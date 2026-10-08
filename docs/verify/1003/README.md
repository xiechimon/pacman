# #1003 批次 0b：registry 对齐前置 — 验收证据

地图 #980 批次 0 的串行第二票（0a = #1002 色板落地）。本票是共享面最后一次
写入：合入后 `tokens.css` / `components/ui` 冻结，唯一写入口 =
`scripts/ui-registry-refresh.mjs`（#989 按需刷新脚本）。

## 声称 → 实物

| 验收判据 | 实物 |
|---|---|
| #989 闸绿 | `04-gate-pass.txt`：ui-registry-gate PASS（S5 vs PR base `6c75da9a`，5 个新注册被点名、零降级；30 件 = 14 pristine + 7 deviated + 9 adapters）+ ui-debt-gate PASS + ui-drift-gate PASS |
| 全量 e2e 绿 | `06-e2e-full.txt`：终态 **811 passed / 0 failed**（E2E_PORT 8398，1.9m）。首跑 4 红 = 全部为判决内重钉面（F-R21 初版定位、overlay-focus ×2 旧环配方、shadcn-primitives avatar contents 契约），修复过程即重钉 |
| 段序 pin 落账实测 | `chief-stream-markdown.spec.ts` F-R21（ADR 0011 premortem 判据：文本段在前、其工具行在后、各恰一次、收口折叠归属后随段、id 字典序陷阱 + 同毫秒并列）——终态全量 run 内绿 |
| lockfile diff 仅 @shadcn/react 及其依赖闭包 | `05-lockfile-scope.txt`：+37 行，恰好两包（`@shadcn/react@0.3.1` + `lucide-react@1.52.0`），零传递依赖新增（peer 皆既有 react/@types/react）。**lucide-react 为票面验收句外增项**：item 1「图标缝 4 件回 lucide」（#982 横切 2，iconLibrary=lucide 契约）在现树无 lucide-react 的前提下不可行，2026-10-08 经用户显式批准加锁文件闸 |
| `add` 必走 `--diff` | `01-add-diff-*.txt` ×11（漂移件逐件）+ `02-dry-run-new-items.txt`（4 新件 + separator 依赖面、零新 npm 确认） |
| hash 账本刷新 + vendored 快照同步 | `03-refresh-output.txt`：21 件全量重拉（cli pin shadcn@4.21.3），逐件对账（pristine ✓ / deviated ✓ / 新件点名）；R4 剥落 cn-* token 全部打印在案 |
| lint / typecheck | `04b-lint-typecheck.txt`：biome ci 0 error（15 warning 为 main 既有面）、五包 typecheck Done |
| unit（light project） | `07-vitest.txt`：2094 条终态绿（首跑 2 红：inventory 登记随 COMPONENTS.md 补齐、skill-write M5 = 与全量 e2e 并跑的负载 flake，隔离重跑过） |
| 动效 / 几何改动面人审对照表 | `08-visual-review.md`（判决 → 旧正典 → 新正典 → 探针状态，逐面） |
| probe-dump 全量插桩 | `probe/probe-comparison.md` + `probe/probe-dump.json`（#921 工具面；KEPT/DRIFT 计数见 README 尾注） |
| 复选新形态外观 | `accept-checked.png` / `accept-unchecked.png` / `provider-checked.png` / `provider-unchecked.png`（evidenceShot，E 色板 + 官方几何下的实物截图） |

## 施工期裁决（本目录其余文件的上文）

1. **refresh 脚本 R2 改判 lucide**：原 R2 把 IconPlaceholder 重写进仓内生成
   图标缝——与 iconLibrary=lucide 契约相抵（#982 横切 2 判缝为皮肤）。本票
   把 R2 改为重写进 `lucide-react`，快照管线与件同源，否则 dialog/checkbox/
   dropdown-menu 永远回不了 pristine。
2. **CLI `view` 批量 64KiB 截断**：21 件批量 view 在 65536 字节处截断
   （exit 0、JSON 中断，实测）——refresh 改为 6 件一批 + 截断对半重试；
   快照写入改为与既有文件合并（原 `--items` 子集模式会把未拉件从快照里
   删掉，属潜伏 bug，同修）。
3. **tooltip 骑 z 梯**：z-50 → z-(--z-dialog)（#733 单梯语义映射，与
   dropdown/popover 同款；当前值相同，token 保持梯为唯一 z 事实源）。
   pristine→deviated 棘轮在图期内单向，注册必须发生在引入票。
4. **checkbox 三态**：上游 mixed 态复用勾形——横杠语义以零皮肤映射保留
   （Indicator 内 MinusIcon 分支，#952/#982），账本 deviated 登记。
5. **seeded-avatar 联动**（#983 判决的另一半）：avatar 重拉回源上游发丝环
   （after:absolute inset-0），contents 根上它会以页级祖先为 containing
   block（XMON-14 实测整页点击拦截）——Root 改定尺盒，22 个挂载点显式
   携带 size-N（与各面 [&_img] utility 同值同构）。
6. **过渡双环注记（波 1 须知）**：button 回官方 transition-all 后，仍带
   #388 per-face outline 配方的面（sidebar ROW_BASE / rail、model-select-core、
   plan-dropdown、parts、schedules-page、project-new-page）在 focus 时呈现
   「旧 outline 环 + 官方 box-shadow 环」双环过渡态，且环有 150ms 过渡
   （#15 窄写随 brand 档退役，#982 判决②联动）。配方退役或中和归各域
   车道（#1004 起）；overlay-focus.spec 正向断言已改配方无关 + 落定等待。
7. **R4 剥落面注记（波 1 人审点）**：上游新增 cn-menu-translucent /
   cn-menu-target / cn-rtl-flip（dropdown/select 族）与 cn-font-heading
   （dialog/alert-dialog/card/empty 标题）为 shadcn 宿主样式表 utility，
   仓不 vendor → 管线剥落、视觉面缺位（半透明菜单 / 标题字体档）。要
   补齐 = vendor 对应 utility 的地图级裁决，不在本票。
