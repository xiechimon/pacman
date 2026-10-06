// 分支与 PR dialog (issue #68, r7 31): 448×409 centered, header carries the
// centered 同步到机器|Git segmented control instead of a title (no divider).
// Sync tab as captured: build-branch/target-commit box with copy buttons,
// 目标机器 pill (green dot + name + chevron), 同步目录 read-only path field,
// 强制同步 label + two-line description + off toggle, and the full-width
// 同步 button. M7 #319（08 册附录 B）= 接真：机器选择走 useMachines 真值
// （GET /api/teams/{id}/machines），目录可编辑（r1 changelog 09-13 文本），
// 同步钮 POST /api/builds/{id}/branch-sync + 订阅 team stream `branch_sync`
// 事件渲染结果卡（pending/running/synced/failed 四态）。Git tab 仍是 [推断]
// minimal PR surface，复用同 box。
// #366：详情路由不再弹此 dialog（右 pane 静止 section 承接，字段件
// BranchBox/BranchSyncFields/SyncButton 由 right-pane.tsx 共用）；本 dialog
// 的存活入口 = 看板卡片分支图标。

import type { BranchSyncRecord, BranchSyncStatus, MachineRecord } from '@pacman/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import { useState } from 'react';
import { api } from '../api/client.js';
import { useBuild, useMachines } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { Input } from '../components/ui/input.js';
import { Switch } from '../components/ui/switch.js';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import { toastError } from '../components/ui/toaster.js';
import type { BranchInfoContent } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown, Copy } from '../icons/index.js';

/** #945（正典表 §5.4，单源同 #944 的 RES_* 律）：.dlg-form-label 别名
 *  退役——字段标签律 = r7 31 节奏（box→label 9、label→control 8、18px
 *  行盒）+ c.css 定版 --label-size/--label-spacing token。branch-dialog
 *  与 right-pane 两消费面共用。 */
export const FIELD_LABEL =
  'mt-[9px] mb-2 text-(length:--label-size) leading-[18px] tracking-(--label-spacing) text-(--text-primary)';

/** #951（detail/overlays.css 清零）：只读目录/PR 槽 box 律（原 .dlg-dir，
 *  r7 31 实测 32 高 / 16 横垫 / card-border 描边 / surface 底 / mono 12
 *  tertiary 墨；line-height 32 垂直居中）。div / anchor / live Input 三形
 *  共用；branch-dialog 与 right-pane 两消费面。 */
export const DIR_BOX =
  'h-8 rounded-none border border-(--card-border) bg-(--surface) px-4 font-mono text-xs leading-8 text-(--text-tertiary) dark:bg-(--surface)';

/** #951：机器 pill 律（原 .dlg-machine，r7 31 实测 30 高 / 11+14 横垫 /
 *  8 gap / card-border 描边方角 / surface 漆底 / 13px primary 墨）。漆底
 *  恒压 hover 与 aria-expanded 档（ghost 七通道中和，#908 裁决 3）；chevron
 *  走 tertiary（原 .dlg-machine svg 律）。fixture 占位与 live picker 共用。 */
export const MACHINE_PILL =
  'h-[30px] cursor-pointer gap-2 rounded-none border border-(--card-border) bg-(--surface) pl-[11px] pr-[14px] text-[13px] leading-[calc(20/14)] font-normal text-(--text-primary) hover:bg-(--surface) hover:text-(--text-primary) dark:hover:bg-(--surface) dark:hover:text-(--text-primary) aria-expanded:bg-(--surface) aria-expanded:text-(--text-primary) [&_svg]:text-(--text-tertiary) [&_svg:not([class*=size-])]:size-auto';

/** #951：机器状态点（原 .dlg-machine-dot，6px 圆 / done 绿）。data-on 是
 *  在线态行为载体（无 CSS 消费，读面语义保留）。 */
export const MACHINE_DOT = 'size-1.5 flex-none rounded-full bg-(--badge-done)';

interface BranchDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  info: BranchInfoContent;
  /**
   * M7 #319：分支对话框接真的 bridge。`buildId` 走 POST/GET 路径段。
   *
   * `buildId` **必须由调用方传**：live 数据层只暴露 { live, teamId }，派生不出
   * 当前 todo 的 build。调用点（board-page）持 `overlayTodo.latestBuildId`
   * 传入；漏传 = buildId 恒 null = canSync 恒 false = 同步面永远停在 r7
   * 占位 UI（同步钮不可点）。
   */
  buildId?: string | null;
  onClose: () => void;
}

