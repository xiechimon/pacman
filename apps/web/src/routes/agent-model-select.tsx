// Agent 模型选择器（#485）：概览 tab 与创建 Agent 弹窗共用一个面。
// 候选清单投影 = api/mappers.ts `toModelOptions`（custom providers
// models[] ∪ model-sources 非 pi 段；与总管压缩模型选择器同源，不各写一份）。
//
// 壳 = components/ui/select.tsx（XMON-75）。本件只剩「值怎么投影成行」：
// 候选键 = `provider/modelId`（同一模型 id 可能在 custom providers 与
// claude-code 段各有一行，只有 provider 位能把它们分开），行右侧次级位出
// providerLabel。
//
// 与 chief/chief-model-select.tsx 的关系：两者是同一投影上的两个面，不是同一
// 个组件——总管那个带「默认（与 Chief 相同）」行与 compactionModel 语义（可空
// 槽 = 继承 Chief），Agent 的模型是自身配置项，没有「继承」态。合并会把一个
// 面不需要的概念塞进另一个面。
//
// 标签只出模型名：原版下拉项是 `r3-gw · 128k`，`128k` 是原版内置模型目录的
// 上下文窗口——pacman 是本地 BYOK，没有这个数据源，不编造。
//
// 几何正本仍是 agent-detail.css 的 `.agent-model-*` / `.dlg-agent-model-*`
// （域 css unlayered，压 utility 层），两处消费各带自己的前缀：概览 tab =
// `agent-model`，创建弹窗 = `dlg-agent-model`。

import { Select, type SelectOption } from '../components/ui/select.js';
import type { ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';

interface AgentModelSelectProps {
  /** 当前值（live = agent 记录真值；fixture = 场景记录）；null = 未设置模型。 */
  value: { provider: string; modelId: string } | null;
  options: ModelOption[];
  /** 选定回调；缺省 = fixture 律（调用面自行决定是否只做本地回显）。 */
  onPick?: (value: { provider: string; modelId: string } | null) => void;
  /** 类名前缀——两个消费点的 e2e 各自钉自己的钩子，几何也各归各的域 CSS。 */
  prefix: string;
}

export function AgentModelSelect({ value, options, onPick, prefix }: AgentModelSelectProps) {
  const { t } = useI18n();
  const key = (row: { provider: string; modelId: string }) => `${row.provider}/${row.modelId}`;
  const rows: SelectOption[] = options.map((row) => ({
    value: key(row),
    label: row.modelName,
    meta: row.providerLabel,
  }));
  const current = value == null ? undefined : options.find((row) => key(row) === key(value));
  // 值回显：选项命中 → 模型名；未命中（provider 已被改名/删除）→ 裸串兜底，
  // 不空白不崩（chief 选择器同律）。
  const label =
    value == null ? t('未设置模型') : (current?.modelName ?? `${value.provider}/${value.modelId}`);

  return (
    <Select
      prefix={prefix}
      value={value == null ? null : key(value)}
      options={rows}
      label={label}
      unsetLabel={t('未设置模型')}
      menuLabel={t('模型')}
      onPick={(next) => {
        if (next === null) {
          onPick?.(null);
          return;
        }
        const hit = options.find((row) => key(row) === next);
        if (hit !== undefined) onPick?.({ provider: hit.provider, modelId: hit.modelId });
      }}
    />
  );
}
