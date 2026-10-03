# #707 证据索引：模型源随执行机走

## 结论

`GET /api/teams/:id/model-sources` 的 claude-code 段不再是 server 本机
`~/.claude/settings.json` 的直读，而是各执行机 daemon 上报的本机解析结果
（presence 30s 节拍 + enroll 即带），server 按机器聚合（pi 首段 + 按机器名
排序的 claude-code 段）。pi 段、选择器并集语义、单机等价面不变。

## 证据

- `probe-providers-tabs/`：更新后的 `drive-providers-tabs.mjs` 全链（21/21
  PASS，`result.json`）：空库 launch → 公开 machine wire 自铺底一台上报过的
  执行机（`verify-exec-1`）→ UI=API=上报值三方一致。关键行：
  `model-sources-per-machine`（`[pi@xmonsMac-3574.local,
  claude-code@verify-exec-1]`）、`executor-following`（段含上报模型）、
  `cc-header-card`（header 卡「已安装在 verify-exec-1」）、
  `cc-model-rows-consistency`（UI=1 vs API=1）。
- `model-sources-multi-executor.json`：真 daemon 双机场景的封套实物——
  两台同箱 daemon（`HOME` 隔离，`exec-a` 有 settings、`exec-b` 无）：
  `exec-a` 段 `installed:true`（`exec-model-a2` + `exec-sonnet-a2`，F4 改配置
  重启后即刷新）、`exec-b` 段 `installed:false`（F3），另含 probe 铺底的
  `verify-exec-1` 段（F2 三机并存，各段 hostname 如实）。
- `machine-rows.json`：同场景 SQLite `machine` 行实物——`claudeCodeReport`
  列存上报原文；server 启动 seed 的本机行 `claudeCodeReport: null`（从未
  上报的机器缺席，F6，不下发假清单）。
- `cc-tab-multi-executor.png`：providers 页 Claude Code tab 三机分段截图
  （两张「已安装在…」+ 一张「未安装」指引态，F7）。
- 单机回归：`apps/web e2e`（`providers-tabs`、`agent-create-model`、
  `machines-local`、`chief-settings`、`chief-drawer-model`、
  `provider-add-dialog`、`provider-oauth`）63 条全绿；server 单测
  `model-sources` 10 条（含 F1/F2/F3/F6/presence 更新/enroll 即带）、
  `chief` 39 条、`machine-*` 43 条、`schema`  pinned 迁移干净应用；
  shared `model-source` 5 条 + 快照（两处新增可选位，零删除）；
  daemon `claude-code-models` 3 条 + `machine-loop` 24 条；
  web vitest 339 条（含 i18n-coverage）；`pnpm -r typecheck` 全绿。

## 失败方式对照（票面 5 条 → 本票 F1–F8）

- F1 显示控制面主机配置：probe `executor-following` + 实机 `exec-a` 段——
  server 箱真实 `~/.claude` 从未被读（`providers.ts` 已删 `fs` 读路径）。
- F2 多机语义：按机器分段（设计决定，见 spec 11 A4 修订），单机等价。
- F3 无 claude-code：`exec-b` → `installed:false` 段在、models 空。
- F4 上报膨胀/陈旧：presence 体小 payload、30s 节奏、无新增长连接；
  改配置重启即刷新（`exec-model-a2` 实物）。
- F5 测试桩兼容：`homeDir` 注入位已删（chief/models 工具改由 machine 行
  播种），`claudeHomeDir` 缝全链摘除（server context/routes/tests）。
- F6 旧 daemon：seed 本机行 `null` 缺席，封套仍合法。
- F7 web 单段假设：`providers-page` 按段渲染 + 零段空态（新文案已同步
  `en.ts`，i18n-coverage 绿）。
- F8 migration：`0024` 新增可空列，存量行 `null`，无需回填（合并期若 main
  尾部前移则重编序号）。

## 说明

- 本机 lint 红在 `integration/eval/chief-dispatch/build-report-lite.mts`
 （存量，`#439` 落地即带，本分支未碰；改动文件 biome 全绿）。
- 全量 e2e 归 CI（4 分片）；`en.ts` 改动触发 `e2e:affected` 全量回退口径，
  本地按分层纪律只跑受影响面。
