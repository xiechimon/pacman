// Todo detail route (issue #56): app shell sidebar + dhead + phase-driven
// body. #366 re-lays the route out as the todos.dev 3-pane grid — 240
// sidebar | fluid thread column | 488 right pane (docs/design/todos.dev.md):
// the 文档|聊天 tab group is gone, the thread (or the fresh block, 23/23d)
// owns the center column with the composer as its only card, and the right
// pane hosts the doc surface (16/17 family) plus the former token/branch/
// history head-icon overlays as static sections (RightPane). #66 adds the
// 更多/删除 overlays; #75 adds the deep dynamic states: the version dropdown /
// compare submenu / plan-version diff surface of the doc pane, the rerun
// dialog + 复用方案 sub-panel (r8 56/74/75) and the interactive reject chain
// (请求修改 → replan streaming → v(N+1) → diff → 确认, AC3) walked
// client-side over the fixture script.
// #83 (M5): live 数据源分支——无 `?scenario=` 时详情页走真 API + 真 SSE
// （transcript 实时流/步进度/plan 版本/变更 diff/overlay 三件），关口动作
// 接真端点（开始/确认/驳回/合并/重跑/删除）；fixture 分支（含 chain 脚本）
// 保持 #56–#75 行为字节不变。
import { type Assignment, conversationBranch, parseGithubIssueSourceRef } from '@pacman/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { activityStore } from '../api/activity.js';
import { attachFile } from '../api/attachments.js';
import { ApiError } from '../api/client.js';
import {
  useApiMutations,
  useBuild,
  useBuildChanges,
  useBuildUsage,
  useDocumentDiff,
  useGithubIssueEcho,
  useMachines,
  useMembers,
  useMessages,
  usePlans,
  useProjectBuilds,
  useProjectFiles,
  useProjects,
  useRunHistoryTokens,
  useSearchResults,
  useSkills,
  useSteps,
  useTags,
  useTodo,
  useTodos,
} from '../api/hooks.js';
import { invalidateConverged } from '../api/invalidate.js';
import { liveTextStore } from '../api/live-text.js';
import {
  mapBranchInfo,
  mapDiffFiles,
  mapPlanDiff,
  mapPlanDoc,
  mapPlanVersions,
  mapRunHistory,
  mapTokenUsage,
  mapTranscript,
  toDisplayTodo,
} from '../api/mappers.js';
import { useAgentAvatarUrlById, useLiveData } from '../api/provider.js';
import { useConversationStream } from '../api/sse.js';
import { AppSidebar } from '../board/app-sidebar.js';
import {
  assignOptionsFromMembers,
  ChiefAgentDialog,
  type ChiefAgentOption,
} from '../chief/chief-agent-dialog.js';
import { useChiefRoot } from '../chief/chief-root.js';
import { useOrchestrateStart } from '../chief/use-orchestrate-start.js';
import { useChatFollow } from '../components/chat/use-chat-follow.js';
import { toastError } from '../components/ui/toaster.js';
import { AcceptDialog } from '../detail/accept-dialog.js';
import { Composer } from '../detail/composer.js';
import { DetailHead } from '../detail/dhead.js';
import { DocPane } from '../detail/docpane.js';
import { FreshBlock } from '../detail/fresh-block.js';
import { mergeRejectCopy, useMergeGate } from '../detail/merge-gate.js';
import { RerunDialog, ReusePanel } from '../detail/overlays.js';
import { RejectDialog } from '../detail/reject-dialog.js';
import { resolveReviewDefault } from '../detail/review-default.js';
import { type ReviewAgentOption, ReviewDialog } from '../detail/review-dialog.js';
import { RightPane } from '../detail/right-pane.js';
import { SourceIssueLine } from '../detail/source-issue.js';
import { SpecBlock } from '../detail/spec-block.js';
import { StopConfirmDialog } from '../detail/stop-confirm-dialog.js';
import { TaskMetaBlock, type TaskMetaFields } from '../detail/task-meta-block.js';
import { type LiveStep, Transcript } from '../detail/transcript.js';
import { UserMenu } from '../detail/user-menu.js';
import { markClosed, markDeleted, withoutDeleted } from '../fixtures/deletions.js';
import { overlayContent } from '../fixtures/fixtures.js';
import type {
  DetailContent,
  OverlayState,
  PaneView,
  Phase,
  PlanDiffContent,
  TranscriptItem,
} from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { attachmentFailureTitle } from '../overlay/attachment-paste.js';
import { DeleteConfirm } from '../overlay/delete-confirm.js';
import type { MentionGroups } from '../overlay/mention-picker.js';
import type { FileMentionEntry } from '../overlay/mention-token.js';
import { MoreMenu } from '../overlay/more-menu.js';
import { SearchPanel, useSearchState } from '../overlays/search-panel.js';
import { PHASE_UI } from '../phase.js';
import { readStoredTheme } from '../theme.js';

/** #209 编辑分配弹层文案 [设计](r2 C.18:该弹层内容从未捕获;弹层形态复用
 *  #182 选择 dialog 家族,title/confirmCopy 入参化)。<agent> 占位显示层
 *  替换;i18n 键 = zh 原文。 */
