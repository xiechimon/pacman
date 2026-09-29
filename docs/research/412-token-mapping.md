# #412 初稿 — tokens.css 117 名 → shadcn 官方语义词表 / 补位族 / 非颜色类

方向已裁（issue #412）：**值正本搬到 shadcn 官方语义词表 + 仓内补位族；legacy generic 名降为别名**。
本文件只做机械取数与初稿：把 117 个 distinct 名摆齐、把风险点标出，**不下最终裁决**，逐条裁定权在人。

## 口径说明

- **取数源**：`apps/web/src/styles/tokens.css`（365 行）。`:root` = dark 默认（11–230 行），`.light` = 浅色镜像（232–365 行）。
- **总数**：`grep -oE '^\s*--[a-z0-9-]+:' tokens.css | sort -u` = **117**（与题面 117 一致）。
- **消费次数**：按题面指定口径 `grep -rhoE 'var\(--[a-z0-9-]+\)' apps/web/src --include='*.css' --include='*.tsx' --include='*.ts' | sort | uniq -c`，**作用域 = `apps/web/src`**（不含 `apps/web/e2e`、`integration/`、`docs/`）。
  - 该口径有 **两处系统性偏差**，读表时必须带上：
    1. **含别名的自身定义**：`--sidebar-bg: var(--surface)` 这类别名行会把目标名（`--surface`）计 +1/+2（:root 与 .light 各一次）。即 `--surface` 的 41 含 2 次来自别名定义，非页面真消费。
    2. **漏 Tailwind v4 简写**：`bg-(--badge-attention)` / `text-(--x)` 形式不含 `var(`，指定正则抓不到。补扫 `(?<!var)\(--[a-z0-9-]+\)` 在 `apps/web/src/**/*.{ts,tsx,css}` 里另有 5 处真消费：`--badge-attention`、`--badge-done`、`--badge-idle`、`--surface-hover`、`--stop` 各 +1。**其中 `--badge-attention` 仅靠简写消费——指定口径下 0，实际未死**。
- **"未镜像"**：该名只在 `:root` 定义、`.light` 未重声明 → 两主题同值（多为 palette 原语与 motion/字体/几何常量）。
- **别名形式**：值为 `var(--别处)` 的写 `别名 → --目标`，在"dark 值"列标出。
- **`[推断]` 标记**：注释里明确写了"dark 值 [推断]"（无暗色 capture，从同族推导）的名字，在"用途"列保留该标记——这类名在并流时值本身就带不确定性。
- 官方目标词表（题面给定，Base UI 代数）：`background/foreground`、`card/card-foreground`、`popover/popover-foreground`、`primary/primary-foreground`、`secondary/secondary-foreground`、`muted/muted-foreground`、`accent/accent-foreground`、`destructive/destructive-foreground`、`border`、`input`、`ring`、`chart-1..5`、sidebar 族 8 枚、`radius`。
- **`shadcn.css` 现值（用于比对"值是否等价"）**：dark `--background #0a0a0a` / `--foreground #fafafa` / `--card #171717` / `--popover #171717` / `--primary #e5e5e5` / `--primary-foreground #171717` / `--secondary #262626` / `--muted #262626` / `--muted-foreground #a1a1a1` / `--accent #404040` / `--destructive #ff6467` / `--border rgb(255 255 255 / 0.1)` / `--input rgb(255 255 255 / 0.15)` / `--ring #737373` / `--column #121212` / `--radius 0.625rem`；light `--background #ffffff` / `--foreground #0a0a0a` / `--card #ffffff` / `--primary #171717` / `--secondary #f5f5f5` / `--muted #f5f5f5` / `--muted-foreground #737373` / `--accent #f5f5f5` / `--destructive #e7000b` / `--border #e5e5e5` / `--input #e5e5e5` / `--ring #a1a1a1` / `--column #f5f5f5`。
- 分组统计：**A 6 · B 53 · C 22 · D 8 · 需人工裁决 28（特别单列 22 + palette 原语 6）= 117**。

---

## A 可并流（语义对口 + 值大致等价）

| 名字 | dark 值 | light 值 | 用途（注释摘要） | 消费次数 | 建议归类 | 目标官方名 | 风险 |
|---|---|---|---|---|---|---|---|
| `--popover-bg` | `#1f1f23` | `#fdfaf7` | detail palette，r7 23/16/17 capture | 20 | A | `--popover` | 值不等价：shadcn 现值 dark `#171717`/light `#ffffff`，本名更暖更亮（`#1f1f23`）。取值方向（pacman 值覆盖 vs 保留 shadcn 值）会改 `components/ui` 内 popover 视觉 |
| `--card-bg` | `#1f1f23` | `#ffffff` | board palette，r7 capture（与 landing token 不同） | 3 | A | `--card` | 同上：dark 与 `--card #171717` 不等价；light 双方同为 `#ffffff` 已等价 |
| `--code-bg` | `#27272a` | `#e7e2da` | detail palette，r7 23/16/17 | 6 | A | `--muted` | 值近似但不严格：dark `#27272a` vs `--muted #262626`（同阶近似）；light 差异较大（`#e7e2da` 暖 vs `#f5f5f5` 中性）。`--muted` 同时被 `--accent` 共用一值，需确认 code 底是否愿意与 hover 底同值 |
| `--danger` | `#ca3a32` | `#ca3a32` | #71/#2 24c probe 值，两主题同值；删除项目 primary danger | 5 | A | `--destructive` | **值显著不等价**：shadcn dark `#ff6467`/light `#e7000b`，本名是深红 `#ca3a32`。语义对口但色相/明度全不同，取谁需裁 |
| `--stop` | `#dd524c` | `#dd524c` | 两主题同值（与 `--danger` 并列的 danger 族） | 7（+1 TW 简写） | A | `--destructive` | 与 `--danger` 同上；且 `--danger`/`--stop` 两名同时映射一个官方名 = **名词一对多**，两名之一必然降为别名（谁留谁降需裁） |
| `--text-on-accent` | `#ffffff` | `#ffffff` | on-accent 文字：白字压 `--card-button`/`--danger`/`--stop` 实心底，两主题同值；此前 31 处散写 `#ffffff` 收此单源 | 16 | A | `--primary-foreground`（或 `--accent-foreground` / `--destructive-foreground` 三取一或共引） | 本名是**跨三族共用**的单一白墨，官方是每族各一枚 foreground。并流 = 一名拆多名（或留单源、各官方名别名回指），拆法需裁；两主题同值这点与官方 `--destructive-foreground #fafafa` 不同值 |

