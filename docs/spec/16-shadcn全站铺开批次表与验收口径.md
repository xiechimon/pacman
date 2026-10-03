# 16 · shadcn/ui 全站铺开：批次表与验收口径

> 正典地位：本册收 #417（Map）的三件规划产物——**批次表**、**每片验收标准模板**、**与三张蓝图票的依赖序**——并把「已落地 / 前沿」两份实测钉在同一处，让 B3 / B4 的执行票不必回翻 issue 线程取口径。
> 决议来源：#421（批次表与验收口径，2026-09-29 用户全项 agree）、#422（第一片选定，2026-09-29）、#409（迁移面盘点，2026-09-29）；三张蓝图票 = #410（primitives 选型）/ #411（e2e 重钉口径）/ #412（token 管道）。
> 时效：§5 实测按 `origin/main @ fa54bbad`（2026-10-01，XMON-20 取数时点）取数，命令逐条在 §7；#409 的数字取于 `8c30775`，凡量纲不同或已漂移处均就地标注。
> 归批口径（XMON-17 定，XMON-20 补第二条边）：**每一处 `ui/` 原语消费点与每一处手搓控件都必须落在某一批里**。裁决 A2=B（父票 XMON-3）：`routes/` 与 `board/` 的残留按域拆回现有各批，不新开「routes 批」；域的判定用两条可复核的边——**挂哪个 shell**（`resources/shell.tsx` / `secondary/shell.tsx`）与**直引哪个域 css**。手搓控件（裸 `<button>` / `<input>` / `<select>` / `<textarea>`）的入账口径见 §6.5——它们是只认「有没有引 `ui/` 原语」的旧口径下唯一漏账的一类。
> 像素纪律：逐域迁移是**纯结构**改动、零视觉重钉（#411 政策 4 + #435 值正本并流后的口径）——per-face 规则仍是几何与配色的正本，组件换成 shadcn 件只换承载结构。

## 0. 结论一览

| 批 | 内容 | 状态（fa54bbad 实测） |
|---|---|---|
| **#414 试点片** | 看板 / 侧栏域（board / sidebar） | **原语面已收口**（#561：`board/notify-banner.tsx` 切 `components/ui` Button，原语消费点清零，见 §5.2 复跑记录）；裸控件 13 处未动（sidebar 9 等），见 §6.5 |
| **B1 弹层族片** | 19 个挂载点收编 shadcn Dialog | 已落地（#425，证据 `docs/verify/425/`） |
| **B2 热身片** | token-gate + machine-authorize + secondary 面 | **已落地**（#426 热身两面，证据 `docs/verify/426/`；Button/Input 收尾 XMON-13 / #534；secondary 面 XMON-20，证据 `docs/verify/xmon-20/`） |
| **第一片真域** | resources 五页（machines / providers / secrets / skills / mcp-servers） | 已落地（#423，证据 `docs/verify/423/`）；`routes/agent-detail.css` 为壳内邻页残留，见 §6.2 |
| **B3 弹层内容族** | overlays + overlay + detail/overlays + mention-picker | **未开工**，剩 3 个 tsx 消费点；裸控件 26 处 / 手搓类 22 |
| **B4 高三件** | chief / detail / pages | **未开工**，剩 11 个 tsx 消费点；裸控件 83 处 / 手搓类 59 |

闸口状态：三张蓝图票 **#410 / #411 / #412 全部 CLOSED**（#412 的执行票 #435 亦已闭），B1 亦已落地——#421 设的两道闸（「B2 起 blocked-by #412 + #411」与「B1 串行先行」）**均已打开**，B3 / B4 可直接开工。

## 1. 批次表

前四行是 #421 决议原文（数字为 #421 时点值），**`#414 试点片` 行与各行末尾的〔归批增量〕是 XMON-17 按 A2=B 补的**——补的目的是让每个 `ui/` 原语消费点都能指到一批。

