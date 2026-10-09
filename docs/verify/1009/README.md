# #1009 A0 证据（ADR 0013 壳形态反转：贴右竖板 → Multica 式悬浮窗）

> 阶段：**实审通过（2026-10-08 用户「全按推荐走」）→ 施工段**。原型证据（§1–§5）+
> 施工证据（§6–§8：载体重钉 ⑨、探针重钉清零、better-colors 增量实测）同册归档。
> 复跑配方见各节命令；栈纪律 = verify-pacman SKILL.md（隔离 live 栈，绝不碰 8787/5173）。

## 0. 结论速览

| 面 | 结果 | 产物 |
|---|---|---|
| fixture 位形 smoke（五路由 + 交互契约，50 checks） | **50/50 PASS** | `drive-1009-a0-smoke.mjs` + `result-a0-fixture-smoke.json` + 截图 01–13 |
| live 栈取证（真数据，24 checks） | **24/24 PASS** | `drive-1009-a0-live.mjs`（skill scripts/ 内）+ `result-a0-live.json` + `live-*.png` |
| chief 域 + 邻接 e2e（17 spec / 179 用例）原型态 | 136 绿 / 43 红（红 = 重钉账，逐条分类见 §3） | `e2e-domain-status.txt` + `e2e-failed-list.txt` |
| 同域 e2e 重钉后 | **178 绿 / 0 红**（43 红全数重钉，见 §6） | 重跑命令同 §1 |
| 视觉探针三方 diff（开工侦察 vs 原型后 vs #953 封版） | KEPT 52 / DRIFT 5 / NOT-RUN 33 / VIOLATION 0 | `probe-pre-a0/` + `probe-after-a0/` |
| 视觉探针重钉后（验收模板 v3 第 2 项） | **KEPT 109 / DRIFT 0 / NOT-RUN 0 / VIOLATION 0**（91 用例全绿） | `probe-repinned/` |
| better-colors 增量实测（验收模板 v3 第 3 项） | **双模 14 对全过**（下限 4.5 正文 / 3 UI 字形） | `measure-a0-colors.mjs` + `colors-a0.json` |
| 单测（web 全量 468） | 全绿（含 i18n-coverage 新键「最小化」） | — |
| typecheck / lint | 全绿 | — |

## 1. 复跑配方

```sh
# fixture smoke（preview 栈）
cd apps/web && pnpm exec vite build --mode fixture
pnpm exec vite preview --host 127.0.0.1 --port 8403 --strictPort &   # 跑前 lsof 查占用
E2E_PORT=8403 node docs/verify/1009/drive-1009-a0-smoke.mjs

# live 取证（隔离栈）
node .claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_EVIDENCE_DIR=$PWD/docs/verify/1009 \
  node .claude/skills/verify-pacman/scripts/drive-1009-a0-live.mjs
node .claude/skills/verify-pacman/scripts/cleanup.mjs

# 域 e2e 现状（红 = 重钉账，非回归——见 §3 分类）
cd apps/web && E2E_PORT=8403 pnpm exec playwright test chief-panel chief-stream-markdown \
  chief-send-fallback chief-composer-tools chief-drawer-slash chief-drawer-model chief-fab \
  chief-settings hotkeys shell-consistency z-ladder board-docked-reflow board-zoom-fit \
  detail-3pane detail-narrow machines-chief-state overlay-focus

# 探针三方 diff
pnpm --filter @pacman/web probe:dump --specs chief-panel chief-stream-markdown \
  chief-send-fallback chief-composer-tools chief-drawer-slash chief-drawer-model \
  chief-fab chief-settings --out docs/verify/1009/probe-after-a0
```

## 2. registry 逐件对照表（协调者 2026-10-08 口径更正：判据 = `scripts/ui-upstream-snapshots.json`）

本轮（A0 原型）**对 `components/ui/` 零写入**。逐件对照：