const ASSIGN_AGENT_DIALOG_TITLE = '选择执行 Agent';
const ASSIGN_AGENT_REBIND_CONFIRM_COPY = '更换执行 Agent？后续运行将改由 <agent> 执行。';

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
  const qc = useQueryClient();
  const { live, teamId, userName } = useLiveData();
  const { t } = useI18n();
  const fixture = resolveScenario(searchParams);
  // ADR 0013 D1/D6/D7 反转：总管面板不再占用 .detail-body 右栏格位——
  // 悬浮窗由根 layout 常驻挂载（chief-root.tsx），RightPane 恒在（fresh
  // 态整栏不渲染的 XMON-55 P0 律不动），detail 特例 FAB 位（right 504/
  // bottom 104，为躲 488 右栏而生）随族 FAB 退役。
  // #640：来源面板「总管编排会话」的页内深链改经根 host——set 后由
  // useChiefSurface 的 XMON-106 深链消费机制开窗定位线程（消费即清，
  // 一次性）。
  const { openChiefThread } = useChiefRoot();
  // #640：开始任务单出口——todo 相位主按钮直发总管编排回合（T0 反馈 =
  // toast + 查看会话深链，use-orchestrate-start.ts）。
  const orchestrateStart = useOrchestrateStart();
  // 右 pane 视图 (#366)：doc = DocPane（方案/变更/diff，相位派生），其余三
  // 值 = 原 head 图标 overlay 三件的静止 section。纯渲染态，capture 场景经
  // ui.paneView 冻结（r7 30/31/32、r8 57/77 的新家）。
  const [paneView, setPaneView] = useState<PaneView>(fixture.ui?.paneView ?? 'doc');
  // 更多 menu + delete confirm (#66): confirming a delete marks the todo
  // in the deletions overlay and returns to /app (r2 §5.4) — the board
  // route then renders without it; the fixture phase has no backend.
  // M5: live 模式走 DELETE /api/todos/{id}。
  const [moreOpen, setMoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // M7 #310 附件 wire：live editable composer 把 draft 提到此处，附件 token
  // 才能注入；send 时与 text 一起随 content 发出（#280 steer / #75 reject）。
  // #729 起 token 注入住 useComposerWire（行原子 + caret 位），本页只保留
  // draft state 与上传委托。
  const [liveDraft, setLiveDraft] = useState('');
  const search = useSearchState(fixture.ui?.searchOpen === true, fixture.ui?.searchQuery ?? '');
  // W4 #286：live 面服务端搜索（fixture 面不经此钩）。
  const searchResults = useSearchResults(search.query, live && search.open);
  const fixtureTodos = withoutDeleted(fixture.todos);

  // —— live 查询面（#83）：todo → latestBuild → steps/messages/plans/changes/
  // usage + machines/members/projects 供 overlay 与指派。fixture 模式全部
  // 惰性（enabled = live）。——
  const todoQ = useTodo(live ? id : undefined, live);
  const todosQ = useTodos(teamId, live);
  const wireTodo = todoQ.data ?? null;
  const buildId = wireTodo?.latestBuildId ?? null;
  const buildQ = useBuild(buildId, live);
  const stepsQ = useSteps(buildId, live);
  const messagesQ = useMessages(buildId, live);
  const plansQ = usePlans(buildId, live);
  const usageQ = useBuildUsage(buildId, live);
  // W4 #288：运行历史 tokens 供数（buildHistory 各 build usage 并查）。
  const historyTokens = useRunHistoryTokens(
    wireTodo?.buildHistory.map((e) => e.buildId) ?? [],
    live,
  );
  const machinesQ = useMachines(teamId, live);
  const membersQ = useMembers(teamId, live);
  // #760 `@` 文件候选：当前项目全仓路径表（失败/非托管/未决 = 空集 →
  // agents-only，渐进增强不挡主面）。
  const filesQ = useProjectFiles(wireTodo?.projectId, live);
  // XMON-105: avatarUrl override join for the todo's agent ref (transcript
  // rows + rerun dialog fallback row).
  const agentAvatarUrl = useAgentAvatarUrlById();
  const projectsQ = useProjects(teamId, live);
  const skillsQ = useSkills(teamId, live);
  const projectBuildsQ = useProjectBuilds(wireTodo?.projectId, live);
  // #309 fresh meta 区标签 chip 供数：todo.tagIds × 项目标签集真值投影
  //（r9 100；fixture 面无标签数据源 → 缺省不渲染，r7 23 基线原样）。
  const tagsQ = useTags(wireTodo?.projectId, live);
  const freshTags = useMemo(() => {
    const all = tagsQ.data ?? [];
    return (wireTodo?.tagIds ?? [])
      .map((id) => all.find((tag) => tag.id === id))
      .filter((tag) => tag !== undefined)
      .map(({ id, name, color }) => ({ id, name, color }));
  }, [tagsQ.data, wireTodo?.tagIds]);
  const mutations = useApiMutations(teamId);

  const liveTodos = useMemo(() => (todosQ.data ?? []).map(toDisplayTodo), [todosQ.data]);
  const todos = live ? liveTodos : fixtureTodos;
  const todo = live
    ? wireTodo
      ? toDisplayTodo(wireTodo)
      : todos.find((t) => t.id === id)
    : (fixtureTodos.find((t) => t.id === id) ?? fixtureTodos[0]);

  // Modal overlays (issue #68, extended in #75 with rerun/reuse): the
  // scenario fixture opens one for capture determinism; the header
  // buttons and the review/failed action buttons open the same set
  // interactively.
  const [overlay, setOverlay] = useState<OverlayState | null>(fixture.overlay ?? null);
  // XMON-89：合并被拒的可见态。住页层而非弹层内——弹层是 retained-mount，
  // 关掉不清会在下一次开窗时回显上一轮的拒绝（并入 closeOverlay）。
  const [mergeReject, setMergeReject] = useState<string | null>(null);
  // #701：打回弹层的服务端拒绝原因（XMON-89 同律——被拒弹层不关、原因显性）。
  const [rejectError, setRejectError] = useState<string | null>(null);
  const closeOverlay = useCallback(() => {
    setOverlay(null);
    setMergeReject(null);
    setRejectError(null);
  }, []);
  // 前置检查（XMON-89）：查的 Agent = merge 步的执行者 = assignment.build 槽
  // （不是卡片上显示的折算值）。
  const mergeMissing = useMergeGate(live ? (wireTodo?.assignment?.build?.agentId ?? null) : null);
  // #75 version-menu + plan-version diff state: scenario-frozen for the
  // captures, interactive afterwards (63–72).
  const [menu, setMenu] = useState<'versions' | 'compare' | undefined>(fixture.detail?.versionMenu);
  const [diff, setDiff] = useState(fixture.detail?.planDiff);
  const [chain, setChain] = useState<ChainState>('idle');
  // live 面:变更 pane 展开态 + 版本对比开关(数据来自 documents/{id}/diff)。
  // XMON-55 P2:默认展开——审核面的全部职责就是让人看 diff,折叠默认把
  // 488px 栏留成空白,复核者每次都得先点一次「全部展开」。收起态仍一键可达
  // (全部收起,同一钮位)。
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [compareOpen, setCompareOpen] = useState(false);
  // #318 复用面板「查看方案」:关弹层并把 docpane 切到被复用方案的 plan
  // 显示面(plans 读面已在;原站行为未捕获——r8 §5/r9 §5 登记,本实现为
  // [设计] 裁定)。复位键 = 路由任务 id + 新一轮 build(切换任务/新轮起跑
  // 都回相位默认面;fixture 面 buildId 恒 null,id 是唯一有效键)。
  const [planView, setPlanView] = useState(false);
  useEffect(() => {
    setPlanView(false);
  }, [id, buildId]);
  // #209 编辑分配弹层开态——挂页层:chip popover 关即卸载(dhead
  // OverlayMount),弹层挂其内会被带走。
  const [assignOpen, setAssignOpen] = useState(false);
  // 停止钮（M7 #308，r9 §3.3）：确认弹层开态 + 「正在停止…」过渡旗标——
  // 确认即乐观置位，步终态经 SSE step 事件重取回显（running 转 false）后清。
  const [stopOpen, setStopOpen] = useState(false);
  const [stopping, setStopping] = useState(false);

  const phase: Phase = todo?.phase ?? 'todo';
  const showsChanges = phase === 'review' || phase === 'done' || phase === 'failed';
  const changesQ = useBuildChanges(buildId, live && (showsChanges || compareOpen));
  const latestPlan = plansQ.data?.length ? plansQ.data[plansQ.data.length - 1] : null;
  const compareDiffQ = useDocumentDiff(
    compareOpen && latestPlan && latestPlan.version > 1 ? latestPlan.id : null,
    null,
    live,
  );

  // live transcript：conversation stream 订阅 + text_delta 打字缓冲。
  // #857 收敛交接（chief use-chief-surface 同律）：终稿事件只记 handoff，
  // 读数走 getVisible，落盘走 prune effect——重取在飞时打字面不闪清。
  const detailMessagesData = messagesQ.data;
  const knownDetailIds = useMemo(
    () => new Set((detailMessagesData?.messages ?? []).map((m) => m.id)),
    [detailMessagesData],
  );
  const liveText = useSyncExternalStore(liveTextStore.subscribe, () =>
    buildId != null ? liveTextStore.getVisible(buildId, knownDetailIds) : '',
  );
  useEffect(() => {
    if (buildId != null) liveTextStore.prune(buildId, knownDetailIds);
  }, [buildId, knownDetailIds]);
  // #905 活动相位读侧（chief use-chief-surface 同律）：单槽快照引用稳定；
  // stepId 对在跑步的过滤在 mapTranscript 内（W1）。
  const activity = useSyncExternalStore(activityStore.subscribe, () =>
    buildId != null ? activityStore.get(buildId) : null,
  );
  const streamHandlers = useMemo(
    () => ({
      // todo/phase 面由 team stream 驱动失效；此处兜底本页 todo 键。走收敛缝
      // （#717）：挂载取数在飞时到达的提示不得被去重吞掉——chip 停在旧相位
      // 正是 CI 间歇红的历史指纹。
      onMessage: () => {
        void invalidateConverged(qc, { queryKey: ['todo', id] });
      },
    }),
    [qc, id],
  );
  useConversationStream(buildId ?? undefined, live, streamHandlers);

  const steps = stepsQ.data ?? [];
  const runningStep = steps.find((s) => s.status === 'claimed' || s.status === 'pending') ?? null;
  const running = runningStep !== null;
  // AI 审核中态（M7 #312，r8 §3.1）：chip 改「审核中」、composer placeholder 改
  // 「AI 审核进行中…」、期间显示停止钮（复用 #308）。判定 = 存在 kind=review
  // 的活动步（claimed/pending）。phase 不动（review 步是额外 agent 步）。
  const reviewActive = steps.some(
    (s) => s.kind === 'review' && (s.status === 'claimed' || s.status === 'pending'),
  );
  // 「正在停止…」过渡态出口：活动步消失（stopped 落账/自然收尾）即清；
  // 换 build（重开/重跑）同样复位——新轮不继承上一轮的停止态。
  useEffect(() => {
    if (!running) setStopping(false);
  }, [running]);
  useEffect(() => {
    setStopping(false);
  }, [buildId]);

  // #634: ESC leaves the detail — layered, never「一按就跳走」. An open
  // floating surface (overlay / dialog / menu / listbox / chip popover) owns
  // the key first: its own listener closes it on the same event while the
  // DOM guard below still sees it mounted, so the exit waits for the next
  // clean ESC. The composer's inline mention state consumes the key with
  // preventDefault (defaultPrevented guard). Only a clean ESC with nothing
  // open goes home, carrying the search string — same law as the back link.
  // ADR 0013 D6/D3 exception: the chief floating window is a persistent
  // root-host [role=dialog] node (keepMounted, hidden when closed) whose own
  // law is "Esc never closes it" — it never owns this key, so the guard
  // excludes the whole window (an open window does not block the detail exit
  // either; it survives the navigation as a cross-route resident). Its inner
  // popovers (thread switcher etc.) portal as separate nodes without the
  // .chief-drawer class and still consume the key first per the layering law.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const openSurface = document.querySelector(
        '.overlay, [role="dialog"]:not(.chief-drawer), [role="menu"], [role="listbox"]',
      );
      if (openSurface !== null) return;
      const query = searchParams.toString();
      navigate({ pathname: '/app', ...(query === '' ? {} : { search: `?${query}` }) });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, searchParams]);

  // 执行机器名（#476 提为单源：transcript stamp 与 meta 块机器行同值）：
  // steps.machineId × machines 读面；未派发 = null。
  const machineName = useMemo(
    () => machinesQ.data?.find((m) => steps.some((s) => s.machineId === m.id))?.name ?? null,
    [machinesQ.data, steps],
  );
  // #682 钉选机器（等待面数据源）：build 钉了机器、步未领（machineName 空时）
  // → meta 机器行回落钉选机器名；该机离线 = 行尾等待标注（步只等它上线，
  // server claim 过滤面保证不自动改派）。
  const pinnedMachine = useMemo(
    () => machinesQ.data?.find((m) => m.id === buildQ.data?.pinnedMachineId) ?? null,
    [machinesQ.data, buildQ.data?.pinnedMachineId],
  );
  const machineField = machineName ?? pinnedMachine?.name ?? null;
  // #864 T3：等待标注只在「还在等」时成立。done/failed 会把右栏切到变更面
  // （本块根本不挂），closed 是唯一还能看到本块的收尾相位——失败后被关掉的
  // 任务不该继续自称「等待机器上线」（钉选机离线不再是它的阻塞原因，
  // 而 #864 超时收尾后步已经是 failed）。
  const machineWaiting =
    machineName == null && pinnedMachine != null && !pinnedMachine.online && phase !== 'closed';

  const liveDetail: DetailContent | undefined = useMemo(() => {
    if (!live || !wireTodo || buildId == null) return undefined;
    return {
      transcript: mapTranscript({
        messages: messagesQ.data?.messages ?? [],
        steps,
        plans: plansQ.data ?? [],
        build: buildQ.data ?? null,
        todo: toDisplayTodo(wireTodo),
        machineName,
        userName,
        liveText,
        stopping,
        activity,
      }),
      ...(latestPlan ? { doc: mapPlanDoc(latestPlan.content) } : {}),
      ...(changesQ.data
        ? { changes: { files: mapDiffFiles(changesQ.data.files), expanded: changesExpanded } }
        : {}),
      planVersions: mapPlanVersions(plansQ.data ?? []),
    };
  }, [
    live,
    wireTodo,
    buildId,
    machineName,
    steps,
    messagesQ.data,
    plansQ.data,
    buildQ.data,
    userName,
    liveText,
    activity,
    latestPlan,
    changesQ.data,
    changesExpanded,
    stopping,
  ]);

  // #476 meta 块模型行：指派 agent 的 members actor.modelId（#318 副题
  // 同投影），缺指派/缺 actor 退 usage 首行 model（本轮实际运行值）。
  const agentModel = useMemo(() => {
    const agentId =
      wireTodo?.assignment?.build?.agentId ?? wireTodo?.assignment?.plan?.agentId ?? null;
    if (agentId == null) return null;
    const member = (membersQ.data ?? []).find(
      (m) => m.memberType === 'agent' && m.actorId === agentId,
    );
    return (member?.actor as { modelId?: string | null } | undefined)?.modelId ?? null;
  }, [wireTodo?.assignment, membersQ.data]);

  // #476 meta 块来源 issue 行的标题真值（ADR 0006 D5：issue 侧为真值）：
  // 与 SourceIssueLine 同查询键（react-query 去重，不多打一次请求）；拉不
  // 到（未连接/限流/已删）退本地标题，行不因此丢失（D6 的隐藏律只约束回
  // 显行自身——meta 行的存在性由本地 sourceRef 决定，echo 只供标题）。
  const sourceEchoQ = useGithubIssueEcho(
    live ? wireTodo?.id : undefined,
    live && wireTodo?.sourceRef != null,
  );

  // #476（#473 决策候选 A）：live 方案空态的任务元信息——字段序与缺省律
  // 见 task-meta-block.tsx；fixture 面恒 null（无来源/机器/模型数据源），
  // 空态占位「暂无方案」字节不变。
  const taskMeta = useMemo<TaskMetaFields | null>(() => {
    if (!live || wireTodo == null || buildId == null) return null;
    const ref = wireTodo.sourceRef != null ? parseGithubIssueSourceRef(wireTodo.sourceRef) : null;
    const prUrl = buildQ.data?.prUrl ?? null;
    const prNumber = buildQ.data?.prNumber ?? null;
    return {
      sourceIssue:
        ref != null
          ? {
              number: ref.issueNumber,
              title: sourceEchoQ.data?.title ?? wireTodo.title,
              url: `https://github.com/${ref.owner}/${ref.repo}/issues/${ref.issueNumber}`,
            }
          : null,
      branch: conversationBranch(buildId),
      pr: prUrl != null && prNumber != null ? { number: prNumber, url: prUrl } : null,
      machine: machineField,
      machineWaiting,
      model: agentModel ?? usageQ.data?.[0]?.model ?? null,
      createdAt: wireTodo.buildHistory[0]?.createdAt ?? buildQ.data?.createdAt ?? null,
    };
  }, [
    live,
    wireTodo,
    buildId,
    buildQ.data,
    machineField,
    machineWaiting,
    agentModel,
    usageQ.data,
    sourceEchoQ.data,
  ]);

  // live 版本对比面（r8 64→65：上一版本 unified diff）。#244：to 版本
  // plan.md 全文挂 fullContent 槽——plans 读面已载各版本 content（05 册
  // M5 §1.2），plan-diff 面「显示完整文件」不走 changes/file 端点。
  const livePlanDiff: PlanDiffContent | undefined =
    compareOpen && compareDiffQ.data
      ? mapPlanDiff({
          ...compareDiffQ.data,
          toContent: plansQ.data?.find((p) => p.version === compareDiffQ.data.toVersion)?.content,
        })
      : undefined;

  const fixtureView = chainView(fixture.detail, chain, diff);
  const view = live
    ? {
        phaseOverride: null as Phase | null,
        transcript: liveDetail?.transcript ?? [],
        doc: liveDetail?.doc,
        planVersions: liveDetail?.planVersions,
        planDiff: livePlanDiff,
      }
    : fixtureView;

  // #873 会话跟随单源（components/chat/use-chat-follow）：列容器是
  // column-reverse（最新在 scrollTop 0 侧），规则与总管抽屉逐字同款——增长
  // 只在读者已贴最新端时拖动视口；读者自己发出去的那条永远跳到最新。
  const chatColRef = useRef<HTMLDivElement | null>(null);
  const { requestFollow } = useChatFollow({
    ref: chatColRef,
    dep: view.transcript,
    reversed: true,
    // 会话列只在真挂了 transcript 的那一支持存在（fresh 面没有 .chat-col）。
    active: live && view.transcript.length > 0,
  });
  // 在飞行数据（活行披露面 + 会话跟随时机）：步类词表 = 详情头部 chip 同族。
  const liveStep = useMemo<LiveStep | null>(
    () =>
      runningStep == null
        ? null
        : {
            step:
              runningStep.kind === 'review'
                ? '审核中'
                : runningStep.kind === 'plan'
                  ? '规划中'
                  : '执行中',
            // 真值 = 该步实际领取的机器（machineName 由 steps×machines 解出，
            // 未领取为 null）。不取 machineField：它会回落到 build 钉选的机器
            // ——钉了一台还没来领的机器时，面板会声称「执行机器 = 那台」，
            // 而步其实还在等（钉选等待态在 meta 块另有标注）。
            machine: machineName,
          },
    [runningStep, machineName],
  );

  // live 指派：dialog 未给显式 assignment 时取团队首个 Agent（02 §6.2 双槽
  // 同值）；#318 开始 dialog 统一面携带选定双槽（分用开关 OFF = 同值，
  // ON = plan/build 独立，r9 §3.6）。
  const firstAgentId = useMemo(() => {
    const member = (membersQ.data ?? []).find((m) => m.memberType === 'agent');
    return member?.actorId ?? null;
  }, [membersQ.data]);
  const startBuild = useCallback(
    (withPlan: boolean, assignment?: Assignment) => {
      if (!live || !wireTodo) return;
      mutations.startBuilds.mutate(
        {
          projectId: wireTodo.projectId,
          todoIds: [wireTodo.id],
          assignment: assignment ?? {
            plan: firstAgentId ? { agentId: firstAgentId } : null,
            build: firstAgentId ? { agentId: firstAgentId } : null,
          },
          withPlan,
        },
        // #638 破坏性后果面（票面优先级 1）：弹层已关、任务停在半启动态却
        // 零解释——toast 点名失败，server 原因进 description。
        { onError: (error) => toastError(t('开始运行失败，请重试。'), error) },
      );
      setOverlay(null);
    },
    [live, wireTodo, mutations.startBuilds, firstAgentId, t],
  );

  if (todo == null) return null;

  // —— #209 编辑分配:chip popover「编辑分配」→ agent 选择弹层(#182 家族
  // 形态)→ PATCH assignment.build 槽(执行对话选中行 = build 槽派生投影,
  // services/todos.ts;server 槽级 merge #208 保 plan 槽)→ mutation 自带
  // invalidateAll 重取回显。候选 = members 读面 memberType:"agent" 行
  // (chief-settings 同投影);fixture 面 onBind 缺省 → accept 律(选择即关)。——
  // #318: model 副题并入投影(r9 §2.6 选择器行形「name · model」;开始
  // dialog 与编辑分配共用同一候选集)。
  // #616: 投影收编进 assignOptionsFromMembers（board 页的拖拽落位开始面
  // 共用，单源在 chief-agent-dialog.tsx；XMON-105 avatarUrl 覆盖律随行）。
  const assignOptions: ChiefAgentOption[] | undefined = live
    ? assignOptionsFromMembers(membersQ.data ?? [])
    : undefined;
  const bindAssign = live
    ? (agentId: string) =>
        mutations.patchTodo.mutate(
          { id: todo.id, body: { assignment: { build: { agentId } } } },
          {
            onSuccess: () => setAssignOpen(false),
            // #638：失败时弹层留着（关挂在 onSuccess）但零解释——toast 补上。
            onError: (error) => toastError(t('保存失败，请重试。'), error),
          },
        )
    : undefined;

  // —— #318 更多菜单生命周期行(r1 changelog 09-16:Complete 走看板自带
  // confirm-and-merge、相位适配;Close 关闭语义)。完成 = review 开验收弹层
  // (既有 accept→merge 链)/ confirm 关口确认(live wire);关闭 = PATCH phase
  // closed 后回看板(卡片立即隐藏;延迟 Undo 窗口 [设计] wontfix,r1 语义
  // 归 closed→todo reopen 面)。server 漏斗现有边 todo/failed→closed;
  // review/confirm/done→closed 边缺,归 W3 server 票(票面授权前端+注记),
  // 故 canClose 只放行有边的相位,其余 disabled(运行中禁用 = r1 Delete-in-
  // turn 先例)。fixture 面无 wire:关闭走 deletions.ts 会话覆面同律。——
  // #702(B-C17):failed 且 build 腿已交付 → 「完成」出口重新出现(服务端
  // 恢复闸是权威判定,此处只是钮面可达性:steps 投影里执行步 done)。点开
  // 同一 accept 弹层 → merge API → server 恢复回 review 关口 + 正常合并委派;
  // 未交付的 failed(执行步失败/零产物)不亮钮——重跑面(rerun dialog)才是
  // 它的出口。fixture 面无 steps 数据,不启用(live 判据钉死)。
  const buildLegDone = steps.some((s) => s.kind === 'build' && s.status === 'done');
  const canComplete =
    phase === 'review' ||
    (live && phase === 'confirm') ||
    (live && phase === 'failed' && buildLegDone);
  const canClose = phase === 'todo' || phase === 'failed';
  const completeTask = () => {
    setMoreOpen(false);
    if (phase === 'review' || phase === 'failed') {
      setOverlay({ kind: 'accept' });
      return;
    }
    if (live && phase === 'confirm' && buildId != null)
      mutations.stepAction.mutate({ buildId, body: { action: 'confirm' } });
  };
  // —— #864 T3：重跑面的钉选出口。重跑沿用任务钉选（orchestrate 读
  // todo.machineId），钉着离线机 = 再失败一轮，所以失败面给「改为自动」。
  // machines 读面未到时判「不知道」而不是「离线」（不把未取到错读成不在线）；
  // 钉的机器行已不在（被删/换团队）= 服务端同离线语义，文案走「（已移除）」。
  const pinnedTodoMachine =
    wireTodo?.machineId != null && machinesQ.data != null
      ? (machinesQ.data.find((m) => m.id === wireTodo.machineId) ?? null)
      : undefined;
  const rerunPin =
    pinnedTodoMachine === undefined
      ? null
      : {
          machineName: pinnedTodoMachine?.name ?? null,
          offline: pinnedTodoMachine?.online !== true,
        };
  const unpinForRerun = () => {
    mutations.patchTodo.mutate(
      { id: todo.id, body: { machineId: null } },
      { onError: (error) => toastError(t('改为自动失败，请重试。'), error) },
    );
  };

  const closeTask = () => {
    setMoreOpen(false);
    if (live) {
      mutations.patchTodo.mutate(
        { id: todo.id, body: { phase: 'closed' } },
        {
          onSuccess: () => navigate('/app'),
          // #638：关闭失败 = 留在详情页、任务没关，此前零反馈。
          onError: (error) => toastError(t('关闭任务失败，请重试。'), error),
        },
      );
      return;
    }
    markClosed(todo.id);
    navigate('/app');
  };

  // AI 审核候选 Agent（M7 #312，r8 §3.1）：live = members 读面 memberType:"agent"
  // 行投影（#509 起带 provider，供跨厂商判定）；fixture 面 undefined =
  // ReviewDialog 兜底 DEFAULT_AGENT（行 A：r8 §3.1 仅一处 Agent 选取，canon
  // 单默认行）。
  const reviewAgents: ReviewAgentOption[] | undefined = live
    ? (membersQ.data ?? [])
        .filter((m) => m.memberType === 'agent')
        .map((m) => {
          const actor = m.actor as
            | { displayName?: string; modelId?: string | null; provider?: string | null }
            | undefined;
          return {
            id: m.actorId,
            name: actor?.displayName ?? m.actorId,
            model: actor?.modelId ?? '默认',
            provider: actor?.provider ?? null,
          };
        })
    : undefined;
  // 默认选人 + 独立性判定（#509）：跨厂商优先，产出步 Agent = 执行侧槽优先、
  // 规划槽回退（与服务端 per-step 凭据解析同一条链）；两槽都空 = 无基准，默认
  // 值退到候选集稳定序第一且不声称独立。判定规则单源 = detail/review-default.ts
  // ——用户改选后的复判走同一条 classifyReviewChoice（ReviewDialog 内）。
  const reviewPick = resolveReviewDefault({
    candidates: reviewAgents ?? [],
    assignment: wireTodo?.assignment ?? null,
  });
  // fixture 面不做判定：reviewAgents undefined → 走 ReviewDialog 兜底单默认行，
  // producerProvider 也保持 undefined（undefined = 本面不判定）。
  const reviewDefaultId = live ? reviewPick.defaultAgentId : undefined;
  const reviewProducerProvider = live ? reviewPick.producerProvider : undefined;

  const content = live
    ? wireTodo && buildId
      ? {
          token: mapTokenUsage(usageQ.data ?? []),
          branch: mapBranchInfo(buildId, steps, machinesQ.data ?? []),
          runs: mapRunHistory(wireTodo, projectBuildsQ.data ?? [], Date.now(), historyTokens),
        }
      : null
    : overlayContent(todo.id);

  // #311: mention picker groups — live pulls the canonical REST hooks,
  // fixture derives from the local capture set (boardDefault.resources
  // covers machines/skills; projectNames drives the project chip; the
  // team roster gives the agent card row).
  const mentionGroups: MentionGroups = live
    ? {
        todo: (todosQ.data ?? []).map((t) => ({
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
        machine: (fixture.resources?.machines ?? []).map((m) => ({
          id: m.name,
          label: m.name,
        })),
      };
  // #760 `@` 文件候选：live = 当前项目全仓路径表；fixture 面无仓库 → 缺省
  // （agents-only，DOM 字节不变）。
  const mentionFiles: FileMentionEntry[] | undefined = live
    ? (filesQ.data?.files ?? []).map((f) => ({ path: f.path, type: f.type }))
    : undefined;
  const ui = PHASE_UI[phase];
  const detail = live ? liveDetail : fixture.detail;
  const streaming = live ? running : view.transcript.some((item) => item.kind === 'streaming');
  // The doc pane flips to the 变更 surface once a run produced changes
  // (r7 27/36, r8 54/73); the plan-version diff surface wins while open
  // (r8 65–72); the plan surface serves todo→building (r7 16/17/26).
  // #318 查看方案:planView 强制 plan 面(r8 §5 [设计] 裁定),新 build 复位。
  const docMode =
    view.planDiff != null
      ? 'diff'
      : planView
        ? 'plan'
        : phase === 'review' || phase === 'done' || phase === 'failed'
          ? 'changes'
          : 'plan';

  // composer 被拒提示行（W3 #280 steer / #320 restart / #701 review 打回）：
  // 异步 onSend 失败时 draft 保留不丢字，文案按被拒写面分流；stepAction 错误
  // scope 到 variables.action ∈ {restart, revision}（confirm 主钮同走
  // stepAction，其错误不上此行——review 打回与 confirm 驳回共用 revision 位）。
  const stepActionFailed =
    mutations.stepAction.isError &&
    (mutations.stepAction.variables?.body.action === 'restart' ||
      mutations.stepAction.variables?.body.action === 'revision');
  const composerReject = !live
    ? null
    : mutations.sendSteer.isError
      ? t('当前没有运行中的会话，消息未送出')
      : stepActionFailed
        ? t('任务状态已变化，消息未送出')
        : null;

  // The phase's single primary action. Head and fresh-block both call it, so
  // the start affordance sits next to the task brief as well as in the head
  // corner (XMON-55 P0) without forking the ordering rules.
  const handlePrimaryAction = () => {
    if (live) {
      // 主时序关口（02 §4.2；#640 起 todo 开始 = 单出口直发总管编排回合，
      // 不再经 dialog 选择面）：todo 开始 = orchestrate / confirm 确认 /
      // review 验收弹层 / failed 重跑弹层（重跑 = 编排回合 + 复用方案）/
      // done 重开 = 新一轮 build。
      if (phase === 'todo') orchestrateStart.orchestrate(todo.id);
      else if (phase === 'confirm' && buildId)
        mutations.stepAction.mutate({ buildId, body: { action: 'confirm' } });
      else if (phase === 'review') setOverlay({ kind: 'accept' });
      else if (phase === 'failed') setOverlay({ kind: 'rerun' });
      else if (phase === 'done') startBuild(true);
      return;
    }
    if (chain === 'landed' && detail?.revision != null) {
      setChain('building');
      return;
    }
    // r7 34: the review-phase 完成 button opens the accept dialog;
    // r8 54: the failed 重跑 button opens the rerun dialog（#640 瘦身形）。
    // todo 相位不再开 dialog（#640：开始 = 直发编排，fixture 面 inert）。
    if (phase === 'review') setOverlay({ kind: 'accept' });
    if (phase === 'failed') setOverlay({ kind: 'rerun' });
  };

  return (
    // ADR 0013 D1：#447 (0004 D7) 的 data-chief-open 两态收窄退役——悬浮窗
    // 是覆盖层，右栏格位不再被面板顶掉，--detail-pane-right 收敛回单态
    // 488px（composer-reject 锚照它 calc() 跳过右格位）。#945（detail.css
    // 清零）：三栏壳（240 | fluid | 488，todos.dev 网格）迁 utilities；
    // #932 窄屏折叠走 max-md 变体（<768px 双定宽栏退场、线程列独占视口，
    // pane 变量归零让锚位停止跳格）。board-sidebar 是 #943 保留的运行时
    // 钩子类，子选择器规则随壳迁移（跨域消费面不断）。
    <div
      className="detail-shell flex h-full overflow-hidden [--detail-pane-right:488px] max-md:[--detail-pane-right:0px] [&>.board-sidebar]:max-md:hidden"
      data-route="todo-detail"
      data-todo-id={id}
    >
      <AppSidebar
        fixture={fixture}
        todos={todos}
        searchPanel={false}
        onSearch={() => search.setOpen(true)}
      />
      <div
        className="detail-main group/detail-main relative flex min-w-0 flex-1 flex-col bg-(--card)"
        data-testid="detail-main"
      >
        <DetailHead
          todo={todo}
          phase={live ? phase : (view.phaseOverride ?? todo.phase)}
          onMore={() => setMoreOpen(true)}
          reviewActive={reviewActive}
          onAction={handlePrimaryAction}
          chipPopoverOpen={fixture.ui?.chipPopoverOpen === true}
          onEditAssign={() => setAssignOpen(true)}
        />
        <div className="detail-body relative flex min-h-0 flex-1" data-testid="detail-body">
          <div className="detail-center flex min-w-0 flex-1 flex-col" data-testid="detail-center">
            {/* 来源 issue 行（#452 / ADR 0006 D5/D6）：live 专属——未建成给
                重试入口；已建成进入拉一次回显（不一致中性提示、拉不到整行
                隐藏）。fixture 面无来源数据源，不渲染。 */}
            {live && wireTodo?.sourceKind != null && (
              <SourceIssueLine
                todo={wireTodo}
                onRetry={() =>
                  mutations.retryGithubIssue.mutate(wireTodo.id, {
                    // #638：重试再败此前只是 pending 灯灭——toast 点名失败。
                    onError: (error) => toastError(t('重试失败，请稍后再试。'), error),
                  })
                }
                retryPending={mutations.retryGithubIssue.isPending}
                onOpenThread={openChiefThread}
              />
            )}
            {detail == null ? (
              <div className="detail-fresh min-h-0 flex-1 overflow-y-auto pb-4">
                <FreshBlock
                  todo={todo}
                  tags={freshTags}
                  action={ui.action}
                  onAction={handlePrimaryAction}
                  // #612：live 有 spec = 下方简报卡在场，「尚无描述」占位让位
                  // （两行同屏自相矛盾）；fixture 面恒缺省，r7 23 基线不动。
                  hasSpec={live && todo.spec.trim() !== ''}
                />
                {/* M7 #310：live 详情面把用户提交的 spec 渲染在 FreshBlock 之
                    下（fix 丢字 bug ——之前 spec 落 todo.spec 但 UI 从未呈现
                    给用户看）。fixture 面不走此分支：fixture
                    fresh-probe 用同样的「尚无描述」placeholder。 */}
                {live && todo.spec.trim() !== '' && <SpecBlock spec={todo.spec} fresh />}
              </div>
            ) : (
              <div
                className="chat-col flex min-h-0 flex-1 flex-col-reverse overflow-y-auto pt-[19px] pr-4 pb-4 pl-[19px]"
                data-testid="transcript-col"
                ref={chatColRef}
              >
                {/* margin-top:auto pins an overflowing transcript to the
                      newest row at first paint (r8 63–77) and keeps short r7
                      transcripts top-aligned — no scroll scripting, so the
                      fixture capture is deterministic. #873: the reader's own
                      send still jumps here (useChatFollow), which the layout
                      alone never did. */}
                <div className="chat-pin mb-auto">
                  {/* #827：简报卡住线程列首（随流滚动，不钉住）——此前它挂
                        在 chat-col 之外，长线程下恒占列首视口（M7 #310 把它
                        从 doc 列迁到中心列的理由不变：用户原始输入属于线程
                        流）。fixture 面无 spec 数据，捕获字节不动。 */}
                  {live && todo.spec.trim() !== '' && <SpecBlock spec={todo.spec} />}
                  <Transcript
                    transcript={view.transcript}
                    // #873：活行披露面 = 在跑步（哪一步、哪台机器）——详情面
                    // 唯一时间线里没有的事；fixture 面无此数据 = 无面板。
                    liveStep={live ? liveStep : null}
                    // XMON-105: agent message rows carry the executing
                    // agent's own avatar (same identity as board card /
                    // team page), never the logged-in user's.
                    agent={
                      todo.agent
                        ? {
                            displayName: todo.agent.displayName,
                            avatarUrl: agentAvatarUrl.get(todo.agent.id) ?? null,
                          }
                        : null
                    }
                    // #366 AC：线程内 plan 卡激活 = 右 pane 切文档面的
                    // plan 显示面（与 复用方案「查看方案」同律）。
                    onOpenPlan={() => {
                      setPaneView('doc');
                      setPlanView(true);
                    }}
                  />
                </div>
              </div>
            )}
            {/* #472：composer 是中心列的最后一个 flex 项（in-flow）——
                滚动区在卡片上缘之上结束，正文永不被压进不透明卡片底下。 */}
            {ui.placeholder != null && (
              <Composer
                placeholder={
                  // AI 审核中态（M7 #312，r8 §3.1）:placeholder 改「AI 审核进行中…」
                  // 与 chip 改「审核中」同步;phase 不动,UI 层覆盖。
                  reviewActive ? t('AI 审核进行中…') : ui.placeholder
                }
                aiReview={
                  // r7 §4.1 / r8 §3.1: the AI 审核 button only shows on writable
                  // confirm/review surfaces; failed and waiting-on-user
                  // composers render the three base tools alone
                  (phase === 'confirm' || phase === 'review') && !todo.awaitingReply
                }
                streaming={streaming}
                editable={live}
                draft={live ? liveDraft : undefined}
                onDraftChange={live ? setLiveDraft : undefined}
                onAttachment={
                  live
                    ? async (files) => {
                        // #310 三步 wire（r9 §3.1）：每个文件走 grant + upload，
                        // 失败 toast 点名原因（#729 失败方式 5/12：draft 一字不
                        // 动，成功文件的 token 仍落入）；注入由 wire hook 做。
                        const tokens: string[] = [];
                        for (const file of files) {
                          try {
                            const r = await attachFile({ file, scope: 'message' });
                            tokens.push(r.token);
                          } catch (err) {
                            console.error('attachment failed', file.name, err);
                            toast.error(t(attachmentFailureTitle(err)), {
                              description: file.name,
                            });
                          }
                        }
                        return tokens;
                      }
                    : undefined
                }
                mentionGroups={mentionGroups}
                mentionFiles={mentionFiles}
                onStop={live && buildId ? () => setStopOpen(true) : undefined}
                onReview={
                  // AI 审核钮入口（M7 #312，r8 §3.1）：live 确认/审核面可点，fixture
                  // 面不动（DOM 字节不变）。
                  live && (phase === 'confirm' || phase === 'review') && !reviewActive
                    ? () => setOverlay({ kind: 'review' })
                    : undefined
                }
                onSend={
                  live
                    ? (text) => {
                        // #873：读者自己发出去的那条必须看得见——这一刻先跳到
                        // 最新端（四个分流出口共用；被拒 409 不清稿，落在最新端
                        // 也无害）。增长跟随的其余判断在 useChatFollow 里。
                        if (text !== '') requestFollow();
                        // 驳回回路（r5 §4）：confirm 关口发送 = revision + feedback
                        // → 重规划步入队 → plan v(N+1)（会话流即时呈现）。
                        if (phase === 'confirm' && buildId && text !== '') {
                          mutations.stepAction.mutate({
                            buildId,
                            body: {
                              action: 'revision',
                              side: 'plan',
                              feedback: text,
                              clientMessageId: crypto.randomUUID(),
                            },
                          });
                          return;
                        }
                        // W3 steer（#280，06 册 D9 / spec #277）：building 态发送 =
                        // 运行中补话；review 态仅在运行中（AI 审核步在跑等）保持
                        // 本面——运行补话与静息打回各走各的道，不互抢。server 门
                        // （claimed 步在跑）收则 201，无在跑步 409 明确拒绝（提示行
                        // + draft 保留，不丢字）。返回 Promise = composer 异步清稿面。
                        if (
                          (phase === 'building' || (phase === 'review' && running)) &&
                          buildId &&
                          text !== ''
                        ) {
                          return mutations.sendSteer
                            .mutateAsync({ conversationId: buildId, content: text })
                            .then(() => {
                              setLiveDraft('');
                              return undefined;
                            });
                        }
                        // #701（B-C12）：review 关口静息态发送 = 人肉打回——confirm
                        // 驳回的动作面复用（POST steps revision → review→planning +
                        // 重规划步入队，边与 #330 自动回流同一条），不再撞 steer 面
                        // 的 409 死路；「请求修改…」占位符从此诚实（可填即可发）。
                        // Promise 面 = restart 同律：成功清稿、被拒（409 竞态）保留。
                        if (phase === 'review' && !running && buildId && text !== '') {
                          return mutations.stepAction
                            .mutateAsync({
                              buildId,
                              body: {
                                action: 'revision',
                                side: 'plan',
                                feedback: text,
                                clientMessageId: crypto.randomUUID(),
                              },
                            })
                            .then(() => undefined);
                        }
                        // #320 失败面发送 = 带反馈重启（r9 §3.3：原站 failed 态发消息
                        // 触发新一轮，消息随新轮入会话——非 steer 语义）。走 steps
                        // restart 动作位：新 build + 反馈行落新 conv + failed→queued。
                        // Promise 面 = 成功清稿、被拒（相位漂移 409）保留 draft。
                        if (phase === 'failed' && buildId && text !== '') {
                          return mutations.stepAction
                            .mutateAsync({
                              buildId,
                              body: {
                                action: 'restart',
                                feedback: text,
                                clientMessageId: crypto.randomUUID(),
                              },
                            })
                            .then(() => undefined);
                        }
                      }
                    : detail?.revision != null && chain === 'idle'
                      ? () => {
                          setChain('streaming');
                          window.setTimeout(() => setChain('landed'), 900);
                        }
                      : undefined
                }
              />
            )}
          </div>
          {/* ADR 0013 D1：0004 D7 的「竖板与右栏格位互斥」退役——悬浮窗
              盖在右栏之上（覆盖代价由无模态 + ⌘J 即关 + clearance 消化），
              RightPane 恒在。pane 状态（paneView/docMode/diff/menu）全住
              页面层。XMON-55 P0：fresh（无线程）态整栏不渲染——它的三个
              section 都要 build 载荷，文档面在无 build 时也只是空占位；
              488px 让给中心列的任务简报，不让空态各占一半。 */}
          {detail != null && (
            <RightPane
              view={paneView}
              onView={setPaneView}
              docLabel={docMode === 'changes' ? '变更' : '方案'}
              content={content}
              buildId={live ? buildId : null}
            >
              <DocPane
                mode={docMode}
                doc={view.doc}
                changes={live ? liveDetail?.changes : detail.changes}
                now={live ? Date.now() : fixture.now}
                planDropdownOpen={fixture.ui?.planDropdownOpen === true}
                onPaneView={setPaneView}
                hasSections={content != null}
                planVersions={view.planVersions}
                versionMenu={menu}
                onVersionMenu={setMenu}
                onCompare={() => {
                  if (live) {
                    setCompareOpen(true);
                    setMenu(undefined);
                    return;
                  }
                  // 上一版本 (r8 64 → 65/71): opens the previous-version
                  // diff — the fixture's compare target, or the chain's
                  // landed diff once the reject loop produced one
                  setDiff(detail.compareTarget ?? detail.revision?.landed.planDiff);
                  setMenu(undefined);
                }}
                onBase={() => {
                  if (live) {
                    setCompareOpen(false);
                    setMenu(undefined);
                    return;
                  }
                  setDiff(undefined);
                  setMenu(undefined);
                }}
                planDiff={view.planDiff}
                buildId={live ? buildId : null}
                emptyMeta={
                  taskMeta != null ? <TaskMetaBlock meta={taskMeta} now={Date.now()} /> : undefined
                }
                onToggleExpand={() => {
                  if (live) {
                    setChangesExpanded((v) => !v);
                    return;
                  }
                  setDiff((d) => (d != null ? { ...d, expanded: !d.expanded } : d));
                }}
              />
            </RightPane>
          )}
        </div>
        {ui.placeholder != null && composerReject != null && (
          <div className="composer-reject absolute bottom-[104px] left-4 right-[calc(var(--detail-pane-right)+16px)] text-center text-xs leading-4 text-(--destructive)">
            {composerReject}
          </div>
        )}
        {/* ADR 0013 D4/D6：detail 特例 FAB 位与面板拆挂退役——launcher 与
            悬浮窗由根 layout 常驻（chief-root.tsx），#443 的 unreadOnly
            门控在根 host 按路由保留。 */}
      </div>
      {!live && detail?.userMenuOpen === true && <UserMenu theme={readStoredTheme(localStorage)} />}
      <MoreMenu
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onDelete={() => {
          setMoreOpen(false);
          setDeleteOpen(true);
        }}
        onComplete={completeTask}
        canComplete={canComplete}
        onCloseTask={closeTask}
        canClose={canClose}
        // #701：审核关口显式打回入口——live review 静息态在场（运行中让位
        // steer 补话面）；fixture 面/其余相位缺省 = 行不渲染，四行几何不变。
        onReject={
          live && phase === 'review' && buildId != null && !running
            ? () => {
                setMoreOpen(false);
                setOverlay({ kind: 'reject' });
              }
            : undefined
        }
      />
      <DeleteConfirm
        open={deleteOpen}
        title={t('确定删除该任务？此操作不可撤销。')}
        summary={
          <>
            <span className="delete-confirm-seq text-(--text-tertiary)">#{todo.seqNum}</span>
            {todo.title}
          </>
        }
        ariaLabel={t('删除任务')}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          if (live) {
            mutations.deleteTodo.mutate(todo.id, {
              onSuccess: () => navigate('/app'),
              // #638：确认层已关（上方 setDeleteOpen），失败 = 任务还在却零解释。
              onError: (error) => toastError(t('删除任务失败，请重试。'), error),
            });
            return;
          }
          markDeleted(todo.id);
          navigate('/app');
        }}
      />
      <StopConfirmDialog
        open={stopOpen}
        onClose={() => setStopOpen(false)}
        onConfirm={(discard) => {
          setStopOpen(false);
          if (!buildId) return;
          // 乐观过渡态（r9 §3.3「正在停止…」）：确认即置位；终态由 SSE step
          // 事件重取回显（running 转 false 清旗标）。409 竞态（步已收尾）=
          // 数据面已前进，清旗标 + invalidateAll 重取即收敛。
          setStopping(true);
          mutations.stopBuild.mutate({ buildId, discard }, { onError: () => setStopping(false) });
        }}
      />
      <AcceptDialog
        open={overlay?.kind === 'accept'}
        onClose={closeOverlay}
        missingTools={mergeMissing}
        rejectReason={mergeReject}
        onConfirm={
          live && buildId
            ? () => {
                // merge = 202 delegated（r3 §3.6）：合并步机器执行，phase 经
                // SSE 推进到 done（🎉 时间线行由 server 落库）。XMON-89：关
                // 弹层改挂 onSuccess——被拒（403）时弹层留着显原因，不再静默
                // 关掉。
                mutations.mergeBuild.mutate(buildId, {
                  onSuccess: () => closeOverlay(),
                  onError: (error) => setMergeReject(mergeRejectCopy(error, t)),
                });
              }
            : undefined
        }
      />
      <RejectDialog
        open={overlay?.kind === 'reject'}
        onClose={closeOverlay}
        rejectReason={rejectError}
        onConfirm={
          // 打回 = revision 动作面（composer 静息发送同一条 mutation）；关弹层
          // 挂 onSuccess——被拒（409 竞态/相位漂移）弹层留着显原因（XMON-89）。
          live && buildId
            ? (feedback) => {
                setRejectError(null);
                mutations.stepAction.mutate(
                  {
                    buildId,
                    body: {
                      action: 'revision',
                      side: 'plan',
                      feedback,
                      clientMessageId: crypto.randomUUID(),
                    },
                  },
                  {
                    onSuccess: () => closeOverlay(),
                    onError: (error) =>
                      setRejectError(
                        error instanceof ApiError ? error.message : t('打回请求未送出，请重试。'),
                      ),
                  },
                );
              }
            : undefined
        }
      />
      {overlay?.kind === 'rerun' && (
        /* #640：dialog 只剩 failed 重跑面——重跑 = 直发总管编排回合；
           reuse（失败轮持有方案文档）保留 r8 §3.4 复用方案 家族。 */
        <RerunDialog
          reuse={todo.hasPlan}
          pin={live ? rerunPin : null}
          onClose={closeOverlay}
          onRerun={
            live
              ? () => {
                  closeOverlay();
                  orchestrateStart.orchestrate(todo.id);
                }
              : undefined
          }
          onReuse={() => setOverlay({ kind: 'reuse' })}
          onUnpin={live ? unpinForRerun : undefined}
        />
      )}
      {overlay?.kind === 'reuse' && (
        <ReusePanel
          onClose={closeOverlay}
          onBack={() => setOverlay({ kind: 'rerun' })}
          onView={() => {
            // #318: 查看方案 = 关弹层 + docpane 切被复用方案的 plan 显示面
            // (plans 读面已在;原站行为未捕获——r8 §5/r9 §5,[设计] 裁定)。
            setPlanView(true);
            closeOverlay();
          }}
          onDirect={
            live
              ? () => {
                  // 复用方案 = 直执行（跳过规划轮，r8 75/76；02 §4.2
                  // withPlan:false 分支）。
                  startBuild(false);
                }
              : closeOverlay
          }
        />
      )}
      <ChiefAgentDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        agents={assignOptions}
        boundAgentId={todo.agent?.id ?? null}
        onBind={bindAssign}
        title={t(ASSIGN_AGENT_DIALOG_TITLE)}
        confirmCopy={ASSIGN_AGENT_REBIND_CONFIRM_COPY}
      />
      <ReviewDialog
        open={overlay?.kind === 'review'}
        onClose={closeOverlay}
        agents={reviewAgents}
        defaultAgentId={reviewDefaultId ?? undefined}
        producerProvider={reviewProducerProvider}
        onStart={
          // 入队审核步（r8 §3.1 实测）：POST steps {action:"review", agentId, focus?}
          // → server 入队审核步 + 时间线插 REVIEW_ANNOUNCEMENT + phase 留 confirm
          // /review。乐观 closeOverlay；终态由 SSE step 事件推进 reviewActive。
          live && buildId
            ? (input) => {
                mutations.stepAction.mutate(
                  {
                    buildId,
                    body: { action: 'review', agentId: input.agentId, focus: input.focus },
                  },
                  { onSuccess: () => closeOverlay() },
                );
              }
            : undefined
        }
      />
      <SearchPanel
        open={search.open}
        fixture={
          live
            ? {
                ...fixture,
                todos,
                now: Date.now(),
                projectNames: Object.fromEntries((projectsQ.data ?? []).map((p) => [p.id, p.name])),
              }
            : fixture
        }
        server={live ? searchResults.data : undefined}
        query={search.query}
        onQuery={search.setQuery}
        onClose={() => search.setOpen(false)}
      />
    </div>
  );
}
