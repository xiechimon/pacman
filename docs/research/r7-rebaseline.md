# R7 · 像素素材全量重拍（1440 基线，r5/r6 位图作废替换）

> 目的：r2/r3 左裁切、r5/r6 override 被物理窗口钳制（右 ~130 CSS px 位图缺失）——四轮像素基线全部带右缘缺口。本票用已验证修法全量重拍：窗口正常化 1450×829 → 真实视口 1440×732 CSS，零 override、零钳制，右缘完整。
> 素材：Ego 浏览器 TaskSpace「todos.dev 复刻盘点」（spaceId 0），free 档已登录账号（Xmon Dai / xiechimon@qq.com / 团队 Xmon Dai's team `BoZYfvqKSGanlxsXVbXSa`）。
> 盘点时间：2026-09-21 13:10–14:05（探针 `#9` 13:21 创建、14:00 前后删除；探针 `#10` 为 dark fresh 补拍、即拍即删）。
> 票：#51（map #34 子票）。素材落 `docs/research/assets/r7/`。方法基线：r6（`r6-rebaseline.md`）+ r5b §0.3。
> 前置事实（API 一手）：机器 `xmonsMac-3574.local`（id `TlZ2sSD4EJCxjNJqVhdo_`）`isOnline: true`、`buildEnabled: true`、cli 0.1.52（与 r5b/r6 同值）。

## 0. 捕获清单（capture manifest）——本票起的新基线

| 项 | 实测值 | 说明 |
|---|---|---|
| 窗口 | `Browser.setWindowBounds {windowState:'normal', left:0, top:37, width:1450, height:829}` | 先 normal 化再设 bounds；完毕恢复 maximized |
| 视口 | **1440×732 CSS**（`innerWidth/innerHeight` 实测） | 本机物理上限（屏 1470×956，chrome 高 97、纵向滚动条 10）；`Emulation.clearDeviceMetricsOverride` 后**不做任何 override** |
| devicePixelRatio | **2**（tab 缩放 100%） | r5/r6 时代的 110% 缩放（dpr 2.2）已不在；缩放复位是本修法能拍全 1440 的前提之一 |
| 截图面 | **1440×732 px**（53 张全量 sips 核验一致） | = 视口 1:1 CSS px 位图，**右缘无缺口**（r5b §0.2 的窗口面上限问题随缩放复位消失） |
| 看板 6 列 | 单张 1440 装不下 1772 → **横向两拍**：scrollLeft 0（01/02）+ scrollLeft max=572（01b/02b），拼接读图 | scrollWidth 1772 / clientWidth 1200 |
| 主题 | light 全量；dark 覆盖看板（双 scroll）+ 详情五态中 fresh/规划中/待确认/审核/完成态（见清单 d 后缀） | |
| 语言 | zh（`tds.locale=zh`） | |

对拍 harness 注意：本批位图 = 100% 缩放下的 1440×732；与 r5/r6 批（1293×727、110% 缩放、右缘缺 ~130）**不可直接像素 diff**，几何以 §3 DOM 表为准。

## 1. 截图清单（`docs/research/assets/r7/`，53 张 + icons.json）

