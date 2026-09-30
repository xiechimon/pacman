# 16 · shadcn/ui 全站铺开：批次表与验收口径

> 正典地位：本册收 #417（Map）的三件规划产物——**批次表**、**每片验收标准模板**、**与三张蓝图票的依赖序**——并把「已落地 / 前沿」两份实测钉在同一处，让 B3 / B4 的执行票不必回翻 issue 线程取口径。
> 决议来源：#421（批次表与验收口径，2026-09-29 用户全项 agree）、#422（第一片选定，2026-09-29）、#409（迁移面盘点，2026-09-29）；三张蓝图票 = #410（primitives 选型）/ #411（e2e 重钉口径）/ #412（token 管道）。
> 时效：§5 实测按 `origin/main @ fa54bbad`（2026-10-01，XMON-20 取数时点）取数，命令逐条在 §7；#409 的数字取于 `8c30775`，凡量纲不同或已漂移处均就地标注。
> 归批口径（XMON-17 定，XMON-20 补第二条边）：**每一处 `ui/` 原语消费点与每一处手搓控件都必须落在某一批里**。裁决 A2=B（父票 XMON-3）：`routes/` 与 `board/` 的残留按域拆回现有各批，不新开「routes 批」；域的判定用两条可复核的边——**挂哪个 shell**（`resources/shell.tsx` / `secondary/shell.tsx`）与**直引哪个域 css**。手搓控件（裸 `<button>`）的入账口径见 §5.3——它们是只认「有没有引 `ui/` 原语」的旧口径下唯一漏账的一类。
> 像素纪律：逐域迁移是**纯结构**改动、零视觉重钉（#411 政策 4 + #435 值正本并流后的口径）——per-face 规则仍是几何与配色的正本，组件换成 shadcn 件只换承载结构。

## 0. 结论一览

| 批 | 内容 | 状态（fa54bbad 实测） |
|---|---|---|
| **#414 试点片** | 看板 / 侧栏域（board / sidebar） | **未收口**，剩 1 个 tsx 消费点（`board/notify-banner.tsx`）；裸控件 13 处 / 手搓类 1，见 §5.3 |
| **B1 弹层族片** | 19 个挂载点收编 shadcn Dialog | 已落地（#425，证据 `docs/verify/425/`） |
| **B2 热身片** | token-gate + machine-authorize + secondary 面 | **已落地**（#426 热身两面，证据 `docs/verify/426/`；Button/Input 收尾 XMON-13 / #534；secondary 面 XMON-20，证据 `docs/verify/xmon-20/`） |
| **第一片真域** | resources 五页（machines / providers / secrets / skills / mcp-servers） | 已落地（#423，证据 `docs/verify/423/`）；`routes/agent-detail.css` 为壳内邻页残留，见 §6.2 |
| **B3 弹层内容族** | overlays + overlay + detail/overlays + mention-picker | **未开工**，剩 3 个 tsx 消费点；裸控件 26 处 / 手搓类 22 |
| **B4 高三件** | chief / detail / pages | **未开工**，剩 11 个 tsx 消费点；裸控件 83 处 / 手搓类 59 |

闸口状态：三张蓝图票 **#410 / #411 / #412 全部 CLOSED**（#412 的执行票 #435 亦已闭），B1 亦已落地——#421 设的两道闸（「B2 起 blocked-by #412 + #411」与「B1 串行先行」）**均已打开**，B3 / B4 可直接开工。

## 1. 批次表

前四行是 #421 决议原文（数字为 #421 时点值），**`#414 试点片` 行与各行末尾的〔归批增量〕是 XMON-17 按 A2=B 补的**——补的目的是让每个 `ui/` 原语消费点都能指到一批。