| 件 | 上游快照形态 | 本地形态 | 判定 |
|---|---|---|---|
| `button.tsx` | base-nova registry（快照 hash `1df2d803…`） | 未改；消费点沿用 #950 七通道中和 utility（HEAD_ICON_BTN_CLS 等，先于本轮存在） | ledger `deviated` 已登记（#411/#425 语义映射零皮肤）——本轮未新增偏离 |
| `dialog-shell.tsx`（adapter） | 非 registry 件（本地组合层） | 未改（rewind 确认层消费点原样） | ledger `adapter` 已登记；**L3/#1006 已翻面为 registry dialog 组合——合并序撞上时 rewind 消费点按 L3 示范对齐（去自携 padding 包装、裸内容进 DialogFooter），归属施工面** |
| `message-scroller / message / bubble / attachment / marker`（A1 五件） | base-nova registry，`ui-registry-refresh.mjs --items` 管线产物 | 已 vendored 至 `/tmp/a1-primitives-1009/`（**未提交**，A0/A1 分段纪律）；与快照**逐字节同源**（hash 即管线 hash：ed1dd557 / dc60c69f / b6812e3f / 33d34435 / 59574fed） | A1 段登记（pristine）；本轮不进 commit |
| 悬浮窗本体（`chief-drawer.tsx` aside） | **非 registry 件**——承载机制 = Base UI 非模态 Dialog + Portal（ADR 0013 D10/F11，不触 0012 D3） | 几何/皮肤 = ADR 0013 D2 整套 Multica 原值（380×600、8px inset、12px 圆角、`--floating-shadow` 双主题原值、不透明卡底、edge-ring 发丝环） | 依据 = ADR 0013（用户 2026-10-08 十三问定案），非「方角/圆角」形容词判读 |
| FAB（`chief-root.tsx`） | 非 registry 件（应用面 launcher） | 40px 正圆 / 8px inset / floating-shadow + edge-ring = ADR 0013 D4 Multica 原值 | 同上 |

**本轮没有任何「改得更方」的动作**：窗 12px 圆角与 FAB 正圆均取自 ADR 钉死的 Multica 原值；
消费点中和 utility（rounded-none 族）全部先于本轮存在（#950 七通道配方），未扩未改。
12px 圆角落点记票：一次性 arbitrary 值（§3.1(a)），**不**消费 #983 退役面 token
`--radius-popover`（ADR 0012 D4 明令）；窗是该值唯一消费点，若施工面裁决提 token 再迁。

## 3. e2e 43 红分类（重钉账，ADR 0013 D11 / 票面 ⑨；行为断言语义一字不动）

| spec | 红数 | 分类 |
|---|---|---|
| board-docked-reflow | 8 | 整 spec 钉已退役的停靠让位态（0004 D8 废）——重钉为「覆盖层零让位」语义 |
| chief-panel | 11 | docked 418 几何 pin ×6 + 让位 pin + Esc 关窗 pin（D3 反转）+ 刷新不持久 pin（D5 反转）+ D7 互斥 pin |
| hotkeys | 9 | `data-chief-open` 标记族 + count-0 断言族（D6「关 = 在 DOM 但 inert」新契约） |
| shell-consistency | 5 | 族 FAB 类名/几何（48×48/16 族律退役，D4） |
| chief-fab | 5 | 同上 + unreadOnly 门载体 |
| chief-stream-markdown | 2 | F-R16 气泡几何随窗宽 418→380 重钉；F-R18 进场动画 settle 谓词（scale 动画期间 boundingBox 读缩放值——重钉加等待谓词，同 #984 对 A2 的预警形态） |
| detail-3pane | 1 | 418 chief dock 态 pin（D7 互斥退役） |
| chief-drawer-model | 1 | 关窗回收 popover 的 count 载体族 |
| board-zoom-fit | 1 | `data-chief-open` 两态地板切换（#1035 面随让位退役收敛单态） |

