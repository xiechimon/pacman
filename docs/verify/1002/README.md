# #1002 批次 0a：色板落地——验收证据

地图 #980 批次 0 波头。本票把 #988 实审定版的 E · 暖灰玫（Ash Rose）色板落
main，执行 #987 §3 槽位收敛判决，并整批重钉色值 e2e 探针面。本目录是验收
四项判据的实物证据（measure-912 实测档 + probe-dump 封版级对照表）。

## 落地内容

- **E 色板翻值**：cherry-pick `ui/988-palette-reselect`（prototype f8cfdb9e +
  flip eaec9481）。143 字面色槽 1:1 纯值翻转 + `--radius` 基 0.875rem→
  0.625rem（官方默认，#980 裁决④）。冻结正本 `apps/web/e2e/palette-e.css`
  （218 声明，name-complete）。#988 原型脚手架（switcher / overlay / 生成器 /
  shoot harness）按其自带的「胜者落 main 时删除」注记退役，只留永久面
  （palette-e.css 正本、measure-912 参数化、本证据档）；脚手架 reachable
  through git history（branch ui/988-palette-reselect）。
- **oklch→hex/rgb 折算**：全树零 `oklch(`/`lab(`/`lch(` 色函数（#411 记法
  契约，e2e 值探针按 rgb 字符串解析）。flip 本就输出 hex，probe VIOLATION 面
  零命中。
- **#987 §3 槽位收敛**：109 色槽 → 72（死 7 删 + 并 30 退役，消费点全数改
  直引官方/正本槽）。并 30 经落地树双模逐值实测 0 分叉（`surface≡card`、
  `secondary≡surface-secondary` 等），故为纯别名退役、零渲染色变。公式底随
  并更新（spot-soft/spot-disabled 的 color-mix 底 `--surface`→`--card`；
  edge-ring `--border-default`→`--border`）。app.css 别名 utility 层（content/
  line/surface 族）随并退役，消费改官方 utility；accent-* 5 条原色映射删除
  （accent-rose 2 处 error 文案并 text-destructive）。
- **色值 e2e 整批重钉**：probe-dump 全量驱动，绝对色值 pin 按 C→E 实测值翻
  （16 处字面量，覆盖 20 DRIFT + NOT-RUN 常量面）。相对断言（两边同翻）与
  对比度阈值（不动）保持 KEPT。

## 验收四项判据

### 1. 全量 e2e 绿

`pnpm --filter @pacman/web e2e`（E2E_PORT 8398）+ probe-dump 插桩全量run
（8397）：**813 passed / 0 failed**。

### 2. 探针色值面对账表清零

`probe/`（probe-dump 全量，--port 8397）：**visual rows 805 — KEPT 805,
DRIFT 0, NOT-RUN 0, VIOLATION 0**。三方 diff 的 pre-image = 封版
`docs/verify/953/probe-sealed/`（纸兰 C 终态）；本轮终态 = E 色板 + 收敛后
官方几何。唯一 NOT-RUN（全 995 断言行中）= token-gate.spec.ts:174 否定式
URL 行为断言（非 visual、非色值），playwright 0 failed 佐证其通过。

### 3. measure-912 复跑双模 109 对 0 fail（--palette 冻结正本）

`node apps/web/e2e/measure-912.mjs --palette palette-e.css --variant e`：

| 档 | 目录 | 读数 |
| --- | --- | --- |
| 收敛前（canon 复现 #988） | `measure-pre/` | 双模 109 对（90 PASS + 19 report-only）0 FAIL；unchanged=109 retired=0；min gated 暗 3.45 menu-icon / 亮 3.08 ring |
| 收敛后（终态） | `measure-post/` | 双模 109 对 0 FAIL；unchanged=72 retired=37 flip=0 new=0；min gated 逐字同 #988 归档 |

PAIRS 保持 109（量的是冻结 name-complete 正本，验收要求复现 109 对读数）；
退役 37 槽经 RETIRED_SLOTS 强制诚实状态（沿 #952 toggle 先例），status diff
读 unchanged=72 / retired=37，非误标 new。

### 4. better-colors 实测（不许估）

对比度全走 measure-912 的 WCAG 2.1 亮度比实算（半透明档先按真实底合成），
零估算。技能「before you finish」清单核查：

- ui-drift-gate G5：components/ui 25 件零裸色 PASS。
- 无 live Tailwind 原色 utility（indigo 引用仅存于描述参考产品出处的注释）。
- 零 `oklch(`/`lab(`/`lch(` 色函数（hex/rgb 记法契约）。
- `--color-primary`/`--color-text-primary` 双定义反模式已解（text-primary 随
  并流别名层退役，消费直引 --foreground）。
- 渲染对（浏览器内）：probe-dump 805 KEPT，双模渲染色值与正本逐值相符。

## 收敛终态（#987 §6）

shadcn.css = 官方 18 + radius + 留类扩展 51（品牌/状态/文本三阶/surface 独有
档/交互 alpha 梯/恒定杂项）= 69 色槽；tokens.css = 纯非颜色层 + drop-tint 3
色槽；合计留 72。独立值约 40，余为别名/公式/镜像派生。**本票合并后
tokens.css 翻值面冻结**（唯一写入口 = #989 刷新脚本）。

延后项：`--sidebar-hover`/`--sidebar-active` 命名空间改名（#987 §3.5-2）是
引入官方 Sidebar 件的前置，不在批次 0a；measure-912 canon-diff 无改名表示形，
改名随 Sidebar 引入批次走。input/textarea 圆角回 registry（#982 漂移件重拉）
归 #1003，本票保持 main 态 rounded-none。

## 文件清单

- `measure-pre/token-scale-912.{json,tables.md}` — 收敛前 canon 复现档
- `measure-post/token-scale-912.{json,tables.md,fragment.md}` — 收敛后终态档
- `probe/probe-{dump.json,comparison.md}` — 全量 probe-dump 封版级对照表
- `c2e-valmap.json` — C→E 渲染值映射（60 值，0 冲突，重钉依据，已审）
