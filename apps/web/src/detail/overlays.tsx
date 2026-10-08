// Centered modal overlays of the detail route (issue #75, r8 56/74/75):
// the 开始任务 rerun dialog and the 复用方案 sub-panel (back arrow +
// centered prompt + 查看方案/直接执行). Geometry on top of the 448-wide
// centered law (r7 §3.5). (The former 运行历史 dialog of #68 is a static
// right-pane section since #366 — right-pane.tsx.)
// #640（r14 §5.7 前置裁决落地，用户 2026-10-02）：开始任务不再给选择——
// 「先做规划/立即执行」双分支、「规划与执行分用不同 Agent」开关与指派
// 选择器（#318 载荷）全部撤销；待开始相位的开始入口不经 dialog，直接发
// 总管编排回合（use-orchestrate-start.ts）。本 dialog 只剩 failed 重跑面：
// 重跑（= 编排回合）+ — 仅当失败轮持有方案文档（r8 §3.4）— indigo
// 复用方案 第三钮。fixture 面保持静态：无 onRerun/onReuse 时钮无 wire。

import { useEffect } from 'react';
import { Button } from '../components/ui/button.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronLeft, X } from '../icons/index.js';

// XMON-24：老 ui/button overlay 档（30 高 + 12 内边距 + 18 行高 @13px）的
// 几何/皮肤逐值搬进 registry Button utilities。ghost 另有 1px --card-border
// 描边 + secondary 墨；老 .btn--ghost 无 hover 规则，hover 底色两档都要清零
// （dark 档不清会在默认暗色主题下透出 dark:hover:bg-muted/50）。primary 漆面
// 配 border-none：底座 1px 透明描边 + bg-clip-padding 会在漆边留一圈未 paint 环。
const OVERLAY_BTN =
  'h-[30px] px-3 text-[13px] leading-[18px] font-normal border-none cursor-pointer active:not-aria-[haspopup]:translate-y-0';
const OVERLAY_GHOST =
  'h-[30px] px-3 text-[13px] leading-[18px] font-normal border-(--border) text-(--text-secondary) cursor-pointer hover:bg-transparent dark:hover:bg-transparent hover:text-(--text-secondary) active:not-aria-[haspopup]:translate-y-0';

// #168: the rerun/reuse pair joins the dialog family close law (DialogShell
// #68) — Esc, backdrop click, and the X head button all carry the same
// `onClose` (dismiss the whole overlay); `back` stays the explicit
// step-back affordance. Mount/unmount is conditional at the call site, so
// the Esc listener needs no open flag (DialogShell keeps one only for the
// #73 retained-mount exit fade).
function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // #945（detail.css 清零）：scrim 皮肤迁 token utilities；.overlay 类名
  // 保留——todo-detail-page 的 ESC 布线 querySelector('.overlay, …') 与
  // rerun-close-family spec（detail-b 批次重钉）都按它定位。
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop is a click-to-dismiss surface
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes — see comment
    <div
      className="overlay fixed inset-0 z-(--z-modal-scrim) flex items-center justify-center bg-(--overlay-scrim)"
      onClick={(event) => {
        // only the backdrop itself dismisses; panel clicks bubble harmlessly
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="overlay-panel w-[448px] rounded-(--radius-popover) bg-(--popover) shadow-[0_12px_32px_rgb(0_0_0/0.25)]">
        {children}
      </div>
    </div>
  );
}

function PanelHead({
  title,
  back,
  onBack,
  onClose,
}: {
  title: string;
  back?: boolean;
  onBack?: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="overlay-head flex h-12 items-center gap-1 border-b border-(--border) pl-4 pr-3">
      {/* XMON-24：back/close 切 shadcn ghost；#945：per-face 皮肤退役，
          老 computed 逐项搬 utilities——ghost 七通道中和（#908 裁决 3）：
          hover/aria-expanded 底与墨钉回透明 + tertiary，尺寸/内边距/边框
          逐值同形（back 20×20 -ml-1，close 24×24 ml-auto）。 */}
      {back === true && (
        <Button
          variant="ghost"
          className="overlay-back flex size-5 -ml-1 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-(--text-tertiary) hover:bg-transparent hover:text-(--text-tertiary) dark:hover:bg-transparent dark:hover:text-(--text-tertiary) active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
          onClick={onBack}
          aria-label={t('返回')}
        >
          <ChevronLeft width={16} height={16} />
        </Button>
      )}
      <span className="overlay-title text-sm leading-5 font-medium text-(--foreground)">
        {title}
      </span>
      <Button
        variant="ghost"
        className="overlay-close ml-auto flex size-6 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-(--text-tertiary) hover:bg-transparent hover:text-(--text-tertiary) dark:hover:bg-transparent dark:hover:text-(--text-tertiary) active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
        onClick={onClose}
        aria-label={t('关闭')}
      >
        <X width={16} height={16} />
      </Button>
    </div>
  );
}

