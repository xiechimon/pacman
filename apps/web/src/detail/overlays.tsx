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
  'h-[30px] px-3 text-[13px] leading-[18px] font-normal border-(--card-border) text-(--text-secondary) cursor-pointer hover:bg-transparent dark:hover:bg-transparent hover:text-(--text-secondary) active:not-aria-[haspopup]:translate-y-0';

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
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop is a click-to-dismiss surface
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes — see comment
    <div
      className="overlay"
      onClick={(event) => {
        // only the backdrop itself dismisses; panel clicks bubble harmlessly
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="overlay-panel">{children}</div>
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
    <div className="overlay-head">
      {/* XMON-24：back/close 切 shadcn ghost——皮肤全在 .overlay-back /
          .overlay-close per-face（bg transparent 灭 hover 底）；utilities 只清
          active 位移与 svg 16px 强制（属性 16px，此面同值，纯防底座漂移）。 */}
      {back === true && (
        <Button
          variant="ghost"
          className="overlay-back active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
          onClick={onBack}
          aria-label={t('返回')}
        >
          <ChevronLeft width={16} height={16} />
        </Button>
      )}
      <span className="overlay-title">{title}</span>
      <Button
        variant="ghost"
        className="overlay-close active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
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
  onClose,
  onRerun,
  onReuse,
}: {
  reuse: boolean;
  /** #168: family close law — X / Esc / backdrop all dismiss. */
  onClose: () => void;
  /** live 面：重跑 = POST /todos/:id/orchestrate（总管编排回合）；缺省 =
   *  fixture 静态面（钮无 wire）。 */
  onRerun?: () => void;
  onReuse?: () => void;
}) {
  const { t } = useI18n();
  return (
    <Overlay onClose={onClose}>
      <PanelHead title={t('开始任务')} onClose={onClose} />
      <div className="overlay-body">
        <div className="rerun-info">{t('这张任务将交给总管重新编排。')}</div>
        <div className="overlay-actions">
          <Button
            variant={reuse ? 'ghost' : 'brand'}
            className={reuse ? OVERLAY_GHOST : OVERLAY_BTN}
            onClick={onRerun}
          >
            {t('重跑')}
          </Button>
          {reuse && (
            <Button variant="brand" className={OVERLAY_BTN} onClick={onReuse}>
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
      <div className="overlay-body reuse-body">
        <div className="reuse-prompt">{t('选择接下来如何使用这个方案')}</div>
        <div className="overlay-actions">
          <Button variant="ghost" className={OVERLAY_GHOST} onClick={onView}>
            {t('查看方案')}
          </Button>
          <Button variant="brand" className={OVERLAY_BTN} onClick={onDirect}>
            {t('直接执行')}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
