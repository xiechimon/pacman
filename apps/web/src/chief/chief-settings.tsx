// 总管设置 view (issue #72, r5 101–104): the gear swaps the whole content
// area to this surface — back button + centered title over a 766-wide
// centered column with the 4 tabs (Agent / 章程 / 记忆 / 关注与提醒). The
// tab row is real state; parity captures take the fixture's tab.
// #182 三钮接线:agent 行 = 选择总管 Agent dialog(清单 = members 读面
// memberType:"agent" 行,r5 §1;选定 → PATCH chief agent 槽,换绑带二次
// 确认 canon);章程编辑 = DialogShell 编辑弹窗(#180 裁决;保存 → PATCH
// charter 槽)。#204 压缩模型翻回交互(#182 曾静态化:当时 PATCH schema
// 无模型槽;server #203 落 compactionModel 可空 JSON 槽 + PATCH 第三槽后
// 启用)= ChiefModelSelect anchored popover,#180 数据源裁决(自定义
// providers 真值 + presets 兜底)落账口径见 chief-model-select.tsx 文件头。

import { BRAND, type ChiefCompactionModel } from '@pacman/shared';
import { useState } from 'react';
import { useApiMutations, useChief, useMembers, useProviders } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import type { ChiefContent, ChiefSettingsTab } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronLeft, ChevronRight, ChiefFaceDashed } from '../icons/index.js';
import { Button } from '../ui/button.js';
import { ChiefAgentDialog, type ChiefAgentOption } from './chief-agent-dialog.js';
import { type ChiefModelOption, ChiefModelSelect } from './chief-model-select.js';
import './chief.css';
import { EditCharterDialog } from './edit-charter-dialog.js';

const TABS: { id: ChiefSettingsTab; label: string }[] = [
  { id: 'agent', label: 'Agent' },
  { id: 'charter', label: '章程' },
  { id: 'memory', label: '记忆' },
  { id: 'watches', label: '关注与提醒' },
];

