// watch/wake 主动回路三触发（#1128 自 chief.test.ts 拆分；判定口径与 M4a 组头注见
// ./chief-harness.ts）。共享 harness 收编位 = ./chief-harness.ts，
// 状态经 H 单出口每用例重绑。

import { CHIEF_WATCH_REASON_DISPATCH } from '@pacman/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { step as stepTable, todo as todoTable } from '../src/db/schema.js';
import { newRecordId, nowMs } from '../src/lib/ids.js';
import { addChiefWatch, getChiefEnvelope, triggerChiefWakes } from '../src/services/chief.js';
import { getTodo, setTodoPhase } from '../src/services/todos.js';
import { AGENT_ID, H, registerChiefHarness, relay } from './chief-harness.js';

registerChiefHarness();

// —— AC r5 §3.5: watch/wake 三触发 ————————————————————————————————————————

describe('watch/wake 主动回路三触发（r5 §3.5）', () => {
  function seedWatchedTodo(): string {
    const id = newRecordId();
    const now = nowMs();
    H.s.db
      .insert(todoTable)
      .values({
        id,
        teamId: H.teamId,
        projectId: H.projectId,
        title: '被关注任务',
        spec: '',
        phase: 'todo',
        phaseAt: now,
        seqNum: 1,
        orderIndex: 0,
        assignment: null,
        latestBuildId: null,
        lastRunAt: null,
        hasChanges: false,
        hasPlan: false,
        sourceTodo: null,
        v: 1,
        createdBy: null,
        ownerId: H.userId,
        sourceBuildId: null,
      })
      .run();
    return id;
  }

  test('run_builds 派工即自动 watch（reason canon）', async () => {
    const todoRec = (await relay('create_todo', {
      projectId: H.projectId,
      title: 't',
      spec: 's',
    })) as {
      id: string;
    };
    await relay('run_builds', {
      todoIds: [todoRec.id],
      assignment: { build: { agentId: AGENT_ID } },
    });
    const env = getChiefEnvelope(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      H.teamId,
    );
    expect(env.watches).toHaveLength(1);
    expect(env.watches[0]!.reason).toBe(CHIEF_WATCH_REASON_DISPATCH);
    expect(env.watches[0]!.todoId).toBe(todoRec.id);
  });

  test('gate 触发（停 review）→ chief wake 步入队，watch 保留', async () => {
    const todoId = seedWatchedTodo();
    const rec = getTodo({ db: H.s.db, hub: H.s.hub, user: H.s.user }, todoId)!;
    addChiefWatch(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      { teamId: H.teamId, todo: rec, projectName: 'demo', threadId: H.threadId },
    );
    // 停驻 review（gate）
    setTodoPhase(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      todoId,
      'queued',
    );
    const before = H.s.db
      .select()
      .from(stepTable)
      .where(eq(stepTable.buildId, H.threadId))
      .all().length;
    triggerChiefWakes(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      getTodo({ db: H.s.db, hub: H.s.hub, user: H.s.user }, todoId)!,
      'review',
    );
    const after = H.s.db.select().from(stepTable).where(eq(stepTable.buildId, H.threadId)).all();
    expect(after.length).toBe(before + 1);
    expect(after.at(-1)!.kind).toBe('chief');
    expect(after.at(-1)!.prompt).toContain('[wake:gate]');
    // watch 保留（gate 不解除）
    const env = getChiefEnvelope(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      H.teamId,
    );
    expect(env.watches).toHaveLength(1);
  });

  test('settle 触发（done）→ wake + watch 自动解除（r5 §3.5）', async () => {
    const todoId = seedWatchedTodo();
    const rec = getTodo({ db: H.s.db, hub: H.s.hub, user: H.s.user }, todoId)!;
    addChiefWatch(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      { teamId: H.teamId, todo: rec, projectName: 'demo', threadId: H.threadId },
    );
    triggerChiefWakes(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      rec,
      'done',
    );
    const steps = H.s.db.select().from(stepTable).where(eq(stepTable.buildId, H.threadId)).all();
    expect(steps.at(-1)!.prompt).toContain('[wake:settle]');
    const env = getChiefEnvelope(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      H.teamId,
    );
    expect(env.watches).toHaveLength(0); // settle 后自动解除
  });

  test('failed 触发 → wake（法证式汇报指引）+ watch 自动解除', async () => {
    const todoId = seedWatchedTodo();
    const rec = getTodo({ db: H.s.db, hub: H.s.hub, user: H.s.user }, todoId)!;
    addChiefWatch(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      { teamId: H.teamId, todo: rec, projectName: 'demo', threadId: H.threadId },
    );
    triggerChiefWakes(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      rec,
      'failed',
    );
    const steps = H.s.db.select().from(stepTable).where(eq(stepTable.buildId, H.threadId)).all();
    expect(steps.at(-1)!.prompt).toContain('[wake:failed]');
    expect(steps.at(-1)!.prompt).toContain('machines'); // 先调 machines 工具核实环境
    const env = getChiefEnvelope(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      H.teamId,
    );
    expect(env.watches).toHaveLength(0);
  });
});
