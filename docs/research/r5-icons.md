# R5 · todos.dev 全窗补拍 + workspace 内联 SVG 图标集 dump

> ⚠️ **像素位图作废（右缘缺口），以 r7 为准**：本批 PNG 拍摄于 110% tab 缩放 + override 钳制期，右缘 ~130 CSS px 缺失，已从 main 删除（git 历史可查）；权威位图见 `r7-rebaseline.md` + `assets/r7/`（1440×732 全窗）。下文 DOM 实测表与 icons dump 仍然有效。

> 目的：闭合 #42 原型对拍的两个素材缺口——①全窗截图（面板右缘完整可见）②workspace 内联 SVG 图标的 DOM dump（替换目测手绘图标的权威源）。
> 素材：Ego 浏览器 TaskSpace 2「todos.dev 复刻盘点」，free 档已登录账号（Xmon Dai / xiechimon@qq.com / 团队 Xmon Dai's team）。
> 盘点时间：2026-09-20（探针任务 13:37 创建、约 13:45 删除）。
> 票：#48（map #34 子票）。素材落 `docs/research/assets/r5/`。

## 0. 捕获清单（capture manifest）

| 项 | 实测值 | 说明 |
|---|---|---|
| CSS viewport | **1422×800** | 经 CDP `Emulation.setDeviceMetricsOverride {width:1564, height:880, deviceScaleFactor:2.2}` 强制（映射：override width W → CSS viewport W÷1.1，见 §0.1） |
| devicePixelRatio | 2.2 | 屏幕 2× × tab 缩放 110%（r2 同值） |
| 窗口 bounds | 1470×849（maximized） | `Browser.getWindowForTarget` 经 page session 读取 |
| 截图输出 | **1293×727 px** | 全 viewport 均匀缩采，PNG px = CSS px × 0.909；换算回 CSS px 需 ×1.1 |
| 主题 | light / dark 分屏标注 | 见 §2.5 主题机制 |
| 语言 | zh（`tds.locale=zh` 实测） | 文案照抄原文 |

### 0.1 捕获语义实测（clip 探针）

ego-browser `page.screenshot()` 输出恒为 viewport÷1.1（`raw`/`scale` 参数不改变输出尺寸）；`clip` 坐标为 CSS px、输出同比例缩采（clip 100×100 → 输出 91×91）。**截图包含全 viewport 内容，无裁切**；右缘内容（面板 `关闭` 按钮等）在 r5 全部截图内可见。

## 1. 截图清单（`docs/research/assets/r5/`，7 张 + icons.json）

| 文件 | 状态 | 要点 |
|---|---|---|
| `01-新建任务抽屉-light.png` | `+ 任务` 抽屉，标题已填探针名 | 抽屉全宽、字段布局 |
| `02-board-light-探针卡.png` | 看板 light，探针 `#3` 在 `待开始` | toast `任务已创建` 同帧 |
| `03-board-dark-探针卡.png` | 看板 dark，探针卡 | 6 列全在 DOM，横向滚动 |
| `04-task-panel-fresh-dark.png` | 探针面板 fresh（待处理），dark | **面板右缘 + 6 枚 header 图标完整** |
| `05-task-panel-fresh-light.png` | 同上，light | 对拍主用 |
| `06-task-panel-executing-r3card-light.png` | r3 遗留卡面板（状态芯片 `审核`），light | transcript + composer 全窗（§2.3） |
| `07-board-sidebar-collapsed-light.png` | 侧栏收起态看板，light | 图标轨 40 CSS px（§2.8） |

## 2. 改变像素对拍基线的观察

