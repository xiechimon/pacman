# #811 总管设置页四连 bug——live 真机验证

四条现象同一 live 路径复现（board `总管` → `总管设置`），逐条钉死后修。

## 复现条件（before/after 两栈一致）

全新库（launch 即清空重建，seed 用户 Owner）+ 同一份探针数据：

- Agent `复现探针`（`avatarUrl` = dicebear bottts seed=probe）绑定为 Chief Agent
- 该 Agent 名下 1 条记忆（`探针记忆 / 偏好深色主题`）
- chief 行 1 条 watch（`给总管演示的跟进任务 / 演示主题`）+ 1 条 wake（`到点回头核实演示任务`）

| 栈 | 代码 | server | web |
| --- | --- | --- | --- |
| before | `origin/main` @ `22804a83`（一次性 worktree，已回收） | 127.0.0.1:8792 | 127.0.0.1:5274 |
| after | 本分支 | 127.0.0.1:8791 | 127.0.0.1:5273 |

入口均为 `/app?chief=settings`（board 深链）。

## 四条：现象 → 改法 → 证据

1. 返回钮死：`.chief-set-title` 全宽绝对定位覆盖层盖住返回钮，
   Playwright 点选超时（`h1.chief-set-title intercepts pointer events`）。
   改法：标题 `pointer-events: none`（纯文本，无命中测试需求；布局/绘制零变化）。
   证据：`before/before-back-settings.png`（设置面）→ `after/after-back.png`
   （点返回后总管抽屉打开）；e2e 回归 `chief-settings.spec.ts` 新增
   `返回按钮可用：点击回到总管抽屉 (#811)`。
2. 头像不同步：已绑定行只渲染名字首字，丢弃封套自带的
   `agentActor.avatarUrl`（dialog 候选行与 FAB 都在用同一字段）。
   改法：非空时走 `SeededAvatar`（XMON-105 `--img` 律，图即 24 圆盘）；
   为空沿用首字，面不变。
   证据：`before/before-agent.png`（首字`复`）→ `after/after-agent.png`（头像图）。
3. 记忆页误报未选：memory tab 无条件静态文案，已绑定也显示`尚未选择`。
   改法：判据与 Agent 面同源（`boundAgent`）；已绑定读 `useMemories`
  （agent-detail 同源 hook），配额头 `记忆 · n / 100` + 只读列表，
   空集走 shared canon `MEMORY_EMPTY_COPY`；未绑定文案不动。
   证据：`before/before-memory.png`（尚未选择）→ `after/after-memory.png`
   （`记忆 · 1 / 100` + 探针记忆行）。
4. 关注与提醒未闭环：`GET chief` 封套回 `watches`/`wakes` 非空，
   tab 恒显示`暂无跟进事项`——有数据、无显示、无取关入口。
   改法：live 面渲染封套 `watches`（标题 + 主题）与 `wakes`
  （备注 + 到点时间）；双空沿用原空态文案。手动取关无服务端
   mutation（`PATCH chief` 可写槽只有 agent/charter/compactionModel/model；
   watch 由派工自动建、settle/failed 后自动解），故本面只读。
   证据：`before/before-watches.png`（暂无）→ `after/after-watches.png`
   （1 watch 卡 + 1 wake 卡）。

## 回归

- `pnpm lint`（所改三文件 clean；`integration/eval/chief-dispatch` 的
  `useTemplate` 存量告警未动）、`pnpm format`、`pnpm typecheck` 全绿。
- web e2e 全量 746 passed（含新增 #811 用例），`test-results` 未进仓。
- i18n coverage 28 passed（新增 `到点提醒` en 对条）。
