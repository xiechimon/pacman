// 机器主循环（02 §5.4 上线序列 canon + r3 §1.5 实测行为）：
// `Loading pi runtime…` → enroll（如未注册）→ presence → `Online (machineId=…);
// polling <url>` → 防睡（caffeinate 类）→ `[recover]` 步 journal 恢复 →
// `maxConcurrent changed null -> 3` → `[wake] push channel connected` →
// claim 长轮询循环（断网指数退避封顶 30s，presence 心跳并行失败，进程不退出）。
// 退出：SIGTERM → `[machine] Shutting down…`（`[supervisor] stopped` 在
// supervisor 侧，02 §5.3/r3 §1.5）。

import { type ChildProcess, spawn } from 'node:child_process';
import type { AgentBackend, AgentSessionHandle, ClaimedStep } from '@pacman/shared';
import {
  CLAIM_BACKOFF_CAP_MS,
  CLAIM_POLL_INTERVAL_MS,
  ORPHAN_WORKTREE_TTL_MS,
} from '@pacman/shared';
import { createPiBackend } from './backend/pi.js';
import type { DaemonConfig } from './config.js';
import { StepJournal } from './journal.js';
import type { DaemonLogger } from './log.js';
import { type MachineApi, MachineClient } from './machine-client.js';
import { setupProxy } from './proxy.js';
import { runStep } from './runner.js';
import {
  ensureStateDirs,
  loadMachineJson,
  loadOrCreateDeviceJson,
  recordSession,
  resolveSessionFile,
  type StatePaths,
  saveMachineJson,
} from './state.js';
import { DAEMON_VERSION } from './version.js';
import { WorkspaceManager } from './workspace.js';

export interface MachineLoopOpts {
  config: DaemonConfig;
  paths: StatePaths;
  logger: DaemonLogger;
  /** 测试注入面（缺省 = pi backend + 内置 fetch）。 */
  backend?: AgentBackend;
  fetchImpl?: typeof fetch;
  client?: MachineApi;
  /** claim 客户端侧护栏（server hold + 余量）[设计]。 */
  claimTimeoutMs?: number;
  /** presence 心跳节奏 [设计]（r3 未采具体值）。 */
  presenceIntervalMs?: number;
  /** claim 断网退避基数（默认 1s，指数翻倍封顶 CLAIM_BACKOFF_CAP_MS=30s，
   * r3 §1.5）；测试注入缩短时标。 */
  claimBackoffBaseMs?: number;
  /** 代理探测 env 面（默认 process.env；测试注入 {} 关闭）。 */
  proxyEnv?: NodeJS.ProcessEnv;
  heartbeatIntervalMs?: number;
  /** 闲置防睡（darwin caffeinate；linux systemd-inhibit [推断] 可缺省，
   * 01 §4.3）。测试关闭。 */
  idleSleepPrevention?: boolean;
  /** 孤儿 worktree 回收 TTL（缺省 7×24h，02 §5.5/r3 §1.4；测试注入缩短）。 */
  orphanTtlMs?: number;
}

