# XMON-100 · `/app/team` 页面 SVG 盘点（证据归档）

> 票面：XMON-100（父 XMON-96）。任务 = 盘点 `/app/team?runtime=claude-code` 页面全部 SVG：来源、截图出证，供用户挑选保留。**只盘不删**——删哪个由用户挑。
> 本目录（`docs/verify/XMON-100/`）= 全部证据（85 张 PNG + `manifest.json`），随 PR 提交；截图链用 `raw/<SHA>/` 永久链（私有仓 `raw.githubusercontent.com` 恒 404）。
>
> 实测坐标：HEAD `52ceac3`（main）。隔离栈 web `:5274` / api `:8792`、独立 `PACMAN_HOME`（verify-pacman 纪律，未碰 8787/5173 真栈）；fixture 场景 `?scenario=team-org-chart`（组织图）/ `?scenario=12`（网格）/ `?scenario=06`（模型服务、机器）。1440×900、DPR 2。证据生成脚本会话期一次性工具，未入仓。

## 一、总览：来源只有三类

| 来源族 | 目录 / 文件 | 管理方式 |
|---|---|---|
| **A. 生成图标集** | `apps/web/src/icons/`（69 个文件） | `scripts/generate-icons.mjs` 从 `docs/research/assets/r7/icons.json`（218 条）+ r6 补遗 + lucide-static 生成；文件头 `Do not edit` |
| **B. 业务文件内联手抄字形** | `apps/web/src/routes/team-chart.tsx:18/41/58` | 不在 icons/、无生成器管；文件注释自述「不属于 r7 图标清单……故留在此处而不入 icons/」 |
| **C. 官方品牌 mark** | `apps/web/src/components/brand-marks.tsx`（`PiMark` :20、`ClaudeMark` :44） | pi.dev / claude.ai 站点原路径抓取；注释明言不走 currentColor、按品牌原色着色 |

行号均为 HEAD `52ceac3` 实测。「属性」= SVG 标签 authored 值；「渲染」= 浏览器实测盒（DPR 2 下 1 属性 px = 2 截图像素）。

## 二、核心结论：总管 Agent 旁的小 SVG 是什么

**= 组织图根节点名字右侧的「皇冠」。**

- 字形本体：`team-chart.tsx:18` `CrownGlyph`——12×12、`viewBox 0 0 24 24`、描边 2.5 的内联手抄字形（注释自述「逐字抄自参考产品 chart 根节点」）。
- 外层 18px 靛蓝圆底：`secondary/secondary.css:300-319`（`.team-chart-crown`：`color:#4f46e5` + `rgb(99 102 241/0.1)` 底——**写死、不跟主题**）。
- 渲染位置：组织图根节点卡第一行，Agent 名字紧右侧。证据 `chart-18.png`（皇冠，属性 12×12 + 2.5 描边，fingerprint 与文件逐一比对确认）。
- **只在「组织图」布局存在**。网格布局的 Agent 卡上没有任何徽标（头像 + 三行字而已），对照 `page-team-grid-full.png` vs `page-team-chart-full.png`。用户看到它 = 当时页面停在组织图布局。
- 票面猜的两个候选（模型服务 / 路由）都**不是**它的来源：模型服务页两个 mark 属族 C（`brand-marks.tsx:20/44`），皇冠属族 B——不同源、不同文件、不同着色体系。
- 桥事实：`?runtime=claude-code` 在团队页**不改变任何 SVG 渲染**（第六节 A/B 实测：加参数前后页面 SVG outerHTML 逐字节相同，6938 B；DOM 差异仅 15 个侧栏 `<a>` 的 href 多带查询串，#121 链接随行的既有行为）。该参数是模型服务页切 runtime tab 写进 URL 后漂过来的。

## 三、着色体系四套并存（「整体不统一」的根因）

