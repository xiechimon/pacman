// daemon.log 行形（01 §4.3：pino 自定义输出行形；日志形状 = 平价面，r3 实测
// 词表）。行前缀词表 = DAEMON_LOG_PREFIXES 六件（supervisor/machine/step/
// workspace/recover/wake，02 §5.3）；上线序列/步骤生命周期 canon 行为无前缀
// 原文（r3 §1.5 实测样本族）。行格式 `<msg>` 原样落盘 [设计]（时间戳位未采）。

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pino from 'pino';
import { DAEMON_LOG_PREFIXES, type DaemonLogPrefix } from './log-vocab.js';

export interface DaemonLogger {
  /** canon 原文行（无前缀）：`claim step=<id>`、`Online (…)` 族。 */
  raw(msg: string): void;
  /** 前缀行 `[prefix] msg`（02 §5.3 词表六件）。 */
  prefixed(prefix: DaemonLogPrefix, msg: string): void;
  supervisor(msg: string): void;
  machine(msg: string): void;
  step(msg: string): void;
  workspace(msg: string): void;
  recover(msg: string): void;
  wake(msg: string): void;
}

export function isLogPrefix(value: string): value is DaemonLogPrefix {
  return (DAEMON_LOG_PREFIXES as readonly string[]).includes(value);
}

interface LineFields {
  msg?: string;
  prefix?: string;
}

export function formatLine(fields: LineFields): string {
  const msg = fields.msg ?? '';
  if (fields.prefix && isLogPrefix(fields.prefix)) return `[${fields.prefix}] ${msg}`;
  return msg;
}

export function createDaemonLogger(opts: {
  logFile?: string;
  stdout?: boolean;
  level?: string;
}): DaemonLogger {
  if (opts.logFile) mkdirSync(dirname(opts.logFile), { recursive: true });
  const sink = {
    write(line: string): void {
      let fields: LineFields;
      try {
        fields = JSON.parse(line) as LineFields;
      } catch {
        fields = { msg: line.trimEnd() };
      }
      const text = `${formatLine(fields)}\n`;
      if (opts.logFile) appendFileSync(opts.logFile, text);
      if (opts.stdout) process.stdout.write(text);
    },
  };
  const log = pino({ level: opts.level ?? 'info', base: undefined }, sink);

  const prefixed = (prefix: DaemonLogPrefix, msg: string) => {
    log.info({ prefix }, msg);
  };
  return {
    raw: (msg) => log.info(msg),
    prefixed,
    supervisor: (msg) => prefixed('supervisor', msg),
    machine: (msg) => prefixed('machine', msg),
    step: (msg) => prefixed('step', msg),
    workspace: (msg) => prefixed('workspace', msg),
    recover: (msg) => prefixed('recover', msg),
    wake: (msg) => prefixed('wake', msg),
  };
}
