#!/usr/bin/env node
// 发布产物冒烟守 CI（#264，spec #260 W2 npm 首发 / 06 册 §11 W2-D5 口径）：
// pnpm pack 主包 @xiechimon/pacman → 仓外临时目录 npm 装 tarball → 裸 node
// （无 tsx）起 server → 断言 /api/user/me 200 + /app 200 + 数据根隔离
// （临时 PACMAN_HOME）。本地与 CI 同路径（根 package.json：pnpm pack-smoke）。
//
// 失败方式枚举固化为断言（#264 票面 / spec #260 Testing Decisions）：
//   F1 bundle 缺依赖（esbuild external 误伤）→ 裸 node 起不来/秒退
//   F2 web dist 未进包 / webDir 包内解析错 → /app 非 200
//   F3 migration 未进包 → 首启 migrate 崩
//   F4 tarball 混入 src/test（files 面回归）
//   F5 数据根不隔离（PACMAN_HOME 未被尊重 → 数据落 homedir 兜底位）
//
// 已知坑护栏（#261 车道实锤）：tarball 安装必须在仓外——仓内 npm 会向上爬
// 到 workspace 根解析 catalog: 协议报 EUNSUPPORTEDPROTOCOL；mktemp + HOME
// 覆盖双隔离。HTTP 探针走 Node fetch（undici 默认不读 env 代理，无 curl
// 需 --noproxy 的坑）。端口 8792-8799 = 冒烟专用段（5173/8787 主仓 dev 栈、
// 8390/8399 parity/e2e 车道、8791 verify 栈均不动；全占用即红，不杀别人）。

import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'); // 仓根（本 worktree）
const MAIN_REPO = resolve(ROOT, '../../..'); // 主仓 checkout（祖先坑双护栏）
const SERVER_FILTER = '@xiechimon/pacman';
const ENTRY_REL = 'node_modules/@xiechimon/pacman/dist/index.mjs';
const PORT_FIRST = 8792;
const PORT_LAST = 8799;
const ONLINE_MARKER = 'pacman-server online'; // index.ts 上线日志（pino msg）
const TAIL = 4000; // 失败时输出的日志尾长

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    timeout: 600_000,
    maxBuffer: 32 * 1024 * 1024,
    ...opts,
  });
  if (r.error || r.status !== 0) {
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    throw new Error(
      `${cmd} ${args.join(' ')} 失败（${r.error ?? `exit ${r.status}`}）:\n${out.slice(-TAIL)}`,
    );
  }
  return r;
}

/** 目录文件清单（相对路径，POSIX 分隔；drizzle 规模小，同步递归无碍）。 */
function listFiles(dir) {
  const out = [];
  const walk = (d, prefix) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p, `${prefix}${name}/`);
      else out.push(`${prefix}${name}`);
    }
  };
  walk(dir, '');
  return out;
}

/** tarball 内容清单断言（F2/F3/F4 + F1 清单面）。纯函数：可脱离打包链喂清单
 * 抽查红路径（import 本模块直调；直跑 guard 在，import 不触发主流程）。 */
export function assertManifest(files, srcDrizzle) {
  const prefix = 'package/';
  const entries = files.filter((f) => f !== '' && !f.endsWith('/'));
  for (const rel of ['package.json', 'dist/index.mjs', 'web/index.html']) {
    if (!entries.includes(`${prefix}${rel}`)) {
      throw new Error(`F2/F1：tarball 缺 ${prefix}${rel}（files 面或 prepack 链断裂）`);
    }
  }
  // web dist 不止 html 壳：hashed JS/CSS 至少各一（防空壳 dist 混过 /app）。
  for (const ext of ['js', 'css']) {
    const assetRe = new RegExp(`^package/web/assets/[^/]+\\.${ext}$`);
    if (!entries.some((f) => assetRe.test(f))) {
      throw new Error(`F2：tarball 缺 web/assets/*.${ext}（web dist 未整树进包）`);
    }
  }
  for (const f of entries) {
    if (f.startsWith(`${prefix}src/`) || f.startsWith(`${prefix}test/`)) {
      throw new Error(`F4：tarball 混入源/测试文件 ${f}（files 面回归）`);
    }
  }
  // migration 全量对齐：源 drizzle 集 == 包内集（journal + sql + meta 快照），
  // 防部分迁移进包（首启 migrate 崩的清单面前置）。两侧口径 = 相对 drizzle/
  // 的路径（源 listFiles 天然如此；tar 侧剥 package/drizzle/ 前缀对齐）。
  const tarDrizzle = entries
    .filter((f) => f.startsWith(`${prefix}drizzle/`))
    .map((f) => f.slice('package/drizzle/'.length));
  const missing = srcDrizzle.filter((f) => !tarDrizzle.includes(f));
  if (missing.length > 0) {
    throw new Error(`F3：tarball 缺 migration 文件：${missing.join(', ')}`);
  }
}

