// chief-dispatch 的判分函数。独立成模块是为了能脱离模型单测——手册要求在首次
// 全量付费跑之前，先把 oracle（必过）与 null（必挂）喂过整条判分链，否则一个
// 判分 bug 会花一整轮的钱才暴露。

import type { TurnEvidence } from './stack.mts';

export interface RosterAgent {
  key: string;
  displayName: string;
  modelId: string;
  description: string;
}

export interface Case {
  id: string;
  tags: string[];
  prompt: string;
  expect: { kind: 'dispatch' | 'hold'; agent?: string; why?: string };
}

export interface GradedRun {
  evidence: TurnEvidence;
  agentIds: Record<string, string>;
}

/** 判一个 chief 回合。判据读环境终态（todo.assignment），不读 transcript。 */
export function gradeCase(
  input: Case,
  run: GradedRun,
  roster: RosterAgent[],
): {
  grade: Record<string, number>;
  explanation: Record<string, string>;
} {
  const ev = run.evidence;
  const rosterByKey = new Map(roster.map((r) => [r.key, r]));
  const keyOfId = new Map(Object.entries(run.agentIds).map(([k, v]) => [v, k]));

  const dispatched = ev.toolCalls.some((c) => c.name === 'run_builds');
  const pickedKeys = new Set(
    ev.createdTodoRows
      .map((t) => (t.buildAgentId !== null ? (keyOfId.get(t.buildAgentId) ?? null) : null))
      .filter((k): k is string => k !== null),
  );

  const pickedIds = ev.createdTodoRows
    .map((t) => t.buildAgentId)
    .filter((x): x is string => x !== null);

  const expectedKey = input.expect.agent;
  let decision: number;
  let why: string;
  if (input.expect.kind === 'dispatch') {
    const ok = dispatched && expectedKey != null && pickedKeys.has(expectedKey);
    decision = ok ? 1 : 0;
    // 原始 agentId 一并记进说明：agentId 每条栈随机，事后无法从 key 反推，
    // 不记就没法回溯核对「模型到底传了谁的 id」。
    why = ok
      ? `派给 ${expectedKey}（${rosterByKey.get(expectedKey)?.displayName}）id=${[...pickedIds].join(',')}`
      : `期望 ${expectedKey}，实际 dispatched=${dispatched} picked=[${[...pickedKeys].join(',') || '无'}] ids=[${pickedIds.join(',') || '无'}]`;
  } else {
    // 「无回答 ≠ 否定回答」：空回合不得因为「没派工」而被判通过。
    const replied = ev.assistantText !== '' && ev.stepStatus === 'done';
    decision = !dispatched && replied ? 1 : 0;
    why = !dispatched
      ? replied
        ? '未派工且有正文回复'
        : '未派工但无正文（空回合不算通过）'
      : '不该派工却调了 run_builds';
  }

  // 回执：工作约定第 4 条要求派工后点名承接 Agent 的职责语义。
  let receipt: number;
  if (input.expect.kind === 'dispatch') {
    const names = [...pickedKeys].map((k) => rosterByKey.get(k)?.displayName ?? k);
    receipt = names.length > 0 && names.some((n) => ev.assistantText.includes(n)) ? 1 : 0;
  } else {
    receipt = ev.assistantText !== '' ? 1 : 0;
  }

  return {
    grade: { decision_ok: decision, receipt_ok: receipt },
    explanation: { decision_ok: why },
  };
}
