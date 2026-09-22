// 请求处理上下文：DB + 事件 hub + seed 单用户/团队（02 §2 保形恒一行）。

import type { TeamRecord, UserRecord } from '@pacman/shared';
import type { Db } from './db/client.js';
import type { TeamStreamHub } from './services/events.js';

export interface AppContext {
  db: Db;
  hub: TeamStreamHub;
  /** seed 单用户（自动登录，02 §2.1）。 */
  user: UserRecord;
  /** seed 团队（恒一行，02 §2.2）。 */
  team: TeamRecord;
  /** team stream ping 节奏（默认 ~15s，02 §1.2）。 */
  pingIntervalMs: number;
}
