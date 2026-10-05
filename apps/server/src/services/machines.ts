// 机器面服务层（02 §5 canonical，wire schema 单源 = shared machine-wire.ts）。
// - enroll：api-key 非交互注册（02 §5.2 路径二）；重注册复用同一 machineId
//   （r3 §1.2 实测，按 key/team 认机器 [推断]）。
// - claim：长轮询领取（~75s 节奏，r3 §1.5）+ wake 即时唤醒；step 队列 server
//   持有、机器 claim 三类步（02 §4.2/A6）。
// - journal：heartbeat/tool/done/upload-urls/token（02 §5.4 词表）。
// 载荷细形 r3 未采处 = [推断]/[设计]（04 §3 不判负口径），补采后回写 02 §11。

import { hostname } from 'node:os';
import { join } from 'node:path';
import type {
  ClaimedStep,
  ClaudeCodeReport,
  GitCredentials,
  MachineAttachmentResponse,
  MachineDoneBody,
  MachineShellPrecheckBody,
  MachineShellResultBody,
  MachineSkillsResponse,
  MachineStreamEvent,
  MachineSyncCommand,
  MachineTokenResponse,
  ProviderConfig,
  SecretBox,
  StepRecord,
  ToolCallRecord,
  TranscriptUpload,
  UserRecord,
} from '@pacman/shared';
import {
  AGENT_TOOL_SHELL,
  AGENT_TOOL_SKILL_CREATE,
  AGENT_TOOL_SKILL_UPDATE,
  AGENT_TOOL_TAG,
  CHANGES_DIFF_MAX_BYTES,
  CHIEF_REMOTE_TOOLS,
  CHIEF_TURN_ERROR_KIND,
  createSkillBodySchema,
  derivePlaceholderTitle,
  FIXED_TAGS,
  formatSkillRouteSection,
  GITHUB_ACCESS_TOKEN_USERNAME,
  isBackendRuntimeId,
  isChiefConversationId,
  LOCAL_TOOL_CREATE_TAG,
  LOCAL_TOOL_REMOTE_SHELL,
  MAX_SKILL_TOTAL_BYTES,
  MCP_MIN_CLI_VERSION,
  machineRecordSchema,
  suggestSkillsForMessage,
  updateSkillToolParamsSchema,
  WORKER_REMOTE_TOOLS,
  WORKER_REMOTE_TOOLS_GITHUB,
} from '@pacman/shared';
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import {
  agent,
  agentMemory,
  apiKey,
  build,
  chief,
  chiefThread,
  machine,
  message,
  plan as planTable,
  project,
  shellCommand,
  steerPending,
  step,
  stopPending,
  todo,
  tokenUsage,
} from '../db/schema.js';
import { HttpError, parseWith } from '../lib/errors.js';
import { systemGitOps } from '../lib/git.js';
import type { FetchLike } from '../lib/github.js';
import { hashCredential } from '../lib/hash.js';
import { newRecordId, nowMs } from '../lib/ids.js';
import { newMachineToken } from '../lib/keys.js';
import { readAttachmentMeta } from './attachments.js';
import {
  applyStepFailure,
  applyStoppedStep,
  completeStep,
  NotFoundError,
  toBuildRecord,
} from './builds.js';
import {
  chiefClaimContext,
  finishChiefTurn,
  notifyChiefTurn,
  parseChiefTrigger,
  upsertChiefMessage,
} from './chief.js';
import { executeChiefTool, executeWorkerMemoryTool } from './chief-tools.js';
import type { StepCredentialBundle } from './credentials.js';
import {
  issueStepGitCredential,
  resolveChiefStepCredentials,
  resolveStepCredentials,
  revokeStepGitCredential,
} from './credentials.js';
import {
  agentForStep as agentForStepEligibility,
  runtimeGatePasses,
  stepRuntimeFor,
} from './dispatch-eligibility.js';
import { SESSION_WEDGE_GRACE_MS, stepActivityAt } from './dispatch-timeouts.js';
import type { ConversationStreamHub, TeamStreamHub } from './events.js';
import { parseUnifiedDiff, projectRepoRef, repoDirFor } from './git.js';
import { openGithubToken } from './github-connection.js';
import {
  createLocalSkill,
  listSkillFiles,
  readSkillFile,
  scanLocalSkills,
  updateLocalSkill,
} from './skills.js';
import { listProjectTagVocab, resolveFixedTagId, resolveProjectTagIds } from './tags.js';
import { setTodoPhase, updateTodo, writebackSelfIssueTitle } from './todos.js';

/** chief 步 conv id 判别（单源 = shared isChiefConversationId；thread id 形
 * `chief-<uuid>`，无 build 行，r5 §3.1）。 */
export function isChiefConversation(id: string): boolean {
  return isChiefConversationId(id);
}

export interface MachineDeps {
  db: Db;
  hub: TeamStreamHub;
  machineHub: MachineWakeHub;
  /** at-rest 加密缝（per-step 凭证解密下发，02 §8；M2c SecretBox）。 */
  box: SecretBox;
  /** 通知收件人（completeStep → setTodoPhase 通知漏斗，02 §9.1/M2c）。 */
  user: UserRecord;
  /** 托管 bare repo 存储根（merge 步 fast-forward 落地，02 §4.2/A6）。 */
  reposDir: string;
  /** 附件存储根（#310 chief attachment 工具读面）。 */
  attachmentsDir: string;
  /** 技能根目录（spec 13 #367：chief systemPrompt 资源清单 + skills relay
   * 读工具 = 本地现扫）。 */
  skillsDir: string;
  /** 本机 MCP config 读路径（spec 13/#368；executeChiefTool deps 透传——
   * 缺省 = 工具侧回落 ~/.claude.json，生产接线恒随 ctx 携带）。 */
  mcpConfigPath?: string;
  /** conversation stream 通道（M5 live streaming：transcript 行/文本增量/
   * 步状态即时推送，02 §1.2 会话流）；缺省 = 无会话流面（单测形态）。 */
  convHub?: ConversationStreamHub;
  /** GitHub 出站注入位（#452 写向：set_task_meta 标题回写 + chief create_todo
   * 自建 issue 透传；AppContext.githubFetch 同族，缺省 globalThis.fetch，
   * 测试注入 mock——零真实出站）。 */
  githubFetch?: FetchLike;
}

/** 步状态位透出会话流（journal 状态 [内部] 列 → step 事件 [设计]）。 */
function publishStepStatus(deps: MachineDeps, stepId: string): void {
  if (!deps.convHub) return;
  const row = deps.db.select().from(step).where(eq(step.id, stepId)).get();
  if (!row) return;
  deps.convHub.publishStep(row.buildId, {
    id: row.id,
    buildId: row.buildId,
    kind: row.kind,
    machineId: row.machineId,
    createdAt: row.createdAt,
    status: row.status,
    checkpointCommit: row.checkpointCommit,
  });
}

// —— wake 通道（claim 长轮询等待者 + SSE stream 订阅者，按 team 分组）—————————

export class MachineWakeHub {
  private readonly waiters = new Map<string, Set<() => void>>();
  private readonly streams = new Map<string, Set<(ev: MachineStreamEvent) => void>>();
  /** 机器定向派发索引（M7 #319，08 册附录 B）：单条 SSE 流的 team key
   * 粒度不够——sync 命令须按 machineId 派发给单台机器（团队可挂多机）。订阅
   * 时同步登记到 streamsByMachine，pushSync 走此索引；streams（team key）
   * 保留用于 wake/shutdown/steer 的全团队广播语义（02 §1.2 + W3 #278）。 */
  private readonly streamsByMachine = new Map<
    string,
    { teamId: string; send: (ev: MachineStreamEvent) => void }
  >();

  /** 等待 wake；true = 被唤醒，false = 超时（长轮询节奏 ≈ timeoutMs，r3 §1.5）。 */
  waitWake(teamId: string, timeoutMs: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      let set = this.waiters.get(teamId);
      if (!set) {
        set = new Set();
        this.waiters.set(teamId, set);
      }
      const holder = set;
      const cleanup = () => {
        holder.delete(fn);
        if (holder.size === 0) this.waiters.delete(teamId);
      };
      const fn = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve(true);
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(false);
      }, timeoutMs);
      holder.add(fn);
    });
  }

  /** 新步入队 → 唤醒该团队全部等待者 + 推送 SSE wake（低延迟派发，02 §1.2）。 */
  wake(teamId: string): void {
    for (const send of this.streams.get(teamId) ?? []) {
      try {
        send({ type: 'wake' });
      } catch {
        // 连接已死：订阅方 onAbort 自清理。
      }
    }
    for (const fn of [...(this.waiters.get(teamId) ?? [])]) fn();
  }

  subscribe(teamId: string, send: (ev: MachineStreamEvent) => void): () => void {
    let set = this.streams.get(teamId);
    if (!set) {
      set = new Set();
      this.streams.set(teamId, set);
    }
    set.add(send);
    return () => {
      set?.delete(send);
      if (set && set.size === 0) this.streams.delete(teamId);
    };
  }

  /** 机器定向订阅（M7 #319 [设计]，08 册附录 B「分支同步」）：team SSE
   * 注册 + machine 索引登记，返回两个清理句柄绑定的复合 unsubscribe。daemon
   * 一个 SSE 连接 = 一台机器，machineId 由 auth 中间件已校验，重复调用 =
   * 后注册覆盖前注册（同一 daemon 重连即重注册，连接已死前一条自动失效）。 */
  subscribeMachine(
    teamId: string,
    machineId: string,
    send: (ev: MachineStreamEvent) => void,
  ): () => void {
    const unsubscribeTeam = this.subscribe(teamId, send);
    const prev = this.streamsByMachine.get(machineId);
    if (prev) {
      try {
        prev.send({ type: 'shutdown' });
      } catch {
        // 连接已死
      }
    }
    this.streamsByMachine.set(machineId, { teamId, send });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      unsubscribeTeam();
      const cur = this.streamsByMachine.get(machineId);
      if (cur && cur.send === send) this.streamsByMachine.delete(machineId);
    };
  }

  /** 机器定向派发 sync 命令（M7 #319 [设计]）：单机命中 = SSE 流在
   * → 派发 sync 事件；未命中（机器离线/SSE 断连）= false。返回 bool 取代抛
   * 错，调用方（services/branch-sync.ts）按 machine.online 校验后仍以本返回值
   * 为准——online 列 = presence 心跳面，本索引 = 实时 SSE 面，二者错位中间
   * 态由调用方处理（写 failed 行 + 推团队流）。 */
  pushSync(machineId: string, cmd: MachineSyncCommand): boolean {
    const entry = this.streamsByMachine.get(machineId);
    if (!entry) return false;
    try {
      entry.send({ type: 'sync', sync: cmd });
      return true;
    } catch {
      return false;
    }
  }

  /** 机器定向索引清理（认证 SSE 流 onAbort 时由路由显式调用，避免
   * streamsByMachine 残留）。 */
  releaseMachine(machineId: string): void {
    this.streamsByMachine.delete(machineId);
  }

  streamCount(teamId: string): number {
    return this.streams.get(teamId)?.size ?? 0;
  }

  /** steer 信号（W3 #278）：推送 SSE steer 事件（载荷只带 stepId 信号）。
   * 不触发 claim 长轮询唤醒——steer 不入队，运行中的步经
   * GET /api/machine/steer 拉取-确认（spec #277「SSE 载荷不携文本防丢」）。 */
  steerSignal(teamId: string, stepId: string): void {
    for (const send of this.streams.get(teamId) ?? []) {
      try {
        send({ type: 'steer', stepId });
      } catch {
        // 连接已死：订阅方 onAbort 自清理。
      }
    }
  }

  /** stop 信号（M7 #308）：推送 SSE stop 事件（载荷只带 stepId 信号，
   * discard 位经 GET /api/machine/stop 拉取-确认——steer 同律，SSE 载荷
   * 不携语义位防丢）。不触发 claim 长轮询唤醒。 */
  stopSignal(teamId: string, stepId: string): void {
    for (const send of this.streams.get(teamId) ?? []) {
      try {
        send({ type: 'stop', stepId });
      } catch {
        // 连接已死：订阅方 onAbort 自清理。
      }
    }
  }
}