| 文件 | 状态/路由 | 备注 |
|---|---|---|
| `01-board-light-scrollL.png` / `01b-…-scrollR.png` | 看板 light | scrollLeft 0 / 572 两拍；含 r3 遗留 #1（执行中·`回复`）#2（已完成） |
| `02-board-dark-scrollL.png` / `02b-…-scrollR.png` | 看板 dark | 拍摄时探针 #9 在待确认列 |
| `03-board-sidebar-collapsed-light.png` | rail 收起 | rail 宽 40 |
| `04-新建任务dialog-light.png` / `14-…-已填标题…` | 新建任务 dialog | 672×439 居中（§3.2） |
| `05-搜索面板-light.png` | ⌘K 搜索面板 | placeholder `搜索任务、项目、成员…` |
| `06`–`10` | resources machines/providers/skills/mcp-servers/secrets | 路由级 |
| `11-schedules.png` / `12-team.png` / `13-account.png` | 定时/团队/帐号 | 路由级 |
| `15/15b/15c-开始任务弹层-*.png` | 开始任务弹层 | 未指派 / agent 选择列表 / 已选 r3-builder |
| `16-规划中-streaming-light.png` / `16d-…-dark.png` | 规划中 streaming | |
| `17-待确认-chat视图-light.png` / `17d-…-dark.png` | 待确认 chat | |
| `17b-待确认-方案文档分栏-light.png` | 方案文档分栏 | 左文档 pane `方案▾ v1▾` + 右 chat 列 |
| `18-待确认-更多菜单-light.png` | `更多` 菜单 | 4 项同 r6 |
| `19-状态芯片弹层-待确认-light.png` | 状态芯片弹层 | 298×193 @ (287,34.5) |
| `20-方案类型下拉-light.png` | `方案▾` 下拉 | 仅文档类型选择 |
| `21-待确认-看板卡片-light.png` | 待确认列卡片 | 卡 262×114.5、`确认` 42.5×26 |
| `22-board-fresh探针-light.png` / `22d-…-dark.png` | 看板 fresh 探针卡 | dark 版为探针 #10 |
| `23-detail-fresh-light.png` / `23d-…-dark.png` | 全页详情 fresh | |
| `24-fresh-更多菜单-light.png` | fresh `更多` 菜单 | 220×165 @ (1052.5,39.5)，4 项 |
| `25-删除确认弹窗-light.png` | 删除确认 | 448×142 居中，文案不变 |
| `26-执行中-streaming-light.png` / `26d-…-dark.png` | 执行中 streaming | |
| `27-审核-diff分栏-light.png` / `27b-…-diff展开` / `27d-…-dark` | 审核 diff | `变更▾ v1 · 1 个文件改动 +1` |
| `28-执行transcript-工具行展开-light.png` | 工具行展开 | `edit README.md` + `bash … tail -n 3` pill |
| `29-状态芯片弹层-审核-light.png` | 芯片弹层（审核） | |
| `30-Token用量弹层-light.png` | Token 用量 | 82.9k；448×256 居中 |
| `31-分支与PR弹层-light.png` | 分支与 PR | 448×409；构建分支 `tds/conv-01a0c26e-…` |
| `32-运行历史弹层-light.png` | 运行历史 | 448×133；单行态（§4.2 差异） |
| `33-待验收-看板卡片-完成钮-light.png` | 待验收列卡片 | `完成` 42.5×26 @ (1067.5,171.5)（scrollRight 态） |
| `34-验收确认弹层-light.png` | 验收确认 | 448×143；`将改动合并到默认分支` 默认勾 |
| `35-完成态-看板-light.png` / `35d-…-dark.png` | 完成态看板 | |
| `36-完成态-详情-light.png` / `36d-…-dark.png` | 完成态详情 | |
| `37-用户菜单-light.png` | 用户菜单 | 面板 224×272 @ (8,410)，触发器上方弹出；**菜单项纯文本零图标**（§4.1） |
| `38-r3遗留卡-详情-light.png` | r3 #1 详情（只读） | chip `审核`、等待回复态；**composer 无 `AI 审核` 钮**（§4.1） |
| `39-安装App-install页.png` | 安装 App | 侧栏项 = 路由跳 `https://todos.dev/zh/install`（站内 install 页，非弹层） |

## 2. 图标 dump（`assets/r7/icons.json`）与 r6 漂移复核

方法同 r6 §2（`querySelectorAll('svg')` → outerHTML 去重；`{route, context, w, h, svg, count, contexts}`），两处收窄：overlay scope（搜索面板/新建任务 dialog/用户菜单）改为 **dialog 内限定**（r6 为整页 dump，overlay 计数含页面背景）；detail 三个动态 scope（fresh/更多/审核）本票不落 JSON，改用 markup 集合级 diff 复核（探针删后 DOM 已消失，全局比对见下）。

