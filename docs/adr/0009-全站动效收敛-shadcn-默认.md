# ADR 0009 · 全站进出场动效收敛 shadcn 默认——撤销 #73 复刻纪律的动效值面

> **superseded-in-part（2026-10-08，ADR 0012 / #991 Q9 / #1013）**：D3② 面——dropdown/popover 动效的仓内正典（本 ADR 追认的 `duration-100` + slide -8px，后经 #790/#805 长成 V2 scale-fade 覆写：scale .98 + fade、100ms ease-out）——被部分取代：动效时长曲线属 base-nova 形态的一部分，保留自定义 = 皮肤适配超出语义映射（违背 #980 零皮肤裁决②），dropdown/popover 动效的正典性来源换锚为 **registry 上游默认动画**（执行载体 = #1003 批次 0b，PR #1045 @ `da5972ce`：dropdown/popover 重拉回上游动效；dialog-shell / floating-shell 的 scale-fade 保留至 #1008 壳退役批次）。D3② 字面数值与重拉后的上游默认一致（`duration-100` + slide -8px 即上游 `duration-100` + `slide-in-from-*` 类），结论数值不变、变的是正典性来源——动效值面自此不再有仓内一手正本。原文整体保留作历史账、不删；D1 / D2 / D3①③ / D4 / D5 不在本修订射程内。

> 状态：**已裁决并生效**（2026-10-02，用户拍板方向 B：「我选择 B」）。
> 来源：#644 的原型交付（`docs/research/644-motion-shadcn-prototype.md` §2/§4，交互原型
> `docs/research/assets/644/motion-prototype.html`）。本 ADR 记「为什么撤、撤到哪为止」；
> 逐域施工范围与验收在执行票（票面引本 ADR），批次入账在 spec 16 的动效批条目。

## Problem Statement

#73 以来，站点动效层是一份**复刻参考站生产样式表的 transition registry**（`apps/web/src/styles/motion.css`，文件头明文「Values mirror the official production stylesheet」，数值逐条抄自 `docs/research/assets/r1/f965382e067739e9.css`）。与此同时，spec 16 的 shadcn 铺开把携带 tw-animate-css 默认动效的件铺进了 6 个面（B1 弹层壳、dropdown/popover/dialog registry 件）——站点已是**双动效系统并存**，且三处漂移可实测。混合态必须收敛，#644 把两个收敛方向连同真实数值与代价摆给了用户：

- **方向 A**：机制迁 shadcn、数值桥回复刻值（观感与参考站零漂移）；
- **方向 B**：全站采用 shadcn 默认动效语言（与参考站产生可感知漂移，需显式推翻 #73）。

用户选 **B**。本 ADR 记录这个改判的边界与理由，防止两件事：接手的人继续按复刻纪律施工；或者反过来，把改判扩大解释到几何/配色面。

## 侦察事实

| # | 事实 | 出处 |
|---|---|---|
| F1 | motion.css 复刻 registry 消费面 = 14 个 tsx（含 `components/ui` 三个适配层 dialog-shell / floating-shell / select）+ `useOverlayMount` 手动进出场 2 文件；机制为手写 keyframes + `data-overlay-state` 保活挂载 | #644 原型 §1.1（grep 实测） |
| F2 | `tw-animate-css@1.4.0` 已入 web 依赖，6 个 tsx 已用 `animate-in` 家族；dist 逐字读出默认 = `.15s` / `ease`，enter/exit 由 Base UI `data-open/data-closed` 驱动，**不需要**手动保活机制 | #644 原型 §1.2 |
| F3 | 三处既有漂移：① dialog-shell 带 `zoom-in-95`，而 r8 捕获实测参考站居中 dialog **仅 fade**；② dropdown/popover 100ms / slide -8px vs 复刻 150ms / -4px；③ 挂载淡入 200ms ease-out vs tw 默认 150ms ease | #644 原型 §1.3（读自源码 + 实测记录） |
| F4 | 动效面的 e2e 断言极少：2 处 `getAnimations().finished` 等待（机制无关）+ spinner duration（保留面）——重钉成本≈0；视觉 spec 钉的是静止态几何/配色，不钉动效值 | #644 原型 §2（grep 实测） |
| F5 | 「参考实现优先、不凭空造」是现行纪律（ADR 0008 D5）；动效值偏离参考站因此**只能显式改判**，不能由迁移顺手发生——而 F3 显示它正在顺手发生 | ADR 0008 + #644 票面 |

## Decision

