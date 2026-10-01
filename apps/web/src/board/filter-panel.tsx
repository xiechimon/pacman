// 看板统一筛选面板（XMON-57）：顶栏从「左仓库 chip 组 + 右类型 popover 钮」
// 收敛成「左 = 生效筛选条 + 右 = 恰好一钮（筛选）」。
//
// 为什么不是「两个面各自加个全选键」：原来的痛点是**逐个点选**，而逐个点选
// 有两个来源——两条轴各占顶栏一半、各自只有单值切换语义。补全选键治的是
// 症状；把两轴收进同一个面板、批次操作（全选 / 清除 / 仅此）与计数挂在
// 维度行上，才是治因。对照面：Multica 是单 Filter 钮 + 弹层多维；todos.dev
// 是板级 Filters 图标 + 层内两段（「Created by」「Projects」）。三者同形，
// 本面取 Multica 的计数与批次、不取 todos.dev 的排除式（并集 + 全选已覆盖，
// 且换模型要重写 ?projects= 契约）。
//
// 本文件 = 两轴的**共用视图**：轴自己「有哪些、怎么判」在 tag-filter.ts /
// repo-filter.ts，这里只吃归一化后的 FilterDimension，不写第二份判定。
//
// 弹层机制**有意沿用** dismiss.tsx 家族律（OverlayMount + ClickCatcher +
// useEscapeClose），不走 components/ui/floating-shell.tsx：本面被
// e2e/escape-wiring.spec.ts 钉在「开层期 window keydown 接线零重挂」上
// （adds:0 / rems:1），换 Base UI layer 栈就是换掉那条被钉的机制——那属于
// 弹层族迁移（#425）的车道，不混进本票。
//
// per-face 类名（board-filter-panel / board-type-filter / board-type-filter-count
// / type-filter-popover / type-filter-option / repo-filter-option /
// filter-dimension-* / filter-option-* / filter-chip / board-filter-empty /
// board-filter-clear）= e2e 定位别名（README 规则 2）。board-type-filter 与
// type-filter-popover 是 #445 遗留别名，语义已扩到「全轴筛选」，名字保留
// 是为了不动既有钉（#411 别名优先政策）。

import { useMemo, useState } from 'react';
import { Button } from '../components/ui/button.js';
import { EmptyDescription } from '../components/ui/empty.js';
import { Input } from '../components/ui/input.js';
import { TagChip } from '../components/ui/tag-chip.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown, X } from '../icons/index.js';
import { ClickCatcher, OverlayMount, useEscapeClose } from '../overlays/dismiss.js';

/** 选项超过此数才给搜索框——短词表（固定 6 词）搜索框是纯噪音。 */
const SEARCH_THRESHOLD = 8;

/** 面板选项（归一化）：两轴各自投影到这里，面板只认这四档。 */
export interface FilterChoice {
  /** 值键（类型轴 = 词表名，仓库轴 = 项目 id）。 */
  value: string;
  label: string;
  /** 色位：在场 = 渲染 TagChip（用户数据色，词表专属）；缺席 = 素文本行。 */
  color?: string;
  /** 另一轴收窄后的命中卡数（本轴自身不参与，见各轴 build*Options）。 */
  count: number;
}

