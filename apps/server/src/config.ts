// Settings 缝（01 §3 五缝之一）的 M2a 最小层：优先级 = 显式入参 > env > 默认值。
// .env / 配置文件层与 zod 全量 schema 随 M2c 密钥面补齐；数据根路径 = 品牌位
// （01 §4.2 数据目录行，形状：单一数据根，备份 = 拷目录）。

import { homedir } from 'node:os';
import { join } from 'node:path';
import { BRAND, ENV_VARS, TEAM_STREAM_PING_INTERVAL_MS } from '@pacman/shared';
import { z } from 'zod';

export const serverConfigSchema = z.object({
  /** HTTP 监听端口（默认值 [设计]——官方端口不可观测）。 */
  port: z.number().int().min(0).max(65535),
  /** 单一数据根（DB 文件 + keyfile + bare repo 存储，01 §4.2）。 */
  dataDir: z.string(),
  /** SQLite DB 文件路径；`:memory:` = 内存库（测试面）。 */
  dbPath: z.string(),
  /** team stream ping 心跳间隔；默认 ~15s（02 §1.2/r3 §8.1 实测节奏）。 */
  pingIntervalMs: z.number().int().positive(),
});
export type ServerConfig = z.infer<typeof serverConfigSchema>;

function envPort(): number | undefined {
  const raw = process.env.PORT;
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  return Number.isInteger(n) ? n : undefined;
}

export function loadConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  // 用户主目录槽 = ENV_VARS.home（TDS_HOME，r3 §1.1 实测原名）；默认 ~/.tds。
  const home = process.env[ENV_VARS.home] ?? join(homedir(), BRAND.homeDirName);
  // 数据根子目录名 `server` [设计]（品牌位归 #44 一次性替换面）。
  const dataDir = join(home, 'server');
  return serverConfigSchema.parse({
    port: envPort() ?? 8787,
    dataDir,
    dbPath: join(dataDir, 'server.db'),
    pingIntervalMs: TEAM_STREAM_PING_INTERVAL_MS,
    ...overrides,
  });
}
