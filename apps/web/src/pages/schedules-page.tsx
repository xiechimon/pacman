// Schedules route (issue #71): empty state pixel-bound to r7 11 (probe
// geometry: 768px centered column at x456, 48px tile @ y84, 75×30 primary
// @ y228), list card from r3 93, 新建定时 dialog from r3 92/92b with the
// 02 §9.2 copy canon (频率 tabs, 00/15/30/45 minute steps, tz note).
import { useSearchParams } from 'react-router';
import type { FixtureSet, ScheduleRecord } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  EllipsisVertical,
  ExternalLink,
  Lock,
  PlusSmall,
  Server,
  X,
} from '../icons/index.js';
import { PHASE_UI } from '../phase.js';
import { PageShell } from './shell.js';
import './pages.css';

/** Capture-timezone offset (+08:00) — same convention as board/rel-time.ts:
 *  wall-clock labels are formatted in the capture tz so parity output never
 *  drifts with the runner locale (CI runs UTC). */
const TZ_OFFSET = 8 * 3_600_000;
const pad = (n: number) => String(n).padStart(2, '0');
const hourMinute = (ts: number) => {
  const d = new Date(ts + TZ_OFFSET);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
const monthDay = (ts: number) => {
  const d = new Date(ts + TZ_OFFSET);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
};
/** r3 93 line 3 day word: same calendar day as the capture = 今天. */
const dayWord = (ts: number, now: number) =>
  monthDay(ts) === monthDay(now) ? '今天' : monthDay(ts);

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

function ScheduleCard({ schedule, now }: { schedule: ScheduleRecord; now: number }) {
  const ui = PHASE_UI[schedule.todo.phase];
  return (
    <div className="sched-card">
      <span className="sched-card-tile">
        <Clock width={14} height={14} />
      </span>
      <div className="sched-card-body">
        <div className="sched-card-title">{`#${schedule.todo.seqNum} ${schedule.todo.title}`}</div>
        <div className="sched-card-line">
          {`${monthDay(schedule.at)} ${hourMinute(schedule.at)} ${RUN_WORD[schedule.kind]}`}
        </div>
        <div className="sched-card-line sched-card-line--dim">
          {`下次 ${dayWord(schedule.nextRunAt, now)} ${hourMinute(schedule.nextRunAt)}`}
          <span className="sched-card-sep">·</span>
          <Server width={12} height={12} />
          {schedule.machineId == null ? '自动' : schedule.machineId}
          <span className="sched-card-sep">·</span>
          {schedule.todo.projectName}
        </div>
      </div>
      <span className={`sched-card-chip sched-card-chip--${ui.tone}`}>{ui.chip}</span>
      <button type="button" className="sched-card-more" aria-label="更多">
        <EllipsisVertical />
      </button>
    </div>
  );
}

/** r3 92/92b dialog. Field values ride the fixture (project + first todo);
 *  the open tab is the scenario's capture state. */
function ScheduleForm({
  kind,
  fixture,
}: {
  kind: 'hourly' | 'daily' | 'weekly' | 'once';
  fixture: FixtureSet;
}) {
  const todo = fixture.todos[0];
  const repo = fixture.project?.repoName ?? '';
  return (
    <div className="sched-form-overlay">
      <div className="sched-form" role="dialog" aria-label="新建定时">
        <header className="sched-form-head">
          <span className="sched-form-title">新建定时</span>
          <button type="button" className="sched-form-close" aria-label="关闭">
            <X />
          </button>
        </header>
        <div className="sched-form-body">
          <div className="sched-form-row">
            <span className="sched-form-label">项目</span>
            <span className="sched-form-value">
              {repo}
              <ChevronRight width={12} height={12} />
            </span>
          </div>
          <div className="sched-form-row">
            <span className="sched-form-label">任务</span>
            <span className="sched-form-value">
              {todo == null ? '' : `#${todo.seqNum} ${todo.title}`}
              <ChevronRight width={12} height={12} />
            </span>
          </div>
          <div className="sched-form-freq">
            {(['hourly', 'daily', 'weekly', 'once'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`sched-form-freq-tab${k === kind ? ' sched-form-freq-tab--active' : ''}`}
              >
                {FREQ_LABEL[k]}
              </button>
            ))}
          </div>
          {kind === 'once' && (
            <>
              <div className="sched-form-field">日期</div>
              <div className="sched-form-selects">
                <span className="sched-form-select">
                  <select className="sched-form-date" aria-label="日期" defaultValue="今天">
                    {/* r3 92b observes 今天; further entries unrecorded */}
                    <option>今天</option>
                  </select>
                  <ChevronDown width={12} height={12} />
                </span>
              </div>
            </>
          )}
          <div className="sched-form-field">时间</div>
          <div className="sched-form-selects sched-form-selects--time">
            <span className="sched-form-select">
              <select aria-label="时" defaultValue="09">
                {HOURS.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
              <ChevronDown width={12} height={12} />
            </span>
            <span className="sched-form-select">
              <select aria-label="分" defaultValue="00">
                {MINUTE_STEPS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <ChevronDown width={12} height={12} />
            </span>
          </div>
          <div className="sched-form-tz">按你的本地时区运行（Asia/Shanghai）</div>
          <div className="sched-form-row">
            <span className="sched-form-label">机器</span>
            <span className="sched-form-value">
              自动
              <ChevronRight width={12} height={12} />
            </span>
          </div>
        </div>
        <footer className="sched-form-foot">
          <button type="button" className="sched-form-cancel">
            取消
          </button>
          <button type="button" className="sched-form-save">
            保存
          </button>
        </footer>
      </div>
    </div>
  );
}

export function SchedulesPage() {
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const schedules = fixture.schedules ?? [];
  return (
    <PageShell
      fixture={fixture}
      selected="schedules"
      title="定时"
      action={
        <button type="button" className="page-new-action">
          <PlusSmall width={13} height={13} />
          新建
        </button>
      }
    >
      <div className="page-col schedules-body">
        {schedules.length === 0 ? (
          <div className="sched-empty">
            <div className="sched-empty-tile">
              <Clock width={26} height={26} />
            </div>
            <div className="sched-empty-title">尚无定时。</div>
            <p className="sched-empty-desc">
              按周期或在指定时间自动重新运行任务。每一轮都会依据任务描述从头开始一次全新运行，到达确认或审核关口时暂停，交由负责人接手。
            </p>
            <div className="sched-empty-actions">
              <button type="button" className="sched-empty-new">
                新建定时
              </button>
              <button type="button" className="sched-empty-docs">
                查看文档
                <ExternalLink />
              </button>
            </div>
            <div className="sched-empty-hint">
              {/* the r7 icon dump names the bulb markup Lock (#49a224ab53) */}
              <Lock width={12} height={12} />
              <span>也可以直接告诉总管某个任务要多久重跑一次，它会替你写好规则。</span>
            </div>
          </div>
        ) : (
          schedules.map((s) => <ScheduleCard key={s.id} schedule={s} now={fixture.now} />)
        )}
      </div>
      {fixture.scheduleForm != null && (
        <ScheduleForm kind={fixture.scheduleForm} fixture={fixture} />
      )}
    </PageShell>
  );
}