---

## B 补位族（官方词表无对口的域内色 — 保留原名，值随正本文件走）

> 判据：这些是**域内语义**（看板列 / chip / tile / diff / chief / dialog / range / seg / tab / row / pill / notify / avatar / toggle 等），官方 Base UI 词表没有对应槽位；`shadcn.css` 已有先例只补位了 `--column`/`--sidebar-hover`/`--sidebar-active` 三名。保留原名即保留其语义精度（并流进官方名会丢域内区分度）。

| 名字 | dark 值 | light 值 | 用途（注释摘要） | 消费次数 | 建议归类 | 目标官方名 | 风险 |
|---|---|---|---|---|---|---|---|
| `--agent-avatar-bg` | `#202733` | `#eff1f5` | 团队 agent 头像盘（r7 12 light / r2 32）；dark 值 [推断]，从 chip-idle/plan dark 族推导 | 1 | B | —（补位：avatar） | 无官方槽；dark 为 [推断] 值 |
| `--badge-done` | `#5ec26a` | `#5ec26a` | 状态 badge 完成绿，两主题同值 | 2（+1 TW 简写） | B | —（补位：badge） | 无 |
| `--badge-idle` | `#9ea3ae` | `#9ea3ae` | fresh-card owner badge（r7 22/22d），两主题同灰 | 1（+1 TW 简写） | B | —（补位：badge） | 无 |
| `--chief-tab-active` | `#3f3f46` | `#f7f4ef` | chief tab 条 active pill（r5 101；dark [推断]，r2 16 dark panel） | 1 | B | —（补位：tab） | dark [推断] |
| `--chief-tab-bg` | `#27272a` | `#eeeae4` | chief tab 条 group bg（r5 101） | 1 | B | —（补位：tab） | dark [推断] |
| `--chip-confirm-bg` | `#33221b` | `#fffbed` | chip 族：待处理 confirm（r7 23/16/17） | 3 | B | —（补位：chip） | 无 |
| `--chip-confirm-fg` | `#f2c24b` | `#a85923` | 同上 fg | 3 | B | —（补位：chip） | 无 |
| `--chip-done-bg` | `#14291c` | `#ecfdf3` | chip 族：已完成 done | 3 | B | —（补位：chip） | 无 |
| `--chip-done-fg` | `#5ec26a` | `#15803d` | 同上 fg | 3 | B | —（补位：chip） | 无 |
| `--chip-failed-bg` | `#351c1a` | `#fcf3f2` | r8 dynamic states（#75）failed chip；light 实测，dark [推断]（r8 §5 dark 动态面未拍） | 1 | B | —（补位：chip） | dark [推断] |
| `--chip-failed-fg` | `#dd524c` | `#ca3a32` | 同上 fg | 1 | B | —（补位：chip） | dark [推断] |
| `--chip-idle-bg` | `#202733` | `#f3f4f6` | chip 族：待开始 idle（r7 23/16/17） | 3 | B | —（补位：chip） | 无 |
| `--chip-idle-fg` | `#9ea3ae` | `#4d5562` | 同上 fg | 3 | B | —（补位：chip） | 无 |
| `--chip-plan-bg` | `#1c2740` | `#eff2fe` | chip 族：执行中 plan（r7 23/16/17） | 5 | B | —（补位：chip） | 无 |
| `--chip-plan-fg` | `#8b93f8` | `#4e47dd` | 同上 fg | 6 | B | —（补位：chip） | 无 |
| `--col-bg` | `#09090b` | `#f1ede7` | board palette，r7 capture 采样 | 2 | B | —（补位：col） | 无；与 `--surface-inset` dark 同值 `#09090b` |
| `--col-dot-building` | `#4e81ee` | `#4e81ee` | 列点族 #351 4-fold：执行中 building | 1 | B | —（补位：col） | 无 |
| `--col-dot-confirm` | `#e9a23b` | `#e9a23b` | 列点族：待处理 confirm | 1 | B | —（补位：col） | 与 `--badge-attention` 同值 `#e9a23b` |
| `--col-dot-done` | `#5ec26a` | `#5ec26a` | 列点族：已完成 done | 3 | B | —（补位：col） | 与 `--badge-done`/`--chip-done-fg` dark 同值 `#5ec26a` |
| `--col-dot-idle` | `#9ea3ae` | `#9ea3ae` | 列点族 #351 4-fold：待开始 idle | 1 | B | —（补位：col） | 与 `--badge-idle`/`--chip-idle-fg` dark 同值 |
| `--col-head-text` | `#bebec1` | `#57534e` | 列头文字 | 1 | B | —（补位：col） | 无 |
| `--dash-border` | `#3f3f46` | `#e8e2db` | 资源面（r7 06–10, #69）：虚线 add-machine 边框；dark [推断] | 2 | B | —（补位：dash/资源面） | dark [推断] |
| `--dialog-bg` | `#1f1f23` | `#fdfaf7` | modal dialog panel 填充（#68, r8 78–81 dark capture） | 3 | B | —（补位：dialog） | 与 `--popover-bg`/`--surface-elevated` dark 同值；light `#fdfaf7` 与 `--popover-bg` 近似 |
| `--dialog-box-bg` | `#1f1f23` | `#f1ede7` | dialog 内嵌 box 填充（r8 79 scan：panel 填充 + 仅描边） | 1 | B | —（补位：dialog） | dark 与 `--dialog-bg` 同值 |
| `--dialog-ring` | `#44444b` | `#cbc8c4` | 运行历史 row ring（r7 32 scan）/ 弹层发丝环 | 1 | B | —（补位：dialog） | light 有实测（r7 32），dark 无 capture 标注 |
| `--dialog-row-bg` | `#27272a` | `#f1ede7` | r8 rerun-dialog agent row（#75） | 2 | B | —（补位：dialog/row） | dark [推断] |
| `--diff-add-bg` | `#16281d` | `#eaf1e8` | diff pane 新增行 tint（r7 27d dark 实测） | 1 | B | —（补位：diff） | 无 |
| `--diff-add-fg` | `#478266` | `#499771` | diff pane stat/gutter 绿（r7 27/27b） | 3 | B | —（补位：diff） | 无 |
| `--diff-del-bg` | `#2e1c1a` | `#f8e6e4` | r8 删除行 tint（#75）；light 实测，dark [推断] | 1 | B | —（补位：diff） | dark [推断] |
| `--fail-fg` | `#d98b4a` | `#cc7c2e` | r8 fail message 标题色（#75）；dark [推断] | 2 | B | —（补位：状态） | dark [推断] |
| `--menu-icon` | `#71717a` | `#1c1917` | 更多 menu row 图标色（r8 78/56 probe） | 1 | B | —（补位：menu） | 无 |
| `--notify-icon-bg` | `#2e2f42` | `#e3dfe7` | 通知 banner bell 盘（#114, r2 28 dark / r2 01 light）；盘上 glyph 用 `--indigo-500` | 1 | B | —（补位：notify） | 无 |
| `--overlay-divider` | `#2a2a2e` | `#efebe5` | 浮层 batch B（#67）popover 分隔线；dark 无 capture（r7 §6），[推断] 自 surface ramp | 1 | B | —（补位：overlay） | dark [推断] |
| `--overlay-scrim` | `rgb(0 0 0 / 0.6)` | `rgb(0 0 0 / 0.6)` | 浮层遮罩（轨 A #A2）：modal/search/token-gate 全屏黑幕统一值；此前 6 处各写 | 6 | B | —（补位：overlay/scrim） | 无官方 scrim 槽；两主题同值 |
| `--overlay-select-indigo` | `#2a2740` | `#edebf6` | 浮层 batch B：indigo select block（r7 05/05b/19）；dark [推断] | 1 | B | —（补位：overlay） | dark [推断] |
| `--pill-idle-bg` | `#27272a` | `#e7e2da` | 资源面状态 pill 底（r7 06–10, #69）；dark [推断] | 1 | B | —（补位：pill） | dark [推断] |
| `--primary-disabled` | `#3d3a8f` | `#a49fe8` | disabled primary（r8 79 light 实测）；dark [推断]，indigo 族调暗 | 2 | B | —（补位：disabled 态） | 官方无 disabled 槽；dark [推断] |
| `--project-avatar-bg` | `#e97b35` | 未镜像（同 dark） | 项目首字母头像底（board card / sidebar / overlays），两主题同值 | 5 | B | —（补位：avatar） | 无 |
| `--project-avatar-fg` | `#ffffff` | 未镜像（同 dark） | 同上 fg | 5 | B | —（补位：avatar） | 无 |
| `--range-chip-bg` | `#27272a` | `#eeebe7` | r8 range chip（#75）；light 实测，dark [推断] | 1 | B | —（补位：range） | dark [推断] |
| `--range-chip-border` | `#3f3f46` | `#d1cdc9` | 同上 border | 1 | B | —（补位：range） | dark [推断] |
| `--row-icon-bg` | `#3f3f46` | `#e7e2da` | 浮层 batch B：search 结果 icon tile（r7 05/05b/19）；dark [推断] | 1 | B | —（补位：row） | dark [推断] |
| `--row-selected` | `#27272a` | `#f1ede7` | 浮层 batch B：selected row tile；dark [推断] | 2 | B | —（补位：row） | dark [推断]；与 `--surface-secondary` light 同值 `#f1ede7` |
| `--seg-active` | `#3f3f46` | `#e7e2da` | 分段控件 active chip（#138 族） | 4 | B | —（补位：seg） | 无 |
| `--seg-hover` | `rgb(255 255 255 / 0.05)` | `rgb(28 25 23 / 0.05)` | 分段控件 unselected hover tint（#138 dogfood，cds alpha 梯第一阶） | 5 | B | —（补位：seg） | alpha 记法，与 `--sidebar-hover` 同值同形 |
| `--tab-chip-bg` | `#27272a` | `#faf7f3` | text-tab chip：group bg = `--surface-secondary`，active chip 不同（r2 24b/24c） | 6 | B | —（补位：tab） | light `#faf7f3` 与 `--surface` light 同值；e2e `segmented-controls.spec.ts:25` 钉 dark `rgb(39, 39, 42)` |
| `--tile-hero-bg` | `#33221b` | `#f8ead8` | 资源面 hero tile tint（r7 06–10, #69）；dark [推断] | 1 | B | —（补位：tile） | dark [推断]；dark 与 `--tile-orange-bg`/`--chip-confirm-bg` 同值 `#33221b` |
| `--tile-indigo-bg` | `#1c2740` | `#e3dfe7` | 资源面 indigo tile 底；dark [推断] | 1 | B | —（补位：tile） | dark [推断]；dark 与 `--chip-plan-bg` 同值 |
| `--tile-indigo-fg` | `#8b93f8` | `#6466e9` | 同上 fg | 1 | B | —（补位：tile） | dark 与 `--chip-plan-fg` 同值 |
| `--tile-orange-bg` | `#33221b` | `#f0e5d5` | 资源面 orange tile 底；dark [推断] | 1 | B | —（补位：tile） | dark [推断] |
| `--tile-orange-fg` | `#f2c24b` | `#e9a23b` | 同上 fg | 3 | B | —（补位：tile） | dark 与 `--chip-confirm-fg` 同值 |
| `--toggle-knob` | `#ffffff` | `#ffffff` | toggle 白圆点（轨 A #A2）：12/16px 白盘，两主题同色 | 4 | B | —（补位：toggle） | 无 |
| `--toggle-track` | `#27272a` | `#e7e2da` | modal dialog 关闭态 toggle track（#68, r8 78–81） | 1 | B | —（补位：toggle） | 无 |

