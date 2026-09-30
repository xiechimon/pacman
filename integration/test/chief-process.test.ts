// 过程评分的失败场景固化。先写测试后写实现（AGENTS.md「要测就先于实现」）。
//
// 为什么需要过程评分：chief-dispatch 的结果判据（grade.mts）只输出
// decision_ok / receipt_ok 两个布尔加一句 why。metrics.md 记录的主失败形态——
// 正文写对了名字、实参传了另一个 Agent 的 id——落在 receipt_ok=0 上，但分数
// 本身说不清是「名字点错了」还是「id 抄错了」。本模块把那一个 0 拆成定位到
// 具体调用/具体行的 finding。
//
// 判据只读外部可见面（工具实参、落库行、正文），不读模型思维链；与 TRACES 的
// process verification 同纪律，但只做可程序化的那几维——语义维（Alternatives
// 的论证质量、Scope）留给模型裁判，本模块显式记 unobserved 而不是假装覆盖。

import { describe, expect, test } from 'vitest';
import type { Case, RosterAgent } from '../eval/chief-dispatch/grade.mts';
import { scoreTrace } from '../eval/chief-dispatch/process.mts';
import type { TurnEvidence } from '../eval/chief-dispatch/stack.mts';

/** 与 .claude/hillclimb/chief-dispatch/cases.json 同形的四人编制。分类信息只
 * 存在于 description 里，显示名是花名——评测靠这个堵「按名字猜分类」的捷径，
 * 本模块也因此必须用 description 之外的 id↔名字映射，不能靠名字语义。 */
const roster: RosterAgent[] = [
  { key: 'doc', displayName: '阿岚', modelId: 'qwen3.8-max', description: '文档' },
  { key: 'code', displayName: '老周', modelId: 'glm-5.3', description: '后端' },
  { key: 'frontend', displayName: '小柯', modelId: 'kimi-k3', description: '前端' },
  { key: 'ops', displayName: '铁手', modelId: 'glm-5.3', description: '运维' },
];

/** 每条栈的 agentId 都是现建的随机串，自检用等价替身。 */
const agentIds: Record<string, string> = {
  doc: 'a-doc',
  code: 'a-code',
  frontend: 'a-front',
  ops: 'a-ops',
};

const dispatchCase = (agent: string): Case => ({
  id: 'x',
  tags: [],
  prompt: 'p',
  expect: { kind: 'dispatch', agent },
});

const holdCase: Case = { id: 'h', tags: [], prompt: 'p', expect: { kind: 'hold' } };

function base(): TurnEvidence {
  return {
    threadId: 't',
    stepStatus: 'done',
    toolCalls: [],
    runBuildsArgs: [],
    assistantText: '',
    createdTodoIds: [],
    createdTodoRows: [],
    buildRows: [],
    model: 'glm-5.3',
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    wallMs: 0,
  };
}

const row = (todoId: string, buildAgentId: string | null) => ({
  id: todoId,
  title: 'x',
  spec: 's',
  buildAgentId,
  planAgentId: null,
  phase: 'queued',
});

const find = (s: ReturnType<typeof scoreTrace>, check: string) => {
  const f = s.findings.find((x) => x.check === check);
  if (f === undefined) throw new Error(`没有 ${check} 这条 finding`);
  return f;
};

describe('tools.assignment_resolvable', () => {
  test('落库 agentId 解析不到 roster 时判失败并指出那个 id', () => {
    const ev = base();
    ev.createdTodoRows = [row('t1', 'a-ghost')];
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: dispatchCase('ops').expect });
    const f = find(s, 'tools.assignment_resolvable');
    expect(f.ok).toBe(false);
    expect(f.detail).toContain('a-ghost');
  });

  test('实参里的 agentId 解析不到 roster 时也判失败（落库行还没出现）', () => {
    const ev = base();
    ev.runBuildsArgs = [{ todoIds: ['t1'], assignment: { build: { agentId: 'a-ghost' } } }];
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: dispatchCase('ops').expect });
    expect(find(s, 'tools.assignment_resolvable').ok).toBe(false);
  });

  test('全部解析得到时通过', () => {
    const ev = base();
    ev.createdTodoRows = [row('t1', 'a-ops')];
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: dispatchCase('ops').expect });
    expect(find(s, 'tools.assignment_resolvable').ok).toBe(true);
  });
});

