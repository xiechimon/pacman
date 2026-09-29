# 迁移面盘点：ui 原语消费矩阵 + css 依赖图 + 三面钉扎点清单

> 票：#409（地图 #406「apps/web 组件架构切换到 shadcn/ui」的研究票）。
> 目的：为切片策略与 e2e 重钉策略供事实——原语谁在用、23 个 css 谁依赖谁、
> 三面钉扎（web e2e 类名断言 / integration locator / 视觉几何断言）各钉了哪些
> 选择子、散件 css 收编难度分级。
> 方法：纯本地读码（grep + 逐文件抄录 import 语句），未起服务未跑测试。
> 基线：`origin/main @ 8c30775`（2026-09-29，#394 新建任务无标题面 + #401 快捷键组已合入）。
> 140 tsx / 23 css（与地图笔记一致）。

## 0. 口径

- **import 文件数** = grep `ui/<name>` 命中且不在 `ui/` 目录内的 tsx/ts 文件数（已人工复核排除纯注释提及）。
- **JSX 实点数** = `<Component` 出现次数（props 折行导致的行尾断行已计入）。
- **css 依赖边** = 逐文件抄录 `^import .*\.css` 原文（45 条），不走 basename 猜测——`detail/overlays.css` 与 `overlays/overlays.css` 同名不同物，basename 匹配会把两者消费面混为一谈（本盘点中途实测撞上一次，已纠正）。
- **钉扎点** = `locator('.…')` 类名选择子（web e2e 与 integration 同口径）；几何断言 = `boundingBox` 调用点 + 视觉 spec 内 `page.evaluate` 探针的 expect。

## 1. ui/ 原语消费矩阵

`apps/web/src/ui/` 共 7 原语 6 css（avatar 无 css，纯行为原语：dicebear 生成 + onError 兜底，视觉尺寸由消费面 per-face css 给定）。

| 原语 | 样式 | import 文件 | JSX 实点 | 消费文件分布 |
|---|---|---|---|---|
| Button | button.css (41 decl) | **22** | **38** / 21 文件 | 全域：board 3、chief 2、detail 5、overlay 4、pages 3、resources 2、routes 3 |
| Card | card.css (6 decl) | **0** | **0** | **死原语**——见 §1.1 |
| Chip | chip.css (25 decl) | 2 | 2 | detail/dhead.tsx、resources/parts.tsx |
| DialogShell | dialog.css (126 decl) | 11 | 11 | 11 个 dialog 各 1 处壳（chief 2、detail 4、resources 3、routes 2） |
| Input | input.css (24 decl) | 6 | 12 | token-gate、search-panel、4 个创建 dialog（create-provider 一处 6 点） |
| TagChip | tag-chip.css (14 decl) | 1 | 1 | 仅 detail/fresh-block.tsx |
| Avatar | —（无 css） | 9 | 12 | sidebar、todo-card、detail 2、overlays 2、pages 1、routes 2 |

Button 消费 Top：overlay/new-task-dialog 6 点、detail/overlays 5 点。

### 1.1 四个原生事实（直接影响选型/切片）

1. **Card 是死原语**。`ui/card.tsx` 导出 `Card`（tone: card/inset/elevated），全仓 0 import、0 JSX；card.css 仅被 card.tsx 自引。真实「卡片」是 **7 个 per-face 类族**，全部绕开原语直写域 css：
   - `res-card`/`res-rowcard`（resources.css：machines/secrets/skills/mcp-servers 4 页行卡）
   - `prj-set-card`（pages.css：项目设置）、`prj-task-card`（pages.css：项目任务卡）
   - `sched-card`（pages.css：定时列表卡）、`team-agent-card`（secondary.css：团队网格卡）
   - `account-card`（secondary.css）、`authorize-card`（machine-authorize.css）
   迁移含义：shadcn Card 落地不是「替换 Card 原语」，而是**新立组件 + 收编 7 族散写**；card.tsx/card.css 可直接退役。
