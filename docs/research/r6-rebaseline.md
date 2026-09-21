# R6 · 基线重拍（站点漂移第三数据点）

> 目的：todos.dev 再次更新（r2→r5→r5b 三天内已漂移三次），为 #42 像素对拍重立基线——全量重拍两屏相关状态 + 刷新图标 dump，并逐区 diff 出「这次到底变了什么」。
> 素材：Ego 浏览器 TaskSpace「todos.dev 复刻盘点」，free 档已登录账号（Xmon Dai / xiechimon@qq.com / 团队 Xmon Dai's team `BoZYfvqKSGanlxsXVbXSa`）。
> 盘点时间：2026-09-21（截图 11:07–11:59 由前一轮 agent 完成；icons dump 与 DOM 复核 12:10–12:40 由本轮补齐，探针 `#8` 12:18 创建、12:30 前后删除）。
> 票：#50（map #34 子票）。素材落 `docs/research/assets/r6/`。方法基线：r5（`r5-icons.md`）+ r5b §0.3 双基线（`r5b-lifecycle-states.md`）。
> 前置事实（API 一手）：机器 `xmonsMac-3574.local`（id `TlZ2sSD4EJCxjNJqVhdo_`）`isOnline: true`、`buildEnabled: true`、cli 0.1.52（与 r5b 同值）。

## 0. 捕获清单（capture manifest）

沿用 r5b §0.3 双基线：

| 项 | 实测值 | 说明 |
|---|---|---|
| DOM 基线 | CSS **1422×800** | CDP `Emulation.setDeviceMetricsOverride {1564×880@2.2}`，本轮 `innerWidth/innerHeight` 复测生效 |
| devicePixelRatio | 2.2 | 屏幕 2× × tab 缩放 110% |
| 截图面 | **1293×727 px**（42 张） | = 窗口内容面 1:1 CSS px 位图（r5b §0.2：右缘 ≈130 CSS px 物理不可拍） |
| 例外 | `40-待确认-chat视图-fit1292.png` = **1175×661** | 1175×1.1=1292.5、661×1.1=727.1，即窗口收窄到 CSS 1292×727 使全 viewport 落进可拍面（r5b §0.3 第二配方）[推断：目的即文件名 fit1292] |
| 主题 | light 为主；`02` 为 dark | |
| 语言 | zh（`tds.locale=zh`） | |

## 1. 截图清单（`docs/research/assets/r6/`，43 张 + icons.json）

