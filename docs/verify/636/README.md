# #636 看板筛选面板照参考站重做 —— 证据

fixture 栈（`vite build --mode fixture` + `vite preview`，1440x732，light
scheme）开面板态元素截图；before = `origin/main` 一次性 worktree 栈（port
8402），after = 本分支栈（port 8401）。探针：点开 `.board-type-filter` 后选
一个选项（board-tags 选 bug / board-repos 选 canon 项目），鼠标移开行表再截
（静息态：计数在位、hover 控件隐藏）。

- `reference.png` —— 用户提供的参考站（todos.dev）面板截图（原图副本）。
- `before.png` / `after.png` —— board-tags 场景：类型维（选 bug 后）。
- `before-repos.png` / `after-repos.png` —— board-repos 场景：仓库维（选
  canon 项目后；零命中项 r4-quiet 在 after 不画计数）。

对齐面（参考站实测值 → 本面）：维度标题（11px semibold tracking-wide）→
checkbox 行（28px 高、行首 16px 圆角 checkbox、计数仅命中时画在右端）→
全选行（行表首：三态 checkbox + 全选，右端反选）→ 全出血分隔线 → 下一维度。
创建者维度不搬，类型轴居其段位。
