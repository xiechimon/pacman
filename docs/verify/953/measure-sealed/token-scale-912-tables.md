<!-- 本文件由 apps/web/e2e/measure-912.mjs 生成（#953 自 library/t-0909 随迁），勿手改。
     取数源 = apps/web/e2e/palette-c.css（#909 定版色板冻结副本）+ apps/web/src/styles/{shadcn,tokens}.css；
     对比度 = WCAG 2.1 亮度比，逐对实测。 -->

# #912 色槽映射实测表（生成物）

汇总：dark flip=0 unchanged=109 new=0 retired=2；
light flip=0 unchanged=109 new=0 retired=2。
AA 门控对（text 4.5 / ui 3）：dark 88 对全过，最低 3.46:1（menu-icon）；
light 88 对全过，最低 3.05:1（ring）。report-only = 软发丝线 / 装饰点 / 失能态 / 半透明 tint（非 AA 门控）。

## 组件件面实测（真实 shadcn 件消费多槽，量渲染对）

### 暗模 (dark)

| 组件件面 | 角色对 (fg on bg) | 实测 | 阈值 | 结果 | 备注 |
| --- | --- | --- | --- | --- | --- |
| Switch — unchecked (OFF) | `--foreground on --input` | 9.08:1 | 3 | PASS | thumb on track; OFF track = --input (dark renders bg-input/80 over surface) |
| Switch — checked (ON) | `--primary-foreground on --primary` | 14.17:1 | 3 | PASS | thumb on track |
| Switch — track state flip | `--input on --primary` | 9.08:1 | 3 | PASS | OFF→ON track color = primary state carrier (WCAG 1.4.11) |
| Input — border on page bg | `--input on --background` | 1.56:1 | 1.5 | PASS | field boundary hairline (state also carried by focus ring) |
| Button brand — label on fill | `--text-on-accent on --card-button` | 8.24:1 | 4.5 | PASS | brand solid-fill label |

### 亮模 (light)

| 组件件面 | 角色对 (fg on bg) | 实测 | 阈值 | 结果 | 备注 |
| --- | --- | --- | --- | --- | --- |
| Switch — unchecked (OFF) | `--background on --input` | 1.52:1 | 3 | below 3 | thumb on track; OFF track = --input (dark renders bg-input/80 over surface) |
| Switch — checked (ON) | `--background on --primary` | 16.71:1 | 3 | PASS | thumb on track |
| Switch — track state flip | `--input on --primary` | 11.03:1 | 3 | PASS | OFF→ON track color = primary state carrier (WCAG 1.4.11) |
| Input — border on page bg | `--input on --background` | 1.52:1 | 1.5 | PASS | field boundary hairline (state also carried by focus ring) |
| Button brand — label on fill | `--text-on-accent on --card-button` | 7.41:1 | 4.5 | PASS | brand solid-fill label |

## 已退役（#952 唯一解冻窗执行；名字仍留在冻结色板正本里，live 已删）

- `--toggle-track`：retired by #952 (consumer .dlg-toggle died with detail/overlays.css; → shadcn Switch)
- `--toggle-knob`：retired by #952 (consumers .dlg-toggle-knob + secondary.css died; → shadcn Switch)

## 暗模 (dark) 逐槽