| 文件 | 状态/路由 | 备注 |
|---|---|---|
| `01-board-light.png` | 看板 light | r3 遗留 #1 执行中·`回复` 钮、#2 已完成 |
| `02-board-dark.png` | 看板 dark | |
| `03-board-sidebar-collapsed-light.png` | 侧栏收起 rail | |
| `04-新建任务抽屉-light.png` | 新建任务 dialog | 现为居中 dialog（§3.2） |
| `05-搜索面板-light.png` | ⌘K 搜索面板 | |
| `06`–`10` | resources machines/providers/skills/mcp-servers/secrets | 路由级 |
| `11-schedules.png` / `12-team.png` / `13-account.png` | 定时/团队/帐号 | 路由级 |
| `14-新建任务-已填标题-light.png` | 抽屉已填探针标题 | |
| `15/15b/15c-开始任务弹层-*.png` | 开始任务弹层 | 未指派 / agent 选择 / 选 Agent |
| `16-规划中-streaming-light.png` | 规划中 streaming | |
| `17-待确认-chat视图-light.png` | 待确认 chat 视图 | |
| `18-待确认-更多菜单-light.png` | 待确认 `更多` 菜单 | |
| `19-状态芯片弹层-待确认-light.png` | 状态芯片弹层 | |
| `20-方案类型下拉-light.png` | `方案▾` 下拉 | |
| `21-待确认-看板卡片-light.png` | 待确认列卡片 | |
| `22-board-fresh探针2-light.png` | 看板 fresh 探针卡 | |
| `23-detail-fresh-light.png` | 全页详情 fresh | |
| `24-fresh-更多菜单-light.png` | fresh `更多` 菜单 | 本轮 DOM 复测 4 项同 r5b |
| `25-删除确认弹窗-light.png` | 删除确认 | 本轮复测文案不变 |
| `26-执行中-streaming-light.png` | 执行中 streaming | |
| `27/27b-审核-diff*.png` | 审核 diff 分栏/展开 | |
| `28-执行transcript-工具行展开-light.png` | 工具行展开 | |
| `29-状态芯片弹层-审核-light.png` | 芯片弹层（审核） | |
| `30-Token用量弹层-light.png` | Token 用量弹层 | |
| `31-分支与PR弹层-light.png` | 分支与 PR 弹层 | |
| `32-运行历史弹层-light.png` | 运行历史弹层 | |
| `33-待验收-看板卡片-完成钮-light.png` | 待验收列卡片 `完成` 钮 | |
| `34-验收确认弹层-light.png` | 验收确认弹层 | |
| `35-完成态-看板-light.png` / `36-完成态-详情-light.png` | 完成态 | |
| `37-用户菜单-light.png` | 用户菜单 | 本轮 DOM 复测（§3.3） |
| `38-r3遗留卡-详情审核-light.png` | r3 #1 详情（审核） | 本轮 icons dump 同 surface |
| `39-待确认-AI审核钮-light.png` | 待确认 | **文件名所述「AI审核钮」本轮 DOM 未复证**（§4.4） |
| `40-待确认-chat视图-fit1292.png` | 待确认 chat | 1292 窗宽全 surface 版 |

## 2. 图标 dump（`assets/r6/icons.json`）

方法同 r5 §4（`querySelectorAll('svg')` → outerHTML scope 内去重；context = 最近祖先 `[aria-label]` → `button`/`[role=button]` 文本 → 邻近文本 ≤4 hop；`w`/`h` = `getBoundingClientRect` CSS px；字段 `{route, context, w, h, svg, count, contexts}`）。

- 规模：**15 个 scope、383 条 entries、83 个唯一 markup**；41 个 markup 跨 ≥2 scope 复用。全部 `viewBox="0 0 24 24"`；345/383 条依赖 `currentColor`；5 条 `0×0` 隐藏模板节点。
- scope 比 r5 少 3 个：dark 两个 scope 不重复（r5 §4 已证主题无关，35/35 dark markup 与 light 全同），fresh/审核面板改为全页详情 surface。
- scope 一览（entries 数）：board:light 22 · rail:侧栏收起 20 · 新建任务抽屉 28 · 用户菜单 22 · 搜索面板(⌘K) 27 · detail:fresh 34 · ▾任务更多(fresh) 38 · detail:审核(只读) 42 · machines 19 · providers 19 · skills 21 · mcp-servers 17 · secrets 19 · schedules 19 · team 19 · account 17。

### 2.1 r6 vs r5 图标 diff

r5 = 449 entries / 93 唯一 markup → r6 = 383 entries / 83 唯一：**共同 62、新增 21、移除 31**。

- **侧栏导航图标全部重绘**：同一 aria 上下文（`看板`/`定时`/`搜索`/`技能`/`MCP`/`密钥`/`机器`/`模型服务`）markup 全换，且渲染尺寸从 11×11（展开态）/ 10×10、14×14（rail）统一变为 **16×16**（展开态与 rail 同尺寸）。搜索面板内导航图标 13×13 → 16×16。`文档`（详情 tab 图标）亦重绘（14×14）。
- 移除的 31 个 = 旧导航图标集（11×11/13×13/10×10/14×14）+ 已下线 overlay 控件 `全屏 · F`（r5b §3.1 已判该 surface 下线）。
- 新增上下文：`项目`（aria `展开项目`，chevron 16×16，项目分组折叠钮）、`收起资源`（资源分组折叠钮）。
- 未变：`收起/展开侧边栏`、`看板指南`、`总管`（30.8×30.8）、`发送`/composer 工具条、状态点类等 markup 与 r5 逐字节一致。

