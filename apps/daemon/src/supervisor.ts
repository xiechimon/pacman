// supervisor（01 §4.3：detach spawn + daemon.json{pid,startedAt,runner} +
// 崩溃保活重启，~100 行；02 §5.1「detached + supervisor 跨崩溃保活」的实现形）。
// daemon.json.pid = supervisor pid [设计]（形状照 r3 §1.3 {pid,startedAt,
// runner:"cli"}；stop 对 supervisor 发 SIGTERM，其转发 runner 后自清）。

import { spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { CLAIM_BACKOFF_CAP_MS } from '@pacman/shared';
import { createDaemonLogger } from './log.js';
import { clearDaemonJson, loadDaemonJson, statePaths, writeDaemonJson } from './state.js';

export interface SupervisorOpts {
  home: string;
  /** 透传给前台 runner 的 argv（start --foreground …）。 */
  runnerArgv: string[];
  cliPath?: string;
}

/** 后台启动：detach supervisor 进程，打印 `Started in background`（r3 §1.2）。 */
export function spawnSupervisor(opts: SupervisorOpts): { pid: number } {
  const paths = statePaths(opts.home);
  const existing = loadDaemonJson(paths);
  if (existing && isAlive(existing.pid)) {
    throw new Error(`daemon already running (pid ${existing.pid})`);
  }
  const logFd = openSync(paths.daemonLog, 'a');
  const cliPath = opts.cliPath ?? process.argv[1] ?? '';
  const child = spawn(process.execPath, [cliPath, 'supervise', ...opts.runnerArgv], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: process.env,
  });
  child.unref();
  if (child.pid === undefined) throw new Error('failed to spawn supervisor');
  return { pid: child.pid };
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** supervisor 主循环：spawn runner（start --foreground），崩溃保活重启
 * （指数退避封顶 30s = claim 同族预算 [设计]）；SIGTERM → 转发 runner →
 * `[supervisor] stopped`（r3 §1.5 退出行序）。 */
export async function runSupervisor(opts: SupervisorOpts): Promise<void> {
  const paths = statePaths(opts.home);
  const logger = createDaemonLogger({ logFile: paths.daemonLog });
  const cliPath = opts.cliPath ?? process.argv[1] ?? '';
  let stopping = false;
  let runner: ReturnType<typeof spawn> | null = null;

  writeDaemonJson(paths, { pid: process.pid, startedAt: Date.now(), runner: 'cli' });

  const onSignal = () => {
    if (stopping) return;
    stopping = true;
    runner?.kill('SIGTERM');
  };
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);

  let backoff = 1_000;
  while (!stopping) {
    const exitCode = await new Promise<number | null>((resolve) => {
      runner = spawn(process.execPath, [cliPath, ...opts.runnerArgv], {
        stdio: 'inherit',
        env: process.env,
      });
      runner.on('exit', (code) => resolve(code));
      runner.on('error', () => resolve(null));
    });
    if (stopping) break;
    logger.supervisor(`runner exited (code ${exitCode ?? 'signal'}) — restarting in ${backoff}ms`);
    await new Promise((r) => setTimeout(r, backoff));
    backoff = Math.min(backoff * 2, CLAIM_BACKOFF_CAP_MS);
  }
  clearDaemonJson(paths);
  logger.supervisor('stopped');
}

/** stop：读 daemon.json → SIGTERM supervisor → 等待退出（清理由 supervisor 做）。 */
export async function stopSupervisor(home: string, timeoutMs = 8_000): Promise<boolean> {
  const paths = statePaths(home);
  const daemon = loadDaemonJson(paths);
  if (!daemon || !isAlive(daemon.pid)) {
    clearDaemonJson(paths);
    return false;
  }
  process.kill(daemon.pid, 'SIGTERM');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(daemon.pid)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return !isAlive(daemon.pid);
}
