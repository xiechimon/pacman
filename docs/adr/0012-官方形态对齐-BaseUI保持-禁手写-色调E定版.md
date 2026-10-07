# ADR 0012 · 组件形态对齐 shadcn 官网：registry 默认几何为正典、Base UI 保持、禁手写件、色调定版 E · 暖灰玫

> 状态：**已裁决**（2026-10-07，#980 charting grilling 九项裁决 + #988 实审三答）。执行承载 = #980 地图（task 票即施工批次），入账票 #990。
> 来源：#980（地图，Notes = 九项裁决正本）；侦察与判决票 #981（组件清单差距表）/ #982（registry 件漂移审计）/ #983（手写件八件判决表）/ #984（chief 聊天面差距）/ #985（禁手写闸机械判据）/ #986（e2e 受影响面盘点）/ #987（token 架构收敛映射）/ #988（色调重选实审定版）；CI 闸已落地 = #989（`f2652a02`）。本 ADR 记「推翻了什么、保留了什么、新正本在哪」；批次表、波次形状与施工序在 #991。

## Problem Statement

ADR 0010 以「几何自由重设计」（D2）与「C · 纸兰定版」（D1）为全站 UI 换代正典，spec/22 为唯一取数正本，#908 按此施工并已封版（#953）。但换代完成后的两轮审计显示，正典链在组件承载面上长出了系统性漂移：16 件 registry 同源件中 11 件有实质漂移——checkbox / select 整文件手写、input / textarea 方角、button 自持 focus 环 outline 形态 + brand 档、tabs 手写 segmented / bare 皮肤档（#982）；另有 8 个本地手写壳 / 适配件堆积在 `components/ui/`（panel、dialog-shell、floating-shell、alert-dialog-shell、seeded-avatar、status-chip、tag-chip、kbd-hint，#983）。「几何自由重设计」的授权在实践中把本地偏离沉淀成了新债——纯结构迁移「旧脸换骨架」的问题被解决了，换来的是「官方形态被本地皮肤覆盖」。

用户 2026-10-07 九项裁决（#980 Notes 正本）重设目的地：`components/ui/` 只许 registry 同源件 + 零皮肤适配层，几何以 registry 默认为正典、用户自行决定只经 token 层生效；Base UI（base-nova）保持不切 Radix；色调重新选一次（纸兰退位为历史参考），全量并行原型实审定版；禁手写落 CI 机械闸。本 ADR 是这些裁决的入账点：ADR 0010 D1 值正本 / D2 件级几何授权随之部分废止，spec/22 相应节标 superseded-in-part。

ADR 三条件全中：**难以逆转** = 全站几何正典换锚（官方 61 件基准面、e2e 几何审查面 369 行、类名 locator 671 处随迁）+ 143 字面色槽重翻；**无上下文会惊讶** = spec/22 上周还是「逐域施工票的唯一取数正本」、ADR 0010 仍标「已裁决并生效」，而件级几何正典已整体换锚；**真取舍** = 几何自由重设计 vs 官方形态对齐、Base UI vs Radix、E / D / F 三候选色板实审。

## 侦察事实