| 批 | 内容 | 依据 | 并行 | 裸控件 处 / 类〔XMON-20 增量〕 |
|---|---|---|---|---|
| **#414 试点片**〔归批增量〕 | 看板 / 侧栏域（`board/`）的**原语全切**——#414 只迁了卡片族的 token 与工具类，原语消费点仍在；`routes/board-page.tsx` 同域（直引 `board/board.css`） | 该片是最早落地的一批，域已存在；残留不归批就永远没有验收范围 | 已在盘面，本批只做收口 | 13 处 / 1 类 |
| **B1 弹层族片** | 19 个挂载点（共享壳 14 消费点 + 2 手工壳）收编到 shadcn Dialog；壳类 `.dlg` ×67 是最热重钉单点 | 共享件先行，避免半迁移缝合线在每域重复 | **串行先行** | 0 / 0（壳件，控件在内容族批） |
| **B2 热身 + 第一片真域** | token-gate（30 decl）+ machine-authorize（41 decl）+ resources / secondary 之一（#422 裁 = resources）。〔归批增量〕**secondary 面**：`routes/` 下三个页面壳 + 同域页 `team-page.tsx` / `team-chart.tsx` / `account-page.tsx`（均挂 `secondary/shell.tsx`，样式经 `secondary.css` 注入；先例 = XMON-13 已按本行落地同域的 `routes/machine-authorize-page.tsx`） | 低 2 面小钉扎少；中 9 里两件 shell 单引、边界最整 | 批内错域可并行 | **21 处 / 14 类**（XMON-20 前 32 / 24——secondary 面 11 / 10 已由本票清零；余 21 / 14 = resources 五页 15/13 + 壳内邻页 `routes/agent-detail-page.tsx`、`routes/agent-model-select.tsx` 6/1）。#423 迁的是卡片/徽标/tab/switch/input/empty **件**，页内手搓控件当时不在该行验收范围，`create-*-dialog` 三件更在 #422 的排除面内 |
| **B3 弹层内容族**（合并一片） | overlays（241）+ overlay（278）+ detail/overlays（404）+ mention-picker（223，先修悬空 token） | 三件同族（dlg-* 内容族）、跨域同源；合并免把 dialog-viewport 34 处钉扎改三遍 | 批内可并行 | 26 处 / 22 类 |
| **B4 高三件** | chief（464 / 49 处钉扎）+ detail（852 / 41K 单文件）+ pages（899 / prj-* 42 选择子） | 体量与钉扎密度决定必须等管道与重钉口径稳定 | 可并行，**最多两条车道**（避免同批断言冲突） | 83 处 / 59 类 |

`board/` / `sidebar` **不在「已从盘面消掉」之列**：实测仍有原语消费点（§5.2），归 `#414 试点片` 收口；`routes/` 八个 tsx 按上述两条边（挂哪个 shell / 直引哪个域 css）拆进 `#414 试点片` / `B2` / `第一片真域`，不单开一批。判定与证据见 §6.2。

## 2. 每片验收标准模板（#421 决议原文）

1. 该域界面**全切 shadcn 件**（含该域弹层内容族，若有）；
2. 该域**行为 e2e 全绿**（夹具面回归走 apps/web e2e，不用 verify-pacman）；
3. **视觉探针按 B 重钉**（口径归 #411；重钉清单从 #409 附录 A 按 spec 摘——该附录已并入 main，但数字停在 `8c30775`，摘清单前先按 §6.4 的口径重跑）；
4. **verify-pacman 栈出证据**（截图 + API/SQLite）归档进 `docs/verify/<票号>/` 随 PR 提交；
5. **未迁残留声明**：该片故意留旧的面（相邻域共享件等）在 PR body 列明，避免「看着全迁完了」的错觉。

**每片特有的额外面**（#421 只点名了体量与钉扎，开工前按域补）：

- B3：`dialog-viewport` 的 34 处钉扎是跨三域同源面——合并成一片就是为了只改一遍；`mention-picker` 的 5 个悬空 token 已由 #419 修（PR #427），本片不必重做。
- B4 · chief：49 处钉扎 + 容器结构会变（贴右竖板，ADR 0004 / #447）——**#447 先于 B4 合入**，B4 迁的是竖板不是内缩悬浮卡。
- B4 · detail：`todo-detail-page.tsx` 41K 单文件是最大单点，域 css 现为 955 decl（§5.1）。
- B4 · pages：域 css 现为 1094 decl（§5.1），是最大户。

## 3. 闸口与依赖序（#421 决议原文）

