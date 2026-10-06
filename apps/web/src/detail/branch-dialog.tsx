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
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import { toastError } from '../components/ui/toaster.js';
import type { BranchInfoContent } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown, Copy } from '../icons/index.js';
import './overlays.css';

/** #945（正典表 §5.4，单源同 #944 的 RES_* 律）：.dlg-form-label 别名
 *  退役——字段标签律 = r7 31 节奏（box→label 9、label→control 8、18px
 *  行盒）+ c.css 定版 --label-size/--label-spacing token。branch-dialog
 *  与 right-pane 两消费面共用。 */
export const FIELD_LABEL =
  'mt-[9px] mb-2 text-(length:--label-size) leading-[18px] tracking-(--label-spacing) text-(--text-primary)';

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
    // utilities；24×24 几何留 overlays.css .dlg-copy per-face（选择器已去
    // .btn 前缀）。Copy 属性 14px，svg 免底座强制 16px。
    <Button
      variant="ghost"
      size="icon"
      className="dlg-copy text-(--text-tertiary) hover:bg-transparent dark:hover:bg-transparent hover:text-(--text-secondary) cursor-pointer active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
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
  return (
    <div className="dlg-branch-box">
      <div className="dlg-branch-row">
        <span className="dlg-branch-label">{t('构建分支')}</span>
        <span className="dlg-branch-value">{info.branch}</span>
        <CopyButton value={info.branch} />
      </div>
      <div className="dlg-branch-row">
        <span className="dlg-branch-label">{t('目标提交')}</span>
        <span className="dlg-branch-value">{info.commit}</span>
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
        // XMON-24：切 shadcn ghost——几何/皮肤全在 .dlg-machine per-face
        // （漆底压 hover）；恒 disabled 且老面无禁用降档 → opacity/
        // pointer-events 双双中性化。ChevronDown 属性 12px，svg 免底座 16px。
        <Button
          variant="ghost"
          className="dlg-machine font-normal disabled:opacity-100 disabled:pointer-events-auto [&_svg:not([class*='size-'])]:size-auto"
          disabled
        >
          <span className="dlg-machine-dot" />
          <span className="dlg-machine-name">{info.machine}</span>
          <ChevronDown width={12} height={12} />
        </Button>
      )}
      <div className={FIELD_LABEL}>{t('同步目录')}</div>
      {canSync ? (
        // XMON-24：目录输入切 registry Input——几何/皮肤全在 .dlg-dir
        // per-face（h32/padding/border/mono12，unlayered 恒压底座）；老面
        // 是 UA 裸 input：固有宽度（w-auto 还原）、focus 时 UA outline 环
        // （outline:auto 复刻，底座的 ring/border 变色清零）。
        <Input
          type="text"
          className="dlg-dir dlg-dir--input w-auto focus-visible:ring-0 focus-visible:border-transparent focus-visible:[outline:auto]"
          value={directory}
          onChange={(event) => onDirectory(event.target.value)}
          spellCheck={false}
        />
      ) : (
        <div className="dlg-dir">{info.directory}</div>
      )}
      <div className="dlg-force">
        <div className="dlg-force-text">
          {/* 老层叠里 overlays.css 的 .dlg-force-text .dlg-form-label 把本
              label 的 margin 归零（detail-b 域规则）——m-0 是其终值等价形，
              cn/twMerge 摘掉 FIELD_LABEL 的 mt/mb。 */}
          <div className={cn(FIELD_LABEL, 'm-0')}>{t('强制同步')}</div>
          <div className="dlg-force-desc">
            {t('丢弃代码修改并删除非忽略的未跟踪文件；保留忽略内容。仅本次生效。')}
          </div>
        </div>
        <label className="dlg-toggle" data-on={force}>
          {/* deliberate-native（#855）：原生 checkbox 是自定义拨杆之下的无障碍
              交互层（键盘/读屏语义白送，opacity:0 覆盖全 track）；Switch 原语几何
              不同（28×16 vs 32×18.4），换皮属另一票范围。 */}
          <input
            type="checkbox"
            aria-label={t('强制同步')}
            checked={force}
            onChange={(event) => onForce(event.target.checked)}
          />
          <span className="dlg-toggle-knob" />
        </label>
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
        <div className="dlg-branch-body dlg-branch-body--foot">
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
        <div className="dlg-branch-body">
          <BranchBox info={info} />
          <div className={FIELD_LABEL}>Pull Request</div>
          {pr !== null && prNumber != null ? (
            <a className="dlg-dir dlg-pr-link" href={pr} target="_blank" rel="noopener noreferrer">
              #{prNumber}
            </a>
          ) : (
            <div className="dlg-dir">{t('未创建')}</div>
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
  return (
    <div className="dlg-machine-picker">
      {/* XMON-24：机器 pill 切 shadcn ghost——皮肤全在 .dlg-machine
          per-face（漆底压 hover/aria-expanded 底）；aria-haspopup 命中底座
          active 位移豁免，无需中性化。ChevronDown 12px 免底座 16px。 */}
      <Button
        variant="ghost"
        className="dlg-machine font-normal [&_svg:not([class*='size-'])]:size-auto"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dlg-machine-dot" data-on={cur?.online ?? false} />
        <span className="dlg-machine-name">{cur?.name ?? t('选择机器')}</span>
        <ChevronDown width={12} height={12} />
      </Button>
      {open ? (
        <div className="dlg-machine-menu" role="listbox">
          {list.length === 0 ? (
            <div className="dlg-machine-empty">{t('暂无在线机器')}</div>
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
                  className="dlg-machine-opt h-auto rounded-none gap-1 p-0 text-[length:inherit] leading-[inherit] font-normal hover:bg-transparent dark:hover:bg-transparent hover:text-inherit active:not-aria-[haspopup]:translate-y-0"
                  data-active={m.id === selected}
                  onClick={() => {
                    onSelect(m.id);
                    setOpen(false);
                  }}
                >
                  <span className="dlg-machine-dot" data-on={m.online} />
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
    // XMON-24：同步钮切 shadcn ghost——漆底/几何全在 .dlg-sync per-face
    // （w100% h38 --spot-disabled 漆面压 hover；cursor:default 与底座
    // disabled:pointer-events-none 的箭头光标同效）；老面无 :disabled
    // 降档 → opacity 中性化。
    <Button
      variant="ghost"
      className="dlg-sync font-normal disabled:opacity-100 active:not-aria-[haspopup]:translate-y-0"
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
  return (
    <div className="dlg-sync-result" data-status={record.status}>
      <div className="dlg-sync-result-state">{statusLabel[record.status]}</div>
      {record.errorMessage !== null && record.status === 'failed' ? (
        <div className="dlg-sync-result-error">{record.errorMessage}</div>
      ) : null}
      <div className="dlg-sync-result-meta">
        {record.commit.slice(0, 12)} · {record.directory}
      </div>
    </div>
  );
}
