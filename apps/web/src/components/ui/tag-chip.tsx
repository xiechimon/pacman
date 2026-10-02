// TagChip（XMON-14）：标签 chip——20px 高 pill、tag.color 底 inline、白字。
// 渲染面 = fresh 详情 meta 区、看板卡身份行、项目 issues 标签、看板类型筛选。
//
// 落点取舍（本票的裁决，依据写在本票评论）：**落在已有 components/ui/badge.tsx
// 上，不自建 registry 件**。registry 没有 `tag-chip` 同名件，而 Badge 的皮肤档
// 与本 chip 的几何正本几乎重合（h-5=20px / rounded-4xl=9999px / px-2=8px /
// font-medium / overflow-hidden+whitespace-nowrap），#423 第一片真域已有
// `res-pill` / `res-tag` → Badge 的先例。差异只剩四档（字号 12→11、行高、
// 上下内边距、宽度上限+省略号），本层用 cn 逐组改写，不新增皮肤件。
//
// 与 Chip 原语的边界（`ui/chip.tsx`，任务状态五态 + neutral）不变：
// Chip = 状态色族（token 对）；TagChip = 用户数据色（tag record color 位）。
//
// 尺寸正本 20px 有一个 per-face 例外：看板卡身份行（todo-card.tsx 的
// row-flush 覆写 h-4/leading-4/px-1.5）——16px 行盒里的 20px pill 是卡上
// 唯一溢出自己行盒的件（上下各 2px，且实底墨重压过标题），卡面收到与
// mark 齐平的 16px；本层其余消费面（详情 meta / 项目 issues / 筛选面板
// 选中行）容器都更高，仍走 20px 正本。几何钉：board-filter.spec 的任务卡
// 用例 + shadcn-primitives.spec 的 tag-chip 用例（两面各钉各的档）。
//
// 数据色走 inline style 而非 Tailwind 类：tag.color 是运行期记录字段，不是
// 设计 token，进不了类名编译面（既有行为原样保留）。

import type { TagRecord } from '@pacman/shared';
import { cn } from 'cn';
import { Badge } from './badge.js';

/** 渲染所需的最小投影（record 全形见 shared tagRecordSchema）。 */
export type TagChipData = Pick<TagRecord, 'id' | 'name' | 'color'>;

interface TagChipProps {
  tag: TagChipData;
  /** per-face 类名（fresh-tag-chip / todo-card-tag…），作 e2e 定位别名
   *  （README 规则 2）。 */
  className?: string;
}

export function TagChip({ tag, className }: TagChipProps) {
  return (
    <Badge
      className={cn(
        // registry Badge 档 → 仓内 chip 档（tailwind-merge 逐组覆盖）
        'tag-chip max-w-40 justify-start gap-0 py-0 text-[11px] leading-5 text-(--text-on-accent) text-ellipsis transition-none',
        className,
      )}
      style={{ backgroundColor: tag.color }}
    >
      {tag.name}
    </Badge>
  );
}