describe('tools.attribution_consistent（承重检查）', () => {
  // metrics.md「失败形态 1」的复刻：正文从头到尾写对了名字，实参/落库是另一个
  // Agent 的 id。任何只读叙述的裁判会给它满分。
  test('正文点名铁手、落库是小柯的 id 时判失败，且两个名字都出现在 detail 里', () => {
    const ev = base();
    ev.createdTodoRows = [row('t1', 'a-front')];
    ev.assistantText = '已立任务，由 [铁手](agent:a-ops) 承接运维职责。';
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: dispatchCase('ops').expect });
    const f = find(s, 'tools.attribution_consistent');
    expect(f.ok).toBe(false);
    expect(f.detail).toContain('铁手');
    expect(f.detail).toContain('小柯');
    expect(f.locus).toContain('t1');
  });

  test('正文引用 id 与落库一致时通过', () => {
    const ev = base();
    ev.createdTodoRows = [row('t1', 'a-ops')];
    ev.assistantText = '已立任务，由 [铁手](agent:a-ops) 承接。';
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: dispatchCase('ops').expect });
    expect(find(s, 'tools.attribution_consistent').ok).toBe(true);
  });

  test('正文只写显示名（无 id 形式）时仍按显示名比对', () => {
    const ev = base();
    ev.createdTodoRows = [row('t1', 'a-front')];
    ev.assistantText = '已立任务，由铁手承接。';
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: dispatchCase('ops').expect });
    expect(find(s, 'tools.attribution_consistent').ok).toBe(false);
  });

  test('未派工的回合该检查为未观测（null），不得记为通过', () => {
    const ev = base();
    ev.assistantText = '当前没有在跑的任务。';
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: holdCase.expect });
    expect(find(s, 'tools.attribution_consistent').ok).toBeNull();
  });
});

describe('evidence.mentioned_agents_exist', () => {
  test('正文引用了一个不存在的 agent id 时判失败（幻觉引用的可程序化形态）', () => {
    const ev = base();
    ev.assistantText = '已派给 [老王](agent:a-nobody)。';
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: holdCase.expect });
    const f = find(s, 'evidence.mentioned_agents_exist');
    expect(f.ok).toBe(false);
    expect(f.detail).toContain('a-nobody');
  });

  test('正文未引用任何 id 形式时为未观测', () => {
    const ev = base();
    ev.assistantText = '好的。';
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: holdCase.expect });
    expect(find(s, 'evidence.mentioned_agents_exist').ok).toBeNull();
  });
});

describe('repair', () => {
  test('工具报错后同名工具重试（新实参）判通过', () => {
    const ev = base();
    ev.toolCalls = [
      {
        name: 'run_builds',
        arguments: { assignment: { build: { agentId: 'a-ghost' } } },
        isError: true,
      },
      { name: 'run_builds', arguments: { assignment: { build: { agentId: 'a-ops' } } } },
    ];
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: dispatchCase('ops').expect });
    expect(find(s, 'repair.retry_after_error').ok).toBe(true);
  });

  test('工具报错后没有重试判失败并指出那个工具', () => {
    const ev = base();
    ev.toolCalls = [{ name: 'run_builds', arguments: {}, isError: true }];
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: dispatchCase('ops').expect });
    const f = find(s, 'repair.retry_after_error');
    expect(f.ok).toBe(false);
    expect(f.detail).toContain('run_builds');
  });

  test('没有工具报错的回合为未观测', () => {
    const ev = base();
    ev.toolCalls = [{ name: 'todos', arguments: {} }];
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: holdCase.expect });
    expect(find(s, 'repair.retry_after_error').ok).toBeNull();
  });

  test('同名同实参重复失败判失败（重复调用率同源）', () => {
    const ev = base();
    const args = { todoIds: ['t1'] };
    ev.toolCalls = [
      { name: 'run_builds', arguments: args, isError: true },
      { name: 'run_builds', arguments: args, isError: true },
    ];
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: dispatchCase('ops').expect });
    expect(find(s, 'repair.no_repeat_failed_call').ok).toBe(false);
  });
});

