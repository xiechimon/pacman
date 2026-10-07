# #988 候选色板对比度实测报告

WCAG 2.1 亮度比，逐对实测（gen-palettes.mjs 内联数学计算，非估计；数学以
variant-C 自检对封版正本逐字节复核，见文末）。threshold 4.5 = 正文 AA；
3 = 大字号/UI 组件/图形对象；1.5 = 发丝线可辨性（report-only）。
FIXED = 首测未过、按「只动感知明度」自动修正后复测通过（hue/chroma 保持）。

## D · 冷瓷靛 Porcelain Indigo

| mode | pair | label | threshold | measured | result |
| --- | --- | --- | --- | --- | --- |
| dark | `--foreground on --background` | body text on page bg | 4.5 | 14.45:1 | PASS |
| dark | `--foreground on --card` | body text on card | 4.5 | 13.38:1 | PASS |
| dark | `--foreground on --popover` | body text on popover | 4.5 | 13.38:1 | PASS |
| dark | `--foreground on --muted` | body text on muted/code bg | 4.5 | 12.24:1 | PASS |
| dark | `--text-secondary on --background` | secondary text on page bg | 4.5 | 11.05:1 | PASS |
| dark | `--text-secondary on --card` | secondary text on card | 4.5 | 10.23:1 | PASS |
| dark | `--text-tertiary on --background` | tertiary/meta text on page bg | 4.5 | 7.84:1 | PASS |
| dark | `--text-tertiary on --card` | tertiary/meta text on card | 4.5 | 7.25:1 | PASS |
| dark | `--muted-foreground on --card` | muted-foreground on card | 4.5 | 7.25:1 | PASS |
| dark | `--muted-foreground on --background` | muted-foreground on page bg | 4.5 | 7.84:1 | PASS |
| dark | `--text-dim on --background` | dim (decorative) on page bg | 3 | 3.77:1 | PASS |
| dark | `--primary-foreground on --primary` | primary button label | 4.5 | 14.45:1 | PASS |
| dark | `--text-on-accent on --card-button` | brand solid-fill label | 4.5 | 8.77:1 | PASS |
| dark | `--spot-text-on-tint on --spot-soft` | selected-row text on spot tint | 4.5 | 6.99:1 | PASS |
| dark | `--chip-idle-fg on --chip-idle-bg` | chip idle | 4.5 | 6.64:1 | PASS |
| dark | `--chip-confirm-fg on --chip-confirm-bg` | chip confirm | 4.5 | 7.57:1 | PASS |
| dark | `--chip-done-fg on --chip-done-bg` | chip done | 4.5 | 7.8:1 | PASS |
| dark | `--chip-failed-fg on --chip-failed-bg` | chip failed | 4.5 | 7.52:1 | PASS |
| dark | `--badge-attention-fg on --badge-attention` | attention pill digit | 4.5 | 6.57:1 | PASS |
| dark | `--project-avatar-fg on --project-avatar-bg` | project initial avatar | 4.5 | 6.52:1 | PASS |
| dark | `--destructive-foreground on --destructive` | destructive label | 4.5 | 7.52:1 | PASS |
| dark | `--col-dot-idle on --background` | column dot idle (graphical) | 3 | 8.89:1 | PASS |
| dark | `--col-dot-confirm on --background` | column dot confirm (decorative, label-carried) | 3 | 8.64:1 | report-only (8.64:1) |
| dark | `--col-dot-building on --background` | column dot building (graphical) | 3 | 9.02:1 | PASS |
| dark | `--col-dot-done on --background` | column dot done (graphical) | 3 | 9.3:1 | PASS |
| dark | `--focus-ring on --background` | focus ring (UI component) | 3 | 8.77:1 | PASS |
| dark | `--focus-ring on --card` | focus ring on card (UI component) | 3 | 8.11:1 | PASS |
| dark | `--menu-icon on --popover` | menu row icon (UI component) | 3 | 3.49:1 | PASS |
| dark | `--stop on --background` | stop button red (UI component) | 3 | 9.74:1 | PASS |
| dark | `--fail-fg on --card` | fail message text | 4.5 | 9.11:1 | PASS |
| dark | `--diff-add-fg on --diff-add-bg` | diff add stat | 4.5 | 5.96:1 | PASS |
| dark | `--border-strong on --background` | hairline border legibility (report-only) | 1.5 | 1.58:1 | report-only (1.58:1) |
| light | `--foreground on --background` | body text on page bg | 4.5 | 17.27:1 | PASS |
| light | `--foreground on --card` | body text on card | 4.5 | 16.37:1 | PASS |
| light | `--foreground on --popover` | body text on popover | 4.5 | 16.37:1 | PASS |
| light | `--foreground on --muted` | body text on muted/code bg | 4.5 | 15.39:1 | PASS |
| light | `--text-secondary on --background` | secondary text on page bg | 4.5 | 11.49:1 | PASS |
| light | `--text-secondary on --card` | secondary text on card | 4.5 | 10.89:1 | PASS |
| light | `--text-tertiary on --background` | tertiary/meta text on page bg | 4.5 | 6.77:1 | PASS |
| light | `--text-tertiary on --card` | tertiary/meta text on card | 4.5 | 6.42:1 | PASS |
| light | `--muted-foreground on --card` | muted-foreground on card | 4.5 | 10.89:1 | PASS |
| light | `--muted-foreground on --background` | muted-foreground on page bg | 4.5 | 11.49:1 | PASS |
| light | `--text-dim on --background` | dim (decorative) on page bg | 3 | 3.05:1 | FIXED (5 steps) |
| light | ↳ | fg #9c9fa1 (2.41) → #8a8c8f | | | |
| light | `--primary-foreground on --primary` | primary button label | 4.5 | 18.27:1 | PASS |
| light | `--text-on-accent on --card-button` | brand solid-fill label | 4.5 | 6.99:1 | PASS |
| light | `--spot-text-on-tint on --spot-soft` | selected-row text on spot tint | 4.5 | 7.74:1 | PASS |
| light | `--chip-idle-fg on --chip-idle-bg` | chip idle | 4.5 | 6.04:1 | PASS |
| light | `--chip-confirm-fg on --chip-confirm-bg` | chip confirm | 4.5 | 5.5:1 | PASS |
| light | `--chip-done-fg on --chip-done-bg` | chip done | 4.5 | 8.4:1 | PASS |
| light | `--chip-failed-fg on --chip-failed-bg` | chip failed | 4.5 | 8.84:1 | PASS |
| light | `--badge-attention-fg on --badge-attention` | attention pill digit | 4.5 | 6.44:1 | PASS |
| light | `--project-avatar-fg on --project-avatar-bg` | project initial avatar | 4.5 | 4.54:1 | FIXED (8 steps) |
| light | ↳ | fg #4e220b (3.43) → #2f0d00 | | | |
| light | `--destructive-foreground on --destructive` | destructive label | 4.5 | 7.26:1 | PASS |
| light | `--col-dot-idle on --background` | column dot idle (graphical) | 3 | 6.05:1 | PASS |
| light | `--col-dot-confirm on --background` | column dot confirm (decorative, label-carried) | 3 | 1.75:1 | report-only (1.75:1) |
| light | `--col-dot-building on --background` | column dot building (graphical) | 3 | 5.93:1 | PASS |
| light | `--col-dot-done on --background` | column dot done (graphical) | 3 | 5.66:1 | PASS |
| light | `--focus-ring on --background` | focus ring (UI component) | 3 | 6.33:1 | PASS |
| light | `--focus-ring on --card` | focus ring on card (UI component) | 3 | 6:1 | PASS |
| light | `--menu-icon on --popover` | menu row icon (UI component) | 3 | 16.37:1 | PASS |
| light | `--stop on --background` | stop button red (UI component) | 3 | 6.58:1 | PASS |
| light | `--fail-fg on --card` | fail message text | 4.5 | 7.01:1 | PASS |
| light | `--diff-add-fg on --diff-add-bg` | diff add stat | 4.5 | 6.47:1 | PASS |
| light | `--border-strong on --background` | hairline border legibility (report-only) | 1.5 | 1.52:1 | report-only (1.52:1) |