---

## C 非颜色（不进颜色并流）

> 判据：这些值的类型不是颜色（时间/缓动/长度/字体栈/合成 box-shadow+ring/圆角），官方颜色词表**没有**对应槽位。**不进颜色并流**；若要收编，去向是官方 `--radius`（圆角）或另立非颜色层，均属另一张票的范围。

| 名字 | dark 值 | light 值 | 用途（注释摘要） | 消费次数 | 建议归类 | 目标官方名 | 风险 |
|---|---|---|---|---|---|---|---|
| `--dur-fast` | `150ms` | 未镜像 | motion registry（#73）：150ms 标准步 | 10 | C（motion） | 非颜色，无官方槽 | 无 |
| `--dur-overlay` | `200ms` | 未镜像 | motion registry：200ms mount fade | 2 | C（motion） | 非颜色，无官方槽 | 无 |
| `--dur-drawer` | `300ms` | 未镜像 | motion registry：300ms drawer slide | 2 | C（motion） | 非颜色，无官方槽 | 无 |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | 未镜像 | Tailwind 默认缓动 | 7 | C（motion） | 非颜色，无官方槽 | 无 |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | 未镜像 | Tailwind ease-out | 2 | C（motion） | 非颜色，无官方槽 | 无 |
| `--ease-pop` | `cubic-bezier(0.22, 1, 0.36, 1)` | 未镜像 | 官方 sheet 唯一自定义缓动 | 4 | C（motion） | 非颜色，无官方槽 | 无 |
| `--space-1` | `4px` | `4px` | spacing ladder（DESIGN.md §Layout & Spacing）：4px 基数阶梯，仅供新写代码 | 0 | C（spacing） | 非颜色，无官方槽 | **0 引用（见 D 节）** |
| `--space-2` | `8px` | `8px` | 同上 | 0 | C（spacing） | 非颜色，无官方槽 | **0 引用（见 D 节）** |
| `--space-3` | `12px` | `12px` | 同上 | 0 | C（spacing） | 非颜色，无官方槽 | **0 引用（见 D 节）** |
| `--space-4` | `16px` | `16px` | 同上 | 0 | C（spacing） | 非颜色，无官方槽 | **0 引用（见 D 节）** |
| `--space-6` | `24px` | `24px` | 同上 | 0 | C（spacing） | 非颜色，无官方槽 | **0 引用（见 D 节）** |
| `--font-sans` | `var(--font-inter), -apple-system, …` | 未镜像 | 字体栈，源自 859B font stylesheet（fonts.css, r1 §4.1） | 4 | C（字体） | 非颜色，无官方槽 | 依赖未在本文件定义的 `--font-inter`（见文末注） |
| `--font-mono` | `ui-monospace, "JetBrains Mono", …` | 未镜像 | 同上 | 20 | C（字体） | 非颜色，无官方槽 | 无 |
| `--edge-ring` | 别名 → `inset 0 0 0 1px var(--border-default)` | 未镜像（随 `--border-default` 变） | 统一边框语言（#139）：elevated surface 单源发丝环，用 inset shadow spread 而非真 border（分数缩放下真 1px border 光栅化不均） | 4 | C（合成值/环） | 非颜色，无官方槽 | 是**别名**，跟随 `--border-default`；若 `--border-default` 改 `--border`（alpha）则环的观感随之变 |
| `--edge-shadow` | `0 5px 14px rgb(0 0 0 / 0.4)` | `0 5px 14px rgb(28 25 23 / 0.14)` | #139 edge shadow tier 单源 | 4 | C（阴影） | 非颜色，无官方槽 | light 已按暖墨调暗 |
| `--fab-shadow` | 别名 → `var(--edge-shadow)` | 未镜像 | #139 edge shadow tier 别名，elevated surface（fab/popover/panel）单源 | 19 | C（阴影） | 非颜色，无官方槽 | 别名，跟随 `--edge-shadow` |
| `--card-shadow` | `0 2px 4px rgb(0 0 0 / 0.2)` | `0 2px 4px rgb(28 25 23 / 0.07)` | card-tier resting shadow（#161）：小卡族停留态，比 popover 低一级 | 2 | C（阴影） | 非颜色，无官方槽 | 无 |
| `--lift-shadow` | `0 3px 12px rgb(0 0 0 / 0.5)` | `0 3px 12px rgb(28 25 23 / 0.16)` | lift-tier shadow（#391）：DragOverlay 飞行态，高于 popover 级 | 1 | C（阴影） | 非颜色，无官方槽 | 无 |
| `--dialog-shadow` | `0 5px 14px rgb(0 0 0 / 0.4)` | `0 5px 14px rgb(0 0 0 / 0.4)` | overlay batch A（#66）：dialog 投影，比 `--fab-shadow` 更强；两主题同值（显式镜像） | 3 | C（阴影） | 非颜色，无官方槽 | dark/`--edge-shadow` dark 同值 |
| `--chief-shadow` | `0 4px 24px rgb(0 0 0 / 0.35)` | `0 4px 24px rgb(28 25 23 / 0.16)` | chief 面（r5 100–104, #72）drawer 投影，r5 100 edge gradient 采样 | 2 | C（阴影） | 非颜色，无官方槽 | dark 无 capture 标注 |
| `--edge-radius` | `12px` | 未镜像 | #139 统一 12px 圆角（elevated surface） | 10 | C（圆角） | 非颜色；官方圆角槽是 `--radius`（`shadcn.css` 已定义 `0.625rem`=10px） | 与官方 `--radius` **不同值**（12 vs 10）；另有 `--radius-popover` 10px。三者并流需先裁"哪档是官方 `--radius`" |
| `--radius-popover` | `10px` | `10px` | popover 半径 | 18 | C（圆角） | 非颜色；官方 `--radius`（10px，与 `shadcn.css` 现值相等） | 值恰等于官方 `--radius`；可候选并入，但语义上属几何非颜色层 |

