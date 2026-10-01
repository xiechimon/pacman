// Agent 详情编辑面（#485，r3 §4 实测形态）：团队页点 Agent 卡进
// `/app/resources/agents/<id>?name=<名>`，三 tab 概览 / 记忆 / 权限。
//
// 为什么详情页不骑 members 读面：团队页的 `GET members` 投影出的是展示用
// TeamAgentCard（只有 displayName/model/role），职责、provider、权限四组都
// 不在其中；编辑面要的是全记录，故直取 `GET agents/{aid}`（r3 §4 词表内，
// 与 PATCH 同路径）。
//
// 数据面纪律与仓内其它 resource 页同律：`live ? 查询真值 : fixture 记录`
// （两组形状同源 = shared AgentRecord），fixture 面无后端，提交落本地覆盖
// 记录承载「提交后回显」——live 面则是 S8 律（mutation → invalidateAll 重取）。
//
// XMON-18 裁决（2026-10-01）：概览不摆 `状态` 行——`agentStatusSchema` 只有一个
// 取值 active，摆出来零信息量（原版有这一行，本仓不复刻）；`创建于 …` 也不摆
// （不需要创建时间，DB 不加 createdAt 列）。**其余只读行保留**：思考强度档位交给
// agent 编排、不给人手设，但值本身要看得见。
//
// 本面明确不做的两件（均因证据/结构缺口，不发明）：
// · `创建于 …` 状态行——AgentRecord 与 DB agent 表都无 createdAt 列；
// · 思考强度选择器——B1 已裁「保持只读」；档位词表本身有读面了（XMON-16：
//   `GET /api/capabilities` 投影 shared THINKING_LEVELS），但读面 ≠ 写面，
//   只读行按读面呈现档位，选择器与 provider 写面的耦合仍不做。
//
// 承载结构 = components/ui/Button ghost（XMON-28/B3）：本面四处散写钮
// （进行中行、记忆排序触发器与选项行、名称行内编辑）换底座，几何与配色正本
// 仍住 agent-detail.css 与 resources.css 的 `.res-sort*`（域 css unlayered，
// 压 utility 层），故契约面逐值不动。底座带进来的差额在消费点就地并掉：
// `justify-start` / `gap-0`（散写形是 flex-start、无序间距）、`h-auto`（行钮
// 没有定高，底座 h-8 会把 `进行中` 行与名称钮钉成 32px）、`rounded-none`
// （`.agent-task-row` 无圆角，底座 rounded-lg 会让 hover 底色带弧）、
// `font-normal`（底座 font-medium）、`leading-[inherit]`（底座 text-sm 自带
// 20px 行高；散写形走 preflight 的 `font: inherit`，本仓正解就是 inherit）、
// `[&_svg…]:size-*`（底座 size-4 会盖过图标自己的 width/height 属性）。
//
// 删除 Agent（XMON-19/B2）：入口在概览页脚，二次确认接 DeleteConfirm 家族。
// 整个流程 2026-10-01 登录原版实测过一遍（入口 → 确认层 → 取消 → 删除 → 落点），
// 文案与落点都取自实测，产线 bundle 语料是第二源、两源一致。删除语义（记忆保留、
// 任务指派摘槽、总管摘绑定）在 server services/agents.ts 注记。原版同族还有一档
// remove_over_quota 提示（删除后仍达计划上限）——本仓没有套餐/Agent 上限模型，
// 无锚可挂，故不渲染。

import {
  AGENT_PERMISSION_COPY,
  AGENT_TOOL_COPY,
  AGENT_TOOL_SWITCHES,
  type AgentRecord,
  MEMORY_EMPTY_COPY,
  MEMORY_QUOTA_PER_AGENT,
  MEMORY_UI_COPY,
  type PatchAgentBody,
  THINKING_LEVELS,
} from '@pacman/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  useAgent,
  useAgentTasks,
  useApiMutations,
  useCapabilities,
  useMcpServers,
  useMemories,
  useModelSources,
  useProviders,
  useSecrets,
  useSkills,
} from '../api/hooks.js';
import { RUNTIME_LABELS, toModelOptions, toThinkingLevelDisplay } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { ProfileAvatar, ProfileCard, ProfileHead, ProfileRow } from '../components/profile-card.js';
import { Button } from '../components/ui/button.js';
import { FloatingShell } from '../components/ui/floating-shell.js';
import { Input } from '../components/ui/input.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import { Select } from '../components/ui/select.js';
import { Switch } from '../components/ui/switch.js';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import { isDeleted, markDeleted } from '../fixtures/deletions.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  SquarePen,
} from '../icons/index.js';
import { DeleteConfirm } from '../overlay/delete-confirm.js';
import { ClickCatcher } from '../overlays/dismiss.js';
import { PHASE_UI } from '../phase.js';
import { SECRETS_HREF } from '../resources/secrets-page.js';
import { ResourceShell } from '../resources/shell.js';
import { Chip } from '../ui/chip.js';
import './agent-detail.css';
import { AgentModelSelect } from './agent-model-select.js';

