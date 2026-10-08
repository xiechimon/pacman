// Detail header (issue #56, r7 §3.3): back button, #seq, status chip, the
// 更多 icon and the 50.5×28 primary button. #366 stripped the centered
// 文档|聊天 tab group (the route is a 3-pane layout now) and the
// 分支与 PR/Token 用量/运行历史 icon trio (static right-pane sections).
// #58: the back button carries the current search string home so the
// dev/fixture ?scenario= selection survives the round trip; the board
// scroll position is restored by BoardSurface from sessionStorage.
// #67: the chip is a real button — it toggles the status popover (r7
// 19/29), and the chevron rides outside the pill (r7 17 measure).

import { type Ref, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Button } from '../components/ui/button.js';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover.js';
import { StatusChip } from '../components/ui/status-chip.js';
import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown, ChevronLeft, EllipsisVertical } from '../icons/index.js';
import { ChipPopover } from '../overlays/chip-popover.js';
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
  /** #1008: 更多 钮的定位锚 ref（MoreMenu 迁 DropdownMenu 后触发钮与菜单体
   *  分住两层，页面层持 ref 双投：这里挂到钮上，Content 走 anchor）。 */
  moreButtonRef?: Ref<HTMLButtonElement>;
}

export function DetailHead({
  todo,
  phase,
  onMore,
  onAction,
  chipPopoverOpen,
  onEditAssign,
  reviewActive,
  moreButtonRef,
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
  return (
    <header
      className="detail-head relative flex h-11 flex-none items-center border-b border-(--border) pl-3"
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
      <span className="relative flex items-center">
        {/* #1008（#983 判决：floating-shell 族拆退役，锚定 absolute 族 →
            registry Popover）：chip 钮 = PopoverTrigger（toggle/aria-expanded
            归原语，#666 双写 state 竞态的根因随之消失）；面板定位从 wrap
            container + absolute CSS 迁 Positioner 参数（side=bottom
            align=start alignOffset=-18 sideOffset=8 = 原「chip 左缘 −18、
            底缘 +8」捕获几何）。initialFocus=false 保 #666 键盘契约（焦点
            留触发钮，同一个键再按一次关面）。外点关走 Base UI 原生
            outside-press（ClickCatcher 退役——穿透与否 = #983 遗留待原型
            实审裁决项）。触发钮皮肤照旧（#945 utility 七通道中和；
            .detail-chip 别名保留，chip-assign/chip-hotzone/integration m5
            按它定位）。#634: chevron 在触发钮内——整只 chip 一个热区。 */}
        <Popover open={popover} onOpenChange={setPopover}>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                data-testid="phase-chip"
                className="detail-chip ml-2 flex h-auto flex-none cursor-pointer items-center gap-0 border-none bg-transparent p-0 text-[length:inherit] leading-[inherit] font-normal hover:bg-transparent hover:text-inherit dark:hover:bg-transparent dark:hover:text-inherit aria-expanded:bg-transparent aria-expanded:text-inherit active:not-aria-[haspopup]:translate-y-0"
              />
            }
          >
            <StatusChip tone={ui.tone} className="shrink-0 whitespace-nowrap">
              {t(ui.chip)}
            </StatusChip>
            {/* #949: chevron 皮肤等值迁 utility。testid = 二级载体
                （chip-hotzone 的 H1 热区钉扎位，#910 裁定 1）。 */}
            <span
              className="ml-[5px] flex flex-none text-(--text-tertiary)"
              data-testid="chip-chevron"
            >
              <ChevronDown width={12} height={12} />
            </span>
          </PopoverTrigger>
          {/* 298 宽 = 捕获设计的内容 layout 槽（#983 宽度归消费点判例）；
              皮肤/圆角/描边/投影/Arrow 归 PopoverContent 默认（#991 Q9）。 */}
          <PopoverContent
            side="bottom"
            align="start"
            alignOffset={-18}
            sideOffset={8}
            initialFocus={false}
            aria-label={t('任务分配')}
            className="w-[298px]"
          >
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
          </PopoverContent>
        </Popover>
      </span>

      {/* XMON-55 P1: the head carries the task subject. Without it the only
          way to tell which task the page belongs to was to read the thread's
          taskline — the head showed an id and a status word and nothing to
          attach them to. Ellipsised, never wrapped: the head is a fixed 44px
          band. */}
      <span
        className="detail-title ml-3.5 min-w-0 flex-1 truncate text-[15px] leading-5 font-semibold text-(--foreground)"
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
          ref={moreButtonRef}
          className={`detail-head-icon detail-head-icon--more ${ICON_BTN} [&_svg:not([class*='size-'])]:size-auto`}
          aria-label={t('更多')}
          onClick={onMore}
        >
          <EllipsisVertical />
        </Button>
        {ui.action != null && (
          <Button
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
