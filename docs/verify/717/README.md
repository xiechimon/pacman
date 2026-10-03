# #717 判因：m5 CI 间歇红的 UI 面钉死——查询层吞掉挂载取数期间到达的失效

## 结论一句话

两次新 CI 命中（#718 诊断增强合入后）按票面判据均落 `DB plans 行 ≥1` ⇒ **UI 刷新面**。
断的环节不在 SSE 建连/重连/事件发布，而在**失效落地的查询层**：react-query 对
「挂载取数在飞（`data === undefined`）时到达的 invalidate」无法取消该次取数
（cancel 以已有数据为前提，query-core 5.103.1 `query.cjs:300`），失效被去重并进
那次**事件前**读服务器的取数；旧快照落地后 success 动作不重排取数
（reducer，`query.cjs:438`）⇒ 提示永久丢失，界面停在事件前的值。
修复 = 失效收敛缝 `apps/web/src/api/invalidate.ts`：对「失效时仍在挂载取数」的
查询，在其 settle 后补一轮失效，保证每次提示都换来一次**失效之后发出**的取数。

## 命中与签名判读

### 命中 1：main run 37125887924（push fbd8293b，含 #718/#666/XMON-59/60）——2 用例红

原始日志：`ci-dump-main-run-37125887924.log`。

**脊柱「plan 卡 v1 上屏」30s 超时（签名 F1，#713 同形）**，dump 四环证据：

| 环 | 读数 | 判读 |
| --- | --- | --- |
| UI chip | `"确认"` | 相位链（todo 查询）已收敛 |
| server 相位 | `confirm` | 服务端走完 plan→confirm |
| DB plans | **1 条**（v1@1791033787828） | plan 行已落库 ⇒ 票面判据：UI 刷新面 |
| stub 计数 | 2（规划轮两次调用） | daemon/模型面正常（#698 口径对账成立） |

chip 翻了 ⇒ team/conv 至少一条流的事件到达；而 #666 之后 team todo 事件、conv
message/step 事件**都**带 `['plans']` 失效，且服务端发布序恒在 plan 行落库之后
（`machines.ts receivePlanUpload`：落库即 `publishStepStatus`，XMON-59）。
⇒ plans 失效确实在落库后发出过，却在查询层丢失——chip（todo 查询，数据早已
定义，cancelRefetch 路径正常）与 plan 卡（plans 查询，openDetail 后挂载取数在
2 核 runner 上被十余个并发查询拖长）在同一批事件下分叉，正是吞失效的选择性形态。

**驳回支线「plan 卡 v2 上屏」30s 超时（签名 F2 = 级联噪声，非独立缺陷）**：
脊柱早退只消费共享顺序脚本 13 条中的前 2 条 ⇒ 驳回支线拿到错位响应
（build/merge 脚本），3 个 plan/done 步 + 仅 v1 行 + 请求时刻 31s 空窗全部可按
错位对账（#698 judgment F2 同指纹；本 dump 中 `stub 请求时刻 0,31,31249,…` 的
0/31 为脊柱轮，31249+ 才是驳回轮）。放大器修复归 stub harness 面（见「留待裁决」）。

### 命中 2：PR run 37125498051（t-0086 分支 b1528d7d，含 #718）——1 用例红

原始日志：`ci-dump-pr-run-37125498051.log`。

**驳回支线 `waitChip(/规划中/)` 150s 超时（#686/#697/#711 历史签名）**，dump：

- DB plans **2 条**：v1@1791033377720、v2@1791033378044；
- DB steps 2 条 plan/done：修订步创建于 @1791033377856；
- stub 9 次请求全部落在 2504ms 内（0,31,393,422,1049 ‖ 2106,2128,2490,2504；
  前 5 次为脊柱用例，后 4 次为驳回两轮）。