2. **DialogShell 族有一个出族大户**。overlay/new-task-dialog.tsx 在 #394（无标题单字段面）后**不再用 DialogShell**——手搓 OverlayMount + ClickCatcher + Esc 三件套（家族律 #67/#127 的原始形态），仅保留 `.new-task-dialog` 类名作 e2e 锚。它同时是 TagChip 的原第二大消费面，#394 固定标签词表后 TagChip 只剩 fresh-block 一处。**弹窗族实际 = DialogShell 11 壳 + new-task-dialog 1 个手工壳**，迁移时这第 12 个面要么收编回族要么单独立项。
3. **per-face 类名 = e2e 定位别名**（ui/README 规则 2 明文）。例：dhead.tsx 渲染 `<Chip variant={tone} className="detail-chip--{tone}">` 且外层保留 `.detail-chip` 基类——e2e 按 `.detail-chip` 定位点击。同类别名遍布全仓（token-gate-input/-submit、fresh-tag-chip、new-task-dialog…）。**迁移组件时类名别名必须原样保留或 e2e 同步重钉**，这是三面钉扎（§3）与组件层之间的契约面。
4. **1 处死 import**：routes/account-page.tsx 引 `Button` 从未渲染（#148 账户页净化残留，lint 未拦）。

另：overlay/token-gate.tsx 源码注释提及「样式本体在 ui/input.css / ui/button.css」，易被 grep 误读为直引 css——实测只 import 组件，无 seam 违规。

## 2. css 依赖图

23 个 css 分三层。依赖边全部来自 tsx 顶部静态 import（无任何 css `@import` 他 css；唯一 `@import` 是 app.css 引 tailwindcss）。

### 2.1 全局层（main.tsx 直引 4 件）

| 文件 | 体量 | 角色 |
|---|---|---|
| styles/tokens.css | 16.4K，119 个 distinct token（:root = dark 默认 L11，.light 镜像 L231） | 唯一 token 源 |
| styles/fonts.css | 22 decl | @font-face + --font-inter |
| styles/motion.css | 35 decl | 动效 token/关键帧 |
| styles/app.css | tailwind @import + `@theme inline` 映射（--color-* → tokens.css 变量）+ 全局 focus 环收编（#388） | tailwind v4 入口 |

token 流通实测（全 src grep `var(--`）：

- **119 定义 / 109 被消费 / 19 个死 token**（defined-but-unused）：`--active-text` `--blue-400` `--card-ghost-border` `--chip-active-bg` `--chip-active-border` `--col-dot-building` `--col-dot-confirm` `--col-dot-idle` `--col-dot-planning` `--col-dot-review` `--disabled-fg` `--indigo-400` `--nav-bg` `--send-disabled` `--space-1..4` `--space-6`。col-dot 五态整族 + space 间距族全灭——迁移前可先清。
- **5 个被消费但全仓无定义**（无 fallback，共 20 处 var() 引用）：`--surface-base` `--border` `--ring` `--text` `--text-muted`——**全部由 overlay/mention-picker.css 独占**。该文件系 #311 从参考应用移植时带入的对岸 token 名，#334 只 token 化了圆角；css 变量未定义且无 fallback = IACVT（background/border 这类非继承属性落 initial——面板底色透明、边框消失；color 经继承侥幸不显坏）。**这是现存缺陷也是迁移必答题**：mention-picker 无论迁不迁都得重接 token。
- detail.css 的 `var(--color-danger, #dc2626)` / `var(--color-warning, #f59e0b)` 带 fallback，属自足写法，不在缺陷列；fonts.css 的 --font-inter 与 detail.css 的 --detail-pane-right 为本地定义本地用。
- tsx 内联 `style` 消费 `var(--`：**0 处**——token 消费 100% 走 css 文件，组件层无内联 token 耦合。

### 2.2 原语层（ui/ 6 件，各随 tsx 自引）

