// 总管设置 view (issue #72, r5 101–104): the gear swaps the whole content
// area to this surface — back button + centered title over a 766-wide
// centered column with the 4 tabs (Agent / 章程 / 记忆 / 关注与提醒). The
// tab row is real state; fixture captures take the fixture's tab.
// #182 三钮接线:agent 行 = 选择总管 Agent dialog(清单 = members 读面
// memberType:"agent" 行,r5 §1;选定 → PATCH chief agent 槽,换绑带二次
// 确认 canon);章程编辑 = DialogShell 编辑弹窗(#180 裁决;保存 → PATCH
// charter 槽)。#204 压缩模型翻回交互(#182 曾静态化:当时 PATCH schema
// 无模型槽;server #203 落 compactionModel 可空 JSON 槽 + PATCH 第三槽后
// 启用)= ChiefModelSelect anchored popover,#358 数据源(model-sources 非 pi
// 段;#770 起 providers 段已除,spec 11 §A10)落账口径见 chief-model-select.tsx
// 文件头。#895 主力机槽(spec 21 A6) = Agent tab 新「机器」行
// ChiefMachineSelect:live 选定 → PATCH chief machineId 槽(null = 清回
// 自动),行形态沿 new-task 机器 chip 的 listbox 族。

import {
  BRAND,
  type ChiefCompactionModel,
  MEMORY_EMPTY_COPY,
  MEMORY_QUOTA_PER_AGENT,
} from '@pacman/shared';
import { useState } from 'react';
import {
  useApiMutations,
  useChief,
  useMachines,
  useMembers,
  useMemories,
  useModelSources,
} from '../api/hooks.js';
import { toModelOptions } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { Button } from '../components/ui/button.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import type {
  ChiefContent,
  ChiefSettingsTab,
  MachineRow,
  ModelOption,
} from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronLeft, ChevronRight, ChiefFaceDashed } from '../icons/index.js';
import { ChiefAgentDialog, type ChiefAgentOption } from './chief-agent-dialog.js';
import { type ChiefMachineOption, ChiefMachineSelect } from './chief-machine-select.js';
import { ChiefModelSelect } from './chief-model-select.js';
import './chief.css';
import { EditCharterDialog } from './edit-charter-dialog.js';

const TABS: { id: ChiefSettingsTab; label: string }[] = [
  { id: 'agent', label: 'Agent' },
  { id: 'charter', label: '章程' },
  { id: 'memory', label: '记忆' },
  { id: 'watches', label: '关注与提醒' },
];

