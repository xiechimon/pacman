// Agent 状态行（B4/XMON-18）：原版形 `active · 创建于 2026/9/19`（r3 §4 概览
// tab 实测），一手时间戳 = r5 raw `chief-record-testA.json` 的
// `agentActor.createdAt: 1789786840183`。
//
// 每条断言钉一个失败方式：
//   ① 有值不渲染日期分句 —— 读面拿到 createdAt 也不显示（列白加）；
//   ② 未知（null）渲染成占位日期 —— `创建于 1970/1/1` 是把占位当真值播；
//   ③ 日期形与截图不一致 —— 不是 `2026/9/19`（月/日不补零、斜杠分隔）；
//   ④ en 面漏了这条键 —— 语言切到 en 时整行回落中文；
//   ⑤ 字段整个缺席（undefined）漏过守卫 —— 读面响应不经 zod 运行时校验
//     （api/client.ts 是 `as T`），字段缺席时就是 undefined；漏过去 formatter
//     把 undefined 当「现在」，渲染出**今天**的日期（实测 `2026/10/1`）——
//     与 ② 同一类错，只是更隐蔽。

import { describe, expect, it } from 'vitest';
import { EN } from '../src/i18n/en.js';
import { translate, type TVars } from '../src/i18n/translate.js';
import { agentStatusLine, createdOn } from '../src/routes/agent-status-line.js';

/** r5 raw 一手值（agentActor.createdAt）。 */
const TS = 1789786840183;

const zh = (source: string, vars?: TVars) => translate('zh', EN, source, vars);
const en = (source: string, vars?: TVars) => translate('en', EN, source, vars);

describe('createdOn', () => {
  it('渲染 r3 §4 截图逐字形 2026/9/19（月/日不补零）', () => {
    expect(createdOn(TS)).toBe('2026/9/19');
  });
});

describe('agentStatusLine', () => {
  it('有值时 = `status · 创建于 日期`（r3 §4 原样）', () => {
    expect(agentStatusLine('active', TS, zh)).toBe('active · 创建于 2026/9/19');
  });

  it('未知（null）= 只有 status，不出分句、更不出占位日期', () => {
    expect(agentStatusLine('active', null, zh)).toBe('active');
  });

  it('字段整个缺席（undefined）= 同样只有 status，不落「今天」', () => {
    // 显式传 undefined：读面响应未经 zod 校验时字段缺席的真实形状。
    expect(agentStatusLine('active', undefined, zh)).toBe('active');
  });

  it('en 面不回落中文', () => {
    expect(agentStatusLine('active', TS, en)).toBe('active · Created 2026/9/19');
  });
});