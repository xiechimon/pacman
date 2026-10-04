// 机器主循环（02 §5.4 上线序列 canon + r3 §1.5 实测行为）：
// `Loading pi runtime…` → enroll（如未注册）→ presence → `Online (machineId=…);
// polling <url>` → 防睡（caffeinate 类）→ `[recover]` 步 journal 恢复 →
// `[wake] push channel connected` →
// claim 长轮询循环（断网指数退避封顶 30s，presence 心跳并行失败，进程不退出）。
// 退出：SIGTERM → `[machine] Shutting down…`（`[supervisor] stopped` 在
// supervisor 侧，02 §5.3/r3 §1.5）。

import { type ChildProcess, spawn } from 'node:child_process';
import type { AgentBackend, AgentSessionHandle, ClaimedStep, DeliveredImage } from '@pacman/shared';
import {
  CLAIM_BACKOFF_CAP_MS,
  CLAIM_POLL_INTERVAL_MS,
  isBackendRuntimeId,
  ORPHAN_WORKTREE_TTL_MS,
} from '@pacman/shared';
import { createClaudeCodeBackend } from './backend/claude-code.js';
import { createPiBackend } from './backend/pi.js';
import { readClaudeCodeReport } from './claude-code-models.js';
import type { DaemonConfig } from './config.js';
import { StepJournal } from './journal.js';
import type { DaemonLogger } from './log.js';
import { type MachineApi, MachineClient } from './machine-client.js';
import { setupProxy } from './proxy.js';
import { runStep, type StopRequest } from './runner.js';
import {
  ensureStateDirs,
  loadMachineJson,
  loadOrCreateDeviceJson,
  recordSession,
  resolveSessionFile,
  type StatePaths,
  saveMachineJson,
} from './state.js';
import { resolveStepImages, sweepStepAttachments } from './step-attachments.js';
import { performSync } from './sync.js';
import { DAEMON_VERSION } from './version.js';
import { WorkspaceManager } from './workspace.js';

export interface MachineLoopOpts {
  config: DaemonConfig;
  paths: StatePaths;
  logger: DaemonLogger;
  /** pi 后端测试注入面（缺省 = 内建构造；spec 17 A3 起 per-step 解析的
   * 默认支）。 */
  backend?: AgentBackend;
  /** claude-code 后端测试注入面（spec 17 A3；缺省 = 首个 runtime 步惰性
   * 构造，canon 行 `Loading claude-code runtime…` 与 pi 行对仗）。 */
  claudeCodeBackend?: AgentBackend;
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
   * （journal 残留 + recover 对账）以子进程 SIGKILL 实测（T2 验证）。
   * cause = 触发面标识（#691：信号名进退出行，事后可考）。 */
  stop(cause?: string): Promise<void>;
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
  setupProxy(logger, opts.proxyEnv ?? process.env, config.serverUrl);

  // —— 上线序列 canon（02 §5.4）——
  logger.raw('Loading pi runtime…');
  const backend =
    opts.backend ??
    createPiBackend({
      agentDir: paths.agentRuntimeDir,
      sessionDir: paths.chatSessionsDir,
      // skills 执行面注入（spec 14/#371）：skillsDir = PACMAN_SKILLS_DIR 扫描根；
      // cwd = daemon home（project 级解析不随任务 worktree 切换跳变）。
      skills: { skillsDir: config.skillsDir, cwd: config.home },
      resolveSessionFile: (sid) => resolveSessionFile(paths, sid),
      onSession: (sid, file) => {
        if (file) recordSession(paths, sid, file);
      },
      // [mcp] 降级行（r3 §1.5 canon；02 §5.3 前缀词表 mcp 位）。
      onMcpLog: (msg) => logger.mcp(msg),
      // [skills] 诊断行（spec 14/#371；前缀词表 skills 位）。
      onSkillsLog: (msg) => logger.skills(msg),
      // [gate] 裁决行（#866 T5 命令闸；只记非放行裁决，allow 静默）。
      onGateLog: (msg) => logger.gate(msg),
    });