**非重钉的真回归：0**——43 红逐条对到上表；136 绿覆盖设置面/ composer 面/ slash 面/
发送回落/ machines-chief-state/ overlay-focus/ z-ladder/ detail-narrow 等行为契约。

## 4. 本轮工程裁决记录（施工面/实审可翻）

1. **z 新 rung = `--z-floating: 15`**（--z-docked 之上、--z-backdrop-low 之下）：#688 律
   「活动面恒压常驻面」原样成立；F8 单点裁决 = 渲染中的 registry 弹层件经已登记 deviation
   骑 --z-dialog，未渲染件（ui/dialog、ui/alert-dialog）保持上游 z-50 原文（永不竞争）。
2. **clearance 预约制度落地**：`--chief-launcher-size/inset/clearance` + `pe-/pb-/above-chief-launcher`
   三 utility（app.css @utility，Multica base.css 同形）。本轮零消费点：右下角落位经 smoke
   逐路由核对无吸底元素被撞（detail composer 发送钮在中心列、board 无吸底条）；消费点
   出现时按 Multica 三分类选 utility。
3. **autofocus 只认 closed→open 迁移**（MUL-5522 同律）：持久化开态的加载不抢焦点；
   keepMounted 后节点常驻，旧「OverlayMount 滞后一帧 ref callback 首焦」径退役。
4. **草稿跨整页刷新不持久**（与现状 main 同行为）：D5 只持久化开态；Multica 的草稿
   per-workspace 持久化如需对齐另票。
5. **抑制路由集 = agent 详情 + 机器授权**（覆盖面 = 现状，不发明新面）：根 host 保持
   hook 实例存活（状态跨绕行保留）但不渲染 launcher/窗、解除 ⌘J 注册。全站统一覆盖
   （含这两路由）是否为终态 = 实审裁决点。
6. **scrollAnchor（registry anchoring）A1 再裁**：A1 设计侦察已定「不挂 anchor、发送跳最新
   走 useMessageScroller().scrollToEnd」以保 #873 跟随律；anchoring 作为增强面留实审裁决。

## 5. 截图清单

fixture：01 board FAB 关态 / 02 board 窗开 / 03 新建任务 dialog 压窗（z 律）/ 04 最小化后 /
05 schedules 窗开（SPA 常驻）/ 06–08 pages·resources·secondary 三壳窗开 / 09 detail 窗开+右栏共存 /
10·10b fixture 111 hero·114 线程捕获形 / 11 抑制路由 / 12 设置视图内容交换 / 13 live 窗开。
live：live-01 真线程窗开 / live-03 刷新恢复开态 / live-05 schedules 常驻 / live-06 detail 覆盖位形 /
live-07 设置深链 / live-09 抑制路由。

## 6. 施工段：载体重钉（验收模板 v3 第 1 项，ADR 0013 D11）

43 红全数重钉后同域 17 spec **178 绿 / 0 红**。逐族处置（行为断言语义一字不动，
只换载体/换已裁决行为）：

