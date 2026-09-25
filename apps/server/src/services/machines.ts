// 机器面服务层（02 §5 canonical，wire schema 单源 = shared machine-wire.ts）。
// - enroll：api-key 非交互注册（02 §5.2 路径二）；重注册复用同一 machineId
//   （r3 §1.2 实测，按 key/team 认机器 [推断]）。
// - claim：长轮询领取（~75s 节奏，r3 §1.5）+ wake 即时唤醒；step 队列 server
//   持有、机器 claim 三类步（02 §4.2/A6）。
// - journal：heartbeat/tool/done/upload-urls/token（02 §5.4 词表）。
// 载荷细形 r3 未采处 = [推断]/[设计]（04 §3 不判负口径），补采后回写 02 §11。

import type {
  ClaimedStep,
  MachineDoneBody,
  MachineStreamEvent,
  MachineTokenResponse,
  McpEndpoint,
  ProviderConfig,
  SecretBox,
  StepRecord,
  ToolCallRecord,
  TranscriptUpload,
  UserRecord,
} from '@pacman/shared';
import {
  CHIEF_REMOTE_TOOLS,
  isChiefConversationId,
  MAX_CONCURRENT_DEFAULT,
  MCP_MIN_CLI_VERSION,
  WORKER_MEMORY_REMOTE_TOOLS,
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
  steerPending,
  step,
  todo,
  tokenUsage,
} from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import { systemGitOps } from '../lib/git.js';
import { hashCredential } from '../lib/hash.js';
import { newRecordId, nowMs } from '../lib/ids.js';
import { newMachineToken } from '../lib/keys.js';
import { completeStep, NotFoundError } from './builds.js';
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
import type { ConversationStreamHub, TeamStreamHub } from './events.js';
import { githubCloneUrl, hostedCloneUrl, repoDirFor } from './git.js';
import { resolveAgentMcpEndpoints } from './mcp-servers.js';
import { canTransitionPhase } from './phase.js';
import { setTodoPhase } from './todos.js';

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
  /** conversation stream 通道（M5 live streaming：transcript 行/文本增量/
   * 步状态即时推送，02 §1.2 会话流）；缺省 = 无会话流面（单测形态）。 */
  convHub?: ConversationStreamHub;
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

