// 看板类型筛选（#403 建轴，#445 收进顶栏右侧无底色 popover 钮）：固定
// 6 词表（shared FIXED_TAGS 单源）多选。设计裁决：
//   - 多选 = OR 并集（「找某类活」直觉；AND 在「每任务至多 1 个标签」的
//     ADR 0002 D4 口径下恒退化为单选，无意义）；
//   - 无标签任务恒可见——筛选是附加收窄，不产生「任务凭空消失」的意外；
//   - 筛选态进 URL query（?tags=bug,docs，replace 写回不刷历史），
//     刷新/分享不丢；清空即删参回全量。
// #445 形态：原顶栏左侧 chip 组撤除（左侧让位仓库筛选，repo-filter.tsx），
// 词表收进 anchored popover——弹层家族律（#67/#127：OverlayMount +
// ClickCatcher + Esc；prj-tasks-menu 配方），多选点选**保持开**（点选即关
// 会把多选取缔成单选）。选中态行内渲染 TagChip（词表配色实底，视觉与详情
// fresh chips 字节同源）；未选 = 素文本行。
// 消费面：TypeFilterButton 由 board.tsx（BoardSurface 顶栏右动作区）渲染；
// parseTagParam / matchesTagFilter / cardTag 由 board-page.tsx 与测试面消费。
// per-face 类名（board-type-filter / type-filter-popover /
// type-filter-option / board-filter-empty / board-filter-clear）= e2e 定位
// 别名（README 规则 2）。

import { FIXED_TAGS } from '@pacman/shared';
import { useState } from 'react';
import { Button } from '../components/ui/button.js';
import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown } from '../icons/index.js';
import { ClickCatcher, OverlayMount, useEscapeClose } from '../overlays/dismiss.js';
import { TagChip, type TagChipData } from '../ui/tag-chip.js';

/** URL 参 → 选中词表名集。词表外名/重复名静默丢弃，返回序 = FIXED_TAGS
 *  规范序（URL 确定性与点击序无关，同选集恒同 URL）。 */
export function parseTagParam(raw: string | null): string[] {
  if (raw == null || raw === '') return [];
  const seen = new Set(raw.split(','));
  return FIXED_TAGS.map((t) => t.name).filter((n) => seen.has(n));
}

/** 命中判定：空选中集 = 全量；无标签恒可见（裁决）；否则 tagIds 解析名
 *  与选中集求交（OR）。无法解析的 tagId（脏数据/首载未就绪）不命中也
 *  不误配——按可解析的名判。 */
export function matchesTagFilter(
  todo: TodoRecord,
  selected: ReadonlySet<string>,
  nameById: ReadonlyMap<string, string>,
): boolean {
  if (selected.size === 0) return true;
  if (todo.tagIds.length === 0) return true;
  return todo.tagIds.some((id) => {
    const name = nameById.get(id);
    return name != null && selected.has(name);
  });
}

/** #445 卡片标签解析：tagIds → 首个可解析的标签行（name+color 供 TagChip
 *  渲染）。每卡至多 1 个 = **渲染上限**而非数据假设（ADR 0005 Premortem
 *  护栏：github 形态多标签时版面问题交给卡片渲染的上限，不交给词表）；
 *  从 per-project tag 记录解析而非拿 FIXED_TAGS 按 name 硬配——label 镜像
 *  入库后同一路径自动正确。脏/未就绪 id 跳过，全不可解析 = null（卡不
 *  渲染占位）。 */
export function cardTag(
  todo: TodoRecord,
  tagById: ReadonlyMap<string, TagChipData>,
): TagChipData | null {
  for (const id of todo.tagIds) {
    const tag = tagById.get(id);
    if (tag != null) return tag;
  }
  return null;
}

interface TypeFilterButtonProps {
  /** 选中词表名（FIXED_TAGS 规范序）；空 = 无收窄。 */
  selected: string[];
  onToggle: (name: string) => void;
}

/** 顶栏右动作区的类型过滤钮（无底色 ghost——与主操作实底材质区分）+
 *  anchored popover。开态由本组件自持（纯 UI 态，真值在 URL）；关闭三路
 *  = Esc / 外点（click-catcher）/ 重点触发钮（catcher 承接，家族律）。 */
export function TypeFilterButton({ selected, onToggle }: TypeFilterButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  useEscapeClose(open, close);
  const selectedSet = new Set(selected);
  return (
    <span className="relative flex items-center">
      <Button
        variant="ghost"
        size="sm"
        className="board-type-filter h-7 gap-1.5 px-2.5 text-sm"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t('类型')}
        {selected.length > 0 && (
          <span className="board-type-filter-count rounded-full bg-accent px-1.5 text-[11px] leading-4 font-normal text-muted-foreground">
            {selected.length}
          </span>
        )}
        <ChevronDown width={12} height={12} />
      </Button>
      <OverlayMount open={open}>
        <ClickCatcher onClose={close} />
        <div
          className="type-filter-popover anim-pop absolute top-[calc(100%+6px)] right-0 z-30 flex min-w-[148px] origin-top-right flex-col rounded-[var(--radius-popover)] bg-[var(--popover-bg)] p-1 shadow-[var(--fab-shadow)]"
          role="listbox"
          aria-multiselectable="true"
          aria-label={t('类型')}
        >
          {FIXED_TAGS.map((tag) => {
            const active = selectedSet.has(tag.name);
            return (
              <button
                key={tag.name}
                type="button"
                data-tag={tag.name}
                role="option"
                aria-selected={active}
                className={`type-filter-option flex h-7 w-full items-center rounded-lg px-2 text-xs text-foreground ${
                  active ? '' : 'hover:bg-accent'
                }`}
                onClick={() => onToggle(tag.name)}
              >
                {active ? (
                  <TagChip tag={{ id: tag.name, name: tag.name, color: tag.color }} />
                ) : (
                  tag.name
                )}
              </button>
            );
          })}
        </div>
      </OverlayMount>
    </span>
  );
}
