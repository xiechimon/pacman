# chief 派发方式（#903 / ADR 0013）

chief `run_builds` 派发的任务是否先出方案 = 团队级设置槽 `chief.dispatchWithPlan`
（boolean，默认 true 先规划）——选择权归用户、服务端强制（chief 工具面无 withPlan
参数，报文塞值不生效）。两面：chief 设置 Agent tab「派发方式」槽（live 写 =
PATCH /chief dispatchWithPlan 槽，行形态沿机器槽的 listbox 族）；claim 载荷的合成
systemPrompt 派发模式行（按设置合成，写死的 withPlan:false 措辞已退役）。server 侧
失败方式钉在 `apps/server/test/chief.test.ts`（#903 四测：默认走 plan / 设置 false 走
build / 报文 clamp / PATCH 槽往返）与 `orchestration-source.test.ts` B1；fixture 面钉在
`apps/web/e2e/chief-settings.spec.ts`（#903 五测）。

## Sub-features

- `settings-dispatch-slot` — 设置 Agent tab「派发方式」行：`button[aria-label="派发方式"]`
  开 popover（`[role="dialog"][aria-label="派发方式"]`，两行固定无搜索，行 =
  `[data-testid="chief-dispatch-row"]`）；缺省回显「先规划」（ADR 0013 D2 默认档）；
  选定 = PATCH chief dispatchWithPlan 槽 → invalidateAll 重取回显（无本地乐观态）。
  aria-label 独立命名（派发方式 vs 机器 vs 压缩模型）——e2e strict mode 钉单元素。
- `prompt-mode-line` — claim 载荷 `chief.systemPrompt` 的「- 派发模式（团队设置，
  服务端强制）：先规划/直接执行…」行按设置合成；全文不再出现 `withPlan:false`
  （#892 实证病灶的提示词半）。
- `tool-def-clamp` — claim 载荷 remoteTools 的 `run_builds` 定义 properties =
  `[todoIds, assignment, machineId]`（withPlan 参数除名，51 词表其余不动）；relay
  报文塞 withPlan 被忽略，响应 `withPlan` 字段回报生效值。
- `dispatch-effect` — 生效值落库面：`build.withPlan` + 首步 `step.kind`（plan 档 =
  plan 步停 confirm 闸；直执行档 = build 步）。

## How to get to it (user POV)

- 抽屉齿轮 → 总管设置 → Agent tab「派发方式」槽选「先规划」/「直接执行」。
- 看板「开始」→ 编排回合 → chief 派发按设置走（plan 档停确认闸等批准）。

## Driving it with drive-903-dispatch-mode.mjs

Preconditions: `launch.mjs` 已起隔离栈（全新库）；proxy env 全 unset。

- 一键全链（14 条断言）：`env -u http_proxy -u https_proxy -u all_proxy
  VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/drive-903-dispatch-mode.mjs`
  → 控制台 PASS/FAIL + `evidence:<目录>`（result.json + 4 截图 + 6 API/SQLite JSON）。
- 链路：设置面真用户路径默认档回显 → 选「直接执行」（PATCH 回读）→ 假机器 claim
  chief 步（取 systemPrompt 行 + 工具定义实物）→ relay run_builds 直派实证
  （build.withPlan=0 + 首步 build）→ 清道（build 步 done failed，别挡下一 claim）→
  翻回「先规划」→ relay 对抗性塞 withPlan:false → clamp 实证（生效值 true +
  build.withPlan=1 + 首步 plan）。
- 铺底全走公开 REST（provider + agent + PATCH chief 绑定 + project + 双 todo +
  api-key + machine enroll）；零 daemon 零 LLM，chief 回合数据面与真机器同形
  （drive-agent-identity 铺底律）。

## Gotchas

- claim 响应双层包装 `{step:{step:{…}, chief, remoteTools}}`（machine-wire 律）；
  chief 步判别 = `step.kind === 'chief'`，领到 worker 步即顺序错（清道步要先收）。
- relay 端点 body = `{name, params}`（不是 `{arguments}`），响应 = `{text}`（JSON 串，
  需再 parse）——`routes-machine.ts` 的 relay 形与 transcript delta/activity/row 三形
  同径分流，判别靠 params/id/kind 键位。
- 直执行腿的 build 步是 pending worker 步，不清道会被 E2 的 claim 领走（FIFO 按
  createdAt）——probe 内 claim + done failed 收道，别省。
- 设置面回显等真值落定（invalidateAll 重取，无本地乐观态）：`dispatchChip.filter({
  hasText: label }).waitFor()`，别用 waitTimeout 猜。
