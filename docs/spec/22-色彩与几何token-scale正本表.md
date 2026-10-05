# 22 · 色彩与几何 token scale 正本表（#912）

> 状态：**已裁决并生效**（2026-10-05，#912 wayfinder task 产出）。本册是逐域施工票的唯一取数正本——每个域批次（#913 批次表 v2）只消费、不自行裁定；色值翻转与双模封版（#915）、探针重钉（#921）均以本册 + `library/t-0909/src/themes/c.css` 为准。
> 上游正典：ADR 0010（D1 色相重选 / D2 几何自由重设计 / D5.4 hex/rgb 记法契约）、#909 决议（C · 纸兰定版，色板正本 c.css @ `7340d0ab`）、#910 决议（钉扎口径五项裁定）。
> 取数源：色彩与几何值全取 `library/t-0909/src/themes/c.css`（定版色板）；对比度由 `library/t-0909/scripts/measure-912.mjs` 按 WCAG 2.1 亮度比逐对实测（非估计），算法与 `scripts/gen-palettes.mjs`（#909 正本生成器）逐字节同源，且与 `library/t-0909/reports/contrast.md` 逐对对账一致。机器可读实测落 `library/t-0909/reports/token-scale-912.json`。

## 0. 落点与正典地位

本册落 `docs/spec/22`，理由：

- `docs/spec/` 是仓内唯一编号正典序列（00–21），token scale 正本表是被批次（#913）、值翻转（#915）、探针（#921）长期消费的引用正本，属正典序列而非沙盒产物。
- `library/t-0909/` 是 #909 原型沙盒，退役时点已在 #908 fog 列明（各域施工票吸收定版后整体退役）。正本表须比沙盒长寿，故不落 t-0909；c.css 色板正本仍留 t-0909（ADR 0010 D1 钉其为取数源），本册以 `@ 7340d0ab` 锚定引用。
- 编号按合并时点 main 尾部 +1（撞号纪律与 drizzle migration 同律）：若并行车道先落 22 册，本册重编号到新尾部，引用同步改。

本册管「每个 token 的正本值与实测证据」，不管施工顺序（在 #913）、不管钉扎载体（在 #910 / ADR 0010 D5）。数值与 spec/16 旧口径冲突处以本册为准（spec/16 已标 superseded-in-part）。

## 1. 色：c.css → shadcn.css 槽位映射

### 1.1 架构结论：槽不动，只翻值

名字级 diff 实测 111 个色槽，**0 新增、0 退役**——定版色板 c.css 是 #787/#813 槽架构的 1:1 值替换，印证 ADR 0010 D1「翻的是槽里的值，不是槽」。#915 的值翻转执行因此是**纯值替换**：把 `shadcn.css` 的 `:root`（暗）与 `.light`（亮）里每个色槽的持值换成 c.css 对应值即可，槽名与 `@theme inline` 的 Tailwind 映射（`--color-*`）零改动。

- **翻值**：暗 107 槽、亮 103 槽取新值（含 `--surface-inset`/`--card-bg`/`--popover-bg`/`--text-primary`/`--code-bg`/`--danger` 六个并流别名槽，值随其直引的正本槽一起翻）。
- **不变**：暗 2 槽、亮 6 槽——主题恒定值（`--overlay-scrim` `rgb(0 0 0 / 0.6)`、`--text-on-veil` 白；亮侧另有 `--primary-foreground`/`--destructive-foreground`/`--text-on-accent`/`--spot-disabled-fg` 恰与现行同值）。不变 ≠ 不需翻，是定版值恰等于现行值。
- **退役候选**：2 槽（`--toggle-track`/`--toggle-knob`）——名字级 diff 看不见（两文件都在），但其唯一消费点是随 D3 清零的 per-face CSS 手搓 toggle（见 §1.6）。

### 1.2 度量方法

- 算法：WCAG 2.1 相对亮度比 `(Lhi+0.05)/(Llo+0.05)`，sRGB 通道。与 #909 `gen-palettes.mjs` 同源；`color-mix(in srgb, …)` 与半透明 `rgb(… / α)` 按浏览器合成规则解析后量化到 8-bit 整数通道再量（与渲染像素一致）。
- 阈值：`text` 4.5（正文 AA）/ `ui` 3（UI 组件与图形对象，WCAG 1.4.11）/ `hairline` 1.5（可辨发丝线底线）/ `info` report-only（软发丝线、装饰点、失能态、半透明 tint、退役候选——非 AA 门控）。
- 角色对：每槽按「它实际渲染在其上的背景」量（better-colors 纪律），非一律对页面底。半透明 overlay（sidebar/seg hover、accent/danger-soft、scrim）先合成到真实基色再量。
- 结果：双模全部 AA 门控对（text/ui）通过——暗 88 对最低 3.46:1（`--menu-icon` on popover），亮 88 对最低 3.05:1（`--ring`/`--text-dim` on 底）。**门控对 0 未过。**

### 1.3 report-only 族说明

21 个 report-only 槽不是 AA 门控，原因分四类：

- **软发丝线**（`--border`/`--border-default`/`--card-border`/`--overlay-divider`/`--dialog-ring`/`--range-chip-border`/`--dash-border`）：定版有意用低对比软分隔线（暗 ≈1.2:1、亮 ≈1.1:1），是结构暗示而非「可辨边界」；可辨边界由 `--border-strong`/`--input`（1.5 门控，暗 1.56 / 亮 1.52 通过）承担。WCAG 1.4.11 只约束「理解内容所必需的视觉信息」，软分隔线不属之。
- **装饰点**（`--col-dot-confirm`）：确认列圆点是装饰冗余，语义由文字 label 承担，与 #909 report-only 同形。
- **失能态**（`--spot-disabled`/`--spot-disabled-fg`/`--primary-disabled`）：失能态不按 4.5 验收，只要求可辨（沿 #787 P0 口径）。
- **半透明 tint**（`--sidebar-hover`/`--sidebar-active`/`--seg-hover`/`--accent-soft`/`--danger-soft`/`--drop-tint-base`/`--drop-tint-hover`/`--overlay-scrim`）：交互态淡 tint 与遮罩，合成于底下内容、随内容变，无单一 AA 对。

### 1.4 翻转执行口径（给 #915）

- 值正本 = 本册 §1.7/§1.8 表的「新值 (c.css 定版)」列；#915 翻转时按槽把 c.css 的持值搬进 shadcn.css，不得手敲或从本册表二次抄 hex（本册表是实测证据，c.css 是值正本）。
- 记法契约：hex/rgb only，禁 oklch（ADR 0010 D5.4，见 §3.2）。c.css 实测全 hex/rgb 零 oklch，天然兼容。
- P0 语义槽六名（`--spot-soft`/`--accent-soft`/`--danger-soft`/`--spot-text-on-tint`/`--spot-disabled`/`--spot-disabled-fg`）公式形态保持 `color-mix` 不动，mix 源 `--card-button` 翻值后自动跟随（#787 公式继承）——#915 只翻 `--spot-text-on-tint` 的实值与 `--card-button` 源，公式槽零改。

### 1.5 组件件面实测（真实 shadcn 件消费多槽，量渲染对）

#### 暗模 (dark)

| 组件件面 | 角色对 (fg on bg) | 实测 | 阈值 | 结果 | 备注 |
| --- | --- | --- | --- | --- | --- |
| Switch — unchecked (OFF) | `--foreground on --input` | 9.08:1 | 3 | PASS | thumb on track; OFF track = --input (dark renders bg-input/80 over surface) |
| Switch — checked (ON) | `--primary-foreground on --primary` | 14.17:1 | 3 | PASS | thumb on track |
| Switch — track state flip | `--input on --primary` | 9.08:1 | 3 | PASS | OFF→ON track color = primary state carrier (WCAG 1.4.11) |
| Input — border on page bg | `--input on --background` | 1.56:1 | 1.5 | PASS | field boundary hairline (state also carried by focus ring) |
| Button brand — label on fill | `--text-on-accent on --card-button` | 8.24:1 | 4.5 | PASS | brand solid-fill label |

#### 亮模 (light)

| 组件件面 | 角色对 (fg on bg) | 实测 | 阈值 | 结果 | 备注 |
| --- | --- | --- | --- | --- | --- |
| Switch — unchecked (OFF) | `--background on --input` | 1.52:1 | 3 | below 3 | thumb on track; OFF track = --input (dark renders bg-input/80 over surface) |
| Switch — checked (ON) | `--background on --primary` | 16.71:1 | 3 | PASS | thumb on track |
| Switch — track state flip | `--input on --primary` | 11.03:1 | 3 | PASS | OFF→ON track color = primary state carrier (WCAG 1.4.11) |
| Input — border on page bg | `--input on --background` | 1.52:1 | 1.5 | PASS | field boundary hairline (state also carried by focus ring) |
| Button brand — label on fill | `--text-on-accent on --card-button` | 7.41:1 | 4.5 | PASS | brand solid-fill label |

### 1.6 退役候选（名字级 diff 看不见，消费点随 D3 per-face 清零而孤儿化）

- `--toggle-track`：only consumer = detail/overlays.css .dlg-toggle (per-face, D3-zeroed) → shadcn Switch
- `--toggle-knob`：only consumers = .dlg-toggle-knob + secondary.css (per-face, D3-zeroed) → shadcn Switch

### 1.7 暗模 (dark) 逐槽映射与实测

