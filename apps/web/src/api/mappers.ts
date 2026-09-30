// wire → display mappers（M5 汇合，#83）：live 模式把 server 的 02 §6.2
// record 形状投影成既有显示契约（fixtures/records.ts——像素矩阵冻结的组件
// props 面）。fixture 模式不经过本模块；两模式在组件处消费同一显示形状 =
// 「一个显示契约、两个数据源」的汇合缝（03 §1 R5）。
//
// 呈现规则出处：transcript 行族 = r7 16/17/26/27/36/38 + r8 54/73/76 实测；
// overlay 三件 = r7 30/31/32 + r8 77；工具 pill 形 = `<name> <主参数>`
// （r7 27b `edit README.md` 族）；运行历史行 = r3 §3.8
// `第 N 次运行 · 相对时间 · tokens · 错误`。

import type {
  BuildRecord,
  ChiefGetResponse,
  ChiefThread,
  DocumentDiffFile,
  MachineRecord,
  McpServerRecord,
  ModelSource,
  ModelSourceRuntime,
  ProviderRecord,
  SecretRecord,
  SkillRecord,
  TeamMember,
  TokenUsage,
  ToolCallRecord,
  ScheduleRecord as WireSchedule,
  TodoRecord as WireTodo,
} from '@pacman/shared';
import {
  BRAND,
  conversationBranch,
  MERGE_ANNOUNCEMENT,
  REVIEW_VERDICT_KIND,
  reviewVerdictSchema,
} from '@pacman/shared';
import { relativeTime } from '../board/rel-time.js';
import type {
  BranchInfoContent,
  ChiefContent,
  ChiefModelOption,
  ChiefStreamItem,
  DiffFile,
  DiffLine,
  ApiKeyRecord as DisplayApiKey,
  ScheduleRecord as DisplaySchedule,
  TodoRecord as DisplayTodo,
  DocBlock,
  DocSegment,
  MachineRow,
  McpRow,
  PlanDiffContent,
  PlanVersion,
  ProjectCommitRow,
  ReviewFinding,
  RunHistoryRow,
  SkillRow,
  TeamAgentCard,
  TeamContent,
  TokenUsageContent,
  TranscriptItem,
} from '../fixtures/records.js';
import type { ApiKeyRow, PlanRow, StepRow } from './hooks.js';

/** transcript 消息行（GET messages 封套行形，shared transcriptRowSchema）。 */
export interface MessageRow {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: unknown;
  createdAt: number;
}

// —— todo ————————————————————————————————————————————————————————————————

export function toDisplayTodo(w: WireTodo): DisplayTodo {
  // 显示契约 assignment = 扁平 {agentId}（r3 §3.0 卡面单值）；wire 双槽
  // （02 §6.2 plan/build）折向执行槽、退规划槽。
  const agentId = w.assignment?.build?.agentId ?? w.assignment?.plan?.agentId ?? null;
  return {
    id: w.id,
    teamId: w.teamId,
    projectId: w.projectId,
    title: w.title,
    spec: w.spec,
    phase: w.phase,
    phaseAt: w.phaseAt,
    seqNum: w.seqNum,
    orderIndex: w.orderIndex,
    tagIds: w.tagIds,
    assignment: agentId !== null ? { agentId } : null,
    agent: w.agent,
    latestBuildId: w.latestBuildId,
    lastRunAt: w.lastRunAt,
    hasChanges: w.hasChanges,
    hasPlan: w.hasPlan,
    buildHistory: w.buildHistory,
    sourceTodo: w.sourceTodo,
    v: w.v,
    // awaitingReply = 显示扩展（r5b §3.15 [推断] wire 位）——live 侧无对应
    // wire 字段，恒缺省（等待回复面由 review+composer 呈现，不造假值）。
  };
}

// —— 数值/时间格式 ————————————————————————————————————————————————————————

/** token 计数显示形（r3 §3.8：`854` / `38.3k` / `435.5k`）。 */
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}

/** `HH:MM` 时间戳行（r7 26 `13:35`；本地时区 = live 语义，fixture 侧另有
 * 冻结时钟）。 */
export function clockTime(ms: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(ms);
}

// —— 消息内容归一（pi 内容块 / 纯文本 / toolcall 行 / system JSON）———————————