- 规模：**13 scope、218 条 entries、64 个唯一 markup**（board 23 · rail 20 · 搜索面板 11 · 新建任务 dialog 6 · machines 20 · providers 20 · skills 22 · mcp-servers 18 · secrets 20 · schedules 20 · team 20 · account 18 · 用户菜单 0）。
- 复核法：r7 三处代表性 scope（board:light 23 uniq、详情审核态整页 33 uniq、用户菜单开态整页 33 uniq）的唯一 markup 与 r6 全 83 个唯一 markup 做集合 diff。
- **结论：微漂移，已重拍为 r7 版**（本文件 + icons.json）。差异仅 3 处：
  1. **新增 1 个 markup**：侧栏 `新建项目` 行的 16×16 plus（`<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12">`、stroke-width 2.5、`text-content-secondary`），@ (34,208)，r6 全集无此 markup。
  2. **`AI 审核` 按钮**（新控件，icon markup 未入 dump，见 §6 缺口）：r6 §4.4「未获复证」→ r7 **证实存在**。
  3. **detail 路由不再挂载看板 DOM**：r6 detail scope 能 dump 到看板列/卡片图标；r7 详情页 DOM 中看板列内容不渲染（板顶栏元素仍在但 `visibility:hidden`，elementFromPoint 证实详情 header 才是命中层）。属 DOM 挂载结构变化，非图标 markup 漂移。
- 其余可比项（侧栏导航 16×16 全集、`收起/展开侧边栏`、`看板指南`、composer 工具条、发送、状态点等）与 r6 **逐字节一致**；r6「r5→r6 导航重绘」结论延续有效。

## 3. DOM 几何实测 @1440×732（对拍权威数值）

### 3.1 看板

| 项 | 实测 |
|---|---|
| 侧栏 | 宽 240（收起 rail 40，不变） |
| 列 | 列头文本 x = 285 / 577 / 869 / 1161 / 1453 / 1745（**pitch 292**，与 r5b/r6 同）；scrollWidth 1772 / clientWidth 1200 / maxScroll **572** |
| 卡片 | 262×114.5（待确认列卡 x=849；待验收列卡 scrollRight 后 x=861）；卡主按钮 **42.5×26**（`确认`/`完成` 靛蓝；r3 #1 `回复` 同尺寸透明底） |
| 顶栏 | 标题 `看板` x=825.7 w=28.6 → 中心 **840.0 = (240+1440)/2 = 内容区中心**（r6 §4.2 公式 @1440 闭合）；`+ 任务` 59.5×28 @ x=1334.5；`看板指南` 28×28 @ x=1400（右缘距 12） |

### 3.2 新建任务 dialog

672×439 @ (384, 146.5)——x = (1440−672)/2 **水平居中**（r6 @1422 为 x=374.9，同一居中律；高 480→439）。底部 `保存` + `保存并开始`；标题 placeholder `需要做什么？`；描述模板五行不变；项目选择器默认 `r3-lifecycle`。

### 3.3 详情 header（chat 视图，自左）

返回 28×28 @ x=252 · `#N`+状态芯片 · tab 组 `文档/聊天` 68×28 @ x=806（钮 32×24；组中心 840 = 内容区中心）· `更多` 28×28 @ 1244.5 · `分支与 PR` 27×27 @ 1278.5 · `Token 用量` 27×27 @ 1311.5 · `运行历史` 27×27 @ 1344.5（图标 pitch 33）· **主按钮 50.5×28 @ 1377.5**（右缘距 12；文案 fresh=`开始`/待确认=`确认`/审核=`完成`/已完成=`重开`，四态同位同尺寸）。
右缘控件本票**全部落进截图面**（r5b §0.3 的 fixed 位图滞后问题在 100% 缩放下未复现）。

### 3.4 chat 列 / composer