export interface MachineHandle {
  machineId: string;
  /** 优雅停止：等待在跑步收尾后退出（r3 §1.5 SIGTERM 序列）。硬崩溃面
   * （journal 残留 + recover 对账）以子进程 SIGKILL 实测（T2 验证）。 */
  stop(): Promise<void>;
  /** 主循环结束（stop 后 resolve）。 */
  done: Promise<void>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 指数退避封顶 30s（r3 §1.5「断网 claim 指数退避封顶 30s」）。 */
export function nextBackoffMs(current: number, cap = CLAIM_BACKOFF_CAP_MS): number {
  return Math.min(current * 2, cap);
}

export async function runMachine(opts: MachineLoopOpts): Promise<MachineHandle> {
  const { config, paths, logger } = opts;
  ensureStateDirs(paths);
  loadOrCreateDeviceJson(paths); // device.json 32hex（r3 §1.3）
  setupProxy(logger, opts.proxyEnv ?? process.env);

  // —— 上线序列 canon（02 §5.4）——
  logger.raw('Loading pi runtime…');
  const backend =
    opts.backend ??
    createPiBackend({
      agentDir: paths.agentRuntimeDir,
      sessionDir: paths.chatSessionsDir,
      resolveSessionFile: (sid) => resolveSessionFile(paths, sid),
      onSession: (sid, file) => {
        if (file) recordSession(paths, sid, file);
      },
      // [mcp] 降级行（r3 §1.5 canon；02 §5.3 前缀词表 mcp 位）。
      onMcpLog: (msg) => logger.mcp(msg),
    });

  let inMemoryToken = '';
  const client =
    opts.client ??
    new MachineClient({
      serverUrl: config.serverUrl,
      getToken: () => inMemoryToken,
      ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
    });

  // enroll（02 §5.2：machine.json 缺省 = 未注册；--api-key --team 非交互路径。
  // 浏览器授权流交互式注册归 M3b/web 接线）。
  let machineJson = loadMachineJson(paths);
  if (!machineJson) {
    if (!config.apiKey || !config.teamId) {
      throw new Error(
        'machine not enrolled: pass --api-key <k> --team <id> (browser enroll path lands with web wiring)',
      );
    }
    const enrolled = await client.enroll({
      apiKey: config.apiKey,
      teamId: config.teamId,
      name: config.name,
      cliVersion: DAEMON_VERSION,
    });
    machineJson = {
      machineId: enrolled.machineId,
      token: enrolled.token,
      teamId: enrolled.teamId,
      serverUrl: enrolled.serverUrl,
    };
    saveMachineJson(paths, machineJson);
    logger.raw(`Enrolled in team ${machineJson.teamId} (machine ${machineJson.machineId})`);
  }
  inMemoryToken = machineJson.token;
  const machineId = machineJson.machineId;

  await client.presence({ maxConcurrent: config.maxConcurrent, cliVersion: DAEMON_VERSION });
  logger.raw(`Online (machineId=${machineId}); polling ${config.serverUrl}`);

  // 闲置防睡（darwin caffeinate -i；平台命令表 spawn，01 §4.3）。
  let caffeinate: ChildProcess | undefined;
  if (opts.idleSleepPrevention !== false && process.platform === 'darwin') {
    try {
      caffeinate = spawn('caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' });
      caffeinate.unref();
      logger.raw('Idle-sleep prevention active (caffeinate)');
    } catch {
      // 平台命令缺省可降级（01 §9 linux systemd-inhibit [推断] 可缺省同族）。
    }
  }

  const journal = new StepJournal(paths.outboxDir);
  // worktree 契约面（02 §5.5；单例共享 = projectLock 跨步串行化前提）。
  const workspace = new WorkspaceManager({
    logger,
    ...(opts.orphanTtlMs !== undefined ? { orphanTtlMs: opts.orphanTtlMs } : {}),
  });