export function textOfContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block !== null && typeof block === 'object') {
          const b = block as { type?: string; text?: string };
          if (b.type === 'text' && typeof b.text === 'string') return b.text;
        }
        return '';
      })
      .join('');
  }
  if (content !== null && typeof content === 'object') {
    const b = content as { type?: string; text?: string };
    if (b.type === 'text' && typeof b.text === 'string') return b.text;
  }
  return '';
}

export function toolCallOfContent(content: unknown): ToolCallRecord | null {
  if (content !== null && typeof content === 'object' && !Array.isArray(content)) {
    const c = content as { kind?: string; call?: ToolCallRecord };
    if (c.kind === 'toolcall' && c.call) return c.call;
  }
  return null;
}

function systemKindOf(content: unknown): string | null {
  if (typeof content !== 'string') return null;
  try {
    const parsed = JSON.parse(content) as { kind?: string };
    return typeof parsed?.kind === 'string' ? parsed.kind : null;
  } catch {
    return null;
  }
}

/** 解析 REVIEW_VERDICT_KIND 系统消息的 verdict（M7 #330，r8 §3.1）：
 * server `applyBuildStepAction` 完成时 emit `{kind:'review_verdict',
 * verdict: ReviewVerdict}` system 消息；校验失败 = null（兜底退化为空
 * findings 渲染——service 侧 zod 兜底已固，不会真触发）。 */
function reviewVerdictOfContent(
  content: unknown,
): { conclusion: string; findings: ReviewFinding[] } | null {
  if (typeof content !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    (parsed as { kind?: string }).kind !== REVIEW_VERDICT_KIND
  ) {
    return null;
  }
  const verdict = reviewVerdictSchema.safeParse((parsed as { verdict?: unknown }).verdict);
  if (!verdict.success) return null;
  return {
    conclusion: verdict.data.conclusion,
    findings: verdict.data.findings.map((f) => ({
      id: f.id,
      severity: f.severity,
      summary: f.summary,
      ...(f.description !== undefined ? { description: f.description } : {}),
      ...(f.file !== undefined ? { file: f.file } : {}),
      ...(f.line !== undefined ? { line: f.line } : {}),
      ...(f.suggestion !== undefined ? { suggestion: f.suggestion } : {}),
    })),
  };
}

/** 工具 pill 文案（r7 27b `edit README.md` / `bash <命令>` 族；命令全长随
 * CSS ellipsis 截断——mapper 不截，行形与 fixture 一致）。 */
export function pillOf(call: ToolCallRecord): string {
  const args = (call.arguments ?? {}) as Record<string, unknown>;
  const primary =
    typeof args.file_path === 'string'
      ? args.file_path
      : typeof args.path === 'string'
        ? args.path
        : typeof args.command === 'string'
          ? args.command
          : '';
  return primary === '' ? call.name : `${call.name} ${primary}`;
}

// —— plan.md → DocBlock（文档 pane；四段卡软结构，r3 §3.3）———————————————

/** 行内 `code` 芯片 + 提及方案切分（r7 17 段内 mono chip；**bold** 归并纯文本——
 * 显示契约无 bold 位）。 #311：mention 方案的 `[name](agent:<id>)` /
 * `[name](skill:<id>)` / `[name](project:<id>)` / `[name](machine:<id>)`
 * 也切出独立 mention 段,带 mentionKind 给 segments 渲染对应 accent。
 * mention 段内不展开嵌套 scheme（r9 wire 形只一层）。 */
export function inlineSegments(text: string): DocSegment[] {
  const out: DocSegment[] = [];
  // First pass — extract `code` segments (split is lossless, even
  // alternation indices are non-code, odd are code). The mention scheme
  // is rare enough that we can run a second pass per non-code fragment
  // rather than build a single combined regex that captures both.
  const parts = text.split(/`([^`]+)`/g);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? '';
    if (part === '') continue;
    if (i % 2 === 1) {
      out.push({ text: part, style: 'code' });
      continue;
    }
    // Mention scheme scan over the non-code fragment. Single global
    // regex; matches `[label](kind:id)` for the four schemes that
    // serialize as a link — `todo:` keeps its plain `#seq` form (r9
    // §3.2: 任务提及按 #seq 留存), so it does not show up here.
    const cleaned = part.replaceAll('**', '');
    const SCHEME = /\[([^\]\n]+?)\]\((agent|skill|project|machine):([A-Za-z0-9_-]+)\)/g;
    let cursor = 0;
    SCHEME.lastIndex = 0;
    for (;;) {
      const m = SCHEME.exec(cleaned) as RegExpExecArray | null;
      if (m === null) break;
      if (m.index > cursor) {
        out.push({ text: cleaned.slice(cursor, m.index) });
      }
      out.push({
        text: m[1] ?? '',
        style: 'mention',
        mentionKind: m[2] as 'agent' | 'skill' | 'project' | 'machine',
      });
      cursor = m.index + m[0].length;
    }
    if (cursor < cleaned.length) {
      out.push({ text: cleaned.slice(cursor) });
    }
  }
  return out.length > 0 ? out : [{ text }];
}

