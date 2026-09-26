# R9 · 附件/提及交互规格补采（+ 停止钮/标签/菜单桩顺带全站扫描）

> 目的：M7-W1 总账票 #303 的规格补采——08 册 §3 story 7/8 的「附件」「提及」
> 两处交互（composer + 新建任务对话框）以 r8 §3.1 实测先例的格式落规格；
> 顺带（08 册 §7 护栏 1「补采顺带全站扫描」）采集台账校准中浮出的无规格项：
> 停止钮确认弹层、新建任务标签面、chief ⋮ 菜单、定时卡片 ⋮ 菜单、开始任务
> dialog（Agent 行/机器行/分用开关）。
> 素材：Ego 浏览器 TaskSpace「todos.dev M7-W1 附件提及补采」（spaceId 24），
> free 档已登录账号（Xmon Dai / 团队 `BoZYfvqKSGanlxsXVbXSa`）。
> 盘点时间：2026-09-26 22:36–23:0x（本地 Asia/Shanghai）。票：#303。
> 编号纪律（04 附录 C）：续 r8（78 后首空号 = 79），落 `docs/research/assets/r9/`。

## 0. 方法与环境

- 视口 **1470×728 CSS**（Ego 原生窗口，无 override），主题 **light**，语言 zh
  （`tds.locale=zh`）。截图 = 1:1 CSS px 位图存 `assets/r9/`。
- 本会话 Read 工具经 API 网关读图返回空（首发已知坑，见 wiki），**几何全部以
  DOM `getBoundingClientRect()` 实测为准**，截图仅作人工复核存档——与 r8 的
  sips 核验路径不同，标注为 [DOM 实测]。
- wire 采集 = 页面内 `window.fetch` 包装钩子（请求/响应 JSON 抄录落
  `assets/r9/raw/wire-captures.json`）；仅覆盖 fetch 通道，标签删除等方法未滤。
- 探针：`r9-probe.md`（94 B text/markdown，/tmp）；探针 todo ×2（#18 附件提及
  wire 验证 / 「r9 开始对话框探针」）+ 探针标签 ×2 + 探针定时 ×1，全部收尾
  删除（§6）。#12 为长驻失败 todo，被用作 composer 面（发送一条带提及消息后
  状态改变，见 §3.3/§6）。

## 1. 截图清单（`docs/research/assets/r9/`，31 张 + `raw/`）

| 文件 | 状态 | 备注 |
|---|---|---|
| 79-failed-composer-light | #12 失败态详情 | composer 请求修改… + 三工具钮 |
| 80-提及-popover-light | 点「提及」 | 五分组首层 |
| 81-提及-任务分组展开-light | 钻入「任务」 | 搜索框 + 3 行任务 |
| 82-提及-插入后-light | 插入后 composer | ` #1 ` 纯文本 token |
| 83-提及-@内联列表-light | composer 键入 `@` | agents 内联 listbox |
| 84-提及-@agent插入后-light | 选 r3-builder | ` @r3-builder ` token |
| 85-提及-发送后-light | 发送（失败面触新轮） | 消息行 chip 渲染 |
| 86-运行中-composer-停止钮-light | 新轮运行中 | 停止钮 32×32 与发送并存 |
| 87-停止-确认弹层-light | 点停止 | 确认弹层 + 默认勾选 checkbox |
| 88-停止-确认后状态-light | 确认停止后 | 运行行「已取消」，todo → 审核 |
| 89-附件-选择后composer-light | 选文件后 | composer 内附件 token |
| 90-附件-发送后-light | 发送后 | transcript 附件行 |
| 91-附件-steer发送后-light | 运行中发带附件 steer | 混合行 chip + 文本 |
| 92-新建任务-工具条-light | 新建任务对话框 | 添加标签 + 三工具钮 |
| 93-新建任务-标签面-light | 点添加标签 | 空标签列表 + 新建入口 |
| 94-新建任务-新建标签-light | 点新建标签 | 内联名称输入 + 保存 |
| 95-新建任务-标签chip-light | 建后选中态 | 列表 pill 选中（indigo 底） |
| 96-新建任务-标签选中footer-light | 选中关面后 | footer 标签 chip + 虚线圈添加钮 |
| 97-新建任务-附件提及-light | 附件已入描述 | 提及弹层同款五分组 |
| 98-新建任务-提及插入后-light | 插入 @r3-builder | 描述 = 提及 token + 附件 token |
| 99-新建任务-保存后看板-light | 保存 | #18 落待开始 |
| 100-探针任务-详情标签行-light | #18 详情 | 标签 chip + 描述 chip 渲染 |
| 101-chief-更多菜单-light | chief 头部 ⋮ | 更换图标/重命名主题/删除主题 |
| 102-定时-新建表单-light | 新建定时表单 | 与 pacman 同形 |
| 103-定时-卡片-light | 保存后卡片 | 每天 09:00 · 下次 · 自动 |
| 104-定时-卡片更多菜单-light | 卡片 ⋮ | 编辑/移除 |
| 105-定时-移除后-light | 移除后 | 无确认弹层，回到空态 |
| 106-开始任务dialog-light | 待开始 todo 点「开始」 | Agent 行未指派 + 机器行 |
| 107-开始任务-agent选择器-light | 点 Agent 行 | 选择 Agent 弹层（含未指派） |
| 108-开始任务-分用开关后-light | 开分用开关 | 规划/执行双 Agent 行 |

