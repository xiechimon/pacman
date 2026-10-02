# #629 板面卡按压面对齐参考站——「小链接」绝迹 + 按压整卡 tint

## 用户报的现象

`user-report-link-chip.png`（用户截图）：已完成列的卡按住微移时冒出一个
「带 URL 的原生 tooltip」——即用户说的「偶尔会出现一个小链接」。

## 根因（实测复现）

#618 后待处理/已完成卡不武装 dnd 传感器（dnd-kit `disabled` → `listeners:
undefined`），卡面成为裸 stretched `<a href>`：`draggable` 缺省 true、
`-webkit-user-drag: auto`、卡面 `user-select: auto`。按住微移命中浏览器对
链接的缺省可拖性 → **原生 link drag**：headless 实测 `dragstart` 事件 +1，
Chrome 拖影 chip 显示链接文本 + URL（截图里的「tooltip」即此 chip；`title`
属性实测为 null，排除悬停提示说）。

## 参考站实测（todos.dev，2026-10-02，已完成列卡片）

| 面 | 实测值 |
| --- | --- |
| 卡内 `<a>` 元素 | 0 个（点击 = Pressable 行为，无原生链接可拖） |
| user-select（卡根 + 标题） | none |
| hover | 零视觉变化，cursor: pointer（卡根） |
| 按压 :active | 整卡 bg tint：light `active:bg-surface-secondary`（实测 rgb 242,237,230）/ dark `active:bg-surface-tertiary` |
| 点击 | 导航 `/app/todo/<id>`（详情路由，重开钮在详情头） |
| 按住拖动（不可拖列） | 零选中、零拖影、零 overlay |

## 修复

- `board.css`：`.todo-card { user-select: none }` + `.todo-card-link {
  -webkit-user-drag: none }`；`todo-card.tsx`：Link `draggable={false}`
  （三锁）。
- `shadcn.css`：新语义 token `--surface-press`（dark = surface-tertiary
  #27272a / light = surface-secondary #f1ede7，与参考站 active:bg-* 逐值
  同源）；`motion.css`：`.todo-card:active` 消费之，标题链接退出全局
  `a:active opacity .85`（参考站单一反馈，无双重压暗）。
- 点击导航保留（stretched link 原位）。

## 验证（probe.json 逐项）

| 探针 | dark | light |
| --- | --- | --- |
| 卡根 user-select | none | none |
| link draggable 属性 / -webkit-user-drag | "false" / none | "false" / none |
| link title 属性 | null | null |
| 静置 bg → 按压 bg | rgb(31,31,35) → rgb(39,39,42)（= surface-tertiary） | rgb(255,255,255) → rgb(241,237,231)（= surface-secondary） |
| 按压中标题 opacity | 1（无双重反馈） | 1 |
| 按住移动 10 步 dragstart 计数 | **0** | **0** |
| 按住移动选区字符数 | 0 | 0 |

- `press-compare-dark.png` / `press-compare-light.png`：静置 vs 按压实拍。
- e2e：`card-press.spec.ts` 4 条钉扎（tint 两主题 / 三锁 + dragstart 零触发 + 零选中 / 点击导航保留）；全量 592/592、web vitest 150/150、lint 0 error、typecheck 5/5。

## 参考站取证纪律

一次性探针卡（标题自标「可删」）拖入已完成列做实验对象，结束后经详情页
更多菜单删除并核对盘面恢复；用户真卡（#1/#12/#13）全程未点击未拖动。
