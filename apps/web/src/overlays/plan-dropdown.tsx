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

/** #949: 旧 .plan-dropdown 壳规则等值迁 utility——V2 弹层壳（#790 P3：
 *  12px 内边距 / 1px 墨线框 / 圆角 0 / 最小宽 220）+ #854 盘三件套的硬偏移
 *  投影（--plate-shadow，用户 2026-10-05 取向）+ 12×6 描边 Arrow（双层
 *  clip-path 三角，anchor 边内侧）+ origin 顶右（#73 锚定 pop 家族律）。
 *  ring-0 中和 Content 底座的 ring-1 描边圈（旧 per-face box-shadow 是
 *  unlayered 单值，天然压掉 layered ring——utility 化后必须显式归零，否则
 *  多出一圈 1px 环）。定位正本仍在 Positioner 参数（side=bottom align=end
 *  sideOffset=8）；面板是 Positioner 的静态子级（relative 承 Arrow 伪元）。 */
const DROPDOWN_PANEL =
  "relative flex min-w-[220px] flex-col rounded-none border border-(--border-default) bg-(--popover-bg) p-3 shadow-(--plate-shadow) ring-0 origin-top-right before:absolute before:top-px before:right-5 before:h-1.5 before:w-3 before:bg-(--border-default) before:[clip-path:polygon(0_100%,50%_0,100%_100%)] before:content-[''] after:absolute after:top-0.5 after:right-[21px] after:h-[5px] after:w-2.5 after:bg-(--popover-bg) after:[clip-path:polygon(0_100%,50%_0,100%_100%)] after:content-['']";

/** #949: 旧 .plan-dropdown-row 规则等值迁 utility——36px 行 / 直角（#854
 *  参考站实测：选中行底四角满色）/ 16px 左垫 4px 右垫 / 12px 一级墨。
 *  RadioItem 底座的 focus:bg-accent 家族按旧「行 transparent 底恒压」语义
 *  中和成 focus:bg-transparent（选中行 focus 底保持 --spot-soft，复合变体
 *  压在透明档之后）；hover 淡 tint = motion.css #73 家族 --accent-soft
 *  同值（行随本票退出该选择子族、utility 自持，hover 压过选中底 = 迁移前
 *  实测同序）。Base UI Menu 里 hover 即移焦（hover⇒focus 同刻在体），
 *  focus 透明档与 hover tint 同特异性时按 TW 变体序 focus 后位恒压——故
 *  hover tint 一律带 hover:focus（及 data-checked:hover:focus）复合档，
 *  特异性抬一级钉死「悬停必亮」的迁移前实测序；键盘 roving focus 环 =
 *  #388 canon 2px --focus-ring（底座 outline-hidden 之上按 focus-visible
 *  变体补钉）；勾形色钉
 *  --card-button（indicator 槽选择器吃 wrapper 的 data-slot 契约，同旧
 *  per-face 选择器；focus 态勾色随底座 ** 家族走一级墨 = 迁移前 layered
 *  focus tint 的同值中和，见 PR 对照表）。 */
const DROPDOWN_ROW =
  "h-9 w-full flex-none cursor-pointer justify-start rounded-none py-0 pl-4 pr-1 text-left text-xs leading-4 font-normal whitespace-normal text-(--text-primary) transition-[background-color] duration-150 hover:bg-(--accent-soft) hover:focus:bg-(--accent-soft) data-checked:bg-(--spot-soft) data-checked:hover:bg-(--accent-soft) data-checked:hover:focus:bg-(--accent-soft) focus:bg-transparent focus:text-(--text-primary) focus:**:text-(--text-primary) data-checked:focus:bg-(--spot-soft) data-checked:focus:**:text-(--text-primary) focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2 [&_[data-slot=dropdown-menu-radio-item-indicator]]:text-(--card-button) [&_svg:not([class*='size-'])]:size-auto";

/** Type-select button + dropdown, shared by the doc-pane head and the three
 *  section heads (#366). #854 收编到 components/ui/dropdown-menu（Base UI
 *  Menu RadioGroup，#714 playbook）：单选即关走显式 closeOnClick（RadioItem
 *  缺省 false，原生 radio 保开语义；本面家族律是 select-and-close #306）；
 *  勾形改由 RadioItemIndicator 原生槽承载（同位旧 margin-left:auto 勾）；
 *  roving focus / typeahead / Esc / 外点关 / 焦点归还全归原语（modal 默认
 *  档 = 外点不穿透，ClickCatcher 家族律同语义）。皮肤/几何正本 = 上方
 *  DROPDOWN_PANEL / DROPDOWN_ROW utility（#949 per-face 清零）；定位正本
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
            <Button
              variant="ghost"
              size="default"
              className="doc-pane-select h-auto rounded-none justify-start gap-0 font-normal active:not-aria-[haspopup]:translate-y-0 hover:bg-transparent [&_svg:not([class*='size-'])]:size-auto"
            />
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
          className={DROPDOWN_PANEL}
        >
          <DropdownMenuRadioGroup value={view} onValueChange={(next) => onView(next as PaneView)}>
            {rows.map((row) => (
              <DropdownMenuRadioItem
                key={row.view}
                value={row.view}
                closeOnClick
                className={DROPDOWN_ROW}
              >
                {t(row.label)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
