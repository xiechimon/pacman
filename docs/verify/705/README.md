# #705 复验记录 — 门页放行后 SSE 活性（B-C3）

**结论：B-C3 断裂在当前 main（`0a1069fd`，2026-10-03）不可复现。**
三轮独立探针各 11/11 PASS：门页放行后首个页面生命周期内，服务端步失败 →
详情 chip「规划中」→「失败」页内实时翻（零 reload），延迟 26ms / 33ms / 68ms；
`token-gate.spec.ts` e2e 4/4 通过（三连跑全绿）。按票面出口以本证据关票。

## 复验条件

- **部署形态与 #519 观测一致**：同源生产形——server（`apps/server`，tsx 直跑）
  托管 `apps/web/dist`（`vite build --mode fixture`，live 面 = URL 不带
  `?scenario=`），`PACMAN_TOKEN` 设 = 鉴权开。非 vite dev 代理形。
- **隔离**：OS 分配空闲端口、`mkdtemp` scratch `PACMAN_HOME`、空
  `PACMAN_SKILLS_DIR`；全新 Playwright browser context = 清 storage 首访。
- **触发事件与 B-C3 同款**：真实机器面回写步失败——探针以裸 HTTP 扮机器
  （enroll → claim → `POST /api/machine/done/{stepId}` `{status:"failed"}`），
  服务端走 `finishStep` 正缝（publishStepStatus + setTodoPhase('failed')），
  事件经 team/conv 两条 SSE 流下发，无任何测试专用旁路。
- **场景时间线**（与 #519 叙述逐点对齐）：seed（agent/hosted 项目/todo）→
  开 build（withPlan）→ 机器 claim（phase → planning）→ 浏览器清 storage 首访
  `/app` → 401 落门页 → 输 token 放行 → 看板 → 点卡进详情（chip=规划中，
  全程零 reload）→ 服务端步失败 → 断言 chip 页内实时翻「失败」。

## 复现步骤

```sh
# worktree 根（依赖已装、代理 env 剥除——本机代理会打回环 502）
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  node docs/verify/705/probe-705-gate-sse.mjs
# 自包含：自建 dist（缺则 build）、自起隔离栈、自 seed、自扮机器、自清理。
# 证据落 .claude/verify-evidence/<ts>-probe-705-gate-sse/（本目录 run-1/2 即其拷贝）。
```

## 结果（run-1 / run-2 / run-3 一致）

11 项 checks 全 PASS（逐条明细 + 完整时间线 + EventSource 构造日志 +
网络侧 stream 日志见各 run 的 `result.json`）。run-3 = 归档后从
`docs/verify/705/` 落点原样重跑，证明仓内副本可独立复现：

| 观测点 | run-1 | run-2 | run-3 |
|---|---|---|---|
| 门页期 EventSource 构造数（#519「启动即建流」形态） | 0 | 0 | 0 |
| 放行后 team stream 以 `?token=` 建流 | 是 | 是 | 是 |
| 进详情后 conversation stream 以 `?token=` 建流 | 是 | 是 | 是 |
| 不带 token 的裸 stream 构造 | 0 | 0 | 0 |
| 步失败 → chip 页内翻「失败」延迟（零 reload） | 26ms | 33ms | 68ms |
| failed 相位「重跑」主按钮出现 | 是 | 是 | 是 |
| SQLite 真值 todo.phase / step.status / build.errorMessage | failed / failed / 落库 | 同 | 同 |

零 reload 证明：放行后写 `window.__probeAlive` 标记，chip 翻面后回读仍在
（任何整页重载都会丢它）；EventSource 构造日志由 addInitScript patch 记录，
重载会清空该日志——两路互证。截图序：`01-gate.png`（门页）→
`02-board-after-pass.png`（放行后看板，卡在飞列）→ `03-detail-planning.png`
（chip=规划中）→ `04-detail-failed-flipped.png`（chip=失败，同一页面生命周期）。

## 为什么不复现：机制对照

#519 B-C3 的归因假设是「SPA 启动即建 SSE → 401 → 不重试；门页放行后不重连」。
该形态精确匹配 **#253（2026-09-25，`b9aa99e0`）之前的代码行为**。当前 main 上
三层机制使其结构性不可能，本次复验逐层实测钉住：

1. **建流卫兵（#253）**：`apps/web/src/api/sse.ts` 两条流 hook 均挂
   `auth.gateOpen` 卫兵——门页开着不建流（实测门页期构造数 = 0），放行时
   `passGate` 换 `AuthSnapshot` 引用 → hook effect 重跑 → `streamUrl()` 读到
   新 token 以 `?token=` 建流（实测两条流均带 token、无裸流）。
2. **401 fatal 的恢复流**：HTTP 级失败（含 401）= EventSource fatal CLOSED
   不自动重连——这是浏览器语义，不是缺陷；恢复路径单缝 = REST 401 →
   `demandGate`（清坏 token + 开门页）→ `passGate` → effect 重跑重建。
   `sse-connection.ts` 的看门狗显式不接管 fatal CLOSED，保持该语义。
3. **连接看护（#462 / #559）**：重连 resync 全量失效重取、20s 完全静默
   看门狗、业务帧静默对账 + seq 空洞对账——即使流在放行后因网络级断线
   重建，断线窗口丢失的相位边沿也会被 resync/对账补成查询失效重取。

#519 的观测（2026-10-02）标注「当时部署形态」；其部署代码版本未经考证，
但断口形态与 pre-#253 代码一致、与当前 main 三层机制均矛盾。若 #709 真闭环
复验再遇「相位不翻」，应按 #559 的对账判据先取证（业务帧静默 or seq 空洞
or 流压根没建），不要直接归因回 B-C3——本票钉死的正是「流没建/不重连」这一
种死法在当前 main 不存在。

## 索引

- `probe-705-gate-sse.mjs` — 自包含复验探针（正本；本目录内即可重跑）
- `run-1/`、`run-2/`、`run-3/` — 三轮探针证据（result.json + 4 截图 + server.log）
- `token-gate-e2e.txt` — `apps/web` e2e `token-gate.spec.ts` 4/4 通过日志
  （E2E_PORT=8421，含「放行后 SSE 以 ?token= 建流」的既有钉扎）
