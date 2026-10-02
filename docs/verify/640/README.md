# verify-pacman 证据 · #640（开始任务单出口 + 编排来源面）

隔离 live 栈实测（server + vite dev + 独立 PACMAN_HOME scratch，绝不碰用户真栈）。
两组证据：before = `origin/main` 一次性 worktree 栈（8793/5275）；after = 本分支栈（8791/5273）。
探针为一次性脚本（`.claude/verify-shots/`，随 worktree 不入库）；编排来源字段的**落库逻辑**由 server 单测 `apps/server/test/orchestration-source.test.ts`（A1/A2/A3/A4/C1/D1–D4）确定性直证，本组证据证 **UI 渲染面 + 开始入口 live 行为**。

## before/（origin/main，#640 前）

| 文件 | 内容 |
|---|---|
| `before-start-choice-dialog.png` | todo 相位点「开始」弹出 #318 统一选择面：先做规划 / 立即执行 双分支 + 规划与执行分用不同 Agent 开关 + 指派选择器——即用户裁决要撤掉的选择面。 |
| `result.json` | 3/3 PASS：dialog 开、双分支在、分用开关在。 |

## after/（本分支，#640 后）

| 文件 | 内容 |
|---|---|
| `A1-start-no-dialog-toast.png` | todo 相位点「开始」→ **不再弹任何选择 dialog**，直发总管编排回合，toast「已交给总管编排」上屏（T0 反馈）。 |
| `B1-board-chief-chip.png` | 带编排来源的子卡在看板底行显示「由总管创建」芯片（判定位 = wire `sourceBuildId`）。 |
| `B2-detail-source-panel.png` | 子卡详情页来源面板渲染「总管编排会话」链（`sourceKind='orchestration'` + `sourceRef=chief:<uuid>`）。 |
| `B3-link-back-chief-drawer.png` | 点来源链 → 开总管抽屉定位该编排会话（详情页链回编排回合）。 |
| `result.json` | 12/12 PASS。 |

### after result.json 逐条（12/12）

- `setup-team-user` / `setup-chief-bound` / `setup-task-created`：铺底（team/user/provider/agent/chief 绑定 + 建任务）。
- `A-no-choice-dialog`：点开始后 `.overlay-title` 计数 = 0（选择面已撤）。
- `A-toast-fired`：toast「已交给总管编排」可见。
- `A-chief-thread-created`：`POST /todos/:id/orchestrate` 建 chief 线程（title「开始任务 #1」）。
- `A-orchestrate-msg-verbatim`：编排消息含「编排请求」+ `(todo:<id>)` 实体引用 + 任务原文逐字片段（稳定锚点，r14 §5.2）。
- `A-chief-step-enqueued`：SQLite `step` 行 kind=chief / status=pending（无 daemon 恒 pending = 已入队待执行）。
- `B-subcard-source-landed`：SQLite 子卡 `sourceKind=orchestration` + `sourceRef=chief:<uuid>`。
- `B-board-chief-chip`：看板卡「由总管创建」芯片可见。
- `B-detail-source-panel`：详情来源面板「总管编排会话」链可见。
- `B-link-opens-chief-drawer`：点链开总管抽屉。

> 子卡来源字段（`sourceKind`/`sourceRef`）在本 probe 里以 SQLite seed 同形行验 UI 渲染；其**由 chief `create_todo` 自动落库**的真实路径由 server 单测 A1/C1 直证（chief relay → `orchestrationSourceRef(ctx.threadId)` 落库 + 严格互逆反解）。