| 槽位 | 状态 | 旧值 (shadcn 现行) | 新值 (c.css 定版) | 角色对 (fg on bg) | 实测 | 阈值 | 结果 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `--background` | 翻值 | `#17171a` | `#1e1b16` | `--foreground on --background` | 14.17:1 | 4.5 | PASS |
| `--foreground` | 翻值 | `#eae8ee` | `#ede9e1` | `--foreground on --background` | 14.17:1 | 4.5 | PASS |
| `--card` | 翻值 | `#1e1e22` | `#25221d` | `--card-foreground on --card` | 13.09:1 | 4.5 | PASS |
| `--card-foreground` | 翻值 | `#eae8ee` | `#ede9e1` | `--card-foreground on --card` | 13.09:1 | 4.5 | PASS |
| `--popover` | 翻值 | `#1e1e22` | `#25221d` | `--popover-foreground on --popover` | 13.09:1 | 4.5 | PASS |
| `--popover-foreground` | 翻值 | `#eae8ee` | `#ede9e1` | `--popover-foreground on --popover` | 13.09:1 | 4.5 | PASS |
| `--primary` | 翻值 | `#e5e5e5` | `#ede9e1` | `--primary-foreground on --primary` | 14.17:1 | 4.5 | PASS |
| `--primary-foreground` | 翻值 | `#171717` | `#1e1b16` | `--primary-foreground on --primary` | 14.17:1 | 4.5 | PASS |
| `--secondary` | 翻值 | `#26262b` | `#2d2a24` | `--secondary-foreground on --secondary` | 11.81:1 | 4.5 | PASS |
| `--secondary-foreground` | 翻值 | `#eae8ee` | `#ede9e1` | `--secondary-foreground on --secondary` | 11.81:1 | 4.5 | PASS |
| `--muted` | 翻值 | `#26262b` | `#2d2a24` | `--muted-foreground on --muted` | 6.55:1 | 4.5 | PASS |
| `--muted-foreground` | 翻值 | `#b0afb6` | `#b3afa8` | `--muted-foreground on --background` | 7.86:1 | 4.5 | PASS |
| `--accent` | 翻值 | `#26262b` | `#2d2a24` | `--accent-foreground on --accent` | 11.81:1 | 4.5 | PASS |
| `--accent-foreground` | 翻值 | `#eae8ee` | `#ede9e1` | `--accent-foreground on --accent` | 11.81:1 | 4.5 | PASS |
| `--destructive` | 翻值 | `#e05a5a` | `#ffaab9` | `--destructive-foreground on --destructive` | 7.52:1 | 4.5 | PASS |
| `--destructive-foreground` | 翻值 | `#17171a` | `#47242b` | `--destructive-foreground on --destructive` | 7.52:1 | 4.5 | PASS |
| `--border` | 翻值 | `#26262b` | `#2d2a24` | `--border on --background` | 1.2:1 | — | report-only |
| `--input` | 翻值 | `#35353d` | `#3f3c36` | `--input on --background` | 1.56:1 | 1.5 | PASS |
| `--ring` | 翻值 | `#908f96` | `#928f88` | `--ring on --background` | 5.32:1 | 3 | PASS |
| `--column` | 翻值 | `#17171a` | `#1e1b16` | `--foreground on --column` | 14.17:1 | 4.5 | PASS |
| `--col-bg` | 翻值 | `#17171a` | `#1e1b16` | `--foreground on --col-bg` | 14.17:1 | 4.5 | PASS |
| `--col-head-text` | 翻值 | `#cdccd2` | `#d3cfc7` | `--col-head-text on --col-bg` | 11.05:1 | 4.5 | PASS |
| `--sidebar-hover` | 翻值 | `rgb(255 255 255 / 0.05)` | `rgb(255 252 248 / 0.05)` | `--sidebar-hover on --surface` | 1.16:1 | — | report-only |
| `--sidebar-active` | 翻值 | `rgb(255 255 255 / 0.1)` | `rgb(255 252 248 / 0.1)` | `--sidebar-active on --surface` | 1.36:1 | — | report-only |
| `--surface` | 翻值 | `#1e1e22` | `#25221d` | `--foreground on --surface` | 13.09:1 | 4.5 | PASS |
| `--surface-secondary` | 翻值 | `#26262b` | `#2d2a24` | `--foreground on --surface-secondary` | 11.81:1 | 4.5 | PASS |
| `--surface-tertiary` | 翻值 | `#35353d` | `#3f3c36` | `--foreground on --surface-tertiary` | 9.08:1 | 4.5 | PASS |
| `--surface-elevated` | 翻值 | `#1e1e22` | `#25221d` | `--foreground on --surface-elevated` | 13.09:1 | 4.5 | PASS |
| `--surface-hover` | 翻值 | `#26262b` | `#2d2a24` | `--foreground on --surface-hover` | 11.81:1 | 4.5 | PASS |
| `--surface-press` | 翻值 | `#35353d` | `#3f3c36` | `--foreground on --surface-press` | 9.08:1 | 4.5 | PASS |
| `--text-secondary` | 翻值 | `#cdccd2` | `#d3cfc7` | `--text-secondary on --background` | 11.05:1 | 4.5 | PASS |
| `--text-tertiary` | 翻值 | `#b0afb6` | `#b3afa8` | `--text-tertiary on --background` | 7.86:1 | 4.5 | PASS |
| `--text-dim` | 翻值 | `#908f96` | `#79756f` | `--text-dim on --background` | 3.75:1 | 3 | PASS |
| `--border-default` | 翻值 | `#26262b` | `#2d2a24` | `--border-default on --background` | 1.2:1 | — | report-only |
| `--border-strong` | 翻值 | `#35353d` | `#3f3c36` | `--border-strong on --background` | 1.56:1 | 1.5 | PASS |
| `--card-button` | 翻值 | `#cba6f7` | `#d89cfc` | `--text-on-accent on --card-button` | 8.24:1 | 4.5 | PASS |
| `--text-on-accent` | 翻值 | `#17171a` | `#1e1b16` | `--text-on-accent on --card-button` | 8.24:1 | 4.5 | PASS |
| `--focus-ring` | 翻值 | `#cba6f7` | `#d89cfc` | `--focus-ring on --background` | 8.24:1 | 3 | PASS |
| `--col-dot-idle` | 翻值 | `#9ea3ae` | `#c0b8aa` | `--col-dot-idle on --background` | 8.73:1 | 3 | PASS |
| `--col-dot-confirm` | 翻值 | `#e9a23b` | `#eea953` | `--col-dot-confirm on --background` | 8.53:1 | — | report-only |
| `--col-dot-building` | 翻值 | `#4e81ee` | `#59c5ff` | `--col-dot-building on --background` | 8.87:1 | 3 | PASS |
| `--col-dot-done` | 翻值 | `#5ec26a` | `#73d18f` | `--col-dot-done on --background` | 9.19:1 | 3 | PASS |
| `--badge-attention` | 翻值 | `#e9a23b` | `#eea953` | `--badge-attention-fg on --badge-attention` | 6.59:1 | 4.5 | PASS |
| `--badge-attention-fg` | 翻值 | `#17171a` | `#422b0d` | `--badge-attention-fg on --badge-attention` | 6.59:1 | 4.5 | PASS |
| `--badge-done` | 翻值 | `#5ec26a` | `#73d18f` | `--badge-done on --background` | 9.19:1 | 3 | PASS |
| `--badge-idle` | 翻值 | `#9ea3ae` | `#c0b8aa` | `--badge-idle on --background` | 8.73:1 | 3 | PASS |
| `--project-avatar-bg` | 翻值 | `#e97b35` | `#ff9b78` | `--project-avatar-fg on --project-avatar-bg` | 6.55:1 | 4.5 | PASS |
| `--project-avatar-fg` | 翻值 | `#ffffff` | `#47261a` | `--project-avatar-fg on --project-avatar-bg` | 6.55:1 | 4.5 | PASS |
| `--agent-avatar-bg` | 翻值 | `#26262b` | `#2d2a24` | `--foreground on --agent-avatar-bg` | 11.81:1 | 4.5 | PASS |
| `--chip-idle-bg` | 翻值 | `#26262b` | `#2d2a24` | `--chip-idle-fg on --chip-idle-bg` | 6.55:1 | 4.5 | PASS |
| `--chip-idle-fg` | 翻值 | `#9ea3ae` | `#b3afa8` | `--chip-idle-fg on --chip-idle-bg` | 6.55:1 | 4.5 | PASS |
| `--chip-plan-bg` | 翻值 | `#363140` | `#3e333c` | `--chip-plan-fg on --chip-plan-bg` | 6.74:1 | 4.5 | PASS |
| `--chip-plan-fg` | 翻值 | `#cba6f7` | `#e0afff` | `--chip-plan-fg on --chip-plan-bg` | 6.74:1 | 4.5 | PASS |
| `--chip-confirm-bg` | 翻值 | `#33221b` | `#422b0d` | `--chip-confirm-fg on --chip-confirm-bg` | 7.6:1 | 4.5 | PASS |
| `--chip-confirm-fg` | 翻值 | `#f2c24b` | `#f4b973` | `--chip-confirm-fg on --chip-confirm-bg` | 7.6:1 | 4.5 | PASS |
| `--chip-done-bg` | 翻值 | `#14291c` | `#193822` | `--chip-done-fg on --chip-done-bg` | 7.84:1 | 4.5 | PASS |
| `--chip-done-fg` | 翻值 | `#5ec26a` | `#8ddba2` | `--chip-done-fg on --chip-done-bg` | 7.84:1 | 4.5 | PASS |
| `--chip-failed-bg` | 翻值 | `#351c1a` | `#47242b` | `--chip-failed-fg on --chip-failed-bg` | 7.52:1 | 4.5 | PASS |
| `--chip-failed-fg` | 翻值 | `#dd524c` | `#ffaab9` | `--chip-failed-fg on --chip-failed-bg` | 7.52:1 | 4.5 | PASS |
| `--fail-fg` | 翻值 | `#d98b4a` | `#ffaf94` | `--fail-fg on --card` | 8.91:1 | 4.5 | PASS |
| `--seg-active` | 翻值 | `#35353d` | `#3f3c36` | `--foreground on --seg-active` | 9.08:1 | 4.5 | PASS |
| `--seg-hover` | 翻值 | `rgb(255 255 255 / 0.05)` | `rgb(255 252 248 / 0.05)` | `--seg-hover on --surface` | 1.16:1 | — | report-only |
| `--tab-chip-bg` | 翻值 | `#1e1e22` | `#25221d` | `--foreground on --tab-chip-bg` | 13.09:1 | 4.5 | PASS |
| `--stop` | 翻值 | `#dd524c` | `#ffaab9` | `--stop on --background` | 9.56:1 | 3 | PASS |
| `--diff-add-bg` | 翻值 | `#16281d` | `#193822` | `--diff-add-fg on --diff-add-bg` | 6:1 | 4.5 | PASS |
| `--diff-add-fg` | 翻值 | `#478266` | `#66c483` | `--diff-add-fg on --diff-add-bg` | 6:1 | 4.5 | PASS |
| `--diff-del-bg` | 翻值 | `#2e1c1a` | `#47242b` | `--destructive on --diff-del-bg` | 7.52:1 | 4.5 | PASS |
| `--dialog-bg` | 翻值 | `#1e1e22` | `#25221d` | `--foreground on --dialog-bg` | 13.09:1 | 4.5 | PASS |
| `--dialog-box-bg` | 翻值 | `#1e1e22` | `#25221d` | `--foreground on --dialog-box-bg` | 13.09:1 | 4.5 | PASS |
| `--dialog-row-bg` | 翻值 | `#26262b` | `#2d2a24` | `--foreground on --dialog-row-bg` | 11.81:1 | 4.5 | PASS |
| `--dialog-ring` | 翻值 | `#35353d` | `#3f3c36` | `--dialog-ring on --dialog-bg` | 1.44:1 | — | report-only |
| `--range-chip-bg` | 翻值 | `#26262b` | `#2d2a24` | `--foreground on --range-chip-bg` | 11.81:1 | 4.5 | PASS |
| `--range-chip-border` | 翻值 | `#35353d` | `#3f3c36` | `--range-chip-border on --range-chip-bg` | 1.3:1 | — | report-only |
| `--toggle-track` | 退役候选 | `#35353d` | `#3f3c36` | `--toggle-knob on --toggle-track` | 10.99:1 | — | report-only |
| `--tile-orange-bg` | 翻值 | `#33221b` | `#422b0d` | `--tile-orange-fg on --tile-orange-bg` | 7.6:1 | 4.5 | PASS |
| `--tile-orange-fg` | 翻值 | `#f2c24b` | `#f4b973` | `--tile-orange-fg on --tile-orange-bg` | 7.6:1 | 4.5 | PASS |
| `--tile-indigo-bg` | 翻值 | `#363140` | `#3e333c` | `--tile-indigo-fg on --tile-indigo-bg` | 6.74:1 | 4.5 | PASS |
| `--tile-indigo-fg` | 翻值 | `#cba6f7` | `#e0afff` | `--tile-indigo-fg on --tile-indigo-bg` | 6.74:1 | 4.5 | PASS |
| `--tile-hero-bg` | 翻值 | `#33221b` | `#422b0d` | `--foreground on --tile-hero-bg` | 10.96:1 | 4.5 | PASS |
| `--pill-idle-bg` | 翻值 | `#26262b` | `#2d2a24` | `--foreground on --pill-idle-bg` | 11.81:1 | 4.5 | PASS |
| `--dash-border` | 翻值 | `#35353d` | `#3f3c36` | `--dash-border on --surface` | 1.44:1 | — | report-only |
| `--row-selected` | 翻值 | `#26262b` | `#2d2a24` | `--foreground on --row-selected` | 11.81:1 | 4.5 | PASS |
| `--row-icon-bg` | 翻值 | `#35353d` | `#3f3c36` | `--foreground on --row-icon-bg` | 9.08:1 | 4.5 | PASS |
| `--overlay-divider` | 翻值 | `#26262b` | `#2d2a24` | `--overlay-divider on --popover` | 1.11:1 | — | report-only |
| `--overlay-select-indigo` | 翻值 | `#363140` | `#3e333c` | `--spot-text-on-tint on --overlay-select-indigo` | 6.74:1 | 4.5 | PASS |
| `--pick-selected-bg` | 翻值 | `#363140` | `#3e333c` | `--pick-selected-fg on --pick-selected-bg` | 6.74:1 | 4.5 | PASS |
| `--pick-selected-fg` | 翻值 | `#cba6f7` | `#e0afff` | `--pick-selected-fg on --pick-selected-bg` | 6.74:1 | 4.5 | PASS |
| `--chief-tab-bg` | 翻值 | `#26262b` | `#2d2a24` | `--foreground on --chief-tab-bg` | 11.81:1 | 4.5 | PASS |
| `--chief-tab-active` | 翻值 | `#35353d` | `#3f3c36` | `--foreground on --chief-tab-active` | 9.08:1 | 4.5 | PASS |
| `--notify-icon-bg` | 翻值 | `#35353d` | `#3f3c36` | `--card-button on --notify-icon-bg` | 5.28:1 | 3 | PASS |
| `--menu-icon` | 翻值 | `#71717a` | `#79756f` | `--menu-icon on --popover` | 3.46:1 | 3 | PASS |
| `--toggle-knob` | 退役候选 | `#ffffff` | `#ffffff` | `--toggle-knob on --toggle-track` | 10.99:1 | — | report-only |
| `--overlay-scrim` | 不变 | `rgb(0 0 0 / 0.6)` | `rgb(0 0 0 / 0.6)` | `--overlay-scrim on --background` | 1.15:1 | — | report-only |
| `--text-on-veil` | 不变 | `#ffffff` | `#ffffff` | `--text-on-veil on --overlay-scrim` | 19.67:1 | 4.5 | PASS |
| `--spot-soft` | 翻值 | `#363140` | `#3e333c` | `--spot-text-on-tint on --spot-soft` | 6.74:1 | 4.5 | PASS |
| `--accent-soft` | 翻值 | `rgb(203 166 247 / 0.14)` | `rgb(216 156 252 / 0.14)` | `--accent-soft on --surface` | 1.32:1 | — | report-only |
| `--danger-soft` | 翻值 | `rgb(224 90 90 / 0.14)` | `rgb(255 170 185 / 0.14)` | `--danger-soft on --surface` | 1.36:1 | — | report-only |
| `--spot-text-on-tint` | 翻值 | `#cba6f7` | `#e0afff` | `--spot-text-on-tint on --spot-soft` | 6.74:1 | 4.5 | PASS |
| `--spot-disabled` | 翻值 | `#8670a2` | `#906ba3` | `--spot-disabled-fg on --spot-disabled` | 2.75:1 | — | report-only |
| `--spot-disabled-fg` | 翻值 | `#ddc5fa` | `#e6bffd` | `--spot-disabled-fg on --spot-disabled` | 2.75:1 | — | report-only |
| `--primary-disabled` | 翻值 | `#8670a2` | `#906ba3` | `--spot-disabled-fg on --primary-disabled` | 2.75:1 | — | report-only |
| `--drop-tint-border` | 翻值 | `#cba6f7` | `#d89cfc` | `--drop-tint-border on --column` | 8.24:1 | 3 | PASS |
| `--drop-tint-base` | 翻值 | `rgb(203 166 247 / 0.05)` | `rgb(216 156 252 / 0.05)` | `--drop-tint-base on --column` | 1.08:1 | — | report-only |
| `--drop-tint-hover` | 翻值 | `rgb(203 166 247 / 0.1)` | `rgb(216 156 252 / 0.1)` | `--drop-tint-hover on --column` | 1.2:1 | — | report-only |
| `--surface-inset` | 翻值 | `#17171a` | `#1e1b16` | `--foreground on --surface-inset` | 14.17:1 | 4.5 | PASS |
| `--card-bg` | 翻值 | `#1e1e22` | `#25221d` | `--card-foreground on --card-bg` | 13.09:1 | 4.5 | PASS |
| `--popover-bg` | 翻值 | `#1e1e22` | `#25221d` | `--popover-foreground on --popover-bg` | 13.09:1 | 4.5 | PASS |
| `--text-primary` | 翻值 | `#eae8ee` | `#ede9e1` | `--text-primary on --background` | 14.17:1 | 4.5 | PASS |
| `--code-bg` | 翻值 | `#26262b` | `#2d2a24` | `--foreground on --code-bg` | 11.81:1 | 4.5 | PASS |
| `--danger` | 翻值 | `#e05a5a` | `#ffaab9` | `--danger on --background` | 9.56:1 | 3 | PASS |
| `--card-border` | 翻值 | `#26262b` | `#2d2a24` | `--card-border on --card` | 1.11:1 | — | report-only |

