// esbuild 单文件 + node shebang（01 §4.3/S9：纯 JS npm 包，不复刻 6 平台
// 二进制）。M3a 口径：自有 src 打成单文件；pi 系（@earendil-works/*）保持
// external = 包依赖面（vendor 全内嵌的发行形态归发布票，包体对照 r3 §1.1）。

import { build } from 'esbuild';
import { EXTERNALS } from './externals.mjs';

// banner 三件：shebang（bin 直跑）+ pino CJS 动态 require 垫片。pino.js 顶层
// `require('node:os')` 经 esbuild CJS 包装后走 __require 桩（运行期动态解析，
// 不静态折叠），ESM 无 require 即抛「Dynamic require … not supported」——桩的
// 兜底是 `typeof require !== "undefined"`，故注入 createRequire 令其落到真
// require（主包 #261 车道同款修法，实测）。
const banner = [
  '#!/usr/bin/env node',
  "import { createRequire } from 'node:module';",
  'const require = createRequire(import.meta.url);',
].join('\n');

await build({
  entryPoints: ['src/cli.ts'],
  outfile: 'dist/cli.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: EXTERNALS,
  banner: { js: banner },
  sourcemap: true,
  logLevel: 'info',
});
