# #647 证据索引——claude-code 工具面接线（spec 17 T4）

日期 2026-10-02。live 全栈真路径：verify-pacman 隔离栈（after = 本分支
worktree，server 8795 + vite dev 5277；before = origin/main `e013656f` 一次性
worktree `/tmp/pacman-647-before`，server 8796 + vite 5278，双栈独立 scratch
PACMAN_HOME）+ 真 daemon ×2（真实 HOME——claude 认证机器本地，spec 17 A4
环境契约；代理 env 保留给 claude CLI 外联，daemon→server 回环自动 no-proxy；
`PACMAN_MCP_CONFIG` 指向 probe 自备 config 解锁第三面）。

## 断言面（after 30 项 / before 5 项，两栈对照）

- **A chief 全链路**：总管绑定 claude-code agent（`claude-code/sonnet`）发一轮
  → claim 携 CHIEF_REMOTE_TOOLS 50 件 → 后端把 host 工具面包成 `pacman`
  in-process MCP server → 模型真调 `mcp__pacman__save_memory` /
  `mcp__pacman__notify_user` / `mcp__t4echo__echo`（transcript 铁证）→
  relay 回服务端真执行（`agent_memory` 行 `t4-probe` + `notification`
  chief_message 行）→ 步 done + sessionId 回传 + chief_message assistant 行；
  无 chief-err system 行（用户面「总管本轮执行失败」不复现）。
- **B mcpServers 第三面**：绑定 agent 勾选 `t4echo` slug → daemon 读
  PACMAN_MCP_CONFIG 解析端点 → SDK stdio config → 模型真调
  `mcp__t4echo__echo`（echo 结果回模型，transcript 在）。
- **C 降级退役**：daemon log 有 `using model claude-code/sonnet` canon 行、
  无任何 `(T4)` 降级行（runtimeDrop 分支按票面退役）。
- **D pi chief remoteTools 零回归**：同栈同 daemon，stub LLM（openai-
  completions SSE）pi 总管发一轮真调 `save_memory`（pi customTool → relay
  同径），`pi-probe` memory 行落库 + 步 done。
- **E localTools 面**：机器 shell 开关 + agent「远程 shell」双闸开 → 直派
  claude-code worker 步（裸项目）→ runtimeDrop 退役后 localTools 到达后端
  → 模型真调 `mcp__pacman__remote_shell`（附带 `mcp__pacman__set_task_meta`
  = worker remoteTools 面同链覆盖）→ 预检闸落 `shell_command` 行
  （`echo t4-local-tools-ok` status done）+ 步 done。
- **before 面**（origin/main，同 seed/派发）：chief 步 failed，chief-err
  system 行含 `claude-code backend: remoteTools not supported yet (T4)`
  ——即用户实测撞上的「总管本轮执行失败」起点事实。

## 场景复现（before/after 同一脚本）

1. seed：agent(claude-code, mcpServers=[t4echo]) → PATCH chief 绑定 →
   api-key → probe 自备 MCP config（t4echo stdio 条目）。
2. 段间起 daemon（真实 HOME + scratch PACMAN_HOME + PACMAN_MCP_CONFIG），
   再 run：POST /chief/threads 发工具指令轮 → 等 chief 步终态 → 断言
   （transcript / DB 行 / daemon log）→ D 面换绑 pi 总管再一轮。
3. before 面 `run --before`：同流，断言步 failed + 原因含 T4 fail-closed 文。

## 文件

| 文件 | 内容 |
| --- | --- |
| probe-claude-code-chief.mjs | 定制 probe（seed/run 两段；断言对照图 + 环境契约见文件头） |
| t4-echo-server.mjs | 第三面夹具：最小 stdio MCP server（initialize/tools/list/tools/call） |
| before-result.json | before 面 5 项检查（origin/main：chief 步 failed + T4 fail-closed 原因） |
| before-chief-messages.json | before 面线程消息行（chief-err system 行在列） |
| before-daemon-log.txt | before 面 daemon log 摘录（失败现场：`[step] failed: … not supported yet (T4)`） |
| after-result.json | after 面 30 项检查全 PASS（A/B/C/D/E 五面断言明细） |
| after-transcript.json | chief SDK transcript 摘录：toolUses = Bash, mcp__pacman__save_memory, mcp__pacman__notify_user, mcp__t4echo__echo |
| after-chief-messages.json | after 面线程消息行（用户指令 + assistant 回复 + transcript 上传行） |
| after-daemon-log.txt | after 面 daemon log 摘录（canon 行 + [mcp] loaded t4echo + 无 T4 降级行 + worker 步审计） |
| after-responses.json / before-responses.json | API 载荷记录（无凭据；after 含 worker transcript 摘录 mcp__pacman__set_task_meta / mcp__pacman__remote_shell） |

## 关键事实

- 模型对裸名指令（「调用 save_memory 工具」）与 MCP 前缀名
  （`mcp__pacman__save_memory`）的映射自行完成——chief systemPrompt 以裸名
  提及工具不构成阻断（票面已明示该命名面差异）。
- relay 名钉裸名：transcript 显示 `mcp__pacman__save_memory`，服务端
  executeChiefTool 按裸名 `save_memory` 命中——handler 闭包钉 def.name 的
  设计被端到端证实。
- worker 步的 localTools（remote_shell）与 remoteTools（set_task_meta）同链
  到达：E 面 transcript 同时含两族调用，预检闸的 `shell_command` done 行是
  localTools 真执行的服务端铁证（daemon 本地执行 + server 审计落库双证）。
- 本地 16 项单测（apps/daemon/test/claude-t4-tools.test.ts）覆盖转换保真
  （z.toJSONSchema 回投对拍）、fail-closed 词表、relay 裸名、isError 语义、
  endpoint 映射；runner-runtime 模式 7/8 翻成接线后行为；lint / format /
  typecheck 三闸绿，轻 CI 集（107 文件 / 1203 测试）本地全绿。
