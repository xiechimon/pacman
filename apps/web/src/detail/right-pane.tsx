// Detail right pane (issue #366): the 488px static column of the 3-pane
// detail layout (docs/design/todos.dev.md grid `240 | ~730 | 488`). Hosts
// the doc surface (DocPane plan/changes/diff — the page passes it in) plus
// the three former head-icon overlay dialogs as static sections:
// 分支与 PR / Token 用量 / 运行历史 — one section per view, switched by the
// 方案▾ family type select (overlays/plan-dropdown) every head carries.
// Taste DNA law honored: still pane content on a hairline-divided plane,
// never modals; the pane itself abuts the thread column on a 1px seam. Content classes ride the #68 dialog family (dlg-token-* /
// dlg-history-* / dlg-branch-*) so the captured geometry carries over.
// XMON-55 P0 supersedes #366 修订裁决 3 (空占位，不折叠不隐藏): a fresh phase
// has no build payload, so the page does not mount this pane at all — the
// 488px goes to the fresh block's task brief instead of a placeholder.

import { cn } from 'cn';
import type { ReactNode } from 'react';
import { useBuild } from '../api/hooks.js';
import type { BuildOverlayContent, PaneView, RunHistoryRow } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { BarChart3, Check, Download, History, X } from '../icons/index.js';
import { type DocTypeLabel, PaneTypeSelect } from '../overlays/plan-dropdown.js';
import { BranchSyncFields, FIELD_LABEL, SyncButton, useBranchSyncState } from './branch-dialog.js';
import { PANE_HEAD } from './docpane.js';
import './overlays.css';

/** Type-select props every section head shares (the ✓ row + row set are
 *  derived from the active view and payload availability). */
interface PaneSelectProps {
  view: PaneView;
  /** Doc-row label — the phase-derived document type (方案|变更). */
  docLabel: DocTypeLabel;
  /** Payload present → the three section rows join the dropdown. */
  sections: boolean;
  onView: (view: PaneView) => void;
}

function SectionHead({ icon, select }: { icon: ReactNode; select: PaneSelectProps }) {
  return (
    <header className={PANE_HEAD}>
      {icon}
      <PaneTypeSelect
        view={select.view}
        docLabel={select.docLabel}
        sections={select.sections}
        onView={select.onView}
      />
    </header>
  );
}

/** Row glyph per run status (r7 32 ring; r8 80 × / check). */
function RunGlyph({ status }: { status: RunHistoryRow['status'] }) {
  if (status === 'current') return <span className="dlg-history-ring" />;
  if (status === 'failed' || status === 'failed-current')
    return <X width={14} height={14} className="dlg-history-glyph dlg-history-glyph--failed" />;
  return <Check width={14} height={14} className="dlg-history-glyph dlg-history-glyph--done" />;
}

