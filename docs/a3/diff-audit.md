# A3 散写差异裁决清单

> Phase 1 已建原语库（`apps/web/src/ui/`，零像素变化，parity 229/229 绿）。
> 以下是 Phase 2 收编时会**动像素**的差异点——归一方向需裁决，裁决后
> 各域 herdr lane 按本清单执行 + parity rebaseline。

## 裁决（2026-09-26 用户拍板）

| # | 差异 | 裁决 | Phase 2 执行口径 |
|---|---|---|---|
| 1 | 按钮圆角（8px×80 / 6px×35 / 10px×18 / 4px×16） | **全归 8px** | 按钮与可交互控件圆角一律 8px；board 域 6px、其他 10/4px 全收。**装饰性小圆角（头像角标等非交互元素）不在收编范围** |
| 2 | 按钮高度（26/28/32） | **保留三档** | 原语 size: card/compact/standard 原样；收编按语义选档，不改高度 |
| 3 | Input 高度（实测 36 vs 文档 32） | **跟实测 36px** | DESIGN.md 已修正；原语不变 |
| 4 | dlg-close 圆角 6px | 并入 #1，归 8px | 随按钮圆角收编 |
| 5 | dialog 阴影（0 18px 45px/.25 vs edge-shadow） | **保留独立大阴影** | 不动 |

圆角归一 = 有意视觉变化：Phase 2 各 lane 的 parity 红项**只允许**来自圆角归一（8px 化）影响的组件，其余红 = bug。rebaseline 由主线合并后统一决策，lane 不动基准。

## 已收口（不动像素，轨 A #A2 完成）

- 白字压 accent 实底：31 处 → `--text-on-accent`
- toggle 白圆点：3 处 → `--toggle-knob`
- 全屏遮罩黑：6 处 → `--overlay-scrim`
- spacing 阶梯：`--space-1..6` 已建，**新代码强制消费**；存量实测值（17/13/3px 等 r7/r8 capture ground truth）不收敛

## 结构约束（不裁决，遵守）

- `dlg-form-*` 的 per-face 并列类名是 e2e spec 钉死的别名（`ui/dialog.css` 头注），元素侧保留不改。
- 缝纪律：`@earendil-works/*` 等 import 只能经薄桥模块（`biome.json` noRestrictedImports）。

## Phase 2 分域（herdr 并行，域间文件不相交）

| 域 | 范围 | 特殊注意 |
|---|---|---|
| board | `board/*.tsx` + board.css/sidebar.css | 6px 圆角集中地；todo-card 按钮 26px |
| detail | `detail/*.tsx` + detail.css + overlays.css 余部 | chip 五态消费点；detail-chip--* → Chip |
| overlays+overlay | `overlays/*.tsx`、`overlay/*.tsx` + 同名 css | token-gate、搜索面板、chip-popover |
| 次级页面群 | `resources/ pages/ routes/ secondary/ chief/` | 各页 submit 按钮、表单 input 收编 Input |

## 终态记账（2026-09-27，A5 收尾批裁决）

A 轨三轮收编后剩余散写点位的主线处置——均为「维持现状」终态，理由各 lane 报告已实证：

| 项 | 终态 | 依据 |
|---|---|---|
| `.overlay-btn` 族（rerun/reuse） | **维持散写** | A3 时三处 per-face 叠加后原语贡献趋零（token/尺寸/盒模型三重非中性），收编为纯类名叠贴无意义（report-overlays 实证） |
| res-pill（20px/4px 圆角独立形） | **独立形态维持** | 与 Chip 18px/9999 形态差大，machines/providers 真 baseline 钉扎；归一需动像素，无收益 |
| ⌘K 搜索行 | **A5 已收编**（Input palette variant） | 裸输入皮肤进原语，行容器几何 per-face |
| 复合搜索框（prj-tasks-search / chief-pick-search） | 观望 | palette variant 已成型（A5），需要时按同法收编 |
| 跨域 CSS（detail/overlays.css 服务 resources/routes） | 记账 | 全局单 CSS 包下成立；按路由拆 CSS 包时需迁移 |