button.css ← button.tsx；card.css ← card.tsx（死）；chip.css ← chip.tsx + **tag-chip.tsx 双引**；dialog.css ← dialog-shell.tsx；input.css ← input.tsx；tag-chip.css ← tag-chip.tsx。

### 2.3 域层（13 件散件）——import 边全表

| css | decl 数 | import 它的 tsx | 覆盖界面 |
|---|---|---|---|
| board/board.css | 257 | board/board.tsx、routes/board-page.tsx | 看板列/拖拽/topbar |
| board/sidebar.css | 241 | board/sidebar.tsx | 侧栏树 + rail 窄栏（经 shell 复用于全域） |
| chief/chief.css | 464 | chief/chief-drawer.tsx、chief/chief-settings.tsx | 总管抽屉 + 设置 |
| detail/detail.css | 852 | routes/todo-detail-page.tsx（路由级单引） | 任务详情 3 pane + transcript/diff/spec-block |
| detail/overlays.css | 404 | detail/{accept-dialog, branch-dialog, right-pane, stop-confirm-dialog}.tsx | 详情域弹层内容 + 右 pane 静止 section（dlg-* 内容族） |
| overlay/overlay.css | 278 | overlay/{new-task-dialog, delete-confirm, delete-project-confirm, more-menu}.tsx | 弹层批 A（#66）：新建任务 + 删除确认 + ⋯菜单（#394 后瘦身） |
| overlay/mention-picker.css | 223 | overlay/mention-picker.tsx、detail/segments.tsx | 提及弹层（死 token 面，§2.1） |
| overlay/token-gate.css | 30 | overlay/token-gate.tsx | token 闸页（最小散件） |
| overlays/overlays.css | 241 | overlays/{search-panel, chip-popover, plan-dropdown, dismiss}.tsx | 弹层批 B（#67）：⌘K 搜索 + 状态 popover + 方案下拉 |
| pages/pages.css | 899 | pages/{project-new, project, project-settings, schedules}-page.tsx | 4 个 pages/* 页（最大散件） |
| resources/resources.css | 326 | resources/shell.tsx（shell 模式单引） | machines/providers/secrets/skills/mcp-servers 5 页 |
| routes/machine-authorize.css | 41 | routes/machine-authorize-page.tsx | 授权机器页（独立小件） |
| secondary/secondary.css | 389 | secondary/shell.tsx（shell 模式单引） | account/team/api-keys 3 页 |

结构观察：
- **shell 模式两处**：resources/shell.tsx 与 secondary/shell.tsx 各自单引域 css 并内嵌 AppSidebar——routes/ 下 account/team/api-keys 三页自身 0 css import，样式全经 secondary.css 注入。
- **路由级直引两处**：todo-detail-page.tsx 引 detail.css、board-page.tsx 引 board.css（域组件自身不引，由路由兜底）。
- **overlay/ 与 overlays/ 是两个目录**（弹层分批 #66/#67 的历史形态），加 detail/overlays.css 共三个「overlays」命名物——迁移时命名归一可顺带做。

## 3. 三面钉扎点清单

### 3.1 web e2e 类名断言（apps/web/e2e/，50 个 spec，1278 个 expect）

- **872 处 `.locator('.…')` 类名钉扎，钉 302 个 distinct 选择子**（含 `.x .y` 复合与 `[attr]` 组合）。46/50 个 spec 有类名钉扎。
- 非类名定位极少：getByRole ×8、getByText ×3、getByLabel/Placeholder ×0、data-testid ×0；locator 内 aria-label 组合 ×43。**类名是唯一规模化定位机制**——shadcn 切换（类名全换）对这面是全面重钉，无侥幸面。
- 钉扎密度 Top 5 spec：dead-buttons 119（76 distinct，全站死钮普查面）、provider-add-dialog 51、chief-settings 49、project-tasks-toolbar 36、detail-3pane 34 / dialog-viewport 34。
- 选择子族分布（300 distinct 按前缀）：prj-* 42、dlg-* 35、chief-* 23、res-* 18、board-* 18、new-task-* 14、sched-* 13、sidebar-* 11、detail-* 10、team-* 9、delete-* 9、doc-* 8、search-* 7、diff-* 6、account-* 6、token-gate-* 5、rail-* 5、overlay-* 5、chat-* 5……（全量按文件清单见附录 A）
- 单选择子热度 Top：`.dlg` ×67（11 个 DialogShell 共享壳类，最热单点）、`.dlg-provider-preset` ×20、`.sidebar-row` ×17、`.dlg-title` ×16、`.diff-expand` ×12、`.chief-pick-row` ×11。

### 3.2 integration locator（integration/test/，vitest + playwright）

- 3 个文件用类名 locator，共 **59 处钉 40 个 distinct 选择子**：m5-web-e2e.test.ts 38（28 distinct）、task-meta-e2e.test.ts 13（12 distinct）、m7-branch-dialog-e2e.test.ts 8（6 distinct）。其余 13 个 integration 测试不打 UI。
- 与 web e2e 高度同族（.todo-card/.board-new-task/.new-task-*/.dlg-*/.detail-*/.sched-*/.doc-*），即同一批类名被两面同钉——改一处类名两面齐碎。
- 非类名：getByRole ×2，其余个别文本定位。

