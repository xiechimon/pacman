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
// #895 三态读标注（spec 21 A8，全读态零控件）：「总管主机」徽标（谁是默认
// 主力机）、「总管回合进行中」（该机正在执行 chief 步）、「总管等待机器」
// （被钉的 pending 回合等该机上线/开闸）。live 数据 = GET /chief 封套
// orchestration 块（defaultMachineId + per 机 activity 计数）join 本页行集；
// fixture = MachineRow chief* 字段静态投影。主力机的设定面在 chief 设置
// （N6），本页只有观测——「关电脑前确认编排已落在常开机器上」的观测面。

import { AGENT_TOOL_SHELL, MACHINE_RUNTIMES, type MachineRuntime } from '@pacman/shared';
import { cn } from 'cn';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApiMutations, useChief, useMachines, useTeams } from '../api/hooks.js';
import { mapMachines } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { ClaudeMark, PiMark } from '../components/brand-marks.js';
import { Button } from '../components/ui/button.js';
import { Switch } from '../components/ui/switch.js';
import { TEAM_NAME } from '../fixtures/fixtures.js';
import type { MachineRow } from '../fixtures/records.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { Monitor, ServerThin } from '../icons/index.js';
import { CreateMachineDialog } from './create-machine-dialog.js';
import {
  GroupCard,
  OnlineDot,
  RowDesc,
  RowGrow,
  RowLine,
  RowText,
  RowTitle,
  StatusPill,
  Tile,
} from './parts.js';
import { ResourceShell } from './shell.js';

export const MACHINES_HREF = '/app/resources/machines';

