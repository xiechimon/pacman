// 收单回落（#774）（#1128 自 chief.test.ts 拆分；判定口径与 M4a 组头注见
// ./chief-harness.ts）。共享 harness 收编位 = ./chief-harness.ts，
// 状态经 H 单出口每用例重绑。

import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { chief as chiefTable, step as stepTable } from '../src/db/schema.js';
import { sendChiefMessage } from '../src/services/chief.js';
import { claudeHome, H, registerChiefHarness } from './chief-harness.js';

registerChiefHarness();

// —— AC: 收单回落（#774）：存量主模型槽不在候选里 → 同步愈合 + 上报 ————————

describe('收单回落：存量主模型槽不在候选里 → 同步愈合 + 上报（#774）', () => {
  function setSlot(value: { provider: string; modelId: string } | null) {
    H.s.db.update(chiefTable).set({ model: value }).where(eq(chiefTable.id, H.chiefId)).run();
  }
  function slotNow() {
    return (
      H.s.db
        .select({ model: chiefTable.model })
        .from(chiefTable)
        .where(eq(chiefTable.id, H.chiefId))
        .get()?.model ?? null
    );
  }
  function send(opts?: { homeDir?: string }) {
    return sendChiefMessage(
      { db: H.s.db, hub: H.s.hub, machineHub: H.s.machineHub, user: H.s.user },
      H.teamId,
      { threadId: null, content: '回落探针。' },
      opts,
    );
  }

  test('槽 null → 无动作（最常见路零语义变化）', () => {
    const res = send({ homeDir: claudeHome(JSON.stringify({ model: 'new-model' })) });
    expect(res.modelFallback).toBeNull();
    expect(slotNow()).toBeNull();
  });

  test('槽命中候选 → 保留 + modelFallback null', () => {
    setSlot({ provider: 'claude-code', modelId: 'new-model' });
    const res = send({ homeDir: claudeHome(JSON.stringify({ model: 'new-model' })) });
    expect(res.modelFallback).toBeNull();
    expect(slotNow()).toEqual({ provider: 'claude-code', modelId: 'new-model' });
  });

  test('槽 stale（claude-code 旧 id）→ 置 null + 上报原值 + 回合照常入队', () => {
    const stale = { provider: 'claude-code', modelId: 'old-model' };
    setSlot(stale);
    const res = send({ homeDir: claudeHome(JSON.stringify({ model: 'new-model' })) });
    expect(res.modelFallback).toEqual(stale);
    expect(slotNow()).toBeNull();
    // 回落不是拒收：回合照常入队，claim 读到的是愈合后的 null（= 继承）。
    const steps = H.s.db.select().from(stepTable).where(eq(stepTable.buildId, res.thread.id)).all();
    expect(steps).toHaveLength(1);
    expect(steps[0]!.status).toBe('pending');
  });

  test('custom provider 存量值（无对应段）→ 不动（执行面仍可用，候选面无权裁决）', () => {
    const custom = { provider: 'my-relay', modelId: 'm-x' };
    setSlot(custom);
    const res = send({ homeDir: claudeHome(JSON.stringify({ model: 'new-model' })) });
    expect(res.modelFallback).toBeNull();
    expect(slotNow()).toEqual(custom);
  });

  test('settings.json 缺失（段空）→ claude-code 存量值照样愈合', () => {
    const stale = { provider: 'claude-code', modelId: 'old-model' };
    setSlot(stale);
    const res = send({ homeDir: claudeHome() });
    expect(res.modelFallback).toEqual(stale);
    expect(slotNow()).toBeNull();
  });
});
