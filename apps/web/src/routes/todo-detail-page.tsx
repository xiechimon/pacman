// Todo detail route (issue #56): app shell sidebar + dhead + phase-driven
// body — fresh block (23/23d) or doc pane + chat column (16/17 family) —
// plus composer, 总管 FAB and the capture-frozen user-menu popover.
// #66/#68 add the 更多/删除 and token/branch/history/accept overlays;
// #75 adds the deep dynamic states: the version dropdown / compare
// submenu / plan-version diff surface of the doc pane, the rerun dialog +
// 复用方案 sub-panel (r8 56/74/75) and the interactive reject chain
// (请求修改 → replan streaming → v(N+1) → diff → 确认, AC3) walked
// client-side over the fixture script.
import { useCallback, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AcceptDialog } from '../detail/accept-dialog.js';
import { BranchDialog } from '../detail/branch-dialog.js';
import { Composer } from '../detail/composer.js';
import { DetailHead } from '../detail/dhead.js';
import { DocPane } from '../detail/docpane.js';
import { FreshBlock } from '../detail/fresh-block.js';
import { HistoryDialog } from '../detail/history-dialog.js';
import { RerunDialog, ReusePanel } from '../detail/overlays.js';
import { TokenDialog } from '../detail/token-dialog.js';
import { Transcript } from '../detail/transcript.js';
import { UserMenu } from '../detail/user-menu.js';
import type {
  DetailContent,
  OverlayState,
  Phase,
  PlanDiffContent,
  TranscriptItem,
} from '../fixtures/records.js';
import { DeleteConfirm } from '../overlay/delete-confirm.js';
import { MoreMenu } from '../overlay/more-menu.js';
import { SearchPanel, useSearchState } from '../overlays/search-panel.js';
import { PHASE_UI } from '../phase.js';
import '../detail/detail.css';
import { attentionCount } from '../board/columns.js';
import { BoardSidebar } from '../board/sidebar.js';
import { markDeleted, withoutDeleted } from '../fixtures/deletions.js';
import { overlayContent } from '../fixtures/fixtures.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { ChiefFab } from '../icons/index.js';
import { readStoredTheme } from '../theme.js';

/** Reject-chain walk state (AC3): idle = the fixture's confirm surface;
 *  streaming = the replan round (r8 67); landed = v(N+1) 待确认 (r8 68);
 *  building = the 确认 round opened after the chain's last step. */
type ChainState = 'idle' | 'streaming' | 'landed' | 'building';

/** Reject-chain view derivation (AC3): the streaming round borrows the
 *  planning surface (r8 67), the landed round the confirm surface with
 *  the new version's doc/dropdown, the building round the execution
 *  surface. Kept out of the component so the capture-state render stays
 *  readable. */
function chainView(
  detail: DetailContent | undefined,
  chain: ChainState,
  diff: PlanDiffContent | undefined,
) {
  const revision = detail?.revision;
  const transcript: TranscriptItem[] = [...(detail?.transcript ?? [])];
  if (chain === 'streaming' && revision != null) {
    transcript.push(
      { kind: 'user', text: revision.feedback },
      { kind: 'streaming', seconds: revision.streaming.seconds, label: revision.streaming.label },
    );
  }
  if ((chain === 'landed' || chain === 'building') && revision != null) {
    transcript.push({ kind: 'user', text: revision.feedback }, ...revision.landed.transcriptTail);
  }
  if (chain === 'building' && revision != null) {
    transcript.push({ kind: 'streaming', seconds: 1, label: '处理中...' });
  }
  const landed = chain === 'landed' || chain === 'building';
  return {
    phaseOverride:
      chain === 'streaming'
        ? ('planning' as Phase)
        : chain === 'building'
          ? ('building' as Phase)
          : null,
    transcript,
    doc: landed ? revision?.landed.doc : detail?.doc,
    planVersions: landed ? revision?.landed.planVersions : detail?.planVersions,
    planDiff: chain === 'streaming' ? (revision?.planDiff ?? diff) : diff,
  };
}