| # | 事实 | 出处 |
|---|---|---|
| F1 | 官方 base-nova 全集 61 件 ui（CLI 实测）；仓内 25 文件 = 17 件 CLI 同源承载 + 8 件本地手写；缺 44 件 = 建议引入 4 + 可选逐面核算 10 + 暂不需要 25 + chat 原语 5 | #981 |
| F2 | 16 同源件 5 件零实质漂移、11 件漂移判应回（checkbox / select 整文件手写最重；avatar 属上游演进滞后、重拉即回正）；toaster 非同源（上游对应 sonner / toast 件，形态归批次裁）；spec/22 §2.6-1 预设的「h-8 32px 本地正典」实测不成立——h-8 就是上游 button / input 默认值，该面零漂移 | #982 |
| F3 | 手写件八件判决：panel 换 registry Card；dialog-shell(19 挂载点) / seeded-avatar(17) / status-chip(3) / tag-chip(5+3) 改写为零皮肤适配层；alert-dialog-shell(2) / floating-shell(12) / kbd-hint(5) 退役回消费点组合；select.tsx 是第 9 个手写件（被 floating-shell 退役硬阻塞，批次表单列） | #983 |
| F4 | token 面收敛判决：现行 109 色槽 = 死 7（含 destructive-foreground 条件死）· 并 30 · 留 72 + radius；官方 base-nova 值载体 = `colors/neutral.json` cssVarsV4（亮 32 / 暗 31）；radius 乘数族仓内与官方现形逐字一致、零动作 | #987 |
| F5 | 禁手写闸机械判据 = 清单 + hash 账本 + vendored 上游快照组合（CI 零网络 <1s）；live diff 形态被实测否掉；已落地 main（check job pre-install 槽） | #985 判决、#989 执行（`f2652a02`） |
| F6 | 色调定版 = E · 暖灰玫 Ash Rose（暖灰骨架 hue 62 + rosewood 品牌 hue 338，暗控件档 n(5) 承 #909 手调位间距）+ 圆角基官方 0.625rem + 无槽级微调；measure-912 全量双模 109 对 0 fail（暗 minGated 3.45 / 亮 3.08，高于 C 版 3.05 满足 #987 预警）；冻结正本 `apps/web/e2e/palette-e.css`（218 声明）+ 143 字面槽 1:1 翻值在分支 `ui/988-palette-reselect` @ `eaec9481`，未合 main | #988 |
| F7 | e2e 受影响面：色值探针 111 行随色板整批翻 + 几何审查面 369 行（高概率核心 ~67）+ 行为 515 行不动；载体迁移面 = 类名 locator 671 处 + toHaveClass 17 + integration 39；probe-dump（#921）零改造复用 | #986 |
| F8 | dropdown / popover 的 scale-fade 动效（#790/#805 V2 正典）与上游默认动画及 ADR 0009 D3② 冲突——动效归属需批次表补一个裁决点 | #982 横切 3 |

## Decision

