# #903 verify 证据索引 — chief 派发方式选择权（ADR 0013）

probe = `.claude/skills/verify-pacman/scripts/drive-903-dispatch-mode.mjs`（纯 live 栈，零
daemon 零 LLM：假机器经真 machine wire 认领 chief 回合步 + relay `run_builds`）。
栈坐标 = server 8795 / web 5277 / 独立 PACMAN_HOME scratch（全新库，seed 用户 Owner）。
复跑配方：`launch.mjs`（换端口 env 覆写）→ 本 probe → `cleanup.mjs`。

结果：**14/14 PASS**（`result.json` 的 checks 逐条对齐，不写约数）。

## 证据与判读

| 文件 | 判读 |
|---|---|
| `01-settings-dispatch-default-plan.png` | 设置 Agent tab「派发方式」行在位，缺省回显「先规划」（ADR 0013 D2 默认档） |
| `02-dispatch-menu-plan-selected.png` | popover 两行 listbox：先规划（选中 Check）/ 直接执行 |
| `03-settings-dispatch-direct.png` | 真用户路径选「直接执行」→ chip 回显翻（live PATCH → invalidateAll 重取） |
| `04-settings-dispatch-back-to-plan.png` | 翻回「先规划」→ chip 回显（第二写） |
| `chief-envelope-direct.json` / `chief-envelope-plan.json` | GET /chief 回读：`chief.dispatchWithPlan` false / true（回读确认律） |
| `claim-direct.json` | claim 载荷两样运行时实物：合成 systemPrompt 的派发模式行 = 「直接执行」且全文无 `withPlan:false`（D4）；`run_builds` 工具定义 properties = `[todoIds, assignment, machineId]`——withPlan 参数已除名（D3） |
| `relay-direct.json` | relay `run_builds`（不带 withPlan 参数）→ 响应生效值 `withPlan:false` + `triggerSource:"chief"`；SQLite `build.withPlan=0` + 首步 `step.kind="build"`（直执行档实证） |
| `claim-plan.json` | 翻回先规划后 claim：systemPrompt 派发模式行 = 「先规划」 |
| `relay-plan-clamp.json` | **clamp 实证**：relay 报文对抗性塞 `withPlan:false` → 响应生效值仍 `withPlan:true`；SQLite `build.withPlan=1` + 首步 `step.kind="plan"`（按配置走 plan，编排者推翻不了设置） |
| `result.json` | 14 checks 全 ok + 栈坐标 + 实体 id（team/project/agent/双 todo） |

## 与票面验收的对账

- 「选择权可配置且默认值有理由」→ U1/U3/U4 + A1/A2（设置面 + PATCH/GET 往返）；理由正本 = `docs/adr/0013-chief派发方式-选择权归人-服务端强制.md` D2。
- 「改后 chief 派发按配置走 plan」→ E1（false 档走 build 步）+ E2（true 档走 plan 步）双档 SQLite 行级实证。
- 「编排者不得单方撤销」→ E2b 对抗腿（报文塞 withPlan:false 不生效）。

fixture 面（设置行回显/清单/accept 律/互扰负向）由 `apps/web/e2e/chief-settings.spec.ts`
的 #903 五测钉住（28/28 PASS，含全量回落 818/818）；本目录只管 live 真机面。