/** steer 拉取-确认（W3 #278，GET /api/machine/steer?stepId=）：本机在跑的步
 * 才可拉取（machineId + claimed 双校验）；pending 定向步不匹配（步已收尾/
 * 换新步）→ 丢弃（spec #277「步结束仍有 pending = 丢弃」）；匹配 → 返回内容
 * 并清（拉取即确认）。 */
export function fetchSteer(
  deps: { db: Db },
  machine: { id: string },
  stepId: string,
): { content: string | null } {
  const { db } = deps;
  const stepRow = db.select().from(step).where(eq(step.id, stepId)).get();
  if (!stepRow || stepRow.machineId !== machine.id || stepRow.status !== 'claimed') {
    return { content: null };
  }
  const pending = db
    .select()
    .from(steerPending)
    .where(eq(steerPending.conversationId, stepRow.buildId))
    .get();
  if (!pending) return { content: null };
  db.delete(steerPending).where(eq(steerPending.conversationId, stepRow.buildId)).run();
  if (pending.stepId !== stepId) {
    return { content: null };
  }
  return { content: pending.content };
}

/** stop 拉取-确认（M7 #308，GET /api/machine/stop?stepId=）：fetchSteer 同形
 * ——本机在跑步才可拉取（machineId + claimed 双校验）；pending 定向步不匹配
 * （步已收尾/换新步）→ 丢弃；匹配 → 返回 discard 位并清（拉取即确认）。 */
export function fetchStop(
  deps: { db: Db },
  machine: { id: string },
  stepId: string,
): { discard: boolean | null } {
  const { db } = deps;
  const stepRow = db.select().from(step).where(eq(step.id, stepId)).get();
  if (!stepRow || stepRow.machineId !== machine.id || stepRow.status !== 'claimed') {
    return { discard: null };
  }
  const pending = db
    .select()
    .from(stopPending)
    .where(eq(stopPending.conversationId, stepRow.buildId))
    .get();
  if (!pending) return { discard: null };
  db.delete(stopPending).where(eq(stopPending.conversationId, stepRow.buildId)).run();
  if (pending.stepId !== stepId) {
    return { discard: null };
  }
  return { discard: pending.discard };
}

// —— 认证（02 §8：存哈希比对）———————————————————————————————————————————————

export function findMachineByToken(db: Db, token: string) {
  return db
    .select()
    .from(machine)
    .where(eq(machine.tokenHash, hashCredential(token)))
    .get();
}

export function findApiKeyByPlain(db: Db, plain: string) {
  return db
    .select()
    .from(apiKey)
    .where(eq(apiKey.keyHash, hashCredential(plain)))
    .get();
}

// —— enroll（02 §5.2）———————————————————————————————————————————————————————

/** machine 行 → wire record 投影单源（routes.ts GET/PATCH 与 routes-machine.ts
 * me 双消费；字段增删只改这里 + shared schema）。 */
export function toMachineRecord(row: typeof machine.$inferSelect) {
  return machineRecordSchema.parse({
    id: row.id,
    name: row.name,
    teamId: row.teamId,
    online: row.online,
    latestCliVersion: row.latestCliVersion,
    kind: row.kind,
    enabledRuntimes: row.enabledRuntimes,
    shellEnabled: row.shellEnabled,
  });
}

/** 本机匹配键（spec 11 A8/A9，#357）：daemon `--name` 默认 hostname（r3
 * §1.1），server 侧以自身 os.hostname() 判本机——票面「loopback enroll 同律」
 * 的判定键即 hostname 匹配（同机经 LAN IP 连回也命中；不按连接来源 IP 判，
 * 免绑定形态误伤）。代价 = 异机同名误判 local，票面规则接受。命中返回
 * (teamId, name) 既有行，否则 undefined。 */
function localMachineRow(db: Db, teamId: string, name: string) {
  if (name !== hostname()) return undefined;
  return db
    .select()
    .from(machine)
    .where(and(eq(machine.teamId, teamId), eq(machine.name, name)))
    .get();
}

/** server 启动 seed 本机行（spec 11 A8，index.ts 调），三级定位保证
 * 「本机行至多一行」（验收 #357 + feature map 改名 gotcha）：
 * 1. kind='local' 既有行（含显式 --name 改名后 name 漂移离 hostname 的行）
 *    → 直接复用，不动 name（用户改名意图优先）；
 * 2. hostname 同名行（enroll 先于 seed 落库的窗口）→ 补 kind='local'；
 * 3. 未建 → insert 无凭证 placeholder（tokenHash null；daemon enroll 按
 *    同律复用并补凭证）。
 * idempotent：二次启动不建 duplicate。 */
export function seedLocalMachine(db: Db, teamId: string): void {
  const local = db
    .select()
    .from(machine)
    .where(and(eq(machine.teamId, teamId), eq(machine.kind, 'local')))
    .get();
  if (local) return;
  const byName = localMachineRow(db, teamId, hostname());
  if (byName) {
    db.update(machine).set({ kind: 'local' }).where(eq(machine.id, byName.id)).run();
    return;
  }
  db.insert(machine)
    .values({
      id: newRecordId(),
      teamId,
      name: hostname(),
      online: false,
      tokenHash: null,
      apiKeyId: null,
      latestCliVersion: null,
      kind: 'local',
      // #682：runtime 开关缺省 ['pi']——bootstrap 不空转（claim 真闸下 [] 全关
      // = 新装机一步都领不到）；claude-code 是显式 opt-in（凭据本来就要各机
      // 登录）。存量 [] 行由 0022 migration 回填同值。
      enabledRuntimes: ['pi'],
    })
    .run();
}

export function enrollMachine(
  deps: MachineDeps,
  input: {
    keyId: string;
    teamId: string;
    name: string;
    cliVersion?: string;
    serverUrl: string;
    claudeCode?: ClaudeCodeReport;
  },
): { machineId: string; token: string; teamId: string; serverUrl: string } {
  const { db } = deps;
  const token = newMachineToken();
  const isLocal = input.name === hostname();
  // 重注册复用同一 machineId（r3 §1.2：logout 后重注册 machineId 不变）；
  // 本机律（spec 11 A9）优先认领 seed placeholder 行——loopback enroll 不与
  // 启动 seed 建 duplicate。
  const existing =
    db
      .select()
      .from(machine)
      .where(and(eq(machine.apiKeyId, input.keyId), eq(machine.teamId, input.teamId)))
      .get() ?? (isLocal ? localMachineRow(db, input.teamId, input.name) : undefined);
  if (existing) {
    db.update(machine)
      .set({
        tokenHash: token.hash,
        name: input.name,
        apiKeyId: input.keyId,
        ...(input.cliVersion !== undefined ? { latestCliVersion: input.cliVersion } : {}),
        ...(isLocal ? { kind: 'local' as const } : {}),
        ...(input.claudeCode !== undefined ? { claudeCodeReport: input.claudeCode } : {}),
      })
      .where(eq(machine.id, existing.id))
      .run();
    return {
      machineId: existing.id,
      token: token.plain,
      teamId: input.teamId,
      serverUrl: input.serverUrl,
    };
  }
  const machineId = newRecordId();
  db.insert(machine)
    .values({
      id: machineId,
      teamId: input.teamId,
      name: input.name,
      online: false,
      tokenHash: token.hash,
      apiKeyId: input.keyId,
      latestCliVersion: input.cliVersion ?? null,
      kind: isLocal ? 'local' : 'remote',
      enabledRuntimes: ['pi'],
      ...(input.claudeCode !== undefined ? { claudeCodeReport: input.claudeCode } : {}),
    })
    .run();
  return { machineId, token: token.plain, teamId: input.teamId, serverUrl: input.serverUrl };
}

/** 浏览器授权流建机（#285，02 §5.2 路径一完成面）：无 apiKey——授权页用户
 * 确认（capability = enrollId 单次）即建新机；key 路径的复用键 = apiKeyId 在
 * 此缺席，本机律（spec 11 A9）仍认 seed placeholder 行。machine.json 形状
 * 返回（poll authorized 态同载荷）。 */
export function authorizeEnrollmentMachine(
  deps: MachineDeps,
  input: { teamId: string; name: string; serverUrl: string },
): { machineId: string; token: string; teamId: string; serverUrl: string } {
  const { db } = deps;
  const token = newMachineToken();
  const isLocal = input.name === hostname();
  const existing = isLocal ? localMachineRow(db, input.teamId, input.name) : undefined;
  if (existing) {
    db.update(machine)
      .set({ tokenHash: token.hash, kind: 'local' })
      .where(eq(machine.id, existing.id))
      .run();
    return {
      machineId: existing.id,
      token: token.plain,
      teamId: input.teamId,
      serverUrl: input.serverUrl,
    };
  }
  const machineId = newRecordId();
  db.insert(machine)
    .values({
      id: machineId,
      teamId: input.teamId,
      name: input.name,
      online: false,
      tokenHash: token.hash,
      apiKeyId: null,
      latestCliVersion: null,
      kind: isLocal ? 'local' : 'remote',
      enabledRuntimes: ['pi'],
    })
    .run();
  return { machineId, token: token.plain, teamId: input.teamId, serverUrl: input.serverUrl };
}

// —— presence（02 §5.4：心跳并行失败、进程不退出——server 侧无状态可失败）——————

export function markPresence(
  deps: MachineDeps,
  machineId: string,
  body: { cliVersion?: string; claudeCode?: ClaudeCodeReport },
): void {
  const { db, hub } = deps;
  const row = db.select().from(machine).where(eq(machine.id, machineId)).get();
  if (!row) throw new NotFoundError(`machine ${machineId}`);
  const becameOnline = !row.online;
  db.update(machine)
    .set({
      online: true,
      ...(body.cliVersion !== undefined ? { latestCliVersion: body.cliVersion } : {}),
      ...(body.claudeCode !== undefined ? { claudeCodeReport: body.claudeCode } : {}),
    })
    .where(eq(machine.id, machineId))
    .run();
  if (becameOnline) {
    // team stream machine_presence 事件（02 §1.2 {type,machineId,online}）。
    hub.publish(row.teamId, () => ({ type: 'machine_presence', machineId, online: true }));
  }
}

export function markOffline(deps: MachineDeps, machineId: string): void {
  const { db, hub } = deps;
  const row = db.select().from(machine).where(eq(machine.id, machineId)).get();
  if (!row?.online) return;
  db.update(machine).set({ online: false }).where(eq(machine.id, machineId)).run();
  hub.publish(row.teamId, () => ({ type: 'machine_presence', machineId, online: false }));
}

// —— recover（02 §5.4 步 journal 恢复的 server 侧真值）————————————————————————

export function recoverSteps(deps: MachineDeps, machineId: string): StepRecord[] {
  return deps.db
    .select()
    .from(step)
    .where(and(eq(step.machineId, machineId), eq(step.status, 'claimed')))
    .orderBy(asc(step.createdAt))
    .all()
    .map(toStepRecord);
}

function toStepRecord(r: typeof step.$inferSelect): StepRecord {
  return {
    id: r.id,
    buildId: r.buildId,
    kind: r.kind,
    machineId: r.machineId,
    createdAt: r.createdAt,
  };
}

