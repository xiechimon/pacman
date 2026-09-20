# R5b · 生命周期深层状态全窗补拍（r3 右缘缺失态重拍）

> 目的：闭合 #42 详情流对拍的 r3 右缘缺失素材——实跑一遍任务生命周期，在加宽基线视口逐态全窗重拍（规划中 streaming / 待确认 plan 卡 / 执行 transcript+工具行+收起 / 待验收卡 / 验收弹层 / 完成态 / Token 用量 / 分支与 PR / 运行历史 / 状态芯片弹层），并逐态 DOM 实测面板与按钮几何。
> 素材：Ego 浏览器 TaskSpace 2「todos.dev 复刻盘点」，free 档已登录账号（Xmon Dai / 团队 Xmon Dai's team `BoZYfvqKSGanlxsXVbXSa`）。
> 盘点时间：2026-09-20 22:45–23:52（探针 `#4` 22:45 创建、23:50 前后删除）。
> 票：#49（map #34 子票）。素材落 `docs/research/assets/r5b/`。方法基线：r5（`r5-icons.md`）。
> 前置事实（API 一手）：机器 `xmonsMac-3574.local`（id `TlZ2sSD4EJCxjNJqVhdo_`）`GET /api/teams/{id}/machines` → `isOnline: true`、`buildEnabled: true`、cli 0.1.52（截图 01）；服务商 `R3 网关`（`r3-gw`，`anthropic-messages`，12 模型，截图 02）。执行体 Agent = `r3-builder`（`claude-sonnet-5 · 默认`）。

## 0. 捕获方法与关键更正

### 0.1 CDP override 映射复核（沿用 r5）

`Emulation.setDeviceMetricsOverride {width:W, height:H, deviceScaleFactor:2.2, mobile:false}` → CSS viewport = W÷1.1（tab 缩放 110% 实测生效；`innerWidth` 逐项核对）。override 跨导航持续（r5 §7 复证）。

### 0.2 对 r5 §0.1 的更正：截图是窗口面，右缘物理不可拍

r5 §0.1 结论「截图包含全 viewport 内容，无裁切」不成立。本票用注入探针（`position:fixed` 纯色块 + DOM rect 对照）实测：

- `page.screenshot()` 输出 = **窗口内容面的 1:1 CSS px 位图**，宽度 = 窗口内容 DIP ÷ 1.1（本机屏宽 1470 DIP、窗口最大化 → 面宽 ≈1293 CSS px；窗口 1450 宽时 ≈1175–1190）。
- CSS viewport 超出面宽的部分（1422 基线下右缘 ≈130 CSS px）**在任何 clip/captureBeyondViewport 组合下都不出现**：clip 请求尺寸会被按比例满足，但超出面的像素是空白/旧帧。
- 推论：r3 的「右缘缺失」不是 r3 视口选小了，而是**该屏 + 110% 缩放的物理上限**；r5 的 04/05 同样没拍到 header 最右的 `全屏 · F`/`关闭`（r5 §2.2 的 6 图标数字来自 DOM，不是像素）。[实锤，探针复测]

### 0.3 本票采用的双基线

- **DOM 实测**：CSS 1422×800（override 1564×880@2.2，= r5 §0 基线）——对拍权威数值。
- **截图**：CSS 1152×677（override 1268×745@2.2）或 1292×727（override 1422×800@2.2），使右缘控件落进可拍面内。
- 附加发现：header 右缘控件在截图中与 DOM rect 系统性错位（实测：DOM 探针色块与正文按当前布局 1:1 落位，而 header 图标组停留在旧布局位置——疑似 fixed 层的位图缓存未随布局失效）。后果：**右缘主按钮（确认/完成/重开）的像素素材在本机任何视口配方下都拍不全**，其几何只能以 DOM 为准、视觉以弹层/卡片同款按钮替代。复刻对拍 harness 用截图 diff 时，需把「可拍面 ≈1292 CSS px 且 fixed header 位图可能滞后」列为约束。[观察]

