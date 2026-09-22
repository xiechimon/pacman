// step 单会话执行（03 M3a：claim → pi 会话 → transcript 回传落库）。
// 生命周期日志行序 canon = 02 §5.7（`step <id> for conv <uuid> (n/3 running)`
// → `using model <provider>/<modelId>` → workspace 准备 → `new session <convId>`
// / `continue session <convId>` → `finished (m/3 running)`；`pushed <convBranch>`
// 行属 git 面，归 M3b）。
// journal 状态机（02 §5.4 recover 细节 [推断] = 04 附录 A 自定等价物）：
// claimed → running → awaiting-upload →（done | failed）；中断残留由
// machine-loop recover 面对账续跑。

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AgentBackend,
  AgentSessionHandle,
  AgentTokenUsage,
  ClaimedStep,
  ProviderConfig,
  SessionOpts,
} from '@pacman/shared';
import { REMOTE_TOOL_RETRY_DELAYS_MS, STREAM_TIMEOUTS_MS } from '@pacman/shared';
import { SessionNotResumableError } from './backend/errors.js';
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
 * 驳回 feedback / 合并指令等续轮 prompt 由调用方经 resume.prompt 传入）。 */
export function buildTaskPrompt(claimed: ClaimedStep): string {
  return `${claimed.todo.title}\n\n${claimed.todo.spec}`;
}

/** continue session 续轮指令 [设计]（02 §4.2：确认→执行步、merge 202
 * delegated→合并步均复用同 conv 会话；驳回 feedback 注入归 M4 回路）。 */
export const CONTINUE_PROMPTS: Record<ClaimedStep['step']['kind'], string> = {
  plan: '请重新规划该任务，输出更新后的方案。',
  build: '方案已确认。请按方案执行，完成改动。',
  merge: '请把本会话分支的改动合并到默认分支。',
};

/** hasChanges 判定 [推断骨架]（02 §4.1/r5 §8 列位双键；git diff 面归 M3b，
 * 当前 = transcript 含写类工具行）。 */
const CHANGE_TOOLS = new Set(['edit', 'write', 'bash']);

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

  const prompt =
    opts.resume?.prompt ??
    (claimed.session.action === 'continue' && claimed.session.sessionId
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

  // per-step 凭证下发（02 §5.4/§8：内存持有，不落盘常驻）。
  const tokenRes = await client.token(stepId);
  const agent = claimed.agent;
  const provider: ProviderConfig | null =
    tokenRes.provider ?? (agent?.provider ? { kind: 'api_key', providerId: agent.provider } : null);
  if (!agent?.modelId || !provider) {
    await failStep(deps, stepId, 'no agent/model on claimed step');
    return;
  }
  logger.raw(`using model ${provider.providerId}/${agent.modelId}`);

  // workspace 准备（M3a = 任务目录；worktree/git 契约归 M3b，02 §5.5）。
  const cwd = join(deps.workspacesDir, convId);
  mkdirSync(cwd, { recursive: true });
  logger.workspace('准备工作区...');

  const sessionOpts: SessionOpts = {
    provider,
    modelId: agent.modelId,
    ...(agent.thinkingLevel ? { thinkingLevel: agent.thinkingLevel } : {}),
    ...(agent.description ? { systemPrompt: agent.description } : {}),
    cwd,
    ...(prompt !== null ? { prompt } : {}),
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
  try {
    for await (const ev of handle.events) {
      armWatchdog(STREAM_TIMEOUTS_MS.streamIdle);
      switch (ev.type) {
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
          usage = ev.usage;
          break;
        default:
          break;
      }
    }
  } catch (err) {
    clearInterval(heartbeat);
    if (watchdog) clearTimeout(watchdog);
    await failStep(deps, stepId, err instanceof Error ? err.message : String(err));
    return;
  }
  clearInterval(heartbeat);
  if (watchdog) clearTimeout(watchdog);
  if (timedOut)
    lastError = `stream timeout (first=${STREAM_TIMEOUTS_MS.streamFirstEvent}ms idle=${STREAM_TIMEOUTS_MS.streamIdle}ms)`;

  const status = lastError === null ? 'success' : 'failed';
  journal.update(stepId, { state: 'awaiting-upload' });

  // upload-urls → transcript 终稿回传落库（02 §1.3 数据所有权）。
  try {
    const messages = transcript.messages();
    const { uploads } = await client.uploadUrls(stepId, [
      { name: 'transcript.json', size: JSON.stringify(messages).length },
    ]);
    const upload = uploads[0];
    if (upload) {
      await client.putUpload(upload.url, upload.headers, { stepId, messages });
    }
  } catch (err) {
    // 回传失败 = journal 残留 awaiting-upload，recover 面重传 [设计]。
    logger.step(`transcript upload failed: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  try {
    await client.done(stepId, {
      status,
      ...(lastError !== null ? { errorMessage: lastError } : {}),
      sessionId: handle.sessionId,
      usage: [...usage],
      hasChanges: sawChangeTool,
    });
  } catch (err) {
    logger.step(`done report failed: ${err instanceof Error ? err.message : String(err)}`);
    return; // journal 残留，recover 面补报
  }
  journal.remove(stepId);
  logger.raw(`finished (${running - 1}/${deps.maxConcurrent} running)`);
}

async function failStep(deps: RunStepDeps, stepId: string, message: string): Promise<void> {
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
