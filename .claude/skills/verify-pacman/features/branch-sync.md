# 分支同步(详情页 branch-dialog,#319/#328)

用户在任务详情页「分支与 PR」弹层的「同步到机器」tab 把 build 的 worktree 分支同步到目标机器:选机器 pill → (可选)强制同步 toggle → 点「同步」钮 → `POST /api/builds/{id}/branch-sync` → daemon 执行 git/worktree 同步 → team stream `branch_sync` 事件回显结果卡(pending→running→synced/failed)。规格源:r1 changelog 09-13 + 08 册附录 B。

## Sub-features

- `branch-dialog-sync-tab` 详情页「分支与 PR」钮开 branch-dialog,「同步到机器|Git」分段控件,同步 tab 含机器 pill + 同步目录 + 强制 toggle + 同步钮。
- `machine-select-live` 目标机器 pill 走 useMachines 真值选择(在线机器可选);fixture 面占位不可点。
- `sync-post` 「同步」钮 → `POST /api/builds/{id}/branch-sync`(server branch_sync 表 + 状态机)。
- `sync-daemon-exec` daemon 收 team stream sync 派发 → performSync 执行 git/worktree 同步。
- `sync-result-card` 结果卡随 branch_sync 事件迁移:pending → running → synced/failed。
- `sync-any-member` 任意团队成员可用(非仅 owner)。

## How to get to it (user POV)

- 任务详情页头部「分支与 PR」钮(`button[aria-label="分支与 PR"]`)→ branch-dialog →「同步到机器」tab。

## Driving it with verify-pacman

Preconditions:

1. `launch.mjs` 起隔离栈,`doctor.mjs` 全 PASS。
2. 同步执行需真 daemon(在线机器)+ build 有 worktree 分支;live 面。
3. seed 一个有 build 的 todo + enroll machine(同 stop-button 的 daemon 守门)。

- **同步路径。** 详情页 → 「分支与 PR」→ 同步到机器 tab → 选机器 pill → 点「同步」→ 结果卡 pending→running→synced。
- **真值。** `POST /api/builds/{id}/branch-sync` 200;SQLite branch_sync 表有行(migration #328);team stream 出 `branch_sync` 事件;daemon.log 有 performSync 行;结果卡终态 synced。

## Gotchas

- 同步是 daemon 执行面(git/worktree 操作),纯 server seed 不够——需真 daemon 在线 + build 有可同步分支。
- 结果卡走 team stream SSE 事件迁移(pending→running→synced/failed),不是一次性响应;drive 要等终态。
- fixture 面同步钮不可点(占位 UI,r7);live 面才接真。
- 机器选择走 useMachines 真值,只有在线机器可选。
- **验证状态(2026-09-28)**:本功能由 #328 lane 验证(shared branch_sync record + server 表/状态机 + daemon performSync 四层,integration + lane verify run),证据随 worktree 删除未留主仓;主仓 live re-probe 待补(需 daemon + 可同步 build 分支)。user path 从合并代码核实。
