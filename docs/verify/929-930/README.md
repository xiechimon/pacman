# #929 / #930 verify 证据（命令闸 tool_call 缝 + pi 原生 MCP 桥）

probe = `drive-929-930`（`.claude/skills/verify-pacman/scripts/drive-929-930.mjs`），
2026-10-08 跑于 worktree 栈（server 8791 + web 5273 + 独立 PACMAN_HOME scratch）。
**14/14 PASS**（`result.json` 逐条对齐）。

## 票面验收 ↔ 证据对照

| 验收（票面原文） | 证据 |
|---|---|
| #929 放行路径：原本放行的命令仍然放行 | `messages.json`（printf 改动落 README.md，步过产物闸 done）；`detail-transcript.png` pill `bash printf …` |
| #929 拒绝路径：仍被拒且模型拿到同义 reason 文案 | `daemon.log` `[gate] ask: rule=ask-rm-rf-root command=rm -rf /`；`messages.json` 含 `command gate (ask-rm-rf-root)` 三行拒绝文案（error tool result） |
| #929 无人值守安全 | 实现面保证：`gateToolCallHandler` 签名只有 event（无 ctx/ui 依赖，`command-gate.test.ts` F4 钉） |
| #929 覆盖面：MCP 工具调用也走同一条闸 | `integration/test/gate-e2e.test.ts`（注入规则 reject `mcp__demo__echo`：[gate] 行 + 工具面拒绝文案 + 外部 server 零到达） |
| #930 一个真实 MCP server：接通、工具可调、命名逐字节一致 | `messages.json` `mcp__demo__echo` 工具行 + echo 回文 marker；`first-request-tools.json`（首轮声明面）。命名限定语：slug 与工具名均为 `[A-Za-z0-9_]` 时与旧桥逐字节一致（fixture 即此子集）；pi 会把其余字符归一成 `_` 并对超长/撞名加 hash 后缀——含 `-` 等 slug 的旧形不再逐字节保真（代码注释与 PR body 均按此口径） |
| #930 单点失败：降级 + canon 行 + 不阻断 | `daemon.log` `[mcp] dead: connect failed — its tools are unavailable this turn: failed: fetch failed`；步 done（`result.json` 第 3 条） |
| #930 新增能力立证：resources 工具可用 | `messages.json` 含 `demo-note-content`（read_mcp_resource 读回）；`detail-transcript.png` pill `read_mcp_resource` |
| #930 既有授权面零回归（勾选表决定谁能出现） | `daemon.log` `[mcp] loaded from …: demo, dead` + `[mcp] ghost: not in local config — …`（勾了 ghost 但 config 没有 → 该 server 不出现） |

另两条实现期钉死的行为（本组证据顺带立证）：

- **MCP 工具直报模型**：`first-request-tools.json`——首轮请求 tools 含
  `mcp__demo__echo` / `read_mcp_resource` / `list_mcp_resource*`（pi 原生
  exposure=direct + 会话允许清单带 `mcp__*` pattern）。
- **会话收尾关连接**：步终态后 MCP stdio 子进程计数归零（单会话
  `dispose()` 不发 session_shutdown——pi 源读 + 探针实测；`pi.ts` 的
  `shutdownExtensions()` 补发该事件，无孤儿子进程泄漏）。

## 复跑配方

```sh
# 1) 起隔离栈（端口被占先换 VERIFY_PORT/VERIFY_WEB_PORT）
node .claude/skills/verify-pacman/scripts/launch.mjs
# 2) 跑探针（自 spawn：stub LLM + stdio MCP fixture + 真 daemon；收尾自回收）
node .claude/skills/verify-pacman/scripts/drive-929-930.mjs
# 3) 收尾
node .claude/skills/verify-pacman/scripts/cleanup.mjs
```

探针可覆写 env：`DAEMON_HOME`（daemon scratch）/ `MCP_HOME`（MCP config +
fixture 脚本根）。fixture server 脚本运行期落在 `apps/daemon/` 内（ESM
解析需要），探针 finally 删除。

## gotcha

- 详情页 transcript 的「工具过程」组**默认收起**——拍 pill 要先点开
  `button[aria-expanded=false]`（label 工具过程）；首轮跑只有 DB 断言绿、
  截图断言红就是这个。
- 死端点的 canon 行在**首轮请求的 before_agent_start 等待**里落（pi 对
  direct server 有 10s startup wait，`127.0.0.1:1` fetch failed + 两次重试
  ≈1.5s 结算）——行出现在第一条模型请求之前，不在步启动时刻。
- stub LLM 的 call id 必须每运行唯一（drive-918 同坑：message 表主键 =
  call id，复用会把工具行钉进旧会话）。