---

## D 死 token（指定口径 0 引用 — 候选清理）

> 口径 = 题面指定 grep，作用域 `apps/web/src`。**注意两处"看似死实则非死"**，逐条标出。

| 名字 | dark 值 | light 值 | 用途（注释摘要） | 消费次数 | 建议归类 | 目标官方名 | 风险 |
|---|---|---|---|---|---|---|---|
| `--active-text` | `#a0a0a5` | `#6e6b69` | 无紧邻注释（:root 第 22 行，紧随 motion registry 注释块之后） | 0 | D | —（无官方槽） | 全仓仅 tokens.css 自身定义，无任何消费点，语义仅从名推测（`需人工裁决`：可能曾是 active 态文字色）。存在 `--disabled-fg` dark 同值 `#a0a0a5` |
| `--badge-attention` | `#e9a23b` | `#e9a23b` | 状态 badge 待处理橙（board palette 族） | 0（**但 TW 简写 1**：`todo-card.tsx:114` 用 `bg-(--badge-attention)`） | D→**B**（实为非死） | —（补位：badge） | **非死 token**：指定 grep 漏 Tailwind v4 简写。清理前必须补扫 `bg-(--x)` 形 |
| `--card-ghost-border` | 别名 → `var(--card-border)` | 别名 → `var(--card-border)` | A6 收编 ghost 单源：别名直引 `--card-border`，与 overlay-btn 实测对齐 | 0（**仅注释引用**：`ui/button.css:47`、`detail/detail.css:1622` 都在注释里说"别名仍保留给历史消费点"） | D（别名残骸） | 并入 `--border`/`--card-border` 后删除 | **真死**：无 `var()` 消费，仅剩文档性注释。按 No Negative Echo，注释里的"仍保留给历史消费点"本身即废弃残骸 |
| `--chip-active-bg` | `#26243a` | `#ebe8f2` | r2 32 选中反馈 chip tint（#70）；dark 值 [推断] | 0 | D | —（补位：chip） | dark [推断]；无消费点 |
| `--chip-active-border` | `#3b3866` | `#cdc9f0` | 同上 chip 描边 | 0 | D | —（补位：chip） | dark [推断]；无消费点 |
| `--disabled-fg` | `#a0a0a5` | `#ffffff` | disabled primary 标签 + 更多 menu row 图标（r8 78/56 probe） | 0 | D | —（补位：disabled 态） | 无消费点；dark 与 `--active-text` 同值 `#a0a0a5`，light 与 `--text-on-accent`/`--toggle-knob` 同值 `#ffffff` |
| `--nav-bg` | `rgba(24, 24, 27, 0.85)` | `rgba(250, 250, 249, 0.85)` | 无紧邻注释（:root 第 35 行）；全仓另有 `docs/research/assets/r1/…css` 同名字符串（非消费） | 0 | D | —（无官方槽） | 真死：`apps/web/src` 零消费 |
| `--send-disabled` | `#454690` | `#9f9ae2` | 发送键 disabled 态；[推断] indigo-500 at 55% over `--surface-secondary` | 0 | D | —（补位：disabled 态） | dark 标注为 [推断]；无消费点 |

