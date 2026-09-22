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
  ProviderConfig,
  StepRecord,
  ToolCallRecord,
  TranscriptUpload,
} from '@pacman/shared';
import { MAX_CONCURRENT_DEFAULT } from '@pacman/shared';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import {
  agent,
  apiKey,
  build,
  machine,
  message,
  project,
  provider,
  step,
  todo,
  tokenUsage,
} from '../db/schema.js';
import { newRecordId, nowMs } from '../lib/ids.js';
import { newMachineToken, sha256hex } from '../lib/keys.js';
import { completeStep, NotFoundError } from './builds.js';
import type { TeamStreamHub } from './events.js';
import { canTransitionPhase } from './phase.js';
import { setTodoPhase } from './todos.js';

export interface MachineDeps {
  db: Db;
  hub: TeamStreamHub;
  machineHub: MachineWakeHub;
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
}

// —— 认证（02 §8：存哈希比对）———————————————————————————————————————————————

export function findMachineByToken(db: Db, token: string) {
  return db
    .select()
    .from(machine)
    .where(eq(machine.tokenHash, sha256hex(token)))
    .get();
}

export function findApiKeyByPlain(db: Db, plain: string) {
  return db
    .select()
    .from(apiKey)
    .where(eq(apiKey.keyHash, sha256hex(plain)))
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

function tryClaim(deps: MachineDeps, machineId: string, teamId: string): ClaimedStep | null {
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

  for (const cand of claimCandidates(deps, machineId, teamId)) {
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
    const projectRow = db
      .select()
      .from(project)
      .where(eq(project.id, cand.todoRow.projectId))
      .get();
    return {
      step: {
        id: cand.stepRow.id,
        buildId: cand.stepRow.buildId,
        kind: cand.stepRow.kind,
        machineId,
        createdAt: cand.stepRow.createdAt,
      },
      conversationId: cand.stepRow.buildId, // buildId ≡ conversationId（CONTEXT.md）
      session: { action: priorSessionId ? 'continue' : 'new', sessionId: priorSessionId },
      todo: {
        id: cand.todoRow.id,
        seqNum: cand.todoRow.seqNum,
        title: cand.todoRow.title,
        spec: cand.todoRow.spec,
      },
      project: { id: cand.todoRow.projectId, name: projectRow?.name ?? '' },
      agent: {
        id: agentRow.id,
        displayName: agentRow.displayName,
        description: agentRow.description,
        provider: agentRow.provider,
        modelId: agentRow.modelId,
        thinkingLevel: agentRow.thinkingLevel,
      },
    };
  }
  return null;
}

/** 长轮询 claim：先试领；空手则等 wake/超时后再试一次（节奏 ≈ holdMs ≈ 75s，
 * r3 §1.5 实测 ~75–76s；wake = 低延迟派发，02 §5.4）。 */
export async function claimStep(
  deps: MachineDeps,
  machineId: string,
  teamId: string,
  holdMs: number,
): Promise<ClaimedStep | null> {
  const first = tryClaim(deps, machineId, teamId);
  if (first) return first;
  await deps.machineHub.waitWake(teamId, holdMs);
  return tryClaim(deps, machineId, teamId);
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
 * 上传按 toolCall id 幂等去重 [设计]。 */
export function reportTool(
  deps: MachineDeps,
  machineId: string,
  stepId: string,
  call: ToolCallRecord,
): void {
  const row = ownedStep(deps, machineId, stepId);
  upsertMessage(deps.db, {
    id: call.id,
    conversationId: row.buildId,
    role: 'assistant',
    content: { kind: 'toolcall', call },
    createdAt: call.endedAt ?? nowMs(),
  });
}

function upsertMessage(
  db: Db,
  row: {
    id: string;
    conversationId: string;
    role: 'system' | 'user' | 'assistant';
    content: unknown;
    createdAt: number;
  },
): void {
  db.insert(message)
    .values(row)
    .onConflictDoUpdate({
      target: message.id,
      set: { role: row.role, content: row.content, createdAt: row.createdAt },
    })
    .run();
}

/** per-step 凭证下发（02 §5.4/§8：模型 key + git 凭证，daemon 内存持有）。
 * M3a：SecretBox 解密面归 M2c（无 key 网关可留空，r3 §2）；托管 repo git
 * 凭证归 M2b/M3b → git 恒 null [设计过渡]。 */
export function stepToken(
  deps: MachineDeps,
  machineId: string,
  stepId: string,
): MachineTokenResponse {
  const { db } = deps;
  const stepRow = ownedStep(deps, machineId, stepId);
  const buildRow = db.select().from(build).where(eq(build.id, stepRow.buildId)).get();
  if (!buildRow) throw new NotFoundError(`build ${stepRow.buildId}`);
  const todoRow = db.select().from(todo).where(eq(todo.id, buildRow.todoId)).get();
  if (!todoRow) throw new NotFoundError(`todo ${buildRow.todoId}`);
  const agentRow = agentForStep(deps, todoRow, stepRow.kind);
  if (!agentRow?.provider || !agentRow.modelId) return { provider: null, git: null };

  const providerRow = db
    .select()
    .from(provider)
    .where(and(eq(provider.teamId, todoRow.teamId), eq(provider.providerId, agentRow.provider)))
    .get();
  const config: ProviderConfig = providerRow
    ? {
        kind: 'http', // custom 端点（r3 §2 记录形状 kind:"custom" → 缝 kind 投影）
        providerId: providerRow.providerId,
        label: providerRow.label,
        baseUrl: providerRow.baseUrl,
        api: providerRow.api,
        authHeader: providerRow.authHeader,
        models: providerRow.models,
        // apiKey：SecretBox 密文解密归 M2c；当前仅无 key 网关形态可用。
      }
    : {
        kind: 'api_key', // preset provider（38 目录，records/provider.ts）
        providerId: agentRow.provider,
      };
  return { provider: config, git: null };
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
    upsertMessage(deps.db, {
      id: m.id,
      conversationId,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    });
  }
}

// —— done（步骤收尾 + phase 推进 + token 记账，02 §5.4/§4.2）——————————————————

export function finishStep(
  deps: MachineDeps,
  machineId: string,
  stepId: string,
  body: MachineDoneBody,
): void {
  const { db } = deps;
  const stepRow = ownedStep(deps, machineId, stepId);
  if (body.sessionId !== undefined) {
    db.update(step).set({ sessionId: body.sessionId }).where(eq(step.id, stepId)).run();
  }
  // token 记账（02 §6.2：build × model × 四维）。
  for (const u of body.usage ?? []) {
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
  if (body.status === 'success') {
    completeStep(deps, stepId, { hasChanges: body.hasChanges });
    return;
  }
  // failed / stopped（stopped = 人工停止 [设计]，同 failed 收尾）：步级失败无
  // 自动重跑（02 §4.2/r3 §3.7），todo → failed + build.errorMessage。
  db.update(step).set({ status: 'failed' }).where(eq(step.id, stepId)).run();
  const buildRow = db.select().from(build).where(eq(build.id, stepRow.buildId)).get();
  if (buildRow) {
    db.update(build)
      .set({ errorMessage: body.errorMessage ?? `step ${body.status}` })
      .where(eq(build.id, buildRow.id))
      .run();
    const todoRow = db.select().from(todo).where(eq(todo.id, buildRow.todoId)).get();
    if (todoRow && canTransitionPhase(todoRow.phase, 'failed')) {
      setTodoPhase(deps, todoRow.id, 'failed');
    }
  }
}
