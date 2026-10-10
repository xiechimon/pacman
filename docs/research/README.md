# docs/research/

按票归档的调研笔记。写完归档，不再维护；可当史料引用，不当现行规范读（正本见 `docs/README.md`）。本目录不受 ADR 0015 约束（那只管 `docs/verify/`），但 `素材替换计划.md` D4(a) 把 `assets/` 钉为研究证据永久保留、D4(b) 禁止产品面引用。

体积构成（2026-10-10 实测）：顶层笔记 33 篇共 ~1M；`assets/` ~35M（470 张 PNG + 36 JSON + 18 TXT + 12 MD + 5 GIF）。按 R 系列快照编号引用截图（`assets/r7/` = 1440×732 权威像素基线，编号 01–54；`assets/r8/` 续 54+）。

## 索引

### 像素复刻基线（todos.dev 复刻期，2026-09-18 起）

| 笔记 | 素材 | 内容 |
|---|---|---|
| [r1-site-inventory.md](r1-site-inventory.md) | `assets/r1/` | todos.dev 公开站全量盘点：页面/文案/token/PWA/定价边界；抓了 CSS、icons dump、llms-full.txt（304K 文档全文，查「后来改成了什么口径」最快）、i18n 四语对照 |
| [r2-app-ui-inventory.md](r2-app-ui-inventory.md) | `assets/r2/`（63 张） | 登录后 workspace UI 全量盘点——像素级复刻的主素材正典 |
| [r3-protocol-executor.md](r3-protocol-executor.md) | `assets/r3/`（52 张） | 对外协议面与 executor 行为黑盒观察：API/SSE 词表、MCP、CLI、BYOK |
| [r4-foundation.md](r4-foundation.md) | — | 地基选型对比：craft-agents-oss / pi SDK / Claude Agent SDK / 全自研（部分结论引用已归档的 r9-pi-sdk.md，见 git 历史 `cae19acf`） |
| [r5-chief-behavior.md](r5-chief-behavior.md) | `assets/r5/`（Chief 批 36 张 + raw 抓包） | Chief 黑盒行为：策略层/驳回回路/双 Agent/memory/通知矩阵/设置齿轮；`raw/chief-threads-testA.json` 是 chief-tools 快照测试的加载源 |
| [r5-icons.md](r5-icons.md) | `assets/r5/`（icons.json） | workspace 内联 SVG 图标 DOM dump；⚠️ 位图作废以 r7 为准 |
| [r5b-lifecycle-states.md](r5b-lifecycle-states.md) | `assets/r5b/`（25 张） | 生命周期深层状态补拍（r3 右缘缺口重拍） |
| [r6-rebaseline.md](r6-rebaseline.md) | `assets/r6/`（icons.json） | 站点漂移第三数据点；⚠️ 位图作废以 r7 为准；icons.json 仍被 `scripts/generate-icons.mjs` 作构建期输入 |
| [r7-rebaseline.md](r7-rebaseline.md) | `assets/r7/`（54 张 1440×732 + icons.json） | **权威像素基线**——r5/r6 位图作废后的全量重拍；icons.json 是图标生成正源，`apps/web/test/pwa.test.ts` 加载 r1 的 manifest/sw.js 对拍 |
| [r8-chief-panel-adhoc.md](r8-chief-panel-adhoc.md) | — | Chief 面板随拍记录与缺口登记（#72 施工期） |
| [r8-dynamic-states.md](r8-dynamic-states.md) | `assets/r8/`（77 文件 + raw 几何 JSON） | 动态面像素基线集中补拍：驳回回路/失败态/复用方案/运行历史/AI 审核 |
| [r8-resources-static.md](r8-resources-static.md) | `assets/r8/`（drift-skills 等） | 资源面静态随拍（#69 路由批内置补拍动作） |
| [r9-attachments-mentions.md](r9-attachments-mentions.md) | `assets/r9/`（30 张） | 附件/提及交互规格补采 + 停止钮/标签/菜单全站扫描；spec 08 的「r9 §3.x」都指这份 |
| [素材替换计划（spec）](../spec/素材替换计划.md) | `assets/`（全部） | D4(a)：`assets/` = 研究证据永久保留，不入替换清单；D4(b)：产品面禁引（唯一现存构建期例外 = generate-icons.mjs） |

### Multica / runtime 调研（2026-09-29 起）

| 笔记 | 素材 | 内容 |
|---|---|---|
| [r10-multica-runtime.md](r10-multica-runtime.md) | — | Multica runtime 模型全解：定义/发现/协议族/运行/凭据/profile/权限（源码级 467 行） |
| [r11-runtime-gap.md](r11-runtime-gap.md) | — | pacman ↔ Multica runtime 能力差距清单 G1–G25 |
| [r12-save-and-start-behavior.md](r12-save-and-start-behavior.md) | — | 「保存并开始」后 agent 行为：直接执行 vs 先后台编排（决策材料） |
| [r13-multica-runtime-verify.md](r13-multica-runtime-verify.md) | — | r10 的 fresh-clone 复核（HEAD `2ea01ae`）；行号以该 clone 为准；spec 17 的行号正本 |
| [r14-orchestration-parent-card.md](r14-orchestration-parent-card.md) | `assets/r14/`（9 张 + raw/ 12 篇抓取） | 编排拆分的父卡去留：三路取证与建议（XMON-98 拍板点 1） |
| [r15-multica-run-rendering.md](r15-multica-run-rendering.md) | — | Multica run 过程呈现（UI 渲染 + 事件流）源码级事实；ADR 0011 的依据 |
| [machine-execution-plane.md](machine-execution-plane.md) | — | 「同一份代码放任意机器跑」全链路实现调研；spec 21 的依据（§4-7 会话本地性 = 正确性项） |
| [herdr-multica-parity.md](herdr-multica-parity.md) | — | herdr 本体能力面能不能长出 Multica 的效果（方法论调研） |

