// AI 审核默认选人（#509）——失败方式枚举先行，本文件是场景固化（仓测试规则 3）。
// 被测是纯判定：给定候选集（含 provider）与指派形态，输出「默认选中谁」+ 独立
// 性三态。不断言内部怎么算（GPS 票面 Testing Decisions：只测外部行为）。
//
// 场景清单（票面「必须覆盖的失败场景」逐条 + 两条边界）：
//   S1 执行侧与规划侧被指派给不同厂商 → 默认与**执行侧**跨厂商，不是与规划侧
//   S2 执行侧未指派、规划侧有指派 → 以规划侧为对照基准
//   S3 两侧都未指派 → 默认值确定，且不声称具备独立性
//   S4 团队内全部 Agent 同厂商 → 判定同源，默认值仍确定
//   S5 多个跨厂商候选 → 默认稳定（重复求值一致；与输入序无关）
//   S6 Agent 未配置 provider → 不被误判为「跨厂商」
//   S7 候选集为空 → 无默认，不崩
//   S8 产出槽指向的 Agent 不在候选集（已删/不可见）→ 无基准，不声称独立

import { describe, expect, it } from 'vitest';
import {
  classifyReviewChoice,
  resolveReviewDefault,
  type ReviewCandidate,
} from '../src/detail/review-default.js';

function candidate(id: string, provider: string | null): ReviewCandidate {
  return { id, name: id, model: 'm1', provider };
}

/** 跨厂商四行探针：两个厂商各两名；列表次序刻意既非 id 序也非厂商序（首行
 *  r-y 在任何一种基准下都不是跨厂商候选），用来区分「按厂商+稳定序挑对了」
 *  与「碰巧撞上第一行」。 */
const FOUR = [
  candidate('r-y', 'vendor-b'),
  candidate('r-x', 'vendor-a'),
  candidate('agent-b', 'vendor-b'),
  candidate('agent-a', 'vendor-a'),
];

describe('classifyReviewChoice', () => {
  it('厂商不同 → cross-vendor', () => {
    expect(classifyReviewChoice(candidate('r', 'vendor-b'), 'vendor-a')).toBe('cross-vendor');
  });

  it('厂商相同 → same-vendor', () => {
    expect(classifyReviewChoice(candidate('r', 'vendor-a'), 'vendor-a')).toBe('same-vendor');
  });

  it('候选未配置 provider → 不误判为跨厂商', () => {
    expect(classifyReviewChoice(candidate('r', null), 'vendor-a')).toBe('undetermined');
  });

  it('产出侧无基准（provider 未知）→ 不声称跨厂商', () => {
    expect(classifyReviewChoice(candidate('r', 'vendor-a'), null)).toBe('undetermined');
  });
});