| 着色口径 | 谁在用 | 出处 |
|---|---|---|
| `currentColor`（跟主题） | 生成图标集（侧栏/头部/抽屉全部） | `icons/*` |
| 写死靛蓝 `#4f46e5` + 靛蓝 10% 底 | **皇冠**（全页唯一固定色 SVG） | `secondary.css:316-319` |
| 写死 `#52525b`（不跟主题） | `ChiefFab` 笑脸（右下角总管 FAB） | `icons/ChiefFab.tsx:12` |
| 品牌原色（有意为之） | pi 三色 / Claude 星芒 | `brand-marks.tsx` 头注 |

补充两条：`ChiefFab` 的 `#52525b` 深色主题下对比不足；团队页 fixture 总管已绑定，FAB 渲染的是头像而非该 SVG，live 无绑定机器上才可见（`chief-fab-icon.tsx:11-22` 二态切换）。

## 四、组织图布局清单（24 个可见 SVG）

### A. 组织图独有 · 族 B —— 3 个

| 渲染位置 | 组件 / 来源 | 属性 / 渲染 | 截图 |
|---|---|---|---|
| **总管 Agent 名右侧（票面指认处）** | `CrownGlyph` — `team-chart.tsx:18` | 12×12、描边 2.5 / 12×12 | `chart-18.png` |
| 每节点第二行·模型名左侧 | `ProviderGlyph` — `team-chart.tsx:41` | 12×12、实心 fill / 12×12 | `chart-19.png` |
| 虚线「创建 Agent」卡 | `PlusGlyph` — `team-chart.tsx:58` | 12×12、描边 2.5 / 12×12 | `chart-22.png` |

### B. 侧栏 · 族 A —— 12 个（两布局同）

由 `board/sidebar.tsx:28-45` 从 `icons/` 导入；图标 16px 档。

| 渲染位置 | 来源 | 截图 |
|---|---|---|
| 顶行右侧·收起侧边栏 | `icons/PanelLeftClose.tsx` | `chart-00.png` |
| 搜索行 | `icons/Search.tsx` | `chart-01.png` |
| 新任务行 | `icons/Plus.tsx`（16 默认，描边 2.5） | `chart-02.png` |
| 工作台行 | `icons/Kanban.tsx` | `chart-03.png` |
| 定时行 | `icons/Clock.tsx` | `chart-04.png` |
| 项目组头 | `icons/ChevronDown.tsx`（资源组头同字形） | `chart-05.png` |
| 技能行 | `icons/Puzzle.tsx` | `chart-08.png` |
| MCP 行 | `icons/Network.tsx` | `chart-09.png` |
| 密钥行 | `icons/Key.tsx` | `chart-10.png` |
| 机器行 | `icons/Server.tsx` | `chart-11.png` |
| 模型服务行 | `icons/Layers.tsx` | `chart-12.png` |
| 底部用户名右侧·用户菜单 | `icons/EllipsisVertical.tsx` | `chart-13.png` |

侧栏 12 项里搜索/新任务/新建项目是 `<button>`，其余是 `<a>`；截图编号跳过 06/07（该两号 = 同页组织图节点上的 SeededAvatar 头像——是 `<img>`，不是 SVG，故不入清单）。

### C. 头部与内容区 · 族 A —— 4 个（两布局同）

| 渲染位置 | 组件 / 来源 | 属性 / 渲染 | 截图 |
|---|---|---|---|
| 头部左·返回 | `icons/ChevronLeft.tsx`（`secondary/shell.tsx:15,57`） | 16/16 | `chart-14.png` |
| 头部中·团队名右侧 | `icons/ChevronDown.tsx`（`team-page.tsx:115`，12 尺寸） | 12/12 | `chart-15.png` |
| 右上·布局切换片「网格」 | `icons/Grid2x2.tsx`（`team-page.tsx` Tabs 内） | 属性 18×18 / **渲染 16×16**（被 tabs 底座压平） | `chart-16.png` |
| 右上·布局切换片「组织图」 | `icons/ChartNetwork.tsx`（同上） | 属性 14×14 / **渲染 16×16** | `chart-17.png` |

### D. 总管抽屉 · 族 A —— 5 个（两布局同；点右下角 FAB 张开时可见）

