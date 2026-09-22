// Todo detail route (issue #56): app shell sidebar + dhead + phase-driven
// body — fresh block (23/23d) or doc pane + chat column (16/17 family) —
// plus composer, 总管 FAB and the capture-frozen user-menu popover.
// #75 adds the deep dynamic states: the version dropdown / compare
// submenu / plan-version diff surface of the doc pane, the rerun dialog +
// 复用方案 sub-panel + 运行历史 overlays (r8 56/74/75/57/77) and the
// interactive reject chain (请求修改 → replan streaming → v(N+1) → diff
// → 确认, issue #75 AC3) walked client-side over the fixture script.
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Composer } from '../detail/composer.js';
import { DetailHead } from '../detail/dhead.js';
import { DocPane } from '../detail/docpane.js';
import { FreshBlock } from '../detail/fresh-block.js';
import { HistoryDialog, RerunDialog, ReusePanel } from '../detail/overlays.js';
import { Transcript } from '../detail/transcript.js';
import { UserMenu } from '../detail/user-menu.js';
import { PHASE_UI } from '../phase.js';
import '../detail/detail.css';
import { attentionCount } from '../board/columns.js';
import { BoardSidebar } from '../board/sidebar.js';
import type { Phase, TranscriptItem } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { ChiefFab } from '../icons/index.js';
import { readStoredTheme } from '../theme.js';

/** Reject-chain walk state (AC3): idle = the fixture's confirm surface;
 *  streaming = the replan round (r8 67); landed = v(N+1) 待确认 (r8 68);
 *  building = the 确认 round opened after the chain's last step. */
type ChainState = 'idle' | 'streaming' | 'landed' | 'building';

export function TodoDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  // 文档|聊天 tabs (issue #56): 文档 = doc pane + chat column, 聊天 = chat
  // column alone. Pure render state — the captures all sit on 文档.
  const [tab, setTab] = useState<'doc' | 'chat'>('doc');
  const fixture = resolveScenario(searchParams);
  const todo = fixture.todos.find((t) => t.id === id) ?? fixture.todos[0];
  const detail0 = fixture.detail;
  const [menu, setMenu] = useState<'versions' | 'compare' | undefined>(detail0?.versionMenu);
  const [diff, setDiff] = useState(detail0?.planDiff);
  const [dialog, setDialog] = useState<'rerun' | 'reuse' | 'history' | undefined>(detail0?.dialog);
  const [chain, setChain] = useState<ChainState>('idle');

  const revision = detail0?.revision;
  // Chain view overrides: the streaming round borrows the planning
  // surface (r8 67), the landed round the confirm surface with the new
  // version's doc/dropdown, the building round the execution surface.
  const phase: Phase =
    chain === 'streaming'
      ? 'planning'
      : chain === 'building'
        ? 'building'
        : (todo?.phase ?? 'todo');
  const transcript: TranscriptItem[] = [...(detail0?.transcript ?? [])];
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
  const doc = chain === 'landed' || chain === 'building' ? revision?.landed.doc : detail0?.doc;
  const planVersions =
    chain === 'landed' || chain === 'building'
      ? revision?.landed.planVersions
      : detail0?.planVersions;
  const planDiff = chain === 'streaming' ? (revision?.planDiff ?? diff) : diff;

  if (todo == null) return null;
  const ui = PHASE_UI[phase];
  const detail = detail0;
  const streaming = transcript.some((item) => item.kind === 'streaming');
  // The doc pane flips to the 变更 surface once a run produced changes
  // (r7 27/36, r8 54/73); the plan-version diff surface wins while open
  // (r8 65–72); the plan surface serves todo→building (r7 16/17/26).
  const docMode =
    planDiff != null
      ? 'diff'
      : phase === 'review' || phase === 'done' || phase === 'failed'
        ? 'changes'
        : 'plan';

  return (
    <div className="detail-shell" data-route="todo-detail" data-todo-id={id}>
      <BoardSidebar attention={attentionCount(fixture.todos)} />
      <div className="detail-main">
        <DetailHead
          todo={todo}
          phase={phase}
          tab={tab}
          onTab={setTab}
          onAction={chain === 'landed' && revision != null ? () => setChain('building') : undefined}
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
                doc={doc}
                changes={detail.changes}
                planVersions={planVersions}
                versionMenu={menu}
                onVersionMenu={setMenu}
                onCompare={() => {
                  // 上一版本 (r8 64 → 65/71): opens the previous-version
                  // diff — the fixture's compare target, or the chain's
                  // landed diff once the reject loop produced one
                  setDiff(detail0?.compareTarget ?? revision?.landed.planDiff);
                  setMenu(undefined);
                }}
                onBase={() => {
                  setDiff(undefined);
                  setMenu(undefined);
                }}
                planDiff={planDiff}
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
                <Transcript transcript={transcript} />
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
              revision != null && chain === 'idle'
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
        </button>
      </div>
      {detail?.userMenuOpen === true && <UserMenu theme={readStoredTheme(localStorage)} />}
      {dialog === 'rerun' && (
        <RerunDialog reuse={todo.hasPlan} onReuse={() => setDialog('reuse')} />
      )}
      {dialog === 'reuse' && <ReusePanel onBack={() => setDialog('rerun')} />}
      {dialog === 'history' && <HistoryDialog rows={detail?.runHistory ?? []} />}
    </div>
  );
}