- **B2 起全部执行票 blocked-by #412（token 管道）+ #411（e2e 重钉口径）**；#420 的**设计**不设闸（事实已备），B1 的**执行**设闸。
- #419（mention-picker 悬空 token 修复）不受闸，随时可做。
- B1 串行先行；B2 起同批错域可并行，各用独立 worktree + **私有 E2E_PORT**（8399 被占会静默跑在别人构建上——#414 实测）。
- #410（primitives 选型）与铺开解耦：裁决为 **base（Base UI，`@base-ui/react`）**，B1 起所有 shadcn 件按 base 形态拉取。

**现行状态**：#412 + #411 + B1 三闸全解除，B3 / B4 无前置阻塞。

## 4. 已落地批次与证据

| 片 | 落地内容 | 证据归档 |
|---|---|---|
| B1（#425） | 弹层族共享壳换 Base UI Dialog；`ui/dialog-shell.tsx` 已删除，11 个消费点只改 import 路径、调用点零改动 | `docs/verify/425/` |
| B2（#426） | token-gate / machine-authorize 面板换 Card + 语义 token | `docs/verify/426/` |
| B2 收尾（XMON-13 / #534） | 同两面再切 `components/ui` 的 Button + Input（`overlay/token-gate.tsx` 24 行 + `routes/machine-authorize-page.tsx` 21 行） | `docs/verify/xmon-13/` |
| 第一片（#423） | resources 五页：Card 收编 `res-card` / `res-rowcard` / `res-model-row` 系，Badge 收编 `res-pill` / `res-tag`，新增 registry 件 tabs / switch / input / empty；域内 3 个 DialogShell 归 B1 | `docs/verify/423/` |
| B2 · secondary 面（XMON-20） | `routes/` 三个 secondary 页面壳 + 同域页 `team-page.tsx` / `team-chart.tsx` / `account-page.tsx` 共 6 文件切 `components/ui`：11 处裸 `<button>` 收进 Button（布局切换片 / 创建 Agent 槽 ×2 / 语言触发与选项行 / 新建密钥 / 复制 / 创建 / 取消 / 全选清空 / 弹窗提交）+ 推送通知钮换 Switch；`ui/` 原语消费点 3 文件（button ×2、input ×3）清零，`ui/dialog.css` 的表单族与 `secondary.css` 的 per-face 规则原样留作几何正本 | `docs/verify/xmon-20/` |

三片的共同验收信号：**e2e spec 断言一行未动**（别名优先政策 #411 的验收信号）。

另有一件不属任何片的前置：**三原语落点（XMON-14 / #535）**补齐 `components/ui` 的 avatar / kbd / tag-chip 与两个适配层，并一次切完 21 处消费面（证据 `docs/verify/xmon-14/`）——它落的是「件」，不是「域」，故不进上表，只把 §5.2 的读数改写。

## 5. 前沿实测（基线 fa54bbad）

### 5.1 域 css 体量

口径说明：#409 报的 `326`（resources.css）是 **decl 数**，#422 已勘误；下表同用 decl 数以便对拍行数另行给出。

| 域 css | 行 | decl | rule | #409 基线（decl） | 归属批 |
|---|---|---|---|---|---|
| `pages/pages.css` | 1927 | 1094 | 221 | 899 | B4 |
| `detail/detail.css` | 1913 | 955 | 227 | 852 | B4 |
| `secondary/secondary.css` | 924 | 488 | 113 | — | B2 · secondary 面（XMON-20 已落地） |
| `chief/chief.css` | 841 | 470 | 96 | 464 | B4 |
| `detail/overlays.css` | 771 | 420 | 95 | — | B3 |
| `resources/resources.css` | 680 | 363 | 79 | 326 | 已落地（第一片 #423） |
| `overlays/overlays.css` | 462 | 238 | 53 | — | B3 |
| `overlay/overlay.css` | 459 | 240 | 48 | — | B3 |
| `overlay/mention-picker.css` | 410 | 227 | 51 | — | B3 |
| `routes/agent-detail.css` | 379 | 185 | 47 | — | 第一片真域（壳内邻页：`routes/agent-detail-page.tsx` 挂 `resources/shell.tsx`；见 §6.2） |
| `board/board.css` | 140 | 64 | 13 | — | #414 试点片 |
| `ui/*.css`（原语 5 件） | 441 | 189 | 57 | — | 随消费点退役；`dialog.css` 例外——`.dlg-*` 别名规则仍由 B1 的新壳输出，本片不动 |