**其它 0 引用名（已在别节成行，此处只做交叉索引，避免重复计数）**：`--blue-400`（需人工裁决·palette）、`--indigo-400`（需人工裁决·indigo 族）、`--sidebar-bg`（需人工裁决·sidebar 族）、`--sidebar-selected`（需人工裁决·sidebar 族）、`--space-1` … `--space-6`（C 节）。

**#409 报的 19 vs 实测 17 的差异**：按指定口径（`var(--x)` 形、`apps/web/src`）实测 0 引用是 **17** 个：`--active-text`、`--badge-attention`、`--blue-400`、`--card-ghost-border`、`--chip-active-bg`、`--chip-active-border`、`--disabled-fg`、`--indigo-400`、`--nav-bg`、`--send-disabled`、`--sidebar-bg`、`--sidebar-selected`、`--space-1`、`--space-2`、`--space-3`、`--space-4`、`--space-6`。差异可能来自：(a) #409 测量时点与本文件不同（其间有新名加入/旧消费点迁走）；(b) 计数口径不同（是否含 `.light` 镜像行、是否含 Tailwind 简写）。**其中 `--badge-attention` 按简写口径有 1 个活消费点，不应计入死 token。**

---

## 需人工裁决

### 一、特别单列（已知有坑 — 逐条给依据，不预设结论）

#### 1. `--border-default` / `--border-strong` / `--card-border` 对官方 `border`（**改类型风险**）

