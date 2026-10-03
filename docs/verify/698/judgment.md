# #698 判因：m5 CI 间歇红的真因 ≠ daemon 零调用 no-op；两个真洞已修

## 结论一句话

四例 CI 现场里「被 claim 的修订步零模型调用直接 finished」的读法**不成立**——
#713 失败 attempt 的完整日志（`713-failed-run-dumps.md`）给出的 stub 请求计数
与三步序列，能被「脊柱用例早退 → 共享 stub 脚本错位 → 下游用例拿到错位响应」
完整对账。但票面点名的两个 runner/backend 洞是**真实存在的**（可确定性复
现），本 PR 修复之：零事件轮按 success 收 + `session.prompt()` 预检拒绝被吞。

## 证据链（#713，run 37106007887 attempt 1，job 111154549600）

**Dump 1（脊柱「plan 卡 v1 上屏」30s 超时）**：

- stub 计数 = **2**：脊柱规划步的两轮（写 plan.md + 汇报文本）——模型面正常。
- daemon 尾行：`claim → new session → pushed → finished`——规划步完整走完。
- `server 相位 = confirm`、chip = 确认：步收尾、相位回 confirm 都发生了。
- **唯独 UI 的 plan 卡 30s 不出现** → 脊柱用例在断言处失败退出（build/merge
  步从未入队 → 脊柱只消费了 13 条脚本里的前 2 条）。

**Dump 2（驳回支线「plan 卡 v2 上屏」30s 超时，实得 `方案 · v1`）**：

- stub 计数 = **7** = 脊柱 2 + 驳回支线 5。驳回支线的 5 次分布：
  1. plan v1 两轮（拿到**错位的**脊柱 build 响应：`printf >> README.md` +
     汇报文本——写了 README 而非 plan.md）；
  2. #113 兜底自动补写一轮（拿到错位的 merge 纯文本响应——无工具调用，
     无产物）；
  3. 修订步两轮（拿到**错位的**驳回 plan v1 响应：写 plan.md(reject-v1) +
     汇报文本）。
- 修订步**并非零调用**：它做了两次模型调用并把 plan.md 写进了工作区、
  push 落了分支（尾行 `continue session → pushed → finished`）。
- 实得 `方案 · v1` 的成因：该 build 此前没有任何 plan 行（plan v1 被错位响
  应带偏没写 plan.md），修订步的 plan.md 上传成了**该 build 的第一版** →
  版本号 1 → 卡面正确显示 `方案 · v1`。
- 「最后一次请求 = set_task_meta 首 prompt」是**截断误读**：续轮请求体携带
  完整历史，前 240 字符恒为首轮 prompt 形。

**四个例子的两种签名**：

- #686/#697/#711（chip 150s 不翻、计数 9）：脊柱全绿时的驳回支线——计数
  9 = 脊柱 5 + 驳回 plan 2 + 修订 2，同样**包含修订步的两次调用**。UI 侧
  302 次轮询恒「确认」与「服务端相位 planning→confirm 已走完」并存，指向
  UI 刷新链（SSE→invalidate→refetch）没把 planning 相位送到 DOM。
- #713 + main `62d38e06`（plan 卡缺席 / v2 变 v1）：脊柱 plan 卡不渲染
  （F1），下游用例被共享 stub 脚本错位放大成内容级失败（F2）。

**F1 的层尚未钉死**（UI/plans 刷新链 vs plan 行落库竞速）：本 PR 给
`dumpSpineDiagnostics` 加了 DB 真值面（plans/steps 行 + 相对时刻）与 stub
请求时间线——下一次 CI 命中即出分叉证据。本地 20 轮复跑（10 空闲 + 10 六
核有界负载）零复现，触发条件含 CI 环境特有因素。

## 修复（两个坐实的洞，TDD：红先行）

1. **runner 静默 no-op 闸**（`apps/daemon/src/runner.ts`）：零进展 + 零错误
   + 无 done 的轮原先按 `success` 收——「界面已开工、实际什么都没发生、无
   任何错误面」。现按 `failed` 收尾，文案点名 zero-event round。可达形：
   claude-code 后端 `pump()` 生成器耗尽（终局事件缺席时直接 `queue.end()`，
   注释自认「无终局兜底收面」）。pi 后端事件流必经 done 收尾，不受影响。
2. **pi prompt() 预检拒绝上浮**（`apps/daemon/src/backend/pi.ts`）：
   `session.prompt().catch(void err)` 吞掉预检拒绝（auth 校验 / compaction
   守卫 / input handler——发生在 agent run 之前，无事件面）→ runner 挂到
   first=300s 看门狗、报看门狗不报真凶。现经 `emitBackendError` 转 error
   事件 + 收面：步快速 failed 且文案是真因。

## 复现记录

- 红先行：`apps/daemon/test/runner-silent-noop.test.ts` 修复前 3 红
  （`expected 'success' to be 'failed'` ×2 + `stream never ended —
  prompt() rejection swallowed` ×1）→ 修复后 5/5 绿。
- 守护面：daemon 全量 31 文件 280 用例绿；integration 受影响面
  （m5 + m3b/m7-stop/crash-recover/m7-failed-send/web-plans-convergence）绿。
- m5 重复运行：修复后 6 连跑（`repeat-runs.md`）+ 修复前 20 轮
  （10 空闲 + 10 有界负载，`repeat-runs.md`）。