### 设计系统 / 前端工艺（2026-09-23 起）

| 笔记 | 素材 | 内容 |
|---|---|---|
| [412-token-mapping.md](412-token-mapping.md) | — | tokens.css 117 名 → shadcn 官方语义词表机械取数与初稿；`apps/web/src/styles/tokens.css` 头注释指向本文件 |
| [430-baseui-dialog-contract.md](430-baseui-dialog-contract.md) | — | 弹层行为契约对照（Base UI 代数），#418 radix 版的重查稿 |
| [644-motion-shadcn-prototype.md](644-motion-shadcn-prototype.md) | `assets/644/`（原型 HTML + GIF） | 全站动效迁移 shadcn 原型与取舍；已裁决，正本 = ADR 0009 |
| [base-ui-coverage-map.md](base-ui-coverage-map.md) | — | pacman × Base UI 覆盖地图：手搓面账本、逐面代价与批次日次（基线 `633afa37`） |

### 定位 / 评测 / 方法论

| 笔记 | 素材 | 内容 |
|---|---|---|
| [892-gate-usage-measurement.md](892-gate-usage-measurement.md) | — | 量闸实测：withPlan 分布、闸被跳过的路径全枚举；ADR 0014 与 spec 18 §5 的依据 |
| [amp-native-sandbox-orb.md](amp-native-sandbox-orb.md) | — | Amp 原生机器执行模型、沙箱设计、Orbs；permission-rules 的哲学出处 |
| [eval-methods.md](eval-methods.md) | — | agent / LLM 评测方法论与市面做法（含 pi 评测面近读） |
| [m7-w5-ai-review-slice.md](m7-w5-ai-review-slice.md) | — | M7-W5.1（#312）切片裁定 + Grill + Premortem |
| [migration-surface.md](migration-surface.md) | — | #409 迁移面盘点报告（附录 A/B：46+3 个 spec 的逐文件选择子全表）；spec 16 验收的底账 |
| [xmon48-filter-panel-closure.md](xmon48-filter-panel-closure.md) | — | XMON-48 工作台筛选交互调研收尾与决策材料 |
| [r15-agent-responsibility-default.md](r15-agent-responsibility-default.md) | — | 首个 Agent 的「职责」默认值：七生态源码取证与取舍（t-0198，与 r15-multica-run-rendering 同号不同票，各自成篇） |

### 施工随拍（pre-ADR-0015 时代，2026-09-24 前后）

| 目录 | 对应 PR | 内容 |
|---|---|---|
| `assets/issue-128/` | #131 | 侧栏视觉三件 before/after（PR body 内嵌相对链接） |
| `assets/issue-137/` | #142 | 搜索交互修复 before/after |
| `assets/issue-138/` | #145 | 分段控件族修 before/after |
| `assets/issue-139/` | #144 | 边框体系统一 before/after |
| `assets/issue-146/` | #158 | 总管面板收尾 before/after |
| `assets/issue-147/` | #156 | 折叠族接线 before/after |
| `assets/issue-148/` | #157 | account/team local-first 净化 before/after |
| `assets/issue-149/` | #162 | 零散死钮处置 before/after |
| `assets/issue-159/` | #164 | 搜索结果行修复 before/after（PR body 钉分支 raw 链） |
| `assets/issue-160/` | #166 | 看板拖拽解封 before/after |
| `assets/issue-161/` | #167 | 卡片阴影/边框统一 before/after |
| `assets/issue-163/` | #165 | 用户菜单两件 before/after |

这批目录是 ADR 0015 之前 `docs/verify/` 惯例尚未建立时的证据落点：12 张 PR body 都引用各自目录，其中 #131/#164/#166/#167 嵌的相对或分支 raw 链依赖分支存活与目录路径不变。**保持原位，不清理**。

## 已知断链（现状记录，不在本索引修复）

- `docs/spec/00-地基决议.md` 与本目录 `r4-foundation.md` 引用的 `r9-pi-sdk.md` 已于 `cae19acf`（2026-09-19，pre-复刻时代的旧 r 系列 10 篇整体归档）删除，仅存 git 历史。现行 r9 = `r9-attachments-mentions.md`（另一票的产物），与被删的 r9-pi-sdk 无关。

## 引用约定

- 笔记内部互相引用普遍（r12→r10/r11/r5、ADR→r13/r15 等），文件名即锚点——**改名会打断 spec/ADR/笔记三层入链**。
- 截图编号跨批次续号（r7 起 54+，r8 续），`素材替换计划.md` §4 的 parity 门禁对拍基线指向 r7 批。