export function enrollMachine(
  deps: MachineDeps,
  input: {
    keyId: string;
    teamId: string;
    name: string;
    cliVersion?: string;
    serverUrl: string;
  },
): { machineId: string; token: string; teamId: string; serverUrl: string } {
  const { db } = deps;
  const token = newMachineToken();
  // 重注册复用同一 machineId（r3 §1.2：logout 后重注册 machineId 不变）。
  const existing = db
    .select()
    .from(machine)
    .where(and(eq(machine.apiKeyId, input.keyId), eq(machine.teamId, input.teamId)))
    .get();
  if (existing) {
    db.update(machine)
      .set({
        tokenHash: token.hash,
        name: input.name,
        ...(input.cliVersion !== undefined ? { latestCliVersion: input.cliVersion } : {}),
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
      maxConcurrent: MAX_CONCURRENT_DEFAULT, // 02 §2.5 机器配置默认值
      tokenHash: token.hash,
      apiKeyId: input.keyId,
      latestCliVersion: input.cliVersion ?? null,
    })
    .run();
  return { machineId, token: token.plain, teamId: input.teamId, serverUrl: input.serverUrl };
}

// —— presence（02 §5.4：心跳并行失败、进程不退出——server 侧无状态可失败）——————

export function markPresence(
  deps: MachineDeps,
  machineId: string,
  body: { maxConcurrent?: number; cliVersion?: string },
): void {
  const { db, hub } = deps;
  const row = db.select().from(machine).where(eq(machine.id, machineId)).get();
  if (!row) throw new NotFoundError(`machine ${machineId}`);
  const becameOnline = !row.online;
  db.update(machine)
    .set({
      online: true,
      ...(body.maxConcurrent !== undefined ? { maxConcurrent: body.maxConcurrent } : {}),
      ...(body.cliVersion !== undefined ? { latestCliVersion: body.cliVersion } : {}),
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
 * 无 build/todo 行——Chief 回合 = 机器 step，r5 §3.1）。 */
function claimChiefCandidates(deps: MachineDeps, teamId: string) {
  return deps.db
    .select({ stepRow: step, threadRow: chiefThread })
    .from(step)
    .innerJoin(chiefThread, eq(step.buildId, chiefThread.id))
    .where(and(eq(step.status, 'pending'), eq(step.kind, 'chief'), eq(chiefThread.teamId, teamId)))
    .orderBy(asc(step.createdAt))
    .all();
}

function agentForStep(
  deps: MachineDeps,
  todoRow: typeof todo.$inferSelect,
  kind: StepRecord['kind'],
) {
  // assignment 双槽按步类取（02 §4.2/r5 §5）：规划步 → plan 槽；执行/合并步 →
  // build 槽（合并轮复用执行轮会话，同 Agent）。
  const slot = kind === 'plan' ? todoRow.assignment?.plan : todoRow.assignment?.build;
  const agentId = slot?.agentId ?? null;
  if (!agentId) return null;
  return deps.db.select().from(agent).where(eq(agent.id, agentId)).get() ?? null;
}

/** chief 步 claim 载荷组装（remoteTools 49 词表全量 + chief 块 + 会话续轮判定）。
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

/** claim 载荷 mcpServers 解析（02 §7.1 per-turn 连接的 server 侧半）：版本门
 * 未达或无授权 = 缺省（不携带）。headers 密文 per-step 解析内存下发（02 §8）。 */
function claimMcpEndpoints(
  deps: MachineDeps,
  teamId: string,
  latestCliVersion: string | null,
  agentSlugs: readonly string[],
): McpEndpoint[] | undefined {
  if (agentSlugs.length === 0) return undefined;
  if (!meetsMcpVersionGate(latestCliVersion)) return undefined;
  const endpoints = resolveAgentMcpEndpoints({ db: deps.db, box: deps.box }, teamId, agentSlugs);
  return endpoints.length > 0 ? endpoints : undefined;
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
  // 思考强度覆盖（PATCH body agent.thinkingLevel，r5 §2）优先，回退绑定 Agent 值。
  const thinkingLevel = chiefRow.thinkingLevel ?? agentRow.thinkingLevel;
  const claimedAt = nowMs();
  const res = deps.db
    .update(step)
    .set({ status: 'claimed', machineId, claimedAt, lastHeartbeatAt: claimedAt })
    .where(and(eq(step.id, stepRow.id), eq(step.status, 'pending')))
    .run();
  if (res.changes === 0) return null;
  const ctx = chiefClaimContext(deps, threadRow.id);
  // 记忆注入（02 §4.4 读路径最小形；注入形 [推断] 保留）：绑定 Agent 记忆条目。
  const memories = deps.db
    .select({ title: agentMemory.title, content: agentMemory.content })
    .from(agentMemory)
    .where(eq(agentMemory.agentId, agentRow.id))
    .all();
  // Chief = 特例 Agent（02 §4.3）：绑定 Agent 的 MCP 授权同样进回合载荷。
  const chiefMcp = claimMcpEndpoints(
    deps,
    threadRow.teamId,
    machineRow?.latestCliVersion ?? null,
    agentRow.mcpServers,
  );
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
      provider: agentRow.provider,
      modelId: agentRow.modelId,
      thinkingLevel,
      memories,
    },
    chief: {
      threadId: threadRow.id,
      systemPrompt: ctx?.systemPrompt ?? '',
      trigger: ctx ? parseChiefTrigger(stepRow.prompt) : 'user',
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
  // 并发门（02 §2.5：机器页文案「并发上限 3」；claim body running 上报取小）。
  const running = db
    .select({ n: sql<number>`count(*)` })
    .from(step)
    .where(and(eq(step.machineId, machineId), eq(step.status, 'claimed')))
    .get();
  if ((running?.n ?? 0) >= machineRow.maxConcurrent) return null;

  // chief 步与 worker 步共队列，按 createdAt FIFO 交错（chief 派工先于其产生的
  // worker 步入队，天然领先；跨类型仍按 createdAt 保序 [设计]）。
  const workerCands = claimCandidates(deps, machineId, teamId);
  const chiefCands = claimChiefCandidates(deps, teamId);
  const earliestWorker = workerCands[0]?.stepRow.createdAt ?? Number.POSITIVE_INFINITY;
  for (const cand of chiefCands) {
    if (cand.stepRow.createdAt > earliestWorker) break; // worker 更早 → 先走 worker
    const claimed = buildChiefClaim(deps, machineId, cand.stepRow, cand.threadRow, machineRow);
    if (claimed) {
      publishStepStatus(deps, claimed.step.id);
      return claimed;
    }
  }

  for (const cand of workerCands) {
    const agentRow = agentForStep(deps, cand.todoRow, cand.stepRow.kind);
    // 未指派 Agent = 不可执行（Agent 可空是 UI 语义，派发需模型位 [设计]）。
    if (!agentRow?.modelId) continue;
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
    // continue session 判定（02 §5.7：合并轮/重规划轮复用同 conv pi 会话）。
    const prior = db
      .select({ sessionId: step.sessionId })
      .from(step)
      .where(and(eq(step.buildId, cand.stepRow.buildId), sql`${step.sessionId} is not null`))
      .orderBy(asc(step.createdAt))
      .all();
    const priorSessionId = prior.length > 0 ? (prior[prior.length - 1]?.sessionId ?? null) : null;
    // plan.md 交接缺失的 build 步强制 new session（#113 裁定候选2 兜底）：plan 关
    // 未产交接物时续轮会话里无可指方案（confirm 措辞空转 → agent 反问「哪个方案」，
    // 05 §5 实跑）；new session 令 daemon 以 todo 原始 title+spec 开工（runner
    // buildTaskPrompt），agent 必拿任务内容。plan.md 在 → 续轮不变。
    const planHandoffMissing =
      cand.stepRow.kind === 'build' && cand.buildRow.withPlan && cand.buildRow.planDocId === null;
    const session = planHandoffMissing
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
    // repo 绑定位（M3b worktree 契约接线，02 §3/§5.5）：托管 = `<origin>/git/
    // <teamId>/<repoName>`（本地主机代位）；github = https 派生（凭证面归后票）。
    const repo =
      projectRow?.repoKind === 'hosted' && projectRow.repoName !== null
        ? {
            kind: 'hosted' as const,
            cloneUrl: hostedCloneUrl(origin, teamId, projectRow.repoName),
          }
        : projectRow?.repoKind === 'github' && projectRow.githubRepo !== null
          ? { kind: 'github' as const, cloneUrl: githubCloneUrl(projectRow.githubRepo) }
          : null;
    // worker 步 remoteTools = 记忆三件套（02 §4.4 写路径 / r5 §6：worker 侧
    // 同族工具经 remoteTools 下发，relay 服务端执行；触发 = spec 指令 + Agent
    // 裁量，宿主不做任务结束蒸馏）。MCP 授权端点随载荷（02 §7.1 per-turn 连接）。
    const workerMcp = claimMcpEndpoints(
      deps,
      teamId,
      machineRow.latestCliVersion,
      agentRow.mcpServers,
    );
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
      },
      remoteTools: [...WORKER_MEMORY_REMOTE_TOOLS],
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
 * 分流：chief 步 = 49 词表（溯源上下文 step → chief_thread → chief）；worker
 * 步 = 记忆三件套白名单（02 §4.4/r5 §6 worker 写路径，溯源 step → build →
 * todo → assignment 槽）。返回 JSON 串（daemon 侧包 {text} 回 pi）。 */
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

/** worker 步 relay = 记忆三件套（MEMORY_TOOLS 白名单在 executeWorkerMemoryTool；
 * 词表外 400）。溯源上下文（r5 §6 实测样本 = 运行中 todo/build）：
 * step → build → todo → assignment 槽 Agent（02 §4.2 按步类取槽）。 */
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
  const slot = row.kind === 'plan' ? todoRow.assignment?.plan : todoRow.assignment?.build;
  const agentId = slot?.agentId;
  if (!agentId) throw new HttpError(409, 'step has no assigned agent — memory has no store');
  return executeWorkerMemoryTool(
    deps.db,
    {
      teamId: todoRow.teamId,
      agentId,
      todoId: todoRow.id,
      projectId: todoRow.projectId,
      buildId: row.buildId,
    },
    name,
    params,
  );
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

/** per-step 凭证下发（02 §5.4/§8：模型 key + git 凭证，daemon 内存持有不落盘
 * 常驻）。解析链单源 = M2c services/credentials.ts（step → build → todo →
 * assignment → agent → provider → SecretBox 解密 + secrets env 授权集）；
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
  const agentRow = stepRow && todoRow ? agentForStep(deps, todoRow, stepRow.kind) : null;
  // 托管 repo git 凭证 per-step 发行（02 §3 凭证纪律：仅 per-step 注入，手动
  // fetch 无凭证失败；relay 工具名对照 push_credential，r5 §3.1）。GitHub
  // 形态凭证面归后票（02 §3 接入形态）。
  const projectRow = todoRow
    ? deps.db.select().from(project).where(eq(project.id, todoRow.projectId)).get()
    : undefined;
  const git =
    projectRow?.repoKind === 'hosted' && todoRow
      ? issueStepGitCredential(deps, { teamId: todoRow.teamId, stepId })
      : null;
  return { provider: toProviderConfig(bundle.provider, agentRow?.provider), env: bundle.env, git };
}

/** provider 行 → wire ProviderConfig（custom http 端点）；无 custom 行回退
 * agent.provider 直投 api_key kind（preset 38 目录，r3 §2）。stepToken 与
 * chiefStepToken 共用（去重）。 */
function toProviderConfig(
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
      models: bundleProvider.models,
      ...(bundleProvider.apiKey !== null ? { apiKey: bundleProvider.apiKey } : {}),
    };
  }
  return agentProviderId ? { kind: 'api_key', providerId: agentProviderId } : null;
}

/** chief 步凭证（绑定 Agent 模型 key + secrets env）。git 槽恒 null——chief
 * 「探测仓库」经 docs relay 走 server 端裸库读（A4 黑盒逼近 r5 §3.1 的
 * worktree `git show`），daemon 侧不开 worktree、不需 per-step git 凭证；
 * 不下发死载荷。 */
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
    env: bundle.env,
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
    return;
  }
  if (outcome.status === 'success') {
    completeStep(deps, stepId, { hasChanges: outcome.hasChanges });
    publishStepStatus(deps, stepId);
    return;
  }
  // failed / stopped（stopped = 人工停止 [设计]，同 failed 收尾）：步级失败无
  // 自动重跑（02 §4.2/r3 §3.7），todo → failed + build.errorMessage。
  db.update(step).set({ status: 'failed' }).where(eq(step.id, stepId)).run();
  publishStepStatus(deps, stepId);
  const buildRow = db.select().from(build).where(eq(build.id, stepRow.buildId)).get();
  if (buildRow) {
    db.update(build)
      .set({ errorMessage: outcome.errorMessage ?? `step ${outcome.status}` })
      .where(eq(build.id, buildRow.id))
      .run();
    const todoRow = db.select().from(todo).where(eq(todo.id, buildRow.todoId)).get();
    if (todoRow && canTransitionPhase(todoRow.phase, 'failed')) {
      setTodoPhase(deps, todoRow.id, 'failed');
    }
  }
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