| ID | 裁决 |
|---|---|
| **D1** | **官方形态对齐——registry 默认几何为正典**：`components/ui/` 件的几何以上游 base-nova registry 默认为唯一正典；用户自行决定只经 token 层生效（`--radius` 基值、色槽值等），不做件级几何偏离。**ADR 0010 D2「几何自由重设计」部分废止**：废止面 = 件级偏离官方形态的授权（#982 判应回的 11 件漂移 + #983 八件手写壳承载的自裁几何）；继承面 = better-ui 工艺基准、token 层的几何自由度、车道纪律与 ADR 0010 D5 钉扎口径全部有效。spec/22 §2.5 / §2.6 件级几何正典表随之 superseded-in-part：Input / Textarea 方角回 registry `rounded-lg`（override 6 废止）、Button focus 环回官方 `ring-3 ring-ring/50` 形态（override 2 废止，环色槽归并随 #987 判决、#883 挂起票随此再评）、brand 档废止（override 3，品牌语义由 token 翻值承接、开放点归 #991）、switch `thumbClassName` 死口删除、tabs segmented / bare 手写档废止（回上游 default / line 原生机制）、图标缝 4 件回 lucide（iconLibrary 契约）；h-8 = 32px 控件高**保留**（实测即上游默认，override 1 的 36px 退役结论不受影响）；动效归属冲突（F8）归 #991 批次表裁决，本 ADR 不裁。 |
| **D2** | **Base UI 保持，不切 Radix**：项目态正典 = `components.json`（base-nova × Base UI × lucide × Tailwind v4）。#787 / #813 主题槽架构建立在 Base UI 上且已经历两轮换代翻值；切库 = 全站钉点第三次重进，无增量收益。 |
| **D3** | **禁手写纪律（B 档）**：`apps/web/src/components/ui/` 只许两类文件——① **registry 同源件**：hash 账本 + vendored 上游快照机械证明同源，适配仅限仓 lint 三件套（type import、`.js` 扩展名、`'use client'`）；② **零皮肤适配层**：只做语义映射（`data-tone` / `data-variant` 状态载体、API 整形、`type='button'` 默认等具名行为理由、图标回 lucide），禁伴随 CSS、禁 arbitrary 颜色类、禁超出官网 variant 集的皮肤档。八件手写壳按 #983 判决表退役 / 改写；CI 闸机械拦截回潮（#989 已落地，判据正本 = #985；#851 施工期止血闸在 #980 地图期间继续生效并由该闸扩面）；「适配层是否越权带皮肤」的语义判断归 #939 软层审查，机械面不装懂。 |
| **D4** | **色调重选定版——纸兰退位**：定版 = **E · 暖灰玫 Ash Rose** + 圆角基**官方 0.625rem**（#988 用户实审三答，乘数族 calc 自动跟随）。值正本 = 冻结副本 `apps/web/e2e/palette-e.css` @ `eaec9481`（218 声明；D 冷瓷靛 / F 石墨青落选存档同分支）；143 字面槽 1:1 翻值 + e2e 视觉重钉（#986 面）的执行归 #991 批次表，可直接 cherry-pick `eaec9481`。**C · 纸兰退位为历史参考**：冻结副本 `palette-c.css` 保留不动、t-0909 历史（main 祖先 `144698cb`）可取回、measure-912 默认读数仍为 C（回归基准）——ADR 0010「换脸后悔」回退路据此仍成立，只是定版从 C 换成 E。ADR 0010 D5.4 hex/rgb 记法契约**不解除**（探针面未变；registry 官方 oklch 值必须折 hex 落仓）；#787 / #813「先加槽后翻值」继承律不变（源翻公式随，var() 别名与 color-mix 公式槽零改动）；`--primary` 保 neutral 与「default 档是否即成品牌档」的张力（#982 判决 vs #987 仓裁定记录）归 #991 施工期槽映射决策。tokens.css 的 `--edge-radius` / `--radius-popover` 不随圆角基翻——消费面是 #983 已判退役的手写壳，随壳退役一并处置。 |
| **D5** | **被推翻的旧裁决链**（点状摘除，非整体否定）：① ADR 0010 D1 定版色板 C · 纸兰（c.css / palette-c.css 值正本）→ 值正本改 `palette-e.css`（D4），槽架构与翻值继承律保留；② ADR 0010 D2「几何自由重设计」的件级授权 → 由 D1 取代（继承面见 D1）；③ spec/22 件级与值级正典 → 该册就地标 superseded-in-part（原文保留作历史账，不删）：§2.5 / §2.6 件级几何按 D1 / #982 判决回官方；§1.7 / §1.8 逐槽 C 值实测表降为历史测量，槽集合按 #987 收敛判决（死 7 · 并 30 · 留 72）由 #991 执行后以 E 值重测；§5.2 chip 五态皮肤面——StatusChip 保 `data-tone` + 五对 `--chip-*` token 槽、删 sm 几何档（#983 零皮肤适配层改写；若后续判改走 Badge registry 语义皮肤并清零五对槽消费，十槽随判死——#987 条件判决保留）；④ #909 定版色板 → 该票追加推翻评论（本 ADR 同 PR 落地后发）；⑤ `--radius` 0.875rem 仓自持档 → 官方 0.625rem（D4）。 |
| **D6** | **保留面**（本 ADR 不动）：**行为契约语义面**——e2e 行为断言语义一字不动，载体与视觉值按 #910 判定表随改重钉；**动效机制**——ADR 0009 收敛面只消费不重设计（唯一悬置 = F8 归属冲突，归 #991）；**钉扎口径与探针工具面**——#910 五项裁定 + #921 probe-dump + D5.4 记法契约全盘继承；**车道纪律**——#908 / #913 纪律由 #980 Notes 继承面承载（worktree 绝对路径、端口 8398–8403、并行硬上限 6、波次闸、lane 首装 corepack、模型路由）；**ADR 0008 定位两轴**——自用第一判据不变；「参考实现优先、不凭空造」纪律下，ADR 0010 F7 的视觉面反向授权（zinc 骨架 / 圆角 / 投影 / 彩色四项有意反向）**收窄**：几何以官方为正典后不再反向，色彩仍走 token 层自选（E 定版即行权）。 |
| **D7** | **执行承载**：#980 地图携带执行（task 票即施工批次、跑完合并即关，ADR 0010 D4 形态不变、载体由 #908 换 #980）；批次表与波次形状 = #991（输入 = #983 判决表、#984 chat 面拆道建议、#986 重钉面账、#988 cherry-pick 翻值、F8 动效归属裁决点）。 |

理由一句话：自由重设计在色彩面产出了用户定版的好结果，但在组件承载面把「偏离官方」变成了默认——审计（#982 / #983）证明 16 同源件 11 件漂移、8 手写壳堆积，且漂移不可机械拦截；把几何正典换锚到 registry 默认后，「同源」成为可 hash 证明的机械性质（#985 / #989 闸），色彩自由保留在唯一经用户实审的 token 层（E 定版），两个面各归其位。

## 术语

三项术语的定义正本随本 ADR 落仓（#980 Notes 裁决 ② 用语的成文点）：

