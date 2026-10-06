# #908 Destination 逐句核对（#953 sealed 封版）

Destination 原文（#908 body）拆句核对。判据列全部机器可判；证据指针为本目录与票链。

| # | Destination 分句 | 判定 | 实物判据 |
| --- | --- | --- | --- |
| 1 | 所有交互元素由 shadcn 件承载 | **达成（含 1 项显式豁免）** | 老 `ui/` 原语消费 = 0（目录已删，typecheck 证明零 import）；`components/ui/` 26+ 件为唯一共享件面（COMPONENTS.md 登记，ui-reuse-inventory 闸钉「src/ui 不得复活 + 冻结清单为空」）；裸控件账面 = 3 处 deliberate-native 隐藏 file input（`display:none` 编程式触发器，无可见皮肤可收编——#855 marker 纪律 + drift-gate G4 绿；票面出口「显式豁免并给理由」，见 README §裸控件豁免） |
| 2 | per-face CSS 清零（样式全部成为 shadcn 件上的 Tailwind 类） | **达成** | `apps/web/src` 下 `*.css` = 白名单五件（shadcn/tokens/motion/app/fonts），白名单外 **0**；ui-debt 基线 `perFaceCss: {}`（audit-terminal-state.txt 第 1 项）；ci 闸 D1–D4 兜底禁新增 |
| 3 | 新色板（色相重选、明暗双模、对比度实测达 WCAG AA）落地封版 | **达成** | #909 用户实审定版 C · 纸兰 → #915 翻值 → 本票封版树复跑 measure-912：双模各 flip=0 / new=0 / retired=2（toggle 两槽 #952 删）/ unchanged=109；AA 门控 0 未过（dark min 3.46 / light min 3.05，均 ui 档 ≥3.0）；live 双模抽测 B5+D 全过（measure-sealed/ + live/result.json） |
| 4 | 新几何（better-ui 工艺基准）落地封版 | **达成** | 几何正本 = spec/22 §2；全部视觉 spec 已按 #942–#952 逐域重钉；封版 probe-dump 全量表 805 行 DRIFT=0（几何/色值探针基线 == 实测，probe-sealed/probe-comparison.md） |
| 5 | e2e 行为契约全绿 | **达成** | 本地全量（E2E_PORT=8398，caffeinate）：**811/811（1.8m，104 spec）**；首跑 5 条睡眠假红，同树重跑 38/38 绿 + 全量复跑绿（README §睡眠假红判例）；vitest 2083/2083、integration 60/60、`pnpm -r typecheck`、biome ci 全绿；CI 三必需检查为准 |
| 6 | 视觉探针按新正典重钉 sealed | **达成** | probe-dump（#921 工具）全量对照表：KEPT 805 / DRIFT 0 / VIOLATION 0 / NOT-RUN 0（封版复跑）；人审 diff = 本表即封版记录（#910 裁定 5 口径：工具对照 + 人审，无自动改写） |
| 7 | `src/ui/` 老原语正式退役 | **达成** | 目录不存在（audit 第 2 项）；#952 终删 + ui-reuse-inventory 闸防复活 |
| 8 | spec/16 像素纪律正式退役 | **达成** | spec/16 头部 superseded-in-part 声明就位（#911/ADR 0010），像素纪律注明确标退役（audit 第 5 项） |

## 未竟面清单（关图建议随附）

- **a11y / i18n 牵连面**（#908「Not yet specified」遗留）：shadcn 件语义 vs 现有断言之差、新色板下 reduced-motion 与对比度降级律——始终是雾、未毕业成票。换代本体不依赖它（对比度 AA 已实测封版；行为断言语义未动）；建议关图后单开小票或按涌现制处理。
- 其余票面义务全部闭环：波次表 12 票 + #851 闸全 CLOSED（gh 实测）；两条裁决观察（`.chief-fab` 双份、ROW_SELECTED 编译序）均已处置——chief-fab 随 per-face 清零自然消失（机器判据 = 第 2 句），ROW_SELECTED 终账裁决见 README §ROW_SELECTED。
- 「跑完即关 #953 + 提请关 #908」按协调者口径留给用户裁决后执行，本 PR 不含任何关票关键字。