// —— claim（长轮询 + 并发门 + 三类步，02 §4.2/§5.4）—————————————————————————

interface ClaimCandidate {
  stepRow: typeof step.$inferSelect;
  buildRow: typeof build.$inferSelect;
  todoRow: typeof todo.$inferSelect;
}

function claimCandidates(deps: MachineDeps, machineId: string, teamId: string): ClaimCandidate[] {
  const rows = deps.db
    .select({ stepRow: step, buildRow: build, todoRow: todo })
    .from(step)
    .innerJoin(build, eq(step.buildId, build.id))
    .innerJoin(todo, eq(build.todoId, todo.id))
    .where(
      and(
        eq(step.status, 'pending'),
        eq(todo.teamId, teamId),
        or(isNull(build.pinnedMachineId), eq(build.pinnedMachineId, machineId)),
      ),
    )
    .orderBy(asc(step.createdAt))
    .all();
  return rows;
}

/** chief 步候选（step.buildId = `chief-<threadId>`，join chief_thread 取 teamId；
 * 无 build/todo 行——Chief 回合 = 机器 step，r5 §3.1）。#682 机器亲和：thread
 * 钉了机器（chief 会话文件是执行机本地资产，轮换认领降级 new session）→ 只
 * 有该机器可领；未钉 = 任何机器（现状）。与 worker 步的 build.pinnedMachineId
 * 过滤同语义。 */
function claimChiefCandidates(deps: MachineDeps, machineId: string, teamId: string) {
  return deps.db
    .select({ stepRow: step, threadRow: chiefThread })
    .from(step)
    .innerJoin(chiefThread, eq(step.buildId, chiefThread.id))
    .where(
      and(
        eq(step.status, 'pending'),
        eq(step.kind, 'chief'),
        eq(chiefThread.teamId, teamId),
        or(isNull(chiefThread.pinnedMachineId), eq(chiefThread.pinnedMachineId, machineId)),
      ),
    )
    .orderBy(asc(step.createdAt))
    .all();
}

function agentForStep(
  deps: MachineDeps,
  todoRow: typeof todo.$inferSelect,
  kind: StepRecord['kind'],
  prompt: string | null = null,
) {
  // #881 起判定原语下沉 dispatch-eligibility（claim 与 sweep 单源），此处仅
  // 适配 MachineDeps → db 形参。
  return agentForStepEligibility(deps.db, todoRow, kind, prompt);
}

/** chief 步 claim 载荷组装（remoteTools 51 词表全量 + chief 块 + 会话续轮判定）。
 * 无 todo/project 语境：chief「探测仓库」经 docs relay（server 端裸库读，A4
 * 黑盒逼近 r5 §3.1 的 worktree `git show`），故不下发 repo/git 载荷——避免死
 * 载荷（runner chief 分支本就不开 worktree）。 */
/** executor 最低版本门（02 §7.1 版本墙形状；数值 = 复刻版本线 MCP_MIN_CLI_VERSION
 * [设计]）：机器自报 cliVersion 低于门 = claim 不携带 mcpServers（老 executor
 * 无薄桥，携带即死载荷）。未知版本（老注册行）= 不携带（保守 [设计]）。 */
export function meetsMcpVersionGate(latestCliVersion: string | null): boolean {
  if (!latestCliVersion) return false;
  const parse = (v: string): number[] => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [a, b] = [parse(latestCliVersion), parse(MCP_MIN_CLI_VERSION)];
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
}

/** claim 载荷 mcpServers（spec 13/#368 slug 化断约）：勾选 slug 原样透传——
 * server 不再解析端点、不再接触任何 MCP 凭证；解析权在执行 daemon（各读各机
 * `~/.claude.json`，stdio 命令在真正的执行机上起，未知 slug daemon 侧跳过 +
 * 降级行）。版本门未达或无授权 = 缺省（不携带）——版本墙提升后旧 daemon
 * 收不到该字段，视为无 MCP 运行，不混发两种形状。 */
function claimMcpSlugs(
  latestCliVersion: string | null,
  agentSlugs: readonly string[],
): string[] | undefined {
  if (agentSlugs.length === 0) return undefined;
  if (!meetsMcpVersionGate(latestCliVersion)) return undefined;
  return [...agentSlugs];
}

/** claim 载荷 localTools（XMON-108 R1）：daemon 本机工具注册面，两词各判一次、
 * 判定单源在此——
 * - remote_shell = agent 层「远程 shell」开关 ∩ machine.shellEnabled 双闸齐开
 *   （词值 = shared LOCAL_TOOL_REMOTE_SHELL）。claim 期只管注册；步中每条命令
 *   真实闸在预检端点复核双闸（precheckShellCommand，机器开关秒级热加载由此
 *   兑现——claim 时快照不作数）。
 * - create_tag = agent 层「创建标签」开关即可（机器层无对应闸，leader 裁定
 *   #4：词值 = shared LOCAL_TOOL_CREATE_TAG；词面量单源 = AGENT_TOOL_TAG，
 *   T1/XMON-111 落地后此处消费常量）。
 * 结果 fail-closed：任一闸没开即不注册该词。 */
function claimLocalTools(
  machineRow: { shellEnabled: boolean },
  agentTools: readonly string[],
): string[] {
  const tools: string[] = [];
  if (agentTools.includes(AGENT_TOOL_SHELL) && machineRow.shellEnabled) {
    tools.push(LOCAL_TOOL_REMOTE_SHELL);
  }
  if (agentTools.includes(AGENT_TOOL_TAG)) {
    tools.push(LOCAL_TOOL_CREATE_TAG);
  }
  return tools;
}

/** #895 A4：chief 绑定 Agent 的 provider（亲和闸判与 buildChiefClaim 内闸
 * 同源——会话机开不了 chief 步所需 runtime = 它不是有效候选人）。 */
function chiefAgentProviderOf(deps: MachineDeps, chiefId: string): string | null {
  const chiefRow = deps.db.select().from(chief).where(eq(chief.id, chiefId)).get();
  const agentRow = chiefRow?.agentId
    ? deps.db.select().from(agent).where(eq(agent.id, chiefRow.agentId)).get()
    : undefined;
  return agentRow?.provider ?? null;
}

/** #895 A4 chief 会话亲和（T2 对称，spec 21 机制总图）：未钉线程 + 会话已开
 * 时，持有链尾会话文件的机器（= 链尾 session 步的 machineId，查询与 worker
 * T2 prior 查询同型）若在线且 runtime 闸开 → 本机跳过该候选（步留 pending
 * 等会话机领；跳过只作用于当前候选，不挡同机领其它线程的步——每机可见性
 * 语义，无队头阻塞）。会话机离线/被删/闸关/归属空 → 放行本机（换机 =
 * daemon SessionNotResumable 回退新会话 + RESUME_FRESH_SESSION_NOTE 显式
 * 降级，#862 T1 契约不预判；亲和是软偏好，机器消失即刻放行，不等 T3 宽限
 * ——未钉线程不因亲和产生新的无界等待）。钉选线程（pinnedMachineId 非空，
 * 含主力机来源）不亲和：钉选 SQL 过滤下唯有钉选机可见，亲和再挡 = 唯一
 * 可见者被挡死；钉选 = 用户显式选择，盖过软偏好。 */
function chiefAffinityHeldByOther(
  deps: MachineDeps,
  threadRow: typeof chiefThread.$inferSelect,
  machineId: string,
): boolean {
  if (threadRow.pinnedMachineId !== null) return false;
  if (threadRow.sessionId === '') return false; // 首轮：无会话文件依赖
  const prior = deps.db
    .select({ sessionId: step.sessionId, machineId: step.machineId })
    .from(step)
    .where(and(eq(step.buildId, threadRow.id), sql`${step.sessionId} is not null`))
    .orderBy(asc(step.createdAt))
    .all();
  const owner = prior.length > 0 ? (prior[prior.length - 1] ?? null) : null;
  if (owner === null || owner.machineId === null || owner.machineId === machineId) return false;
  const ownerRow = deps.db.select().from(machine).where(eq(machine.id, owner.machineId)).get();
  if (ownerRow === undefined || !ownerRow.online) return false;
  return runtimeGatePasses(ownerRow, chiefAgentProviderOf(deps, threadRow.chiefId));
}

function buildChiefClaim(
  deps: MachineDeps,
  machineId: string,
  stepRow: typeof step.$inferSelect,
  threadRow: typeof chiefThread.$inferSelect,
  machineRow?: typeof machine.$inferSelect,
): ClaimedStep | null {
  // 绑定 Agent（模型 = 绑定 Agent 模型，r5 §3.1）：未绑定/无模型 = 不可派发
  // （server 侧不派发 [设计]，与门控条 canon 一致）。单次读 chief 行。
  const chiefRow = deps.db.select().from(chief).where(eq(chief.id, threadRow.chiefId)).get();
  const agentRow = chiefRow?.agentId
    ? deps.db.select().from(agent).where(eq(agent.id, chiefRow.agentId)).get()
    : undefined;
  if (!chiefRow || !agentRow?.modelId) return null;
  // #682 enabledRuntimes 真闸（chief 步同律）：chief 绑定 agent 的 runtime
  // 机器未开 = 该机不可领本回合（候选循环自动试下一条 chief 步）。
  if (!machineRow || !runtimeGatePasses(machineRow, agentRow.provider)) return null;
  // 思考强度覆盖（PATCH body agent.thinkingLevel，r5 §2）优先，回退绑定 Agent 值。
  const thinkingLevel = chiefRow.thinkingLevel ?? agentRow.thinkingLevel;
  // 主模型覆盖（#615，r5 107/108 独立「模型」选择器落库面）优先，回退绑定
  // Agent 的 provider/modelId——覆盖是整对象换（provider+modelId 同槽）。
  const model = chiefRow.model ?? { provider: agentRow.provider, modelId: agentRow.modelId };
  const claimedAt = nowMs();
  const res = deps.db
    .update(step)
    .set({ status: 'claimed', machineId, claimedAt, lastHeartbeatAt: claimedAt })
    .where(and(eq(step.id, stepRow.id), eq(step.status, 'pending')))
    .run();
  if (res.changes === 0) return null;
  const ctx = chiefClaimContext(deps, threadRow.id);
  // #823 发送后 skill 路由（claim 时 = worker 开工前路由位）：仅用户触发轮检测
  // （wake/系统轮跳过——matcher 另有 [wake: 前缀纵深防御）。提示节只进
  // systemPrompt，step.prompt（用户原文）逐字不动；节恒为"建议"（agent 先用
  // skills 工具核对详情，不切合直接忽略）——误触发可逆，普通对话零劫持。
  const trigger = parseChiefTrigger(stepRow.prompt);
  let systemPrompt = ctx?.systemPrompt ?? '';
  if (ctx && trigger === 'user') {
    const hint = suggestSkillsForMessage(
      stepRow.prompt ?? '',
      scanLocalSkills(deps.skillsDir).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      })),
    );
    if (hint) systemPrompt = `${systemPrompt}\n\n${formatSkillRouteSection(hint)}`;
  }
  // 记忆注入（02 §4.4 读路径最小形；注入形 [推断] 保留）：绑定 Agent 记忆条目。
  const memories = deps.db
    .select({ title: agentMemory.title, content: agentMemory.content })
    .from(agentMemory)
    .where(eq(agentMemory.agentId, agentRow.id))
    .all();
  // Chief = 特例 Agent（02 §4.3）：绑定 Agent 的 MCP 授权同样进回合载荷。
  const chiefMcp = claimMcpSlugs(machineRow?.latestCliVersion ?? null, agentRow.mcpServers);
  return {
    step: {
      id: stepRow.id,
      buildId: stepRow.buildId,
      kind: 'chief',
      machineId,
      createdAt: stepRow.createdAt,
    },
    conversationId: stepRow.buildId, // ≡ chief-<threadId>（r5 §3.1）
    session: {
      action: threadRow.sessionId !== '' ? 'continue' : 'new',
      sessionId: threadRow.sessionId !== '' ? threadRow.sessionId : null,
    },
    ...(stepRow.prompt !== null ? { instruction: stepRow.prompt } : {}),
    agent: {
      id: agentRow.id,
      displayName: agentRow.displayName,
      description: agentRow.description,
      provider: model.provider,
      modelId: model.modelId,
      thinkingLevel,
      memories,
      // skills 白名单不携带（#372）：chief 是信任面，catalog 全量直通不受
      // 绑定 Agent 勾选约束（daemon 侧 isChief 判定双保险）。tools 同律不
      // 携带（XMON-77）：chief 步无 worktree/git 收尾，推送/合并开关无语义。
      // localTools 同律不携带（XMON-108 R1）：chief 无 worktree/shell 执行
      // 面，remote_shell/create_tag 无语义（预检端点对 chief 步 409 拒绝）。
    },
    chief: {
      threadId: threadRow.id,
      systemPrompt,
      trigger,
    },
    remoteTools: [...CHIEF_REMOTE_TOOLS],
    ...(chiefMcp ? { mcpServers: chiefMcp } : {}),
  };
}