## 1. 探针生命周期实跑记录（零残留承诺）

| 时刻 | 事件 |
|---|---|
| 22:45 | 看板 `+ 任务` → 标题 `在 README.md 末尾追加一行「r5b lifecycle probe」` → `保存`；落项目 `r3-lifecycle`、编号 `#4`、列 `待开始`；toast `任务已创建` |
| 22:45 | 卡片 `开始` → 开始任务弹层（Agent=`r3-builder`，未开双 Agent 开关）→ `先做规划` |
| 22:45–46 | `规划中` streaming（`处理中... 13s`，截图 04）→ 30s 完成 → `待确认`（方案 v1） |
| 23:36 | 详情 header `确认` 钮（DOM click）→ `执行中` |
| 23:36–37 | 执行 22s（edit+bash 工具行）→ 转 `审核`（=待验收），diff 分栏自动出现 |
| 23:42 | 看板卡片 `完成` → 弹层 `完成任务`（勾选 `将改动合并到默认分支`）→ `完成` → 合并步（transcript `Xmon Dai 发起了合并` + `分支与 origin/main 已经是最新状态…Already up to date`）→ `已完成` |
| 23:50 | 详情 `更多` → `删除` → 确认弹窗（文案同 r5 §3）→ 删除 |
| 23:51 | 验证：URL 回 `/app/`；全文无 `r5b`；列计数 `待开始0 规划中0 待确认0 执行中1 待验收0 已完成1`（执行中/已完成 = r3 遗留 #1/#2，全程未动）；API `GET /api/projects/ZAQczKCu0MOAzC1ZqcFlX/todos?teamId=…` 仅剩 r3 两条 |

## 2. 截图清单（`docs/research/assets/r5b/`，25 张，均 light 主题）