### 3.3 视觉几何断言

- **`toHaveScreenshot` 全仓 0 处**——「视觉 spec」不落截图基线，全部是**数值几何/计算样式断言**，重钉 = 改数字与选择子，不涉及位图再基线化。
- 专职视觉 spec 两个，均走 `page.evaluate` 探针（getComputedStyle + getBoundingClientRect）：
  - visual-polish.spec.ts：30 expects，4 个 evaluate 探针。钉卡片/列/通知条/菜单的 border=0 + radius=12px + shadow/ring 配方（#161 边缘家族）、侧栏与主区同底（#390）、scrollbar 形态、rail borderRight/shadow。
  - sidebar-visual.spec.ts：19 expects，7 个探针。钉 .sidebar-row 选中态 inset（top/bottom 2px、radius 6px）、行宽=侧栏 clientWidth、sidebarWidth=240、online-dot 定位、hover 配色一致性。
- **boundingBox 36 处散在 8 个行为 spec**：board-dnd 10（拖拽几何）、providers-tabs 6、shell-consistency 5、dialog-viewport 4、chief-panel 3、segmented-controls 3、user-menu-trigger 3、collapse-family 2。
- 视觉面探针选择子集中在 sidebar/board 两族（.board-sidebar .sidebar-row* .sidebar-online-dot .sidebar-kbd .board-topbar .board-main .board-scroller）——**侧栏是几何钉扎最密的域**。

### 3.4 三面合流的重钉含义

- 最热重钉单点 = `.dlg`（67 处 web e2e + integration 同族）——它钉的是 ui/dialog.css 的壳基类，11 个 DialogShell 消费面共享；shadcn Dialog 换壳时壳类别名策略（保留 .dlg 还是全面换钉）是第一裁决。
- per-face 别名（§1.1 律 3）与三面钉扎是同一份契约的两端：组件层换实现时别名保留 ⇒ 三面零改动；别名不保留 ⇒ 853+59+几何面同步重钉。**重钉策略票可直接据此量化两案成本**。

## 4. 「一域一样式」散件分布与收编难度分级

视觉密度口径：声明中含 color/background/shadow/border/radius/font/outline/opacity/filter 的比例（全仓域 css 无纯布局壳——最低 sidebar 26% 也带实色配方）。

