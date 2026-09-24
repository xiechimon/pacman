// 机器 route (issue #69, r7 06): one grouped card — the `Pacman 托管机器`
// row (indigo server tile, description line, 未启用 pill) above a divider
// and one row per claimed machine (orange monitor tile, online dot,
// id-tail subline) — then the dashed full-width 添加机器 button.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMachines, useTeams } from '../api/hooks.js';
import { mapMachines } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { TEAM_NAME } from '../fixtures/fixtures.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { Monitor, Server, ServerThin } from '../icons/index.js';
import { CreateMachineDialog } from './create-machine-dialog.js';
import { RowChevron, StatusPill, Tile } from './parts.js';
import { ResourceShell } from './shell.js';

export const MACHINES_HREF = '/app/resources/machines';

export function MachinesPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const fixture = resolveScenario(searchParams);
  // M5 live：GET teams/{id}/machines（machine_presence SSE 联动失效）。
  const { live, teamId } = useLiveData();
  const machinesQ = useMachines(teamId, live);
  const machines = live ? mapMachines(machinesQ.data ?? []) : (fixture.resources?.machines ?? []);
  // wayfinder #181: res-add 钮开 添加机器 dialog（r2 11b CLI 两步表单，
  // #179 裁决）；团队名插值同 team-page 律（live = GET /api/teams，
  // fixture = TEAM_NAME 常量），teamId 内嵌 API key 命令
  const teamsQ = useTeams(live);
  const teamName = live ? (teamsQ.data?.[0]?.name ?? TEAM_NAME) : TEAM_NAME;
  const [addOpen, setAddOpen] = useState(false);

  return (
    // r7 06: the machines topbar carries no `+ 新建` — the dashed 添加机器
    // button is the page's only add action
    <ResourceShell
      title="机器"
      href={MACHINES_HREF}
      backHref="/app"
      selected={MACHINES_HREF}
      hideNew
      fixture={fixture}
    >
      <div className="res-card res-group">
        {machines.map((machine, i) => (
          <div className={`res-grow${i > 0 ? ' res-grow--divided' : ''}`} key={machine.name}>
            <Tile
              Icon={machine.hosted === true ? Server : Monitor}
              size="lg"
              tone={machine.hosted === true ? 'indigo' : 'orange'}
            />
            <span className="res-row-text">
              <span className="res-row-line">
                <span className="res-row-title">{t(machine.name)}</span>
                {machine.online === true && <span className="res-dot" />}
              </span>
              {machine.description != null ? (
                <span className="res-row-desc">{t(machine.description)}</span>
              ) : null}
              {machine.sub != null && <span className="res-row-desc">{machine.sub}</span>}
            </span>
            {machine.pill != null && <StatusPill label={machine.pill} />}
            <RowChevron />
          </div>
        ))}
      </div>
      <button type="button" className="res-add" onClick={() => setAddOpen(true)}>
        <ServerThin width={14} height={14} />
        {t('添加机器')}
      </button>
      <CreateMachineDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        teamName={teamName}
        teamId={teamId}
      />
    </ResourceShell>
  );
}
