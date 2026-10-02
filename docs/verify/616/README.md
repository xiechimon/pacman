# #616 看板拖拽——两轮工作的测量方法与证据

第一轮修「录制时阴影不流畅」的性能根因；第二轮按用户裁决对齐参考产品
（todos.dev）的拖拽逻辑与动画全面重做。两轮的证据都在本目录，方法是同
一套可复现测量面。

## 方法

- 栈：`vite build --mode fixture` + `vite preview`，Playwright chromium headless，1440x732，dark。
- 手势：脚本化 pointer 序列（mouse.down → 55-90 步 move，~9-11ms/步 ≈ 90Hz，同真实指针节奏量级）。
- 计数：CDP `Tracing`（devtools.timeline），窗口自对齐到手势自身的 mousedown/mouseup 事件（trace 时钟是单调钟，不能用墙钟过滤）。
- 录屏：Playwright recordVideo（25fps webm，等价「录制时」采样条件），ffmpeg 抽帧 + 模板匹配/像素探针逐帧分析。
- 每项 n>=3 复跑；before/after 用同一 harness、同一场景、同一手势参数。
- 参考站取证：已登录真浏览器（ego-browser）对 todos.dev 逐项实测——overlay 内联样式、getAnimations、MutationObserver、逐列拖拽实验；实验用一次性探针卡（标题带「可删」），结束后删除并核对盘面恢复原状，真数据零变动。

## 参考站行为矩阵（2026-10-02 live 实测，重做的正典依据）

| 面 | todos.dev 实测 |
| --- | --- |
| 可拖列 | 仅待开始（待处理/已完成卡无传感器，按下直通卡内点击） |
| 抬升面 | 紧凑复刻卡：身份行（14px/3px 项目徽标 + 11px 项目名 + 10px tabular seq）+ 两行截断标题；8px 圆角、1px 描边、padding 10x12、gap 6 |
| 抬升配方 | 内联 `opacity: 0.92; box-shadow: rgba(0,0,0,0.18) 0 8px 24px; transform: translate(x,y) rotate(2deg)`，1:1 跟手、无 transition |
| 源卡 | wrapper `opacity: 0.4` 即时，留原槽 |
| 让位/重排 | 无——手势期兄弟卡零位移，同列落位零提交（无列内重排语义） |
| 列染色 | 两级 indigo：全部合法目标列 border-indigo-400 + bg-indigo-500/05；悬停列 /10；源列与待处理素面；瞬切无过渡 |
| 落位 | overlay 随 pointerup 同帧卸载，零动画（getAnimations 全程为空） |
| 落执行中 | 弹「开始任务」居中模态（448px，fade-in 200ms ease）；确认前相位不写；取消零提交 |
| 落已完成 | 静默即时提交，无 toast |
| 静置 hover | 零效果（cursor pointer）；按压态 bg tint |

## 第一轮：性能根因（保留在重做里）

「box-shadow 每帧重绘」直觉被干预实验证伪：去掉 `--lift-shadow`，RasterTask 119 vs 基线 120。真根因 = overlay 层位移由主线程逐 pointermove 提交内联 transform 且无动画提示，Chromium 按静态位置逐帧重栅格。

| 指标（1.5s 列内手势，n=3） | before | will-change 后 |
| --- | --- | --- |
| RasterTask | 115-120 | 57-62（减半） |
| 8x CPU 节流下 RasterTask | 120 | 62 |
| 跟手期帧节奏（rAF 中位） | 16.7ms | 16.7ms |
| 标题带锐度 | 11.72 | 11.65（无损） |

## 第二轮：重做后的闸与钉扎

- `board-dnd.spec` 重写 11 条钉住全部新语义（静默提交落列尾 / 开始任务闸 / 待处理零染色零提交 / 同列零位移零提交 / 待处理与已完成无传感器 / 紧凑抬升配方两主题 / 两级染色两主题 / 无回闪 / 零滑翔）。
- 全量 e2e 561/561、web vitest 139/139、integration 57/57（含 m5 真栈链）、lint 0 error、typecheck 5/5。

## 文件

- `lift-tint-compare.png` — 拖拽悬停瞬间对照：整卡 overlay + 单级染色（before）vs 紧凑 2° 倾角卡 + 两级 indigo（after）。
- `building-drop-compare.png` — 落执行中的结局对照：静默写相位（before）vs 开始任务 dialog 闸（after）。
- `done-gesture-compare.gif` — 落已完成全程 2x 慢放对照（含 250ms glide vs 同帧卸载）。
- `building-gesture-compare.gif` — 落执行中全程 2x 慢放对照（dialog 弹出可见）。

## 追加节（#629）：参考站「已完成」列卡片 hover/按压/点击实测（2026-10-02）

用户验收 #618 后追问不可拖列（已完成/待处理）的卡面行为。真浏览器实测
（探针卡实验、真卡零接触）：

- 卡内 `<a>` 元素 **0 个**——点击是 Pressable 行为，不存在原生链接，因此
  没有拖影 chip、没有 URL tooltip 的物质基础。
- 卡根与标题 `user-select: none`；按住拖动 = 零选中、零 dragstart、零 overlay。
- hover：零视觉变化（无底色/阴影/位移），cursor: pointer。
- **按压 :active = 整卡 bg tint 一档**：light `active:bg-surface-secondary`
  （实测 rgb 242,237,230）、dark `active:bg-surface-tertiary`——用户说的
  「长按或点击之后有一种类似 hover 的效果」即此；瞬切无过渡。
- 点击 = 导航 `/app/todo/<id>` 详情路由（重开钮在详情头，板面卡无按钮）。

pacman 差异与修复（三锁灭「小链接」拖影 + `--surface-press` 按压 tint +
标题退出全局 a:active 压暗 + 点击导航保留）：证据与验证明细在
`docs/verify/629/`。