与 c95ee5f 的差：`detail/overlays.css` 745/407/92 → 771/420/95、`routes/agent-detail.css` 343/175/42 → 379/185/47、`detail/detail.css` 行 1912 → 1913，均为 #435 / #474 / XMON-13 / XMON-14 落地后的量；原语 css 由 7 件降为 5 件（`ui/tag-chip.css`、`ui/kbd-hint.css` 随 XMON-14 的落点删除）。

量纲提醒：#409 的原文对 resources.css 报的是 decl 数（#422 已勘误），对高 3 件写的是「行」——两处量纲不一致，上表第 5 列只作**报告值**看，不做差值解读。可比的是同一单位下的实测：高三位次未变（pages > detail > chief），但三册按 decl 均已长大（+195 / +103 / +6）——**B4 开工前的「各自专门决策」须按新体量重做侦察**，不要沿用 #409 的绝对值排工。

### 5.2 仍消费 `ui/` 原语的文件（17 文件 / 18 处）

口径：只计 `from '../ui/<p>.js'` 形态的 import（含 `type` 形态，已标）。`ui/card`、`ui/dialog-shell` 的真实消费点现均为 **0**（`ui/dialog-shell.tsx` 文件已随 B1 删除；`ui/card.tsx` 自 #409 起即死原语）。`ui/avatar` / `ui/tag-chip` / `ui/kbd-hint` 分别于 XMON-14（#535）落点后清零，落点见 §6.1。第三列只计 `components/ui/` 的 import，含 XMON-14 新增的三个适配层（`seeded-avatar` / `kbd-hint` / `tag-chip`）。**本表每一行都指得到一批**（XMON-17 口径）。

| 归属批 | 文件 | 仍消费 `ui/` 原语 | 已消费 `components/ui/` |
|---|---|---|---|
| B3 | `overlay/new-task-dialog.tsx` | `ui/button` | `dialog-shell` |
| B3 | `detail/overlays.tsx` | `ui/button` | `seeded-avatar` |
| B3 | `overlays/search-panel.tsx` | `ui/input` | `dialog-shell`, `seeded-avatar` |
| B4 | `chief/chief-drawer.tsx` | `ui/button` | - |
| B4 | `chief/chief-settings.tsx` | `ui/button` | - |
| B4 | `detail/accept-dialog.tsx` | `ui/button` | `dialog-shell` |
| B4 | `detail/branch-dialog.tsx` | `ui/button` | `dialog-shell` |
| B4 | `detail/dhead.tsx` | `ui/button` · `ui/chip` | `floating-shell` |
| B4 | `detail/review-dialog.tsx` | `ui/button` | `dialog-shell` |
| B4 | `detail/source-issue.tsx` | `ui/button` | - |
| B4 | `pages/github-issues-dialog.tsx` | `ui/button` | `dialog-shell`, `tag-chip` |
| B4 | `pages/project-page.tsx` | `ui/button` | `seeded-avatar` |
| B4 | `pages/project-settings-page.tsx` | `ui/button` | - |
| B4 | `pages/schedules-page.tsx` | `ui/button` | - |
| #414 试点片 | `board/notify-banner.tsx` | `ui/button` | - |
| 第一片已完成 | `resources/create-provider-dialog.tsx` | `ui/input` | `dialog-shell` |
| 第一片已完成 | `resources/create-secret-dialog.tsx` | `ui/input` | `dialog-shell` |

按原语汇总：`ui/button` ×14 · `ui/input` ×3 · `ui/chip` ×1。

与 c95ee5f 的差（36 文件 / 46 处 → 17 文件 / 18 处，−19 / −28）：

- **−21 处** = 三原语消费点，XMON-14（#535）落点后一次切完（avatar 12 / tag-chip 6 / kbd-hint 3）；
- **−3 处** = `overlay/token-gate.tsx`（button + input）与 `routes/machine-authorize-page.tsx`（button），XMON-13（#534）B2 收尾切完；
- **−4 处** = secondary 面三文件（`routes/api-keys-page.tsx` button、`routes/api-key-create-dialog.tsx` button + input、`routes/create-agent-dialog.tsx` input），XMON-20 切完——B2 · secondary 面就此清零；
- XMON-17 只把当时剩下的 20 个文件 / 22 处逐行归批（不改代码）；XMON-20 落地后刷新为 17 文件 / 18 处。
- `detail/overlays.tsx` 的归属批由 B4 更正为 **B3**：它的域 css 是 `detail/overlays.css`（§5.1 归 B3，弹层内容族），原表按目录挂在 B4 是错位。