`raw/`：`wire-captures.json`（§4 全录）。

## 2. DOM 几何实测 @1470×728（[DOM 实测]，对拍以截图人工复核）

### 2.1 详情 composer（79/86/89）

容器 704×84 @ (256,636)（rounded-xl border）；textarea 678×28 @ (269,645)
（field-sizing:content，min 28 / max 160）；工具钮 30×30 pitch 36 @ (269/305/341,680)，
18×18 图标内嵌；运行中 **停止钮 32×32 @ (865,679) 与发送钮 32×32 @ (915,679)
并存**（pitch 50）；发送钮空稿态底色 rgb(232,226,217)（surface-hover 族）。

### 2.2 提及弹层（80/81）

- 首层：全屏 scrim + 居中面板 **400×272 @ (535,228)**；标题「提及」339×20 @
  (551,242) + 关闭 × 27×27 @ (898,238)；5 分组行 44 高 pitch 45：任务(3)/技能(1)/
  Agents(2)/项目(1)/机器(1)——行内 28×28 图标 + 标签 + 右缘计数（x=911）。
- 钻入后：面板长高；头部 = 返回箭头 + 分组名 + 计数徽标；**搜索框 351×28 @
  (568,194)**（placeholder「搜索…」）；行 400×49-50 pitch 50：`#seq 标题`（304 宽）
  + 相位 chip（右缘 x≈893）+ 副行（项目名 + 相对时间）。
- 底部动作条：**「取消」25×16 @ (804,553) + 「插入 (N)」43×16 @ (863,553)**——
  多选累积，N = 已选数。
- composer 内联 `@` 补全（83）：listbox 702×68 @ (257,559)（贴 composer 上缘），
  agents 行 = 头像 + 名 + 描述。

### 2.3 停止确认弹层（87）

全屏 scrim + 居中面板（400 族）；标题「停止当前这一轮？」319×20 @ (561,306) +
关闭 × 27×27 @ (888,303)；**自绘 checkbox 16×16 @ (561,362)**（选中 = indigo-600
底 rgb(79,70,229) + 白勾 svg，**默认勾选**）+ 标签「丢弃本轮修改——方案和代码回到
上一个版本」324×16 @ (585,361)；按钮「取消」25×16 @ (826,401) /「停止」25×16 @
(871,401)（右为主）。

### 2.4 附件 token（89/98）

textarea 隐形文字层 + aria-hidden 覆盖层渲染：附件/提及 token 均为
`<span style="color:rgb(99,102,241); background-color:rgba(99,102,241,0.15);
border-radius:3px"> token </span>`——**indigo-500 文字 + indigo/10 底 + 3px 圆角**
（与 pacman chat-code chip 同视觉族）；普通文字 span 色 rgb(28,25,23)。

### 2.5 新建任务标签面（93–96）

- 添加标签触发钮（footer 标签行）：**20×20 虚线圆**（`rounded-full border
  border-dashed border-line-strong`）+ 9×9 加号。
- 标签面板：448 族（max-width 448）居中；标题「标签」+ ×；**已选/标签 pill 区**
  （flex-wrap gap 1.5）：pill = `rounded-full px-2 py-1` + text-xs font-medium，
  **未选中底 bg-surface-tertiary / 选中底 indigo-500 rgb(99,102,241)**；分隔线下
  「+ 新建标签」行 60×16。
