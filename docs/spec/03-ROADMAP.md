# 03 · 构建顺序 ROADMAP（追认式，#45 终稿）

> 正典地位：本册 = 复刻实现的全量构建顺序与里程碑验收索引。像素/功能平价的具体验收规则在 `04-验收口径.md`；架构义务在 `02-架构平价.md`；栈与 pin 在 `01-stack-v2.md`；地基在 `00-地基决议.md`。
> 裁决来源：#45 grilling 八问（2026-09-22），逐项记录见 issue resolution comment。

## 0. 结论一览

| # | 裁决 |
|---|------|
| R1 | 通知维持有意 divergence：SSE + 页内 `new Notification()`（`document.hidden` 时弹），Web Push 不进 spec（02 §9.1 已终裁回填） |
| R2 | ROADMAP 为**追认式**：UI-first 既成事实（#52–#58）收编为已过里程碑，全构建顺序一册覆盖 |
| R3 | spec 分册最小新增：本册 + 04 册；现有 00/01/02/素材替换计划四册不重组 |
| R4 | [推断] 44 处不清零（1:1 口径允许黑盒逼近）；不再开内构研究票；遗留证据清单见 04 册附录 A |
| R5 | 两线并行：web 像素线续 #52 自有票流；后端线 shared → server → daemon → 编排；汇合 = fixture 切真 API |
| R6 | 基线补拍混合制：动态面集中一张 r8 票（趁 tds+BYOK 环境在），静态面逐 web 票随拍 |
| R7 | 功能平价双层验收：wire 层逐字段自动化进 CI + 行为层场景清单半自动 E2E（04 册 §3/§4） |
| R8 | 本册 + 04 册落盘 = 地图 #34 destination 到达；雾项处置见 §6；wayfinder 退役，实现 effort 自有票流续走 |

## 1. 定位与两线结构

票面原设「先最小可跑内核，UI 后铺」；实际执行 UI 像素面先行（#42 原型 → #52 伞票 → #53–#58），已产出 apps/web 双屏 + parity 对拍 harness + CI 门禁（31 行矩阵 0 失败）。本册追认该事实为 M0，不回退不重排。

两线并行（R5）：

- **web 像素线**：不依赖后端（fixture/scenario 契约，`?scenario=<r7编号>`，仅 parity/dev 模式存活）。续 #52 票流切分：弹层票、路由票（每路由一张）、动效票、i18n 票；每张票验收增量 = 对拍矩阵加行（04 册 §2）。
- **后端线**：M1 shared → M2 server → M3 daemon → M4 编排，包边界即 01 §3 monorepo 布局。
- **汇合点 M5**：web 从 fixture 切真 API，端到端生命周期实跑；M6 功能平价终验。

## 2. 里程碑

### M0 · UI 像素骨架 + 双屏【已过，追认】

- 交付（已 merge）：apps/web 骨架（#53）、看板基面/卡态（#54/#55）、详情基面/深层（#56/#57）、收尾导航闭环 + 全矩阵终验（#58）。
- 验收（已达成）：parity 31 行矩阵 0 失败进 CI（typecheck + biome + parity）；阈值体系定型见 04 册 §2。

### M0+ · web 线剩余面（与 M1–M4 并行）

- 范围：13 缺路由（schedules / project×3 / resources×6 / team / account / api-keys / feedback）；~14 类弹层（新建任务 dialog、开始任务、⌘K 搜索、更多菜单、chip popover、plan 类型下拉、删除确认、Token 用量、分支与 PR、运行历史、验收确认、交互用户菜单、AI 审核钮）；动效/拖拽排序；live streaming；i18n 接线；Chief 面板。
- PWA 注记：manifest/sw.js 按 01 §4 字节级搬义务执行；**sw.js push handler 保留文件形状、服务端不投 push**（R1 divergence，04 册 §5 验收口径）。
- 前置依赖：动态面（驳回回路/失败态/复用方案/运行历史多行）**无 r7 基线素材**——r8 集中补拍票（§4）先行；静态面随票随拍（R6）。
- 切票与验收：每票加矩阵行 + 单屏阈值按 04 册 §2 规则。

### M1 · shared 包

- 范围：协议词表 schema（02 §5/§6 全量）、record 形状（02 §6.2，24 表投影源）、phase 九值枚举（02 §4.1）、品牌串命名常量表（02 §5.8）。
- 验收：词表 schema 快照测试绿（01 §7.4）；不发明 02 之外字段形状（01 §6 migration 纪律）。

### M2 · server

- 范围：Hono REST + SSE 全端点（02 §6.1 词表，全 SSE 无 WS）；SQLite + Drizzle 24 表 migration 进 repo（01 §6）；git http-backend 本地 bare 托管 + GitHub 接入双形态（02 §3）；cron 定时（02 §9.2 词表照抄）；通知 SSE 事件（02 §9.1 + R1 divergence）；搜索 `GET /api/search`（自设，02 §6.3）；SecretBox keyfile 三层密钥（02 §8，细案 = 01 §4.2 移交项）；单用户 seed + team 保形（02 §2）。
- 验收：M2 面端点 wire 对拍绿（04 册 §3）；行为层 M2 场景清单（04 册 §4）。

### M3 · daemon（executor）

