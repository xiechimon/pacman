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
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModelOption } from '../fixtures/records.js';
import { Check, Search } from '../icons/index.js';

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
   *  BYOK 无此数据源，不编造（chief-model-popover 文件头既有裁决）。 */
  providerLabel?: string;
  onPick: () => void;
}

/** chief 两面共用的 flat 行（button[role=option] + 名 + 副题 + 选中 check）
 *  单源。行序、搜索过滤、空态归各面壳；本件只出一行。 */
export function ModelPickRow({ skin, selected, label, providerLabel, onPick }: ModelPickRowProps) {
  // 基类钩子（#751）：选中态是行渲染律的一部分，不是各面皮肤的一部分——
  // model-pick-* 基类承载选中行底色/墨色单源（chief.css），skin 类继续做
  // 各面几何与 e2e 别名钉扎（#411 别名优先）。
  const name = <span className={`${skin.name} model-pick-name`}>{label}</span>;
  const provider =
    providerLabel == null ? null : <span className={skin.provider}>{providerLabel}</span>;
  return (
    <button
      type="button"
      className={`${skin.row} model-pick-row`}
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
        <span className={`${skin.check} model-pick-check`}>
          <Check width={14} height={14} />
        </span>
      )}
    </button>
  );
}

/** typeahead 搜索框 input 中和件单源（#756 续：用户裁决框不常驻、打字才
 *  现形）：两面同形，故与搜索框皮肤类一并钉在本层，调用面只传文案。 */
const SEARCH_INPUT_CLASS =
  'chief-pick-input h-auto rounded-none border-none bg-transparent p-0 leading-5 placeholder:text-current/50 focus-visible:ring-0 focus-visible:outline-none dark:bg-transparent';

export interface ModelPickListProps {
  skin: ModelRowSkin;
  /** 候选清单（序 = 数据源序）；过滤律在本层。 */
  options: readonly ModelOption[];
  value: ModelSlotValue | null;
  /** 默认行文案（清空/继承语义由各面传入，本层不硬编码）。 */
  defaultLabel: string;
  /** listbox 的 aria-label 与搜索框占位/空态文案（i18n 单源在各面 t()）。 */
  listLabel: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  onPick: (value: ChiefCompactionModel | null) => void;
}

/** 行清单 + typeahead 搜索的单源壳（#756 续）：chief 两个 picker 面共用。
 *  搜索框**不常驻**——开面零占位（不渲染，非透明）；壳捕获可打印字符
 *  （preventDefault + stopPropagation，底层快捷键与行激活都截不到）现形
 *  搜索框并吃掉该字符（预填 + 即刻过滤 + 焦点进 input）。空格保留给行
 *  激活（键盘 a11y 契约），不触现形。
 *  **收回律（本票裁决，写进 PR）**：query 清空 = 收回——框消失、清单回
 *  全量、焦点回清单容器（后续打字可再现形）；不留空框占位。
 *  壳随 FloatingShell 卸载重置：重开回无框全清单态。 */
export function ModelPickList({
  skin,
  options,
  value,
  defaultLabel,
  listLabel,
  searchPlaceholder,
  emptyLabel,
  onPick,
}: ModelPickListProps) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  // 开面即焦点进清单容器（typeahead 契约：未现形时键必经 listbox 冒泡）。
  // Base UI 的 initialFocus 是异步移入——重载下它与首键竞态，e2e 实锤丢
  // 过键；本层在挂载（= 开面，FloatingShell 关面即卸载）同步确立，之后
  // 它再移到行钮仍在清单内，契约不断。
  useEffect(() => {
    listRef.current?.focus();
  }, []);
  // 现形即焦点进 input（吃掉的那个字符已预填，光标在尾）。
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source =
      q === ''
        ? options
        : options.filter(
            (row) =>
              row.modelName.toLowerCase().includes(q) ||
              row.providerLabel.toLowerCase().includes(q),
          );
    return toModelRows(source, value);
  }, [options, query, value]);

  return (
    <div className="model-pick-list-shell">
      {searchOpen && (
        <div className="chief-pick-search">
          <Search width={14} height={14} />
          <input
            ref={inputRef}
            className={SEARCH_INPUT_CLASS}
            value={query}
            onChange={(event) => {
              const next = event.target.value;
              // 收回律：清空即收回，焦点回清单容器承后续 typeahead。
              if (next === '') {
                setSearchOpen(false);
                setQuery('');
                listRef.current?.focus();
                return;
              }
              setQuery(next);
            }}
            placeholder={searchPlaceholder}
          />
        </div>
      )}
      <div
        ref={listRef}
        className="chief-model-pick-list"
        role="listbox"
        aria-label={listLabel}
        tabIndex={-1}
        onKeyDown={(event) => {
          // typeahead 捕获挂在 listbox 上（静态元素禁事件handler 的 biome
          // 律：交互归有 role 的元素）：未现形时焦点恒在清单内（行钮或本
          // 容器），键必经此冒泡。现形后键归 input，本 handler 不插手
          // （Esc 关面归 FloatingShell/Base UI）。空格保留给行激活（键盘
          // a11y 契约），不触现形；preventDefault + stopPropagation 让底层
          // 快捷键（hotkeys 的 window 监听认 defaultPrevented）截不到。
          if (searchOpen || event.metaKey || event.ctrlKey || event.altKey) return;
          if (event.key.length !== 1 || event.key === ' ' || event.nativeEvent.isComposing) return;
          event.preventDefault();
          event.stopPropagation();
          setSearchOpen(true);
          setQuery(event.key);
        }}
      >
        <ModelPickRow
          skin={skin}
          selected={value === null}
          label={defaultLabel}
          onPick={() => onPick(null)}
        />
        {rows.map((row) => (
          <ModelPickRow
            key={row.key}
            skin={skin}
            selected={row.selected}
            label={row.label}
            providerLabel={row.providerLabel}
            onPick={() => onPick(row.value)}
          />
        ))}
        {searchOpen && query.trim() !== '' && rows.length === 0 && emptyLabel != null && (
          <div className="chief-pick-empty">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}