## 3. r6 vs r5b/r5 更新点清单（本次到底变了什么）

### 3.1 侧栏导航重构 [DOM 实测]

- r5 一级导航：`看板 / 定时 / 团队 / 技能 / MCP / 密钥 / 机器 / 模型服务 / 帐号`。
- r6 一级导航：`搜索⌘K / 看板 / 定时 / 项目（可折叠：新建项目 + 项目列表）/ 资源（可折叠父组：技能 / MCP / 密钥 / 机器 / 模型服务）/ 安装 App / Xmon Dai`。
- `团队` 移出一级导航（`/app/team` 路由仍在，搜索面板可达）；`帐号` 移入用户菜单（§3.3）。
- 侧栏宽 240 不变；rail 宽 40 不变（r5 §2.8 结论复证）。

### 3.2 新建任务：抽屉 → 居中 dialog，按钮组变化 [DOM 实测]

- 容器实测 **672×480 居中**（x=374.9=(1422−672)/2, y=160），role 为 `dialog`；不再是右贴抽屉。
- 底部按钮：r5 `保存任务` / r5b `保存` → r6 **`保存` + `保存并开始`**（新增直接进开始流的按钮）。
- 描述字段带模板文本：`我想要的结果：/ 现在的情况：/ 需要保留或避免：/ 我会这样确认完成：/ 我希望收到：`。
- 标题 placeholder `需要做什么？`；项目选择器在 dialog 头部（默认 `r3-lifecycle`）。

### 3.3 用户菜单重构 [DOM 实测]

r6 菜单项：`外观（浅色/深色）/ 帐号 / API 密钥 / MCP / 反馈 / 新功能 / 快捷键`。`帐号` 由此进入；r5 的一级导航 `帐号` 消失。

### 3.4 详情 header：返回钮纯图标化 [DOM 实测]

header 首枚 = 28×28 纯图标钮（chevron-left 16×16，`polyline 15 18 9 12 15 6`，无 aria-label，[推断] = 返回）；r5b §3.2 记为 `返回`（形态未录）。其余 header 集与 r5b 一致（§4.1）。

### 3.5 不变项（几何/文案零漂移，DOM 复测）

- 看板：列宽 292、列头 x=284.9/576.9/868.9/1160.9/1452.9/1744.9（pitch 292，与 r5b @1152 的 285/577/869… 同），scrollWidth 1772 / clientWidth 1182@1422。
- 顶栏：`+ 任务` 文本钮 x≈1343、`看板指南` 28×28 x=1381.8；标题居中公式见 §4.2。
- 详情 header 图标组：`更多` 28×28 x=1226.6 · `分支与 PR` 27×27 x=1260.6 · `Token 用量` 27×27 x=1293.5 · `运行历史` 27×27 x=1326.5 · 主按钮 50.3×28 x=1359.5（indigo-600 `rgb(79,70,229)`、radius 6px、padding 6px 12px）——三态（fresh/待确认/审核/已完成）逐一复测同位同尺寸。
- tab 组 `文档 / 聊天` 68×28（钮 32×24），x=796.9 居中（与 r5b 同）。
- 看板卡片主按钮 42.3×25.8 radius 6px（`回复` 实测）；composer 盒 668.8@1422、右缘距窗 16.2、chat 列右贴（gap 0.2）；`发送` 32×32 radius 8px、空输入底 `rgb(232,226,217)`；placeholder `请求修改…`（审核态复测）。
- 删除确认弹窗文案 `确定删除该任务？此操作不可撤销。` + `取消`/`删除` 不变。
- fresh `更多` 菜单 = `完成 / 复制链接 / 关闭 / 删除`（与 r5b 待确认菜单同 4 项）。