export function ChiefSettings({ chief, onBack }: { chief: ChiefContent; onBack: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<ChiefSettingsTab>(chief.tab ?? 'agent');
  // #182 live 数据面(查询 enabled=live,fixture 面全惰性,parity 零请求
  // 保证不动):charter/绑定 Agent = chief 封套真值;候选 Agent 集 =
  // members 读面投影。
  const { live, teamId } = useLiveData();
  const chiefQ = useChief(teamId, live);
  const membersQ = useMembers(teamId, live);
  const providersQ = useProviders(teamId, live);
  const mutations = useApiMutations(teamId);
  const charter = live ? (chiefQ.data?.chief.charter ?? '') : '';
  const boundAgent =
    live && chiefQ.data?.agentActor != null
      ? { id: chiefQ.data.agentActor.id, name: chiefQ.data.agentActor.displayName }
      : null;
  const agentOptions: ChiefAgentOption[] | undefined = live
    ? (membersQ.data ?? [])
        .filter((m) => m.memberType === 'agent')
        .map((m) => ({
          id: m.actorId,
          name: (m.actor as { displayName?: string } | undefined)?.displayName ?? m.actorId,
        }))
    : undefined;
  const [agentOpen, setAgentOpen] = useState(false);
  const [charterOpen, setCharterOpen] = useState(false);
  // live 提交 = PATCH chief(父侧 onSuccess 关窗,create-secret 同律);
  // fixture 面 callbacks 缺省 → dialog 走 accept 律(提交即关)。
  const bindAgent = live
    ? (agentId: string) =>
        // r5 §2 wire 原样:thinkingLevel null(绑定不带覆盖)。
        mutations.patchChief.mutate(
          { agent: { agentId, thinkingLevel: null } },
          { onSuccess: () => setAgentOpen(false) },
        )
    : undefined;
  const saveCharter = live
    ? (value: string) =>
        mutations.patchChief.mutate({ charter: value }, { onSuccess: () => setCharterOpen(false) })
    : undefined;
  // #204 压缩模型(#180 裁决落账):live 值 = chief 封套真值(null = 默认);
  // 选项 = 自定义 providers 读面投影(查询未决 = 空清单,不退 fixture
  // canon);选定 = PATCH compactionModel 槽(null = 清空回默认),invalidateAll
  // 重取回显——选择即关,不持本地乐观态(S8)。
  const compaction = live
    ? (chiefQ.data?.chief.compactionModel ?? null)
    : (chief.compactionModel ?? null);
  const modelOptions: ChiefModelOption[] | undefined = live
    ? (providersQ.data?.providers ?? []).flatMap((p) =>
        p.models.map((m) => ({
          provider: p.providerId,
          providerLabel: p.label,
          modelId: m.id,
          modelName: m.name,
        })),
      )
    : undefined;
  const pickModel = live
    ? (value: ChiefCompactionModel | null) =>
        mutations.patchChief.mutate({ compactionModel: value })
    : undefined;
  return (
    <div className="chief-settings">
      <header className="chief-set-head">
        <button type="button" className="chief-set-back" aria-label={t('返回')} onClick={onBack}>
          <ChevronLeft width={16} height={16} />
        </button>
        <h1 className="chief-set-title">{t('总管设置')}</h1>
      </header>
      <div className="chief-set-col">
        <div className="chief-tabs" role="tablist">
          {TABS.map((item) => (
            <button
              type="button"
              role="tab"
              key={item.id}
              aria-selected={tab === item.id}
              className={tab === item.id ? 'chief-tab is-active' : 'chief-tab'}
              onClick={() => setTab(item.id)}
            >
              {t(item.label)}
            </button>
          ))}
        </div>

        {tab === 'agent' && (
          <>
            <button type="button" className="chief-agent-row" onClick={() => setAgentOpen(true)}>
              {boundAgent != null ? (
                <span className="chief-agent-row-avatar">{boundAgent.name.charAt(0)}</span>
              ) : (
                <ChiefFaceDashed width={24} height={24} />
              )}
              <span>{boundAgent != null ? boundAgent.name : t('未设置')}</span>
              <ChevronRight width={14} height={14} className="chief-agent-chev" />
            </button>
            <div className="chief-compress">
              <div className="chief-compress-text">
                <h3>{t('压缩模型')}</h3>
                <p>
                  {t(
                    '压缩上下文时用来生成摘要的模型，选更快的模型可缩短等待。需要 {cli} CLI 0.1.49 及以上版本。',
                    {
                      cli: BRAND.cliCommandName,
                    },
                  )}
                </p>
              </div>
              {/* #204 翻回交互(server #203 槽就位,见文件头):ChiefModelSelect
                  保 r5 101 捕获 select 形状(button + chevron)。 */}
              <ChiefModelSelect value={compaction} options={modelOptions} onPick={pickModel} />
            </div>
          </>
        )}

        {tab === 'charter' && (
          <>
            {charter !== '' ? (
              // live 既有章程呈现位(r5 未拍非空章程 tab,[设计]:同空态块
              // 语言换实文)。
              <div className="chief-charter-text">{charter}</div>
            ) : (
              <div className="chief-charter-empty">
                {t('尚无章程。点击编辑，为总管添加常设指示。')}
              </div>
            )}
            <div className="chief-charter-actions">
              {/* a3-pages 收编：Button ghost/compact（e2e 钉 .chief-edit-btn
                  别名保留）；描边/底/字色 per-face 差异见 chief.css。 */}
              <Button
                variant="ghost"
                size="compact"
                className="chief-edit-btn"
                onClick={() => setCharterOpen(true)}
              >
                {t('编辑')}
              </Button>
            </div>
          </>
        )}

        {tab === 'memory' && (
          <div className="chief-memo">
            {t('尚未选择 Agent。请先在「Agent」页选定 Agent，记忆将保存在该 Agent 上。')}
          </div>
        )}

        {tab === 'watches' && (
          <div className="chief-watches">
            {t('暂无跟进事项。总管关注某个任务，或约定到点回头核实时，会按主题列在这里。')}
          </div>
        )}
      </div>
      {/* 弹窗挂在 tab 条件块外:切换 tab 不带走开态(dialog 遮罩层级高于
          设置面)。 */}
      <ChiefAgentDialog
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        agents={agentOptions}
        boundAgentId={boundAgent?.id ?? null}
        onBind={bindAgent}
      />
      <EditCharterDialog
        open={charterOpen}
        onClose={() => setCharterOpen(false)}
        charter={charter}
        onSave={saveCharter}
      />
    </div>
  );
}