抽屉挂 `OverlayMount`（`overlays/dismiss.tsx:30`）；团队页总管已绑定时 FAB 显示头像（`chief-fab-icon.tsx:11`），点开抽屉出这些图标：

| 渲染位置 | 组件 / 来源 | 属性 / 渲染 | 截图 |
|---|---|---|---|
| 总管抽屉头部·主题切换钮 | `icons/ChiefHash.tsx` | 属性 13 / 渲染 13 | `chart-23.png` |
| 总管抽屉头部·新主题钮 | `icons/Plus.tsx`（18 传入） | 18/18 | `chart-25.png` |
| 总管抽屉头部·关闭钮 | `icons/X.tsx`（16 传入） | 16/16 | `chart-26.png` |
| 总管抽屉头部·模型槽位行 | `icons/ChiefPi.tsx` | 属性 12 / 渲染 12 | `chart-27.png` |
| 总管抽屉 composer·发送钮 | `icons/ArrowUp.tsx` | 16/16 | `chart-28.png` |

`ChiefGear`（18）也在头部三钮里，但 capture 去重后无独立截图（与 chart-25 同为 18px Plus 同框不同形，单件截图覆盖 Plus 与 X，Gear 见 `page-team-chart-full.png` 右侧抽屉）。

组织图合计：3（族 B）+ 12（侧栏）+ 4（头部/切换片）+ 5（抽屉）= **24**。

## 五、网格布局（`?scenario=12`）——20 个 + FAB 二态说明

网格布局 = 侧栏 12 + 头部 2 + 切换片 2 + 虚线卡加号 1 + 抽屉 5 = **22 个可见位置**，其中 20 个与组织图形态**同字形**（侧栏 12 + 头部 4 + 抽屉 5 相同，去重后 19 个共享 capture，见 `grid-00…grid-28` 系列与 chart 系列的 fingerprint 对齐）；**不同的一处**：

| 渲染位置 | 组件 / 来源 | 属性 / 渲染 | 截图 |
|---|---|---|---|
| 虚线「创建 Agent」卡 | `icons/PlusSmall.tsx`（`team-page.tsx:198`） | **属性 9×9、描边 3** / **渲染 12×12**（`secondary.css:456-458` `.team-create-icon svg` 强制 12px） | `grid-18.png` |

网格卡无徽标 SVG；总管 FAB 未绑定时显示 `icons/ChiefFab.tsx`（30.8、写死 `#52525b`），绑定时显示头像。团队页两个 fixture 场景里总管均已绑定（`fixtures.ts:1400-1406`），故本目录截图不含 ChiefFab 笑脸本体——上一任 Multica 评论的 `svg-19-chief-fab-DARK.png` 仍是最直观的深色对比证据（未随本目录重截）。

## 六、票面点名的「模型服务」与「路由」

**模型服务页**（`/app/resources/providers?scenario=06`，对照整页 `page-providers-full.png`）：runtime 切换片两 tab 前置品牌 mark（`resources/providers-page.tsx:148-160` 注释与 `:47-49` 映射表；类 `.res-tab-mark`）：

| 位置 | 组件 / 来源 | 截图 |
|---|---|---|
| pi tab | `brand-marks.tsx:20` `PiMark`（pi.dev logo 原路径，三色块） | `prov-16.png` |
| Claude Code tab | `brand-marks.tsx:44` `ClaudeMark`（claude.ai favicon 原路径，星芒） | `prov-17.png` |

同页 topbar「新建」钮还有一枚 13px `Plus`（`resources/shell.tsx:52,57`，`prov-15.png`）——上一任评论没提这处。

**机器页**（`/app/resources/machines?scenario=06`，整页 `page-machines-full.png`）：每台本机行的 runtime 位同一对 mark（`machines-page.tsx:45-47,128-141`，`.mach-mark`，启用实色/未启用 35% 透明）：`mach-16/17.png`。另有 `Monitor` 显示 tile（`mach-15.png`）与 14px `ServerThin`（`machines-page.tsx:166`）。

