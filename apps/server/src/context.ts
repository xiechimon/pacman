// 请求处理上下文：DB + 事件 hub + SecretBox + seed 单用户/团队（02 §2 保形恒一行）。

import type { SecretBox, TeamRecord, UserRecord } from '@pacman/shared';
import type { Db } from './db/client.js';
import type { TeamStreamHub } from './services/events.js';

export interface AppContext {
  db: Db;
  hub: TeamStreamHub;
  /** at-rest 加密缝（02 §8：provider key / secret 值密文进出唯一通道）。 */
  secretBox: SecretBox;
  /** seed 单用户（自动登录，02 §2.1）。 */
  user: UserRecord;
  /** seed 团队（恒一行，02 §2.2）。 */
  team: TeamRecord;
  /** team stream ping 节奏（默认 ~15s，02 §1.2）。 */
  pingIntervalMs: number;
  /** 托管 bare repo 存储根（数据根子目录，01 §4.2；`<reposDir>/<teamId>/<repoName>.git`）。 */
  reposDir: string;
}
