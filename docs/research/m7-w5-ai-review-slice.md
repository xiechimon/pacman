# M7-W5.1 (#312) 切片裁定 + Grill + Premortem

> ticket: #312  →  slice 1 of 2  →  ticket: #326 (M7-W5.2)
> date: 2026-09-27  author: agent
> 原则命中：对抗式审查 + 第一性原理 + No Negative Echo

## 0. 切片裁定

完整 AC（r8 §3.1）= 模态 → 选 Agent → 审核步 → findings → blocking 自动修订回路。
08 册 §7 切片护栏判定：一票装不下（跨 web+server+daemon 五层 + 双 wire 新词 + 自动修订反馈环）。
切两票：

| 票 | 范围 | Issue | PR |
|---|---|---|---|
| 票 A（M7-W5.1） | 模态（560 宽 DialogShell）+ 选 Agent + 可选关注点 + 开始审核 → server enqueue review step + 时间线「发起了 AI 审核」+ 审核中 chip + composer placeholder + 停止钮复用 steer | #312 | 本 PR |
| 票 B（M7-W5.2） | findings 真 wire（verdict+编号+(blocking)）+ daemon stub-llm 真 emit + blocking→edit_plan 自动修订回路 + 新版 plan→confirm | #326 | #326's PR（blocked by #312） |

裁定理由：
1. 反馈回路跨三组件：daemon emit findings → server 收 + 判 blocking → server enqueue revision step → daemon 修订 plan → server 落 plan v2 → web 切 confirm。任意一层卡 → 整回路断。
2. findings 消息 wire 是新协议面（一类新 role / 新 content shape / 新行 kind），必须独立审查。
3. ticket AC2「全链真实可用」分两段交付：票 A 段 = 模态→审核步；票 B 段 = findings→blocking→修订。#312 AC 合并两段关闭。

## 1. Grill 反方推荐（钉死需求）

### 决策 D1 · step kind 词：新增 `review` vs 复用 `build`

反方推荐：**复用 build**，零新词表，daemon runner.ts CONTINUE_PROMPTS 不动。

裁定：**新增 `review`**，理由：
- runner.ts 的 `CONTINUE_PROMPTS[kind]` 决定了首轮 prompt 模板；review ≠ build（review 不需要 todo.spec 全量、需要 plan.md 上下文 + focus textarea 注入 + 工具白名单仅 edit_plan + 拒绝改 worktree）。
- 08 册档 2 后端盘点已明确「审核 action + 审核步 kind + findings 消息 wire + blocking 自动修订回路」四件独立（[确认会冻结点]）。
- 词表收紧意味着后续 review v2（不同 Agent / 多轮 review）可独立演进。

### 决策 D2 · 模态宽度：560 独立规格 vs 拉伸 DialogShell

反方推荐：DialogShell 加 `width` 入参，缺省 448，传 560 给 review。

裁定：**DialogShell 加 `width?: number` 入参**，reason:
- r8 §2.5「560 宽（448 弹层律之外新档）」原文只描述实测值，没说必须独立组件。
- 复用 DialogShell（Esc/背板/关闭/聚焦管理同律）= 一次改一处；新建 DialogShell560 = 两条律并行。
- 唯一需扩展：dialog.css `.dlg` width 由 448 改 `var(--dlg-width, 448px)`，dialog-shell.tsx 透传。

### 决策 D3 · 「开始审核」按钮位置：32×32 圆形 vs 复用 RerunDialog 已有 footer 律

反方推荐：复用 RerunDialog `.overlay-actions` 三按钮排，模态底部居中。

裁定：**新 primary 行**（与 r8 §2.5 `开始审核 32×32 @ (943,476.5)` 实测坐标吻合），reason:
- r8 截图捕获「开始审核」在 textarea 工具条右侧独立位（@x943），不在底部 actions。
- 与 chief-agent-dialog footer 三按钮排不同 = 新设计律。
- 实现：dialog-body 内 textarea 行末尾 32×32 primary 钮（`btn primary 32-square`），点击 = POST review。

### 决策 D4 · 时间线「发起」消息：role=user 纯文本 vs 系统提示行

反方推荐：role=user + actor 拼装（与「发起了合并」row 同律），现成 MERGE_ANNOUNCEMENT 模式。

