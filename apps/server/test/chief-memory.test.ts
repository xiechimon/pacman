// save_memory 写路径（#1128 自 chief.test.ts 拆分；判定口径与 M4a 组头注见
// ./chief-harness.ts）。共享 harness 收编位 = ./chief-harness.ts，
// 状态经 H 单出口每用例重绑。

import { describe, expect, test } from 'vitest';
import { agentMemory } from '../src/db/schema.js';
import { HttpError } from '../src/lib/errors.js';
import { newRecordId, nowMs } from '../src/lib/ids.js';
import { AGENT_ID, H, registerChiefHarness, relay } from './chief-harness.js';

registerChiefHarness();

// —— AC r5 §6: memory save_memory（指令触发 + 溯源 + 配额）———————————————

describe('save_memory 写路径（r5 §6）', () => {
  test('条目含三级溯源（sourceBuildId = chief conv id）', async () => {
    const mem = (await relay('save_memory', {
      title: 't',
      content: 'c',
      projectId: H.projectId,
    })) as {
      agentId: string;
      sourceBuildId: string | null;
      projectId: string | null;
    };
    expect(mem.agentId).toBe(AGENT_ID); // 共用绑定 Agent 存储
    expect(mem.sourceBuildId).toBe(H.threadId);
    expect(mem.projectId).toBe(H.projectId);
  });

  test('配额 100 条/Agent（超出 → 409）', async () => {
    for (let i = 0; i < 100; i++) {
      H.s.db
        .insert(agentMemory)
        .values({
          id: newRecordId(),
          agentId: AGENT_ID,
          teamId: H.teamId,
          title: `m${i}`,
          content: 'c',
          projectId: null,
          sourceTodoId: null,
          sourceBuildId: null,
          createdAt: nowMs(),
          updatedAt: nowMs(),
        })
        .run();
    }
    let threw = false;
    try {
      await relay('save_memory', { title: 'overflow', content: 'c' });
    } catch (err) {
      threw = err instanceof HttpError && err.status === 409;
    }
    expect(threw).toBe(true);
  });

  test('memories 读回 + delete_memory', async () => {
    const mem = (await relay('save_memory', { title: 'x', content: 'y' })) as { id: string };
    const list = (await relay('memories', {})) as { id: string }[];
    expect(list.some((m) => m.id === mem.id)).toBe(true);
    await relay('delete_memory', { memoryId: mem.id });
    const after = (await relay('memories', {})) as { id: string }[];
    expect(after.some((m) => m.id === mem.id)).toBe(false);
  });
});
