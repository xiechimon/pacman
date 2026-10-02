// 模型选择实现核心（#626 收敛）：四个面——agent 创建槽与概览槽（两级 Select
// 级联，#617 裁决形态）、chief 主模型 dialog（r5 108 / #615 裁决形态）、压缩
// 模型 popover（#204 形态）——共用的实现律单源在此：行投影（ModelOption →
// 行形）、值回显兜底裸串律、选中当前值空操作关面律、默认行语义（清空/继承
// 文案由各面传入，本层不硬编码三种变体）。
//
// 壳与几何不收编、归各面：chief 两个 flat 面各带自己的类名组（skin 参数），
// 节点结构与收敛前逐一同构——dialog 面多一层 col 列容器（r5 108 形态），
// popover 面 name/provider 直挂行下；agent 两面继续走 components/ui/select.tsx
// （XMON-75）原语，只消费本文件的回显兜底律。明确不收敛壳：chief 面直接换
// AgentRuntimeSelect 已被票面否决——两级级联与 r5 108 的 flat+副题+搜索+
// 继承默认行不同构，强行统一壳是产品决策不是代码决策。
//
// 本层不碰 i18n（api/mappers.ts toThinkingLevelDisplay 同律）：词典键单源在
// 各调用面的 t()，默认行/未设槽文案一律作参数传入。

import type { ChiefCompactionModel } from '@pacman/shared';
import type { ModelOption } from '../fixtures/records.js';
import { Check } from '../icons/index.js';

/** 模型维槽值：对象形 {provider, modelId}（chiefCompactionModelSchema 同构；
 *  agent 面的两字段拼成同形传入）。modelId null = 槽未设；provider null 仅
 *  agent 级联面出现（内置 pi 档，此时二级禁用、回显走未设文案）。 */
export interface ModelSlotValue {
  provider: string | null;
  modelId: string | null;
}

/** 选项命中：(provider, modelId) 联合键唯一行（toModelOptions 已同键去重，
 *  至多一行相等）。值未命中（改名/删除/退役 preset）返 null，由回显律兜底。 */
export function findModelOption(
  options: readonly ModelOption[],
  value: ModelSlotValue | null,
): ModelOption | null {
  if (value == null || value.modelId == null) return null;
  return (
    options.find((row) => row.provider === value.provider && row.modelId === value.modelId) ?? null
  );
}

/** 行选中标记：槽值 × 行直接比对。值未命中任何选项时（stale preset / 已删
 *  模型）无行选中——101-stale-model 场景钉的就是这一态。 */
export function isOptionSelected(value: ModelSlotValue | null, row: ModelOption): boolean {
  return value != null && value.provider === row.provider && value.modelId === row.modelId;
}

/** 两槽值同值判定（「选中当前值 = 空操作关面」律的谓词）：双 null = 同；
 *  单 null = 不同；否则 provider + modelId 两位都比（裸串跨 provider 撞名，
 *  只比 modelId 是错的——chiefCompactionModelSchema 对象形槽值立法理由同）。 */
export function sameModelValue(a: ModelSlotValue | null, b: ModelSlotValue | null): boolean {
  if (a == null || b == null) return a == null && b == null;
  return a.provider === b.provider && a.modelId === b.modelId;
}

/** 模型维回显兜底裸串律（#180 裁决收敛到值回显层）：选项命中 → 模型名；
 *  未命中 → 裸串 provider/modelId 即名，不空白不崩；槽未设 → 面传入的
 *  未设/继承文案（清空与继承两类语义由调用面给，本层不辨）。 */
export function modelEchoLabel(
  value: ModelSlotValue | null,
  options: readonly ModelOption[],
  unsetLabel: string,
): string {
  if (value == null || value.modelId == null) return unsetLabel;
  return findModelOption(options, value)?.modelName ?? `${value.provider}/${value.modelId}`;
}

