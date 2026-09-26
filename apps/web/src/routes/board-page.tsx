// Board route (issue #54): app shell = sidebar + board surface, content
// picked by the scenario fixture (issue #52 mechanism). The sidebar is the
// shared AppSidebar (#129): the collapse state (storage-backed, #55 — the
// parity harness injects the key like the theme one), the 用量 row, the
// online dot and the ⌘K row derive identically on every route; this route
// keeps its own SearchPanel because the fixture ui.searchOpen open states
// drive the parity rows.
// #72: the chief surfaces ride this route — the drawer overlays the board
// (r5 100/111/114/116) and the 总管设置 gear swaps the content area to the
// settings view (r5 101–104). Both open states are fixture-driven for
// parity; the FAB/gear/back/close buttons make them reachable in dev. The
// wake wiring lives in use-chief-surface (#129), shared with every other
// shell family's FAB.
// #83 (M5): live 数据源分支——无 `?scenario=` 时看板走真 API（todos/
// machines/notifications/chief + 新建/开始/拖拽排序/验收合并 mutation），
// fixture 分支保持 #52–#75 行为字节不变（parity 矩阵数据面）。

import type { TodoRecord as WireTodo } from '@pacman/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  useApiMutations,
  useMachines,
  useMembers,
  useProjects,
  useSearchResults,
  useSkills,
  useTodos,
} from '../api/hooks.js';
import { toDisplayTodo } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { AppSidebar } from '../board/app-sidebar.js';
import { BoardSurface } from '../board/board.js';
import { NotificationBanner, useNotificationBanner } from '../board/notify-banner.js';
import { ChiefDrawer } from '../chief/chief-drawer.js';
import { ChiefSettings } from '../chief/chief-settings.js';
import { useChiefSurface } from '../chief/use-chief-surface.js';
import { AcceptDialog } from '../detail/accept-dialog.js';
import { BranchDialog } from '../detail/branch-dialog.js';
import { withoutDeleted } from '../fixtures/deletions.js';
import { localTodo, overlayContent } from '../fixtures/fixtures.js';
import type { FixtureSet, OverlayState, TodoRecord } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ChiefFab } from '../icons/index.js';
import type { MentionGroups } from '../overlay/mention-picker.js';
import { NewTaskDialog } from '../overlay/new-task-dialog.js';
import { SearchPanel, useSearchState } from '../overlays/search-panel.js';
// shell styles live with the board surface; the settings view (101–104)
// unmounts BoardSurface but keeps the shell, so the route imports them too
import '../board/board.css';

/** 拖拽提交逐卡发送的字段（#160）：手动改相 + 列内排序位（server
 *  patchTodoBodySchema 两位；首次落位会把触及列的 orderIndex 一次性
 *  归一成列视图序，其后幂等）。 */
interface ReorderPatch {
  phase?: TodoRecord['phase'];
  orderIndex?: number;
}

