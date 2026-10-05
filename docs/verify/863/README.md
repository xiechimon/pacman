# docs/verify/863 — AMP 对齐 T2：会话亲和（同 build 下一步优先回同一机器）

物理机双 daemon（Mac `daemon-mac` ↔ mea/WSL2 `daemon-mea`，真模型 `glm-5.3`
经 relay）+ 裸 HTTP 探针机 `probe-watcher` 三方对同一 scratch server
（`<worktree>` 代码，端口 8795，隔离 `PACMAN_HOME`）。两轮：v2 轮（无保活）
撞出会话亲和的物理失效模式并定位根因；v3 轮（带机器通道 SSE 保活修复）
跑通完整语义。探针：`/tmp/pacman-t2-863/drive-affinity.mjs`（lane 本地，
未进仓；REST + 只读 SQLite 真值）。

## 实现（本票落的两件）

1. **会话亲和闸（server claim 面）**：`tryClaim` worker 候选环——会续接
   prior session 的步（≠review、非 plan 交接缺失、build 未钉选）优先回
   「持有该会话的机器」（= 链尾 session 步的 machineId，与 continue 判定
   同源查询）。会话机在线且 runtime 闸开 = 它是有效候选人，本机跳过该候选
   （步留 pending 等它领；跳过不阻塞本机领更晚的它 build 步）。会话机
   离线/被删/闸关/归属空 = 放行（换机 → daemon 侧 SessionNotResumable
   回退新会话 + `RESUME_FRESH_SESSION_NOTE` 显式降级注记，#862 T1 契约
   原样保留，server 不替 daemon 预判降级）。钉选 build 不亲和（钉选 =
   用户显式选择；且钉选 SQL 过滤下唯钉选机可见，再挡 = 死锁）。
2. **机器通道 SSE 保活（`GET /api/machine/stream`）**：无事件机器的流此前
   零字节输出，客户端 bodyTimeout（undici 默认 300s 按 body 数据间隔计）
   把流静默掐断 → server `onAbort → markOffline` → `machine.online` 闪断
   至下一次 presence（≤30s）。亲和闸按 online 即时判会话机在位与否，闪断
   窗口内把他机误放行 = 无谓换机丢上下文（v2 轮实跑撞上，见下）。修法 =
   team/conv 通道同节奏（`ctx.pingIntervalMs`，15s）的 SSE 注释帧保活
   （`: ping` 注释行是 SSE 规范 keep-alive 形态；daemon 帧解析只认
   `data:` 前缀行，注释行零解析面、零 wire 契约变化）。

## v2 轮：失效模式与根因（before 证据）

- 拓扑同 v3，server 无保活。两条 build 步在 A 跑完（会话文件在 A），
  mea 在线；A 忙跑 buildA 的重规划步时，buildB 的重规划步挂 pending。
- **05:56:19 mea 领走了 buildB 的重规划步**（continue 载荷 → 回退新会话
  + 注记，机制正确但换机是**无谓的**——会话机 A 从未死）。翻转轮询器
  （1s 分辨率）当场抓获同形闪断：
  `online-flip-before-ping.json`：`06:07:55 daemon-mea 1->0` →
  `06:08:14 0->1`（**健康 daemon 被 online 列闪断 19 秒**，日志无任何
  错误/重连痕迹——机器通道重连静默（`announced` 旗标只打一次连接行））。
- 根因链：机器 SSE 无 ping → 无事件机器流零字节 → undici bodyTimeout
  掐流 → server markOffline → 闪断窗内亲和闸放行他机。A 的流最后一次
  收到数据 = 05:51:16（revision 入队的 wake 广播）→ 300s 后 05:56:16 掐断
  → 05:56:19 mea 的 hold 到期重试命中闪断窗。

## v3 轮：完整语义（after 证据，全过）

1. 两条 build 步 + 两条重规划步 **全部由 A 认领**，A 日志逐条
   `new session` / `continue session`（会话文件在 A，续接在本机成立）；
   mea 全程在线零认领。
2. **亲和让行直接证据**（`phase1.json`）：A 忙跑 buildA 重规划步期间，
   buildB 重规划步 pending；第三台裸 HTTP 探针机 `probe-watcher`（enroll +
   presence 在线）发 claim → **`step: null`**（步 pending + 会话机在线 =
   亲和闸让行；无亲和时该请求会直接把步领走）。
3. **零闪断**（`online-flip-after-ping.jsonl`）：保活修复后 1s 轮询器整轮
   只录到一条翻转 = 06:14:57 `daemon-mac 1->0`（真实 kill）。健康机器
   （mea、watcher）零闪断（v2 同龄 19s 闪断）。
4. **换机闭环**（真杀 A）：`kill -9` A 进程组（A 正跑 buildB 重规划步）→
   心跳停更 120s + tick → `sweepAbandonedBuildSteps` 释放（`status:
   pending, machineId: null`，#862 T1 机制原样复用）→ mea 一个 hold 周期
   内认领 → claim 载荷 `continue <A 的会话>` → mea 无该会话文件 → 日志
   `continue session unavailable (...) — falling back to new session` →
   新会话跑完 → 步终态 `done`（`result.json` 9/9 check 全过）。终稿
   transcript 带
   `resume-note-<stepId>`（内容 = 共享 canon
   `原会话不可复用，已用新会话重跑（上下文可能不完整）`）——换机显式
   降级标记（#862 T1 落的注记，本票验证其在亲和流程里原样工作）。

文件：`result.json`（check 表）、`steps.json`（两 build 全步 machineId +
sessionId 时间线）、`machines.json`、`transcripts.json`（含注记行）、
`phase1.json`、`phase3.json`、`online-flip-before-ping.json` /
`online-flip-after-ping.jsonl`（保活前后对照）、`daemon-a.log` /
`daemon-mea.log` / `server.log`。

## 本地闸

- 单测（先红后绿）：新增 `machine-session-affinity.test.ts` 11 例（亲和
  核心/离线放行/幽灵机/闸死锁/钉选盖过/无队头阻塞/review 与交接缺失与首步
  不亲和/链尾跟随/载荷契约）+ `machine-wire.test.ts` 保活 1 例（红→绿）。
- 全量：server 728 / daemon 415 / shared 273 / integration 59 全绿；
  `pnpm -r typecheck` 全绿；`pnpm lint` 绿；`e2e:affected` 4/4。

## 已知缝（登记，不在本票范围）

- 会话机**在线但不领**（楔住）= 亲和步无限等待——超时策略归 T3（#864）；
  本票只保证「在线位准确时不误放行」。
- 亲和等待无 UI 面（「等会话机领」不显示）；钉选离线等待显示（#687）是
  相邻先例，后续票可复用同形。
