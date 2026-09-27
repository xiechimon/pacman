# A3-detail 收编报告（detail 域 → ui/ 原语）

任务票：`docs/a3/tickets/detail.md`。范围 `apps/web/src/detail/*.tsx` + `detail.css` + `overlays.css`；
`ui/`、`tokens.css`、`ui/dialog.css` 未动。验证 `pnpm lint` / `pnpm typecheck` / `PARITY_PORT=8392 pnpm parity`。

## 收编清单

### chip 五态（本域重点）

| 位点 | 动作 |
|---|---|
| `dhead.tsx` 状态 chip | 五态 pill 视觉收编 `Chip` 原语：`<button class="detail-chip">` 内嵌 `<Chip variant={tone}>`，tone ∈ idle/plan/confirm/done/failed 与 variant 同名映射（`PHASE_UI` tone 类型即原语 variant 子集） |

- 结构 = 按钮管交互（aria-expanded / popover 开关 / Esc 律原样），Chip 管 pill 视觉。
- e2e 钉死保留：`.detail-chip` 基类留在按钮上（chip-assign / reject-chain 两 spec 按 `.detail-chip` 定位点击与断言文本）；`detail-chip--<tone>` 类名留在 Chip span 上作定位别名，**规则本体从 detail.css 删除**（`.chip--<tone>` 同 token 对，不留双源）。
- 像素等价审计：新旧 pill 同为 18px 高 / 0 7px 垫 / 9999 圆角 / 11px·16 行高 / 同 token 色对；按钮层瘦身成透明无垫壳，渲染结果不变。

### 按钮（逐处裁决）

| 位点 | 裁决 | 理由 |
|---|---|---|
| `dhead.tsx` 主动作钮 `.detail-head-action` | **接 Button**（primary/compact + 类名别名） | 皮肤/圆角归原语；50.5×28 @12px 是 r7 §3.3 冻结几何，scoped override 钉住 |
| `accept-dialog.tsx` 完成钮 `.dlg-accept-done` | **接 Button**（primary/compact + 别名） | 皮肤同 token；50×28 冻结几何 scoped 钉住（dialog-viewport.spec 钉类名） |
| `history-dialog.tsx` 重跑钮 `.dlg-history-rerun` | **接 Button**（primary/compact + 别名） | 皮肤/28px 高归原语；13px 侧垫是 r8 57 冻结值（原语 12px 会窄 2px），scoped 钉住 |
| `accept-dialog.tsx` 取消钮 `.dlg-accept-cancel` | 保留族类 | 原语无对应变体：text 是 indigo 链接式，取消钮是 tertiary 无框墨 |
| `branch-dialog.tsx` 同步钮 `.dlg-sync` | 保留族类 | 38px 高无原语档；disabled 态走 `--indigo-disabled` 对（原语 disabled 走 `--primary-disabled`），token 不同非像素中性 |
| `overlays.tsx` rerun/reuse `.overlay-btn(+--primary)` | 保留族类 | ghost 描边 token 不同（`--card-ghost-border` #2e2e33 vs 实测 `--card-border` #27272a）；30px 高无档；content-box 下 1px 描边参与盒算术，primary 态 border=bg 同色 trick 在原语 `border:none` 下需重加——三处叠加后原语只剩 cursor/字号可贡献，收编为纯类名叠贴无意义 |
| `branch-dialog.tsx` 复制钮 `.dlg-copy` | 保留族类 | 24×24 图标钮，原语无 icon 变体；仅圆角归一 |
| composer 工具/停止/发送、tab 组、seg、机器 pill、range chip | 保留 | 均无对应原语形态（icon 钮 / tab / 分段格 / 复合 pill） |

scoped override 一律 (0,2,0)（`.detail-head .detail-head-action` 等）压过 `.btn*` 单类 (0,1,0)，
不赌样式表 import 顺序。

### input / textarea