| 批 | 内容 | 依据 | 并行 | 裸控件 |
|---|---|---|---|---|
| **#414 试点片**〔归批增量〕 | 看板 / 侧栏域（`board/`）的**原语全切**——#414 只迁了卡片族的 token 与工具类，原语消费点仍在；`routes/board-page.tsx` 同域（直引 `board/board.css`） | 该片是最早落地的一批，域已存在；残留不归批就永远没有验收范围 | 已在盘面，本批只做收口 | 13 |
| **B1 弹层族片** | 19 个挂载点（共享壳 14 消费点 + 2 手工壳）收编到 shadcn Dialog；壳类 `.dlg` ×67 是最热重钉单点 | 共享件先行，避免半迁移缝合线在每域重复 | **串行先行** | 0 |
| **B2 热身 + 第一片真域** | token-gate（30 decl）+ machine-authorize（41 decl）+ resources / secondary 之一（#422 裁 = resources）。〔归批增量〕**secondary 面**：`routes/` 下三个页面壳 + 同域页 `team-page.tsx` / `team-chart.tsx` / `account-page.tsx`（均挂 `secondary/shell.tsx`，样式经 `secondary.css` 注入；先例 = XMON-13 已按本行落地同域的 `routes/machine-authorize-page.tsx`） | 低 2 面小钉扎少；中 9 里两件 shell 单引、边界最整 | 批内错域可并行 | 30 |
| **B3 弹层内容族**（合并一片） | overlays（241）+ overlay（278）+ detail/overlays（404）+ mention-picker（223，先修悬空 token） | 三件同族（dlg-* 内容族）、跨域同源；合并免把 dialog-viewport 34 处钉扎改三遍 | 批内可并行 | 30 |
| **B4 高三件** | chief（464 / 49 处钉扎）+ detail（852 / 41K 单文件）+ pages（899 / prj-* 42 选择子） | 体量与钉扎密度决定必须等管道与重钉口径稳定 | 可并行，**最多两条车道**（避免同批断言冲突） | 102 |

「**裸控件**」列的口径 = 裸 `<button>` / `<input>` / `<select>` / `<textarea>` 四类之和（全域实测与逐文件账见 §6.5）。值按 **XMON-20 落地后**的树取：五批合计 175 处 + `ui/` 原语本体 2 处 = 全站 **177**（`fa54bba` 基线 188）；B3 行含 `detail/overlays.tsx`（按 §6.2 更正后的边归 B3）。B2 行由 41 降到 30 就是本票迁走的那 11 处。

`board/` / `sidebar` **不在「已从盘面消掉」之列**：实测仍有原语消费点（§5.2），归 `#414 试点片` 收口；`routes/` 八个 tsx 按上述两条边（挂哪个 shell / 直引哪个域 css）拆进 `#414 试点片` / `B2` / `第一片真域`，不单开一批。判定与证据见 §6.2。

**动效批（#656 / ADR 0009，织入 B3/B4，不单开全站波）**：全站进出场动效从 #73 的 motion.css 复刻 registry 收敛到 shadcn / tw-animate-css 默认（方向 B，用户 2026-10-02 拍板；显式撤销 #73 复刻纪律的**动效值面**，几何/配色像素纪律照旧）。机制 = `animate-in` / `animate-out` + Base UI `data-open` / `data-closed` 驱动——popup 自身即面板的（`.dlg` / alert-dialog 壳）用自带 `data-open:`；popup 是包装层、面板为其 fixed/absolute 子级的（FloatingShell 族 / 视口根面）在 popup 挂 `group`、子级面板走 `group-data-open:` / `group-data-closed:`（包装层带 transform 会把 fixed 子级的 containing block 拽走，故动效落子级不落壳）。`useOverlayMount` / `.overlay-mount` / `.anim-*` 手动保活随最后一个消费面退役。14 个消费 tsx 的逐域范围织入 B3/B4——每域结构迁移时顺手收该域动效；首个 PR 落 tw-animate-css 接线（`app.css` 的 `@import`，此前只入依赖未接线，`animate-in` 一族不生成）+ 本条目。验收沿本册 §2 模板 + #656 票 F4 动效断言清单：`anim-fade|anim-pop|anim-drawer|overlay-mount|useOverlayMount` 在 `apps/web/src/**/*.tsx` grep 清零、motion.css 收缩到 D4 保留面（spinner reel / hover-press / 全局 `:active` / reduced-motion 降级律）、D3 三条追认值（dialog `zoom-in-95`、dropdown/popover `duration-100` + slide -8px、挂载淡入归 tw 默认档）原样、保留面契约（segmented pill 150ms ease 逐字、spinner-live duration）全绿、e2e 断言改动 = 0。

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

