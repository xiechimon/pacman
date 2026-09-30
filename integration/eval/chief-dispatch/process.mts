// chief 回合的过程评分：只读外部可见面（工具实参、落库行、正文），零模型调用。
//
// 为什么要有这一层：结果判据（grade.mts）输出 decision_ok / receipt_ok 两个布尔
// 加一句 why。metrics.md 记录的主失败形态——正文写对了名字、实参却是另一个
// Agent 的 id——只落在 receipt_ok=0 上，从分数本身看不出是「名字点错了」还是
// 「id 抄错了」。本模块把那一个 0 拆成定位到具体调用/具体行的 finding。
//
// 与 TRACES 的 process verification 同纪律（判据不看模型思维链、不读私有推理），
// 但只做可程序化的那几维：语义维（Alternatives 的论证质量、Scope）显式记
// unobserved，不假装覆盖——用规则判语义会退化成关键词匹配，比不做更坏。
//
// 三态而非二态：每条检查的 ok 取 true / false / null。null = 这一回合里观测不到
// 这个信号（没派工、没工具报错、空回合）。未观测既不算通过也不算失败——把它折进
// 「通过」会让空回合凭空白得分数，折进「失败」会把链路方差记到模型账上。
// metrics.md 的「无回答 ≠ 否定回答」是同一条纪律在结果侧的写法。

import type { Case, RosterAgent } from './grade.mts';
import type { TurnEvidence } from './stack.mts';

export type ProcessDimension =
  | 'tools'
  | 'repair'
  | 'alternatives'
  | 'coherence'
  | 'evidence'
  | 'scope';

export interface ProcessFinding {
  dimension: ProcessDimension;
  /** 稳定 id，跨 run 可聚合（如 "tools.attribution_consistent"）。 */
  check: string;
  /** null = 本回合观测不到该信号。 */
  ok: boolean | null;
  /** 定位信息。原始 id 一并记入：agentId 每条栈随机，事后无法从 key 反推。 */
  detail: string;
  /** 出问题的落点（todo 行 id 或工具调用下标），便于点进去复核。 */
  locus?: string;
}

export interface ProcessScore {
  findings: ProcessFinding[];
  byDimension: Record<ProcessDimension, { pass: number; fail: number; unobserved: number }>;
}

export interface ProcessInput {
  evidence: TurnEvidence;
  roster: RosterAgent[];
  /** 本回合所在那条栈的 key→agentId 映射（每条栈 id 随机，不可用全局表）。 */
  agentIds: Record<string, string>;
  expect: Case['expect'];
}

const DIMENSIONS: ProcessDimension[] = [
  'tools',
  'repair',
  'alternatives',
  'coherence',
  'evidence',
  'scope',
];

const dimOf = (check: string): ProcessDimension => {
  const d = check.split('.')[0];
  if (d === undefined || !DIMENSIONS.includes(d as ProcessDimension)) {
    throw new Error(`finding 的 check 必须带维度前缀: ${check}`);
  }
  return d as ProcessDimension;
};

/** 递归收集 agentId 字段。run_builds 的实参是 unknown，形状由模型决定——它可能
 * 把 assignment 套在任何深度上，所以按字段名深挖而不是按固定路径取。 */
function collectAgentIds(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) collectAgentIds(v, out);
    return out;
  }
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'agentId' && typeof v === 'string') out.push(v);
      else collectAgentIds(v, out);
    }
  }
  return out;
}

/** 键序稳定的序列化——用来判「同参数重复调用」。 */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${stable(x)}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'undefined';
}

/** 正文里的 `[名字](agent:id)` 引用。 */
function textAgentRefs(text: string): { name: string; id: string }[] {
  const refs: { name: string; id: string }[] = [];
  const re = /\[([^\]]{0,40})\]\(agent:([^)\s]+)\)/g;
  for (const m of text.matchAll(re)) {
    const name = m[1];
    const id = m[2];
    if (name !== undefined && id !== undefined) refs.push({ name, id });
  }
  return refs;
}

