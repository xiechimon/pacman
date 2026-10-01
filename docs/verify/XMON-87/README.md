# 新建任务项目选择器记住上次选择（XMON-87）—— 验证记录

**结论：通过（pass）。**

验收标准原文（本 issue 描述）：

> 1. 选中一个非首位项目（如 Pacman）→ 刷新页面 → 选择器仍选中该项目。
> 2. 边界：清掉/伪造一个不存在的项目 id 后刷新 → 回退到第一个项目且页面正常。

## 改动

选择此前是纯组件 state（`new-task-dialog.tsx` 的 `projectId`），关窗不丢、刷新即回
`rows[0]`。现在全局面（看板 / 侧栏全局 dialog）把选中的项目 id 落到 localStorage
`pacman.newTaskProjectId`：挂载读一次、选行写回。

`rememberProject` 只由 `use-new-task-surface` 在**无锚**（`anchorProjectId ===
undefined`）时打开。project 页自己的 dialog 走锚定面（#404/#305）：那面的未动选择
按规矩恒等于路由项目，全局记忆会把它顶掉 —— 故不记忆。

项目集里没有这个 id 时（被删 / 无权限 / 还没加载完），`rows.find` 打空、`selected`
落回 `rows[0]`，记忆位原样留着不清（行集可能只是未加载，按缺省清会误伤真值）。

## 证据

fixture 构建（`vite build --mode fixture`），场景 `newtask-projects`（r3-lifecycle /
r2-inventory 双项目）。

| 图 | 说明 | 实测 |
|---|---|---|
| `1-cold-start.png` | 冷启动，无记忆 | chip = r3-lifecycle（首行） |
| `2-picked-r2-inventory.png` | 选第二行 | chip = r2-inventory，存储 = r2-inventory |
| `3-after-reload.png` | **刷新后**（验收 1） | chip 仍是 r2-inventory |
| `4-after-reload-menu-open.png` | 刷新后展开列表 | aria-selected 行 = r2-inventory |
| `5-forged-id-fallback.png` | **伪造 id**（验收 2） | 存储 = ghost-project → chip 回 r3-lifecycle，看板 4 列照常渲染 |

自动化：`apps/web/e2e/newtask-project-persist.spec.ts`（4 例，改动前 2 红 2 绿，
改动后全绿）。邻面回归：`newtask-project-select.spec.ts` / `project-empty-new-task.spec.ts`
/ `hotkeys.spec.ts` 同批 28 例全绿。

## 续：项目选择器快捷键 ⌘P

需求（issue 评论）：给新建任务 dialog 的项目选择加一个切换快捷键，并按主页「C」
角标的样子把它提示给用户。

`⌘P` / `Ctrl+P`（P = project；与 ⌘K / ⌘J 同族）在 dialog 打开时 toggle 项目选择器，
再按一次收起（#468 toggle 律）。**键盘开的这一路把焦点落到当前选中行**——鼠标开的那
一路不动焦点（点击本身就是选择动作）。chip 上挂 ⌘P 提示 chip（`KbdHint`），与「C」
角标同族：静息隐藏，hover / focus-visible chip 时浮出。

守卫按 ⌘J 的 drawer 豁免同律收窄（`isEditableOutsideNewTaskDialog`）：dialog 打开即
autofocus 落 spec textarea，守卫若照吞输入态，和弦在它唯一该生效的地方就是死的。
dialog 关着时 hook 不注册（`useChordHotkey(..., enabled)`），⌘P 原样还给浏览器。

| 图 | 说明 | 实测 |
|---|---|---|
| `6-sidebar-c-badge.png` | 用户指的参照物：侧栏「新任务」行的常驻 C 角标 | badge = `C` |
| `7-cmdp-opened-picker.png` | **⌘P** 开选择器 | 菜单可见，焦点 = `button.new-task-project-row`，`aria-selected=true` |
| `8-cmdp-hint-hover.png` | hover chip | 提示 chip 浮出，字面量 `⌘P` |

自动化：`apps/web/e2e/hotkeys.spec.ts` 新增 3 例（⌘P toggle + 选中行接管焦点、
chip 悬浮提示静息隐藏、dialog 关闭时 ⌘P 不响应），改动前 2 红，改动后 18 例全绿；
邻面 `newtask-project-select` / `newtask-project-persist` / `project-empty-new-task`
同批 13 例全绿。