  // —— per-step 后端解析 registry（spec 17 A3：runner 的 backendFor 唯一
  // 分叉，此处供解析目标）——claude-code 后端惰性初始化：首 runtime 步才
  // 构造（零 claude 步的机器不付 SDK 构造/扫描成本），canon 行
  // `Loading claude-code runtime…` 与 pi 启动行对仗、恰一条。注入面
  // （测试）预置即免构造，canon 行仍在首解析时落（行为面统一）。
  let claudeBackend: AgentBackend | null = opts.claudeCodeBackend ?? null;
  let claudeAnnounced = false;
  const backendFor = (agentProviderId: string | null | undefined): AgentBackend => {
    if (!isBackendRuntimeId(agentProviderId)) return backend; // 默认支（pi）
    if (!claudeAnnounced) {
      logger.raw('Loading claude-code runtime…');
      claudeAnnounced = true;
    }
    if (claudeBackend === null) {
      claudeBackend = createClaudeCodeBackend({
        // skills 通道与 pi 同律（A9 复用 buildSkillsCatalog）。
        skills: { skillsDir: config.skillsDir, cwd: config.home },
        onSkillsLog: (msg) => logger.skills(msg),
      });
    }
    return claudeBackend;
  };

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
  // server 迁移诊断（#519 控制面搬家）：token 由注册时 server 签发，配置指向
  // 另一地址后旧 token 打新 server——若对面是全新库，唯一表象是 claim 401
  // 退避死循环，本行是排障第一线索（轮询地址仍以配置为准，A1「PACMAN_SERVER
  // 指过去」语义不变）。
  if (machineJson && machineJson.serverUrl !== config.serverUrl) {
    logger.machine(
      `enrolled against ${machineJson.serverUrl} but polling ${config.serverUrl} — if auth fails, re-enroll: logout, then start --api-key <k> --team <id>`,
    );
  }
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
      claudeCode: readClaudeCodeReport(),
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

  await client.presence({ cliVersion: DAEMON_VERSION, claudeCode: readClaudeCodeReport() });
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
  // 在跑 session 句柄注册表（W3 #279 steer 投递面）。声明位必须在 recover 块
  // 之前——stepDeps() 是函数声明（提升）且 recover 路径会先于下方流段调用它，
  // 注册表若在调用点之后才 const 初始化 = TDZ ReferenceError（crash-recover
  // 集成实测：重启 daemon 于 recover 即崩）。
  const sessionHandles = new Map<string, AgentSessionHandle>();
  // 停止请求旗标（M7 #308）：deliverStop 拉取-确认后置位，runStep 收尾判
  // stopped 消费；声明位纪律同 sessionHandles。
  const stopRequests = new Map<string, StopRequest>();

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