### 1.8 亮模 (light) 逐槽映射与实测

| 槽位 | 状态 | 旧值 (shadcn 现行) | 新值 (c.css 定版) | 角色对 (fg on bg) | 实测 | 阈值 | 结果 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `--background` | 翻值 | `#efece5` | `#f4efe7` | `--foreground on --background` | 16.71:1 | 4.5 | PASS |
| `--foreground` | 翻值 | `#15140f` | `#120f09` | `--foreground on --background` | 16.71:1 | 4.5 | PASS |
| `--card` | 翻值 | `#e7e3da` | `#efe9e1` | `--card-foreground on --card` | 15.86:1 | 4.5 | PASS |
| `--card-foreground` | 翻值 | `#15140f` | `#120f09` | `--card-foreground on --card` | 15.86:1 | 4.5 | PASS |
| `--popover` | 翻值 | `#e7e3da` | `#efe9e1` | `--popover-foreground on --popover` | 15.86:1 | 4.5 | PASS |
| `--popover-foreground` | 翻值 | `#15140f` | `#120f09` | `--popover-foreground on --popover` | 15.86:1 | 4.5 | PASS |
| `--primary` | 翻值 | `#171717` | `#120f09` | `--primary-foreground on --primary` | 18.32:1 | 4.5 | PASS |
| `--primary-foreground` | 不变 | `#fafafa` | `#fafafa` | `--primary-foreground on --primary` | 18.32:1 | 4.5 | PASS |
| `--secondary` | 翻值 | `#e7e3da` | `#e8e3da` | `--secondary-foreground on --secondary` | 14.96:1 | 4.5 | PASS |
| `--secondary-foreground` | 翻值 | `#15140f` | `#120f09` | `--secondary-foreground on --secondary` | 14.96:1 | 4.5 | PASS |
| `--muted` | 翻值 | `#ddd8cc` | `#e8e3da` | `--muted-foreground on --muted` | 10.12:1 | 4.5 | PASS |
| `--muted-foreground` | 翻值 | `#55534a` | `#35312a` | `--muted-foreground on --background` | 11.3:1 | 4.5 | PASS |
| `--accent` | 翻值 | `#e2ded4` | `#e8e3da` | `--accent-foreground on --accent` | 14.96:1 | 4.5 | PASS |
| `--accent-foreground` | 翻值 | `#15140f` | `#120f09` | `--accent-foreground on --accent` | 14.96:1 | 4.5 | PASS |
| `--destructive` | 翻值 | `#c73e3e` | `#9d2c4c` | `--destructive-foreground on --destructive` | 7.25:1 | 4.5 | PASS |
| `--destructive-foreground` | 不变 | `#ffffff` | `#ffffff` | `--destructive-foreground on --destructive` | 7.25:1 | 4.5 | PASS |
| `--border` | 翻值 | `#e2ded4` | `#e8e3da` | `--border on --background` | 1.12:1 | — | report-only |
| `--input` | 翻值 | `#cbc5b6` | `#c9c4bc` | `--input on --background` | 1.52:1 | 1.5 | PASS |
| `--ring` | 翻值 | `#86826f` | `#8d8980` | `--ring on --background` | 3.05:1 | 3 | PASS |
| `--column` | 翻值 | `#efece5` | `#f4efe7` | `--foreground on --column` | 16.71:1 | 4.5 | PASS |
| `--col-bg` | 翻值 | `#efece5` | `#f4efe7` | `--foreground on --col-bg` | 16.71:1 | 4.5 | PASS |
| `--col-head-text` | 翻值 | `#57534e` | `#57534c` | `--col-head-text on --col-bg` | 6.68:1 | 4.5 | PASS |
| `--sidebar-hover` | 翻值 | `rgb(28 25 23 / 0.05)` | `rgb(28 25 20 / 0.05)` | `--sidebar-hover on --surface` | 1.1:1 | — | report-only |
| `--sidebar-active` | 翻值 | `rgb(28 25 23 / 0.1)` | `rgb(28 25 20 / 0.1)` | `--sidebar-active on --surface` | 1.22:1 | — | report-only |
| `--surface` | 翻值 | `#e7e3da` | `#efe9e1` | `--foreground on --surface` | 15.86:1 | 4.5 | PASS |
| `--surface-secondary` | 翻值 | `#ddd8cc` | `#e8e3da` | `--foreground on --surface-secondary` | 14.96:1 | 4.5 | PASS |
| `--surface-tertiary` | 翻值 | `#ddd8cc` | `#e0dbd2` | `--foreground on --surface-tertiary` | 13.87:1 | 4.5 | PASS |
| `--surface-elevated` | 翻值 | `#e7e3da` | `#efe9e1` | `--foreground on --surface-elevated` | 15.86:1 | 4.5 | PASS |
| `--surface-hover` | 翻值 | `#e2ded4` | `#e8e3da` | `--foreground on --surface-hover` | 14.96:1 | 4.5 | PASS |
| `--surface-press` | 翻值 | `#ddd8cc` | `#e0dbd2` | `--foreground on --surface-press` | 13.87:1 | 4.5 | PASS |
| `--text-secondary` | 翻值 | `#44403c` | `#35312a` | `--text-secondary on --background` | 11.3:1 | 4.5 | PASS |
| `--text-tertiary` | 翻值 | `#57534e` | `#57534c` | `--text-tertiary on --background` | 6.68:1 | 4.5 | PASS |
| `--text-dim` | 翻值 | `#a8a29e` | `#8d8980` | `--text-dim on --background` | 3.05:1 | 3 | PASS |
| `--border-default` | 翻值 | `#e2ded4` | `#e8e3da` | `--border-default on --background` | 1.12:1 | — | report-only |
| `--border-strong` | 翻值 | `#cbc5b6` | `#c9c4bc` | `--border-strong on --background` | 1.52:1 | 1.5 | PASS |
| `--card-button` | 翻值 | `#8839ef` | `#7f2da7` | `--text-on-accent on --card-button` | 7.41:1 | 4.5 | PASS |
| `--text-on-accent` | 不变 | `#ffffff` | `#ffffff` | `--text-on-accent on --card-button` | 7.41:1 | 4.5 | PASS |
| `--focus-ring` | 翻值 | `#8839ef` | `#7f2da7` | `--focus-ring on --background` | 6.47:1 | 3 | PASS |
| `--col-dot-idle` | 翻值 | `#9ea3ae` | `#645b4c` | `--col-dot-idle on --background` | 5.84:1 | 3 | PASS |
| `--col-dot-confirm` | 翻值 | `#e9a23b` | `#faab3f` | `--col-dot-confirm on --background` | 1.67:1 | — | report-only |
| `--col-dot-building` | 翻值 | `#4e81ee` | `#00648c` | `--col-dot-building on --background` | 5.73:1 | 3 | PASS |
| `--col-dot-done` | 翻值 | `#5ec26a` | `#006f36` | `--col-dot-done on --background` | 5.51:1 | 3 | PASS |
| `--badge-attention` | 翻值 | `#e9a23b` | `#faab3f` | `--badge-attention-fg on --badge-attention` | 6.46:1 | 4.5 | PASS |
| `--badge-attention-fg` | 翻值 | `#17171a` | `#4c2e00` | `--badge-attention-fg on --badge-attention` | 6.46:1 | 4.5 | PASS |
| `--badge-done` | 翻值 | `#5ec26a` | `#006f36` | `--badge-done on --background` | 5.51:1 | 3 | PASS |
| `--badge-idle` | 翻值 | `#9ea3ae` | `#645b4c` | `--badge-idle on --background` | 5.84:1 | 3 | PASS |
| `--project-avatar-bg` | 翻值 | `#e97b35` | `#cd5f37` | `--project-avatar-fg on --project-avatar-bg` | 4.5:1 | 4.5 | PASS |
| `--project-avatar-fg` | 翻值 | `#ffffff` | `#310a00` | `--project-avatar-fg on --project-avatar-bg` | 4.5:1 | 4.5 | PASS |
| `--agent-avatar-bg` | 翻值 | `#e7e3da` | `#e8e3da` | `--foreground on --agent-avatar-bg` | 14.96:1 | 4.5 | PASS |
| `--chip-idle-bg` | 翻值 | `#e7e3da` | `#e8e3da` | `--chip-idle-fg on --chip-idle-bg` | 5.98:1 | 4.5 | PASS |
| `--chip-idle-fg` | 翻值 | `#4d5562` | `#57534c` | `--chip-idle-fg on --chip-idle-bg` | 5.98:1 | 4.5 | PASS |
| `--chip-plan-bg` | 翻值 | `#dacbdd` | `#dfcfd9` | `--chip-plan-fg on --chip-plan-bg` | 7.64:1 | 4.5 | PASS |
| `--chip-plan-fg` | 翻值 | `#6d28d9` | `#562071` | `--chip-plan-fg on --chip-plan-bg` | 7.64:1 | 4.5 | PASS |
| `--chip-confirm-bg` | 翻值 | `#fffbed` | `#ffe5c8` | `--chip-confirm-fg on --chip-confirm-bg` | 5.53:1 | 4.5 | PASS |
| `--chip-confirm-fg` | 翻值 | `#a85923` | `#825100` | `--chip-confirm-fg on --chip-confirm-bg` | 5.53:1 | 4.5 | PASS |
| `--chip-done-bg` | 翻值 | `#ecfdf3` | `#c2f5ce` | `--chip-done-fg on --chip-done-bg` | 8.38:1 | 4.5 | PASS |
| `--chip-done-fg` | 翻值 | `#15803d` | `#004c23` | `--chip-done-fg on --chip-done-bg` | 8.38:1 | 4.5 | PASS |
| `--chip-failed-bg` | 翻值 | `#fcf3f2` | `#ffdce1` | `--chip-failed-fg on --chip-failed-bg` | 8.87:1 | 4.5 | PASS |
| `--chip-failed-fg` | 翻值 | `#ca3a32` | `#6b1f33` | `--chip-failed-fg on --chip-failed-bg` | 8.87:1 | 4.5 | PASS |
| `--fail-fg` | 翻值 | `#cc7c2e` | `#833a1f` | `--fail-fg on --card` | 6.72:1 | 4.5 | PASS |
| `--seg-active` | 翻值 | `#ddd8cc` | `#e0dbd2` | `--foreground on --seg-active` | 13.87:1 | 4.5 | PASS |
| `--seg-hover` | 翻值 | `rgb(28 25 23 / 0.05)` | `rgb(28 25 20 / 0.05)` | `--seg-hover on --surface` | 1.1:1 | — | report-only |
| `--tab-chip-bg` | 翻值 | `#e7e3da` | `#efe9e1` | `--foreground on --tab-chip-bg` | 15.86:1 | 4.5 | PASS |
| `--stop` | 翻值 | `#dd524c` | `#9d2c4c` | `--stop on --background` | 6.33:1 | 3 | PASS |
| `--diff-add-bg` | 翻值 | `#eaf1e8` | `#c2f5ce` | `--diff-add-fg on --diff-add-bg` | 6.45:1 | 4.5 | PASS |
| `--diff-add-fg` | 翻值 | `#499771` | `#005f2d` | `--diff-add-fg on --diff-add-bg` | 6.45:1 | 4.5 | PASS |
| `--diff-del-bg` | 翻值 | `#f8e6e4` | `#ffdce1` | `--destructive on --diff-del-bg` | 5.72:1 | 4.5 | PASS |
| `--dialog-bg` | 翻值 | `#e7e3da` | `#efe9e1` | `--foreground on --dialog-bg` | 15.86:1 | 4.5 | PASS |
| `--dialog-box-bg` | 翻值 | `#e7e3da` | `#efe9e1` | `--foreground on --dialog-box-bg` | 15.86:1 | 4.5 | PASS |
| `--dialog-row-bg` | 翻值 | `#ddd8cc` | `#e8e3da` | `--foreground on --dialog-row-bg` | 14.96:1 | 4.5 | PASS |
| `--dialog-ring` | 翻值 | `#cbc5b6` | `#c9c4bc` | `--dialog-ring on --dialog-bg` | 1.44:1 | — | report-only |
| `--range-chip-bg` | 翻值 | `#e7e3da` | `#e8e3da` | `--foreground on --range-chip-bg` | 14.96:1 | 4.5 | PASS |
| `--range-chip-border` | 翻值 | `#cbc5b6` | `#c9c4bc` | `--range-chip-border on --range-chip-bg` | 1.36:1 | — | report-only |
| `--toggle-track` | 退役候选 | `#cbc5b6` | `#c9c4bc` | `--toggle-knob on --toggle-track` | 1.73:1 | — | report-only |
| `--tile-orange-bg` | 翻值 | `#f0e5d5` | `#ffe5c8` | `--tile-orange-fg on --tile-orange-bg` | 5.53:1 | 4.5 | PASS |
| `--tile-orange-fg` | 翻值 | `#e9a23b` | `#825100` | `--tile-orange-fg on --tile-orange-bg` | 5.53:1 | 4.5 | PASS |
| `--tile-indigo-bg` | 翻值 | `#dacbdd` | `#dfcfd9` | `--tile-indigo-fg on --tile-indigo-bg` | 7.64:1 | 4.5 | PASS |
| `--tile-indigo-fg` | 翻值 | `#6d28d9` | `#562071` | `--tile-indigo-fg on --tile-indigo-bg` | 7.64:1 | 4.5 | PASS |
| `--tile-hero-bg` | 翻值 | `#f8ead8` | `#ffd099` | `--foreground on --tile-hero-bg` | 13.42:1 | 4.5 | PASS |
| `--pill-idle-bg` | 翻值 | `#ddd8cc` | `#e8e3da` | `--foreground on --pill-idle-bg` | 14.96:1 | 4.5 | PASS |
| `--dash-border` | 翻值 | `#cbc5b6` | `#c9c4bc` | `--dash-border on --surface` | 1.44:1 | — | report-only |
| `--row-selected` | 翻值 | `#e2ded4` | `#e8e3da` | `--foreground on --row-selected` | 14.96:1 | 4.5 | PASS |
| `--row-icon-bg` | 翻值 | `#ddd8cc` | `#e0dbd2` | `--foreground on --row-icon-bg` | 13.87:1 | 4.5 | PASS |
| `--overlay-divider` | 翻值 | `#e2ded4` | `#e8e3da` | `--overlay-divider on --popover` | 1.06:1 | — | report-only |
| `--overlay-select-indigo` | 翻值 | `#dacbdd` | `#dfcfd9` | `--spot-text-on-tint on --overlay-select-indigo` | 7.64:1 | 4.5 | PASS |
| `--pick-selected-bg` | 翻值 | `#dacbdd` | `#dfcfd9` | `--pick-selected-fg on --pick-selected-bg` | 7.64:1 | 4.5 | PASS |
| `--pick-selected-fg` | 翻值 | `#6d28d9` | `#562071` | `--pick-selected-fg on --pick-selected-bg` | 7.64:1 | 4.5 | PASS |
| `--chief-tab-bg` | 翻值 | `#ddd8cc` | `#e8e3da` | `--foreground on --chief-tab-bg` | 14.96:1 | 4.5 | PASS |
| `--chief-tab-active` | 翻值 | `#e7e3da` | `#e0dbd2` | `--foreground on --chief-tab-active` | 13.87:1 | 4.5 | PASS |
| `--notify-icon-bg` | 翻值 | `#dacbdd` | `#dfcfd9` | `--card-button on --notify-icon-bg` | 4.96:1 | 3 | PASS |
| `--menu-icon` | 翻值 | `#1c1917` | `#120f09` | `--menu-icon on --popover` | 15.86:1 | 3 | PASS |
| `--toggle-knob` | 退役候选 | `#ffffff` | `#ffffff` | `--toggle-knob on --toggle-track` | 1.73:1 | — | report-only |
| `--overlay-scrim` | 不变 | `rgb(0 0 0 / 0.6)` | `rgb(0 0 0 / 0.6)` | `--overlay-scrim on --background` | 5.48:1 | — | report-only |
| `--text-on-veil` | 不变 | `#ffffff` | `#ffffff` | `--text-on-veil on --overlay-scrim` | 6.27:1 | 4.5 | PASS |
| `--spot-soft` | 翻值 | `#dacbdd` | `#dfcfd9` | `--spot-text-on-tint on --spot-soft` | 7.64:1 | 4.5 | PASS |
| `--accent-soft` | 翻值 | `rgb(136 57 239 / 0.14)` | `rgb(127 45 167 / 0.14)` | `--accent-soft on --surface` | 1.24:1 | — | report-only |
| `--danger-soft` | 翻值 | `rgb(199 62 62 / 0.14)` | `rgb(157 44 76 / 0.14)` | `--danger-soft on --surface` | 1.24:1 | — | report-only |
| `--spot-text-on-tint` | 翻值 | `#6d28d9` | `#562071` | `--spot-text-on-tint on --spot-soft` | 7.64:1 | 4.5 | PASS |
| `--spot-disabled` | 翻值 | `#ae7de7` | `#ac78be` | `--spot-disabled-fg on --spot-disabled` | 3.4:1 | — | report-only |
| `--spot-disabled-fg` | 不变 | `#ffffff` | `#ffffff` | `--spot-disabled-fg on --spot-disabled` | 3.4:1 | — | report-only |
| `--primary-disabled` | 翻值 | `#ae7de7` | `#ac78be` | `--spot-disabled-fg on --primary-disabled` | 3.4:1 | — | report-only |
| `--drop-tint-border` | 翻值 | `#8839ef` | `#7f2da7` | `--drop-tint-border on --column` | 6.47:1 | 3 | PASS |
| `--drop-tint-base` | 翻值 | `rgb(136 57 239 / 0.05)` | `rgb(127 45 167 / 0.05)` | `--drop-tint-base on --column` | 1.08:1 | — | report-only |
| `--drop-tint-hover` | 翻值 | `rgb(136 57 239 / 0.1)` | `rgb(127 45 167 / 0.1)` | `--drop-tint-hover on --column` | 1.16:1 | — | report-only |
| `--surface-inset` | 翻值 | `#efece5` | `#f4efe7` | `--foreground on --surface-inset` | 16.71:1 | 4.5 | PASS |
| `--card-bg` | 翻值 | `#e7e3da` | `#efe9e1` | `--card-foreground on --card-bg` | 15.86:1 | 4.5 | PASS |
| `--popover-bg` | 翻值 | `#e7e3da` | `#efe9e1` | `--popover-foreground on --popover-bg` | 15.86:1 | 4.5 | PASS |
| `--text-primary` | 翻值 | `#15140f` | `#120f09` | `--text-primary on --background` | 16.71:1 | 4.5 | PASS |
| `--code-bg` | 翻值 | `#ddd8cc` | `#e8e3da` | `--foreground on --code-bg` | 14.96:1 | 4.5 | PASS |
| `--danger` | 翻值 | `#c73e3e` | `#9d2c4c` | `--danger on --background` | 6.33:1 | 3 | PASS |
| `--card-border` | 翻值 | `#e2ded4` | `#e8e3da` | `--card-border on --card` | 1.06:1 | — | report-only |


