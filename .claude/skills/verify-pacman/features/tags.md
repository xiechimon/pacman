# 标签(新建任务对话框 + 详情 meta,#309/#323)

用户在新建任务对话框给任务打标签:footer「标签」行的虚线圆钮开标签面板(pill toggle 选已有 + 内联表单建新),选中的 tagIds 随 createTodo body 提交;任务详情 fresh meta 区按 tagIds 渲染 TagChip。**看板卡不渲染标签**(r9 §3.4 实测校准,#309 AC 修正)——渲染面仅详情 meta 区。规格源:r9 §3.4。

## Sub-features

- `tag-add-opens-panel` 新建任务对话框 footer「标签」行虚线圆钮(`.new-task-tag-add`)点击开标签面板。
- `tag-panel-toggle` 面板列项目已有标签(pill toggle,选中态)+ 内联新建表单(名称 + 颜色,缺省 TAG_DEFAULT_COLOR)。
- `tag-create-post` 内联新建 → `POST /api/projects/{id}/tags {name,color}` → 解析出新 tag id 自动选中。
- `tag-submit-with-todo` 保存任务时选中 tagIds 随 createTodo body 提交(`tagIds` 字段)。
- `tag-render-detail-meta` 任务详情 fresh meta 区按 todo.tagIds 渲染 TagChip(每标签一 chip);**看板卡不渲染**。
- `tag-live-source` live 面标签集 = useTags(projectId) 真值投影;fixture 面 = dialog-local 新建集兜底。

## How to get to it (user POV)

- 看板「新建任务」→ 对话框 footer「标签」行虚线圆钮 → 标签面板。
- 任务详情页(fresh/todo 相位)meta 区看已打标签的 chip(只读渲染面)。

## Driving it with verify-pacman

Preconditions:

1. `launch.mjs` 起隔离栈,`doctor.mjs` 全 PASS。标签是 UI + server 写路径,无需 daemon。
2. live 面:看板新建任务对话框(无项目时自动建「默认项目」,同 board-new-task)。

- **打标签建任务。** 看板「新建任务」→ 填标题 → 点 `.new-task-tag-add` 开面板 → 内联新建一个标签(名称)→ 选中 → 保存。Run `node <skill>/scripts/drive.mjs new-task`(基线)后手动补标签路径,或写定制 probe。
- **真值。** `POST /api/projects/{id}/tags` 返回新 tag;`GET /api/todos/{id}` 的 `tagIds` 含新 tag id;SQLite `tag` 表 + `todo_tag` 联结表有行;详情页 meta 区渲染 TagChip(`.fresh-tag-chip`)。
- **看板卡不渲染标签**(校准断言):建带标签任务后,看板卡(`.todo-card`)内**不应**出现 tag chip——这是 r9 §3.4 实测的负向断言。

## Gotchas

- **看板卡不渲染标签**是 #309 AC 的关键校准(r9 实测)——别按「打了标签看板该显」的直觉写断言,渲染面仅详情 meta 区。
- 标签属项目:无项目时新建标签会先触发「默认项目」自动创建(同 board-new-task 的无项目路径)。
- 颜色缺省 TAG_DEFAULT_COLOR(`#6366f1`),内联表单可改;tag record 三位(name/color/createdAt + v)。
- live 面标签集随选中项目变(useTags(projectId) 查询键随 dialog 上报的 projectId 动);切项目 → 面板标签集刷新。