| spec | 原红 | 处置 |
|---|---|---|
| chief-panel | 11 | 整 describe 翻面「floating form」：418 docked 几何 → 380×600@8 + fixed + radius token + z15 + 双层投影 + 不压侧栏；让位 pin → 零让位对拍；Esc 关窗 → Esc 永不关（D3）+ 内层先收保留；D9 刷新即关 → D5 刷新恢复（live-mock 桩面，fixture 面零存储律另钉）；count-0 → hidden+count1 |
| hotkeys | 9 | count-0 族 → toBeHidden；escapeUntilHidden(drawer) → toggleUntilHidden（⌘J 是唯一键盘收起）；pressesStayClosed(drawer) → pressesStayHidden 新helper（count-0 律留给 dialog 族）；FAB 互斥注释翻 D4 |
| board-docked-reflow | 8 | 整 spec 翻面「覆盖层零 reflow」：停靠地板/让位横滚 pin → 开合零几何跳变对拍（1440/1024/RTL/最坏数据/卡宽/滚动条披露九条失败方式重写）；FLOOR 280 → 200 单态 |
| shell-consistency | 5 | 五族 FAB 类名载体 → 单实例 .chief-fab；「close returns」→ Minimize 收起；关态 count-0 → hidden+count1 |
| chief-fab | 5 | .detail-fab → .chief-fab；48×48/right504/bottom104 → 40×40@8 fixed（D4）；fab-avatar 捕获形翻关窗态（fixture view drawer→none，D4 互斥的捕获面必然） |
| chief-stream-markdown | 2 | F-R16/F-R18 加进场动画 settle 谓词（fade+scale 期间 boundingBox 含 transform）；44px 药丸值不变（380 宽下单行不 wrap，实测保真） |
| detail-3pane | 1 | 488/418 两态 composer 宽 → 单态 488 + 开窗零位移对拍（D7 互斥退役） |
| chief-drawer-model | 1 | 关窗回收 popover 的 count-0 → hidden 载体（portaled 弹层 open 态清零后节点归零不变） |
| board-zoom-fit | 1 | data-chief-open 活翻 pin → 开窗零地板复活对拍（两态退役） |

## 7. 施工段：探针重钉清零（验收模板 v3 第 2 项）

`probe-repinned/`：重钉后 chief 域 8 spec 全绿 93 用例，visual rows **KEPT 114 /
DRIFT 0 / NOT-RUN 0 / VIOLATION 0**（对照表清零）。三方 diff 链：
`probe-pre-a0/`（开工侦察，旧壳 104 KEPT）→ `probe-after-a0/`（原型态 52 KEPT /
5 DRIFT / 33 NOT-RUN = 重钉工作面）→ `probe-repinned/`（清零）。人审 diff =
本册 §3 分类表 + §6 处置表（DRIFT 5 条全部落在「已裁决退役面」，无一条疑似回归）。

**合并 origin/main 后刷新**（merge `520140f3`，带入 #1004/#1034/#903/#1050）：
FAB ⌘J 提示载体随 #1004 的 kbd-hint 退役面迁移——该消费点原在 board-page 内联钮
（#1004 已翻成 registry Tooltip+Kbd），A0 把 FAB 迁到根 host `chief-root.tsx`，
形态随迁（Tooltip side=top + Kbd，静息不挂载）；hotkeys 的 wake-family 提示 pin
同载体重钉（单实例 FAB 后「共享消费点」语义 = 同一路由无关载体）。本 dump 为
迁移后重跑产物（91→93 用例 = main 在域内 spec 新增 2 条）。域 e2e 合并后
191/191 绿（含 #1004 的 shadcn-primitives / sidebar-visual）、web 单测 468/468、
typecheck / lint 全绿。

**全量批（CI 分片 2/3 暴露，域集外 5 例，修复 `b12251ec`）**：真回归 1 例 =
#634 detail Esc 分层守卫 query 任意在挂载 `[role=dialog]`，被 A0 常驻窗永远命中
→ 守卫排除 `.chief-drawer`（D3 窗从不拥有 Esc 键；detail-esc E1–E3 绿）。载体重钉
4 例 = dead-buttons 第三头钮 关闭→最小化（D3）、notify-click T4b count-0→
hidden+count1（D6）、page-scroll 等卸载→等在场（设置面窗内交换）、
agent-identity-chip 24px 几何撞 D7 进场缩放 → settle 谓词（3x repeat 绿）。
**本地全量收口 848/848**（§0 旧口径「826 绿」为合并前数，作废）。

## 8. 施工段：better-colors 增量实测（验收模板 v3 第 3 项）

