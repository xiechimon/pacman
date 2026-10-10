// 驳回回路 plan v2 + unified diff（#1128 自 chief.test.ts 拆分；判定口径与 M4a 组头注见
// ./chief-harness.ts）。共享 harness 收编位 = ./chief-harness.ts，
// 状态经 H 单出口每用例重绑。

import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { build as buildTable, plan as planTable, step as stepTable } from '../src/db/schema.js';
import { newRecordId, newUuidv7, nowMs } from '../src/lib/ids.js';
import { planDocumentDiff } from '../src/services/documents.js';
import { setTodoPhase } from '../src/services/todos.js';
import { AGENT_ID, H, registerChiefHarness, relay } from './chief-harness.js';
import { req } from './helpers.js';

registerChiefHarness();

// —— AC r5 §4: 驳回 → plan v2 + unified diff ————————————————

describe('驳回回路 plan v2 + unified diff（r5 §4/02 §4.2）', () => {
  test('documents/{id}/diff = plan.md 文件级 unified diff（v1→v2 + hunk 头）', async () => {
    const todoRec = (await relay('create_todo', {
      projectId: H.projectId,
      title: 'plan diff',
      spec: 's',
    })) as {
      id: string;
    };
    const buildId = newUuidv7();
    const now = nowMs();
    H.s.db
      .insert(buildTable)
      .values({
        id: buildId,
        todoId: todoRec.id,
        withPlan: true,
        triggerSource: 'user',
        createdAt: now,
      })
      .run();
    const v1 = ['# 方案', '', 'Context: 后缀用「·r3-lifecycle」。', 'Changes: 改 README。'].join(
      '\n',
    );
    const v2 = [
      '# 方案',
      '',
      'Context: 后缀用「·静态演示页」，不重复项目名。',
      'Changes: 改 README。',
    ].join('\n');
    const id1 = newRecordId();
    const id2 = newRecordId();
    H.s.db
      .insert(planTable)
      .values({ id: id1, buildId, version: 1, content: v1, createdAt: now })
      .run();
    H.s.db
      .insert(planTable)
      .values({ id: id2, buildId, version: 2, content: v2, createdAt: now })
      .run();
    H.s.db.update(buildTable).set({ planDocId: id2 }).where(eq(buildTable.id, buildId)).run();

    const diff = planDocumentDiff(H.s.db, id2);
    expect(diff.fromVersion).toBe(1);
    expect(diff.toVersion).toBe(2);
    expect(diff.files).toHaveLength(1);
    expect(diff.files[0]!.path).toBe('plan.md');
    expect(diff.files[0]!.hunks[0]!.header).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@$/);
    // v2 忠实执行反馈：删「·r3-lifecycle」行、加「·静态演示页」行
    const lines = diff.files[0]!.hunks[0]!.lines;
    expect(lines.some((l) => l.startsWith('-') && l.includes('r3-lifecycle'))).toBe(true);
    expect(lines.some((l) => l.startsWith('+') && l.includes('静态演示页'))).toBe(true);
    expect(diff.files[0]!.additions).toBeGreaterThanOrEqual(1);
    expect(diff.files[0]!.deletions).toBeGreaterThanOrEqual(1);
  });

  test('驳回 → 重规划步入队携带 feedback 指令（v2 忠实执行反馈的宿主半，r5 §4）', async () => {
    const todoRec = (await relay('create_todo', {
      projectId: H.projectId,
      title: 't',
      spec: 's',
    })) as {
      id: string;
    };
    const out = (await relay('run_builds', {
      todoIds: [todoRec.id],
      assignment: { plan: { agentId: AGENT_ID } },
      // withPlan 缺省 = 先规划（#903），无需报文参数。
    })) as { builds: { id: string }[] };
    const buildId = out.builds[0]!.id;
    // run_builds 已置 queued；模拟规划步成 → planning → confirm
    setTodoPhase(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      todoRec.id,
      'planning',
    );
    setTodoPhase(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      todoRec.id,
      'confirm',
    );
    // 驳回
    const res = await req(H.s.app, 'POST', `/api/builds/${buildId}/steps`, {
      action: 'revision',
      side: 'plan',
      feedback: '后缀不要重复项目名',
      clientMessageId: newUuidv7(),
    });
    expect(res.status).toBe(202);
    // 重规划步（plan）携带 feedback 指令 prompt
    const steps = H.s.db.select().from(stepTable).where(eq(stepTable.buildId, buildId)).all();
    const replan = steps.filter((st) => st.kind === 'plan').at(-1)!;
    expect(replan.prompt).toContain('后缀不要重复项目名');
  });
});
