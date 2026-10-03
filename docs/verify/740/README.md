# #740 验收证据索引 — 会话流中途进场补发

probe = `verify-pacman/scripts/drive-chief-catchup.mjs`（本票随票新增；铺底全走
公开 REST + 假机器认领 chief 回合步/推 transcript_delta/终稿上传/收尾，零
daemon 零 LLM，回合数据面与真机器同形；`--expect=old` 反转期望取
`origin/main` 一次性 detached worktree 栈的同等场景基线，drive-agent-identity
先例）。栈 = 隔离 live 实例（`VERIFY_PORT` 8791/8792 + `VERIFY_WEB_PORT`
5273/5274，scratch `PACMAN_HOME`，每次 launch 全新库 seed）。

| 目录 | 内容 | 结果 |
|---|---|---|
| `after/` | 本分支代码，全链：API 面中途进场补发/接缝/重连 + 浏览器面抽屉中途进场/实时打字 + 终局收敛不双份 + 终局后新流零补发 | **8/8 PASS**（`after/result.json`） |
| `before/` | `origin/main`（b9aeac1b）同 probe `--expect=old`：API 面零补发/仅首帧丢失 + 浏览器面中途进场零文本（前缀丢失） | **8/8 PASS**（`before/result.json`） |

checks 明细（与 `result.json` 逐条对应）：

- `after`：A1 中场进场首个 text_delta = 已流出前缀精确拼接 · A2 补发 +
  实时增量精确拼接（长度 2）· A3 重连快照 = 整段前缀 · B1 抽屉打字行一个
  刷新窗口内补齐前缀 · B2 进场后增量照常打字 · C1 终稿行接管 · C2 落库文本
  只出现一次 · D1 终局后新流零 text_delta。
- `before`：O-A1 订阅后零 text_delta · O-A2 仅实时增量到达（首帧丢失，非
  通道坏）· O-A3 重连零补发 · O-B1 中途进场零文本 · O-B2 实时增量照常
  （通道本体健在）· C1/C2/D1 与 after 同律。

动效证据：`after/catchup-flow.gif`（进场快照 → 逐段增量 → 终局收敛，同一
视角 6 帧；静态三图为同帧 PNG）。

单元/集成面（不在本目录）：`apps/server/test/conv-stream-catchup.test.ts`
（13 条：hub 补发/schema/清空点/双上限/多订阅者/隔离 + chief wire 中途进场/
rewind 清）+ `apps/web/test/sse-conversation-stream.test.ts`（6 条：
订阅即清/看门狗重建清/resync 失效/收敛律/透传）。

e2e 回落全量：`sse.ts` 改动触发共享面回落 90/90 spec，687/687 PASS
（`/tmp/740-e2e.log`）。