`measure-a0-colors.mjs` + `colors-a0.json`：A0 新合成面 = 窗 chrome + FAB 族
（token 零新增颜色值，全既有槽的新组合）。双模 14 对全过：dark 正文 13:1 /
UI 字形 7.18:1 / 徽标 8.14:1；light 正文 16.14:1 / UI 6.31:1 / 徽标 7.38:1；
FAB 字形 16.14:1、⌘J chip 10.73:1。下限照 spec/22 §1.8 / #950 先例（正文 4.5、
UI 字形 3）。全局色板不重测（#988 双模 109 对 0 fail 封账）。

## 9. 手写面退役对账声明（验收模板 v3 第 5 项，#983 判决表逐条）

落在 chief 域的 #983 判决行：
- **panel→Card / dialog-shell 零皮化 / status-chip / tag-chip / seeded-avatar /
  kbd-hint→Tooltip+Kbd / floating-shell 族拆**：均**不属 A0 段**（属 #1008 L5 与
  波 2 / 施工批次）——A0 对它们零触碰，现状消费点原样（chief 域内 seeded-avatar /
  kbd-hint / dialog-shell 消费点保持既有形态）。**合并后例外一条**：board FAB 的
  ⌘J 提示消费点已被 main 的 #1004 翻成 registry Tooltip+Kbd，A0 把该 FAB 迁进
  `chief-root.tsx` 时**承接 #1004 形态**（不是本票新做退役；完整版仍归 #1060/L5，
  本票未触碰其余 kbd-hint 消费点）。
- **F8 registry 弹层件写死 z-50 的接法单点裁决**：随 A0 出（tokens.css --z-floating
  注记）——渲染中件经已登记 deviation 骑 --z-dialog，未渲染件保持上游 z-50 原文。
- **dialog-shell 翻面交叉（L3/#1006 实审通报）**：rewind 确认层是 dialog-shell 常规
  消费点；L3 合入后按示范对齐（去自携 padding、裸内容进 DialogFooter）——归属
  A0 施工面与 #1006 的合并序协调，本 PR 不动（动了撞当前 main）。

## 10. 未迁残留声明（验收模板 v3 第 6 项）

- 标识符残留：`chief-drawer.tsx` 文件名 / `ChiefDrawer` 组件名 / `.chief-drawer`
  类钩（hotkeys 守卫 + e2e scope 锚）——ADR 0013 D13 记名，更名随后续施工批次；
- `--chief-shadow` 剩抽屉头切换器 popover 单消费点（悬浮窗改骑 --floating-shadow）；
  `--dur-drawer` 零消费（motion registry 镜像保留）；`--edge-radius`/`--radius-popover`
  仍属 #983 退役面待批；
- A1 五件原语 vendoring 暂存 `/tmp/a1-primitives-1009/`（未提交，A0 合并后启用）；
- 草稿跨整页刷新持久化 = #1056（实审裁决 4 另票）；
- registry anchoring（scrollAnchor）= 实审裁决 2 不采（保 #873 跟随律）。

## 11. A1 段原型（chat 原语装件 + chief 消息流换装）

> 状态：**实审三裁决已回（2026-10-08）→ 施工段完毕，PR #1066 CI 磨绿中**。A0 已合并（squash `99ffb54a`，PR #1062）。
> A1 范围（票面）：五件原语装件（MessageScroller/Message/Bubble/Attachment/Marker）
> + 消息流替换 + 滚动模型替换 + 行 id 贯通 + Bubble 默认皮几何中和；
> jump-to-latest 随原语带入（#991 Q6，实审过目）；composer 输入区不在射程（#991 Q7）。

### 11.1 装件链（验收模板 v3 第 7 项）

`node scripts/ui-registry-refresh.mjs --items message-scroller,message,bubble,attachment,marker`
（shadcn@4.21.3 view → R1–R5 改写 → biome 归一 → 快照账本）——五件 hash 与开工侦察
暂存（/tmp/a1-primitives-1009/）**逐字节同源**：ed1dd557 / dc60c69f / b6812e3f /
33d34435 / 59574fed。落 `components/ui/` + 账本 `pristine` ×5（35 entries = 26 registry
〔19 pristine〕+ 9 adapters，frozen from d62bc480）→ gate PASS（幂等复验 no change）→
COMPONENTS.md new-track 登记 5 行（30→35）→ inventory 闸 4/4 绿。