| 名字 | dark 值 | light 值 | 用途（注释摘要） | 消费次数 | 建议归类 | 目标官方名 | 风险 |
|---|---|---|---|---|---|---|---|
| `--border-default` | `#27272a` | `#e2dbd1` | 统一边框语言（#139）核心：跨 shell 缝线的单源 1px 接缝；`--edge-ring` 别名直引它；sidebar 层分隔全靠它（#390 同底律） | **73**（13 个消费文件，横跨 board/chief/detail/overlay/resources/pages/secondary 全部 shell） | 需人工裁决 | `--border` | **改类型**：本名是**实色 hex**（dark `#27272a` / light `#e2dbd1`），官方 dark `--border` 是 **alpha** `rgb(255 255 255 / 0.1)`、light `#e5e5e5`。实色→alpha 会改"接缝在任意底上恒定"这条性质（实色叠在 `--surface`/`--surface-secondary`/`--col-bg` 上呈现同一色；alpha 会随底变化）。且 73 处引用 + 用户明确称其为"跨 shell 缝线契约"——是最强的下游耦合面 |
| `--border-strong` | `#3f3f46` | `#cec6bb` | 强描边档（与 `--border-default` 同族，第 34 行） | 7 | 需人工裁决 | `--input`（候选）或 `--border` | 官方 `--input` 是 `rgb(255 255 255 / 0.15)`（dark）/ `#e5e5e5`（light），**同属 alpha 改类型**；本名比 `--border-default` 更亮/更深一档，并流进单一 `--border` 会丢"strong 档"这一阶。与 `--dash-border`/`--seg-active`/`--row-icon-bg`/`--chief-tab-active`/`--range-chip-border` 多处同值 `#3f3f46`（dark），牵一发动多处 |
| `--card-border` | `#27272a` | `#e1dbd2` | board palette 卡片描边；`--card-ghost-border` 别名直引它 | **32** | 需人工裁决 | `--border`（或 `--card` 的 border 面） | **改类型**：实色→`--border` alpha。且 light 值 `#e1dbd2` 与 `--border-default` light `#e2dbd1` **几乎同值但不同**（差 1–2 个色阶）——并流时必须先裁"这两个近似值谁是正本"；consumer 面 9 个文件 |

#### 2. `--surface` 族 6 档 对官方 `background` / `card` / `secondary` / `accent` / `muted`（**丢阶风险**）

| 名字 | dark 值 | light 值 | 用途（注释摘要） | 消费次数 | 建议归类 | 目标官方名 | 风险 |
|---|---|---|---|---|---|---|---|
| `--surface` | `#18181b` | `#faf7f3` | 主面板底（DESIGN.md §画布层级：canvas `#09090b` → surface → secondary → tertiary）；`--sidebar-bg` 别名直引它 | 41（含 2 次别名定义自引） | 需人工裁决 | `--background` | **丢阶 + 值不等价**：本名是 6 档 ramp 的第 2 档（主面板），官方 `--background` dark `#0a0a0a` 更接近本仓的 `--surface-inset`/canvas。并流会把"画布 vs 主面板"两层压成一层 |
| `--surface-secondary` | `#1f1f23` | `#f1ede7` | 卡片/弹层底（DESIGN.md）；分段控件 group bg；light 与 `--row-selected`/`--dialog-row-bg` 同值 | 48 | 需人工裁决 | `--secondary` / `--muted` / `--card` 三候选 | **丢阶 + 一对多**：官方 `--secondary` 与 `--muted` dark 同值 `#262626`（本来就同值），本名 dark `#1f1f23` 与二者都不等；48 次引用是该文件第 2 高，牵动最广 |
| `--surface-tertiary` | `#27272a` | `#e8e2d9` | 嵌入控件底（DESIGN.md：四级 ramp 末档）；计数/标签底用 surface-tertiary + text-secondary | 8 | 需人工裁决 | `--accent` / `--secondary` | **丢阶**：官方 `--accent` dark `#404040` 比本名更亮；并流后 harness 的"嵌入控件底"档位可能无处安放 |
| `--surface-inset` | `#09090b` | `#f2ede6` | canvas/页面底色（DESIGN.md 画布层级第一档）；dark 与 `--col-bg` 同值 | 2 | 需人工裁决 | `--background` | **丢阶**：本名才是真正的"最底色"，官方 `--background` dark `#0a0a0a` 与本名 `#09090b` 几乎同值——**这是 ramp 里唯一与官方 background 值等价的一档**；但 light 侧差异大（`#f2ede6` 暖 vs `#ffffff`） |
| `--surface-elevated` | `#1f1f23` | `#fdfaf6` | elevated surface 底（:root 第 27 行，无长度注释）；light 与 `--popover-bg` light `#fdfaf7` 近似 | 3 | 需人工裁决 | `--card` / `--popover` | **丢阶**：dark 与 `--surface-secondary`/`--surface-hover` **完全同值** `#1f1f23`——三档在 dark 侧已经塌成一档，并流前需先确认这三名是否真需要分开存在 |
| `--surface-hover` | `#1f1f23` | `#f2ede6` | overlay/canvas hover canon（motion.css）；sidebar hover 另有 `--sidebar-hover`（#128 划分） | 8（+1 TW 简写 = 9） | 需人工裁决 | `--accent`（hover 槽） | **丢阶 + 值不等价**：官方 hover 语义槽是 `--accent`（dark `#404040`），本名 dark `#1f1f23` 明显更暗；并流会把"overlay/canvas hover"与"accent"合成一槽，且与 `--sidebar-hover` 的分工注释（#128）需重述 |

#### 3. `--text-primary` / `-secondary` / `-tertiary` / `-dim` 4 档 对官方 `foreground` / `muted-foreground` 2 档（**丢阶风险**）

