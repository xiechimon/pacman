// 更多 menu (issue #66, r7 18/24): 220×165 popover anchored under the
// detail header's 更多 button (right edge 1272.5, top 39.5). Four items
// 完成 / 复制链接 / 关闭 / 删除 with per-row separators; 删除 is the
// danger row (r5b §05d, r6 §4.2). No backdrop — a transparent catcher
// closes it on outside click (r7 §4.1.4 keeps popovers above the page).
// 复制链接 copies the route URL (r2 §5.3).
// #318: 完成/关闭 接真(r1 changelog 09-16「菜单项按当前 phase 出:Complete
// 走看板自带 confirm-and-merge、Close 关闭语义」)——完成 = 相位适配动作
// (confirm 关口确认 / review 验收弹层→merge 链,调用位裁定),关闭 = 关闭
// 语义落 closed。无该相位语义的行渲染 disabled(原站按相位出项,pacman
// 保持四行恒定 = 捕获几何;运行中禁用同 r1 Delete-in-turn 先例)。r1 的
// 延迟 Undo 窗口不落地([设计] 票内裁量 wontfix:关闭即刻生效,重开走
// closed→todo reopen 面)。
// #948 per-face 清零：overlay.css 的 more-menu 族规则 1:1 迁 utility——
// frozen-anchor 坐标（top 39.5 / right 96.5，#366）与行带高度（40/37/41/45，
// r7 18/24 分隔位实测；#701 五行面按行序重钉 40/37/37/41/45）逐值保留，
// V2 弹层壳 + 描边 Arrow 走 #944 RES_SORT_MENU_CLS 同形配方（阴影保持本面
// 的 --fab-shadow 不随 --plate-shadow）。行钮收编 components/ui Button，
// ghost 档按七通道中和（#908 comment-6001887439 裁决 3 / #943 ROW_BTN 同形）。
// 旧 :has([data-action=reject]) 的 nth-child 带重排在 JSX 里按行序条件计算
// ——data-action 载体原样保留（e2e 行为锚）。

import { Button } from '../components/ui/button.js';
import { FLOATING_POP_ANIM, FloatingShell } from '../components/ui/floating-shell.js';
import { useI18n } from '../i18n/provider.js';
import { Ban, Check, Copy, MessageSquare, Trash2 } from '../icons/index.js';

interface MoreMenuProps {
  /** #73: retained-mount open flag — the exit pop outlives the close. */
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  /** #318: 完成 = 相位适配动作(confirm/review);其余相位 disabled。 */
  onComplete: () => void;
  canComplete: boolean;
  /** #318: 关闭 = phase closed 落账;server 漏斗现有边(todo/failed)外
   *  disabled(review/confirm/done→closed 边归 W3 server 票,#318 注记)。 */
  onCloseTask: () => void;
  canClose: boolean;
  /** #701: 审核关口人肉打回（请求修改）——live review 静息态在场；缺省 =
   *  行不渲染（fixture 捕获面与其余相位保持四行几何，DOM 字节不变）。 */
  onReject?: () => void;
}

/** 壳退场桥（#656 配方，原 .more-menu-shell 规则）：零视觉 visibility 延迟
 *  过渡撑住卸载窗，让面板 animate-out 播完再卸。 */
const SHELL_CLS =
  'more-menu-shell [transition:visibility_0s_linear_var(--dur-fast)] data-[ending-style]:invisible';

/** V2 弹层壳（#790 P3）+ 上指锚边右上的描边 Arrow（12×6 外三角压 10×5
 *  内三角）+ frozen-anchor 坐标（#366：actions 组首 icon 右沿 1343.5 @1440
 *  → right 96.5）。 */
const PANEL_CLS =
  "more-menu fixed top-[39.5px] right-[96.5px] z-(--z-panel-low) w-[220px] origin-top-right rounded-none border border-(--border) bg-(--popover) p-3 shadow-(--fab-shadow) before:absolute before:top-px before:right-6 before:h-1.5 before:w-3 before:bg-(--border) before:[clip-path:polygon(0_100%,50%_0,100%_100%)] before:content-[''] after:absolute after:top-0.5 after:right-[25px] after:h-[5px] after:w-2.5 after:bg-(--popover) after:[clip-path:polygon(0_100%,50%_0,100%_100%)] after:content-['']";

