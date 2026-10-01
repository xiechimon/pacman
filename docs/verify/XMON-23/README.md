# XMON-23 验证证据:总管域切 shadcn

`apps/web/src/chief/` 全部裸控件收口到 `components/ui/*`(20 处裸控件 + 2 处老原语)。
纯结构变更——视觉零重钉。证据四组(全部为 rebase 到 `134de3bf` 后的当轮输出):

## 1. 像素纪律(验收 3:零视觉重钉)

对照 = 干净基线(origin/main `134de3bf`,另开 detached worktree 采集)+ 迁移后本树;
15 视口 × 明暗双主题 = 30 视图,采集端等所有 drawer/pop/dialog 入场动画落定后才取数。

- `pixel-diff.txt` — 结构化 computed-style 对拍(148 个迁移目标 × 30 视图):
  **0 处未解释差异**,458 项差异全部落在白名单(flexShrink/nowrap/relative/
  透明 1px 边/圆角落在透明底上等),每条均经图像对拍验证不可见。
- `pixel-imgdiff.txt` — chromium canvas 逐像素对拍 30 对整视口截图:
  **30/30 完全一致**(通道差阈值 >8,无一像素越线)。

## 2. 行为 e2e(验收 2:域行为全绿)

- `e2e-full.txt` — 收尾全量 `playwright test`(E2E_PORT=8451):**526 passed**
  (52s)。其中总管域 10 spec(chief-fab / chief-panel / chief-settings /
  segmented-controls / hotkeys / dialog-viewport / dead-buttons / chip-assign /
  shell-consistency / sidebar-visual)贡献 116 条,全绿。

## 3. live 栈探针(验收 4:verify-pacman 栈,API+SQLite 双真值)

隔离栈(VERIFY_PORT=8792 / VERIFY_WEB_PORT=5274 / scratch PACMAN_HOME),
全部交互点走的都是迁移后的 shadcn 件。

- `live-chief-migration/` — 全链探针 **15/15 PASS**(`result.json` + 7 张截图):
  FAB 开 drawer → gate「设置」→ 设置面 → Agent 行开 dialog → 选行绑定
  (PATCH 后 API `agentActor.id` 与 SQLite `chief.agentId` 双双对账)→
  章程 tab 编辑保存(API + SQLite 对账)→ 返回 → composer 发消息
  (POST /chief/threads 201,`chief_thread`/`chief_message` 落库,UI 线程面上屏)。
- `live-model-select/` — 压缩模型选择器并集一致探针 **7/7 PASS**
  (model-sources ∪ custom providers,增删 provider 后行集合与期望投影一致)。

## 4. 预存缺陷登记(非本票回归,迁移前后同态)

设置面返回钮 `.chief-set-back` 中心带被绝对定位标题 `h1.chief-set-title`
(满宽文本框)盖住,只有顶/底 2–3px 露出条可点。探针实测命中链确认:旧静态
`.btn` 输给 absolute 标题,新原语 relative 同 z-auto 按 DOM 序仍输——像素
对拍两边一致,是预存死区。e2e 从不点这个钮(返回都走 Esc/外部),建议另票
修标题盒宽度或 pointer-events。