### 5.2 仍消费 `ui/` 原语的文件（16 文件 / 17 处）

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
| 第一片已完成 | `resources/create-provider-dialog.tsx` | `ui/input` | `dialog-shell` |
| 第一片已完成 | `resources/create-secret-dialog.tsx` | `ui/input` | `dialog-shell` |

按原语汇总：`ui/button` ×13 · `ui/input` ×3 · `ui/chip` ×1。

与 c95ee5f 的差（36 文件 / 46 处 → 17 文件 / 18 处，−19 / −28）：

- **−21 处** = 三原语消费点，XMON-14（#535）落点后一次切完（avatar 12 / tag-chip 6 / kbd-hint 3）；
- **−3 处** = `overlay/token-gate.tsx`（button + input）与 `routes/machine-authorize-page.tsx`（button），XMON-13（#534）B2 收尾切完；
- **−4 处** = secondary 面三文件（`routes/api-keys-page.tsx` button、`routes/api-key-create-dialog.tsx` button + input、`routes/create-agent-dialog.tsx` input），XMON-20 切完——B2 · secondary 面就此清零；
- XMON-17 只把当时剩下的 20 个文件 / 22 处逐行归批（不改代码）；XMON-20 落地后刷新为 17 文件 / 18 处；#561 再迁走 `board/notify-banner.tsx` 一处（#414 试点片原语消费点清零）——今为 16 文件 / 17 处。
- `detail/overlays.tsx` 的归属批由 B4 更正为 **B3**：它的域 css 是 `detail/overlays.css`（§5.1 归 B3，弹层内容族），原表按目录挂在 B4 是错位。

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
| `agent-detail-page.tsx` (+ `agent-detail.css`) | 资源域（挂 `ResourceShell`，路由级直引 `agent-detail.css`） | 第一片真域（壳内邻页，css 为残留；§6.5 记 6 处裸控件） |
| `board-page.tsx` | 看板域（直引 `board/board.css`） | #414 试点片（§6.5 记 1 处裸控件） |
| `team-page.tsx` · `team-chart.tsx` · `account-page.tsx` | secondary | B2 · secondary 面（XMON-20 已落地；§5.2 记的「无原语消费点」只是原语账，裸控件账在 §6.5：本票迁走 11 处） |
| `machine-authorize-page.tsx` | machine-authorize | B2（XMON-13 / #534 已落地） |

`board/` 侧同律：`board/notify-banner.tsx` → **#414 试点片**。并更正票面旧记——**#414 迁的是卡片族的 token 与工具类，不是原语全切**；该尾巴已由 #561 收口（notify-banner 切 `components/ui` 的 Button，原语消费点清零），但 `sidebar` 的 9 处裸控件仍在（§6.5），按 §6.5 口径「控件全切」未完，`board/` / `sidebar` 仍不在「已从盘面消掉」之列。

两处判定不是缺件、是归属更正：`routes/agent-detail.css` 与 `routes/` 三个 secondary 页面壳各自都指到了批，`board/` 残留回到它自己的域。

### 6.3 B2 两面的 Button / Input 收尾（已落）