裁定：**role=system 纯文本 + 新常量 REVIEW_ANNOUNCEMENT**，reason:
- MERGE_ANNOUNCEMENT 是 role=user（用户在 UI 上点合并）—— review 是「agent 流程行为」语义上更像 system。
- 但 review 由用户点发起（按钮在 composer）—— 用户行为。
- 折中：role=user + MERGE_ANN... 复用律。新增 `REVIEW_ANNOUNCEMENT = '发起了 AI 审核'`，与 MERGE 同款。

### 决策 D5 · 审核中 phase：复用 review vs 新增 reviewing

反方推荐：保持 phase=review（chip 已是「审核」），复用现有 phase UI 行。

裁定：**保持 phase=review，但 composer placeholder 改为「AI 审核进行中…」+ chip 用「审核中」**。reason:
- phase 不增加（09 册 §1 九值冻结）；视觉差异由 phase UI 行 + composer placeholder 承载。
- 「审核中」chip vs phase=review chip「审核」= 同一 phase 下的两步变体，类比：planning/building 都是同 chip「规划中/执行中」实测。
- 实现：phase UI 不变（review → chip「审核」、tone=confirm），加一个 reviewHasActiveStep 旗标（review 步 claimed/pending 时 → chip 改「审核中」、placeholder 改「AI 审核进行中…」）。

### 决策 D6 · daemon 端 review 步实现：本票真 emit findings 还是占位 ack

反方推荐：**占位 ack**（review 步 done 后只 emit「AI 审核已完成」单行），findings 真 emit 归 #326。

裁定：**占位 ack + stub-llm 路径**，reason:
- #326 的 blocking 自动修订回路需要真 findings 形态（含 blocking 标记），这层 wire 设计是 #326 的独立审查点。
- #312 的本票目标 = 用户能看到「审核发起 → 审核中 → 审核完成」完整三相过渡，缺中间任何一相都验不出。
- 占位 ack 复用 `completeStep(deps, stepId, { hasChanges: false })` 路径（review 步不动 worktree，不产 changes），`insertMessageRow` system role = `AI 审核已完成`。
- #326 时把占位 ack 替换为真 findings emit + blocking 判定，step kind/action 词表不变。

## 2. Premortem（3 死因 + 护栏）

### 死因 P1 · 「AI 审核进行中…」composer placeholder 与 steer/执行中态冲突

**场景**：review 步 claimed/pending 时 chip 应是「审核中」+ composer placeholder「AI 审核进行中…」；同时用户可能正发 steer（building/review 同 phase），placeholder 又得是 steer 文案。
**护栏**：chip 文案以「活动步 kind」决定，不以 phase 唯一决定；新增 reviewActive 旗标 = `steps.some(s => s.kind === 'review' && (s.status === 'claimed' || s.status === 'pending'))`。phase UI 行不读活动步，等于静态。composer placeholder 读取 reviewActive 优先于 phase UI placeholder。

### 死因 P2 · 模态打开期间 build 状态变化（确认/驳回/重跑/重开）导致「开始审核」点击后端点拒绝

**场景**：用户在 confirm 关口开模态选 Agent，模态未关时点了一次「重跑」/「重开」，buildId 失效。点击「开始审核」→ POST /api/builds/{oldId}/steps → 404。
**护栏**：点击「开始审核」瞬间校验 `buildId === latestBuildId`，不等同（任意 in-flight mutation 都 abort 重取）。server 端也得返 409 区分「buildId 不存在」与「phase 不允许」（参考 steer 409 拒绝律）。

### 死因 P3 · 占位 ack 让「#312 AC2 全链真实可用」名不副实

**场景**：审查员看到 verify 证据 = 模态→开始审核→审核中→占位 ack「AI 审核已完成」，认为 AC2 缺 findings + blocking 不算「全链」。
**护栏**：本票 PR 描述明确写「#312 切片：M7-W5.1 完工段，AC2 子段 模态→审核步 真实可用；findings + blocking 回路归 #326；#312 AC 合并 #326 关闭」。verify 截图标记阶段名（w5.1）。

## 3. 实施切点

### shared（packages/shared/src/records/step.ts）
- `stepKindSchema` 加 `'review'`
- `buildStepActionBodySchema` 加 `{action: 'review', agentId, focus?}` 分支
- 新增 `REVIEW_ANNOUNCEMENT = '发起了 AI 审核'` 常量
- `phase.ts` 文档加 review 步活动期 chip 文案注释

