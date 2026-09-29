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
import type { Assignment } from '@pacman/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { attachFile } from '../api/attachments.js';
import {
  useApiMutations,
  useBuild,
  useBuildChanges,
  useBuildUsage,
  useDocumentDiff,
  useMachines,
  useMembers,
  useMessages,
  usePlans,
  useProjectBuilds,
  useProjects,
  useRunHistoryTokens,
  useSearchResults,
  useSkills,
  useSteps,
  useTags,
  useTodo,
  useTodos,
} from '../api/hooks.js';
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
import { useLiveData } from '../api/provider.js';
import { useConversationStream } from '../api/sse.js';
import { ChiefAgentDialog, type ChiefAgentOption } from '../chief/chief-agent-dialog.js';
import { AcceptDialog } from '../detail/accept-dialog.js';
import { Composer } from '../detail/composer.js';
import { DetailHead } from '../detail/dhead.js';
import { DocPane } from '../detail/docpane.js';
import { FreshBlock } from '../detail/fresh-block.js';
import { RerunDialog, ReusePanel } from '../detail/overlays.js';
import { type ReviewAgentOption, ReviewDialog } from '../detail/review-dialog.js';
import { RightPane } from '../detail/right-pane.js';
import { SourceIssueLine } from '../detail/source-issue.js';
import { SpecBlock } from '../detail/spec-block.js';
import { StopConfirmDialog } from '../detail/stop-confirm-dialog.js';
import { Transcript } from '../detail/transcript.js';
import { UserMenu } from '../detail/user-menu.js';
import type {
  DetailContent,
  OverlayState,
  PaneView,
  Phase,
  PlanDiffContent,
  TranscriptItem,
} from '../fixtures/records.js';
import { DeleteConfirm } from '../overlay/delete-confirm.js';
import type { MentionGroups } from '../overlay/mention-picker.js';
import { MoreMenu } from '../overlay/more-menu.js';
import { SearchPanel, useSearchState } from '../overlays/search-panel.js';
import { PHASE_UI } from '../phase.js';
import '../detail/detail.css';
import { AppSidebar } from '../board/app-sidebar.js';
import { ChiefWake } from '../chief/chief-wake.js';
import { markClosed, markDeleted, withoutDeleted } from '../fixtures/deletions.js';
import { overlayContent } from '../fixtures/fixtures.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
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
  const [liveDraft, setLiveDraft] = useState('');
  // 附件 token 拼到 draft 的逻辑（多文件按选序拼接，每个 token 占独立行）。
  const appendAttachmentTokens = useCallback(
    (tokens: string[]) => {
      if (tokens.length === 0) return;
      const joiner = liveDraft === '' || liveDraft.endsWith('\n') ? '' : '\n';
      setLiveDraft(`${liveDraft}${joiner}${tokens.join('\n')}\n`);
    },
    [liveDraft],
  );
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
  const closeOverlay = useCallback(() => setOverlay(null), []);
  // #75 version-menu + plan-version diff state: scenario-frozen for the
  // captures, interactive afterwards (63–72).
  const [menu, setMenu] = useState<'versions' | 'compare' | undefined>(fixture.detail?.versionMenu);
  const [diff, setDiff] = useState(fixture.detail?.planDiff);
  const [chain, setChain] = useState<ChainState>('idle');
  // live 面:变更 pane 展开态 + 版本对比开关(数据来自 documents/{id}/diff)。
  const [changesExpanded, setChangesExpanded] = useState(false);
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
  const liveText = useSyncExternalStore(liveTextStore.subscribe, () =>
    buildId != null ? liveTextStore.get(buildId) : '',
  );
  const streamHandlers = useMemo(
    () => ({
      // todo/phase 面由 team stream 驱动失效；此处兜底本页 todo 键。
      onMessage: () => {
        void qc.invalidateQueries({ queryKey: ['todo', id] });
      },
    }),
    [qc, id],
  );
  useConversationStream(buildId ?? undefined, live, streamHandlers);

  const steps = stepsQ.data ?? [];
  const running = steps.some((s) => s.status === 'claimed' || s.status === 'pending');
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

  const liveDetail: DetailContent | undefined = useMemo(() => {
    if (!live || !wireTodo || buildId == null) return undefined;
    const machineName =
      machinesQ.data?.find((m) => steps.some((s) => s.machineId === m.id))?.name ?? null;
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
        now: Date.now(),
        stopping,
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
    machinesQ.data,
    steps,
    messagesQ.data,
    plansQ.data,
    buildQ.data,
    userName,
    liveText,
    latestPlan,
    changesQ.data,
    changesExpanded,
    stopping,
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
      mutations.startBuilds.mutate({
        projectId: wireTodo.projectId,
        todoIds: [wireTodo.id],
        assignment: assignment ?? {
          plan: firstAgentId ? { agentId: firstAgentId } : null,
          build: firstAgentId ? { agentId: firstAgentId } : null,
        },
        withPlan,
      });
      setOverlay(null);
    },
    [live, wireTodo, mutations.startBuilds, firstAgentId],
  );

  if (todo == null) return null;

  // —— #209 编辑分配:chip popover「编辑分配」→ agent 选择弹层(#182 家族
  // 形态)→ PATCH assignment.build 槽(执行对话选中行 = build 槽派生投影,
  // services/todos.ts;server 槽级 merge #208 保 plan 槽)→ mutation 自带
  // invalidateAll 重取回显。候选 = members 读面 memberType:"agent" 行
  // (chief-settings 同投影);fixture 面 onBind 缺省 → accept 律(选择即关)。——
  // #318: model 副题并入投影(r9 §2.6 选择器行形「name · model」;开始
  // dialog 与编辑分配共用同一候选集)。
  const assignOptions: ChiefAgentOption[] | undefined = live
    ? (membersQ.data ?? [])
        .filter((m) => m.memberType === 'agent')
        .map((m) => {
          const modelId = (m.actor as { modelId?: string | null } | undefined)?.modelId;
          return {
            id: m.actorId,
            name: (m.actor as { displayName?: string } | undefined)?.displayName ?? m.actorId,
            ...(modelId ? { model: modelId } : {}),
          };
        })
    : undefined;
  const bindAssign = live
    ? (agentId: string) =>
        mutations.patchTodo.mutate(
          { id: todo.id, body: { assignment: { build: { agentId } } } },
          { onSuccess: () => setAssignOpen(false) },
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
  const canComplete = phase === 'review' || (live && phase === 'confirm');
  const canClose = phase === 'todo' || phase === 'failed';
  const completeTask = () => {
    setMoreOpen(false);
    if (phase === 'review') {
      setOverlay({ kind: 'accept' });
      return;
    }
    if (live && phase === 'confirm' && buildId != null)
      mutations.stepAction.mutate({ buildId, body: { action: 'confirm' } });
  };
  const closeTask = () => {
    setMoreOpen(false);
    if (live) {
      mutations.patchTodo.mutate(
        { id: todo.id, body: { phase: 'closed' } },
        { onSuccess: () => navigate('/app') },
      );
      return;
    }
    markClosed(todo.id);
    navigate('/app');
  };

  // AI 审核候选 Agent（M7 #312，r8 §3.1）：live = members 读面 memberType:"agent"
  // 行投影；fixture 面 undefined = ReviewDialog 兜底 DEFAULT_AGENT（行 A：r8 §3.1
  // 仅一处 Agent 选取，canon 单默认行）。
  const reviewAgents: ReviewAgentOption[] | undefined = live
    ? (membersQ.data ?? [])
        .filter((m) => m.memberType === 'agent')
        .map((m) => {
          const actor = m.actor as { displayName?: string; modelId?: string | null } | undefined;
          return {
            id: m.actorId,
            name: actor?.displayName ?? m.actorId,
            model: actor?.modelId ?? '默认',
          };
        })
    : undefined;
  // 默认选中 = 当前任务的 build 槽派生投影（services/todos.ts 双槽同值）；缺
  // 任务指派 = 行 A canon 单默认。
  const reviewDefaultId = live ? (todo.agent?.id ?? reviewAgents?.[0]?.id ?? null) : undefined;

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
          subtitle: m.sub,
        })),
      };
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

  // composer 被拒提示行（W3 #280 steer / #320 restart）：异步 onSend 失败时
  // draft 保留不丢字，文案按被拒写面分流；restart 错误 scope 到
  // variables.action（confirm 主钮同走 stepAction，其错误不上此行）。
  const composerReject = !live
    ? null
    : mutations.sendSteer.isError
      ? t('当前没有运行中的会话，消息未送出')
      : mutations.stepAction.isError && mutations.stepAction.variables?.body.action === 'restart'
        ? t('任务状态已变化，消息未送出')
        : null;

  return (
    <div className="detail-shell" data-route="todo-detail" data-todo-id={id}>
      <AppSidebar
        fixture={fixture}
        todos={todos}
        searchPanel={false}
        onSearch={() => search.setOpen(true)}
      />
      <div className="detail-main">
        <DetailHead
          todo={todo}
          phase={live ? phase : (view.phaseOverride ?? todo.phase)}
          onMore={() => setMoreOpen(true)}
          reviewActive={reviewActive}
          onAction={() => {
            if (live) {
              // 主时序关口（02 §4.2）：todo 开始 = 统一 dialog 面（#318,
              // r9 §3.6 待开始先开 dialog 再跑）/ confirm 确认 / review 验收
              // 弹层 / failed 重跑弹层 / done 重开 = 新一轮 build。
              if (phase === 'todo') setOverlay({ kind: 'rerun' });
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
            // r8 54: the failed 重跑 button opens the rerun dialog;
            // #318: todo 开始 同走统一 dialog 面（fixture 静态形）。
            if (phase === 'todo') setOverlay({ kind: 'rerun' });
            if (phase === 'review') setOverlay({ kind: 'accept' });
            if (phase === 'failed') setOverlay({ kind: 'rerun' });
          }}
          chipPopoverOpen={fixture.ui?.chipPopoverOpen === true}
          onEditAssign={() => setAssignOpen(true)}
        />
        <div className="detail-body">
          <div className="detail-center">
            {/* 来源 issue 行（#452 / ADR 0006 D5/D6）：live 专属——未建成给
                重试入口；已建成进入拉一次回显（不一致中性提示、拉不到整行
                隐藏）。fixture 面无来源数据源，不渲染。 */}
            {live && wireTodo?.sourceKind != null && (
              <SourceIssueLine
                todo={wireTodo}
                onRetry={() => mutations.retryGithubIssue.mutate(wireTodo.id)}
                retryPending={mutations.retryGithubIssue.isPending}
              />
            )}
            {detail == null ? (
              <div className="detail-fresh">
                <FreshBlock todo={todo} tags={freshTags} />
                {/* M7 #310：live 详情面把用户提交的 spec 渲染在 FreshBlock 之
                    下（fix 丢字 bug ——之前 spec 落 todo.spec 但 UI 从未呈现
                    给用户看）。fixture 面不走此分支：fixture
                    fresh-probe 用同样的「尚无描述」placeholder。 */}
                {live && todo.spec.trim() !== '' && <SpecBlock spec={todo.spec} />}
              </div>
            ) : (
              <>
                {/* M7 #310：live 详情面在线程列首展示用户提交 spec（#366：
                    随 3-pane 重排从 doc 列迁到中心列——用户原始输入属于线
                    程流，右 pane 只放 agent 产物面）。fixture 不走（无
                    spec data wire 视觉回归风险）。 */}
                {live && todo.spec.trim() !== '' && <SpecBlock spec={todo.spec} />}
                <div className="chat-col">
                  {/* margin-top:auto pins an overflowing transcript to the
                      newest row at first paint (r8 63–77) and keeps short r7
                      transcripts top-aligned — no scroll scripting, so the
                      fixture capture is deterministic */}
                  <div className="chat-pin">
                    <Transcript
                      transcript={view.transcript}
                      // #366 AC：线程内 plan 卡激活 = 右 pane 切文档面的
                      // plan 显示面（与 复用方案「查看方案」同律）。
                      onOpenPlan={() => {
                        setPaneView('doc');
                        setPlanView(true);
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          <RightPane
            view={paneView}
            onView={setPaneView}
            docLabel={docMode === 'changes' ? '变更' : '方案'}
            content={content}
            buildId={live ? buildId : null}
            empty={detail == null}
          >
            {detail != null && (
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
                onToggleExpand={() => {
                  if (live) {
                    setChangesExpanded((v) => !v);
                    return;
                  }
                  setDiff((d) => (d != null ? { ...d, expanded: !d.expanded } : d));
                }}
              />
            )}
          </RightPane>
        </div>
        {ui.placeholder != null && (
          <>
            {composerReject != null && <div className="composer-reject">{composerReject}</div>}
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
                      // 失败仅记日志不发（用户继续编辑 draft，已发成功的 token
                      // 仍落入）；token 拼到 draft。
                      const tokens: string[] = [];
                      for (const file of files) {
                        try {
                          const r = await attachFile({ file, scope: 'message' });
                          tokens.push(r.token);
                        } catch (err) {
                          console.error('attachment failed', file.name, err);
                        }
                      }
                      appendAttachmentTokens(tokens);
                    }
                  : undefined
              }
              mentionGroups={mentionGroups}
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
                      // W3 steer（#280，06 册 D9 / spec #277）：building/review 态
                      // 发送 = 运行中补话。server 门（claimed 步在跑）收则 201，
                      // 无在跑步 409 明确拒绝（提示行 + draft 保留，不丢字）。
                      // 返回 Promise = composer 异步清稿面。
                      if ((phase === 'building' || phase === 'review') && buildId && text !== '') {
                        return mutations.sendSteer
                          .mutateAsync({ conversationId: buildId, content: text })
                          .then(() => {
                            setLiveDraft('');
                            return undefined;
                          });
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
          </>
        )}
        <ChiefWake fixture={fixture} fabClassName="detail-fab" unreadOnly />
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
      />
      <DeleteConfirm
        open={deleteOpen}
        title={t('确定删除该任务？此操作不可撤销。')}
        summary={
          <>
            <span className="delete-confirm-seq">#{todo.seqNum}</span>
            {todo.title}
          </>
        }
        ariaLabel={t('删除任务')}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          if (live) {
            mutations.deleteTodo.mutate(todo.id, { onSuccess: () => navigate('/app') });
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
        onConfirm={
          live && buildId
            ? () => {
                // merge = 202 delegated（r3 §3.6）：合并步机器执行，phase 经
                // SSE 推进到 done（🎉 时间线行由 server 落库）。
                mutations.mergeBuild.mutate(buildId);
                closeOverlay();
              }
            : undefined
        }
      />
      {overlay?.kind === 'rerun' && (
        <RerunDialog
          reuse={todo.hasPlan}
          agent={
            detail?.rerunAgent ?? {
              name: todo.agent?.displayName ?? '未指派',
              model: '默认',
            }
          }
          // #318 统一面(r9 §3.6):候选 = members 读面投影;初始选择 =
          // 执行槽派生 ?? 团队首个 Agent ?? 未指派('');机器行 = GET
          // machines 读面(展示投影,指定机器无 server 槽——[设计] 注记
          // 在 overlays.tsx)。fixture 面三者缺省 = #75 静态形字节不变。
          agentOptions={assignOptions}
          initialAgentId={live ? (todo.assignment?.agentId ?? firstAgentId ?? '') : undefined}
          machines={
            live
              ? (machinesQ.data ?? []).map((m) => ({ name: m.name, online: m.online }))
              : undefined
          }
          onClose={closeOverlay}
          onReuse={() => setOverlay({ kind: 'reuse' })}
          onStart={
            live ? ({ withPlan, assignment }) => startBuild(withPlan, assignment) : undefined
          }
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
