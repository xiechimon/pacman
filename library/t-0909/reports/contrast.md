# 候选色板对比度实测报告（#909）

WCAG 2.1 亮度比，逐对实测（gen-palettes.mjs 计算，非估计）。
threshold 4.5 = 正文 AA；3 = 大字号/UI 组件/图形对象；1.5 = 发丝线可辨性（report-only）。
FIXED = 首测未过、按「只动明度」自动修正后复测通过。

## A · 石墨 Graphite

| mode | pair | label | threshold | measured | result |
| --- | --- | --- | --- | --- | --- |
| dark | `--foreground on --background` | body text on page bg | 4.5 | 13.81:1 | PASS |
| dark | `--foreground on --card` | body text on card | 4.5 | 12.74:1 | PASS |
| dark | `--foreground on --popover` | body text on popover | 4.5 | 12.74:1 | PASS |
| dark | `--foreground on --muted` | body text on muted/code bg | 4.5 | 11.72:1 | PASS |
| dark | `--text-secondary on --background` | secondary text on page bg | 4.5 | 10.69:1 | PASS |
| dark | `--text-secondary on --card` | secondary text on card | 4.5 | 9.86:1 | PASS |
| dark | `--text-tertiary on --background` | tertiary/meta text on page bg | 4.5 | 7.67:1 | PASS |
| dark | `--text-tertiary on --card` | tertiary/meta text on card | 4.5 | 7.08:1 | PASS |
| dark | `--muted-foreground on --card` | muted-foreground on card | 4.5 | 7.08:1 | PASS |
| dark | `--muted-foreground on --background` | muted-foreground on page bg | 4.5 | 7.67:1 | PASS |
| dark | `--text-dim on --background` | dim (decorative) on page bg | 3 | 3.73:1 | PASS |
| dark | `--primary-foreground on --primary` | primary button label | 4.5 | 13.81:1 | PASS |
| dark | `--text-on-accent on --card-button` | brand solid-fill label | 4.5 | 13.81:1 | PASS |
| dark | `--spot-text-on-tint on --spot-soft` | selected-row text on spot tint | 4.5 | 8.52:1 | PASS |
| dark | `--chip-idle-fg on --chip-idle-bg` | chip idle | 4.5 | 6.51:1 | PASS |
| dark | `--chip-confirm-fg on --chip-confirm-bg` | chip confirm | 4.5 | 7.57:1 | PASS |
| dark | `--chip-done-fg on --chip-done-bg` | chip done | 4.5 | 7.8:1 | PASS |
| dark | `--chip-failed-fg on --chip-failed-bg` | chip failed | 4.5 | 7.55:1 | PASS |
| dark | `--badge-attention-fg on --badge-attention` | attention pill digit | 4.5 | 6.57:1 | PASS |
| dark | `--project-avatar-fg on --project-avatar-bg` | project initial avatar | 4.5 | 6.52:1 | PASS |
| dark | `--destructive-foreground on --destructive` | destructive label | 4.5 | 7.55:1 | PASS |
| dark | `--col-dot-idle on --background` | column dot idle (graphical) | 3 | 8.48:1 | PASS |
| dark | `--col-dot-confirm on --background` | column dot confirm (decorative, label-carried) | 3 | 8.26:1 | report-only (8.26:1) |
| dark | `--col-dot-building on --background` | column dot building (graphical) | 3 | 8.49:1 | PASS |
| dark | `--col-dot-done on --background` | column dot done (graphical) | 3 | 8.89:1 | PASS |
| dark | `--focus-ring on --background` | focus ring (UI component) | 3 | 13.81:1 | PASS |
| dark | `--focus-ring on --card` | focus ring on card (UI component) | 3 | 12.74:1 | PASS |
| dark | `--menu-icon on --popover` | menu row icon (UI component) | 3 | 3.43:1 | PASS |
| dark | `--stop on --background` | stop button red (UI component) | 3 | 9.33:1 | PASS |
| dark | `--fail-fg on --card` | fail message text | 4.5 | 8.68:1 | PASS |
| dark | `--diff-add-fg on --diff-add-bg` | diff add stat | 4.5 | 5.96:1 | PASS |
| dark | `--border-strong on --background` | hairline border legibility (report-only) | 1.5 | 1.54:1 | FIXED (3 steps) |
| dark | ↳ | fg #333437 (1.34) → #3c3d40 | | | |
| light | `--foreground on --background` | body text on page bg | 4.5 | 17.28:1 | PASS |
| light | `--foreground on --card` | body text on card | 4.5 | 16.38:1 | PASS |
| light | `--foreground on --popover` | body text on popover | 4.5 | 16.38:1 | PASS |
| light | `--foreground on --muted` | body text on muted/code bg | 4.5 | 15.51:1 | PASS |
| light | `--text-secondary on --background` | secondary text on page bg | 4.5 | 11.4:1 | PASS |
| light | `--text-secondary on --card` | secondary text on card | 4.5 | 10.8:1 | PASS |
| light | `--text-tertiary on --background` | tertiary/meta text on page bg | 4.5 | 6.73:1 | PASS |
| light | `--text-tertiary on --card` | tertiary/meta text on card | 4.5 | 6.37:1 | PASS |
| light | `--muted-foreground on --card` | muted-foreground on card | 4.5 | 10.8:1 | PASS |
| light | `--muted-foreground on --background` | muted-foreground on page bg | 4.5 | 11.4:1 | PASS |
| light | `--text-dim on --background` | dim (decorative) on page bg | 3 | 3.03:1 | FIXED (5 steps) |
| light | ↳ | fg #9d9ea1 (2.41) → #8b8c8f | | | |
| light | `--primary-foreground on --primary` | primary button label | 4.5 | 18.37:1 | PASS |
| light | `--text-on-accent on --card-button` | brand solid-fill label | 4.5 | 19.18:1 | PASS |
| light | `--spot-text-on-tint on --spot-soft` | selected-row text on spot tint | 4.5 | 12.19:1 | PASS |
| light | `--chip-idle-fg on --chip-idle-bg` | chip idle | 4.5 | 6.04:1 | PASS |
| light | `--chip-confirm-fg on --chip-confirm-bg` | chip confirm | 4.5 | 5.5:1 | PASS |
| light | `--chip-done-fg on --chip-done-bg` | chip done | 4.5 | 8.4:1 | PASS |
| light | `--chip-failed-fg on --chip-failed-bg` | chip failed | 4.5 | 8.88:1 | PASS |
| light | `--badge-attention-fg on --badge-attention` | attention pill digit | 4.5 | 6.44:1 | PASS |
| light | `--project-avatar-fg on --project-avatar-bg` | project initial avatar | 4.5 | 4.54:1 | FIXED (8 steps) |
| light | ↳ | fg #4e220b (3.43) → #2f0d00 | | | |
| light | `--destructive-foreground on --destructive` | destructive label | 4.5 | 7.23:1 | PASS |
| light | `--col-dot-idle on --background` | column dot idle (graphical) | 3 | 5.98:1 | PASS |
| light | `--col-dot-confirm on --background` | column dot confirm (decorative, label-carried) | 3 | 1.74:1 | report-only (1.74:1) |
| light | `--col-dot-building on --background` | column dot building (graphical) | 3 | 6.06:1 | PASS |
| light | `--col-dot-done on --background` | column dot done (graphical) | 3 | 5.63:1 | PASS |
| light | `--focus-ring on --background` | focus ring (UI component) | 3 | 17.28:1 | PASS |
| light | `--focus-ring on --card` | focus ring on card (UI component) | 3 | 16.38:1 | PASS |
| light | `--menu-icon on --popover` | menu row icon (UI component) | 3 | 16.38:1 | PASS |
| light | `--stop on --background` | stop button red (UI component) | 3 | 6.52:1 | PASS |
| light | `--fail-fg on --card` | fail message text | 4.5 | 6.98:1 | PASS |
| light | `--diff-add-fg on --diff-add-bg` | diff add stat | 4.5 | 6.46:1 | PASS |
| light | `--border-strong on --background` | hairline border legibility (report-only) | 1.5 | 1.51:1 | PASS |

