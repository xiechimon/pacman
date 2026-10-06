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
import { StatusChip } from '../components/ui/status-chip.js';
import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown, ChevronLeft, EllipsisVertical } from '../icons/index.js';
import { ChipPopover } from '../overlays/chip-popover.js';
import { ClickCatcher } from '../overlays/dismiss.js';
import { PHASE_UI } from '../phase.js';

/** #945（#942 正典表 §5.2 C1）：头 chip 从老 ui/chip 原语迁 StatusChip
 *  适配件（Badge 骨架 + 五对 --chip-* token utility 皮肤；default 档 h-5，
 *  替旧 md 18px——D2 授权几何）。状态载体 = data-tone（件自带）；
 *  detail-chip--<tone> 别名退役（全库零 spec 消费，grep 复核 @ 034bf7d5）。
 *  触发面 .detail-chip 类名保留（detail-b 的 reject-chain/review-reject 与
 *  integration m5/web-plans 按它定位；重钉归各自批次），皮肤迁 utilities。 */

// 头带 44px（43 + 1px 缝线，r7 §3.1）；主钮 50.5×28 @12px 是 r7 §3.3 冻结
// 几何（老 scoped override 规则的消费端等价形）。ghost 七通道中和（#908
// 裁决 3）逐钮带上：hover/aria-expanded 底清零、墨色钉回原值。
const ICON_BTN =
  'flex size-7 flex-none cursor-pointer items-center justify-center border-none bg-transparent p-0 text-(--text-tertiary) hover:bg-transparent hover:text-(--text-tertiary) dark:hover:bg-transparent dark:hover:text-(--text-tertiary) active:not-aria-[haspopup]:translate-y-0';

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
  // #425 B1：chip popover 是 wrap 锚定面（popover 面板相对本 wrap 绝对
  // 定位，#949 起 wrap 的 relative 锚位由 utility 承载）——portal 挂进
  // wrap 子树保几何；Esc 由 FloatingShell（Base UI layer 栈）承载。
  const [chipWrap, setChipWrap] = useState<HTMLSpanElement | null>(null);
  return (
    <header
      className="detail-head relative flex h-11 flex-none items-center border-b border-(--border-default) pl-3"
      data-testid="detail-head"
    >
      <Link
        className="detail-back flex size-7 flex-none cursor-pointer items-center justify-center border-none bg-transparent p-0 text-(--text-tertiary)"
        to={{ pathname: '/app', search }}
        aria-label={t('返回')}
      >
        <ChevronLeft />
      </Link>
      <span className="detail-seq ml-1 flex-none text-xs leading-4 text-(--text-tertiary)">
        #{todo.seqNum}
      </span>
      {/* #949：chipwrap 定位类随 overlays.css 清零退役（relative flex
          items-center 等值 utility）。 */}
      <span className="relative flex items-center" ref={setChipWrap}>
        {/* XMON-24 wrapper 钮 shadcn ghost 底座不变；#945 皮肤从
            .detail-chip per-face 迁 utilities（七通道中和：hover/
            aria-expanded 底清零、墨色走 inherit 保持老「无 color 规则」的
            继承形；h-auto/gap-0/字号继承清底座差额）。#951：detail-b 两 spec
            （reject-chain/review-reject）重钉到 phase-chip testid——断言目标
            就是这个钮的文案（相位词随链路翻动），按 name 定位即循环，属
            #910 裁定 1 的真盲区二级载体。detail-chip 基类保留至 #953 终账
            ——chip-assign/chip-hotzone 与 integration m5/web-plans 仍按它
            定位（其批次已收官，类名钩零规则存活）。 */}
        {/* #634: the chevron rides INSIDE the trigger — the whole chip
            (pill + arrow + the space between) is one hit target; it used to
            be a sibling span, so the arrow side of the cluster was dead.
            gap-0 keeps the chevron's own 5px margin as the only spacing. */}
        <Button
          variant="ghost"
          data-testid="phase-chip"
          className="detail-chip ml-2 flex h-auto flex-none cursor-pointer items-center gap-0 rounded-none border-none bg-transparent p-0 text-[length:inherit] leading-[inherit] font-normal hover:bg-transparent hover:text-inherit dark:hover:bg-transparent dark:hover:text-inherit aria-expanded:bg-transparent aria-expanded:text-inherit active:not-aria-[haspopup]:translate-y-0"
          aria-expanded={popover}
          onClick={() => setPopover((value) => !value)}
        >
          <StatusChip tone={ui.tone} className="shrink-0 whitespace-nowrap">
            {t(ui.chip)}
          </StatusChip>
          {/* #949: chevron 皮肤等值迁 utility（规则原住 overlays.css，随
              #949 清零；5px 左距 / 三级墨 / flex-none）。testid = 二级
              载体（触发钮内无 role 的结构钩子，chip-hotzone 的 H1 热区
              钉扎位，#910 裁定 1）。 */}
          <span
            className="ml-[5px] flex flex-none text-(--text-tertiary)"
            data-testid="chip-chevron"
          >
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
      <span
        className="detail-title ml-3.5 min-w-0 flex-1 truncate text-[15px] leading-5 font-semibold text-(--text-primary)"
        title={todo.title}
        data-testid="detail-title"
      >
        {todo.title}
      </span>

      <div
        className="detail-head-actions ml-3 flex flex-none items-center gap-1.5 pr-3"
        data-testid="detail-head-actions"
      >
        {/* XMON-24 更多钮 shadcn ghost 底座不变；#945 皮肤迁 utilities
            （ICON_BTN 七通道中和；svg 免底座 16px 强制——EllipsisVertical
            按自身默认尺寸渲染）。--more 别名保留（8 处 spec 钉）。 */}
        <Button
          variant="ghost"
          className={`detail-head-icon detail-head-icon--more ${ICON_BTN} [&_svg:not([class*='size-'])]:size-auto`}
          aria-label={t('更多')}
          onClick={onMore}
        >
          <EllipsisVertical />
        </Button>
        {ui.action != null && (
          <Button
            variant="brand"
            className="detail-head-action h-7 w-[50.5px] flex-none cursor-pointer border-none p-0 text-xs leading-7 font-normal active:not-aria-[haspopup]:translate-y-0"
            onClick={onAction}
          >
            {t(ui.action)}
          </Button>
        )}
      </div>
    </header>
  );
}