## 4. 开放项复核

1. **详情宽随视口**：内容区 x=240 w=1181.8 @1422（= viewport − 240 侧栏）；chat 列右贴、composer 盒 668.8 定宽右缘距 16.2——与 r5b §4 完全一致，本轮零漂移。
2. **顶栏标题居中公式**：`看板` 标题 x=816.6 w=28.6 → 中心 830.9 = (240 + 1422)/2 = **内容区中心**（非 viewport 中心 711）。详情 tab 组中心同为此值（796.9+68/2=830.9）。公式闭合：**居中基准 = 侧栏右缘起的内容区**。
3. **chip 词表**：列名 `待开始/规划中/待确认/执行中/待验收/已完成`；详情芯片 `待处理`(fresh·本轮探针) / `规划中`(本轮实测) / `确认`(待确认·本轮实测) / `审核`(#1 只读) / `已完成`(#2 只读)。与 r5b §3.5 完全一致，未再变。
4. **主按钮文案**：fresh header=`开始`、待确认=`确认`、审核=`完成`、已完成=`重开`、r3 遗留卡=`回复`——全部 DOM 复测，与 r5b §3.3 一致；全 DOM 无 `确认方案` 字样（r5b 更正确认仍成立）。**素材 39 文件名所述 `AI审核钮` 未获复证**：待确认态全文 `AI|智能|自动审` 正则零命中，header 右组仅 `确认` 一枚主按钮。
5. **`确认` 芯片样式**（补充实测）：pill radius 9999px、底 `rgb(255,251,235)`（amber-50 类）。

## 5. 探针生命周期记录（零残留承诺）

- 本轮探针 `#8`（标题 `r6-icons 探针`）：12:18 看板 `+ 任务` 创建（toast `任务已创建`）→ fresh 详情 icons dump + `更多` 菜单 dump → header `开始` → 开始任务弹层（Agent=`r3-builder`）→ `先做规划` → 规划中 chip 实测 → 45s 完成转 `确认`（待确认 header/按钮/词表复测）→ `更多` → `删除` → 确认弹窗 → 删除。
- 验证：URL 回 `/app/`；board 全文无 `r6-icons`；API `GET /api/projects/ZAQczKCu0MOAzC1ZqcFlX/todos?teamId=…` 仅剩 r3 遗留 2 条（#1/#2，全程未动）。
- 规划产物 `方案 · v1` 仅存在于已删任务内；hosted repo 未产生提交（探针未进执行步）。
- 前一轮 agent 的 r6 探针（截图 14–36 的生命周期）同法删净，board/API 双验无残留。

## 6. 缺口清单（未覆盖，勿当作已测）

| 缺口 | 原因 | 现有权威素材 |
|---|---|---|
| header 主按钮右缘像素素材 | r5b §0.2 窗口面物理上限仍在（几何 DOM 已闭合） | r6 33/34（卡片/弹层同款钮全形）+ DOM |
| dark 主题深层状态 / dark icons dump | 本轮只拍 board dark；icons 依 r5 §4 主题无关结论不重复 | r6 02 + r5 icons.json |
| 驳回回路 / `复用方案` 弹层 / 失败态 / 运行历史多行态 | 本轮探针只跑到待确认（icons 与 header 复测够用），未进执行 | r5b §5 同项 + r6 26–32 |
| `项目` 分组内项目项的 icons | 分组展开态未单独 dump（折叠钮已 dump） | — |
| 资源页弹窗内表单图标、`总管` drawer、`看板指南` carousel | 同 r5 §6，未重开 | r2/r3 批（右缘缺） |

## 7. 盘点后 space 状态

- TaskSpace 仅剩 p1，停在 `/app/`，light 主题；p1 的 CDP metrics override（1422×800 CSS）持续生效，下一张浏览器票可直接沿用。
- r3 遗留 #1（执行中·`回复`）/#2（已完成）未动；机器 `xmonsMac-3574.local` 在线。