export function BoardPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { live, teamId } = useLiveData();
  const fixture = resolveScenario(searchParams);
  // chief 面（#72/#129）：三态视图 + live 数据 wiring 由共享 hook 承载，
  // 与其余 shell 族的 FAB 唤醒同一 surface。
  const { chiefView, setChiefView, chiefData, chiefUnread, onSend, onThread, onNewThread } =
    useChiefSurface(fixture);

  // —— live 数据面（#83）：查询 + mutations；fixture 模式全部惰性（enabled
  // = live），parity 采集零请求零流。——
  const todosQ = useTodos(teamId, live);
  const projectsQ = useProjects(teamId, live);
  const membersQ = useMembers(teamId, live);
  const machinesQ = useMachines(teamId, live);
  const skillsQ = useSkills(teamId, live);
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
  // W4 #286：live 面服务端搜索（fixture/parity 面不经此钩）。
  const searchResults = useSearchResults(search.query, live && search.open);
  // #114: 看板顶部通知引导条 — live reads the real Notification.permission;
  // fixture scenarios opt in via ui.notificationBanner (parity determinism,
  // the r7 baselines carry no banner)
  const notifyBanner = useNotificationBanner(fixture.ui?.notificationBanner === true, live);

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
    (title: string, selectedProjectId?: string, spec: string = title) => {
      setNewTaskOpen(false);
      if (live) {
        // #176: dialog 选中项目优先;未选(空集/查询未决)退首行真值
        const projectId = selectedProjectId ?? projectsQ.data?.[0]?.id;
        if (projectId) {
          mutations.createTodo.mutate({ projectId, title, spec });
          return;
        }
        // 无项目：先建默认托管项目再落任务（self-host 单用户语义 [设计]，
        // 02 §3 项目创建流两分支的 hosted 侧）。
        mutations.createProject.mutate(
          { name: t('默认项目'), repoKind: 'hosted' },
          {
            onSuccess: (p) => mutations.createTodo.mutate({ projectId: p.id, title, spec }),
          },
        );
        return;
      }
      setFixtureTodos((prev) => [
        ...prev,
        // fixture.now is the session's reference instant, so the fresh
        // card reads 刚刚 against the same clock as the frozen labels.
        // fixture 面 localTodo 保持 canon projectId(approximation,选择
        // 是纯表单 state 无 mutation,#176 票面 live 语义)。
        localTodo(prev.reduce((max, t) => Math.max(max, t.seqNum), 0) + 1, title, fixture.now),
      ]);
    },
    [live, projectsQ.data, mutations.createTodo, mutations.createProject, fixture, t],
  );

  // 保存并开始（r2 §4.2 双钮语义，M5 live）：创建 → POST builds（withPlan，
  // 首 Agent 双槽指派 [设计]）。fixture 面 = 同 保存。
  const createAndStart = useCallback(
    (title: string, selectedProjectId?: string, spec: string = title) => {
      setNewTaskOpen(false);
      if (!live) {
        createTodo(title, selectedProjectId, spec);
        return;
      }
      const start = (projectId: string) =>
        mutations.createTodo.mutate(
          { projectId, title, spec },
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
      const projectId = selectedProjectId ?? projectsQ.data?.[0]?.id;
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

  // 拖拽落位（#73 / M5 / #160）：fixture = 本地集；live = 逐卡增量 PATCH
  // （phase = 手动改相 + orderIndex = 列内排序位，server patchTodoBodySchema
  // 两位）。diff 基线 = 落位前 todo 集：moveTodo 的输出已把 orderIndex 回写
  // 成列视图序，拿它自身重算再比恒相等（#160 前的死路），故与落位前快照比。
  const handleReorder = useCallback(
    (next: TodoRecord[]) => {
      if (!live) {
        setFixtureTodos(next);
        return;
      }
      const changes = new Map<string, ReorderPatch>();
      for (const todo of next) {
        const before = todos.find((p) => p.id === todo.id);
        if (before == null) continue;
        const body: ReorderPatch = {};
        if (before.phase !== todo.phase) body.phase = todo.phase;
        if (before.orderIndex !== todo.orderIndex) body.orderIndex = todo.orderIndex;
        if (body.phase === undefined && body.orderIndex === undefined) continue;
        changes.set(todo.id, body);
      }
      if (changes.size === 0) return;
      // 乐观落位：卡片停在落点不弹回再跳；phaseAt 近似 server nowMs()。
      // 01 §4.1「server state 全走查询失效重取」裁定 [设计]：乐观值只是落点
      // 的同帧预览，真值源仍是 PATCH 回合的 invalidate 重取（成败两路收敛）。
      queryClient.setQueryData<WireTodo[]>(['todos', teamId], (old) =>
        old?.map((w) => {
          const body = changes.get(w.id);
          if (body == null) return w;
          return {
            ...w,
            ...(body.phase !== undefined ? { phase: body.phase, phaseAt: Date.now() } : {}),
            ...(body.orderIndex !== undefined ? { orderIndex: body.orderIndex } : {}),
          };
        }),
      );
      for (const [id, body] of changes) {
        mutations.patchTodo.mutate(
          { id, body },
          // 409/网络败 = 乐观值作废，重取回 server 真值（卡片弹回 = 真值）
          { onError: () => queryClient.invalidateQueries({ queryKey: ['todos', teamId] }) },
        );
      }
    },
    [live, todos, teamId, mutations.patchTodo, queryClient],
  );

  const content = overlayTodo != null ? overlayContent(overlayTodo.id) : null;
  // live overlay 数据（验收合并只依赖 latestBuildId——branch dialog 数据面
  // 归详情页；看板 branch 弹层在 live 下取查询值兜底 null 关闭）。
  // live 面 now = 墙钟（相对时间标签随 SSE 失效重渲染滚动）；fixture 面保持
  // 冻结采集时刻（parity 确定性）。projectNames = 卡面/搜索/新建 dialog 的
  // 项目 chip 真名位（fixture 面缺省走 capture canon 常量）。
  const projectNames = useMemo(() => {
    if (!live) return undefined;
    return Object.fromEntries((projectsQ.data ?? []).map((p) => [p.id, p.name]));
  }, [live, projectsQ.data]);
  // #176 新建任务 dialog 项目选择器数据位:live = projectsQ 真值投影
  // (undefined = 查询未决);fixture = scenario projectNames(缺省 =
  // undefined → dialog 退 canon 单默认项目)。选择是纯表单 state。
  const projectRows = useMemo(() => {
    if (live) return projectsQ.data?.map((p) => ({ id: p.id, name: p.name }));
    if (fixture.projectNames == null) return undefined;
    return Object.entries(fixture.projectNames).map(([id, name]) => ({ id, name }));
  }, [live, projectsQ.data, fixture.projectNames]);

  // #311 mention picker groups: board's new-task dialog needs the same
  // entity set the composer surfaces. Live pulls the canonical REST
  // hooks; fixture derives from the local scenario (resources carries
  // skills + machines; team roster carries agents; projectNames drives
  // projects). When the live hooks are still loading, fall back to the
  // empty rows so the picker still opens with a 0 count.
  const liveTodoSet: WireTodo[] = todosQ.data ?? [];
  const mentionGroups: MentionGroups = live
    ? {
        todo: liveTodoSet.map((t) => ({
          id: t.id,
          label: `#${t.seqNum} ${t.title}`,
          seq: t.seqNum,
          subtitle: t.phase,
        })),
        agent: (membersQ.data ?? [])
          .filter((m) => m.memberType === 'agent')
          .map((m) => ({
            id: m.actorId,
            label: (m.actor as { displayName?: string } | undefined)?.displayName ?? m.actorId,
            subtitle:
              (m.actor as { description?: string | null } | undefined)?.description ?? undefined,
          })),
        project: (projectsQ.data ?? []).map((p) => ({ id: p.id, label: p.name })),
        skill: (skillsQ.data ?? []).map((s) => ({
          id: s.id,
          label: s.name,
          subtitle: s.description ?? undefined,
        })),
        machine: (machinesQ.data ?? []).map((m) => ({ id: m.id, label: m.name })),
      }
    : {
        todo: fixtureTodos.map((t) => ({
          id: t.id,
          label: `#${t.seqNum} ${t.title}`,
          seq: t.seqNum,
          subtitle: t.phase,
        })),
        agent: (fixture.team?.agents ?? []).map((a) => ({
          id: a.id,
          label: a.displayName,
          subtitle: a.role ?? a.model,
        })),
        project: Object.entries(fixture.projectNames ?? {}).map(([id, name]) => ({
          id,
          label: name,
        })),
        skill: (fixture.resources?.skills ?? []).map((s) => ({
          id: s.name,
          label: s.name,
          subtitle: s.description,
        })),
        machine: (fixture.resources?.machines ?? [])
          .filter((m) => m.hosted !== true)
          .map((m) => ({ id: m.name, label: m.name, subtitle: m.sub })),
      };
  const fixtureWithTodos: FixtureSet = live
    ? { ...fixture, todos, now: Date.now(), ...(projectNames ? { projectNames } : {}) }
    : { ...fixture, todos };
  return (
    <div className="board-shell h-full" data-route="board">
      <AppSidebar
        fixture={fixture}
        todos={todos}
        selected={chiefView === 'settings' ? 'none' : 'board'}
        searchPanel={false}
        onSearch={() => search.setOpen(true)}
      />
      {chiefView === 'settings' ? (
        <ChiefSettings chief={chiefData} onBack={() => setChiefView('drawer')} />
      ) : (
        <BoardSurface
          fixture={fixtureWithTodos}
          onNewTask={() => setNewTaskOpen(true)}
          banner={
            notifyBanner.visible ? <NotificationBanner onEnable={notifyBanner.enable} /> : undefined
          }
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
        server={live ? searchResults.data : undefined}
      />
      <ChiefDrawer
        open={chiefView === 'drawer'}
        chief={chiefData}
        onSettings={() => setChiefView('settings')}
        onClose={() => setChiefView('none')}
        onSend={onSend}
        onThread={onThread}
        onNewThread={onNewThread}
      />
      <NewTaskDialog
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onSave={createTodo}
        onSaveAndStart={live ? createAndStart : undefined}
        projects={projectRows}
        mentionGroups={mentionGroups}
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
