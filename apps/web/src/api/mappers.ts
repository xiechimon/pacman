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
  ProviderRecord,
  SecretRecord,
  SkillRecord,
  TeamMember,
  TokenUsage,
  ToolCallRecord,
  ScheduleRecord as WireSchedule,
  TodoRecord as WireTodo,
} from '@pacman/shared';
import { BRAND, conversationBranch, MERGE_ANNOUNCEMENT } from '@pacman/shared';
import { relativeTime } from '../board/rel-time.js';
import type {
  BranchInfoContent,
  BuildOverlayContent,
  ChiefContent,
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
  ProviderRow,
  RobotPara,
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

/** 行内 `code` 芯片切分（r7 17 段内 mono chip；**bold** 归并纯文本——
 * 显示契约无 bold 位）。 */
export function inlineSegments(text: string): DocSegment[] {
  const out: DocSegment[] = [];
  const parts = text.split(/`([^`]+)`/g);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? '';
    if (part === '') continue;
    if (i % 2 === 1) out.push({ text: part, style: 'code' });
    else out.push({ text: part.replaceAll('**', '') });
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
}): PlanDiffContent {
  return {
    from: `v${diff.fromVersion}`,
    to: `v${diff.toVersion}`,
    files: mapDiffFiles(diff.files),
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
}

export function mapTranscript(input: TranscriptInput): TranscriptItem[] {
  const { messages, steps, plans, build, todo, machineName, userName, liveText, now } = input;
  const head: TranscriptItem[] = [];
  if (build?.triggerSource === 'schedule') head.push({ kind: 'scheduled' });
  if (build?.triggerSource === 'chief') head.push({ kind: 'chief' });
  if (build) {
    head.push({
      kind: 'run',
      at: clockTime(build.createdAt),
      ...(machineName !== null ? { machine: machineName } : {}),
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
      if (systemKindOf(m.content) !== null) continue;
      if (text !== '') entries.push({ at: m.createdAt, item: { kind: 'note', text } });
      continue;
    }
    // assistant 文本行 → robot 段落（空文本行跳过——pi 工具轮的空 content）。
    if (text !== '') {
      const paragraphs: RobotPara[] = text
        .split(/\n{2,}/)
        .filter((p) => p.trim() !== '')
        .map((p) => ({ segments: inlineSegments(p.replace(/\n/g, ' ')) }));
      if (paragraphs.length > 0) {
        entries.push({ at: m.createdAt, item: { kind: 'robot', paragraphs } });
      }
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
  // 连续工具行折叠成 tools 组（r7 27 collapsed `完成 Ns ▸` + pills）。
  let toolRun: { seconds: number; pills: string[] } | null = null;
  const flushTools = () => {
    if (toolRun !== null) {
      items.push({
        kind: 'tools',
        seconds: toolRun.seconds,
        expanded: false,
        pills: toolRun.pills,
      });
      toolRun = null;
    }
  };
  for (const e of entries) {
    if (e.item.kind === '__tool__') {
      const secs = durationSeconds(e.item.call);
      toolRun = toolRun ?? { seconds: 0, pills: [] };
      toolRun.seconds += secs;
      toolRun.pills.push(pillOf(e.item.call));
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
      label:
        running.kind === 'plan' && steps.length === 1 && running.status === 'pending'
          ? '准备工作区...'
          : '处理中...',
    });
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
      modelId?: string | null;
      description?: string | null;
    };
    return {
      id: m.actorId,
      displayName: a.displayName ?? '',
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

/** `Pacman 托管机器` 首行 = 静态产品面（r7 06 canon，复刻未启用托管执行——
 * 恒 未启用 pill；品牌词槽随 D2 替换值 Pacman（静态字面 = i18n 键契约，
 * 见 test/i18n-coverage.test.ts；D3 已切换 #109）。 */
const HOSTED_MACHINE_ROW: MachineRow = {
  hosted: true,
  name: 'Pacman 托管机器',
  description: '随时在线，构建速度快。空闲自动休眠，仅在运行时消耗积分。',
  pill: '未启用',
};

export function mapMachines(rows: MachineRecord[]): MachineRow[] {
  return [
    HOSTED_MACHINE_ROW,
    ...rows.map((m) => ({
      name: m.name,
      sub: `…${m.id.slice(-8)} · max ${m.maxConcurrent}`,
      online: m.online,
    })),
  ];
}

/** `Pacman（内置）` 首行 = 静态产品面（r7 07 canon；内置 built-in 模型走
 * Pro = 复刻排除项，CONTEXT.md 资源与配置——恒 未启用 pill）。 */
const BUILTIN_PROVIDER_ROW: ProviderRow = {
  name: 'Pacman（内置）',
  models: '8 模型',
  pill: '未启用',
};

export function mapProviders(rows: ProviderRecord[]): ProviderRow[] {
  return [
    BUILTIN_PROVIDER_ROW,
    ...rows.map((p) => ({
      name: p.label,
      models: `${p.models.length} 模型`,
      ...(p.kind === 'custom' ? { custom: true } : {}),
    })),
  ];
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
    ...(bound && env.agentActor ? { modelSlot: `${env.agentActor.modelId ?? 'n/a'} · 默认` } : {}),
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