### 5.3 裸控件账本（手搓控件的入账口径）

§5.2 只认「有没有引 `ui/` 原语」。这个口径有一个洞：**页面若把手搓 `<button>` 与域 css 配套写，`ui/` import 为 0，于是被读成「已无原语消费点」，既不进任何一批，也永远没有验收范围**。XMON-20 开票时实测的就是这一面——`routes/team-page.tsx` / `team-chart.tsx` / `account-page.tsx` 三个文件在 §5.2 里记着「本次已无原语消费点」，实际各有 3 / 1 / 3 处手搓钮，样式全在 `secondary.css` 手写。用户看到的就是这句：

> 「组件也没有复用，页面写的一坨，按钮更是有两个样式，都没有用 shadui？」

本节把这类控件也记账。**三列口径**（逐域一行；域 = `apps/web/src` 下的顶层目录）：

- **裸 `<button>`** = 该域 `*.tsx` 里 `<button` 的出现次数（含多行标签）。
- **手搓按钮类** = 挂在裸 `<button>` 的 `className` 上、且在 `apps/web/src` 下任一 `.css` 里被定义成选择子的类名数（**域内 distinct**，逐文件列不可直接相加）。这就是「两套按钮样式」的度量：一套来自 `components/ui/button`，一套来自域 css。
- **消费 shadcn `Button` 的文件** = 引 `components/ui/button` 的 tsx 文件数。

**全站分布（每域一行）**：

| 域 | 裸 `<button>`（开工前 → 现） | 手搓按钮类（开工前 → 现） | 消费 shadcn `Button` 的文件（开工前 → 现） |
|---|---|---|---|
| `pages` | 35 → 35 | 27 → 27 | 0 → 0 |
| `detail` | 34 → 34 | 25 → 25 | 0 → 0 |
| `chief` | 17 → 17 | 11 → 11 | 0 → 0 |
| `overlay` | 15 → 15 | 14 → 14 | 1 → 1 |
| `resources` | 15 → 15 | 13 → 13 | 2 → 2 |
| `board` | 12 → 12 | 0 → 0 | 3 → 3 |
| `overlays` | 8 → 8 | 5 → 5 | 0 → 0 |
| `routes` | 18 → **7** | 14 → **4** | 2 → **8** |
| `ui` | 1 → 1 | 0 → 0 | 0 → 0 |
| `api` / `components` / `i18n` / `icons` / `pwa` / `secondary` | 0 → 0 | 0 → 0 | 0（`components` 2 个是 `components/ui` 内部自引） |
| **合计** | **155 → 144** | **109 → 99** | **10 → 16** |

（开工前 = `fa54bbad`，即 XMON-20 动手前的 main 读数；现 = XMON-20 落地后。`routes` 的 −11 / −10 就是本票迁的 11 处裸钮；合计 −11 / −10 与之一致。`chief` / `detail` / `pages` / `overlays` 消费 shadcn `Button` 的文件数仍为 0——对应 B3 / B4 未开工。）

**逐文件（只列裸 `<button>` > 0 者，按处数降序，42 文件；每行都指得到一批）**：

