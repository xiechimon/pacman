// step 单会话执行（03 M3a：claim → pi 会话 → transcript 回传落库）。
// 生命周期日志行序 canon = 02 §5.7（`step <id> for conv <uuid> (n/3 running)`
// → `using model <provider>/<modelId>` → workspace 准备 → `new session <convId>`
// / `continue session <convId>` → `finished (m/3 running)`；`pushed <convBranch>`
// 行属 git 面，归 M3b）。
// journal 状态机（02 §5.4 recover 细节 [推断] = 04 附录 A 自定等价物）：
// claimed → running → awaiting-upload →（done | failed）；中断残留由
// machine-loop recover 面对账续跑。

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AgentBackend,
  AgentSessionHandle,
  AgentTokenUsage,
  ClaimedStep,
  PreparedWorkspace,
  ProviderConfig,
  SessionOpts,
  WorktreeOps,
} from '@pacman/shared';
import { PLAN_FILE_NAME, REMOTE_TOOL_RETRY_DELAYS_MS, STREAM_TIMEOUTS_MS } from '@pacman/shared';
import { SessionNotResumableError } from './backend/errors.js';
import { clearCredentials, pushCredential } from './credentials.js';
import { type StepJournal, TranscriptBuffer } from './journal.js';
import type { DaemonLogger } from './log.js';
import type { MachineApi } from './machine-client.js';
import type { StatePaths } from './state.js';

export interface RunStepDeps {
  client: MachineApi;
  journal: StepJournal;
  backend: AgentBackend;
  logger: DaemonLogger;
  paths: StatePaths;
  workspacesDir: string;
  maxConcurrent: number;
  /** worktree 契约面（02 §5.5；machine-loop 注入共享实例——projectLock 跨步
   * 串行化需要单例）。缺省且步带 repo 绑定 = 配置错误，按 failed 收尾。 */
  workspace?: WorktreeOps;
  /** 在跑 session 句柄注册表（W3 #279 steer 投递面）：machine-loop 持有，
   * runStep 装卸（handle 创建即注册、各收尾路径注销），machine-loop 的
   * deliverSteer 按 stepId 消费。缺省 = 无 steer 面（单测形态）。 */
  sessionHandles?: Map<string, AgentSessionHandle>;
  /** 停止请求旗标（M7 #308 stop 投递面）：machine-loop deliverStop 拉取-
   * 确认后置位（discard = 「丢弃本轮修改」勾选位），runStep 事件流结束后
   * 消费判 stopped 收尾。缺省 = 无 stop 面（单测形态）。 */
  stopRequests?: Map<string, { discard: boolean }>;
  /** heartbeat 节奏 [设计]（r3 未采具体值；presence 同族 ~30s）。 */
  heartbeatIntervalMs?: number;
  now?: () => number;
}

export interface RunStepOptions {
  /** recover 续跑：已有 journal 条目（continue session 解析用）。 */
  resume?: { sessionId: string | null; prompt: string | null };
  /** 已认领的运行数（canon 行 `(n/3 running)` 的 n）。 */
  running?: number;
}

/** 任务文本（M3a 骨架 [设计]：title + spec 原文；plan.md 产出/git 面归 M3b，
 * 驳回 feedback / 合并指令等续轮 prompt 由调用方经 resume.prompt 传入）。
 * chief 步无 todo → 用 server 合成的 instruction（用户消息/wake 事实）。 */
export function buildTaskPrompt(claimed: ClaimedStep): string {
  const todo = claimed.todo;
  if (!todo) return claimed.instruction ?? '';
  return `${todo.title}\n\n${todo.spec}`;
}

/** continue session 续轮指令 [设计]（02 §4.2：确认→执行步、merge 202
 * delegated→合并步均复用同 conv 会话；驳回 feedback 经 server instruction 注入，
 * M4a）。chief 续轮 = wake 事实走 instruction，本表 chief 值不用（占位保全键）。 */
export const CONTINUE_PROMPTS: Record<ClaimedStep['step']['kind'], string> = {
  plan: '请重新规划该任务，输出更新后的方案。',
  build: '方案已确认。请按方案执行，完成改动。',
  merge: '请把本会话分支的改动合并到默认分支。',
  chief: '',
};