export function ChiefSettings({
  chief,
  onBack,
  machines,
}: {
  chief: ChiefContent;
  onBack: () => void;
  /** #895 fixture 面的机器行集（resources machines 投影；live 面本组件
   *  自取 useMachines，不吃本 prop）。 */
  machines?: MachineRow[];
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<ChiefSettingsTab>(chief.tab ?? 'agent');
  // #182 live 数据面(查询 enabled=live,fixture 面全惰性,零请求
  // 保证不动):charter/绑定 Agent = chief 封套真值;候选 Agent 集 =
  // members 读面投影。
  const { live, teamId } = useLiveData();
  const chiefQ = useChief(teamId, live);
  const membersQ = useMembers(teamId, live);
  const modelSourcesQ = useModelSources(teamId, live);
  const machinesQ = useMachines(teamId, live);
  const mutations = useApiMutations(teamId);
  const charter = live ? (chiefQ.data?.chief.charter ?? '') : '';
  const boundAgent =
    live && chiefQ.data?.agentActor != null
      ? {
          id: chiefQ.data.agentActor.id,
          name: chiefQ.data.agentActor.displayName,
          avatarUrl: chiefQ.data.agentActor.avatarUrl,
        }
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
  // #811: 记忆 tab 读绑定 Agent 的记忆集（agent-detail 同源 useMemories；
  // 未绑定不请求，判据与 Agent 面 boundAgent 同源——误报未选即源于此）。
  const memoriesQ = useMemories(teamId, boundAgent?.id, live && boundAgent != null);
  const memories = memoriesQ.data ?? [];
  // #811: 关注 tab 读 chief 封套 watches/wakes（派工自动 watch、settle 后
  // 自动解；手动取关无服务端 mutation，故本面只读——见报告）。
  const watches = live ? (chiefQ.data?.watches ?? []) : [];
  const wakes = live ? (chiefQ.data?.wakes ?? []) : [];
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
  // #204 压缩模型(#358 数据源切换,spec 11 §A10;#770 起 providers 段已除):
  // live 值 = chief 封套真值(null = 默认);选项 = model-sources 非 pi 段投影
  // (mappers.toModelOptions 单源;查询未决 = 空清单,不退 fixture
  // canon);选定 = PATCH compactionModel 槽(null = 清空回默认),invalidateAll
  // 重取回显——选择即关,不持本地乐观态(S8)。存量 provider 模型值命中不了
  // 选项,走裸串兜底回显(不空白不崩);执行面不受影响。
  const compaction = live
    ? (chiefQ.data?.chief.compactionModel ?? null)
    : (chief.compactionModel ?? null);
  const modelOptions: ModelOption[] | undefined = live
    ? toModelOptions(modelSourcesQ.data?.sources ?? [])
    : undefined;
  const pickModel = live
    ? (value: ChiefCompactionModel | null) =>
        mutations.patchChief.mutate({ compactionModel: value })
    : undefined;
  // #895 spec 21 A6 主力机槽（值/行集/写面三段,compactionModel 槽同构）:
  // live 值 = chief 封套 chief.machineId(null = 自动);行集 = machines 读面
  // 最小投影;选定 = PATCH chief machineId 槽(null 清回自动),invalidateAll
  // 重取回显,无本地乐观态。fixture 面 = ChiefContent.machineId 回显 +
  // resources machines 行集,无 mutation(accept 律)。
  const machineOptions: ChiefMachineOption[] = live
    ? (machinesQ.data ?? []).map((m) => ({ id: m.id, name: m.name, online: m.online }))
    : (machines ?? []).flatMap((m) =>
        m.id != null ? [{ id: m.id, name: m.name, online: m.online }] : [],
      );
  const machineValue = live ? (chiefQ.data?.chief.machineId ?? null) : (chief.machineId ?? null);
  const pickMachine = live
    ? (machineId: string | null) => mutations.patchChief.mutate({ machineId })
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
            {/* #644 滑动指示条：选中 chip 的底色不再画在 .chief-tab 上，改由
                这根 pill 承载——切 tab 时它按参考站实测的过渡滑到新位并变宽
                （几何/动效正本是 chief.css 的 .chief-tab-indicator）。 */}
            <TabsIndicator className="chief-tab-indicator" />
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
                boundAgent.avatarUrl != null ? (
                  /* #811: 已绑定行接 agentActor.avatarUrl（封套自带，不新增
                      请求；XMON-105 --img 律：图即 24 圆盘，去 chip 底边）。 */
                  <span className="chief-agent-row-avatar chief-agent-row-avatar--img">
                    <SeededAvatar
                      name={boundAgent.name}
                      src={boundAgent.avatarUrl}
                      fallback="/avatar-robot-1.svg"
                    />
                  </span>
                ) : (
                  <span className="chief-agent-row-avatar">{boundAgent.name.charAt(0)}</span>
                )
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
            {/* #895 spec 21 A6「机器」槽：主力机（chief 的默认执行机器，决策
                面与绑定 Agent / 模型同层，N6——machines 页只有读态徽标）。 */}
            <div className="chief-host">
              <div className="chief-compress-text">
                <h3>{t('机器')}</h3>
                <p>
                  {t(
                    '总管回合默认在哪台机器上执行。选「自动」时由在线机器认领，并粘住持有会话的那台。',
                  )}
                </p>
              </div>
              <ChiefMachineSelect
                value={machineValue}
                machines={machineOptions}
                onPick={pickMachine}
              />
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

        {tab === 'memory' &&
          (live && boundAgent != null ? (
            memoriesQ.data != null ? (
              <div className="chief-memory">
                {/* 配额头与 agent-detail 同文（`记忆 · n / 100`，上限取 shared
                    单源常量）；行只读，管理落 Agent 详情记忆 tab。 */}
                <p className="chief-memory-head">
                  {t('记忆 · {n} / {max}', { n: memories.length, max: MEMORY_QUOTA_PER_AGENT })}
                </p>
                {memories.length === 0 ? (
                  <p className="chief-memo">{t(MEMORY_EMPTY_COPY)}</p>
                ) : (
                  <div className="chief-memory-card">
                    {memories.map((memory) => (
                      <div key={memory.id} className="chief-memory-row">
                        <span className="chief-memory-title">{memory.title}</span>
                        <span className="chief-memory-content">{memory.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null
          ) : (
            <div className="chief-memo">
              {t('尚未选择 Agent。请先在「Agent」页选定 Agent，记忆将保存在该 Agent 上。')}
            </div>
          ))}

        {tab === 'watches' &&
          (live && (watches.length > 0 || wakes.length > 0) ? (
            <div className="chief-watch">
              {watches.map((watch) => (
                <div key={watch.threadId} className="chief-watch-card">
                  <span className="chief-watch-title">{watch.title}</span>
                  <span className="chief-watch-meta">{watch.threadTitle}</span>
                </div>
              ))}
              {wakes.map((wake) => {
                const note = typeof wake.note === 'string' ? wake.note : null;
                const at = typeof wake.at === 'number' ? wake.at : null;
                const id = typeof wake.id === 'string' ? wake.id : null;
                return (
                  <div key={id ?? `${at}`} className="chief-watch-card">
                    <span className="chief-watch-title">{note ?? t('到点提醒')}</span>
                    {at != null && (
                      <span className="chief-watch-meta">{new Date(at).toLocaleString()}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="chief-watches">
              {t('暂无跟进事项。总管关注某个任务，或约定到点回头核实时，会按主题列在这里。')}
            </div>
          ))}
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
