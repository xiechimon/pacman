# docs/verify/864 — T3 离线钉选超时策略证据

一轮隔离 live 栈（server `:8795` + vite `:5277`，全新 scratch `PACMAN_HOME`）上的
端到端跑：REST 铺世界（真 REST 入口：建项目 / 建 API 密钥 / enroll 一台**永不连接**
的机器 / 建钉选到它的任务），scratch DB 里直插 build + pending 步（机制面全跑真的：
真 server 进程 → 真 scheduler tick → 真 sweep；真 UI → 真 Playwright 路径）。
**22/22 check 通过**（`result.json` 是完整 check 表 + 栈坐标）。

探针脚本：`.claude/verify-shots/864/drive-pin-offline.mjs`（lane 本地，未进仓）。

## before 基线（同一世界的 origin/main 对照）

一次性 `origin/main` worktree（`/tmp/pacman-864-before`，绝对路径）+ 独立端口栈
（`:8796` / `:5278`）跑**同一世界**：钉一台永不连接的机器，团队里另有一台**在线**
旁观机器，步 createdAt 回拨到宽限外——跑 40 秒（≈2 个 scheduler tick）后
（`result-before.json` 7/7，`before-01-still-waiting.png`）：

- 步仍 `pending`、todo 仍 `building`、`build.errorMessage` 为 `null`——
  **改动前这条步没有任何收尾**（无限等待）；
- UI 上只有「（等待机器上线）」一个标注，什么都不发生。

⚠️ 对照世界的**前提必须带在线旁观机器**：只给一台离线机器时，main 的 ① 分支
（团队零在线机器，120 秒）照样会收尾——那样测到的是 ①，测不到 T3 的缺口。首次
对照跑就踩了这个（另一坑：一个 API key 只绑一台机器，同 key 重 enroll 返回同一
`machineId`，旁观机器要另开一把 key）。

## 票面三问的答案（本票裁决）

1. **等多久** — 钉选机器离线的 pending 步等 `PIN_OFFLINE_GRACE_MS = 10 分钟`
   （worker 步与 chief 回合同一常量，单源在 `apps/server/src/services/dispatch-timeouts.ts`）。
   与「团队零在线机器」那档的 120 秒分开：那档是环境错配（根本没机器能跑），这一档
   常是「我指定的那台暂时不在」（笔记本合盖 / daemon 重启 / SSE 断连），短窗口会杀掉
   合法等待。宽限锚在步的**最后活动**（心跳 → 领取 → 入队）而不是入队时刻——T1（#862）
   把失联 claimed 步释放回 pending 后，机器回归的窗口从失联时刻起算。
2. **谁通知** — 不新增通知通道（r5 §7.2 通知矩阵里 failed 没有 in-app 通知事件）：
   走既有失败漏斗 = 步 `failed` 事件 + `build.errorMessage` + todo → `failed`。
   worker 步落在看板失败卡 + 会话流失败行，chief 回合落在 `chief_turn_error` 行 +
   会话流 message 事件（web toast，#631 链）。
3. **能否转自动** — **不自动改派**。pin 的语义是确定性（t-0047 调研 + #682 落地），
   静默换机会让「钉 A 机」变成不确定，也会掩盖跨机凭据/环境差异（T6 的地界）。
   超时的产物是**可见的失败 + 显式出口**：失败文案点名钉选的机器；重跑面
   （failed 相位点「重跑」）在钉选机离线时给出「改为自动」，点了才 `PATCH
   todo.machineId = null`（之后新起的 build 才吃这次改动）。

## 证据逐条（截图 + API + SQLite 三面互证）

| 文件 | 证明什么 | 真值面 |
|---|---|---|
| `01-waiting-meta-row.png` | 宽限内（步 9 分钟龄）：meta 机器行 = `probe-offline-box（等待机器上线）`——#687 的等待语义原样保留 | check `waiting-ui-before-sweep` |
| `02-failed-transcript-message.png` | 超时后：会话流失败行 = `本轮无人认领：钉选的机器「probe-offline-box」离线超过 10 分钟。请让它上线后重跑，或把任务的机器改为其它在线机器（重跑沿用任务的钉选）。`；同一时刻页面上零等待标注 | checks `failure-shown-in-transcript-with-machine-name` / `no-waiting-annotation-after-failure`；`api-build-after-sweep.json`、`sqlite-final-rows.json` |
| `03-rerun-dialog-pin-offline.png` | 重跑面出口：`钉选的机器「probe-offline-box」当前离线，重跑仍会等它。` + `改为自动` | check `rerun-dialog-offers-unpin` |
| `04-rerun-dialog-after-unpin.png` | 点「改为自动」后出口行退场 | checks `unpin-patch-lands` / `pin-row-retreats-after-unpin`；`api-todo-after-unpin.json`、`sqlite-todo-after-unpin.json` |
| `05-closed-phase-no-waiting-annotation.png` | 关闭相位（failed → closed，deliberately 复位钉选后取态）：机器行仍在（`机器 probe-offline-box`）但**不再挂**等待标注——关掉的任务不再自称等待机器上线 | check `closed-meta-names-pin-without-waiting` |

链路里的关键真值（`result.json` 全量）：

- `sweep-timed-out-todo-failed` — 真 scheduler tick（15s）触发 `sweepAbandonedBuildSteps`
  的 ④ 分支；步 `failed`、`machineId` 清空、**`pinnedMachineId` 原样保留**（`pin-kept-no-silent-reassignment`）。
- 判据是「钉的那台不在」而不是「团队没机器」：团队里另有一台在线机器（REST 建的），
  步照样按钉选离线收尾。
- `sqlite-step-failed-machine-null` — 步行终态：`status=failed, machineId=null, claimedAt=null`。

## 覆盖不到的（明说）

- **钉选机在线但 `enabledRuntimes` 闸挡住该步的 runtime** 仍会无期 pending：闸在 claim
  路径（`machines.ts` `tryClaim`），判据要重算 agent 的 provider，不在本 sweep 的直读面。
  已在 `sweepAbandonedBuildSteps` 的头注释登记为「已知缝（不在本票）」。
- 本轮是**单机** live 栈（无 daemon）：钉选过滤（别机拒领）由 `apps/server/test/machine-pin.test.ts`
  与 #682 的实物证据承担；T1 的跨物理机实测见 `docs/verify/862/`。
- 契约面回归走 `apps/web` e2e（全量 787 条绿）+ `pnpm test`（1909 条绿）+ `pnpm -r typecheck`。

## 环境事实（记下来）

- 本机 8791/5273 被别的 lane 的 verify 栈占着（不杀）→ 本趟走 8795/5277。
- **世界铺底不要一次回拨到超宽限**：sweep tick 会在页面加载前把步收走，等待态就拍不到了。
  做法 = 先铺「宽限内」取等待态 → 再 UPDATE `step.createdAt` 到宽限外 → 等 tick。
- **failed 相位不渲染 meta 块**：`docMode` 在 review/done/failed 切到「变更」面，
  `TaskMetaBlock`（`emptyMeta`）只在方案面 `doc == null` 分支挂载。所以「收尾后不该再显示
  等待标注」这条在 failed 相位是**结构性成立**的（块根本不挂），唯一还需要显式判据的是
  `closed`：failed → closed 之后 meta 块重新挂载，钉选机离线 + 未领步会让它继续自称等待。