function tryClaim(
  deps: MachineDeps,
  machineId: string,
  teamId: string,
  origin: string,
): ClaimedStep | null {
  const { db } = deps;
  const machineRow = db.select().from(machine).where(eq(machine.id, machineId)).get();
  if (!machineRow) return null;
  // #503：并发门摘除——原判据「本机 claimed 步数 ≥ machine.maxConcurrent」不再
  // 存在，机器领活不受上限约束。

  // chief 步与 worker 步共队列，按 createdAt FIFO 交错（chief 派工先于其产生的
  // worker 步入队，天然领先；跨类型仍按 createdAt 保序 [设计]）。
  const workerCands = claimCandidates(deps, machineId, teamId);
  const chiefCands = claimChiefCandidates(deps, machineId, teamId);
  const earliestWorker = workerCands[0]?.stepRow.createdAt ?? Number.POSITIVE_INFINITY;
  for (const cand of chiefCands) {
    if (cand.stepRow.createdAt > earliestWorker) break; // worker 更早 → 先走 worker
    // #895 A4：会话机持有本候选（在线且闸开）→ 让给它（见函数头注释）。
    if (chiefAffinityHeldByOther(deps, cand.threadRow, machineId)) continue;
    const claimed = buildChiefClaim(deps, machineId, cand.stepRow, cand.threadRow, machineRow);
    if (claimed) {
      publishStepStatus(deps, claimed.step.id);
      return claimed;
    }
  }

  for (const cand of workerCands) {
    const agentRow = agentForStep(deps, cand.todoRow, cand.stepRow.kind, cand.stepRow.prompt);
    // 未指派 Agent = 不可执行（Agent 可空是 UI 语义，派发需模型位 [设计]）。
    if (!agentRow?.modelId) continue;
    // #682 enabledRuntimes 真闸：机器未开步所需 runtime = 不可领（步留
    // pending 给能跑的机器——机器开 pi、步跑 claude-code agent = 不投给该机）。
    if (!runtimeGatePasses(machineRow, agentRow.provider)) continue;
    // continue session 判定（02 §5.7：合并轮/重规划轮复用同 conv pi 会话）。
    // #863 T2 起判定前移到领取前——会话亲和闸需要同一份事实（prior session +
    // 交接缺失位）；候选步自身 pending ⇒ sessionId 恒空不进结果集，且判定与
    // 领取在同一同步块内（单进程 better-sqlite3），前后移零语义差。
    const prior = db
      .select({ sessionId: step.sessionId, machineId: step.machineId })
      .from(step)
      .where(and(eq(step.buildId, cand.stepRow.buildId), sql`${step.sessionId} is not null`))
      .orderBy(asc(step.createdAt))
      .all();
    const priorRow = prior.length > 0 ? (prior[prior.length - 1] ?? null) : null;
    const priorSessionId = priorRow?.sessionId ?? null;
    // plan.md 交接缺失的 build 步强制 new session（#113 裁定候选2 兜底）：plan 关
    // 未产交接物时续轮会话里无可指方案（confirm 措辞空转 → agent 反问「哪个方案」，
    // 05 §5 实跑）；new session 令 daemon 以 todo 原始 title+spec 开工（runner
    // buildTaskPrompt），agent 必拿任务内容。plan.md 在 → 续轮不变。
    const planHandoffMissing =
      cand.stepRow.kind === 'build' && cand.buildRow.withPlan && cand.buildRow.planDocId === null;
    // review 步恒开新会话（#511）：审核是额外 agent 步，不接续主 conv 会话——
    // 审核者与被审者常是不同的 Agent/模型，接续会让它继承执行轮的上下文，
    // 且 continue 路径会吃掉服务端注入的审核材料（daemon 侧 CONTINUE_PROMPTS
    // 只有一句占位文案，plan.md 全文/变更/diff 全在 step.prompt 里）。
    // #863 T2 会话亲和（machine-execution-plane §4-7，正确性项）：conv 会话
    // 文件是执行机本地资产——会续接 prior session 的步优先回「持有该会话的
    // 机器」（= 链尾 session 步的 machineId，与 continue 判定同源）。其机在
    // 线且 runtime 闸开 = 它是有效候选人，本机跳过该步（步留 pending 等它
    // 领；跳过只作用于本候选，更晚的它 build 步照领，与钉选过滤同型的每机
    // 可见性语义，无队头阻塞）。其机离线/被删/闸关/归属空 = 放行本机（换机
    // → daemon SessionNotResumable 回退新会话 + RESUME_FRESH_SESSION_NOTE
    // 显式降级标记，#862 T1 契约不替它预判）。恒新会话的步（review/交接缺
    // 失/首步）无会话文件依赖，不亲和。钉选 build（pinnedMachineId 非空）不
    // 亲和：钉选 SQL 过滤下唯有钉选机可见，亲和再挡 = 唯一可见者也被挡死；
    // 且钉选 = 用户显式选择，盖过软偏好。
    // #881 楔住有界（#863 登记的已知缝）：让行不是无限期——步已等过
    // SESSION_WEDGE_GRACE_MS 且会话机手上没有任何 claimed 步 → 判楔住，
    // 放行本机（换机 + daemon 注记，与离线换机同一条降级路）。会话机持有
    // claimed 步 = 忙（claim 主循环与 runStep 串行，忙 = 暂不领新步是正常，
    // 等它跑完无损续接）→ 让行继续；忙步心跳停更的「部分存活歧义态」归属
    // 既有 claimed 扫尾政策（等 presence 过期走释放），亲和不越过它抢先换机。
    // 会话机自己从不受本闸挡（priorRow.machineId === machineId 时闸不进）：
    // 楔住释放后它恢复即仍可无损认领。
    const sessionContinuing =
      priorSessionId !== null &&
      cand.stepRow.kind !== 'review' &&
      !planHandoffMissing &&
      cand.buildRow.pinnedMachineId === null;
    if (
      sessionContinuing &&
      priorRow !== null &&
      priorRow.machineId !== null &&
      priorRow.machineId !== machineId
    ) {
      const ownerRow = db.select().from(machine).where(eq(machine.id, priorRow.machineId)).get();
      if (ownerRow?.online && runtimeGatePasses(ownerRow, agentRow.provider)) {
        const ownerBusy =
          db
            .select({ id: step.id })
            .from(step)
            .where(and(eq(step.machineId, ownerRow.id), eq(step.status, 'claimed')))
            .get() !== undefined;
        if (ownerBusy || nowMs() - stepActivityAt(cand.stepRow) <= SESSION_WEDGE_GRACE_MS) {
          continue;
        }
      }
    }
    // 原子领取：仅当仍 pending 时置 claimed（单进程 better-sqlite3 同步写）。
    const claimedAt = nowMs();
    const res = db
      .update(step)
      .set({ status: 'claimed', machineId, claimedAt, lastHeartbeatAt: claimedAt })
      .where(and(eq(step.id, cand.stepRow.id), eq(step.status, 'pending')))
      .run();
    if (res.changes === 0) continue;
    // claim 即 phase 推进（phase.ts 边集：queued→planning/building，02 §4.2）。
    if (cand.todoRow.phase === 'queued') {
      setTodoPhase(deps, cand.todoRow.id, cand.stepRow.kind === 'plan' ? 'planning' : 'building');
    }
    const session =
      planHandoffMissing || cand.stepRow.kind === 'review'
        ? { action: 'new' as const, sessionId: null }
        : {
            action: priorSessionId ? ('continue' as const) : ('new' as const),
            sessionId: priorSessionId,
          };
    const projectRow = db
      .select()
      .from(project)
      .where(eq(project.id, cand.todoRow.projectId))
      .get();
    // repo 绑定位（M3b worktree 契约接线，02 §3/§5.5 + spec 12 G2-T2 三形态）：
    // 托管 = `<origin>/git/<teamId>/<repoName>`（本地主机代位）；github = https
    // 派生（执行凭证 = stepToken 从 github_connection 下发）；local = cloneUrl
    // 即用户仓库绝对路径（validateLocalRepoPath 规范化值——daemon 镜像 clone 源
    // 与 ff-only 落地面同吃该路径）。派生单源 = git.projectRepoRef（#511 起
    // 审核步的「有无只读检出」判据同吃它）。
    const repo = projectRepoRef(projectRow, origin);
    // worker 步 remoteTools = 记忆三件套（02 §4.4 写路径 / r5 §6：worker 侧
    // 同族工具经 remoteTools 下发，relay 服务端执行；触发 = spec 指令 + Agent
    // 裁量，宿主不做任务结束蒸馏）。MCP 授权端点随载荷（02 §7.1 per-turn 连接）。
    const workerMcp = claimMcpSlugs(machineRow.latestCliVersion, agentRow.mcpServers);
    // github 形态项目的任务元信息注入面（#446 / ADR 0005 分叉律）：词表 =
    // 项目标签集镜像（claim 时现取 DB 真值，不缓存第二份）；titleFinal =
    // issue 来源标题已真值（daemon 不指示回填）。local/hosted 缺省 meta ——
    // daemon 回落 FIXED_TAGS 现行为，文本逐字节不变。校验真值在 setTaskMeta
    // （按项目形态分支），meta 只驱动提示词面。
    const isGithubProject = projectRow?.repoKind === 'github';
    // titleFinal = 仅**导入**任务（'github-issue'，标题真值在 issue 侧，ADR
    // 0005 D5）；自建 issue 任务（'github-issue-self'，#452 / ADR 0006 D3）
    // 标题真值在 pacman 侧——占位标题仍走 agent 回填并写进 issue，恒 false。
    const taskMeta =
      isGithubProject && projectRow
        ? {
            titleFinal: cand.todoRow.sourceKind === 'github-issue',
            vocab: listProjectTagVocab(db, projectRow.id),
          }
        : undefined;
    publishStepStatus(deps, cand.stepRow.id);
    return {
      step: {
        id: cand.stepRow.id,
        buildId: cand.stepRow.buildId,
        kind: cand.stepRow.kind,
        machineId,
        createdAt: cand.stepRow.createdAt,
      },
      conversationId: cand.stepRow.buildId, // buildId ≡ conversationId（CONTEXT.md）
      session,
      ...(cand.stepRow.prompt !== null ? { instruction: cand.stepRow.prompt } : {}),
      todo: {
        id: cand.todoRow.id,
        seqNum: cand.todoRow.seqNum,
        title: cand.todoRow.title,
        spec: cand.todoRow.spec,
        ...(taskMeta !== undefined ? { meta: taskMeta } : {}),
      },
      project: { id: cand.todoRow.projectId, name: projectRow?.name ?? '', repo },
      agent: {
        id: agentRow.id,
        displayName: agentRow.displayName,
        description: agentRow.description,
        provider: agentRow.provider,
        modelId: agentRow.modelId,
        thinkingLevel: agentRow.thinkingLevel,
        // 记忆注入（02 §4.4 读路径最小形，注入形 [推断] 保留）：执行 Agent 记忆。
        memories: db
          .select({ title: agentMemory.title, content: agentMemory.content })
          .from(agentMemory)
          .where(eq(agentMemory.agentId, agentRow.id))
          .all(),
        // skills catalog 白名单（#372）：勾选 slug 原样透传（过滤权在 daemon
        // catalog 构建）。worker 步恒携带——含空数组（[] = 不注入任何 skill，
        // least-privilege；缺省 = 全量直通是 chief 面语义，两态不得混淆）。
        skills: [...agentRow.skills],
        // 权限开关已开集（XMON-77）：原样透传（执法权在 daemon 收尾闸——只认
        // 已知档，存量残值自然无效）。恒携带含空数组（[] = 全关 = 不推不并；
        // 缺省保留给老 server 形 fail-open，两态不得混淆）。
        tools: [...agentRow.tools],
      },
      remoteTools: [...(isGithubProject ? WORKER_REMOTE_TOOLS_GITHUB : WORKER_REMOTE_TOOLS)],
      // daemon 本机工具注册面（XMON-108 R1）：server 判定的注册词集（判定
      // 单源 = claimLocalTools）。同 tools 律恒携带含空数组（[] = 无本机工具
      // 可注册；缺省保留给老 server 形，两态不得混淆）。注册 ≠ 放行：步中
      // 每条命令经预检端点复核（machine.shellEnabled 每调用重读）。
      localTools: claimLocalTools(machineRow, agentRow.tools),
      ...(workerMcp ? { mcpServers: workerMcp } : {}),
    };
  }
  return null;
}

