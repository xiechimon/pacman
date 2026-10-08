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
import { Card } from '../components/ui/card.js';
import {
  Dialog,
  DialogClose,
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../components/ui/empty.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select.js';
import { StatusChip } from '../components/ui/status-chip.js';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';
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
import { PAGE_COL_CLS } from './parts.js';
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

/** 表单行盒（项目/任务/机器 静息展示行）：36 高带框行，registry 几何
 *  （rounded-lg + border-input，input 族同款描边词汇）；布局位自持。 */
const FORM_ROW_CLS = 'flex h-9 items-center justify-between rounded-lg border border-input px-3';

/** 行右值槽：13/20 字改走 registry text-sm；chevron muted 墨。 */
const FORM_ROW_VALUE_CLS =
  'flex min-w-0 items-center gap-1.5 text-sm text-foreground [&_svg]:flex-none [&_svg]:text-muted-foreground';

/** 时/分/日期选择盒（#946 建局部壳；#952 回收进共享 Select 件；#1010 随件
 *  回源 = registry select compound 族，皮肤/几何归 registry 默认——旧
 *  SEL_TRIGGER_CLS 方角盒与 min-w-full 菜单覆写退役，ADR 0012 D1。本面只留
 *  min-w-14 布局位：两位数值 `00` 的触发盒保底宽）。语义面（触发钮 = button +
 *  aria-haspopup=listbox + aria-expanded + aria-controls→listbox、内层
 *  Select.List role=listbox、行 role=option + aria-selected、选中即关、Esc 关）
 *  全归 Base UI 原语，外点关 = 原生 outside-press（#1060 裁决①同律，穿透）。
 *  integration 面的语义钩子部分迁移（#735 教训，同 PR）：触发钮
 *  button[aria-label=时|分]（= triggerLabel，可及名 + aria-controls）与 option
 *  名零漂移；但 Base UI 把 role=listbox 放在内层 Select.List、SelectContent 的
 *  aria-label 落在 role=presentation 的外层 Popup（实测 listbox 的 aria-label
 *  恒 null），故 m5 的 `[role=listbox][aria-label]` 复合钩子迁成 `[role=listbox]`
 *  （同一时刻只开一个 select，无歧义）——pristine 件下不可达的钩子不硬留（违
 *  ADR 0012 D1）。menuLabel 仍传 SelectContent（registry 件的可及名入口，落
 *  Popup）。弹层 Portal 落 body，locator 页面级取。 */
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
      onValueChange={(next) => {
        // 本面词表无清空档（无 null item）：null 不可达，窄回 string。
        if (next !== null) onPick(next as string);
      }}
    >
      <SelectTrigger aria-label={triggerLabel} className="min-w-14">
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent aria-label={menuLabel}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
    <Card className="sched-card h-[92px] flex-row items-start p-4">
      <span className="flex size-7 flex-none items-center justify-center self-center rounded-lg bg-muted text-muted-foreground">
        <Clock width={14} height={14} />
      </span>
      <div className="ml-6 min-w-0 flex-1">
        <div className="truncate text-sm leading-5 text-foreground">{`#${schedule.todo.seqNum} ${schedule.todo.title}`}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs leading-[18px] text-muted-foreground">
          {`${monthDay(schedule.at, t)} ${hourMinute(schedule.at)} ${t(RUN_WORD[schedule.kind])}`}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs leading-[18px] text-muted-foreground">
          {t('下次 {day} {time}', {
            day: dayWord(schedule.nextRunAt, now, t),
            time: hourMinute(schedule.nextRunAt),
          })}
          <span aria-hidden="true">·</span>
          <Server width={12} height={12} />
          {schedule.machineId == null ? t('自动') : schedule.machineId}
          <span aria-hidden="true">·</span>
          {schedule.todo.projectName}
        </div>
      </div>
      {/* chip = StatusChip 适配层（#983 判决：五态 data-tone + 五对 token 槽
          单源）。旧卡面「plan 共用 idle 槽」的 per-face 折叠退役——五态映射
          归正典单源，plan 档随全站同色（原型实审点）。 */}
      <StatusChip tone={ui.tone} className="mr-3 flex-none">
        {t(ui.chip)}
      </StatusChip>
      {/* kebab 菜单：registry DropdownMenu 默认皮肤（手写盘/行配方退役），
          destructive 行 = 件语义档。开合/Esc/外点关/焦点归还全归原语；
          sched-card-more/-menu/-menu-row 别名留存（dead-buttons 跨域句柄）。 */}
      <span className="relative flex">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="sched-card-more cursor-pointer text-muted-foreground"
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
            className="sched-card-menu w-40"
          >
            <DropdownMenuItem
              variant="destructive"
              className="sched-card-menu-row cursor-pointer"
              data-action="delete"
              onClick={onDelete}
            >
              <Trash2 />
              {t('删除')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </Card>
  );
}