1. **任务面板宽度 = 560 CSS px**，右对齐贴窗口右缘：`x=861.8 → right=1421.8`（@1422 viewport），高度满 viewport（800）。DOM `getBoundingClientRect` 实测，非截图推算。
2. **面板 header 右图标组 = 6 枚**：`更多`(28×28) / `分支与 PR` / `Token 用量` / `运行历史` / `全屏 · F` / `关闭`（各 27×27 按钮，svg 15×15），x 从 1167 排到 1416。r2 §5.3 记录为 4 枚 + `开始` 主按钮；r5 fresh 态实测 header **无** `开始` 主按钮（`开始` 仅在卡片上），且 `全屏 · F`/`关闭` 为 r2 未记录项。[观察]
3. **Composer（审核态面板底部）**：textarea placeholder `请求修改…`（w=502, h=28 @x=891）；工具条 `语音输入`/`添加附件`/`提及` 30×30 按钮（svg 18×18，border-radius 4px，透明底）；**发送按钮 `发送` = 32×32、border-radius 8px（圆角方形，非圆形）**，空输入态底色 `rgb(232,226,217)`，svg 14×14，右缘距面板右边 29 CSS px。
4. 看板顶栏右侧组：`+ 任务`（`text-indigo-500` 文本按钮，x=1343）+ `看板指南` 图标按钮 28×28（x=821，面板打开时可见于顶栏区）。
5. **主题机制**：`<html class="dark">` + localStorage `tds-theme`（实测值 `dark`/`light`）。当前版本 `document.documentElement.dataset.theme` 为 undefined——r2 §1.4 记录的 `dataset.theme === "dark"` 与本次实测不符 [更正]。
6. **r3 右缘缺失实锤**：`r3/47-task-panel-fresh.png`（1206×621）中标题在图缘截断、header 图标仅见 4/6（`全屏 · F`/`关闭` 不可见）；r5 `04/05` 为完整集。r2/r3 批次的实际视口为 1309/1327 CSS px（<1422），r5 以 1422×800 重立基线。
7. `总管` FAB：48×48 圆形（border-radius 9999px），svg 30.8×30.8，`aria-label="总管"`，位于面板左下外侧（x=797, y=736 @审核态）。
8. **侧栏收起图标轨 = 40 CSS px 宽**（rail 容器 `x=0, w=40, h=800` 实测），r2 §1.1 记录 48px [差异待复核]；rail 内图标渲染 10–16 CSS px（比展开态侧栏的 11 px 略大）。

## 3. 探针任务生命周期记录（零残留承诺）

- 创建：看板顶栏 `+ 任务` → 标题 `r5-recapture 探针` → `保存任务`；落项目 `r3-lifecycle`、编号 `#3`、列 `待开始`；toast `任务已创建`（截图 02）。
- 拍摄：面板 fresh（04/05）+ 更多菜单 dump。
- 删除：面板 `更多` → `删除` → 确认弹窗（文案实测 `确定删除该任务？此操作不可撤销。` + `#3` + 标题 + `取消`/`删除`）→ 确认。
- 验证：`待开始` 恢复空态 `没有等待开始的任务`，URL 回 `/app/`，全文无 `r5-recapture` 字样（DOM 实测）。
- r3 遗留卡（`#1` 审核态、`#2` 已完成）仅只读打开面板，未做状态变更。

## 4. 图标 dump 方法与 `icons.json`

- 每个到访 scope（路由或打开的面板/抽屉/菜单）内执行：`document.querySelectorAll('svg')` → `outerHTML` scope 内去重；context = 最近祖先 `[aria-label]` → `button`/`[role=button]` 文本 → 邻近文本（≤4 hop）；`w`/`h` = `getBoundingClientRect()`（CSS px）；`count` = 该 markup 实例数。
- 规模：**18 个 scope、449 条 entries、93 个唯一 markup**；42 个 markup 跨 ≥2 scope 复用。全部 `viewBox="0 0 24 24"`；markup 长度 188–445 字符（单 path 为主）。403/449 条依赖 `currentColor`，46 条带显式 `fill`/`stroke`（状态点/彩色类）。
- **主题无关**：dark scope 的 markup 与 light 完全一致（35/35 命中 light 集），图标可按 currentColor 单源复刻。
- 字段：`{route, context, w, h, svg, count, contexts}`；`route` 含面板/弹层标注（如 `/app/?panel=todo:3 +panel:任务详情fresh:dark`）。
- scope 一览（entries 数）：board:light/dark 24+24 · 新建任务抽屉 28 · 用户菜单 24 · 面板fresh:dark/light 35+35 · 审核卡面板 43 · rail:侧栏收起 22 · 任务更多菜单 39 · schedules 18 · skills 20 · mcp-servers 16 · secrets 18 · machines 18 · providers 18 · team 18 · account 16 · 搜索面板(⌘K) 33。