/** 长轮询 claim：先试领；空手则等 wake/超时后再试一次（节奏 ≈ holdMs ≈ 75s，
 * r3 §1.5 实测 ~75–76s；wake = 低延迟派发，02 §5.4）。origin = 请求源
 * （托管 cloneUrl 本地主机代位段，02 §5.8 gitHostDomain 槽）。 */
export async function claimStep(
  deps: MachineDeps,
  machineId: string,
  teamId: string,
  holdMs: number,
  origin: string,
): Promise<ClaimedStep | null> {
  const first = tryClaim(deps, machineId, teamId, origin);
  if (first) return first;
  await deps.machineHub.waitWake(teamId, holdMs);
  return tryClaim(deps, machineId, teamId, origin);
}

// —— journal：heartbeat / tool / token / upload-urls / done（02 §5.4）——————————

export function heartbeatStep(deps: MachineDeps, machineId: string, stepId: string): void {
  const row = ownedStep(deps, machineId, stepId);
  deps.db.update(step).set({ lastHeartbeatAt: nowMs() }).where(eq(step.id, row.id)).run();
}

function ownedStep(deps: MachineDeps, machineId: string, stepId: string) {
  const row = deps.db.select().from(step).where(eq(step.id, stepId)).get();
  if (!row) throw new NotFoundError(`step ${stepId}`);
  if (row.machineId !== machineId) throw new NotFoundError(`step ${stepId} (not yours)`);
  return row;
}

/** 工具调用 live 回传（transcript 工具行数据面，r3 §3.5）；与终稿 transcript
 * 上传按 toolCall id 幂等去重 [设计]。chief 步行落 chief_message（线程面）。 */
export function reportTool(
  deps: MachineDeps,
  machineId: string,
  stepId: string,
  call: ToolCallRecord,
): void {
  const row = ownedStep(deps, machineId, stepId);
  const messageRow = {
    id: call.id,
    role: 'assistant' as const,
    content: { kind: 'toolcall', call },
    createdAt: call.endedAt ?? nowMs(),
  };
  if (isChiefConversation(row.buildId)) {
    upsertChiefRow(deps, { ...messageRow, threadId: row.buildId });
    return;
  }
  upsertMessage(deps, { ...messageRow, conversationId: row.buildId });
}

/** live transcript 文本增量（machineToolBodySchema 第三形 [设计]）：瞬态
 * 转发到 conversation stream，不落库——终稿经 upload-urls transcript.json
 * 兜底（02 §1.3 数据所有权不变）。 */
export function reportTranscriptDelta(
  deps: MachineDeps,
  machineId: string,
  stepId: string,
  text: string,
): void {
  const row = ownedStep(deps, machineId, stepId);
  if (text === '') return;
  deps.convHub?.publishTextDelta(row.buildId, text);
}

/** remoteTools relay 执行（02 §4.3「服务端定义并执行」；r5 §3.1 bundle：POST
 * /api/machine/tool/<stepId> {name, params} → {text}）。机器所有权校验后按步类
 * 分流：chief 步 = 51 词表（溯源上下文 step → chief_thread → chief）；worker
 * 步 = 记忆三件套 + 附件读 + set_task_meta + 技能写词（02 §4.4/r5 §6 worker
 * 写路径 + XMON-109 技能写，溯源 step → build → todo → assignment 槽）。
 * 返回 JSON 串（daemon 侧包 {text} 回 pi）。 */
export async function executeRelayToolCall(
  deps: MachineDeps,
  machineId: string,
  stepId: string,
  name: string,
  params: Record<string, unknown>,
): Promise<string> {
  const row = ownedStep(deps, machineId, stepId);
  if (row.kind !== 'chief') {
    return executeWorkerMemoryToolCall(deps, row, name, params);
  }
  if (!isChiefConversation(row.buildId)) {
    throw new HttpError(400, `step ${stepId} is not a chief step`);
  }
  const threadId = row.buildId;
  const threadRow = deps.db.select().from(chiefThread).where(eq(chiefThread.id, threadId)).get();
  if (!threadRow) throw new NotFoundError(`chief thread ${threadId}`);
  const chiefRow = deps.db.select().from(chief).where(eq(chief.id, threadRow.chiefId)).get();
  if (!chiefRow) throw new NotFoundError(`chief ${threadRow.chiefId}`);
  return executeChiefTool(
    {
      db: deps.db,
      hub: deps.hub,
      machineHub: deps.machineHub,
      box: deps.box,
      user: deps.user,
      reposDir: deps.reposDir,
      attachmentsDir: deps.attachmentsDir,
      skillsDir: deps.skillsDir,
      ...(deps.mcpConfigPath !== undefined ? { mcpConfigPath: deps.mcpConfigPath } : {}),
      ...(deps.githubFetch !== undefined ? { githubFetch: deps.githubFetch } : {}),
    },
    {
      teamId: threadRow.teamId,
      userId: threadRow.userId,
      chiefId: chiefRow.id,
      threadId,
      chiefAgentId: chiefRow.agentId,
      conversationId: threadId,
    },
    name,
    params,
  );
}

/** worker 步 relay = 记忆三件套 + set_task_meta + 技能写词 create_skill/
 * update_skill（白名单在 executeWorkerMemoryTool / 下方拦截；词表外 400；
 * 技能写词按 agent 行 tools 开关执法 403）。溯源上下文（r5 §6 实测
 * 样本 = 运行中 todo/build）：step → build → todo → assignment 槽 Agent
 * （02 §4.2 按步类取槽）。 */
async function executeWorkerMemoryToolCall(
  deps: MachineDeps,
  row: typeof step.$inferSelect,
  name: string,
  params: Record<string, unknown>,
): Promise<string> {
  const buildRow = deps.db.select().from(build).where(eq(build.id, row.buildId)).get();
  if (!buildRow) throw new NotFoundError(`build ${row.buildId}`);
  const todoRow = deps.db.select().from(todo).where(eq(todo.id, buildRow.todoId)).get();
  if (!todoRow) throw new NotFoundError(`todo ${buildRow.todoId}`);
  // spec 15 #394：任务元信息回填（ADR 0002 D3）。窄工具——todoId 从步钉死、
  // 不走 agent 槽闸（写面是 todo 不是 agent 资产），词表外 tag name 400。
  if (name === 'set_task_meta') return setTaskMeta(deps, todoRow, params);
  const slot = row.kind === 'plan' ? todoRow.assignment?.plan : todoRow.assignment?.build;
  const agentId = slot?.agentId;
  // XMON-109 S1：技能写词（词表恒列，授权执法在 agent 行 tools——403 同
  // requestMerge 形）。无 agent 步无执行者可审计 = 409（纵深防御位：agent
  // 空槽步不入 claim 候选，正常流走不到）。
  if (name === 'create_skill' || name === 'update_skill') {
    if (!agentId) throw new HttpError(409, 'step has no assigned agent — skill write has no actor');
    return executeWorkerSkillTool(deps, todoRow, agentId, name, params);
  }
  if (!agentId) throw new HttpError(409, 'step has no assigned agent — memory has no store');
  return executeWorkerMemoryTool(
    deps.db,
    {
      teamId: todoRow.teamId,
      agentId,
      todoId: todoRow.id,
      projectId: todoRow.projectId,
      buildId: row.buildId,
      attachmentsDir: deps.attachmentsDir,
    },
    name,
    params,
  );
}

/** worker 技能写词执行（XMON-109 S1）：agent 行 tools 开关执法——「创建
 * 技能/更新技能」未开 = 403（requestMerge 同形：点名开关 + 指路 Agent
 * 详情页权限 tab；词表恒列与授权执法解耦，缺权调用在此拒）。通过后走
 * createLocalSkill/updateLocalSkill 单源写路径，审计 actor = 该步 Agent。 */
async function executeWorkerSkillTool(
  deps: MachineDeps,
  todoRow: typeof todo.$inferSelect,
  agentId: string,
  name: 'create_skill' | 'update_skill',
  params: Record<string, unknown>,
): Promise<string> {
  const agentRow = deps.db.select().from(agent).where(eq(agent.id, agentId)).get();
  if (!agentRow) throw new NotFoundError(`agent ${agentId}`);
  const want = name === 'create_skill' ? AGENT_TOOL_SKILL_CREATE : AGENT_TOOL_SKILL_UPDATE;
  if (!agentRow.tools.includes(want)) {
    throw new HttpError(
      403,
      `Agent ${agentRow.displayName} 未获「${want}」授权（Agent 详情页权限 tab），无法${name === 'create_skill' ? '创建' : '更新'}技能`,
    );
  }
  const opts = {
    db: deps.db,
    skillsDir: deps.skillsDir,
    teamId: todoRow.teamId,
    actor: { type: 'agent' as const, id: agentId },
  };
  if (name === 'create_skill') {
    const body = parseWith(createSkillBodySchema, params, 'params');
    return JSON.stringify(createLocalSkill(opts, body));
  }
  const body = parseWith(updateSkillToolParamsSchema, params, 'params');
  return JSON.stringify(updateLocalSkill(opts, body.skillId, body));
}

