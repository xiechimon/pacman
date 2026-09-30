// Team route (issue #70, r7 12): stats bar (`N 个成员` — the r7 capture's
// plan badge / upgrade link are SaaS surface this local-first self-hosted
// app does not carry, #129; the team-light visual baseline diverges here),
// the grid|chart layout tablist and the agent card grid with the dashed
// 创建 Agent slot. Head title is the team-switch dropdown trigger
// (r2 §8.1); the 设置 link sits in the head right slot (r7 12) and routes
// to the account surface — the app's only settings face (#148, 台账 #136
// team 行: 或通或隐, wired rather than hidden so the r7 12 ink survives).
// #148: the tablist is a real toggle persisted to the registered
// client-state key (r2 §1.5 `pacman.teamMembersLayout`); chart drops the
// stats bar (r2 §8.1 17c) and renders the org chart (#490). The tablist
// itself stays in both layouts — 17c shows it absent, but a toggle with no
// way back is a trap (divergence noted, 01 册 §8).
//
// #490: chart 此前是把 17c 捕获到的空态当成了唯一状态 —— 那份捕获的团队是
// 0 个成员，于是 chart 分支写死 暂无成员 字面量，同一份数据下与 grid 自相
// 矛盾。现在按成员数分流：0 个成员才走空态，否则由 ./team-chart.tsx 出树。
import { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router';
import {
  useApiMutations,
  useChief,
  useMembers,
  useModelSources,
  useProviders,
  useTeams,
  useTodos,
} from '../api/hooks.js';
import { mapTeam, toChiefModelOptions, toDisplayTodo } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { TEAM_NAME, TEAM_R7 } from '../fixtures/fixtures.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ChartNetwork, ChevronDown, Grid2x2, PlusSmall } from '../icons/index.js';
import { SecondaryShell } from '../secondary/shell.js';
import { Avatar } from '../ui/avatar.js';
import { AGENTS_HREF } from './agent-detail-page.js';
import { CreateAgentDialog } from './create-agent-dialog.js';
import { TeamChart } from './team-chart.js';

/** r2 §1.5 registered client-state key (packages/shared protocol/
 *  client-state.ts): the team view switch, grid | chart; absent = grid. */
export const TEAM_LAYOUT_STORAGE_KEY = 'pacman.teamMembersLayout';

type TeamLayout = 'grid' | 'chart';

function readStoredLayout(storage: Storage): TeamLayout {
  return storage.getItem(TEAM_LAYOUT_STORAGE_KEY) === 'chart' ? 'chart' : 'grid';
}

export function TeamPage() {
  const { t } = useI18n();
  // the 设置 link carries the scenario string along like the shell's back
  // chevron, so dev/fixture selection survives the hop
  const { search } = useLocation();
  const fixture = resolveScenario(new URLSearchParams(search));
  // M5 live：成员/Agent 网格 = GET members 真值（r5 §1：Agent 列表实际走
  // members，memberType:"agent" 行内嵌 actor）；团队名 = GET /api/teams。
  const { live, teamId } = useLiveData();
  const membersQ = useMembers(teamId, live);
  const teamsQ = useTeams(live);
  const todosQ = useTodos(teamId, live);
  const team = live && membersQ.data ? mapTeam(membersQ.data) : (fixture.team ?? TEAM_R7);
  const teamName = live ? (teamsQ.data?.[0]?.name ?? TEAM_NAME) : TEAM_NAME;
  // #490: 组织图的根 = 总管绑定的 agent。live 直读 GET chief 的
  // chief.agent.agentId；fixture 走场景里的 chief.agent.id；未绑定 → null，
  // 此时 TeamChart 退到首个成员当根。
  const chiefQ = useChief(teamId, live);
  const chiefAgentId = live
    ? (chiefQ.data?.chief.agent?.agentId ?? null)
    : (fixture.chief?.agent?.id ?? null);
  const [layout, setLayout] = useState<TeamLayout>(() => readStoredLayout(localStorage));
  const switchLayout = useCallback((next: TeamLayout) => {
    setLayout(next);
    localStorage.setItem(TEAM_LAYOUT_STORAGE_KEY, next);
  }, []);
  // #170: the 创建 Agent slot opens the dialog-family form; live submit =
  // POST agents then close (invalidateAll refetches members → the new
  // agent card lands in the grid), fixture = accept-dialog 律 (close only)
  const mutations = useApiMutations(teamId);
  const [createOpen, setCreateOpen] = useState(false);
  // #485: 创建弹窗的模型候选——数据源与投影同 Agent 详情页概览（同一份
  // toChiefModelOptions）。清单非空 = 弹窗出模型选择器；空 = 落「配置服务商」
  // 告警行（原版 capture 20 态）。
  const providersQ = useProviders(teamId, live);
  const modelSourcesQ = useModelSources(teamId, live);
  const modelOptions = live
    ? toChiefModelOptions(providersQ.data?.providers ?? [], modelSourcesQ.data?.sources ?? [])
    : toChiefModelOptions(
        fixture.resources?.providers ?? [],
        fixture.resources?.providerSources ?? [],
      );
  return (
    <SecondaryShell
      route="team"
      fixture={live ? { ...fixture, todos: (todosQ.data ?? []).map(toDisplayTodo) } : fixture}
      sidebarSelected="team"
      title={
        <>
          {teamName}
          <ChevronDown width={12} height={12} />
        </>
      }
      right={
        <Link className="secondary-link" to={{ pathname: '/app/account', search }}>
          {t('设置')}
        </Link>
      }
    >
      <div className={`team-toprow${layout === 'chart' ? ' team-toprow--chart' : ''}`}>
        {layout === 'grid' && (
          <div className="team-stats">
            <span className="team-members">{t('{n} 个成员', { n: team.members })}</span>
          </div>
        )}
        <div className="team-layout-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={layout === 'grid'}
            className={`team-layout-tab${layout === 'grid' ? ' team-layout-tab--active' : ''}`}
            aria-label="grid"
            onClick={() => switchLayout('grid')}
          >
            <Grid2x2 />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={layout === 'chart'}
            className={`team-layout-tab${layout === 'chart' ? ' team-layout-tab--active' : ''}`}
            aria-label="chart"
            onClick={() => switchLayout('chart')}
          >
            <ChartNetwork />
          </button>
        </div>
      </div>
      {layout === 'grid' ? (
        <div className="team-grid">
          {/* #485: 卡是进 Agent 详情编辑面的入口（r3 §4「团队页点 Agent 卡
              进入」）。卡片由 div 改 Link —— 推翻 a3 审计把它归类为「卡表面
              非控件」（report-pages.md:88）的裁决：原版点得进，本仓此前点不
              进，Agent 建出来就再也够不着编辑面。link 反馈态见 secondary.css
              的 .team-agent-card:hover。scenario 随行（#121 Link 律）。 */}
          {team.agents.map((agent) => (
            <Link
              key={agent.id}
              className="team-agent-card"
              to={{ pathname: `${AGENTS_HREF}/${agent.id}`, search }}
            >
              <span className="team-agent-avatar">
                <Avatar
                  name={agent.displayName}
                  src={agent.avatarUrl}
                  fallback="/avatar-robot-1.svg"
                />
              </span>
              <span className="team-agent-text">
                <span className="team-agent-name">{agent.displayName}</span>
                <span className="team-agent-model">
                  {agent.model}
                  {agent.isDefault ? t(' · 默认') : ''}
                </span>
                <span className="team-agent-role">{agent.role ?? t('未设置职责')}</span>
              </span>
            </Link>
          ))}
          {/* #170: the dialog family form (r2 §8.1 capture 20) lives in
              create-agent-dialog.tsx — DialogShell law, POST agents on live. */}
          <button type="button" className="team-create-agent" onClick={() => setCreateOpen(true)}>
            <span className="team-create-icon">
              <PlusSmall />
            </span>
            {t('创建 Agent')}
          </button>
        </div>
      ) : (
        <TeamChart
          agents={team.agents}
          chiefAgentId={chiefAgentId}
          onCreate={() => setCreateOpen(true)}
        />
      )}
      <CreateAgentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        modelOptions={modelOptions}
        onCreate={
          live
            ? (input) =>
                mutations.createAgent.mutate(input, { onSuccess: () => setCreateOpen(false) })
            : undefined
        }
      />
    </SecondaryShell>
  );
}