未过对数：**0**（全部实测达标）

## B · 青墨 Teal Ink

| mode | pair | label | threshold | measured | result |
| --- | --- | --- | --- | --- | --- |
| dark | `--foreground on --background` | body text on page bg | 4.5 | 14.55:1 | PASS |
| dark | `--foreground on --card` | body text on card | 4.5 | 13.48:1 | PASS |
| dark | `--foreground on --popover` | body text on popover | 4.5 | 13.48:1 | PASS |
| dark | `--foreground on --muted` | body text on muted/code bg | 4.5 | 12.23:1 | PASS |
| dark | `--text-secondary on --background` | secondary text on page bg | 4.5 | 11.12:1 | PASS |
| dark | `--text-secondary on --card` | secondary text on card | 4.5 | 10.3:1 | PASS |
| dark | `--text-tertiary on --background` | tertiary/meta text on page bg | 4.5 | 7.88:1 | PASS |
| dark | `--text-tertiary on --card` | tertiary/meta text on card | 4.5 | 7.3:1 | PASS |
| dark | `--muted-foreground on --card` | muted-foreground on card | 4.5 | 7.3:1 | PASS |
| dark | `--muted-foreground on --background` | muted-foreground on page bg | 4.5 | 7.88:1 | PASS |
| dark | `--text-dim on --background` | dim (decorative) on page bg | 3 | 3.79:1 | PASS |
| dark | `--primary-foreground on --primary` | primary button label | 4.5 | 14.55:1 | PASS |
| dark | `--text-on-accent on --card-button` | brand solid-fill label | 4.5 | 9.39:1 | PASS |
| dark | `--spot-text-on-tint on --spot-soft` | selected-row text on spot tint | 4.5 | 7.39:1 | PASS |
| dark | `--chip-idle-fg on --chip-idle-bg` | chip idle | 4.5 | 6.63:1 | PASS |
| dark | `--chip-confirm-fg on --chip-confirm-bg` | chip confirm | 4.5 | 7.56:1 | PASS |
| dark | `--chip-done-fg on --chip-done-bg` | chip done | 4.5 | 7.8:1 | PASS |
| dark | `--chip-failed-fg on --chip-failed-bg` | chip failed | 4.5 | 7.55:1 | PASS |
| dark | `--badge-attention-fg on --badge-attention` | attention pill digit | 4.5 | 6.59:1 | PASS |
| dark | `--project-avatar-fg on --project-avatar-bg` | project initial avatar | 4.5 | 6.54:1 | PASS |
| dark | `--destructive-foreground on --destructive` | destructive label | 4.5 | 7.55:1 | PASS |
| dark | `--col-dot-idle on --background` | column dot idle (graphical) | 3 | 8.95:1 | PASS |
| dark | `--col-dot-confirm on --background` | column dot confirm (decorative, label-carried) | 3 | 8.71:1 | report-only (8.71:1) |
| dark | `--col-dot-building on --background` | column dot building (graphical) | 3 | 9.06:1 | PASS |
| dark | `--col-dot-done on --background` | column dot done (graphical) | 3 | 9.41:1 | PASS |
| dark | `--focus-ring on --background` | focus ring (UI component) | 3 | 9.39:1 | PASS |
| dark | `--focus-ring on --card` | focus ring on card (UI component) | 3 | 8.7:1 | PASS |
| dark | `--menu-icon on --popover` | menu row icon (UI component) | 3 | 3.52:1 | PASS |
| dark | `--stop on --background` | stop button red (UI component) | 3 | 9.81:1 | PASS |
| dark | `--fail-fg on --card` | fail message text | 4.5 | 9.17:1 | PASS |
| dark | `--diff-add-fg on --diff-add-bg` | diff add stat | 4.5 | 6.02:1 | PASS |
| dark | `--border-strong on --background` | hairline border legibility (report-only) | 1.5 | 1.52:1 | FIXED (3 steps) |
| dark | ↳ | fg #2c3134 (1.33) → #353a3d | | | |
| light | `--foreground on --background` | body text on page bg | 4.5 | 17.53:1 | PASS |
| light | `--foreground on --card` | body text on card | 4.5 | 16.65:1 | PASS |
| light | `--foreground on --popover` | body text on popover | 4.5 | 16.65:1 | PASS |
| light | `--foreground on --muted` | body text on muted/code bg | 4.5 | 15.73:1 | PASS |
| light | `--text-secondary on --background` | secondary text on page bg | 4.5 | 11.56:1 | PASS |
| light | `--text-secondary on --card` | secondary text on card | 4.5 | 10.98:1 | PASS |
| light | `--text-tertiary on --background` | tertiary/meta text on page bg | 4.5 | 6.69:1 | PASS |
| light | `--text-tertiary on --card` | tertiary/meta text on card | 4.5 | 6.35:1 | PASS |
| light | `--muted-foreground on --card` | muted-foreground on card | 4.5 | 10.98:1 | PASS |
| light | `--muted-foreground on --background` | muted-foreground on page bg | 4.5 | 11.56:1 | PASS |
| light | `--text-dim on --background` | dim (decorative) on page bg | 3 | 3.01:1 | FIXED (5 steps) |
| light | ↳ | fg #9ca1a3 (2.39) → #898f91 | | | |
| light | `--primary-foreground on --primary` | primary button label | 4.5 | 18.32:1 | PASS |
| light | `--text-on-accent on --card-button` | brand solid-fill label | 4.5 | 6.44:1 | PASS |
| light | `--spot-text-on-tint on --spot-soft` | selected-row text on spot tint | 4.5 | 7.3:1 | PASS |
| light | `--chip-idle-fg on --chip-idle-bg` | chip idle | 4.5 | 6:1 | PASS |
| light | `--chip-confirm-fg on --chip-confirm-bg` | chip confirm | 4.5 | 5.55:1 | PASS |
| light | `--chip-done-fg on --chip-done-bg` | chip done | 4.5 | 8.31:1 | PASS |
| light | `--chip-failed-fg on --chip-failed-bg` | chip failed | 4.5 | 8.87:1 | PASS |
| light | `--badge-attention-fg on --badge-attention` | attention pill digit | 4.5 | 6.42:1 | PASS |
| light | `--project-avatar-fg on --project-avatar-bg` | project initial avatar | 4.5 | 4.52:1 | FIXED (8 steps) |
| light | ↳ | fg #4f2109 (3.43) → #2f0d00 | | | |
| light | `--destructive-foreground on --destructive` | destructive label | 4.5 | 7.25:1 | PASS |
| light | `--col-dot-idle on --background` | column dot idle (graphical) | 3 | 6.11:1 | PASS |
| light | `--col-dot-confirm on --background` | column dot confirm (decorative, label-carried) | 3 | 1.77:1 | report-only (1.77:1) |
| light | `--col-dot-building on --background` | column dot building (graphical) | 3 | 6.01:1 | PASS |
| light | `--col-dot-done on --background` | column dot done (graphical) | 3 | 5.75:1 | PASS |
| light | `--focus-ring on --background` | focus ring (UI component) | 3 | 5.9:1 | PASS |
| light | `--focus-ring on --card` | focus ring on card (UI component) | 3 | 5.61:1 | PASS |
| light | `--menu-icon on --popover` | menu row icon (UI component) | 3 | 16.65:1 | PASS |
| light | `--stop on --background` | stop button red (UI component) | 3 | 6.65:1 | PASS |
| light | `--fail-fg on --card` | fail message text | 4.5 | 7.09:1 | PASS |
| light | `--diff-add-fg on --diff-add-bg` | diff add stat | 4.5 | 6.4:1 | PASS |
| light | `--border-strong on --background` | hairline border legibility (report-only) | 1.5 | 1.5:1 | PASS |

