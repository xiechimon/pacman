// ⌘K search panel (issue #67, r7 05 + the 05b supplementary results
// capture): a fixed 520×440 panel centered on the viewport over a 60%
// black scrim. Empty query = the 前往 nav group (任务 row first and
// selected, then the eight nav routes, r7 05); a query folds the fixture
// todos into two-line 任务 result rows (title + project sub-line, right
// meta = relative time + phase chip pill, 05b) plus 项目/Agents groups
// for name matches; no hit = the 没有与"…"匹配的结果 line (r2 §8.4 04b,
// curly quotes verbatim). Geometry measured off the r7 bitmaps: input row
// 40 + 1px divider, group label block 31, rows 40 inset 8 with radius 8.
// #159: every row is a live SPA hop (todo→详情, 项目→项目页, agent→团队,
// 前往→对应路由) carrying the current ?search= along (#121 convention) and
// closing the panel. The highlight is hover-followed: no row is lit at
// rest, CSS :hover lights the row under the mouse, ↑↓ moves a keyboard
// cursor (data-kbd on the panel suppresses the hover pill so exactly one
// row stays lit; Enter hops to it), and any real pointer movement hands
// the highlight back to the mouse.

import type { SearchResponse } from '@pacman/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAgentAvatarUrlById } from '../api/provider.js';
import { relativeTime } from '../board/rel-time.js';
import { DialogShell, VIEWPORT_POP_ANIM } from '../components/ui/dialog-shell.js';
import { Input } from '../components/ui/input.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import { PROJECT_ID, PROJECT_INITIAL, PROJECT_NAME } from '../fixtures/fixtures.js';
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
import './overlays.css';

/** 前往 group rows, top to bottom. Canon is the r7 05 bitmap, not r2
 *  §8.4: the live set dropped 帐号/API 密钥 (r6) and grew the selected
 *  任务 row — both visible in 05 and in the 05b recapture. #159: each row
 *  hops to its route — the sidebar RESOURCE_ROWS twins verbatim; 任务 and
 *  工作台 both land on /app (the clone has no standalone tasks view,
 *  [推断] like the panel's own nav set). */
const NAV_ROWS = [
  { label: '任务', Icon: FileCheck, href: '/app' },
  { label: '工作台', Icon: Kanban, href: '/app' },
  { label: '定时', Icon: Clock, href: '/app/schedules' },
  { label: '团队', Icon: Users, href: '/app/team' },
  { label: '技能', Icon: Puzzle, href: '/app/resources/skills' },
  { label: 'MCP', Icon: Network, href: '/app/resources/mcp-servers' },
  { label: '密钥', Icon: Key, href: '/app/resources/secrets' },
  { label: '机器', Icon: Server, href: '/app/resources/machines' },
  { label: '模型服务', Icon: Layers, href: '/app/resources/providers' },
];

interface SearchPanelProps {
  fixture: FixtureSet;
  query: string;
  onQuery: (query: string) => void;
  /** #73 retained-mount open flag. */
  open: boolean;
  onClose: () => void;
  /** W4 #286：live 面服务端搜索结果（调用方经 useSearchResults 注入）。
   *  提供且 q 非空 = 服务端结果集（GET /api/search，02 §6.3 [设计]）；缺省 =
   *  客户端过滤（fixture 面 DOM 零改动）。 */
  server?: SearchResponse;
}

/** W4 #286 行面结构化：fixture TodoRecord/AgentRef 与服务端 search 行共形
 * （面板行渲染消费的最小字段集）。 */
interface TodoRowItem {
  id: string;
  seqNum: number;
  title: string;
  phase: TodoRecord['phase'];
  phaseAt: number;
  /** fixture 行的 projectNames 查表键；服务端行缺省（projectName 自带）。 */
  projectId?: string;
  /** 服务端 search 行自带（W4 #286）；fixture 行经 projectNames 查表。 */
  projectName?: string;
}
interface AgentRowItem {
  id: string;
  displayName: string;
  /** XMON-105: explicit avatar override; the live search envelope carries
   *  no avatarUrl, so live rows join it from the members read-side (same
   *  identity the team page renders). */
  avatarUrl?: string | null;
}
interface ProjectRowItem {
  id: string;
  name: string;
}