- 新建态：内联「标签名称」input 357×28 @ (527,405) + 保存。
- 选中后 footer：标签 chip 47×20 @ (441,513)（indigo-500 底、rounded-full）+
  虚线圆添加钮 20×20 @ (497,513)。

### 2.6 开始任务 dialog（106–108）

居中 448 族；**Agent 行**（未指派态可点 → 「选择 Agent」弹层：未指派 +
r3-builder（claude-sonnet-5 · 默认）+ r5-scribe（qwen3.8-max · 默认））；
**机器行**「自动 / xmonsMac-3574.local（在线）」；「规划与执行分用不同 Agent」
开关——**OFF = 单 Agent 行；ON = 「规划」「执行」两条独立 Agent 行**（各自可
再点开选择器）；底部「先做规划」「立即执行」。

## 3. 行为裁定

### 3.1 附件（主项；composer + 新建任务两处）

- 触发：composer/新建任务工具条「添加附件」（30×30）→ 原生文件选择器（单选
  观测；多选能力未测）。
- 选中后：**token 落 textarea 隐形文字层**（值 ` r9-probe.md `，覆盖层渲染
  indigo chip，§2.4）；光标仍可继续键入（caret-color 正常）。
- **wire 三步（两处同形）**：
  1. `POST /api/uploads/grant` body `{kind:"attachment", teamId, fileName,
     mimeType, size}` → 200 `{uploadUrl, grant(签名 JWT：category=attachment/
     container=resources/key/maxBytes/userId/ownerId/exp), key:
     attachments/{teamId}/{id}.{ext}}`；
  2. `POST {uploadUrl}/upload`（FormData 文件本体 + grant）——上传走**独立
     upload host**（upload.todos.dev），与 API host 分离；
  3. 消息 content 序列化 = **`![文件名](attachment:attachments/{teamId}/{id}.md)`**
     （markdown image 语法 + `attachment:` scheme）。
- 发送通道随相位分流：**运行中 = 专用 `POST /api/conversations/{id}/steer`
  body `{content}`**（≠ pacman 现行的 messages 端点复用——pacman #280 走
  `POST /conversations/{id}/messages` build 分支；todos.dev 实测为独立 steer
  路径）；review 相位发送走既有 `POST /api/builds/{id}/steps`（body 未及捕获，
  钩子在发送后才装上）。
- 新建任务对话框：附件 token 落**描述 textarea**，随创建进 spec——
  `POST /api/projects/{id}/todos` body `{title, spec, tagIds}`（spec 内嵌
  attachment markdown，§4）。
- transcript 渲染：附件消息行 = 附件 chip 单独成行（90）；附件 + 文本混合行 =
  chip + 文本同行（91）。**详情描述渲染**（100）：附件 chip 扩展元数据
  `MD · 94 B · 2 分钟前`（类型徽标 + 字节数 + 上传相对时间）。
- agent 侧消费：本轮机器 run 卡在「重试中 n/7」循环（本会话机器 daemon 半死
  态），附件被 agent 取用的实证未取得——chief-tools/mcp 词表的 `attachment`
  工具（attachmentId 取附件）与 r1 §7.4 文档记载为间接证据。

### 3.2 提及（主项；两处 + 内联补全）

- **工具条「提及」钮** → 五分组弹层（任务/技能/Agents/项目/机器，各带计数）→
  钻入分组（返回箭头 + 搜索框 + 行）→ **行点击 = 累积多选**（无勾选标记视觉，
  底部「插入 (N)」计数联动；再点同行 = 取消）→「插入」关层落 composer。
- **插入形态（纯文本 token + 覆盖层 chip）**：任务 = ` #1 `（#seq）；Agent =
  ` @r3-builder `（@名）。任务行可混选多类对象（多选计数实测 1，多对象组合
  未逐一测）。
- **composer 内联补全**：键入 `@` → 贴 composer 上缘 listbox（**仅 agents**，
  头像 + 名 + 职责描述）→ 点选插入 ` @r3-builder `（Enter 语义混入了发送行为，
  见 §5）。
- **wire 序列化**：`@r3-builder` → **`[r3-builder](agent:{agentId})`**（markdown
  link + `agent:` scheme，与 attachment 同族设计）；任务提及 `#1` 在消息内按
  #seq 留存（transcript 渲染为 todo chip，85）。
