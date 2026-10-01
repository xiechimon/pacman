// Centered modal overlays of the detail route (issue #75, r8 56/74/75):
// the 开始任务 rerun dialog (448×245, agent row + 规划与执行分用不同
// Agent switch + 先做规划/立即执行 and — only when the failed build holds
// a plan document, r8 §3.4 — the indigo 复用方案 third button) and the
// 复用方案 sub-panel (back arrow + centered prompt + 查看方案/直接执行).
// Geometry from r8 §2.3/§2.6 on top of the 448-wide centered law (r7
// §3.5). (The former 运行历史 dialog of #68 is a static right-pane
// section since #366 — right-pane.tsx.)
// #318 统一面(r9 §3.6): the dialog is the single 开始任务 face for both
// 待开始 and failed-rerun — Agent row = selector (#182 ChiefAgentDialog
// family, 未指派 included), the 分用 switch toggles one row into the
// 规划/执行 pair (server assignment.plan/build dual slots), and the
// machine row renders the GET machines read face. Fixture mode keeps the
// #75 static face byte-identical: the machine row renders only when the
// `machines` prop is present, and every selector/toggle interaction is
// pure UI state (no wire without `onStart`).

import { useEffect, useState } from 'react';
import {
  ChiefAgentDialog,
  type ChiefAgentOption,
  UNASSIGNED_AGENT_ID,
} from '../chief/chief-agent-dialog.js';
import { Button } from '../components/ui/button.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronLeft, ChevronRight, X } from '../icons/index.js';

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
function Overlay({
  onClose,
  escMuted,
  children,
}: {
  onClose: () => void;
  /** #318: an inner dialog (the agent selector) owns Esc while open — the
   *  family inner-first law (new-task-dialog #176 Esc split precedent). */
  escMuted?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (escMuted) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, escMuted]);
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

/** #318 机器行读面投影(GET machines):自动 = 首台在线机器,无在线退首台。 */
export interface RerunMachine {
  name: string;
  online: boolean;
}

/** #318 开始出口载荷:withPlan = 先做规划/立即执行两分支(02 §4.2);
 *  assignment 正对 server 双槽(packages/shared assignmentSlotSchema)。 */
export interface RerunStart {
  withPlan: boolean;
  assignment: { plan: { agentId: string } | null; build: { agentId: string } | null };
}

/** fixture 面选择器兜底行(r5 捕获名 canon,chief DEFAULT_AGENT / new-task
 *  DEFAULT_PROJECT 同律):agentOptions 缺省时选择器仍有真内容。 */
const CANON_AGENT: ChiefAgentOption = {
  id: 'r3-builder',
  name: 'r3-builder',
  model: 'claude-sonnet-5',
};

/** Agent 行(#318:整行可点开「选择 Agent」弹层,r9 §2.6;#75 原死钮位)。 */
function AgentRow({
  display,
  onPick,
}: {
  /** seed = #387 头像种子:真实 agent 名才生成 dicebear 头像;未指派(占位
   *  文案非人名)无 seed,渲染静态机器人资产。 */
  display: { name: string; model: string; seed?: string };
  onPick: () => void;
}) {
  return (
    // XMON-24：agent 行钮切 shadcn ghost——皮肤全在 .rerun-agent-row
    // per-face（漆底 dialog-row-bg 压过 hover:bg-muted；h54/gap12 同理）；
    // utilities 清 justify（w100% 行内容靠左）、字号继承（name/model 自带
    // 字号，行间空隙不漂）、active 位移与 svg 16px 强制（chevron 属性 14px）。
    <Button
      variant="ghost"
      className="rerun-agent-row justify-start text-[length:inherit] leading-[inherit] font-normal active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
      onClick={onPick}
    >
      <span className="rerun-agent-avatar">
        <SeededAvatar name={display.seed} fallback="/avatar-robot-1.svg" />
      </span>
      <span className="rerun-agent-text">
        <span className="rerun-agent-name">{display.name}</span>
        <span className="rerun-agent-model">{display.model}</span>
      </span>
      <ChevronRight width={14} height={14} />
    </Button>
  );
}

