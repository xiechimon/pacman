// Mention chip 家族皮肤（issue #311/#812，#948 per-face 清零自
// mention-picker.css 迁入）：transcript / doc pane（segments.tsx）与
// composer 确认 strip（composer-chips.tsx）共用的 kind-identity chip 面，
// 以及 picker 首层的 kind 图标 tile（mention-picker.tsx）。
//
// 形态 1:1 沿旧族：inline-flex + 2px 间距 + 1×6px 内垫 + 3px 圆角 +
// baseline 对齐 + 12px/500 字 + 无下划线（#675 todo chip 是 router Link）。
// **面色 = 实底封版槽对**（StatusChip §5.2 同形：bg/fg 各吃一个 §1.7/1.8
// 已实测槽）——chip 骑在 transcript / doc pane / composer strip 多种底上，
// 旧 15% 半透明 tint 形在亮模实测 4.0~4.3:1 不过文本 4.5
// （docs/verify/948/contrast-948.md 首轮 4 FAIL），按 #908
// comment-6001887439 裁决 2 换消费面槽引用改实底形；token 值一律不动。
//
// **色槽映射（#948 暂定正典，PR body + #908 报备）**：旧族是 P1 槽位清扫
// 漏网的硬编码冷色（indigo/purple/green/amber/sky，#915 翻值不波及），在
// C·纸兰暖色正典下无同名槽。按 base-ui-theme §2.5「indigo 回 spot 族」与
// F7「紫只许品牌/可点」映射到既有封版槽对：
//   todo（可点 Link，品牌位）→ --spot-soft / --spot-text-on-tint（6.74/7.64）
//   agent（绿身份保留）      → --chip-done-bg / -fg（7.84/8.38）
//   project（琥珀身份保留）  → --tile-orange-bg / -fg（7.6/5.53）
//   machine（蓝身份保留）    → --chip-idle-bg 底 + --col-dot-building 墨
//   （蓝只此一家、无封版蓝对；墨×底组合实测见 contrast-948.md）
//   skill / file（正典无第 6 色相可分配）→ --chip-idle-bg / -fg 中性
//   ——skill≡file 面色同族是本映射唯一的身份碰撞；正典补第 6 色相槽后各自
//   归位，已报 #908 裁决（token 增槽不在域票授权面内）。
// 对比度按验收模板第 3 项 better-colors 实测（contrast-948.md，48 配对）；
// 图标 tile（18% tint，非文本 3:1）沿用同一批墨槽——tile 底色是 tint 形，
// 但字形阈值 3:1 双主题全过，不需要实底化。

import { cn } from 'cn';

/** chip 基面（原 .mention-chip）。kind 为 null（无 scheme 的裸提及）也吃
 *  spot 族——旧基面即 indigo，正典已把 indigo 折叠进 spot。 */
const CHIP_BASE =
  'mention-chip mx-0.5 inline-flex items-center gap-0.5 rounded-[3px] bg-(--spot-soft) px-1.5 py-px align-baseline font-sans text-xs leading-[1.4] font-medium text-(--spot-text-on-tint) no-underline';

/** kind → 身份色 utility（twMerge 后位覆盖基面的 spot 对）。todo 不换色
 *  （基面即 spot），只带 pointer（旧 .mention-chip--todo cursor:pointer）。 */
const KIND_CHIP_CLS: Record<string, string> = {
  todo: 'cursor-pointer',
  agent: 'bg-(--chip-done-bg) text-(--chip-done-fg)',
  project: 'bg-(--tile-orange-bg) text-(--tile-orange-fg)',
  machine: 'bg-(--chip-idle-bg) text-(--col-dot-building)',
  skill: 'bg-(--chip-idle-bg) text-(--chip-idle-fg)',
  file: 'bg-(--chip-idle-bg) text-(--chip-idle-fg)',
};

/** 完整 chip 类串（含 `mention-chip--<kind>` 钩子类——e2e 的 toHaveClass /
 *  子代选择器载体，#910 别名残留合法）。 */
export function mentionChipClass(kind: string | null | undefined): string {
  if (kind == null || KIND_CHIP_CLS[kind] === undefined) return CHIP_BASE;
  return cn(CHIP_BASE, `mention-chip--${kind}`, KIND_CHIP_CLS[kind]);
}

/** picker 首层的 kind 图标 tile（原 .mention-row-icon + .mention-icon--*）：
 *  28px 圆角 6 tile，18% tint 底 + 身份色字形（非文本 3:1 面）。 */
const ICON_BASE =
  'inline-flex size-7 shrink-0 items-center justify-center rounded-[6px] bg-(--surface-tertiary) text-(--foreground)';

const KIND_ICON_CLS: Record<string, string> = {
  todo: 'bg-[color-mix(in_srgb,var(--spot-text-on-tint)_18%,transparent)] text-(--spot-text-on-tint)',
  skill: 'bg-[color-mix(in_srgb,var(--chip-idle-fg)_18%,transparent)] text-(--chip-idle-fg)',
  agent: 'bg-[color-mix(in_srgb,var(--col-dot-done)_18%,transparent)] text-(--col-dot-done)',
  project: 'bg-[color-mix(in_srgb,var(--tile-orange-fg)_18%,transparent)] text-(--tile-orange-fg)',
  machine:
    'bg-[color-mix(in_srgb,var(--col-dot-building)_18%,transparent)] text-(--col-dot-building)',
};

export function mentionIconClass(kind: string): string {
  return cn(ICON_BASE, `mention-icon--${kind}`, KIND_ICON_CLS[kind] ?? '');
}
