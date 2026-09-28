# 新建任务(看板)

用户在看板上把一件事变成持久任务:点「新建任务」开 dialog、填标题、保存,卡片落进「待开始」列;全新库无项目时系统自动建「默认项目」再落任务(todo → project 两跳,用户无感)。

## Sub-features

- `board-render` 看板 shell 渲染 6 列(待开始/规划中/确认/搭建中/待验收/完成)。
- `newtask-open` `.board-new-task` 钮开 dialog(`.new-task-dialog`,标题输入 `.new-task-input`,placeholder「需要做什么?」)。
- `newtask-save` 「保存」(`.new-task-save`)落卡;「保存并开始」(`.new-task-start`)建卡后还会起 build(会派给 Agent,无 Agent 时行为未铺,勿默认验)。
- `newtask-autoproject` 无项目时自动建「默认项目」(hosted),任务挂其下。
- `newtask-persist` 卡片三重真值:板上可见 + `GET /api/todos` 行 + SQLite `todo` 表行。

## How to get to it (user POV)

- 看板顶栏「新建任务」按钮(唯一入口;详情页/总管另立后票)。

## Driving it with verify-pacman

Preconditions:

- `launch.mjs` 起栈(全新库),`doctor.mjs` 全 PASS。

- **渲染。** 开 `/app`,看板出现。Run `node <skill>/scripts/drive.mjs board`。6 个 `.board-column` + `.board-new-task` 可见,证据 `01-board.png`。
- **新建。** 点「新建任务」→ 填标题 → 点「保存」。Run `node <skill>/scripts/drive.mjs new-task`。它完整走该链:dialog 开 → 标题上屏 → 卡片落 `[data-column-list="todo"]` 带 `#seqNum` → `GET /api/todos` 找到该 title 且 `phase=todo` → SQLite `SELECT id,title,phase,seqNum FROM todo WHERE title=?` 命中。证据 `01-board-before.png` / `02-new-task-card.png` + `result.json`(含 apiTodo/dbTodo 字段)。
- **持久化(重载)。** new-task probe 后手动补:reload `/app`,同一 `.todo-card[data-todo-id]` 仍在「待开始」列(卡片 = 查询真值渲染,重载即二次确认)。
- **项目 chip。** dialog 里 `.new-task-project` 显示当前项目(全新库首建后 =「默认项目」);多项目时点开 `.new-task-project-menu` 选行(`aria-selected`)——选择是纯表单态,随提交走(fixture 面 e2e newtask-project-select.spec.ts 已锁该行为,live 复验非必须)。

## Gotchas

- 「保存并开始」会 POST builds(起运行)——不属本 feature 的最小证明,别顺手点。
- 全新库下第一张卡会先触发自动建项目(两跳 mutation),卡片出现比单跳慢一拍;probe 的 15s 等待已覆盖,手动验时别提前断言。
- 断言用 `[data-column-list="todo"]` 定列 + 卡片 `data-todo-id`,别按列序/坐标猜。
- API/DB 断言要与板上同一 title 对齐;标题带时间戳防撞上残留数据(全新库理论无残留,防的是复用旧栈)。