| 名字 | dark 值 | light 值 | 用途（注释摘要） | 消费次数 | 建议归类 | 目标官方名 | 风险 |
|---|---|---|---|---|---|---|---|
| `--text-primary` | `#fafaf9` | `#1c1917` | 主文字色（无独立注释，位于文字族首位） | **121**（全文件最高） | 需人工裁决 | `--foreground` | **丢阶 + 值不等价**：dark `#fafaf9` vs 官方 `--foreground` dark `#fafafa`（几乎同值 ✓），但 light `#1c1917` vs 官方 `#0a0a0a` 差异较大（暖墨 vs 纯黑）。121 处引用 = 全文件第一，任何并流都是最大面积改动 |
| `--text-secondary` | `#d4d4d8` | `#57534e` | 次级文字（DESIGN.md 用于 chip fg / 计数标签文字） | 63 | 需人工裁决 | `--muted-foreground`（候选） | **丢阶**：官方 `--muted-foreground` dark `#a1a1a1` 明显比本名 `#d4d4d8` 暗——本名更接近官方 `--foreground` 的次级变体而非 muted。4 档压 2 档时本名无处安放 |
| `--text-tertiary` | `#71717a` | `#78716c` | 三级文字（DESIGN.md：卡头 mono 11px 任务 ID 用 text-tertiary） | **115**（全文件第 2 高） | 需人工裁决 | `--muted-foreground` | **丢阶 + 值近似**：dark `#71717a` vs 官方 `--muted-foreground` dark `#a1a1a1` 不等；light `#78716c` vs `#737373` 近似。与 `--menu-icon` dark 同值 `#71717a` |
| `--text-dim` | `#52525b` | `#a8a29e` | 最暗文字档（无独立注释） | 95 | 需人工裁决 | `--muted-foreground` | **丢阶**：4 档里最暗的一档，官方 2 档无对应槽——**若按 4→2 并流，本档与 `--text-tertiary` 必有一档被丢**（三、四档合并），需明确丢谁 |

#### 4. `--indigo-*` 一族（含 `--card-button`）对官方 `primary`（**色值不等价风险**）

| 名字 | dark 值 | light 值 | 用途（注释摘要） | 消费次数 | 建议归类 | 目标官方名 | 风险 |
|---|---|---|---|---|---|---|---|
| `--indigo-600` | `#4f46e5` | 未镜像（同 dark） | palette 原语（:root 第 40 行） | 1 | 需人工裁决 | `--primary`（候选） | 色值不等价：官方 neutral 主题 `--primary` 是近白 `#e5e5e5`（dark）/ 近黑 `#171717`（light），**色相完全不同**（indigo vs neutral）。若要保 brand 紫作 primary，等于改官方 neutral 主题的 primary 语义 |
| `--indigo-500` | `#6466e9` | 未镜像（两主题同值，r7 01b/02 实测：+任务 文字与 card 按钮落在此值，非 landing `#6366f1`） | 品牌主色；`--notify-icon-bg` 上的 glyph 用它 | 26 | 需人工裁决 | `--primary` | **色值不等价**（同 `--indigo-600`）；且本名 dark/light 同值（有意，注释已写明），官方 primary 是主题反相的——并流会破"两主题同色"这条实测性质 |
| `--indigo-400` | `#818cf8` | `#6366f1` | palette 原语（:root 第 44 行） | 0 | 需人工裁决 | `--primary` / `--ring`（候选） | **0 引用（死）** 且色值不等价；官方 `--ring` dark `#737373` 是中性灰，与 indigo 不搭 |
| `--indigo-disabled` | `#4e47dd` | `#a5a1ea` | modal dialog disabled 同步（#68, r8 78–81） | 1 | 需人工裁决 | 无官方槽（disabled 态） | 与 `--card-button` dark **同值** `#4e47dd`——若 `--card-button` 并流，本名需跟着改 |
| `--indigo-disabled-fg` | `#afabf0` | `#ffffff` | 同上 disabled 标签色 | 1 | 需人工裁决 | 无官方槽 | light 与 `--text-on-accent` 同值 `#ffffff` |
| `--card-button` | `#4e47dd` | `#4e47dd` | board palette：card 按钮实心（两主题同值）；**被 e2e 钉死** | 25 | 需人工裁决 | `--primary` | **色值不等价 + 已被测试钉扎**：`apps/web/e2e/brand-typo.spec.ts:113-114` 断言 `.res-back` 的 `outlineColor === 'rgb(78, 71, 221)'`（= `#4e47dd`），注释明写"the codebase ring recipe rides --card-button (#4e47dd, both themes)"；`apps/web/e2e/overlay-focus.spec.ts:17` 有同值常量 `RING = 'rgb(78, 71, 221)'`。并流改值 = 直接红这两个 spec；且它同时是**焦点环色**（ring 语义）与**按钮底色**（primary 语义）——一色跨两语义 |

#### 5. sidebar 族（`--sidebar-bg` / `--sidebar-hover` / `--sidebar-selected`）— **同名撞车单列**

