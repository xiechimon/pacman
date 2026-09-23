// Board route (issue #54): app shell = sidebar + board surface, content
// picked by the scenario fixture (issue #52 mechanism). #55: the sidebar
// collapse toggle is real state, persisted beside the theme; the exact key
// is [推断] (r2 §1.1 only documents `tds.sidebarProjectsCollapsed` for the
// project-group fold), and the parity harness injects it like the theme
// key so the rail capture stays deterministic.
// #72: the chief surfaces ride this route — the drawer overlays the board
// (r5 100/111/114/116) and the 总管设置 gear swaps the content area to the
// settings view (r5 101–104). Both open states are fixture-driven for
// parity; the FAB/gear/back/close buttons make them reachable in dev.
// #83 (M5): live 数据源分支——无 `?scenario=` 时看板走真 API（todos/
// machines/notifications/chief + 新建/开始/拖拽排序/验收合并 mutation），
// fixture 分支保持 #52–#75 行为字节不变（parity 矩阵数据面）。
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  useApiMutations,
  useChief,
  useChiefThreads,
  useMachines,
  useMembers,
  useMessages,
  useNotifications,
  useProjects,
  useTodos,
} from '../api/hooks.js';
import { mapChief, toDisplayTodo } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { useConversationStream } from '../api/sse.js';
import { BoardSurface } from '../board/board.js';
import { attentionCount } from '../board/columns.js';
import { BoardSidebar } from '../board/sidebar.js';
import { ChiefDrawer } from '../chief/chief-drawer.js';
import { ChiefSettings } from '../chief/chief-settings.js';
import { AcceptDialog } from '../detail/accept-dialog.js';
import { BranchDialog } from '../detail/branch-dialog.js';
import { withoutDeleted } from '../fixtures/deletions.js';
import { chiefDefault, localTodo, overlayContent } from '../fixtures/fixtures.js';
import type { FixtureSet, OverlayState, TodoRecord } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ChiefFab } from '../icons/index.js';
import { NewTaskDialog } from '../overlay/new-task-dialog.js';
import { SearchPanel, useSearchState } from '../overlays/search-panel.js';
// shell styles live with the board surface; the settings view (101–104)
// unmounts BoardSurface but keeps the shell, so the route imports them too
import '../board/board.css';

export const SIDEBAR_STORAGE_KEY = 'tds.sidebar-collapsed'; // mirrored in parity/run.mjs

function readCollapsed(storage: Storage): boolean {
  return storage.getItem(SIDEBAR_STORAGE_KEY) === '1';
}