/** worker 步 systemPrompt = 职责文本 + 记忆注入（02 §4.4 读路径最小形；每步
 * 开跑注入该 Agent 记忆条目——注入形 [推断] 保留，触到即验证回写 04 附录 A）。 */
export function composeWorkerSystemPrompt(
  description: string | null | undefined,
  memories: readonly { title: string; content: string }[] | undefined,
): string | undefined {
  const parts: string[] = [];
  if (description) parts.push(description);
  if (memories && memories.length > 0) {
    parts.push(`## 记忆\n${memories.map((m) => `- ${m.title}：${m.content}`).join('\n')}`);
  }
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

/** hasChanges 判定 [推断骨架]（02 §4.1/r5 §8 列位双键；git diff 面归 M3b，
 * 当前 = transcript 含写类工具行）。 */
const CHANGE_TOOLS = new Set(['edit', 'write', 'bash']);

/** live transcript 文本增量转发节流窗口 [设计]（M5 live streaming；官方节奏
 * 不可观测——窗口取「肉眼成流、请求不成洪」的折中）。 */
const TRANSCRIPT_DELTA_FLUSH_MS = 250;

async function withRetries<T>(
  fn: () => Promise<T>,
  delaysMs: readonly number[],
  logger: DaemonLogger,
  label: string,
): Promise<T | null> {
  let lastErr: unknown;
  for (let i = 0; i <= delaysMs.length; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = delaysMs[i - 1];
      if (delay === undefined) break;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // 重试预算耗尽：原因上浮日志（不再静默吞错）。
  logger.step(
    `${label} retry exhausted: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
  return null;
}

export async function runStep(
  deps: RunStepDeps,
  claimed: ClaimedStep,
  opts: RunStepOptions = {},
): Promise<void> {
  const { client, journal, backend, logger } = deps;
  const now = deps.now ?? (() => Date.now());
  const stepId = claimed.step.id;
  const convId = claimed.conversationId;
  const running = opts.running ?? 1;
  logger.raw(`step ${stepId} for conv ${convId} (${running}/${deps.maxConcurrent} running)`);

  // chief 步（回合 = 机器 step，r5 §3.1）：任务文本 = server 合成的 instruction
  // （用户消息 / wake 事实），无 todo 语境；remoteTools relay + systemPrompt 走
  // chief 块。worker 步：title+spec 或续轮指令。
  const isChief = claimed.step.kind === 'chief';
  const prompt =
    opts.resume?.prompt ??
    (isChief
      ? (claimed.instruction ?? '')
      : claimed.session.action === 'continue' && claimed.session.sessionId
        ? CONTINUE_PROMPTS[claimed.step.kind]
        : buildTaskPrompt(claimed));

  // journal：claimed（recover 面即时落盘，02 §5.4）。
  journal.claim({
    stepId,
    buildId: claimed.step.buildId,
    kind: claimed.step.kind,
    conversationId: convId,
    sessionAction: claimed.session.action,
    sessionId: opts.resume?.sessionId ?? claimed.session.sessionId,
    prompt,
    claimed,
  });

  // per-step 凭证下发（02 §5.4/§8：内存持有，不落盘常驻；push_credential
  // 对照 = credentials.ts）。
  const tokenRes = await client.token(stepId);
  const creds = pushCredential(tokenRes);
  const agent = claimed.agent;
  const provider: ProviderConfig | null =
    creds.provider ?? (agent?.provider ? { kind: 'api_key', providerId: agent.provider } : null);
  if (!agent?.modelId || !provider) {
    clearCredentials(creds);
    await failStep(deps, stepId, 'no agent/model on claimed step');
    return;
  }
  logger.raw(`using model ${provider.providerId}/${agent.modelId}`);

  // workspace 准备（02 §5.5 worktree 契约：基座 clone + `worktree add -b`；
  // 项目未绑 repo = 裸任务目录退化形 [设计]，M3a 兼容）。chief 步 = 只读探索，
  // 不开 worktree（不产可合并改动；仓库读经 remoteTools docs/projects relay，
  // 黑盒逼近 04 §1 A4）→ 裸任务目录。
  logger.workspace('准备工作区...');
  let ws: PreparedWorkspace | null = null;
  const repo = isChief ? null : (claimed.project?.repo ?? null);
  if (repo !== null && repo.kind === 'hosted') {
    if (!deps.workspace) {
      clearCredentials(creds);
      await failStep(deps, stepId, 'workspace ops unavailable for repo-bound step');
      return;
    }
    try {
      ws = await deps.workspace.prepare({
        projectId: claimed.project?.id ?? '',
        conversationId: convId,
        cloneUrl: repo.cloneUrl,
        workspacesRoot: deps.workspacesDir,
        credentials: creds.git,
      });
    } catch (err) {
      clearCredentials(creds);
      await failStep(deps, stepId, err instanceof Error ? err.message : String(err));
      return;
    }
  }
  const cwd = ws?.cwd ?? join(deps.workspacesDir, convId);
  if (!ws) mkdirSync(cwd, { recursive: true });

  // 步起点 head（M7 #308：停止 + 丢弃本轮修改的 rewind 目标 checkpoint——
  // prepare 后即时捕获，pi 会话期间的提交/脏树都在其上层）。
  let headAtStart: string | null = null;
  if (ws !== null && deps.workspace) {
    try {
      headAtStart = await deps.workspace.headCommit(ws.cwd);
    } catch {
      headAtStart = null; // 空基座等退化形：无可回退点，discard 降级为不清理
    }
  }

  // systemPrompt：chief = server 合成（charter + 资源清单 + 策略指引 + 记忆，
  // 02 §4.3）；worker = 职责文本 + 记忆注入（02 §4.4 读路径最小形，注入形 [推断]）。
  const systemPrompt =
    isChief && claimed.chief
      ? claimed.chief.systemPrompt
      : composeWorkerSystemPrompt(agent.description, agent.memories);
  // remoteTools：chief 步 = 49 词表全量；worker 步 = 记忆三件套（02 §4.4/r5 §6
  // worker 写路径经 remoteTools relay；M4b 起服务端对 worker 步同样下发）。
  const remoteTools = claimed.remoteTools;
  const sessionOpts: SessionOpts = {
    provider,
    modelId: agent.modelId,
    ...(agent.thinkingLevel ? { thinkingLevel: agent.thinkingLevel } : {}),
    ...(systemPrompt ? { systemPrompt } : {}),
    cwd,
    ...(prompt !== null ? { prompt } : {}),
    ...(remoteTools && remoteTools.length > 0
      ? {
          remoteTools,
          // relay 执行（r5 §3.1 bundle：execute → POST tool/<stepId> {name,params}
          // → {text}；replaySafe 读工具带重试预算 + 10s 超时）。
          executeRemoteTool: (name, params) => {
            const def = remoteTools.find((t) => t.name === name);
            return client.relayTool(stepId, name, params, {
              ...(def?.replaySafe ? { replaySafe: true } : {}),
            });
          },
        }
      : {}),
    // MCP per-turn 连接面（02 §7.1；server 侧 claim 携带已授权端点 + 版本墙）。
    ...(claimed.mcpServers && claimed.mcpServers.length > 0
      ? { mcpServers: claimed.mcpServers }
      : {}),
  };

  // continue 解析键：journal 快照（recover 面）优先，其次 claim 载荷携带的
  // server 侧 sessionId（02 §5.7 合并轮/续轮复用同 conv 会话）。
  const continueId =
    claimed.session.action === 'continue'
      ? (opts.resume?.sessionId ?? claimed.session.sessionId)
      : null;
  let handle: AgentSessionHandle;
  let resumed = Boolean(continueId);
  try {
    handle = continueId
      ? await backend.continueSession(continueId, sessionOpts)
      : await backend.createSession(sessionOpts);
  } catch (err) {
    if (continueId && err instanceof SessionNotResumableError) {
      // 会话文件未落盘（崩溃竞态）→ 回退 new session 重发任务文本 [设计]。
      logger.step(`continue session unavailable (${continueId}) — falling back to new session`);
      resumed = false;
      try {
        handle = await backend.createSession(sessionOpts);
      } catch (err2) {
        await failStep(deps, stepId, err2 instanceof Error ? err2.message : String(err2));
        return;
      }
    } else {
      await failStep(deps, stepId, err instanceof Error ? err.message : String(err));
      return;
    }
  }
  logger.raw(resumed ? `continue session ${convId}` : `new session ${convId}`);
  // 会话持久化索引即时落 journal（崩溃 recover 的 continue 解析键）。
  journal.update(stepId, { state: 'running', sessionId: handle.sessionId });
  // steer 投递面注册（W3 #279）：在跑期间 deliverSteer 可达；各收尾路径注销。
  deps.sessionHandles?.set(stepId, handle);

  const transcript = new TranscriptBuffer(deps.paths.outboxDir, stepId);
  if (prompt !== null) {
    transcript.upsert({
      id: `user-${stepId}`,
      role: 'user',
      content: prompt,
      createdAt: now(),
    });
  }

  // heartbeat 续活（失败不打断执行——与 presence 同纪律 [推断]）。
  const heartbeat = setInterval(() => {
    client.heartbeat(stepId).catch(() => {});
  }, deps.heartbeatIntervalMs ?? 30_000);
  if (heartbeat.unref) heartbeat.unref();

  let usage: AgentTokenUsage = [];
  let lastError: string | null = null;
  let messageSeq = 0;
  let sawChangeTool = false;
  // 自然完成判定（M7 #308）：done 事件在位 = 会话自然收尾，stop 旗标迟到
  // 不改判（停止与自然完成的竞态以完成为准）。
  let sawDone = false;
  // 流超时护栏（02 §5.6 r3 bundle 原文三值全用）：首事件 streamFirstEvent、
  // 事件间空闲 streamIdle、流 body 总时长 streamBodyTimeout；超时 = 中断会话
  // 并按 failed 收尾。
  let timedOut = false;
  let watchdog: NodeJS.Timeout | null = null;
  const armWatchdog = (ms: number) => {
    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      timedOut = true;
      void handle.stop();
    }, ms);
    watchdog.unref?.();
  };
  armWatchdog(STREAM_TIMEOUTS_MS.streamFirstEvent);
  const bodyTimeout = setTimeout(() => {
    timedOut = true;
    void handle.stop();
  }, STREAM_TIMEOUTS_MS.streamBodyTimeout);
  bodyTimeout.unref?.();
  // live transcript 文本增量转发（M5 live streaming）：pi text_delta 按
  // TRANSCRIPT_DELTA_FLUSH_MS 窗口聚合批量 POST（tool/{stepId} 第三形
  // [设计]）；fire-and-forget——失败仅日志，终稿经 transcript 上传兜底。
  let deltaBuf = '';
  let deltaTimer: NodeJS.Timeout | null = null;
  const flushDeltas = () => {
    if (deltaTimer !== null) {
      clearTimeout(deltaTimer);
      deltaTimer = null;
    }
    const text = deltaBuf;
    deltaBuf = '';
    if (text === '') return;
    client.transcriptDelta(stepId, text).catch((err: unknown) => {
      logger.step(
        `transcript delta relay failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  };
  try {
    for await (const ev of handle.events) {
      armWatchdog(STREAM_TIMEOUTS_MS.streamIdle);
      switch (ev.type) {
        case 'text_delta': {
          deltaBuf += ev.text;
          if (deltaTimer === null) {
            deltaTimer = setTimeout(flushDeltas, TRANSCRIPT_DELTA_FLUSH_MS);
            deltaTimer.unref?.();
          }
          break;
        }
        case 'toolcall_end': {
          if (ev.call.name && CHANGE_TOOLS.has(ev.call.name)) sawChangeTool = true;
          transcript.upsert({
            id: ev.call.id,
            role: 'assistant',
            content: { kind: 'toolcall', call: ev.call },
            createdAt: ev.call.endedAt ?? now(),
          });
          if (ev.call.result !== undefined) {
            // live 回传（重试预算 = REMOTE_TOOL_RETRY_DELAYS_MS [500,2000]ms，
            // r5 §3.1；终败仅日志——终稿 transcript 经 upload-urls 兜底）。
            const ok = await withRetries(
              () => client.tool(stepId, ev.call),
              REMOTE_TOOL_RETRY_DELAYS_MS,
              logger,
              `tool relay ${ev.call.id}`,
            );
            if (ok === null)
              logger.step(`tool relay failed for ${ev.call.id} (transcript upload will carry it)`);
          }
          break;
        }
        case 'message_end': {
          // user 行不重复落（任务文本行 user-<stepId> 已在缓冲；pi 回声同文）。
          if (ev.message.role === 'user') break;
          messageSeq += 1;
          transcript.upsert({
            id: `msg-${stepId}-${messageSeq}`,
            role: ev.message.role,
            content: ev.message.content,
            createdAt: now(),
          });
          break;
        }
        case 'error':
          lastError = ev.error.message;
          logger.step(`error: ${ev.error.message} (retryable=${ev.error.retryable})`);
          break;
        case 'auto_retry_start':
          lastError = null; // pi 流级自动重试吸收前错（02 §4.2）
          logger.step(`auto_retry_start attempt=${ev.attempt}`);
          break;
        case 'compaction_start':
          logger.step('compaction_start');
          break;
        case 'done':
          sawDone = true;
          usage = ev.usage;
          break;
        default:
          break;
      }
    }
  } catch (err) {
    clearInterval(heartbeat);
    if (watchdog) clearTimeout(watchdog);
    flushDeltas();
    clearCredentials(creds);
    await failStep(deps, stepId, err instanceof Error ? err.message : String(err));
    return;
  }
  flushDeltas();
  clearInterval(heartbeat);
  if (watchdog) clearTimeout(watchdog);
  if (timedOut)
    lastError = `stream timeout (first=${STREAM_TIMEOUTS_MS.streamFirstEvent}ms idle=${STREAM_TIMEOUTS_MS.streamIdle}ms)`;

  // —— 停止钮中断判定（M7 #308）：旗标 = machine-loop deliverStop 拉取-确认
  // 后置位；sawDone 优先 = stop 与自然完成竞态归完成（success 不改判）。——
  const stopReq = deps.stopRequests?.get(stepId);
  if (stopReq !== undefined) deps.stopRequests?.delete(stepId);
  const stopped = stopReq !== undefined && !sawDone;
  if (stopReq !== undefined && sawDone) logger.step('stop arrived after completion — ignored');
  if (stopped) {
    logger.step(`step stopped by user (discard=${stopReq?.discard === true})`);
    // abort 吞掉终局 done 事件（backend/pi.ts stopping 位）→ usage 从 handle
    // 累计面兜底（token 记账不因停止丢失）。
    usage = handle.usage();
    // 丢弃本轮修改 = worktree rewind 到步起点 checkpoint（r9 §3.3「方案和
    // 代码回到上一个版本」；方案文档面天然回上版——plan.md 上传在步收尾，
    // 停止即不上传）。不 commit/push：中断步不产交接物，远端分支停在上一步
    // 收尾态（本地 rewind 后即与远端一致，无需 force push）。
    if (stopReq?.discard && ws !== null && deps.workspace && headAtStart !== null) {
      try {
        await deps.workspace.restoreCheckpoint(ws.cwd, headAtStart);
      } catch (err) {
        logger.step(`discard rewind failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // —— git 收尾（02 §5.5：每步结束自动 commit + push 本 conversation 工作
  // 分支；合并步先走 `git merge --no-edit origin/<default>`，r3 §3.6；
  // 停止步跳过——中断步不产交接物）——
  let headCommit: string | null = null;
  let hasChanges = sawChangeTool; // 未绑 repo 退化形 = transcript 写类工具行 [推断骨架]
  if (ws !== null && deps.workspace && lastError === null && !stopped) {
    const git = deps.workspace;
    try {
      // 提交身份 [设计]（r3 未采 committer 词表）：Agent 名 + 机器位。
      const identity = {
        name: claimed.agent?.displayName ?? 'pacman-agent',
        email: `${claimed.step.machineId ?? 'machine'}@pacman.local`,
      };
      const committed = await git.commitAll(
        ws.cwd,
        `${claimed.step.kind}: ${claimed.todo?.title ?? claimed.conversationId}`,
        identity,
      );
      if (claimed.step.kind === 'merge') {
        const merged = await git.mergeDefaultBranch(ws.cwd, ws.defaultBranch);
        // 合并结果行进 transcript（r3 §3.6 时间线样本「git merge origin/main
        // 结果为 "Already up to date"…」同形）。
        transcript.upsert({
          id: `merge-${stepId}`,
          role: 'system',
          content: `git merge origin/${ws.defaultBranch} 结果为 "${merged.output || 'OK'}"`,
          createdAt: now(),
        });
      }
      if (
        committed.committed ||
        claimed.step.kind === 'merge' ||
        (await git.countAhead(ws.cwd, ws.defaultBranch)) > 0
      ) {
        await git.push(ws.cwd, ws.branch, creds.git);
        logger.raw(`pushed ${ws.branch}`);
      }
      headCommit = committed.head ?? (await git.headCommit(ws.cwd));
      // hasChanges = conv 分支领先默认分支的提交在位（02 §4.1/r5 §8 列位双键；
      // git 真值面取代 M3a transcript 推断骨架）。
      hasChanges = (await git.countAhead(ws.cwd, ws.defaultBranch)) > 0;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const status = stopped ? 'stopped' : lastError === null ? 'success' : 'failed';
  if (!stopped && lastError !== null) logger.step(`step failed: ${lastError}`);
  journal.update(stepId, { state: 'awaiting-upload' });

  // upload-urls → transcript 终稿 + plan.md 产物回传落库（02 §1.3 数据所有权；
  // plan 即文件、版本 = 文件版本——规划步收尾上传当前版，02 §4.2/r5 §4）。
  try {
    const messages = transcript.messages();
    const files: { name: string; size?: number }[] = [
      { name: 'transcript.json', size: JSON.stringify(messages).length },
    ];
    let planContent: string | null = null;
    if (ws !== null && claimed.step.kind === 'plan' && !stopped) {
      const planPath = join(ws.cwd, PLAN_FILE_NAME);
      if (existsSync(planPath)) {
        planContent = readFileSync(planPath, 'utf8');
        files.push({ name: PLAN_FILE_NAME, size: planContent.length });
      }
    }
    const { uploads } = await client.uploadUrls(stepId, files);
    for (const upload of uploads) {
      if (upload.name === PLAN_FILE_NAME && planContent !== null) {
        await client.putUpload(upload.url, upload.headers, planContent, 'text/markdown');
      } else if (upload.name === 'transcript.json') {
        await client.putUpload(upload.url, upload.headers, { stepId, messages });
      }
    }
  } catch (err) {
    // 回传失败 = journal 残留 awaiting-upload，recover 面重传 [设计]。
    logger.step(`transcript upload failed: ${err instanceof Error ? err.message : String(err)}`);
    clearCredentials(creds);
    deps.sessionHandles?.delete(stepId); // journal 残留 recover 面重传，handle 不再 steer
    deps.stopRequests?.delete(stepId);
    return;
  }

  try {
    await client.done(stepId, {
      status,
      ...(lastError !== null ? { errorMessage: lastError } : {}),
      sessionId: handle.sessionId,
      usage: [...usage],
      hasChanges,
      // per-step checkpoint（done 回传 commit：「恢复到此处」数据源 + 合并步
      // fast-forward 落地键，r3 §3.5/§3.9 [设计]）。
      ...(headCommit !== null ? { commit: headCommit } : {}),
    });
  } catch (err) {
    logger.step(`done report failed: ${err instanceof Error ? err.message : String(err)}`);
    clearCredentials(creds);
    deps.sessionHandles?.delete(stepId); // journal 残留 recover 补报，handle 不再 steer
    deps.stopRequests?.delete(stepId);
    return; // journal 残留，recover 面补报
  }
  clearCredentials(creds);
  journal.remove(stepId);
  deps.sessionHandles?.delete(stepId);
  deps.stopRequests?.delete(stepId);
  logger.raw(`finished (${running - 1}/${deps.maxConcurrent} running)`);
}

async function failStep(deps: RunStepDeps, stepId: string, message: string): Promise<void> {
  deps.sessionHandles?.delete(stepId); // 覆盖 handle 后失败路径（前置失败 = 无键可删）
  deps.stopRequests?.delete(stepId);
  deps.logger.step(`failed: ${message}`);
  try {
    await deps.client.done(stepId, { status: 'failed', errorMessage: message });
    deps.journal.remove(stepId);
  } catch (err) {
    // 离线：journal 保持 claimed/running（pending 面），recover 对账重报
    // （02 §5.4）；原因上浮日志。
    deps.logger.step(
      `done(failed) report unreachable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
