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

- **跑法。** `setup-branch-sync-seed.mjs` 造现场(API 建 provider/agent/project/todo/build + 在 /tmp 造**真 git 现场**：bare origin 上 C1→C2,目标克隆停在 C1 且有未提交改动 + 未跟踪文件;并把 build 的 `step.checkpointCommit` 置为 C2)。用 seed 输出的 `apiKey` 起真 daemon:`pnpm exec tsx src/cli.ts start --foreground --api-key <k> --team <teamId> --server http://127.0.0.1:<port>`(缺 `--team` 会报 machine not enrolled)。然后 `node <skill>/scripts/drive-branch-sync.mjs <todoId> <buildId>`。
- **同步路径。** 详情页 → 「分支与 PR」→ 同步到机器 tab → 选机器 pill → 填同步目录 → 开强制同步 → 点「同步」→ 结果卡 pending→running→synced。
- **真值。** `POST /api/builds/{id}/branch-sync` 200;SQLite branch_sync 表有行(migration #328);结果卡终态 synced;**目标目录真被 git 复位**(HEAD == checkpointCommit + 工作区干净 + 未跟踪文件被 force 清)——目标事前是脏态,所以「本来就干净」蒙混不过去。
- **daemon 起始状态会吃掉 plan 步。** daemon 一连上就认领并跑 build 的 plan 步;stub provider 不可达 → 步 failed、todo 掉 failed 相位。**不影响同步**:`canSync = buildId !== null && live`,与相位无关;checkpointCommit 也不被动。

## Gotchas

- 同步是 daemon 执行面(git/worktree 操作),纯 server seed 不够——需真 daemon 在线 + build 有可同步分支。
- 结果卡走 team stream SSE 事件迁移(pending→running→synced/failed),不是一次性响应;drive 要等终态。
- fixture 面同步钮不可点(占位 UI,r7);live 面才接真。
- 机器选择走 useMachines 真值,只有在线机器可选。
- **调用方必须传 `buildId`**(实测坑):`BranchDialog` 的 `buildId` 是 prop-only,数据层只暴露 { live, teamId },派生不出当前 todo 的 build。两个调用点(todo-detail-page / board-page)漏传时 `canSync` 恒 false → 同步 tab 永远停在 r7 占位 UI(机器 pill 不可点、目录只读、同步钮 disabled),而**界面上没有任何报错**,极易被当成「设计如此」。M7 收尾 re-probe 时实测踩到(PR #328 只留 server wire 测试,无 web e2e / integration 覆盖这条 wiring)。
- **验证状态(2026-09-28)**:主仓 live re-probe 已补——`drive-branch-sync.mjs` 15 checks 全绿,证据归档 `docs/verify/319/2026-09-28T11-32-32-777Z-branch-sync/`。
