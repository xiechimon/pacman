// Schedules route (issue #71): empty state pixel-bound to r7 11 (probe
// geometry: 768px centered column at x456, 48px tile @ y84, 75×30 primary
// @ y228), list card from r3 93, 新建定时 dialog from r3 92/92b with the
// 02 §9.2 copy canon (频率 tabs, 00/15/30/45 minute steps, tz note).
// #83 (M5): live 分支——列表 = GET /api/schedules 真值（SSE todo 事件联动
// 失效），新建 dialog 可交互（受控 tab/时/分 → POST /api/schedules，02 §9.2
// 触发闭环由 server Scheduler 兑现）；fixture 分支（r7 11/r3 92/93 行）不变。
// #306 接真：卡片「更多」钮开 per-card 菜单（anchored-overlay 家族律：Esc +
// 外点关）。菜单内容 [设计]——原站 sched 卡菜单内容未观测（r3 §9 仅录卡面），
// 唯一行「删除」沿 DELETE /api/schedules/:id 全链（route/service/web mutation
// 均已建、此前无 UI 入口）；删除走 DeleteConfirm 家族确认弹层。fixture 面
// 删除走 deletions.ts 覆面（session 局部），live 面走 mutation。
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApiMutations, useProjects, useSchedules, useTodos } from '../api/hooks.js';
import { mapSchedules, toDisplayTodo } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { Button } from '../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu.js';
import { Select } from '../components/ui/select.js';
import { toastError } from '../components/ui/toaster.js';
import { markDeleted, withoutDeleted } from '../fixtures/deletions.js';
import type { FixtureSet, ScheduleRecord } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import type { TFunc } from '../i18n/translate.js';
import {
  ChevronRight,
  Clock,
  EllipsisVertical,
  Lock,
  PlusSmall,
  Server,
  Trash2,
} from '../icons/index.js';
import { DeleteConfirm } from '../overlay/delete-confirm.js';
import { PHASE_UI } from '../phase.js';
import {
  GHOST_SEG_BTN_CLS,
  PAGE_COL_CLS,
  SEG_GROUP_CLS,
  SEG_TAB_ACTIVE_CLS,
  SEG_TAB_CLS,
  SEG_TAB_IDLE_CLS,
} from './parts.js';
import { PageShell } from './shell.js';

/** Capture-timezone offset (+08:00) — same convention as board/rel-time.ts:
 *  wall-clock labels are formatted in the capture tz so fixture output never
 *  drifts with the runner locale (CI runs UTC). */