| 文件 | 裸 `<button>` | 手搓按钮类 | 归属批 |
|---|---|---|---|
| `pages/project-new-page.tsx` | 14 | 9 | B4 高三件 |
| `board/sidebar.tsx` | 9 | 0 | #414 试点片 |
| `detail/docpane.tsx` | 8 | 6 | B4 高三件 |
| `pages/project-page.tsx` | 8 | 5 | B4 高三件 |
| `overlay/mention-picker.tsx` | 7 | 8 | B3 弹层内容族 |
| `chief/chief-drawer.tsx` | 6 | 4 | B4 高三件 |
| `detail/branch-dialog.tsx` | 6 | 3 | B4 高三件 |
| `pages/schedules-page.tsx` | 6 | 6 | B4 高三件 |
| `resources/create-provider-dialog.tsx` | 6 | 6 | 第一片真域（#422 排除面：壳归 B1、内容族归 B3） |
| `detail/composer.tsx` | 5 | 3 | B4 高三件 |
| `overlay/more-menu.tsx` | 5 | 3 | B3 弹层内容族 |
| `overlays/search-panel.tsx` | 4 | 1 | B3 弹层内容族 |
| `pages/dir-browser.tsx` | 4 | 4 | B4 高三件 |
| `resources/create-machine-dialog.tsx` | 4 | 2 | 第一片真域（#422 排除面，同上） |
| `chief/chief-agent-dialog.tsx` | 3 | 3 | B4 高三件 |
| `chief/chief-model-select.tsx` | 3 | 2 | B4 高三件 |
| `detail/overlays.tsx` | 3 | 3 | B3 弹层内容族 |
| `detail/transcript.tsx` | 3 | 4 | B4 高三件 |
| `overlay/new-task-dialog.tsx` | 3 | 3 | B3 弹层内容族 |
| `routes/agent-detail-page.tsx` | 3 | 3 | 第一片真域（壳内邻页，挂 `resources/shell.tsx`） |
| `routes/agent-model-select.tsx` | 3 | 0 | 第一片真域（壳内邻页，同上） |
| `board/repo-filter.tsx` | 2 | 0 | #414 试点片 |
| `chief/chief-settings.tsx` | 2 | 3 | B4 高三件 |
| `chief/edit-charter-dialog.tsx` | 2 | 2 | B4 高三件 |
| `detail/dhead.tsx` | 2 | 2 | B4 高三件 |
| `detail/review-dialog.tsx` | 2 | 2 | B4 高三件 |
| `detail/stop-confirm-dialog.tsx` | 2 | 2 | B4 高三件 |
| `detail/user-menu.tsx` | 2 | 0 | B4 高三件 |
| `overlays/plan-dropdown.tsx` | 2 | 2 | B3 弹层内容族 |
| `pages/github-issues-dialog.tsx` | 2 | 2 | B4 高三件 |
| `resources/skills-page.tsx` | 2 | 2 | 第一片真域 |
| `board/tag-filter.tsx` | 1 | 0 | #414 试点片 |
| `chief/chief-wake.tsx` | 1 | 0 | B4 高三件 |
| `detail/accept-dialog.tsx` | 1 | 1 | B4 高三件 |
| `overlays/chip-popover.tsx` | 1 | 1 | B3 弹层内容族 |
| `overlays/dismiss.tsx` | 1 | 1 | B3 弹层内容族 |
| `pages/shell.tsx` | 1 | 1 | B4 高三件 |
| `resources/create-secret-dialog.tsx` | 1 | 1 | 第一片真域（#422 排除面，同上） |
| `resources/machines-page.tsx` | 1 | 1 | 第一片真域 |
| `resources/shell.tsx` | 1 | 1 | 第一片真域 |
| `routes/board-page.tsx` | 1 | 1 | #414 试点片（直引 `board/board.css`） |
| `ui/button.tsx` | 1 | 0 | 原语自身（消费点清零后退役） |

**这份账对 #414 / B3 / B4 三行口径的修订**（XMON-20 复核结论）：

- **三行的「原语消费点」计数不变**（§5.2 的两条边照旧有效），但**验收范围要连带手搓控件**：B3 的域面从此是「3 个原语消费点 **+ 26 处裸控件**」，B4 是「11 个原语消费点 **+ 83 处裸控件**」，#414 是「1 个原语消费点 **+ 13 处裸控件**」。若只按原语消费点开工，`pages/project-new-page.tsx`（14 处裸钮，全域最大单点）这类文件会整片漏掉。
- **B2 · secondary 面 是本口径下第一个按新账收口的面**：它的三个页面壳在 §5.2 里记着「本次已无原语消费点」，靠本节的账才现形。
- **一处需人裁决的遗留**：`resources/create-*-dialog` 三件（11 处裸控件）在 #422 被划为**排除面**（壳归 B1、内容族归 B3），但 §5.2 把同三件的 `ui/input` 记在「第一片已完成」行下——同一批文件的控件账与原语账落在两行。本节照 #422 原判记在排除面，**是否要把 resources 侧手搓控件单列一行验收，留给父票裁**。