/** GET /api/machine/skills/{stepId}（XMON-109 S1，MACHINE_WIRE_EXTENSIONS
 * 登记 [设计] 附加端点）：S2 daemon 物化消费契约——按步出技能包。chief 步
 * = 信任面全量现扫（#372 同律，不受白名单约束）；worker 步 = agentForStep
 * 解析 Agent 的 skills 白名单 ∩ 现扫。字节闸：单文件 ≤
 * MAX_SKILL_FILE_BYTES（readSkillFile 同闸，盘上字节数计）、包总量 ≤
 * MAX_SKILL_TOTAL_BYTES（utf8 字节数累计），超限 400 点名——写面同闸，
 * 超限技能/包不静默截断（调用方显式修白名单或文件）。 */
/** GET /api/machine/attachment/{stepId}/{attachmentId} 服务层（#730）：daemon
 * 侧图片交付的下载面。三道闸——ownedStep（本机步，非本机 404）→ 附件 team
 * 归属（跨 team 404，requireAttachmentRow 单源）→ ready 状态（pending/failed
 * 409 原因带状态词）。载荷 = readAttachmentMeta 同形（base64 in-memory，
 * 10MiB cap 即内存预算上界）。机器 token 认证由路由中间件（/api/machine/*）
 * 先行完成；teamId 取机器行——机器与附件必须同 team。 */
export function machineAttachmentDownload(
  deps: MachineDeps,
  machineId: string,
  machineTeamId: string,
  stepId: string,
  attachmentId: string,
): MachineAttachmentResponse {
  ownedStep(deps, machineId, stepId); // 非本机步/未知步 = 404
  const meta = readAttachmentMeta(
    { db: deps.db, attachmentsDir: deps.attachmentsDir },
    machineTeamId,
    attachmentId,
  );
  return {
    fileName: meta.fileName,
    mimeType: meta.mimeType,
    sizeBytes: meta.sizeBytes,
    contentBase64: meta.content,
  };
}

export function machineSkillsPackage(
  deps: MachineDeps,
  machineId: string,
  stepId: string,
): MachineSkillsResponse {
  const row = ownedStep(deps, machineId, stepId); // 非本步凭证/未知步 = 404
  const scanned = scanLocalSkills(deps.skillsDir);
  let wanted = scanned;
  if (row.kind !== 'chief') {
    const buildRow = deps.db.select().from(build).where(eq(build.id, row.buildId)).get();
    if (!buildRow) throw new NotFoundError(`build ${row.buildId}`);
    const todoRow = deps.db.select().from(todo).where(eq(todo.id, buildRow.todoId)).get();
    if (!todoRow) throw new NotFoundError(`todo ${buildRow.todoId}`);
    const agentRow = agentForStep(deps, todoRow, row.kind, row.prompt);
    const whitelist = new Set(agentRow?.skills ?? []);
    wanted = scanned.filter((s) => whitelist.has(s.id));
  }
  const skills: MachineSkillsResponse['skills'] = [];
  let total = 0;
  for (const skill of wanted) {
    const dir = join(deps.skillsDir, skill.dirName);
    const files: { path: string; content: string }[] = [];
    for (const path of listSkillFiles(dir)) {
      const content = readSkillFile(dir, path); // 链接逃逸/缺位 = null（防御位跳过）
      if (content === null) continue;
      total += Buffer.byteLength(content, 'utf8');
      if (total > MAX_SKILL_TOTAL_BYTES) {
        throw new HttpError(
          400,
          `skill files too large: total ${total} bytes (limit ${MAX_SKILL_TOTAL_BYTES})`,
        );
      }
      files.push({ path, content });
    }
    skills.push({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      dirName: skill.dirName,
      files,
    });
  }
  return { skills };
}

/** set_task_meta（spec 15 #394 + #446/ADR 0005 分叉律 + #452 写向）：校验按
 * 项目形态分支——local/hosted = FIXED_TAGS 白名单 + 单 tag + title 必填
 * （现行为逐字节不变，ADR 0002 D3/D4 收窄后的 local 适用域）；github =
 * 项目标签集（仓库 label 镜像）+ tags 多枚 + title 可选（导入任务标题已真
 * 值；自建 issue 任务回填并写回 issue，ADR 0006 D3）。
 * 两形态共用一条不变式：贴的标签必须在本项目标签集内。标题归一（首行
 * ≤50 字符，derivePlaceholderTitle 复用）同形。更新走 updateTodo 既有面
 * （v++ + SSE 广播，看板实时刷新）。async = github 形态的 issue 标题回写
 * 出站位（local 形态零出站，行为不变）。 */
async function setTaskMeta(
  deps: MachineDeps,
  todoRow: typeof todo.$inferSelect,
  params: Record<string, unknown>,
): Promise<string> {
  const projectRow = deps.db
    .select({ repoKind: project.repoKind })
    .from(project)
    .where(eq(project.id, todoRow.projectId))
    .get();
  if (projectRow?.repoKind === 'github') return setTaskMetaGithubForm(deps, todoRow, params);
  const title = normalizedMetaTitle(params.title);
  let tagIds: string[] | undefined;
  if (params.tag !== undefined) {
    const tagName = params.tag;
    if (typeof tagName !== 'string' || !FIXED_TAGS.some((t) => t.name === tagName)) {
      throw new HttpError(
        400,
        `invalid params.tag: expected one of ${FIXED_TAGS.map((t) => t.name).join(', ')}`,
      );
    }
    const tagId = resolveFixedTagId(deps.db, todoRow.projectId, tagName);
    if (tagId === null) throw new HttpError(400, `tag ${tagName} not seeded in project`);
    tagIds = [tagId];
  }
  const record = updateTodo(
    { db: deps.db, hub: deps.hub, machineHub: deps.machineHub, user: deps.user },
    todoRow.id,
    { title, ...(tagIds !== undefined ? { tagIds } : {}) },
  );
  if (!record) throw new NotFoundError(`todo ${todoRow.id}`);
  return JSON.stringify({ todoId: record.id, title: record.title, tagIds: record.tagIds });
}

/** set_task_meta 标题归一（两形态共用单点）：derivePlaceholderTitle 首行
 * ≤50 字符；非串 / 归一后空白 → 400。 */
function normalizedMetaTitle(raw: unknown): string {
  const title = typeof raw === 'string' ? derivePlaceholderTitle(raw) : '';
  if (title === '') throw new HttpError(400, 'invalid params.title: expected non-empty string');
  return title;
}

/** github 形态 set_task_meta（#446 + #452 写向）：title 可选（归一规则同
 * local——多行/超长传值归一到首行 ≤50）；**导入**任务（sourceKind =
 * 'github-issue'）的标题已是真值——带 title 的调用一律 400（AC「不被回填
 * 覆盖」的机械闸，提示词面不注入回填指令是第一道，本闸是第二道）；自建
 * issue 任务（'github-issue-self'，ADR 0006 D3）title 放行且落库后写进那
 * 枚 issue（回写失败吞——relay 恒 200，漂移交详情页只读回显提示面，B2）；
 * tags = name 数组，逐个按项目标签集现查解析，集合外 name = 400；title 与
 * tags 全缺 = 400（无意义调用）。混部容忍：旧形单 `tag` 字符串并入 tags
 * （server 校验按项目形态分支，不按工具面形状——旧 daemon 发旧参数不断
 * 约）。 */
async function setTaskMetaGithubForm(
  deps: MachineDeps,
  todoRow: typeof todo.$inferSelect,
  params: Record<string, unknown>,
): Promise<string> {
  let title: string | undefined;
  if (params.title !== undefined) {
    if (todoRow.sourceKind === 'github-issue') {
      throw new HttpError(400, 'invalid params.title: title is final (issue-sourced)');
    }
    title = normalizedMetaTitle(params.title);
  }
  let tagIds: string[] | undefined;
  const rawTags = params.tags !== undefined ? params.tags : params.tag;
  if (rawTags !== undefined) {
    const names = typeof rawTags === 'string' ? [rawTags] : rawTags;
    if (!Array.isArray(names) || names.some((n) => typeof n !== 'string' || n === '')) {
      throw new HttpError(400, 'invalid params.tags: expected an array of tag names');
    }
    const resolved = resolveProjectTagIds(deps.db, todoRow.projectId, names);
    for (const name of names) {
      if (!resolved.has(name)) {
        throw new HttpError(400, `tag ${name} not in project tag set`);
      }
    }
    tagIds = [...new Set(names.map((n) => resolved.get(n)))].filter(
      (id): id is string => id !== undefined,
    );
  }
  if (title === undefined && tagIds === undefined) {
    throw new HttpError(400, 'invalid params: expected at least one of title / tags');
  }
  const todoDeps = {
    db: deps.db,
    hub: deps.hub,
    machineHub: deps.machineHub,
    user: deps.user,
    box: deps.box,
    ...(deps.githubFetch !== undefined ? { githubFetch: deps.githubFetch } : {}),
  };
  const record = updateTodo(todoDeps, todoRow.id, {
    ...(title !== undefined ? { title } : {}),
    ...(tagIds !== undefined ? { tagIds } : {}),
  });
  if (!record) throw new NotFoundError(`todo ${todoRow.id}`);
  // #452 / ADR 0006 D3：自建 issue 任务的回填标题写进那枚 issue（await 出站
  // ——relay 面非建任务关键路径；lib 超时 15s 封顶）。失败吞（B2）：本地标题
  // 已生效不回滚，不一致由详情页只读回显给中性提示。未建成 → 静默跳过
  // （后建 issue 现读当前标题，自然一致）。
  if (title !== undefined && record.sourceKind === 'github-issue-self') {
    await writebackSelfIssueTitle(todoDeps, todoRow.id, record.title).catch(() => undefined);
  }
  return JSON.stringify({ todoId: record.id, title: record.title, tagIds: record.tagIds });
}

type MessageRowInput = {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: unknown;
  createdAt: number;
};

/** transcript 行幂等落库 + 会话流即时推送（live 工具行与终稿上传共用；
 * 与终稿按 id 去重 = onConflict upsert [设计]）。 */
function upsertMessage(
  deps: { db: Db; convHub?: ConversationStreamHub },
  row: MessageRowInput & { conversationId: string },
): void {
  deps.db
    .insert(message)
    .values(row)
    .onConflictDoUpdate({
      target: message.id,
      set: { role: row.role, content: row.content, createdAt: row.createdAt },
    })
    .run();
  deps.convHub?.publishMessage(row.conversationId, row);
}

/** chief 线程行同形（chief_message 表 + 会话流键 = chief-<threadId>）。 */
function upsertChiefRow(
  deps: { db: Db; convHub?: ConversationStreamHub },
  row: MessageRowInput & { threadId: string },
): void {
  upsertChiefMessage(deps.db, row);
  deps.convHub?.publishMessage(row.threadId, row);
}

/** per-step 凭证下发（02 §5.4/§8：模型 key + git 凭证 + 团队密钥取用面，
 * daemon 内存持有不落盘常驻）。解析链单源 = M2c services/credentials.ts
 * （step → build → todo → assignment → agent → provider → SecretBox 解密 +
 * 按 step kind 收窄的 secrets 取用面）；
 * 本层只做机器所有权校验 + wire 形状映射（machineTokenResponseSchema）。 */