/** 开始任务 dialog in its rerun form (r8 56/74): the agent row carries the
 *  previous run's agent; `reuse` adds the indigo third button and demotes
 *  立即执行 to secondary. */
export function RerunDialog({
  reuse,
  agent,
  agentOptions,
  initialAgentId,
  machines,
  onClose,
  onReuse,
  onStart,
}: {
  reuse: boolean;
  /** Previous run's agent (fixture data, r8 56/74 agent row); doubles as
   *  the display fallback while no explicit selection exists. */
  agent: { name: string; model: string };
  /** #318 live 候选集(members 读面 memberType:"agent" 投影);缺省 =
   *  fixture 面(选择器退 canon 单行)。 */
  agentOptions?: ChiefAgentOption[];
  /** #318 live 初始选择(执行槽派生 ?? 团队首个 Agent);'' = 未指派;
   *  缺省 = 无显式选择,行面显示 agent prop(fixture 字节不变)。 */
  initialAgentId?: string | null;
  /** #318 live 机器读面;undefined = 机器行不渲染(fixture 56/74 捕获无
   *  该行,初始像素字节不变)。 */
  machines?: RerunMachine[];
  /** #168: family close law — X / Esc / backdrop all dismiss. */
  onClose: () => void;
  onReuse?: () => void;
  /** M5 live 面：先做规划 = POST builds withPlan:true；立即执行 =
   *  withPlan:false（02 §4.2 开始 dialog 两分支）；#318 携带 dialog 选定
   *  的 assignment(分用 OFF = 双槽同值,ON = plan/build 独立);缺省 =
   *  fixture 静态面(钮无 wire)。 */
  onStart?: (start: RerunStart) => void;
}) {
  const { t } = useI18n();
  const rows = agentOptions ?? [CANON_AGENT];
  // 选择态:undefined = 未显式选过(行面退 agent prop);'' = 未指派。
  const [singleId, setSingleId] = useState<string | undefined>(initialAgentId ?? undefined);
  const [planId, setPlanId] = useState<string | undefined>(initialAgentId ?? undefined);
  const [buildId, setBuildId] = useState<string | undefined>(initialAgentId ?? undefined);
  // 分用开关(r9 §2.6:OFF = 单 Agent 行;ON = 规划/执行双行各自可点选)。
  const [split, setSplit] = useState(false);
  // 「选择 Agent」弹层目标槽;null = 关。
  const [pick, setPick] = useState<'single' | 'plan' | 'build' | null>(null);
  // 冷深链下 members 读面晚到——initialAgentId 首帧冻结 ''(未指派);用户
  // 未动手前随 prop 同步默认值,选过之后用户意图优先(重取不回灌)。
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched) return;
    setSingleId(initialAgentId ?? undefined);
    setPlanId(initialAgentId ?? undefined);
    setBuildId(initialAgentId ?? undefined);
  }, [initialAgentId, touched]);
  const displayFor = (id: string | undefined) => {
    if (id === UNASSIGNED_AGENT_ID) return { name: t('未指派'), model: t('默认') };
    if (id == null) return { ...agent, seed: agent.name };
    const row = rows.find((r) => r.id === id);
    return row
      ? { name: row.name, model: row.model ?? t('默认'), seed: row.name }
      : { ...agent, seed: agent.name };
  };
  const slot = (id: string | undefined) =>
    id != null && id !== UNASSIGNED_AGENT_ID ? { agentId: id } : null;
  const start = (withPlan: boolean) => {
    onStart?.({
      withPlan,
      assignment: split
        ? { plan: slot(planId), build: slot(buildId) }
        : { plan: slot(singleId), build: slot(singleId) },
    });
  };
  // 机器行 = 读面投影,非交互:「指定机器」无 server 槽(startBuilds body
  // 无 machineId,shared assignmentSlotSchema 仅 agentId)——[设计] 静态
  // 展示面(分支 chip #149 先例);live-only 行(fixture 捕获无此行),
  // 非 button 断言由 verify-pacman #318 probe 持有,e2e fixture 面无钉。
  const autoMachine = machines?.find((m) => m.online) ?? machines?.[0] ?? null;
  const pickBoundId = pick === 'plan' ? planId : pick === 'build' ? buildId : singleId;
  return (
    <>
      <Overlay onClose={onClose} escMuted={pick != null}>
        <PanelHead title={t('开始任务')} onClose={onClose} />
        <div className="overlay-body">
          {split ? (
            <>
              <div className="rerun-agent-label">{t('规划')}</div>
              <AgentRow display={displayFor(planId)} onPick={() => setPick('plan')} />
              <div className="rerun-agent-label">{t('执行')}</div>
              <AgentRow display={displayFor(buildId)} onPick={() => setPick('build')} />
            </>
          ) : (
            <>
              <div className="rerun-agent-label">Agent</div>
              <AgentRow display={displayFor(singleId)} onPick={() => setPick('single')} />
            </>
          )}
          {machines != null && (
            <>
              <div className="rerun-machine-label">{t('机器')}</div>
              <div className="rerun-machine-row">
                <span className="rerun-machine-auto">{t('自动')}</span>
                {autoMachine != null && (
                  <>
                    <span className="rerun-machine-sep">/</span>
                    <span
                      className={`rerun-machine-dot${autoMachine.online ? ' rerun-machine-dot--online' : ''}`}
                    />
                    <span className="rerun-machine-name">{autoMachine.name}</span>
                    <span className="rerun-machine-state">
                      ({autoMachine.online ? t('在线') : t('离线')})
                    </span>
                  </>
                )}
              </div>
            </>
          )}
          <div className="rerun-switch-row">
            <span>{t('规划与执行分用不同 Agent')}</span>
            {/* #318: #75 的静态 span 接真为 role=switch(span 元素保持 =
                56/74 初始像素字节不变;键盘 Enter/Space 同律)。 */}
            <span
              className={`rerun-switch${split ? ' rerun-switch--on' : ''}`}
              role="switch"
              aria-checked={split}
              aria-label={t('规划与执行分用不同 Agent')}
              tabIndex={0}
              onClick={() => setSplit((v) => !v)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSplit((v) => !v);
                }
              }}
            >
              <span className="rerun-switch-knob" />
            </span>
          </div>
          <div className="overlay-actions">
            <Button
              variant="ghost"
              className={OVERLAY_GHOST}
              onClick={onStart ? () => start(true) : undefined}
            >
              {t('先做规划')}
            </Button>
            <Button
              variant={reuse ? 'ghost' : 'brand'}
              className={reuse ? OVERLAY_GHOST : OVERLAY_BTN}
              onClick={onStart ? () => start(false) : undefined}
            >
              {t('立即执行')}
            </Button>
            {reuse && (
              <Button variant="brand" className={OVERLAY_BTN} onClick={onReuse}>
                {t('复用方案')}
              </Button>
            )}
          </div>
        </div>
      </Overlay>
      {/* #318 「选择 Agent」弹层 = #182 家族件复用(r9 §2.6:未指派 + agent
          行);confirmRebind=false 选择即发;Esc 归内层(Overlay escMuted)。 */}
      <ChiefAgentDialog
        open={pick != null}
        onClose={() => setPick(null)}
        agents={rows}
        unassign
        confirmRebind={false}
        boundAgentId={pickBoundId ?? null}
        onBind={(id) => {
          setTouched(true);
          if (pick === 'plan') setPlanId(id);
          else if (pick === 'build') setBuildId(id);
          else setSingleId(id);
          setPick(null);
        }}
        title={t('选择 Agent')}
      />
    </>
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
