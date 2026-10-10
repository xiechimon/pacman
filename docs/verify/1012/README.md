# #1012 sealed 封版证据（#980 地图终点票）

封版树 = 本 PR 分支（基线 main `e87186d3`，开工时与 origin/main 逐 sha 相同）。
本票是核账面不是施工面：树内改动仅三处注记（`ci.yml` 两条闸注释、
`ui-debt-gate.mjs` 头注释）+ 本证据目录，零行为改动。

## ⚠️ 封版状态：provisional（协调者指令，2026-10-09）

- **#1011（#883 model picker 再评）仍 OPEN，判定由并行车道 t-0261 测量中。**
  本票「子票全闭」结论**待 #1011 关闭后补**——本目录任何读数都不声称子票已全闭。
- **合并闸：#1011 关闭之前本 PR 不合并**（合并权在协调者）。
- **探针底片（`probe-sealed/`）先留档不定终态**：若 #1011 判定为
  「未自解 → 重切修复票」，修复落地会改渲染面，底片需在其后重切；
  是否重跑由协调者裁决。若判定为「自解」（零码改动），本底片即成终态。

## 目录

| 路径 | 内容 |
| --- | --- |
| `audit-sealed.sh` / `audit-sealed.txt` | 树内核账可复跑脚本（`bash docs/verify/1012/audit-sealed.sh`，rc=0 全过）+ 本次输出：五闸 PASS、账本终数、债基线地板、正典注记、闸裁决落 CI、手写壳退役面 |
| `e2e-full.log` | 全量 e2e 封版复跑原始日志：**862 passed / 0 failed（5.3m）**，E2E_PORT 8399（开跑前 lsof 核过无占用），树 `e87186d3` |
| `probe-sealed/` | **新底片（provisional）** = run-4 全量落档（`probe-comparison.md` + `probe-dump.json` + `probe-records.ndjson` + `probe-run.log`）——取代 `docs/verify/953/probe-sealed/` 成为后续三方 diff 基准（基准是约定不是代码指针：old-baseline 列取自 spec 内联期望值，换底片零代码改动） |
| `flake-attribution/` | 四轮探针运行的全部非绿读数归因档案（见下「运行账」） |
| `gates.txt` | 五闸单轮全量输出（registry / debt / drift / consumer-shape / dead-class，全 PASS rc=0） |

## 票面五项对账

### 1. 全量 e2e + 探针封版

**全量 e2e 本地一次全绿**：862/862（5.3m，`e2e-full.log`），与波 1 收口 862/862 同口径。

**探针封版 = run-4**（port 8400，树 `e87186d3`）：visual **894 行 — KEPT 894 / DRIFT 0 /
VIOLATION 0 / NOT-RUN 0**——底片只载 canonical 值，零 flake 值混入。tests 账面 861/1，
唯一红 = `provider-oauth.spec.ts:99`（`page.waitForLoadState` 30s 超时，负载 flake 签名），
该 spec 不贡献 visual 行（NOT-RUN 0 可证覆盖面完整），同树隔离重跑 **7/7 绿**
（`flake-attribution/rerun-provider-oauth.log`）。

四轮运行账（同一棵树，全部归因档案在 `flake-attribution/`）：

| 轮 | port | tests | visual rows | 处置 |
| --- | --- | --- | --- | --- |
| run-1 | 8397 | 861/1（page-scroll 5s 可见超时） | 891：KEPT 891 / 0 DRIFT / 0 VIOLATION / 0 NOT-RUN | 红已归因 flake（隔离重跑 5/5 绿 ×2）；产物被 run-2 覆写，仅存日志 + 汇总头 |
| run-2 | 8400 | 856/6（4× 30s 超时 + board-dnd 帧采样 + fs-pick 计数） | 894：892 KEPT / **1 DRIFT** | **作废**——被本线程自己的并发工作污染（spec:parse 的 tsc + playwright --list 与探针并跑），时长膨胀 7.7m→12.7m；产物存 `run2-contended/` 留归因 |
| run-3 | 8400 | 861/1（board-dnd:844 帧采样 t=8ms） | 894：893 KEPT / **1 DRIFT** | DRIFT 行 = 同一 board-dnd 断言，**harness 竞态非视觉漂移**（分析见下）；日志存 `run3/` |
| **run-4** | 8400 | 861/1（provider-oauth 负载超时，隔离 7/7 绿） | **894：KEPT 894 / 0 / 0 / 0** | **入档为新底片** |

**board-dnd:844 竞态分析（run-2/run-3 的唯一 DRIFT 源）**：该测试在 `mouse.up()` 之前
就把 rAF 帧采样器种进页面（`t0` = evaluate 时刻）。仪表化（probe preload 记录每次
evaluate）拉长 Playwright 客户端回程后，首个采样帧可以落在 mouse.up 派发**之前**——
t=8ms 的 `col:todo` 帧是「提交尚未发生」的前提交态，不是 #398 律要抓的「提交后闪回源列」。
判据：同树无仪表化全量 e2e 绿（862/0）、run-1 仪表化下也绿、失败帧恒为首帧（t≤11ms）。
产品面无回归。**跟进建议（归协调者裁决，不在本核账票夹带）**：给该 spec 的采样器加
「丢弃 mouse-up 派发前的帧」或改为 up 后种采样器；同族先例 = #398（同 spec 的
高负载 flake 票）。

### 2. hash 账本终审（#989 闸面）

`ui-registry-gate` PASS，**对账零漂移**（in-tree comparison，非刷新——本票未跑
`ui-registry-refresh.mjs`，账本零改动）：

- **终数 = 33 文件 = 26 registry（19 pristine / 7 registered deviations）+ 7 adapters**；
  vendored 快照 shadcn@4.21.3（2026-10-08 fetch）；账本冻结自 `a0659279`。
