// Agent 模型槽两级选择器（t-0024 诉求 2）：概览 tab 与创建 Agent 弹窗共用。
// 一级 = 运行时/服务商（provider 维），二级 = 该 provider 名下的具体模型。
// 改前是单个平铺下拉（行 = `模型名` + 右侧 provider 徽标），provider 与
// runtime 段的候选混在一列——用户原话「全部混杂在一起，只有一个模型的方框」。
//
// 为什么一级是 provider 维而不是 machine 维 runtime（pi / claude-code 词表，
// records/model-source.ts）：agent 记录只有 provider + modelId 两字段（wire 无
// 独立 runtime 字段），provider 位的语义 = null/pi 内置、claude-code 本机段、
// 其余 custom provider id（#499 只读行时期的裁决原文）；一级分组键因此只能是
// provider——它既是存值位，也是用户心智里「先指定 Claude / 先指定某个网关」
// 的那一层。machine 维 runtime 是「一台电脑 × 一个 CLI」的执行面概念
// （docs/research/r10-multica-runtime.md），agent 配置面没有这个选择。
//
// 候选清单投影 = api/mappers.ts `toModelOptions`（model-sources 非 pi 段；
// #770 起 providers 段已除——存量 provider 绑定值命中不了选项，走裸串兜底
// 回显；与总管压缩模型选择器同源，不各写一份）。一级分组 =
// 该投影的 provider 位去重保序。
//
// 壳 = components/ui/select.tsx（XMON-75）。本件只剩「值怎么投影成行」与两级
// 级联：换一级清二级（modelId 只在 provider 内有意义，跨 provider 带过去是脏
// 值）；一级为内置 (pi)（= null，本仓 BYOK 无内置模型目录）时二级无候选，走
// Select 的 disabled 门（时序门，非 #222 死钮）。
//
// 与 chief/chief-model-select.tsx 的关系不变：两者是同一投影上的两个面——总管
// 那个带「默认（与 Chief 相同）」行与 compactionModel 语义（可空槽 = 继承
// Chief），Agent 的模型是自身配置项，没有「继承」态。值回显兜底裸串律两面
// 共用一份，单源在 components/model-select-core（#626 收敛）：本件一级消费
// providerEchoLabel、二级消费 modelEchoLabel，壳与两级级联律仍归本件。
//
// 标签只出模型名：原版下拉项的 `· 128k` 是原版内置模型目录的上下文窗口——
// pacman 是本地 BYOK，没有这个数据源，不编造；provider 位升去一级后二级行内
// 也不再重复徽标。
//
// 几何正本（#952，agent-detail.css 退役）：触发钮皮肤与菜单锚边/封顶是本文件
// 的 AGENT_/DLG_AGENT_ SELECT_* utility 常量（原 `.agent-*-select` /
// `.dlg-agent-*-select` 与 `.ui-select-menu.<prefix>-menu` 复合覆盖的等值迁移），
// 经 Select 的 triggerClassName/menuClassName 位注入；e2e 句柄仍走 prefix：
// 概览 tab = `agent-model` / `agent-runtime`，创建弹窗 = `dlg-agent-model` /
// `dlg-agent-runtime`。