## 5. 图标索引

`w×h` 为渲染尺寸（CSS px）；同一 markup 在不同 scope 渲染尺寸可不同（各列一行）。`0×0` = 隐藏模板节点（5 条，复刻可忽略）。

### 5.1 带标注图标（aria-label / 按钮文本，43 个唯一 markup）

| 图标上下文 | 渲染尺寸(CSS px) | 实例 | 出现路由/面板 |
|---|---|---|---|
| `安装 App` | 12×12 | 17 | +drawer:新建任务 · account · board:dark · board:light · resources/machines · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · team · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `安装 App` | 16×16 | 1 | rail:侧栏收起 |
| `编辑` | 13×13 0×0 | 4 | ▾任务更多 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `变更` | 11×11 | 10 | +drawer:新建任务 · board:dark · board:light · rail:侧栏收起 · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `待开始` | 13×13 | 60 | +drawer:新建任务 · board:dark · board:light · rail:侧栏收起 · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `定时` | 14×14 | 1 | rail:侧栏收起 |
| `发送` | 14×14 | 1 | 面板:审核 |
| `方案` | 11×11 | 10 | +drawer:新建任务 · board:dark · board:light · rail:侧栏收起 · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `分支与 PR` | 13×13 | 28 | +drawer:新建任务 · board:dark · board:light · rail:侧栏收起 · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `分支与 PR` | 15×15 | 4 | ▾任务更多 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `复制任务` | 13×13 0×0 | 4 | ▾任务更多 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `复制文本` | 13×13 0×0 | 6 | ▾任务更多 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `关闭` | 15×15 | 5 | +drawer:新建任务 · ▾任务更多 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `恢复到此处` | 13×13 | 1 | 面板:审核 |
| `机器` | 10×10 | 1 | rail:侧栏收起 |
| `技能` | 10×10 | 1 | rail:侧栏收起 |
| `看板` | 14×14 | 1 | rail:侧栏收起 |
| `看板指南` | 16×16 | 10 | +drawer:新建任务 · board:dark · board:light · rail:侧栏收起 · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `聊天` | 14×14 | 1 | 面板:审核 |
| `密钥` | 10×10 | 1 | rail:侧栏收起 |
| `模型服务` | 10×10 | 1 | rail:侧栏收起 |
| `排序` | 13×13 | 1 | resources/skills |
| `排序` | 12×12 | 1 | resources/skills |
| `全屏 · F` | 15×15 | 4 | ▾任务更多 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `收起侧边栏` | 14×14 | 17 | +drawer:新建任务 · account · board:dark · board:light · resources/machines · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · team · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `搜索` | 14×14 | 1 | rail:侧栏收起 |
| `提及` | 18×18 | 2 | +drawer:新建任务 · 面板:审核 |
| `添加标签` | 9×9 | 1 | +drawer:新建任务 |
| `添加标签` | 14×14 0×0 | 4 | ▾任务更多 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `添加标签` | 9×9 0×0 | 4 | ▾任务更多 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `添加附件` | 18×18 | 2 | +drawer:新建任务 · 面板:审核 |
| `文档` | 14×14 | 1 | 面板:审核 |
| `语音输入` | 18×18 | 2 | +drawer:新建任务 · 面板:审核 |
| `运行历史` | 15×15 | 4 | ▾任务更多 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `展开侧边栏` | 14×14 | 1 | rail:侧栏收起 |
| `展开项目` | 11×11 | 34 | +drawer:新建任务 · account · board:dark · board:light · resources/machines · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · team · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `展开项目` | 14×14 | 2 | rail:侧栏收起 |
| `总管` | 30.8×30.8 | 10 | +drawer:新建任务 · board:dark · board:light · rail:侧栏收起 · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `chart` | 14×14 | 1 | team |
| `grid` | 14×14 | 1 | team |
| `MCP` | 10×10 | 1 | rail:侧栏收起 |
| `Token 用量` | 15×15 | 4 | ▾任务更多 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `Xmon Dai` | 16×16 | 23 | +drawer:新建任务 · account · board:dark · board:light · resources/machines · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · team · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |

### 5.2 上下文/装饰图标（邻近文本定位，50 个唯一 markup）

| 图标上下文 | 渲染尺寸(CSS px) | 实例 | 出现路由/面板 |
|---|---|---|---|
| `#3待处理` / `#1审核` | 10×10 | 4 | ▾任务更多 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `​1` | 10×10 | 1 | 面板:审核 |
| `23 小时前` | 9×9 | 10 | +drawer:新建任务 · board:dark · board:light · rail:侧栏收起 · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `23 小时前回复` | 9×9 | 10 | +drawer:新建任务 · board:dark · board:light · rail:侧栏收起 · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `查看文档` | 11×11 | 2 | resources/secrets · schedules |
| `创建 Agent` | 12×12 | 1 | team |
| `定时` | 11×11 | 17 | +drawer:新建任务 · account · board:dark · board:light · resources/machines · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · team · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `定时` | 13×13 | 1 | ▸搜索面板(⌘K) |
| `定时新建` / `技能新建` / `MCP 服务器新建` | 16×16 | 8 | account · resources/machines · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · team |
| `复制链接` | 14×14 | 1 | ▾任务更多 |
| `刚刚开始` / `1 分钟前开始` / `2 分钟前开始` | 14×14 | 8 | board:dark · board:light · rail:侧栏收起 · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `刚刚开始` / `1 分钟前开始` / `2 分钟前开始` | 9×9 | 8 | board:dark · board:light · rail:侧栏收起 · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `关闭` | 14×14 | 1 | ▾任务更多 |
| `机器` | 11×11 | 17 | +drawer:新建任务 · account · board:dark · board:light · resources/machines · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · team · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `机器` | 13×13 | 1 | ▸搜索面板(⌘K) |
| `技能` | 11×11 | 17 | +drawer:新建任务 · account · board:dark · board:light · resources/machines · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · team · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `技能` | 13×13 | 1 | ▸搜索面板(⌘K) |
| `简体中文` | 11×11 | 1 | account |
| `看板` | 11×11 | 17 | +drawer:新建任务 · account · board:dark · board:light · resources/machines · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · team · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `看板` | 13×13 | 1 | ▸搜索面板(⌘K) |
| `密钥` | 11×11 | 17 | +drawer:新建任务 · account · board:dark · board:light · resources/machines · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · team · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `密钥` | 13×13 | 2 | ▸搜索面板(⌘K) |
| `模型服务` | 11×11 | 17 | +drawer:新建任务 · account · board:dark · board:light · resources/machines · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · team · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `模型服务` | 13×13 | 1 | ▸搜索面板(⌘K) |
| `排序` | 13×13 | 1 | resources/skills |
| `前往任务看板定时团队技能MCP密钥机器模型服务帐号API 密` | 13×13 | 1 | ▸搜索面板(⌘K) |
| `任务` / `新建` | 13×13 | 15 | +drawer:新建任务 · board:dark · board:light · rail:侧栏收起 · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `任务` | 13×13 | 1 | ▸搜索面板(⌘K) |
| `删除` | 14×14 | 1 | ▾任务更多 |
| `尚无定时。按周期或在指定时间自动重新运行任务。每一轮都会依据` | 26×26 | 1 | schedules |
| `尚无密钥。团队密钥将以环境变量注入每个任务的 shell。值` | 26×26 | 1 | resources/secrets |
| `搜索⌘K` | 11×11 | 17 | +drawer:新建任务 · account · board:dark · board:light · resources/machines · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · team · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `添加机器` | 14×14 | 1 | resources/machines |
| `团队` | 13×13 | 1 | ▸搜索面板(⌘K) |
| `完成` | 14×14 | 1 | ▾任务更多 |
| `也可以直接告诉总管某个任务要多久重跑一次，它会替你写好规则。` / `也可以让总管添加：它会开一张安全输入卡填写值，值不会进入对话` | 11×11 | 2 | resources/secrets · schedules |
| `帐号` | 13×13 | 1 | ▸搜索面板(⌘K) |
| `MCP` | 11×11 | 17 | +drawer:新建任务 · account · board:dark · board:light · resources/machines · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · team · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `MCP` | 13×13 | 1 | ▸搜索面板(⌘K) |
| `R3 网关自定义12 模型` | 12×12 | 1 | resources/providers |
| `r3-mbp离线…NJqVhdo_ · max 3` | 16×16 | 1 | resources/machines |
| `r3-mcp远程（HTTP）https://example.` | 12×12 | 1 | resources/mcp-servers |
| `r3-probe-skillR3 盘点测试技能` | 12×12 | 1 | resources/skills |
| `r3-probe-skillR3 盘点测试技能` / `未启用` | 13×13 | 5 | resources/machines · resources/providers · resources/skills |
| `Rr3-lifecycle` | 12×12 | 1 | +drawer:新建任务 |
| `Todos 托管机器随时在线，构建速度快。空闲自动休眠，仅在` | 16×16 | 1 | resources/machines |
| `Todos（内置）8 模型未启用` | 12×12 | 1 | resources/providers |
| `Xmon Dai` | 12×12 | 1 | account |
| `Xmon Dai's team` | 11×11 | 17 | +drawer:新建任务 · account · board:dark · board:light · resources/machines · resources/mcp-servers · resources/providers · resources/secrets · resources/skills · schedules · team · ▸搜索面板(⌘K) · ▾任务更多 · ▾用户菜单 · 面板:审核 · 面板fresh:dark · 面板fresh:light |
| `Xmon Dai's team` | 12×12 | 1 | team |