原状：`overlay/token-gate.tsx` 文件头写的保留理由原文是「components/ui 无 Input 件、shadcn Button 的 variant 表无 brand primary 档，换件即改填充色——故本片不动它们」。这两条**都已被后续批次推翻**：`components/ui/input` 随后入库（#423），`components/ui/button` 在 #423 新增了 `brand` 档（注释原文：「= 轨 A3 ui/Button primary 档等价迁移位」）。`routes/machine-authorize-page.tsx` 同形（`ui/button`，Card 已换）。

**裁决 A3 = A（B2 收尾）**，XMON-13（#534）落地：两面切到 `components/ui` 的 Button + Input（改动面 = `overlay/token-gate.tsx` 24 行 + `routes/machine-authorize-page.tsx` 21 行，证据 `docs/verify/xmon-13/`）。两者的域 css 更早一步退的役——`overlay/token-gate.css` 与 `routes/machine-authorize.css` 随 B2 热身片（#426 / #474，commit `aa1314b`）删除。§5.2 里这两行已清零。

### 6.4 #409 的重钉底账（已并入 main，数字停在 `8c30775`）

每片验收第 3 件要「重钉清单从 #409 附录 A 按 spec 摘」。该底账是 `docs/research/migration-surface.md`（附录 A/B：46+3 个 spec 的逐文件选择子全表），原先只在 `research/migration-surface` 分支（commit `def4b57`）。

**已解**：按父票裁决 A4=A，该文件已并入 `main`——正文逐字取自 `def4b57`，文件头记明来源与入仓理由。

**但摘清单前必须先重跑**：报告成文于 `8c30775`，并入时已算出与当前树的偏差（复核基线 `9a0613b`，晚 77 个 commit），并以「偏差标注」块**就地**插在报告各节。**附录 A 的 46 spec 全表不是现行清单**（现 e2e 66 个 spec / 61 个有类名钉扎，表内每行的处数与 distinct 都可能已变）；§3.1、§2.1、§4 同此。摘任何数字前先读对应节的标注块。

同类研究产物仍未在 `main`：`research/dialog-contract`（#418）、`research/baseui-dialog-contract-2`（#430 车道）等分支同形。

### 6.5 账本缺口：手搓控件不入账（XMON-20 补）

**问题**：§6.2 的归批口径只认**「有没有引 `ui/` 原语」**这一条。于是「一个 `ui/` 原语都不引、按钮全用裸 `<button>` + 一次性类名手搓」的文件，会被记成「**本次已无原语消费点**」——账面干净，但它恰恰是 shadcn 化最该收的面。

**实例**（用户在看 serve-live 起的 app 时点出来的）：§6.2 把 `team-page.tsx` / `team-chart.tsx` / `account-page.tsx` 三件记成「B2 · secondary 面（本次已无原语消费点）」，可实测：

| 文件 | 裸 `<button>` | `ui/` 原语 import |
|---|---|---|
| `apps/web/src/routes/team-page.tsx` | 3（顶部 grid / 组织图切换 ×2 + 创建 Agent ×1） | 0 |
| `apps/web/src/routes/team-chart.tsx` | 1 | 0 |
| `apps/web/src/routes/account-page.tsx` | 3 | 0 |
| `apps/web/src/routes/api-keys-page.tsx` | 1 | 1 |
| `apps/web/src/routes/api-key-create-dialog.tsx` | 2 | 2 |
| `apps/web/src/routes/create-agent-dialog.tsx` | 1 | 1 |

这三件的 7 个手搓按钮样式全在 `apps/web/src/secondary/secondary.css`（931 行）里手搓（`.team-layout-tabs` / `.team-layout-tab` / `.team-layout-tab--active`，含自己的媒体查询）。同一页里 `components/ui/button` 与手搓类名两套并存 —— 就是「按钮有两个样式」的来源。

