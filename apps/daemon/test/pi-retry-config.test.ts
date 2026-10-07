// #926 retry 面显式化 + 护栏常量与设置一致（票面验收 1 与 3）。
// pi 包不在测试面出现——缝纪律（断言经 pi.ts / runner.ts 的导出面，不直接 import
// @earendil-works/*）。失败方式先于实现固化：
//   1. retry 面没接进会话设置：buildPiSessionSettings() 不含显式 retry 块（吃了 pi
//      内建默认）→ 断言 retry 就是 PI_RETRY_SETTINGS 那一个对象（引用同一性，挡复制漂移）。
//   2. 护栏与设置脱钩：RETRY_STORM_MAX 与 pi 会话设置里的 maxRetries 不是同源 →
//      断言两者相等，且都等于 PI_RETRY_SETTINGS.maxRetries（单一旋钮驱动两面）。
//   3. 设置是摆设 / 值错：显式值与 docs/settings.md §Network and retries 的口径不符 →
//      用独立来源（docs 字面值）钉 enabled/maxRetries/baseDelayMs，不是自证。

import { describe, expect, test } from 'vitest';
import { buildPiSessionSettings } from '../src/backend/pi.js';
import { PI_RETRY_SETTINGS } from '../src/backend/pi-retry.js';
import { RETRY_STORM_MAX } from '../src/runner.js';

describe('retry 面显式接入会话设置（#926 验收 1）', () => {
  test('buildPiSessionSettings 携显式 retry 块，且就是 PI_RETRY_SETTINGS 那一个对象', () => {
    const settings = buildPiSessionSettings();
    // 引用同一性：会话设置里的 retry 不是等价副本，而是单源常量本身——改一处即改这里。
    expect(settings.retry).toBe(PI_RETRY_SETTINGS);
    // compaction 面零回归（既有行为）。
    expect(settings.compaction).toEqual({ enabled: true });
  });

  test('显式值对齐 docs/settings.md §Network and retries（独立来源，非自证）', () => {
    // 这些字面值取自 pi docs 的默认列——显式声明必须与文档口径一致，写死以防漂移。
    expect(PI_RETRY_SETTINGS.enabled).toBe(true);
    expect(PI_RETRY_SETTINGS.maxRetries).toBe(3);
    expect(PI_RETRY_SETTINGS.baseDelayMs).toBe(2000);
    expect(PI_RETRY_SETTINGS.maxAgentDelayMs).toBe(60000);
    // provider.maxRetries 显式钉 0（docs 建议：别抢在 pi 处理 quota/usage-limit 之前）。
    expect(PI_RETRY_SETTINGS.provider.maxRetries).toBe(0);
  });
});

describe('护栏常量与设置一致（#926 验收 3）', () => {
  test('RETRY_STORM_MAX 与 pi 会话 retry.maxRetries 同源，不脱钩', () => {
    // 单一旋钮（PI_RETRY_SETTINGS.maxRetries）同时驱动 pi 的重试预算与 runner 的
    // 零进展护栏——两条独立访问路径必须收敛到同一个值。
    expect(RETRY_STORM_MAX).toBe(buildPiSessionSettings().retry.maxRetries);
    expect(RETRY_STORM_MAX).toBe(PI_RETRY_SETTINGS.maxRetries);
  });
});