const TZ_OFFSET = 8 * 3_600_000;
const pad = (n: number) => String(n).padStart(2, '0');
const hourMinute = (ts: number) => {
  const d = new Date(ts + TZ_OFFSET);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
/** en month abbreviations for the dict template ([设计] — the en line
 *  shape has no observed canon). */
const EN_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const monthDay = (ts: number, t: TFunc) => {
  const d = new Date(ts + TZ_OFFSET);
  return t('{mo}月{d}日', {
    mo: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    monthShort: EN_MONTHS[d.getUTCMonth()] ?? '',
  });
};
/** r3 93 line 3 day word: same calendar day as the capture = 今天. */
const dayWord = (ts: number, now: number, t: TFunc) =>
  monthDay(ts, t) === monthDay(now, t) ? t('今天') : monthDay(ts, t);

/** 频率 tab words (02 §9.2 canon order). */
const FREQ_LABEL: Record<ScheduleRecord['kind'], string> = {
  hourly: '每小时',
  daily: '每天',
  weekly: '每周',
  once: '单次',
};
/** 分档 canon (02 §9.2 / r3 §9): four minute steps. Hours run 00–23. */
const MINUTE_STEPS = ['00', '15', '30', '45'];
const HOURS = Array.from({ length: 24 }, (_, h) => pad(h));

/** r3 93 line 2 per frequency; only 单次 was observed (r3 §9), the rest
 *  are [推断] from the 频率 tab words. */
const RUN_WORD: Record<ScheduleRecord['kind'], string> = {
  hourly: '每小时运行',
  daily: '每天运行',
  weekly: '每周运行',
  once: '运行一次',
};

/** 卡面 chip 的 tone→槽映射（原 .sched-card-chip--*）：五对 --chip-* 槽
 *  1:1 迁移；plan 与 idle 共用 idle 槽是本面既有裁决（r3 93 捕获的卡面
 *  chip 无 plan 紫档），不随 StatusChip 的正典槽位漂移——本 chip 是
 *  同名不同族 per-face 面（spec/22 §5.0），不走 §5.2 件。 */
const CHIP_TONE_CLS: Record<'idle' | 'plan' | 'confirm' | 'done' | 'failed', string> = {
  idle: 'bg-(--chip-idle-bg) text-(--chip-idle-fg)',
  plan: 'bg-(--chip-idle-bg) text-(--chip-idle-fg)',
  confirm: 'bg-(--chip-confirm-bg) text-(--chip-confirm-fg)',
  done: 'bg-(--chip-done-bg) text-(--chip-done-fg)',
  failed: 'bg-(--chip-failed-bg) text-(--chip-failed-fg)',
};

/** 24×24 icon 钮配方（原 .sched-card-more / .sched-form-close，老
 *  .btn--icon 正典值）：无边框/透明底/tertiary 墨/hover 提亮 secondary；
 *  ghost 件配方按七通道律中和。kebab 面另有 aria-expanded 通道（菜单开合
 *  时底色/墨色钉回静息值）与 pressed×hover 叠态提亮（= 旧 unlayered 规则序
 *  的等值）。 */
const ICON_BTN_24_CLS =
  'size-6 cursor-pointer rounded-none border-none bg-transparent p-0 text-(--text-tertiary) hover:bg-transparent hover:text-(--text-secondary) dark:hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-(--text-tertiary) aria-expanded:hover:text-(--text-secondary) font-normal leading-none active:not-aria-[haspopup]:translate-y-0';

/** 时/分/日期选择盒（#946 建局部壳；#952 回收进共享 Select 件——className
 *  透传位已落件上，本面几何走 triggerClassName/menuClassName 两位）：皮肤 =
 *  原 .sched-form-select 触发盒（fit-content / 32 高带框）等值 utility + 件
 *  共用盘/行外观（select.tsx SELECT_* 单源）+ 本面 min-width:100% 覆写。
 *  语义面（aria-haspopup/expanded、role=listbox/option、aria-selected、选中
 *  即关、Esc/外点关归 FloatingShell 家族律）全由件契约承载，integration 面的
 *  语义钩子（button[aria-label=时|分] + [role=listbox][aria-label] + option
 *  名）零漂移。 */
const SEL_TRIGGER_CLS =
  "h-8 w-fit min-w-14 cursor-pointer justify-start gap-1.5 border border-(--border) bg-transparent px-2 text-[13px] font-normal leading-[inherit] text-(--foreground) hover:bg-transparent hover:text-(--foreground) dark:hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-(--foreground) active:not-aria-[haspopup]:translate-y-0 [&_svg]:text-(--text-tertiary) [&_svg:not([class*='size-'])]:size-3";

function SchedSelect({
  value,
  options,
  label,
  menuLabel,
  triggerLabel,
  onPick,
}: {
  value: string;
  options: { value: string; label: string }[];
  /** 触发钮上的当前值文案。 */
  label: string;
  /** listbox 的可及名。 */
  menuLabel: string;
  /** 触发钮的可及名（值形如 `00` 的纯值控件必给）。 */
  triggerLabel: string;
  onPick: (value: string) => void;
}) {
  return (
    <Select
      value={value}
      options={options}
      label={label}
      menuLabel={menuLabel}
      triggerLabel={triggerLabel}
      triggerClassName={SEL_TRIGGER_CLS}
      menuClassName="min-w-full"
      onPick={(next) => {
        // 本面词表无清空档（unsetLabel 缺省）：null 不可达，窄回 string。
        if (next !== null) onPick(next);
      }}
    />
  );
}

function ScheduleCard({
  schedule,
  now,
  onDelete,
}: {
  schedule: ScheduleRecord;
  now: number;
  /** #306: opens the delete confirm (owned by the page so one dialog
   *  serves every card). */
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const ui = PHASE_UI[schedule.todo.phase];
  return (
    <div className="sched-card flex h-[92px] items-start rounded-none bg-(--secondary) p-4">
      <span className="flex size-7 flex-none items-center justify-center self-center rounded-none bg-(--surface-tertiary) text-(--text-secondary)">
        <Clock width={14} height={14} />
      </span>
      <div className="ml-6 min-w-0 flex-1">
        <div className="truncate text-[13px] leading-5 text-(--foreground)">{`#${schedule.todo.seqNum} ${schedule.todo.title}`}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs leading-[18px] text-(--text-secondary)">
          {`${monthDay(schedule.at, t)} ${hourMinute(schedule.at)} ${t(RUN_WORD[schedule.kind])}`}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs leading-[18px] text-(--text-tertiary)">
          {t('下次 {day} {time}', {
            day: dayWord(schedule.nextRunAt, now, t),
            time: hourMinute(schedule.nextRunAt),
          })}
          <span className="text-(--text-tertiary)">·</span>
          <Server width={12} height={12} />
          {schedule.machineId == null ? t('自动') : schedule.machineId}
          <span className="text-(--text-tertiary)">·</span>
          {schedule.todo.projectName}
        </div>
      </div>
      <span
        className={`mr-3 flex-none rounded-[6px] px-2 py-0.5 text-xs leading-4 ${CHIP_TONE_CLS[ui.tone]}`}
      >
        {t(ui.chip)}
      </span>
      {/* t-0070 收编：手搓 role=menu 面 → components/ui/dropdown-menu（Base UI
          Menu，本仓首个消费点）。开合/Esc/外点关（modal 默认档 = 外点不穿透，
          ClickCatcher 家族律同语义）/焦点归还全归原语；aria-haspopup、
          aria-expanded 由 Trigger/Root 自动挂。皮肤正本仍在 per-face
          .sched-card-more（24×24 几何）与 .sched-card-menu*（160 宽/4 内边距/
          popover 底/圆角/fab 影/删除行 --stop 墨）；定位正本从 CSS inset 迁到
          Positioner 参数（side=bottom align=end sideOffset=4 = 原
          top:calc(100%+4px) right:0）。行 svg 的 size-auto 中和 base 强制
          size-4，保 Trash2 的 13px 属性尺寸（#607 机理）。 */}
      <span className="relative flex">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className={`sched-card-more ${ICON_BTN_24_CLS}`}
                aria-label={t('更多')}
              />
            }
          >
            <EllipsisVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={4}
            aria-label={t('更多')}
            className="sched-card-menu w-40 rounded-(--radius-popover) bg-(--popover) p-1 shadow-(--fab-shadow) ring-0 [&_svg:not([class*='size-'])]:size-auto"
          >
            {/* 行皮肤（原 .sched-card-menu-row[data-action=delete]）：--stop 墨
                + hover danger 淡 tint（#791 §1.1）；行面无静息 hover 涂底，
                focus:bg 中和回透明；键盘 roving focus 环按 #388 配方补钉
                （div[role=menuitem] 不在全局环名单）。 */}
            <DropdownMenuItem
              className="sched-card-menu-row h-8 w-full cursor-pointer gap-2.5 rounded-[8px] px-3 py-0 text-left text-xs leading-4 text-(--destructive) hover:bg-(--danger-soft) hover:text-(--destructive) focus:bg-transparent focus:text-(--destructive) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) [&_svg]:text-(--destructive)"
              data-action="delete"
              onClick={onDelete}
            >
              <Trash2 width={13} height={13} />
              {t('删除')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  );
}

/** r3 92/92b dialog. Field values ride the fixture (project + first todo);
 *  the open tab is the scenario's capture state. M5 live 面：`live` 绑定使
 *  tab/时/分受控、保存接真 mutation（DOM 类名与几何不变）。
 *  #388/#1008：全屏族——壳 = registry Dialog（modal 原生背板盖全视口，
 *  Esc / 背板点击 / X / 取消 四路关闭全归原语，Base UI layer 栈；旧手搓
 *  scrim + --z-modal-scrim 档 + fade-only 律随 #983 族拆退役，动效归
 *  registry 默认，#991 Q9）。open/onClose 由页面持有：live 面 = formOpen
 *  真值，fixture 冻结开屏面 = 局部 UI 态（关闭不销毁 scenario，重载还原
 *  ——deletions.ts 覆面同律）。 */
function ScheduleForm({
  kind,
  fixture,
  open,
  onClose,
  live,
}: {
  kind: 'hourly' | 'daily' | 'weekly' | 'once';
  fixture: FixtureSet;
  open: boolean;
  onClose: () => void;
  live?: {
    hour: string;
    minute: string;
    todo: { seqNum: number; title: string } | undefined;
    repo: string;
    onKind(kind: 'hourly' | 'daily' | 'weekly' | 'once'): void;
    onHour(hour: string): void;
    onMinute(minute: string): void;
    onSave(): void;
  };
}) {
  const { t } = useI18n();
  // #1008：Esc 归 registry Dialog（Base UI layer 栈）。
  // 时/分现在是受控选择器（XMON-75），fixture 面没有后端，落局部态承载「选了
  // 就回显」——live 面照旧走 live.hour/onHour。
  const [fixtureHour, setFixtureHour] = useState('09');
  const [fixtureMinute, setFixtureMinute] = useState('00');
  const hour = live ? live.hour : fixtureHour;
  const minute = live ? live.minute : fixtureMinute;
  const onHour = live ? live.onHour : setFixtureHour;
  const onMinute = live ? live.onMinute : setFixtureMinute;
  const todo = live ? live.todo : fixture.todos[0];
  const repo = live ? live.repo : (fixture.project?.repoName ?? '');
  return (
    // #1008（#983 判决：居中 fixed 模态族 → registry Dialog）：壳 =
    // Dialog + DialogContent（modal 原生背板 = 外点只关不穿透，旧手搓
    // scrim + target 判定退役；Esc/X 关归原语，旧 sched-form-close 手写 X
    // 退役 = registry showCloseButton 承载）。头带（h-46 border-b）→
    // DialogHeader/DialogTitle 语义映射；488 宽是内容 layout 槽。别名
    // sched-form-overlay / sched-form-close 随壳退役（e2e 重钉面，相位二）。
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="w-[488px] max-w-[488px] gap-0 overflow-hidden p-0 sm:max-w-[488px]">
        <DialogHeader className="border-b border-(--border) px-4 py-3">
          <DialogTitle>{t('新建定时')}</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          {/* 行盒（原 .sched-form-row）：36 高带框行；首行不带头顶距
                （原 .sched-form-body > :first-child 规则）。 */}
          <div className="flex h-9 items-center justify-between rounded-lg border border-(--border) px-3">
            <span className="text-[13px] leading-5 text-(--text-secondary)">{t('项目')}</span>
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-(--foreground) [&_svg]:flex-none [&_svg]:text-(--text-tertiary)">
              {repo}
              <ChevronRight width={12} height={12} />
            </span>
          </div>
          <div className="mt-3 flex h-9 items-center justify-between rounded-lg border border-(--border) px-3">
            <span className="text-[13px] leading-5 text-(--text-secondary)">{t('任务')}</span>
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-(--foreground) [&_svg]:flex-none [&_svg]:text-(--text-tertiary)">
              {todo == null ? '' : `#${todo.seqNum} ${todo.title}`}
              <ChevronRight width={12} height={12} />
            </span>
          </div>
          <div className={`sched-form-freq mt-3 w-fit ${SEG_GROUP_CLS}`}>
            {(['hourly', 'daily', 'weekly', 'once'] as const).map((k) => (
              // XMON-25 收编：ghost；#946：13/24 字体与几何迁 SEG_* 配方
              // （#138 发丝环家族），--active 类名留存 = segmented-controls
              // 跨域别名，选中皮肤 = tab-chip 填充 utility。
              <Button
                key={k}
                variant="ghost"
                className={`sched-form-freq-tab ${SEG_TAB_CLS} ${GHOST_SEG_BTN_CLS} ${
                  k === kind
                    ? `sched-form-freq-tab--active ${SEG_TAB_ACTIVE_CLS}`
                    : SEG_TAB_IDLE_CLS
                }`}
                onClick={live ? () => live.onKind(k) : undefined}
              >
                {t(FREQ_LABEL[k])}
              </Button>
            ))}
          </div>
          {kind === 'once' && (
            <>
              <div className="mt-4 mb-2.5 text-[13px] leading-5 text-(--text-secondary)">
                {t('日期')}
              </div>
              <div>
                {/* r3 92b observes 今天; further entries unrecorded——单候选，
                      故值就地取 t()（每渲染现取，locale 切换自然跟上，不带
                      #74 那种「无控 select 重挂」）。 */}
                <SchedSelect
                  value={t('今天')}
                  options={[{ value: t('今天'), label: t('今天') }]}
                  label={t('今天')}
                  menuLabel={t('日期')}
                  triggerLabel={t('日期')}
                  onPick={() => undefined}
                />
              </div>
            </>
          )}
          <div className="mt-4 mb-2.5 text-[13px] leading-5 text-(--text-secondary)">
            {t('时间')}
          </div>
          {/* hour at column left, minute at column center (r3 92 probe) */}
          <div className="grid grid-cols-2">
            <SchedSelect
              value={hour}
              options={HOURS.map((h) => ({ value: h, label: h }))}
              label={hour}
              menuLabel={t('时')}
              triggerLabel={t('时')}
              onPick={onHour}
            />
            <SchedSelect
              value={minute}
              options={MINUTE_STEPS.map((m) => ({ value: m, label: m }))}
              label={minute}
              menuLabel={t('分')}
              triggerLabel={t('分')}
              onPick={onMinute}
            />
          </div>
          <div className="mt-3 mb-1 text-xs leading-4 text-(--text-tertiary)">
            {t('按你的本地时区运行（Asia/Shanghai）')}
          </div>
          <div className="mt-3 flex h-9 items-center justify-between rounded-lg border border-(--border) px-3">
            <span className="text-[13px] leading-5 text-(--text-secondary)">{t('机器')}</span>
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-(--foreground) [&_svg]:flex-none [&_svg]:text-(--text-tertiary)">
              {t('自动')}
              <ChevronRight width={12} height={12} />
            </span>
          </div>
        </div>
        {/* 页脚 → DialogFooter 语义映射（registry 官网形态自带 border-t +
                muted 带；旧「无带 justify-end」是 per-face 皮肤，#991 Q9
                registry 默认赢，负 margin 归零适配 p-0 内容列）。取消 =
                ghost（surface-secondary 底皮按七通道律钉回静息值），保存 =
                default（等价迁移位）。 */}
        <DialogFooter className="m-0 px-4 py-3">
          <Button
            variant="ghost"
            className="sched-form-cancel h-[30px] cursor-pointer border-none bg-(--secondary) px-4 text-[13px] font-normal leading-[inherit] text-(--text-secondary) hover:bg-(--secondary) hover:text-(--text-secondary) dark:hover:bg-(--secondary) active:not-aria-[haspopup]:translate-y-0"
            onClick={onClose}
          >
            {t('取消')}
          </Button>
          <Button
            className="h-[30px] cursor-pointer border-none px-4 text-[13px] font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0"
            onClick={live?.onSave}
          >
            {t('保存')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SchedulesPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const { live, teamId } = useLiveData();
  const schedulesQ = useSchedules(live);
  const todosQ = useTodos(teamId, live);
  const projectsQ = useProjects(teamId, live);
  const mutations = useApiMutations(teamId);
  // live 表单态（fixture 面由 scenario 冻结 scheduleForm，互不干扰）。
  const [formOpen, setFormOpen] = useState(false);
  // #388 fixture 冻结开屏面的关闭态：局部 UI 状态，重载还原（deletions.ts
  // 覆面同律）——Esc / 背板 / X / 取消 四路关闭在冻结面上同样成立。
  const [fixtureFormOpen, setFixtureFormOpen] = useState(true);
  const [formKind, setFormKind] = useState<'hourly' | 'daily' | 'weekly' | 'once'>('daily');
  const [formHour, setFormHour] = useState('09');
  const [formMinute, setFormMinute] = useState('00');
  const schedules = withoutDeleted(
    live ? mapSchedules(schedulesQ.data ?? []) : (fixture.schedules ?? []),
  );
  const now = live ? Date.now() : fixture.now;
  // #306 删除确认：target 与 open 分离——退出动画期摘要行保内容（todo 删除
  // 同律），重开换 target 即换摘要。
  const [deleteTarget, setDeleteTarget] = useState<ScheduleRecord | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const liveTodos = (todosQ.data ?? []).map(toDisplayTodo);
  const liveTodo = todosQ.data?.[0];
  const saveSchedule = () => {
    if (!liveTodo) {
      setFormOpen(false);
      return;
    }
    // at = 本地时区今日 hh:mm（02 §9.2：tz = Intl 解析值，server 侧同口径；
    // 周期档 nextRunAt 由 server computeNextRunAt 滚动，once 触发后出队）。
    const base = new Date();
    base.setHours(Number(formHour), Number(formMinute), 0, 0);
    if (formKind === 'once' && base.getTime() < Date.now()) {
      base.setDate(base.getDate() + 1); // 单次已过点 = 明日同刻 [设计]
    }
    mutations.createSchedule.mutate(
      {
        todoId: liveTodo.id,
        projectId: liveTodo.projectId,
        kind: formKind,
        at: base.getTime(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        machineId: null,
      },
      // #638：表单提交即关（下方 setFormOpen），失败 = 定时没建上却零解释。
      { onError: (error) => toastError(t('新建定时失败，请重试。'), error) },
    );
    setFormOpen(false);
  };
  return (
    <PageShell
      fixture={live ? { ...fixture, todos: liveTodos } : fixture}
      selected="schedules"
      title="定时"
      action={
        // XMON-25 收编：ghost；#946：品牌墨 14/22 与零内距迁 utility 配方
        // （七通道中和——旧 per-face 的 bg/color 简写恒压 hover 档的等值）。
        // h-auto 保 22px 内容高（base h-8 会撑高顶栏钮）；size-auto 保
        // PlusSmall 的 13px 属性尺寸（base 会强制 16）。page-new-action
        // 类名留存 = overlay-focus 跨域别名。
        <Button
          variant="ghost"
          className="page-new-action h-auto cursor-pointer gap-1 rounded-none border-none bg-transparent p-0 text-sm leading-[22px] font-normal text-(--card-button) hover:bg-transparent hover:text-(--card-button) dark:hover:bg-transparent active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
          onClick={live ? () => setFormOpen(true) : undefined}
        >
          <PlusSmall width={13} height={13} />
          {t('新建')}
        </Button>
      }
    >
      <div className={`${PAGE_COL_CLS} space-y-3 pt-10`}>
        {schedules.length === 0 ? (
          <div className="sched-empty">
            <div className="flex size-12 items-center justify-center rounded-none bg-(--secondary) text-(--text-secondary)">
              <Clock width={26} height={26} />
            </div>
            {/* sched-empty-title 类名留存 = accent-typo 字重探针的跨域别名。 */}
            <div className="sched-empty-title mt-5 text-sm font-semibold leading-5 text-(--foreground)">
              {t('尚无定时。')}
            </div>
            <p className="mt-3 max-w-[448px] text-[13px] leading-5 text-(--text-tertiary)">
              {t(
                '按周期或在指定时间自动重新运行任务。每一轮都会依据任务描述从头开始一次全新运行，到达确认或审核关口时暂停，交由负责人接手。',
              )}
            </p>
            <div className="mt-5 flex items-center">
              {/* XMON-25 收编：default（等价迁移位）；75×30
                  几何与 cursor 迁 utility。sched-empty-new 类名留存 =
                  dead-buttons 跨域别名。 */}
              <Button
                className="sched-empty-new h-[30px] w-[75px] cursor-pointer rounded-none border-none p-0 text-[13px] font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0"
                onClick={live ? () => setFormOpen(true) : undefined}
              >
                {t('新建定时')}
              </Button>
              {/* 「查看文档」钮全除（#149 wontfix）：local-first 自托管无
                  文档站可链（官方链接对象不可观测），README 指向上游代码库
                  与产品语义无关——隐去，台账 #136 勾兑登记。 */}
            </div>
            <div className="mt-[19px] flex items-center gap-1.5 text-xs leading-4 text-(--text-tertiary)">
              {/* the r7 icon dump names the bulb markup Lock (#49a224ab53) */}
              <Lock width={12} height={12} />
              <span>{t('也可以直接告诉总管某个任务要多久重跑一次，它会替你写好规则。')}</span>
            </div>
          </div>
        ) : (
          schedules.map((s) => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              now={now}
              onDelete={() => {
                setDeleteTarget(s);
                setConfirmOpen(true);
              }}
            />
          ))
        )}
      </div>
      {live ? (
        <ScheduleForm
          kind={formKind}
          fixture={fixture}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          live={{
            hour: formHour,
            minute: formMinute,
            todo: liveTodo ? { seqNum: liveTodo.seqNum, title: liveTodo.title } : undefined,
            repo: projectsQ.data?.[0]?.name ?? '',
            onKind: setFormKind,
            onHour: setFormHour,
            onMinute: setFormMinute,
            onSave: saveSchedule,
          }}
        />
      ) : (
        fixture.scheduleForm != null && (
          <ScheduleForm
            kind={fixture.scheduleForm}
            fixture={fixture}
            open={fixtureFormOpen}
            onClose={() => setFixtureFormOpen(false)}
          />
        )
      )}
      <DeleteConfirm
        open={confirmOpen}
        title={t('确定删除该定时？此操作不可撤销。')}
        summary={
          deleteTarget != null ? (
            <>
              <span className="delete-confirm-seq text-(--text-tertiary)">
                #{deleteTarget.todo.seqNum}
              </span>
              {deleteTarget.todo.title}
            </>
          ) : null
        }
        ariaLabel={t('删除定时')}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (deleteTarget == null) return;
          // live = DELETE /api/schedules/:id（invalidateAll 重取）；fixture =
          // deletions 覆面（session 局部，重载还原）——todo 删除同律。
          if (live)
            mutations.deleteSchedule.mutate(deleteTarget.id, {
              // #638：确认层已关，失败 = 行还在却零解释。
              onError: (error) => toastError(t('删除定时失败，请重试。'), error),
            });
          else markDeleted(deleteTarget.id);
          setConfirmOpen(false);
        }}
      />
    </PageShell>
  );
}
