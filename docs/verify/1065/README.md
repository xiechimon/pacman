# #1065 验证证据索引 — 僵尸认领：claim 绑请求存活态

探针 = `.claude/skills/verify-pacman/scripts/drive-1065-zombie-claim.mjs`（**纯 live 栈**——无 daemon / 无浏览器 / 无 LLM：死机 A = 子进程 claim 长轮询被 SIGKILL，活机 B = 探针本进程 claim；步不需要被执行，认领归属就是断言面）。运行日 2026-10-09；双栈对拍：after = 本分支 worktree（8791/5273），before = `origin/main` 一次性 worktree（8793/5275，`git worktree add --detach` + corepack install）。

**结论：claim 长轮询的请求方死亡后，服务端 waitWake 不再替死机认领新步；活机路径行为不变。**

| 腿 | checks | 钉住的事实（红即指认断点） |
|---|---|---|
| before（origin/main） | 1/4 红 | A 认领进程 SIGKILL → 入队新步 → wake 按插入序先醒僵尸 waiter → **步落死机**（DB 行 machineId=死机、status=claimed）、活机 B 空手（step=null）——票面现象可断言复现 |
| after（本分支） | 4/4 绿 | 同场景同序：A 的 waiter 随连接断（请求 signal abort）摘除 → 步留 pending → 活机 B 经 wake 路径领走（machineId=B）；死机零认领；claim 随 abort 即时返回 |

真值件（本目录）：`before-result.json` / `after-result.json`（checks 逐条 + machineId 实值）+ `unit-before-summary.txt` / `unit-after-summary.txt`（单测 4 失败→6 通过）+ `rerun-1025-run1/run2-result.json`（#1025 探针背靠背双跑 13/13 ×2——复跑不再撞僵尸 claim 窗口，同时覆盖活机**真 daemon** 全链领步执行，双向验收的活侧实物）。机理图 `zombie-claim.drawio.svg`（可编辑源 `zombie-claim.drawio`）。

## 复跑配方

```sh
# 栈（端口撞了顺延 VERIFY_PORT/VERIFY_WEB_PORT，别杀邻道）
VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/launch.mjs
# 最小场景探针（改前红复现：VERIFY_REPO_ROOT 指向 origin/main 的一次性 worktree 栈）
env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY NO_PROXY='*' \
  VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/drive-1065-zombie-claim.mjs
# 背靠背噪声复跑（#1025 探针 ×2，每 run 换 DAEMON_HOME）
env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY NO_PROXY='*' \
  DAEMON_HOME=/tmp/pacman-1025-r1-<新后缀> node .claude/skills/verify-pacman/scripts/drive-1025-plan-first-round.mjs
node .claude/skills/verify-pacman/scripts/cleanup.mjs
```

## 结果判读

- **before 腿的 1/4 是预期红**：唯一 PASS 是「A 进程确实被 SIGKILL」的场景前提自检；三红 = 票面现象三面（死机领步 / 步落死机 / 活机空手）。
- **after 腿的 waiter 摘除不依赖 DB 位**：探针里两台机器行恒 online=true——判据绑请求存活态（连接断 → node-server abort Request signal），不绑 machine.online（SSE onAbort 与 claim 长轮询是异步竞速，tryClaim 本也不消费它）。
- **abort 传播窗口**：探针在 kill 与入队之间留 1s；即便摘除滞后，claimStep 出口的 signal 复查是第二道闸（wake 先醒、abort 后到的竞序由单测第 2 条钉住）。
