// ⌘K search panel (issue #67, r7 05 + the 05b supplementary results
// capture): a fixed 520×440 panel centered on the viewport over a 60%
// black scrim. Empty query = the 前往 nav group (任务 row first and
// selected, then the eight nav routes, r7 05); a query folds the fixture
// todos into two-line 任务 result rows (title + project sub-line, right
// meta = relative time + phase chip pill, 05b) plus 项目/Agents groups
// for name matches; no hit = the 没有与"…"匹配的结果 line (r2 §8.4 04b,
// curly quotes verbatim). Geometry measured off the r7 bitmaps: input row
// 40 + 1px divider, group label block 31, rows 40 inset 8 with radius 8.

import { useEffect, useRef, useState } from 'react';
import { relativeTime } from '../board/rel-time.js';
import { PROJECT_INITIAL, PROJECT_NAME } from '../fixtures/fixtures.js';
import type { AgentRef, FixtureSet, TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
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
import { OverlayMount } from './dismiss.js';
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
  /** #73 retained-mount open flag. */
  open: boolean;
  onClose: () => void;
}

function TodoRow({
  todo,
  now,
  selected,
  projectName,
}: {
  todo: TodoRecord;
  now: number;
  selected: boolean;
  /** M5 live：真项目名（fixture.projectNames 位）；缺省 = capture canon。 */
  projectName?: string;
}) {
  const { t } = useI18n();
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
        <span className="search-row-sub">{projectName ?? PROJECT_NAME}</span>
      </span>
      <span className="search-row-time">{relativeTime(todo.phaseAt, now, t)}</span>
      <span className={`search-row-chip search-row-chip--${ui.tone}`}>{t(ui.chip)}</span>
    </button>
  );
}

export function SearchPanel({ fixture, query, onQuery, open, onClose }: SearchPanelProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  const q = query.trim().toLowerCase();
  const todos = q === '' ? [] : fixture.todos.filter((t) => t.title.toLowerCase().includes(q));
  const agents =
    q === ''
      ? []
      : [...new Set(fixture.todos.map((t) => t.agent))]
          .filter((agent): agent is AgentRef => agent != null)
          .filter((agent) => agent.displayName.toLowerCase().includes(q));
  // M5 live：项目 chip/命中 = 真项目名（首位；多项目面归后票）；fixture 面
  // 保持 capture canon 常量。
  const projectName = fixture.projectNames
    ? (Object.values(fixture.projectNames)[0] ?? PROJECT_NAME)
    : PROJECT_NAME;
  const projectInitial = projectName.charAt(0).toLowerCase() || PROJECT_INITIAL;
  const projectHit = q !== '' && projectName.toLowerCase().includes(q);
  const hitCount = todos.length + agents.length + (projectHit ? 1 : 0);

  return (
    <OverlayMount open={open}>
      {/* scrim as its own control: click outside the panel closes it
          (Escape does too, via useSearchState) — [推断] affordance, no
          capture exercises either */}
      <button
        type="button"
        className="search-scrim anim-fade"
        aria-label={t('关闭搜索')}
        onClick={onClose}
      />
      <div className="search-panel anim-pop" role="dialog" aria-label={t('搜索')}>
        <div className="search-input-row">
          <Search width={13} height={13} />
          <input
            // the live panel opens focused (r7 05/05b show the caret);
            // retained mount refocuses on every open instead of mount
            ref={inputRef}
            value={query}
            placeholder={t('搜索任务、项目、成员…')}
            onChange={(event) => onQuery(event.target.value)}
          />
        </div>
        {q === '' ? (
          <div className="search-list">
            <div className="search-group-label">{t('前往')}</div>
            {NAV_ROWS.map(({ label, Icon }, index) => (
              <button
                type="button"
                key={label}
                className={`search-row${index === 0 ? ' search-row--selected' : ''}`}
              >
                <Icon width={16} height={16} />
                {t(label)}
              </button>
            ))}
          </div>
        ) : hitCount === 0 ? (
          <div className="search-empty">{t('没有与“{q}”匹配的结果', { q: query.trim() })}</div>
        ) : (
          <div className="search-list">
            {todos.length > 0 && (
              <>
                <div className="search-group-label">{t('任务')}</div>
                {todos.map((todo, index) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    now={fixture.now}
                    selected={index === 0}
                    projectName={fixture.projectNames?.[todo.projectId] ?? projectName}
                  />
                ))}
              </>
            )}
            {projectHit && (
              <>
                <div className="search-group-label">{t('项目')}</div>
                <button
                  type="button"
                  className={`search-row search-row--todo${todos.length === 0 ? ' search-row--selected' : ''}`}
                >
                  <span className="search-row-icon search-row-icon--project">{projectInitial}</span>
                  <span className="search-row-main">
                    <span className="search-row-title">{projectName}</span>
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
    </OverlayMount>
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
