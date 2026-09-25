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
   * （纯 API 形态）。env 覆写位 = ENV_VARS.webDir（品牌槽单源，02 §5.8）；
   * 默认 = monorepo 布局 `apps/web/dist` 存在即托管。 */
  webDir: z.string().nullable(),
  /** OAuth App client 凭证对（#231 握手面；env 双件齐 = 配置，双缺 = null
   *  未配置——authorize 走 400 提示；只配一件 = 启动期报错不静默）。 */
  githubOauth: z.object({ clientId: z.string(), clientSecret: z.string() }).nullable(),
  /** 可选 token 鉴权（#251，06 册 D8）：env ENV_VARS.token 设 = 开、未设/
   *  空串 = null 关（默认，行为与现状一致）。 */
  authToken: z.string().nullable(),
  /** HTTP 绑定主机（env HOST，PORT 同款通用基建位不进品牌槽）；null = 默认
   *  绑定（node 缺省 = 全接口）。显式 `0.0.0.0`/`::` 且鉴权关 → 启动 WARN
   *  （insecureBindWarning，#251 验收面 6）。 */
  host: z.string().nullable(),
});
export type ServerConfig = z.infer<typeof serverConfigSchema>;

function envPort(): number | undefined {
  const raw = process.env.PORT;
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  return Number.isInteger(n) ? n : undefined;
}

/** 非空 env 串读取（空串 = 未设同律，PORT/webDir 既有纪律）。 */
function envStr(name: string): string | null {
  const raw = process.env[name];
  return raw !== undefined && raw !== '' ? raw : null;
}

/** 全网卡绑定主机名族（显式配置命中 + 鉴权关 = 启动 WARN 判定面）。 */
const ANY_INTERFACE_HOSTS = new Set(['0.0.0.0', '::', '::0']);

/** SPA 产物默认位：monorepo 布局 `apps/web/dist`（本模块 = apps/server/src/
 * config.ts，向上两级到 apps/ 再进 web/dist）；不存在 = null（纯 API 形态）。 */
function defaultWebDir(): string | null {
  const here = resolve(fileURLToPath(import.meta.url), '../..'); // apps/server
  const candidate = join(here, '..', 'web', 'dist');
  return existsSync(join(candidate, 'index.html')) ? resolve(candidate) : null;
}

export function loadConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  // 用户主目录槽 = ENV_VARS.home（PACMAN_HOME；r3 §1.1 实测原名 TDS_HOME）；默认 ~/.pacman。
  const home = process.env[ENV_VARS.home] ?? join(homedir(), BRAND.homeDirName);
  // 数据根子目录名 `server` [设计]（品牌位归 #44 一次性替换面）。
  const dataDir = join(home, 'server');
  const webDirEnv = process.env[ENV_VARS.webDir];
  const oauthId = process.env[ENV_VARS.githubOauthClientId] || undefined;
  const oauthSecret = process.env[ENV_VARS.githubOauthClientSecret] || undefined;
  if ((oauthId === undefined) !== (oauthSecret === undefined)) {
    throw new Error(
      `oauth client half-configured: ${ENV_VARS.githubOauthClientId} 与 ${ENV_VARS.githubOauthClientSecret} 必须同设`,
    );
  }
  return serverConfigSchema.parse({
    port: envPort() ?? 8787,
    dataDir,
    dbPath: join(dataDir, 'server.db'),
    keyfilePath: join(dataDir, 'secretbox.key'),
    pingIntervalMs: TEAM_STREAM_PING_INTERVAL_MS,
    claimHoldMs: CLAIM_POLL_INTERVAL_MS,
    schedulerTickMs: 15_000,
    webDir: webDirEnv !== undefined && webDirEnv !== '' ? resolve(webDirEnv) : defaultWebDir(),
    githubOauth:
      oauthId !== undefined && oauthSecret !== undefined
        ? { clientId: oauthId, clientSecret: oauthSecret }
        : null,
    authToken: envStr(ENV_VARS.token),
    host: envStr('HOST'),
    ...overrides,
  });
}

/** `0.0.0.0` 裸绑护栏（#251，06 册 D8）：显式全网卡绑定且鉴权未启用 →
 * 返回警示文案（入口 logger.warn 落日志——WARN 级别由 logger 担，文案不重复
 * 前缀；不阻断启动）；默认绑定（host 未设）、回环绑定或鉴权已开 → null。
 * 纯函数 = 验收面 10 测试缝。 */
export function insecureBindWarning(config: ServerConfig): string | null {
  if (config.authToken !== null) return null;
  if (config.host === null || !ANY_INTERFACE_HOSTS.has(config.host)) return null;
  return `绑定 ${config.host}（全网卡可达）且 ${ENV_VARS.token} 未设——API 面裸奔于所有网络接口；设 ${ENV_VARS.token}=<token> 开启 Bearer 鉴权，或 HOST=127.0.0.1 收回本机`;
}

/** 入口接线（index.ts 启动段唯一调用点）：警示行经 logger.warn 落日志。
 * 抽函数 = 接线可钉（stub logger 用例防「判定在、发射丢」回归，spec #247
 * AC6）；pino Logger 结构兼容本最小口。 */
export function warnInsecureBind(logger: { warn(msg: string): void }, config: ServerConfig): void {
  const message = insecureBindWarning(config);
  if (message !== null) logger.warn(message);
}

/** 托管 bare repo 存储根 = 数据根子目录 `repos` [设计]（01 §4.2 单一数据根：
 * DB 文件 + keyfile + bare repo 存储同根，备份 = 拷目录）。 */
export function reposDirOf(config: ServerConfig): string {
  return join(config.dataDir, 'repos');
}
