// Agent 概览的「状态行」（B4/XMON-18）。原版形 `active · 创建于 2026/9/19`
// （r3 §4）：`status` 是 wire 数据层原值（不译），日期分句是 UI 文案（走 t）。
//
// 时间区钉 +08:00（与 detail/fresh-block 的创建时间戳同一理由：采集会话在
// 该区跑，钉死才让 fixture 输出不随宿主 TZ 漂移）。
//
// `createdAt` 为 null = 该 Agent 建于本列落地之前，真值当年没存、仓内没有可
// 回填的第二来源——此时整条分句不出（少一条信息），不拿占位时间戳顶
// （`0` 与真值同形，渲染出来是 1970/1/1，等于把占位当真值播）。

import type { TFunc } from '../i18n/translate.js';

/** 日期形 `2026/9/19`（r3 §4 截图逐字：zh-CN numeric 三档，月/日不补零）。 */
export function createdOn(ms: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(ms);
}

export function agentStatusLine(status: string, createdAt: number | null, t: TFunc): string {
  if (createdAt === null) return status;
  return `${status} · ${t('创建于 {date}', { date: createdOn(createdAt) })}`;
}
