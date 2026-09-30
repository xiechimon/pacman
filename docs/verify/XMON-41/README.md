# 新任务快捷键改成 `c` —— 验证记录（XMON-41）

**结论：通过（pass）。**

验收标准原文（本 issue 描述）：

> 把 Pacman 中「新任务」的快捷键改成 `c`。
> 具体判定：在看板页面、原本新任务快捷键生效的同等场景下，按 `c` 弹出新任务创建入口；
> 旧快捷键不再触发新任务。

被测对象：PR [#548](https://github.com/xiechimon/pacman/pull/548) 分支
`agent/pacman/8951658784a8`（`b7eef764`，含 main 合流）。旧键基线：该改动的父提交
`65d9294a`（= main 在 XMON-37 落地前）。

## 判定拆解

| 标准分句 | 判定 | 依据 |
|---|---|---|
| 看板页按 `c` 弹出新任务创建入口 | 通过 | `.new-task-dialog` 出现，且正文框 `.new-task-spec` 持焦 |
| 原本快捷键生效的同等场景（同页面的另外两条渲染路径） | 通过 | project 页本页面、schedules 等非看板页的 AppSidebar 全局面，`c` 均开面且持焦 |
| 同等场景的守卫面不漂移 | 通过 | 输入态（搜索框持焦）`c` 照常入框、不开面；侧栏「新任务」行点击入口不受改键影响 |
| 旧快捷键不再触发新任务 | 通过 | `n` 连按 5 次，三条路径上弹层一次都未出现 |

无歧义项：验收标准对「入口」的可观察形态没有额外限定，本记录以「新任务弹层出现 + 正文框持焦」
为入口判据，并要求它确实是新建任务面（保存后落 API + SQLite 真值，见下）。

## 复现步骤

1. 取代码并起隔离栈（worktree 车道须从 worktree 路径跑脚本）：

```sh
multica repo checkout https://github.com/xiechimon/pacman.git --ref agent/pacman/8951658784a8
cd <worktree> && pnpm install
VERIFY_REPO_ROOT=$PWD VERIFY_PORT=8795 VERIFY_WEB_PORT=5285 \
  node $PWD/.claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=$PWD VERIFY_PORT=8795 VERIFY_WEB_PORT=5285 \
  node $PWD/.claude/skills/verify-pacman/scripts/doctor.mjs      # all PASS
```

2. 跑键位专测（正负成对）：

```sh
VERIFY_REPO_ROOT=$PWD VERIFY_PORT=8795 VERIFY_WEB_PORT=5285 \
  node $PWD/.claude/skills/verify-pacman/scripts/drive-newtask-key.mjs
```

3. 手验（同一条路径，浏览器直开 `http://127.0.0.1:5285/app`）：
   看板页非输入态按 `c` → 弹层出现、光标在正文框；Esc 关；连按 `n` → 什么都不发生；
   点侧栏「新任务」行 → 同样开面。

4. 基线对照（可选，证明键位只是对调、场景集合没变）：在 `65d9294a` 的 worktree 上起第二套栈
   （不同端口），把同一脚本拷进去后加 `--expect=old` 跑，期望反转。

5. 回收：`node $PWD/.claude/skills/verify-pacman/scripts/cleanup.mjs`。

## 实测结果（subject，`c` 为新键）

`2026-09-30T23-34-26-038Z-newtask-key/result.json`：**18/18 ok**。

| # | check | 观测 |
|---|---|---|
| 1 | board-ready | 看板 shell 就绪（`[data-route="board"]`） |
| 2 | sidebar-badge-key | 侧栏「新任务」行 `.sidebar-kbd` 角标 = `"C"` |
| 3 | sidebar-row-click-opens | 行点击开 `.new-task-dialog` = true |
| 4-5 | board-new-key-opens / -focus | `c` → 弹层出现=true，正文框持焦=true |
| 6 | board-old-key-stays-closed | `n` ×5 → 弹层出现=false |
| 7 | board-input-state-guard | 搜索框持焦按 `c`：入框=`"c"`，弹层=false |
| 8-9 | schedules-new-key-opens / -focus | `c` → 开面=true，持焦=true |
| 10 | schedules-old-key-stays-closed | `n` ×5 → 出现=false |
| 11 | project-page-ready | 项目页 `/app/project/<id>` 就绪 |
| 12-13 | project-new-key-opens / -focus | `c` → 开面=true，持焦=true |
| 14 | project-old-key-stays-closed | `n` ×5 → 出现=false |
| 15-16 | chain-open / chain-saved-closed | `c` 开面 → 填题 → 保存 → 弹层收起 |
| 17 | api-todo-created | `GET /api/todos` 命中新任务（id `_Dr5Rn-3xWCJaQMBRxrNV`） |
| 18 | db-todo-created | SQLite `todo` 表命中同名行 |

## 基线对照（`65d9294a`，`n` 为旧键，期望反转）

`2026-09-30T23-35-00-000Z-newtask-key-baseline/result.json`：**12/12 ok**。

- `n` 在 board / schedules / project 三条路径上均开面且正文框持焦 → 旧键确为 `n`，
  「同等场景」这一集合与 subject 完全一致（同一脚本、同一断言位）。
- `c` 在三条路径上 ×5 均不开面 → 改键前 `c` 确无此行为。
- 输入态守卫两版一致（`c` 入框、不开面）。

两版的差异因此收敛为「开面键互换」一件事，没有附带的行为漂移。

## 附带核实（超出 AC 但同源）

- 侧栏角标随键位同步为 `C`（AC 未点名，作为观测量记录，不参与判读基调）。
- Shift 态两版一致：改键前 `Shift+n` 也不开面，改键后 `Shift+c` 同样不开面——
  小写键位语义未变，不存在因改键丢掉的 `Shift` 变体。
- 工具链 `drive-hotkeys.mjs` 原断言 `N`，改键后按维护纪律同步为 `C` 并复跑
  **14/14 ok**（`2026-09-30T23-35-41-538Z-hotkeys/result.json`），全链
  （角标 / 行点击 / 开面持焦 / 保存落 API+SQLite / ⌘J 抽屉 / ⌘K 输入态负向）保持绿。

## 环境

- 隔离栈：server `8795`、web dev `5285`、scratch `PACMAN_HOME=<worktree>/.claude/verify-run/home`；
  `doctor.mjs` all PASS。默认 8791 被别的车道占用，按端口纪律换口，未碰他人端口。
- 基线栈：server `8797`、web `5290`，独立 scratch 库（`.baseline-old` worktree，detached `65d9294a`）。
- 两套栈各自全新库、各自 seed 用户 Owner；未触碰 `~/.pacman` 与 8787/5173 上的活跃栈。
- 证据：截图 1440×732（与 e2e 同口径）+ 逐条 checks 的 `result.json`。

## 记录之外

- 本票未改 `apps/` 与 `packages/` 下任何文件；本次改动只落在验证侧
  （`docs/verify/XMON-41/` 与本验证 skill 的 probe/feature map）。