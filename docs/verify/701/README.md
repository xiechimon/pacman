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

真值面（`result.json` checks 摘要）：

- 打回后 `GET /api/todos/{id}` phase=planning；`latestBuildId` 不换 build（分支不孤儿化）；
- 重规划步入队（pending plan 步，路径 A 后共 2 条、路径 B 后共 3 条）；
- 用户 feedback 行落 transcript（role user）；plan v1 保留；
- SQLite step.prompt = 审核关口打回模板（`用户在审核关口请求修改。修改反馈：「…」`，含「会话分支/不要丢弃既有产物」保留句）。