| 文件 | 状态 | 要点 |
|---|---|---|
| `01-machines-在线.png` | resources/machines | `xmonsMac-3574.local …NJqVhdo_ · max 3`（在线=API isOnline，卡片无文字徽标） |
| `02-providers-模型.png` | resources/providers | `Todos（内置）8 模型 未启用` + `R3 网关 自定义 12 模型` |
| `03-开始任务弹层-light.png` | 开始任务弹层（未指派） | `Agent 未指派` + 开关 `规划与执行分用不同 Agent` + `先做规划`/`立即执行` |
| `03b-开始任务弹层-选Agent-light.png` | 同上（r3-builder） | Agent 行 = 头像 + `r3-builder` + `claude-sonnet-5` |
| `04-规划中-streaming-light.png` | 规划中 streaming | `22:45 运行在 xmonsMac-3574.local 上` + `开始执行任务` 卡 + `处理中... 13s`；composer placeholder `向 Agent 补充说明，执行过程中即可送达` |
| `05-待确认-看板卡片-light.png` | 看板 待确认 列 | #4 卡 + 靛蓝 `确认` 主按钮全形（42.3×25.8） |
| `05b-待确认-详情transcript-light.png` | 详情（首次打开） | header `#4 确认▾` + `[文档|聊天]` + `⋮` + `⬇`；transcript + `方案 · v1` 折叠卡 + `完成 30s` |
| `05c-待确认-方案文档分栏-light.png` | 方案展开（文档分栏） | 左文档 pane `方案▾ v1▾` + Context/Changes/Verification；右 chat 列 |
| `05d-待确认-更多菜单-light.png` | `更多` 菜单 | `完成` / `复制链接` / `关闭` / `删除`（4 项，无 Token/历史/确认方案） |
| `05e-状态芯片弹层-待确认-light.png` | 状态芯片弹层 | `任务`（负责人 Xmon Dai）+ `执行对话`（`r3-builder · claude-sonnet-5 · 默认` ✓）+ `编辑分配` |
| `05f-方案类型下拉-light.png` | `方案▾` 下拉 | 仅文档类型选择（`方案 ✓`），非确认入口 |
| `05g-待确认-plan卡-chat视图-light.png` | 待确认 chat 视图 | 折叠方案卡 + composer `请求修改…`；header `确认` 钮在面外（§0.2） |
| `06-待验收-审核diff分栏-light.png` | 审核（待验收） | chip `审核`；左 diff `变更▾ v1 · 1 个文件改动 +1` + README.md unified diff；右 transcript |
| `06b-执行transcript-确认轮-light.png` | 执行后 transcript | 用户 `确认` 消息泡（23:36）+ 结果消息 + `完成 22s ▾` |
| `07-执行transcript-工具行展开-light.png` | 工具行展开 | 灰底 pill `> edit README.md`、`> bash cd "$(git rev-parse --show-toplev…` + `收起 ^` |
| `07b-执行transcript-收起态-light.png` | 工具行收起 | `完成 22s ▸` 单行 + `全部收起` 工具栏钮 |
| `08-待验收-看板卡片-完成钮-light.png` | 看板 待验收 列（横向滚动） | #4 卡 `4 分钟前` + 靛蓝 `完成` 钮全形；邻列 r3 遗留 #1 卡 `回复` 钮（只读未动） |
| `09-验收确认弹层-light.png` | 验收确认弹层 | `完成任务` + 复选 `将改动合并到默认分支`（默认勾）+ `取消`/`完成` |
| `10-完成态-看板-light.png` | 看板终态 | 待验收 0、已完成 2（#4 `刚刚` + #2 `昨天`） |
| `10b-完成态-详情transcript-light.png` | 完成态详情 | chip `已完成`（绿）+ `变更 v1 1 个文件改动 +1 全部收起` + 合并轮 `Xmon Dai 发起了合并` |
| `11-Token用量-有数据-light.png` | Token 用量弹层 | `130.9k tokens`；`r3-gw/claude-sonnet-5 130.9k`；`输入18 / 输出1.3k / 缓存读取85.8k / 缓存写入43.7k` |
| `12-分支与PR-有构建分支-light.png` | 分支与 PR 弹层 | tab `同步到机器`/`Git`；`构建分支 tds/conv-<uuid>`、`目标提交 386b8e4af054`、`目标机器 xmonsMac-3574.local`、`同步目录`、`强制同步`+说明、`同步` |
| `13-运行历史-完成态-light.png` | 运行历史弹层 | `第 1 次运行 · 当前 · 1 小时前 · 130.9k tokens` + `重跑`（单行） |
| `14-状态芯片弹层-审核-light.png` | 芯片弹层（审核态） | 同 05e 结构，chip 文本 `审核` |
| `15-删除确认弹窗-light.png` | 删除确认 | `确定删除该任务？此操作不可撤销。` + `#4` + 标题 + `取消`/`删除`（红 50.3×29.8） |

## 3. 改变像素对拍基线的观察