composer 盒 x=737、w=687、**右缘距 16**（左锚定：x=737 与 r6@1422 全同，宽随视口长）；textarea 661×28 @ (750,649)；placeholder 待确认/审核=`请求修改…`、规划中/执行中=`向 Agent 补充说明，执行过程中即可送达`。
工具条 30×30 pitch 36：`语音输入` @750 · `添加附件` @786 · **`AI 审核` @822（新）** · `提及` @858；`发送` 32×32 @ (1379,683)。`总管` FAB 48×48 @ (1376,668) 与 `发送` 区域重叠（z 序/显隐逻辑未深挖，[推断] 按上下文切换）。

### 3.5 弹层（全部水平居中 x=496=(1440−448)/2）

| 弹层 | 尺寸 | y |
|---|---|---|
| 开始任务 | 448×235 | 248.5 |
| Token 用量 | 448×256 | 238 |
| 分支与 PR | 448×409 | 161.5 |
| 运行历史 | 448×133 | 299.5 |
| 验收确认 | 448×143 | 294.5 |
| 删除确认 | 448×142 | 295 |
| 状态芯片 | 298×193 | @ (287,34.5)，芯片下方锚定 |
| `更多` 菜单 | 220×165 | @ (1052.5,39.5)，右上锚定 |
| 用户菜单 | 224×272 | @ (8,410)，触发器上方弹出 |

### 3.6 文档 pane

分栏头 `方案▾`(x=274) / `变更▾`(x=274) / `v1▾`(x=327.5) @ y=53.5；文件行 `README.md` @ y=90；`全部展开/全部收起` 按钮互替。

## 4. r7 vs r6 更新点清单

### 4.1 漂移（DOM 实测）

1. **composer 工具条新增 `AI 审核` 钮**：30×30 @ x=822，位于 `添加附件` 与 `提及` 之间；出现于活动任务的待确认/审核详情（#9 两态均实测）；r3 #1（等待用户回复的只读审核态）composer **无**此钮。r6 §4.4「AI审核钮未获复证」→ 本票**证实存在**，但仅限可交互审核面。[推断] 该钮按会话可写性显隐。
2. **侧栏 `新建项目` 行新增 16×16 plus 图标**（§2 差异 1）。
3. **detail 路由卸载看板 DOM**（§2 差异 3）：elementFromPoint 证实详情 header 为命中层，板顶栏 `visibility:hidden` 残留。
4. **用户菜单项纯文本化**：菜单 dialog 内 0 个 svg（r6 菜单 scope 的 22 条为整页 dump 的页面背景图标）；菜单项文案不变（外观/帐号/API 密钥/MCP/反馈/新功能/快捷键）。主题切换后菜单**不自动关闭**（需 Esc）。
5. **运行历史单行态无 `重跑` 文本**：本票单行 `第 1 次运行 · 当前 · 12 分钟前 · 38.3k tokens`，dump 文本无 `重跑`（r5b 13 有）；[推断] `重跑` 为 hover 态控件。
6. **Token 弹层数值口径复核**：审核时点弹层 82.9k（输入12/输出854/缓存读54.2k/缓存写27.8k），运行历史行 38.3k = 单次执行 run 口径；弹层 = 累计口径。[推断]

### 4.2 不变项（零漂移复测）

列 pitch 292、侧栏 240/rail 40、顶栏/详情 header 集与位置律（内容区中心 840、右缘距 12）、主按钮 50.5×28（header）/42.5×26（卡片）、tab 组 68×28、弹层 448 宽居中律、删除确认文案、`更多` 菜单 4 项、芯片弹层结构（任务/执行对话/编辑分配）、chip 双词表（列名 vs 芯片：`待验收`↔`审核`、`待确认`↔`确认`、fresh↔`待处理`）、`文档/聊天` tab、composer 占位词随状态切换。

### 4.3 相对 r6@1422 的几何平移律

视口 +18 宽后：右锚控件（header 图标组/主按钮/看板指南）**x +18**；内容区中心锚（板标题/tab 组）**x +9**；左锚容器（composer 盒 x=737、文档 pane x=240 起）**不动、宽度 +18**；居中弹层 x 重算 =(1440−w)/2。复刻 harness 用「锚点 + 视口宽」参数化即可一套公式通吃。

