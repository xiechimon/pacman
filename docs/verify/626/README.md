# #626 模型选择器收敛——四面像素级零变化证据

## 主张

实现核心收敛（`components/model-select-core.tsx` 单源四律）之后，四个消费面
的渲染输出与收敛前**逐字节相同**：agent 创建槽、agent 概览槽、chief 主模型
dialog（r5 108 形态）、压缩模型 popover（#204 形态），含 stale preset 裸串
兜底回显态。

## 方法

两套独立栈、同一个捕获脚本（本目录 `shots.mjs`）：

| 栈 | 代码 | 构建 | 服务 |
| --- | --- | --- | --- |
| before | `origin/main` @ `43528c48`（`git worktree add --detach` 一次性检出） | `vite build --mode fixture` | `vite preview` 127.0.0.1:8411 |
| after | 本分支（已并入同一 main tip） | `vite build --mode fixture` | `vite preview` 127.0.0.1:8412 |

捕获条件（两栈完全一致）：Playwright chromium headless、viewport 1440×732、
`colorScheme: dark`、**所有非回环请求一律 abort**（dicebear 头像 / 远端字体
不得进入像素）、`animations: 'disabled'` 截图、clip = 目标元素包围盒并集
+ 8px padding（clip 几何两栈逐一相同，见 `result.json` 尺寸）。

8 个捕获态：

| 文件 | 面 | 场景 / 状态 |
| --- | --- | --- |
| `a-create-runtime-menu` | agent 创建槽 | `/app/team?scenario=agent-detail`，弹窗开、一级运行时菜单开 |
| `b-create-model-menu` | agent 创建槽 | 选 r3-gw 后二级模型菜单开 |
| `c-detail-runtime-menu` | agent 概览槽 | `/app/resources/agents/r3-builder?scenario=agent-detail`，运行时菜单开 |
| `d-detail-model-menu` | agent 概览槽 | 模型菜单开 |
| `e-chief-model-dialog` | chief 主模型 | `/app?scenario=111`，抽屉模型行点开 dialog |
| `f-settings-compaction-menu` | 压缩模型 | `/app?scenario=101`，popover 开 |
| `g-stale-trigger` | 压缩模型 | `/app?scenario=101-stale-model`，触发钮裸串回显 |
| `h-stale-menu` | 压缩模型 | stale 态菜单开（无选中行） |

判据：PNG 字节 SHA-256 相同 = 像素相同。

## 结果

**8/8 对 SHA-256 逐一相同**（digest 对钉在 `result.json`）。目录
`before/` 与 `after/` 各 8 张，文件名一一对应。

## 行为闸（同 tip 全绿）

- 票面点名的 4 条 spec + 同域 4 条（`agent-create-model` / `agent-detail` /
  `avatar-dicebear` / `chief-drawer-model` / `chief-settings` /
  `dead-buttons` / `dialog-viewport` / `team-create-agent`）：118 passed。
- web 全量 e2e：**592 passed / 0 failed**（2.4m，含 `101-stale-model`
  裸串兜底钉）。
- 根 vitest（i18n-coverage / snapshot / 集成）：**122 files / 1228 tests
  全过**（exit 0）。
- `pnpm typecheck` / `pnpm lint`：exit 0（2 条 warning 为 server 侧既有，
  与本票无关）。

## 复跑

```sh
# before 栈
git worktree add --detach /tmp/pacman-626-before origin/main
cd /tmp/pacman-626-before && corepack pnpm install
cd apps/web && ./node_modules/.bin/vite build --mode fixture
./node_modules/.bin/vite preview --host 127.0.0.1 --port 8411 --strictPort
# after 栈（分支检出同法，端口 8412），然后对两栈各跑一次：
BASE=http://127.0.0.1:8411 OUT=/tmp/626/before node docs/verify/626/shots.mjs
BASE=http://127.0.0.1:8412 OUT=/tmp/626/after node docs/verify/626/shots.mjs
shasum -a 256 /tmp/626/{before,after}/*.png
```