1. **560px overlay 面板已不存在**：看板卡片点击直达全页详情 `/app/todo/<conversationId>`；旧路由 `/app/?panel=todo:N` 被 redirect 到详情（实测）。r5 §2.1「面板宽 560 右贴窗」与 §2.2「6 图标含 `全屏 · F`/`关闭`」是已下线 surface 的数值 [更正]。详情结构 = 侧栏 240 + 内容区（文档 pane 可全宽 ‖ chat 列右贴）。
2. **详情 header（chat 视图）实测集**（自左）：`返回` · `#N` · 状态芯片▾ · tab 组 `文档/聊天`（组 68×28、钮 32×24）· `更多` 28×28 · `分支与 PR` 27×27 · `Token 用量` 27×27 · `运行历史` 27×27 · **主按钮 50.3×28**（radius 6px、底 `rgb(79,70,229)`=indigo-600、白字 text-xs、padding 6px 12px、右距 viewport 缘 11.3–12.2 CSS px，@1152/1422 两基线同尺寸）。图标 x 间距 33 CSS px。
3. **主按钮文案随状态变**：`待确认`=`确认`、`待验收`=`完成`、`已完成`=`重开`。**r3 记录的 `确认方案` 文案在当前 build 实测不存在**（全 DOM 无 `确认方案` 字样；确认入口=卡片/ header 的 `确认`）。r3 58 的蓝钮半截素材 = 旧 build 的 `确认方案`，对拍应以 `确认` 为准 [更正]。
4. **看板卡片主按钮 = 42.3×25.8、radius 6px**：`确认`/`完成` 靛蓝底白字；`回复` 透明底 secondary 字（r3 遗留卡实测）。卡片头行右二枚：`#N` + `分支与 PR` 图标；底行：负责人头像(徽标点) + 相对时间 + 文档/重跑小图标 + 主按钮。
5. **状态芯片文案 ≠ 列名**：列 `待开始/规划中/待确认/执行中/待验收/已完成`；详情芯片实测 `待处理`(fresh·r5) / `规划中` / `确认` / `审核`(=待验收) / `已完成`。复刻需两套词表。
6. **Composer（chat 列）**：textarea placeholder 随状态：规划中/执行中=`向 Agent 补充说明，执行过程中即可送达`；待确认/待验收=`请求修改…`。工具条 `语音输入`/`添加附件`/`提及` 30×30 radius 4px 透明底；`发送` 32×32 radius 8px、空输入底 `rgb(232,226,217)`（与 r5 §2.3 一致）。chat 列宽随视口：composer 盒 668.8@1422、539.7@1152（右缘距窗 15.3–16.2 CSS px）——非固定宽。
7. **待确认 plan 卡**：chat 内折叠行 = `方案 · v1` 标题 + 单行预览（`Context …` 截断 `…`）+ ↗；展开走文档 pane（`方案▾ v1▾` + markdown 正文 Context/Changes/Verification，`v1▾` 为版本选择）。`方案▾` 下拉只是文档类型选择器。
8. **执行 transcript 结构**：时间戳行 `HH:MM 运行在 <机器名> 上` → `开始执行任务` 卡（`#N` + 标题）→ 复制/`恢复到此处` 图标对 → agent 消息（规划轮含方案卡 + `完成 30s ▸`）→ 用户 `确认` 消息泡 → 结果消息 + `完成 22s ▾` 展开工具行 pill（`> edit README.md`、`> bash cd "$(git rev-parse --show-toplevel)" …`）+ `收起 ^`；transcript 顶栏 `全部收起/全部展开`；diff pane 头 `变更▾ v1 · N 个文件改动 +N`，文件行 `README.md` + 👁，unified diff 增行绿底。
9. **验收确认弹层**：dialog 448×142.8 居中、标题 `完成任务`、复选 `将改动合并到默认分支`（默认勾选，靛蓝）、`取消` 文本钮 + `完成` 靛蓝 50.3×29.8。与 r3 76 文案一致。
10. **Token 用量弹层（有数据）**：居中 modal + `Token 用量` 标题 + 大字 `130.9k` + `tokens` 后缀 + 模型行 `r3-gw/claude-sonnet-5 130.9k` + 明细 `输入/输出/缓存读取/缓存写入`。规划完成时点实测 82.8k（输入12/输出934/缓存读54.2k/缓存写27.7k），合并后 130.9k——**弹层随运行推进刷新**。
11. **分支与 PR 弹层（有构建分支）**：顶部 tab `同步到机器`/`Git`；字段 `构建分支 tds/conv-<uuidv7>`、`目标提交 <12hex>`、`目标机器 xmonsMac-3574.local`、`同步目录`、开关 `强制同步` + 说明 `丢弃代码修改并删除非忽略的未跟踪文件；保留忽略内容。仅本次生效。`、主钮 `同步`。fresh 态旧文案 `任务尚未开始构建，暂无构建分支。`（r2）本票未复测。
12. **运行历史弹层**：`运行历史` + 行 `第 1 次运行` + `当前` 徽标 + `1 小时前 · 130.9k tokens` + `重跑`。单行态实测；多行态见 §5。
13. **开始任务弹层**（门控已解除，无 Pro 墙）：`开始任务` + `Agent` 选择（`未指派` 默认；选项行 = 头像 + `r3-builder` + `claude-sonnet-5 · 默认`）+ 开关 `规划与执行分用不同 Agent` + 钮 `先做规划` / `立即执行`。
14. **看板列几何**：列宽 292 CSS px（列头 x=285/577/869/1161/1453/1745 @1152 视口），横向滚动容器 scrollWidth 1772 / clientWidth 913；列头 = 色点 + 列名 + 计数 + 折叠钮；`已完成` 列头带 `最近 7 天`。
15. **r3 遗留卡现状**（只读复证，未动）：#1 停 `执行中` 列、chip `审核`、卡上 `回复` 钮（= 等待用户回复态）；#2 `已完成`。