describe('resolveReviewDefault', () => {
  it('S1 执行侧与规划侧不同厂商 → 默认以执行侧为基准，不是规划侧', () => {
    // build = vendor-b 侧、plan = vendor-a 侧。以 build 为基准时跨厂商集是
    // {agent-a, r-x}（vendor-a）；以 plan 为基准时跨厂商集是 {agent-b, r-y}
    // （vendor-b）——两侧给出不同答案，故本断言能区分基准取的是哪一槽。
    const out = resolveReviewDefault({
      candidates: FOUR,
      assignment: { build: { agentId: 'agent-b' }, plan: { agentId: 'agent-a' } },
    });
    expect(out.producerProvider).toBe('vendor-b');
    expect(out.independence).toBe('cross-vendor');
    expect(out.defaultAgentId).toBe('agent-a');
  });

  it('S2 执行侧未指派、规划侧有指派 → 回退规划侧作对照基准', () => {
    const out = resolveReviewDefault({
      candidates: FOUR,
      assignment: { build: null, plan: { agentId: 'agent-a' } },
    });
    expect(out.producerProvider).toBe('vendor-a');
    expect(out.independence).toBe('cross-vendor');
    expect(out.defaultAgentId).toBe('agent-b');
  });

  it('S3 两侧都未指派 → 默认值确定，且不声称具备独立性', () => {
    const first = resolveReviewDefault({ candidates: FOUR, assignment: null });
    expect(first.producerProvider).toBeNull();
    expect(first.independence).toBe('undetermined');
    expect(first.defaultAgentId).toBe('agent-a');

    const second = resolveReviewDefault({
      candidates: FOUR,
      assignment: { build: null, plan: null },
    });
    expect(second.defaultAgentId).toBe(first.defaultAgentId);
    expect(second.independence).toBe('undetermined');
  });

  it('S4 团队内全部 Agent 同厂商 → 判定同源，默认值仍确定', () => {
    const same = [
      candidate('agent-a', 'vendor-a'),
      candidate('agent-b', 'vendor-a'),
      candidate('r-x', 'vendor-a'),
    ];
    const out = resolveReviewDefault({
      candidates: same,
      assignment: { build: { agentId: 'agent-b' }, plan: null },
    });
    expect(out.independence).toBe('same-vendor');
    expect(out.defaultAgentId).toBe('agent-a');
  });

  it('S5 多个跨厂商候选 → 默认稳定，且与输入序无关', () => {
    const assignment = { build: { agentId: 'agent-b' }, plan: null };
    const forward = resolveReviewDefault({ candidates: FOUR, assignment });
    const reversed = resolveReviewDefault({ candidates: [...FOUR].reverse(), assignment });
    const again = resolveReviewDefault({ candidates: FOUR, assignment });
    expect(forward.defaultAgentId).toBe('agent-a');
    expect(reversed.defaultAgentId).toBe(forward.defaultAgentId);
    expect(again.defaultAgentId).toBe(forward.defaultAgentId);
  });

  it('S5b 全体候选跨厂商（无产出同厂商行）→ 仍取稳定序第一', () => {
    const out = resolveReviewDefault({
      candidates: [
        candidate('r-z', 'vendor-c'),
        candidate('r-a', 'vendor-c'),
        candidate('producer', 'vendor-a'),
      ],
      assignment: { build: { agentId: 'producer' }, plan: null },
    });
    expect(out.independence).toBe('cross-vendor');
    expect(out.defaultAgentId).toBe('r-a');
  });

  it('S6a 未配置 provider 的候选不入跨厂商集，但仍是可选的确定默认', () => {
    const out = resolveReviewDefault({
      candidates: [candidate('agent-a', 'vendor-a'), candidate('r-null', null)],
      assignment: { build: { agentId: 'agent-a' }, plan: null },
    });
    // 无跨厂商候选 → 降级到全集的稳定序第一（agent-a）；判定按其真实事实
    // 报同源，而不是把 r-null 说成跨厂商。
    expect(out.defaultAgentId).toBe('agent-a');
    expect(out.independence).toBe('same-vendor');
  });

  it('S6b 存在跨厂商候选时不因未配置行而抖动', () => {
    const out = resolveReviewDefault({
      candidates: [
        candidate('agent-a', 'vendor-a'),
        candidate('r-null', null),
        candidate('r-b', 'vendor-b'),
      ],
      assignment: { build: { agentId: 'agent-a' }, plan: null },
    });
    expect(out.defaultAgentId).toBe('r-b');
    expect(out.independence).toBe('cross-vendor');
  });

  it('S7 候选集为空 → 无默认', () => {
    const out = resolveReviewDefault({
      candidates: [],
      assignment: { build: { agentId: 'agent-a' }, plan: null },
    });
    expect(out.defaultAgentId).toBeNull();
    expect(out.independence).toBe('undetermined');
  });

  it('S8 产出槽指向的 Agent 不在候选集 → 无基准，不声称独立', () => {
    const out = resolveReviewDefault({
      candidates: FOUR,
      assignment: { build: { agentId: 'agent-gone' }, plan: null },
    });
    expect(out.producerProvider).toBeNull();
    expect(out.independence).toBe('undetermined');
    expect(out.defaultAgentId).toBe('agent-a');
  });
});