export function TodoDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // 文档|聊天 tabs (issue #56): 文档 = doc pane + chat column, 聊天 = chat
  // column alone. Pure render state — the captures all sit on 文档.
  const [tab, setTab] = useState<'doc' | 'chat'>('doc');
  // 更多 menu + delete confirm (#66): confirming a delete marks the todo
  // in the deletions overlay and returns to /app (r2 §5.4) — the board
  // route then renders without it; the fixture phase has no backend.
  const [moreOpen, setMoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const fixture = resolveScenario(searchParams);
  const search = useSearchState(fixture.ui?.searchOpen === true, fixture.ui?.searchQuery ?? '');
  const todos = withoutDeleted(fixture.todos);
  const todo = todos.find((t) => t.id === id) ?? todos[0];
  // Modal overlays (issue #68, extended in #75 with rerun/reuse): the
  // scenario fixture opens one for capture determinism; the header
  // buttons and the review/failed action buttons open the same set
  // interactively.
  const [overlay, setOverlay] = useState<OverlayState | null>(fixture.overlay ?? null);
  const closeOverlay = useCallback(() => setOverlay(null), []);
  // #75 version-menu + plan-version diff state: scenario-frozen for the
  // captures, interactive afterwards (63–72).
  const [menu, setMenu] = useState<'versions' | 'compare' | undefined>(fixture.detail?.versionMenu);
  const [diff, setDiff] = useState(fixture.detail?.planDiff);
  const [chain, setChain] = useState<ChainState>('idle');

  const view = chainView(fixture.detail, chain, diff);
  if (todo == null) return null;
  const content = overlayContent(todo.id);
  const phase: Phase = view.phaseOverride ?? todo.phase;
  const ui = PHASE_UI[phase];
  const detail = fixture.detail;
  const streaming = view.transcript.some((item) => item.kind === 'streaming');
  // The doc pane flips to the 变更 surface once a run produced changes
  // (r7 27/36, r8 54/73); the plan-version diff surface wins while open
  // (r8 65–72); the plan surface serves todo→building (r7 16/17/26).
  const docMode =
    view.planDiff != null
      ? 'diff'
      : phase === 'review' || phase === 'done' || phase === 'failed'
        ? 'changes'
        : 'plan';

  return (
    <div className="detail-shell" data-route="todo-detail" data-todo-id={id}>
      <BoardSidebar
        attention={attentionCount(todos)}
        onSearch={() => search.setOpen(true)}
        usageNav={fixture.usageNav === true}
      />
      <div className="detail-main">
        <DetailHead
          todo={todo}
          phase={phase}
          tab={tab}
          onTab={setTab}
          onMore={() => setMoreOpen(true)}
          onOverlay={(kind) => setOverlay({ kind })}
          onAction={() => {
            if (chain === 'landed' && detail?.revision != null) {
              setChain('building');
              return;
            }
            // r7 34: the review-phase 完成 button opens the accept dialog;
            // r8 54: the failed 重跑 button opens the rerun dialog
            if (phase === 'review') setOverlay({ kind: 'accept' });
            if (phase === 'failed') setOverlay({ kind: 'rerun' });
          }}
          chipPopoverOpen={fixture.ui?.chipPopoverOpen === true}
        />
        {detail == null ? (
          <div className="detail-body detail-body--single">
            <FreshBlock todo={todo} />
          </div>
        ) : (
          <div className="detail-body">
            {tab === 'doc' && (
              <DocPane
                mode={docMode}
                doc={view.doc}
                changes={detail.changes}
                now={fixture.now}
                planDropdownOpen={fixture.ui?.planDropdownOpen === true}
                planVersions={view.planVersions}
                versionMenu={menu}
                onVersionMenu={setMenu}
                onCompare={() => {
                  // 上一版本 (r8 64 → 65/71): opens the previous-version
                  // diff — the fixture's compare target, or the chain's
                  // landed diff once the reject loop produced one
                  setDiff(detail.compareTarget ?? detail.revision?.landed.planDiff);
                  setMenu(undefined);
                }}
                onBase={() => {
                  setDiff(undefined);
                  setMenu(undefined);
                }}
                planDiff={view.planDiff}
                onToggleExpand={() =>
                  setDiff((d) => (d != null ? { ...d, expanded: !d.expanded } : d))
                }
              />
            )}
            <div className="chat-col">
              {/* margin-top:auto pins an overflowing transcript to the
                  newest row at first paint (r8 63–77) and keeps short r7
                  transcripts top-aligned — no scroll scripting, so the
                  parity capture is deterministic */}
              <div className="chat-pin">
                <Transcript transcript={view.transcript} />
              </div>
            </div>
          </div>
        )}
        {ui.placeholder != null && (
          <Composer
            placeholder={ui.placeholder}
            aiReview={
              // r7 §4.1 / r8 §3.1: the AI 审核 button only shows on writable
              // confirm/review surfaces; failed and waiting-on-user
              // composers render the three base tools alone
              (phase === 'confirm' || phase === 'review') && !todo.awaitingReply
            }
            streaming={streaming}
            onSend={
              detail?.revision != null && chain === 'idle'
                ? () => {
                    setChain('streaming');
                    window.setTimeout(() => setChain('landed'), 900);
                  }
                : undefined
            }
          />
        )}
        <button type="button" className="detail-fab" aria-label="总管">
          <ChiefFab />
          {fixture.chiefUnread != null && fixture.chiefUnread > 0 && (
            <span className="fab-badge">{fixture.chiefUnread}</span>
          )}
        </button>
      </div>
      {detail?.userMenuOpen === true && <UserMenu theme={readStoredTheme(localStorage)} />}
      {moreOpen && (
        <MoreMenu
          onClose={() => setMoreOpen(false)}
          onDelete={() => {
            setMoreOpen(false);
            setDeleteOpen(true);
          }}
        />
      )}
      {deleteOpen && (
        <DeleteConfirm
          todo={todo}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => {
            setDeleteOpen(false);
            markDeleted(todo.id);
            navigate('/app');
          }}
        />
      )}
      {overlay?.kind === 'token' && content != null && (
        <TokenDialog stats={content.token} onClose={closeOverlay} />
      )}
      {overlay?.kind === 'branch' && content != null && (
        <BranchDialog info={content.branch} onClose={closeOverlay} />
      )}
      {overlay?.kind === 'history' && content != null && (
        <HistoryDialog runs={content.runs} onClose={closeOverlay} />
      )}
      {overlay?.kind === 'accept' && <AcceptDialog onClose={closeOverlay} />}
      {overlay?.kind === 'rerun' && (
        <RerunDialog
          reuse={todo.hasPlan}
          agent={
            detail?.rerunAgent ?? {
              name: todo.agent?.displayName ?? '未指派',
              model: '默认',
            }
          }
          onReuse={() => setOverlay({ kind: 'reuse' })}
        />
      )}
      {overlay?.kind === 'reuse' && (
        <ReusePanel
          onBack={() => setOverlay({ kind: 'rerun' })}
          onView={closeOverlay}
          onDirect={closeOverlay}
        />
      )}
      {search.open && (
        <SearchPanel
          fixture={fixture}
          query={search.query}
          onQuery={search.setQuery}
          onClose={() => search.setOpen(false)}
        />
      )}
    </div>
  );
}
