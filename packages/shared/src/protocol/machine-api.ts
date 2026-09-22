// 机器面协议——02 §5.4/§6.1（「机器面 13 端点见 §5」）+ r3 §1.6（bundle 静态
// 提取，/api/machine/* 全词表）。HTTP 动词未逐一观测 [推断]（claim 为长轮询、
// stream 为 SSE 有实证）；路径词表即契约，不改形状（02 §5.8 尾注）。

export interface MachineEndpoint {
  readonly path: string;
  readonly note?: string;
}

export const MACHINE_ENDPOINTS: readonly MachineEndpoint[] = [
  { path: '/api/machine/enroll', note: '注册（02 §5.2）' },
  { path: '/api/machine/enroll/start', note: '浏览器授权流（02 §5.2 路径一）' },
  { path: '/api/machine/enroll/poll' },
  { path: '/api/machine/me', note: '机器自述' },
  { path: '/api/machine/presence', note: '心跳（断网时并行失败，进程不退出，r3 §1.5）' },
  { path: '/api/machine/recover', note: '步 journal 恢复（细节 [推断]，02 §5.4/§11）' },
  { path: '/api/machine/tasks/claim', note: '长轮询领取（~75–76s 节奏，r3 §1.5）' },
  { path: '/api/machine/stream', note: 'wake SSE 低延迟派发（02 §1.2/§5.4）' },
  { path: '/api/machine/heartbeat/{stepId}', note: '步骤 journal 续活（02 §5.4）' },
  { path: '/api/machine/tool/{stepId}', note: '工具调用回传；remoteTools relay 同径（r5 §3.1）' },
  {
    path: '/api/machine/token/{stepId}',
    note: 'per-step 凭证下发（模型 key + 托管 repo git 凭证），不落盘常驻 [推断]（02 §5.4/§8）',
  },
  { path: '/api/machine/upload-urls/{stepId}', note: '预签名产物上传：transcript/产物（r3 §1.6）' },
  { path: '/api/machine/done/{stepId}', note: '步骤收尾' },
];

/** claim 长轮询节奏（r3 §1.5 实测 ~75–76s）。 */
export const CLAIM_POLL_INTERVAL_MS = 75_000;

/** 断网 claim 指数退避封顶（r3 §1.5）。 */
export const CLAIM_BACKOFF_CAP_MS = 30_000;

/** remoteTools relay 读工具重试预算与超时（r5 §3.1 bundle 提取：
 * RETRY_DELAYS_MS=[500,2000]、remoteTool:10s；读工具 replaySafe）。 */
export const REMOTE_TOOL_RETRY_DELAYS_MS = [500, 2000] as const;
export const REMOTE_TOOL_TIMEOUT_MS = 10_000;

/** 注册两条路径（02 §5.2，r3 §1.2 实测）：
 * 1. 浏览器授权：start 无参 → 开登录页授权团队（enroll/start + enroll/poll）。
 * 2. key 非交互（云服务器文案路径）：--api-key --team；「添加机器」弹窗底部
 *    展开命令 + 「获取 API key →」跳 api-keys 页（r2 11b 文案）。
 * logout 只 Forget 本机；服务端机器记录保留，重注册复用同一 machineId
 * （r3 实测 + [推断] 按 key/team 认机器）。 */
export const ENROLL_PATHS = ['browser', 'api-key'] as const;

/** 上线序列 canon 行（02 §5.4/r3 §1.5 daemon.log 实测；maxConcurrent 行取
 * r3 §1.5 一手原文 `null -> 3`，02 §5.4 引文同步回写——02 §11 纪律）。 */
export const ONLINE_SEQUENCE_CANON = [
  'Loading pi runtime…',
  'Online (machineId=…); polling <url>',
  'Idle-sleep prevention active (caffeinate)',
  '[recover] no pending steps found',
  'maxConcurrent changed null -> 3',
  '[wake] push channel connected',
] as const;