| 槽位 | 状态 | 旧值 (shadcn 现行) | 新值 (c.css 定版) | 角色对 (fg on bg) | 实测 | 阈值 | 结果 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `--background` | 不变 | `#1e1b16` | `#1e1b16` | `--foreground on --background` | 14.17:1 | 4.5 | PASS |
| `--foreground` | 不变 | `#ede9e1` | `#ede9e1` | `--foreground on --background` | 14.17:1 | 4.5 | PASS |
| `--card` | 不变 | `#25221d` | `#25221d` | `--card-foreground on --card` | 13.09:1 | 4.5 | PASS |
| `--card-foreground` | 不变 | `#ede9e1` | `#ede9e1` | `--card-foreground on --card` | 13.09:1 | 4.5 | PASS |
| `--popover` | 不变 | `#25221d` | `#25221d` | `--popover-foreground on --popover` | 13.09:1 | 4.5 | PASS |
| `--popover-foreground` | 不变 | `#ede9e1` | `#ede9e1` | `--popover-foreground on --popover` | 13.09:1 | 4.5 | PASS |
| `--primary` | 不变 | `#ede9e1` | `#ede9e1` | `--primary-foreground on --primary` | 14.17:1 | 4.5 | PASS |
| `--primary-foreground` | 不变 | `#1e1b16` | `#1e1b16` | `--primary-foreground on --primary` | 14.17:1 | 4.5 | PASS |
| `--secondary` | 不变 | `#2d2a24` | `#2d2a24` | `--secondary-foreground on --secondary` | 11.81:1 | 4.5 | PASS |
| `--secondary-foreground` | 不变 | `#ede9e1` | `#ede9e1` | `--secondary-foreground on --secondary` | 11.81:1 | 4.5 | PASS |
| `--muted` | 不变 | `#2d2a24` | `#2d2a24` | `--muted-foreground on --muted` | 6.55:1 | 4.5 | PASS |
| `--muted-foreground` | 不变 | `#b3afa8` | `#b3afa8` | `--muted-foreground on --background` | 7.86:1 | 4.5 | PASS |
| `--accent` | 不变 | `#2d2a24` | `#2d2a24` | `--accent-foreground on --accent` | 11.81:1 | 4.5 | PASS |
| `--accent-foreground` | 不变 | `#ede9e1` | `#ede9e1` | `--accent-foreground on --accent` | 11.81:1 | 4.5 | PASS |
| `--destructive` | 不变 | `#ffaab9` | `#ffaab9` | `--destructive-foreground on --destructive` | 7.52:1 | 4.5 | PASS |
| `--destructive-foreground` | 不变 | `#47242b` | `#47242b` | `--destructive-foreground on --destructive` | 7.52:1 | 4.5 | PASS |
| `--border` | 不变 | `#2d2a24` | `#2d2a24` | `--border on --background` | 1.2:1 | — | report-only |
| `--input` | 不变 | `#3f3c36` | `#3f3c36` | `--input on --background` | 1.56:1 | 1.5 | PASS |
| `--ring` | 不变 | `#928f88` | `#928f88` | `--ring on --background` | 5.32:1 | 3 | PASS |
| `--column` | 不变 | `#1e1b16` | `#1e1b16` | `--foreground on --column` | 14.17:1 | 4.5 | PASS |
| `--col-bg` | 不变 | `#1e1b16` | `#1e1b16` | `--foreground on --col-bg` | 14.17:1 | 4.5 | PASS |
| `--col-head-text` | 不变 | `#d3cfc7` | `#d3cfc7` | `--col-head-text on --col-bg` | 11.05:1 | 4.5 | PASS |
| `--sidebar-hover` | 不变 | `rgb(255 252 248 / 0.05)` | `rgb(255 252 248 / 0.05)` | `--sidebar-hover on --surface` | 1.16:1 | — | report-only |
| `--sidebar-active` | 不变 | `rgb(255 252 248 / 0.1)` | `rgb(255 252 248 / 0.1)` | `--sidebar-active on --surface` | 1.36:1 | — | report-only |
| `--surface` | 不变 | `#25221d` | `#25221d` | `--foreground on --surface` | 13.09:1 | 4.5 | PASS |
| `--surface-secondary` | 不变 | `#2d2a24` | `#2d2a24` | `--foreground on --surface-secondary` | 11.81:1 | 4.5 | PASS |
| `--surface-tertiary` | 不变 | `#3f3c36` | `#3f3c36` | `--foreground on --surface-tertiary` | 9.08:1 | 4.5 | PASS |
| `--surface-elevated` | 不变 | `#25221d` | `#25221d` | `--foreground on --surface-elevated` | 13.09:1 | 4.5 | PASS |
| `--surface-hover` | 不变 | `#2d2a24` | `#2d2a24` | `--foreground on --surface-hover` | 11.81:1 | 4.5 | PASS |
| `--surface-press` | 不变 | `#3f3c36` | `#3f3c36` | `--foreground on --surface-press` | 9.08:1 | 4.5 | PASS |
| `--text-secondary` | 不变 | `#d3cfc7` | `#d3cfc7` | `--text-secondary on --background` | 11.05:1 | 4.5 | PASS |
| `--text-tertiary` | 不变 | `#b3afa8` | `#b3afa8` | `--text-tertiary on --background` | 7.86:1 | 4.5 | PASS |
| `--text-dim` | 不变 | `#79756f` | `#79756f` | `--text-dim on --background` | 3.75:1 | 3 | PASS |
| `--border-default` | 不变 | `#2d2a24` | `#2d2a24` | `--border-default on --background` | 1.2:1 | — | report-only |
| `--border-strong` | 不变 | `#3f3c36` | `#3f3c36` | `--border-strong on --background` | 1.56:1 | 1.5 | PASS |
| `--card-button` | 不变 | `#d89cfc` | `#d89cfc` | `--text-on-accent on --card-button` | 8.24:1 | 4.5 | PASS |
| `--text-on-accent` | 不变 | `#1e1b16` | `#1e1b16` | `--text-on-accent on --card-button` | 8.24:1 | 4.5 | PASS |
| `--focus-ring` | 不变 | `#d89cfc` | `#d89cfc` | `--focus-ring on --background` | 8.24:1 | 3 | PASS |
| `--col-dot-idle` | 不变 | `#c0b8aa` | `#c0b8aa` | `--col-dot-idle on --background` | 8.73:1 | 3 | PASS |
| `--col-dot-confirm` | 不变 | `#eea953` | `#eea953` | `--col-dot-confirm on --background` | 8.53:1 | — | report-only |
| `--col-dot-building` | 不变 | `#59c5ff` | `#59c5ff` | `--col-dot-building on --background` | 8.87:1 | 3 | PASS |
| `--col-dot-done` | 不变 | `#73d18f` | `#73d18f` | `--col-dot-done on --background` | 9.19:1 | 3 | PASS |
| `--badge-attention` | 不变 | `#eea953` | `#eea953` | `--badge-attention-fg on --badge-attention` | 6.59:1 | 4.5 | PASS |
| `--badge-attention-fg` | 不变 | `#422b0d` | `#422b0d` | `--badge-attention-fg on --badge-attention` | 6.59:1 | 4.5 | PASS |
| `--badge-done` | 不变 | `#73d18f` | `#73d18f` | `--badge-done on --background` | 9.19:1 | 3 | PASS |
| `--badge-idle` | 不变 | `#c0b8aa` | `#c0b8aa` | `--badge-idle on --background` | 8.73:1 | 3 | PASS |
| `--project-avatar-bg` | 不变 | `#ff9b78` | `#ff9b78` | `--project-avatar-fg on --project-avatar-bg` | 6.55:1 | 4.5 | PASS |
| `--project-avatar-fg` | 不变 | `#47261a` | `#47261a` | `--project-avatar-fg on --project-avatar-bg` | 6.55:1 | 4.5 | PASS |
| `--agent-avatar-bg` | 不变 | `#2d2a24` | `#2d2a24` | `--foreground on --agent-avatar-bg` | 11.81:1 | 4.5 | PASS |
| `--chip-idle-bg` | 不变 | `#2d2a24` | `#2d2a24` | `--chip-idle-fg on --chip-idle-bg` | 6.55:1 | 4.5 | PASS |
| `--chip-idle-fg` | 不变 | `#b3afa8` | `#b3afa8` | `--chip-idle-fg on --chip-idle-bg` | 6.55:1 | 4.5 | PASS |
| `--chip-plan-bg` | 不变 | `#3e333c` | `#3e333c` | `--chip-plan-fg on --chip-plan-bg` | 6.74:1 | 4.5 | PASS |
| `--chip-plan-fg` | 不变 | `#e0afff` | `#e0afff` | `--chip-plan-fg on --chip-plan-bg` | 6.74:1 | 4.5 | PASS |
| `--chip-confirm-bg` | 不变 | `#422b0d` | `#422b0d` | `--chip-confirm-fg on --chip-confirm-bg` | 7.6:1 | 4.5 | PASS |
| `--chip-confirm-fg` | 不变 | `#f4b973` | `#f4b973` | `--chip-confirm-fg on --chip-confirm-bg` | 7.6:1 | 4.5 | PASS |
| `--chip-done-bg` | 不变 | `#193822` | `#193822` | `--chip-done-fg on --chip-done-bg` | 7.84:1 | 4.5 | PASS |
| `--chip-done-fg` | 不变 | `#8ddba2` | `#8ddba2` | `--chip-done-fg on --chip-done-bg` | 7.84:1 | 4.5 | PASS |
| `--chip-failed-bg` | 不变 | `#47242b` | `#47242b` | `--chip-failed-fg on --chip-failed-bg` | 7.52:1 | 4.5 | PASS |
| `--chip-failed-fg` | 不变 | `#ffaab9` | `#ffaab9` | `--chip-failed-fg on --chip-failed-bg` | 7.52:1 | 4.5 | PASS |
| `--fail-fg` | 不变 | `#ffaf94` | `#ffaf94` | `--fail-fg on --card` | 8.91:1 | 4.5 | PASS |
| `--seg-active` | 不变 | `#3f3c36` | `#3f3c36` | `--foreground on --seg-active` | 9.08:1 | 4.5 | PASS |
| `--seg-hover` | 不变 | `rgb(255 252 248 / 0.05)` | `rgb(255 252 248 / 0.05)` | `--seg-hover on --surface` | 1.16:1 | — | report-only |
| `--tab-chip-bg` | 不变 | `#25221d` | `#25221d` | `--foreground on --tab-chip-bg` | 13.09:1 | 4.5 | PASS |
| `--stop` | 不变 | `#ffaab9` | `#ffaab9` | `--stop on --background` | 9.56:1 | 3 | PASS |
| `--diff-add-bg` | 不变 | `#193822` | `#193822` | `--diff-add-fg on --diff-add-bg` | 6:1 | 4.5 | PASS |
| `--diff-add-fg` | 不变 | `#66c483` | `#66c483` | `--diff-add-fg on --diff-add-bg` | 6:1 | 4.5 | PASS |
| `--diff-del-bg` | 不变 | `#47242b` | `#47242b` | `--destructive on --diff-del-bg` | 7.52:1 | 4.5 | PASS |
| `--dialog-bg` | 不变 | `#25221d` | `#25221d` | `--foreground on --dialog-bg` | 13.09:1 | 4.5 | PASS |
| `--dialog-box-bg` | 不变 | `#25221d` | `#25221d` | `--foreground on --dialog-box-bg` | 13.09:1 | 4.5 | PASS |
| `--dialog-row-bg` | 不变 | `#2d2a24` | `#2d2a24` | `--foreground on --dialog-row-bg` | 11.81:1 | 4.5 | PASS |
| `--dialog-ring` | 不变 | `#3f3c36` | `#3f3c36` | `--dialog-ring on --dialog-bg` | 1.44:1 | — | report-only |
| `--range-chip-bg` | 不变 | `#2d2a24` | `#2d2a24` | `--foreground on --range-chip-bg` | 11.81:1 | 4.5 | PASS |
| `--range-chip-border` | 不变 | `#3f3c36` | `#3f3c36` | `--range-chip-border on --range-chip-bg` | 1.3:1 | — | report-only |
| `--tile-orange-bg` | 不变 | `#422b0d` | `#422b0d` | `--tile-orange-fg on --tile-orange-bg` | 7.6:1 | 4.5 | PASS |
| `--tile-orange-fg` | 不变 | `#f4b973` | `#f4b973` | `--tile-orange-fg on --tile-orange-bg` | 7.6:1 | 4.5 | PASS |
| `--tile-indigo-bg` | 不变 | `#3e333c` | `#3e333c` | `--tile-indigo-fg on --tile-indigo-bg` | 6.74:1 | 4.5 | PASS |
| `--tile-indigo-fg` | 不变 | `#e0afff` | `#e0afff` | `--tile-indigo-fg on --tile-indigo-bg` | 6.74:1 | 4.5 | PASS |
| `--tile-hero-bg` | 不变 | `#422b0d` | `#422b0d` | `--foreground on --tile-hero-bg` | 10.96:1 | 4.5 | PASS |
| `--pill-idle-bg` | 不变 | `#2d2a24` | `#2d2a24` | `--foreground on --pill-idle-bg` | 11.81:1 | 4.5 | PASS |
| `--dash-border` | 不变 | `#3f3c36` | `#3f3c36` | `--dash-border on --surface` | 1.44:1 | — | report-only |
| `--row-selected` | 不变 | `#2d2a24` | `#2d2a24` | `--foreground on --row-selected` | 11.81:1 | 4.5 | PASS |
| `--row-icon-bg` | 不变 | `#3f3c36` | `#3f3c36` | `--foreground on --row-icon-bg` | 9.08:1 | 4.5 | PASS |
| `--overlay-divider` | 不变 | `#2d2a24` | `#2d2a24` | `--overlay-divider on --popover` | 1.11:1 | — | report-only |
| `--overlay-select-indigo` | 不变 | `#3e333c` | `#3e333c` | `--spot-text-on-tint on --overlay-select-indigo` | 6.74:1 | 4.5 | PASS |
| `--pick-selected-bg` | 不变 | `#3e333c` | `#3e333c` | `--pick-selected-fg on --pick-selected-bg` | 6.74:1 | 4.5 | PASS |
| `--pick-selected-fg` | 不变 | `#e0afff` | `#e0afff` | `--pick-selected-fg on --pick-selected-bg` | 6.74:1 | 4.5 | PASS |
| `--chief-tab-bg` | 不变 | `#2d2a24` | `#2d2a24` | `--foreground on --chief-tab-bg` | 11.81:1 | 4.5 | PASS |
| `--chief-tab-active` | 不变 | `#3f3c36` | `#3f3c36` | `--foreground on --chief-tab-active` | 9.08:1 | 4.5 | PASS |
| `--notify-icon-bg` | 不变 | `#3f3c36` | `#3f3c36` | `--card-button on --notify-icon-bg` | 5.28:1 | 3 | PASS |
| `--menu-icon` | 不变 | `#79756f` | `#79756f` | `--menu-icon on --popover` | 3.46:1 | 3 | PASS |
| `--overlay-scrim` | 不变 | `rgb(0 0 0 / 0.6)` | `rgb(0 0 0 / 0.6)` | `--overlay-scrim on --background` | 1.15:1 | — | report-only |
| `--text-on-veil` | 不变 | `#ffffff` | `#ffffff` | `--text-on-veil on --overlay-scrim` | 19.67:1 | 4.5 | PASS |
| `--spot-soft` | 不变 | `#3e333c` | `#3e333c` | `--spot-text-on-tint on --spot-soft` | 6.74:1 | 4.5 | PASS |
| `--accent-soft` | 不变 | `rgb(216 156 252 / 0.14)` | `rgb(216 156 252 / 0.14)` | `--accent-soft on --surface` | 1.32:1 | — | report-only |
| `--danger-soft` | 不变 | `rgb(255 170 185 / 0.14)` | `rgb(255 170 185 / 0.14)` | `--danger-soft on --surface` | 1.36:1 | — | report-only |
| `--spot-text-on-tint` | 不变 | `#e0afff` | `#e0afff` | `--spot-text-on-tint on --spot-soft` | 6.74:1 | 4.5 | PASS |
| `--spot-disabled` | 不变 | `#906ba3` | `#906ba3` | `--spot-disabled-fg on --spot-disabled` | 2.75:1 | — | report-only |
| `--spot-disabled-fg` | 不变 | `#e6bffd` | `#e6bffd` | `--spot-disabled-fg on --spot-disabled` | 2.75:1 | — | report-only |
| `--primary-disabled` | 不变 | `#906ba3` | `#906ba3` | `--spot-disabled-fg on --primary-disabled` | 2.75:1 | — | report-only |
| `--drop-tint-border` | 不变 | `#d89cfc` | `#d89cfc` | `--drop-tint-border on --column` | 8.24:1 | 3 | PASS |
| `--drop-tint-base` | 不变 | `rgb(216 156 252 / 0.05)` | `rgb(216 156 252 / 0.05)` | `--drop-tint-base on --column` | 1.08:1 | — | report-only |
| `--drop-tint-hover` | 不变 | `rgb(216 156 252 / 0.1)` | `rgb(216 156 252 / 0.1)` | `--drop-tint-hover on --column` | 1.2:1 | — | report-only |
| `--surface-inset` | 不变 | `#1e1b16` | `#1e1b16` | `--foreground on --surface-inset` | 14.17:1 | 4.5 | PASS |
| `--card-bg` | 不变 | `#25221d` | `#25221d` | `--card-foreground on --card-bg` | 13.09:1 | 4.5 | PASS |
| `--popover-bg` | 不变 | `#25221d` | `#25221d` | `--popover-foreground on --popover-bg` | 13.09:1 | 4.5 | PASS |
| `--text-primary` | 不变 | `#ede9e1` | `#ede9e1` | `--text-primary on --background` | 14.17:1 | 4.5 | PASS |
| `--code-bg` | 不变 | `#2d2a24` | `#2d2a24` | `--foreground on --code-bg` | 11.81:1 | 4.5 | PASS |
| `--danger` | 不变 | `#ffaab9` | `#ffaab9` | `--danger on --background` | 9.56:1 | 3 | PASS |
| `--card-border` | 不变 | `#2d2a24` | `#2d2a24` | `--card-border on --card` | 1.11:1 | — | report-only |

