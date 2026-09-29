// TagChip 原语（#309，r9 96/100）：标签 chip——20px 高 pill、tag.color 底
// inline、白字。渲染面 = fresh 详情 meta 区（spec 15 #394 起新建对话框
// 无标签面,ADR 0002 D5）；per-face 类名（fresh-tag-chip）由调用面
// className 传入，作 e2e 定位别名（README 规则 2）。
// 与 Chip 原语的边界：Chip = 任务状态五态 + neutral（token 色族对）；
// TagChip = 用户数据色（tag record color 位），不进状态色族。

import type { TagRecord } from '@pacman/shared';
import './tag-chip.css';

/** 渲染所需的最小投影（record 全形见 shared tagRecordSchema）。 */
export type TagChipData = Pick<TagRecord, 'id' | 'name' | 'color'>;

interface TagChipProps {
  tag: TagChipData;
  className?: string;
}

export function TagChip({ tag, className }: TagChipProps) {
  return (
    <span
      className={className != null ? `tag-chip ${className}` : 'tag-chip'}
      style={{ backgroundColor: tag.color }}
    >
      {tag.name}
    </span>
  );
}