| css | decl | 视觉占比 | 覆盖 | 收编难度 | 理由 |
|---|---|---|---|---|---|
| overlay/token-gate.css | 30 | 47% | 单页 | **低** | 已 Button/Input 原语化，余量仅壳布局 |
| routes/machine-authorize.css | 41 | 51% | 单页 | **低** | 单页单卡（authorize-card 族 1 处） |
| overlay/mention-picker.css | 223 | 48% | 提及弹层 | **中（须先修）** | 死 token 面（§2.1），迁前须重接 token 才有真基线 |
| board/board.css | 257 | 28% | 看板 | **中** | 布局为主（列/拖拽/滚动），但 board-dnd 10 处 boundingBox 钉拖拽几何 |
| board/sidebar.css | 241 | 26% | 侧栏+rail | **中** | 全仓最几何敏感：sidebar-visual 19 expects + collapse/shell 两 spec 同钉 |
| overlays/overlays.css | 241 | 36% | 搜索/popover/下拉 | **中** | search-* 7 + chip-popover + plan-dropdown 族；⌘K 面板形态独立 |
| resources/resources.css | 326 | 33% | 5 页 | **中** | res-* 18 选择子 / res-card 行卡族；5 页同族收编一次到位 |
| overlay/overlay.css | 278 | 34% | 新建任务+删除+菜单 | **中** | #394 后瘦身；new-task-dialog 18.6K 且已出 DialogShell 族（§1.1 律 2），单独立项感强 |
| secondary/secondary.css | 389 | 37% | 3 页 | **中** | account/team/keys 三页 + team-agent-card/account-card 两卡族 |
| detail/overlays.css | 404 | 41% | 详情弹层内容 | **中** | 壳已上提 ui/dialog.css，余 dlg-* 内容族随 DialogShell 迁移顺带 |
| chief/chief.css | 464 | 38% | 总管 | **高** | chief-* 22 选择子 + chief-settings 49 处钉扎（单 spec 密度第 3） |
| detail/detail.css | 852 | 33% | 任务详情全域 | **高** | 最大技术深度：transcript/diff/spec-block 组件级视觉（diff-* 族双 spec 同钉）+ todo-detail-page.tsx 41K 全仓最大单文件 |
| pages/pages.css | 899 | 38% | 4 页 | **高** | 最大散件：prj-* 42 选择子（族最大户）+ sched-* 13，project-new github/repo 双流程 |

分级合计：**低 2 / 中 9（含 1 个须先修）/ 高 3**——13 件域散件无一件是纯布局壳。
建议切片顺序（供蓝图票参考，非裁决）：低难度两件（token-gate、machine-authorize）当试点热身——面小、钉扎少（token-gate spec 16 处但选择子只 6 个）、已部分原语化；中难度里 resources 或 secondary 当第一个「真域」（shell 模式单引 css，收编边界整齐）；高三件（chief/detail/pages）留到 token 管道与重钉策略稳定后。

## 附录 A：web e2e 类名钉扎按文件全表（46 spec，基线 8c30775）

列 = spec（去 .spec.ts）｜钉扎处数｜distinct 数｜distinct 选择子（首类，复合选择子按首类归并）。

