# #905 取证基线 — 「规划中」步的时长分布与可用信号

改形态之前先量真实形态（票面要求 1）。两部分：
A. 真跑数据里规划步有多久、首个可见信号来得多慢；
B. 那段时间线上实际存在哪些信号、逐个判能否安全暴露给 UI。

## A. 时长分布（本机真跑数据，2026-09-23 … 2026-10-02）

数据源 = 用户本机部署的 server DB（`~/.pacman/server/server.db`，只读查询）。
步时长以该步 transcript 行的首末 `createdAt` 跨度计（行 id 内嵌 stepId，
`msg-<stepId>-N` / 工具行 id = toolCall id；prompt 行 `createdAt` = claim 时刻，
故跨度 ≈ claim → 末次模型输出的真实时长）。

39 个 done 的 plan 步，跨度分布（秒）：

| 分位 | 值 |
|---|---|
| min | 3s |
| p25 | 9s |
| p50 | 15s |
| p75 | 29s |
| p90 | 67s |
| max | 137s |

长尾全部来自真实用户任务（09-29/09-30 的 137s / 95s / 89s / 76s / 67s / 56s / 45s）；
10-02 傍晚那批 7–12s 的密集步是验证栈跑的痕迹。结论：**规划步常规十几秒，
但真实任务下 1–2 分钟不是异常**——用户截图里的「8s 处理中」正是长尾步的开头，
而 UI 在该窗口内零信息。

首个落库信号（prompt 行之后第一行 transcript）：plan 步平均 4s、最大 35s
（build 步平均 2s / 最大 7s；merge 步平均 16s / 最大 18s）。
⚠️ 该口径**低估**黑盒窗口：`text_delta` 是瞬态流不落库，落库行只在工具完成 /
消息终局时出现——模型思考期（`thinking_delta`）在 DB 里完全不可见，
只能靠下面的信号盘点确认它存在。

## B. 信号盘点（那段时间线上实际有什么）

取证路径 = 读码钉死（file:line 为本仓 origin/main @ 67509706）：

| 信号 | 产生处 | 现在到哪一层 | UI 可见？ | 能否安全暴露 |
|---|---|---|---|---|
| `text_delta`（模型流式正文） | pi/claude-code backend → runner（`runner.ts:811`，250ms 聚合 `TRANSCRIPT_DELTA_FLUSH_MS`） | → server `reportTranscriptDelta`（`machines.ts:1097`）→ SSE `text_delta` → liveTextStore | ✅ 已可见（打字面） | 已暴露 |
| `thinking_delta`（模型思考流） | 两 backend 都发（`pi.ts:437`、`claude-code.ts:183`） | **runner 的 switch 无 case，直接丢弃** | ❌ | **内容不暴露**（思维链可含敏感中间推理，且票面只要「在干什么」）；**「正在思考」这个事实 + 事件到达时刻可安全暴露**——它是思考期唯一的活动证据 |
| `toolcall_end` 无 result（调用块流完，工具开始执行，名字已知） | `pi.ts` 映射（调用块完成即发；`tool_execution_end` 才带 result） | runner 只在 `result !== undefined` 时回传（`runner.ts:834`）→ 无 result 的那半被丢 | ❌ 工具跑完才出现 | ✅ 工具名+参数摘要本就随终稿落库展示；「开始执行」时刻暴露无新增泄露 |
| `toolcall_end` 带 result | 同上 | → `client.tool` → server 落库 + SSE `message` | ✅ 已可见 | 已暴露 |
| `auto_retry_start/end`（协议 400 自动重试） | backend | runner 只写日志（`runner.ts:875`） | ❌ | ✅ 「自动重试中（第 N 轮）」直接回答「为什么久」 |
| `compaction_start/end`（上下文压缩） | backend | runner 只写日志（`runner.ts:890`） | ❌ | ✅ 同上 |
| `message_end`（轮边界） | backend | runner 落本地 transcript 缓冲，终稿步末上传 | ❌（live 期间） | ✅ 作为「等模型下一轮」的相位事实 |
| heartbeat（30s，`runner.ts:658`） | daemon | server 只更新 `step.lastHeartbeatAt`，不发 SSE | ❌ | ✅ 但 30s 粒度太粗，只够判 daemon 活着，不够「在动 vs 卡住」 |
| chief `activeRun.tool`（r5 §3.5 形状） | — | **全库无写入方**（Multica 取证残留 [推断] 形状；`chief.ts:416` 只写 `{phase}`） | 面板行恒空 | 死代码位——本次由真信号接管 |

### 黑盒窗口的构成（改前）

claim → 首个 text_delta 之间依次是：工作区准备（git worktree，秒级）→ 凭证/技能
下发 → 会话开启 → 模型首 token 延迟 → **思考期（可达数十秒，`thinking_delta`
全被丢弃）**。这整段 UI 只有「处理中… + 本步：规划中」；思考期结束后若模型直接
调工具，工具执行期（`toolcall_end` 无 result 被丢）同样静默。用户看到的黑盒 =
「preparing + starting + thinking + tool 执行」四种相位的叠加，而 daemon 侧
**每一种都有事件到达**（runner 的看门狗正是靠它们重置，`runner.ts:812`）——
信号存在，只是从未转发。

### 判定

安全暴露面 = **相位（在做什么）+ 工具名 + 重试轮次 + 最近信号时刻**；
不暴露 = thinking/text 内容增量的任何新面（text 已有既有暴露通道，thinking 内容
不上 wire）。「在动 vs 卡住」判据 = 最近信号时刻的新鲜度：daemon 只在**真有
事件到达**时刷新它，静默期不伪造心跳——数字持续增长即「卡住」的诚实呈现
（#471 律：不挂会说谎的数）。

## 复现查询

```sh
sqlite3 "file:$HOME/.pacman/server/server.db?mode=ro" "
with rows as (
  select s.id as sid, s.kind, m.id, m.createdAt,
    row_number() over (partition by s.id order by m.createdAt) as rn,
    min(m.createdAt) over (partition by s.id) as t0
  from step s join message m on m.conversationId = s.buildId and m.id like '%'||s.id||'%'
  where s.claimedAt is not null and s.status='done')
select kind, count(distinct sid),
  cast(avg((first_t-t0)/1000.0) as int), max((first_t-t0)/1000)
from (select r1.sid, r1.kind, r1.t0, min(r2.createdAt) first_t
      from rows r1 left join rows r2 on r2.sid=r1.sid and r2.rn>1
      where r1.rn=1 group by r1.sid) group by kind;"
```
