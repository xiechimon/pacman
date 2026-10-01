# XMON-74 / XMON-115 权限闭环 live 验证证据

隔离栈（verify-pacman：server 8791 + vite 5273 + scratch PACMAN_HOME，全新库）上
走真 HTTP、真 UI（Playwright chromium 1440x732）、真 SQLite 的全链证据。
25/25 checks 全 PASS，逐条明细见 `result.json`。

## 复现

```sh
# 栈（worktree 根）：
VERIFY_REPO_ROOT=$PWD node .claude/skills/verify-pacman/scripts/launch.mjs
# 探针（一次性脚本，随证据归档；跑完 cleanup.mjs 回收）：
node docs/verify/XMON-74/xmon74-probe.mjs
```

## 证据链（对应 XMON-74 三问）

| 问 | 证据 | 结论 |
|---|---|---|
| Q1 开关默认态是否全 off | `01-agent-created-defaults.json`（REST 建 agent → `tools:["推送分支"]`）+ `02-perms-default.png`（权限 tab 六开关：远程 shell OFF、推送分支 ON） | 非全 off：新建 agent 默认 `AGENT_TOOL_DEFAULTS=['推送分支']`，其余五档 off（XMON-84 拍板 B4） |
| Q2/Q3 chief 授权写点闭环 | `03-claim1-remoteTools.json`（chief 步 claim 携带 50 词表含 `set_remote_shell`）→ `04-relay-grant.json`（relay 授权 → `tools:["推送分支","远程 shell"]`）→ `05-agent-get-after-grant.json`（REST GET 同值）→ `06-sqlite-agent-row.json`（SQLite 行同值）→ `08-perms-chief-granted.png`（UI 开关 ON） | chief relay 与 REST PATCH 写同一 `agent.tools` 字段、同过 `filterAgentTools`，双入口单真相 |
| 守卫面 | `07-relay-revoke-guard-regrant.json`：撤回只摘 shell 不动推送分支；不存在 agentId → 404 且不写 | 越权/误写 fail-closed |
| 执法消费面（双闸） | `07b-chief-dispatch-workers.json`（chief `run_builds` 直派两个 worker 步）+ `10-worker-claims-localTools.json`：worker1 agent 开关开 ∩ 机器 `shellEnabled=false` → `localTools:[]`（fail-closed）；`09-machine-shell-enabled.json` 开机器闸后 worker2 → `localTools:["remote_shell"]` | agent 开关 ∩ 机器开关双闸齐开才注册工具（XMON-108 R1 判定单源 `claimLocalTools`） |

注：chief 步 claim 不携带 `localTools`（chief 无本机执行面，XMON-108 R1 设计；
预检端点对 chief 步 409），双闸消费点在 worker 步 claim——`03` 的
`localTools:[]` 是该设计的体现，不是闸闭证据；闸闭/齐开对照见 `10`。
