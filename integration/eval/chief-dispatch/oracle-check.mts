#!/usr/bin/env -S pnpm exec tsx
// 判分链自检（build-eval 手册：首次全量付费跑之前必须过）。
//
// 把三种构造出来的回合喂过真判分函数，不看模型、不花钱：
//   oracle — 期望的行为全做对 → 必须 ~100%
//   null   — 空回合（无工具、无正文）→ 必须 ~0%（否则判分太宽）
//   misroute — 派给了别的 Agent → 必须 ~0%（否则判分只看「派没派」不看「派给谁」）
//
// oracle 不过 = 判分或链路坏了；null 不挂 = 判分太松。两条都是几分钟的事，
// 能挡掉大多数要花一整轮钱才暴露的 bug。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Case, gradeCase, type RosterAgent } from './grade.mts';
import type { TurnEvidence } from './stack.mts';

const FLOW = process.argv[2] ?? '.claude/hillclimb/chief-dispatch';
const d = JSON.parse(readFileSync(join(FLOW, 'cases.json'), 'utf8')) as {
  roster: RosterAgent[];
  cases: Case[];
};
const roster = d.roster;
// 评测里每条栈的 agentId 都是现建的随机串；自检里用等价替身。
const agentIds: Record<string, string> = Object.fromEntries(
  roster.map((r) => [r.key, `agent-${r.key}`]),
);
const nameByKey = new Map(roster.map((r) => [r.key, r.displayName]));

/** 自检用的替身 id：真评测里每条栈的 agentId 都是现建的随机串。 */
function pick(key: string): string {
  const id = agentIds[key];
  if (id === undefined) throw new Error(`roster 里没有 ${key}`);
  return id;
}

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

/** 期望行为全做对的回合。 */
function oracle(c: Case): TurnEvidence {
  const ev = base();
  if (c.expect.kind === 'dispatch') {
    const key = c.expect.agent;
    if (key === undefined) throw new Error(`${c.id} 标了 dispatch 却没给 agent`);
    ev.toolCalls = [
      { name: 'create_todo', arguments: {} },
      {
        name: 'run_builds',
        arguments: { todoIds: ['t1'], assignment: { build: { agentId: agentIds[key] } } },
      },
    ];
    ev.runBuildsArgs = [{ todoIds: ['t1'] }];
    ev.createdTodoIds = ['t1'];
    ev.createdTodoRows = [
      {
        id: 't1',
        title: 'x',
        spec: '> 原文\n\n要求：\n- a',
        buildAgentId: pick(key),
        planAgentId: null,
        phase: 'queued',
      },
    ];
    ev.buildRows = [{ id: 'b1', todoId: 't1', withPlan: false, triggerSource: 'chief' }];
    ev.assistantText = `已立任务，由 ${nameByKey.get(key)} 承接。`;
  } else {
    ev.toolCalls = [{ name: 'todos', arguments: {} }];
    ev.assistantText = '当前没有在跑的任务。';
  }
  return ev;
}

/** 空回合：既没派工也没正文。 */
function nullRun(): TurnEvidence {
  return base();
}

/** 派了，但派给别的 Agent（该派 A 却派 B）。 */
function misroute(c: Case): TurnEvidence {
  const ev = oracle(c);
  if (c.expect.kind !== 'dispatch') return ev;
  const other = roster.find((r) => r.key !== c.expect.agent);
  const row = ev.createdTodoRows[0];
  if (other === undefined || row === undefined) throw new Error('misroute 构造前提不成立');
  row.buildAgentId = pick(other.key);
  ev.assistantText = `已立任务，由 ${other.displayName} 承接。`;
  return ev;
}

interface Tally {
  n: number;
  decision: number;
  receipt: number;
}
const tally = (
  label: string,
  mk: (c: Case) => TurnEvidence,
  only?: (c: Case) => boolean,
): Tally => {
  let decision = 0;
  let receipt = 0;
  const bad: string[] = [];
  const scope = d.cases.filter((c) => only?.(c) ?? true);
  for (const c of scope) {
    const g = gradeCase(c, { evidence: mk(c), agentIds }, roster).grade;
    decision += g.decision_ok ?? 0;
    receipt += g.receipt_ok ?? 0;
    if (g.decision_ok !== 1) bad.push(`${c.id}(${g.decision_ok})`);
  }
  const t = { n: scope.length, decision, receipt };
  const pct = ((decision / t.n) * 100).toFixed(0);
  const pctR = ((receipt / t.n) * 100).toFixed(0);
  console.log(
    `${label.padEnd(10)} decision_ok ${decision}/${t.n} (${pct}%)  receipt_ok ${receipt}/${t.n} (${pctR}%)` +
      (bad.length ? `  未过: ${bad.slice(0, 8).join(' ')}${bad.length > 8 ? ' …' : ''}` : ''),
  );
  return t;
};

console.log(`flow=${FLOW}  用例 ${d.cases.length} 条\n`);
const o = tally('oracle', oracle);
const n = tally('null', () => nullRun());
// misroute 只在派工用例上有意义：hold 用例本就不该派工，misroute 对它们原样
// 返回是正确行为，算进去就是假阳性。
const m = tally('misroute', misroute, (c) => c.expect.kind === 'dispatch');

let exit = 0;
if (o.decision !== o.n) {
  console.error(`\n✗ oracle 未达 100%（${o.decision}/${o.n}）——判分或链路坏了，先修再花钱`);
  exit = 1;
}
if (n.decision !== 0) {
  console.error(`\n✗ null 未被拒（${n.decision}/${n.n}）——判分太松，空回合被算通过`);
  exit = 1;
}
if (m.decision !== 0) {
  console.error(`\n✗ misroute 未被拒（${m.decision}/${m.n}）——判分只看「派没派」不看「派给谁」`);
  exit = 1;
}
if (exit === 0) console.log('\n✓ oracle 100% / null 0% / misroute 0%，判分链自检通过');
process.exit(exit);
