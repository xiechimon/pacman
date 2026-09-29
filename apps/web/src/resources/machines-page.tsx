// 机器 route (spec 11 A8, #357): one grouped card — the local machine row
// (server-host baseline, seeded at startup, pinned first, undeletable) with
// per-runtime pi / Claude Code switches writing enabledRuntimes, then one row
// per attached LAN/VPS machine — then the dashed full-width 添加机器 button
// (CreateMachineDialog flow unchanged: run the same CLI on the target box).
// A7: no row carries a navigation/menu handler, so no row renders chevron or
// ellipsis affordances. The former `Pacman 托管机器` facade row is gone —
// hosted execution does not exist in the local-first architecture.
// #222 出账注记的「无机器管理面」前提已被本票翻转：switch 是真控件
// (PATCH /api/machines/{id})，非死钮；行内仍无其它动作钮。

import { MACHINE_RUNTIMES } from '@pacman/shared';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApiMutations, useMachines, useTeams } from '../api/hooks.js';
import { mapMachines } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { TEAM_NAME } from '../fixtures/fixtures.js';
import type { MachineRow } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { Monitor, ServerThin } from '../icons/index.js';
import { CreateMachineDialog } from './create-machine-dialog.js';
import { StatusPill, Tile } from './parts.js';
import { ResourceShell } from './shell.js';

export const MACHINES_HREF = '/app/resources/machines';

/** runtime 显示名（专有名词，双语言同形；词表单源 = shared MACHINE_RUNTIMES）。 */
const RUNTIME_LABELS: Record<string, string> = {
  pi: 'pi',
  'claude-code': 'Claude Code',
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
  const mutations = useApiMutations(teamId);
  // fixture 面开关本地态（无 live 时 canon 展示；点按仅页内翻转不落库）。
  const [fixtureRuntimes, setFixtureRuntimes] = useState<Record<string, string[]>>({});
  // live 面 pending 意图层：开关显示 = 用户最近一次点按的目标态，直到查询
  // 缓存追上才摘除（下方 effect）。连续点按两个 switch 时，前一 mutation
  // onSuccess invalidate 触发的 refetch 可能带着旧态落回缓存——若直接读
  // 缓存，后一个 switch 会闪回；pending 层对任意 refetch 竞态免疫。
  const [pendingRuntimes, setPendingRuntimes] = useState<Record<string, string[]>>({});

  const rowKey = (machine: MachineRow): string => machine.id ?? machine.name;
  const enabledOf = (machine: MachineRow): string[] =>
    pendingRuntimes[rowKey(machine)] ??
    (live
      ? (machine.enabledRuntimes ?? [])
      : (fixtureRuntimes[rowKey(machine)] ?? machine.enabledRuntimes ?? []));

  // 缓存追上 pending 意图（成员集相等）即摘除该键；未追上 = 继续以意图为
  // 显示真值。失败回滚走 mutation onError 清 pending + invalidateAll 收敛。
  useEffect(() => {
    setPendingRuntimes((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [key, intent] of Object.entries(next)) {
        const cached = machines.find((m) => rowKey(m) === key)?.enabledRuntimes;
        if (
          cached != null &&
          cached.length === intent.length &&
          intent.every((r) => cached.includes(r))
        ) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [machines]);

  const toggleRuntime = (machine: MachineRow, runtime: string): void => {
    const current = enabledOf(machine);
    const next = current.includes(runtime)
      ? current.filter((r) => r !== runtime)
      : [...current, runtime];
    const key = rowKey(machine);
    if (live && machine.id != null) {
      // 意图同步落 pending（点击即翻 aria-checked，不等网络）。
      setPendingRuntimes((prev) => ({ ...prev, [key]: next }));
      mutations.patchMachineRuntimes.mutate(
        { id: machine.id, enabledRuntimes: next },
        {
          onError: () =>
            setPendingRuntimes((prev) => {
              const rolled = { ...prev };
              delete rolled[key];
              return rolled;
            }),
        },
      );
    } else {
      setFixtureRuntimes((prev) => ({ ...prev, [key]: next }));
    }
  };

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
              {machine.sub != null && <span className="res-row-desc">{machine.sub}</span>}
            </span>
            {machine.kind === 'local' ? (
              <span className="mach-runtimes">
                {MACHINE_RUNTIMES.map((runtime) => {
                  const on = enabledOf(machine).includes(runtime);
                  return (
                    <span className="mach-runtime" key={runtime}>
                      <span className="mach-runtime-label">{RUNTIME_LABELS[runtime]}</span>
                      {/* span 元素 = rerun-switch 先例（#318）：role=switch +
                          tabIndex 0，Enter/Space 同律；非 button = 行内钮面
                          零增（dead-buttons §7 钉）。 */}
                      <span
                        className={`mach-switch${on ? ' mach-switch--on' : ''}`}
                        role="switch"
                        data-runtime={runtime}
                        aria-checked={on}
                        aria-label={RUNTIME_LABELS[runtime]}
                        tabIndex={0}
                        onClick={() => toggleRuntime(machine, runtime)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleRuntime(machine, runtime);
                          }
                        }}
                      >
                        <span className="mach-switch-knob" />
                      </span>
                    </span>
                  );
                })}
              </span>
            ) : (
              machine.pill != null && <StatusPill label={machine.pill} />
            )}
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
