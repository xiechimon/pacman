# #613 看板面 UI 打磨——前后对照证据

栈：verify-pacman 隔离实例（`VERIFY_PORT=8795` / `VERIFY_WEB_PORT=5277`，独立
`PACMAN_HOME` scratch），fixture 面 `?scenario=board-tags` / `board-repos`，
1440×732 @2x。截图探针 = 本分支 `.claude/verify-shots/board-shots.mjs`
（gitignored，仅本地复跑用；复跑配方 = launch 栈后
`node .claude/verify-shots/board-shots.mjs <outDir>`）。

## ① 卡片身份行圆件（实测几何，live DOM）

| 件 | 改前 | 改后 | 依据 |
| --- | --- | --- | --- |
| TagChip（`.todo-card-tag`） | 20px 高，溢 16px row1 上下各 2px | 16px，与 row1 齐平 | 全卡唯一溢出自己行盒的件；row-flush per-face 覆写 |
| row1 行盒 | 16px | 16px（不变） | 卡高/行高零漂移 |
| 卡高 | 94.5px | 94.5px（不变） | 同上 |
| project-avatar | 16px | 16px（未动） | 本就和行盒齐平 |
| SeededAvatar | 20px | 20px（未动） | 与详情 chat 行 / 项目任务行同档 |
| 卡片圆角 | 12px | 12px（未动） | Card 族 token，visual-polish.spec 钉 |

## ② 筛选面板（computed style 实测）

| 项 | 改前 | 改后 | 依据 |
| --- | --- | --- | --- |
| 弹层内边距 | `0 0 4px`（行贴圆角边） | `4px` 四边 | dropdown/menu popup 同档 p-1 |
| 选项行圆角 | 10px（= 壳圆角，全出血） | 8px（rounded-md，内缩 4px） | 与站点 dropdown 同形（壳 10 / 行 8 / 垫 4），见下注 |
| 维度标题墨色 | foreground `rgb(28,25,23)` | muted `rgb(115,115,115)` | chrome 带与内容带分层次（DropdownMenuLabel 同角色） |
| 选中态 cue | 仅 aria-selected（仓库轴肉眼不可辨） | 行首 Check + bg-accent 实底 | 选中态可辨；toggle 零布局位移（槽位恒在） |
| 维度分隔线 | 半出血 | 全出血 `-mx-1`、my-1 节奏 | DropdownMenuSeparator 同形 |

注：壳圆角走 `--radius-popover: 10px`。严格同心算式（外 = 内 + 垫）要行 6px，
但站点 dropdown popup 自身就是壳 10 / 行 8 / 垫 4 的同 2px 偏差档——本轮取
「与站点逐值同形」，不另立算式档。

## 截图清单

| 文件 | 内容 |
| --- | --- |
| `before-card-tagged.png` / `after-card-tagged.png` | 带标签卡整卡 |
| `before-card-row1.png` / `after-card-row1.png` | 身份行放大（mark / 名字 / pill / seq / 分支钮） |
| `before-panel-rest.png` / `after-panel-rest.png` | 面板静息态（board-tags） |
| `before-panel-hover.png` / `after-panel-hover.png` | 未选行 hover 态 |
| `before-panel-selected-repos.png` / `after-panel-selected-repos.png` | 双轴选中态（board-repos：仓库一行 + 类型一行，含「仅此」现形） |

## 回归面

- `apps/web/e2e/board-filter.spec.ts` 20 条全绿（含任务卡几何护栏：chipH 钉改 16）
- `apps/web/e2e/shadcn-primitives.spec.ts` tag-chip 用例改双面各钉（卡面 16 / 面板面 20）
- `apps/web/e2e/visual-polish.spec.ts` 12 条全绿（卡片圆角 12px 等未动契约）
- 合计 37 passed；`pnpm lint` / `pnpm typecheck` 绿
