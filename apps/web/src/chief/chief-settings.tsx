// 总管设置 view (issue #72, r5 101–104): the gear swaps the whole content
// area to this surface — back button + centered title over a 766-wide
// centered column with the 4 tabs (Agent / 章程 / 记忆 / 关注与提醒). The
// tab row is real state; fixture captures take the fixture's tab.
// #182 三钮接线:agent 行 = 选择总管 Agent dialog(清单 = members 读面
// memberType:"agent" 行,r5 §1;选定 → PATCH chief agent 槽,换绑带二次
// 确认 canon);章程编辑 = DialogShell 编辑弹窗(#180 裁决;保存 → PATCH
// charter 槽)。#204 压缩模型翻回交互(#182 曾静态化:当时 PATCH schema
// 无模型槽;server #203 落 compactionModel 可空 JSON 槽 + PATCH 第三槽后
// 启用)= ChiefModelSelect anchored popover,#358 数据源(model-sources ∪
// custom providers 并集,spec 11 §A10)落账口径见 chief-model-select.tsx
// 文件头。

import { BRAND, type ChiefCompactionModel } from '@pacman/shared';
import { useState } from 'react';
import {
  useApiMutations,
  useChief,
  useMembers,
  useModelSources,
  useProviders,
} from '../api/hooks.js';
import { toModelOptions } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { Button } from '../components/ui/button.js';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import type { ChiefContent, ChiefSettingsTab, ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronLeft, ChevronRight, ChiefFaceDashed } from '../icons/index.js';
import { ChiefAgentDialog, type ChiefAgentOption } from './chief-agent-dialog.js';
import { ChiefModelSelect } from './chief-model-select.js';
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
  // #182 live 数据面(查询 enabled=live,fixture 面全惰性,零请求
  // 保证不动):charter/绑定 Agent = chief 封套真值;候选 Agent 集 =
  // members 读面投影。
  const { live, teamId } = useLiveData();
  const chiefQ = useChief(teamId, live);
  const membersQ = useMembers(teamId, live);
  const providersQ = useProviders(teamId, live);
  const modelSourcesQ = useModelSources(teamId, live);
  const mutations = useApiMutations(teamId);
  const charter = live ? (chiefQ.data?.chief.charter ?? '') : '';
  const boundAgent =
    live && chiefQ.data?.agentActor != null
      ? { id: chiefQ.data.agentActor.id, name: chiefQ.data.agentActor.displayName }
      : null;
  const agentOptions: ChiefAgentOption[] | undefined = live
    ? (membersQ.data ?? [])
        .filter((m) => m.memberType === 'agent')
        .map((m) => {
          const actor = m.actor as { displayName?: string; avatarUrl?: string | null } | undefined;
          return {
            id: m.actorId,
            name: actor?.displayName ?? m.actorId,
            avatarUrl: actor?.avatarUrl ?? null,
          };
        })
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
  // #204 压缩模型(#358 数据源切换,spec 11 §A10):live 值 = chief 封套真值
  // (null = 默认);选项 = model-sources ∪ custom providers 并集投影
  // (mappers.toModelOptions 单源;查询未决 = 空清单,不退 fixture
  // canon);选定 = PATCH compactionModel 槽(null = 清空回默认),invalidateAll
  // 重取回显——选择即关,不持本地乐观态(S8)。
  const compaction = live
    ? (chiefQ.data?.chief.compactionModel ?? null)
    : (chief.compactionModel ?? null);
  const modelOptions: ModelOption[] | undefined = live
    ? toModelOptions(providersQ.data?.providers ?? [], modelSourcesQ.data?.sources ?? [])
    : undefined;
  const pickModel = live
    ? (value: ChiefCompactionModel | null) =>
        mutations.patchChief.mutate({ compactionModel: value })
    : undefined;
  return (
    <div className="chief-settings">
      <header className="chief-set-head">
        {/* XMON-23 收编：ghost/icon 原语；28×28 + 圆角 6 + tertiary 墨
            （含 hover 增亮，承旧 btn--icon 皮肤）per-face 留 chief.css。
            hover:bg-transparent 中和 ghost 的灰底 hover（per-face 无底色）。 */}
        <Button
          variant="ghost"
          size="icon"
          className="chief-set-back hover:bg-transparent active:not-aria-[haspopup]:translate-y-0"
          aria-label={t('返回')}
          onClick={onBack}
        >
          <ChevronLeft width={16} height={16} />
        </Button>
        <h1 className="chief-set-title">{t('总管设置')}</h1>
      </header>
      <div className="chief-set-col">
        {/* XMON-23 收编：Tabs bare 档——零 chrome 原语只出语义（role=
            tablist/tab、aria-selected、roving tabindex），几何/配色/选中态
            全由 chief-tabs/chief-tab per-face 承载；is-active 类随受控值
            条件挂上（e2e 钉该类名）。根 contents 出树，不产生布局盒。 */}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as ChiefSettingsTab)}
          className="contents"
        >
          <TabsList variant="bare" className="chief-tabs">
            {TABS.map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className={tab === item.id ? 'chief-tab is-active' : 'chief-tab'}
              >
                {t(item.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab === 'agent' && (
          <>
            {/* XMON-23 收编：ghost 原语 + chief-agent-row per-face（44 行卡
                几何/底/墨全在 unlayered per-face）。中和件：justify-start
                （原语居中会破左对齐行）、font-normal、leading-normal（原语
                text-sm 的 20px 定值行高会替掉继承的 1.5=21px，行内名字
                垂直挪 0.5px——像素对拍实测出在名字 AA 上）、active 位移、
                svg size-auto（ChiefFaceDashed 24 / ChevronRight 14 属性尺寸）。 */}
            <Button
              variant="ghost"
              className="chief-agent-row justify-start font-normal leading-normal active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto"
              onClick={() => setAgentOpen(true)}
            >
              {boundAgent != null ? (
                <span className="chief-agent-row-avatar">{boundAgent.name.charAt(0)}</span>
              ) : (
                <ChiefFaceDashed width={24} height={24} />
              )}
              <span>{boundAgent != null ? boundAgent.name : t('未设置')}</span>
              <ChevronRight width={14} height={14} className="chief-agent-chev" />
            </Button>
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
              {/* XMON-23 收编：ghost/sm（h-7=28 高、min(radius-md,12px)=8
                  圆角 = 旧 ghost/compact 公共形）；px-3/text-[13px] 补齐
                  compact 档的 12 内边距/13 字；描边 token、surface 底、
                  primary 字 per-face 留 chief.css（.chief-edit-btn re-key）。 */}
              <Button
                variant="ghost"
                size="sm"
                className="chief-edit-btn px-3 text-[13px] font-normal active:not-aria-[haspopup]:translate-y-0"
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
