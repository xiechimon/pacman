# 快捷键组（新任务 C + 空格呼出总管）

任意 shell 页（非输入态）按 `C` 开新建任务 dialog——侧栏「新任务」行动作入口（Plus 图标 + `sidebar-kbd` 的 C 角标，上游 todos.dev 形态）与热键共用同一 opener；按 `⌘J` 呼出总管抽屉且焦点落草稿框（dialog 家族 autofocus 律；#442 起 ⌘J 取代 Space，Space 回归原生语义）。守卫律：输入态（input/textarea/select/contenteditable）两键均不触发；交互态（button/a/role 族）Space 保留原生激活语义；修饰键组合（⌘C、Ctrl+Space 输入法）放行。键位 XMON-41 起由 N 改为 C（`n` 不再开面，小写键位、Shift 态两版一致不触发）。

## Sub-features

- `hotkeys-new-task` C 开 `.new-task-dialog`：board 走本页 dialog（fixture 保存落本地卡），project 页走本页 dialog（保存锚路由项目，PageShell `onNewTask` 透传），其余路由走 AppSidebar 内部全局 dialog（`useNewTaskSurface` 同一 live save 路径）。侧栏行点击 = 同一 opener。
- `hotkeys-chief-wake` `⌘J` 开 `.chief-drawer` + `.chief-composer-input` 持焦；Esc 关（#146 既有；#442 起 Space 不再是呼出键）。
- `hotkeys-kbd-hint`（#468）FAB 的 `⌘J` 悬浮提示 chip（`.kbd-hint`，XMON-14 起落在 `components/ui` 的 kbd 落点上）：静息 `visibility:hidden`，父控件 hover/focus-visible 浮出；契约 `[data-slot="kbd"]`。
- `hotkeys-guards` 输入态/交互态负向：搜索面板输入框持焦时 C/Space 不误触且字符照常入框；按钮持焦时 Space 原生激活按钮（不劫持）。

## How to get to it (user POV)

- 展开态侧栏「新任务」行（`button.sidebar-row` 含「新任务」文案 + `.sidebar-kbd` C 角标）。
- 键盘：任意页 `C`（非输入态）；`⌘J` 呼出总管抽屉。

## Driving it with verify-pacman

Preconditions:

- `launch.mjs` 起栈 + `doctor.mjs` 全 PASS。无需铺底（无项目时保存自动建「默认项目」，board-new-task 同律）。

- **全链。** Run `node <skill>/scripts/drive-hotkeys.mjs`。链路：侧栏行 + 角标断言 → 行点击开/Esc 关 → C 开（标题框持焦）→ 填题保存 → FAB 的 `⌘J` 提示 chip registry 契约 + 静息隐藏/悬浮浮出 → ⌘K 输入态负向（`c ` 入框、无 dialog/drawer）→ `⌘J` 开抽屉（草稿框持焦）→ /app/schedules C 开全局 dialog 保存。真值：`GET /api/todos` 双行（board 面 + schedules 面）+ SQLite `todo` 表双行。证据 `01..04-*.png` + `02b-kbd-hint.png` + `result.json`（titles 字段）。

- **键位专测（XMON-41）。** Run `node <skill>/scripts/drive-newtask-key.mjs [旧键]`。正负成对跑在同一页面状态上：c 开（`.new-task-dialog` + `.new-task-spec` 持焦）/ 旧键 `n` ×5 一次不开，三条渲染路径各一对（board 本页 / project 本页 / schedules 全局面），外加输入态守卫（`c` 入框不开面）、侧栏行点击入口、以及「c 开面 → 保存 → API + SQLite 双行」全链。旧提交栈上加 `--expect=old` 反转期望，用来证明「同等场景」集合没有随改键漂移。

## Gotchas

- **热键首按可能早于 hydration**（监听注册在被动 effect）：probe 内 `pressUntil` 重按至目标可见即停；两键均 open-only（非 toggle），重按幂等。
- **OverlayMount 的 mounted 滞后 open 一帧**（`useOverlayMount` 在 effect 里才 setMounted）：弹层「开后聚焦」若只挂 `[open]` effect，鲜开时节点尚不存在 = 焦点静默丢失。家族律 = ref callback 载首焦 + `[open]` effect 兜 retained-mount 重开（SearchPanel attachInput 先例；#389 把 NewTaskDialog/ChiefDrawer 收到同律）。
- fixture 面回归（守卫/角标/两路径）在 `apps/web/e2e/hotkeys.spec.ts`，不经本 probe。
