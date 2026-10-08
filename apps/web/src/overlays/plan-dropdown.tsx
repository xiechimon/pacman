// 方案▾/变更▾ document-type dropdown (issue #67, r7 20 / r5b 05f; #149
// generalized to the changes/diff header select; #366 generalized again
// into the detail right-pane view picker): 218-wide panel right-aligned
// under the pane-head type button. The first row is the doc surface's
// phase-derived type (方案|变更 — re-selecting it just stays on the doc
// view), then the three static pane sections that replaced the former
// head-icon overlay dialogs (分支与 PR / Token 用量 / 运行历史). Row click
// = pick the view and close — the lang-dropdown select-and-close law
// (#306 校准: a rendered option row must act, not just check). Surfaces
// without build payload data list the doc row alone (no dead rows).

import { Button } from '../components/ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu.js';
import type { PaneView } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown } from '../icons/index.js';

/** Row/button copy — zh dict keys, rendered through t(). */
export type PaneRowLabel = '方案' | '变更' | '分支与 PR' | 'Token 用量' | '运行历史';

/** The doc surface's phase-derived type word (the listbox's first row). */
export type DocTypeLabel = '方案' | '变更';

const SECTION_ROWS: Array<{ view: PaneView; label: PaneRowLabel }> = [
  { view: 'branch', label: '分支与 PR' },
  { view: 'token', label: 'Token 用量' },
  { view: 'history', label: '运行历史' },
];

// #1006 原型（#980 前提②④）：DROPDOWN_PANEL / DROPDOWN_ROW 两串手写皮律
// 退役——V2 弹层壳（方角 / --plate-shadow 硬偏移投影 / 双层 clip-path 描边
// Arrow）与 36px 行距 / hover-focus 中和 / --spot-soft 选中漆 / --card-button
// 勾色全部让位 registry DropdownMenu 默认形态（rounded-lg p-1 shadow-md
// ring-1、item rounded-md focus:bg-accent、RadioItemIndicator 原生槽）。
// 保留的是行为与 layout：select-and-close 家族律（closeOnClick #306）、
// Positioner 定位参数（side=bottom align=end sideOffset=8）、盘最小宽 220
// （r8 §2.7 行词长度 layout 位）、.doc-select-wrap / .doc-pane-select 别名
// （spec/22 §5.0 残留律）。
const DROPDOWN_PANEL_LAYOUT = 'min-w-[220px]';

/** Type-select button + dropdown, shared by the doc-pane head and the three
 *  section heads (#366). #854 收编到 components/ui/dropdown-menu（Base UI
 *  Menu RadioGroup，#714 playbook）：单选即关走显式 closeOnClick（RadioItem
 *  缺省 false，原生 radio 保开语义；本面家族律是 select-and-close #306）；
 *  勾形改由 RadioItemIndicator 原生槽承载（同位旧 margin-left:auto 勾）；
 *  roving focus / typeahead / Esc / 外点关 / 焦点归还全归原语（modal 默认
 *  档 = 外点不穿透，ClickCatcher 家族律同语义）。皮肤/几何正本 = registry
 *  DropdownMenu 件默认形态（#1006 原型，#980 前提④）；定位正本
 *  从 CSS inset 迁到 Positioner 参数（side=bottom align=end sideOffset=8 =
 *  原 top:calc(100%+8px) right:0）。The button label is the active view's
 *  own word.
 *  类别名 .doc-select-wrap / .doc-pane-select 原位保留（spec/22 §5.0 别名
 *  残留律）：detail.css 的 .doc-select-wrap + .doc-pane-select 兄弟选择器
 *  与 .doc-pane-select 规则是活住址（#945 清零账），wrap 的 relative/flex
 *  两条已死属性以 utility 等值随行。 */
export function PaneTypeSelect({
  view,
  docLabel,
  sections,
  onView,
  initiallyOpen,
}: {
  view: PaneView;
  docLabel: DocTypeLabel;
  sections?: boolean;
  onView: (view: PaneView) => void;
  /** Scenario-frozen initial open state (#67, r7 20). */
  initiallyOpen?: boolean;
}) {
  const { t } = useI18n();
  const rows: Array<{ view: PaneView; label: PaneRowLabel }> = [
    { view: 'doc', label: docLabel },
    ...(sections ? SECTION_ROWS : []),
  ];
  const label: PaneRowLabel =
    view === 'doc'
      ? docLabel
      : (SECTION_ROWS.find((row) => row.view === view)?.label ?? '分支与 PR');
  return (
    <span className="doc-select-wrap relative flex">
      <DropdownMenu defaultOpen={initiallyOpen}>
        <DropdownMenuTrigger
          render={
            // #1006 原型：与 detail/docpane 的 PANE_SELECT 同配方（防两消费
            // 面漂移的既有律）——ghost xs 档默认形态，仅左距不同：wrap 内
            // 6px（老基规则 ml 6px；docpane 的 range-wrap 嵌套覆写是 ml-0）。
            <Button variant="ghost" size="xs" className="doc-pane-select ml-1.5" />
          }
        >
          {t(label)}
          <ChevronDown width={12} height={12} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={8}
          aria-label={t('面板视图')}
          className={DROPDOWN_PANEL_LAYOUT}
        >
          <DropdownMenuRadioGroup value={view} onValueChange={(next) => onView(next as PaneView)}>
            {rows.map((row) => (
              <DropdownMenuRadioItem key={row.view} value={row.view} closeOnClick>
                {t(row.label)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