function TodoRow({
  todo,
  now,
  selected,
  index,
  onActivate,
  projectName,
}: {
  todo: TodoRowItem;
  now: number;
  /** #159: lit only while the ↑↓ keyboard cursor sits here — the mouse
   *  hover pill is CSS (:hover), and at rest no row is selected. */
  selected: boolean;
  /** Flat row position in the list (keyboard cursor + scroll-into-view). */
  index: number;
  onActivate: () => void;
  /** M5 live：真项目名（fixture.projectNames 位 / 服务端行自带）；缺省 = capture canon。 */
  projectName?: string;
}) {
  const { t } = useI18n();
  const ui = PHASE_UI[todo.phase];
  return (
    <button
      type="button"
      data-row-index={index}
      onClick={onActivate}
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

/** #137 常亮互斥: one lit focus surface globally. While any search panel
 *  is open, `data-search-open` on the root dims the page-layer 常亮
 *  selected pills (overlays.css); the panel's own selected row stays the
 *  single lit surface. Module-level count so a route-owned panel and the
 *  shell-owned panel (app-sidebar) never clobber each other's marker. */
let openPanelCount = 0;
function useSingleLitSurface(open: boolean) {
  useEffect(() => {
    if (!open) return;
    openPanelCount += 1;
    document.documentElement.dataset.searchOpen = '';
    return () => {
      openPanelCount -= 1;
      if (openPanelCount === 0) delete document.documentElement.dataset.searchOpen;
    };
  }, [open]);
}

export function SearchPanel({ fixture, query, onQuery, open, onClose, server }: SearchPanelProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  // #121 convention: SPA hops carry the live query string so the fixture
  // scenario rides along (same as the sidebar / todo-card links).
  const { search } = useLocation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  // #159 hover 跟随: the ↑↓ keyboard cursor — the only JS-owned highlight.
  // null = at-rest / mouse-owned (rows light via CSS :hover, zero
  // re-renders); a real pointer movement releases the cursor (让位).
  const [cursor, setCursor] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  // #137 two-path focus. The ref callback below focuses at the real DOM
  // attach — the mount path, and the one that runs when ⌘K opens onto a
  // panel whose input does not exist yet. This effect is the reopen path:
  // the retained panel never detaches its input (mid-exit ⌘K), so the ref
  // callback does not re-fire and the open flip would leave the caret
  // nowhere. Both paths must stay: dropping either regresses ⌘K focus.
  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);
  const attachInput = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (node && openRef.current) node.focus({ preventScroll: true });
  }, []);
  useSingleLitSurface(open);
  const q = query.trim().toLowerCase();
  // W4 #286：live 面切服务端结果集（server 注入 + q 非空）；fixture
  // 面保持客户端过滤（渲染 DOM 零改动）。
  const useServer = server !== undefined && q !== '';
  const todos: TodoRowItem[] = useServer
    ? server.todos
    : q === ''
      ? []
      : fixture.todos.filter((t) => t.title.toLowerCase().includes(q));
  // XMON-105: live agent rows join avatarUrl from the members read-side
  // (the /api/search envelope carries no avatar field).
  const agentAvatarById = useAgentAvatarUrlById();
  const agents: AgentRowItem[] = useServer
    ? server.agents.map((a) => ({ ...a, avatarUrl: agentAvatarById.get(a.id) ?? null }))
    : q === ''
      ? []
      : [...new Set(fixture.todos.map((t) => t.agent))]
          .filter((agent): agent is AgentRef => agent != null)
          .filter((agent) => agent.displayName.toLowerCase().includes(q));
  // M5 live：项目 chip/命中 = 真项目名（首位；多项目面归后票）；fixture 面
  // 保持 capture canon 常量。
  const projectName = fixture.projectNames
    ? (Object.values(fixture.projectNames)[0] ?? PROJECT_NAME)
    : PROJECT_NAME;
  const projects: ProjectRowItem[] = useServer
    ? server.projects
    : q !== '' && projectName.toLowerCase().includes(q)
      ? [
          {
            id: fixture.projectNames
              ? (Object.keys(fixture.projectNames)[0] ?? PROJECT_ID)
              : PROJECT_ID,
            name: projectName,
          },
        ]
      : [];
  const hitCount = todos.length + agents.length + projects.length;

  // Flat activation targets in render order — the ↑↓ cursor's index space
  // (nav rows on the empty query; todos → 项目 rows → agents on a hit list).
  const targets =
    q === ''
      ? NAV_ROWS.map((row) => row.href)
      : [
          ...todos.map((todo) => `/app/todo/${todo.id}`),
          ...projects.map((project) => `/app/project/${project.id}`),
          ...agents.map(() => '/app/team'),
        ];

  const go = (pathname: string) => {
    navigate({ pathname, search });
    onClose();
  };
  const releaseCursor = () => setCursor(null);

  // A query or open flip rebuilds the flat index space — the cursor drops
  // and the panel returns to its at-rest state: no fixed lit row (#159).
  useEffect(() => {
    setCursor(null);
  }, [query, open]);

  // The keyboard cursor stays in view inside the scrollable list.
  useEffect(() => {
    if (cursor == null) return;
    listRef.current
      ?.querySelector(`[data-row-index="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  return (
    // #453：视口根面走 DialogShell 的 `viewportRoot` 变体——面板自带 fixed
    // 几何（.search-panel），scrim 归壳的 Backdrop 位（皮肤经
    // backdropClassName 给），模态机制（焦点圈定 / 滚动锁 / Esc 层栈）由壳
    // 承载。z 档 = #688 阶梯的 --z-modal（背板由壳减一 = --z-modal-scrim
    // 同值，overlays.css 的 CSS 对读同一条阶梯）。
    <DialogShell
      open={open}
      onClose={onClose}
      viewportRoot
      // 背板是 Base UI Backdrop（自带 data-open/data-closed）→ 自变体淡入淡出，
      // 与 .dlg 默认背板同档（duration-200 fade）。
      backdropClassName="search-scrim duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      zIndex="var(--z-modal)"
    >
      <div
        className={`search-panel ${VIEWPORT_POP_ANIM}`}
        role="dialog"
        aria-label={t('搜索')}
        // kbd marker: while the ↑↓ cursor is live the CSS hover pill stands
        // down (overlays.css) so exactly one row is lit (#159)
        data-kbd={cursor != null ? '' : undefined}
        // entering the panel (incl. a synthetic pointer jump straight onto
        // a row) hands the highlight to the mouse as well
        onMouseEnter={releaseCursor}
        onMouseMove={(event) => {
          // 鼠标一动让位: only a *real* move (coordinate delta) drops the
          // keyboard cursor — a scroll-jitter re-fire under a resting
          // pointer keeps it.
          const prev = pointerRef.current;
          pointerRef.current = { x: event.clientX, y: event.clientY };
          if (prev != null && (prev.x !== event.clientX || prev.y !== event.clientY))
            setCursor(null);
        }}
      >
        <div className="search-input-row">
          <Search width={13} height={13} />
          {/* A5 收编：palette 裸输入形态（r7 05 canon）；e2e search-focus
              钉 .search-input-row input 元素结构选择器——Input 渲染的
              input 元素天然满足，ref 经 React 19 ref-as-prop 透传 */}
          <Input
            // the live panel opens focused (r7 05/05b show the caret);
            // the attach callback is the mount-time focus path (#137),
            // the [open] effect the retained-mount refocus.
            // B3: variant="palette" 皮肤换 Tailwind 工具类——flex-1 + 无框
            // 透明 + 13px 字，行容器几何（40px/padding/分隔线）per-face 保留。
            ref={attachInput}
            className="flex-1 h-auto border-none p-0 text-[13px] md:text-[13px] leading-4 rounded-none bg-transparent dark:bg-transparent text-(--text-primary) placeholder:text-(--text-tertiary) focus-visible:border-transparent focus-visible:!ring-0"
            value={query}
            placeholder={t('搜索任务、项目、成员…')}
            onChange={(event) => onQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                if (targets.length === 0) return;
                event.preventDefault();
                const step = event.key === 'ArrowDown' ? 1 : -1;
                setCursor((prev) =>
                  prev == null
                    ? event.key === 'ArrowDown'
                      ? 0
                      : targets.length - 1
                    : (prev + step + targets.length) % targets.length,
                );
              } else if (event.key === 'Enter' && cursor != null) {
                // Enter follows the visible cursor only — an unlit row is
                // never activated (#159: no hidden default selection).
                const target = targets[cursor];
                if (target == null) return;
                event.preventDefault();
                go(target);
              }
            }}
          />
        </div>
        {q === '' ? (
          <div className="search-list" ref={listRef}>
            <div className="search-group-label">{t('前往')}</div>
            {NAV_ROWS.map(({ label, Icon, href }, index) => (
              <button
                type="button"
                key={label}
                data-row-index={index}
                className={`search-row${cursor === index ? ' search-row--selected' : ''}`}
                onClick={() => go(href)}
              >
                <Icon width={16} height={16} />
                {t(label)}
              </button>
            ))}
          </div>
        ) : hitCount === 0 ? (
          <div className="search-empty">{t('没有与“{q}”匹配的结果', { q: query.trim() })}</div>
        ) : (
          <div className="search-list" ref={listRef}>
            {todos.length > 0 && (
              <>
                <div className="search-group-label">{t('任务')}</div>
                {todos.map((todo, index) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    now={fixture.now}
                    selected={cursor === index}
                    index={index}
                    onActivate={() => go(`/app/todo/${todo.id}`)}
                    projectName={
                      useServer
                        ? todo.projectName
                        : ((todo.projectId !== undefined
                            ? fixture.projectNames?.[todo.projectId]
                            : undefined) ?? projectName)
                    }
                  />
                ))}
              </>
            )}
            {projects.length > 0 && (
              <>
                <div className="search-group-label">{t('项目')}</div>
                {projects.map((project, index) => (
                  <button
                    type="button"
                    key={project.id}
                    data-row-index={todos.length + index}
                    className={`search-row search-row--todo${
                      cursor === todos.length + index ? ' search-row--selected' : ''
                    }`}
                    onClick={() => go(`/app/project/${project.id}`)}
                  >
                    <span className="search-row-icon search-row-icon--project">
                      {project.name.charAt(0).toLowerCase() || PROJECT_INITIAL}
                    </span>
                    <span className="search-row-main">
                      <span className="search-row-title">{project.name}</span>
                    </span>
                  </button>
                ))}
              </>
            )}
            {agents.length > 0 && (
              <>
                <div className="search-group-label search-group-label--upper">Agents</div>
                {agents.map((agent, index) => {
                  // flat cursor space: todos → 项目 rows → agents (#159)
                  const rowIndex = todos.length + projects.length + index;
                  return (
                    <button
                      type="button"
                      key={agent.id}
                      data-row-index={rowIndex}
                      className={`search-row search-row--todo${
                        cursor === rowIndex ? ' search-row--selected' : ''
                      }`}
                      onClick={() => go('/app/team')}
                    >
                      <span className="search-row-icon search-row-icon--agent">
                        <SeededAvatar
                          name={agent.displayName}
                          src={agent.avatarUrl}
                          fallback="/avatar-robot-1.svg"
                        />
                      </span>
                      <span className="search-row-main">
                        <span className="search-row-title">{agent.displayName}</span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </DialogShell>
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
