# #667 验证证据：总管抽屉每回合双用户气泡 → 读侧去重

栈：verify-pacman 隔离 live 栈 + 真 daemon（pi 运行时）+ stub LLM（OpenAI SSE
即时回复）。after 面 = 本分支（server 8793 + vite 5275，scratch PACMAN_HOME）；
before 面 = `origin/main`（633afa37）一次性 detached worktree 同配方独立栈
（8795/5277）。同脚本重放（`.claude/verify-shots/chief-echo/probe.mjs`，
worktree 本地，未提交）。daemon 必须在场——无 daemon 时回声行永不落库，单气
泡是假象。

## 文件

| 文件 | 内容 |
|---|---|
| `before-turn1.png` | origin/main 第一轮收敛面：同一句话**两个**用户气泡（bug 复现） |
| `before-turn2.png` | origin/main 第二轮后：第一句 ×2 + 第二句 ×2 = 4 个用户气泡 |
| `result-before.json` | before checks 6/6（`before-turn1-double-user-bubble` / `before-turn2-double-each` 等）+ DB 行 ids |
| `after-turn1.png` | 本分支第一轮收敛面：恰**一个**用户气泡 + 一条定稿 robot 行 |
| `after-turn2.png` | 本分支第二轮后：两句话各一条 = 2 个用户气泡（无过度去重） |
| `result-after.json` | after checks 6/6（`after-turn1-single-user-bubble` / `after-turn2-distinct-both-render` 等）+ DB 行 ids |

## 判读

- **呈现面（读侧去重）**：before 一次发送 = 2 个用户气泡；after = 1。连发两
  句不同内容：before 4 个、after 2 个（防过度去重的反向钉）。
- **数据面（写侧不动）**：两面 DB 都落 2 条同文 user 行——POST 行（id =
  `Yfe8z9…` / `glfvK…`，21 字符无前缀）+ daemon 回声行（id =
  `user-dC9s…` / `user-LNFF…`，`user-<stepId>`）。去重只发生在
  mapChiefStream，chief_message 表零改动（`turn1-db-two-user-rows` 两面同 PASS）。
- 回合真实收尾：两面 `turn1-assistant-reply-rendered` 均 PASS（stub 回复的
  定稿行落位 = transcript 上传 + done 走完，回声行确实落库）。
