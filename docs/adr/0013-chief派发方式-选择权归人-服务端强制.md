# ADR 0013 · chief 派发方式（先规划/直接执行）：选择权归用户，服务端强制

> 状态：**已裁决**（2026-10-08）。落地票 #903（依据 = `docs/research/892-gate-usage-measurement.md` §6 建议 4）。
> 来源：#892 量闸实测——chief 派发 8/8 全部直执行，withPlan 的选择权从未在用户手里；「直执行」被写死在工具默认值 + 系统提示词两处，成为编排者的单方行为。

## Problem Statement

pacman 的产品主张是两道硬闸（方案确认 confirm + 合并审阅 review，`docs/spec/18-定位与差异化.md`）。但主派发路径（看板「开始」→ orchestrate → chief `run_builds`）上，confirm 闸 100% 被绕过：`run_builds` 工具默认 `withPlan:false`，系统提示词工作约定又明令「withPlan:false 直接执行」。若两道闸是产品主张，编排者不应在每次派发上单方面撤销其中一道——而用户没有任何入口能表达「我要先看到方案」。

## 侦察事实

| # | 事实 | 出处 |
|---|---|---|
| F1 | 8/8 chief 派发 build 全部 withPlan=0；chief_message 里 10 次 `run_builds` 派发 = 9 次显式 false + 1 次缺省（工具默认亦 false） | `docs/research/892-gate-usage-measurement.md` §3 / §4.1 路径 A |
| F2 | user 侧首发 18 次里 17 次选带方案（94%）——但那是 #640 前的旧入口；#640 后开始按钮唯一入口 = orchestrate，选 withPlan 的是 chief 的 LLM | 同上 §3；`apps/server/src/routes.ts` orchestrate 注释 |
| F3 | 写死点两处联动：工具默认（`bool(params,'withPlan',false)`）+ 系统提示词工作约定行（「withPlan:false 直接执行」） | 改前 `chief-tools.ts:673`、`chief.ts` 工作约定节 |
| F4 | #640 用户前置裁决：开始入口不再给「先做规划/立即执行」选择，编排为唯一默认路径 | `routes.ts` orchestrate 路由注释 |
| F5 | spec 21（T4 主力机）裁决模式：「约束由人设定、由人解除，系统不猜」；chief 级设置槽（`chief.machineId`）+ settings Agent tab 决策面 + 存量行不回填的迁移纪律均有先例 | `docs/spec/21-单机编排默认策略.md` A1/A2/A7/A9/N6 |
| F6 | plan 表 0 行——版本化方案文档通道在观测窗内零真实样本（通道质量归 #892 §6 建议 5 的票；本 ADR 只裁选择权归属，不预设通道好坏） | 同 F1 出处 §5 |
| F7 | chief 工具面之外同族面有三：MCP `run_builds`（外部客户端，自带 per-key 授权模型）、定时重跑（scheduler withPlan:false 写死 + cancelGateBuild 顶替闸上停驻）、失败重启继承（restart 继承原轮 withPlan） | 同 F1 出处 附录 B #3/#4/#18 |

## Decision

| ID | 裁决 | 理由 |
|---|---|---|
| **D1** | 选择权落 **chief 级结构化设置槽** `chief.dispatchWithPlan`（boolean，每「用户×团队」一份），不落 charter 自由文本 | 自由文本只能建议 LLM、无法强制；结构化槽才有服务端强制（D3 的保证来自这里）。票面「charter 加一档」落实为与章程同层的设置行（settings Agent tab，与绑定 Agent/模型/机器同决策面，spec 21 N6 同构） |
| **D2** | **默认 = true（先规划）**；存量行不回填（ALTER 的 DEFAULT true 即落） | ① 两道硬闸是产品主张（spec 18），缺省面不应单方撤销 confirm 闸——#892 的 8/8 病灶正是「默认即撤闸」；② 用户数据：首发面 94% 选带方案（F2）；③ spec 21 同源裁决模式：最保守的闸语义做默认，解除归用户（F5） |
| **D3** | **服务端强制（clamp）**：`run_builds` 工具面移除 withPlan 参数（51 词表其余不动），生效值 = 设置槽；报文塞值不生效，响应回报生效值 | 票面验收「chief 派发按配置走 plan」要的是保证不是倾向——只要工具面还收参数，LLM 就保留单方撤销权，而 F1 实证它 100% 会用 |
| **D4** | 系统提示词的派发模式行**按设置合成**，写死的 withPlan:false 措辞退役 | 提示词描述必须与实际行为一致，否则 chief 会向用户复述不存在的策略 |
| **D5** | 用户界面 = settings Agent tab「派发方式」行（两档 listbox，机器槽同构）；live 选定 = PATCH `/chief` `dispatchWithPlan` 槽（第六槽：undefined = 不动；二值无 null 形——默认档即 true，清回默认 = 显式写 true） | #895 机器槽同构：无本地乐观态，invalidateAll 重取回显；决策面同层（N6） |
| **D6** | 同族三面（MCP `run_builds` / 定时重跑 / 失败重启继承）**不动**，各归其票 | 本票病灶 = chief 派发面（票面明示 `chief*.ts` 一带）。MCP 面是外部客户端授权模型；scheduler 面在 #892 §4.2 路径 E 已单独登记为高危面；跨面一把抓会把验收面扩到不可证 |
| **D7** | orchestrate 入口**不加** per-request withPlan 透传 | 见备选表 |