export function BoardPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { live, teamId } = useLiveData();
  const [collapsed, setCollapsed] = useState(() => readCollapsed(localStorage));
  const fixture = resolveScenario(searchParams);

  // —— live 数据面（#83）：查询 + mutations；fixture 模式全部惰性（enabled
  // = live），parity 采集零请求零流。——
  const todosQ = useTodos(teamId, live);
  const projectsQ = useProjects(teamId, live);
  const machinesQ = useMachines(teamId, live);
  const notificationsQ = useNotifications(teamId, live);
  const membersQ = useMembers(teamId, live);
  const chiefQ = useChief(teamId, live);
  const chiefThreadsQ = useChiefThreads(teamId, live);
  const mutations = useApiMutations(teamId);

  // New-task dialog (#66): fixture phase has no backend, so a saved task
  // lives in this client-side set — the card lands in 待开始 with the
  // 刚刚 label and the column count couples (r2 §4.2/§5.2). Deletions
  // made on the detail route ride along via the deletions overlay.
  // M5: live 模式下 todos = 查询真值（SSE → invalidate 重取），本地集仅
  // fixture 分支使用。
  const [fixtureTodos, setFixtureTodos] = useState<TodoRecord[]>(() =>
    withoutDeleted(fixture.todos),
  );
  const liveTodos = useMemo(() => (todosQ.data ?? []).map(toDisplayTodo), [todosQ.data]);
  const todos = live ? liveTodos : fixtureTodos;
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  // Modal overlays over the board (issue #68): the accept dialog opens from
  // the review card's 完成 button (r7 34) or the scenario fixture; the
  // branch dialog from the card's branch icon.
  const [overlay, setOverlay] = useState<OverlayState | null>(fixture.overlay ?? null);
  const [overlayTodo, setOverlayTodo] = useState<TodoRecord | null>(null);
  const closeOverlay = useCallback(() => setOverlay(null), []);
  const openFor = (todo: TodoRecord, kind: OverlayState['kind']) => {
    setOverlayTodo(todo);
    setOverlay({ kind });
  };
  const search = useSearchState(fixture.ui?.searchOpen === true, fixture.ui?.searchQuery ?? '');
  const toggle = useCallback(() => {
    const next = !collapsed;
    localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
    setCollapsed(next);
  }, [collapsed]);

  // live 面的默认执行 Agent（开始/重跑无 dialog 位——已建屏无开始弹窗，
  // assignment 取团队首个 Agent [设计]，02 §6.2 双槽同值；E2E 脊柱口径）。
  const firstAgentId = useMemo(() => {
    const member = (membersQ.data ?? []).find((m) => m.memberType === 'agent');
    return member?.actorId ?? null;
  }, [membersQ.data]);
  const startBuild = useCallback(
    (todo: TodoRecord, withPlan: boolean) => {
      if (!live) return;
      mutations.startBuilds.mutate({
        projectId: todo.projectId,
        todoIds: [todo.id],
        assignment: {
          plan: firstAgentId ? { agentId: firstAgentId } : null,
          build: firstAgentId ? { agentId: firstAgentId } : null,
        },
        withPlan,
      });
    },
    [live, mutations.startBuilds, firstAgentId],
  );

  const createTodo = useCallback(
    (title: string) => {
      setNewTaskOpen(false);
      if (live) {
        const projectId = projectsQ.data?.[0]?.id;
        if (projectId) {
          mutations.createTodo.mutate({ projectId, title, spec: title });
          return;
        }
        // 无项目：先建默认托管项目再落任务（self-host 单用户语义 [设计]，
        // 02 §3 项目创建流两分支的 hosted 侧）。
        mutations.createProject.mutate(
          { name: t('默认项目'), repoKind: 'hosted' },
          {
            onSuccess: (p) => mutations.createTodo.mutate({ projectId: p.id, title, spec: title }),
          },
        );
        return;
      }
      setFixtureTodos((prev) => [
        ...prev,
        // fixture.now is the session's reference instant, so the fresh
        // card reads 刚刚 against the same clock as the frozen labels
        localTodo(prev.reduce((max, t) => Math.max(max, t.seqNum), 0) + 1, title, fixture.now),
      ]);
    },
    [live, projectsQ.data, mutations.createTodo, mutations.createProject, fixture, t],
  );

  // 保存并开始（r2 §4.2 双钮语义，M5 live）：创建 → POST builds（withPlan，
  // 首 Agent 双槽指派 [设计]）。fixture 面 = 同 保存。
  const createAndStart = useCallback(
    (title: string) => {
      setNewTaskOpen(false);
      if (!live) {
        createTodo(title);
        return;
      }
      const start = (projectId: string) =>
        mutations.createTodo.mutate(
          { projectId, title, spec: title },
          {
            onSuccess: (created) =>
              mutations.startBuilds.mutate({
                projectId,
                todoIds: [created.id],
                assignment: {
                  plan: firstAgentId ? { agentId: firstAgentId } : null,
                  build: firstAgentId ? { agentId: firstAgentId } : null,
                },
                withPlan: true,
              }),
          },
        );
      const projectId = projectsQ.data?.[0]?.id;
      if (projectId) start(projectId);
      else
        mutations.createProject.mutate(
          { name: t('默认项目'), repoKind: 'hosted' },
          { onSuccess: (p) => start(p.id) },
        );
    },
    [
      live,
      createTodo,
      mutations.createTodo,
      mutations.startBuilds,
      mutations.createProject,
      projectsQ.data,
      firstAgentId,
      t,
    ],
  );

  // 拖拽落位（#73 / M5）：fixture = 本地集；live = 列内 orderIndex 增量
  // PATCH（01 §4.1 拖拽面，server patchTodoBodySchema.orderIndex 位）。
  const handleReorder = useCallback(
    (next: TodoRecord[]) => {
      if (!live) {
        setFixtureTodos(next);
        return;
      }
      const perColumn = new Map<string, number>();
      for (const todo of next) {
        const idx = perColumn.get(todo.phase) ?? 0;
        perColumn.set(todo.phase, idx + 1);
        if (todo.orderIndex !== idx) {
          mutations.patchTodo.mutate({ id: todo.id, body: { orderIndex: idx } });
        }
      }
    },
    [live, mutations.patchTodo],
  );

  const content = overlayTodo != null ? overlayContent(overlayTodo.id) : null;
  // live overlay 数据（验收合并只依赖 latestBuildId——branch dialog 数据面
  // 归详情页；看板 branch 弹层在 live 下取查询值兜底 null 关闭）。
  const chief = fixture.chief;

  // one three-state view: drawer and settings are mutually exclusive by
  // construction (r5: the gear swaps the drawer for the full-content view)
  const [chiefView, setChiefView] = useState<'none' | 'drawer' | 'settings'>(chief?.view ?? 'none');
  const chiefViewOpen = chiefView === 'drawer';

  // —— chief live 面（r5 §2/§3.6）：envelope + threads + 活动线程消息 +
  // 会话流订阅；发送 = POST threads / conversations messages。——
  const [activeThreadIdx, setActiveThreadIdx] = useState<number | null>(null);
  const liveThreads = chiefThreadsQ.data ?? [];
  const activeThread =
    live && liveThreads.length > 0 ? (liveThreads[activeThreadIdx ?? 0] ?? null) : null;
  const chiefMessagesQ = useMessages(live ? (activeThread?.id ?? null) : null, live);
  useConversationStream(
    live ? (activeThread?.id ?? undefined) : undefined,
    live && chiefViewOpen,
    {},
  );
  const liveChief = useMemo(() => {
    if (!live || !chiefQ.data) return null;
    return mapChief(chiefQ.data, {
      threads: liveThreads,
      activeThreadId: activeThread?.id ?? null,
      messages: chiefMessagesQ.data?.messages ?? [],
    });
  }, [live, chiefQ.data, liveThreads, activeThread, chiefMessagesQ.data]);

  const chiefData = live ? (liveChief ?? chiefDefault) : (chief ?? chiefDefault);
  // live 面 now = 墙钟（相对时间标签随 SSE 失效重渲染滚动）；fixture 面保持
  // 冻结采集时刻（parity 确定性）。projectNames = 卡面/搜索/新建 dialog 的
  // 项目 chip 真名位（fixture 面缺省走 capture canon 常量）。
  const projectNames = useMemo(() => {
    if (!live) return undefined;
    return Object.fromEntries((projectsQ.data ?? []).map((p) => [p.id, p.name]));
  }, [live, projectsQ.data]);
  const fixtureWithTodos: FixtureSet = live
    ? { ...fixture, todos, now: Date.now(), ...(projectNames ? { projectNames } : {}) }
    : { ...fixture, todos };
  const liveUnread = live
    ? (notificationsQ.data?.unreadThreadIds ?? []).filter((id) => id.startsWith('chief-')).length
    : 0;
  const chiefUnread = live ? liveUnread : (fixture.chiefUnread ?? 0);
  const machineOnline = live ? (machinesQ.data ?? []).some((m) => m.online) : chief != null;
  return (
    <div className="board-shell h-full" data-route="board">
      <BoardSidebar
        collapsed={collapsed}
        onToggle={toggle}
        attention={attentionCount(todos)}
        onSearch={() => search.setOpen(true)}
        usageNav={fixture.usageNav === true}
        selected={chiefView === 'settings' ? 'none' : 'board'}
        machineOnline={machineOnline}
      />
      {chiefView === 'settings' ? (
        <ChiefSettings chief={chiefData} onBack={() => setChiefView('drawer')} />
      ) : (
        <BoardSurface
          fixture={fixtureWithTodos}
          onNewTask={() => setNewTaskOpen(true)}
          onAction={(todo) => {
            if (live) {
              // r7 34: review 完成 = accept dialog（merge 202 delegated，
              // r3 §3.6）；todo/queued 开始 = POST builds（02 §4.2）；其余
              // 关口进详情页操作。
              if (todo.phase === 'review' && todo.awaitingReply !== true) openFor(todo, 'accept');
              else if (todo.phase === 'todo') startBuild(todo, true);
              else navigate(`/app/todo/${todo.id}`);
              return;
            }
            // r7 34: review-phase 完成 opens the accept dialog; 回复/确认
            // stay inert until their own tickets
            if (todo.phase === 'review' && todo.awaitingReply !== true) openFor(todo, 'accept');
          }}
          onBranch={(todo) => openFor(todo, 'branch')}
          // #73: drag drops commit into the same client-side todo set as
          // create/delete — column counts and folds re-derive from it
          onReorder={handleReorder}
        />
      )}
      <SearchPanel
        open={search.open}
        fixture={live ? { ...fixture, todos, now: Date.now() } : fixture}
        query={search.query}
        onQuery={search.setQuery}
        onClose={() => search.setOpen(false)}
      />
      <ChiefDrawer
        open={chiefView === 'drawer'}
        chief={chiefData}
        onSettings={() => setChiefView('settings')}
        onClose={() => setChiefView('none')}
        onSend={
          live
            ? (text) => {
                mutations.chiefSend.mutate(
                  { threadId: activeThread?.id ?? null, content: text },
                  {
                    onSuccess: () => {
                      // 新主题落线程首位（listChiefThreads 新在前）——切回 0 位。
                      if (activeThread === null) setActiveThreadIdx(0);
                    },
                  },
                );
              }
            : undefined
        }
        onThread={live ? (_title, index) => setActiveThreadIdx(index) : undefined}
      />
      <NewTaskDialog
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onSave={createTodo}
        onSaveAndStart={live ? createAndStart : undefined}
        projectName={live ? projectsQ.data?.[0]?.name : undefined}
      />
      <button
        type="button"
        className="chief-fab"
        aria-label={t('总管')}
        onClick={() => setChiefView('drawer')}
      >
        <ChiefFab />
        {chiefUnread > 0 && <span className="fab-badge">{chiefUnread}</span>}
      </button>
      <AcceptDialog
        open={overlay?.kind === 'accept'}
        onClose={closeOverlay}
        onConfirm={
          live && overlayTodo?.latestBuildId
            ? () => {
                mutations.mergeBuild.mutate(overlayTodo.latestBuildId as string);
                closeOverlay();
              }
            : undefined
        }
      />
      {content != null && (
        <BranchDialog
          open={overlay?.kind === 'branch'}
          info={content.branch}
          onClose={closeOverlay}
        />
      )}
    </div>
  );
}