function CopyButton({ value }: { value: string }) {
  const { t } = useI18n();
  const copy = () => {
    void navigator.clipboard?.writeText(value).catch(() => {
      // clipboard unavailable (headless/permissions) — copy is best-effort
    });
  };
  return (
    // XMON-24：icon 钮切 shadcn ghost/icon 档——老 ui/Button icon 变体皮肤
    // （透明底 tertiary 墨、hover 增亮 secondary、零内边距）逐值搬
    // utilities。#951：24×24 per-face 几何（原 .dlg-copy）随 overlays.css
    // 清零并入 size-6 flex-none（size-8 底座差额，等值）。Copy 属性 14px，
    // svg 免底座强制 16px。
    <Button
      variant="ghost"
      size="icon"
      className="size-6 flex-none text-(--text-tertiary) hover:bg-transparent dark:hover:bg-transparent hover:text-(--text-secondary) cursor-pointer active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
      aria-label={t('复制')}
      onClick={copy}
    >
      <Copy width={14} height={14} />
    </Button>
  );
}

/** 构建分支/目标提交 box（r7 31）——dialog 与详情右 pane 的 分支与 PR
 *  section（#366）共用。 */
export function BranchBox({ info }: { info: BranchInfoContent }) {
  const { t } = useI18n();
  // #951（overlays.css 清零）：box/行/标签/值四律等值迁 utility——box =
  // card-border 描边方角 + dialog-box-bg 底；行 42 高 / 15+12 横垫，第二行
  // 顶部缝线（原 `row + row` 兄弟选择器的静态等价形）；标签 76 定宽
  // tertiary；值 mono 12 primary 省略号。
  const row = 'flex h-[42px] items-center pr-3 pl-[15px]';
  const label = 'w-[76px] flex-none text-[length:12px] text-(--text-tertiary)';
  const value = 'min-w-0 flex-1 truncate font-mono text-[length:12px] text-(--text-primary)';
  return (
    <div className="rounded-none border border-(--card-border) bg-(--dialog-box-bg)">
      <div className={row}>
        <span className={label}>{t('构建分支')}</span>
        <span className={value}>{info.branch}</span>
        <CopyButton value={info.branch} />
      </div>
      <div className={`${row} border-t border-t-(--card-border)`}>
        <span className={label}>{t('目标提交')}</span>
        <span className={value}>{info.commit}</span>
        <CopyButton value={info.commit} />
      </div>
    </div>
  );
}

/** Sync-tab field stack（受控件）：box + 目标机器 + 同步目录 + 强制同步 +
 *  结果卡。dialog（footer 钉同步钮）与右 pane section（inline 同步钮）
 *  各自持 state 后走同一份字段渲染（#366 抽取，M7 #319 接真行为不变）。 */
