// 总管设置 view (issue #72, r5 101–104): the gear swaps the whole content
// area to this surface — back button + centered title over a 766-wide
// centered column with the 4 tabs (Agent / 章程 / 记忆 / 关注与提醒). The
// tab row is real state; parity captures take the fixture's tab.
// #182 三钮接线:agent 行 = 选择总管 Agent dialog(清单 = members 读面
// memberType:"agent" 行,r5 §1;选定 → PATCH chief agent 槽,换绑带二次
// 确认 canon);章程编辑 = DialogShell 编辑弹窗(#180 裁决;保存 → PATCH
// charter 槽)。压缩模型静态化(#177 目标分支同律):PATCH chief schema 核
// 词表实测仅 agent/charter 两槽、无模型槽(DB chief 表同),票「以 server
// schema 为权威」落账 → button→span,保捕获形状不再是死钮;#180 数据源裁
// 决(providers 真值+presets 兜底)待 server 长出模型槽后启用。

import { BRAND } from '@pacman/shared';
import { useState } from 'react';
import { useApiMutations, useChief, useMembers } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import type { ChiefContent, ChiefSettingsTab } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronDown, ChevronLeft, ChevronRight, ChiefFaceDashed } from '../icons/index.js';
import { ChiefAgentDialog, type ChiefAgentOption } from './chief-agent-dialog.js';
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
              {/* #182 静态化(无模型槽可持久化,见文件头):span 非 button,
                  chevron 保 r5 101 捕获形状——非交互元素,不再是死钮。 */}
              <span className="chief-select">
                <span>{t('默认（与 Chief 相同）')}</span>
                <ChevronDown width={12} height={12} />
              </span>
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
              <button type="button" className="chief-edit-btn" onClick={() => setCharterOpen(true)}>
                {t('编辑')}
              </button>
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