describe('coherence', () => {
  test('步以失败收场时判失败（轨迹不完整）', () => {
    const ev = base();
    ev.stepStatus = 'failed';
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: holdCase.expect });
    const f = find(s, 'coherence.step_completed');
    expect(f.ok).toBe(false);
    expect(f.detail).toContain('failed');
  });

  test('多行派给不同 Agent 而正文只点了一个名时判失败', () => {
    const ev = base();
    ev.createdTodoRows = [row('t1', 'a-ops'), row('t2', 'a-doc')];
    ev.assistantText = '两件事都交给铁手了。';
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: dispatchCase('ops').expect });
    const f = find(s, 'coherence.narrative_covers_all_rows');
    expect(f.ok).toBe(false);
    expect(f.detail).toContain('阿岚');
  });

  test('正文点全了所有承接者时通过', () => {
    const ev = base();
    ev.createdTodoRows = [row('t1', 'a-ops'), row('t2', 'a-doc')];
    ev.assistantText = '运维交给铁手，文档交给阿岚。';
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: dispatchCase('ops').expect });
    expect(find(s, 'coherence.narrative_covers_all_rows').ok).toBe(true);
  });
});

describe('alternatives.hold_honest', () => {
  test('该守住的场景没派工且有正文 → 通过', () => {
    const ev = base();
    ev.toolCalls = [{ name: 'todos', arguments: {} }];
    ev.assistantText = '当前没有在跑的任务。';
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: holdCase.expect });
    expect(find(s, 'alternatives.hold_honest').ok).toBe(true);
  });

  test('该守住的场景却派了工 → 失败（过早承诺）', () => {
    const ev = base();
    ev.toolCalls = [{ name: 'run_builds', arguments: {} }];
    ev.createdTodoRows = [row('t1', 'a-ops')];
    ev.assistantText = '已派给铁手。';
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: holdCase.expect });
    expect(find(s, 'alternatives.hold_honest').ok).toBe(false);
  });

  // 与 metrics.md「无回答 ≠ 否定回答」同源：空回合不得因为「没派工」被算通过，
  // 也不得被算失败——它是未观测。
  test('该守住的场景是空回合 → 未观测，不算通过也不算失败', () => {
    const ev = base();
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: holdCase.expect });
    expect(find(s, 'alternatives.hold_honest').ok).toBeNull();
  });
});

describe('汇总与覆盖声明', () => {
  test('byDimension 把 pass/fail/unobserved 分开计数', () => {
    const ev = base();
    ev.createdTodoRows = [row('t1', 'a-front')];
    ev.assistantText = '由铁手承接。';
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: dispatchCase('ops').expect });
    const t = s.byDimension.tools;
    expect(t.fail).toBe(1);
    expect(t.pass).toBe(1);
    expect(t.unobserved).toBe(0);
  });

  test('语义维（alternatives 的论证质量、scope）显式记 unobserved，不假装覆盖', () => {
    const ev = base();
    ev.assistantText = '好的。';
    const s = scoreTrace({ evidence: ev, roster, agentIds, expect: holdCase.expect });
    expect(find(s, 'alternatives.argument_quality').ok).toBeNull();
    expect(find(s, 'scope.limits_stated').ok).toBeNull();
  });

  test('roster 内显示名撞车时不猜，记未观测并说明歧义', () => {
    const dup: RosterAgent[] = [
      ...roster,
      { key: 'dup', displayName: '铁手', modelId: 'glm-5.3', description: '同名' },
    ];
    const dupIds: Record<string, string> = { ...agentIds, dup: 'a-dup' };
    const ev = base();
    ev.createdTodoRows = [row('t1', 'a-ops')];
    ev.assistantText = '由铁手承接。';
    const s = scoreTrace({
      evidence: ev,
      roster: dup,
      agentIds: dupIds,
      expect: dispatchCase('ops').expect,
    });
    const f = find(s, 'tools.attribution_consistent');
    expect(f.ok).toBeNull();
    expect(f.detail).toContain('歧义');
  });
});
