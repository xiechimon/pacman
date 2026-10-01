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
// 原样保留——那是死控件（PR #507：「该字段全仓只写不读」），摘除是对的。
// XMON-113：行内接回**唯一一个活控件**——机器层 shell 闸
// （machine.shellEnabled，消费方 = claim 组装 localTools 双闸 + 每命令预检，
// XMON-108 R1）。行内控件面自此 = 这一个开关，死钮纪律（删除 / chevron /
// per-runtime 开关）原样由 e2e 负向把守。

import { AGENT_TOOL_SHELL, MACHINE_RUNTIMES, type MachineRuntime } from '@pacman/shared';
import { cn } from 'cn';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApiMutations, useMachines, useTeams } from '../api/hooks.js';
import { mapMachines } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { ClaudeMark, PiMark } from '../components/brand-marks.js';
import { Switch } from '../components/ui/switch.js';
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

/** 机器行开关副文案（行内第二行）——机器侧的那半边语义：Agent 权限 tab 的
 * 同名开关说的是「在哪台机器上能用」，这里说的是「这台机器让不让用」，两者
 * 齐开预检才放行（XMON-108 R1 双闸）。工具名经 {tool} 插值走 shared
 * AGENT_TOOL_SHELL 单源——两层开关共用同一个词，词变了不会只改一处。 */
const MACHINE_SHELL_HINT = '已授权「{tool}」的 Agent 可在该机器上执行命令。';

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

  const rowKey = (machine: MachineRow): string => machine.id ?? machine.name;

  // shell 开关态：live 面由记录驱动（mutation 的乐观写落在 ['machines'] 缓存
  // 上），fixture 面（scenario 数据源，无 API）落本地草稿——两态同形，fixture
  // 面的开关因此也是活的，不是演示死钮。
  const [shellDraft, setShellDraft] = useState<Record<string, boolean>>({});
  const shellOn = (machine: MachineRow): boolean =>
    shellDraft[rowKey(machine)] ?? machine.shellEnabled ?? false;
  const toggleShell = (machine: MachineRow, on: boolean): void => {
    if (!live || machine.id == null) {
      setShellDraft((prev) => ({ ...prev, [rowKey(machine)]: on }));
      return;
    }
    mutations.patchMachine.mutate({ id: machine.id, body: { shellEnabled: on } });
  };
  // 保存失败的显式反馈（XMON-80/P2 同律）：本面无 toast，失败只可能来自
  // shell 开关这条写（页面唯一 mutation），文案是固定句、不透传 server 原文。
  const shellSaveFailed =
    mutations.patchMachine.isError &&
    mutations.patchMachine.variables?.body.shellEnabled !== undefined;

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
      {shellSaveFailed && (
        <p className="mach-error" role="alert">
          {t('保存失败，请重试。')}
        </p>
      )}
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
              <span className="res-row-desc">
                {t(MACHINE_SHELL_HINT, { tool: t(AGENT_TOOL_SHELL) })}
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
            {/* 机器层 shell 闸（XMON-113）：唯一行内控件。label 与副文案同
                词（AGENT_TOOL_SHELL）——两层授权共用一套词汇，用户在 Agent
                权限 tab 看到的是同一个词。 */}
            <span className="mach-shell">
              <span className="mach-shell-label">{t(AGENT_TOOL_SHELL)}</span>
              <Switch
                className="mach-shell-switch"
                data-machine-id={machine.id}
                aria-label={t(AGENT_TOOL_SHELL)}
                checked={shellOn(machine)}
                onCheckedChange={(on) => toggleShell(machine, on)}
              />
            </span>
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