## 6. 缺口清单（未覆盖，勿当作已测）

| 缺口 | 原因 | 权威素材 |
|---|---|---|
| `待确认` plan 方案卡全窗态 | 需在线机器+模型跑规划；r3 机器 `r3-mbp` 实测 `离线`，不强跑 | r3 57/58（右缘缺，见 §2.6） |
| 执行中 live streaming（流式 transcript）全窗态 | r3 卡已停 `审核` 终态；06 为静态 transcript 非流式 | r3 59/63（右缘缺） |
| 面板子弹层（`分支与 PR`/`Token 用量`/`运行历史`/状态芯片负责人弹层）全窗重拍 | 本票未逐一重拍（fresh 态图标已 dump） | r2 26c–26f（右缘缺） |
| `总管` drawer、`看板指南` carousel、`/zh/install` 页图标 dump | 未打开（FAB/入口图标已 dump） | r2 16/23、r3 87/88 |
| 资源页弹窗内表单图标（添加机器/MCP/密钥、新建定时等） | 未重开弹窗（路由默认态已 dump） | r2 09b–11b（截图） |
| 收起 rail / 新建抽屉的 dark 补拍 | 未拍（light 权威） | r2 30 |
| 侧栏展开宽度复核 | r2 记 240、rail r2 记 48 vs r5 实测 40 | [差异待复核] |

## 7. 盘点后 space 状态

- TaskSpace 2 仅剩 p1，停在 `/app/`，light 主题，探针已删。
- **p1 带一个未清除的 CDP metrics override（1422×800 CSS）**：`clearDeviceMetricsOverride` 与 `width:0` 均不生效（跨导航持续）。对下一张浏览器票：可直接沿用（= r5 基线），或关 tab 重开回到窗口原生 1327×683。