/** provider 维回显兜底裸串律（agent 一级面）：分组命中 → 分组显示名；
 *  未命中（provider 已被改名/删除）→ 裸串 = provider id 本身；null → 面
 *  传入的清空档文案。candidates 收 ModelOption[] 或 providerGroups 输出
 *  皆可（只需 provider + providerLabel 两位）。 */
export function providerEchoLabel(
  provider: string | null,
  candidates: readonly { provider: string; providerLabel: string }[],
  unsetLabel: string,
): string {
  if (provider == null) return unsetLabel;
  return candidates.find((row) => row.provider === provider)?.providerLabel ?? provider;
}

/** 「选中当前值 = 空操作关面」律 + accept 律（选择即关）单源：同值只关面
 *  不上报；不同值先关面再上报（live 真值经 invalidateAll 重取回显，不做
 *  本地乐观态；fixture 面 onPick 缺省 = 选择即关）。 */
export function createModelPicker(params: {
  value: ChiefCompactionModel | null;
  close: () => void;
  onPick?: (value: ChiefCompactionModel | null) => void;
}): (next: ChiefCompactionModel | null) => void {
  const { value, close, onPick } = params;
  return (next) => {
    close();
    if (!sameModelValue(value, next)) onPick?.(next);
  };
}

/** 行投影后的行视图形（ModelOption → 行形）：key = provider/modelId（与
 *  toModelOptions 去重键同形，React key 防撞）；selected 走 isOptionSelected；
 *  value = 选中时上报的槽值。 */
export interface ModelRowVm {
  key: string;
  label: string;
  providerLabel: string;
  selected: boolean;
  value: ChiefCompactionModel;
}

/** 行投影：候选清单 × 当前槽值 → 行视图形清单（顺序 = 候选序，不排序——
 *  序由数据源给，toModelOptions 的并集序即展示序）。 */
export function toModelRows(
  options: readonly ModelOption[],
  value: ModelSlotValue | null,
): ModelRowVm[] {
  return options.map((row) => ({
    key: `${row.provider}/${row.modelId}`,
    label: row.modelName,
    providerLabel: row.providerLabel,
    selected: isOptionSelected(value, row),
    value: { provider: row.provider, modelId: row.modelId },
  }));
}

/** flat 行面钩子类名组：几何正本在各面域 CSS（chief.css），核心只保证节点
 *  结构。col 缺省 = name/provider 直挂行下（#204 popover 面）；给了 = 包一
 *  层列容器（r5 108 dialog 面）。 */
export interface ModelRowSkin {
  row: string;
  col?: string;
  name: string;
  provider: string;
  check: string;
}

interface ModelPickRowProps {
  skin: ModelRowSkin;
  selected: boolean;
  /** 行主文案：模型行 = modelName；默认行 = 各面传入的清空/继承语义文案。 */
  label: string;
  /** 行副题 = provider 显示名；默认行不传即不出。副题只投影 providerLabel
   *  ——原版捕获位 r3-gw 后那段 128k 是原版内置模型目录的上下文窗口，本地
   *  BYOK 无此数据源，不编造（chief-model-dialog 文件头既有裁决）。 */
  providerLabel?: string;
  onPick: () => void;
}

/** chief 两面共用的 flat 行（button[role=option] + 名 + 副题 + 选中 check）
 *  单源。行序、搜索过滤、空态归各面壳；本件只出一行。 */
export function ModelPickRow({ skin, selected, label, providerLabel, onPick }: ModelPickRowProps) {
  const name = <span className={skin.name}>{label}</span>;
  const provider =
    providerLabel == null ? null : <span className={skin.provider}>{providerLabel}</span>;
  return (
    <button
      type="button"
      className={skin.row}
      role="option"
      aria-selected={selected}
      onClick={onPick}
    >
      {skin.col == null ? (
        <>
          {name}
          {provider}
        </>
      ) : (
        <span className={skin.col}>
          {name}
          {provider}
        </span>
      )}
      {selected && (
        <span className={skin.check}>
          <Check width={14} height={14} />
        </span>
      )}
    </button>
  );
}
