// Team route (issue #70, r7 12): stats bar (`N 个成员` + FREE badge +
// 升级 link — A3 keeps the badge shape but no upgrade dialog), the
// grid|chart layout tablist and the agent card grid with the dashed
// 创建 Agent slot. Head title is the team-switch dropdown trigger
// (r2 §8.1); the 设置 link sits in the head right slot (r7 12).
import { useSearchParams } from 'react-router';
import { TEAM_NAME, TEAM_R7 } from '../fixtures/fixtures.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { ChartNetwork, ChevronDown, Grid2x2, PlusSmall } from '../icons/index.js';
import { SecondaryShell } from '../secondary/shell.js';

export function TeamPage() {
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  const team = fixture.team ?? TEAM_R7;
  return (
    <SecondaryShell
      route="team"
      fixture={fixture}
      sidebarSelected="team"
      title={
        <>
          {TEAM_NAME}
          <ChevronDown width={12} height={12} />
        </>
      }
      right={
        <button type="button" className="secondary-link">
          设置
        </button>
      }
    >
      <div className="team-toprow">
        <div className="team-stats">
          <span className="team-members">{team.members} 个成员</span>
          <span className="team-plan">FREE</span>
          <button type="button" className="secondary-link team-upgrade">
            升级 →
          </button>
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
                {agent.isDefault ? ' · 默认' : ''}
              </span>
              <span className="team-agent-role">{agent.role ?? '未设置职责'}</span>
            </span>
          </div>
        ))}
        <button type="button" className="team-create-agent">
          <span className="team-create-icon">
            <PlusSmall />
          </span>
          创建 Agent
        </button>
      </div>
    </SecondaryShell>
  );
}
