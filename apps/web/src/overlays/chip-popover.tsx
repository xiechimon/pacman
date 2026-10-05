// Status-chip popover (issue #67, r7 19 / 29): 298×193 panel anchored under
// the detail-header chip (left = chip − 18, top = chip bottom + 3.5, r7
// §3.5 @ (287,34.5)). Structure verbatim from the captures: project head
// (12px avatar + name + #seq), two-line title, divider, 任务 section
// (assignee row), the selected 执行对话 section (agent row + indigo check,
// the highlight covering label and row), divider, 编辑分配 row.
// #949: overlays.css 清零——V2 弹层壳（#790 P3：12px 内边距 / 1px 墨线框 /
// 圆角 0）与 12×6 描边 Arrow（双层 clip-path 三角）等值迁 utility；锚定
// relative 位在被锚 wrap（dhead 的 chipwrap utility）；皮肤选择子零残留。
// 选中 section 的状态载体 = data-selected（#910 裁定 3）；两行是纯展示
// div（无 role），行族载体 = data-row-kind（owner/agent，头像 spec 的
// 语义盲区继任者）。

import { useAgentAvatarUrlById, useLiveData } from '../api/provider.js';
import { Button } from '../components/ui/button.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import { AGENT_MODEL_LINE, PROJECT_INITIAL, PROJECT_NAME } from '../fixtures/fixtures.js';
import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { Check, Settings } from '../icons/index.js';

/** 行皮肤（旧 .chip-popover-row 等值）：26px 行 / 10px 列距 / 右垫 4px /
 *  12px 字三级墨；hover 淡 tint = motion.css #73 家族的 --accent-soft 同值
 *  （150ms 背景过渡同档，行随 #949 退出该选择子族、utility 自持）；头像
 *  img 12px 圆形。 */
const POPOVER_ROW =
  'flex h-[26px] items-center gap-2.5 pr-1 text-xs leading-4 text-(--text-tertiary) transition-[background-color] duration-150 hover:bg-(--accent-soft) [&_img]:size-3 [&_img]:flex-none [&_img]:rounded-full';

const SECTION_LABEL = 'p-0 text-[11px] leading-3 font-medium text-(--text-primary)';

export function ChipPopover({ todo, onEditAssign }: ChipPopoverProps) {
  const { t } = useI18n();
  // XMON-105: the 任务 (owner) row shows the logged-in user's own identity
  // avatar — single source, same face as the sidebar chip / account head.
  const { user } = useLiveData();
  const agentAvatarUrl = useAgentAvatarUrlById();
  return (
    <div
      className="absolute top-[calc(100%+8px)] -left-[18px] z-(--z-popover) flex h-[193px] w-[298px] flex-col overflow-visible rounded-none border border-(--border-default) bg-(--popover-bg) p-3 text-left shadow-(--fab-shadow) origin-top-left before:absolute before:top-px before:left-6 before:h-1.5 before:w-3 before:bg-(--border-default) before:[clip-path:polygon(0_100%,50%_0,100%_100%)] before:content-[''] after:absolute after:top-0.5 after:left-[25px] after:h-[5px] after:w-2.5 after:bg-(--popover-bg) after:[clip-path:polygon(0_100%,50%_0,100%_100%)] after:content-['']"
      role="dialog"
      aria-label={t('任务分配')}
    >
      <div className="flex items-center gap-2 pt-[5px]">
        <span className="flex size-3 flex-none items-center justify-center rounded-[4px] bg-(--project-avatar-bg) text-[8px] font-medium text-(--project-avatar-fg)">
          {PROJECT_INITIAL}
        </span>
        <span className="text-[11px] leading-3 text-(--text-tertiary)">{PROJECT_NAME}</span>
        {/* #序号墨 = --text-tertiary（#949 better-colors 换槽，search-panel
            时间列同判：--text-dim × --popover-bg 亮模 2.89 < 地板 3） */}
        <span className="text-[11px] leading-3 text-(--text-tertiary)">#{todo.seqNum}</span>
      </div>
      <div className="pt-[5px] pb-2 text-xs leading-4 text-(--text-primary)">{todo.title}</div>
      <div className="h-px flex-none bg-(--overlay-divider)" />
      <div className="flex-none pt-2">
        <div className={SECTION_LABEL}>{t('任务')}</div>
        <div className={POPOVER_ROW} data-row-kind="owner">
          <SeededAvatar name={user.displayName} src={user.avatarUrl} fallback="/avatar-user.png" />
          {user.displayName}
        </div>
      </div>
      <div className="flex-none bg-(--overlay-select-indigo) pt-2" data-selected="">
        <div className={SECTION_LABEL}>{t('执行对话')}</div>
        <div className={POPOVER_ROW} data-row-kind="agent">
          <SeededAvatar
            name={todo.agent?.displayName}
            src={todo.agent ? (agentAvatarUrl.get(todo.agent.id) ?? null) : null}
            fallback="/avatar-robot-1.svg"
          />
          {/* 未指派 fallback is [推断]: every capture shows an assigned agent */}
          {todo.agent?.displayName ?? t('未指派')} · {AGENT_MODEL_LINE}
          <span className="ml-auto flex text-(--card-button)">
            <Check width={14} height={14} />
          </span>
        </div>
      </div>
      <div className="h-px flex-none bg-(--overlay-divider)" />
      {/* #949: 旧 .chip-popover-edit 规则等值迁 utility——ghost 件配方全
          通道中和（hover/aria-expanded 涂底与墨色钉回三级墨、press 位移
          禁掉、1px 透明边归零、font-medium 归 normal），flex-1 吃满壳垫
          余高，gap 8px 保持图标与文案的 r7 列距。 */}
      <Button
        variant="ghost"
        size="default"
        className="h-auto flex-1 cursor-pointer justify-start gap-2 rounded-none border-none bg-transparent p-0 text-left text-xs leading-4 font-normal whitespace-normal text-(--text-tertiary) hover:bg-transparent hover:text-(--text-tertiary) dark:hover:bg-transparent dark:hover:text-(--text-tertiary) aria-expanded:bg-transparent aria-expanded:text-(--text-tertiary) active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
        onClick={onEditAssign}
      >
        <Settings width={14} height={14} />
        {t('编辑分配')}
      </Button>
    </div>
  );
}

interface ChipPopoverProps {
  todo: TodoRecord;
  /** #209「编辑分配」接线:点击开 agent 选择弹层(#182 家族形态);弹层挂
   *  在页层(popover 关即卸载,挂内层会被带走)。 */
  onEditAssign?: () => void;
}
