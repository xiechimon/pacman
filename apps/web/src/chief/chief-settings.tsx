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
import { EditCharterDialog } from './edit-charter-dialog.js';

const TABS: { id: ChiefSettingsTab; label: string }[] = [
  { id: 'agent', label: 'Agent' },
  { id: 'charter', label: '章程' },
  { id: 'memory', label: '记忆' },
  { id: 'watches', label: '关注与提醒' },
];

/** 设置面卡片族公共皮肤（#950 清零，旧 .chief-compress/.chief-host 等值：
 *  surface-secondary 块 / 16 横垫 8 纵垫 / min-height 62——#772 律英文描述
 *  换行时长高 / 17 上距）。 */
const CARD_CLS = 'mt-[17px] flex min-h-[62px] items-center gap-4 bg-(--secondary) px-4 py-2';

/** 卡片文字组（旧 .chief-compress-text h3/p 等值）。 */
const CARD_TITLE_CLS = 'text-sm font-semibold text-(--foreground)';
const CARD_DESC_CLS = 'mt-0.5 text-xs text-(--text-tertiary)';

/** 空态卡（旧 .chief-memo/.chief-watches 等值，#772 min-height + 居中 +
 *  tertiary 统一律）。 */
const EMPTY_CARD_CLS =
  'mt-[17px] flex min-h-11 items-center justify-center rounded-none bg-(--secondary) px-4 py-2 text-[13px] text-(--text-tertiary)';

/** 列表卡（旧 .chief-memory-card/.chief-watch-card 等值：8 圆角一次性尺寸
 *  §3.1(a)，XMON-117 一卡多行律）。 */
const LIST_CARD_CLS = 'mt-[17px] rounded-[8px] bg-(--secondary) text-[13px]';

/** tab chip（#950 清零，旧 .chief-tab 等值：26 高 / 11 横垫 / 13px 次级墨 /
 *  方角透明底；z-[1] 压在滑动指示条之上）。选中态载体 = aria-selected
 *  （Base UI 自带，#910 裁定 3——旧 .is-active 类退役）：primary 墨 + 600。
 *  hover tint 只给未选中 chip、只吃精细指针（#73/#138 律）；过渡只动
 *  background-color（旧律：选中墨切换瞬切不过渡）。 */
const TAB_CLS =
  'relative z-[1] h-[26px] cursor-pointer rounded-none border-none bg-transparent px-[11px] text-[13px] text-(--text-secondary) transition-[background-color] duration-(--dur-fast) ease-(--ease-standard) pointer-fine:hover:aria-[selected=false]:bg-(--seg-hover) aria-selected:font-semibold aria-selected:text-(--foreground)';

/** 滑动指示条（#644，旧 .chief-tab-indicator 等值）：Base UI 把激活 chip 的
 *  几何写进内联 --active-tab-* 自定义属性，pill 垫在 chip 下层（z-0）按
 *  参考站实测过渡滑动——left/top/width/height 各 150ms ease（todos.dev 真
 *  浏览器实测，ease 即 cubic-bezier(0.25,0.1,0.25,1)，非 --ease-standard）。
 *  transition 走任意值 shorthand 而非 transition-[…] + duration 拆件：四条
 *  逐属性声明的 computed 读回是 4 元列表（'0.15s, 0.15s, 0.15s, 0.15s' /
 *  'ease, ease, ease, ease'），segmented-controls 探针按旧 CSS 逐字钉该形。
 *  减弱动效瞬切（r1 §4.3 全站降级律，motion-reduce 承旧 reduce 块）。 */
const TAB_INDICATOR_CLS =
  'pointer-events-none absolute left-(--active-tab-left) top-(--active-tab-top) z-0 h-(--active-tab-height) w-(--active-tab-width) rounded-none bg-(--chief-tab-active) shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] [transition:left_var(--dur-fast)_ease,top_var(--dur-fast)_ease,width_var(--dur-fast)_ease,height_var(--dur-fast)_ease] motion-reduce:[transition:none]';

/** 已绑定 Agent 行头像（旧 .chief-agent-row-avatar 等值：首字母 chip =
 *  24 圆盘 surface 底 + 墨线框；--img 律去 chip 底边，图即圆盘）。 */
const ROW_AVATAR_CLS =
  'grid size-6 flex-none place-items-center rounded-full border border-(--border) bg-(--card) text-xs text-(--foreground)';
