// 机器 route (spec 11 A8, #357): one grouped card — the local machine row
// (server-host baseline, seeded at startup, pinned first, undeletable) with
// one per-runtime pi / Claude Code brand mark pair, then one row per attached
// LAN/VPS machine — then the dashed full-width 添加机器 button
// (CreateMachineDialog flow unchanged: run the same CLI on the target box).
// A7: no row carries a navigation/menu handler, so no row renders chevron or
// ellipsis affordances. The former `Pacman 托管机器` facade row is gone —
// hosted execution does not exist in the local-first architecture.
// #503: per-runtime 开关摘除，改官方品牌 mark（启用 = 品牌原色，未启用 =
// 35% 透明，read-only）。enabledRuntimes 字段与 PATCH /api/machines/{id}
// 原样保留——控件面以后要接回来再说；行内自此零交互控件。

import { MACHINE_RUNTIMES, type MachineRuntime } from '@pacman/shared';
import { cn } from 'cn';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMachines, useTeams } from '../api/hooks.js';
import { mapMachines } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { ClaudeMark, PiMark } from '../components/brand-marks.js';
import { TEAM_NAME } from '../fixtures/fixtures.js';
import type { MachineRow } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { Monitor, ServerThin } from '../icons/index.js';
import { CreateMachineDialog } from './create-machine-dialog.js';
import { GroupCard, StatusPill, Tile } from './parts.js';
import { ResourceShell } from './shell.js';

export const MACHINES_HREF = '/app/resources/machines';

/** runtime 显示名（专有名词，双语言同形；词表单源 = shared MACHINE_RUNTIMES）。 */
const RUNTIME_LABELS: Record<MachineRuntime, string> = {
  pi: 'pi',
  'claude-code': 'Claude Code',
};

/** runtime → 官方品牌 mark。键集钉 MachineRuntime：词表扩项时此处编译期报错，
 * 不会静默退化成默认 mark。 */
const RUNTIME_MARKS: Record<MachineRuntime, typeof PiMark> = {
  pi: PiMark,
  'claude-code': ClaudeMark,
};

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

  const rowKey = (machine: MachineRow): string => machine.id ?? machine.name;

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
      <GroupCard>
        {machines.map((machine, i) => (
          <div
            className={`res-grow${i > 0 ? ' res-grow--divided' : ''}`}
            key={rowKey(machine)}
            data-machine-id={machine.id}
            data-kind={machine.kind ?? 'remote'}
          >
            <Tile Icon={Monitor} size="lg" tone="orange" />
            <span className="res-row-text">
              <span className="res-row-line">
                <span className="res-row-title">{t(machine.name)}</span>
                {machine.online === true && <span className="res-dot" />}
              </span>
            </span>
            {machine.kind === 'local' ? (
              <span className="mach-runtimes">
                {MACHINE_RUNTIMES.map((runtime) => {
                  const on = (machine.enabledRuntimes ?? []).includes(runtime);
                  const Mark = RUNTIME_MARKS[runtime];
                  return (
                    // mark 是装饰（aria-hidden），可读名走紧邻的 label——状态
                    // 由 mark 的实色/35% 透明两态承载，故不设 aria-label。
                    <span
                      className={cn('mach-runtime', on && 'mach-runtime--on')}
                      key={runtime}
                      data-runtime={runtime}
                    >
                      <Mark className="mach-mark" />
                      <span className="mach-runtime-label">{RUNTIME_LABELS[runtime]}</span>
                    </span>
                  );
                })}
              </span>
            ) : (
              machine.pill != null && <StatusPill label={machine.pill} />
            )}
          </div>
        ))}
      </GroupCard>
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
