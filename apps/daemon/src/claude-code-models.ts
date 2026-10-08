// 本机 claude-code 上报（#707；#1050 扩二进制与凭据态）：daemon 读本机
// ~/.claude/settings.json，解析结果随 enroll/presence 上行，server 按机器
// 聚合进 model-sources。
// 纯槽位语义单源 = shared parseClaudeCodeModelSource（server 与 daemon 共吃）。
//
// #1050 起同一份载荷还带两个事实位：
//   - `bin`（claude-code-bin.ts 探测）——「这台机器装没装、装的在哪、什么
//     版本」。没有它，`installed` 只等于「配置文件在」，两个方向都会说谎；
//   - `auth`（claude-code-auth.ts 预检回填）——「这台机器登没登」。它不进
//     presence 节拍（30s 一次 spawn auth status 是纯浪费，登录态分钟级才变），
//     由起动时一次 + 每个 runtime 步前一次探到，缓存进下一次 presence。

import { readFileSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';
import {
  type ClaudeAuthStateWire,
  type ClaudeCodeReport,
  parseClaudeCodeModelSource,
} from '@pacman/shared';
import type { ClaudeCodeAuthProbe } from './claude-code-auth.js';
import type { ClaudeBinInfo } from './claude-code-bin.js';

/** #1050 附加事实位：`bin` 缺席/null = 探测说「没有」（PATH 里没有、不可
 *  执行、超时、无输出）——上报侧一律省略键，不让 null 与「老 daemon 没报」
 *  在 wire 上长得一样却又语义不同。 */
export interface ClaudeCodeReportExtra {
  bin?: ClaudeBinInfo | null;
  auth?: ClaudeCodeAuthProbe;
}

/** 预检三态 → wire 形状（#1050）。逐态只带该态有意义的位：logged-in 有
 *  method/provider，not-logged-in 只有 provider，unknown 只有 reason。 */
export function toWireAuth(probe: ClaudeCodeAuthProbe): ClaudeAuthStateWire {
  if (probe.state === 'logged-in') {
    return { state: probe.state, method: probe.method, provider: probe.provider };
  }
  if (probe.state === 'not-logged-in') {
    return { state: probe.state, provider: probe.provider };
  }
  return { state: probe.state, reason: probe.reason };
}

/** 读本机 settings.json + 附加位 → 上报载荷。文件缺失/不可读/非法一律落
 *  installed:false（parse 侧已覆盖），不抛——上报失败不阻断上线序列。 */
export function readClaudeCodeReport(
  homeDir: string = homedir(),
  extra: ClaudeCodeReportExtra = {},
): ClaudeCodeReport {
  let raw: string | undefined;
  try {
    raw = readFileSync(join(homeDir, '.claude', 'settings.json'), 'utf8');
  } catch {
    raw = undefined;
  }
  const source = parseClaudeCodeModelSource(raw ?? null, hostname());
  return {
    installed: source.installed,
    hostname: source.hostname,
    models: source.models,
    ...(extra.bin ? { bin: extra.bin } : {}),
    ...(extra.auth ? { auth: toWireAuth(extra.auth) } : {}),
  };
}
