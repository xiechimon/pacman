// XMON-46 兜底模型列表（agent 配置面）的纯逻辑钉面。失败方式先列后写：
//
//   F1  把主模型本身加进兜底列表 —— 出重复行，且 server 写面会把它剥掉，
//       界面回显与服务端真值不一致
//   F2  重复添加同一条 —— 列表出两行同样的兜底模型
//   F3  删除中间一条 —— 其余条目顺序被打乱
//   F4  首条上移 / 末条下移 —— 越界后条目跑位或数组长度变化
//   F5  相邻换位没真的换 —— 排序钮是摆设
//   F6  主模型换成列表里已有的模型 —— 存量条目留在列表里（server 会剥，
//       界面显示与服务端真值分叉）
//   F7  create 面空列表仍带 fallbackModels: [] —— 「空 = 现行为」的提交形状
//       被改写成显式空数组
//   F8  create 面非空列表没带上下文 —— 选的兜底模型提交不上去
//   F9  patch 面空列表被吞成「不带字段」—— 用户清空最后一档后服务端仍留旧值
//   F10 行只出模型名 —— 两个 provider 供同名模型（r3-gw/claude-sonnet-5 与
//       claude-code/claude-sonnet-5）时两行长得一模一样，有序列表的序读不出来
//
// 渲染侧（弹层几何、行内按钮）由 e2e/agent-fallback-models.spec.ts 钉。

import { describe, expect, test } from 'vitest';
import type { ModelOption } from '../src/fixtures/records.js';
import {
  addFallback,
  createFallbackBody,
  fallbackCandidates,
  fallbackLabel,
  fallbackProvider,
  mainChangePrune,
  moveFallback,
  patchFallbackBody,
  pruneMainDupe,
  removeFallback,
  type FallbackEntry,
} from '../src/routes/agent-fallback-models.js';

const OPTIONS: ModelOption[] = [
  { provider: 'r3-gw', providerLabel: 'r3-gw', modelId: 'claude-sonnet-5', modelName: 'claude-sonnet-5' },
  { provider: 'r3-gw', providerLabel: 'r3-gw', modelId: 'claude-opus-5', modelName: 'claude-opus-5' },
  { provider: 'claude-code', providerLabel: 'Claude Code', modelId: 'sonnet', modelName: 'sonnet' },
];

const MAIN = { provider: 'r3-gw', modelId: 'claude-sonnet-5' };
const OPUS: FallbackEntry = { provider: 'r3-gw', modelId: 'claude-opus-5' };
const CC: FallbackEntry = { provider: 'claude-code', modelId: 'sonnet' };

describe('兜底模型列表（XMON-46）', () => {
  test('F1/F2: 候选挖去主模型与已选条目，加不进去重复项', () => {
    expect(fallbackCandidates(OPTIONS, MAIN, [])).toEqual([OPTIONS[1], OPTIONS[2]]);
    expect(fallbackCandidates(OPTIONS, MAIN, [OPUS])).toEqual([OPTIONS[2]]);
    // addFallback 自身也幂等——候选过滤之外的第二道闸
    expect(addFallback([OPUS], OPUS)).toEqual([OPUS]);
  });

  test('F1: 主模型未配 provider（null 槽）时按 provider null 比对', () => {
    // provider 空槽 = 沿用 agent.provider；选项的 provider 是实串，只有主模型
    // 自己也用同一个实串才可能撞上。主模型模型未配 → 候选不挖。
    expect(fallbackCandidates(OPTIONS, { provider: null, modelId: null }, [])).toHaveLength(3);
  });

  test('F3: 删除中间一条其余保序', () => {
    expect(removeFallback([OPUS, CC], 0)).toEqual([CC]);
    expect(removeFallback([OPUS], 0)).toEqual([]);
  });

  test('F4: 越界的上移/下移是空操作', () => {
    const list = [OPUS, CC];
    expect(moveFallback(list, 0, -1)).toEqual(list);
    expect(moveFallback(list, 1, 1)).toEqual(list);
    expect(list).toEqual([OPUS, CC]); // 纯函数，不改入参
  });

  test('F5: 相邻换位真的换位', () => {
    expect(moveFallback([OPUS, CC], 0, 1)).toEqual([CC, OPUS]);
    expect(moveFallback([OPUS, CC], 1, -1)).toEqual([CC, OPUS]);
  });

  test('F6: 主模型换成列表里已有的模型，存量条目被剥离', () => {
    expect(pruneMainDupe([OPUS, CC], { provider: 'r3-gw', modelId: 'claude-opus-5' })).toEqual([CC]);
    expect(pruneMainDupe([OPUS, CC], MAIN)).toEqual([OPUS, CC]);
    // 主模型未配 → 无可重复
    expect(pruneMainDupe([OPUS], { provider: null, modelId: null })).toEqual([OPUS]);
  });

  test('F6: 换主模型只在真剥掉条目时才带字段（未变 → null）', () => {
    expect(mainChangePrune([OPUS, CC], MAIN)).toBeNull();
    expect(mainChangePrune([OPUS, CC], { provider: 'r3-gw', modelId: 'claude-opus-5' })).toEqual([CC]);
  });

  test('F7/F8: create 面空列表不带字段，非空带有序数组', () => {
    expect(createFallbackBody([])).toEqual({});
    expect(createFallbackBody([OPUS, CC])).toEqual({ fallbackModels: [OPUS, CC] });
  });

  test('F9: patch 面恒带字段——[] = 清空，不是「未动」', () => {
    expect(patchFallbackBody([])).toEqual({ fallbackModels: [] });
    expect(patchFallbackBody([CC])).toEqual({ fallbackModels: [CC] });
  });

  test('行标签：选项命中出模型名，未命中出裸 provider/modelId', () => {
    expect(fallbackLabel(OPUS, MAIN, OPTIONS)).toBe('claude-opus-5');
    expect(fallbackLabel({ provider: 'gone', modelId: 'x' }, MAIN, OPTIONS)).toBe('gone/x');
    // provider 空槽 = 沿用 agent.provider（server 写面同律）
    expect(fallbackLabel({ provider: null, modelId: 'claude-opus-5' }, MAIN, OPTIONS)).toBe(
      'claude-opus-5',
    );
    expect(fallbackLabel({ provider: null, modelId: 'x' }, MAIN, OPTIONS)).toBe('r3-gw/x');
    // 两侧都无 provider：只剩模型名，不出空 provider 前缀
    expect(
      fallbackLabel({ provider: null, modelId: 'x' }, { provider: null, modelId: null }, OPTIONS),
    ).toBe('x');
  });

  test('F10: 行右侧 provider 标签——同名模型靠它分档，未命中不出', () => {
    expect(fallbackProvider(OPUS, MAIN, OPTIONS)).toBe('r3-gw');
    expect(fallbackProvider(CC, MAIN, OPTIONS)).toBe('Claude Code');
    // provider 空槽 = 沿用主模型的 provider（标签按解析后的 provider 出）
    expect(fallbackProvider({ provider: null, modelId: 'claude-opus-5' }, MAIN, OPTIONS)).toBe(
      'r3-gw',
    );
    // 选项未命中：名字已是裸串 `provider/modelId`，不再重复挂 provider
    expect(fallbackProvider({ provider: 'gone', modelId: 'x' }, MAIN, OPTIONS)).toBeNull();
    expect(
      fallbackProvider({ provider: null, modelId: 'x' }, { provider: null, modelId: null }, OPTIONS),
    ).toBeNull();
  });
});