### 11.2 换装面（结构映射）

| 现状面 | 换装后 | 中和（消费点 className/style，文件 pristine 零触碰） |
|---|---|---|
| body div（overflow-y auto，bodyRef + useChatFollow） | `MessageScroller` Root/Viewport/Content/Item | Root `h-auto min-h-0 flex-1`（原语 size-full 的 h-full 会顶爆 flex 链）；Viewport 承接 chief-body testid（F-R6/R8 overflowY auto 面 = 原语自带） |
| chief-stream div（px-17 pt-3.5） | Content + chief-stream testid | `block gap-0`（行距留行 margin——原语 flex gap-6 会双倍行距） |
| 行 div（key=index） | Item（key/messageId = 源 chief_message id） | inline style `content-visibility: visible`（原语 auto 会让离屏行跳布局——探针/e2e 随滚动相位漂；380px 窗数十行规模，确定性 > 虚拟化收益） |
| user 行气泡（BUBBLE_CLS div） | Message + MessageContent + `Bubble variant=secondary` + BubbleContent（chief-bubble testid 随迁） | 二次档 --secondary 底 = 原槽位（--secondary-foreground 双主题与 --foreground 等值，#1002 色板实测）；`border-0`（原语 border-transparent 吃 2px——F-R16 44px 药丸 canon）；rounded-(--radius-popover)/px-3/py-2.5/leading-6/w-full（80% cap 退役） |
| robot 行裸文本 | Message + `Bubble variant=ghost` + BubbleContent | ghost 档 p-0/bg-transparent/rounded-none = 裸文本面；w-full + leading-6 补正 |
| note/error 行（居中 div） | `Marker` + MarkerContent（error 带 role=alert 二段面） | 居中/12px/墨色钉回现状 |
| thinking/tool/streaming 行 | Message 骨架 + 既有行件（ThinkingRow/ToolActivityRow/LiveRow 共享件不动，A2 面） | `.chief-msg` 类载体保留（F-R19/R20 联合选择器） |
| gate/hero（滚动区内） | 移出滚动区（flex-none 兄弟） | 两面只在无流状态出场——移出后视觉等价 |
| — | `MessageScrollerButton direction=end`（jump-to-latest，#991 Q6 随原语带入） | children 覆写 = 仓 ArrowDown 字形（生成器新增）+ t('滚动到最新') sr-only（pristine 面英文字面量不进 i18n 账） |

**滚动律映射（#873 逐条 → 原语机制，实审裁决 2 = 不采 scrollAnchor）**：
贴底阈值 80px = `scrollEdgeThreshold={80}`（FOLLOW_THRESHOLD 同值）；关窗解除武装 =
`autoScroll={open}`（旧 active 同律）；打开落底 = `defaultScrollPosition="end"`；
切线程落底 = threadTitle 守卫 effect → `scrollToEnd()`（旧 resetDep 等价）；
发送跳最新 = wire.onSend 里 `scrollToEnd()`（旧 requestFollow 等价）。
useChatFollow 本体保留（详情页对话列 = A2 段的替换面，本段不动）。

**行 id 贯通（票面「mapper 视图侧」）**：`ChiefStreamItem` robot/thinking/tool 三 kind
扩 `id?: string`；collectChiefStream 三投影点 `id: m.id`（每行源 message 互异，直投
不冲突；wire 零触碰——ADR 0011 封段在写入端）。单测契约同步（chief-segments
F2/F4/F6 toEqual 含 id，7/7 绿）。fixture 捕获形无 id → key 回落 index、Item 无
messageId（S10 钉）；live 面 messageId pin 归施工段 e2e（live-mock 桩带 id）。

