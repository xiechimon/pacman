# R8 随拍 · Chief 面板（票 #72 随拍记录与缺口登记）

> 目的：#72（Chief 面板静态面）实现期的随拍记录——r7 §6 缺口表把
> `总管 drawer` 派给「逐 web 实现票随拍」（04 册附录 C），本票即该 web 票。
> 本文登记：随拍方法、已落素材、与 r5 正典的漂移观察、仍缺需补拍项。
> 编号纪律（04 附录 C）：r8 起续 r7 编号（54+）。
> 时间：2026-09-22 23:20–23:50（本地 Asia/Shanghai）。

## 0. 方法

- 通道：ego-browser（macOS），复用研究 TaskSpace「todos.dev 复刻盘点」space 0 / p1
  （free 档已登录 Xmon Dai's team `BoZYfvqKSGanlxsXVbXSa`，`tds.locale=zh`）。
- 视口：`innerWidth/innerHeight` 实测 **1440×732**、dpr 2（r7 §0 窗口态延续，零 override）；
  截图 `scale: css` → 1440×732 位图（sips 核验）。
- 操作：`总管` FAB 原生点击开 drawer；drawer 头部按钮因滑入动画与无 aria 属性，
  坐标点击不可靠，改用 `elementFromPoint` 诊断 + DOM click（r5 会话同型 force/DOM click 口径）。
- 未做任何团队状态变更：未解绑/重绑 chief agent，未写 charter，未建探针。

## 1. 已落素材（`docs/research/assets/r8/`）

| 文件 | 内容 | 用途 |
|---|---|---|
| `78-chief-thread-stream-light.png` | 绑定态 drawer · 既有线程消息流（#12 failed wake 汇报卡 + `展开完整消息` + `完成 31s`/`1m 17s` 行）| 消息流静态面旁证；#72 流式行布局参照 |

编号协调（2026-09-22 与 #64 r8 集中补拍票会话间约定）：**54–77 由 #64 正典册
（`r8-dynamic-states.md`）连续占用**；本票 ad-hoc 单张让至 78（#64 序列后首空号，
其正典册 §1 留 78 空号引本册）。

## 2. 漂移观察（2026-09-22 深夜 vs r5 正典，同日）

| 项 | r5 正典（100–116） | 本票随拍实测 | 处置 |
|---|---|---|---|
| drawer 外框 | 浮动圆角卡：right 17 / bottom 16 / top 42 边距 + 四周阴影 | **右缘与底缘贴齐视口**（x=1436 列 y99 起全 `#faf7f3`；底部无阴影带），仅 top 留白 | #72 按 r5 正典构建（04 A6：对照冻结批次，不追实时）；漂移登记在案，触发 A6 漂移监测 |
| 头部图标 | 新主题/总管设置/全屏/关闭 四件（新线程） | 线程视图五件：设置与全屏之间**新增 `更多`（⋮）** | 已入复刻（线程视图渲染 ⋮，新线程视图四件，与两批素材各自一致） |
| 示例卡文案 | 帮我组建 Agent 团队 / 帮我创建一个新项目 / 总结一下我所有项目现在的进展 / 查一下这个月的 token 用量 | 逐字未变 | — |
| 看板 #12 卡 | r5 期 review 态 `完成` 钮 | failed 态主按钮 `重试` | 超出 #72 票面（failed 面归 r8 集中票），仅登记 |

## 3. 缺口登记（仍缺，勿当作已测）

| 缺口 | 原因 | 去向 |
|---|---|---|
| Chief drawer 全窗 1440×732 基线（gated/ready/switcher/设置 4 tab，light+dark） | r5 批为 1438×730 离批位图（04 A6 不作基线）；本票随拍仅得消息流一面 | 随拍续补（free 账号静态可达；gated 面需 chief 解绑窗口）→ r8 编号 79+ |
| 绑定态设置面（Agent tab 绑定行 + 模型覆盖 picker，r5 107–110） | #72 票面素材 = r5 100–104（未绑定态）；绑定态设置面未建未拍 | 后续 web 票随拍随建 |
| drawer 背后看板底态（r5 116 徽标 2、机器点语义） | 徽标/点随真团队状态；复刻侧机器点已按 r5 四图入 sidebar（chief 场景），徽标随 fixture 看板面，不追 r5 会话实态 | 登记在案，不补 |
| chief 深色面参照位图 | 任一批次均无 chief dark _capture_（r2 16 为漂移前布局）；深色 token 值 [推断] | 随拍续补；矩阵 dark 行先以 smoke 进 CI |
| drawer 贴边形态的几何实测表 | 本票只留位图，未做 DOM 几何盘点 | 漂移若经 A6 确认为新正典 → 重拍册级基线时一并实测 |
| `更多`（⋮）菜单内容、全屏态（`tds.panel-maximized`） | 未点开 | 随拍/r8 集中票 |

**parity 现状**：#72 的 16 行 chief 矩阵（light+dark）以 smoke 行进 CI（自比对
SSIM=1.0，`parity/matrix.mjs` 行注）；上表基线补齐后逐行切 baseline（04 §2 阈值体系）。

## 4. 盘点后 space 状态

- p1 停留 `/app/`（light），drawer 关闭态；无探针、无团队数据变更（chief 记录
  `agent.agentId=TVv0DxUu3jTIhYpeWh6mn`、`watches:[]`、`wakes:[]` 与盘点前一致，API 复核）。
