// Centered modal overlays of the detail route (issue #75, r8 56/74/75/
// 57/77): the 开始任务 rerun dialog (448×245, agent row + 规划与执行分用
// 不同 Agent switch + 先做规划/立即执行 and — only when the failed build
// holds a plan document, r8 §3.4 — the indigo 复用方案 third button), the
// 复用方案 sub-panel (back arrow + centered prompt + 查看方案/直接执行)
// and the 运行历史 dialog (448 wide, vertically centered, run rows with
// state glyph + 当前 badge + `rel · tokens · error` sub-row, row-level
// 重跑 on the failed todo's current row only). Geometry from r8 §2.3/
// §2.4/§2.6; the 448-wide centered law and the vertical centering
// (y=(732−h)/2) come from r7 §3.5 / r8 §2.4.

import type { RunHistoryRow } from '../fixtures/records.js';
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
  return (
    <div className="overlay-head">
      {back === true && (
        <button type="button" className="overlay-back" onClick={onBack} aria-label="返回">
          <ChevronLeft width={16} height={16} />
        </button>
      )}
      <span className="overlay-title">{title}</span>
      <button type="button" className="overlay-close" aria-label="关闭">
        <X width={16} height={16} />
      </button>
    </div>
  );
}

/** 开始任务 dialog in its rerun form (r8 56/74): the agent row carries the
 *  previous run's agent; `reuse` adds the indigo third button and demotes
 *  立即执行 to secondary. */
export function RerunDialog({ reuse, onReuse }: { reuse: boolean; onReuse?: () => void }) {
  return (
    <Overlay>
      <PanelHead title="开始任务" />
      <div className="overlay-body">
        <div className="rerun-agent-label">Agent</div>
        <button type="button" className="rerun-agent-row">
          <span className="rerun-agent-avatar">
            <img src="/avatar-robot-1.svg" alt="" />
          </span>
          <span className="rerun-agent-text">
            <span className="rerun-agent-name">r3-builder</span>
            <span className="rerun-agent-model">claude-sonnet-5</span>
          </span>
          <ChevronRight width={14} height={14} />
        </button>
        <div className="rerun-switch-row">
          <span>规划与执行分用不同 Agent</span>
          <span className="rerun-switch" aria-hidden="true">
            <span className="rerun-switch-knob" />
          </span>
        </div>
        <div className="overlay-actions">
          <button type="button" className="overlay-btn">
            先做规划
          </button>
          <button
            type="button"
            className={reuse ? 'overlay-btn' : 'overlay-btn overlay-btn--primary'}
          >
            立即执行
          </button>
          {reuse && (
            <button type="button" className="overlay-btn overlay-btn--primary" onClick={onReuse}>
              复用方案
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

/** 复用方案 sub-panel (r8 75): independent dialog face, back arrow returns
 *  to the rerun dialog. */
export function ReusePanel({ onBack }: { onBack?: () => void }) {
  return (
    <Overlay>
      <PanelHead title="复用方案" back onBack={onBack} />
      <div className="overlay-body reuse-body">
        <div className="reuse-prompt">选择接下来如何使用这个方案</div>
        <div className="overlay-actions">
          <button type="button" className="overlay-btn">
            查看方案
          </button>
          <button type="button" className="overlay-btn overlay-btn--primary">
            直接执行
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/** 运行历史 dialog (r8 57/77). */
export function HistoryDialog({ rows }: { rows: RunHistoryRow[] }) {
  const rerun = rows.some((r) => r.rerun === true);
  return (
    <Overlay>
      <PanelHead title="运行历史" />
      <div className="history-rows">
        {rows.map((row) => (
          <div key={row.n} className="history-row">
            <span className={`history-glyph history-glyph--${row.state}`} aria-hidden="true" />
            <span className="history-row-text">
              <span className="history-row-title">
                第 {row.n} 次运行
                {row.current && <span className="history-current">当前</span>}
              </span>
              <span className="history-row-sub">
                {[row.rel, row.tokens, row.error]
                  .filter((part): part is string => part != null)
                  .join(' · ')}
              </span>
            </span>
          </div>
        ))}
      </div>
      {rerun && (
        <div className="overlay-actions overlay-actions--history">
          <button type="button" className="overlay-btn overlay-btn--primary">
            重跑
          </button>
        </div>
      )}
    </Overlay>
  );
}