**Provider 拆分**：Dialog 壳（Root/Portal/Popup/aside）+ `MessageScrollerProvider` 住
外层 ChiefDrawer；threadsOpen 状态上提（Root onOpenChange 的 Esc 代收要读写它）；
整列窗内容下沉 ChiefDrawerInner（hook 面消费 useMessageScroller——同组件 hook 吃不到
自己渲染树的 context，拆分点即此）。

### 11.3 原型态账面

- 域 e2e 24 spec：**247 绿 / 2 红**——两条红都是重钉账（行为断言语义不动）：
  ① hero 面 `chief-stream` count-0 → 常驻 Content 载体（D6 同族：容器常驻、行零个）；
  ② XMON-102「草稿/空面等高 60px」→ **#860 grow 律已取代固定轨**（chief-drawer
  growCap:120 注记原文 "the XMON-102 fixed-height law is superseded"）。实证：A1 前
  scrollHeight=120 而 inline height=''——grow 副作用因隐藏挂载时序在 fixture 面
  **从未触发**（另检出 A0 态 worktree 建 build 实测），XMON-102 pin 钉的是副作用
  未触发的意外面；A1 挂载结构下首次触发 = 律的真面目（草稿面 120px 顶格 + 盒内
  滚动）。施工段按 #860 语义重钉。
- 探针三方链：`probe-a1-pre/`（开工基线 KEPT 119/140 行）→ `probe-after-a1/`
  **KEPT 115 / DRIFT 1 / NOT-RUN 3 / VIOLATION 0**——DRIFT+NOT-RUN 四条全部落在
  XMON-102 那一个测试（304 断言 + 其后续 308–310），其余几何/皮肤行全 KEPT
  （44px 药丸、行节奏、chip 几何、头像 24px 逐值保住）。
- fixture smoke（`drive-1009-a1-smoke.mjs`）：**19/19 PASS**（S1 结构/S2 中和/S3
  Bubble 皮/S4 Marker/S5 hero+grow/S6 打开落底/S7 jump-to-latest 三面/S8 重开落底/
  S9 载体守恒/S10 id 面）。
- 单测 468 全绿（chief-segments 契约更新后 7/7）；typecheck / lint 干净。
- 截图：a1-01 线程面 / a1-02 jump 钮浮出 / a1-03 重开落底 / a1-04 hero+grow 面 /
  a1-05 identity chip 面 / a1-06 dark / a1-07 light。

### 11.4 实审裁决点（滚动实审过目）

1. **jump-to-latest 按钮形态本体**（#991 Q6：删除才是定制——原语默认皮 = 仓
   Button secondary/icon-sm 档、底缘居中、上翻浮出/近底退场）：a1-02 截图。
2. **S8 判据翻面**：最小化重开 = **落底看最新**（chat 通行律，与旧 dock 时代一致）。
   实测发现：Base UI keepMounted 关态 = `hidden` = display:none——浏览器丢弃滚动
   位置，A0 宣称的 D6「滚动存活」在最小化面物理不可达（A0 期同样如此，未取证到
   这一面；草稿/线程态存活不受影响）。Multica 原形态 = opacity+inert 常驻**不**
   display:none，滚动才真保。若要真保留需换壳层关态载体（超 A1 射程）——采「重开
   落底」还是开壳层票，请裁决。
3. **#860 grow 律在 fixture 面首发**（XMON-102 重钉）：草稿 6 行面 composer 120px
   顶格（a1-04）——按 #860 已裁决律重钉，还是维持固定轨（需关 fixture 面 grow），
   请确认。

### 11.5 A1 未消费原语面（残留声明预登）

MessageAvatar/MessageHeader/MessageFooter/MessageGroup/BubbleGroup/BubbleReactions/
MarkerIcon/Attachment 全族（B 段消费）——头像槽仍走 recipes 单源 span（原语自带
bg-muted/min-w-8 皮，中和成本高于收益，A2 再裁）；`scroll-fade-b`/`scrollbar-thin`/
`scrollbar-gutter-stable` 是 shadcn hosted utility 死类（仓未 vendor，零生效零副作用）。