/** 行钮基底（ghost 七通道中和，#943 ROW_BTN / #944 GHOST_ROW_BTN_CLS 同形）：
 *  行带高由消费点按行序补；分隔线 = 首行外 border-t（旧 nth-child(2..n)）；
 *  svg 墨 --menu-icon（r7 18 亮 / r8 56 暗软化），尺寸走属性原值（size-auto
 *  挡件基类 size-4 强制）；disabled 墨 text-dim + cursor default（#318 相位
 *  禁用心智），opacity 中性化（旧面无降透明）。 */
const ITEM_CLS =
  "more-menu-item flex w-full cursor-pointer justify-start gap-4 rounded-none border-0 px-1 text-left text-xs leading-4 font-normal text-(--foreground) hover:bg-transparent dark:hover:bg-transparent aria-expanded:bg-transparent active:not-aria-[haspopup]:translate-y-0 disabled:pointer-events-auto disabled:cursor-default disabled:opacity-100 disabled:text-(--text-dim) disabled:[&_svg]:text-(--text-dim) [&_svg]:flex-none [&_svg]:text-(--menu-icon) [&_svg:not([class*='size-'])]:size-auto";

export function MoreMenu({
  open,
  onClose,
  onDelete,
  onComplete,
  canComplete,
  onCloseTask,
  canClose,
  onReject,
}: MoreMenuProps) {
  const { t } = useI18n();
  const copyLink = () => {
    void navigator.clipboard?.writeText(window.location.href);
    onClose();
  };
  // #701 五行面：打回行插在 完成 之后，行带按行序重钉（旧 :has + nth-child
  // 的 JSX 等价形）——关闭行永不吃 delete 的红带，delete 恒 45px 红带。
  const rows = [
    {
      key: 'complete',
      band: 'h-10',
      label: t('完成'),
      Icon: Check,
      disabled: !canComplete,
      onClick: onComplete,
    },
    ...(onReject !== undefined
      ? [
          {
            key: 'reject',
            band: 'h-[37px]',
            label: t('请求修改'),
            Icon: MessageSquare,
            action: 'reject',
            disabled: false,
            onClick: onReject,
          },
        ]
      : []),
    {
      key: 'copy',
      band: onReject !== undefined ? 'h-[37px]' : 'h-[37px]',
      label: t('复制链接'),
      Icon: Copy,
      disabled: false,
      onClick: copyLink,
    },
    {
      key: 'close',
      band: onReject !== undefined ? 'h-[41px]' : 'h-[41px]',
      label: t('关闭'),
      Icon: Ban,
      disabled: !canClose,
      onClick: onCloseTask,
    },
    {
      key: 'delete',
      band: 'h-[45px]',
      label: t('删除'),
      Icon: Trash2,
      action: 'delete',
      disabled: false,
      danger: true,
      onClick: onDelete,
    },
  ];
  return (
    <FloatingShell open={open} onClose={onClose} className={SHELL_CLS}>
      {/* 透明 catcher 保留（外点只关层、不穿透——#425 车道书记为该族待定项） */}
      {/* 透明 catcher 不画任何东西，进出场无需动效（旧淡入配方是无效淡入） */}
      {/* #948 收编 Button（ghost 全中和：无盒皮肤，z 档 20 = --z-backdrop-low
          低档衬底，菜单压衬底一档——#688 阶梯）。 */}
      <Button
        variant="ghost"
        className="more-menu-catcher fixed inset-0 z-(--z-backdrop-low) cursor-default rounded-none border-0 bg-transparent p-0 hover:bg-transparent hover:text-(--foreground) dark:hover:bg-transparent aria-expanded:bg-transparent active:not-aria-[haspopup]:translate-y-0"
        aria-label={t('关闭菜单')}
        onClick={onClose}
      />
      <div className={`${PANEL_CLS} ${FLOATING_POP_ANIM}`} role="menu" aria-label={t('更多')}>
        {rows.map((row, index) => (
          <Button
            key={row.key}
            variant="ghost"
            role="menuitem"
            className={`${ITEM_CLS} ${row.band}${index > 0 ? ' border-t border-t-(--border)' : ''}${
              row.danger === true
                ? ' text-(--destructive) hover:text-(--destructive) aria-expanded:text-(--destructive) [&_svg]:text-(--destructive)'
                : ' hover:text-(--foreground) aria-expanded:text-(--foreground)'
            }`}
            {...('action' in row ? { 'data-action': row.action } : {})}
            disabled={row.disabled}
            onClick={row.onClick}
          >
            <row.Icon />
            {row.label}
          </Button>
        ))}
      </div>
    </FloatingShell>
  );
}
