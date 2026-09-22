// 请求处理上下文：DB + 事件 hub + seed 单用户/团队（02 §2 保形恒一行）。

import type { TeamRecord, UserRecord } from '@pacman/shared';
import type { Db } from './db/client.js';
import type { TeamStreamHub } from './services/events.js';
import type { MachineWakeHub, PendingUpload } from './services/machines.js';

export interface AppContext {
  db: Db;
  hub: TeamStreamHub;
  /** 机器 wake 通道（claim 长轮询等待者 + machine stream SSE，02 §5.4）。 */
  machineHub: MachineWakeHub;
  /** seed 单用户（自动登录，02 §2.1）。 */
  user: UserRecord;
  /** seed 团队（恒一行，02 §2.2）。 */
  team: TeamRecord;
  /** team stream ping 节奏（默认 ~15s，02 §1.2）。 */
  pingIntervalMs: number;
  /** claim 长轮询 hold（默认 = CLAIM_POLL_INTERVAL_MS ~75s，r3 §1.5 节奏）。 */
  claimHoldMs: number;
  /** upload-urls 一次性上传位（[设计]：self-host 无对象存储，内存态即可）。 */
  uploads: Map<string, PendingUpload>;
  /** 浏览器授权流 enroll 位（02 §5.2 路径一；web 侧接线归 M5）。 */
  enrollments: Map<string, { teamId: string; createdAt: number }>;
}
