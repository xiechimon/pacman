// 版本串单源钉（首发 0.1.1 实测坑：--version 报 0.1.0——版本串硬编码于源码
// 未随 manifest bump。契约 = DAEMON_VERSION 恒等于 package.json version）。

import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
import { DAEMON_VERSION } from '../src/version.js';

const requireManifest = createRequire(import.meta.url);

describe('DAEMON_VERSION', () => {
  test('与 manifest version 一致（禁止再硬编码）', () => {
    const pkg = requireManifest('../package.json') as { version: string };
    expect(DAEMON_VERSION).toBe(pkg.version);
  });
});