| spec | 处 | distinct | 选择子 |
|---|---|---|---|
| account-team-cleanse | 21 | 12 | .account-avatar .account-card .account-delete .account-logout .account-swap .account-switch .secondary-link .team-agent-card .team-chart-empty .team-create-agent .team-layout-tab .team-members |
| avatar-dicebear | 21 | 15 | .chip-popover .chip-popover-row .chip-popover-section--selected .dlg-agent-avatar .prj-task-avatar .rail-user .search-panel .search-row-icon--agent .sidebar-row .sidebar-user .team-agent-avatar .team-agent-card .team-create-agent .todo-agent-avatar .user-menu-head |
| board-dnd | 9 | 4 | .board-drag-overlay .board-scroller .board-sidebar .todo-card-action--ghost |
| brand-typo | 1 | 1 | .res-back |
| chief-panel | 11 | 7 | .chief-composer-bar .chief-drawer .chief-example .chief-examples .chief-stream .chief-switcher .secondary-fab |
| chief-settings | 49 | 15 | .chief-agent-row .chief-dlg-charter-input .chief-dlg-ghost .chief-dlg-primary .chief-edit-btn .chief-model-menu .chief-model-row .chief-model-row-provider .chief-pick-empty .chief-pick-input .chief-pick-name .chief-pick-row .dlg .dlg-close .dlg-title |
| chip-assign | 25 | 12 | .chief-pick-check .chief-pick-empty .chief-pick-input .chief-pick-name .chief-pick-row .chip-popover .chip-popover-edit .chip-popover-section--selected .detail-chip .dlg .dlg-close .dlg-title |
| collapse-family | 28 | 10 | .board-column .board-column--collapsed .board-column-collapse .board-column-count .board-column-strip .rail-group .rail-row .sidebar-group .sidebar-group--collapsed .sidebar-subrow |
| dead-buttons | 119 | 76 | .account-avatar .account-swap .board-guide .board-guide-pop .board-guide-wrap .board-new-task .board-topbar-actions .btn--overlay .chat-collapse .chat-tool-pill .chief-head-actions .chief-pick-row .composer-toolbar .delete-confirm .delete-confirm-delete .detail-head-action .detail-head-icon--more .detail-right .dlg .dlg-agent-avatar .dlg-agent-swap .dlg-title .doc-empty .doc-select-wrap .keys-create .keys-docs .keys-empty .more-menu .more-menu-item .new-task-close .new-task-dialog .new-task-discard .new-task-discard-drop .new-task-discard-keep .new-task-spec .new-task-tools .overlay .overlay-title .plan-dropdown .plan-dropdown-row .prj-branch-chip .prj-file-row .prj-files-seg-tab .prj-files-share .prj-history-row .prj-set-avatar .prj-set-change .prj-task-card .prj-task-row .prj-tasks-view-btn .rerun-agent-label .rerun-agent-name .rerun-agent-row .rerun-switch .res-doclink .res-dot .res-empty .res-empty-desc .res-grow .res-new .res-row-more .res-rowcard .res-rowcard--mcp .res-sort .res-sort-menu .res-sort-row .sched-card .sched-card-menu .sched-card-menu-row .sched-card-more .sched-empty .sched-empty-docs .sched-empty-new .sidebar-user .team-create-agent .user-menu |
| detail-3pane | 34 | 16 | .chat-plan-open .detail-center .detail-head .detail-head-icon--more .detail-right .detail-tab .detail-tabs .detail-tabs-group .dlg .dlg-token-total .doc-pane .doc-pane-body .doc-select-wrap .plan-dropdown .plan-dropdown-row .right-empty |
| dialog-viewport | 34 | 24 | .chief-agent-row .chief-dlg-ghost .chief-dlg-primary .chief-edit-btn .chief-pick-list .dlg .dlg-accept-cancel .dlg-accept-done .dlg-agent-create .dlg-body .dlg-branch-body .dlg-enroll-apikey .dlg-enroll-keylink .dlg-enroll-toggle .dlg-provider-create .dlg-provider-custom .dlg-provider-model-add .dlg-secret-create .dlg-seg-tab .dlg-sync .res-add .res-new .team-create-agent .todo-card-branch |
| diff-full-file | 20 | 6 | .diff-expand .diff-full .diff-hunk-head .diff-line .diff-line--add .diff-no--new |
| file-viewer | 12 | 6 | .prj-file-content .prj-file-row .prj-file-row--active .prj-files-seg-tab .prj-files-viewer .prj-history-row |
| hotkeys | 18 | 9 | .chief-composer-input .chief-drawer .new-task-dialog .new-task-project-name .new-task-spec .search-input-row .search-panel .sidebar-kbd .sidebar-row |
| machine-add-dialog | 22 | 12 | .dlg .dlg-close .dlg-enroll-apikey .dlg-enroll-browserlink .dlg-enroll-cmd .dlg-enroll-copy .dlg-enroll-desc .dlg-enroll-keylink .dlg-enroll-lead .dlg-enroll-toggle .dlg-title .res-add |
| machines-local | 1 | 1 | .res-row-title |
| newtask-project-select | 18 | 6 | .board-new-task .new-task-dialog .new-task-project .new-task-project-menu .new-task-project-name .new-task-project-row |
| newtask-single-field | 12 | 7 | .board-new-task .new-task-dialog .new-task-input .new-task-spec .new-task-tag-add .new-task-tags .todo-card-title |
| notify-banner | 9 | 4 | .board-notify-banner .board-notify-banner-action .board-notify-banner-body .board-notify-banner-title |
| overlay-focus | 12 | 7 | .board-new-task .new-task-dialog .overlay-mount .page-new-action .sched-form-cancel .sched-form-close .sched-form-overlay |
| plan-diff-full-file | 20 | 6 | .diff-expand .diff-full .diff-hunk-head .diff-line .diff-line--add .diff-no--new |
| project-empty-new-task | 8 | 6 | .new-task-dialog .new-task-project-name .new-task-spec .prj-task-row .prj-tasks-empty .prj-tasks-empty-new |
| project-files-local-disabled | 12 | 4 | .page-tab .prj-files-disabled .prj-files-pane .prj-task-row |
| project-new-github | 31 | 13 | .prj-new-gh-auth .prj-new-gh-disconnect .prj-new-gh-empty .prj-new-gh-error .prj-new-gh-link .prj-new-gh-login .prj-new-gh-picker .prj-new-gh-row .prj-new-gh-search .prj-new-repo-input .prj-new-repo-menu .prj-new-repo-menu-row .prj-new-repo-swap |
| project-new-repo | 22 | 7 | .prj-new-error .prj-new-gh-auth .prj-new-gh-link .prj-new-repo-menu .prj-new-repo-menu-row .prj-new-repo-swap .prj-new-submit |
| project-settings-delete | 13 | 11 | .delete-confirm--project .delete-confirm-cancel .delete-confirm-close .delete-confirm-delete .delete-confirm-input .delete-confirm-prompt .delete-confirm-summary .delete-confirm-title .prj-set-danger-label .prj-set-danger-title .prj-set-delete |
| project-tasks-toolbar | 36 | 9 | .prj-task-card .prj-task-row .prj-tasks-empty .prj-tasks-filter .prj-tasks-menu .prj-tasks-menu-row .prj-tasks-nomatch .prj-tasks-search .prj-tasks-view-btn |
| provider-add-dialog | 51 | 13 | .dlg .dlg-close .dlg-provider-back .dlg-provider-badge .dlg-provider-create .dlg-provider-custom .dlg-provider-model-add .dlg-provider-note .dlg-provider-preset .dlg-provider-search .dlg-provider-seg-tab .dlg-title .res-new |
| provider-oauth | 22 | 6 | .dlg .dlg-provider-badge .dlg-provider-note .dlg-provider-oauth-error .dlg-provider-preset .res-new |
| reject-chain | 18 | 13 | .chat-plan-title .chat-streaming-label .composer-send .detail-chip .detail-head-action .diff-hunk-head .diff-line--add .doc-file-row .doc-pane-select .doc-range-chip .doc-range-wrap .version-menu--sub .version-menu-row |
| rerun-close-family | 9 | 4 | .overlay .overlay-back .overlay-close .overlay-title |
| search-focus | 11 | 9 | .rail-row--selected .search-group-label .search-input-row .search-panel .search-row .search-row--selected .search-row--todo .sidebar-row .sidebar-row--selected |
| search-result-rows | 7 | 6 | .detail-shell .search-panel .search-row .search-row--selected .search-row--todo .sidebar-row |
| secret-add-dialog | 13 | 6 | .dlg .dlg-close .dlg-secret-create .dlg-secret-note .dlg-title .res-new |
| segmented-controls | 23 | 14 | .chief-tab .dlg .dlg-seg-tab .page-tab .prj-files .prj-files-seg-tab .prj-tasks-view-btn .sched-form-freq .sched-form-freq-tab .sched-form-freq-tab--active .team-layout-tab .team-layout-tab--active .todo-card-branch .user-menu-seg |
| shell-consistency | 18 | 10 | .board-sidebar .board-sidebar--collapsed .chief-drawer .rail-row .sidebar-row .sidebar-subrow .sidebar-team-collapse .sidebar-team-name .team-plan .team-upgrade |
| sidebar-nav | 15 | 9 | .board-sidebar .rail-install .rail-row .sidebar-install .sidebar-row .sidebar-subrow .sidebar-team-name .sidebar-team-row .sidebar-user |
| sidebar-search-offboard | 2 | 2 | .search-panel .sidebar-row |
| skills-readonly | 13 | 7 | .res-empty .res-empty-desc .res-empty-hint .res-empty-title .res-new .res-primary .res-rowcard |
| team-create-agent | 16 | 9 | .dlg .dlg-agent-configure .dlg-agent-create .dlg-agent-warn .dlg-close .dlg-title .team-chart-empty .team-create-agent .team-layout-tab |
| theme-toggle | 2 | 1 | .user-menu-seg |
| title-band-clicks | 4 | 4 | .res-back .res-new .secondary-back .secondary-head-right |
| token-gate | 16 | 6 | .board-sidebar .token-gate .token-gate-error .token-gate-input .token-gate-submit .token-gate-title |
| user-menu-nav | 4 | 3 | .sidebar-user .user-menu .user-menu-row |
| user-menu-trigger | 8 | 4 | .rail-user .sidebar-user .user-menu .user-menu-seg |
| visual-polish | 2 | 2 | .board-scroller .board-sidebar--collapsed |