## 2. 几何

几何正本值取 c.css 的 geometry 块（`--radius` 族 / `--pad-*` / `--row-h` / `--label-*` / `--title-*` / 四档投影）与 tokens.css 非颜色层。#909 冻结了 shadcn 件几何逐字节（原型 `components/ui/` 与 apps/web byte-identical）——几何重设计只通过 token 值翻转表达，件类结构不动。故本节件级几何 = shadcn 上游默认 + 仓内已记录偏离，半径/投影随 token 翻转整体变。

### 2.1 radius 阶梯

`--radius` 是半径基，从现行 0.625rem（10px）翻到定版 0.875rem（14px）。Tailwind 半径族走官方乘数形态（shadcn.css `@theme inline`），翻基值一档带动全族：

| 半径档 | 乘数 | 现行 (--radius 10px) | 定版 (--radius 14px) |
| --- | --- | --- | --- |
| `rounded-sm` | 0.6× | 6px | 8.4px |
| `rounded-md` | 0.8× | 8px | 11.2px |
| `rounded-lg` | 1× (= --radius) | 10px | 14px |
| `rounded-xl` | 1.4× | 14px | 19.6px |
| `rounded-2xl` | 1.8× | 18px | 25.2px |
| `rounded-3xl` | 2.2× | 22px | 30.8px |
| `rounded-4xl` | 2.6× | 26px | 36.4px |