**全域实测**。口径是**四类裸控件之和**——`<button>` / `<input>` / `<select>` / `<textarea>`：只数 `<button>` 会漏掉 33 处（`<input>` 22 · `<textarea>` 7 · `<select>` 4），而 `ui/input` 与 `components/ui/input` 两代并存正是同一类问题。下表值按 **XMON-20 落地后**的树取（括号内为 `fa54bba` 基线）：

| 域 | `<button>` | `<input>` | `<select>` | `<textarea>` | 合计 | 手搓类 | 消费 `components/ui/button` 的文件数 |
|---|---|---|---|---|---|---|---|
| pages | 35 | 5 | 3 | 0 | 43 | 31 | 0 |
| detail | 34 | 6 | 0 | 2 | 42 | 30 | 0 |
| chief | 17 | 1 | 0 | 2 | 20 | 14 | 0 |
| overlay | 15 | 3 | 0 | 1 | 19 | 17 | 1 |
| resources | 15 | 1 | 0 | 1 | 17 | 14 | 2 |
| routes | 18 → 7 → **1** | 5 | 1 | 1 | 25 → 14 → **8** | 17 → 7 → **4** | 2 → 8 → **9** |
| board | 12 | 0 | 0 | 0 | 12 | 0 | 3 |
| overlays | 8 | 0 | 0 | 0 | 8 | 5 | 0 |
| ui（原语本体） | 1 | 1 | 0 | 0 | 2 | 0 | — |
| **合计** | **155 → 144 → 138** | **22** | **4** | **7** | **188 → 177 → 171** | **128 → 118 → 115** | **10 → 16 → 17 个文件** |

**「手搓类」是 XMON-20 补的第五列**（口径 = 挂在这些裸控件的 `className` 上、且在 `apps/web/src` 任一 `.css` 里被定义成选择子的类名数，域内 distinct）。它才是「按钮有两个样式」的直接读数：一套来自 `components/ui/*`，一套来自域 css。全站 118 类里 `pages` / `detail` / `chief` 三域占 75 类，对应 B4 未开工。

**逐文件账**（同口径，只列含裸控件者；「手搓类」= 该文件内 distinct，列间不可相加）：

