# docs/verify/881 — 收口「有界等待」的两条缝（钉选在线但 runtime 被挡 / 会话机在线但楔住）

#864（T3）与 #863（T2）各登记了一条同源的「无界等待」缝。本目录 = 两条缝在
隔离 live 栈上的 before/after 行为证据：before 栈 = `origin/main` 一次性
worktree（`:8796`/`:5278`），after 栈 = 本分支 worktree（`:8795`/`:5277`），
同脚本重放（`drive-881.mjs`，`EXPECT=new|old` 反转关键断言，#741 先例）。

形态：纯 REST 世界搭建（项目/Agent/API key/enroll 三机/presence 置在线）+
SQLite 回拨步龄过宽限（**有界复现**——不烧 10 分钟真等）+ 真实 scheduler
tick（15s × 2 拍）/ 真实 claim 端点（长轮询）判定。零 daemon、零 LLM——
两条缝都是 server 侧派发判定面。

## 世界（两栈同形）

- `pin-blocked`：缝 ① 的钉选机——**在线**，enroll 缺省只开 `['pi']`。
- `session-owner`（X）：缝 ② 的会话机——**在线**、持有 prior session、不领
  步（楔住的判据就是它该领而不领）。
- `bystander`（Y）：健康旁观者，claim 探针。
- Agent：缝 ① 用 `provider: 'claude-code'`（runtime 反例位）；缝 ② 用
  `provider: 'stub-gw'`（pi 档，机器都开）。
- 一机一 API key：enroll 按 (apiKeyId, teamId) 复用机器行，同一 key 注册
  三台会坍缩成一台。

## 缝 ①（钉选机在线但 enabledRuntimes 挡步 runtime）——worker 半边

钉选 build 步（claude-code agent × 只开 pi 的钉选机）入队后回拨步龄过
`PIN_OFFLINE_GRACE_MS`，等真实 scheduler tick：

- **before**（`result-before.json` 10/10，`seam1-before-tick.json`）：步
  `pending`、`build.errorMessage` null、todo 停在 `queued`（从未被领取）——
  无期等待，钉选 SQL 过滤下唯钉选机可见、claim 闸恒 false。
- **after**（`result-after.json` 12/12，`seam1-after-tick.json`）：步
  `failed`；`errorMessage` = 「钉选的机器「pin-blocked」未开启本步所需的
  runtime「claude-code」。请在机器页为它开启该 runtime 后重跑，或把任务的
  机器改为其它在线机器（重跑沿用任务的钉选）。」；`pinnedMachineId` 原样
  保留（不静默改派）；todo → `failed`（既有失败漏斗，#631 链）。

chief 半边（线程钉选 + 闸挡 → 回合失败）与 worker 同政策同漏斗
（`dispatch-timeouts.ts` 单源），由 `chief-abandoned-sweep.test.ts` 3 条新
单测钉（离线版 #864 的 live 证据已走全漏斗，本缝只改判据分支不新增面）。

## 缝 ②（会话机在线但楔住）——亲和闸有界

X 持有 prior session 在线不领；pending build 步（续接该 session）回拨步龄
过 `SESSION_WEDGE_GRACE_MS`；Y 发 claim：

- **before**（`seam2-claim-before.json`）：`step: null`——亲和闸按「在线 +
  闸开」永久让行，等待无界（Y 挂满整个 hold 周期后空手而归）。
- **after**（`seam2-claim-after.json`）：Y 领到该步，`machineId` = Y；载荷
  契约原样 = `{action: 'continue', sessionId: 'sess-881'}`——server 不替
  daemon 预判降级，换机后的新会话回退 + `RESUME_FRESH_SESSION_NOTE` 注记
  走 #862 T1 既有机制（daemon 面，#863 物理跑已钉）。
- **忙保护**（两栈都成立，`busy-guard-claim*.json`）：X 手上挂一条心跳新鲜
  的 claimed 步（忙 = 合法长跑）+ 步龄超宽限 → Y 仍空手——楔住判定只对
  「在线且手上无步」的机器生效，不误放忙机（免无谓换机丢上下文）。

## 文件

- `result-before.json` / `result-after.json` — 两栈的 check 表（逐条
  ok/label/detail）。
- `seam1-{before,after}-tick.json` — 缝 ① sweep 后的 step/build/todo 真值。
- `seam2-claim-{before,after}.json` — 缝 ② Y 的 claim 响应（before = null
  的外层形态，after = 完整 claim 载荷含 session 契约）。
- `busy-guard-claim{,-before}.json` — 忙保护两栈对照（都是空手）。
- `machines-{before,after}.json` — 世界形状（在线位 + enabledRuntimes）。
- `drive-881.mjs` — 探针正本（env：`VERIFY_PORT`/`DB_PATH`/`OUT_DIR`/
  `EXPECT`）。

## 本地闸

- 单测先红后绿：`build-abandoned-sweep.test.ts` +5（缝 ① worker 族）、
  `chief-abandoned-sweep.test.ts` +3（缝 ① chief 族）、
  `machine-session-affinity.test.ts` +5（缝 ② 楔住/忙保护/宽限/自领）。
- 全量：server 753 / daemon 431 / shared 273 / integration 59 全绿；
  `pnpm -r typecheck` 绿；`pnpm lint` 绿（warnings/infos 为既有形态，零
  error）。
- `pnpm --filter @pacman/web e2e:affected`：纯 server 侧改动，受影响面
  spec 为零 → 未触发全量回落（PR body 记录实跑数字）。