独立半径槽（非乘数族）：

| 槽 | 现行 | 定版 | 用途 |
| --- | --- | --- | --- |
| `--edge-radius` | 12px | 14px | 抬升面发丝环半径（#139 统一边框语言） |
| `--radius-popover` | 10px | 12px | popover 族半径 |

行为理由：C · 纸兰是 editorial/craft 气质，14px 大圆角 + 分层软投影是 #909 用户实审定版的几何语言（柔和向，三方向中最宽松之一）。件圆角不逐件改，一律经 `--radius` 翻转派生——避免逐件半径漂移，也让「圆角对齐外=内+padding」的同心圆角律（better-ui）随乘数族自动成立。

### 2.2 spacing 阶梯

仓内无 `--spacing` 覆写，走 Tailwind v4 默认 4px 基（`spacing-N` = N×4px：1=4、1.5=6、2=8、2.5=10、3=12、4=16、5=20、6=24、8=32 …）。语义密度 token（定版新增，现行 apps/web 无此名）：

| 槽 | 值 | 用途 |
| --- | --- | --- |
| `--pad-card` | 16px | 卡片/面板内边距 |
| `--pad-page` | 28px | 页面级留白 |
| `--row-h` | 40px | 列表行高 |

原型 dialog 实测间距（参考，非 token）：表单列 gap 12px、动作行 gap 8px、面板 padding 16px。密度口径：C 是三方向中最宽松（#909 决议），行高 40px = 32px 控件 + 4px×2 竖向 padding，与 shadcn 控件默认高自洽（见 §2.5/§2.6）。

### 2.3 font-size 阶梯

仓内无 `--font-size`/`--text-*` 覆写，走 Tailwind v4 默认 text 阶梯。正文 = 14px（`text-sm`，base.css body）。

| Tailwind 档 | px / 行高 |
| --- | --- |
| `text-xs` | 12 / 16 |
| `text-sm` | 14 / 20（正文） |
| `text-base` | 16 / 24 |
| `text-lg` | 18 / 28 |
| `text-xl` | 20 / 28 |

语义文字 token（定版新增）：

| 槽 | 值 | 用途 |
| --- | --- | --- |
| `--label-size` | 12px | 控件/字段标签字号（= text-xs） |
| `--label-spacing` | 0.01em | 标签字距 |
| `--label-transform` | none | 标签无大写变换（有意弃 all-caps） |
| `--title-weight` | 590 | 标题字重（Inter 可变字体） |
| `--title-tracking` | -0.02em | 标题字距 |
| `--font-label` | var(--font-sans) | 标签字体栈 |

字体：Inter（sans，`--font-sans`）+ JetBrains Mono（monospace，`--font-mono`）。原型控件 label / 主钮实测用 13px（arbitrary `text-[13px]`）、hint 用 12px——arbitrary value 允许面见 §3.1。

### 2.4 shadow 阶梯

定版翻转四档投影（c.css 持值，双模各一份），沿用 tokens.css 保留档：

**翻转档（c.css 持值）：**

| 槽 | 暗 | 亮 | 用途 |
| --- | --- | --- | --- |
| `--card-shadow` | `0 2px 6px rgb(0 0 0 / 0.24)` | `0 2px 8px rgb(28 25 23 / 0.08)` | 卡静止投影（small-card 族） |
| `--edge-shadow` | `0 8px 24px rgb(0 0 0 / 0.4)` | `0 8px 24px rgb(28 25 23 / 0.14)` | 抬升面投影（popover/panel/fab） |
| `--plate-shadow` | `none` | `0 6px 16px rgb(0 0 0 / 0.12)` | 手搓 overlay 盘投影 |
| `--dialog-shadow` | `0 12px 32px rgb(0 0 0 / 0.45)` | `0 12px 32px rgb(28 25 23 / 0.18)` | 模态 dialog 投影 |

**保留档（tokens.css 持值，c.css 未持，#915 不动）：**

| 槽 | 值 | 注 |
| --- | --- | --- |
| `--drag-shadow` | `0 8px 24px rgb(0 0 0 / 0.18)` | 拖拽浮起克隆，主题恒定 |
| `--chief-shadow` | 暗 `0 4px 24px rgb(0 0 0 / 0.35)` / 亮 `0 4px 24px rgb(28 25 23 / 0.16)` | chief drawer |
| `--fab-shadow` | `var(--edge-shadow)` 别名 | 随 edge-shadow 翻转 |
| `--edge-ring` | `inset 0 0 0 1px var(--border-default)` | 结构发丝环（非投影，随 border 值翻） |