### 11.6 施工段（实审裁决落地 + CI 磨绿，2026-10-08/09）

**实审三裁决（用户「三条都按你的建议」+ 第三条加硬口径）**：
① jump-to-latest 采纳 registry 默认形态；② reopen 语义采「重新打开落在最新」，
Multica inert/opacity 载体另开壳票 **#1067**（display:none 物理不可达事实已写进票面，
本票不做）；③ XMON-102 重钉到 #860 grow 语义，**钉扎值以证据实测读数为准**
（「截图上是多少就钉多少」，不许钉推定/理论常数）。

**G5 判红与登记偏离（bubble.tsx tinted 档）**：ui-drift-gate G5 抓 pristine 文件里
上游 tinted 档的相对色 `oklch(from var(--primary) …)`——运行时依赖 --primary、
折不了静态 token 值，且 #851「颜色走语义槽」无豁免出口。处置 = **不新造 token 槽**
（协调者明令拿不准就别自拍槽；本处置也没拍）：按 button.tsx 既有偏离先例改写为
`color-mix(in_oklch, var(--primary) p%, var(--card))` 双 token 混色（同文件上游
secondary/muted hover 的括号习语），配比按上游 L 目标值（base 0.93 light / 0.30
dark，hover 0.88 / 0.35）对 #988 实测 token L 值（card 0.9426/0.2553、primary
0.1706/0.9346）反推：light 2%/8%、dark 7%/14%，四面 |ΔL| ≤ 0.005。账本
bubble.tsx → **deviated**（第 8 个登记偏离，reason 含完整推导），hash 重冻
`a1b3b663…`，registry gate + drift gate 双 PASS。与 #988 色板账零冲突（不动任何
token 值）、与 #1055 品牌墨裁决零冲突（text-foreground 原样，墨槽未挪用）。
tinted 档本车道零消费（A1 只吃 secondary/ghost）。

**两条重钉账落地（e2e）**：
- hero 面 `chief-stream` count-0 → 常驻 Content 载体律（D6 同族）：容器 count-1 +
  Item 零个 + 行载体零个（行为语义「hero 面无流」不动）。
- XMON-102 → 更名「composer grows with a restored draft to the six-line cap
  (#860 supersedes XMON-102)」：drafted 120 / empty 60，**值来源 = 实测渲染**
  （smoke S5/S5b 两行录于 result-a1-fixture-smoke.json，截图对照 a1-04 / a1-01），
  spec 注释注明非 growCap 常数推定（数值恰合同为实测结果）。overflowY auto 两面保留。
- 新增 **F-R23**：live 面行 id 贯通 pin——四条 Item 的 data-message-id 逐一
  对到桩消息 id（m1/m2/m3/m9，存储序）；fixture 面 id 缺省回落 index（S10 已钉）。

**better-colors 增量（模板 v3 第 3 项）**：A1 新合成面 = **零**——user 气泡走
secondary 档（--secondary 既有槽，A0 册 §8 已双模实测过同槽族）、robot 走 ghost
（透明底无新对）、marker/jump 钮全既有墨槽；tinted 偏离色零消费不渲染、无可测面。
故本段不重测（#988 全局 109 对封账 + A0 增量 14 对面不变）。

**收口账面**：本地全量 e2e **849/849**（含 F-R23 新增；main 同期并入 #1007 pages
大改——全量网兜住零交互红）、根 vitest **2251/2251（206 文件）**、typecheck /
lint / registry gate / drift gate / inventory 全绿、探针重钉后
**KEPT 121 / DRIFT 0 / NOT-RUN 0 / VIOLATION 0**（probe-after-a1 重跑覆盖原型态
dump；三方链 = probe-a1-pre 基线 → 原型 DRIFT 1 → 施工清零）。