## 与 T4（spec 21 主力机策略）的关系

同一决策模式，不同轴，互不触碰：

- **同**：都是 chief 级用户设置槽（每「用户×团队」一份）；都遵循「约束由人设定、由人解除，系统不猜」；决策面同在 settings Agent tab 同层（N6）；迁移纪律同（存量行不回填）。
- **异**：主力机管「chief 回合/派发在哪台机器执行」（执行位）；派发方式管「派发的任务是否经方案确认闸」（闸语义）。
- **正交**：spec 21 A9 约定主力机不动章程通道；对称地，本槽不动任何钉选语义（`run_builds` 的 machineId 缺省链原样）。

## 备选方案与否决理由

| 方案 | 否决理由 |
|---|---|
| orchestrate 请求带显式 withPlan 透传（票面「或」的另一支） | 与 #640 用户前置裁决（F4：入口不再给「先做规划/立即执行」选择）正面冲突；且 per-request 选择不沉淀——每次派发都要重选一次，闸语义本应是团队级常设决策。设置槽一次设定长期生效 |
| charter 自由文本写「派发走 plan」 | 只能建议 LLM、不可强制——验收「按配置走 plan」退化成「大概会走 plan」；charter 是用户手写面，缺省行为不能依赖用户写没写章程 |
| 保留工具参数、默认值 = 设置（LLM 保留 override 权） | F1 实证 LLM 会 100% 按提示词明令使用手里有的参数；保留参数 = 保留单方撤销面，D3 的保证不成立 |
| 默认 = false（维持现状直执行） | 产品主张（两道硬闸）在主派发路径上默认关闭 = 自家差异化不出厂；「不惊动存量」不成立——本仓唯一部署的用户就是 #903 的提出者，#892 实测已把现状定性为病灶 |

## Premortem（假设已失败，最可能死因 + 护栏）

| 死因 | 护栏 |
|---|---|
| 默认先规划让无人值守派发的任务停在 confirm 闸久候（#892 §5：confirm dwell 曾达数天） | 这是闸语义的**预期行为**（人强制在场）而非事故；解除 = 设置行一键切「直接执行」（D5）；停驻期间 gate wake 照常通知 chief、notification 行照常进铃铛 |
| plan 通道脆弱（F6：plan 表 0 行）让默认面卡死 | #703 已有「两轮无 plan.md 不进 confirm」闸；通道质量归 #892 建议 5 的票。选择权归属与通道质量是两个独立面，互不阻塞 |
| 老会话/旧习惯的 LLM 仍发 withPlan 参数 | clamp = 参数被忽略（chief 工具面本就宽容读参）；工具 description 与提示词派发模式行都明说「不是调用时选择」；响应回报生效值供 LLM 自纠 |
| 存量部署升级后行为突变（派发全停确认闸）用户困惑 | 设置行带描述文案（D5）；本 ADR + #903 即 release note；单一用户部署，切换成本 = 一次点选 |

## 回读校验

本 ADR 的设置槽是库内行（chief 表列），不是服务端快照式配置记录。回读面 = 实测证据链 `docs/verify/903/`：PATCH 写 → GET 回读 → chief relay 派发 → `build.withPlan` / 首步 `step.kind` 落库行，两档设置各取一组实物。