/** 开始任务 dialog —— #640 起只剩 failed 重跑面（待开始相位的开始入口
 *  不经 dialog，直发总管编排回合）：一行说明 + 重跑（= 编排回合）；
 *  `reuse`（失败轮持有方案文档，r8 §3.4）加 indigo 复用方案 钮并把重跑
 *  降为 ghost 次钮。 */
export function RerunDialog({
  reuse,
  pin,
  onClose,
  onRerun,
  onReuse,
  onUnpin,
}: {
  reuse: boolean;
  /** #864 T3：任务钉选的机器（todo.machineId 的反解）+ 它是否离线。重跑沿用
   *  任务钉选（orchestrate 读 todo.machineId），钉着离线机就是再失败一轮——
   *  所以离线时这一面给出「改为自动」这道显式出口。在线/未钉 = 不出现：
   *  pin 是用户自己下的确定性约束，机器在时不该暗示去改掉它。 */
  pin?: { machineName: string | null; offline: boolean } | null;
  /** #168: family close law — X / Esc / backdrop all dismiss. */
  onClose: () => void;
  /** live 面：重跑 = POST /todos/:id/orchestrate（总管编排回合）；缺省 =
   *  fixture 静态面（钮无 wire）。 */
  onRerun?: () => void;
  onReuse?: () => void;
  /** live 面：清掉任务钉选（PATCH todo.machineId = null，之后新起的 build
   *  才吃这次改动）；缺省 = 静态面（钮无 wire）。 */
  onUnpin?: () => void;
}) {
  const { t } = useI18n();
  const pinOffline = pin != null && pin.offline;
  return (
    <Overlay onClose={onClose}>
      <PanelHead title={t('开始任务')} onClose={onClose} />
      <div className="overlay-body px-4 pt-3 pb-4">
        <div className="rerun-info pt-[18px] pb-0.5 text-center text-[13px] leading-[18px] text-(--text-secondary)">
          {t('这张任务将交给总管重新编排。')}
        </div>
        {pinOffline && onUnpin !== undefined && (
          <div className="rerun-pin flex items-center justify-center gap-2 pt-2 text-xs leading-4 text-(--text-secondary)">
            <span>
              {t('钉选的机器「{machine}」当前离线，重跑仍会等它。', {
                machine: pin.machineName ?? t('（已移除）'),
              })}
            </span>
            <Button variant="ghost" className={OVERLAY_GHOST} onClick={onUnpin}>
              {t('改为自动')}
            </Button>
          </div>
        )}
        <div className="overlay-actions mt-4 flex justify-end gap-2">
          <Button
            variant={reuse ? 'ghost' : 'default'}
            className={reuse ? OVERLAY_GHOST : OVERLAY_BTN}
            onClick={onRerun}
          >
            {t('重跑')}
          </Button>
          {reuse && (
            <Button className={OVERLAY_BTN} onClick={onReuse}>
              {t('复用方案')}
            </Button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

/** 复用方案 sub-panel (r8 75): independent dialog face, back arrow returns
 *  to the rerun dialog. */
export function ReusePanel({
  onClose,
  onBack,
  onView,
  onDirect,
}: {
  /** #168: family close law — X / Esc / backdrop all dismiss; `back` stays
   *  the explicit step-back to the rerun face. */
  onClose: () => void;
  onBack?: () => void;
  onView?: () => void;
  onDirect?: () => void;
}) {
  const { t } = useI18n();
  return (
    <Overlay onClose={onClose}>
      <PanelHead title={t('复用方案')} back onBack={onBack} onClose={onClose} />
      {/* reuse-body = 老 .reuse-body 覆写规则（padding-top 0）的消费端
          等价形：字面 className 不经 twMerge，直接写终值 pt-0。 */}
      <div className="overlay-body reuse-body px-4 pt-0 pb-4">
        <div className="reuse-prompt px-4 pt-[30px] pb-1 text-center text-sm leading-5 text-(--text-secondary)">
          {t('选择接下来如何使用这个方案')}
        </div>
        <div className="overlay-actions mt-4 flex justify-end gap-2">
          <Button variant="ghost" className={OVERLAY_GHOST} onClick={onView}>
            {t('查看方案')}
          </Button>
          <Button className={OVERLAY_BTN} onClick={onDirect}>
            {t('直接执行')}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