export interface FilterDimension {
  key: string;
  name: string;
  choices: readonly FilterChoice[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onOnly: (value: string) => void;
}

/** 生效筛选条的一节：一个维度一条，点即清该维度。 */
export interface FilterChip {
  key: string;
  label: string;
  onClear: () => void;
}

const FOCUS = 'focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2';

/** 顶栏左侧的生效筛选条。空选中集不渲染任何条——「全部」态没有可摘的
 *  东西，画一个常驻「全部」pill 会把「当前无筛选」表达成一个筛选。
 *  实底高对比（bg-foreground）是刻意的：看板被收窄时「卡不见了」的观感
 *  与「卡真的没了」无法区分，解释这件事的东西就该是全屏最重的一小块
 *  墨；静息淡灰会让最需要被读到的状态变成最容易被略过的。 */
export function FilterChips({
  chips,
  onClearAll,
}: {
  chips: readonly FilterChip[];
  onClearAll: () => void;
}) {
  const { t } = useI18n();
  if (chips.length === 0) return null;
  return (
    <div className="board-filter-chips flex min-w-0 items-center gap-1.5 overflow-x-auto pl-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          data-dimension={chip.key}
          className={`filter-chip ${FOCUS} flex h-5 flex-none items-center gap-1 rounded-full border border-transparent bg-foreground px-2 text-[11px] leading-none font-medium text-background transition-colors`}
          aria-label={t('清除{name}筛选', { name: chip.label })}
          onClick={chip.onClear}
        >
          <span className="filter-chip-label max-w-40 truncate">{chip.label}</span>
          <X width={10} height={10} />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          className={`filter-chips-clear ${FOCUS} flex h-5 flex-none items-center rounded-full px-2 text-[11px] leading-none font-medium text-muted-foreground transition-colors hover:text-foreground`}
          onClick={onClearAll}
        >
          {t('清除全部')}
        </button>
      )}
    </div>
  );
}

function DimensionSection({
  dimension,
  divided,
  query,
  onQuery,
}: {
  dimension: FilterDimension;
  /** 非首段加分隔线——两段是同一面板里的两个维度，不是两个面板。 */
  divided: boolean;
  query: string;
  onQuery: (next: string) => void;
}) {
  const { t } = useI18n();
  const selectedSet = new Set(dimension.selected);
  const needle = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      needle === ''
        ? dimension.choices
        : dimension.choices.filter((choice) => choice.label.toLowerCase().includes(needle)),
    [dimension.choices, needle],
  );
  const actionable = dimension.choices.length > 0;
  return (
    <section
      className={`filter-dimension flex flex-col ${divided ? 'mt-0.5 border-t border-border pt-1' : ''}`}
      data-dimension={dimension.key}
    >
      <header className="filter-dimension-head flex items-center gap-1.5 px-2 pt-1.5 pb-1">
        <span className="filter-dimension-name text-[11px] font-medium text-foreground">
          {t(dimension.name)}
        </span>
        <span className="filter-dimension-selected ml-auto text-[11px] text-muted-foreground tabular-nums">
          {t('已选 {n}/{m}', { n: dimension.selected.length, m: dimension.choices.length })}
        </span>
        {/* 批次键：全选 / 清除。禁用态而非隐藏——控件位置稳定，用户不必
            找「为什么这行刚才有键现在没了」。 */}
        <button
          type="button"
          disabled={!actionable}
          className={`filter-dimension-all ${FOCUS} rounded px-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground`}
          onClick={dimension.onSelectAll}
        >
          {t('全部选中')}
        </button>
        <button
          type="button"
          disabled={dimension.selected.length === 0}
          className={`filter-dimension-clear ${FOCUS} rounded px-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground`}
          onClick={dimension.onClear}
        >
          {t('清除')}
        </button>
      </header>
      {!actionable ? (
        // 空词表不是错误态：作用域里本来就没有可选项（旧 fixture 场景没有
        // 项目 / 标签源）。说清「本作用域内没有」而不是留一个空壳。
        <EmptyDescription className="filter-dimension-empty px-2 pt-1 pb-2 text-xs">
          {dimension.key === 'repo' ? t('本作用域内没有可选的仓库') : t('本作用域内没有可选的类型')}
        </EmptyDescription>
      ) : (
        <>
          {dimension.choices.length > SEARCH_THRESHOLD && (
            <Input
              className="filter-dimension-search mx-1.5 mb-1 h-6 px-2 text-xs"
              placeholder={t('搜索{name}', { name: t(dimension.name) })}
              aria-label={t('搜索{name}', { name: t(dimension.name) })}
              value={query}
              onChange={(event) => onQuery(event.target.value)}
            />
          )}
          <div
            className="filter-dimension-list flex max-h-[220px] flex-col overflow-y-auto"
            role="listbox"
            aria-multiselectable="true"
            aria-label={t(dimension.name)}
          >
            {shown.map((choice) => {
              const active = selectedSet.has(choice.value);
              const alias = choice.color == null ? 'repo-filter-option' : 'type-filter-option';
              return (
                <div key={choice.value} className="filter-option-row group flex items-center">
                  <button
                    type="button"
                    {...(choice.color == null
                      ? { 'data-project': choice.value }
                      : { 'data-tag': choice.value })}
                    role="option"
                    aria-selected={active}
                    className={`${alias} ${FOCUS} flex h-7 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-xs text-foreground ${
                      active ? '' : 'hover:bg-accent'
                    }`}
                    onClick={() => dimension.onToggle(choice.value)}
                  >
                    {active && choice.color != null ? (
                      <TagChip
                        tag={{ id: choice.value, name: choice.label, color: choice.color }}
                      />
                    ) : (
                      <span className="filter-option-label min-w-0 flex-1 truncate text-left">
                        {choice.label}
                      </span>
                    )}
                    <span className="filter-option-count text-[11px] text-muted-foreground tabular-nums">
                      {choice.count}
                    </span>
                  </button>
                  {/* 「仅此」：多选轴的逆向操作（全选后取消一个的镜像）。
                      静息透明、hover/focus 现形——常驻会让每行两个键。 */}
                  {dimension.selected.length > 0 && (
                    <button
                      type="button"
                      className={`filter-option-only ${FOCUS} mr-1 shrink-0 rounded px-1 text-[11px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100`}
                      onClick={() => dimension.onOnly(choice.value)}
                    >
                      {t('仅此')}
                    </button>
                  )}
                </div>
              );
            })}
            {shown.length === 0 && (
              <EmptyDescription className="filter-dimension-empty px-2 py-1.5 text-xs">
                {t('没有与“{q}”匹配的选项', { q: query })}
              </EmptyDescription>
            )}
          </div>
        </>
      )}
    </section>
  );
}