/** 试绑一次端口判空闲（listen 即释放，起点 8792 段；竞窗极小，真撞上 =
 * server 侧 EADDRINUSE 秒退走 F1 红路径，诊断信息足够）。绑法镜像被测
 * server：不指定 host = `::` 全网卡（IPv6 wildcard）——只探 127.0.0.1 会漏
 * 掉别的进程占的 `*:port`（v6 wildcard 与 v4 loopback 不互斥，8792 实测）。 */
function probePort(port) {
  return new Promise((resolvePort) => {
    const srv = createServer();
    srv.once('error', () => resolvePort(false));
    srv.once('listening', () => srv.close(() => resolvePort(true)));
    srv.listen(port);
  });
}

async function pickPort() {
  for (let p = PORT_FIRST; p <= PORT_LAST; p++) {
    if (await probePort(p)) return p;
  }
  throw new Error(`端口 ${PORT_FIRST}-${PORT_LAST} 全被监听（别的车道在用，不能杀）——稍后重跑`);
}

async function main() {
  const smoke = mkdtempSync(join(tmpdir(), 'pacman-pack-smoke.'));
  // 祖先坑护栏：安装目录必须在仓（含主仓）之外，否则 npm 向上爬 workspace 根。
  for (const repo of [ROOT, MAIN_REPO]) {
    if (smoke === repo || smoke.startsWith(`${repo}${sep}`)) {
      throw new Error(`临时目录 ${smoke} 落在仓库内——TMPDIR 被串改？安装隔离失效`);
    }
  }
  const packDir = join(smoke, 'pack');
  const installDir = join(smoke, 'install');
  const home = join(smoke, 'home'); // npm 缓存 + server homedir() 兜底全落此
  const pacmanHome = join(smoke, 'pacman-home'); // 显式数据根（票面口径）
  for (const d of [packDir, installDir, home, pacmanHome]) mkdirSync(d);

  let server = null;
  const chunks = [];
  const output = () => chunks.join('');
  let ok = false;
  try {
    // 1) pack（prepack 链：web build + esbuild bundle + stage-web）
    console.log('pack smoke: packing @xiechimon/pacman（prepack 含 web build）…');
    run('pnpm', ['--filter', SERVER_FILTER, 'pack', '--pack-destination', packDir], {
      cwd: ROOT,
      timeout: 300_000,
    });
    const tarballs = readdirSync(packDir).filter((f) => f.endsWith('.tgz'));
    if (tarballs.length !== 1) {
      throw new Error(`pack 产物异常：期望恰 1 个 tgz，实得 [${tarballs.join(', ')}]`);
    }
    const tarball = join(packDir, tarballs[0]);

    // 2) 清单断言（F2/F3/F4）
    assertManifest(
      run('tar', ['-tf', tarball]).stdout.split('\n'),
      listFiles(join(ROOT, 'apps/server/drizzle')),
    );
    console.log(`pack smoke: ${tarballs[0]} 清单面通过（dist/web/drizzle 齐，无 src/test）`);

    // 3) 仓外安装（npm + HOME 覆盖；tarball 路径用绝对路径防 cwd 漂移）
    writeFileSync(
      join(installDir, 'package.json'),
      `${JSON.stringify({ name: 'pacman-pack-smoke', private: true }, null, 2)}\n`,
    );
    console.log('pack smoke: 仓外 npm install tarball（隔离 HOME）…');
    run('npm', ['install', '--no-fund', '--no-audit', tarball], {
      cwd: installDir,
      env: { ...process.env, HOME: home },
    });
    const entry = join(installDir, ENTRY_REL);
    if (!existsSync(entry)) {
      throw new Error(`安装后缺入口 ${ENTRY_REL}（npm install 面）`);
    }

    // 4) 裸 node 起 server。env 只给最小四件：外层 shell 的 PACMAN_WEB_DIR
    //    等串扰会让断言 green-for-wrong-reason（webDir 被外部兜住）。
    const port = await pickPort();
    server = spawn(process.execPath, [entry], {
      cwd: installDir,
      env: { PATH: process.env.PATH, HOME: home, PORT: String(port), PACMAN_HOME: pacmanHome },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', (d) => chunks.push(String(d)));
    server.stderr.on('data', (d) => chunks.push(String(d)));
    const onlineTimeout = 60_000;
    const startedAt = Date.now();
    for (;;) {
      if (output().includes(ONLINE_MARKER)) break;
      if (server.exitCode !== null) {
        throw new Error(
          `F1：裸 node 秒退（exit ${server.exitCode}）——bundle 缺依赖或首启崩（对照 esbuild external 面 / F3 migration）：\n${output().slice(-TAIL)}`,
        );
      }
      if (Date.now() - startedAt > onlineTimeout) {
        throw new Error(`F1：${onlineTimeout}ms 未上线：\n${output().slice(-TAIL)}`);
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    // 5) HTTP 断言（Node fetch：undici 默认不吃 env 代理，无 --noproxy 坑）
    const base = `http://127.0.0.1:${port}`;
    const me = await fetch(`${base}/api/user/me`, { signal: AbortSignal.timeout(5000) });
    if (me.status !== 200) {
      throw new Error(`F3：/api/user/me → ${me.status}（seed/migrate 面）`);
    }
    const meBody = await me.json();
    if (typeof meBody?.id !== 'string' || meBody.id === '') {
      throw new Error(
        `F3：/api/user/me 200 但 seed 用户形状异常：${JSON.stringify(meBody).slice(0, 200)}`,
      );
    }
    const app = await fetch(`${base}/app`, { signal: AbortSignal.timeout(5000) });
    if (app.status !== 200) {
      throw new Error(`F2：/app → ${app.status}（web dist 未进包或 webDir 包内解析错）`);
    }
    const appBody = await app.text();
    if (!/<!doctype html/i.test(appBody)) {
      throw new Error('F2：/app 200 但非 HTML（webDir 解析错）');
    }
    console.log(`pack smoke: /api/user/me 200 + /app 200（port ${port}）`);

    // 6) 数据根隔离（F5）双向断言：正向 = 显式 PACMAN_HOME 下首启三件齐；
    // 反向 = 兜底位无泄漏——PACMAN_HOME 失效时代码落 HOME/.pacman（HOME 已被
    // 覆盖进冒烟沙箱，泄漏面可控可探测；.pacman = brand.ts homeDirName 单源位）。
    for (const rel of ['server/server.db', 'server/secretbox.key', 'server/repos']) {
      if (!existsSync(join(pacmanHome, rel))) {
        throw new Error(
          `F5：数据根缺 ${join(pacmanHome, rel)}（PACMAN_HOME 隔离失效或首启未建库）`,
        );
      }
    }
    if (existsSync(join(home, '.pacman'))) {
      throw new Error(
        `F5：兜底数据根 ${join(home, '.pacman')} 出现——PACMAN_HOME 未被尊重，数据写穿到 homedir 默认位`,
      );
    }
    console.log(`pack smoke: 数据根隔离于 ${pacmanHome}（三件齐，兜底位无泄漏）`);
    ok = true;
  } catch (err) {
    process.exitCode = 1;
    console.error(`pack smoke: FAIL — ${err instanceof Error ? err.message : err}`);
    console.error(`现场保留（排查后自删）：${smoke}`);
  } finally {
    // 优雅停机（SIGTERM → index.ts 走 graceful 收尾），5s 兜底 SIGKILL
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      await new Promise((res) => {
        const killer = setTimeout(() => server.kill('SIGKILL'), 5000);
        server.once('exit', () => {
          clearTimeout(killer);
          res();
        });
      });
      if (server.exitCode !== 0) {
        console.warn(`pack smoke: server 退出码 ${server.exitCode}（SIGTERM 收尾，不影响断言面）`);
      }
    }
  }
  if (ok) {
    rmSync(smoke, { recursive: true, force: true });
    console.log('pack smoke: all green');
  }
}

// 直跑才走主流程；被 import（红路径抽查 assertManifest）时不打包不起服务。
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