**「路由」：本仓不存在任何叫「路由」的 UI 标签/页面/导航行**。全仓 grep「路由」只命中散文注释与 docs 里「SPA 路由」用法。上一任按最接近候选出了模型服务/机器页两对 mark 的图；本清单把两页全部 SVG 列齐（含 topbar Plus、Monitor、ServerThin），用户按图指认即可。

## 七、`?runtime=claude-code` A/B 实测

同一组织图 URL 有无该参数，Playwright 取整页 DOM + 全部 SVG outerHTML 对比（隔离栈，`?scenario=team-org-chart`）：

| 口径 | 不带参数 | 带参数 |
|---|---|---|
| SVG outerHTML 逐字节 | 6938 B，hash `9683ee0f` | **6938 B，hash `9683ee0f`（相同）** |
| 整页 DOM | 337204 B | 337564 B（差 360 B = 15 个侧栏 `<a>` href 各多带查询串，#121 既有行为） |

结论：参数对团队页渲染**零影响**；它是模型服务页 runtime tabs（`providers-page.tsx:148-152` 受控 Tabs 写 URL）留下的行踪。团队页只认 `?scenario=`，且 `?scenario=` 仅 dev/fixture 构建生效（`scenario.ts:92-97` gate），生产构建折叠掉。

## 八、不统一之处逐条（给用户挑选的判断材料）

1. **三个例外字形住在业务文件里**（族 B 全体）：皇冠/服务商徽标/加号内联在 `team-chart.tsx`，同页其余 SVG 全部来自生成集 `icons/`；写法虽同为 24 viewBox + 描边，但无生成器管、改一处不带动另一处。
2. **着色四套并存**（第三节表）：`currentColor` / 皇冠写死靛蓝 / ChiefFab 写死 `#52525b` / 品牌原色。
3. **同一个「总管」概念，至少四个字形**：组织图皇冠（`team-chart.tsx:18`）／FAB 笑脸（`icons/ChiefFab.tsx`）／抽屉主题钮的 13px `ChiefHash`（`chief-drawer.tsx:158`）／抽屉头 24px `ChiefFaceDashed`（`chief-drawer.tsx:337`）。四处出处、画法、尺寸都不同。
4. **同一个动作「创建 Agent」，两个加号**：网格 = `PlusSmall`（属性 9×9、描边 3），组织图 = `PlusGlyph`（12×12、描边 2.5）。同页同动作、两个字形两档描边；且 PlusSmall 属性 9px 被 `.team-create-icon svg` 强制渲染 12px——authored 9 渲染 12 的错位。
5. **描边宽度不齐**：皇冠/PlusGlyph 2.5 vs 侧栏族 2 vs PlusSmall 3。
6. **尺寸档位散**：本页并存属性 9 / 12 / 13 / 16 / 18 / 30.8 六档；12px 档（皇冠、加号）是描边最易糊的尺寸，皇冠在 12px 下已读不出「皇冠」形。
7. **布局切换片两个图标内在尺寸不一致**：`Grid2x2` 属性 18 / `ChartNetwork` 属性 14，渲染都被压到 16×16——authored 与渲染脱节（XMON-103 迁到分段控制器正本时带入的形态）。

## 九、上一任评论（Multica）结论的复核结果

| 上一任（对 `ccb89e5e`） | 本轮（对 `52ceac3`） |
|---|---|
| 组织图 29 / 网格 20 个 SVG | 组织图 24 / 网格 22 可见位置（口径差：上一任把「新任务行 + 新建项目行」两个 Plus 分开计数、把抽屉 5 个并入总数 29，且 grid 无徽标只数了 20；两轮 fingerprint 逐一比对，**图形集合一致**） |
| 皇冠 = `team-chart.tsx:18` + `secondary.css:356` | 字形同，CSS 现在在 `:300-319`（XMON-104 #587 搬过 secondary.css 行号） |
| 着色三套 | 现为四套口径（`brand-marks` 的品牌原色族单列，上一任也单独描述过；口径划分不同，事实一致） |
| `?runtime=claude-code` 不影响团队页 | **A/B 实测复核成立**（第七节） |

