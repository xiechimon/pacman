# 失败面发送(详情页 composer failed 相位,#320/#322)

用户在失败任务的详情页 composer 输入反馈并发送 → 触发带反馈重启新一轮(非 steer 409 语义):`POST /api/builds/{id}/steps {action:"restart", feedback, clientMessageId}` → server 起新 build(withPlan 承接失败轮)+ 反馈行落新 conversation + 首步入队(instruction 携反馈)+ failed→queued 漏斗。原站实测:failed 态发消息 = 触发新一轮,消息随新轮入会话(r9 §3.3)。

## Sub-features

- `failed-composer-send` failed 相位详情页 composer 可输入 + 发送(非只读);发送钮走 restart 语义。
- `restart-action-wire` 发送 → `POST /api/builds/{id}/steps {action:"restart", feedback, clientMessageId}`(shared buildStepActionBodySchema 的 restart 变体)。
- `restart-new-build` server 起新 build(withPlan 承接失败轮)+ failed→queued 漏斗;反馈行落新 conversation。
- `restart-first-step` 首步入队,instruction 携用户反馈(revision 同缝)。
- `restart-phase-gate` restart 门只收 failed 相位(confirm 走 revision、building/review 走 steer——两写面相位隔离,不共享入口)。
- `restart-empty-rejected` 空消息不成发送(`feedback: z.string().min(1)`);异步 onSend 失败(409)时 draft 保留不丢字。

## How to get to it (user POV)

- 失败任务详情页(`/app/todo/:id`,phase=failed)→ composer 输入反馈 → 发送钮。

## Driving it with verify-pacman

Preconditions:

1. `launch.mjs` 起隔离栈,`doctor.mjs` 全 PASS。
2. seed 一个 failed 相位的 todo(起 build → 让 plan/build 步失败,或直接构造 failed 态);live 面。
3. restart 起新 build 后,新轮执行需 daemon(可选——验证 restart 入队只需 server 面)。

- **失败面发送路径。** failed todo 详情页 → composer 填反馈文本 → 点发送 → 新 build 起(原 todo 从 failed 转 queued)+ 反馈行入会话。
- **真值。** `POST /api/builds/{id}/steps {action:"restart",...}` 200(delegated);`GET /api/todos/{id}` phase 从 failed → queued;新 build 行 + 新 conversation 含反馈 message;SQLite step 表首步入队携反馈 instruction。
- **相位门负向。** 非 failed 相位调 restart → 409(`restart 仅适用于 failed 相位`)。

## Gotchas

- restart ≠ steer:steer 是运行中中断(building/review 相位,停止钮),restart 是失败后带反馈重启(failed 相位,composer 发送)——两写面相位隔离,server 漏斗边不同。
- 空 feedback 被 schema 拒(`z.string().min(1)`);异步 onSend 失败时 draft 保留(不丢用户输入)。
- restart 起的是**新 build**(withPlan 承接失败轮的 plan),不是原 build 续跑;todo.latestBuildId 指向新 build。
- 失败面 composer 在 fixture 静态面是只读占位;live 面才接 restart wire。
- **验证状态(2026-09-28)**:本功能由 #322 lane 验证(server steps 扩 restart 形 + 前端 onSend failed 分支,integration REST 断言覆盖 409 面 + lane verify run happy path),证据随 worktree 删除未留主仓;主仓 live re-probe 待补(需构造 failed 相位 todo)。user path 从合并代码 + step.ts restart schema 核实。