## 5. 探针生命周期记录（零残留承诺）

| 时刻 | 事件 |
|---|---|
| 13:21 | 看板 `+ 任务` → `在 README.md 末尾追加一行「r7 rebaseline probe」` → `保存`；`#9`（id `7ve0iOkQ-JBpSL98zSiGc`）落 `待开始` |
| 13:21 | 详情 header `开始` → 开始任务弹层（Agent=`r3-builder`）→ `先做规划` |
| 13:21–13:26 | `规划中` streaming（16/16d）→ 方案 v1（规划 21s）→ `待确认`（chip `确认`） |
| 13:26–13:35 | 待确认全套采集（17/17b/17d/18/19/20/21 + AI 审核钮实测） |
| 13:35 | header `确认` → `执行中`（26/26d；执行 19s：edit + bash 验证） |
| ~13:37 | 转 `审核`（27/27b/27d/28/29/30/31/32），Token 82.9k、构建分支 `tds/conv-01a0c26e-23ea-734f-9847-cf9cdbce7802`、目标提交 `2cceb9dbf7a8` |
| ~13:52 | 看板卡 `完成` → 验收弹层（勾合并）→ `完成`（合并轮 `Already up to date`）→ 35/35d/36/36d |
| ~13:55 | 探针 #10 `r7-dark-fresh 探针（拍完即删）` 创建 → 22d/23d → 即删（dark 删除弹层未拍） |
| ~14:00 | #9 `更多` → `删除` → 确认弹窗（25）→ 删除 |

验证（UI+API 双验）：URL 回 `/app/`；board 全文无 `r7`；API `GET /api/projects/ZAQczKCu0MOAzC1ZqcFlX/todos?teamId=…` 仅剩 r3 遗留 #1（review）/#2（done），全程未动。hosted repo `r3-lifecycle` main 新增一行 `r7 rebaseline probe`（合并步产物，与历轮探针同性质）。

## 6. 缺口清单（未覆盖，勿当作已测）

| 缺口 | 原因 | 现有权威素材 |
|---|---|---|
| `AI 审核` 钮 icon markup + 点击后行为 | 钮在探针删除后才完成比对定位，未单独建探针三 | 本票 §4.1 几何/显隐 + 17/27 系列截图中可见 |
| 运行历史 `重跑` 钮、多行态 | 单行态下 `重跑` 疑似 hover 才现；未重跑 | r5b 13 / r3 74（右缘缺） |
| 驳回回路 / `复用方案` 弹层 / 失败态 | 生命周期一次跑通，未触发 | 同 r6 §6 |
| `总管` drawer / `看板指南` carousel / 资源页弹窗表单图标 | 票面未列，沿袭 r6 未重开 | r2/r3 批（右缘缺） |
| dark 弹层（更多/Token/分支/历史/验收/删除） | 票面要求 dark 覆盖 board+detail，弹层未要求 | 本票 light 弹层全套 |
| 搜索面板结果态（有命中列表） | 只拍了空面板 | — |
| detail 三 scope 的 r7 icons JSON 落盘 | 探针删后 DOM 消失；已用集合 diff 替代复核（§2） | r6 icons.json detail scope + 本票 §2 结论 |

## 7. 盘点后 space 状态

- TaskSpace 仅剩 p1（停 `/app/`、light）；本票临时页 p5 已关，前轮遗留 p2/p3/p4 一并清关。
- 窗口已恢复 maximized（1470×849）；p1 无 metrics override 残留（实测 innerWidth 1460 / dpr 2）。
- 探针 #9/#10 已删（UI+API 双验零残留）；r3 遗留 #1/#2 未动；机器 `xmonsMac-3574.local` 在线。
- tab 缩放 100%（dpr 2）——与 r6 时代 110% 不同，下一张票沿用本票 §0 方法即可。