- 范围：纯 JS npm 包（01 §4.3）；pi 0.85.1 经 `AgentBackend` 缝消费（01 §5 签名闭环，缝外 import = lint 红）；机器协议 claim~75s + SSE wake、`/api/machine/*` 全词表（02 §5）；worktree 契约（`tds/conv-*`、checkpoint、7 天回收）；step 三类执行 + journal；upload-urls 回传；merge `202 delegated`；per-step 凭证下发不落盘（02 §8）。
- 验收：executor 协议逐字段对拍（02 §5 canonical）；单机生命周期 todo→done 实跑（02 §4.2 主时序 = E2E 脊柱）。
- **T2 时间盒（00 册移交，本册定）**：M3 首张票内验证 `AgentSession` 缝撑宿主 durable 编排（step 队列持久 + recover）；时间盒 = M3 第一张票；撑不住即触发 00/T2 重估 D3，**不拖入 M4**。

### M4 · 编排

- 范围：Chief = 特例 Agent（pi 会话 + `remoteTools[]` relay，49 词表按 02 §4.3 + r5 §2 黑盒逼近）；措辞→spec 三段变换（r5 §2.3）；分派职责文本权重（r5 §2.4 A/B 实证）；memory 写路径（`save_memory`、指令触发+裁量、溯源形状、配额 100，02 §4.4/r5 §6）；驳回回路 plan v2 + unified diff（02 §4.2/r5 §4）；双 Agent 分派 `assignment:{plan,build}`（r5 §5）；MCP 双面（团队 server per-Agent 授权 + 远程 MCP + key 级工具白名单，02 §7）；通知矩阵 in-app 三事件（02 §9.1 r5 改判）。
- 验收：行为层 M4 场景清单 = r5 六项实测逐条对照（04 册 §4）；memory 读侧注入形等 [推断] 项触到即验证回写（04 册附录 A）。

### M5 · 汇合

- 范围：web fixture 切真 API（scenario 参数退役为 dev-only 或删）；live streaming 接真 SSE；r8 补拍基线进矩阵；端到端生命周期 UI 实跑（新建→规划→确认→执行→审核→合并→done，含驳回支线与定时轮）。
- 验收：全矩阵（含 r8 新基线行）0 失败；E2E 主时序全链绿（01 §7.4）。

### M6 · 功能平价终验

- 范围：04 册全部口径终验——像素矩阵全跑、wire 对拍全绿、行为层清单逐条核、真人一次项（OS 通知权限弹窗、桌面通知实弹、OAuth 连订阅）。
- 出口：验收报告落 `docs/spec/`（或 parity/output 存档）；升级票开窗（§3）。

## 3. 升级窗口与节奏（01 §9 / 00 册移交项汇编）

| 项 | 节奏 |
|---|------|
| pi 0.86.0 | M3 期间首个 D6 升级窗口：读 Breaking 段，过 `AgentBackend` 缝回归 |
| TS 7.0.2 / react-router 8.4.0 / Tailwind 4.x | M6 验收后各自成票（承旧升级票纪律） |
| turbo | CI 时长成痛点时触发，不预装 |
| transcript 虚拟滚动 | 实现期按实测定，不预锁（@tanstack/react-virtual 候选） |
| T1/T3 触发条款 | 随时可触发，回写 00 册 + 对应票 comment |

## 4. r8 集中补拍票（R6）

- **实现 effort 第一张研究票**（不属地图 #34；地图已关）：动态面基线补拍——驳回回路各态、失败态、`复用方案` 弹层、运行历史多行 + `重跑` 钮；顺带 r7 §6 缺口表中需真实 build 触发的项（AI 审核钮点击后行为）。
- 前置：本机 tds + BYOK 链路可用（r3/r5 会话已打通；机器离线先 `tds start`）；环境有失效风险（站点已三次漂移），**优先排期**。
- 纪律：截图编号续 r7（54+），落 `docs/research/assets/r8/`；产出 `docs/research/r8-*.md`；新基线进 parity matrix 引用。
- 静态面（资源页弹窗表单、dark 弹层、搜索面板结果态）：不开集中票，各 web 实现票内置前置补拍动作。

## 5. 每阶段验收清单索引

| 里程碑 | 像素层 | wire 层 | 行为层 |
|---|---|---|---|
| M0+/每 web 票 | 矩阵加行（04 §2） | — | — |
| M1 | — | schema 快照（04 §3） | — |
| M2 | — | M2 端点对拍 | M2 场景（04 §4） |
| M3 | — | machine 协议对拍 | 单机生命周期实跑 |
| M4 | — | — | r5 六项对照（04 §4） |
| M5 | 全矩阵 + r8 行 | 全端点 | E2E 主时序全链 |
| M6 | 终验 | 终验 | 清单逐条 + 真人一次项 |

## 6. 雾处置记录（R8，地图 #34 收尾）

| 原雾项 | 处置 |
|---|------|
| 分屏幕 UI 规格切分 + 像素 diff 工具 | 被现实吸收：#52 票流切分（弹层/路由/动效/i18n 票）+ #53 parity harness 已建成；规则定型入 04 册 §2 |
| preview-token / tds-tunnel | 转 04 册附录 B：实现期见到 UI/wire 触点再 graduate 设计票（02 §9.3 在册不设计不变） |
| spec 分册结构与出版格式 | 本册 + 04 册落盘即终稿（R3） |
| 执行 effort 启动与组织 | 已自发启动（web 线 #52–#58 实跑）；组织方式 = `ready-for-agent` 票 + 逐票实现会话；后端线按本册 §2 里程碑切票 |

## 7. 交接

- 地图 #34：Decisions-so-far 补齐后关闭；wayfinder 退役。
- 实现票纪律：每票自足（引用正典册章节，不复述）；票间上下文可弃；web 线续 `web/NN-*` 分支 + PR，后端线同型。
- 遗留 [推断] 与证据缺口：04 册附录 A 清单，实现期触到就地验证，结果回写 02 §11。
