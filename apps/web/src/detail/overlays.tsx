// Centered modal overlays of the detail route (issue #75, r8 56/74/75):
// the 开始任务 rerun dialog (448×245, agent row + 规划与执行分用不同
// Agent switch + 先做规划/立即执行 and — only when the failed build holds
// a plan document, r8 §3.4 — the indigo 复用方案 third button) and the
// 复用方案 sub-panel (back arrow + centered prompt + 查看方案/直接执行).
// The 运行历史 dialog lives in history-dialog.tsx (#68); geometry from
// r8 §2.3/§2.6 on top of the 448-wide centered law (r7 §3.5).

import { useI18n } from '../i18n/provider.js';
import { ChevronLeft, ChevronRight, X } from '../icons/index.js';

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="overlay">
      <div className="overlay-panel">{children}</div>
    </div>
  );
}

function PanelHead({
  title,
  back,
  onBack,
}: {
  title: string;
  back?: boolean;
  onBack?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="overlay-head">
      {back === true && (
        <button type="button" className="overlay-back" onClick={onBack} aria-label={t('返回')}>
          <ChevronLeft width={16} height={16} />
        </button>
      )}
      <span className="overlay-title">{title}</span>
      <button type="button" className="overlay-close" aria-label={t('关闭')}>
        <X width={16} height={16} />
      </button>
    </div>
  );
}

/** 开始任务 dialog in its rerun form (r8 56/74): the agent row carries the
 *  previous run's agent; `reuse` adds the indigo third button and demotes
 *  立即执行 to secondary. */
export function RerunDialog({
  reuse,
  agent,
  onReuse,
}: {
  reuse: boolean;
  /** Previous run's agent (fixture data, r8 56/74 agent row). */
  agent: { name: string; model: string };
  onReuse?: () => void;
}) {
  const { t } = useI18n();
  return (
    <Overlay>
      <PanelHead title={t('开始任务')} />
      <div className="overlay-body">
        <div className="rerun-agent-label">Agent</div>
        <button type="button" className="rerun-agent-row">
          <span className="rerun-agent-avatar">
            <img src="/avatar-robot-1.svg" alt="" />
          </span>
          <span className="rerun-agent-text">
            <span className="rerun-agent-name">{agent.name}</span>
            <span className="rerun-agent-model">{agent.model}</span>
          </span>
          <ChevronRight width={14} height={14} />
        </button>
        <div className="rerun-switch-row">
          <span>{t('规划与执行分用不同 Agent')}</span>
          <span className="rerun-switch" aria-hidden="true">
            <span className="rerun-switch-knob" />
          </span>
        </div>
        <div className="overlay-actions">
          <button type="button" className="overlay-btn">
            {t('先做规划')}
          </button>
          <button
            type="button"
            className={reuse ? 'overlay-btn' : 'overlay-btn overlay-btn--primary'}
          >
            {t('立即执行')}
          </button>
          {reuse && (
            <button type="button" className="overlay-btn overlay-btn--primary" onClick={onReuse}>
              {t('复用方案')}
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

/** 复用方案 sub-panel (r8 75): independent dialog face, back arrow returns
 *  to the rerun dialog. */
export function ReusePanel({
  onBack,
  onView,
  onDirect,
}: {
  onBack?: () => void;
  onView?: () => void;
  onDirect?: () => void;
}) {
  const { t } = useI18n();
  return (
    <Overlay>
      <PanelHead title={t('复用方案')} back onBack={onBack} />
      <div className="overlay-body reuse-body">
        <div className="reuse-prompt">{t('选择接下来如何使用这个方案')}</div>
        <div className="overlay-actions">
          <button type="button" className="overlay-btn" onClick={onView}>
            {t('查看方案')}
          </button>
          <button type="button" className="overlay-btn overlay-btn--primary" onClick={onDirect}>
            {t('直接执行')}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