- transcript 渲染：提及 token 呈现为实体 chip（`@` + 名 / `#` + seq，85 消息行）；
  详情描述（100）`r3-builder` 渲染为 agent chip。
- 新建任务对话框的「提及」= 同款五分组弹层，token 落描述 textarea（98）。

### 3.3 停止钮（顺带主证，#308 规格输入）

- 显隐：仅运行中态渲染（失败/只读面无，79 三钮无停止）；运行中 **停止 32×32
  与发送并存**（86）——pacman composer 同形（r7 16 家族）。
- 点击 → **确认弹层**（87）：「停止当前这一轮？」+ **默认勾选**「丢弃本轮
  修改——方案和代码回到上一个版本」+ 取消/停止。r1 changelog 2026-09-16
  原文（英文站）的中文现站逐字对应，语义 = 勾选则 rewind worktree/branch/
  session 到上一 checkpoint。
- 确认后：transcript 运行行出现「**正在停止…**」过渡态（机器侧中断在途，
  r1 changelog 09-15「取消即时生效」的 machine-channel 事件）→ 运行行终态
  「**已取消**」；**todo 落在上一完成 turn 的 gate**（#12 失败重跑轮被停 →
  审核 相位 + 变更 v1 面保留，88）。
- 失败面 composer 附带发现：placeholder = 「请求修改…」（可写）；**发送消息
  触发新一轮执行**（85：`@ #1` 消息发出后 #12 从 failed 转入新一轮运行，
  非纯 steer 语义——失败态发消息 = 带反馈重启）。

### 3.4 标签（顺带，#309 规格输入）

- 新建任务 footer「添加标签」虚线圆 → 标签面板：**已有标签 pill 列表（点击
  toggle 选中）+ 「+ 新建标签」**；新建 = 内联名称输入 + 保存（color 客户端
  缺省 `#6366f1`）。
- wire：`POST /api/projects/{id}/tags` body `{name, color}` → tag record
  `{id, projectId, name, color, createdAt, v}`（**pacman tagRecordSchema 缺
  color/createdAt/v 三位**）；**创建任务随 body 携带 `tagIds:[]`**（pacman
  createTodoBodySchema 缺此位）。
- 渲染：footer 选中 chip（indigo 底 pill）；**fresh 详情 meta 区标签 chip**
  （100，66×20 indigo 底）；看板卡不渲染标签（本轮 DOM 查询无 pill）。
- 管理/删除：**项目设置「标签」tab**（基本信息|仓库|标签）= 标签管理面——
  行（名 + N 个 todo）+ 双图标钮（编辑/删除）；删除 → 确认弹层「将从所有
  todo 中移除？」→ 确认即删。REST 直删路径未采（`DELETE tags/{tid}` 404）。
- 附带：新建任务对话框带未保存内容关闭 → **「放弃新建任务？未保存的内容将
  丢失。」确认弹层**（继续编辑/放弃并关闭）——pacman 关闭直关无闸。

### 3.5 菜单桩内容（顺带，#306 规格输入）