| 文件 | button | input | select | textarea | 合计 | 手搓类 | 归属批 |
|---|---|---|---|---|---|---|---|
| `pages/project-new-page.tsx` | 14 | 4 | 0 | 0 | 18 | 12 | B4 高三件 |
| `board/sidebar.tsx` | 9 | 0 | 0 | 0 | 9 | 0 | #414 试点片 |
| `pages/project-page.tsx` | 8 | 1 | 0 | 0 | 9 | 5 | B4 高三件 |
| `pages/schedules-page.tsx` | 6 | 0 | 3 | 0 | 9 | 7 | B4 高三件 |
| `detail/branch-dialog.tsx` | 6 | 2 | 0 | 0 | 8 | 4 | B4 高三件 |
| `detail/docpane.tsx` | 8 | 0 | 0 | 0 | 8 | 6 | B4 高三件 |
| `overlay/mention-picker.tsx` | 7 | 1 | 0 | 0 | 8 | 9 | B3 弹层内容族 |
| `chief/chief-drawer.tsx` | 6 | 0 | 0 | 1 | 7 | 5 | B4 高三件 |
| `detail/composer.tsx` | 5 | 1 | 0 | 1 | 7 | 5 | B4 高三件 |
| `resources/create-provider-dialog.tsx` | 6 | 1 | 0 | 0 | 7 | 6 | 第一片真域 |
| `routes/agent-detail-page.tsx` | 0 | 1 | 1 | 1 | 3 | 3 | 第一片真域（壳内邻页） |
| `overlay/more-menu.tsx` | 5 | 0 | 0 | 0 | 5 | 3 | B3 弹层内容族 |
| `overlay/new-task-dialog.tsx` | 3 | 1 | 0 | 1 | 5 | 4 | B3 弹层内容族 |
| `chief/chief-agent-dialog.tsx` | 3 | 1 | 0 | 0 | 4 | 4 | B4 高三件 |
| `detail/review-dialog.tsx` | 2 | 1 | 0 | 1 | 4 | 4 | B4 高三件 |
| `overlays/search-panel.tsx` | 4 | 0 | 0 | 0 | 4 | 1 | B3 弹层内容族 |
| `pages/dir-browser.tsx` | 4 | 0 | 0 | 0 | 4 | 4 | B4 高三件 |
| `resources/create-machine-dialog.tsx` | 4 | 0 | 0 | 0 | 4 | 2 | 第一片真域 |
| `routes/api-key-create-dialog.tsx` | 0 | 4 | 0 | 0 | 4 | 0 | B2 · secondary 面 |
| `chief/chief-model-select.tsx` | 3 | 0 | 0 | 0 | 3 | 2 | B4 高三件 |
| `chief/edit-charter-dialog.tsx` | 2 | 0 | 0 | 1 | 3 | 3 | B4 高三件 |
| `detail/overlays.tsx` | 3 | 0 | 0 | 0 | 3 | 3 | B3 弹层内容族 |
| `detail/stop-confirm-dialog.tsx` | 2 | 1 | 0 | 0 | 3 | 2 | B4 高三件 |
| `detail/transcript.tsx` | 3 | 0 | 0 | 0 | 3 | 4 | B4 高三件 |
| `board/repo-filter.tsx` | 2 | 0 | 0 | 0 | 2 | 0 | #414 试点片 |
| `chief/chief-settings.tsx` | 2 | 0 | 0 | 0 | 2 | 3 | B4 高三件 |
| `detail/accept-dialog.tsx` | 1 | 1 | 0 | 0 | 2 | 1 | B4 高三件 |
| `detail/dhead.tsx` | 2 | 0 | 0 | 0 | 2 | 2 | B4 高三件 |
| `detail/user-menu.tsx` | 2 | 0 | 0 | 0 | 2 | 0 | B4 高三件 |
| `overlays/plan-dropdown.tsx` | 2 | 0 | 0 | 0 | 2 | 2 | B3 弹层内容族 |
| `pages/github-issues-dialog.tsx` | 2 | 0 | 0 | 0 | 2 | 2 | B4 高三件 |
| `resources/create-secret-dialog.tsx` | 1 | 0 | 0 | 1 | 2 | 2 | 第一片真域 |
| `resources/skills-page.tsx` | 2 | 0 | 0 | 0 | 2 | 2 | 第一片真域 |
| `board/tag-filter.tsx` | 1 | 0 | 0 | 0 | 1 | 0 | #414 试点片 |
| `chief/chief-wake.tsx` | 1 | 0 | 0 | 0 | 1 | 0 | B4 高三件 |
| `overlay/delete-project-confirm.tsx` | 0 | 1 | 0 | 0 | 1 | 1 | B3 弹层内容族 |
| `overlays/chip-popover.tsx` | 1 | 0 | 0 | 0 | 1 | 1 | B3 弹层内容族 |
| `overlays/dismiss.tsx` | 1 | 0 | 0 | 0 | 1 | 1 | B3 弹层内容族 |
| `pages/shell.tsx` | 1 | 0 | 0 | 0 | 1 | 1 | B4 高三件 |
| `resources/machines-page.tsx` | 1 | 0 | 0 | 0 | 1 | 1 | 第一片真域 |
| `resources/shell.tsx` | 1 | 0 | 0 | 0 | 1 | 1 | 第一片真域 |
| `routes/board-page.tsx` | 1 | 0 | 0 | 0 | 1 | 1 | #414 试点片 |
| `ui/button.tsx` | 1 | 0 | 0 | 0 | 1 | 0 | 原语自身 |
| `ui/input.tsx` | 0 | 1 | 0 | 0 | 1 | 0 | 原语自身 |