export function stepToken(
  deps: MachineDeps,
  machineId: string,
  stepId: string,
): MachineTokenResponse {
  const owned = ownedStep(deps, machineId, stepId);
  if (isChiefConversation(owned.buildId)) return chiefStepToken(deps, stepId, owned.buildId);
  const bundle = resolveStepCredentials({ db: deps.db, box: deps.box }, stepId);
  // provider 行为空（preset 目录形态）时回退 agent.provider 直投 api_key kind。
  const stepRow = deps.db.select().from(step).where(eq(step.id, stepId)).get();
  const buildRow = stepRow
    ? deps.db.select().from(build).where(eq(build.id, stepRow.buildId)).get()
    : undefined;
  const todoRow = buildRow
    ? deps.db.select().from(todo).where(eq(todo.id, buildRow.todoId)).get()
    : undefined;
  const agentRow =
    stepRow && todoRow ? agentForStep(deps, todoRow, stepRow.kind, stepRow.prompt) : null;
  // repo 形态分流 git 凭证（02 §3 凭证纪律：仅 per-step 注入；relay 工具名对照
  // push_credential，r5 §3.1）：hosted = 一次性 gitAccess key 发行；github =
  // github_connection token（spec 12 G2-T2 执行凭证面）；local = null（本地
  // 路径 clone/push 无需凭证）。
  const projectRow = todoRow
    ? deps.db.select().from(project).where(eq(project.id, todoRow.projectId)).get()
    : undefined;
  const git =
    projectRow?.repoKind === 'hosted' && todoRow
      ? issueStepGitCredential(deps, { teamId: todoRow.teamId, stepId })
      : projectRow?.repoKind === 'github' && todoRow
        ? githubExecCredential(deps, todoRow.teamId)
        : null;
  return {
    provider: toProviderConfig(bundle.provider, agentRow?.provider),
    secrets: bundle.secrets,
    git,
  };
}

/** GitHub 执行凭证（spec 12 G2-T2）：connection 行 token → per-step
 * GitCredentials（basic auth 用户名固定 x-access-token，GitHub 约定；daemon
 * 消费形 = git.ts gitCredentialEnv，不进 argv / 不落盘）。未连接 = null——
 * 私有仓匿名 clone/push 的失败原文归 daemon 步 reason，不在 token 端点造错。
 * 凭证生命周期 = connection 行（非 hosted 族一次性 key；步收尾
 * revokeStepGitCredential 对该 stepId 无行可删 = no-op）。 */
function githubExecCredential(deps: MachineDeps, teamId: string): GitCredentials | null {
  const token = openGithubToken({ db: deps.db, box: deps.box }, teamId);
  return token !== null ? { username: GITHUB_ACCESS_TOKEN_USERNAME, password: token } : null;
}

/** provider 行 → wire ProviderConfig（custom http 端点）；无 custom 行回退
 * agent.provider 直投 api_key kind（preset 38 目录，r3 §2）。runtime 身份
 * （spec 17 A4，claude-code ∈ BACKEND_RUNTIME_IDS）例外：无可代发之物，
 * 回退支返回 null——凭据机器本地（claude 登录或 ANTHROPIC_API_KEY），不再
 * 凭空造 api_key 配置（旧行为会让 daemon 在 pi 后端炸 model not found）。
 * stepToken 与 chiefStepToken 共用（去重）；bundle 优先级不动（daemon 侧
 * runtime 分支才是权威短路——mixed-version 兼容面见 runner）。导出供
 * provider-config.test 钉非 runtime 支零回归。 */
export function toProviderConfig(
  bundleProvider: StepCredentialBundle['provider'],
  agentProviderId: string | null | undefined,
): ProviderConfig | null {
  if (bundleProvider) {
    return {
      kind: 'http', // custom 端点（baseUrl 在位；r3 §2 记录形状投影）
      providerId: bundleProvider.providerId,
      label: bundleProvider.label,
      baseUrl: bundleProvider.baseUrl,
      api: bundleProvider.api,
      authHeader: bundleProvider.authHeader,
      // 兼容旋钮（#654）：行值原样透传；老 server 不带此位 = daemon 走 pi
      // 端点探测默认（现状行为，mixed-version 零回归）。
      compat: bundleProvider.compat,
      models: bundleProvider.models,
      ...(bundleProvider.apiKey !== null ? { apiKey: bundleProvider.apiKey } : {}),
    };
  }
  if (isBackendRuntimeId(agentProviderId)) return null;
  return agentProviderId ? { kind: 'api_key', providerId: agentProviderId } : null;
}

/** chief 步凭证（绑定 Agent 模型 key；secrets 取用面恒空——chief = 总管探索
 * 步，records/step.ts stepTakesSecrets）。git 槽恒 null——chief 「探测仓库」
 * 经 docs relay 走 server 端裸库读（A4 黑盒逼近 r5 §3.1 的 worktree
 * `git show`），daemon 侧不开 worktree、不需 per-step git 凭证；不下发死载荷。 */
function chiefStepToken(
  deps: MachineDeps,
  _stepId: string,
  conversationId: string,
): MachineTokenResponse {
  const threadId = conversationId; // conv id ≡ chief-<threadId> 同值（r5 §3.6）
  const bundle = resolveChiefStepCredentials({ db: deps.db, box: deps.box }, threadId);
  const threadRow = deps.db.select().from(chiefThread).where(eq(chiefThread.id, threadId)).get();
  const chiefRow = threadRow
    ? deps.db.select().from(chief).where(eq(chief.id, threadRow.chiefId)).get()
    : undefined;
  const agentRow = chiefRow?.agentId
    ? deps.db.select().from(agent).where(eq(agent.id, chiefRow.agentId)).get()
    : undefined;
  return {
    provider: toProviderConfig(bundle.provider, agentRow?.provider),
    secrets: bundle.secrets,
    git: null,
  };
}

// —— upload-urls（预签名产物上传，r3 §1.6；self-host = server 自出一次性
// PUT 端点 [设计]，无对象存储）———————————————————————————————————————————————

export interface PendingUpload {
  stepId: string;
  name: string;
  machineId: string;
}

export function createUploadUrls(
  deps: MachineDeps,
  machineId: string,
  stepId: string,
  files: { name: string }[],
  origin: string,
  uploads: Map<string, PendingUpload>,
): { uploads: { name: string; url: string; method: 'PUT'; headers: Record<string, string> }[] } {
  ownedStep(deps, machineId, stepId);
  const out = files.map((f) => {
    const uploadId = newRecordId();
    uploads.set(uploadId, { stepId, name: f.name, machineId });
    return {
      name: f.name,
      url: `${origin}/api/machine/upload/${uploadId}`,
      method: 'PUT' as const,
      headers: {},
    };
  });
  return { uploads: out };
}

/** plan.md 产物落库（M3b；02 §4.2/r5 §4「plan 即文件（plan.md），版本 =
 * 文件版本」）：每上传一版插一行 plan（version = max+1，驳回重规划轮自然
 * v2）+ build.planDocId 指向最新版（documents/{id}/diff 的 {id} 同值，
 * diff 端点面归 M4）。 */
export function receivePlanUpload(deps: MachineDeps, upload: PendingUpload, content: string): void {
  ownedStep(deps, upload.machineId, upload.stepId);
  const stepRow = deps.db.select().from(step).where(eq(step.id, upload.stepId)).get();
  const buildId = stepRow?.buildId;
  if (!buildId) throw new NotFoundError(`step ${upload.stepId}`);
  const last = deps.db
    .select({ version: planTable.version })
    .from(planTable)
    .where(eq(planTable.buildId, buildId))
    .orderBy(desc(planTable.version))
    .limit(1)
    .get();
  const id = newRecordId();
  deps.db
    .insert(planTable)
    .values({ id, buildId, version: (last?.version ?? 0) + 1, content, createdAt: nowMs() })
    .run();
  deps.db.update(build).set({ planDocId: id }).where(eq(build.id, buildId)).run();
  // 落库即发会话流 step 事件（XMON-59 第二断口）：plan 行此前静默落库，web
  // ['plans', buildId] 在挂载取数读早于提交时无人再失效（方案卡停 v1/空）。
  // step 事件是既有 web 失效面（sse.ts step 分支已列 plans——message 事件与
  // plan.md 上传赛跑的兜底），把发布点从 done 收尾提前到落库点：done 面失
  // 联/延迟/重放均不吞。载荷 = 当前 step 行（stepJournalRow 单源形状）。
  publishStepStatus(deps, upload.stepId);
}

/** transcript 终稿落库（02 §1.3 数据所有权：transcript 消息/工具行经上传回传
 * 落 server DB）；id 幂等 upsert（与 tool live 行去重）。 */
export function receiveUpload(
  deps: MachineDeps,
  upload: PendingUpload,
  body: TranscriptUpload,
): void {
  ownedStep(deps, upload.machineId, upload.stepId);
  if (body.stepId !== upload.stepId) throw new NotFoundError(`upload for step ${upload.stepId}`);
  const stepRow = deps.db.select().from(step).where(eq(step.id, upload.stepId)).get();
  const conversationId = stepRow?.buildId;
  if (!conversationId) throw new NotFoundError(`step ${upload.stepId}`);
  for (const m of body.messages) {
    if (isChiefConversation(conversationId)) {
      upsertChiefRow(deps, {
        id: m.id,
        threadId: conversationId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      });
      continue;
    }
    upsertMessage(deps, {
      id: m.id,
      conversationId,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    });
  }
}

// —— done（步骤收尾 + phase 推进 + token 记账，02 §5.4/§4.2）——————————————————

