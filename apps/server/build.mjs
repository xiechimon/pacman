// esbuild 单文件 + node shebang + web dist 内嵌（06 §11 W2-D2：JS 依赖全打入；
// 外置 = better-sqlite3（native 编译物）+ pino / pino-pretty（transport 经
// worker 线程按模块名在线解析，无法内联）。承 daemon build.mjs 先例（01 §4.3）。
// 包内形态：dist/index.mjs（bin）+ web/（拷入的 vite 生产产物，#58 gate =
// scenario 盲构建）+ drizzle/（migration 进 repo，pack 原位收录）。

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: ['better-sqlite3', 'pino', 'pino-pretty'],
  banner: { js: '#!/usr/bin/env node' },
  sourcemap: true,
  logLevel: 'info',
});

// web dist 内嵌（包内 web/ 形态 = config.defaultWebDir 的包内探测位）。
// 生产 vite build（不带 --mode parity——那是冒烟/对拍 harness 的形态）。
const web = spawnSync('pnpm', ['--filter', '@pacman/web', 'build'], { stdio: 'inherit' });
if (web.status !== 0) process.exit(web.status ?? 1);
rmSync('web', { recursive: true, force: true });
cpSync('../web/dist', 'web', { recursive: true });
if (!existsSync('web/index.html')) {
  console.error('build failed: web dist missing index.html');
  process.exit(1);
}