## 6. 开工前四件的落点（全部已落）

四条都在 2026-09-30 的父票裁决里定了选项，并已各自落地：6.1 = A1（补三件，XMON-14 / #535）、6.2 = A2（按域拆回现有各批，本票）、6.3 = A3（B2 收尾，XMON-13 / #534）、6.4 = A4（底账并 main，XMON-11 / #532）。

### 6.1 三个原语在 `components/ui` 的落点（已落）

原状：`components/ui/` 现有件里没有 avatar / tag-chip / kbd-hint，21 处消费点（`avatar` 12 / `tag-chip` 6 / `kbd-hint` 3）够不到「全切 shadcn 件」这条验收。

**裁决 A1 = A（补三件）**，XMON-14（#535）落地：`components/ui/avatar.tsx` + `kbd.tsx` 取 base-nova registry 件原样入仓（仓内偏离就地标注：Avatar Root 去 `after:` 环、AvatarImage 去尺寸与圆角——几何归 per-face 正本）；`seeded-avatar.tsx` / `kbd-hint.tsx` / `tag-chip.tsx` 是仓内语义适配层（tag-chip 落在已有 `badge.tsx` 上，registry 无同名件，沿用 #423 的 `res-pill` / `res-tag` → Badge 先例）。21 处消费面只改 import 路径与组件名，调用点传参零改动；`ui/{avatar,kbd-hint}.tsx` 与 `ui/{tag-chip,kbd-hint}.css` 随之删除。

结果：§5.2 里三原语的行已清零，`ui/*.css` 由 7 件降为 5 件（§5.1）。

### 6.2 `routes/` 与 `board/` 的归批（已裁，本票落地）

**裁决 A2 = B**：按域拆回现有各批，不新开「routes 批」。

归域的判据用两条**可复核的边**，不看目录名：

1. **挂哪个 shell**——`resources/shell.tsx`（资源域）/ `secondary/shell.tsx`（secondary 域）。`routes/` 下页面自身 0 css import，样式全经 shell 的域 css 注入。
2. **直引哪个域 css**——`routes/board-page.tsx` → `board/board.css`、`routes/agent-detail-page.tsx` → `routes/agent-detail.css`、`routes/todo-detail-page.tsx` → `detail/detail.css`。

落到批次表（§1）：

| `routes/` 文件 | 域（边） | 归批 |
|---|---|---|
| `api-keys-page.tsx` · `api-key-create-dialog.tsx` · `create-agent-dialog.tsx` | secondary（均挂 `SecondaryShell`；`create-agent-dialog` 由同域的 `team-page.tsx` 渲染） | B2 · secondary 面（XMON-20 已落地） |
| `agent-detail-page.tsx` (+ `agent-detail.css`) | 资源域（挂 `ResourceShell`，路由级直引 `agent-detail.css`） | 第一片真域（壳内邻页，css 为残留；§5.3 记 3 处裸控件） |
| `board-page.tsx` | 看板域（直引 `board/board.css`） | #414 试点片（§5.3 记 1 处裸控件） |
| `team-page.tsx` · `team-chart.tsx` · `account-page.tsx` | secondary | B2 · secondary 面（XMON-20 已落地；§5.2 记的「无原语消费点」只是原语账，裸控件账在 §5.3：11 处 / 10 类） |
| `machine-authorize-page.tsx` | machine-authorize | B2（XMON-13 / #534 已落地） |

`board/` 侧同律：`board/notify-banner.tsx` → **#414 试点片**。并更正票面旧记——**#414 迁的是卡片族的 token 与工具类，不是原语全切**，实测仍有原语消费点（§5.2 那一行），故 `board/` / `sidebar` 不在「已从盘面消掉」之列。

两处判定不是缺件、是归属更正：`routes/agent-detail.css` 与 `routes/` 三个 secondary 页面壳各自都指到了批，`board/` 残留回到它自己的域。

### 6.3 B2 两面的 Button / Input 收尾（已落）

原状：`overlay/token-gate.tsx` 文件头写的保留理由原文是「components/ui 无 Input 件、shadcn Button 的 variant 表无 brand primary 档，换件即改填充色——故本片不动它们」。这两条**都已被后续批次推翻**：`components/ui/input` 随后入库（#423），`components/ui/button` 在 #423 新增了 `brand` 档（注释原文：「= 轨 A3 ui/Button primary 档等价迁移位」）。`routes/machine-authorize-page.tsx` 同形（`ui/button`，Card 已换）。

