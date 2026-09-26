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

import type { BranchSyncRecord, BranchSyncStatus, MachineRecord } from '@pacman/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client.js';
import { useMachines } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import type { BranchInfoContent } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown, Copy } from '../icons/index.js';
import { Button } from '../ui/button.js';
import { DialogShell } from '../ui/dialog-shell.js';
import './overlays.css';

interface BranchDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  info: BranchInfoContent;
  /**
   * M7 #319：分支对话框接真的 bridge。`buildId` 走 POST/GET 路径段；`teamId`
   * 走 useMachines 查询键。两个 prop 都可省——缺省时从 useLiveData() 派生
   * （详情页 mount 时 LiveDataBridge 已就绪）。fixture 模式下两端 = null
   * → 仍按 r7 占位 UI（不可点同步钮）。
   */
  buildId?: string | null;
  teamId?: string;
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
    // A4-deep 收编：icon 变体皮肤；24×24 几何 per-face 留 overlays.css
    <Button variant="icon" className="dlg-copy" aria-label={t('复制')} onClick={copy}>
      <Copy width={14} height={14} />
    </Button>
  );
}

export function BranchDialog({
  info,
  buildId: buildIdProp,
  teamId: teamIdProp,
  open,
  onClose,
}: BranchDialogProps) {
  const { t } = useI18n();
  const { live, teamId: liveTeamId } = useLiveData();
  const teamId = teamIdProp ?? liveTeamId;
  const buildId = buildIdProp ?? null;
  const machinesQ = useMachines(teamId, live && open === true);
  const [tab, setTab] = useState<'sync' | 'git'>('sync');
  const [force, setForce] = useState(false);
  const [machineId, setMachineId] = useState<string | null>(null);
  const [directory, setDirectory] = useState(info.directory);

  // 初始机器默认选：info.machine 同名命中优先，否则首个在线机器，否则 null。
  const machines: MachineRecord[] = machinesQ.data ?? [];
  const initialMachineId =
    machineId ?? machines.find((m) => m.name === info.machine)?.id ?? machines[0]?.id ?? null;

  const canSync = buildId !== null && live;

  return (
    <DialogShell
      headerCenter={
        <div className="dlg-form-seg" role="tablist" aria-label={t('分支与 PR')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'sync'}
            className="dlg-seg-tab"
            data-active={tab === 'sync'}
            onClick={() => setTab('sync')}
          >
            {t('同步到机器')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'git'}
            className="dlg-seg-tab"
            data-active={tab === 'git'}
            onClick={() => setTab('git')}
          >
            Git
          </button>
        </div>
      }
      open={open}
      onClose={onClose}
      footer={
        // #193: the sync tab's 同步 button rides the pinned shell footer;
        // the git tab carries no action and no footer.
        tab === 'sync' ? (
          <div className="dlg-form-foot">
            <SyncButton
              buildId={buildId}
              canSync={canSync}
              machineId={initialMachineId}
              directory={directory}
              refName={info.branch}
              commit={info.commit}
              force={force}
              disabled={initialMachineId === null || directory.trim() === ''}
            />
          </div>
        ) : undefined
      }
    >
      {tab === 'sync' ? (
        <div className="dlg-branch-body dlg-branch-body--foot">
          {box(info, t)}
          <div className="dlg-form-label">{t('目标机器')}</div>
          {canSync ? (
            <MachinePicker
              machines={machines}
              selected={initialMachineId}
              onSelect={setMachineId}
              t={t}
            />
          ) : (
            // fixture / fixture 路径占位（r7 31 原始捕获面）
            <button type="button" className="dlg-machine" disabled>
              <span className="dlg-machine-dot" />
              <span className="dlg-machine-name">{info.machine}</span>
              <ChevronDown width={12} height={12} />
            </button>
          )}
          <div className="dlg-form-label">{t('同步目录')}</div>
          {canSync ? (
            <input
              type="text"
              className="dlg-dir dlg-dir--input"
              value={directory}
              onChange={(event) => setDirectory(event.target.value)}
              spellCheck={false}
            />
          ) : (
            <div className="dlg-dir">{info.directory}</div>
          )}
          <div className="dlg-force">
            <div className="dlg-force-text">
              <div className="dlg-form-label">{t('强制同步')}</div>
              <div className="dlg-force-desc">
                {t('丢弃代码修改并删除非忽略的未跟踪文件；保留忽略内容。仅本次生效。')}
              </div>
            </div>
            <label className="dlg-toggle" data-on={force}>
              <input
                type="checkbox"
                aria-label={t('强制同步')}
                checked={force}
                onChange={(event) => setForce(event.target.checked)}
              />
              <span className="dlg-toggle-knob" />
            </label>
          </div>
          {canSync && buildId !== null ? <ResultCard buildId={buildId} t={t} /> : null}
        </div>
      ) : (
        <div className="dlg-branch-body">
          {box(info, t)}
          <div className="dlg-form-label">Pull Request</div>
          <div className="dlg-dir">{t('未创建')}</div>
        </div>
      )}
    </DialogShell>
  );
}

function box(info: BranchInfoContent, t: (k: string) => string) {
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
      <button
        type="button"
        className="dlg-machine"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dlg-machine-dot" data-on={cur?.online ?? false} />
        <span className="dlg-machine-name">{cur?.name ?? t('选择机器')}</span>
        <ChevronDown width={12} height={12} />
      </button>
      {open ? (
        <div className="dlg-machine-menu" role="listbox">
          {list.length === 0 ? (
            <div className="dlg-machine-empty">{t('暂无在线机器')}</div>
          ) : (
            list.map((m) => (
              <div key={m.id}>
                <button
                  type="button"
                  className="dlg-machine-opt"
                  data-active={m.id === selected}
                  onClick={() => {
                    onSelect(m.id);
                    setOpen(false);
                  }}
                >
                  <span className="dlg-machine-dot" data-on={m.online} />
                  <span>{m.name}</span>
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function SyncButton({
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
  });
  const live = canSync && buildId !== null && machineId !== null;
  return (
    <button
      type="button"
      className="dlg-sync"
      disabled={!live || disabled || mut.isPending}
      onClick={() => {
        if (!live || buildId === null || machineId === null) return;
        mut.mutate({ machineId, directory, ref: refName, commit, force });
      }}
    >
      {t('同步')}
    </button>
  );
}

/** 结果卡：初始 GET 拉一次 + team stream `branch_sync` 事件失效重取。四个状态
 * （pending 等待中 / running 正在同步… / synced 已同步 / failed 同步失败 + 错误
 * 文本）由 record.status 驱动；无 record = 不渲染卡（M7 #319 设计：未发起过
 * 同步 = 静默，避免空态噪声）。 */
function ResultCard({ buildId, t }: { buildId: string; t: (k: string) => string }) {
  const syncQ = useQuery({
    queryKey: ['branchSync', buildId],
    queryFn: () => api.get<BranchSyncRecord | null>(`/api/builds/${buildId}/branch-sync`),
  });
  // team stream 事件由 useTeamStream 在 LiveDataBridge 根层订阅 → invalidate
  // `['branchSync', buildId]`（api/sse.ts 处补 case）。本卡只读缓存。
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
