// Settings 缝（01 §3 五缝之一）的当前层：优先级 = 显式入参 > env > 默认值。
// .env / 配置文件层随部署面补齐；数据根路径 = 品牌位（01 §4.2 数据目录行，
// 形状：单一数据根 = DB 文件 + keyfile + bare repo 存储，备份 = 拷目录）。

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRAND,
  CLAIM_POLL_INTERVAL_MS,
  ENV_VARS,
  TEAM_STREAM_PING_INTERVAL_MS,
} from '@pacman/shared';
import { z } from 'zod';

export const serverConfigSchema = z.object({
  /** HTTP 监听端口（默认值 [设计]——官方端口不可观测）。 */
  port: z.number().int().min(0).max(65535),
  /** 单一数据根（DB 文件 + keyfile + bare repo 存储，01 §4.2）。 */
  dataDir: z.string(),
  /** SQLite DB 文件路径；`:memory:` = 内存库（测试面）。 */
  dbPath: z.string(),
  /** SecretBox keyfile 路径（01 §4.2：数据根内、首启生成 0600；文件名
   * `secretbox.key` [设计]，品牌槽归 #44）。 */
  keyfilePath: z.string(),
  /** team stream ping 心跳间隔；默认 ~15s（02 §1.2/r3 §8.1 实测节奏）。 */
  pingIntervalMs: z.number().int().positive(),
  /** claim 长轮询 hold；默认 ~75s（r3 §1.5 实测节奏 ~75–76s，wake SSE 提供
   * 低延迟派发，02 §5.4）。 */
  claimHoldMs: z.number().int().positive(),
  /** cron 调度循环 tick 间隔（02 §9.2 宿主自持；触发精度 = 分档最细 15min，
   * 默认 15s 远细于档位粒度 [设计]）。 */
  schedulerTickMs: z.number().int().positive(),
  /** SPA 静态同源托管根（02/A1，M5）：vite build 产物目录；null = 不托管
   * （纯 API 形态）。env `WEB_DIR` 覆写 [设计]；默认 = monorepo 布局
   * `apps/web/dist` 存在即托管。 */
  webDir: z.string().nullable(),
});
export type ServerConfig = z.infer<typeof serverConfigSchema>;

function envPort(): number | undefined {
  const raw = process.env.PORT;
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  return Number.isInteger(n) ? n : undefined;
}

/** SPA 产物默认位：monorepo 布局 `apps/web/dist`（本模块 = apps/server/src/
 * config.ts，向上两级到 apps/ 再进 web/dist）；不存在 = null（纯 API 形态）。 */
function defaultWebDir(): string | null {
  const here = resolve(fileURLToPath(import.meta.url), '../..'); // apps/server
  const candidate = join(here, '..', 'web', 'dist');
  return existsSync(join(candidate, 'index.html')) ? resolve(candidate) : null;
}

export function loadConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  // 用户主目录槽 = ENV_VARS.home（TDS_HOME，r3 §1.1 实测原名）；默认 ~/.tds。
  const home = process.env[ENV_VARS.home] ?? join(homedir(), BRAND.homeDirName);
  // 数据根子目录名 `server` [设计]（品牌位归 #44 一次性替换面）。
  const dataDir = join(home, 'server');
  const webDirEnv = process.env.WEB_DIR;
  return serverConfigSchema.parse({
    port: envPort() ?? 8787,
    dataDir,
    dbPath: join(dataDir, 'server.db'),
    keyfilePath: join(dataDir, 'secretbox.key'),
    pingIntervalMs: TEAM_STREAM_PING_INTERVAL_MS,
    claimHoldMs: CLAIM_POLL_INTERVAL_MS,
    schedulerTickMs: 15_000,
    webDir: webDirEnv !== undefined && webDirEnv !== '' ? resolve(webDirEnv) : defaultWebDir(),
    ...overrides,
  });
}

/** 托管 bare repo 存储根 = 数据根子目录 `repos` [设计]（01 §4.2 单一数据根：
 * DB 文件 + keyfile + bare repo 存储同根，备份 = 拷目录）。 */
export function reposDirOf(config: ServerConfig): string {
  return join(config.dataDir, 'repos');
}