## 十、边界与自检

- 只盘不删：本 PR **仅含 `docs/verify/XMON-100/` 证据与本文档**，无任何产品代码改动；Multica 全程未写（不改状态/不改正文/不附评论）。
- 截图 = 隔离栈 + fixture 场景（成员名单与用户真数据不同，图标集合一致）；1440×900、DPR 2。
- capture 按「attrs + 全部 shape 几何」fingerprint 去重；编号跳号 = 去重或非 SVG 元素（头像 img）。
- 清单只覆盖**可见** SVG；生产构建里 `?scenario=` 折叠（`scenario.ts:92-97`），`?runtime=` 影响面见第七节。
- 未重截 `ChiefFab` 笑脸本体（fixture 总管已绑定）；需要时对无绑定 live 栈单独出图。
- 证据脚本会话期一次性工具未入仓；`manifest.json` 含每张截图的 domPath + attrs + shape 几何，可独立复核「截图 ↔ 代码」对位。

## 附录 · capture 全表（81 项，与 `manifest.json` 一一对应）

页面：chart = `/app/team?scenario=team-org-chart`（组织图），grid = `?scenario=12`，prov = `/app/resources/providers?scenario=06`，mach = `/app/resources/machines?scenario=06`。「渲染」为浏览器实测盒。