export async function finishStep(
  deps: MachineDeps,
  machineId: string,
  stepId: string,
  body: MachineDoneBody,
): Promise<void> {
  const { db } = deps;
  const stepRow = ownedStep(deps, machineId, stepId);
  if (body.sessionId !== undefined) {
    db.update(step).set({ sessionId: body.sessionId }).where(eq(step.id, stepId)).run();
  }
  // per-step checkpoint（M3b done 回传 commit：「恢复到此处」数据源 +
  // 合并步落地键，r3 §3.5/§3.9）。
  if (body.commit !== undefined) {
    db.update(step).set({ checkpointCommit: body.commit }).where(eq(step.id, stepId)).run();
  }
  // per-step 一次性 git 凭证回收（步收尾即撤销，成败均回收——凭证生命周期 =
  // 步生命周期，02 §8 运行时层「不落盘常驻」的 server 半）。
  revokeStepGitCredential(deps, stepId);
  // 交付面回填（#704 / B-C16，Multica link-back 只读方向）：daemon 步收尾
  // 上报的 PR（github 形态 agent 开的 PR）与变更 diff（非 hosted 形态投影
  // 真值源）落 build 行。字段缺席 = 未上报/探测失败——保持 null 不造数据
  // （失败方式 ②④：无 PR 不造假、探测失败按「未知」）。changesDiff 超上限
  // 丢弃（daemon 侧同闸，此处第二道——两侧闸都不打爆 done 通道与 DB）。
  // chief 步 buildId 无 build 行，update 无匹配 = no-op。
  {
    const sets: Partial<typeof build.$inferSelect> = {};
    if (body.prUrl !== undefined && body.prNumber !== undefined) {
      sets.prUrl = body.prUrl;
      sets.prNumber = body.prNumber;
    }
    if (body.changesDiff !== undefined && body.changesDiff.length <= CHANGES_DIFF_MAX_BYTES) {
      sets.changes = parseUnifiedDiff(body.changesDiff);
    }
    if (Object.keys(sets).length > 0) {
      const updated = db.update(build).set(sets).where(eq(build.id, stepRow.buildId)).run();
      // 回填即发布：build doc SSE 事件（web「分支 / PR」面板与 changes 面的
      // 失效重取键）；行不存在（chief conv）changes=0 时不发布。
      if (updated.changes > 0) {
        const row = db.select().from(build).where(eq(build.id, stepRow.buildId)).get();
        const todoRow = row
          ? db.select().from(todo).where(eq(todo.id, row.todoId)).get()
          : undefined;
        if (row && todoRow) deps.hub.publishBuildDoc(todoRow.teamId, toBuildRecord(row));
      }
    }
  }
  // 合并步落地（02 §4.2：merge 202 delegated → 机器 git merge + push → server
  // bare repo 默认分支 fast-forward [设计]；r3 §3.6「服务端 main 验证」同语义）。
  // 落地失败（非快进/无 commit）= 步按 failed 收尾（失败仅人工重跑，02/A6）。
  const landingError =
    stepRow.kind === 'merge' && body.status === 'success'
      ? await applyMergeLanding(deps, stepRow, body.commit ?? null)
      : null;
  const outcome: MachineDoneBody =
    landingError !== null ? { ...body, status: 'failed', errorMessage: landingError } : body;
  // token 记账（02 §6.2：build × model × 四维）。
  for (const u of outcome.usage ?? []) {
    db.insert(tokenUsage)
      .values({
        buildId: stepRow.buildId,
        model: u.model,
        input: u.input,
        output: u.output,
        cacheRead: u.cacheRead,
        cacheWrite: u.cacheWrite,
      })
      .onConflictDoUpdate({
        target: [tokenUsage.buildId, tokenUsage.model],
        set: {
          input: sql`${tokenUsage.input} + ${u.input}`,
          output: sql`${tokenUsage.output} + ${u.output}`,
          cacheRead: sql`${tokenUsage.cacheRead} + ${u.cacheRead}`,
          cacheWrite: sql`${tokenUsage.cacheWrite} + ${u.cacheWrite}`,
        },
      })
      .run();
  }
  // stop_pending 卫生清理（全终态共通，M7 #308）：stop 与自然完成/失败的
  // 竞态残留随收尾即清（拉取-确认面另有定向步校验双保险，不复活）。
  db.delete(stopPending).where(eq(stopPending.conversationId, stepRow.buildId)).run();
  // chief 步收尾（无 build/phase/merge；thread 面 + chief_message 通知，r5 §3.6/
  // §7.2）。token 记账已按 buildId=chief conv id 落位（context.tokens 数据源）。
  if (stepRow.kind === 'chief' && isChiefConversation(stepRow.buildId)) {
    db.update(step)
      .set({ status: outcome.status === 'success' ? 'done' : 'failed' })
      .where(eq(step.id, stepId))
      .run();
    publishStepStatus(deps, stepId);
    finishChiefTurn(deps, stepRow.buildId, outcome);
    if (outcome.status === 'success') notifyChiefTurn(deps, stepRow.buildId);
    // #631 失败闭环：build 路径的失败原因有 build.errorMessage 承接，chief
    // 路径此前零承接——daemon 上报的 errorMessage 落一条 system 行进线程
    // （machine_selected 同族 content 形态 = JSON 串），会话流 message 事件
    // 即时推送，web 面渲染为失败行 + toast。无 errorMessage 的终态（stopped
    // 等）不落。
    if (outcome.status === 'failed' && outcome.errorMessage) {
      upsertChiefRow(deps, {
        id: `chief-err-${stepId}`,
        threadId: stepRow.buildId,
        role: 'system',
        content: JSON.stringify({ kind: CHIEF_TURN_ERROR_KIND, message: outcome.errorMessage }),
        createdAt: nowMs(),
      });
    }
    return;
  }
  if (outcome.status === 'success') {
    completeStep(deps, stepId, {
      hasChanges: outcome.hasChanges,
      ...(outcome.findings !== undefined ? { findings: outcome.findings } : {}),
      ...(outcome.findingsError !== undefined ? { findingsError: outcome.findingsError } : {}),
    });
    publishStepStatus(deps, stepId);
    return;
  }
  if (outcome.status === 'stopped') {
    // 停止钮落账（M7 #308，r9 §3.3）：step stopped + build.errorMessage
    // 取消标记 + gate 回落（上一完成 turn 关口 / prevPhase）+ stopPending 清。
    // 落账单源 = builds.applyStoppedStep（pending 步即时取消路径同函数）；
    // 不走 failed 漏斗（todo 不落 failed，r9 #12 → 审核实证）。
    applyStoppedStep(deps, stepId);
    publishStepStatus(deps, stepId);
    return;
  }
  // failed：步级失败无自动重跑（02 §4.2/r3 §3.7），todo → failed +
  // build.errorMessage。落账单源 = builds.applyStepFailure（#703 产物闸的
  // 失败收尾同函数——闸失败与机器报失败走同一条漏斗）。
  applyStepFailure(deps, stepRow, outcome.errorMessage ?? `step ${outcome.status}`);
  publishStepStatus(deps, stepId);
}

/** 合并落地（M3b [设计]，02 §4.2 merge 202 delegated 的 server 半）：机器合并
 * 步 push 后，bare repo 默认分支 fast-forward 到 done 回传的 conv 分支 HEAD。
 * 护栏：现 tip 必须是该 commit 祖先（非快进 = main 在合并窗口被推进 → 步按
 * failed 收尾，人工重跑，02/A6）。GitHub 形态不落地本地 ref（PR 面归后票，
 * 02 §3 接入形态）。返回 null = 落地成功/不适用；string = 失败原因。 */
async function applyMergeLanding(
  deps: MachineDeps,
  stepRow: typeof step.$inferSelect,
  commit: string | null,
): Promise<string | null> {
  const buildRow = deps.db.select().from(build).where(eq(build.id, stepRow.buildId)).get();
  const todoRow = buildRow
    ? deps.db.select().from(todo).where(eq(todo.id, buildRow.todoId)).get()
    : undefined;
  const projectRow = todoRow
    ? deps.db.select().from(project).where(eq(project.id, todoRow.projectId)).get()
    : undefined;
  if (!todoRow || projectRow?.repoKind !== 'hosted' || projectRow.repoName === null) {
    return null; // 未绑托管 repo：无可落地 ref（github 形态 PR 面归后票）。
  }
  if (commit === null) return 'merge step reported no commit';
  const dir = repoDirFor(deps.reposDir, todoRow.teamId, projectRow.repoName);
  const { defaultBranch } = await systemGitOps.listBranches(dir);
  const branch = defaultBranch ?? 'main'; // main 正典值（r3 §3.6 origin/main）
  const tip = await systemGitOps.resolveCommit(dir, `refs/heads/${branch}`);
  if (tip !== null && tip !== commit) {
    const ancestor = await systemGitOps.isAncestor(dir, tip, commit);
    if (!ancestor) {
      return `merge landing refused: ${branch} moved (non-fast-forward) — rerun the task`;
    }
  }
  await systemGitOps.updateBranchRef(dir, branch, commit);
  return null;
}

// —— machine shell（XMON-108 R1：每调用预检 + 审计先落 + 终态一次回写）——————

/** 预检（POST /api/machine/shell/{stepId}）：claim 期 localTools 只是注册面，
 * 每条命令的真实闸在这里。双闸每调用重读——agent「远程 shell」开关（agent 行
 * 现值，步中被摘同样立即拒）∩ machine.shellEnabled（机器行现值，验收 #3 的
 * 「秒级热加载」由此兑现，claim 时快照不作数）。审计先于放行落库：拒绝 =
 * denied 行（含拒绝原因）落库后 403；放行 = running 行落库后返回 runId，
 * daemon 执行完毕经 result 端点回写终态（执行侧唯一标识 = runId，与 stepId
 * 解耦——同步多条命令各领各的 runId）。403 措辞先例 = requestMerge
 * （builds.ts）双开关校验。 */
export function precheckShellCommand(
  deps: MachineDeps,
  machineId: string,
  stepId: string,
  body: MachineShellPrecheckBody,
): { allowed: true; runId: string } {
  const { db } = deps;
  const stepRow = ownedStep(deps, machineId, stepId);
  // 只对在跑步预检（pending 未领 / done/failed 已收尾 = 409 协议错）。
  if (stepRow.status !== 'claimed') {
    throw new HttpError(409, `step ${stepId} is not in flight (status: ${stepRow.status})`);
  }
  // chief 步无 shell 语义（claim 也不携带 localTools——见 buildChiefClaim）。
  if (stepRow.kind === 'chief' || isChiefConversation(stepRow.buildId)) {
    throw new HttpError(409, `step ${stepId} is a chief step (no shell semantics)`);
  }
  const buildRow = db.select().from(build).where(eq(build.id, stepRow.buildId)).get();
  const todoRow = buildRow
    ? db.select().from(todo).where(eq(todo.id, buildRow.todoId)).get()
    : undefined;
  const agentRow = todoRow ? agentForStep(deps, todoRow, stepRow.kind, stepRow.prompt) : undefined;
  // claim 门槛已保证 worker 步有可解 Agent（modelId 非空才可领）；此处不可
  // 解 = 协议层破坏（409，不落审计行——审计只记授权决定，见 schema 注释）。
  if (!todoRow || !agentRow) {
    throw new HttpError(409, `step ${stepId} has no resolvable agent for shell gating`);
  }
  const machineRow = db.select().from(machine).where(eq(machine.id, machineId)).get();
  if (!machineRow) throw new NotFoundError(`machine ${machineId}`);
  // 拒绝路径：denied 审计行（终态，插入即终局）先落库，再抛 403 带原因——
  // 「未授权命令从未跑过」是审计事实本身。
  const deny = (reason: string): never => {
    db.insert(shellCommand)
      .values({
        id: newRecordId(),
        stepId,
        machineId,
        agentId: agentRow.id,
        teamId: machineRow.teamId,
        command: body.command,
        status: 'denied',
        errorMessage: reason,
        createdAt: nowMs(),
        finishedAt: nowMs(),
      })
      .run();
    throw new HttpError(403, reason);
  };
  if (!agentRow.tools.includes(AGENT_TOOL_SHELL)) {
    deny(
      `Agent ${agentRow.displayName} 未获「远程 shell」授权（Agent 详情页权限 tab），无法执行命令`,
    );
  }
  if (!machineRow.shellEnabled) {
    deny(`机器 ${machineRow.name} 未开启 shell 访问（机器详情页），无法执行命令`);
  }
  // 放行路径：running 审计行先于 runId 下发落库（命令将执行的事实先入账）。
  const runId = newRecordId();
  db.insert(shellCommand)
    .values({
      id: runId,
      stepId,
      machineId,
      agentId: agentRow.id,
      teamId: machineRow.teamId,
      command: body.command,
      status: 'running',
      createdAt: nowMs(),
    })
    .run();
  return { allowed: true as const, runId };
}

/** 终态回写（POST /api/machine/shell/{runId}/result）：daemon 执行完毕按
 * runId 回写。状态机 = running → done | failed，终态只写一次——已终态行
 * 收到重复回写 = 幂等 200 不改写（branch-sync transitionBranchSync 同律：
 * 网络重试不产生第二份终账）。done = 进程跑完（exitCode 任意值含非零）；
 * failed = 执行没跑完（超时/杀进程/异常，errorMessage 携因）。denied 行收到
 * 回写 = 409（denied 的 runId 从未下发，只可能协议错）。 */
export function reportShellResult(
  deps: MachineDeps,
  machineId: string,
  runId: string,
  body: MachineShellResultBody,
): void {
  const { db } = deps;
  const row = db.select().from(shellCommand).where(eq(shellCommand.id, runId)).get();
  if (!row) throw new HttpError(404, `shell run ${runId} not found`);
  if (row.machineId !== machineId) {
    throw new HttpError(403, `shell run ${runId} not owned by machine ${machineId}`);
  }
  if (row.status === 'denied') {
    throw new HttpError(409, `shell run ${runId} was denied (no result to report)`);
  }
  if (row.status === 'done' || row.status === 'failed') return; // 终态幂等不改写
  db.update(shellCommand)
    .set({
      status: body.status,
      exitCode: body.status === 'done' ? (body.exitCode ?? null) : null,
      output: body.output ?? null,
      ...(body.status === 'failed' && body.errorMessage !== undefined
        ? { errorMessage: body.errorMessage }
        : {}),
      finishedAt: nowMs(),
    })
    .where(eq(shellCommand.id, runId))
    .run();
}