interface FilterPanelProps {
  dimensions: readonly FilterDimension[];
  /** 两轴选中值总数：驱动触发钮角标（收起态也读得出筛选在生效）。 */
  totalSelected: number;
  onClearAll: () => void;
}

/** 顶栏右动作区的筛选钮（无底色 ghost——与主操作实底材质区分）+ anchored
 *  popover。开态由本组件自持（纯 UI 态，真值在 URL）；关闭三路 = Esc /
 *  外点（click-catcher）/ 重点触发钮（catcher 承接，家族律）。点选**保持
 *  开**——点选即关会把多选取缔成单选。 */
export function FilterPanel({ dimensions, totalSelected, onClearAll }: FilterPanelProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<Record<string, string>>({});
  const close = () => setOpen(false);
  useEscapeClose(open, close);
  return (
    <span className="relative flex items-center">
      <Button
        variant="ghost"
        size="sm"
        className="board-type-filter h-7 gap-1.5 px-2.5 text-sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          setQuery({});
        }}
      >
        {t('筛选')}
        {totalSelected > 0 && (
          <span className="board-type-filter-count rounded-full bg-accent px-1.5 text-[11px] leading-4 font-normal text-muted-foreground">
            {totalSelected}
          </span>
        )}
        <ChevronDown width={12} height={12} />
      </Button>
      <OverlayMount open={open}>
        <ClickCatcher onClose={close} />
        <div
          className="type-filter-popover board-filter-panel anim-pop absolute top-[calc(100%+6px)] right-0 z-30 flex w-[268px] origin-top-right flex-col rounded-[var(--radius-popover)] bg-[var(--popover-bg)] pb-1 shadow-[var(--fab-shadow)]"
          role="dialog"
          aria-label={t('筛选')}
        >
          {dimensions.map((dimension, index) => (
            <DimensionSection
              key={dimension.key}
              dimension={dimension}
              divided={index > 0}
              query={query[dimension.key] ?? ''}
              onQuery={(next) => setQuery((prev) => ({ ...prev, [dimension.key]: next }))}
            />
          ))}
          {totalSelected > 0 && (
            <button
              type="button"
              className={`filter-panel-clear ${FOCUS} mt-0.5 flex h-7 items-center justify-center rounded-lg text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground`}
              onClick={onClearAll}
            >
              {t('清除全部')}
            </button>
          )}
        </div>
      </OverlayMount>
    </span>
  );
}
