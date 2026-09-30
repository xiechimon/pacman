// Agent 模型选择器（#485）：概览 tab 与创建 Agent 弹窗共用一个面。
// 候选清单投影 = api/mappers.ts `toModelOptions`（custom providers
// models[] ∪ model-sources 非 pi 段；与总管压缩模型选择器同源，不各写一份）。
// 交互 = anchored popover 家族律（FloatingShell + ClickCatcher + Esc，
// role=listbox/option）；选中当前值 = 空操作关面。
//
// 与 chief/chief-model-select.tsx 的关系：两者是同一投影上的两个面，不是同一
// 个组件——总管那个带「默认（与 Chief 相同）」行与 compactionModel 语义（可空
// 槽 = 继承 Chief），Agent 的模型是自身配置项，没有「继承」态。合并会把一个
// 面不需要的概念塞进另一个面。
//
// 标签只出 `provider · 模型名`：原版下拉项是 `r3-gw · 128k`，`128k` 是原版
// 内置模型目录的上下文窗口——pacman 是本地 BYOK，没有这个数据源，不编造。
//
// 承载结构 = components/ui/Button ghost（XMON-28/B3），几何正本仍是
// agent-detail.css 的 `.agent-model-select` / `.agent-model-row`（域 css
// unlayered，压 utility 层）。底座与散写形的差额在消费点就地并掉：
// `justify-start`（散写形是 flex-start，底座 justify-center）、`h-auto`
// （选择行没有定高，底座 h-8 会把它钉成 32px）、`font-normal`（底座
// font-medium）、`leading-[inherit]`（底座 text-sm 自带 20px 行高，散写形
// 走 preflight 的 `font: inherit`）、`[&_svg…]:size-3|3.5`（底座 size-4 会
// 盖过图标自己的 width/height 属性）。

import { useState } from 'react';
import { Button } from '../components/ui/button.js';
import { FloatingShell } from '../components/ui/floating-shell.js';
import type { ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { Check, ChevronDown } from '../icons/index.js';
import { ClickCatcher } from '../overlays/dismiss.js';

interface AgentModelSelectProps {
  /** 当前值（live = agent 记录真值；fixture = 场景记录）；null = 未设置模型。 */
  value: { provider: string; modelId: string } | null;
  options: ModelOption[];
  /** 选定回调；缺省 = fixture 律（调用面自行决定是否只做本地回显）。 */
  onPick?: (value: { provider: string; modelId: string } | null) => void;
  /** 类名前缀——两个消费点的 e2e 各自钉自己的钩子，几何也各归各的域 CSS：
   *  概览 tab = `agent-model`，创建弹窗 = `dlg-agent-model`。 */
  prefix: string;
}

export function AgentModelSelect({ value, options, onPick, prefix }: AgentModelSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [wrap, setWrap] = useState<HTMLSpanElement | null>(null);
  const current =
    value == null
      ? undefined
      : options.find((row) => row.provider === value.provider && row.modelId === value.modelId);
  // 值回显：选项命中 → 模型名；未命中（provider 已被改名/删除）→ 裸串兜底，
  // 不空白不崩（chief 选择器同律）。
  const label =
    value == null ? t('未设置模型') : (current?.modelName ?? `${value.provider}/${value.modelId}`);

  const pick = (next: { provider: string; modelId: string } | null) => {
    setOpen(false); // accept 律：选择即关；真值经 invalidateAll 重取回显
    onPick?.(next);
  };

  return (
    <span className={`${prefix}-wrap`} ref={setWrap}>
      <Button
        variant="ghost"
        className={`${prefix}-select justify-start font-normal leading-[inherit] [&_svg:not([class*='size-'])]:size-3`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{label}</span>
        <ChevronDown width={12} height={12} />
      </Button>
      <FloatingShell
        open={open}
        onClose={() => setOpen(false)}
        container={wrap}
        className={`${prefix}-shell`}
      >
        <ClickCatcher onClose={() => setOpen(false)} />
        <div className={`${prefix}-menu anim-pop`} role="listbox" aria-label={t('模型')}>
          <Button
            variant="ghost"
            className={`${prefix}-row justify-start h-auto font-normal leading-[inherit] [&_svg:not([class*='size-'])]:size-3.5`}
            role="option"
            aria-selected={value == null}
            onClick={() => pick(null)}
          >
            <span className={`${prefix}-row-name`}>{t('未设置模型')}</span>
            {value == null && (
              <span className={`${prefix}-check`}>
                <Check width={14} height={14} />
              </span>
            )}
          </Button>
          {options.map((row) => {
            const selected = current?.provider === row.provider && current.modelId === row.modelId;
            return (
              <Button
                key={`${row.provider}/${row.modelId}`}
                variant="ghost"
                className={`${prefix}-row justify-start h-auto font-normal leading-[inherit] [&_svg:not([class*='size-'])]:size-3.5`}
                role="option"
                aria-selected={selected}
                onClick={() => pick({ provider: row.provider, modelId: row.modelId })}
              >
                <span className={`${prefix}-row-name`}>{row.modelName}</span>
                <span className={`${prefix}-row-provider`}>{row.providerLabel}</span>
                {selected && (
                  <span className={`${prefix}-check`}>
                    <Check width={14} height={14} />
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </FloatingShell>
    </span>
  );
}