未过对数：**0**（全部实测达标）

## C · 纸兰 Paper Orchid

| mode | pair | label | threshold | measured | result |
| --- | --- | --- | --- | --- | --- |
| dark | `--foreground on --background` | body text on page bg | 4.5 | 14.17:1 | PASS |
| dark | `--foreground on --card` | body text on card | 4.5 | 13.09:1 | PASS |
| dark | `--foreground on --popover` | body text on popover | 4.5 | 13.09:1 | PASS |
| dark | `--foreground on --muted` | body text on muted/code bg | 4.5 | 11.81:1 | PASS |
| dark | `--text-secondary on --background` | secondary text on page bg | 4.5 | 11.05:1 | PASS |
| dark | `--text-secondary on --card` | secondary text on card | 4.5 | 10.2:1 | PASS |
| dark | `--text-tertiary on --background` | tertiary/meta text on page bg | 4.5 | 7.86:1 | PASS |
| dark | `--text-tertiary on --card` | tertiary/meta text on card | 4.5 | 7.25:1 | PASS |
| dark | `--muted-foreground on --card` | muted-foreground on card | 4.5 | 7.25:1 | PASS |
| dark | `--muted-foreground on --background` | muted-foreground on page bg | 4.5 | 7.86:1 | PASS |
| dark | `--text-dim on --background` | dim (decorative) on page bg | 3 | 3.75:1 | PASS |
| dark | `--primary-foreground on --primary` | primary button label | 4.5 | 14.17:1 | PASS |
| dark | `--text-on-accent on --card-button` | brand solid-fill label | 4.5 | 8.24:1 | PASS |
| dark | `--spot-text-on-tint on --spot-soft` | selected-row text on spot tint | 4.5 | 6.74:1 | PASS |
| dark | `--chip-idle-fg on --chip-idle-bg` | chip idle | 4.5 | 6.55:1 | PASS |
| dark | `--chip-confirm-fg on --chip-confirm-bg` | chip confirm | 4.5 | 7.6:1 | PASS |
| dark | `--chip-done-fg on --chip-done-bg` | chip done | 4.5 | 7.84:1 | PASS |
| dark | `--chip-failed-fg on --chip-failed-bg` | chip failed | 4.5 | 7.52:1 | PASS |
| dark | `--badge-attention-fg on --badge-attention` | attention pill digit | 4.5 | 6.59:1 | PASS |
| dark | `--project-avatar-fg on --project-avatar-bg` | project initial avatar | 4.5 | 6.55:1 | PASS |
| dark | `--destructive-foreground on --destructive` | destructive label | 4.5 | 7.52:1 | PASS |
| dark | `--col-dot-idle on --background` | column dot idle (graphical) | 3 | 8.73:1 | PASS |
| dark | `--col-dot-confirm on --background` | column dot confirm (decorative, label-carried) | 3 | 8.53:1 | report-only (8.53:1) |
| dark | `--col-dot-building on --background` | column dot building (graphical) | 3 | 8.87:1 | PASS |
| dark | `--col-dot-done on --background` | column dot done (graphical) | 3 | 9.19:1 | PASS |
| dark | `--focus-ring on --background` | focus ring (UI component) | 3 | 8.24:1 | PASS |
| dark | `--focus-ring on --card` | focus ring on card (UI component) | 3 | 7.61:1 | PASS |
| dark | `--menu-icon on --popover` | menu row icon (UI component) | 3 | 3.46:1 | PASS |
| dark | `--stop on --background` | stop button red (UI component) | 3 | 9.56:1 | PASS |
| dark | `--fail-fg on --card` | fail message text | 4.5 | 8.91:1 | PASS |
| dark | `--diff-add-fg on --diff-add-bg` | diff add stat | 4.5 | 6:1 | PASS |
| dark | `--border-strong on --background` | hairline border legibility (report-only) | 1.5 | 1.56:1 | FIXED (3 steps) |
| dark | ↳ | fg #36322d (1.35) → #3f3c36 | | | |
| light | `--foreground on --background` | body text on page bg | 4.5 | 16.71:1 | PASS |
| light | `--foreground on --card` | body text on card | 4.5 | 15.86:1 | PASS |
| light | `--foreground on --popover` | body text on popover | 4.5 | 15.86:1 | PASS |
| light | `--foreground on --muted` | body text on muted/code bg | 4.5 | 14.96:1 | PASS |
| light | `--text-secondary on --background` | secondary text on page bg | 4.5 | 11.3:1 | PASS |
| light | `--text-secondary on --card` | secondary text on card | 4.5 | 10.72:1 | PASS |
| light | `--text-tertiary on --background` | tertiary/meta text on page bg | 4.5 | 6.68:1 | PASS |
| light | `--text-tertiary on --card` | tertiary/meta text on card | 4.5 | 6.34:1 | PASS |
| light | `--muted-foreground on --card` | muted-foreground on card | 4.5 | 10.72:1 | PASS |
| light | `--muted-foreground on --background` | muted-foreground on page bg | 4.5 | 11.3:1 | PASS |
| light | `--text-dim on --background` | dim (decorative) on page bg | 3 | 3.05:1 | FIXED (5 steps) |
| light | ↳ | fg #9f9b92 (2.42) → #8d8980 | | | |
| light | `--primary-foreground on --primary` | primary button label | 4.5 | 18.32:1 | PASS |
| light | `--text-on-accent on --card-button` | brand solid-fill label | 4.5 | 7.41:1 | PASS |
| light | `--spot-text-on-tint on --spot-soft` | selected-row text on spot tint | 4.5 | 7.64:1 | PASS |
| light | `--chip-idle-fg on --chip-idle-bg` | chip idle | 4.5 | 5.98:1 | PASS |
| light | `--chip-confirm-fg on --chip-confirm-bg` | chip confirm | 4.5 | 5.53:1 | PASS |
| light | `--chip-done-fg on --chip-done-bg` | chip done | 4.5 | 8.38:1 | PASS |
| light | `--chip-failed-fg on --chip-failed-bg` | chip failed | 4.5 | 8.87:1 | PASS |
| light | `--badge-attention-fg on --badge-attention` | attention pill digit | 4.5 | 6.46:1 | PASS |
| light | `--project-avatar-fg on --project-avatar-bg` | project initial avatar | 4.5 | 4.5:1 | FIXED (8 steps) |
| light | ↳ | fg #4f2110 (3.40) → #310a00 | | | |
| light | `--destructive-foreground on --destructive` | destructive label | 4.5 | 7.25:1 | PASS |
| light | `--col-dot-idle on --background` | column dot idle (graphical) | 3 | 5.84:1 | PASS |
| light | `--col-dot-confirm on --background` | column dot confirm (decorative, label-carried) | 3 | 1.67:1 | report-only (1.67:1) |
| light | `--col-dot-building on --background` | column dot building (graphical) | 3 | 5.73:1 | PASS |
| light | `--col-dot-done on --background` | column dot done (graphical) | 3 | 5.51:1 | PASS |
| light | `--focus-ring on --background` | focus ring (UI component) | 3 | 6.47:1 | PASS |
| light | `--focus-ring on --card` | focus ring on card (UI component) | 3 | 6.14:1 | PASS |
| light | `--menu-icon on --popover` | menu row icon (UI component) | 3 | 15.86:1 | PASS |
| light | `--stop on --background` | stop button red (UI component) | 3 | 6.33:1 | PASS |
| light | `--fail-fg on --card` | fail message text | 4.5 | 6.72:1 | PASS |
| light | `--diff-add-fg on --diff-add-bg` | diff add stat | 4.5 | 6.45:1 | PASS |
| light | `--border-strong on --background` | hairline border legibility (report-only) | 1.5 | 1.52:1 | PASS |

未过对数：**0**（全部实测达标）