## 亮模 (light) 逐槽

| 槽位 | 状态 | 旧值 (shadcn 现行) | 新值 (c.css 定版) | 角色对 (fg on bg) | 实测 | 阈值 | 结果 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `--background` | 不变 | `#f4efe7` | `#f4efe7` | `--foreground on --background` | 16.71:1 | 4.5 | PASS |
| `--foreground` | 不变 | `#120f09` | `#120f09` | `--foreground on --background` | 16.71:1 | 4.5 | PASS |
| `--card` | 不变 | `#efe9e1` | `#efe9e1` | `--card-foreground on --card` | 15.86:1 | 4.5 | PASS |
| `--card-foreground` | 不变 | `#120f09` | `#120f09` | `--card-foreground on --card` | 15.86:1 | 4.5 | PASS |
| `--popover` | 不变 | `#efe9e1` | `#efe9e1` | `--popover-foreground on --popover` | 15.86:1 | 4.5 | PASS |
| `--popover-foreground` | 不变 | `#120f09` | `#120f09` | `--popover-foreground on --popover` | 15.86:1 | 4.5 | PASS |
| `--primary` | 不变 | `#120f09` | `#120f09` | `--primary-foreground on --primary` | 18.32:1 | 4.5 | PASS |
| `--primary-foreground` | 不变 | `#fafafa` | `#fafafa` | `--primary-foreground on --primary` | 18.32:1 | 4.5 | PASS |
| `--secondary` | 不变 | `#e8e3da` | `#e8e3da` | `--secondary-foreground on --secondary` | 14.96:1 | 4.5 | PASS |
| `--secondary-foreground` | 不变 | `#120f09` | `#120f09` | `--secondary-foreground on --secondary` | 14.96:1 | 4.5 | PASS |
| `--muted` | 不变 | `#e8e3da` | `#e8e3da` | `--muted-foreground on --muted` | 10.12:1 | 4.5 | PASS |
| `--muted-foreground` | 不变 | `#35312a` | `#35312a` | `--muted-foreground on --background` | 11.3:1 | 4.5 | PASS |
| `--accent` | 不变 | `#e8e3da` | `#e8e3da` | `--accent-foreground on --accent` | 14.96:1 | 4.5 | PASS |
| `--accent-foreground` | 不变 | `#120f09` | `#120f09` | `--accent-foreground on --accent` | 14.96:1 | 4.5 | PASS |
| `--destructive` | 不变 | `#9d2c4c` | `#9d2c4c` | `--destructive-foreground on --destructive` | 7.25:1 | 4.5 | PASS |
| `--destructive-foreground` | 不变 | `#ffffff` | `#ffffff` | `--destructive-foreground on --destructive` | 7.25:1 | 4.5 | PASS |
| `--border` | 不变 | `#e8e3da` | `#e8e3da` | `--border on --background` | 1.12:1 | — | report-only |
| `--input` | 不变 | `#c9c4bc` | `#c9c4bc` | `--input on --background` | 1.52:1 | 1.5 | PASS |
| `--ring` | 不变 | `#8d8980` | `#8d8980` | `--ring on --background` | 3.05:1 | 3 | PASS |
| `--column` | 不变 | `#f4efe7` | `#f4efe7` | `--foreground on --column` | 16.71:1 | 4.5 | PASS |
| `--col-bg` | 不变 | `#f4efe7` | `#f4efe7` | `--foreground on --col-bg` | 16.71:1 | 4.5 | PASS |
| `--col-head-text` | 不变 | `#57534c` | `#57534c` | `--col-head-text on --col-bg` | 6.68:1 | 4.5 | PASS |
| `--sidebar-hover` | 不变 | `rgb(28 25 20 / 0.05)` | `rgb(28 25 20 / 0.05)` | `--sidebar-hover on --surface` | 1.1:1 | — | report-only |
| `--sidebar-active` | 不变 | `rgb(28 25 20 / 0.1)` | `rgb(28 25 20 / 0.1)` | `--sidebar-active on --surface` | 1.22:1 | — | report-only |
| `--surface` | 不变 | `#efe9e1` | `#efe9e1` | `--foreground on --surface` | 15.86:1 | 4.5 | PASS |
| `--surface-secondary` | 不变 | `#e8e3da` | `#e8e3da` | `--foreground on --surface-secondary` | 14.96:1 | 4.5 | PASS |
| `--surface-tertiary` | 不变 | `#e0dbd2` | `#e0dbd2` | `--foreground on --surface-tertiary` | 13.87:1 | 4.5 | PASS |
| `--surface-elevated` | 不变 | `#efe9e1` | `#efe9e1` | `--foreground on --surface-elevated` | 15.86:1 | 4.5 | PASS |
| `--surface-hover` | 不变 | `#e8e3da` | `#e8e3da` | `--foreground on --surface-hover` | 14.96:1 | 4.5 | PASS |
| `--surface-press` | 不变 | `#e0dbd2` | `#e0dbd2` | `--foreground on --surface-press` | 13.87:1 | 4.5 | PASS |
| `--text-secondary` | 不变 | `#35312a` | `#35312a` | `--text-secondary on --background` | 11.3:1 | 4.5 | PASS |
| `--text-tertiary` | 不变 | `#57534c` | `#57534c` | `--text-tertiary on --background` | 6.68:1 | 4.5 | PASS |
| `--text-dim` | 不变 | `#8d8980` | `#8d8980` | `--text-dim on --background` | 3.05:1 | 3 | PASS |
| `--border-default` | 不变 | `#e8e3da` | `#e8e3da` | `--border-default on --background` | 1.12:1 | — | report-only |
| `--border-strong` | 不变 | `#c9c4bc` | `#c9c4bc` | `--border-strong on --background` | 1.52:1 | 1.5 | PASS |
| `--card-button` | 不变 | `#7f2da7` | `#7f2da7` | `--text-on-accent on --card-button` | 7.41:1 | 4.5 | PASS |
| `--text-on-accent` | 不变 | `#ffffff` | `#ffffff` | `--text-on-accent on --card-button` | 7.41:1 | 4.5 | PASS |
| `--focus-ring` | 不变 | `#7f2da7` | `#7f2da7` | `--focus-ring on --background` | 6.47:1 | 3 | PASS |
| `--col-dot-idle` | 不变 | `#645b4c` | `#645b4c` | `--col-dot-idle on --background` | 5.84:1 | 3 | PASS |
| `--col-dot-confirm` | 不变 | `#faab3f` | `#faab3f` | `--col-dot-confirm on --background` | 1.67:1 | — | report-only |
| `--col-dot-building` | 不变 | `#00648c` | `#00648c` | `--col-dot-building on --background` | 5.73:1 | 3 | PASS |
| `--col-dot-done` | 不变 | `#006f36` | `#006f36` | `--col-dot-done on --background` | 5.51:1 | 3 | PASS |
| `--badge-attention` | 不变 | `#faab3f` | `#faab3f` | `--badge-attention-fg on --badge-attention` | 6.46:1 | 4.5 | PASS |
| `--badge-attention-fg` | 不变 | `#4c2e00` | `#4c2e00` | `--badge-attention-fg on --badge-attention` | 6.46:1 | 4.5 | PASS |
| `--badge-done` | 不变 | `#006f36` | `#006f36` | `--badge-done on --background` | 5.51:1 | 3 | PASS |
| `--badge-idle` | 不变 | `#645b4c` | `#645b4c` | `--badge-idle on --background` | 5.84:1 | 3 | PASS |
| `--project-avatar-bg` | 不变 | `#cd5f37` | `#cd5f37` | `--project-avatar-fg on --project-avatar-bg` | 4.5:1 | 4.5 | PASS |
| `--project-avatar-fg` | 不变 | `#310a00` | `#310a00` | `--project-avatar-fg on --project-avatar-bg` | 4.5:1 | 4.5 | PASS |
| `--agent-avatar-bg` | 不变 | `#e8e3da` | `#e8e3da` | `--foreground on --agent-avatar-bg` | 14.96:1 | 4.5 | PASS |
| `--chip-idle-bg` | 不变 | `#e8e3da` | `#e8e3da` | `--chip-idle-fg on --chip-idle-bg` | 5.98:1 | 4.5 | PASS |
| `--chip-idle-fg` | 不变 | `#57534c` | `#57534c` | `--chip-idle-fg on --chip-idle-bg` | 5.98:1 | 4.5 | PASS |
| `--chip-plan-bg` | 不变 | `#dfcfd9` | `#dfcfd9` | `--chip-plan-fg on --chip-plan-bg` | 7.64:1 | 4.5 | PASS |
| `--chip-plan-fg` | 不变 | `#562071` | `#562071` | `--chip-plan-fg on --chip-plan-bg` | 7.64:1 | 4.5 | PASS |
| `--chip-confirm-bg` | 不变 | `#ffe5c8` | `#ffe5c8` | `--chip-confirm-fg on --chip-confirm-bg` | 5.53:1 | 4.5 | PASS |
| `--chip-confirm-fg` | 不变 | `#825100` | `#825100` | `--chip-confirm-fg on --chip-confirm-bg` | 5.53:1 | 4.5 | PASS |
| `--chip-done-bg` | 不变 | `#c2f5ce` | `#c2f5ce` | `--chip-done-fg on --chip-done-bg` | 8.38:1 | 4.5 | PASS |
| `--chip-done-fg` | 不变 | `#004c23` | `#004c23` | `--chip-done-fg on --chip-done-bg` | 8.38:1 | 4.5 | PASS |
| `--chip-failed-bg` | 不变 | `#ffdce1` | `#ffdce1` | `--chip-failed-fg on --chip-failed-bg` | 8.87:1 | 4.5 | PASS |
| `--chip-failed-fg` | 不变 | `#6b1f33` | `#6b1f33` | `--chip-failed-fg on --chip-failed-bg` | 8.87:1 | 4.5 | PASS |
| `--fail-fg` | 不变 | `#833a1f` | `#833a1f` | `--fail-fg on --card` | 6.72:1 | 4.5 | PASS |
| `--seg-active` | 不变 | `#e0dbd2` | `#e0dbd2` | `--foreground on --seg-active` | 13.87:1 | 4.5 | PASS |
| `--seg-hover` | 不变 | `rgb(28 25 20 / 0.05)` | `rgb(28 25 20 / 0.05)` | `--seg-hover on --surface` | 1.1:1 | — | report-only |
| `--tab-chip-bg` | 不变 | `#efe9e1` | `#efe9e1` | `--foreground on --tab-chip-bg` | 15.86:1 | 4.5 | PASS |
| `--stop` | 不变 | `#9d2c4c` | `#9d2c4c` | `--stop on --background` | 6.33:1 | 3 | PASS |
| `--diff-add-bg` | 不变 | `#c2f5ce` | `#c2f5ce` | `--diff-add-fg on --diff-add-bg` | 6.45:1 | 4.5 | PASS |
| `--diff-add-fg` | 不变 | `#005f2d` | `#005f2d` | `--diff-add-fg on --diff-add-bg` | 6.45:1 | 4.5 | PASS |
| `--diff-del-bg` | 不变 | `#ffdce1` | `#ffdce1` | `--destructive on --diff-del-bg` | 5.72:1 | 4.5 | PASS |
| `--dialog-bg` | 不变 | `#efe9e1` | `#efe9e1` | `--foreground on --dialog-bg` | 15.86:1 | 4.5 | PASS |
| `--dialog-box-bg` | 不变 | `#efe9e1` | `#efe9e1` | `--foreground on --dialog-box-bg` | 15.86:1 | 4.5 | PASS |
| `--dialog-row-bg` | 不变 | `#e8e3da` | `#e8e3da` | `--foreground on --dialog-row-bg` | 14.96:1 | 4.5 | PASS |
| `--dialog-ring` | 不变 | `#c9c4bc` | `#c9c4bc` | `--dialog-ring on --dialog-bg` | 1.44:1 | — | report-only |
| `--range-chip-bg` | 不变 | `#e8e3da` | `#e8e3da` | `--foreground on --range-chip-bg` | 14.96:1 | 4.5 | PASS |
| `--range-chip-border` | 不变 | `#c9c4bc` | `#c9c4bc` | `--range-chip-border on --range-chip-bg` | 1.36:1 | — | report-only |
| `--tile-orange-bg` | 不变 | `#ffe5c8` | `#ffe5c8` | `--tile-orange-fg on --tile-orange-bg` | 5.53:1 | 4.5 | PASS |
| `--tile-orange-fg` | 不变 | `#825100` | `#825100` | `--tile-orange-fg on --tile-orange-bg` | 5.53:1 | 4.5 | PASS |
| `--tile-indigo-bg` | 不变 | `#dfcfd9` | `#dfcfd9` | `--tile-indigo-fg on --tile-indigo-bg` | 7.64:1 | 4.5 | PASS |
| `--tile-indigo-fg` | 不变 | `#562071` | `#562071` | `--tile-indigo-fg on --tile-indigo-bg` | 7.64:1 | 4.5 | PASS |
| `--tile-hero-bg` | 不变 | `#ffd099` | `#ffd099` | `--foreground on --tile-hero-bg` | 13.42:1 | 4.5 | PASS |
| `--pill-idle-bg` | 不变 | `#e8e3da` | `#e8e3da` | `--foreground on --pill-idle-bg` | 14.96:1 | 4.5 | PASS |
| `--dash-border` | 不变 | `#c9c4bc` | `#c9c4bc` | `--dash-border on --surface` | 1.44:1 | — | report-only |
| `--row-selected` | 不变 | `#e8e3da` | `#e8e3da` | `--foreground on --row-selected` | 14.96:1 | 4.5 | PASS |
| `--row-icon-bg` | 不变 | `#e0dbd2` | `#e0dbd2` | `--foreground on --row-icon-bg` | 13.87:1 | 4.5 | PASS |
| `--overlay-divider` | 不变 | `#e8e3da` | `#e8e3da` | `--overlay-divider on --popover` | 1.06:1 | — | report-only |
| `--overlay-select-indigo` | 不变 | `#dfcfd9` | `#dfcfd9` | `--spot-text-on-tint on --overlay-select-indigo` | 7.64:1 | 4.5 | PASS |
| `--pick-selected-bg` | 不变 | `#dfcfd9` | `#dfcfd9` | `--pick-selected-fg on --pick-selected-bg` | 7.64:1 | 4.5 | PASS |
| `--pick-selected-fg` | 不变 | `#562071` | `#562071` | `--pick-selected-fg on --pick-selected-bg` | 7.64:1 | 4.5 | PASS |
| `--chief-tab-bg` | 不变 | `#e8e3da` | `#e8e3da` | `--foreground on --chief-tab-bg` | 14.96:1 | 4.5 | PASS |
| `--chief-tab-active` | 不变 | `#e0dbd2` | `#e0dbd2` | `--foreground on --chief-tab-active` | 13.87:1 | 4.5 | PASS |
| `--notify-icon-bg` | 不变 | `#dfcfd9` | `#dfcfd9` | `--card-button on --notify-icon-bg` | 4.96:1 | 3 | PASS |
| `--menu-icon` | 不变 | `#120f09` | `#120f09` | `--menu-icon on --popover` | 15.86:1 | 3 | PASS |
| `--overlay-scrim` | 不变 | `rgb(0 0 0 / 0.6)` | `rgb(0 0 0 / 0.6)` | `--overlay-scrim on --background` | 5.48:1 | — | report-only |
| `--text-on-veil` | 不变 | `#ffffff` | `#ffffff` | `--text-on-veil on --overlay-scrim` | 6.27:1 | 4.5 | PASS |
| `--spot-soft` | 不变 | `#dfcfd9` | `#dfcfd9` | `--spot-text-on-tint on --spot-soft` | 7.64:1 | 4.5 | PASS |
| `--accent-soft` | 不变 | `rgb(127 45 167 / 0.14)` | `rgb(127 45 167 / 0.14)` | `--accent-soft on --surface` | 1.24:1 | — | report-only |
| `--danger-soft` | 不变 | `rgb(157 44 76 / 0.14)` | `rgb(157 44 76 / 0.14)` | `--danger-soft on --surface` | 1.24:1 | — | report-only |
| `--spot-text-on-tint` | 不变 | `#562071` | `#562071` | `--spot-text-on-tint on --spot-soft` | 7.64:1 | 4.5 | PASS |
| `--spot-disabled` | 不变 | `#ac78be` | `#ac78be` | `--spot-disabled-fg on --spot-disabled` | 3.4:1 | — | report-only |
| `--spot-disabled-fg` | 不变 | `#ffffff` | `#ffffff` | `--spot-disabled-fg on --spot-disabled` | 3.4:1 | — | report-only |
| `--primary-disabled` | 不变 | `#ac78be` | `#ac78be` | `--spot-disabled-fg on --primary-disabled` | 3.4:1 | — | report-only |
| `--drop-tint-border` | 不变 | `#7f2da7` | `#7f2da7` | `--drop-tint-border on --column` | 6.47:1 | 3 | PASS |
| `--drop-tint-base` | 不变 | `rgb(127 45 167 / 0.05)` | `rgb(127 45 167 / 0.05)` | `--drop-tint-base on --column` | 1.08:1 | — | report-only |
| `--drop-tint-hover` | 不变 | `rgb(127 45 167 / 0.1)` | `rgb(127 45 167 / 0.1)` | `--drop-tint-hover on --column` | 1.16:1 | — | report-only |
| `--surface-inset` | 不变 | `#f4efe7` | `#f4efe7` | `--foreground on --surface-inset` | 16.71:1 | 4.5 | PASS |
| `--card-bg` | 不变 | `#efe9e1` | `#efe9e1` | `--card-foreground on --card-bg` | 15.86:1 | 4.5 | PASS |
| `--popover-bg` | 不变 | `#efe9e1` | `#efe9e1` | `--popover-foreground on --popover-bg` | 15.86:1 | 4.5 | PASS |
| `--text-primary` | 不变 | `#120f09` | `#120f09` | `--text-primary on --background` | 16.71:1 | 4.5 | PASS |
| `--code-bg` | 不变 | `#e8e3da` | `#e8e3da` | `--foreground on --code-bg` | 14.96:1 | 4.5 | PASS |
| `--danger` | 不变 | `#9d2c4c` | `#9d2c4c` | `--danger on --background` | 6.33:1 | 3 | PASS |
| `--card-border` | 不变 | `#e8e3da` | `#e8e3da` | `--card-border on --card` | 1.06:1 | — | report-only |

