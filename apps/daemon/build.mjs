// esbuild 单文件 + node shebang（01 §4.3/S9：纯 JS npm 包，不复刻 6 平台
// 二进制）。M3a 口径：自有 src 打成单文件；pi 系（@earendil-works/*）保持
// external = 包依赖面（vendor 全内嵌的发行形态归发布票，包体对照 r3 §1.1）。

import { build } from 'esbuild';

await build({
  entryPoints: ['src/cli.ts'],
  outfile: 'dist/cli.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: [
    '@earendil-works/pi-ai',
    '@earendil-works/pi-coding-agent',
    '@earendil-works/pi-agent-core',
  ],
  banner: { js: '#!/usr/bin/env node' },
  sourcemap: true,
  logLevel: 'info',
});