⇒ 修订步创建 → v2 落库仅 **188ms**：服务端在亚秒内走完 reject→replan→confirm。
刷新链是采样式（S8 canon：事件仅作提示，状态全靠失效重取）——重取到达服务端时
相位早已翻回 confirm，chip 物理上采不到「规划中」。此形态**不是失效丢失**
（todo 查询数据已定义，取消+重取路径正常，本 PR 的收敛缝与之无关），而是
**亚秒瞬态在采样式架构下不可观察**。真实 LLM 下 planning 窗口为几十秒，产品面
无影响；stub 速度轮次 + 要求看见瞬态的测试 oracle 才会命中。处置见「留待裁决 1」。

## 三层看护为什么全没兜住（F1 的结构性盲区）

- **XMON-60 业务静默对账**：闸门 = 缓存里存在 planning/building 相位 todo。
  F1 卡住时相位已是 confirm ⇒ 闸门关，对账不触发（#666 注释自己点名过这一盲区）。
- **#462 完全静默看门狗**：服务端 15s 心跳 ping 保活 ⇒ 永不满足「完全静默」。
- **seq 空洞对账**：需要先漏帧；F1 无漏帧——事件到了、失效也发了，丢在查询层。

⇒ 事件层三重保险都在，洞在其下游。#666（事件带 plans 键）与 XMON-59（落库点
即发 step 事件）都是在**事件层**加保险，所以 F1 仍然复发——本次把收口下沉到
失效落地这一层。

## 复现与修复（确定性，不依赖 CI 复现）

- **复现**：`apps/web/test/invalidate-converged.test.ts`「现状」区块——真
  QueryClient + 真 QueryObserver（与 useQuery 同挂载形态）+ 受控迟到的挂载取数，
  裸 `invalidateQueries` 被吞：queryFn 仅 1 次调用、缓存停在空快照。
  `unit-repro-naive-invalidate.log`：把收敛缝换成裸实现的对照组，2 条收敛用例红。
- **修复**：`invalidateConverged(qc, filters)` —— 记录调用时刻处于挂载取数的
  查询，待 `invalidateQueries` 的 promise settle（去重路径会等在飞取数落地）后
  对其补一轮失效；彼时 data 已定义（或 error、retryer rejected），取消/重取
  路径都成立，补出的取数服务端读必然晚于事件。一轮为界不自激；无匹配查询零请求。
- **接线**：`sse.ts`（team/conv 两流事件处理器 + 两处 resync）、`sse-guards.ts`
  reconcile、`todo-detail-page.tsx` conv 兜底失效——SSE 驱动的失效全走收敛缝。
- `unit-repro-converged.log`：6/6 绿；web 单测全量 321/321 绿。

## 复跑留证（票面 ≥5 次口径）

`m5-run1..5.log`：本地 5 连跑全过（每次 3/3，~13s）。本地无法复现 CI 红
（#698 已 20 轮零复现，触发条件含 2 核 runner 负载），故确定性证据面 =
上述单元复现的红绿对照；CI 侧终判 = 本 PR check 绿 + 后续 main run 观察。

## 留待裁决（不在本 PR 改）

1. **驳回支线瞬态 oracle**：`waitChip(/规划中/)` 要求 UI 渲染 188ms 瞬态，
   架构不保证。选项 a（推荐）：oracle 改钉持久证据（驳回气泡 + plan 卡 v2 +
   版本 chip v2），测试仍真走 UI；选项 b：chip 改事件载荷直渲（setQueryData +
   v 版本守卫），瞬态可见但动 S8 canon，需单独立票。
2. **m5 共享顺序 stub 脚本级联**（F2 放大器）：前序用例早退必把下游染成内容级
   红，建议按用例隔离脚本或消费计数对账，归 #698 主线。
3. **mutation 侧失效点同一潜在洞**（`hooks.ts:571,851`、`board-page.tsx:473`、
   `skill-dialog.tsx:116,161`、`branch-dialog.tsx:413`）：可机械换收敛缝；
   无实锤受损证据，建议另票收口。
4. **dump 增强（可选）**：下次 CI 红要 100% 区分「吞失效 vs 重取连败」，可在
   live 面暴露 plans/todo 查询缓存态（fetchStatus/isInvalidated/dataUpdatedAt）
   与两条流的事件计数给 `dumpSpineDiagnostics` 读取。