## 附录 B：integration 类名钉扎按文件全表（3 spec，基线 8c30775）

| spec | 处 | distinct | 选择子 |
|---|---|---|---|
| m5-web-e2e | 38 | 28 | .board-column .board-column-name .board-new-task .chat-bubble .chat-note .chat-plan-title .chat-scheduled .composer-input .composer-send .detail-chip .detail-head-action .detail-shell .dlg-accept-done .doc-file-row .doc-pane-select .doc-range-chip .doc-range-wrap .new-task-spec .new-task-start .page-new-action .sched-card .sched-form .sched-form-freq-tab .sched-form-save .todo-card .todo-card-link .todo-card-title .version-menu-row |
| task-meta-e2e | 13 | 12 | .board-new-task .detail-shell .fresh-tags .new-task-dialog .new-task-input .new-task-save .new-task-spec .new-task-tag-add .new-task-tags .todo-card .todo-card-link .todo-card-title |
| m7-branch-dialog-e2e | 8 | 6 | .detail-right .dlg-branch-value .dlg-dir--input .dlg-machine .dlg-machine-menu .plan-dropdown-row |

## 附录 C：死 token 与悬空 token 全单

- 死 token（tokens.css 定义、全 src 零消费，19）：--active-text、--blue-400、--card-ghost-border、--chip-active-bg、--chip-active-border、--col-dot-building、--col-dot-confirm、--col-dot-idle、--col-dot-planning、--col-dot-review、--disabled-fg、--indigo-400、--nav-bg、--send-disabled、--space-1、--space-2、--space-3、--space-4、--space-6。
- 悬空 token（消费但全仓无定义，5，均在 overlay/mention-picker.css）：--border（5 处）、--text（5 处）、--text-muted（5 处）、--surface-base（4 处）、--ring（1 处）。
- 自足 fallback（非缺陷）：detail.css 的 --color-danger/--color-warning（各 2 处，均带 hex fallback）；fonts.css 的 --font-inter 与 detail.css 的 --detail-pane-right 为本地定义本地用。
