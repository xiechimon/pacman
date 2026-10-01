# #616 看板拖拽抬升卡流畅度——测量方法与证据

## 方法

- 栈：`vite build --mode fixture` + `vite preview`（127.0.0.1:8499），Playwright chromium headless，1440x732，dark。
- 手势：脚本化 pointer 序列（mouse.down → 60-90 步 move，~9ms/步 ≈ 90Hz，跟真实指针节奏同量级），场景 35（已完成列内重排）与场景 01（待处理→待开始跨列）。
- 计数：CDP `Tracing`（devtools.timeline 类别），窗口自对齐到手势自身的 mousedown/mouseup 事件（trace 时钟是单调钟，不能用墙钟过滤），统计 Paint / RasterTask / Commit / UpdateLayoutTree。
- 录屏：Playwright recordVideo（25fps webm，等价「录制时」的采样条件），逐帧模板匹配（cv2 NCC）追踪抬升卡位置。
- 每项 n>=3 复跑；before/after 各跑同一 harness。

## 根因判定（实测，与直觉相反）

「box-shadow + transform 每帧重绘」**不成立**：把 `--lift-shadow` 整段拿掉（`box-shadow: none !important`），RasterTask 119 vs 基线 120、Paint 不变。

真实成本：**DragOverlay 层的位移由主线程逐 pointermove 提交内联 transform，且无动画提示**——Chromium 把每个新位置当静态位置处理，overlay 层以 ~0.8 次/帧重栅格。录屏（编码器竞争 GPU/CPU）与 Retina 2x 栅格面积会放大这一成本，即用户报的「录制时阴影不流畅」。

## 数字

| 指标（1.5s 列内手势，n=3） | before | after |
| --- | --- | --- |
| RasterTask | 115-120 | **57-62（减半）** |
| Paint（离散） | 20-27 | 20-27（不变） |
| 去阴影干预 RasterTask | 119（无效） | — |
| 8x CPU 节流下 RasterTask | 120 | 62 |
| 跟手期帧节奏（rAF 中位） | 16.7ms | 16.7ms |
| 跟手期 overlay transform 更新 | 每帧（gap=1） | 每帧（gap=1） |

落位滑动（36px glide，25fps 采样，距离覆盖率）：

| t (ms) | 40 | 80 | 120 | 160 | 200 |
| --- | --- | --- | --- | --- | --- |
| before（ease 250ms） | 6% | 14% | 28% | 67% | 81% |
| after（ease-pop 250ms） | **28%** | **50%** | **78%** | 89% | 94% |

ease 慢起步 = 松手后卡片迟疑再猛追；ease-pop 即时起步、柔和落位。

## 视觉无回归

- 抬升卡几何逐字节一致（摘除冗余 dragWidth 后 wrapper 矩形 `{x:1152.25, y:253, w:264.5, h:114.5}` 前后相同——dnd-kit PositionedOverlay 本就把 wrapper 宽度设为 activeNodeRect.width）。
- 拖拽中整页截图像素差 0.18%（位置噪声级）；标题文字带锐度 before 11.72 / after 11.65（will-change 不降栅格质量）。
- `board-dnd.spec` 10/10、`visual-polish` + `sidebar-visual` 20/20 通过（含 lift 阴影四边墨量像素探针、落位滑翔 >100ms 时长下限、glide 终点=落位槽）。

## 文件

- `glide-compare.gif` — 落位滑动逐帧对照（左 before / 右 after，2x 慢放，帧头标注松手后毫秒）。
- `shift-compare.gif` — 让位卡过渡对照（ease 200ms vs ease-pop 200ms）。
- `glide-curve.png` — 滑动距离覆盖率-时间曲线。
- `mid-drag-before.png` / `mid-drag-after.png` — 拖拽中整页截图（外观一致性）。