行为理由：C · 纸兰用分层软投影管层次（better-ui「阴影管层次 / 边框管结构」）。`--plate-shadow` 从 #854 的硬偏移档（亮 `4px 4px 0`，零 blur）翻为软 blur 档（`0 6px 16px`）——硬偏移盘是前一方向（Herdr 紫）的语言，随 D1/D2 色相与几何重设计退役；暗侧 `--plate-shadow` 仍 `none`（暗「线框承重」口径不变，#854 用户裁定）。

### 2.5 shadcn 件级几何默认值

#909 冻结件几何，以下为正本（件只消费 token，不逐件改几何）：

**Button**（`components/ui/button.tsx`，size 阶梯）：

| size | 高 | 圆角 | 字号 | 横 padding |
| --- | --- | --- | --- | --- |
| `default` | h-8 = 32px | rounded-lg = 14px | text-sm = 14px | px-2.5 = 10px |
| `xs` | h-6 = 24px | rounded-[min(--radius-md,10px)] = 10px | text-xs = 12px | px-2 = 8px |
| `sm` | h-7 = 28px | rounded-[min(--radius-md,12px)] = 11.2px | text-[0.8rem] = 12.8px | px-2.5 = 10px |
| `lg` | h-9 = 36px | rounded-lg = 14px | text-sm = 14px | px-2.5 = 10px |
| `icon` | size-8 = 32px | rounded-lg = 14px | — | — |
| `icon-xs` | size-6 = 24px | min(--radius-md,10px) = 10px | — | — |
| `icon-sm` | size-7 = 28px | min(--radius-md,12px) = 11.2px | — | — |
| `icon-lg` | size-9 = 36px | rounded-lg = 14px | — | — |

（Button 圆角随 `--radius` 翻转整体变：default/lg 从现行 10px → 定版 14px；xs/sm 被 `min()` 上限卡在 10 / 11.2px。）

**Input**（`components/ui/input.tsx`）：高 h-8 = 32px，圆角 `rounded-none`（方角），边框 `border-input`，padding px-2.5（10px）/ py-1（4px），字号 text-base（16px）→ md:text-sm（14px），`min-w-0`。

**Switch**（`components/ui/switch.tsx`）：default h-[18.4px] w-[32px]，sm h-[14px] w-[24px]；thumb default size-4（16px）/ sm size-3（12px），`rounded-full`。track/thumb 色消费 `--input`（unchecked）/ `--primary`（checked）/ `--background`·`--foreground`（thumb），实测对比见 §1.5。

### 2.6 显式 override 清单（每项附行为理由）

以下是仓内对 shadcn 上游默认或旧仓几何的显式偏离，施工批次照此执行、不再自裁：

| # | Override 项 | 值 / 口径 | 行为理由 |
| --- | --- | --- | --- |
| 1 | **36px 输入框族退役** | 旧 `src/ui/input.css .input`（height 36px、radius 0）与 `dialog.css .dlg-input`（36px）不留；正本控件高 = shadcn Input 默认 **h-8 = 32px** | ① D3 令所有交互元素由 shadcn 件承载、per-face CSS 清零——`.input`/`.dlg-input` 的载体本身退役，36px 值无附着点；② Button 默认与 Input 统一到 32px，单一控件高正本，与 `--row-h` 40px 自洽（32 控件 + 4×2 padding）；③ #909 冻结了 shadcn 件几何，32px 是用户实审定版 C 方向已渲染的默认值，采 36px 反而是对定版的未授权偏离。真需高控件时用 size 阶梯（lg = h-9 = 36px），不另造 36px 死值。4px 收缩是 D2 几何自由重设计的有意结果，非回归。 |
| 2 | **Button focus 环** | `focus-visible:[outline:2px_solid_var(--focus-ring)]` + `outline-offset-2`，替上游 `outline-none` + 灰 ring | 仓级 #388 focus 环 canon（2px 实线 + offset 2）；环色 `--focus-ring` 与 `--card-button` 语义分离独立成名（#435 D3），值随品牌翻 |
| 3 | **Button brand 档** | 新增 `variant=brand`：`bg-(--card-button) text-(--text-on-accent)`，hover `brightness-[1.07]`，disabled `bg-(--spot-disabled)` | 仓内品牌实底档（轨 A3 ui/Button primary 等价迁移位，#423/#426）；hover 走 brightness 不降透明度（disabled 由 pointer-events-none 承接，hover 不命中） |
| 4 | **Button transition 窄写** | `transition-[color,background-color,border-color,filter]`，替 `transition-all`/`transition-colors` | TW 的 transition-all 属性表含 outline-color，会把 focus 环吞进过渡初值（#15 探针实测） |
| 5 | **Button type 默认** | `type` 默认 `button`（非 submit） | 防表单内隐式 submit（仓内 ui/button 同律） |
| 6 | **Input 方角** | `rounded-none`（上游默认 `rounded-md`） | 沿旧 `.input` 方角语言（旧 input.css `border-radius:0`），#909 冻结原样。**无 inline 行为理由记录**——批次若要圆角输入框须回视觉方向票补裁，不自行改（见 §4 回调项） |
| 7 | **--plate-shadow 亮侧软化** | 亮 `4px 4px 0`（硬偏移）→ `0 6px 16px`（软 blur） | C · 纸兰分层软投影语言替 #854 硬偏移盘语言（前一 Herdr 紫方向），见 §2.4；暗侧维持 `none` |

## 3. 载体规约（Tailwind 类书写）

### 3.1 类书写规约

- **token 工具类优先**：消费颜色用 `bg-(--slot)`/`text-(--slot)`/`border-(--slot)`（Tailwind v4 CSS 变量简写，`bg-(--x)` = `bg-[var(--x)]`），圆角用 `rounded-sm…4xl` 乘数档，间距用 `spacing-N` 4px 阶梯。角色有 token 必走 token，禁裸值（better-colors：「角色没 token 就加 token」，不是写 arbitrary 值）。
- **arbitrary value 何时允许**：仅限 (a) 阶梯外的一次性几何尺寸（如 Switch `w-[32px]`、Button sm `text-[0.8rem]`、控件 label `text-[13px]`），(b) `min()`/`calc()` 复合形态（如 Button xs/sm 的 `rounded-[min(var(--radius-md),10px)]`）。**颜色 arbitrary 值是坏味道**——遇无 token 的颜色角色先加 token，不写 `bg-[#hex]`。
- **禁新增 per-face CSS、禁新增裸控件**（#908 跨车道纪律）：施工期样式只能成为 shadcn 件上的 Tailwind 类。`.dlg-*` 别名残骸随 #910 裁定 3 处置（状态类断言归行为、载体改 `aria-*`/`data-state`）。

### 3.2 token 记法：hex/rgb，禁 oklch

- 正本契约（ADR 0010 D5.4，继承 #910 裁定 4 全盘继承 #411）：token 持值一律 hex/rgb 记法，**禁 oklch**。原因：e2e 值探针（computed-style 探针 + `apps/web/e2e/png.ts` luma 探针）按 rgb 字符串正则解析，`oklch()` 函数通道会被正则误读 → 假红。
- `color-mix(in srgb, …)` **允许**：它在渲染时被浏览器解析成 rgb，computed-style 读回的是 rgb 字符串，探针正常读。P0 语义槽六名的 color-mix 公式保持（§1.4）。
- c.css 实测全 hex/rgb 零 oklch，契约天然兼容——#915 翻值不会引入 oklch。

### 3.3 oklch 旧坑处置（票面问答）

票面问「oklch 被探针正则误读的旧坑是否随探针重写消失」。答：按 #910 裁定 4，探针工具面**全盘继承 #411、不重写**（`toHaveScreenshot` 维持 0 处，保留 computed-style 探针 + png.ts luma 探针两件窄口径），故 hex/rgb 记法契约**存续，不因工具重写而解除**。本册把它固化为载体规约：只要探针按 rgb 正则读 computed 值，token 记法就锁 hex/rgb。#921 探针 dump 工具做重钉时，内联值也取本册表的 hex/rgb 实测为准。

## 4. 与原型冲突 / 回调项

本册与 #909 定版原型整体一致（色板、几何 token、件几何均取自 c.css 与冻结件）。以下几处需施工期注意或回调视觉方向票（#909）/ 值翻转票（#915）：

1. **亮模 Switch unchecked thumb 对比度偏软**（实测发现，非门控失败）：shadcn Switch 亮模 OFF 态 thumb（`bg-background` #f4efe7）压 track（`bg-input` #c9c4bc）= **1.52:1**，低于 UI 组件 3:1。但状态载体是 track 色翻转（OFF `--input` → ON `--primary` = **11.03:1**，见 §1.5）+ thumb 位置，WCAG 1.4.11 的「状态可辨」由 track 翻转满足；thumb 低对比是亮模软发丝线语言下的一致性打磨项，非 AA 门控失败。**处置**：不改色板（better-colors report-not-repaint + 色板已 #909 封版）；#915/批次若判 OFF 态 thumb 过弱，可给 thumb 加 1px 描边或投影（件级，不动 token 值），但须回视觉方向票补裁，不自行加。
2. **`--toggle-track`/`--toggle-knob` 退役**（需 #915 执行）：两槽唯一消费点是随 D3 清零的 per-face 手搓 toggle（`detail/overlays.css` `.dlg-toggle`、`secondary.css`），迁 shadcn Switch 后孤儿化。**处置**：#915 翻值时把两槽从 shadcn.css/tokens.css 删除（不搬进新色板）；本册已标「退役候选」。
3. **Input 方角无 inline 理由**（§2.6 override 6）：`rounded-none` 沿旧语言但件内无注释记录行为理由。批次若要圆角输入框，回视觉方向票补裁。
4. **几何 token 落点**：`--pad-card`/`--pad-page`/`--row-h`/`--label-*`/`--title-*` 是定版新增的具名 token（现行 apps/web 无）。#915/首批落地时须决定这些新几何 token 落哪个文件——本册给值与用途，落点随 #915 值翻转票的非颜色层口径（tokens.css 现持非颜色 token，是自然落点）。

## 5. 老 ui/ 原语退役正典表（#942）

> 状态：**已裁决并生效**（2026-10-06，#942 wayfinder task 产出，账与消费点 grep 逐点复核 @ b38e70d7）。12 张域票（#943–#953）只执行本表，不自行设计。本节管「老 `src/ui/` 原语与 `ui/dialog.css` 别名逐点迁到什么件、e2e 钉扎换到什么载体、哪张票执行」；色值/几何值不在此钉——一律取本册 §1.7/1.8（#915 翻值后）与 §2 阶梯。