/** 资源族根路径（非侧栏行——原版命令面板「前往」清单里没有 Agents 行，
 *  r2 §8.4；本面只从团队页的卡进入）。 */
export const AGENTS_HREF = '/app/resources/agents';

type AgentTab = 'overview' | 'memory' | 'permissions';

/** 内置 runtime 的显示值（原版实测原文，Agent 详情概览的「运行时」行）。 */
const BUILTIN_RUNTIME_LABEL = '内置 (pi)';

const TAB_LABELS: { id: AgentTab; label: string }[] = [
  { id: 'overview', label: '概览' },
  { id: 'memory', label: '记忆' },
  { id: 'permissions', label: '权限' },
];

/** 记忆 tab 的两档序（r5 §6 只观测到 `排序` 钮本体，下拉内容未观测）。
 *  [设计] 取值同 skills-page #306 的判法：只列数据面能诚实承载的键——
 *  MemoryRecord 有 createdAt，故第二档是 `添加时间`（新 → 旧）；`默认` =
 *  到达序（server 投影序，不重排）。 */
const MEMORY_SORT_OPTIONS = ['默认', '添加时间'] as const;
type MemorySort = (typeof MEMORY_SORT_OPTIONS)[number];

export function AgentDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const agentId = params.id;
  const { search } = useLocation();
  const navigate = useNavigate();
  const fixture = resolveScenario(new URLSearchParams(search));
  const { live, teamId } = useLiveData();

  const agentQ = useAgent(teamId, agentId, live);
  const agentTasksQ = useAgentTasks(teamId, agentId, live);
  const memoriesQ = useMemories(teamId, agentId, live);
  const providersQ = useProviders(teamId, live);
  const modelSourcesQ = useModelSources(teamId, live);
  const capabilitiesQ = useCapabilities(live);
  const skillsQ = useSkills(teamId, live);
  const secretsQ = useSecrets(teamId, live);
  const mcpQ = useMcpServers(teamId, live);
  const mutations = useApiMutations(teamId);

  const [tab, setTab] = useState<AgentTab>('overview');
  // fixture 面没有后端：本地覆盖记录承载「提交后回显」（live 面恒空，走
  // invalidateAll 重取）。字段语义与 patchAgent body 同。
  const [localPatch, setLocalPatch] = useState<Partial<AgentRecord>>({});
  /** fixture 面的记忆删除：没有 DELETE 后端，落本地已删集（live 面恒空）。 */
  const [removedMemories, setRemovedMemories] = useState<string[]>([]);
  /** 记忆 tab 的搜索词与排序档（#499）；`#425 B1` 的 wrap 锚定面同 skills-page。 */
  const [memoryQuery, setMemoryQuery] = useState('');
  const [memorySort, setMemorySort] = useState<MemorySort>('默认');
  const [memorySortOpen, setMemorySortOpen] = useState(false);
  const [memorySortWrap, setMemorySortWrap] = useState<HTMLSpanElement | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fixtureAgent = fixture.agents?.find((row) => row.id === agentId);
  const source = live ? agentQ.data : fixtureAgent;
  // fixture 面的删除覆面（#66 deletions）：删掉的 Agent 在本 SPA 会话里不再
  // 解析出记录，页面落既有「找不到该 Agent」态；reload 还原。
  const agent: AgentRecord | undefined =
    source === undefined || (agentId !== undefined && isDeleted(agentId))
      ? undefined
      : { ...source, ...localPatch };

  const patch = useCallback(
    (body: PatchAgentBody) => {
      if (agentId === undefined) return;
      if (live) {
        mutations.patchAgent.mutate({ id: agentId, body });
      } else {
        setLocalPatch((prev) => ({ ...prev, ...body }));
      }
    },
    [agentId, live, mutations.patchAgent],
  );

  // 模型候选：live = providers ∪ model-sources 真值；fixture = 场景行集。
  // 投影单源 = toModelOptions（与总管压缩模型选择器同一份）。
  const modelOptions = live
    ? toModelOptions(providersQ.data?.providers ?? [], modelSourcesQ.data?.sources ?? [])
    : toModelOptions(fixture.resources?.providers ?? [], fixture.resources?.providerSources ?? []);

  // 技能候选：live 的 SkillRecord.id 与 fixture SkillRow.name 同值域
  // （skillRecordSchema：id = frontmatter name 回落目录名）。
  const skillOptions = live
    ? (skillsQ.data ?? []).map((row) => ({ id: row.id, name: row.name }))
    : (fixture.resources?.skills ?? []).map((row) => ({ id: row.name, name: row.name }));

  const memories = (live ? (memoriesQ.data ?? []) : (fixture.resources?.memories ?? [])).filter(
    (row) => row.agentId === agentId && !removedMemories.includes(row.id),
  );

  // 「进行中」段（概览）。语义 = 该 Agent 名下正在跑的 build，不是「指派给
  // 它的 todo」——判据在服务端（routes.ts 同名端点），本面只渲染。行形状 =
  // shared AgentTask，逐字段的原件出处见 agent.ts 的 schema 注释。
  const agentTasks = live ? (agentTasksQ.data ?? []) : (fixture.agentTasks ?? []);
  // live 面首帧 data 未到 ≠ 没有在跑的任务：不给空态闪一下。
  const agentTasksPending = live && agentTasksQ.isPending;

  // 搜索扫 title 与 content 两栏（r5 §6 的条目卡就是这两栏文本），ASCII 走
  // 大小写不敏感；排序只在命中集内重排，不重置搜索条件。
  const memoryNeedle = memoryQuery.trim().toLowerCase();
  const matchedMemories =
    memoryNeedle === ''
      ? memories
      : memories.filter((row) =>
          `${row.title}\n${row.content}`.toLowerCase().includes(memoryNeedle),
        );
  const visibleMemories =
    memorySort === '添加时间'
      ? [...matchedMemories].sort((a, b) => b.createdAt - a.createdAt)
      : matchedMemories;
  // 密钥只取 id 集：授权粒度是全有全无（#510），本面不逐条渲染密钥名。
  const secretIds = live
    ? (secretsQ.data ?? []).map((row) => row.id)
    : (fixture.resources?.secrets ?? []).map((row) => row.id);
  const mcpOptions = live
    ? (mcpQ.data ?? []).map((row) => ({ id: row.id, name: row.label }))
    : (fixture.resources?.mcpServers ?? []).map((row) => ({ id: row.name, name: row.name }));

  // 权限 tab 保存失败的可见反馈（XMON-80/P2）。patchAgent 是全页共用的一条
  // mutation——概览的名称 / 职责 / 模型 / 默认 skill 也走它，所以裸看 isError
  // 会把概览的失败挂在权限 tab 的红字上，指到一个用户没动过的控件。判据取
  // 失败那一次的 variables（todo-detail-page 的 restart 分支同律）：只有失败
  // 体碰了工具 / 密钥 / MCP 三组，才落在这块面的账上。
  const failedPatchBody = mutations.patchAgent.variables?.body;
  const permSaveFailed =
    mutations.patchAgent.isError &&
    failedPatchBody !== undefined &&
    ('tools' in failedPatchBody || 'secrets' in failedPatchBody || 'mcpServers' in failedPatchBody);

  if (agent === undefined) {
    return (
      <ResourceShell
        title={t('Agent')}
        href={AGENTS_HREF}
        backHref="/app/team"
        hideNew
        fixture={fixture}
      >
        <div className="agent-detail">
          <p className="agent-missing">{t('找不到该 Agent。它可能已被删除。')}</p>
        </div>
      </ResourceShell>
    );
  }

  const toggleTool = (label: string, on: boolean) => {
    const next = on
      ? [...agent.tools, label].filter((v, i, all) => all.indexOf(v) === i)
      : agent.tools.filter((v) => v !== label);
    patch({ tools: next });
  };
  const toggleMcp = (id: string, on: boolean) => {
    const next = on ? [...agent.mcpServers, id] : agent.mcpServers.filter((v) => v !== id);
    patch({ mcpServers: next });
  };

  const defaultSkill = agent.skills[0] ?? null;
  // 思考强度档位（XMON-16）：live 面词表来自能力读面 `GET /api/capabilities`
  // （server 投影 shared 单源）；fixture 面与读面未解析时直接取 shared
  // `THINKING_LEVELS` 本身——那不是第二份真值，就是读面背后的同一个常量。
  // 存值须落在词表内才呈现，否则落 r3 §4 观测形「默认」。
  const thinkingLevels = capabilitiesQ.data?.thinkingLevels ?? THINKING_LEVELS;
  const thinkingLevel = toThinkingLevelDisplay(agent.thinkingLevel, thinkingLevels);
  const runtimeLabel =
    agent.provider == null || agent.provider === 'pi'
      ? t(BUILTIN_RUNTIME_LABEL)
      : agent.provider === 'claude-code'
        ? RUNTIME_LABELS['claude-code']
        : agent.provider;

  return (
    <ResourceShell
      title={agent.displayName}
      href={AGENTS_HREF}
      backHref="/app/team"
      hideNew
      fixture={fixture}
    >
      <div className="agent-detail">
        <Tabs value={tab} onValueChange={(value) => setTab(value as AgentTab)}>
          <TabsList variant="segmented" className="agent-tabs" aria-label={t('Agent')}>
            {TAB_LABELS.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="agent-tab">
                {t(item.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab === 'overview' && (
          <div className="agent-overview">
            {/* XMON-117：概览按 `/app/account` 的个人页模板复刻——原来是一列
                各自带 label 的散块，现在是**一张** profile 卡：居中头像头 +
                行式字段（label 左、值槽右，行间 1px 分隔线）。
                字段集合与行序逐条不动，只换承载结构；副文案（默认 skill 与
                职责的说明）跟着 label 走，值槽仍只放值，免得长句把值挤到贴边。 */}
            <ProfileCard className="agent-card">
              <ProfileHead>
                <ProfileAvatar>
                  {/* 头像走 SeededAvatar 适配层（种子 / 静态兜底 / 失败换图三律），
                      profile-avatar 只给 64px 圆盒。 */}
                  <SeededAvatar
                    name={agent.displayName}
                    src={agent.avatarUrl}
                    fallback="/avatar-robot-1.svg"
                  />
                </ProfileAvatar>
              </ProfileHead>
              <NameRow
                value={agent.displayName}
                onCommit={(displayName) => patch({ displayName })}
              />
              <RoleRow
                value={agent.description}
                onCommit={(description) => patch({ description })}
              />
              <ProfileRow
                label={t('默认 skill')}
                hint={t(AGENT_PERMISSION_COPY.defaultSkill)}
                labelClassName="agent-field-label"
              >
                {/* XMON-75：这一格此前是裸 `<select>`，弹的是 macOS 系统菜单——
                    与紧邻的模型选择器（自制弹层）并排就是两套弹窗。换成同一个
                    Select 壳后两格同形。值回显同模型面：候选里没有的值（技能已
                    被删除）出裸 id，不空白。 */}
                <Select
                  prefix="agent-skill"
                  value={defaultSkill}
                  options={skillOptions.map((skill) => ({ value: skill.id, label: skill.name }))}
                  label={
                    defaultSkill === null
                      ? t('未设置')
                      : (skillOptions.find((skill) => skill.id === defaultSkill)?.name ??
                        defaultSkill)
                  }
                  unsetLabel={t('未设置')}
                  menuLabel={t('默认 skill')}
                  onPick={(next) => patch({ skills: next === null ? [] : [next] })}
                />
              </ProfileRow>
              <ProfileRow label={t('运行时')} labelClassName="agent-field-label">
                {/* 运行时（原版概览在模型之上有这一档，实测值形如 `内置 (pi)`）。
                    本仓 wire 没有独立 runtime 字段——它就是 provider 位：null/pi
                    = 内置 pi runtime，claude-code = 本机 Claude Code，其余 =
                    custom provider 的 id。故只读呈现：做成选择器要落 provider
                    槽并与下面的模型选择器耦合（换 runtime 得同时改或清 modelId），
                    且原版「内置」文案在本仓没有对应物——语义裁决见 #499。 */}
                <span className="agent-runtime">{runtimeLabel}</span>
              </ProfileRow>
              <ProfileRow label={t('模型')} labelClassName="agent-field-label">
                <AgentModelSelect
                  value={
                    agent.provider != null && agent.modelId != null
                      ? { provider: agent.provider, modelId: agent.modelId }
                      : null
                  }
                  options={modelOptions}
                  onPick={(next) =>
                    patch(
                      next === null
                        ? { provider: null, modelId: null }
                        : { provider: next.provider, modelId: next.modelId },
                    )
                  }
                  prefix="agent-model"
                />
              </ProfileRow>
              <ProfileRow label={t('思考强度')} labelClassName="agent-field-label">
                {/* 只读值行（B1 裁「保持只读」）：值经能力读面词表解析，不直接
                    透出存值——引擎没有的档位不呈现（#499 B3 / XMON-16）。 */}
                <span className="agent-thinking">{thinkingLevel ?? t('默认')}</span>
              </ProfileRow>
            </ProfileCard>
            {/* 进行中（原版概览最后一段；r3 53 截图拍到的是空态
                `暂无进行中的任务`）。结构照原件：一张描边卡（bg-surface-secondary
                + 11px 三级色段头），空态是段内一行说明文字；段头带计数，
                但 N=0 时不出「 · 0」（原件 `count > 0 ? ' · N' : ''`）。
                行 = `#序号` + 标题（单行截断）+ 状态 chip + 右箭头，整行是
                按钮，落点 = 任务详情（原件 TaskRow onPress 走 todo.id）。
                行间不画分隔线——原件 Agent 详情这一处没传 `divided`（机器详情
                的同款列表才传），照抄。 */}
            <div className="agent-tasks">
              <p className="agent-tasks-head">
                {t('进行中')}
                {agentTasks.length > 0 ? ` · ${agentTasks.length}` : ''}
              </p>
              {agentTasksPending ? null : agentTasks.length === 0 ? (
                <p className="agent-tasks-empty">{t('暂无进行中的任务')}</p>
              ) : (
                agentTasks.map((row) => {
                  // `state === 'waiting'`（build 已建、尚无机器领取）落
                  // PhasePill 时映射为 `queued`；其余按 todo.phase（原件逐字，
                  // 见 shared AgentTask 注释）。
                  const ui = PHASE_UI[row.state === 'waiting' ? 'queued' : row.todo.phase];
                  return (
                    <Button
                      key={row.buildId}
                      variant="ghost"
                      className="agent-task-row justify-start h-auto rounded-none font-normal leading-[inherit] [&_svg:not([class*='size-'])]:size-3"
                      onClick={() => navigate(`/app/todo/${row.todo.id}`)}
                    >
                      <span className="agent-task-seq">#{row.todo.seqNum}</span>
                      <span className="agent-task-title">{row.todo.title}</span>
                      <Chip variant={ui.tone} size="mini">
                        {t(ui.chip)}
                      </Chip>
                      <span className="agent-task-go" aria-hidden="true">
                        <ChevronRight width={12} height={12} />
                      </span>
                    </Button>
                  );
                })
              )}
            </div>
            {/* 删除入口（r3 §4：概览页脚「删除 Agent」，在状态行之下）。按
                钮文案 = 原版语料 agent_modal.remove 原文。 */}
            <div className="agent-danger">
              <Button
                variant="destructive"
                size="sm"
                className="agent-delete"
                onClick={() => setDeleteOpen(true)}
              >
                {t('删除 Agent')}
              </Button>
            </div>
          </div>
        )}

        {tab === 'memory' && (
          <div className="agent-memories">
            {/* 配额头（r5 §6 原文 `记忆 · 1 / 100`）。n = 存量条数——配额记的
                是 Agent 上存了多少，不随搜索收窄；上限取 shared 单源常量，
                不在这写死 100（server 的超限 409 走同一个常量）。 */}
            <p className="agent-memory-head">
              {t('记忆 · {n} / {max}', {
                n: memories.length,
                max: MEMORY_QUOTA_PER_AGENT,
              })}
            </p>
            {memories.length === 0 ? (
              /* 空态文案 = shared MEMORY_EMPTY_COPY（02 §4.4/r5 §6 canon，总管
                 设置记忆 tab 同文），经 t() 消费、不作字面量出现。空列表不摆
                 搜索/排序控件（skills-page 先例：空态顶掉工具行）。 */
              <p className="agent-memory-empty">{t(MEMORY_EMPTY_COPY)}</p>
            ) : (
              <>
                {/* 搜索框 + 排序钮行：盒形与开合行为复用资源族既有面
                    （resources.css 的 .res-search 与 .res-sort 族，#306 家族
                    律），不另造一套。 */}
                <div className="agent-memory-search res-searchrow">
                  <div className="res-search">
                    <Search width={13} height={13} />
                    <Input
                      className="res-search-input"
                      type="text"
                      placeholder={t(MEMORY_UI_COPY.searchPlaceholder)}
                      aria-label={t(MEMORY_UI_COPY.searchPlaceholder)}
                      value={memoryQuery}
                      onChange={(event) => setMemoryQuery(event.target.value)}
                    />
                  </div>
                  <span className="res-sort-wrap" ref={setMemorySortWrap}>
                    <Button
                      variant="ghost"
                      className="res-sort agent-memory-sort justify-start gap-0 font-normal"
                      aria-haspopup="listbox"
                      aria-expanded={memorySortOpen}
                      onClick={() => setMemorySortOpen((v) => !v)}
                    >
                      <ArrowUpDown width={13} height={13} className="size-[13px]" />
                      <span>{t(MEMORY_UI_COPY.sort)}</span>
                      <ChevronDown width={12} height={12} className="size-3" />
                    </Button>
                    <FloatingShell
                      open={memorySortOpen}
                      onClose={() => setMemorySortOpen(false)}
                      container={memorySortWrap}
                    >
                      <ClickCatcher onClose={() => setMemorySortOpen(false)} />
                      <div
                        className="res-sort-menu agent-memory-sort-menu"
                        role="listbox"
                        aria-label={t(MEMORY_UI_COPY.sort)}
                      >
                        {MEMORY_SORT_OPTIONS.map((option) => (
                          <Button
                            key={option}
                            variant="ghost"
                            className="res-sort-row justify-start gap-0 font-normal [&_svg:not([class*='size-'])]:size-3.5"
                            role="option"
                            aria-selected={option === memorySort}
                            onClick={() => {
                              setMemorySort(option);
                              setMemorySortOpen(false);
                            }}
                          >
                            <span>{t(option)}</span>
                            {option === memorySort && (
                              <span className="res-sort-check">
                                <Check width={14} height={14} />
                              </span>
                            )}
                          </Button>
                        ))}
                      </div>
                    </FloatingShell>
                  </span>
                </div>
                {visibleMemories.length === 0 ? (
                  /* 搜不到 ≠ 没有记忆：canon 空态说的是「一条都没存过」，
                     [设计] 另起一行，不改用 MEMORY_EMPTY_COPY。 */
                  <p className="agent-memory-no-match">{t('没有匹配的记忆。')}</p>
                ) : (
                  /* XMON-117：记忆行落进同一张模板卡（一卡多行、行间分隔线），
                     不再一条一张描边卡。行不是 label/值对（没有左侧字段名），
                     故直接用模板的行盒类，不走 ProfileRow。 */
                  <ProfileCard className="agent-memory-card">
                    {visibleMemories.map((memory) => (
                      <div
                        key={memory.id}
                        className="profile-row profile-row--auto agent-memory-row"
                      >
                        <span className="agent-memory-text">
                          <span className="agent-memory-title">{memory.title}</span>
                          <span className="agent-memory-content">{memory.content}</span>
                        </span>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="agent-memory-del"
                          onClick={() => {
                            if (agentId === undefined) return;
                            if (live)
                              mutations.deleteMemory.mutate({ agentId, memoryId: memory.id });
                            else setRemovedMemories((prev) => [...prev, memory.id]);
                          }}
                        >
                          {t('删除')}
                        </Button>
                      </div>
                    ))}
                  </ProfileCard>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'permissions' && (
          <div className="agent-perms">
            {/* XMON-80/P2：保存失败的显式反馈。本面无乐观更新——开关由服务端
                值驱动，失败时控件压根没动过，所以「什么都不说」在用户侧 = 点了
                没反应（XMON-78 实测）。文案是固定句，不透传 server / statusText
                原文：500 的 body 对用户不可操作，且网络级失败的原文是英文串，
                混进中文面反而更糊（todo-detail 的被拒提示行同律）。 */}
            {permSaveFailed && (
              <p className="agent-perm-error" role="alert">
                {t('保存失败，请重试。')}
              </p>
            )}
            {/* XMON-117：三组各落一张模板卡（个人页那张卡的同一套行盒）——组名
                留作段头，行 = label（+ 说明副文案）左、开关右，与个人页的
                推送通知行同形。 */}
            <section className="agent-perm-group">
              <h3 className="agent-perm-title">{t('工具')}</h3>
              <ProfileCard className="agent-perm-card">
                {AGENT_TOOL_SWITCHES.map((label) => (
                  <ProfileRow
                    key={label}
                    className="agent-perm-row"
                    label={t(label)}
                    /* 六档各带说明副文案（AGENT_TOOL_COPY 单源；原文实测自
                       参考产品的权限 tab，XMON-84 恢复全六档）。 */
                    hint={t(AGENT_TOOL_COPY[label])}
                    labelClassName="agent-perm-name"
                    hintClassName="agent-perm-hint"
                  >
                    <Switch
                      className="agent-tool-switch"
                      aria-label={t(label)}
                      checked={agent.tools.includes(label)}
                      onCheckedChange={(checked) => toggleTool(label, checked)}
                    />
                  </ProfileRow>
                ))}
              </ProfileCard>
            </section>

            <section className="agent-perm-group">
              <h3 className="agent-perm-title">{t('密钥')}</h3>
              {/* 授权粒度 = 原版的「全有全无」（#510）：一行「团队密钥 + 总
                  说明 + 单个 switch」。原版 Agent 权限 tab 不展开逐个密钥行
                  （2026-09-30 直读参考产品确认），密钥页的行菜单也只有编辑/
                  删除、没有 per-Agent 矩阵。wire 的 secrets: string[] 表达得
                  了：开 = 全 id 集，关 = 空集。勾选态 = agent.secrets 非空。
                  零密钥时不出开关——没有对象可授，出了就是死控件。 */}
              {secretIds.length === 0 ? (
                // XMON-80/P3：零密钥时不出开关（没有对象可授），但也不能把
                // 用户停在一句陈述句上——创建入口本来就在侧栏密钥页，这里给
                // 出指向它的入口。search 随行 = 仓内 Link 律（sidebar /
                // parts.tsx 同法），生产 build 里 scenario 参数本就被编译期
                // 折叠、不参与路由。
                <ProfileCard className="agent-perm-card">
                  <div className="profile-row profile-row--auto agent-perm-empty-row">
                    <p className="agent-perm-empty">{t('暂无团队密钥。')}</p>
                    <Link className="agent-secret-add" to={{ pathname: SECRETS_HREF, search }}>
                      {t('去添加密钥')}
                    </Link>
                  </div>
                </ProfileCard>
              ) : (
                <ProfileCard className="agent-perm-card">
                  <ProfileRow
                    className="agent-perm-row agent-secret-row"
                    label={t('团队密钥')}
                    /* canon 副文案（AGENT_PERMISSION_COPY.secrets）内嵌
                       BRAND.cliCommandName 与密钥最低 CLI 版本插值，键值随
                       品牌常量走。 */
                    hint={t(AGENT_PERMISSION_COPY.secrets)}
                    labelClassName="agent-perm-name agent-secret-name"
                    hintClassName="agent-perm-hint agent-secret-hint"
                  >
                    <Switch
                      className="agent-secret-switch"
                      aria-label={t('团队密钥')}
                      checked={agent.secrets.length > 0}
                      onCheckedChange={(checked) => patch({ secrets: checked ? secretIds : [] })}
                    />
                  </ProfileRow>
                </ProfileCard>
              )}
            </section>

            <section className="agent-perm-group">
              {/* 段级说明（整组共用一句，不挂在单行上——挂哪一行都是任选），
                  形随模板的副文案档（12px 三级色）。 */}
              <h3 className="agent-perm-title">{t('MCP 服务器')}</h3>
              <p className="profile-hint">{t(AGENT_PERMISSION_COPY.mcpServers)}</p>
              {mcpOptions.length === 0 ? (
                <ProfileCard className="agent-perm-card">
                  <div className="profile-row profile-row--auto agent-perm-empty-row">
                    <p className="agent-perm-empty">{t('暂无 MCP 服务器。')}</p>
                  </div>
                </ProfileCard>
              ) : (
                <ProfileCard className="agent-perm-card">
                  {mcpOptions.map((server) => (
                    <ProfileRow
                      key={server.id}
                      className="agent-perm-row agent-mcp-row"
                      label={server.name}
                      labelClassName="agent-perm-name"
                    >
                      <Switch
                        className="agent-mcp-switch"
                        aria-label={server.name}
                        checked={agent.mcpServers.includes(server.id)}
                        onCheckedChange={(checked) => toggleMcp(server.id, checked)}
                      />
                    </ProfileRow>
                  ))}
                </ProfileCard>
              )}
            </section>
          </div>
        )}
      </div>
      {/* 删除确认（2026-10-01 登录原版实测，与产线 bundle 语料两源一致）：
          标题 `删除 Agent？`、正文 `将「{name}」移出团队？该 Agent 进行中的任务
          将被停止。`、两钮 `取消` / `删除`，逐字。取消路径实测：点取消 → 层关、
          留在详情页、Agent 未删。 */}
      <DeleteConfirm
        open={deleteOpen}
        title={t('删除 Agent？')}
        summary={t('将「{name}」移出团队？该 Agent 进行中的任务将被停止。', {
          name: agent.displayName,
        })}
        ariaLabel={t('删除 Agent')}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          if (agentId === undefined) return;
          // 确认后落团队页 `/app/team`，无提示条——2026-10-01 登录原版实测（不再是
          // 推断：点「删除」后地址先停在详情页，随请求落地切到 `/app/team`，页面
          // 无 toast/横幅）。search 随行 = #121 Link 律（fixture 的场景位不能在这
          // 一跳丢；原版无此查询参，观测不到差异）。
          if (live) {
            mutations.deleteAgent.mutate(agentId, {
              onSuccess: () => navigate({ pathname: '/app/team', search }),
            });
            return;
          }
          markDeleted(agentId);
          navigate({ pathname: '/app/team', search });
        }}
      />
    </ResourceShell>
  );
}

/** 进输入态即聚焦。聚焦走 ref + effect 而非 autoFocus：biome 的
 *  a11y/noAutofocus 在本仓是 error 档，composer / mention-picker 同法。 */
function useEditorFocus<T extends HTMLElement>(editing: boolean) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);
  return ref;
}

/** 名称行内编辑（r3 §4：名称（行内编辑））——点文本进输入态，Enter 或失焦
 *  提交，Esc 放弃。空串不算提交（displayName 有 min(1) 约束）。
 *  行内的编辑图标（r3 §4 实测：名称行带编辑图标）与文本同为入口：图标钮是
 *  图标-only，靠 aria-label 拿可访问名（SquarePen 自带 aria-hidden）。 */
function NameRow({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useEditorFocus<HTMLInputElement>(draft !== null);
  if (draft === null) {
    // 行高 49 = 个人页的名称行（r7 13 探测值，模板里唯一加高的一档）
    return (
      <ProfileRow
        className="profile-row--name"
        label={t('名称')}
        labelClassName="agent-field-label"
      >
        <Button
          variant="ghost"
          className="agent-name justify-start h-auto gap-0 rounded-none font-normal leading-[inherit]"
          onClick={() => setDraft(value)}
        >
          {value}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="agent-name-edit"
          aria-label={t('编辑')}
          onClick={() => setDraft(value)}
        >
          <SquarePen width={14} height={14} />
        </Button>
      </ProfileRow>
    );
  }
  const commit = () => {
    const next = draft.trim();
    if (next !== '' && next !== value) onCommit(next);
    setDraft(null);
  };
  return (
    <ProfileRow
      className="profile-row--name"
      label={t('名称')}
      labelClassName="agent-field-label"
      valueClassName="profile-value--grow"
    >
      <input
        id="agent-name-input"
        ref={inputRef}
        className="agent-name-input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setDraft(null);
        }}
      />
    </ProfileRow>
  );
}

/** 职责编辑（r3 §4 原文注：「用一两句话说明该 Agent 的职责。…」）。未设置时
 *  出 canon 空态文案（团队页卡同一串）。 */
function RoleRow({
  value,
  onCommit,
}: {
  value: string | null;
  onCommit: (next: string | null) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useEditorFocus<HTMLTextAreaElement>(draft !== null);
  // 说明副文案是这一行的常驻部分（编辑态也在）：它是「怎么写」的指导，
  // 编辑时撤掉反而最需要它的时候没了。
  return (
    <ProfileRow
      label={t('职责')}
      hint={t(AGENT_PERMISSION_COPY.responsibility)}
      labelClassName="agent-field-label"
      valueClassName={draft === null ? undefined : 'profile-value--editor'}
    >
      {draft === null ? (
        <>
          <span className="agent-role-text">{value ?? t('未设置职责')}</span>
          <div className="agent-role-actions">
            {/* r3 §4 实测：职责行带编辑图标（点击进编辑态）。图标-only 钮，
                可访问名走 aria-label；文字钮的可点感靠图标补。 */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="agent-role-edit"
              aria-label={t('编辑')}
              onClick={() => setDraft(value ?? '')}
            >
              <SquarePen width={14} height={14} />
            </Button>
          </div>
        </>
      ) : (
        <>
          <textarea
            id="agent-role-input"
            ref={inputRef}
            className="agent-role-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="agent-role-actions">
            <Button
              variant="brand"
              size="sm"
              className="agent-role-save"
              onClick={() => {
                const next = draft.trim();
                onCommit(next === '' ? null : next);
                setDraft(null);
              }}
            >
              {t('保存')}
            </Button>
          </div>
        </>
      )}
    </ProfileRow>
  );
}
