#!/usr/bin/env node
// verify-pacman cleanup — 回收 launch 起的栈:按 pid 文件组杀(SIGTERM →
// 6s 宽限 → SIGKILL),删 VERIFY_RUN_DIR(scratch home + 日志)。证据目录
// 不动,收尾回显其位置。只杀 pid 文件里自己记录的进程,且杀前用 ps 核对
// 命令行含 tsx/vite/pnpm 标记(防陈旧 pid 误杀无辜进程);永不按进程名杀。

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const SCRIPT_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
const ROOT = process.env.VERIFY_REPO_ROOT
  ? resolve(process.env.VERIFY_REPO_ROOT)
  : SCRIPT_ROOT;
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(ROOT, '.claude', 'verify-run');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function groupAlive(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** 组内进程命令行含我们的标记才杀;查不到命令行(已死)当已回收。 */
function commandOf(pid) {
  try {
    return execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' })
      .trim();
  } catch {
    return '';
  }
}

async function killStackPid(pid, label) {
  if (!Number.isInteger(pid)) return;
  if (!groupAlive(pid)) {
    console.log(`${label}:pid ${pid} 已不在`);
    return;
  }
  const cmd = commandOf(pid);
  if (cmd !== '' && !/tsx|vite|pnpm/.test(cmd)) {
    console.warn(`${label}:pid ${pid} 命令行不像我们的栈(${cmd}),跳过`);
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    /* 已死 */
  }
  for (let i = 0; i < 20 && groupAlive(pid); i += 1) await sleep(300);
  if (groupAlive(pid)) {
    console.warn(`${label}:SIGTERM 未收敛,pid ${pid} 升级 SIGKILL`);
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      /* 已死 */
    }
    for (let i = 0; i < 10 && groupAlive(pid); i += 1) await sleep(200);
  }
  console.log(`${label}:${groupAlive(pid) ? '仍在(人工查 lsof)' : '已回收'}(pid ${pid})`);
}

async function main() {
  const portsFile = join(RUN_DIR, 'ports.json');
  const pids = { server: undefined, web: undefined };
  let homeDir = null;
  if (existsSync(portsFile)) {
    try {
      const stack = JSON.parse(readFileSync(portsFile, 'utf8'));
      pids.server = stack.serverPid;
      pids.web = stack.webPid;
      homeDir = stack.homeDir;
    } catch {
      /* 坏文件走 pid 文件兜底 */
    }
  }
  for (const name of ['server', 'web']) {
    if (pids[name] == null && existsSync(join(RUN_DIR, `${name}.pid`))) {
      pids[name] = Number.parseInt(readFileSync(join(RUN_DIR, `${name}.pid`), 'utf8'), 10);
    }
  }
  if (pids.server == null && pids.web == null && !existsSync(RUN_DIR)) {
    console.log('无栈可回收(运行目录不存在)');
    process.exit(0);
  }

  await killStackPid(pids.web, 'vite dev');
  await killStackPid(pids.server, 'server');

  const dbExisted = homeDir != null && existsSync(join(homeDir, 'server', 'server.db'));
  rmSync(RUN_DIR, { recursive: true, force: true });
  console.log(`运行态已删:${RUN_DIR}(scratch home${dbExisted ? ',含 SQLite 库' : ''})`);

  // 证据回显:cleanup 不删证据,确认其仍在命名位置
  const evidenceRoot = process.env.VERIFY_EVIDENCE_DIR
    ? resolve(process.env.VERIFY_EVIDENCE_DIR)
    : join(SCRIPT_ROOT, '.claude', 'verify-evidence');
  if (existsSync(evidenceRoot)) {
    const entries = readdirSync(evidenceRoot)
      .filter((f) => statSync(join(evidenceRoot, f)).isDirectory())
      .sort();
    console.log(`证据完好:${evidenceRoot}(${entries.length} 组)`);
    for (const e of entries.slice(-3)) console.log(`  - ${e}`);
  } else {
    console.log(`证据目录(尚未有产物):${evidenceRoot}`);
  }
}

await main();