export function scoreTrace(input: ProcessInput): ProcessScore {
  const { evidence, roster, agentIds, expect } = input;
  const findings: ProcessFinding[] = [];
  const add = (
    check: string,
    ok: boolean | null,
    detail: string,
    locus?: string,
  ): ProcessFinding => {
    const f: ProcessFinding = { dimension: dimOf(check), check, ok, detail, locus };
    findings.push(f);
    return f;
  };

  const ids = Object.values(agentIds);
  const idSet = new Set(ids);
  const nameById = new Map<string, string>();
  const namesById: string[] = [];
  for (const r of roster) {
    const id = agentIds[r.key];
    if (id === undefined) continue;
    nameById.set(id, r.displayName);
    namesById.push(r.displayName);
  }
  /** 同一显示名对应多个 Agent 时无法从正文反推是谁——不猜。 */
  const ambiguousNames = new Set(
    namesById.filter((n, i) => namesById.indexOf(n) !== i && n !== ''),
  );

  // --- 落库/实参里的分派槽 ------------------------------------------------
  const rowIds: { id: string; locus: string }[] = [];
  for (const row of evidence.createdTodoRows) {
    for (const [slot, agentId] of [
      ['build', row.buildAgentId],
      ['plan', row.planAgentId],
    ] as const) {
      if (agentId !== null) rowIds.push({ id: agentId, locus: `todo ${row.id} ${slot}` });
    }
  }
  if (rowIds.length === 0) {
    for (const [i, args] of evidence.runBuildsArgs.entries()) {
      for (const id of collectAgentIds(args)) rowIds.push({ id, locus: `run_builds[${i}]` });
    }
  }
  const assignedIds = [...new Set(rowIds.map((r) => r.id))];
  const assignedNames = new Set(
    assignedIds.map((id) => nameById.get(id)).filter((n): n is string => n !== undefined),
  );

  // --- tools.assignment_resolvable ---------------------------------------
  if (rowIds.length === 0) {
    add('tools.assignment_resolvable', null, '本回合没有分派槽（未派工）');
  } else {
    const unresolved = rowIds.filter((r) => !idSet.has(r.id));
    add(
      'tools.assignment_resolvable',
      unresolved.length === 0,
      unresolved.length === 0
        ? `${rowIds.length} 个分派槽全部解析到 roster（${assignedIds.join(',')}）`
        : `解析不到 roster 的 agentId：${unresolved.map((u) => `${u.id}@${u.locus}`).join(' ')}`,
      unresolved[0]?.locus,
    );
  }

  // --- tools.attribution_consistent（承重检查） ---------------------------
  const mentionedInText = new Set(
    namesById.filter((n) => n !== '' && evidence.assistantText.includes(n)),
  );
  const ambiguousMentioned = [...mentionedInText].filter((n) => ambiguousNames.has(n));
  const textRefs = textAgentRefs(evidence.assistantText).filter((r) => idSet.has(r.id));
  const refIdOutsideAssignment = textRefs.filter(
    (r) => assignedIds.length > 0 && !assignedIds.includes(r.id),
  );

  if (assignedIds.length === 0) {
    add('tools.attribution_consistent', null, '本回合没有落库的分派对象，无从比对正文点名');
  } else if (ambiguousMentioned.length > 0) {
    add(
      'tools.attribution_consistent',
      null,
      `正文点名 ${ambiguousMentioned.join(' ')} 在 roster 里有歧义（同显示名多个 Agent），不猜`,
    );
  } else {
    const unmatched = [...assignedNames].filter((n) => !mentionedInText.has(n));
    const extra = [...mentionedInText].filter((n) => !assignedNames.has(n));
    const ok = unmatched.length === 0 && extra.length === 0 && refIdOutsideAssignment.length === 0;
    const parts: string[] = [];
    if (unmatched.length > 0 || extra.length > 0) {
      parts.push(
        `落库=【${[...assignedNames].join(' ') || '无'}】正文点名=【${[...mentionedInText].join(' ') || '无'}】`,
      );
    }
    if (refIdOutsideAssignment.length > 0) {
      parts.push(
        `正文引用了未落库的 id：${refIdOutsideAssignment.map((r) => `${r.name}→${r.id}`).join(' ')}（落库=${assignedIds.join(',')}）`,
      );
    }
    add(
      'tools.attribution_consistent',
      ok,
      ok
        ? `落库与正文点名一致（${[...assignedNames].join(' ')}）`
        : `名字与 id 对不上：${parts.join('；')}`,
      rowIds[0]?.locus,
    );
  }

  // --- tools（补充：正文引用 id 的存在性） --------------------------------
  const allRefs = textAgentRefs(evidence.assistantText);
  const ghostRefs = allRefs.filter((r) => !idSet.has(r.id));
  if (allRefs.length === 0) {
    add('evidence.mentioned_agents_exist', null, '正文没有引用任何 agent id');
  } else {
    add(
      'evidence.mentioned_agents_exist',
      ghostRefs.length === 0,
      ghostRefs.length === 0
        ? `${allRefs.length} 处 id 引用全部存在（${[...new Set(allRefs.map((r) => r.id))].join(',')}）`
        : `正文引用了不存在的 agent id：${ghostRefs.map((r) => `${r.name}→${r.id}`).join(' ')}`,
    );
  }

  // --- repair -------------------------------------------------------------
  const erroredIdx = evidence.toolCalls
    .map((c, i) => ({ c, i }))
    .filter((x) => x.c.isError === true);
  if (erroredIdx.length === 0) {
    add('repair.retry_after_error', null, '本回合没有工具报错');
    add('repair.no_repeat_failed_call', null, '本回合没有工具报错');
  } else {
    const unretried = erroredIdx.filter(
      (x) => !evidence.toolCalls.slice(x.i + 1).some((c) => c.name === x.c.name),
    );
    add(
      'repair.retry_after_error',
      unretried.length === 0,
      unretried.length === 0
        ? `${erroredIdx.length} 处工具报错后都有同名重试`
        : `报错后未重试：${unretried.map((x) => `${x.c.name}[${x.i}]`).join(' ')}`,
      unretried[0] === undefined ? undefined : `toolCall[${unretried[0].i}]`,
    );

    const seen = new Map<string, number[]>();
    for (const x of erroredIdx) {
      const k = `${x.c.name}|${stable(x.c.arguments)}`;
      seen.set(k, [...(seen.get(k) ?? []), x.i]);
    }
    const repeats = [...seen.entries()].filter(([, v]) => v.length > 1);
    add(
      'repair.no_repeat_failed_call',
      repeats.length === 0,
      repeats.length === 0
        ? `${erroredIdx.length} 处工具报错各不相同，无同参数重发`
        : `同参数重复失败：${repeats.map(([k, v]) => `${k.split('|')[0]}×${v.length} @${v.join(',')}`).join(' ')}`,
    );
  }

  // --- coherence ----------------------------------------------------------
  add(
    'coherence.step_completed',
    evidence.stepStatus === 'done',
    evidence.stepStatus === 'done' ? '步正常结束' : `步状态 ${evidence.stepStatus}（轨迹不完整）`,
  );

  if (evidence.createdTodoRows.length === 0) {
    add('coherence.narrative_covers_all_rows', null, '本回合没有新建 todo 行');
  } else {
    const missing = [...assignedNames].filter(
      (n) => !ambiguousNames.has(n) && !mentionedInText.has(n),
    );
    add(
      'coherence.narrative_covers_all_rows',
      missing.length === 0,
      missing.length === 0
        ? `${evidence.createdTodoRows.length} 行承接者都在正文点名`
        : `正文漏点承接者：${missing.join(' ')}`,
    );
  }

  // --- alternatives -------------------------------------------------------
  if (expect.kind !== 'hold') {
    add('alternatives.hold_honest', null, '非该守住的场景（派工类由 decision_ok 判）');
  } else {
    const dispatched = evidence.toolCalls.some((c) => c.name === 'run_builds');
    const silent = evidence.toolCalls.length === 0 && evidence.assistantText === '';
    if (silent) {
      add('alternatives.hold_honest', null, '空回合：既无工具调用也无正文，观测不到守住的判断');
    } else {
      add(
        'alternatives.hold_honest',
        !dispatched,
        dispatched ? '该守住的场景却调了 run_builds（过早承诺）' : '未派工且有正文回复',
      );
    }
  }

  // 语义维：需要模型裁判，本模块不做——显式记未观测，避免「六维都覆盖了」的假象。
  add('alternatives.argument_quality', null, '需模型裁判（候选是否被摆出并比较），本模块不做');
  add('scope.limits_stated', null, '需模型裁判（结论边界是否声明），本模块不做');

  const byDimension = Object.fromEntries(
    DIMENSIONS.map((d) => [d, { pass: 0, fail: 0, unobserved: 0 }]),
  ) as ProcessScore['byDimension'];
  for (const f of findings) {
    const cell = byDimension[f.dimension];
    if (f.ok === null) cell.unobserved += 1;
    else if (f.ok) cell.pass += 1;
    else cell.fail += 1;
  }

  return { findings, byDimension };
}

/** 一行摘要（报告与终端共用）。未观测单独计数，不混进通过率。 */
export function summarize(s: ProcessScore): string {
  const cells = DIMENSIONS.map((d) => {
    const c = s.byDimension[d];
    return `${d}:${c.pass}✓/${c.fail}✗/${c.unobserved}–`;
  });
  return cells.join('  ');
}
