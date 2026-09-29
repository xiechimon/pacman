// Board route (issue #54): app shell = sidebar + board surface, content
// picked by the scenario fixture (issue #52 mechanism). The sidebar is the
// shared AppSidebar (#129): the collapse state (storage-backed, #55 — the
// fixture build injects the key like the theme one), the 用量 row, the
// online dot and the ⌘K row derive identically on every route; this route
// keeps its own SearchPanel because the fixture ui.searchOpen open states
// drive the fixture rows.
// #72: the chief surfaces ride this route — the drawer overlays the board
// (r5 100/111/114/116) and the 总管设置 gear swaps the content area to the
// settings view (r5 101–104). Both open states are fixture-driven; the
// FAB/gear/back/close buttons make them reachable in dev. The
// wake wiring lives in use-chief-surface (#129), shared with every other
// shell family's FAB.
// #83 (M5): live 数据源分支——无 `?scenario=` 时看板走真 API（todos/
// machines/notifications/chief + 新建/开始/拖拽排序/验收合并 mutation），
// fixture 分支保持 #52–#75 行为字节不变（fixture 数据面）。

import type { TodoRecord as WireTodo } from '@pacman/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  useApiMutations,
  useProjects,
  useProjectTags,
  useSearchResults,
  useTodos,
} from '../api/hooks.js';
import { toDisplayTodo } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { AppSidebar } from '../board/app-sidebar.js';
import { type BoardFilters, BoardSurface } from '../board/board.js';
import { NotificationBanner, useNotificationBanner } from '../board/notify-banner.js';
import { matchesProjectFilter, parseProjectsParam, type RepoOption } from '../board/repo-filter.js';
import { matchesTagFilter, parseTagParam } from '../board/tag-filter.js';
import { ChiefDrawer } from '../chief/chief-drawer.js';
import { ChiefFabIcon } from '../chief/chief-fab-icon.js';
import { ChiefSettings } from '../chief/chief-settings.js';
import { useChiefSurface } from '../chief/use-chief-surface.js';
import { AcceptDialog } from '../detail/accept-dialog.js';
import { BranchDialog } from '../detail/branch-dialog.js';
import { withoutDeleted } from '../fixtures/deletions.js';
import { localTodo, overlayContent } from '../fixtures/fixtures.js';
import type { FixtureSet, OverlayState, TodoRecord } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { NewTaskDialog } from '../overlay/new-task-dialog.js';
import { useNewTaskSurface } from '../overlay/use-new-task-surface.js';
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
  // = live），采集零请求零流。members/skills/machines 归 #389 抽出的
  // useNewTaskSurface（eager 位保持原状）。——
  const todosQ = useTodos(teamId, live);
  const projectsQ = useProjects(teamId, live);
  const mutations = useApiMutations(teamId);

  // —— #403/#445 看板筛选面：URL ?tags=（类型轴）与 ?projects=（仓库轴）
  // 为唯一真值（刷新/分享不丢），选中集 = 词表名规范序 / 项目 id 字典序
  // 规范序。标签数据源：live = 全项目标签集并查（useProjectTags；首载未
  // 就绪不激活类型轴，防 tagged 卡闪隐），fixture = scenario.tags。仓库
  // 数据源：live = useProjects，fixture = scenario.projectNames（absent =
  // 仓库面不渲染，旧场景基线零漂移）；仓库轴零异步依赖——projectId 在卡
  // 上，直达 URL 在项目列表落定前即可正确收窄。——
  const rawTags = searchParams.get('tags');
  const rawProjects = searchParams.get('projects');
  const selectedTags = useMemo(() => parseTagParam(rawTags), [rawTags]);
  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags]);
  const selectedProjects = useMemo(() => parseProjectsParam(rawProjects), [rawProjects]);
  const selectedProjectSet = useMemo(() => new Set(selectedProjects), [selectedProjects]);
  const projectIds = useMemo(() => (projectsQ.data ?? []).map((p) => p.id), [projectsQ.data]);
  const liveTags = useProjectTags(projectIds, live);
  const fixtureTags = useMemo(() => {
    const rows = fixture.tags ?? [];
    return {
      tagById: new Map(rows.map((tag) => [tag.id, tag] as const)),
      nameById: new Map(rows.map((tag) => [tag.id, tag.name] as const)),
      ready: true,
    };
  }, [fixture]);
  const tagIndex = live ? liveTags : fixtureTags;
  const typeReady = !live || tagIndex.ready;
  // 组合谓词：仓库 AND 类型；类型轴的就绪闸内嵌（未就绪 = 类型放行，
  // 防闪隐），谓词各自单源（repo-filter / tag-filter），此处不写第二份。
  const matchesBoth = useCallback(
    (todo: TodoRecord) =>
      matchesProjectFilter(todo, selectedProjectSet) &&
      (typeReady ? matchesTagFilter(todo, selectedTagSet, tagIndex.nameById) : true),
    [selectedProjectSet, typeReady, selectedTagSet, tagIndex.nameById],
  );
  const filterActive = selectedProjects.length > 0 || (selectedTags.length > 0 && typeReady);
  // 写回 = 规范序 join，清空即删参；replace 不刷历史（筛选不是导航步）。
  // 其余参（scenario 等）原样保留——providers-page 着陆参同律。
  // 逗号段手工拼、其余参全权 URLSearchParams：票面要可读的字面逗号
  //（?tags=bug,feature），而 setSearchParams 内部 createSearchParams 会把
  // 逗号重编码成 %2C（react-router 8.4 dom/lib.js useSearchParams 实测）；
  // navigate('?…') 的 parsePath 原样切片 + normalizeSearch 仅做前缀规范化，
  // search 串不重编码，空 pathname = 保当前路径（resolvePath）。词表名是
  // [a-z]+、项目 id 字母数字，无需编码。
  const writeFilterParams = useCallback(
    (tags: string[], projects: string[]) => {
      const rest = new URLSearchParams(searchParams);
      rest.delete('tags');
      rest.delete('projects');
      const parts = [
        rest.toString(),
        tags.length > 0 ? `tags=${tags.join(',')}` : '',
        projects.length > 0 ? `projects=${projects.join(',')}` : '',
      ].filter((s) => s !== '');
      navigate(`?${parts.join('&')}`, { replace: true });
    },
    [searchParams, navigate],
  );
  const toggleTag = useCallback(
    (name: string) => {
      // 规范序 = FIXED_TAGS 序：复用 parseTagParam 的规范化（单源，不另写
      // 一份词表序过滤）。
      const next = selectedTags.includes(name)
        ? selectedTags.filter((n) => n !== name)
        : parseTagParam([...selectedTags, name].join(','));
      writeFilterParams(next, selectedProjects);
    },
    [selectedTags, selectedProjects, writeFilterParams],
  );
  const toggleProject = useCallback(
    (id: string) => {
      // 规范序 = 字典序：复用 parseProjectsParam 的规范化（单源）。
      const next = selectedProjects.includes(id)
        ? selectedProjects.filter((p) => p !== id)
        : parseProjectsParam([...selectedProjects, id].join(','));
      writeFilterParams(selectedTags, next);
    },
    [selectedProjects, selectedTags, writeFilterParams],
  );
  const clearProjects = useCallback(() => {
    if (selectedProjects.length === 0) return;
    writeFilterParams(selectedTags, []);
  }, [selectedProjects, selectedTags, writeFilterParams]);
  const clearFilters = useCallback(() => {
    if (selectedProjects.length === 0 && searchParams.get('tags') == null) return;
    writeFilterParams([], []);
  }, [selectedProjects, searchParams, writeFilterParams]);
  // 仓库面渲染门：live 恒渲染（项目列表即数据源）；fixture 仅
  // scenario.projectNames 在场时渲染（类型钮不受门控——右动作区恰好一钮）。
  const repoOptions = useMemo<RepoOption[]>(
    () =>
      live
        ? (projectsQ.data ?? []).map((p) => ({ id: p.id, name: p.name }))
        : Object.entries(fixture.projectNames ?? {}).map(([id, name]) => ({ id, name })),
    [live, projectsQ.data, fixture],
  );
  const filters: BoardFilters = {
    ...(live || fixture.projectNames != null
      ? {
          repo: {
            options: repoOptions,
            selected: selectedProjects,
            onToggle: toggleProject,
            onClear: clearProjects,
          },
        }
      : {}),
    type: { selected: selectedTags, onToggle: toggleTag },
    active: filterActive,
    matches: matchesBoth,
    onClear: clearFilters,
  };

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
  // 新建任务面（#389）：dialog 接线 = useNewTaskSurface（侧栏全局面共享同一
  // save 路径）；board 特有的只有 fixture 保存落点（本地卡 append，#66 律）
  // 与 eager 数据位（卡片级 开始 在 dialog 开之前就吃 firstAgentId）。
  // spec 15 #394 同律：参数 = 正文，标题由 localTodo 内 shared 规则派生
  // （live 面 = wire 空串 server 派生，agent 回填）。
  const onFixtureSave = useCallback(
    (spec: string) => {
      setFixtureTodos((prev) => [
        ...prev,
        // fixture.now is the session's reference instant, so the fresh
        // card reads 刚刚 against the same clock as the frozen labels.
        // fixture 面 localTodo 保持 canon projectId(approximation,选择
        // 是纯表单 state 无 mutation,#176 票面 live 语义)。
        localTodo(prev.reduce((max, t) => Math.max(max, t.seqNum), 0) + 1, spec, fixture.now),
      ]);
    },
    [fixture],
  );
  const {
    openDialog: openNewTask,
    firstAgentId,
    dialogProps: newTaskDialogProps,
  } = useNewTaskSurface(fixture, { fixtureTodos, eager: true, onFixtureSave });
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
  // W4 #286：live 面服务端搜索（fixture 面不经此钩）。
  const searchResults = useSearchResults(search.query, live && search.open);
  // #114: 看板顶部通知引导条 — live reads the real Notification.permission;
  // fixture scenarios opt in via ui.notificationBanner (fixture determinism,
  // the r7 baselines carry no banner)
  const notifyBanner = useNotificationBanner(fixture.ui?.notificationBanner === true, live);

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
  // 冻结采集时刻（采集确定性）。projectNames = 卡面/搜索/新建 dialog 的
  // 项目 chip 真名位（fixture 面缺省走 capture canon 常量）。
  const projectNames = useMemo(() => {
    if (!live) return undefined;
    return Object.fromEntries((projectsQ.data ?? []).map((p) => [p.id, p.name]));
  }, [live, projectsQ.data]);
  const fixtureWithTodos: FixtureSet = live
    ? { ...fixture, todos, now: Date.now(), ...(projectNames ? { projectNames } : {}) }
    : { ...fixture, todos };
  return (
    // #447 (ADR 0004 D8): data-chief-open scopes the board-column min-width
    // guard to the docked state — closed, the grid resolves exactly as before.
    <div
      className="board-shell h-full"
      data-route="board"
      data-chief-open={chiefView === 'drawer' ? '' : undefined}
    >
      <AppSidebar
        fixture={fixture}
        todos={todos}
        selected={chiefView === 'settings' ? 'none' : 'board'}
        searchPanel={false}
        onSearch={() => search.setOpen(true)}
        onNewTask={openNewTask}
      />
      {chiefView === 'settings' ? (
        <ChiefSettings chief={chiefData} onBack={() => setChiefView('drawer')} />
      ) : (
        <BoardSurface
          fixture={fixtureWithTodos}
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
          filters={filters}
          tagsById={tagIndex.tagById}
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
      {/* #389: dialog 接线全走 useNewTaskSurface（侧栏 N 热键/新任务行
          的 opener 也指这里——openNewTask）；fixture 保存落点 = 本页
          onFixtureSave 本地卡 append（#66 律）。 */}
      <NewTaskDialog {...newTaskDialogProps} />
      <button
        type="button"
        className="chief-fab"
        aria-label={t('总管')}
        onClick={() => setChiefView('drawer')}
      >
        <ChiefFabIcon chief={chiefData} />
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
          buildId={overlayTodo?.latestBuildId ?? null}
          onClose={closeOverlay}
        />
      )}
    </div>
  );
}
