// ⌘K search panel (issue #67, r7 05 + the 05b supplementary results
// capture): a fixed 520×440 panel centered on the viewport over a 60%
// black scrim. Empty query = the 前往 nav group (任务 row first and
// selected, then the eight nav routes, r7 05); a query folds the fixture
// todos into two-line 任务 result rows (title + project sub-line, right
// meta = relative time + phase chip pill, 05b) plus 项目/Agents groups
// for name matches; no hit = the 没有与"…"匹配的结果 line (r2 §8.4 04b,
// curly quotes verbatim). Geometry measured off the r7 bitmaps: input row
// 40 + 1px divider, group label block 31, rows 40 inset 8 with radius 8.

import { useEffect, useState } from 'react';
import { relativeTime } from '../board/rel-time.js';
import { PROJECT_INITIAL, PROJECT_NAME } from '../fixtures/fixtures.js';
import type { AgentRef, FixtureSet, TodoRecord } from '../fixtures/records.js';
import {
  Clock,
  FileCheck,
  Kanban,
  Key,
  Layers,
  Network,
  Puzzle,
  Search,
  Server,
  Users,
} from '../icons/index.js';
import { PHASE_UI } from '../phase.js';
import './overlays.css';

/** 前往 group rows, top to bottom. Canon is the r7 05 bitmap, not r2
 *  §8.4: the live set dropped 帐号/API 密钥 (r6) and grew the selected
 *  任务 row — both visible in 05 and in the 05b recapture. */
const NAV_ROWS = [
  { label: '任务', Icon: FileCheck },
  { label: '看板', Icon: Kanban },
  { label: '定时', Icon: Clock },
  { label: '团队', Icon: Users },
  { label: '技能', Icon: Puzzle },
  { label: 'MCP', Icon: Network },
  { label: '密钥', Icon: Key },
  { label: '机器', Icon: Server },
  { label: '模型服务', Icon: Layers },
];

interface SearchPanelProps {
  fixture: FixtureSet;
  query: string;
  onQuery: (query: string) => void;
  onClose: () => void;
}

function TodoRow({ todo, now, selected }: { todo: TodoRecord; now: number; selected: boolean }) {
  const ui = PHASE_UI[todo.phase];
  return (
    <button
      type="button"
      className={`search-row search-row--todo${selected ? ' search-row--selected' : ''}`}
    >
      <span className="search-row-icon">
        <FileCheck width={16} height={16} />
      </span>
      <span className="search-row-main">
        <span className="search-row-title">
          #{todo.seqNum} {todo.title}
        </span>
        <span className="search-row-sub">{PROJECT_NAME}</span>
      </span>
      <span className="search-row-time">{relativeTime(todo.phaseAt, now)}</span>
      <span className={`search-row-chip search-row-chip--${ui.tone}`}>{ui.chip}</span>
    </button>
  );
}

export function SearchPanel({ fixture, query, onQuery, onClose }: SearchPanelProps) {
  const q = query.trim().toLowerCase();
  const todos = q === '' ? [] : fixture.todos.filter((t) => t.title.toLowerCase().includes(q));
  const agents =
    q === ''
      ? []
      : [...new Set(fixture.todos.map((t) => t.agent))]
          .filter((agent): agent is AgentRef => agent != null)
          .filter((agent) => agent.displayName.toLowerCase().includes(q));
  const projectHit = q !== '' && PROJECT_NAME.toLowerCase().includes(q);
  const hitCount = todos.length + agents.length + (projectHit ? 1 : 0);

  return (
    <>
      {/* scrim as its own control: click outside the panel closes it
          (Escape does too, via useSearchState) — [推断] affordance, no
          capture exercises either */}
      <button type="button" className="search-scrim" aria-label="关闭搜索" onClick={onClose} />
      <div className="search-panel" role="dialog" aria-label="搜索">
        <div className="search-input-row">
          <Search width={13} height={13} />
          <input
            // the live panel opens focused (r7 05/05b show the caret);
            // ref-focus keeps the caret without the autoFocus attribute
            ref={(input) => input?.focus()}
            value={query}
            placeholder="搜索任务、项目、成员…"
            onChange={(event) => onQuery(event.target.value)}
          />
        </div>
        {q === '' ? (
          <div className="search-list">
            <div className="search-group-label">前往</div>
            {NAV_ROWS.map(({ label, Icon }, index) => (
              <button
                type="button"
                key={label}
                className={`search-row${index === 0 ? ' search-row--selected' : ''}`}
              >
                <Icon width={16} height={16} />
                {label}
              </button>
            ))}
          </div>
        ) : hitCount === 0 ? (
          <div className="search-empty">没有与“{query.trim()}”匹配的结果</div>
        ) : (
          <div className="search-list">
            {todos.length > 0 && (
              <>
                <div className="search-group-label">任务</div>
                {todos.map((todo, index) => (
                  <TodoRow key={todo.id} todo={todo} now={fixture.now} selected={index === 0} />
                ))}
              </>
            )}
            {projectHit && (
              <>
                <div className="search-group-label">项目</div>
                <button
                  type="button"
                  className={`search-row search-row--todo${todos.length === 0 ? ' search-row--selected' : ''}`}
                >
                  <span className="search-row-icon search-row-icon--project">
                    {PROJECT_INITIAL}
                  </span>
                  <span className="search-row-main">
                    <span className="search-row-title">{PROJECT_NAME}</span>
                  </span>
                </button>
              </>
            )}
            {agents.length > 0 && (
              <>
                <div className="search-group-label search-group-label--upper">Agents</div>
                {agents.map((agent, index) => (
                  <button
                    type="button"
                    key={agent.id}
                    className={`search-row search-row--todo${
                      todos.length === 0 && !projectHit && index === 0
                        ? ' search-row--selected'
                        : ''
                    }`}
                  >
                    <span className="search-row-icon search-row-icon--agent">
                      <img src="/avatar-robot-1.svg" alt="" />
                    </span>
                    <span className="search-row-main">
                      <span className="search-row-title">{agent.displayName}</span>
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/** ⌘K / Escape wiring + the scenario-frozen initial open state (issue
 *  #67). Shared by the board and detail routes so the hotkey works on
 *  both; the panel itself is viewport-fixed. */
export function useSearchState(initialOpen: boolean, initialQuery: string) {
  const [open, setOpen] = useState(initialOpen);
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen, query, setQuery };
}
