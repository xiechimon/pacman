// Team route (issue #70, r7 12): stats bar (`N 个成员` — the r7 capture's
// plan badge / upgrade link are SaaS surface this local-first self-hosted
// app does not carry, #129; the team-light parity baseline diverges here),
// the grid|chart layout tablist and the agent card grid with the dashed
// 创建 Agent slot. Head title is the team-switch dropdown trigger
// (r2 §8.1); the 设置 link sits in the head right slot (r7 12) and routes
// to the account surface — the app's only settings face (#148, 台账 #136
// team 行: 或通或隐, wired rather than hidden so the r7 12 ink survives).
// #148: the tablist is a real toggle persisted to the registered
// client-state key (r2 §1.5 `pacman.teamMembersLayout`); the chart layout
// swaps the content block for the 暂无成员 empty state and drops the stats
// bar + 创建 Agent slot (r2 §8.1 17c). The tablist itself stays in both
// layouts — 17c shows it absent, but a toggle with no way back is a trap
// (divergence noted, 01 册 §8).
import { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useMembers, useTeams, useTodos } from '../api/hooks.js';
import { mapTeam, toDisplayTodo } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { TEAM_NAME, TEAM_R7 } from '../fixtures/fixtures.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ChartNetwork, ChevronDown, Grid2x2, PlusSmall } from '../icons/index.js';
import { SecondaryShell } from '../secondary/shell.js';

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
  // chevron, so dev/parity fixture selection survives the hop
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
  const [layout, setLayout] = useState<TeamLayout>(() => readStoredLayout(localStorage));
  const switchLayout = useCallback((next: TeamLayout) => {
    setLayout(next);
    localStorage.setItem(TEAM_LAYOUT_STORAGE_KEY, next);
  }, []);
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
          {team.agents.map((agent) => (
            <div key={agent.id} className="team-agent-card">
              <span className="team-agent-avatar">
                <img src="/avatar-robot-1.svg" alt="" />
              </span>
              <span className="team-agent-text">
                <span className="team-agent-name">{agent.displayName}</span>
                <span className="team-agent-model">
                  {agent.model}
                  {agent.isDefault ? t(' · 默认') : ''}
                </span>
                <span className="team-agent-role">{agent.role ?? t('未设置职责')}</span>
              </span>
            </div>
          ))}
          {/* TODO(#148 → 弹层族后票, 台账 #136 team 行): the 创建 Agent dialog
              (r2 §8.1 capture 20: 标题 创建 agent / 头像+更换 / 名称 / 服务商
              告警+配置服务商 / 创建) belongs to the dialog family — this
              ticket notes it only, no form. */}
          <button type="button" className="team-create-agent">
            <span className="team-create-icon">
              <PlusSmall />
            </span>
            {t('创建 Agent')}
          </button>
        </div>
      ) : (
        <div className="team-chart-empty">{t('暂无成员')}</div>
      )}
    </SecondaryShell>
  );
}
