// per-step 凭证持有面（02 §5.4/§8 运行时层：`token/{stepId}` 下发，daemon
// 内存持有、不落盘常驻）。relay 工具名对照 = `push_credential`（r5 §3.1/
// RELAY_TOOLS：官方经服务端 relay 工具下发 git 凭证；复刻 = daemon 主动拉取
// token 端点的等价物，04 附录 A「自定等价物（形状对即可）」口径）。
// 纪律：本模块是凭证在 daemon 内的唯一驻留位——不写日志、不进 journal、
// 不进任何文件；步收尾即 clear()（GC 面前不留引用）。

import type { GitCredentials, MachineTokenResponse, ProviderConfig } from '@pacman/shared';

export interface StepCredentials {
  /** 模型凭证（apiKey 内存态 → backend setRuntimeApiKey，02 §8）。 */
  provider: ProviderConfig | null;
  /** 团队 Secret → 任务 shell 环境变量（02 §8；注入 pi 会话的授权面归 M4
   * Agent 权限票，本层持有下发值）。 */
  env: Record<string, string>;
  /** 托管 repo git 凭证（02 §3 凭证纪律：仅 per-step 注入——手动 fetch 无
   * 凭证失败；注入形 = git.ts gitCredentialEnv，argv/磁盘均不落）。 */
  git: GitCredentials | null;
}

/** push_credential 对照位：token/{stepId} 响应 → 步内内存凭证束。 */
export function pushCredential(token: MachineTokenResponse): StepCredentials {
  return { provider: token.provider, env: token.env, git: token.git };
}

/** 步收尾清空（引用置空；明文串本身随 GC）。 */
export function clearCredentials(creds: StepCredentials): void {
  creds.provider = null;
  creds.env = {};
  creds.git = null;
}