export function BranchSyncFields({
  info,
  canSync,
  machines,
  selectedMachineId,
  onMachineId,
  directory,
  onDirectory,
  force,
  onForce,
  buildId,
}: {
  info: BranchInfoContent;
  canSync: boolean;
  machines: MachineRecord[];
  selectedMachineId: string | null;
  onMachineId: (id: string) => void;
  directory: string;
  onDirectory: (directory: string) => void;
  force: boolean;
  onForce: (force: boolean) => void;
  buildId: string | null;
}) {
  const { t } = useI18n();
  return (
    <>
      <BranchBox info={info} />
      <div className={FIELD_LABEL}>{t('目标机器')}</div>
      {canSync ? (
        <MachinePicker
          machines={machines}
          selected={selectedMachineId}
          onSelect={onMachineId}
          t={t}
        />
      ) : (
        // fixture / fixture 路径占位（r7 31 原始捕获面）
        // XMON-24：切 shadcn ghost；#951：.dlg-machine per-face 律等值迁
        // MACHINE_PILL utility。恒 disabled 且老面无禁用降档 → opacity/
        // pointer-events 双双中性化。ChevronDown 属性 12px，svg 免底座 16px。
        <Button
          variant="ghost"
          className={cn(MACHINE_PILL, 'disabled:opacity-100 disabled:pointer-events-auto')}
          disabled
        >
          <span className={MACHINE_DOT} />
          <span>{info.machine}</span>
          <ChevronDown width={12} height={12} />
        </Button>
      )}
      <div className={FIELD_LABEL}>{t('同步目录')}</div>
      {canSync ? (
        // XMON-24：目录输入切 registry Input；#951：.dlg-dir per-face 律
        // （h32/padding/border/mono12）等值迁 DIR_BOX utility（原 unlayered
        // 恒压底座，迁移后同层冲突类并掉 base 的 px/py/border-input/dark 底）。
        // 老面是 UA 裸 input：固有宽度（w-auto 还原）、focus 时 UA outline 环
        // （outline:auto 复刻，底座的 ring/border 变色清零——border 恒 card-border，
        // 原 unlayered 律下 focus 也不变色，focus-visible:border-(--card-border)
        // 是其等值形）。aria-label = e2e/读屏一级载体（m7 集成钉，#910 裁定 1）。
        <Input
          type="text"
          aria-label={t('同步目录')}
          className={cn(
            DIR_BOX,
            'w-auto py-0 focus-visible:border-(--card-border) focus-visible:ring-0 focus-visible:[outline:auto]',
          )}
          value={directory}
          onChange={(event) => onDirectory(event.target.value)}
          spellCheck={false}
        />
      ) : (
        <div className={DIR_BOX}>{info.directory}</div>
      )}
      <div className="mt-[10px] flex items-start gap-3">
        <div className="flex-1">
          {/* 老层叠里 overlays.css 的 .dlg-force-text .dlg-form-label 把本
              label 的 margin 归零——m-0 是其终值等价形，cn/twMerge 摘掉
              FIELD_LABEL 的 mt/mb。 */}
          <div className={cn(FIELD_LABEL, 'm-0')}>{t('强制同步')}</div>
          <div className="text-xs leading-[18px] text-(--text-tertiary)">
            {t('丢弃代码修改并删除非忽略的未跟踪文件；保留忽略内容。仅本次生效。')}
          </div>
        </div>
        {/* #951（票面注 + spec/22 §1.6/§4-2）：手搓 28×16 拨杆（原生 checkbox
            + opacity:0 覆盖层，#855 deliberate-native）→ components/ui Switch
            正典默认档（§2.5 冻结几何 32×18.4，D2 授权增长；role=switch +
            aria-checked 底座透出）。--toggle-track/--toggle-knob 两槽就此
            孤儿化（槽删除归 #915/散件票，token 值本票不动）。mt-4 = 老
            margin-top:17px 的光学等值：track 中心对齐 desc 首行（老 25px，
            新 16+9.2=25.2px）。 */}
        <Switch
          className="mt-4 flex-none cursor-pointer"
          aria-label={t('强制同步')}
          checked={force}
          onCheckedChange={onForce}
        />
      </div>
      {canSync && buildId !== null ? <ResultCard buildId={buildId} t={t} /> : null}
    </>
  );
}

/** 机器默认选派生：info.machine 同名命中优先，否则首台机器，否则 null。 */
export function defaultMachineId(
  machines: MachineRecord[],
  override: string | null,
  infoMachine: string,
): string | null {
  return override ?? machines.find((m) => m.name === infoMachine)?.id ?? machines[0]?.id ?? null;
}

/** 分支同步面共享状态（#366 抽取）：机器/目录/强制三件 + 默认选派生 +
 *  canSync。dialog（machines 查询随 open 门控）与右 pane section（挂载即
 * 查）走同一状态形，避免两处漂移。 */
export function useBranchSyncState(
  info: BranchInfoContent,
  buildId: string | null,
  machinesEnabled = true,
) {
  const { live, teamId } = useLiveData();
  const machinesQ = useMachines(teamId, live && machinesEnabled);
  const [force, setForce] = useState(false);
  const [machineId, setMachineId] = useState<string | null>(null);
  const [directory, setDirectory] = useState(info.directory);
  const machines: MachineRecord[] = machinesQ.data ?? [];
  return {
    live,
    machines,
    selectedMachineId: defaultMachineId(machines, machineId, info.machine),
    onMachineId: setMachineId,
    directory,
    onDirectory: setDirectory,
    force,
    onForce: setForce,
    canSync: buildId !== null && live,
  };
}