/** runtime 可读名（专有名词，双语言同形；词表单源 = shared MACHINE_RUNTIMES）。
 *  #887 起不再上屏为文字——挂在 mark 容器上做 aria-label 与 title 悬停提示。 */
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
  // #895 orchestration 读面：live = chief 封套块（无效数据 = 无标注，页面
  // 不等 chief 查询——标注是增量信息，查询未决时行照常渲染）；fixture = 行
  // 字段（chiefHost / chiefRunning / chiefWaiting）静态投影。
  const chiefQ = useChief(teamId, live);
  const orchestration = live ? chiefQ.data?.orchestration : undefined;
  const activityOf = (machineId?: string) =>
    orchestration?.activity.find((a) => a.machineId === machineId);
  const chiefState = (
    machine: MachineRow,
  ): { host: boolean; running: boolean; waiting: boolean } =>
    live
      ? {
          host: orchestration?.defaultMachineId === machine.id,
          running: (activityOf(machine.id)?.running ?? 0) > 0,
          waiting: (activityOf(machine.id)?.waiting ?? 0) > 0,
        }
      : {
          host: machine.chiefHost === true,
          running: machine.chiefRunning === true,
          waiting: machine.chiefWaiting === true,
        };
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
        <p className="mt-0 mb-2 text-xs leading-4 text-(--danger)" role="alert">
          {t('保存失败，请重试。')}
        </p>
      )}
      <GroupCard>
        {machines.map((machine, i) => {
          const chief = chiefState(machine);
          return (
            <RowGrow
              divided={i > 0}
              key={rowKey(machine)}
              data-machine-id={machine.id}
              data-kind={machine.kind ?? 'remote'}
            >
              <Tile Icon={Monitor} size="lg" tone="orange" />
              <RowText className="ml-4">
                <RowLine>
                  <RowTitle>{t(machine.name)}</RowTitle>
                  {/* online 读 machine.online（与 new-task-machine-dot /
                    dlg-machine-dot 同族语义）：在线绿点，离线灰点——离线行
                    此前无任何表示，daemon 死后机器页看不出。undefined（无该
                    字段的旧 fixture）保持不渲染，存量 capture 零漂移。
                    data-on 是状态载体（#910 裁定 3）。 */}
                  {machine.online !== undefined && <OnlineDot on={machine.online !== false} />}
                </RowLine>
                <RowDesc>{t(MACHINE_SHELL_HINT, { tool: t(AGENT_TOOL_SHELL) })}</RowDesc>
              </RowText>
              {machine.kind === 'local' ? (
                <span className="ml-auto flex items-center gap-4">
                  {MACHINE_RUNTIMES.map((runtime) => {
                    const on = (machine.enabledRuntimes ?? []).includes(runtime);
                    const Mark = RUNTIME_MARKS[runtime];
                    return (
                      // #887 图标独形：文字名撤下，可辨识性不跟着删——容器
                      // role="img" + aria-label 给读屏报名字，title 给悬停提示。
                      // mark 仍是装饰（aria-hidden）；on/off 两态由 mark 的
                      // 实色/35% 透明承载（enabledRuntimes 全仓只写不读，#503），
                      // data-enabled 是状态断言载体（原 .mach-runtime--on 修饰类；
                      // 不叫 data-on——那是行内在线点 OnlineDot 的既有载体，
                      // 两者同屏，名字撞了选择器就分不开）。
                      <span
                        className="flex items-center"
                        key={runtime}
                        data-runtime={runtime}
                        data-enabled={on}
                        role="img"
                        aria-label={RUNTIME_LABELS[runtime]}
                        title={RUNTIME_LABELS[runtime]}
                      >
                        <Mark
                          className={cn('block flex-none', on ? 'opacity-100' : 'opacity-35')}
                        />
                      </span>
                    );
                  })}
                </span>
              ) : (
                machine.pill != null && <StatusPill label={machine.pill} />
              )}
              {/* #895 三态读标注（A8）：纯文本/badge 读态——无 handler、无
                button、无 menu（行内活控件纪律仍 = shell 闸恰一个）。
                margin-left:auto 同 StatusPill 律：本地行 runtimes 已吃 auto
                时贴其右，远端行自己撑到行右。状态行行首点只作装饰（aria
                语义在文案），等待灰点与离线灰点同色——「在等谁」与「机器
                在不在线」是两个正交事实，别用颜色再表达一遍。 */}
              {(chief.host || chief.running || chief.waiting) && (
                <span className="ml-auto flex flex-none items-center gap-2">
                  {chief.host && (
                    <span
                      className="inline-flex h-5 items-center rounded-[4px] border border-(--border-default) bg-(--surface-secondary) px-1.5 text-[11px] leading-5 whitespace-nowrap text-(--text-primary)"
                      data-orchestration="host"
                    >
                      {t('总管主机')}
                    </span>
                  )}
                  {chief.running && (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs leading-4 whitespace-nowrap text-(--text-tertiary) before:block before:size-1.5 before:rounded-full before:bg-(--col-dot-done) before:content-['']"
                      data-orchestration="running"
                    >
                      {t('总管回合进行中')}
                    </span>
                  )}
                  {chief.waiting && (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs leading-4 whitespace-nowrap text-(--text-tertiary) before:block before:size-1.5 before:rounded-full before:bg-(--col-dot-idle) before:content-['']"
                      data-orchestration="waiting"
                    >
                      {t('总管等待机器')}
                    </span>
                  )}
                </span>
              )}
              {/* 机器层 shell 闸（XMON-113）：唯一行内控件。label 与副文案同
                词（AGENT_TOOL_SHELL）——两层授权共用一套词汇，用户在 Agent
                权限 tab 看到的是同一个词。与左侧 runtime mark / status pill
                之间留 20px——mark 是展示、开关是控件，贴太近会被读成同一组
                （#503 摘 mark 的歧义正是「这是不是又在开关 runtime」）；
                行内无 mark 无 pill 时（接入机未观测态）自己撑到右缘。 */}
              <span
                className={cn(
                  'flex flex-none items-center gap-2',
                  machine.kind === 'local' || machine.pill != null ? 'ml-5' : 'ml-auto',
                )}
              >
                <span className="text-xs leading-4 whitespace-nowrap text-(--text-tertiary)">
                  {t(AGENT_TOOL_SHELL)}
                </span>
                <Switch
                  data-machine-id={machine.id}
                  aria-label={t(AGENT_TOOL_SHELL)}
                  checked={shellOn(machine)}
                  onCheckedChange={(on) => toggleShell(machine, on)}
                />
              </span>
            </RowGrow>
          );
        })}
      </GroupCard>
      {/* dashed 全宽 添加机器 钮（r7 06）：Button ghost 底座（#851 裸控件
          收编）+ dashed 大钮形态 utility；46px 高是阶梯外一次性尺寸（§3.1a），
          件默认的 hover 底色就地并掉（原形无 hover 态）。 */}
      <Button
        variant="ghost"
        className="mt-4 h-[46px] w-full gap-2 border-dashed border-(--dash-border) text-[13px] leading-4 font-normal text-(--text-tertiary) hover:bg-transparent hover:text-(--text-tertiary) aria-expanded:bg-transparent aria-expanded:text-(--text-tertiary) dark:hover:bg-transparent active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-3.5"
        onClick={() => setAddOpen(true)}
      >
        <ServerThin width={14} height={14} />
        {t('添加机器')}
      </Button>
      <CreateMachineDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        teamName={teamName}
        teamId={teamId}
      />
    </ResourceShell>
  );
}