### 5.0 执行总则

- **退役面界定 = 规则住址**。只有规则住在 `src/ui/`（chip.css / input.css / dialog.css）的类与原语件属于本表。同 `dlg-` 前缀但规则住在域 CSS 的 per-face 类（`dlg-accept-*`、`dlg-enroll-*`、`dlg-branch-*`、`dlg-history-*`、`dlg-token-*`、`dlg-provider-*`（除 create/seg-tab/model-add 三枚）、`dlg-skill-*`、`dlg-ghissues`、`dlg-agent-*`（除 create）、`dlg-reset-*`、`dlg-machine-*`、`dlg-toggle*` 等）归各域票的 per-face CSS 清零账，**不属本表**；`--toggle-track`/`--toggle-knob` 两槽退役走 §1.6 + §4-2 既有裁定。
- **对旧账的更正**：#908/#913 侦察账「老原语消费 20 文件 24 处」把两类不该入账的面计了进去——① 已经 shadcn 化的 `components/ui/input.js` import（16 处，如 overlay/ 三件、skills-page、filter-panel，它们不是退役对象，已是正典形态）；② 仅前缀相同的 per-face 类消费点。本表 §5.1 的逐点账以「规则住址」重新划界，域票以本表为准，不再追旧账里的幽灵点（如 #944 票面的「skills-page chip/input 消费」实为 shadcn Input，无动作）。
- **时序**（#913 裁决 3）：消费面迁移 = 各域票随改（#910 裁定 2，同 PR 完成类退役 + spec 重钉）；`ui/` 目录终删 + dialog-shell 壳级别名摘除 + `.dlg-shell`/`.dlg-viewport` 机制内联 = #952（唯一持有 `components/ui/` 既有件改动授权的票）；终态核账 = #953。
- **载体与替换类同 PR 落地**：语义载体（role/label/text，#910 一级）不依赖任何新属性，域票可先行重钉；需要新增载体（`data-tone`、testid）的点，载体随 StatusChip 件/执行票落 DOM，钉它的 spec 在同一个 PR 里重钉——两票永不同刻改同一 spec。
- **别名类残留合法**：类名从 CSS 规则退役 ≠ 立刻从 DOM 摘除。执行域完成 per-face 清零前，别名类（`detail-chip--*`、`search-row-chip` 等）可经 className 透传存活；#952 删 `ui/` 目录前 grep 消费点 = 0 的既有核过律不变。

### 5.1 消费面逐点总账（grep 复核 @ b38e70d7）

**Chip 原语（`ui/chip.tsx`）——3 文件 3 处**：

| # | 消费点 | 形态 | 目标件（§5.2） | e2e 载体判定 | 执行票 |
| --- | --- | --- | --- | --- | --- |
| C1 | `detail/dhead.tsx` | md，`detail-chip--<tone>` 别名透传，外套 `.detail-chip` ghost Button | StatusChip default | chip 文案 = 一级 text（`reject-chain`/`review-reject` 的 toHaveText 原样保语义）；触发面 `.detail-chip`/`.detail-chip-chevron` 是 detail per-face，归 #945 一并处置 | #945 |
| C2 | `overlays/search-panel.tsx` | mini，`search-row-chip` 定位类透传 | StatusChip size="sm" | 文案一级 text；`search-row-chip` 定位职责改行内 utility（overlays.css 清零同 PR） | #949 |
| C3 | `routes/agent-detail-page.tsx` | mini，无别名 | StatusChip size="sm" | `agent-detail.spec` 的 `.chip` locator ×2 → 行 scope `getByText`（行为断言语义不动） | #952（**本票抽查已实装**，见 §5.6） |

同名不同族（`mention-chip--*`、`composer-chip--*`、`chip-popover-*`、`agent-identity-chip`、`spec-chip--*`、KbdHint）不属五态原语，归各域 per-face 账。五态 tone 的唯一语义源 = `phase.ts` 的 `PHASE_UI.tone`，StatusChip API 对齐该字段名。

**老 Input 原语（`ui/input.tsx`，36px）——2 文件 8 处**：

| # | 消费点 | 处数 | 目标件（§5.3） | e2e 载体判定 | 执行票 |
| --- | --- | --- | --- | --- | --- |
| I1 | `resources/create-provider-dialog.tsx` | 6 | components/ui Input | getByLabel / placeholder 属性断言不动 | #944 |
| I2 | `resources/create-secret-dialog.tsx` | 2 | components/ui Input | 同上 | #944（**本票抽查已实装**，见 §5.6） |

**shadcn Input 挂 `.dlg-form-input` 老类（混装形态）——2 文件 3 处**：

| # | 消费点 | 处数 | 处置 | 执行票 |
| --- | --- | --- | --- | --- |
| I3 | `resources/skill-dialog.tsx` | 2 | 摘类，件不动（几何即正典 h-8） | #944 |
| I4 | `routes/create-agent-dialog.tsx` | 1 | 摘类 | #952 |

**`ui/dialog.css` 表单/按钮/分段族消费面——11 文件**（逐类处置见 §5.4）：

| 文件 | 所挂 dialog.css 类 | 执行票 |
| --- | --- | --- |
| `resources/create-provider-dialog.tsx` | dlg-form、-foot、-label、-input、-note、-seg、dlg-provider-seg-tab、dlg-provider-create、dlg-provider-model-add | #944 |
| `resources/create-secret-dialog.tsx` | dlg-form、-foot、-label、-input、-textarea、dlg-secret-note、dlg-secret-create | #944（已抽查实装） |
| `resources/skill-dialog.tsx` | dlg-form、-foot、-label、-input、-textarea、-note、-primary | #944 |
| `routes/create-agent-dialog.tsx` | dlg-form、-foot、-label、-input、dlg-agent-create | #952 |
| `detail/branch-dialog.tsx` | dlg-form-foot、-label、-seg、dlg-seg-tab | #945 |
| `detail/review-dialog.tsx` | dlg-form-foot、-actions、-label、chief-dlg-ghost | #945 |
| `detail/reject-dialog.tsx` | dlg-form-foot、-actions、-label、chief-dlg-ghost | #945 |
| `detail/right-pane.tsx` | dlg-form-label | #945 |
| `chief/chief-drawer.tsx` | dlg-form-foot、-actions、chief-dlg-primary、chief-dlg-ghost | #950 |
| `chief/chief-agent-dialog.tsx` | dlg-form-foot、-actions、chief-dlg-primary、chief-dlg-ghost | #950 |
| `chief/edit-charter-dialog.tsx` | dlg-form、-foot、-actions、chief-dlg-charter-input、chief-dlg-primary、chief-dlg-ghost | #950 |

**载体层（`components/ui/` 适配层，非域票面）**：`dialog-shell.tsx`（import dialog.css + 输出 `.dlg-shell`/`.dlg-viewport` 机制类与壳级别名 `.dlg`/`.dlg-head`/`.dlg-title`/`.dlg-close`/`.dlg-body`/`.dlg-foot`/`.dlg-backdrop`）、`alert-dialog-shell.tsx`（`.dlg-shell`）→ #952（§5.5）。

### 5.2 chip 五态 → StatusChip（`components/ui/status-chip.tsx`，#942 落件）

- **先例形态**：沿 TagChip（落已有 registry Badge 上、不自建 registry 件）与 SeededAvatar（registry Avatar 适配层）同形——本地适配件、零 CSS、皮肤全为 token utility 类。
- **不走 registry 语义皮肤**（destructive/secondary 等）：五对 `--chip-*` 槽在 §1.7/1.8 是 1:1 翻值槽（0 退），对比度已实测封版；registry 语义皮肤会弃掉实测槽，且 plan/confirm 两态在 registry 档里没有语义对应。Badge 只借几何骨架（h-5 / rounded-4xl / px-2 / text-xs / font-medium / shrink-0 / whitespace-nowrap）。
- **几何正典**：default 档 = Badge registry 默认（h-5 20px，替旧 md 18px）；`size="sm"` 档（替旧 mini 14px）= `h-4 px-1.5 text-[10px]`（16px，先例 = tag-chip 的 todo-card row-flush 16px 档）。18→20、14→16 的增长是 D2 几何自由重设计的有意结果，非回归；某消费面行盒确实容不下时按 tag-chip per-face 例外律处置（件头注释记行为理由，域票自裁）。
- **色彩正典**：`bg-(--chip-<tone>-bg) text-(--chip-<tone>-fg)` 五对 utility（§3.1 token 类优先；值随 #915 翻，本表不钉值）。tailwind-merge 覆盖 Badge 基皮肤的 bg-primary/text-primary-foreground 两槽，与 TagChip 手法一致。
- **API**：`<StatusChip tone="idle|plan|confirm|done|failed" size?="default|sm" className?>`——旧 prop 名 `variant` 改 `tone`（对齐 `PHASE_UI.tone` 字段名，避免与 Badge 的 variant 皮肤轴混淆）；`className` 透传（别名类存活至执行域退役）。
- **状态载体（#910 裁定 3 灰区：状态类断言归行为）**：`data-tone="<tone>"` 属性替代 `.chip--<tone>` 状态类；文案断言走一级 text 载体。`.chip`/`.chip--*` 类名 locator 退役。
- **视觉断言处置**：旧 18/14px 几何钉与 `--chip-*` 色值钉属视觉断言，整条按 #910 裁定 3 重写，值取 #915 翻值后的 §1.7/1.8 实测列（probe-dump 对照表流程，#921 工具）。

### 5.3 input 36px 老族 → shadcn Input / Textarea（§2.6-1 已定值的执行细则)

