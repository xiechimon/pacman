// Todo detail route (issue #56): app shell sidebar + dhead + phase-driven
// body — fresh block (23/23d) or doc pane + chat column (16/17 family) —
// plus composer, 总管 FAB and the capture-frozen user-menu popover.
// #66/#68 add the 更多/删除 and token/branch/history/accept overlays;
// #75 adds the deep dynamic states: the version dropdown / compare
// submenu / plan-version diff surface of the doc pane, the rerun dialog +
// 复用方案 sub-panel (r8 56/74/75) and the interactive reject chain
// (请求修改 → replan streaming → v(N+1) → diff → 确认, AC3) walked
// client-side over the fixture script.
// #83 (M5): live 数据源分支——无 `?scenario=` 时详情页走真 API + 真 SSE
// （transcript 实时流/步进度/plan 版本/变更 diff/overlay 三件），关口动作
// 接真端点（开始/确认/驳回/合并/重跑/删除）；fixture 分支（含 chain 脚本）
// 保持 #56–#75 行为字节不变。
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
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
  useSteps,
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
import { AppSidebar } from '../board/app-sidebar.js';
import { ChiefWake } from '../chief/chief-wake.js';
import { markDeleted, withoutDeleted } from '../fixtures/deletions.js';
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
  // 文档|聊天 tabs (issue #56): 文档 = doc pane + chat column, 聊天 = chat
  // column alone. Pure render state — the captures all sit on 文档.
  const [tab, setTab] = useState<'doc' | 'chat'>('doc');
  // 更多 menu + delete confirm (#66): confirming a delete marks the todo
  // in the deletions overlay and returns to /app (r2 §5.4) — the board
  // route then renders without it; the fixture phase has no backend.
  // M5: live 模式走 DELETE /api/todos/{id}。
  const [moreOpen, setMoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const fixture = resolveScenario(searchParams);
  const search = useSearchState(fixture.ui?.searchOpen === true, fixture.ui?.searchQuery ?? '');
  // W4 #286：live 面服务端搜索（fixture/parity 面不经此钩）。
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
  const projectBuildsQ = useProjectBuilds(wireTodo?.projectId, live);
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
  // #209 编辑分配弹层开态——挂页层:chip popover 关即卸载(dhead
  // OverlayMount),弹层挂其内会被带走。
  const [assignOpen, setAssignOpen] = useState(false);

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

  // live 指派：开始/重跑取团队首个 Agent（已建屏无开始 dialog——assignment
  // 缺省语义 [设计]，02 §6.2 双槽同值）。
  const firstAgentId = useMemo(() => {
    const member = (membersQ.data ?? []).find((m) => m.memberType === 'agent');
    return member?.actorId ?? null;
  }, [membersQ.data]);
  const startBuild = useCallback(
    (withPlan: boolean) => {
      if (!live || !wireTodo) return;
      mutations.startBuilds.mutate({
        projectId: wireTodo.projectId,
        todoIds: [wireTodo.id],
        assignment: {
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
  const assignOptions: ChiefAgentOption[] | undefined = live
    ? (membersQ.data ?? [])
        .filter((m) => m.memberType === 'agent')
        .map((m) => ({
          id: m.actorId,
          name: (m.actor as { displayName?: string } | undefined)?.displayName ?? m.actorId,
        }))
    : undefined;
  const bindAssign = live
    ? (agentId: string) =>
        mutations.patchTodo.mutate(
          { id: todo.id, body: { assignment: { build: { agentId } } } },
          { onSuccess: () => setAssignOpen(false) },
        )
    : undefined;

  const content = live
    ? wireTodo && buildId
      ? {
          token: mapTokenUsage(usageQ.data ?? []),
          branch: mapBranchInfo(buildId, steps, machinesQ.data ?? []),
          runs: mapRunHistory(wireTodo, projectBuildsQ.data ?? [], Date.now(), historyTokens),
        }
      : null
    : overlayContent(todo.id);
  const ui = PHASE_UI[phase];
  const detail = live ? liveDetail : fixture.detail;
  const streaming = live ? running : view.transcript.some((item) => item.kind === 'streaming');
  // The doc pane flips to the 变更 surface once a run produced changes
  // (r7 27/36, r8 54/73); the plan-version diff surface wins while open
  // (r8 65–72); the plan surface serves todo→building (r7 16/17/26).
  const docMode =
    view.planDiff != null
      ? 'diff'
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
          tab={tab}
          onTab={setTab}
          onMore={() => setMoreOpen(true)}
          onOverlay={(kind) => setOverlay({ kind })}
          onAction={() => {
            if (live) {
              // 主时序关口（02 §4.2）：todo 开始 / confirm 确认 / review 验收
              // 弹层 / failed 重跑弹层 / done 重开 = 新一轮 build。
              if (phase === 'todo') startBuild(true);
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
            // r8 54: the failed 重跑 button opens the rerun dialog
            if (phase === 'review') setOverlay({ kind: 'accept' });
            if (phase === 'failed') setOverlay({ kind: 'rerun' });
          }}
          chipPopoverOpen={fixture.ui?.chipPopoverOpen === true}
          onEditAssign={() => setAssignOpen(true)}
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
                changes={live ? liveDetail?.changes : detail.changes}
                now={live ? Date.now() : fixture.now}
                planDropdownOpen={fixture.ui?.planDropdownOpen === true}
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
          <>
            {composerReject != null && <div className="composer-reject">{composerReject}</div>}
            <Composer
              placeholder={ui.placeholder}
              aiReview={
                // r7 §4.1 / r8 §3.1: the AI 审核 button only shows on writable
                // confirm/review surfaces; failed and waiting-on-user
                // composers render the three base tools alone
                (phase === 'confirm' || phase === 'review') && !todo.awaitingReply
              }
              streaming={streaming}
              editable={live}
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
          </>
        )}
        <ChiefWake fixture={fixture} fabClassName="detail-fab" />
      </div>
      {!live && detail?.userMenuOpen === true && <UserMenu theme={readStoredTheme(localStorage)} />}
      <MoreMenu
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onDelete={() => {
          setMoreOpen(false);
          setDeleteOpen(true);
        }}
      />
      <DeleteConfirm
        open={deleteOpen}
        todo={todo}
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
      {content != null && (
        <TokenDialog
          open={overlay?.kind === 'token'}
          stats={content.token}
          onClose={closeOverlay}
        />
      )}
      {content != null && (
        <BranchDialog
          open={overlay?.kind === 'branch'}
          info={content.branch}
          onClose={closeOverlay}
        />
      )}
      {content != null && (
        <HistoryDialog
          open={overlay?.kind === 'history'}
          runs={content.runs}
          onClose={closeOverlay}
        />
      )}
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
          onClose={closeOverlay}
          onReuse={() => setOverlay({ kind: 'reuse' })}
          onPlan={live ? () => startBuild(true) : undefined}
          onDirect={live ? () => startBuild(false) : undefined}
        />
      )}
      {overlay?.kind === 'reuse' && (
        <ReusePanel
          onClose={closeOverlay}
          onBack={() => setOverlay({ kind: 'rerun' })}
          onView={closeOverlay}
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