/** r3 92/92b dialog. Field values ride the fixture (project + first todo);
 *  the open tab is the scenario's capture state. M5 live 面：`live` 绑定使
 *  tab/时/分受控、保存接真 mutation。
 *  #983 判决执行（居中 fixed 模态族 → Dialog）：registry Dialog 直组——
 *  scrim/居中/进出场动效/X 关闭钮全归件默认；Esc / 背板点击 / X / 取消
 *  四路关闭语义保持（Base UI 原语承载，家族律 #67/#68 的机制位）。
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
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
    >
      {/* 关闭钮自携（aria-label 走 t('关闭')——registry 内建钮的 sr-only
          文案是英文硬编码，i18n 语义映射归消费点；形态与内建钮逐类同形，
          L3 dialog-shell 同款手法）。 */}
      <DialogContent className="w-[488px] sm:max-w-[488px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('新建定时')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className={FORM_ROW_CLS}>
            <span className="text-sm leading-5 text-muted-foreground">{t('项目')}</span>
            <span className={FORM_ROW_VALUE_CLS}>
              {repo}
              <ChevronRight width={12} height={12} />
            </span>
          </div>
          <div className={FORM_ROW_CLS}>
            <span className="text-sm leading-5 text-muted-foreground">{t('任务')}</span>
            <span className={FORM_ROW_VALUE_CLS}>
              {todo == null ? '' : `#${todo.seqNum} ${todo.title}`}
              <ChevronRight width={12} height={12} />
            </span>
          </div>
          {/* 频率分段 = registry Tabs default 档（手写 SEG_* 发丝环壳退役，
              #982 tabs 判决）；sched-form-freq(-tab) 别名留存
              （segmented-controls 跨域句柄），选中载体 = data-active。
              fixture 冻结面：受控 value 无 onValueChange = 点击不动。 */}
          <Tabs
            className="sched-form-freq w-fit gap-0"
            value={kind}
            {...(live
              ? { onValueChange: (next: unknown) => live.onKind(next as typeof kind) }
              : {})}
          >
            <TabsList>
              {(['hourly', 'daily', 'weekly', 'once'] as const).map((k) => (
                <TabsTrigger key={k} value={k} className="sched-form-freq-tab px-3">
                  {t(FREQ_LABEL[k])}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {kind === 'once' && (
            <>
              <div className="text-sm leading-5 text-muted-foreground">{t('日期')}</div>
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
          <div className="text-sm leading-5 text-muted-foreground">{t('时间')}</div>
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
          <div className="text-xs leading-4 text-muted-foreground">
            {t('按你的本地时区运行（Asia/Shanghai）')}
          </div>
          <div className={FORM_ROW_CLS}>
            <span className="text-sm leading-5 text-muted-foreground">{t('机器')}</span>
            <span className={FORM_ROW_VALUE_CLS}>
              {t('自动')}
              <ChevronRight width={12} height={12} />
            </span>
          </div>
        </div>
        {/* registry DialogFooter 形态（border-t + muted 底、行尾对齐）：
            取消 = outline、保存 = default（官网 dialog footer 词汇）。 */}
        <DialogFooter>
          <Button variant="outline" className="sched-form-cancel" onClick={onClose}>
            {t('取消')}
          </Button>
          <Button onClick={live?.onSave}>{t('保存')}</Button>
        </DialogFooter>
        <DialogClose
          render={<Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" />}
          aria-label={t('关闭')}
        >
          <X width={16} height={16} />
        </DialogClose>
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
        // 顶栏动作钮：ghost 件默认形态 + primary 墨（品牌语义走 token 层，
        // #991 Q10）；手写七通道中和配方退役，hover 涂底 = registry 可供性。
        // page-new-action 类名留存 = overlay-focus 跨域别名。
        <Button
          variant="ghost"
          className="page-new-action text-primary hover:text-primary dark:hover:text-primary"
          onClick={live ? () => setFormOpen(true) : undefined}
        >
          <PlusSmall data-icon="inline-start" />
          {t('新建')}
        </Button>
      }
    >
      <div className={`${PAGE_COL_CLS} space-y-3 pt-10`}>
        {schedules.length === 0 ? (
          // 空态 = registry Empty 件族（手写 48px tile + 节奏配方退役）；
          // sched-empty/-title/-new 别名留存（dead-buttons / accent-typo
          // 跨域句柄）。
          <Empty className="sched-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Clock />
              </EmptyMedia>
              <EmptyTitle className="sched-empty-title">{t('尚无定时。')}</EmptyTitle>
              <EmptyDescription>
                {t(
                  '按周期或在指定时间自动重新运行任务。每一轮都会依据任务描述从头开始一次全新运行，到达确认或审核关口时暂停，交由负责人接手。',
                )}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                className="sched-empty-new"
                onClick={live ? () => setFormOpen(true) : undefined}
              >
                {t('新建定时')}
              </Button>
              {/* 「查看文档」钮全除（#149 wontfix）：local-first 自托管无
                  文档站可链（官方链接对象不可观测），README 指向上游代码库
                  与产品语义无关——隐去，台账 #136 勾兑登记。 */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {/* the r7 icon dump names the bulb markup Lock (#49a224ab53) */}
                <Lock width={12} height={12} />
                <span>{t('也可以直接告诉总管某个任务要多久重跑一次，它会替你写好规则。')}</span>
              </div>
            </EmptyContent>
          </Empty>
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