/** plan.md markdown-lite → DocBlock[]（# 标题 / - 列表 / 段落；`Context:`
 * 段首词保留原文——四段为 LLM 自由文本，不做结构强判，r3 §3.3）。 */
export function mapPlanDoc(content: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length > 0) {
      blocks.push({ kind: 'para', segments: inlineSegments(para.join(' ')) });
      para = [];
    }
  };
  for (const raw of content.split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      flushPara();
      continue;
    }
    if (line.startsWith('#')) {
      flushPara();
      blocks.push({ kind: 'head', segments: inlineSegments(line.replace(/^#+\s*/, '')) });
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      flushPara();
      blocks.push({ kind: 'bullet', segments: inlineSegments(line.replace(/^[-*•]\s+/, '')) });
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  return blocks;
}

// —— diff（unified → 显示契约；双侧行号展开 = 渲染层义务，01 §4.1）———————

export function mapDiffFiles(files: DocumentDiffFile[]): DiffFile[] {
  return files.map((f) => ({
    path: f.path,
    added: f.additions,
    removed: f.deletions,
    hunks: f.hunks.map((h) => {
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(h.header);
      let oldNo = m ? Number(m[1]) : 1;
      let newNo = m ? Number(m[2]) : 1;
      const lines: DiffLine[] = [];
      for (const line of h.lines) {
        if (line.startsWith('\\')) {
          lines.push({ kind: 'marker', text: line.slice(1).trim() });
          continue;
        }
        if (line.startsWith('+')) {
          lines.push({ kind: 'add', text: line.slice(1), newNo });
          newNo += 1;
        } else if (line.startsWith('-')) {
          lines.push({ kind: 'del', text: line.slice(1), oldNo });
          oldNo += 1;
        } else {
          const text = line.startsWith(' ') ? line.slice(1) : line;
          lines.push({ kind: 'context', text, oldNo, newNo });
          oldNo += 1;
          newNo += 1;
        }
      }
      return { header: h.header, lines };
    }),
  }));
}

export function mapPlanDiff(diff: {
  fromVersion: number;
  toVersion: number;
  files: DocumentDiffFile[];
  /** #244: to 版本 plan.md 全文（plans 读面已载）→ 单文件 fullContent 槽，
   *  plan-diff 面「显示完整文件」数据源。files[0] 位置安全：document-diff
   *  单文件 plan.md 由 server 构造保证（documents.ts computeUnifiedDiff
   *  `files: [file]`）。 */
  toContent?: string;
}): PlanDiffContent {
  const files = mapDiffFiles(diff.files);
  const first = files[0];
  if (diff.toContent !== undefined && first !== undefined) {
    first.fullContent = diff.toContent;
  }
  return {
    from: `v${diff.fromVersion}`,
    to: `v${diff.toVersion}`,
    files,
    expanded: false,
  };
}

// —— transcript 组装（时间线 = 消息行 + 步标记 + plan 卡 + live 尾部）——————

/** 工具行中间形态（组装期折叠成 tools 组用；不进产物）。 */
interface ToolEntry {
  kind: '__tool__';
  call: ToolCallRecord;
}

interface TimelineEntry {
  at: number;
  item: TranscriptItem | ToolEntry;
}

export interface TranscriptInput {
  messages: MessageRow[];
  steps: StepRow[];
  plans: PlanRow[];
  build: BuildRecord | null;
  todo: DisplayTodo;
  machineName: string | null;
  userName: string;
  /** conversation stream text_delta 累积（live 打字面；'' = 无进行中文本）。 */
  liveText: string;
  now: number;
  /** 停止钮确认后的过渡态（M7 #308，r9 §3.3「正在停止…」）：stop 已被
   * 受理、步终态未回（live 面本地旗标；缺省 false = 捕获面不受扰）。 */
  stopping?: boolean;
}

export function mapTranscript(input: TranscriptInput): TranscriptItem[] {
  const {
    messages,
    steps,
    plans,
    build,
    todo,
    machineName,
    userName,
    liveText,
    now,
    stopping = false,
  } = input;
  const head: TranscriptItem[] = [];
  if (build?.triggerSource === 'schedule') head.push({ kind: 'scheduled' });
  if (build?.triggerSource === 'chief') head.push({ kind: 'chief' });
  if (build) {
    // 运行行终态「已取消」（M7 #308，r9 §3.3）：本 build 有 stopped 步 =
    // 被停止的运行（数据面 = step.status 词表，shared stepStatusSchema）。
    const cancelled = steps.some((s) => s.status === 'stopped');
    head.push({
      kind: 'run',
      at: clockTime(build.createdAt),
      ...(machineName !== null ? { machine: machineName } : {}),
      ...(cancelled ? { cancelled: true } : {}),
    });
  }

  const entries: TimelineEntry[] = [];
  let firstUser = true;
  for (const m of messages) {
    const call = toolCallOfContent(m.content);
    if (call !== null) {
      entries.push({ at: m.createdAt, item: toolItem(call) });
      continue;
    }
    const text = textOfContent(m.content).trim();
    if (m.role === 'user') {
      // 合并宣告行 content = shared MERGE_ANNOUNCEMENT 单源（server
      // requestMerge 写入端同款常量；呈现层拼装 actor，r3 §3.6）。
      if (text === MERGE_ANNOUNCEMENT) {
        entries.push({
          at: m.createdAt,
          item: { kind: 'note', text: `${userName} ${MERGE_ANNOUNCEMENT}` },
        });
        continue;
      }
      const userItem: TranscriptItem = firstUser
        ? { kind: 'user', text, seq: todo.seqNum, title: todo.title }
        : { kind: 'user', text };
      firstUser = false;
      entries.push({ at: m.createdAt, item: userItem });
      continue;
    }
    if (m.role === 'system') {
      // machine_selected JSON 行 = run 戳数据面（顶部已渲染）——不重复成行。
      if (systemKindOf(m.content) !== null) {
        // AI 审核 verdict 消息（M7 #330，r8 §3.1）= 结论段 + 编号 findings +
        // 严重度标签；不是抽象 system kind（具形状）。
        const verdict = reviewVerdictOfContent(m.content);
        if (verdict !== null) {
          entries.push({ at: m.createdAt, item: { kind: 'review', ...verdict } });
        }
        continue;
      }
      if (text !== '') entries.push({ at: m.createdAt, item: { kind: 'note', text } });
      continue;
    }
    // assistant 文本行 → robot 块级 markdown（#469：原文直入 markdown 槽，
    // 标题/有序无序列表/代码围栏由 chat-markdown 渲染器在渲染期解析——不再
    // 把块结构摊平成 chat-para；行内 code 仍走 inlineSegments 的 .chat-code
    // 芯片。空文本行跳过——pi 工具轮的空 content）。
    if (text !== '') {
      entries.push({ at: m.createdAt, item: { kind: 'robot', markdown: text } });
    }
  }

  // 步标记：确认气泡（withPlan 的执行步入队时刻 = 确认点击，r7 26d）+
  // plan 卡（第 i 个规划步 ↔ plan v(i+1)，方案就绪时刻 = 步 createdAt 近似）。
  const planSteps = steps.filter((s) => s.kind === 'plan');
  plans.forEach((p, i) => {
    const step = planSteps[i];
    const preview =
      p.content
        .split('\n')
        .map((l) => l.replace(/^#+\s*/, '').replace(/`/g, ''))
        .find((l) => l.trim() !== '') ?? '';
    entries.push({
      at: (step?.createdAt ?? p.createdAt) + 1,
      item: {
        kind: 'plan',
        title: `方案 · v${p.version}`,
        preview: preview.length > 90 ? `${preview.slice(0, 90)}…` : preview,
        chevron: true,
      },
    });
  });
  if (build?.withPlan === true) {
    for (const s of steps) {
      if (s.kind === 'build') {
        entries.push({ at: s.createdAt, item: { kind: 'user', text: '确认' } });
      }
    }
  }

  entries.sort((a, b) => a.at - b.at);
  const items: TranscriptItem[] = [...head];
  // 连续工具行折叠成 tools 组（r7 27 collapsed `完成 Ns ▸` + pills）。#469：
  // 每个 call 的 stdout/stderr（call.result）按 index 平行收进 outputs，渲染
  // 层在展开的组里给每个 pill 挂一块左对齐等宽输出——终端内容不再摊平进
  // .chat-note 居中灰通知。
  let toolRun: { seconds: number; pills: string[]; outputs: (string | null)[] } | null = null;
  const flushTools = () => {
    if (toolRun !== null) {
      items.push({
        kind: 'tools',
        seconds: toolRun.seconds,
        expanded: false,
        pills: toolRun.pills,
        outputs: toolRun.outputs,
      });
      toolRun = null;
    }
  };
  for (const e of entries) {
    if (e.item.kind === '__tool__') {
      const secs = durationSeconds(e.item.call);
      toolRun = toolRun ?? { seconds: 0, pills: [], outputs: [] };
      toolRun.seconds += secs;
      toolRun.pills.push(pillOf(e.item.call));
      toolRun.outputs.push(resultToText(e.item.call.result));
      continue;
    }
    flushTools();
    items.push(e.item);
  }
  flushTools();

  // live 尾部：进行中文本（打字面）+ streaming 行（r7 16 `准备工作区...` /
  // 26 `处理中...`）。running 步存在才挂尾。
  const running = steps.find((s) => s.status === 'claimed' || s.status === 'pending');
  if (running && build) {
    if (liveText.trim() !== '') {
      items.push({
        kind: 'robot',
        paragraphs: [{ segments: [{ text: liveText }] }],
      });
    }
    items.push({
      kind: 'streaming',
      seconds: Math.max(1, Math.round((now - running.createdAt) / 1000)),
      label: stopping
        ? '正在停止…' // 停止过渡态（M7 #308，r9 §3.3：中断在途）
        : running.kind === 'plan' && steps.length === 1 && running.status === 'pending'
          ? '准备工作区...'
          : '处理中...',
    });
  } else if (build && todo.phase === 'building' && !steps.some((s) => s.status === 'stopped')) {
    // 静止态 live 线索（#471）：building 的步间隙 / agent 非流式窗口没有
    // claimed/pending 步——对话区不能全静（实测唯一线索只剩头部「执行中」
    // chip）。挂同族 streaming 行（spinner reel + 静态标签，渲染共用
    // transcript 组件）；不挂秒数计数：静止期没有流事件驱动重渲，挂上去
    // 只会冻结说谎。stopped 步在场 = 本轮已被停止钮终结（run 行挂「已取
    // 消」终态），phase 未翻篇的窗口里不再自称执行中。
    items.push({ kind: 'streaming', label: '执行中...' });
  }

  // 失败行（r8 54/73 canon：橙色标题 + 指引 + 链接行）。
  if (build?.errorMessage && todo.phase === 'failed') {
    items.push({
      kind: 'fail',
      title: build.errorMessage,
      body: '请将其重新上线，或重新运行任务以改派其他机器。',
      links: ['查看原始错误', '排查指南'],
    });
  }
  return items;
}

/** 工具行的中间形态（组装期折叠用；不出现在产物里）。 */
function toolItem(call: ToolCallRecord): ToolEntry {
  return { kind: '__tool__', call };
}

function durationSeconds(call: ToolCallRecord): number {
  if (call.startedAt !== undefined && call.endedAt !== undefined) {
    return Math.max(0, Math.round((call.endedAt - call.startedAt) / 1000));
  }
  return 0;
}

/** 工具执行结果 → 可显示文本（#469 工具输出块的数据面）。pi 的 `call.result`
 * 是 z.unknown()：bash 多为纯串或 `{type:'text',text}` / `[{type:'text',…}]`
 * 内容块，宿主工具可能是 `{content|output|stdout|result: …}` 包一层。逐层拆出
 * 文本；空/不可解析 → null（渲染层跳过该块，不产空框）。不做 JSON 兜底串——
 * 结构化结果没有稳定的「显示文本」语义，宁可不出块也不糊一坨 JSON。 */
function resultToText(result: unknown): string | null {
  if (result == null) return null;
  if (typeof result === 'string') return result === '' ? null : result;
  if (Array.isArray(result)) {
    const joined = result
      .map(resultToText)
      .filter((s): s is string => s != null && s !== '')
      .join('\n');
    return joined === '' ? null : joined;
  }
  if (typeof result === 'object') {
    const o = result as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text === '' ? null : o.text;
    for (const key of ['content', 'output', 'stdout', 'result'] as const) {
      if (o[key] !== undefined) {
        const nested = resultToText(o[key]);
        if (nested != null && nested !== '') return nested;
      }
    }
  }
  return null;
}

// —— overlay 三件（Token 用量 / 分支与 PR / 运行历史）———————————————————

export function mapTokenUsage(usage: TokenUsage[]): TokenUsageContent {
  const totals = usage.reduce(
    (acc, u) => ({
      input: acc.input + u.input,
      output: acc.output + u.output,
      cacheRead: acc.cacheRead + u.cacheRead,
      cacheWrite: acc.cacheWrite + u.cacheWrite,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  );
  const total = totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
  const model = usage[0]?.model ?? 'n/a';
  return {
    total: formatTokens(total),
    model,
    modelTotal: formatTokens(total),
    input: formatTokens(totals.input),
    output: formatTokens(totals.output),
    cacheRead: formatTokens(totals.cacheRead),
    cacheWrite: formatTokens(totals.cacheWrite),
  };
}

export function mapBranchInfo(
  buildId: string,
  steps: StepRow[],
  machines: MachineRecord[],
): BranchInfoContent {
  const lastCheckpoint = [...steps].reverse().find((s) => s.checkpointCommit !== null);
  const machineId = [...steps].reverse().find((s) => s.machineId !== null)?.machineId ?? null;
  const machine = machines.find((m) => m.id === machineId);
  return {
    branch: conversationBranch(buildId),
    commit: lastCheckpoint?.checkpointCommit?.slice(0, 7) ?? '—',
    machine: machine?.name ?? '—',
    directory: `~/${BRAND.homeDirName}/workspaces/${buildId}`,
  };
}

/** 提交历史行（#149 文件|历史 分段「历史」；server 已按新→旧序返回，
 *  sha → 行 id）。 */
export function mapCommits(
  commits: {
    sha: string;
    shortSha: string;
    message: string;
    authorName: string;
    at: number;
  }[],
): ProjectCommitRow[] {
  return commits.map((c) => ({
    id: c.sha,
    shortSha: c.shortSha,
    message: c.message,
    authorName: c.authorName,
    at: c.at,
  }));
}

/** 运行历史行（r3 §3.8 顺序 = 新行在前；tokens 位 = 调用方按 build 供数，
 * 缺省行只显示相对时间）。 */
export function mapRunHistory(
  todo: WireTodo,
  builds: BuildRecord[],
  now: number,
  tokensByBuild?: Map<string, number>,
): RunHistoryRow[] {
  const byId = new Map(builds.map((b) => [b.id, b]));
  const rows: RunHistoryRow[] = [];
  const history = [...todo.buildHistory].reverse(); // 新行在前（r8 77）
  history.forEach((entry, idx) => {
    const n = todo.buildHistory.length - idx; // 第 N 次运行（时序编号）
    const b = byId.get(entry.buildId);
    const isCurrent = todo.latestBuildId === entry.buildId;
    const failed = b?.errorMessage != null && b.errorMessage !== '';
    const parts = [relativeTime(entry.createdAt, now)];
    const tokens = tokensByBuild?.get(entry.buildId);
    if (tokens !== undefined) parts.push(`${formatTokens(tokens)} tokens`);
    if (failed && b) parts.push(b.errorMessage ?? '');
    rows.push({
      label: `第 ${n} 次运行`,
      meta: parts.join(' · '),
      status: isCurrent ? (failed ? 'failed-current' : 'current') : failed ? 'failed' : 'done',
    });
  });
  return rows;
}

// —— schedules / team / resources ————————————————————————————————

export function mapSchedules(rows: WireSchedule[]): DisplaySchedule[] {
  return rows.map((r) => ({
    id: r.id,
    teamId: r.teamId,
    projectId: r.projectId,
    todoId: r.todoId,
    kind: r.kind,
    at: r.at ?? 0,
    tz: r.tz,
    machineId: r.machineId,
    nextRunAt: r.nextRunAt ?? 0,
    createdBy: r.createdBy,
    todo: r.todo,
  }));
}

export function mapTeam(members: TeamMember[]): TeamContent {
  const agents = members.filter((m) => m.memberType === 'agent');
  const cards: TeamAgentCard[] = agents.map((m) => {
    const a = m.actor as {
      displayName?: string;
      avatarUrl?: string | null;
      modelId?: string | null;
      description?: string | null;
    };
    return {
      id: m.actorId,
      displayName: a.displayName ?? '',
      avatarUrl: a.avatarUrl ?? null,
      model: a.modelId ? `${a.modelId} · 默认` : '未配置模型',
      isDefault: false,
      role: a.description ?? null,
    };
  });
  return { members: members.length, agents: cards };
}

export function mapApiKeys(rows: ApiKeyRow[]): DisplayApiKey[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    masked: r.masked,
    gitAccess: r.gitAccess,
    mcpAccess: r.mcpAccess,
  }));
}

/** machines 页投影（spec 11 A8，#357）：本机行（kind='local'）钉列表首，
 * 接入机保持 API 序；enabledRuntimes 原样透传 = switch aria-checked 数据源。 */
export function mapMachines(rows: MachineRecord[]): MachineRow[] {
  const local = rows.filter((m) => m.kind === 'local');
  const attached = rows.filter((m) => m.kind !== 'local');
  return [...local, ...attached].map((m) => ({
    id: m.id,
    kind: m.kind,
    name: m.name,
    sub: `…${m.id.slice(-8)} · max ${m.maxConcurrent}`,
    online: m.online,
    enabledRuntimes: m.enabledRuntimes,
  }));
}

export function mapSkills(rows: SkillRecord[]): SkillRow[] {
  return rows.map((s) => ({ name: s.name, description: s.description ?? '' }));
}

export function mapSecrets(rows: SecretRecord[]): { name: string; description: string | null }[] {
  return rows.map((s) => ({ name: s.name, description: s.description }));
}

export function mapMcpServers(rows: McpServerRecord[], now: number): McpRow[] {
  return rows.map((m) => ({
    name: m.label,
    kind: m.transport === 'http' ? 'HTTP' : 'stdio',
    url: m.transport === 'http' ? m.url : m.slug,
    ago: relativeTime(m.createdAt, now),
  }));
}

// —— chief（总管 drawer / 设置面）———————————————————————————————

/** runtime 显示名（品牌/runtime 名不译，不走 t()）——单源：providers-page
 * runtime tablist 与 chief 压缩模型选择器（toChiefModelOptions）共消费。
 * 词表闭包 = ModelSourceRuntime；Codex 等后续 runtime 扩在此补（spec 11
 * §A1），两消费面自动同更，不分头改。 */
export const RUNTIME_LABELS: Record<ModelSourceRuntime, string> = {
  pi: 'pi',
  'claude-code': 'Claude Code',
};

/** 压缩模型选择器候选投影（#358，spec 11 §A10）：custom providers
 * `models[]`（带 providerId/label 归属——model-sources 的 pi 段与其同构
 * 但平铺丢归属，不重复产行）∪ 非 pi runtime 段模型（claude-code = server
 * 直读 ~/.claude/settings.json 的槽位；provider 位 = runtime 词表值，
 * 未安装段 models 恒空天然无贡献）。同 (provider, modelId) 去重
 * first-wins（settings.json default 槽 + env 槽可映同一 id；组件 React
 * key 防撞）；跨 provider 同 modelId 两行都留——model id 只在 provider
 * 内有意义（chiefCompactionModelSchema 对象形槽值立法理由）。providers
 * 段卫生与 server pi 投影对齐：空 id 跳过、空 name 回退 id（shared
 * modelSourceModelSchema 两处 min(1)）。边角：providerId 与 runtime 词表
 * 共用 provider 命名空间，custom provider 若取名 'claude-code' 且撞同
 * modelId，会被 providers 段 first-wins 遮蔽——刻意取该名的撞名罕见，
 * 规格未约束，不去 invent 隔离前缀。 */
export function toChiefModelOptions(
  providers: ProviderRecord[],
  sources: ModelSource[],
): ChiefModelOption[] {
  const options: ChiefModelOption[] = [];
  const seen = new Set<string>();
  const push = (option: ChiefModelOption) => {
    const key = `${option.provider}/${option.modelId}`;
    if (seen.has(key)) return;
    seen.add(key);
    options.push(option);
  };
  for (const p of providers) {
    for (const m of p.models) {
      if (m.id === '') continue;
      push({
        provider: p.providerId,
        providerLabel: p.label,
        modelId: m.id,
        modelName: m.name !== '' ? m.name : m.id,
      });
    }
  }
  for (const source of sources) {
    if (source.runtime === 'pi') continue;
    const providerLabel = RUNTIME_LABELS[source.runtime] ?? source.runtime;
    for (const m of source.models) {
      push({
        provider: source.runtime,
        providerLabel,
        modelId: m.id,
        modelName: m.name,
      });
    }
  }
  return options;
}

/** r5 100/111 hero 网格 canon（卡序 = 抓包序；与 fixtures CHIEF_EXAMPLES
 * 同源文案——live 面单源在此，fixture 面保持自有副本不动）。 */
const CHIEF_HERO_EXAMPLES = [
  { icon: 'user-plus' as const, text: '帮我组建 Agent 团队' },
  { icon: 'folder' as const, text: '帮我创建一个新项目' },
  { icon: 'grid' as const, text: '总结一下我所有项目现在的进展' },
  { icon: 'bars' as const, text: '查一下这个月的 token 用量' },
];

export function mapChiefStream(messages: MessageRow[]): ChiefStreamItem[] {
  const items: ChiefStreamItem[] = [];
  for (const m of messages) {
    const call = toolCallOfContent(m.content);
    if (call !== null) continue; // 工具行不进 chief 流呈现（r5 114/116 无工具行）
    const text = textOfContent(m.content).trim();
    if (text === '') continue;
    if (m.role === 'user') {
      items.push({ kind: 'user', text });
      continue;
    }
    if (m.role === 'system') continue;
    const lines = text.split('\n').filter((l) => l.trim() !== '');
    const paragraphs: { text: string }[][] = [];
    const bullets: { text: string; strong?: boolean }[][] = [];
    for (const line of lines) {
      if (/^[-*•]\s+/.test(line)) {
        const content = line.replace(/^[-*•]\s+/, '');
        const lead = /^([^:：]+)[:：]\s*(.*)$/.exec(content);
        bullets.push([
          lead ? { text: `${lead[1]}:`, strong: true } : { text: content },
          ...(lead ? [{ text: ` ${lead[2]}` }] : []),
        ]);
      } else {
        paragraphs.push([{ text: line }]);
      }
    }
    items.push({
      kind: 'robot',
      paragraphs,
      ...(bullets.length > 0 ? { bullets } : {}),
      seconds: '',
    });
  }
  return items;
}

export function mapChief(
  env: ChiefGetResponse,
  opts: {
    threads: ChiefThread[];
    activeThreadId: string | null;
    messages: MessageRow[];
    draft?: string;
  },
): ChiefContent {
  const bound = env.chief.agent !== null;
  const active =
    opts.activeThreadId !== null
      ? (opts.threads.find((t) => t.id === opts.activeThreadId) ?? null)
      : null;
  return {
    view: 'drawer',
    bound,
    ...(bound && env.agentActor
      ? {
          modelSlot: `${env.agentActor.modelId ?? 'n/a'} · 默认`,
          // #444: FAB 头像位 = 绑定 Agent 全记录里的既有两字段（封套已带，
          // 零新增请求）。
          agent: {
            displayName: env.agentActor.displayName,
            avatarUrl: env.agentActor.avatarUrl,
          },
        }
      : {}),
    threadTitle: active?.title ?? '新主题',
    ...(opts.threads.length > 0
      ? {
          threads: opts.threads.map((t) => ({
            title: t.title,
            ...(t.id === opts.activeThreadId ? { active: true } : {}),
          })),
        }
      : {}),
    ...(active === null
      ? { examples: CHIEF_HERO_EXAMPLES }
      : { stream: mapChiefStream(opts.messages) }),
    ...(opts.draft !== undefined ? { draft: opts.draft } : {}),
  };
}

/** plan 版本下拉行（r8 63/70：`vN · 相对时间`，新在前；相对时间由显示层
 * 以 `at` 对 now 求值）。 */
export function mapPlanVersions(plans: PlanRow[]): PlanVersion[] {
  return [...plans].reverse().map((p) => ({ v: `v${p.version}`, at: p.createdAt }));
}

export { relativeTime };