未过对数：**0**（全部实测达标）

## E · 暖灰玫 Ash Rose

| mode | pair | label | threshold | measured | result |
| --- | --- | --- | --- | --- | --- |
| dark | `--foreground on --background` | body text on page bg | 4.5 | 14.08:1 | PASS |
| dark | `--foreground on --card` | body text on card | 4.5 | 13:1 | PASS |
| dark | `--foreground on --popover` | body text on popover | 4.5 | 13:1 | PASS |
| dark | `--foreground on --muted` | body text on muted/code bg | 4.5 | 11.87:1 | PASS |
| dark | `--text-secondary on --background` | secondary text on page bg | 4.5 | 10.95:1 | PASS |
| dark | `--text-secondary on --card` | secondary text on card | 4.5 | 10.11:1 | PASS |
| dark | `--text-tertiary on --background` | tertiary/meta text on page bg | 4.5 | 7.78:1 | PASS |
| dark | `--text-tertiary on --card` | tertiary/meta text on card | 4.5 | 7.18:1 | PASS |
| dark | `--muted-foreground on --card` | muted-foreground on card | 4.5 | 7.18:1 | PASS |
| dark | `--muted-foreground on --background` | muted-foreground on page bg | 4.5 | 7.78:1 | PASS |
| dark | `--text-dim on --background` | dim (decorative) on page bg | 3 | 3.74:1 | PASS |
| dark | `--primary-foreground on --primary` | primary button label | 4.5 | 14.08:1 | PASS |
| dark | `--text-on-accent on --card-button` | brand solid-fill label | 4.5 | 8.14:1 | PASS |
| dark | `--spot-text-on-tint on --spot-soft` | selected-row text on spot tint | 4.5 | 6.62:1 | PASS |
| dark | `--chip-idle-fg on --chip-idle-bg` | chip idle | 4.5 | 6.56:1 | PASS |
| dark | `--chip-confirm-fg on --chip-confirm-bg` | chip confirm | 4.5 | 7.6:1 | PASS |
| dark | `--chip-done-fg on --chip-done-bg` | chip done | 4.5 | 7.8:1 | PASS |
| dark | `--chip-failed-fg on --chip-failed-bg` | chip failed | 4.5 | 7.53:1 | PASS |
| dark | `--badge-attention-fg on --badge-attention` | attention pill digit | 4.5 | 6.59:1 | PASS |
| dark | `--project-avatar-fg on --project-avatar-bg` | project initial avatar | 4.5 | 6.58:1 | PASS |
| dark | `--destructive-foreground on --destructive` | destructive label | 4.5 | 7.53:1 | PASS |
| dark | `--col-dot-idle on --background` | column dot idle (graphical) | 3 | 8.65:1 | PASS |
| dark | `--col-dot-confirm on --background` | column dot confirm (decorative, label-carried) | 3 | 8.5:1 | report-only (8.5:1) |
| dark | `--col-dot-building on --background` | column dot building (graphical) | 3 | 8.85:1 | PASS |
| dark | `--col-dot-done on --background` | column dot done (graphical) | 3 | 9.11:1 | PASS |
| dark | `--focus-ring on --background` | focus ring (UI component) | 3 | 8.14:1 | PASS |
| dark | `--focus-ring on --card` | focus ring on card (UI component) | 3 | 7.52:1 | PASS |
| dark | `--menu-icon on --popover` | menu row icon (UI component) | 3 | 3.45:1 | PASS |
| dark | `--stop on --background` | stop button red (UI component) | 3 | 9.58:1 | PASS |
| dark | `--fail-fg on --card` | fail message text | 4.5 | 8.92:1 | PASS |
| dark | `--diff-add-fg on --diff-add-bg` | diff add stat | 4.5 | 5.96:1 | PASS |
| dark | `--border-strong on --background` | hairline border legibility (report-only) | 1.5 | 1.57:1 | report-only (1.57:1) |
| light | `--foreground on --background` | body text on page bg | 4.5 | 17.03:1 | PASS |
| light | `--foreground on --card` | body text on card | 4.5 | 16.14:1 | PASS |
| light | `--foreground on --popover` | body text on popover | 4.5 | 16.14:1 | PASS |
| light | `--foreground on --muted` | body text on muted/code bg | 4.5 | 15.17:1 | PASS |
| light | `--text-secondary on --background` | secondary text on page bg | 4.5 | 11.32:1 | PASS |
| light | `--text-secondary on --card` | secondary text on card | 4.5 | 10.73:1 | PASS |
| light | `--text-tertiary on --background` | tertiary/meta text on page bg | 4.5 | 6.66:1 | PASS |
| light | `--text-tertiary on --card` | tertiary/meta text on card | 4.5 | 6.31:1 | PASS |
| light | `--muted-foreground on --card` | muted-foreground on card | 4.5 | 10.73:1 | PASS |
| light | `--muted-foreground on --background` | muted-foreground on page bg | 4.5 | 11.32:1 | PASS |
| light | `--text-dim on --background` | dim (decorative) on page bg | 3 | 3.08:1 | FIXED (5 steps) |
| light | ↳ | fg #a19c97 (2.42) → #8f8985 | | | |
| light | `--primary-foreground on --primary` | primary button label | 4.5 | 18.31:1 | PASS |
| light | `--text-on-accent on --card-button` | brand solid-fill label | 4.5 | 7.38:1 | PASS |
| light | `--spot-text-on-tint on --spot-soft` | selected-row text on spot tint | 4.5 | 7.74:1 | PASS |
| light | `--chip-idle-fg on --chip-idle-bg` | chip idle | 4.5 | 5.94:1 | PASS |
| light | `--chip-confirm-fg on --chip-confirm-bg` | chip confirm | 4.5 | 5.53:1 | PASS |
| light | `--chip-done-fg on --chip-done-bg` | chip done | 4.5 | 8.4:1 | PASS |
| light | `--chip-failed-fg on --chip-failed-bg` | chip failed | 4.5 | 8.88:1 | PASS |
| light | `--badge-attention-fg on --badge-attention` | attention pill digit | 4.5 | 6.46:1 | PASS |
| light | `--project-avatar-fg on --project-avatar-bg` | project initial avatar | 4.5 | 4.51:1 | FIXED (8 steps) |
| light | ↳ | fg #4f210e (3.42) → #310b00 | | | |
| light | `--destructive-foreground on --destructive` | destructive label | 4.5 | 7.22:1 | PASS |
| light | `--col-dot-idle on --background` | column dot idle (graphical) | 3 | 6.01:1 | PASS |
| light | `--col-dot-confirm on --background` | column dot confirm (decorative, label-carried) | 3 | 1.71:1 | report-only (1.71:1) |
| light | `--col-dot-building on --background` | column dot building (graphical) | 3 | 5.87:1 | PASS |
| light | `--col-dot-done on --background` | column dot done (graphical) | 3 | 5.57:1 | PASS |
| light | `--focus-ring on --background` | focus ring (UI component) | 3 | 6.57:1 | PASS |
| light | `--focus-ring on --card` | focus ring on card (UI component) | 3 | 6.23:1 | PASS |
| light | `--menu-icon on --popover` | menu row icon (UI component) | 3 | 16.14:1 | PASS |
| light | `--stop on --background` | stop button red (UI component) | 3 | 6.43:1 | PASS |
| light | `--fail-fg on --card` | fail message text | 4.5 | 6.9:1 | PASS |
| light | `--diff-add-fg on --diff-add-bg` | diff add stat | 4.5 | 6.47:1 | PASS |
| light | `--border-strong on --background` | hairline border legibility (report-only) | 1.5 | 1.52:1 | report-only (1.52:1) |