function TokenSection({
  content,
  select,
}: {
  content: BuildOverlayContent;
  select: PaneSelectProps;
}) {
  const { t } = useI18n();
  const stats = content.token;
  const rows: Array<[string, string]> = [
    ['输入', stats.input],
    ['输出', stats.output],
    ['缓存读取', stats.cacheRead],
    ['缓存写入', stats.cacheWrite],
    ['缓存命中率', stats.cacheHitRate],
  ];
  return (
    <section className="pane-section flex min-h-0 flex-1 flex-col">
      <SectionHead icon={<BarChart3 width={14} height={14} />} select={select} />
      <div className="pane-section-body min-h-0 flex-1 overflow-y-auto">
        <div className="dlg-token-total">
          <span className="dlg-token-num">{stats.total}</span>
          <span className="dlg-token-unit">tokens</span>
        </div>
        <div className="dlg-token-model">
          <span className="dlg-token-model-name">{stats.model}</span>
          <span className="dlg-token-model-total">{stats.modelTotal}</span>
        </div>
        <div className="dlg-token-rows">
          {rows.map(([label, value]) => (
            <div key={label} className="dlg-token-row">
              <span className="dlg-token-label">{t(label)}</span>
              <span className="dlg-token-value">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HistorySection({
  content,
  select,
}: {
  content: BuildOverlayContent;
  select: PaneSelectProps;
}) {
  const { t } = useI18n();
  // The dialog's footer 重跑 was a close-stub (onClick=onClose) — a static
  // section has nothing to close, and the failed phase's header 重跑
  // primary already carries the real action, so the section lists rows only.
  return (
    <section className="pane-section flex min-h-0 flex-1 flex-col">
      <SectionHead icon={<History width={14} height={14} />} select={select} />
      <div className="pane-section-body min-h-0 flex-1 overflow-y-auto">
        <div className="dlg-history">
          {content.runs.map((run) => (
            <div key={run.label} className="dlg-history-row">
              <RunGlyph status={run.status} />
              <div className="dlg-history-text">
                <div className="dlg-history-line">
                  <span className="dlg-history-label">{t(run.label)}</span>
                  {(run.status === 'current' || run.status === 'failed-current') && (
                    <span className="dlg-history-chip">{t('当前')}</span>
                  )}
                </div>
                <div className="dlg-history-meta">{t(run.meta)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BranchSection({
  content,
  buildId,
  select,
}: {
  content: BuildOverlayContent;
  /** Live branch-sync handle (fixture = null → the static r7 31 face). */
  buildId: string | null;
  select: PaneSelectProps;
}) {
  const { t } = useI18n();
  const info = content.branch;
  // The section mounts while its view is active, so the machines query
  // gates on live alone (the dialog gates on its open flag, #319).
  const sync = useBranchSyncState(info, buildId);
  // #704 / B-C16：PR 槽真值 = build 行回填（daemon 步收尾只读探测上报）；
  // null（无 PR / 探测失败 / fixture 面）保持「未创建」诚实态，不造数据。
  const buildQ = useBuild(buildId, buildId != null);
  const pr = buildQ.data?.prUrl ?? null;
  const prNumber = buildQ.data?.prNumber ?? null;
  return (
    <section className="pane-section flex min-h-0 flex-1 flex-col">
      <SectionHead icon={<Download width={14} height={14} />} select={select} />
      <div className="pane-section-body min-h-0 flex-1 overflow-y-auto">
        <div className="dlg-branch-body">
          <BranchSyncFields
            info={info}
            canSync={sync.canSync}
            machines={sync.machines}
            selectedMachineId={sync.selectedMachineId}
            onMachineId={sync.onMachineId}
            directory={sync.directory}
            onDirectory={sync.onDirectory}
            force={sync.force}
            onForce={sync.onForce}
            buildId={buildId}
          />
          {/* The dialog's Git tab ([推断] minimal PR surface) folds into the
              section tail — one static column, no sub-tabs. */}
          <div className={cn('pane-branch-pr', FIELD_LABEL, 'mt-4')}>Pull Request</div>
          {pr !== null && prNumber != null ? (
            <a className="dlg-dir dlg-pr-link" href={pr} target="_blank" rel="noopener noreferrer">
              #{prNumber}
            </a>
          ) : (
            <div className="dlg-dir">{t('未创建')}</div>
          )}
          <div className="pane-branch-foot mt-4">
            <SyncButton
              buildId={buildId}
              canSync={sync.canSync}
              machineId={sync.selectedMachineId}
              directory={sync.directory}
              refName={info.branch}
              commit={info.commit}
              force={sync.force}
              disabled={sync.selectedMachineId === null || sync.directory.trim() === ''}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

interface RightPaneProps extends Omit<PaneSelectProps, 'sections'> {
  /** Build-scoped section payloads; null = doc surface alone. */
  content: BuildOverlayContent | null;
  /** Live branch-sync handle (fixture = null). */
  buildId: string | null;
  /** The doc-view surface (DocPane), rendered while view === 'doc'. */
  children?: ReactNode;
}

export function RightPane({ view, docLabel, onView, content, buildId, children }: RightPaneProps) {
  const select = (active: PaneView): PaneSelectProps => ({
    view: active,
    docLabel,
    sections: content != null,
    onView,
  });
  return (
    <aside
      className="detail-right flex w-(--detail-pane-right) min-h-0 flex-none flex-col border-l border-(--border-default) max-md:hidden"
      data-testid="detail-right"
    >
      {content == null || view === 'doc' ? (
        children
      ) : view === 'branch' ? (
        <BranchSection content={content} buildId={buildId} select={select('branch')} />
      ) : view === 'token' ? (
        <TokenSection content={content} select={select('token')} />
      ) : (
        <HistorySection content={content} select={select('history')} />
      )}
    </aside>
  );
}
