// Detail header (issue #56, r7 §3.3): back button, #seq, status chip, the
// 更多 icon and the 50.5×28 primary button. #366 stripped the centered
// 文档|聊天 tab group (the route is a 3-pane layout now) and the
// 分支与 PR/Token 用量/运行历史 icon trio (static right-pane sections).
// #58: the back button carries the current search string home so the
// dev/fixture ?scenario= selection survives the round trip; the board
// scroll position is restored by BoardSurface from sessionStorage.
// #67: the chip is a real button — it toggles the status popover (r7
// 19/29), and the chevron rides outside the pill (r7 17 measure).

import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Button } from '../components/ui/button.js';
import { FloatingShell } from '../components/ui/floating-shell.js';
import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown, ChevronLeft, EllipsisVertical } from '../icons/index.js';
import { ChipPopover } from '../overlays/chip-popover.js';
import { ClickCatcher } from '../overlays/dismiss.js';
import { PHASE_UI } from '../phase.js';
import { Chip } from '../ui/chip.js';

/** #853：头 chip 即 Chip 原语（18px/9999/11px + 五态 token 对全在
 *  ui/chip）——XMON-24 的 Badge + utilities 转写与原语逐值同形，本票收进
 *  原语本体；detail-chip--<tone> 留 DOM 作 e2e 定位别名（className 透传），
 *  shrink/nowrap 是触发钮内 flex 项的保形几何。 */

interface DetailHeadProps {
  todo: TodoRecord;
  /** Rendered phase; the reject chain overrides the record's phase
   *  (replan streaming / building rounds, issue #75). */
  phase?: TodoRecord['phase'];
  /** #66: opens the 更多 menu popover. */
  onMore?: () => void;
  /** Primary button (开始/确认/完成/重开/重跑); the page decides what it
   *  does — the reject chain's 确认 step, the failed 重跑 dialog (#75). */
  onAction: () => void;
  /** Scenario-frozen initial open state of the chip popover (#67). */
  chipPopoverOpen?: boolean;
  /** #209: chip popover「编辑分配」入口——关 popover 后由页层开 agent 选择
   *  弹层(弹层挂页层:popover 关即卸载,挂内层会被带走)。 */
  onEditAssign?: () => void;
  /** M7 #312 / r8 §3.1：审核中态旗标——chip 改「审核中」、composer placeholder
   * 改「AI 审核进行中…」、期间显示停止钮（复用 #308）。 */
  reviewActive?: boolean;
}

export function DetailHead({
  todo,
  phase,
  onMore,
  onAction,
  chipPopoverOpen,
  onEditAssign,
  reviewActive,
}: DetailHeadProps) {
  const { t } = useI18n();
  // AI 审核中态（M7 #312，r8 §3.1）：chip 文案与 phase 解耦——「审核中」字面
  // 反映活动步 kind 而非 phase（review 步是额外 agent 步，phase 留 confirm/
  // review）。tone 用 confirm（同色与待确认期一致，不引入新色）。
  const ui = reviewActive
    ? { ...PHASE_UI[phase ?? todo.phase], chip: '审核中' }
    : PHASE_UI[phase ?? todo.phase];
  const { search } = useLocation();
  const [popover, setPopover] = useState(chipPopoverOpen === true);
  // #425 B1：chip popover 是 wrap 锚定面（.chip-popover 相对 .detail-chipwrap
  // 绝对定位）——portal 挂进 wrap 子树保几何；Esc 由 FloatingShell（Base UI
  // layer 栈）承载。
  const [chipWrap, setChipWrap] = useState<HTMLSpanElement | null>(null);
  return (
    <header className="detail-head">
      <Link className="detail-back" to={{ pathname: '/app', search }} aria-label={t('返回')}>
        <ChevronLeft />
      </Link>
      <span className="detail-seq">#{todo.seqNum}</span>
      <span className="detail-chipwrap" ref={setChipWrap}>
        {/* XMON-24：wrapper 裸钮切 shadcn ghost——皮肤全在 .detail-chip
            per-face（unlayered 压底座，含 bg transparent 顺手灭掉 ghost 的
            hover/aria-expanded 底）；utilities 只清 h-8、字号继承这些底座
            差额。detail-chip 基类保留——e2e 按 .detail-chip 定位点击。 */}
        {/* #634: the chevron rides INSIDE the trigger — the whole chip
            (pill + arrow + the space between) is one hit target; it used to
            be a sibling span, so the arrow side of the cluster was dead.
            gap-0 keeps the chevron's own 5px margin as the only spacing. */}
        <Button
          variant="ghost"
          className="detail-chip h-auto gap-0 rounded-none text-[length:inherit] leading-[inherit] font-normal active:not-aria-[haspopup]:translate-y-0"
          aria-expanded={popover}
          onClick={() => setPopover((value) => !value)}
        >
          <Chip variant={ui.tone} className={`detail-chip--${ui.tone} shrink-0 whitespace-nowrap`}>
            {t(ui.chip)}
          </Chip>
          <span className="detail-chip-chevron">
            <ChevronDown width={12} height={12} />
          </span>
        </Button>
        {/* #666: initialFocus=false——焦点留在触发钮。键盘契约（#634）是同一
            个键再按一次关面；Base UI 缺省会开面即抢焦点进弹层，第二次 Enter
            落在弹层内部件上（轻则 no-op 关不掉，重则随机激活「编辑分配」）。
            disablePointerDismissal——外点归 ClickCatcher（家族律），原生
            outsidePress 只会接住触发钮上的键盘合成 click，与本钮 toggle
            onClick 双写 state 把关面翻回开面（详见 FloatingShell prop 注）。 */}
        <FloatingShell
          open={popover}
          onClose={() => setPopover(false)}
          container={chipWrap}
          initialFocus={false}
          disablePointerDismissal
        >
          <ClickCatcher onClose={() => setPopover(false)} />
          <ChipPopover
            todo={todo}
            onEditAssign={
              onEditAssign == null
                ? undefined
                : () => {
                    // 先关 popover 再开弹层:两 overlay 不叠(家族律单实例)。
                    setPopover(false);
                    onEditAssign();
                  }
            }
          />
        </FloatingShell>
      </span>

      {/* XMON-55 P1: the head carries the task subject. Without it the only
          way to tell which task the page belongs to was to read the thread's
          taskline — the head showed an id and a status word and nothing to
          attach them to. Ellipsised, never wrapped: the head is a fixed 44px
          band. */}
      <span className="detail-title" title={todo.title}>
        {todo.title}
      </span>

      <div className="detail-head-actions">
        {/* XMON-24：更多钮切 shadcn ghost——28×28/透明/tertiary 全在
            .detail-head-icon per-face；utilities 只清 active 位移与底座
            svg 16px 强制（EllipsisVertical 按自身默认尺寸渲染）。 */}
        <Button
          variant="ghost"
          className="detail-head-icon detail-head-icon--more active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
          aria-label={t('更多')}
          onClick={onMore}
        >
          <EllipsisVertical />
        </Button>
        {ui.action != null && (
          <Button
            variant="brand"
            className="detail-head-action border-none font-normal cursor-pointer active:not-aria-[haspopup]:translate-y-0"
            onClick={onAction}
          >
            {t(ui.action)}
          </Button>
        )}
      </div>
    </header>
  );
}