- **registry 同源件**：`components/ui/` 下与 shadcn 上游 base-nova registry 源码逐 token 等价的文件——等价由 CI 机械证明（清单 + hash 账本 + vendored 上游快照，#985 / #989），允许的适配仅剩仓 lint 三件套（`import type * as React`、`.js` 扩展名、`'use client'`）。上游演进时按需刷新脚本重拉，刷新即回正。
- **零皮肤适配层**：`components/ui/` 下组合 registry 件、只携带**语义映射**的本地文件——状态载体（`data-tone` / `data-variant`）、API 整形（如受控 props 转透传）、具名行为理由的默认值（如 `type='button'` 防隐式 submit）。判据三条否定式：不带伴随 CSS、不带 arbitrary 颜色类、不带超出官网 variant 集的皮肤档。八件手写壳中判「改写」的四件（dialog-shell / seeded-avatar / status-chip / tag-chip）终态即此形态。
- **官方形态（registry 默认几何）**：上游 base-nova 件源码携带的几何与皮肤默认值全集（size 阶梯、圆角档、focus 环形态、variant 集）。它是件级几何的唯一正典；仓侧自由只存在于 token 层（`--radius` 基值、色槽值）与消费点的 className 组合，不进入件文件。

## 备选方案与否决理由

| 方案 | 否决理由 |
|---|---|
| **切 Radix**（shadcn 默认底库） | 用户裁决 ③ 否决。Base UI 上已建成 #787 / #813 槽架构并经历两轮翻值；切库要第三次全站重钉，而两套底库在本仓消费面无实质能力差 |
| **维持几何自由重设计**（ADR 0010 D2 原样） | #982 审计证伪其可持续性：自由授权下 16 同源件 11 件漂移、漂移无机械拦截手段、spec/22 要为每个偏离维护 override 登记；官方形态是可 hash 证明的锚，自由重设计的收益面（token 层）保留后无损失 |
| **手写件登记白名单继续持有** | 白名单只能证明「列表里有」，不能证明「与上游等价」；CI 闸的机械判据（hash + vendored 快照）只对 registry 同源成立，手写件永远需要人审——#985 实测 live diff 形态被否后，这是唯一可零网络机械化的路 |
| **色调沿 C · 纸兰不重选** | 用户裁决 ⑤ 明确要求重选（纸兰是「几何自由」时代的定版，暖纸骨架与分层软投影语言绑定旧形态）；#988 三候选实审后 E 胜出，且 E 在官方圆角基 + registry 件形态下过了全量门控 |
| **圆角基沿 0.875rem 仓自持档** | #988 实审第二答否决：用户在官方 0.625rem 与仓自持档之间选了官方值——圆角基属 token 层自由（D1），行权结果就是回归官方默认 |

## Premortem（假设已失败，最可能死因 + 护栏）

| 死因 | 护栏 |
|---|---|
| **双正本漂移**：施工车道一半看 spec/22 旧值旧几何、一半看 registry / palette-e.css，口径分叉 | spec/22 与 ADR 0010 头部 superseded-in-part 注记与本 ADR 同 PR 落地；取数源指针改写为 #991 批次表 + palette-e.css；#989 CI 闸机械拦手写回潮 |
| **E 翻值期探针假绿 / 门控失守**：oklch 混入、dump 直写吞真回归 | hex/rgb 记法契约存续（D4）；measure-912 已带 `--palette/--variant` 参数且默认读数 = C 封版逐字复现（回归基准）；重钉走 #921 probe-dump + 人审 diff（ADR 0010 D5.5 禁纯自动直写继承） |
| **适配层以「语义映射」名义夹带皮肤**：禁手写纪律被措辞漏洞侵蚀 | 判据拆两层——机械面（伴随 CSS / arbitrary 颜色类 / hash）CI 闸拦，语义面（是否超出官网 variant 集）归 #939 软层审查；#983 判决表逐件写明终态形态，批次验收对照 |
| **纸兰资产反弹**：某域施工发现 E 缺档（如 soft 投影语言无对口槽）就地造皮肤 | 缺档属 token 层问题回 #991 / 视觉方向补裁，不进件文件；C 冻结副本 + t-0909 历史在，对照与回退都不需要复活皮肤 |

## 回读校验

本 ADR 是 docs-only 裁决入账，不落任何「服务端快照式配置」，无回读对象。落地回读面 = ① 本 PR 的 CI 闸实测（#989 已落地的 check job 对 docs-only 改动应绿）；② spec/22 与 ADR 0010 头部注记的 raw diff；③ #909 推翻评论与 #980 地图 Decisions so far 行（合并后追加）。