未过对数：**0**（全部实测达标）

## F · 石墨青 Signal Graphite

| mode | pair | label | threshold | measured | result |
| --- | --- | --- | --- | --- | --- |
| dark | `--foreground on --background` | body text on page bg | 4.5 | 14.78:1 | PASS |
| dark | `--foreground on --card` | body text on card | 4.5 | 13.74:1 | PASS |
| dark | `--foreground on --popover` | body text on popover | 4.5 | 13.74:1 | PASS |
| dark | `--foreground on --muted` | body text on muted/code bg | 4.5 | 12.64:1 | PASS |
| dark | `--text-secondary on --background` | secondary text on page bg | 4.5 | 11.37:1 | PASS |
| dark | `--text-secondary on --card` | secondary text on card | 4.5 | 10.57:1 | PASS |
| dark | `--text-tertiary on --background` | tertiary/meta text on page bg | 4.5 | 7.9:1 | PASS |
| dark | `--text-tertiary on --card` | tertiary/meta text on card | 4.5 | 7.35:1 | PASS |
| dark | `--muted-foreground on --card` | muted-foreground on card | 4.5 | 7.35:1 | PASS |
| dark | `--muted-foreground on --background` | muted-foreground on page bg | 4.5 | 7.9:1 | PASS |
| dark | `--text-dim on --background` | dim (decorative) on page bg | 3 | 3.68:1 | PASS |
| dark | `--primary-foreground on --primary` | primary button label | 4.5 | 14.78:1 | PASS |
| dark | `--text-on-accent on --card-button` | brand solid-fill label | 4.5 | 9.61:1 | PASS |
| dark | `--spot-text-on-tint on --spot-soft` | selected-row text on spot tint | 4.5 | 7.63:1 | PASS |
| dark | `--chip-idle-fg on --chip-idle-bg` | chip idle | 4.5 | 6.76:1 | PASS |
| dark | `--chip-confirm-fg on --chip-confirm-bg` | chip confirm | 4.5 | 7.6:1 | PASS |
| dark | `--chip-done-fg on --chip-done-bg` | chip done | 4.5 | 7.8:1 | PASS |
| dark | `--chip-failed-fg on --chip-failed-bg` | chip failed | 4.5 | 7.55:1 | PASS |
| dark | `--badge-attention-fg on --badge-attention` | attention pill digit | 4.5 | 6.59:1 | PASS |
| dark | `--project-avatar-fg on --project-avatar-bg` | project initial avatar | 4.5 | 6.54:1 | PASS |
| dark | `--destructive-foreground on --destructive` | destructive label | 4.5 | 7.55:1 | PASS |
| dark | `--col-dot-idle on --background` | column dot idle (graphical) | 3 | 9.11:1 | PASS |
| dark | `--col-dot-confirm on --background` | column dot confirm (decorative, label-carried) | 3 | 8.87:1 | report-only (8.87:1) |
| dark | `--col-dot-building on --background` | column dot building (graphical) | 3 | 9.27:1 | PASS |
| dark | `--col-dot-done on --background` | column dot done (graphical) | 3 | 9.63:1 | PASS |
| dark | `--focus-ring on --background` | focus ring (UI component) | 3 | 9.61:1 | PASS |
| dark | `--focus-ring on --card` | focus ring on card (UI component) | 3 | 8.93:1 | PASS |
| dark | `--menu-icon on --popover` | menu row icon (UI component) | 3 | 3.42:1 | PASS |
| dark | `--stop on --background` | stop button red (UI component) | 3 | 10.01:1 | PASS |
| dark | `--fail-fg on --card` | fail message text | 4.5 | 9.41:1 | PASS |
| dark | `--diff-add-fg on --diff-add-bg` | diff add stat | 4.5 | 6.02:1 | PASS |
| dark | `--border-strong on --background` | hairline border legibility (report-only) | 1.5 | 1.55:1 | report-only (1.55:1) |
| light | `--foreground on --background` | body text on page bg | 4.5 | 17.25:1 | PASS |
| light | `--foreground on --card` | body text on card | 4.5 | 16.35:1 | PASS |
| light | `--foreground on --popover` | body text on popover | 4.5 | 16.35:1 | PASS |
| light | `--foreground on --muted` | body text on muted/code bg | 4.5 | 15.47:1 | PASS |
| light | `--text-secondary on --background` | secondary text on page bg | 4.5 | 11.4:1 | PASS |
| light | `--text-secondary on --card` | secondary text on card | 4.5 | 10.81:1 | PASS |
| light | `--text-tertiary on --background` | tertiary/meta text on page bg | 4.5 | 6.72:1 | PASS |
| light | `--text-tertiary on --card` | tertiary/meta text on card | 4.5 | 6.37:1 | PASS |
| light | `--muted-foreground on --card` | muted-foreground on card | 4.5 | 10.81:1 | PASS |
| light | `--muted-foreground on --background` | muted-foreground on page bg | 4.5 | 11.4:1 | PASS |
| light | `--text-dim on --background` | dim (decorative) on page bg | 3 | 3.03:1 | FIXED (5 steps) |
| light | ↳ | fg #9d9ea0 (2.41) → #8b8c8e | | | |
| light | `--primary-foreground on --primary` | primary button label | 4.5 | 18.34:1 | PASS |
| light | `--text-on-accent on --card-button` | brand solid-fill label | 4.5 | 6.42:1 | PASS |
| light | `--spot-text-on-tint on --spot-soft` | selected-row text on spot tint | 4.5 | 7.27:1 | PASS |
| light | `--chip-idle-fg on --chip-idle-bg` | chip idle | 4.5 | 6.03:1 | PASS |
| light | `--chip-confirm-fg on --chip-confirm-bg` | chip confirm | 4.5 | 5.5:1 | PASS |
| light | `--chip-done-fg on --chip-done-bg` | chip done | 4.5 | 8.31:1 | PASS |
| light | `--chip-failed-fg on --chip-failed-bg` | chip failed | 4.5 | 8.88:1 | PASS |
| light | `--badge-attention-fg on --badge-attention` | attention pill digit | 4.5 | 6.43:1 | PASS |
| light | `--project-avatar-fg on --project-avatar-bg` | project initial avatar | 4.5 | 4.52:1 | FIXED (8 steps) |
| light | ↳ | fg #4f2109 (3.43) → #2f0d00 | | | |
| light | `--destructive-foreground on --destructive` | destructive label | 4.5 | 7.27:1 | PASS |
| light | `--col-dot-idle on --background` | column dot idle (graphical) | 3 | 6.04:1 | PASS |
| light | `--col-dot-confirm on --background` | column dot confirm (decorative, label-carried) | 3 | 1.74:1 | report-only (1.74:1) |
| light | `--col-dot-building on --background` | column dot building (graphical) | 3 | 5.9:1 | PASS |
| light | `--col-dot-done on --background` | column dot done (graphical) | 3 | 5.64:1 | PASS |
| light | `--focus-ring on --background` | focus ring (UI component) | 3 | 5.78:1 | PASS |
| light | `--focus-ring on --card` | focus ring on card (UI component) | 3 | 5.48:1 | PASS |
| light | `--menu-icon on --popover` | menu row icon (UI component) | 3 | 16.35:1 | PASS |
| light | `--stop on --background` | stop button red (UI component) | 3 | 6.55:1 | PASS |
| light | `--fail-fg on --card` | fail message text | 4.5 | 6.95:1 | PASS |
| light | `--diff-add-fg on --diff-add-bg` | diff add stat | 4.5 | 6.4:1 | PASS |
| light | `--border-strong on --background` | hairline border legibility (report-only) | 1.5 | 1.51:1 | report-only (1.51:1) |

