# #739 总管抽屉在飞存在行——静默窗口的 before/after 与三态收敛证据

用户主诉「发一句话就什么也没有，一股脑儿全部出来」的呈现半边（(a) 无存在
行）。本目录证据 = 发送到首 token 的静默窗口里，消息流尾部现在挂一条在飞存在
行（loading-dev Atom + `处理中...`，详情页 streaming 行同族），且首 delta / 终稿
到达时按收敛律退场。

## 方法

- 栈：`vite build --mode fixture` + `vite preview`（1440x732，Playwright chromium
  headless）。before = `origin/main`（c91f3961）一次性 detach worktree 同配方重建；
  after = 本分支同一 harness。
- 数据面：e2e/chief-stream-markdown.spec.ts 的 live-mock 配方（替身 EventSource +
  `/api/**` 路由 mock）。线程 `activeRun={phase:'chief'}`（回合在飞），messages 只
  有 user 行、不发 text_delta = 复现「发送到首 token」的静默窗口（绑定慢模型时该
  窗口分钟级）。
- 三态：静默窗口（存在行）→ 发 `text_delta`（收敛为 typing 打字行）→ 发终稿
  `message`（收敛为定稿 robot 行，两 live 尾行皆退场）。
- 截图裁 `.chief-drawer` 元素；before/after 同脚本同视角同 mock，仅构建不同。

## 结论

| 帧 | before (main) | after (本分支) |
| --- | --- | --- |
| 静默窗口（running、无 delta） | 消息流零变化，只有用户气泡 + 空白（主诉本体） | 尾挂存在行：agent 头像 + Atom spinner + `›` + `处理中...` |
| 首 delta 到达 | typing 打字行（#651 既有） | 存在行收敛为 typing 行（互斥，尾部恒一行） |
| 终稿落库 | 定稿 robot 行 | 定稿 robot 行；存在行/typing 行皆退场，无闪烁 |

秒数按 #471 律不挂（静默期无流事件驱动重渲，挂计数会冻结说谎；本票不加计时
器），与详情页「静止不挂秒数」同族。

## 文件

- `silent-window-compare.png` — 静默窗口对照：左 before（空）/ 右 after（存在行）。
- `before-silent.png` / `after-silent.png` — 上表的单帧原图。
- `after-typing.png` / `after-final.png` — after 的收敛两帧（typing / 定稿）。
- `presence-convergence.gif` — after 三态收敛连放（静默存在行 → typing → 定稿）。

## 钉扎

- 单测 `test/chief-markdown.test.ts`（#739 块）：running+缓冲空 → 存在行；缓冲非
  空 → 仅 typing；activeRun null → 无行；终稿已落库（尾 robot）→ 存在行不闪；新主
  题视图 → 不残留。
- e2e `chief-stream-markdown.spec.ts`：F-R14（live mock 三态收敛）、F-R15（fixture
  面 r5 113 running 捕获不长存在行，ChiefStreamItem 新 kind 零污染）。