  // 孤儿 worktree 回收（r3 §1.4 cleanupOrphanWorktrees(ttlMs = 7*24h)）：
  // 上线一次 + 每日节奏 [设计]（观测仅函数名，节奏未采）。活步 = journal
  // pending 面的 conversationId 集。
  const sweepOrphans = () => {
    workspace
      .cleanupOrphans({
        workspacesRoot: config.workspacesDir,
        ttlMs: opts.orphanTtlMs ?? ORPHAN_WORKTREE_TTL_MS,
        now: Date.now(),
        activeConversationIds: journal.pending().map((e) => e.conversationId),
      })
      .then((removed) => {
        if (removed.length > 0) {
          logger.workspace(`orphan worktrees recycled: ${removed.length} (${removed.join(', ')})`);
        }
      })
      .catch((err: unknown) => {
        logger.workspace(
          `orphan cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  };
  sweepOrphans();
  const orphanTimer = setInterval(sweepOrphans, 24 * 60 * 60 * 1000);
  orphanTimer.unref?.();

  // —— [recover] 步 journal 恢复（server 真值对账 + continue session 续跑）——
  const recovered = await client.recover();
  if (recovered.steps.length === 0) {
    logger.recover('no pending steps found');
  } else {
    logger.recover(`${recovered.steps.length} pending step(s) found — resuming`);
    for (const stepRecord of recovered.steps) {
      const entry = journal.get(stepRecord.id);
      if (entry?.claimed) {
        // journal 快照续跑：sessionId 在 → continue session（同 conv pi 会话
        // 复用，02 §4.2/§5.7）；不在 → new session 重发任务文本。
        const claimed: ClaimedStep = {
          ...entry.claimed,
          session: {
            action: entry.sessionId ? 'continue' : 'new',
            sessionId: entry.sessionId,
          },
        };
        await runStep(stepDeps(), claimed, {
          resume: { sessionId: entry.sessionId, prompt: entry.prompt },
          running: 1,
        });
      } else {
        logger.recover(`step ${stepRecord.id} has no local journal — reporting failed`);
        await client.done(stepRecord.id, {
          status: 'failed',
          errorMessage: 'daemon journal lost across restart',
        });
      }
    }
  }

  logger.raw(`maxConcurrent changed null -> ${config.maxConcurrent}`);

  // —— wake SSE（低延迟派发通道；断线持续重连不退出，r3 §1.5）——
  // 双通道语义（02 §5.4）：server 侧入队会直接解决挂起的 claim hold；客户端
  // wake 事件兜底 = 中断在飞 claim 立即重发（覆盖 hold 未被解决的边界）。
  // steer 事件（W3 #279）三号分流：拉取-确认投递到在跑 session handle。
  const streamCtrl = new AbortController();
  // 盒装引用：规避 TS 对捕获 let 的初始化收窄（wake 回调与 claim 循环异步互访）。
  const flight: { claim: AbortController | null } = { claim: null };
  // 在跑 session 句柄注册表（stepId → handle；runStep 装卸，deliverSteer 消费）。
  const sessionHandles = new Map<string, AgentSessionHandle>();
  const deliverSteer = async (stepId: string): Promise<void> => {
    try {
      const content = await client.steer(stepId);
      if (content === null) return; // server 门拒/旧步已丢弃（拉取-确认语义）。
      const live = sessionHandles.get(stepId);
      if (live === undefined) {
        logger.step(`steer dropped (no live session) step=${stepId}`); // 收尾竞态
        return;
      }
      await live.steer(content);
      logger.step(`steer delivered step=${stepId}`);
    } catch (err) {
      logger.step(`steer delivery failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  void (async () => {
    let backoff = 1_000;
    let announced = false;
    while (!streamCtrl.signal.aborted) {
      try {
        await client.stream(
          streamCtrl.signal,
          (ev) => {
            if (ev.type === 'wake') flight.claim?.abort(new Error('wake'));
            if (ev.type === 'shutdown') void stop();
            if (ev.type === 'steer') void deliverSteer(ev.stepId);
          },
          () => {
            if (!announced) {
              announced = true;
              logger.wake('push channel connected');
            }
          },
        );
        backoff = 1_000;
      } catch {
        // 断线重连（代理死持续重试不退出同纪律，02 §5.6）。
      }
      if (streamCtrl.signal.aborted) return;
      await sleep(backoff);
      backoff = nextBackoffMs(backoff);
    }
  })();

  // —— presence 心跳（并行失败不退出，r3 §1.5）——
  const presenceTimer = setInterval(() => {
    client
      .presence({ maxConcurrent: config.maxConcurrent, cliVersion: DAEMON_VERSION })
      .catch((err: unknown) => {
        logger.machine(`presence failed: ${err instanceof Error ? err.message : String(err)}`);
      });
  }, opts.presenceIntervalMs ?? 30_000);
  presenceTimer.unref?.();

  // —— claim 主循环（长轮询；空手即重发 → 节奏 ≈ server hold ≈ 75s）——
  let stopping = false;
  const claimCtrl = new AbortController();
  const claimTimeoutMs = opts.claimTimeoutMs ?? CLAIM_POLL_INTERVAL_MS + 15_000;

  function stepDeps() {
    return {
      client,
      journal,
      backend,
      logger,
      paths,
      workspace,
      workspacesDir: config.workspacesDir,
      maxConcurrent: config.maxConcurrent,
      sessionHandles,
      ...(opts.heartbeatIntervalMs !== undefined
        ? { heartbeatIntervalMs: opts.heartbeatIntervalMs }
        : {}),
    };
  }

  const done = (async () => {
    const backoffBase = opts.claimBackoffBaseMs ?? 1_000;
    let backoff = backoffBase;
    while (!stopping) {
      let step: ClaimedStep | null = null;
      try {
        // 客户端护栏 = server hold + 余量；stop 时 claimCtrl 中断挂起请求。
        step = await client.claim(
          AbortSignal.any([claimCtrl.signal, AbortSignal.timeout(claimTimeoutMs)]),
        );
        backoff = backoffBase; // 成功即重置（指数退避仅断网面，r3 §1.5）
      } catch (err) {
        if (stopping) break;
        logger.machine(
          `claim failed: ${err instanceof Error ? err.message : String(err)} (backoff ${backoff}ms)`,
        );
        await sleep(backoff);
        backoff = Math.min(backoff * 2, CLAIM_BACKOFF_CAP_MS); // 封顶 30s
        continue;
      }
      if (!step || stopping) continue;
      logger.raw(`claim step=${step.step.id}`);
      await runStep(stepDeps(), step, { running: 1 });
    }
  })();

  async function stop(): Promise<void> {
    if (stopping) return;
    stopping = true;
    logger.machine('Shutting down…');
    clearInterval(presenceTimer);
    clearInterval(orphanTimer);
    streamCtrl.abort();
    claimCtrl.abort();
    caffeinate?.kill();
  }

  return { machineId, stop, done };
}
