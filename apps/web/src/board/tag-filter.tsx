// 看板标签筛选条（#403）：顶栏 chip 组——固定 6 词表（shared FIXED_TAGS
// 单源）+ 「全部」复位态。设计裁决（#403 范围条的设计面）：
//   - 多选 = OR 并集（「找某类活」直觉；AND 在「每任务至多 1 个标签」的
//     ADR 0002 D4 口径下恒退化为单选，无意义）；
//   - 无标签任务恒可见——筛选是附加收窄，不产生「任务凭空消失」的意外；
//   - 筛选态进 URL query（?tags=bug,docs，replace 写回不刷历史），
//     刷新/分享不丢；清空即删参回全量。
// 视觉语言 = TagChip 同源：选中态直接渲染 TagChip 组件（20px pill、
// tag.color 实底白字，字节级同源）；未选 = 中性描边 pill（新造面——
// 六色全亮则读不出选中态）。
// 消费面：TagFilterBar 由 board.tsx（BoardSurface 顶栏）渲染；
// parseTagParam / matchesTagFilter 由 board-page.tsx 与测试面消费。
// per-face 类名（board-tag-filter / tag-filter-chip / tag-filter-all /
// board-tag-filter-empty / board-tag-filter-clear）= e2e 定位别名
//（README 规则 2）。

import { FIXED_TAGS } from '@pacman/shared';
import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { TagChip } from '../ui/tag-chip.js';

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

interface TagFilterBarProps {
  /** 选中词表名（FIXED_TAGS 规范序）；空 = 全部态。 */
  selected: string[];
  onToggle: (name: string) => void;
  onClear: () => void;
}

/** 顶栏 chip 组。选中态内嵌 TagChip 组件（视觉单源）；未选中性描边。
 *  focus 环与 shadcn Button 同 idiom（button.tsx 的 --focus-ring 实线）。 */
export function TagFilterBar({ selected, onToggle, onClear }: TagFilterBarProps) {
  const { t } = useI18n();
  const selectedSet = new Set(selected);
  const allActive = selected.length === 0;
  const focus =
    'focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2';
  // 未选 pill 的几何（20px/11px/px-2）与 tag-chip.css 对齐；选中态不承载
  // 几何——pill 由 TagChip 组件本体出，button 退为透明包裹。
  const pill =
    'flex h-5 flex-none items-center rounded-full border px-2 text-[11px] leading-none font-medium transition-colors';
  return (
    <div className="board-tag-filter flex min-w-0 items-center gap-1.5 overflow-x-auto pl-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        className={`tag-filter-all ${pill} ${focus} ${
          allActive
            ? 'border-transparent bg-foreground text-background'
            : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
        aria-pressed={allActive}
        onClick={onClear}
      >
        {t('全部')}
      </button>
      {FIXED_TAGS.map((tag) => {
        const active = selectedSet.has(tag.name);
        return (
          <button
            key={tag.name}
            type="button"
            data-tag={tag.name}
            className={
              active
                ? `tag-filter-chip flex flex-none items-center p-0 ${focus}`
                : `tag-filter-chip ${pill} ${focus} border-border text-muted-foreground hover:bg-accent hover:text-foreground`
            }
            aria-pressed={active}
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
  );
}
