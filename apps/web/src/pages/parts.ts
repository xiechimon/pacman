// pages 域共享配方（#946 per-face 清零建；#1007 起 SEG_* 退役中）。
// 域内消费点（shell TabGroup、schedules 频率 seg、project 文件 seg / 视图
// 切换）与 routes/agent-detail-page 已迁 registry Tabs 件默认形态（#980
// 裁决②④：手写发丝环分段壳是超出官网形态的皮肤通道，退役）；SEG_* 常量
// 仅剩两个域外消费点（resources/providers-page、routes/team-page，归 L2
// 车道迁移），迁完即删——本文件不再接受新消费者。
// page-tabs-group/page-tab 类名留存于 registry Tabs 承载（e2e 定位面，
// 选中态载体 = data-active/aria-selected，#910 裁定 3）。

/** 分段组盒（原 .page-tabs-group / .sched-form-freq / .prj-files-seg /
 *  .prj-tasks-view 共用基）：30px 高 = 1 border + 2 pad + 24 chip + 2 pad +
 *  1 border（#138 发丝环 idiom），方角，surface-secondary 底。
 *  定位差（topbar 的 pointer-events-auto、freq 的 w-fit/mt-3 等）由消费点补。 */
export const SEG_GROUP_CLS =
  'flex h-[30px] items-center rounded-none border border-(--border) bg-(--secondary) p-[2px] group-data-horizontal/tabs:h-[30px]';

/** 分段 chip 基皮（原 .page-tab 族）：24px 高、13/24 字、secondary 墨、
 *  透明底、方角、150ms 标准步的背景过渡（#138 家族律；旧规的
 *  (hover:hover)(pointer:fine) 门由 TW hover: 变体自带 (hover:hover) 承接，
 *  pointer:fine 细分门为 D2 吸收项——桌面探针面等值）。
 *  未选 chip 的 hover 淡 tint 见 SEG_TAB_IDLE_CLS。
 *  尾段 = Tabs 件承载的上游基类中和层（#1003，segmented 档退役后 chip 骑
 *  registry default 档 trigger）：font-medium → 400 字重；data-active 漆面
 *  （bg-background/shadow-sm/dark:bg-input/30）→ 选中 chip --card 实底无阴影
 *  （原 .page-tab--active 正典值）。Button 承载无 data-active 属性、字重已被
 *  GHOST_SEG_BTN_CLS 钉 400，中和段在其上惰性。 */
export const SEG_TAB_CLS =
  'h-6 cursor-pointer rounded-none border-none bg-transparent px-3 text-[13px] leading-6 text-(--text-secondary) transition-[background-color] duration-(--dur-fast) ease-(--ease-standard) font-normal gap-0 data-active:bg-(--card) data-active:shadow-none dark:data-active:bg-(--card)';

/** 未选 chip：hover 吃 --seg-hover 淡 tint（alpha 梯第一级，tint 骑 chip
 *  自身盒 + 圆角 = 选中 chip 同几何，一个几何两个深度）。 */
export const SEG_TAB_IDLE_CLS =
  'hover:bg-(--seg-hover) hover:text-(--text-secondary) dark:hover:bg-(--seg-hover)';

/** 选中 chip（原 .page-tab--active / [data-active]）：--tab-chip-bg 填充 +
 *  primary 墨；hover 保持自身填充不被洗浅（旧规 :not(--active) 闸的等值——
 *  选中分支不挂 idle 的 hover tint，且显式压回 chip 底）。 */
export const SEG_TAB_ACTIVE_CLS =
  'bg-(--card) text-(--foreground) hover:bg-(--card) hover:text-(--foreground) dark:hover:bg-(--card)';

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