**裁决 A3 = A（B2 收尾）**，XMON-13（#534）落地：两面切到 `components/ui` 的 Button + Input（改动面 = `overlay/token-gate.tsx` 24 行 + `routes/machine-authorize-page.tsx` 21 行，证据 `docs/verify/xmon-13/`）。两者的域 css 更早一步退的役——`overlay/token-gate.css` 与 `routes/machine-authorize.css` 随 B2 热身片（#426 / #474，commit `aa1314b`）删除。§5.2 里这两行已清零。

### 6.4 #409 的重钉底账（已并入 main，数字停在 `8c30775`）

每片验收第 3 件要「重钉清单从 #409 附录 A 按 spec 摘」。该底账是 `docs/research/migration-surface.md`（附录 A/B：46+3 个 spec 的逐文件选择子全表），原先只在 `research/migration-surface` 分支（commit `def4b57`）。

**已解**：按父票裁决 A4=A，该文件已并入 `main`——正文逐字取自 `def4b57`，文件头记明来源与入仓理由。

**但摘清单前必须先重跑**：报告成文于 `8c30775`，并入时已算出与当前树的偏差（复核基线 `9a0613b`，晚 77 个 commit），并以「偏差标注」块**就地**插在报告各节。**附录 A 的 46 spec 全表不是现行清单**（现 e2e 66 个 spec / 61 个有类名钉扎，表内每行的处数与 distinct 都可能已变）；§3.1、§2.1、§4 同此。摘任何数字前先读对应节的标注块。

同类研究产物仍未在 `main`：`research/dialog-contract`（#418）、`research/baseui-dialog-contract-2`（#430 车道）等分支同形。

## 7. 取数命令

```sh
# 裸控件账本（§5.3）—— 每域一行 + 逐文件两表，直接贴进本节
node scripts/count-raw-controls.mjs

# 前沿消费点（§5.2）—— 17 文件 / 18 处：ui/button 14 · ui/input 3 · ui/chip 1
grep -rn -E "from '(\.\./|\.\./\.\./|\./)ui/[a-z-]+\.js'" apps/web/src --include=*.tsx

# 域 css 体量（§5.1；decl = 形如 `prop: value;` 的行）
for f in $(find apps/web/src -name '*.css' | sort); do
  printf "%-42s %5s行 %5s decl %4s rule\n" "${f#apps/web/src/}" \
    "$(wc -l < $f)" \
    "$(grep -cE '^[[:space:]]*[-a-zA-Z]+[[:space:]]*:.*;' $f)" \
    "$(grep -cE '^[^@/].*\{' $f)"
done

# 三闸（本册基线绿；本票未复跑，见下方复跑记录）
pnpm -r typecheck                       # TC_EXIT=0
rtk proxy pnpm exec biome ci .          # 0 error / 4 warnings / 25 infos（459 files）
# 全量 e2e（夹具构建单次；私有端口，跑前 lsof 查占用）
cd apps/web && E2E_PORT=8429 pnpm exec playwright test    # 472 passed (44.8s)
```

**复跑记录（XMON-20 @ `fa54bbad` + 本票改动）**：§7 的前三条取数命令全部复跑，读数即 §5.1 / §5.2 / §5.3 现表（域 css 一行一值、消费点 17 文件 / 18 处、裸控件 144 处 / 99 类 / 42 文件）。§5.1 的 `secondary.css` 行与 §5.2 / §5.3 的 `routes` 行按本票落地后的树刷新，其余行与 `fa54bbad` 逐值一致。

**复跑记录（XMON-17 @ `d37937f`）**：前两条取数命令已复跑，读数即当时 §5.1 / §5.2 的表（消费点 20 文件 / 22 处）。该票**三闸未复跑**——只改本册，按仓规「仅文档改动不跑」执行。

> e2e 与 lint 的取数纪律：`pnpm lint` 在 Bash 工具里会被 rtk hook 重写成假红，真值取 `rtk proxy pnpm exec biome ci .`；回环命令一律 `env -u http_proxy … NO_PROXY='*'` 前缀。