`chief` / `detail` / `pages` / `overlays` 消费 shadcn `Button` 的文件数为 0，与 §0「B3 / B4 未开工」一致。`routes/` 18 处的逐文件分布（供归批对账，基线 `fa54bbad`）：`team-page` 3 · `account-page` 3 · `agent-detail-page` 3 · `agent-model-select` 3 · `api-key-create-dialog` 2 · `api-keys-page` 1 · `board-page` 1 · `create-agent-dialog` 1 · `team-chart` 1。B2 迁走 11 处、XMON-28 迁走 7 处，`routes/` 今余 `board-page` 1 处；其间 `agent-detail-page` 由 XMON-15（#536）加了 1 处，见下方复跑记录。

**口径修订（本行起生效）**：§6.2 的归批判据由**两条边**扩到**三条边**——第三条 = **手搓控件**（裸 `<button>` / `<input>` / `<select>` / `<textarea>` / 一次性类名控件）也构成消费点，同样必须指到某一批。逐文件表的「归属批」列即按此判据落，**45 个文件无一行「未点名」**（XMON-28 后 44 行，`routes/agent-model-select.tsx` 归零出表）。

**三行复核结论（XMON-20 迁移落地后核）**：`#414 试点片` / `B3` / `B4` 三行的**「原语消费点」计数不用改**（§5.2 的两条边照旧有效），但**验收范围要连带手搓控件**——按逐文件表（处数可直接相加，类数按上表域级 distinct 读）：B3 从此是「3 个原语消费点 **+ 30 处裸控件**」，B4 是「11 个原语消费点 **+ 102 处**」，`#414 试点片` 是「1 个原语消费点 **+ 13 处**」；B2 行余 26 处（resources 17 + 壳内邻页 9）+ secondary 残留 4 处。

**复跑记录（XMON-28 @ `38c945b9`，PR #547）**：`routes/agent-detail-page.tsx` 4 处 + `routes/agent-model-select.tsx` 3 处裸 `<button>` 收进 `components/ui` 的 `Button`（ghost），本册三张表按落地后的树刷新（`node scripts/count-raw-controls.mjs`）：域表 `routes` 行 = button **1** / 合计 **8** / 手搓类 **4** / 消费 `ui/button` 的文件数 **9**；全站合计 = **138** / **171** / **115** / **17 文件**；逐文件表删去已归零的 `routes/agent-model-select.tsx` 一行，`routes/agent-detail-page.tsx` 行改为 `0 | 1 | 1 | 1 | 3 | 3`。

上表箭头的**中间值 = XMON-20 @ 其复跑时点**，在其时点上正确；`routes` 行由中间值走到现值之间夹着 XMON-15（#536）——它在本册基线之后、XMON-20 复跑之后给 `agent-detail-page.tsx` 加了「进行中」行，即第 4 处裸 `<button>`（`routes` 因此由 7 变 8，全站由 177 变 178）。所以该行 `7 → 1` 的净差 6 **不是**迁移量：XMON-28 实际迁走的是 **7** 处（`agent-detail-page.tsx` 4 + `agent-model-select.tsx` 3），另 1 处由 XMON-15 带入。手搓类列未对 XMON-15 那个中间态单独取数，故只记两端。

按现值，B2 行余 **20** 处（resources 17 + 壳内邻页 3）+ secondary 残留 4 处 = **24** 处。§0 / §1 的批次表数字仍停在各行标注的时点（B2 行 30 处），未按本行同步——批次级重算不在本次改动范围内。