- adapters 七件（#983 判决的零皮肤适配层）：`alert-dialog-shell` `dialog-shell` `panel`
  `seeded-avatar` `status-chip` `tag-chip` `toaster`。
- **口径注记**：任务书引「30 条 = 14 pristine / 7 deviated / 9 adapters」是 #1003 刷新时点账；
  波 1 / 波 2 各票按 #989 纪律在同 PR 重冻账本（select 退役入 pristine、chat 原语与
  tooltip 等入册、手写壳退役出册），封版时点权威账 = 上述 33 文件终数。

### 3. #980 关图核账

- **Decisions so far 每关票一行**：核账发现 7 张已关票缺行（#1004–#1008、#1010、#1013），
  已补齐并 `gh api PATCH` 写入 #980 body，回读逐字节比对 **MATCH**。
  补行后 21 张已关子票全部有行（#981–#991、#1002–#1010、#1013）。
- **子票全闭**：23 张子票，21 张 CLOSED。**待闭 2 张 = #1011（t-0261 判定中）+
  #1012（本票，随本 PR 合并关闭）**。#1011 关闭前本项不成立、也不声称成立。
- **Not yet specified 为空**：✓（正文「（无——…）」，#991 毕业后纯执行期）。
- **Out of scope 核对**：✓。逐 PR 文件面扫描 14 张波次 PR
  （#1021/#1045/#1057–#1062/#1066/#1069/#1072/#1075/#1088/#1090）：
  改动面 = apps/web + docs + scripts + .github + 验证工具（verify-pacman skill scripts），
  外加三处已授权例外——`biome.json`+`pnpm-lock.yaml`（#1003 依赖授权，
  PACMAN_ALLOW_LOCKFILE_CHANGE 过闸）、`integration/test/m5-web-e2e.test.ts`
  （F-R21 段序 pin 的测试基建面，#1003 票内）、`.claude/skills/verify-pacman/`（验证工具）。
  **零 apps/server / apps/daemon / packages 语义改动**——后端 out-of-scope 声明成立；
  动效只消费不重设计（ADR 0009 面）✓；Base UI 保持（registry 账本可证）✓；
  composer 未组件化 ✓；todos.dev 像素对拍未复活（parity/ 仍不存在）✓。

### 4. 历史正典处置核账

- **#909 色板退位存档句**：✓——#909 内 2026-10-07「推翻记录」评论在档
  （C · 纸兰退位为历史参考、E · 暖灰玫定版、C 资产正本地位不变条款齐）。
- **spec/22 superseded 标注**：✓——头部 superseded-in-part（ADR 0012 / #980）四面①–④在档。
- **余册标注（#1013 入账核对）**：✓——ADR 0009 头部 superseded-in-part（D3②，#991 Q9）+
  修订条目；ADR 0012 修订节（Q9 F8 指针 + Q10 品牌槽位闭合）；docs/spec/06
  superseded-in-part（parity harness 面）；spec/11 叠加注（承载形态换锚）；spec/18
  余册核账封口（无失效面）。全部经 `audit-sealed.sh` 机器复核（ALL CHECKS PASS）。
- **#851 闸去留判定**：**保留，转为永久回归闸**（裁决落 `ci.yml` 两闸注释 +
  `ui-debt-gate.mjs` 头注，纯注记零行为改动，改后 debt/drift 两闸复跑 PASS）。理由：
  1. **覆盖面正交，退役即失守**：#989 registry 闸的面到 `components/ui` 边界为止；
     consumer-shape 闸判几何盒行；dead-class 闸判类 token。debt 闸的 D1（per-face CSS
     零新增）与 D2（裸 button/input/select/textarea 总量）没有第二道闸承载；drift 闸的
     G1–G4/G6（.btn 选择子、hex 字面量、chip 异地重定义、deliberate-native 标记、
     品牌墨台账）同样唯一。G5 与 registry 账本互补——账本钉文件 hash，看不见
     registered-deviated 文件里的颜色内容。
  2. **基线已在地板，棘轮纯防回潮**：0 per-face 文件、3 裸控件（全部 deliberate-native
     豁免的隐藏 file 触发器，#953 终账裁决）——「非 registry 新增为零」（验收模板 v3 ⑦）
     的机械载体就是这两道闸；退役零收益、失守整面。
  3. **保留成本为零**：纯源码扫描、零依赖、秒级，D3/S5 双棘轮已防「分支内重冻抬天花板」。

### 5. 证据归档 + 关票口径

- 本目录即归档；PR body 引 raw 永久链。
- 本 PR commit message 带 `closes #1012`；**#980 由用户在合并后关闭**（地图关闭是用户仪式），
  本 PR 不携带 #980 尾标。#1011 不由本票处置。

## 全量运行账（封版复跑汇总）

| 运行 | 结果 | 证据 |
| --- | --- | --- |
| e2e 全量（8399） | **862/862（5.3m）** | `e2e-full.log` |
| probe run-4（8400，入档底片） | visual **894 KEPT / 0 DRIFT / 0 VIOLATION / 0 NOT-RUN**；tests 861/1（provider-oauth 负载 flake，隔离 7/7 绿） | `probe-sealed/` + `flake-attribution/rerun-provider-oauth.log` |
| probe run-1/2/3 | 891 全 KEPT（run-1）；run-2 作废（自污染）；run-3 = board-dnd harness 竞态（归因见上） | `flake-attribution/` |
| 五闸 | 全 PASS rc=0 | `gates.txt` |
| audit-sealed.sh | ALL CHECKS PASS（rc=0） | `audit-sealed.txt` |
| 本地三闸 | lint 0 error / typecheck 五包绿 / spec:parse PASS（862 tests / 112 files） | 会话记录（run-2 前跑完） |