- **目标件**：`components/ui/input.tsx`（h-8 32px / rounded-none / border-input / px-2.5 / text-base→md:text-sm）。**不留任何 per-face 几何覆写**——36px 不以别名、utility 或 size 档任何形式存续（§2.6-1：4px 收缩是 D2 有意结果；真需高控件走 Button/Input 的 size 阶梯，不另造死值）。
- **三种执行形态**：① 老件 import 点（I1/I2）：import 路径 `'../ui/input.js'` → `'../components/ui/input.js'`，同 PR 摘除 className 上的 `.dlg-form-input`；② 混装点（I3/I4）：只摘 `.dlg-form-input` 类；③ 裸 `<input>`：收编 Input 件（#851 裸控件账，各域票按自己账目走，不属本表逐点）。
- **focus 环正典** = 件自带 `focus-visible:border-ring` + `ring-3 ring-ring/50`；旧 `.input` 的 1px 描边 + 发丝环退役。§2.6-2 的 2px outline 环是 Button 档专属，**不外推到 Input**。
- **e2e 载体**：表单输入一律 `getByLabel` 一级（`htmlFor`/`id` 配对是语义资产，保留不动——它不是类名别名）；placeholder 断言 = `toHaveAttribute('placeholder', …)` 行为断言原样。`.dlg-form-input`/`.input` 类名 pin 实测 0 处，无重钉面。
- **textarea（`.dlg-form-textarea` 族，裸控件）**：目标件 = `components/ui/textarea.tsx`（registry base-nova 件，**#942 已落件**；唯一记录内偏离 = `rounded-lg`→`rounded-none`，理由：与 §2.6-6 Input 方角语言同族 + 旧 `.dlg-form-textarea` radius 0 同形迁移）。几何正典 = registry 默认（`field-sizing-content` + `min-h-16`）；旧 88px 最小高不留（D2），charter 高字段保留显式 override `min-h-[120px]`（行为理由：章程全文多行编辑空间，#950 执行）。旧 `resize: vertical` 退役（field-sizing 自增长替代手动拖拽）。消费点：create-secret-dialog ×1（已抽查实装）、skill-dialog ×1（#944）、edit-charter-dialog ×1（#950）。e2e 载体：有 label 的走 getByLabel；charter textarea 无 label，走 dialog scope `getByRole('textbox')`（唯一 textbox，chief-settings.spec 的 `.chief-dlg-charter-input` pin ×2 据此重钉）。

### 5.4 `ui/dialog.css` `.dlg-*` 别名逐条处置表

处置口径按 #910 裁定 3 机械判定：行为断言语义不动、只换载体；视觉断言整条按新正典重写。「pin 数」= e2e + integration 的类名 locator 实测计数 @ b38e70d7。

| 类（规则组） | 处置 | 目标载体 | e2e 重钉（pin 数 → 载体） | 执行票 |
| --- | --- | --- | --- | --- |
| `.dlg-form` | 退役 | 容器 utility：`flex flex-col gap-3 px-4 pt-4 pb-3`（现值 12/16px 已在 §2.2 阶梯上，等值迁移即正典） | 1（agent-create-model 的几何 boundingBox）→ 视觉断言，随 #952 按新正典重写；结构 scope 用 getByRole('dialog') | #944/#950/#952（各自 JSX）；spec 随 #952 |
| `.dlg-form-foot` | 退役 | 容器 utility：`flex flex-col px-4 pb-4` | 1（agent-create-model boundingBox）→ 同上 | 同上 |
| `.dlg-form-actions` | 退役 | 容器 utility：`flex justify-end gap-2` | 0 | #945/#950 |
| `.dlg-form-label` | 退役 | 裸 `<label htmlFor>` + utility：`mt-[9px] mb-2 text-[12px] leading-[18px] tracking-[0.01em] text-(--text-primary)`（字号/字距 = c.css 定版 `--label-size`/`--label-spacing`；#915 落 token 后改 `text-(--label-size) tracking-(--label-spacing)`，§4-4）。**不拉 registry Label 件**：label 无交互机制，裸 `<label>` 不在 #851 裸控件清单；getByLabel 一级载体只依赖 htmlFor/id，不依赖件 | 0（label 类无 pin；载体 = getByLabel） | #944/#945/#950/#952 |
| `.dlg-form-input` | 退役 | §5.3 Input 件 | 0 | #944/#952 |
| `.dlg-form-textarea`、`.chief-dlg-charter-input` | 退役 | §5.3 Textarea 件（charter 加 `min-h-[120px]`） | 2（chief-settings）→ dialog scope getByRole('textbox') | #944（secret 已由本票实装）/#950 |
| `.dlg-form-note`、`.dlg-secret-note` | 退役 | `<p>` + utility：`text-xs leading-4 text-(--text-tertiary)` | 1（secret-add-dialog toContainText）→ 一级 getByText(/值将加密存储/)，断言语义不动 | #944（secret 已由本票实装） |
| `.dlg-form-primary`、`.dlg-secret-create`、`.dlg-provider-create`、`.dlg-agent-create`、`.chief-dlg-primary` | 退役 | Button `variant="brand"`（§2.6-3 即此迁移位）；钉底独占 = 加 `w-full`；chief 内联档保留消费点既有 `px-3 text-[13px]` utility | 19（secret 3、provider 7、agent 5、chief-primary 4）→ getByRole('button', { name }) 一级（按钮文案即语义）；disabled/enabled/toBeInViewport 均行为断言，语义不动 | #944（secret/provider）/#950（chief）/#952（agent）；dialog-viewport.spec 内的对应 pin 随各按钮执行票同 PR 重钉 |
| `.chief-dlg-ghost` | 退役 | Button `variant="outline"`（旧形 card-border 描边 + surface 底 ≈ outline 档 border-border/bg-background；#915 翻值后自动对齐新色板） | 3（chief-settings、dialog-viewport）→ getByRole('button', { name }) | #945（review/reject）/#950（chief 三件） |
| `.dlg-provider-model-add` | 退役 | Button `variant="ghost"` + utility：`self-start px-0 text-(--text-secondary)`（旧形：贴左、无框、secondary 墨） | 2（provider-add-dialog、dialog-viewport）→ getByRole('button', { name }) | #944 |
| `.dlg-form-seg`、`.dlg-seg-tab`、`.dlg-provider-seg-tab` | 退役 | Tabs 件 default 档（registry 几何 `rounded-lg bg-muted p-[3px] h-8` 与旧 30px/3px/8px 族近同形，差值 D2 吸收）；provider block 形态 = TabsList `w-full` + TabsTrigger `flex-1`。**不用 segmented 档**——该档类名绑 pages.css `.page-tabs-group`，属 #946 面，跨文件依赖不进 dialog 族。选中态载体 = `role=tab` + `aria-selected`（Base UI 自带）；`data-active="true"` 断言 → getByRole('tab', { selected: true })；hover tint 行为 → TabsTrigger hover utility，`--seg-hover`/`--tab-chip-bg` 值随 #915 | 6（segmented-controls 2、provider-add-dialog 4）→ 行为断言语义不动，locator 换 role/文案；segmented-controls.spec 的 branch-seg 用例随 #945 重钉，该 spec 其余家族用例不动 | #945（branch）/#944（provider） |
| `.dlg-shell`、`.dlg-viewport`（选择器机制层：退场配方 + 视口根容器） | dialog.css 规则退役，机制**内联进适配层** utility：shell = `[transition:visibility_0s_linear_var(--dur-overlay)] data-[ending-style]:invisible`；viewport = `fixed inset-0 pointer-events-none [&>*]:pointer-events-auto [transition:visibility_0s_linear_var(--dur-fast)] data-[ending-style]:invisible`（z-index 已是适配层入参，无类依赖） | 0（两类名无 spec pin；dialog-viewport.spec 钉的是行为面） | #952（dialog.css 终删点，components/ui 授权票） |

### 5.5 壳级别名同族（dialog-shell.tsx 输出面，关联登记）

`.dlg`/`.dlg-backdrop`/`.dlg-head`/`.dlg-head--plain`/`.dlg-title`/`.dlg-close`/`.dlg-body`/`.dlg-foot` 的规则本体已随 #425 B1 退役，现存的是 `dialog-shell.tsx` 适配层按 #411 别名政策输出的**类名残影**——#910 裁定 1 已废止该政策，故一并登记处置（本表管辖裁定，执行归 #952）：

| 别名 | 替代载体（#910 两级制） | pin 面 |
| --- | --- | --- |
| `.dlg`（面板） | `getByRole('dialog')`（Popup 自带 role=dialog + aria-label=title） | `locator('.dlg')` 80 处——各域票随改重钉（别名残留 DOM 至 #952，重钉可先行） |
| `.dlg-title` | dialog 可及名断言（aria-label）或 dialog scope 内一级 text | 17 处，同上 |
| `.dlg-close` | `getByRole('button', { name: '关闭' })`（aria-label 已在件上） | 7 处，同上 |
| `.dlg-head`/`.dlg-body`/`.dlg-foot` | 结构容器：优先 role-scope（dialog 内几何关系断言直接量子元素）；确需结构钩子才补二级 testid（`dialog-head`/`dialog-body`/`dialog-foot`，kebab-case 无前缀律） | 8 处（agent-create-model、dialog-viewport），重钉时逐点判 |
| `.dlg-backdrop` | 无载体需求（外点关闭 = 坐标点击行为面，不 locator） | 0 |

类名输出的摘除点 = #952（dialog-shell.tsx 单点，与 §5.4 机制内联同 PR）。

### 5.6 抽查实装记录（#942 本票，映射无损证明）

按票面抽 2 个消费点实装并保 e2e 行为断言语义不变：

- **C3**（`routes/agent-detail-page.tsx` mini chip）→ StatusChip `size="sm"`；`agent-detail.spec` 的 `.chip` locator ×2 改行 scope `getByText`（文案断言 = 行为，语义一字不动）。
- **I2 + secret 弹窗全族**（`resources/create-secret-dialog.tsx`）→ Input ×2 换件摘类、label/note/foot/form 按 §5.4 utility 化、裸 textarea → Textarea 件、裸 button `.dlg-secret-create` → Button brand + `w-full`；`secret-add-dialog.spec` 重钉：`#dlg-secret-*` → getByLabel（id/htmlFor 保留为语义资产）、`.dlg-secret-create` → getByRole('button')、`.dlg-secret-note` → getByText；壳级 `.dlg`/`.dlg-title`/`.dlg-close` locator 本轮**保留**（别名退役权属 #952，抽查不越权改共享件）。该点裸控件账 −2（button + textarea 收编），`.dlg-*` 类消费清零（secret 面）。
- 36→32px 与 chip 14→16px 为 D2 授权几何变化；两 spec 无视觉断言，无需重钉数值。证据（fixture 栈实测 + e2e 输出）在 `docs/verify/942/`。

## 附录：复现

```sh
cd library/t-0909
node scripts/measure-912.mjs
# 产出:
#   reports/token-scale-912.json          机器可读实测(全槽解析值 + 逐对对比度 + 组件件面)
#   reports/token-scale-912-tables.md     人读完整报告(含汇总)
#   reports/token-scale-912-fragment.md   本册 §1.5–1.8 表格片段(拼接用中间产物)
```

取数源 `src/themes/c.css` 与 `apps/web/src/styles/{shadcn,tokens}.css`；算法与 `scripts/gen-palettes.mjs`（#909 正本生成器）同源，逐对与 `reports/contrast.md` 对账。t-0909 沙盒退役时（#908 fog），`measure-912.mjs` 应随迁到永久工具面（建议与 #921 探针 dump 工具同级归档进 e2e 工具面），本册引用路径同步改。
