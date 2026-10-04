// 命令闸：bash 执行面门控（#866 T5 tracer：权限规则表最小版落地）。
// 机制（pi-coding-agent 0.86 实测）：createAgentSession 的 customTools 与内建
// 工具同名时按名覆盖（agent-session.js definitionRegistry/toolRegistry 两处
// 后写胜出；执行经 _toolRegistry 分发；getToolDefinition 读同一覆盖后注册
// 表；session 循环内无 isBashToolResult 特判）。本闸用 pi 自家的
// createBashToolDefinition + 包一层 operations.exec 实现门控——放行命令的描
// 述/schema/流式输出/截断/超时/exit 码文案与内建 bash 逐字节同行为（同一份定
// 义，只换 operations），transcript 面零漂移（daemon 的 mapPiSessionEvent 本
// 就忽略 bash_execution_update 流事件，只消费 toolcall/tool_execution_end）。
// 裁决分两层（单真值，不存在"表说一套码做一套"）：
// 1. 调用方自带规则（PermissionRule[]，shared 通用 glob 匹配器）：AMP 式可编
//    程策略，首命中胜出；未命中回落第 2 层。将来服务端统一下发表即进此层。
// 2. 默认不可逆形态（本文件 DEFAULT_BASH_PATTERNS，段级 token 判定）：glob 表
//    达不了"rm 的操作数恰为 /"（`*rm*-rf /*` 会误伤 /tmp），精确判定必须做
//    token 级，见各 pattern 注释。匹配严格度按 base rate 定：rm 普通路径是 agent
//    日常（worktree 清理）→ 精确到根才拦；mkfs/dd→/dev/断电/fork 在 agent
//    流量里几乎恒无合法用 → 宁可误拦（一次可改道的拒绝）不漏放。
// ask 在无人值守 daemon 面的执行语义 = 拒（附改道文案）。表里保留 ask 与
// reject 的区分：ask = "有人在场就可批"，reject = "恒无合法用途"（fork 炸弹）；
// 将来审批面（web UI）上线，ask 直接转人工，数据面零迁移。人的判断今天仍在
// confirm（方案审批）/review（改后审计）两道流程闸。
// 威胁模型 = agent 失误，不是恶意 agent：引号剥离 + 分段扫描防的是"好心写错"
// （echo 里提一句 rm -rf / 不该炸），变量展开/转义/编码绕行不在射程内（防误
// 不防恶）。claude-code 后端仍跑 bypassPermissions（钩子在 bypass 下是否触发
// 未验证，动 permissionMode 是全量行为变更，留给后续票），缺口见 PR 与报告。
import type { BashOperations } from '@earendil-works/pi-coding-agent';
import { matchPermissionRule, type PermissionAction, type PermissionRule } from '@pacman/shared';

export type { PermissionRule };

/** 裁决（ruleId 缺席 = 默认放行；表裁决 ask 与执行动作的区分：tracer 面两者
 * 同值，审批面上线后 ask 可转人工而不改表）。 */
export interface BashGateDecision {
  action: PermissionAction;
  ruleId?: string;
}

/** 默认不可逆形态（输入 = 已剥引号文本；scope 决定按整串还是按分段判定）。 */
export interface BashGatePattern {
  id: string;
  action: PermissionAction;
  description: string;
  /** 整串 scope 专给跨管道符的形态（fork 炸弹含 `|`，分段会把它拆散）。 */
  scope: 'command' | 'segment';
  test: (text: string, segment: BashSegment) => boolean;
}

/** 分段 token 视图（sudo/env 等前缀已剥，head = 实际命令头）。 */
export interface BashSegment {
  /** 剥前缀后的头 token（如 `sudo rm` → `rm`）。 */
  head: string;
  /** 头之后 token（含 flag 与操作数，`--` 之后全算操作数）。 */
  args: string[];
  /** 分段原文（剥引号后；供 dd 的 of=/dev 这类跨 token 判定）。 */
  text: string;
}

/** 剥前缀链：sudo / env KV… / command / nice（可重复，`sudo env FOO=1 X`）。 */
const PREFIX_TOKENS = new Set(['sudo', 'command', 'nice', 'nohup']);

