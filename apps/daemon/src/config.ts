// Settings 缝（01 §3 五缝之一）的 daemon 最小层：优先级 = 显式入参 > env >
// 默认值（承旧 Settings 纪律；.env/配置文件层与 zod 全量 schema 随后续票）。
// env 词表 = ENV_VARS 五件（r3 §1.1 实测 TDS_*；品牌槽 brand.ts）。

import { existsSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  BRAND,
  ENV_VARS,
  MAX_CONCURRENT_DEFAULT,
  WORKSPACES_DIR_GUARD_CANON,
} from '@pacman/shared';
import { z } from 'zod';

export const daemonConfigSchema = z.object({
  serverUrl: z.string(),
  apiKey: z.string().optional(),
  teamId: z.string().optional(),
  /** --name 默认 hostname（r3 §1.1）。 */
  name: z.string(),
  /** TDS_HOME 默认 ~/.tds（02 §5.3 布局根）。 */
  home: z.string(),
  /** 持久工作区根（02 §5.5 baseRepo/任务目录的父层）。 */
  workspacesDir: z.string(),
  foreground: z.boolean(),
  /** 并发上限默认 3（02 §2.5 机器配置默认值，非付费件）。 */
  maxConcurrent: z.number().int().positive(),
});
export type DaemonConfig = z.infer<typeof daemonConfigSchema>;

export interface DaemonConfigInput {
  serverUrl?: string;
  apiKey?: string;
  teamId?: string;
  name?: string;
  home?: string;
  workspacesDir?: string;
  foreground?: boolean;
  maxConcurrent?: number;
}

/** 默认 server URL [设计]（官方默认不可观测——todos.dev 云常量；复刻
 * self-host 本机默认 = server 默认端口，01 §4.2）。 */
export const DEFAULT_SERVER_URL = 'http://127.0.0.1:8787';

export class WorkspacesDirError extends Error {
  constructor(dir: string) {
    // 护栏 canon（r3 §1.1 help 原话语义，WORKSPACES_DIR_GUARD_CANON）：
    // 父目录必须已存在，防误落启动盘。
    super(`workspaces dir parent does not exist: ${dirname(dir)} (${WORKSPACES_DIR_GUARD_CANON})`);
    this.name = 'WorkspacesDirError';
  }
}

export function loadDaemonConfig(
  input: DaemonConfigInput = {},
  env: NodeJS.ProcessEnv = process.env,
): DaemonConfig {
  const home = resolve(input.home ?? env[ENV_VARS.home] ?? join(homedir(), BRAND.homeDirName));
  const workspacesDir = resolve(
    input.workspacesDir ?? env[ENV_VARS.workspacesDir] ?? join(home, 'workspaces'),
  );
  // 显式/env 指定的 workspaces-dir：父目录必须已存在（一次性覆盖不持久，
  // r3 §1.1 TDS_WORKSPACES_DIR 语义）。
  const explicit = input.workspacesDir !== undefined || env[ENV_VARS.workspacesDir] !== undefined;
  if (explicit && !existsSync(dirname(workspacesDir))) {
    throw new WorkspacesDirError(workspacesDir);
  }
  const apiKey = input.apiKey ?? env[ENV_VARS.apiKey];
  const teamId = input.teamId ?? env[ENV_VARS.team];
  const serverUrl = input.serverUrl ?? env[ENV_VARS.server] ?? DEFAULT_SERVER_URL;
  return daemonConfigSchema.parse({
    serverUrl: serverUrl.replace(/\/$/, ''),
    ...(apiKey !== undefined ? { apiKey } : {}),
    ...(teamId !== undefined ? { teamId } : {}),
    name: input.name ?? hostname(),
    home,
    workspacesDir,
    foreground: input.foreground ?? false,
    maxConcurrent: input.maxConcurrent ?? MAX_CONCURRENT_DEFAULT,
  });
}