  // step-attachments scratch 回收（#759 R3：sweepOrphans 同形——上线一次 +
  // 每日节奏；再生前提见 step-attachments.ts STEP_ATTACHMENTS_TTL_MS）。
  const sweepStepScratch = () => {
    try {
      const removed = sweepStepAttachments(paths.stepAttachmentsDir, { now: Date.now() });
      if (removed.length > 0) {
        logger.workspace(`step-attachments recycled: ${removed.length} (${removed.join(', ')})`);
      }
    } catch (err: unknown) {
      logger.workspace(
        `step-attachments cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };
  sweepStepScratch();
  const stepScratchTimer = setInterval(sweepStepScratch, 24 * 60 * 60 * 1000);
  stepScratchTimer.unref?.();

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

  // —— wake SSE（低延迟派发通道；断线持续重连不退出，r3 §1.5）——
  // 低延迟派发全归 server 侧：入队 wake() 同一同步轮直解挂起的 claim hold
  // （tryClaim→waiter 注册为同一同步块，单进程无事件循环间隙可乘——
  // machine-wire.test.ts「入队即 wake」钉住）。daemon 端不消费 wake 事件
  // （#482 裁定）：SSE 先于 claim 响应到达时中断在飞 claim 会与 server 已
  // 落库 claimed 的响应竞态，孤儿化已领步；hold 到期重发（≤75s）即残余
  // 上界的兜底（多进程部署内存 hub 不共享时同此界）。
  // steer 事件（W3 #279）三号分流：拉取-确认投递到在跑 session handle。
  // #730：steer 文本里的整行图片 token 同步解析下载（先判活再下载——无在跑
  // handle 时一字节不白下），图片随 handle.steer(text, images) 内联交付。
  const streamCtrl = new AbortController();
  const deliverSteer = async (stepId: string): Promise<void> => {
    try {
      const content = await client.steer(stepId);
      if (content === null) return; // server 门拒/旧步已丢弃（拉取-确认语义）。
      const live = sessionHandles.get(stepId);
      if (live === undefined) {
        logger.step(`steer dropped (no live session) step=${stepId}`); // 收尾竞态
        return;
      }
      let deliveryText = content;
      let images: DeliveredImage[] | undefined;
      try {
        const resolved = await resolveStepImages({
          text: content,
          stepId,
          client,
          materializeDir: paths.stepAttachmentsDir,
          log: (line) => logger.step(line),
        });
        deliveryText = resolved.text;
        if (resolved.images.length > 0) images = [...resolved.images];
      } catch (err) {
        logger.step(
          `steer attachment resolve failed (delivering raw text): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      await live.steer(deliveryText, images);
      logger.step(`steer delivered step=${stepId}`);
    } catch (err) {
      logger.step(`steer delivery failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  // 停止投递（M7 #308，steer 三号分流同律）：拉取-确认置旗标 → live.stop()
  // 中断 pi 会话；旗标先于 stop() 置位（runStep 的事件流结束即读）。收尾
  // 判 stopped / done(stopped) 回报 / discard rewind 归 runner。
  const deliverStop = async (stepId: string): Promise<void> => {
    try {
      const discard = await client.stop(stepId);
      if (discard === null) return; // server 门拒/旧步已丢弃（拉取-确认语义）。
      const live = sessionHandles.get(stepId);
      if (live === undefined) {
        logger.step(`stop dropped (no live session) step=${stepId}`); // 收尾竞态
        return;
      }
      stopRequests.set(stepId, { discard });
      await live.stop();
      logger.step(`stop delivered step=${stepId}`);
    } catch (err) {
      // 拉取/abort 失败旗标不残留（会话未真中断，自然收尾不被误判 stopped）。
      stopRequests.delete(stepId);
      logger.step(`stop delivery failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  const deliverSync = async (cmd: import('@pacman/shared').MachineSyncCommand): Promise<void> => {
    // 第四事件分流（M7 #319 [设计]，08 册附录 B「分支同步」）：分支对话框
    // 「同步到机器」server 派发；performSync 内部 ack running + 收尾 synced
    // /failed + 异常吞掉（本函数不抛——sync 是独立轨道，失败落账即闭环）。
    await performSync({ client, logger }, cmd);
  };
  void (async () => {
    let backoff = 1_000;
    let announced = false;
    while (!streamCtrl.signal.aborted) {
      try {
        await client.stream(
          streamCtrl.signal,
          (ev) => {
            if (ev.type === 'shutdown') void stop();
            if (ev.type === 'steer') void deliverSteer(ev.stepId);
            if (ev.type === 'stop') void deliverStop(ev.stepId);
            if (ev.type === 'sync') void deliverSync(ev.sync);
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
      .presence({ cliVersion: DAEMON_VERSION, claudeCode: readClaudeCodeReport() })
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
      backendFor,
      logger,
      paths,
      workspace,
      workspacesDir: config.workspacesDir,
      mcpConfigPath: config.mcpConfigPath,
      sessionHandles,
      stopRequests,
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

  async function stop(cause?: string): Promise<void> {
    if (stopping) return;
    stopping = true;
    logger.machine(`Shutting down…${cause ? ` (${cause})` : ''}`);
    clearInterval(presenceTimer);
    clearInterval(orphanTimer);
    clearInterval(stepScratchTimer);
    streamCtrl.abort();
    claimCtrl.abort();
    caffeinate?.kill();
  }

  return { machineId, stop, done };
}