| ID | 裁决 |
|---|---|
| **D1** | **全站进出场动效收敛到 shadcn/tw-animate-css 默认（方向 B）**：以 tw 默认档（150ms `ease` 基档、浮层 fade+zoom-95、已铺开的 duration-100 件维持现值）为正典；motion.css 的复刻 enter/exit 数值作废，`overlay-mount` / `anim-*` / `useOverlayMount` 手动机制随各面退役 |
| **D2** | **显式撤销 #73 复刻纪律——仅限动效值面**：motion.css 文件头「数值逐条抄参考站样式表」的正本地位对进出场动效废止；#73 / r8 的实测值不再是施工依据。**几何与配色的像素纪律不受影响**（spec 16「纯结构、零视觉重钉」与 #411 口径照旧）——本条撤销不得被扩大解释 |
| **D3** | **三处既有漂移逐条被 B 追认，不是静默改动**：① dialog `zoom-in-95` = 新正典（r8「仅 fade」口径就此作废）；② dropdown/popover `duration-100` + slide -8px = 新正典；③ 挂载淡入归 tw 默认档。每条在执行票里按「被 B 追认」入账 |
| **D4** | **保留面（shadcn 无竞争默认，数值不动）**：tab 指示条滑动（#644 参考站实测 left/top/width/height 150ms ease，Base UI Tabs.Indicator 承载）、~~spinner reel（#471）~~（2026-10-03 修订移出，见文末「修订」：加载指示器改挂 loading-dev Atom 契约，#672）、hover/press tint 家族（#73/#629）、`prefers-reduced-motion` 全站降级律（加载面一份自 #672 起由 loading-dev 库样式承载，行为等价） |
| **D5** | **排期形态**：动效批织入 spec 16 的 B3/B4 逐域批次（每域结构迁移时顺手收该域动效），不另开全站改动波；spec 16 追加动效批条目入账，验收沿用该册 §2 模板 + 本票 F4 的动效断言清单 |

理由一句话：机制统一（一套 animate-in/out、去掉手动保活）的收益用户已确认要吃，而观感与参考站的动效漂移用户明确接受——B 比 A 少维护一层「桥接值」的账，混合态就此收敛。

## Premortem（假设已失败，三种最可能死因 + 护栏）

| 死因 | 护栏 |
|---|---|
| **换脸后悔**：全站动效变「通用 shadcn 脸」后，用户对某个面想要参考站观感回来 | 机制已统一，回退 = 改单面数值（duration/ease/enter-*），不是换机制；D4 保留面本来就未动 |
| **撤销被扩大解释**：施工者拿本 ADR 当「参考对齐作废」的通行证，顺手改几何/配色 | D2 明文「仅限动效值面」；执行票验收含「不得触碰 per-face 几何/配色正本」一条 |
| **双系统长期残留**：迁移半途而废，一半复刻一半默认，比现在的混合态更乱 | 织入 B3/B4 既有推进机制（不是独立志愿批）；执行票验收 = `anim-*` / `overlay-mount` / `useOverlayMount` 消费点清零（grep 可复核），motion.css 收缩到 D4 保留面 |

## 修订

- **2026-10-03 · #672**：D4 保留面移出 `spinner reel（#471）`。用户 2026-10-03 agree：transcript 加载指示器换 **loading-dev**（MIT，React 19+）试点，指示器为 `Atom`（`size=16`、`duration=900` 钉齐旧 reel 周期——atom 库默认 1000ms；用户看过实物预览后选定）——即**在加载态这一处放弃 todos.dev 复刻纪律**（产品级决定；几何/配色像素纪律不受影响，D2 边界照旧）。加载态的正本契约自此 = loading-dev 库：根节点自带 `aria-hidden`、`prefers-reduced-motion` 冻结由库注入样式承载（`animation: none` + 旋转件静态 `rotate(60deg)` 落定姿态），与本 ADR 的全站降级律行为等价。motion.css 的 `spinner-reel` keyframes 随 reel 一并删除；#656 验收里「motion.css 收缩到 D4 保留面」按修订后的 D4 计。铺开与否（全站加载态统一入口）待用户看过试点实物另裁。
- **2026-10-08 · #991 Q9（#1013 入账）**：D3② 修订——dropdown/popover 动效正典性换锚 registry 上游默认（#790/#805 仓内 scale-fade V2 正典退役），理由与射程见头部 superseded-in-part 注记；执行载体 = #1003（批次 0b，PR #1045 @ `da5972ce`，已合 main）。