- **域内无单行 input 收编点**：detail 域 12 个 tsx 里仅有的输入是 composer 的多行 textarea（M5 live 面）与两处 checkbox。
- composer textarea 按票面口径保留散写并记录：多行、40px 定高、无框透明内嵌（Input 原语是 36px 带框单行 input，收编必动几何与元素类型）。

### 圆角归一（6 → 8px，裁决 #1）

| 位点 | 变更 |
|---|---|
| `.detail-head-action` | 6 → 8px（随 Button 原语 `.btn`） |
| `.doc-range-chip` | 6 → 8px |
| `.overlay-btn` | 6 → 8px |
| `.dlg-copy` | 6 → 8px |
| `.dlg-enroll-copy` | 6 → 8px（tsx 在 resources/routes 域，仅 css 侧归一） |

明确**不动**（并记录依据）：

- `.detail-tab` / `.user-menu-seg button` 内格 6px：同心圆角律（外板 8px − padding 2px = 内格 6px），与冻结的 `ui/dialog.css` `.dlg-form-seg` 族（外 8 − 垫 3 = 内 6）同一族律；单改本域会与同屏弹窗 seg 不一致。
- checkbox 视觉方格 4px（`.dlg-accept-check` / `.dlg-provider-check`）：18px 盒 8px 圆角会被读成 radio。
- `.composer-stop` 4px：14px 停止方块是捕获设计语义，8px 被 CSS 钳成近圆。
- inline code chip 4px（`.doc-code` / `.chat-code`）、`.chat-taskline-seq`、`.dlg-history-chip`：行内文本级装饰，非控件。
- `.version-menu` 10px：浮层面板属 elevation 半径族，非控件半径。
- 全圆角元素（chip pill / FAB / 头像 / toggle）与已 8px 控件：原样。

## parity

`PARITY_PORT=8392 pnpm parity`，基线不动（lane 纪律）。

- **红项数：0**——229/229 pairs green，exit 0。五处 6→8 圆角变化均被 SSIM 0.85 门槛吸收（角弧级变化不拉低全页相似度）。
- 收编面像素等价的实测佐证（本 lane 渲染 vs 变更前渲染，同机同栅格化；对照 = 主仓
  7ba764cd7 干净树的 parity 产物）：
  - `overlay-accept-light`（含收编的 `.dlg-accept-done`）：全页差 **YAVG = 0.000**——Button
    堆叠收编像素级零漂移。
  - `detail-confirm-light`：全页差分总量（≈3136 luma 单位）与 head-action 钮裁剪区差分
    （≈3134）相等——页面全部差异收在该钮圆角角弧内；chip 收编区域实测零差异。
  - `overlay-branch-light` / `overlay-history-light` / rerun-reuse 族：全页差 0.0012–0.0067，
    均为角弧量级；`dlg-history-rerun` 收编无额外贡献。

## 未决问题

1. **`dlg-close` 6px → 8px（裁决 #4）无处落地**：规则本体在 `ui/dialog.css`，本票禁令明示该文件不在范围，Phase 2 四个域也无人认领——留主线在 ui/ 侧收口时一并处理。
2. **detail.css `.history-*` 死选择器族**（`.history-row` / `.history-glyph` / `.history-current` 等 8 条，与 history-dialog 实际类名 `dlg-history-*` 平行的旧代命名）：疑似上代残骸；非票面范围未动，建议主线确认后清理。
3. **`.overlay-btn` 族若要归一需先扩原语**：ghost 描边 token 对齐（`--card-ghost-border` vs 实测 `--card-border`）或增设 30px 档 + border-box 约定，均动 `ui/`，本票冻结不能做。
4. **`detail/overlays.css` 跨域服务**：`dlg-agent-*` / `dlg-provider-*` / `dlg-mcp-*` / `dlg-enroll-*` 规则在本文件，消费者 tsx 在 resources/routes 域（全局单 CSS 包成立）。文件归属与 Phase 2 分域口径不一致，未来拆包（按路由 code-split CSS）时会断；建议主线记账。