function tokenize(segmentText: string): BashSegment {
  const raw = segmentText
    .trim()
    .split(/\s+/)
    .filter((t) => t !== '');
  const tokens = [...raw];
  while (tokens.length > 0) {
    const head = tokens[0] as string;
    if (PREFIX_TOKENS.has(head)) {
      tokens.shift();
      continue;
    }
    if (head === 'env') {
      tokens.shift();
      while (tokens.length > 0 && (tokens[0] as string).includes('=')) tokens.shift();
      continue;
    }
    break;
  }
  const [head = '', ...args] = tokens;
  return { head, args, text: segmentText.trim() };
}

/** rm 递归 flag（-r/-R/--recursive，合并短 flag 如 -rf/-fr 亦中）。 */
function hasRecursiveFlag(args: string[]): boolean {
  return args.some(
    (t) =>
      t === '--recursive' ||
      (t.startsWith('-') && t !== '-' && !t.startsWith('--') && /[rR]/.test(t.slice(1))),
  );
}

/** `${NAME}` / `${NAME}/…` → `$NAME` / `$NAME/…`（花括号只是 shell 取值写
 * 法，不改变指代；归一后下游只查 `$` 形。用模板字面量拼，避免
 * noTemplateCurlyInString 误报 shell 字面量）。 */
function normalizeBracedVar(op: string): string {
  const m = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}(\/.*)?$/.exec(op);
  if (!m) return op;
  return `$${m[1] ?? ''}${m[2] ?? ''}`;
}

/** rm 操作数（flag 不算；`--` 之后全算操作数；`${HOME}` 归一成 `$HOME`）。 */
function rmOperands(args: string[]): string[] {
  const out: string[] = [];
  let restAreOperands = false;
  for (const t of args) {
    if (restAreOperands) {
      out.push(normalizeBracedVar(t));
      continue;
    }
    if (t === '--') {
      restAreOperands = true;
      continue;
    }
    if (t.startsWith('-') && t !== '-') continue;
    out.push(normalizeBracedVar(t));
  }
  return out;
}

const POWER_HEADS = new Set(['shutdown', 'reboot', 'halt', 'poweroff']);

/** 默认不可逆形态表（顺序 = 裁决优先序：reject 在前；同为 ask 按表中序）。 */
export const DEFAULT_BASH_PATTERNS: readonly BashGatePattern[] = [
  {
    id: 'reject-forkbomb',
    action: 'reject',
    description: 'fork 炸弹（匿名函数自管道：恒无合法用途，直接拒）',
    scope: 'command',
    test: (text) => text.includes(':()') && text.includes('&') && text.includes('{'),
  },
  {
    id: 'ask-rm-rf-root',
    action: 'ask',
    description: '递归删且目标为系统根（/、/*）或显式关掉 --preserve-root',
    scope: 'segment',
    test: (_text, s) =>
      s.head === 'rm' &&
      hasRecursiveFlag(s.args) &&
      (s.args.includes('--no-preserve-root') ||
        rmOperands(s.args).some((op) => op === '/' || op === '/*')),
  },
  {
    id: 'ask-rm-rf-home',
    action: 'ask',
    description: '递归删且目标为用户家目录（~、$HOME、/root）',
    scope: 'segment',
    test: (_text, s) =>
      s.head === 'rm' &&
      hasRecursiveFlag(s.args) &&
      rmOperands(s.args).some(
        (op) =>
          op === '~' ||
          op === '~/' ||
          op === '$HOME' ||
          op === '/root' ||
          op === '/root/' ||
          op.startsWith('$HOME/') ||
          op.startsWith('/root/'),
      ),
  },
  {
    id: 'ask-mkfs',
    action: 'ask',
    description: '文件系统格式化（恒无合法 agent 用途）',
    scope: 'segment',
    test: (_text, s) => s.head === 'mkfs' || s.head.startsWith('mkfs.'),
  },
  {
    id: 'ask-dd-disk',
    action: 'ask',
    description: 'dd 直写块设备（of=/dev/…；of=/dev/null 是空洞放行）',
    scope: 'segment',
    test: (_text, s) =>
      s.head === 'dd' && s.text.includes('of=/dev/') && !s.text.includes('of=/dev/null'),
  },
  {
    id: 'ask-power',
    action: 'ask',
    description: '关机/重启（执行机是共享/远端资产，停机不可逆）',
    scope: 'segment',
    test: (_text, s) => POWER_HEADS.has(s.head),
  },
];