import { modelEchoLabel, providerEchoLabel } from '../components/model-select-core.js';
import { Select, type SelectOption } from '../components/ui/select.js';
import type { ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';

/** 概览 tab 触发钮（原 .agent-model-select / .agent-runtime-select /
 *  .agent-skill-select 三选择器同值）：32 高带框盒形（card-border 描边 +
 *  surface 底 + 13px 字 + 6 gap + 10px 横垫）。ghost 底座七通道中和
 *  （spec/22 §5.0）：本钮是带框盒形，hover/aria-expanded 回 surface 皮肤
 *  而非透明（RES_SORT_TRIGGER_CLS 同律），无按下位移。 */
export const AGENT_SELECT_TRIGGER_CLS =
  'h-8 cursor-pointer gap-1.5 rounded-none border border-(--border) bg-(--card) px-2.5 text-[13px] text-(--foreground) hover:bg-(--card) hover:text-(--foreground) dark:hover:bg-(--card) aria-expanded:bg-(--card) aria-expanded:text-(--foreground) active:not-aria-[haspopup]:translate-y-0';

/** 创建弹窗触发钮（原 .dlg-agent-model-select / .dlg-agent-runtime-select）：
 *  36 高、撑满行宽、文案贴左值贴右（space-between）、12px 横垫；皮肤与中和
 *  同概览档。 */
export const DLG_AGENT_SELECT_TRIGGER_CLS =
  'h-9 w-full cursor-pointer justify-between gap-1.5 rounded-none border border-(--border) bg-(--card) px-3 text-[13px] text-(--foreground) hover:bg-(--card) hover:text-(--foreground) dark:hover:bg-(--card) aria-expanded:bg-(--card) aria-expanded:text-(--foreground) active:not-aria-[haspopup]:translate-y-0';

/** 概览 tab 菜单锚边（原 `.ui-select-menu.agent-*-menu { left:auto; right:0 }`）：
 *  触发钮在模板行的值槽位（行右缘），贴右缘向下展开——锚错边菜单就往**外**长，
 *  越过 `.res-col` 的横向裁切被切掉一截（#486/#494 前车）。 */
export const AGENT_SELECT_MENU_CLS = 'left-auto right-0';

/** 创建弹窗菜单锚位（原 `.ui-select-menu.dlg-agent-*-menu`）：模型槽是表单最后
 *  一个字段，下方紧贴底栏——向下展开必被压住（实测只剩首行露出来），故向上
 *  展开：底边贴触发钮上缘（4px 锚距），横向仍左锚（触发钮撑满行宽，右锚会往
 *  左冒出行左缘；左锚冒的是弹窗体自己的 16px 内垫）。封顶 192：菜单的
 *  containing block（触发钮 wrap）在 dialog-body 这个 overflow-y:auto 滚动盒里，
 *  触发钮上缘到 body 上缘实测 200~202px，192 留 ≥8px 余量整块落在盒内，超出的
 *  行交给菜单自滚（XMON-39：44 行候选时 300 壳档顶进裁剪带，前几行既画不出来
 *  也点不中）。改这条前先量触发钮上缘与 body 上缘之差，封顶值不得越过去——
 *  agent-create-model.spec 的几何断言钉着它。 */
export const DLG_AGENT_SELECT_MENU_CLS = 'top-auto bottom-[calc(100%+4px)] max-h-[192px]';

/** 运行时/skill 菜单最小宽（原 `.ui-select-menu.agent-runtime-menu` /
 *  `.agent-skill-menu` / `.dlg-agent-runtime-menu` 的 180）：候选都是短标识
 *  （r3-gw / Claude Code / agent-reach），180 够装；模型菜单吃壳默认 220
 *  （模型名长度随 provider 自定，比触发钮宽才装得下）。 */
export const AGENT_SELECT_MENU_NARROW_CLS = 'min-w-[180px]';

/** 内置 (pi) 的显示词（provider null/'pi' 的读回形）：一级选择器的清空行与
 *  触发钮回读同词，与 #499 只读行时期的运行时档文案逐字一致（原 agent-detail
 *  页本地常量，两级化后单源移此）。 */
export const BUILTIN_RUNTIME_LABEL = '内置 (pi)';

/** 一级候选分组：provider 位去重保序（toModelOptions 同键去重语义——分组键
 *  只能是 provider）。 */
export function providerGroups(
  options: ModelOption[],
): { provider: string; providerLabel: string }[] {
  const groups: { provider: string; providerLabel: string }[] = [];
  const seen = new Set<string>();
  for (const row of options) {
    if (seen.has(row.provider)) continue;
    seen.add(row.provider);
    groups.push({ provider: row.provider, providerLabel: row.providerLabel });
  }
  return groups;
}

interface AgentRuntimeSelectProps {
  /** 当前值 = provider 位；null = 内置 (pi)（清空行）。 */
  value: string | null;
  options: ModelOption[];
  /** 选定回调；级联清二级的决定权在调用面（存值形态各面不同）。 */
  onPick?: (provider: string | null) => void;
  /** 类名前缀——两个消费点的 e2e 各自钉自己的钩子（零规则句柄类）。 */
  prefix: string;
  /** 触发钮皮肤位（AGENT_/DLG_AGENT_ SELECT_TRIGGER_CLS，消费面选档）。 */
  triggerClassName?: string;
  /** 菜单几何位（锚边/封顶/最小宽，消费面拼档）。 */
  menuClassName?: string;
}

/** 一级：运行时/服务商。行 = provider 分组名（custom provider 的 label /
 *  runtime 段品牌名 `Claude Code`），首行恒是「内置 (pi)」清空档。 */
export function AgentRuntimeSelect({
  value,
  options,
  onPick,
  prefix,
  triggerClassName,
  menuClassName,
}: AgentRuntimeSelectProps) {
  const { t } = useI18n();
  const groups = providerGroups(options);
  const rows: SelectOption[] = groups.map((group) => ({
    value: group.provider,
    label: group.providerLabel,
  }));
  // 值回显：分组命中 → 分组名；未命中（provider 已被改名/删除）→ 裸串兜底，
  // 不空白不崩（律单源 model-select-core，二级同律）。
  const unset = t(BUILTIN_RUNTIME_LABEL);
  const label = providerEchoLabel(value, groups, unset);

  return (
    <Select
      prefix={prefix}
      value={value}
      options={rows}
      label={label}
      unsetLabel={unset}
      menuLabel={t('运行时')}
      triggerClassName={triggerClassName}
      menuClassName={menuClassName}
      onPick={(next) => onPick?.(next)}
    />
  );
}

interface AgentModelSelectProps {
  /** 一级当前值：候选按它过滤；null = 内置 (pi)，名下无可选模型，本级禁用。 */
  provider: string | null;
  modelId: string | null;
  options: ModelOption[];
  /** 选定回调（modelId 或 null 清空）；provider 位由调用面自持。 */
  onPick?: (modelId: string | null) => void;
  /** 类名前缀——同 AgentRuntimeSelect。 */
  prefix: string;
  /** 触发钮皮肤位——同 AgentRuntimeSelect。 */
  triggerClassName?: string;
  /** 菜单几何位——同 AgentRuntimeSelect。 */
  menuClassName?: string;
}

/** 二级：当前运行时/服务商名下的具体模型。 */
export function AgentModelSelect({
  provider,
  modelId,
  options,
  onPick,
  prefix,
  triggerClassName,
  menuClassName,
}: AgentModelSelectProps) {
  const { t } = useI18n();
  const rows: SelectOption[] = options
    .filter((row) => row.provider === provider)
    .map((row) => ({ value: row.modelId, label: row.modelName }));
  // 值回显：选项命中 → 模型名；未命中（模型已被改名/删除）→ 裸串兜底，
  // 不空白不崩（律单源 model-select-core，chief 选择器同律）。
  const unset = t('未设置模型');
  const label = modelEchoLabel({ provider, modelId }, options, unset);

  return (
    <Select
      prefix={prefix}
      value={modelId}
      options={rows}
      label={label}
      unsetLabel={unset}
      menuLabel={t('模型')}
      disabled={provider === null}
      triggerClassName={triggerClassName}
      menuClassName={menuClassName}
      onPick={(next) => onPick?.(next)}
    />
  );
}
