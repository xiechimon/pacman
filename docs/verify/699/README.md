# #699 验证证据：540s streamBodyTimeout 墙杀活跃长步

隔离 verify 栈（verify-pacman skill：server 8791 / web 5273 / 独立
PACMAN_HOME scratch），**生产超时值**（first 300s / idle 480s / body 540s /
duration cap 3600s 默认——无测试注入）。两条探针同时跑在两台独立机器
（各持独立 api key，避免同 machineId 的 enroll/recover 串扰）。

## 探针形态

- **长流（A）**：stub provider（OpenAI Chat Completions SSE）每 20s 滴一条
  content delta × 34 = 680s（> 10min 且 > 540s body 预算）后
  `finish_reason=stop` 收尾——事件流持续活跃的步。
- **死流（B）**：stub 首响应 = `bash` toolcall `sleep 600`（pi bash 无默认
  超时）→ 工具执行期事件流真静默（provider 层静默会先撞 pi 自身 300s
  HTTP idle，工具执行静默才是 idle 臂的真实触发形态）。

## 结果（时间线全 UTC）

| 探针 | claim/首请求 | 落定 | 结果 |
|---|---|---|---|
| A 长流 | 06:49:26（drip 开始） | 07:00:48 `finished (0 running)` | **682s 自然完成**，无超时行；step `done`，todo → `review`，`build.errorMessage = null` |
| B 死流 | 06:49:32（sleep 600 派发） | 06:57:47 `step failed: stream timeout (arm=idle, idle=480000ms)` | **idle 臂在 480s 期限内收尸**（06:49:33 末事件 + 480s ≈ 06:57:33 + 收尾余量）；step `failed`，todo → `failed`，`build.errorMessage` 携带该文案 |

对照：旧代码下 A 在 body 臂武装后 542s（≈ 06:58:28）被杀——#519 实测
指纹（claim 后精确 542s，流健康到最后一秒）。修复后同形态步跑满 682s
自然收尾。

## 文件

- `daemonA-timeouts.log` / `daemonB-timeouts.log` — 两 daemon 全量日志
  （claim → using model → new session → finished / failed 行序）。
- `steps-rows.json` — SQLite step / build / todo 三表行（B 的
  `build.errorMessage` = arm 指名文案）。
- `api-faces.json` — 两 todo / 两 build steps 的 API 面 JSON。
- `stub-requests.jsonl` — stub 请求记录（模式判定 + 时间戳）。
- `todo-long-after.png` / `todo-dead-after.png` — 两 todo 详情页终态
  （1440×732，与 e2e 同口径）。

## 单测

`apps/daemon/test/runner-stream-timeout.test.ts`（8 测，票面四条失败方式）：
事件重置救活超 body 预算的活跃流 / idle 收死流 / duration cap 收无上界流
（含 env 旋钮）/ 四臂文案指名臂位与数值。全 daemon 套件 283/283，
shared 套件 203/203（含 zod 快照）。
