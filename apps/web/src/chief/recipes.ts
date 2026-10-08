// Chief 域 utility 配方单源（#950 per-face 清零：chief.css 退役，皮肤全部
// 改挂 token utility——spec/22 §3.1 角色有 token 必走 token，阶梯外一次性
// 几何走 arbitrary §3.1(a)）。几何取原 per-face 规则等值迁移；控件高随件
// 正典（§2.6-1：30px 触发钮 → Button 默认档 h-8 32px，差额 D2 吸收，探针
// 对照表随 PR 人审）。跨文件共用的配方住这里单源（RES/parts.tsx 同律）；
// 单文件私有的就地内联。

/** V2 弹层壳（#790 P3 / #854 盘三件套：直角 + 1px 墨线 + plate-shadow）
 *  等值迁移：纵向 12px 内衬、横向零垫（行自带内衬铺满选中底色，#872 律）；
 *  PopoverContent 件默认档就地并掉（w-72/gap/圆角/p-2.5/shadow-md/ring）。
 *  上指锚边描边 Arrow = 12×6 外三角压 10×5 内三角（clip-path utility，
 *  RES_SORT_MENU_CLS 同配方）；side 由消费点拼 LEFT/RIGHT 段。 */
export const MENU_SHELL_CLS =
  "relative flex w-auto flex-col gap-0 rounded-none border border-(--border) bg-(--popover) px-0 py-3 shadow-(--plate-shadow) ring-0 before:absolute before:top-px before:h-1.5 before:w-3 before:bg-(--border) before:[clip-path:polygon(0_100%,50%_0,100%_100%)] before:content-[''] after:absolute after:top-0.5 after:h-[5px] after:w-2.5 after:bg-(--popover) after:[clip-path:polygon(0_100%,50%_0,100%_100%)] after:content-['']";

/** 锚边右上（设置面两盘：压缩模型 / 主力机，align=end）。 */
export const MENU_ARROW_RIGHT_CLS = 'before:right-4 after:right-[17px]';

/** 锚边左上（抽屉头主模型盘，align=start）。 */
export const MENU_ARROW_LEFT_CLS = 'before:left-4 after:left-[17px]';

/** select 形触发钮皮肤（旧 .chief-select / .chief-host-select 等值：1px 墨线
 *  框 + surface 底 + 13px primary 字 + chevron 右缘）。Button ghost 底座按
 *  七通道律归零（#908 裁决 3）：旧形无 hover/expanded 反馈——unlayered
 *  per-face 恒压件配方，迁移后逐通道显式钉回 surface 皮肤。高度随件正典
 *  h-8（旧 30px，§2.6-1 D2 吸收）；min-w 差归消费点。 */
export const SELECT_TRIGGER_CLS =
  "h-8 max-w-50 cursor-pointer justify-between gap-2.5 rounded-none border border-(--border) bg-(--card) px-2.5 font-normal text-[13px] text-(--foreground) hover:bg-(--card) hover:text-(--foreground) dark:hover:bg-(--card) dark:hover:text-(--foreground) aria-expanded:bg-(--card) aria-expanded:text-(--foreground) active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto";

/** 触发钮值 span（#772 截断律：min-w-0 是省略号触发前提）。 */
export const SELECT_VALUE_CLS = 'min-w-0 flex-auto truncate';

/** 24px 头像槽（XMON-105 律单源，旧 .chief-avatar / .chief-avatar--img
 *  等值）：glyph 形只出墨色与不伸缩；img 形图即 24 圆盘（SeededAvatar Root
 *  定尺盒——几何由 Root 的 className 与 wrapper 的 [&_img] 同值承载，
 *  #1003）。 */
export const AVATAR_SLOT_CLS = 'flex-none text-(--text-tertiary)';
export const AVATAR_IMG_CLS =
  'flex-none text-(--text-tertiary) [&_img]:block [&_img]:size-6 [&_img]:rounded-full';

/** 主力机行钮（旧 .chief-host-row 等值：32 行 / 12px 字 / px-12 / hover
 *  surface-secondary）。与 model 行（PICK_ROW_BTN_CLS）的唯一差异 = 无
 *  aria-selected 底色通道——#895 行形态沿 new-task machine chip 族，选中
 *  态只出 Check 勾不出底色，等值保留。 */
export const HOST_ROW_BTN_CLS =
  "h-8 w-full cursor-pointer justify-start gap-2 rounded-none border-none bg-transparent px-3 text-left text-xs leading-4 font-normal text-(--foreground) whitespace-nowrap hover:bg-(--secondary) hover:text-(--foreground) dark:hover:bg-(--secondary) aria-expanded:bg-transparent aria-expanded:text-(--foreground) active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto";
