# B1 弹层族收编验证（票 #425）

## 证据清单

| 文件 | 内容 |
|---|---|
| `425-dialog-secret.png` | 模态弹层族（DialogShell 适配层）：资源页「添加密钥」，面板底/环描边/头部/禁用态底栏 |
| `425-new-task.png` | new-task（`bare` 面板模式）：项目选择器在头、五行模板占位、工具行、双提交钮几何原位 |

## live 栈真人路径（verify-pacman 隔离栈）

栈：server 8792 + vite dev 5274（8791/5273 被占，未动他人进程）+ scratch `PACMAN_HOME`（全新库，seed 用户 Owner，不碰 `~/.pacman`）。

| 证据目录 | probe | 覆盖的迁移面 |
|---|---|---|
| `20260930-003740-new-task` | 新建任务全链 | `bare` 面板模式（对话框族） |
| `20260930-004131-mentions` | 提及 picker 全链（含 token 落库） | 锚定族（L1 车道迁移面） |
| `20260930-003827-chief-model-select` | 总管压缩模型选择器（行集合投影一致性） | 锚定族（L2 车道迁移面） |
| `20260930-003741-api-key` | 建密钥 + 掩码 + keyHash | routes 创建弹层 |
| `20260930-003742-theme` | 主题持久化双向 | 用户菜单浮层（**本片未迁，确认无连带回归**） |

`doctor.mjs` 六项全 PASS；每 probe 均带截图 + API/SQLite 双真值。跑法见 SKILL.md（worktree 车道须 `VERIFY_REPO_ROOT=<worktree>` 且从 worktree 路径跑脚本）。

**已知前置**：`drive-mentions` 需先 seed 至少一个 agent（该 feature 文件明写），否则 Agents 组 0 计数、插入钮恒禁用而超时——非回归。

## 验证口径

- **三闸**：lint / format / typecheck 全绿。
- **全量 e2e 336/336**（合并两条并发车道 + 全部修正后，新端口新构建复跑）。
- **分族**：弹层族 43/43、确认面 48/48、new-task 59/59、L1 车道 48/48、L2 车道 55/55。
- **spec 零改动**：33 个相关 spec 的断言未动（别名优先政策 #411 的验收信号）。
- **几何对拍**（L2 车道）：chip `281.0625,34,298×193`、chief `987,216,220×72`、res `1084,96,140×72`，1440 逐像素一致，1280/1600 抽测锚定跟随无误。
- **退场逐帧**（主线）：more-menu 点外点后 opacity 1 → 0.078（108ms）→ 209ms 卸载，≈200ms 退场窗。
- **机制事实七条**见 PR 正文与各适配层注释。

## 未覆盖

- `search-panel` 与 `chief-drawer` 不在本片（见 PR「未做」）。