### server
- `applyBuildStepAction` 加 `body.action === 'review'` 分支：
  - 校验 phase ∈ {confirm, review}
  - insertMessageRow role=user content=REVIEW_ANNOUNCEMENT
  - enqueueStep(deps, buildId, 'review', teamId, reviewPrompt) where reviewPrompt 含 todo plan.md 全文 + 用户 focus
- `completeStep` 加 `step.kind === 'review'` 分支：phase 不动（review 仍 review）+ emit 占位 ack message
- 错误：build 不存在 → NotFoundError；phase 非法 → 409

### daemon
- `CONTINUE_PROMPTS.review`：留空字符串占位（review 步 = 首轮，prompt 由 server instruction 注入）
- runner.ts：`claimed.step.kind === 'review'` 不需要 worktree（review 不改 worktree）；复用 isChief 路径判断逻辑（用 `isReview` 标记，`!isChief && !isReview` 时准备 worktree）
- 占位 ack：completeStep server 侧处理；daemon 不直接 emit（统一经 server 落账）

### web（apps/web）
- 新文件 `apps/web/src/detail/review-dialog.tsx`：
  - DialogShell 560 宽变体（width=560 入参）
  - 标题「AI 审核」（来自 #312 spec 推 i18n 键）
  - 搜索行（复用 chief-pick-search）
  - Agent 行 560×65（复用 chief-pick-row 几何）
  - 可选关注点 textarea（带 placeholder 「希望 Agent 审核时重点关注什么？（可选）」）
  - 32×32 primary 行右锚「开始审核」按钮（@x943 几何）
- `overlays.tsx` 复用：export `ReviewDialog` 或独立文件（同 family 形态）
- `OverlayState.kind` 加 `'review'`
- composer.tsx aiReview 显隐律已实装（r7 §4.1）；加 `onReview?: () => void` 入参
- todo-detail-page.tsx：
  - `aiReview && onReview={() => setOverlay({ kind: 'review' })}` 接线
  - ReviewDialog 渲染（live：mutate stepAction {action: 'review', agentId, focus?}；fixture：仅显示，不触发）
  - chip 文案改读：`reviewActive ? '审核中' : ui.chip`
  - composer placeholder：`reviewActive ? 'AI 审核进行中…' : ui.placeholder`

### shared wire 兼容
- stepJournalRowSchema 不变（status 字段已含 claimed/pending/done）
- 新增 review 步 message content 形态：role=user, content=REVIEW_ANNOUNCEMENT（纯文本，与 MERGE 同款）

### i18n
- zh 添加：`AI 审核`（已有，aria-label 用）、`发起了 AI 审核`（不在 i18n，由 shared 常量承担）、`希望 Agent 审核时重点关注什么？（可选）`、`开始审核`、`审核中`
- en 同步补（i18n-coverage CI 闸；`本地闸 vs CI 闸`先例）

### verify
- verify-pacman 栈：mock build 进 confirm 关口 → 开模态 → 选 Agent → 开始审核 → 时间线出现「发起了 AI 审核」+ chip「审核中」+ composer placeholder「AI 审核进行中…」+ 停止钮可用 → 等 review 步 done → chip 回「审核」+ placeholder 回「请求修改…」
- e2e：apps/web/e2e/review-modal.spec.ts（开模态/选 Agent/开始 → 状态变化/时间线行/停止钮可用）

## 4. 不动清单（No Negative Echo + 用户先前约定）

- steer 实现（#308 / PR #325）：不动，发现洞记 PR 评论
- DialogShell 既有 448 宽律：不改家族律（仅加 width 入参）
- phase 九值：不增加 reviewing（chip 文案靠 reviewActive 旗标）
- chief-agent-dialog：不复用（AI 审核模态是 560 宽 + 含 textarea，与 448 宽选择器不同形）
- runner.ts CONTINUE_PROMPTS 词表键数：增加 review 但保留 chief 占位

## 5. 收尾

- 三闸绿（pnpm lint / format / typecheck）
- verify-pacman 证据 + e2e 钉面
- 提交 commit `web(312)` `server(312)` `daemon(312)` 按改动面
- PR body 挂 Parent #302，附 closes #312（注脚：#326 收尾后合并关），实际本票只关「W5.1 段」