const ROW_AVATAR_IMG_CLS =
  'grid size-6 flex-none place-items-center rounded-full border-none bg-none [&_img]:block [&_img]:size-6 [&_img]:rounded-full';

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
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="relative flex h-[57px] flex-none items-center">
        {/* XMON-23→#950：ghost/icon 原语；28×28 + 方角 + tertiary 墨（含
            hover 增亮承旧 btn--icon 皮肤）改挂 utility 等值；ghost 的灰底
            hover / expanded 涂底逐通道钉回透明（旧 per-face 无底色）。 */}
        <Button
          variant="ghost"
          size="icon"
          className="ml-3.5 size-7 cursor-pointer rounded-none border-none text-(--text-tertiary) hover:bg-transparent hover:text-(--text-secondary) dark:hover:bg-transparent dark:hover:text-(--text-secondary) aria-expanded:bg-transparent aria-expanded:text-(--text-tertiary) active:not-aria-[haspopup]:translate-y-0"
          aria-label={t('返回')}
          onClick={onBack}
        >
          <ChevronLeft width={16} height={16} />
        </Button>
        {/* 标题 = 全宽绝对定位覆盖层；pointer-events-none 放行到底层返回钮
            （#811：纯文本标题不需要命中测试，布局/绘制零变化）。 */}
        <h1 className="pointer-events-none absolute inset-x-0 text-center text-[15px] font-semibold text-(--foreground)">
          {t('总管设置')}
        </h1>
      </header>
      {/* #1032：面板体自持滚动（secondary/shell.tsx:92、resources/shell.tsx:121
          同律）——根与内容列此前全链 overflow visible，长内容（记忆列表/长
          章程/关注清单）被外壳 overflow-hidden 裁掉且滚轮不动。全宽滚动层
          承接 overflow（滚动条贴面板右缘），766px 窄列只在里面居中、不自滚；
          overflow-x 保持裁切：窄列内容不该横向溢出（页面壳仍是唯一裁切者）。 */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="mx-auto w-[766px]">
          {/* XMON-23 收编：Tabs bare 档——零 chrome 原语只出语义（role=
            tablist/tab、aria-selected、roving tabindex），几何/配色/选中态
            #950 后由 TAB_CLS/TAB_INDICATOR_CLS utility 承载；选中态载体 =
            aria-selected（旧 is-active 类退役，e2e 钉 role=tab+selected）。
            根 contents 出树，不产生布局盒。 */}
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as ChiefSettingsTab)}
            className="contents"
          >
            <TabsList
              variant="bare"
              className="relative inline-flex rounded-none bg-(--secondary) p-0.5"
            >
              {/* #644 滑动指示条：选中 chip 的底色不再画在 chip 上，改由这根
                pill 承载——切 tab 时它按参考站实测的过渡滑到新位并变宽。 */}
              <TabsIndicator data-testid="chief-tab-indicator" className={TAB_INDICATOR_CLS} />
              {TABS.map((item) => (
                <TabsTrigger key={item.id} value={item.id} className={TAB_CLS}>
                  {t(item.label)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {tab === 'agent' && (
            <>
              {/* XMON-23→#950：ghost 原语 + 行卡皮肤 utility（旧
                .chief-agent-row 等值：44 行 / 12 gap / 16 横垫 /
                surface-secondary 底 / 14px 次级墨）。中和件沿旧：
                justify-start（原语居中会破左对齐行）、font-normal、
                leading-normal（原语 text-sm 的 20px 定值行高会替掉继承的
                1.5=21px，行内名字垂直挪 0.5px——像素对拍实测出在名字 AA
                上）、active 位移、hover/expanded 涂底钉回卡片底（旧
                per-face 恒压件层无反馈）、svg size-auto（ChiefFaceDashed
                24 / ChevronRight 14 属性尺寸）+ 行首 svg tertiary 墨。 */}
              <Button
                variant="ghost"
                className="mt-[17px] h-11 w-full cursor-pointer justify-start gap-3 rounded-none border-none bg-(--secondary) px-4 text-sm leading-normal font-normal text-(--text-secondary) hover:bg-(--secondary) hover:text-(--text-secondary) dark:hover:bg-(--secondary) dark:hover:text-(--text-secondary) aria-expanded:bg-(--secondary) aria-expanded:text-(--text-secondary) active:not-aria-[haspopup]:translate-y-0 [&_svg:first-child]:text-(--text-tertiary) [&_svg:not([class*='size-'])]:size-auto"
                onClick={() => setAgentOpen(true)}
              >
                {boundAgent != null ? (
                  boundAgent.avatarUrl != null ? (
                    /* #811: 已绑定行接 agentActor.avatarUrl（封套自带，不新增
                      请求；XMON-105 --img 律：图即 24 圆盘，去 chip 底边）。 */
                    <span className={ROW_AVATAR_IMG_CLS}>
                      <SeededAvatar
                        name={boundAgent.name}
                        src={boundAgent.avatarUrl}
                        fallback="/avatar-robot-1.svg"
                      />
                    </span>
                  ) : (
                    <span className={ROW_AVATAR_CLS}>{boundAgent.name.charAt(0)}</span>
                  )
                ) : (
                  <ChiefFaceDashed width={24} height={24} />
                )}
                <span>{boundAgent != null ? boundAgent.name : t('未设置')}</span>
                <ChevronRight width={14} height={14} className="ml-auto text-(--text-tertiary)" />
              </Button>
              <div className={CARD_CLS}>
                <div>
                  <h3 className={CARD_TITLE_CLS}>{t('压缩模型')}</h3>
                  <p className={CARD_DESC_CLS}>
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
              <div className={CARD_CLS}>
                <div>
                  <h3 className={CARD_TITLE_CLS}>{t('机器')}</h3>
                  <p className={CARD_DESC_CLS}>
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
                // 语言换实文)。旧 .chief-charter-text 等值迁移。
                <div className="mt-[17px] bg-(--secondary) px-4 py-3 text-[13px] leading-5 whitespace-pre-wrap text-(--foreground)">
                  {charter}
                </div>
              ) : (
                <div className="mt-[17px] grid min-h-[78px] place-items-center rounded-none border border-dashed border-(--input) bg-(--secondary) text-[13px] text-(--text-tertiary)">
                  {t('尚无章程。点击编辑，为总管添加常设指示。')}
                </div>
              )}
              <div className="mt-5 flex justify-end">
                {/* XMON-23→#950：旧 .chief-edit-btn 三点 per-face 偏差（描边
                  token、surface 底、primary 字）正是 outline 档配方——收编
                  variant="outline"（spec/22 §5.4 chief-dlg-ghost 同律，件
                  几何正典承接、差额 D2 吸收）；sm 档 28 高沿旧；px-3/
                  text-[13px] 补齐 compact 档的 12 内边距/13 字。 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="px-3 text-[13px]"
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
                <div>
                  {/* 配额头与 agent-detail 同文（`记忆 · n / 100`，上限取 shared
                    单源常量）；行只读，管理落 Agent 详情记忆 tab。 */}
                  <p className="mt-[17px] text-xs text-(--text-tertiary)">
                    {t('记忆 · {n} / {max}', { n: memories.length, max: MEMORY_QUOTA_PER_AGENT })}
                  </p>
                  {memories.length === 0 ? (
                    <p className={EMPTY_CARD_CLS}>{t(MEMORY_EMPTY_COPY)}</p>
                  ) : (
                    <div className={`${LIST_CARD_CLS} px-4 py-1`}>
                      {memories.map((memory, index) => (
                        <div
                          key={memory.id}
                          className={
                            // XMON-117 一卡多行律：行间分隔线（旧
                            // .chief-memory-row + 兄弟选择器等值，随改落
                            // 条件类）。
                            index > 0 ? 'block border-t border-(--border) py-2' : 'block py-2'
                          }
                        >
                          <span className="block text-(--foreground)">{memory.title}</span>
                          <span className="block text-(--text-secondary)">{memory.content}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null
            ) : (
              <div className={EMPTY_CARD_CLS}>
                {t('尚未选择 Agent。请先在「Agent」页选定 Agent，记忆将保存在该 Agent 上。')}
              </div>
            ))}

          {tab === 'watches' &&
            (live && (watches.length > 0 || wakes.length > 0) ? (
              <div className="flex flex-col">
                {watches.map((watch) => (
                  <div key={watch.threadId} className={`${LIST_CARD_CLS} px-4 py-2`}>
                    <span className="block text-(--foreground)">{watch.title}</span>
                    <span className="block text-xs text-(--text-tertiary)">
                      {watch.threadTitle}
                    </span>
                  </div>
                ))}
                {wakes.map((wake) => {
                  const note = typeof wake.note === 'string' ? wake.note : null;
                  const at = typeof wake.at === 'number' ? wake.at : null;
                  const id = typeof wake.id === 'string' ? wake.id : null;
                  return (
                    <div key={id ?? `${at}`} className={`${LIST_CARD_CLS} px-4 py-2`}>
                      <span className="block text-(--foreground)">{note ?? t('到点提醒')}</span>
                      {at != null && (
                        <span className="block text-xs text-(--text-tertiary)">
                          {new Date(at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={EMPTY_CARD_CLS}>
                {t('暂无跟进事项。总管关注某个任务，或约定到点回头核实时，会按主题列在这里。')}
              </div>
            ))}
        </div>
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
