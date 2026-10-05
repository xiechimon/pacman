// pages 域共享配方（#946 per-face 清零）：原 pages.css 里被多面/多域消费的
// 规则组以 utility 常量单源在此——域内消费点（shell TabGroup、schedules 频率
// seg、project 文件 seg / 视图切换）与三个域外 segmented Tabs 消费点
// （resources/providers-page、routes/team-page、routes/agent-detail-page，
// 经 components/ui/tabs 的 segmented 档）共引同一份，不再有两套同款手搓壳。
// 值 = 原 pages.css 规则的等值迁移（token 槽引用，spec/22 §1.7/1.8 + §3.1）；
// 几何 r2 24b/24c 发丝环（1px border + 2px padding，chip 内浮）逐值保持。
// tabs.tsx segmented 档仍输出 page-tabs-group/page-tab 类名（共享件冻结，
// #946 不动 components/ui/）——类名自本票起无 CSS 规则，皮肤由这些常量承载；
// 档收敛进件内归 #952（components/ui/ 授权票）。

/** 分段组盒（原 .page-tabs-group / .sched-form-freq / .prj-files-seg /
 *  .prj-tasks-view 共用基）：30px 高 = 1 border + 2 pad + 24 chip + 2 pad +
 *  1 border（#138 发丝环 idiom），方角，surface-secondary 底。
 *  定位差（topbar 的 pointer-events-auto、freq 的 w-fit/mt-3 等）由消费点补。 */
export const SEG_GROUP_CLS =
  'flex h-[30px] items-center rounded-none border border-(--border-default) bg-(--surface-secondary) p-[2px]';

/** 分段 chip 基皮（原 .page-tab 族）：24px 高、13/24 字、secondary 墨、
 *  透明底、方角、150ms 标准步的背景过渡（#138 家族律；旧规的
 *  (hover:hover)(pointer:fine) 门由 TW hover: 变体自带 (hover:hover) 承接，
 *  pointer:fine 细分门为 D2 吸收项——桌面探针面等值）。
 *  未选 chip 的 hover 淡 tint 见 SEG_TAB_IDLE_CLS。 */
export const SEG_TAB_CLS =
  'h-6 cursor-pointer rounded-none border-none bg-transparent px-3 text-[13px] leading-6 text-(--text-secondary) transition-[background-color] duration-(--dur-fast) ease-(--ease-standard)';

/** 未选 chip：hover 吃 --seg-hover 淡 tint（alpha 梯第一级，tint 骑 chip
 *  自身盒 + 圆角 = 选中 chip 同几何，一个几何两个深度）。 */
export const SEG_TAB_IDLE_CLS =
  'hover:bg-(--seg-hover) hover:text-(--text-secondary) dark:hover:bg-(--seg-hover)';

/** 选中 chip（原 .page-tab--active / [data-active]）：--tab-chip-bg 填充 +
 *  primary 墨；hover 保持自身填充不被洗浅（旧规 :not(--active) 闸的等值——
 *  选中分支不挂 idle 的 hover tint，且显式压回 chip 底）。 */
export const SEG_TAB_ACTIVE_CLS =
  'bg-(--tab-chip-bg) text-(--text-primary) hover:bg-(--tab-chip-bg) hover:text-(--text-primary) dark:hover:bg-(--tab-chip-bg)';

/** 禁用 chip（原 .page-tab--disabled）：弱化但保留可见（占位语义，spec 12 /
 *  #362 G2-T2 v1）；hover 微光是现行为（disabled:pointer-events-auto 保留），
 *  故 hover 墨色钉 tertiary 不被 ghost 档提亮。 */
export const SEG_TAB_DISABLED_CLS =
  'cursor-default text-(--text-tertiary) hover:text-(--text-tertiary) disabled:cursor-default disabled:opacity-[0.55]';

/** ghost 档「分段 chip 钮」七通道中和（#908 comment-6001887439 裁决 3，
 *  #943 ROW_BTN / #944 GHOST_ROW_BTN_CLS 同形）：hover bg（含 dark:）·
 *  hover text · press translate（active:not-aria-[haspopup] 同变体链）·
 *  gap/px · font-weight · border；aria-expanded 通道不适用（分段 chip 无
 *  haspopup 面）。文字墨色通道随各 chip 状态在 SEG_TAB_* 里重复。 */
export const GHOST_SEG_BTN_CLS = 'gap-0 font-normal active:not-aria-[haspopup]:translate-y-0';

/** 居中内容列（原 .page-col）：768 宽 = r7 11 空态块 @ x456。
 *  设置列 760（r2 24c 卡列）由消费点覆写宽度。 */
export const PAGE_COL_CLS = 'mx-auto w-[768px]';