- **`#414 试点片` 的「本批只做收口」不再成立**：它的 13 处裸控件里 `board/sidebar.tsx` 独占 9 处（侧栏全部导航行），#414 当时只迁了卡片族的 token 与工具类——按新口径这是「原语全切 + 控件全切」两件事，不是一件事。
- **B4 是最大户且已可量化**：105 处裸控件 / 75 类，`pages/project-new-page.tsx` 一个文件 18 处（全域最大单点）；只按原语消费点开工会把这类文件整片漏掉。
- **B2 · secondary 面是本口径下第一个按新账收口的面**：它的三个页面壳在 §5.2 里记着「本次已无原语消费点」，靠本节的账才现形；XMON-20 迁走后该面只剩 `routes/api-key-create-dialog.tsx` 的 4 个权限位 `<input>`。
- **一处需人裁决的遗留**：`resources/create-*-dialog` 三件（13 处裸控件）在 #422 被划为**排除面**（壳归 B1、内容族归 B3），但 §5.2 把同三件的 `ui/input` 记在「第一片已完成」行下——同一批文件的控件账与原语账落在两行。本表照 #422 原判记在排除面，**是否要把 resources 侧手搓控件单列一行验收，留给父票裁**。

## 7. 取数命令

```sh
# 裸控件账本（§6.5）—— 每域一行 + 逐文件两表（四类口径 + 手搓类列），直接贴进本节
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

# 裸控件 census（§6.5）—— 四类之和，全站 188 处
for t in button input select textarea; do
  printf "%-10s %s\n" "<$t" "$(grep -rho "<$t" apps/web/src --include=*.tsx | wc -l)"
done
# 逐域分解（一域一行，末列 = 四类之和）
for d in apps/web/src/*/; do
  b=$(grep -rho '<button' "$d" --include=*.tsx | wc -l)
  i=$(grep -rho '<input' "$d" --include=*.tsx | wc -l)
  s=$(grep -rho '<select' "$d" --include=*.tsx | wc -l)
  t=$(grep -rho '<textarea' "$d" --include=*.tsx | wc -l)
  [ $((b+i+s+t)) -gt 0 ] && printf "%-22s btn=%-4s input=%-3s select=%-3s textarea=%-3s 合计=%s\n" \
    "$(basename $d)" "$b" "$i" "$s" "$t" "$((b+i+s+t))"
done
# 域名内逐文件（归批对账用；routes/ × routes/ 的 25 处就是这样拆出来的）
for f in apps/web/src/routes/*.tsx; do
  n=$(( $(grep -c '<button' "$f") + $(grep -c '<input' "$f") + $(grep -c '<select' "$f") + $(grep -c '<textarea' "$f") ))
  [ "$n" -gt 0 ] && printf "%-40s %s\n" "$(basename $f)" "$n"
done
# 消费 shadcn Button 的文件数
grep -rl 'components/ui/button' apps/web/src --include=*.tsx | wc -l

# 三闸（本册基线绿；本票未复跑，见下方复跑记录）
pnpm -r typecheck                       # TC_EXIT=0
rtk proxy pnpm exec biome ci .          # 0 error / 4 warnings / 25 infos（459 files）
# 全量 e2e（夹具构建单次；私有端口，跑前 lsof 查占用）
cd apps/web && E2E_PORT=8429 pnpm exec playwright test    # 472 passed (44.8s)
```

**复跑记录（XMON-20 @ `fa54bbad` + 本票改动）**：§7 的三条取数命令全部复跑。§6.5 的 census 按本票落地后的树刷新（四类合计 177 处，`fa54bba` 基线 188；差额 11 = 本票迁走的裸 `<button>`）；§5.1 / §5.2 刷新为「域 css 一行一值 + 消费点 17 文件 / 18 处」，其余行与 `fa54bbad` 逐值一致。

**复跑记录（XMON-17 @ `d37937f`）**：前两条取数命令已复跑，读数即当时 §5.1 / §5.2 的表（消费点 20 文件 / 22 处）。该票**三闸未复跑**——只改本册，按仓规「仅文档改动不跑」执行。

> e2e 与 lint 的取数纪律：`pnpm lint` 在 Bash 工具里会被 rtk hook 重写成假红，真值取 `rtk proxy pnpm exec biome ci .`；回环命令一律 `env -u http_proxy … NO_PROXY='*'` 前缀。