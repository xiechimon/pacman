# #701 审核关口人肉打回（B-C12）— verify-pacman 真栈证据

探针：`.claude/skills/verify-pacman/scripts/drive-review-reject.mjs`（配方 `features/review-reject.md`）。
栈：隔离 live 栈 server `:8791` + vite dev `:5273` + 独立 `PACMAN_HOME` scratch；seed 到 confirm 后由探针经机器 wire（HTTP claim/done）驱到 review 静息态。结果：**22/22 checks PASS**（逐条见 `result.json`）。

| 文件 | 内容 |
|---|---|
| `01-review-quiescent.png` | review 静息态：chip「审核」+ composer 占位「请求修改…」 |
| `02-more-menu-reject-entry.png` | 更多菜单出现「请求修改」打回行（路径 A 入口） |
| `03-reject-dialog-filled.png` | 打回弹层填入反馈（空稿时确认钮禁用） |
| `04-chip-flipped-planning.png` | 路径 A 确认后 chip 即时翻「规划中」（真 SSE 失效键路径，未 reload） |
| `05-composer-reject-typed.png` | 路径 B：composer 静息态直接输入打回反馈 |
| `06-composer-reject-flipped.png` | 路径 B Enter 后 chip 翻「规划中」、draft 清空、无「消息未送出」提示行 |
| `07-transcript-feedback-rows.png` | transcript 两条 feedback 用户气泡均在 |
| `result.json` | 22 条 check 逐条 ok/label + 栈坐标 + API/SQLite 真值 |

## delivery/ — 续轮指令投递对账（合并态：main + #721 + #719）

打回意图不止要入队，还要**真的到达 agent**。#703（PR #719）修复前，daemon runner 对 continue 步一律发 `CONTINUE_PROMPTS` 占位句、claim 载荷 `instruction` 从不进会话——本票的重规划步是 continue 步，投递依赖该修复。对账在 `origin/main + #721 + #719` 的合并态一次性检出上跑（`delivery-drive.mjs`，真 daemon + 捕获型 stub LLM，双面方法照 #703 证据同款，请求体全文落盘不截断）：**16/16 checks PASS**。

- face 1（server→daemon wire）：claim 载荷 `instruction` 全文 === `buildReviewRejectPrompt(feedback)` 模板合成值（166 字节逐字相等），`session.action='continue'`；
- face 2（daemon→LLM 请求时间线）：stub 收到的唯一请求 messages 里含意图文本与用户反馈原文，且无占位句顶替（`stub-requests.json` 全文）；
- face 3（transcript DB 真值）：message 表 `user-<stepId>` 行 content === instruction 全文、step.prompt 同值，重规划步收尾后 phase=confirm（`sqlite-truth.json`）；
- daemon 日志（`daemon-tail.out`）：HTTP 驱的轮次无本机会话文件 → `falling back to new session`（预期回退，prompt 投递不受影响）。

依赖结论：**#719（或等价 runner 修复）先于/随 #721 合并**，打回意图才达 agent；单独 #721 时相位流转/入队/UI 全部照常，但 agent 收到的是通用占位句（与现状 confirm 关口驳回同病，非本票引入）。

真值面（`result.json` checks 摘要）：

- 打回后 `GET /api/todos/{id}` phase=planning；`latestBuildId` 不换 build（分支不孤儿化）；
- 重规划步入队（pending plan 步，路径 A 后共 2 条、路径 B 后共 3 条）；
- 用户 feedback 行落 transcript（role user）；plan v1 保留；
- SQLite step.prompt = 审核关口打回模板（`用户在审核关口请求修改。修改反馈：「…」`，含「会话分支/不要丢弃既有产物」保留句）。
