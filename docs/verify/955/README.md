# docs/verify/955 — 总管过程按事件边界实时封段（#955 / ADR 0011）

隔离 live 栈（server `8792` + vite dev `5274`，全新库、独立 `PACMAN_HOME`），
探针 `.claude/skills/verify-pacman/scripts/drive-chief-segments.mjs`：
铺底全走公开 REST + **假机器**（provider / agent / PATCH chief / POST
chief/threads / api-key / machine enroll / claim），然后按**封口后的真 wire 序**
推帧——`transcript_delta`（在飞文本）、第五形 `transcript_row`（段行落库）、
既有形 toolCallRecord（工具行两半）。零 daemon、零 LLM；daemon 侧的封口本身
由 daemon 套件钉（见下）。

`result.json`：**9/9 checks ok**（thread `chief-01a10d06-ae72-7102-afc2-61ee74a73b0d`）。

## 机制判据 → 实物

| 声称 | 实物 | 结果 |
|---|---|---|
| 段序：正文段排在它之后的工具行**之前**（封口点在工具到达那一刻） | `db-rows.json` 的落库序 idx think/seg1/call/seg2 = 1/2/3/4 | A1 PASS |
| 段行落库形 = 单类型块数组 | `db-rows.json` shapes = `[["thinking"],["text"],["text"],["text"]]` | A2 PASS |
| 先落库再广播 | `stream-events.jsonl` 的 message 帧序 == DB 中的相对序，且每个帧 id 都在库里 | A3 PASS |
| 工具行落库**不**清在飞缓冲（旧律会抹掉正在流的下一段） | 工具行落库后新开的 SSE 客户端拿到 `["第二步：核对补发语义。"]` | A4 PASS |
| 工具行开始半即时落库（进行中的工具要在流式期可见） | `db-rows.json` 含 call 行；`drawer-text.txt` 有 `正在调用 todo_write` | B0/B3 PASS |
| 同 id 幂等（终稿覆盖不双份） | 「读取仓库结构」在该线程恰一行 | A5 PASS |
| 抽屉真 DOM：思考段单列、正文按段分行、在飞工具行平铺并挂进行态 | `01-drawer-inflight.png` + `drawer-text.txt` | B1/B2/B3 PASS |

## 证据文件

- `result.json` — 9 条 check 的逐条 ok/label/detail + 栈坐标 + 线程/步 id。
- `db-rows.json` — `{viaApi, viaSqlite}` 两份行快照（读面 + 库面）。
- `stream-events.jsonl` — 全程 SSE 帧（含补发快照与 message 帧序）。
- `drawer-text.txt` — 抽屉在飞态的可读文本（截图的可 diff 版）。
- `01-drawer-inflight.png` — 抽屉在飞态截图（思考行 + 分段正文 + 进行中工具行）。

## before 基线

本探针不带 `--expect=old`。本票的 **before 形态**由仓内既有证据提供：
`docs/verify/857/tail-samples.jsonl` —— 用户报的症状本体（同一轮里多段叙述被
拼成一行、共享一个身份 chip），以及 `docs/verify/857/README.md` 记的流事件序。

## daemon 侧实物（封口的发生地）

探针按真 wire 序发帧，**产出**这些帧的是 daemon 的 runner。封口本身的 pin 在
daemon 套件里，同 PR 实跑：

- `apps/daemon/test/segment.test.ts` — 段缓冲 10 条（同 kind 累积 / 异 kind 先封 /
  封后清空 / 空段不派出 / 全文替换 / 逐字保留）。
- `apps/daemon/test/machine-loop.test.ts` — 全链 transcript 行序
  `['user-s1', 'msg-s1-1', 'call-1']`（正文段先落、工具行随后）。
- 其余各层实跑：`pnpm -r test` = shared 274 / web 453 / daemon 464 / server 786 /
  integration 60，全绿。

## 探针坑位（复用本探针时先读）

1. **行 id 必须每次运行唯一**：`chief_message` 的幂等 upsert 以 **id** 为冲突键，
   且 `set` 不改 `threadId`——复用同一个 `call-1` 会让第二次运行的行写回**第一次**
   的线程（实测：只有首轮线程长到 7 行、后续各 5 行，且 message 帧照常发出，
   极易误判成产品 bug）。
2. **外部只读连接读不到刚落的行**：服务端连接持有 WAL，`better-sqlite3` 新开的
   连接会在行刚落地时读到旧快照。断言一律走 server 自己的读面
   （`GET /api/conversations/{id}/messages`），SQLite 只作落盘实物。
3. 读面回的 `content` 是**已解析**的数组/对象，探针内部发的是字符串形——
   断言走归一函数，不假设形状。