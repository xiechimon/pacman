// Team route (issue #70, r7 12): stats bar (`N 个成员` — the r7 capture's
// plan badge / upgrade link are SaaS surface this local-first self-hosted
// app does not carry, #129; the team-light parity baseline diverges here),
// the grid|chart layout tablist and the agent card grid with the dashed
// 创建 Agent slot. Head title is the team-switch dropdown trigger
// (r2 §8.1); the 设置 link sits in the head right slot (r7 12).
import { useSearchParams } from 'react-router';
import { useMembers, useTeams, useTodos } from '../api/hooks.js';
import { mapTeam, toDisplayTodo } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { TEAM_NAME, TEAM_R7 } from '../fixtures/fixtures.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ChartNetwork, ChevronDown, Grid2x2, PlusSmall } from '../icons/index.js';
import { SecondaryShell } from '../secondary/shell.js';

export function TeamPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  // M5 live：成员/Agent 网格 = GET members 真值（r5 §1：Agent 列表实际走
  // members，memberType:"agent" 行内嵌 actor）；团队名 = GET /api/teams。
  const { live, teamId } = useLiveData();
  const membersQ = useMembers(teamId, live);
  const teamsQ = useTeams(live);
  const todosQ = useTodos(teamId, live);
  const team = live && membersQ.data ? mapTeam(membersQ.data) : (fixture.team ?? TEAM_R7);
  const teamName = live ? (teamsQ.data?.[0]?.name ?? TEAM_NAME) : TEAM_NAME;
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
        <button type="button" className="secondary-link">
          {t('设置')}
        </button>
      }
    >
      <div className="team-toprow">
        <div className="team-stats">
          <span className="team-members">{t('{n} 个成员', { n: team.members })}</span>
        </div>
        <div className="team-layout-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected
            className="team-layout-tab team-layout-tab--active"
            aria-label="grid"
          >
            <Grid2x2 />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            className="team-layout-tab"
            aria-label="chart"
          >
            <ChartNetwork />
          </button>
        </div>
      </div>
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
        <button type="button" className="team-create-agent">
          <span className="team-create-icon">
            <PlusSmall />
          </span>
          {t('创建 Agent')}
        </button>
      </div>
    </SecondaryShell>
  );
}