/** 剥单/双引号包住的 span（echo "rm -rf /" 这类字面提及不判；反引号不剥——
 * 反引号内是真执行，剥了会漏。unmatched 引号剥到行尾：宁可宽（威胁模型非恶
 * 意）。 */
export function stripQuotedSpans(command: string): string {
  let out = '';
  let i = 0;
  while (i < command.length) {
    const ch = command[i];
    if (ch === "'" || ch === '"') {
      const end = command.indexOf(ch, i + 1);
      i = end === -1 ? command.length : end + 1;
      out += ' ';
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

/** 分段（;/&&/||/换行/单竖线；`||` 先于 `|` 切，避免把或拆成管）。 */
export function splitBashSegments(command: string): string[] {
  return command
    .split(/&&|\|\||;|\n|\|/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/** bash 命令裁决：自带表（整串 glob，AMP 式）优先，默认形态（分段 token）
 * 次之，都未中 = 默认放行。Bash 工具名大小写两形（pi `bash` / SDK `Bash`）
 * 都查——自带表写任一形都生效。 */
export function decideBashCommand(
  command: string,
  customRules?: readonly PermissionRule[],
): BashGateDecision {
  const stripped = stripQuotedSpans(command);
  if (customRules !== undefined) {
    const params = { command: stripped };
    const hit =
      matchPermissionRule(customRules, 'bash', params) ??
      matchPermissionRule(customRules, 'Bash', params);
    if (hit !== undefined) return { action: hit.action, ruleId: hit.id };
  }
  for (const pattern of DEFAULT_BASH_PATTERNS) {
    if (pattern.scope === 'command') {
      if (pattern.test(stripped, { head: '', args: [], text: stripped })) {
        return { action: pattern.action, ruleId: pattern.id };
      }
      continue;
    }
    for (const segmentText of splitBashSegments(stripped)) {
      const segment = tokenize(segmentText);
      if (segment.head === '') continue;
      if (pattern.test(stripped, segment)) return { action: pattern.action, ruleId: pattern.id };
    }
  }
  return { action: 'allow' };
}

/** 拒绝文案（进 tool result：agent 照着改道；规则 id 供人审计）。 */
export function formatGateRefusal(command: string, decision: BashGateDecision): string {
  const ruleId = decision.ruleId ?? 'unknown';
  const actionNote =
    decision.action === 'reject'
      ? 'rejected outright (this shape is never legitimate)'
      : 'requires approval, and this daemon runs unattended (no approval surface), so it is denied';
  return [
    `command gate (${ruleId}): ${actionNote}.`,
    `command: ${command}`,
    'replan without the irreversible shape (narrow the paths, drop the flags), or put the rationale in the plan and let a human approve it at the confirm/review gate.',
  ].join('\n');
}

/** 门控 operations：ask/reject 抛拒绝（pi 内建定义转成 tool error 结果，agent
 * 可见）；allow 原样委托本地 ops（signal/timeout/env 全透传，行为零差）。
 * allow 静默（非常态不征税）；ask/reject 落一行 gate 日志（审计口径）。 */
export function buildGatedBashOperations(
  localOps: BashOperations,
  opts?: { rules?: readonly PermissionRule[]; log?: (msg: string) => void },
): BashOperations {
  return {
    exec: async (command, cwd, execOpts) => {
      const decision = decideBashCommand(command, opts?.rules);
      if (decision.action !== 'allow') {
        opts?.log?.(`${decision.action}: rule=${decision.ruleId} command=${command}`);
        throw new Error(formatGateRefusal(command, decision));
      }
      return localOps.exec(command, cwd, execOpts);
    },
  };
}