## 4. 面板宽 per-state（issue 问「面板宽是否仍 560」）

| 状态 | surface | 实测 |
|---|---|---|
| 全部深层状态 | 详情全页（overlay 已下线） | 内容区 = viewport−240；chat 列 composer 盒 668.8@1422 / 539.7@1152（响应式，右贴 16 px）；文档 pane 可全宽或分栏 |
| 看板 | — | 列宽 292、6 列横滚 |
| 560 overlay | 不存在 | `?panel=todo:` redirect [更正] |

## 5. 缺口清单（未覆盖，勿当作已测）

| 缺口 | 原因 | 现有权威素材 |
|---|---|---|
| header 主按钮（`确认`/`完成`/`重开`）右缘像素素材 | §0.2 窗口面物理上限（1470 屏 + 110%）；几何已由 DOM 闭合（50.3×28/6px/indigo-600），视觉同款可由 08（卡 `完成` 全形）+ 09（弹层 `完成` 全形）替代 | 本票 08/09 + DOM |
| `执行中` live streaming（spinner+增量 transcript）全窗态 | 执行仅 22s，轮询间隔错过；`规划中` streaming 已拍（04） | r3 59/63（右缘缺）+ 本票 06b/07（静态全链） |
| 运行历史多行态 | 需重跑；票面「不强造」 | r3 74（右缘缺，3 行态） |
| 驳回回路（`请求修改`→方案 v2→再确认） | 未实走（同 r3 §9 遗留） | 无 |
| `复用方案` 弹层（重跑第三钮 + `查看方案`/`直接执行`） | 未触发（需重跑入口） | r3 80/81（右缘缺） |
| 失败态 | 本轮零失败，未自然出现 | r3 77–79 |
| 深色主题深层状态 | 本票全 light | r3 批（右缘缺） |
| `全屏 · F`/`关闭` 图标 | 旧 overlay 控件，当前 build 详情 header 实测无 | r5 §2.2（该 surface 已下线） |

## 6. 对 #42 像素复刻的直接影响

1. 复刻目标 surface 应为**全页详情**（`/app/todo/:id`），不是 560 右贴面板；原型 `prototype/42` 若按 r5 §2.1 面板模型建，需重对齐。
2. 主按钮文案表：`确认`/`完成`/`重开`（非 `确认方案`）；尺寸 50.3×28（header）与 42.3×25.8（卡片）两套。
3. 对拍 harness 截图视口上限 ≈ 屏宽 DIP÷1.1（本机 1293 CSS px）；要 1422 全窗需外接屏或降 tab 缩放。
4. 状态芯片两套词表（列名 vs 芯片：`待验收`↔`审核`、`待确认`↔`确认`、fresh↔`待处理`）。

## 7. 盘点后 space 状态

- TaskSpace 2 恢复为接手时的 p1/p5（均停 `/app/`）；本票临时页 p6/p7/p8 已关闭。
- 探针 #4 已删（UI + API 双验零残留）；r3 遗留 #1/#2 未动。
- todos.dev origin 的 tab 缩放保持 110%（CDP 键事件无法改浏览器缩放，实测无副作用）。
- 机器 `xmonsMac-3574.local` 仍在线；`r3-lifecycle` 项目 hosted repo 的 main 新增一行 `r5b lifecycle probe`（合并步产物，与 r3 探针行同性质，非任务残留）。
