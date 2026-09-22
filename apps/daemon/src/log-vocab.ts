// 日志前缀词表本地别名（单源 = shared DAEMON_LOG_PREFIXES，02 §5.3）。

import { DAEMON_LOG_PREFIXES as PREFIXES } from '@pacman/shared';

export const DAEMON_LOG_PREFIXES = PREFIXES;
export type DaemonLogPrefix = (typeof PREFIXES)[number];