export function BranchDialog({ info, buildId: buildIdProp, open, onClose }: BranchDialogProps) {
  const { t } = useI18n();
  const buildId = buildIdProp ?? null;
  const [tab, setTab] = useState<'sync' | 'git'>('sync');
  const sync = useBranchSyncState(info, buildId, open === true);
  // #704 / B-C16：PR 槽真值 = build 行回填的 prUrl/prNumber（daemon 步收尾
  // 只读探测上报）。buildId 缺席（fixture 面/live 无 build）或探测失败（null）
  // = 保持「未创建」诚实态——面板分支名在、PR 槽留空，不造数据。
  const buildQ = useBuild(buildId, buildId != null);
  const pr = buildQ.data?.prUrl ?? null;
  const prNumber = buildQ.data?.prNumber ?? null;

  return (
    <DialogShell
      headerCenter={
        // #945（正典表 §5.4）：.dlg-form-seg/.dlg-seg-tab 退役 → Tabs 件
        // default 档（registry 几何 rounded-lg bg-muted p-[3px] h-8 与旧
        // 30px/3px/8px 族近同形，差值 D2 吸收）；inline 形态不加 w-full
        // （block 形态是 provider seg 专属）。选中态载体 = role=tab +
        // aria-selected + data-active（Base UI 自带）；#138 家族 hover tint
        // 走消费端 utility（--seg-hover，未选中档专属——老 :not([data-
        // active=true]):hover 律的组件侧等价形）。
        <Tabs value={tab} onValueChange={(value) => setTab(value as 'sync' | 'git')}>
          <TabsList aria-label={t('分支与 PR')}>
            <TabsTrigger
              value="sync"
              className={
                tab === 'sync' ? undefined : 'hover:bg-(--seg-hover) dark:hover:bg-(--seg-hover)'
              }
            >
              {t('同步到机器')}
            </TabsTrigger>
            <TabsTrigger
              value="git"
              className={
                tab === 'git' ? undefined : 'hover:bg-(--seg-hover) dark:hover:bg-(--seg-hover)'
              }
            >
              Git
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
      open={open}
      onClose={onClose}
      footer={
        // #193: the sync tab's 同步 button rides the pinned shell footer;
        // the git tab carries no action and no footer.
        tab === 'sync' ? (
          // #945（正典表 §5.4）：.dlg-form-foot 别名退役，容器律走 utility。
          <div className="flex flex-col px-4 pb-4">
            <SyncButton
              buildId={buildId}
              canSync={sync.canSync}
              machineId={sync.selectedMachineId}
              directory={sync.directory}
              refName={info.branch}
              commit={info.commit}
              force={sync.force}
              disabled={sync.selectedMachineId === null || sync.directory.trim() === ''}
            />
          </div>
        ) : undefined
      }
    >
      {tab === 'sync' ? (
        // #951：.dlg-branch-body(--foot) 律等值迁 utility——16 垫；#193 sync
        // tab 底垫 10（钉底同步钮接管原 margin-top）。
        <div className="px-4 pt-4 pb-[10px]">
          <BranchSyncFields
            info={info}
            canSync={sync.canSync}
            machines={sync.machines}
            selectedMachineId={sync.selectedMachineId}
            onMachineId={sync.onMachineId}
            directory={sync.directory}
            onDirectory={sync.onDirectory}
            force={sync.force}
            onForce={sync.onForce}
            buildId={buildId}
          />
        </div>
      ) : (
        <div className="p-4">
          <BranchBox info={info} />
          <div className={FIELD_LABEL}>Pull Request</div>
          {pr !== null && prNumber != null ? (
            // #704 PR 槽回填态：同 box 形，链接色 + 下划线（原 .dlg-pr-link）。
            <a
              className={cn(DIR_BOX, 'block text-(--accent) underline')}
              href={pr}
              target="_blank"
              rel="noopener noreferrer"
            >
              #{prNumber}
            </a>
          ) : (
            <div className={DIR_BOX}>{t('未创建')}</div>
          )}
        </div>
      )}
    </DialogShell>
  );
}

function MachinePicker({
  machines,
  selected,
  onSelect,
  t,
}: {
  machines: MachineRecord[];
  selected: string | null;
  onSelect: (id: string) => void;
  t: (k: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const cur = machines.find((m) => m.id === selected);
  const list = machines.filter((m) => m.online);
  // #951：picker/menu/empty/opt 类名钩退役（零规则死类；e2e 载体换
  // role+可及名与 role=listbox，m7 集成钉同 PR 重钉）。
  return (
    <div>
      {/* XMON-24：机器 pill 切 shadcn ghost；#951：皮肤律等值迁 MACHINE_PILL
          utility（漆底压 hover/aria-expanded 底）；aria-haspopup 命中底座
          active 位移豁免，无需中性化。ChevronDown 12px 免底座 16px。 */}
      <Button
        variant="ghost"
        className={MACHINE_PILL}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={MACHINE_DOT} data-on={cur?.online ?? false} />
        <span>{cur?.name ?? t('选择机器')}</span>
        <ChevronDown width={12} height={12} />
      </Button>
      {open ? (
        <div role="listbox">
          {list.length === 0 ? (
            <div>{t('暂无在线机器')}</div>
          ) : (
            list.map((m) => (
              <div key={m.id}>
                {/* XMON-24：菜单项切 shadcn ghost。老面是 preflight 裸
                    button（透明底/零内边距/inline 排版），全仓无
                    .dlg-machine-opt CSS——utilities 逐项还原：几何清零、
                    hover 底/字色双中性（含 dark 默认档）、gap-1 近似老
                    inline 空白间距（≈3.5px，PR body 声明近似）。 */}
                <Button
                  variant="ghost"
                  className="h-auto rounded-none gap-1 p-0 text-[length:inherit] leading-[inherit] font-normal hover:bg-transparent dark:hover:bg-transparent hover:text-inherit active:not-aria-[haspopup]:translate-y-0"
                  data-active={m.id === selected}
                  onClick={() => {
                    onSelect(m.id);
                    setOpen(false);
                  }}
                >
                  <span className={MACHINE_DOT} data-on={m.online} />
                  <span>{m.name}</span>
                </Button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/** 同步钮（POST branch-sync）——dialog footer 与右 pane section（#366）
 *  共用；disabled 律由调用方派生（机器/目录齐备才可点）。 */
export function SyncButton({
  buildId,
  canSync,
  machineId,
  directory,
  refName,
  commit,
  force,
  disabled,
}: {
  buildId: string | null;
  canSync: boolean;
  machineId: string | null;
  directory: string;
  refName: string;
  commit: string;
  force: boolean;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (input: {
      machineId: string;
      directory: string;
      ref: string;
      commit: string;
      force: boolean;
    }) =>
      api.post<BranchSyncRecord>(`/api/builds/${buildId}/branch-sync`, {
        machineId: input.machineId,
        directory: input.directory,
        ref: input.ref,
        commit: input.commit,
        force: input.force,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['branchSync', buildId] });
    },
    // #638（普查账外、验收 grep 命中）：POST 入队被拒（409/5xx/网络）此前
    // 全静默。ResultCard 的红字是机器异步失败（record.status='failed'）的
    // 既有 canon 位——与 POST 失败分属两个阶段，不重叠、不双报。
    onError: (error) => toastError(t('同步失败，请重试。'), error),
  });
  const live = canSync && buildId !== null && machineId !== null;
  return (
    // XMON-24：同步钮切 shadcn ghost；#951：.dlg-sync per-face 律等值迁
    // utility（w100% h38 圆角 8 / --spot-disabled 漆面恒压 hover——老面
    // enabled 态同漆面，无 :disabled 降档 → opacity 中性化；cursor:default
    // 与底座 disabled:pointer-events-none 的箭头光标同效）。
    <Button
      variant="ghost"
      className="h-[38px] w-full cursor-default rounded-[8px] border-none bg-(--spot-disabled) text-[13px] leading-[calc(20/14)] font-normal text-(--spot-disabled-fg) hover:bg-(--spot-disabled) hover:text-(--spot-disabled-fg) dark:hover:bg-(--spot-disabled) dark:hover:text-(--spot-disabled-fg) disabled:opacity-100 active:not-aria-[haspopup]:translate-y-0"
      disabled={!live || disabled || mut.isPending}
      onClick={() => {
        if (!live || buildId === null || machineId === null) return;
        mut.mutate({ machineId, directory, ref: refName, commit, force });
      }}
    >
      {t('同步')}
    </Button>
  );
}

/** 结果卡：初始 GET + team stream `branch_sync` 事件失效重取。
 * record.status 四态（pending / running / synced / failed）；无 record = 不渲染卡。 */
function ResultCard({ buildId, t }: { buildId: string; t: (k: string) => string }) {
  const syncQ = useQuery({
    queryKey: ['branchSync', buildId],
    queryFn: () => api.get<BranchSyncRecord | null>(`/api/builds/${buildId}/branch-sync`),
  });
  // team stream branch_sync events are subscribed at LiveDataBridge root level
  // (api/sse.ts); this card only reads the cache.
  const live: BranchSyncRecord | null = syncQ.data ?? null;
  if (!live) return null;
  return <ResultCardBody record={live} t={t} />;
}

function ResultCardBody({ record, t }: { record: BranchSyncRecord; t: (k: string) => string }) {
  const statusLabel: Record<BranchSyncStatus, string> = {
    pending: t('等待中'),
    running: t('正在同步…'),
    synced: t('已同步'),
    failed: t('同步失败'),
  };
  // #951：result 卡类名钩退役（全仓零规则零 pin 的死类）；data-status 是
  // 状态行为载体，保留。
  return (
    <div data-status={record.status}>
      <div>{statusLabel[record.status]}</div>
      {record.errorMessage !== null && record.status === 'failed' ? (
        <div>{record.errorMessage}</div>
      ) : null}
      <div>
        {record.commit.slice(0, 12)} · {record.directory}
      </div>
    </div>
  );
}
