// 本机 claude-code 模型上报（#707）：daemon 读本机 ~/.claude/settings.json，
// 解析结果随 enroll/presence 上行，server 按机器聚合进 model-sources。
// 纯槽位语义单源 = shared parseClaudeCodeModelSource（server 与 daemon 共吃）。

import { readFileSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';
import { type ClaudeCodeReport, parseClaudeCodeModelSource } from '@pacman/shared';

/** 读本机 settings.json → 上报载荷。文件缺失/不可读/非法一律落
 *  installed:false（parse 侧已覆盖），不抛——上报失败不阻断上线序列。 */
export function readClaudeCodeReport(homeDir: string = homedir()): ClaudeCodeReport {
  let raw: string | undefined;
  try {
    raw = readFileSync(join(homeDir, '.claude', 'settings.json'), 'utf8');
  } catch {
    raw = undefined;
  }
  const source = parseClaudeCodeModelSource(raw ?? null, hostname());
  return { installed: source.installed, hostname: source.hostname, models: source.models };
}
