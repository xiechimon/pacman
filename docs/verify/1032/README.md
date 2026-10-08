# #1032 容器层滚动收口 — live 栈证据

票面：总管设置-记忆无法下滑（容器缺 `overflow-y-auto`），同类 6 处页面一并收口。
修复 = 两处容器层各补一次滚动层（`apps/web/src/chief/chief-settings.tsx` 内容列、
`apps/web/src/pages/shell.tsx` 的 `{children}` 包装），仓内既有模板 =
`secondary/shell.tsx:92` 与 `resources/shell.tsx:121`。fixture 面回归钉在
`apps/web/e2e/page-scroll.spec.ts`（5 条，先红后绿）；本目录是 live 真栈证据。

## 复跑配方

```sh
node .claude/skills/verify-pacman/scripts/launch.mjs        # 隔离栈 8791/5273
node docs/verify/1032/drive-1032-scroll.mjs                 # 38 checks
node .claude/skills/verify-pacman/scripts/cleanup.mjs
```

probe 自含 seed：REST 真缝建项目/40 任务/30 定时/Agent/绑定 Agent + 60 行章程
（PATCH chief）；SQLite 直写 40 条 `agent_memory` 与 30 条 `chief.watches`
（两者无 REST 写面，seed 只进 scratch 库；UI 读的仍是真 GET 缝）。重跑前必须
cleanup+launch 换全新库（记忆行主键固定 `mem-1032-*`，同库重跑撞主键）。

## 判读

- 视口：1440×732 主口径；项目设置 1440×500、新建项目 1440×360 短窗口场景逼出
  溢出（两页真实内容在 732 下放得下——无溢出即无滚动需求，F1 会正确地报
  「无可滚祖先」；e2e 侧同款断言用 360px）。
- 每面四条断言（F1–F4）：F1 从内容元素向上找到「overflow-y auto/scroll 且
  scrollHeight > clientHeight」的滚动层；F2 鼠标滚轮真驱动它（用户报障的
  原始交互）；F3 置底后末条元素完整入视口；F4 `documentElement` 横纵
  scrollWidth/Height ≤ client*（问题没从「滚不动」搬成「整页滚」）。
- 总管设置三 tab 前等 `.chief-drawer` 卸载：抽屉退场腿 absolute 离流滑出会
  瞬时顶宽 documentElement（既有 chrome，与本票无关），不等它 F4 按动画相位
  随机红。
- 已安全四处零回归 = 页面可达 + 页面级零溢出 + 截图（08–11）；结构面回归由
  全量 e2e（823 条）承接。

## 证据索引

| 文件 | 内容 |
|---|---|
| `drive-1032-scroll.mjs` | probe 本体（seed + 浏览器断言，本目录即可复跑） |
| `result.json` | 38/38 checks 逐条 ok + 栈坐标 + 视口口径 |
| `seed-truth.json` | seed 真值回读（API/SQLite 计数与样例行、章程尾行） |
| `01-chief-memory-{top,bottom}.png` | 记忆 tab：顶（tab 行+配额+首条）/ 底（末条 39 完整可见） |
| `02-chief-watches-{top,bottom}.png` | 关注与提醒 tab：30 条 watch 行滚到底 |
| `03-chief-charter-{top,bottom}.png` | 章程 tab：60 行长文滚到底（编辑钮入视口） |
| `04-project-tasks-{top,bottom}.png` | 项目任务列表：40 行滚到底 |
| `05-schedules-{top,bottom}.png` | 排期：30 卡滚到底 |
| `06-project-settings-{top,bottom}.png` | 项目设置（500px 短窗）：危险操作区滚到底 |
| `07-project-new-{top,bottom}.png` | 新建项目（360px 短窗）：创建钮滚到底 |
| `08-safe-secondary.png` | secondary 团队页零回归 |
| `09-safe-resources.png` | resources Agent 详情页零回归 |
| `10-safe-todo-detail.png` | todo 详情页零回归 |
| `11-safe-machine-authorize.png` | machine-authorize 页零回归 |
