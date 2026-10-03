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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu.js';
import { FloatingShell } from '../components/ui/floating-shell.js';
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
  X,
} from '../icons/index.js';
import { DeleteConfirm } from '../overlay/delete-confirm.js';
import { PHASE_UI } from '../phase.js';
import { PageShell } from './shell.js';
import './pages.css';

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
    <div className="sched-card">
      <span className="sched-card-tile">
        <Clock width={14} height={14} />
      </span>
      <div className="sched-card-body">
        <div className="sched-card-title">{`#${schedule.todo.seqNum} ${schedule.todo.title}`}</div>
        <div className="sched-card-line">
          {`${monthDay(schedule.at, t)} ${hourMinute(schedule.at)} ${t(RUN_WORD[schedule.kind])}`}
        </div>
        <div className="sched-card-line sched-card-line--dim">
          {t('下次 {day} {time}', {
            day: dayWord(schedule.nextRunAt, now, t),
            time: hourMinute(schedule.nextRunAt),
          })}
          <span className="sched-card-sep">·</span>
          <Server width={12} height={12} />
          {schedule.machineId == null ? t('自动') : schedule.machineId}
          <span className="sched-card-sep">·</span>
          {schedule.todo.projectName}
        </div>
      </div>
      <span className={`sched-card-chip sched-card-chip--${ui.tone}`}>{t(ui.chip)}</span>
      {/* t-0070 收编：手搓 role=menu 面 → components/ui/dropdown-menu（Base UI
          Menu，本仓首个消费点）。开合/Esc/外点关（modal 默认档 = 外点不穿透，
          ClickCatcher 家族律同语义）/焦点归还全归原语；aria-haspopup、
          aria-expanded 由 Trigger/Root 自动挂。皮肤正本仍在 per-face
          .sched-card-more（24×24 几何）与 .sched-card-menu*（160 宽/4 内边距/
          popover 底/圆角/fab 影/删除行 --stop 墨）；定位正本从 CSS inset 迁到
          Positioner 参数（side=bottom align=end sideOffset=4 = 原
          top:calc(100%+4px) right:0）。行 svg 的 size-auto 中和 base 强制
          size-4，保 Trash2 的 13px 属性尺寸（#607 机理）。 */}
      <span className="sched-more-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="sched-card-more font-normal leading-none"
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
            className="sched-card-menu [&_svg:not([class*='size-'])]:size-auto"
          >
            <DropdownMenuItem
              className="sched-card-menu-row"
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
 *  #388：全屏族——scrim 盖全视口（z 归 dialog 族档，pages.css）、Esc / 背板
 *  点击 / X / 取消 四路关闭（家族律 #67/#68；Esc 经 FloatingShell 的 Base UI
 *  layer 栈）。#656：进出场归 tw-animate-css——scrim 走 group-data-open/closed
 *  的 fade（居中弹层 fade-only 律，与 dialog 族同档 duration-200）。
 *  open/onClose 由页面持有：live 面 = formOpen 真值，fixture 冻结
 *  开屏面 = 局部 UI 态（关闭不销毁 scenario，重载还原——deletions.ts
 *  覆面同律）。 */
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
  // #656：Esc 归 FloatingShell（Base UI layer 栈），旧 useEscapeClose 退役。
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
    <FloatingShell
      open={open}
      onClose={onClose}
      className="anchored-pop-shell anchored-pop-shell--slow"
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes — see comment */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop is a click-to-dismiss surface */}
      <div
        className="sched-form-overlay duration-200 group-data-closed/fshell:fill-mode-forwards group-data-open/fshell:animate-in group-data-open/fshell:fade-in-0 group-data-closed/fshell:animate-out group-data-closed/fshell:fade-out-0"
        onClick={(event) => {
          // only the backdrop itself dismisses; panel clicks bubble harmlessly
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="sched-form" role="dialog" aria-modal="true" aria-label={t('新建定时')}>
          <header className="sched-form-head">
            <span className="sched-form-title">{t('新建定时')}</span>
            {/* XMON-25 收编：老 ui/Button icon 变体 → ghost + size icon；皮肤
                下沉 per-face .sched-form-close；24×24 几何留 pages.css。
                无 haspopup → active 位移需中和位。 */}
            <Button
              variant="ghost"
              size="icon"
              className="sched-form-close font-normal leading-none active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
              aria-label={t('关闭')}
              onClick={onClose}
            >
              <X />
            </Button>
          </header>
          <div className="sched-form-body">
            <div className="sched-form-row">
              <span className="sched-form-label">{t('项目')}</span>
              <span className="sched-form-value">
                {repo}
                <ChevronRight width={12} height={12} />
              </span>
            </div>
            <div className="sched-form-row">
              <span className="sched-form-label">{t('任务')}</span>
              <span className="sched-form-value">
                {todo == null ? '' : `#${todo.seqNum} ${todo.title}`}
                <ChevronRight width={12} height={12} />
              </span>
            </div>
            <div className="sched-form-freq">
              {(['hourly', 'daily', 'weekly', 'once'] as const).map((k) => (
                // XMON-25 收编：ghost；13/24 字体与几何正本在 per-face，
                // --active chip 与 seg-hover 媒体块 unlayered 恒胜。
                <Button
                  key={k}
                  variant="ghost"
                  className={`sched-form-freq-tab font-normal active:not-aria-[haspopup]:translate-y-0${
                    k === kind ? ' sched-form-freq-tab--active' : ''
                  }`}
                  onClick={live ? () => live.onKind(k) : undefined}
                >
                  {t(FREQ_LABEL[k])}
                </Button>
              ))}
            </div>
            {kind === 'once' && (
              <>
                <div className="sched-form-field">{t('日期')}</div>
                <div className="sched-form-selects">
                  {/* r3 92b observes 今天; further entries unrecorded——单候选，
                      故值就地取 t()（每渲染现取，locale 切换自然跟上，不带
                      #74 那种「无控 select 重挂」）。 */}
                  <Select
                    prefix="sched-form"
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
            <div className="sched-form-field">{t('时间')}</div>
            <div className="sched-form-selects sched-form-selects--time">
              <Select
                prefix="sched-form"
                value={hour}
                options={HOURS.map((h) => ({ value: h, label: h }))}
                label={hour}
                menuLabel={t('时')}
                triggerLabel={t('时')}
                onPick={(next) => {
                  if (next !== null) onHour(next);
                }}
              />
              <Select
                prefix="sched-form"
                value={minute}
                options={MINUTE_STEPS.map((m) => ({ value: m, label: m }))}
                label={minute}
                menuLabel={t('分')}
                triggerLabel={t('分')}
                onPick={(next) => {
                  if (next !== null) onMinute(next);
                }}
              />
            </div>
            <div className="sched-form-tz">{t('按你的本地时区运行（Asia/Shanghai）')}</div>
            <div className="sched-form-row">
              <span className="sched-form-label">{t('机器')}</span>
              <span className="sched-form-value">
                {t('自动')}
                <ChevronRight width={12} height={12} />
              </span>
            </div>
          </div>
          <footer className="sched-form-foot">
            {/* XMON-25 收编：取消 = ghost（per-face bg 简写压掉 hover 档），
                保存 = brand（--card-button 实底的等价迁移位）。 */}
            <Button
              variant="ghost"
              className="sched-form-cancel font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0"
              onClick={onClose}
            >
              {t('取消')}
            </Button>
            <Button
              variant="brand"
              className="sched-form-save font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0"
              onClick={live?.onSave}
            >
              {t('保存')}
            </Button>
          </footer>
        </div>
      </div>
    </FloatingShell>
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
        // XMON-25 收编：ghost；indigo 14/22 墨色与 padding 0 正本在 per-face。
        // h-auto 保 22px 内容高（base h-8 会撑高顶栏钮）；size-auto 保
        // PlusSmall 的 13px 属性尺寸（base 会强制 16）。
        <Button
          variant="ghost"
          className="page-new-action h-auto rounded-none font-normal active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
          onClick={live ? () => setFormOpen(true) : undefined}
        >
          <PlusSmall width={13} height={13} />
          {t('新建')}
        </Button>
      }
    >
      <div className="page-col schedules-body">
        {schedules.length === 0 ? (
          <div className="sched-empty">
            <div className="sched-empty-tile">
              <Clock width={26} height={26} />
            </div>
            <div className="sched-empty-title">{t('尚无定时。')}</div>
            <p className="sched-empty-desc">
              {t(
                '按周期或在指定时间自动重新运行任务。每一轮都会依据任务描述从头开始一次全新运行，到达确认或审核关口时暂停，交由负责人接手。',
              )}
            </p>
            <div className="sched-empty-actions">
              {/* XMON-25 收编：brand（--card-button 实底等价迁移位）；75×30
                  几何与 cursor 正本在 per-face。 */}
              <Button
                variant="brand"
                className="sched-empty-new font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0"
                onClick={live ? () => setFormOpen(true) : undefined}
              >
                {t('新建定时')}
              </Button>
              {/* 「查看文档」钮全除（#149 wontfix）：local-first 自托管无
                  文档站可链（官方链接对象不可观测），README 指向上游代码库
                  与产品语义无关——隐去，台账 #136 勾兑登记。 */}
            </div>
            <div className="sched-empty-hint">
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
              <span className="delete-confirm-seq">#{deleteTarget.todo.seqNum}</span>
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