未过对数：**0**（全部实测达标）

---

# Variant-C self-test (inline color math vs sealed canon)

emitted literal slots compared: **166**
byte-identical: **155**
LSB-class (每通道 ±1，clamp/取整边界): **10**
real diffs: **1**

LSB-class residuals — canon 在 #909 实审中手调到 L≈0.3575（dark 控件档）
等 curve 外位置，候选版按结构等价继承（n(5)），残差 ≤1/通道，不可见：

| mode | slot | live (sealed) | generated |
| --- | --- | --- | --- |
| dark | `--input` | #3f3c36 | #403d37 |
| dark | `--surface-tertiary` | #3f3c36 | #403d37 |
| dark | `--border-strong` | #3f3c36 | #403d37 |
| dark | `--seg-active` | #3f3c36 | #403d37 |
| dark | `--range-chip-border` | #3f3c36 | #403d37 |
| dark | `--dialog-ring` | #3f3c36 | #403d37 |
| dark | `--dash-border` | #3f3c36 | #403d37 |
| dark | `--row-icon-bg` | #3f3c36 | #403d37 |
| dark | `--chief-tab-active` | #3f3c36 | #403d37 |
| dark | `--notify-icon-bg` | #3f3c36 | #403d37 |

| mode | slot | live (sealed) | generated |
| --- | --- | --- | --- |
| light | `--project-avatar-fg` | #310a00 | #2d0800 |