| 文件 | 归属 | DOM 路径（截断） | 渲染 |
|---|---|---|---|
| `chart-00.png` | 侧栏·收起侧边栏 PanelLeftClose | #root > div.secondary-shell > aside.board-sidebar > div.si | 14×14 |
| `chart-01.png` | 侧栏·搜索 Search | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `chart-02.png` | 侧栏·新任务 Plus | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `chart-03.png` | 侧栏·工作台 Kanban | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `chart-04.png` | 侧栏·定时 Clock | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `chart-05.png` | 侧栏·项目组头 ChevronDown | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `chart-08.png` | 侧栏·技能 Puzzle | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `chart-09.png` | 侧栏·MCP Network | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `chart-10.png` | 侧栏·密钥 Key | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `chart-11.png` | 侧栏·机器 Server | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `chart-12.png` | 侧栏·模型服务 Layers | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `chart-13.png` | 侧栏·用户菜单 EllipsisVertical | #root > div.secondary-shell > aside.board-sidebar > button | 16×16 |
| `chart-14.png` | 头部·返回 ChevronLeft | div.secondary-shell > div.secondary-main > div.secondary-m | 16×16 |
| `chart-15.png` | 头部·团队 ChevronDown(12) | div.secondary-shell > div.secondary-main > div.secondary-m | 12×12 |
| `chart-16.png` | 切换片·Grid2x2 | #base-ui-_r_3_ > svg | 16×16 |
| `chart-17.png` | 切换片·ChartNetwork | #base-ui-_r_4_ > svg | 16×16 |
| `chart-18.png` | 组织图·皇冠 CrownGlyph | div.team-chart > div.team-chart-node > span.team-chart-tex | 12×12 |
| `chart-19.png` | 组织图·服务商徽标 ProviderGlyph | div.team-chart > div.team-chart-node > span.team-chart-tex | 12×12 |
| `chart-22.png` | 组织图·创建加号 PlusGlyph | div.team-chart > div.team-chart-children > div.team-chart- | 12×12 |
| `chart-23.png` | 抽屉·主题钮 ChiefHash | div.overlay-mount > aside.chief-drawer > header.chief-head | 13×13 |
| `chart-25.png` | 抽屉·新主题 Plus(18) | aside.chief-drawer > header.chief-head > div.chief-head-ro | 18×18 |
| `chart-26.png` | 抽屉·关闭 X | aside.chief-drawer > header.chief-head > div.chief-head-ro | 16×16 |
| `chart-27.png` | 抽屉·模型槽 ChiefPi | div.secondary-main > div.overlay-mount > aside.chief-drawe | 12×12 |
| `chart-28.png` | 抽屉·发送 ArrowUp | div.overlay-mount > aside.chief-drawer > div.chief-compose | 16×16 |
| `grid-00.png` | 侧栏·收起侧边栏 PanelLeftClose | #root > div.secondary-shell > aside.board-sidebar > div.si | 14×14 |
| `grid-01.png` | 侧栏·搜索 Search | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `grid-02.png` | 侧栏·新任务 Plus | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `grid-03.png` | 侧栏·工作台 Kanban | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `grid-04.png` | 侧栏·定时 Clock | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `grid-05.png` | 侧栏·项目组头 ChevronDown | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `grid-08.png` | 侧栏·技能 Puzzle | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `grid-09.png` | 侧栏·MCP Network | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `grid-10.png` | 侧栏·密钥 Key | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `grid-11.png` | 侧栏·机器 Server | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `grid-12.png` | 侧栏·模型服务 Layers | div.secondary-shell > aside.board-sidebar > nav.sidebar-na | 16×16 |
| `grid-13.png` | 侧栏·用户菜单 EllipsisVertical | #root > div.secondary-shell > aside.board-sidebar > button | 16×16 |
| `grid-14.png` | 头部·返回 ChevronLeft | div.secondary-shell > div.secondary-main > div.secondary-m | 16×16 |
| `grid-15.png` | 头部·团队 ChevronDown(12) | div.secondary-shell > div.secondary-main > div.secondary-m | 12×12 |
| `grid-16.png` | 切换片·Grid2x2 | #base-ui-_r_3_ > svg | 16×16 |
| `grid-17.png` | 切换片·ChartNetwork | #base-ui-_r_4_ > svg | 16×16 |
| `grid-18.png` | 网格·创建加号 PlusSmall | div.secondary-body > div.secondary-col > div.team-grid > b | 12×12 |
| `grid-19.png` | 抽屉·主题钮 ChiefHash | div.overlay-mount > aside.chief-drawer > header.chief-head | 13×13 |
| `grid-21.png` | 抽屉·新主题 Plus(18) | aside.chief-drawer > header.chief-head > div.chief-head-ro | 18×18 |
| `grid-22.png` | 抽屉·关闭 X | aside.chief-drawer > header.chief-head > div.chief-head-ro | 16×16 |
| `grid-23.png` | 抽屉·模型槽 ChiefPi | div.secondary-main > div.overlay-mount > aside.chief-drawe | 12×12 |
| `grid-24.png` | 抽屉·发送 ArrowUp | div.overlay-mount > aside.chief-drawer > div.chief-compose | 16×16 |
| `mach-00.png` | 侧栏·收起侧边栏 PanelLeftClose | #root > div.res-shell > aside.board-sidebar > div.sidebar- | 14×14 |
| `mach-01.png` | 侧栏·搜索 Search | div.res-shell > aside.board-sidebar > nav.sidebar-nav > bu | 16×16 |
| `mach-02.png` | 侧栏·新任务 Plus | div.res-shell > aside.board-sidebar > nav.sidebar-nav > bu | 16×16 |
| `mach-03.png` | 侧栏·工作台 Kanban | div.res-shell > aside.board-sidebar > nav.sidebar-nav > a. | 16×16 |
| `mach-04.png` | 侧栏·定时 Clock | div.res-shell > aside.board-sidebar > nav.sidebar-nav > a. | 16×16 |
| `mach-05.png` | 侧栏·项目组头 ChevronDown | div.res-shell > aside.board-sidebar > nav.sidebar-nav > bu | 16×16 |
| `mach-08.png` | 侧栏·技能 Puzzle | div.res-shell > aside.board-sidebar > nav.sidebar-nav > a. | 16×16 |
| `mach-09.png` | 侧栏·MCP Network | div.res-shell > aside.board-sidebar > nav.sidebar-nav > a. | 16×16 |
| `mach-10.png` | 侧栏·密钥 Key | div.res-shell > aside.board-sidebar > nav.sidebar-nav > a. | 16×16 |
| `mach-11.png` | 侧栏·机器 Server | div.res-shell > aside.board-sidebar > nav.sidebar-nav > a. | 16×16 |
| `mach-12.png` | 侧栏·模型服务 Layers | div.res-shell > aside.board-sidebar > nav.sidebar-nav > a. | 16×16 |
| `mach-13.png` | 侧栏·用户菜单 EllipsisVertical | #root > div.res-shell > aside.board-sidebar > button.sideb | 16×16 |
| `mach-14.png` | topbar·返回 ChevronLeft | div.res-shell > div.res-main > div.res-main-col > header.r | 16×16 |
| `mach-15.png` | 机器行·Monitor tile | div.res-body > div.res-col > div.group/card > div.res-grow | 16×16 |
| `mach-16.png` | 机器行·pi mark | div.res-col > div.group/card > div.res-grow > span.mach-ru | 16×16 |
| `mach-17.png` | 机器行·Claude mark | div.res-col > div.group/card > div.res-grow > span.mach-ru | 16×16 |
| `mach-18.png` | 机器页·添加机器钮 ServerThin(14) | div.res-main > div.res-main-col > div.res-body > div.res-c | 14×14 |
| `mach-19.png` | 机器页·总管 FAB（已绑定→头像） | #root > div.res-shell > div.res-main > button.group/button | 31×31 |
| `prov-00.png` | 侧栏·收起侧边栏 PanelLeftClose | #root > div.res-shell > aside.board-sidebar > div.sidebar- | 14×14 |
| `prov-01.png` | 侧栏·搜索 Search | div.res-shell > aside.board-sidebar > nav.sidebar-nav > bu | 16×16 |
| `prov-02.png` | 侧栏·新任务 Plus | div.res-shell > aside.board-sidebar > nav.sidebar-nav > bu | 16×16 |
| `prov-03.png` | 侧栏·工作台 Kanban | div.res-shell > aside.board-sidebar > nav.sidebar-nav > a. | 16×16 |
| `prov-04.png` | 侧栏·定时 Clock | div.res-shell > aside.board-sidebar > nav.sidebar-nav > a. | 16×16 |
| `prov-05.png` | 侧栏·项目组头 ChevronDown | div.res-shell > aside.board-sidebar > nav.sidebar-nav > bu | 16×16 |
| `prov-08.png` | 侧栏·技能 Puzzle | div.res-shell > aside.board-sidebar > nav.sidebar-nav > a. | 16×16 |
| `prov-09.png` | 侧栏·MCP Network | div.res-shell > aside.board-sidebar > nav.sidebar-nav > a. | 16×16 |
| `prov-10.png` | 侧栏·密钥 Key | div.res-shell > aside.board-sidebar > nav.sidebar-nav > a. | 16×16 |
| `prov-11.png` | 侧栏·机器 Server | div.res-shell > aside.board-sidebar > nav.sidebar-nav > a. | 16×16 |
| `prov-12.png` | 侧栏·模型服务 Layers | div.res-shell > aside.board-sidebar > nav.sidebar-nav > a. | 16×16 |
| `prov-13.png` | 侧栏·用户菜单 EllipsisVertical | #root > div.res-shell > aside.board-sidebar > button.sideb | 16×16 |
| `prov-14.png` | topbar·返回 ChevronLeft | div.res-shell > div.res-main > div.res-main-col > header.r | 16×16 |
| `prov-15.png` | topbar·新建 Plus(13) | div.res-shell > div.res-main > div.res-main-col > header.r | 13×13 |
| `prov-16.png` | 模型服务·pi mark | #base-ui-_r_3_ > svg.res-tab-mark | 16×16 |
| `prov-17.png` | 模型服务·Claude mark | #base-ui-_r_4_ > svg.res-tab-mark | 16×16 |
| `prov-18.png` | 模型服务页·总管 FAB（已绑定→头像） | #root > div.res-shell > div.res-main > button.group/button | 31×31 |