| 名字 | dark 值 | light 值 | 用途（注释摘要） | 消费次数 | 建议归类 | 目标官方名 | 风险 |
|---|---|---|---|---|---|---|---|
| `--sidebar-bg` | **别名** → `var(--surface)` | **别名** → `var(--surface)` | sidebar layer（#390 同底律）：侧栏与主区**共用** surface token，层分隔只由 1px `--border-default` 接缝承担，不用色调阶 | **0**（`apps/web/src` 零消费；`apps/web/DESIGN.md:102` 提及） | 需人工裁决 | 官方 sidebar 族 `--sidebar`（8 枚之一） | **同名撞车 + 语义错位**：官方 `--sidebar` 是"侧栏自己的底色"（shadcn.css 未定义它，官方默认与 `--background` 同值或独立档），而本仓**刻意让侧栏与主面板同底**（#390 同底律，注释写死"层分隔由接缝线承担，不是色调阶"）。直接映射会引入一条本仓有意规避的色调差。另：本名 0 引用（死 token，别名本身无消费点） |
| `--sidebar-hover` | `rgb(255 255 255 / 0.05)` | `rgb(28 25 23 / 0.05)` | sidebar 行 hover pill（#128 claude.ai cds 参照，cds alpha 梯 5%） | 2 | 需人工裁决 | 官方 sidebar 族 `--sidebar-accent`（候选） | **同名撞车（严重）**：`shadcn.css:78` 已定义同名 `--sidebar-hover: rgb(255 255 255 / 0.05)`（light `rgb(28 25 23 / 0.05)`）——**两文件同名同值同记法**。同名双源 = 谁覆盖谁取决于 import 顺序，是本次并流最直接的结构隐患（官方 8 枚 sidebar 族里**没有** `--sidebar-hover`，官方对应槽是 `--sidebar-accent`） |
| `--sidebar-selected` | `rgb(255 255 255 / 0.1)` | `rgb(28 25 23 / 0.1)` | sidebar 行 selected pill（#128，cds alpha 梯 10%） | 0（`apps/web/e2e/sidebar-nav.spec.ts:10,127` 仅在注释里提到该名） | 需人工裁决 | 官方 sidebar 族 `--sidebar-accent` / `--sidebar-primary` | **同名撞车（变形）**：`shadcn.css:79` 定义的是 `--sidebar-active`（不是 `--sidebar-selected`），同值同记法——**同语义两名字**。官方 8 枚族里两个名都没有；官方对应槽是 `--sidebar-accent`。本名 0 引用，`--sidebar-active` 1 引用 |

> **sidebar 族结构性缺口（不在 tokens.css，但决定映射口径）**：官方 sidebar 族 8 枚 = `--sidebar` / `-foreground` / `-primary` / `-primary-foreground` / `-accent` / `-accent-foreground` / `-border` / `-ring`。本仓现有 sidebar 相关名只有 3 个（且 2 个是 alpha pill、1 个是别名），**缺 5–6 枚**（无 sidebar-foreground / primary / accent-foreground / border / ring）。而 sidebar 的 border/ring 现由全局 `--border-default` / `--card-button` 承担（见上文两条风险）。**补位族还是全族搬官方 sidebar 8 枚，需人工裁**。

### 二、其余需人工裁决（palette 原语族 — 官方唯一颜色槽族是 chart-1..5，但这几名非 chart 语义）

| 名字 | dark 值 | light 值 | 用途（注释摘要） | 消费次数 | 建议归类 | 目标官方名 | 风险 |
|---|---|---|---|---|---|---|---|
| `--blue-500` | `#3b82f6` | 未镜像（同 dark） | palette 原语（:root 第 45 行）；无独立用途注释 | 1 | 需人工裁决 | `chart-1..5`（候选） | 官方唯一的颜色槽族是 `chart-1..5`，但本仓这几名**没有 chart 消费语义**（是 Tailwind 原语色被零散引用）。硬塞进 chart = 名字与用途不符；留 B = 官方词表外自留原语族。二选一需裁 |
| `--blue-400` | `#60a5fa` | 未镜像（同 dark） | palette 原语 | 0 | 需人工裁决 | `chart-1..5`（候选） | **0 引用（死）** + 同上语义问题 |
| `--amber-500` | `#f59e0b` | 未镜像（同 dark） | palette 原语 | 1 | 需人工裁决 | `chart-1..5`（候选） | 同上 |
| `--green-500` | `#22c55e` | 未镜像（同 dark） | palette 原语 | 1 | 需人工裁决 | `chart-1..5`（候选） | 同上 |
| `--rose-500` | `#f43f5e` | 未镜像（同 dark） | palette 原语 | 3 | 需人工裁决 | `chart-1..5`（候选） | 同上 |
| `--gray-400` | `#9ca3af` | 未镜像（同 dark） | palette 原语 | 1 | 需人工裁决 | `chart-1..5`（候选） | 同上 |

---

## 附：取数过程中的其它事实（供裁定参考）

- **本文件外定义但被消费的名字**：`--detail-pane-right`（定义在 `apps/web/src/detail/detail.css:12`，值 `488px`，消费 4 次）——不在 tokens.css 的 117 内，是局部 token，与本次并流无关（列此以免与 117 名单混淆）。
- **alias 图（值正本流向）**：`--sidebar-bg → --surface`；`--card-ghost-border → --card-border`；`--fab-shadow → --edge-shadow`；`--edge-ring → --border-default`（嵌在合成值里）。这 4 条是"legacy 名降为别名"方向的**现成样板**，可作为改法参考。
- **`--font-sans` 依赖外部定义**：值里引 `var(--font-inter)`，该名不在 tokens.css 的 117 内（注释指其来自 `fonts.css`，r1 §4.1）。`apps/web/src` 内有 2 处 `var(--font-inter)` 消费——即该名在别处定义，读表时勿误判为死 token。
- **消费次数 Top 10**（指定口径）：`--text-primary` 121 · `--text-tertiary` 115 · `--text-dim` 95 · `--border-default` 73 · `--text-secondary` 63 · `--surface-secondary` 48 · `--surface` 41 · `--card-border` 32 · `--indigo-500` 26 · `--card-button` 25。**这 10 名占了并流改动面积的绝大部分**，其中 8 名落在"需人工裁决"节。
- **e2e 值钉扎面**（并流改值会直接红，本地无感、CI 才炸）：`brand-typo.spec.ts:113-114`（`--card-button` = `rgb(78, 71, 221)`）· `overlay-focus.spec.ts:17`（同值常量）· `segmented-controls.spec.ts:25`（`--tab-chip-bg` dark = `rgb(39, 39, 42)`）。
- **覆盖核对**：A 6 + B 53 + C 22 + D 8 + 需人工裁决 28（特别单列 22 + palette 原语 6）= **117** ✓（= 题面 117，无遗漏、无重复计入）。