- **chief 抽屉头部 ⋮（101）=「更换图标 / 重命名主题 / 删除主题」**三行
  （r1 changelog 09-08 topic emoji 图标 + 双击改名 + PATCH title/emoji 的
  UI 入口）。另实测：chief 头部钮序 = 新主题/总管设置/更多/**全屏 · F**
  （全屏带 F 快捷键标注）/关闭；**chief composer 工具条 = 语音/添加附件/
  提及**（pacman #136 已按「无后端面」移除后三项中的两项——附件/提及的
  回插归 #310/#311 裁量）。
- **定时卡片 ⋮（104）=「编辑 / 移除」**两行；移除**无确认弹层**即时生效
  （105）；编辑行为未点开（与新建表单同形推断）。卡片 = `#seq 标题` + 相位
  chip + `频率 HH:mm` + 下次 + · 自动 · 项目（103）。

### 3.6 开始任务 dialog（顺带，pacman RerunDialog 家族差距正源）

待开始 todo 点「开始」→ **先开 dialog 再跑**（pacman 待开始 = 直接 startBuild
无 dialog——[设计] 缺省语义差距）；dialog = Agent 行（选择器含「未指派」）+
**机器行（自动/指定机器 + 在线圆点）** + 分用开关 + 先做规划/立即执行。
分用开关 ON = 规划/执行双 Agent 行独立选择（108）——**与 pacman server
assignment.plan/build 双槽一一对位**。失败重跑 dialog（r8 56/74）与本 dialog
同族（复用方案第三钮仅失败态出现，r8 §3.4）。

## 4. wire 全录（原始抄录见 `raw/wire-captures.json`）

| 端点 | 方法 | 形状 | pacman 对位 |
|---|---|---|---|
| `/api/uploads/grant` | POST | `{kind,teamId,fileName,mimeType,size}` → `{uploadUrl,grant,key}` | **无**（#310 需新建） |
| `https://upload.todos.dev/upload` | POST | FormData（grant + 文件） | **无**（独立上传 host；pacman local-first 可并入同源或对齐分离） |
| `/api/conversations/{id}/steer` | POST | `{content}`（附件/提及 markdown 内嵌） | pacman 走 `POST /conversations/{id}/messages` build 分支（#280）——**端点路径分叉，载荷同义** |
| `/api/projects/{id}/todos` | POST | `{title,spec,tagIds}` | pacman 缺 `tagIds` 位（#309） |
| `/api/projects/{id}/tags` | POST | `{name,color}` | **无**（#309 需新建；tag record 缺 color/createdAt/v） |
| `POST /api/builds/{id}/steps` | POST | （review 相位消息 + 附件；body 未及捕获） | pacman 已有（revision/confirm 同端点） |

## 5. 缺口清单（未采，勿当作已测）

| 缺口 | 原因 | 去向 |
|---|---|---|
| `复用方案 → 查看方案` 点击行为 | 本轮无 failed-with-plan 主体（#12 停止后落 review） | 沿 r8 §5 登记；归 #312 票前补采或 [设计] 裁定 |
| 多文件附件 / 拖拽入 composer | 单文件路径单次实测 | #310 施工期按需补 |
| 附件被 agent 实际消费（工具调用往返） | 机器 run 卡重试循环（daemon 半死） | #310 integration 侧自证 |
| 附件/提及 token 的退格原子性 | backspace 观察被 token 保护干扰 | #310 施工期 UI 细节 |
| 标签删除 wire 方法 | 钩子只滤 POST/PUT；REST 直删 404 | #309 施工期 UI 路径实现（项目设置标签 tab） |
| tags PATCH（改名/改色）、提及多对象混选组合 | 时间预算 | 后续按需 |
| `Enter` 在内联 @ listbox 的确切语义（本轮观测 = 选中的同时把消息发出） | 单次观测疑似焦点竞态 | #311 施工期注意：列表选中用点击，Enter 语义需复核 |
| 语音输入钮行为 | M7 C5 wontfix（08 册） | 不采 |

## 6. 探针生命周期与零残留

| 时刻 | 事件 |
|---|---|
| 22:3x | #12 详情面：提及插入 `#1` → 发送（消息 `@ #1` 落 transcript；**failed 面发送触发新一轮**） |
| 22:4x | 运行中 composer（steer placeholder）→ 停止钮 → 确认弹层（默认勾选）→ 停止 → `已取消`，#12 → 审核 |
| 22:4x | 附件三步 wire（grant/upload/steer content）；运行中发带附件 steer（transcript 混合行） |
| 22:4x | 第二轮 run 再次重试循环 → 第二次停止确认（同弹层）→ #12 复落审核 |
| 22:4x | 新建任务：附件入描述 + 提及 @r3-builder + 建标签 r9probe + 选中 → 保存 → **createTodo wire 全录**（#18） |
| 22:4x | #18 详情面核渲染（标签 chip + 描述 chip + 附件元数据行）→ 更多 → 删除 → 确认 → 删除 |
| 22:5x | 标签管理（项目设置标签 tab）：r9probe/r9probe2 双删（确认弹层 ×2） |
| 22:5x | 定时探针：新建（默认每天 09:00）→ 卡片 + ⋮ 菜单（编辑/移除）→ 移除（无确认） |
| 23:0x | 开始任务 dialog 探针：建 todo → 开始 → dialog + Agent 选择器 + 分用开关 → Esc → 删除 todo |

验证（API 复核）：todos = 原驻留 6 条（#1 review / #2 done / #11 done / **#12
review** / #13 review / #14 done）；tags = `[]`；定时空态。**唯一状态残留 =
#12 failed → review**（停止+丢弃的合法落态，r1 changelog 09-16 语义的直接
实证；r8 期 #12 为 failed）。TaskSpace 24 已 finish（keep: []）。
