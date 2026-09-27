# A3-pages 交付报告：次级页面群收编到 ui/ 原语

范围：`resources/ pages/ routes/ secondary/ chief/` 五区（ts + css）。
方法：**零像素收编**——元素侧改接 `Button/Input/Chip` 原语，per-face 差异
降为高特异性别名规则（`.btn.xxx` / `.chip.xxx` 0-2-0，顺序无关稳赢），
e2e 钉死类名一律保留叠加；唯一有意像素变化 = 圆角归一 6/10 → 8。

验证：`pnpm lint` 0 error（175 warnings 全为存量，五区文件零诊断）、
`pnpm typecheck` 全绿、`PARITY_PORT=8394 pnpm parity` **229/229 全绿**
（含真 baseline 行：machines 0.9884 / providers 0.9910 / team 0.9629 /
schedules-empty 0.9498 / 四弹窗 0.90-0.99，均高于 0.85 阈值）。

## 收编清单（改接原语，28 元素处）

### Button（9 处）

| 处 | variant/size | 保留的 per-face 差异 | 理由 |
|---|---|---|---|
| res-primary（resources/parts.tsx EmptyState 主钮） | primary/compact | `padding: 0 11px; line-height: 16px` | r7 10 实测 11px 横向内边距（compact 档 12）；e2e 钉 `.res-empty .res-primary` |
| res-primary--block（skills-import 创建技能） | primary/standard | margin/width/height 34px/font 14 | r8 79/80 block 形在档位之上 |
| prj-tasks-empty-new（project-page 任务空态） | primary/compact | `margin-top: 16px; gap: 4px` | icon+text 间隙是 per-face 形 |
| prj-set-delete（project-settings 危险区） | danger/compact | `margin-top: 12px` | 圆角 6→8 = 圆角归一（smoke 行无红）；e2e 钉 `.prj-set-delete` |
| account-swap（account 更换） | text | 无（逐值同形） | e2e 钉 `.account-swap` 文本断言 |
| keys-once-copy（api-keys 一次性块复制） | primary/compact | `font-size: 12px` | 行内形 12px 字 |
| apikey-form-quickbtn ×2（全选/清空） | text | `font-size: 12px; color: var(--text-tertiary)` | 票面点名收编；表头轻量动作字 |
| chief-edit-btn（chief 章程编辑） | ghost/compact | `border-color / background: var(--surface) / color: var(--text-primary)` | r5 102 实测描边 token 与底/字色；e2e 钉 `.chief-edit-btn` |

### Input（18 处）

| 处 | 说明 |
|---|---|
| dlg-form-input ×14（mcp 6 / secret 2 / provider 5 / agent 1） | 与 `.input` 逐值同形（36/8/surface/12 边距/14px）；类名叠加，`ui/dialog.css` 族规则不动（同值共存单源化于元素结构） |
| res-input ×3（skills-import 名称/描述/链接） | 同形收编，删同值规则，留 `::placeholder`（全局无占位规则）；`.res-scanrow > .res-input` 布局规则保留 |
| apikey-form-input ×1（API key 名称） | 票面点名归一 36px 标准族（原 padding 8 10 / surface-inset / border-strong / 13px 散写面归一）；W4 #287 面无 parity 基准，零红项 |

### Chip（1 处）

| 处 | 说明 |
|---|---|
| res-pill（resources/parts.tsx StatusPill，machines/providers 未启用 pill） | `Chip variant="neutral"`（bg 同源 `--pill-idle-bg`）；r7 06/07 实测形（20px 高/4px 圆角/text-dim 字/0 5 内边距）保留为 `.chip.res-pill` 高特异性别名——06/07 真 baseline 零像素 |

## 圆角归一（6/10 → 8，9 处可交互控件）

`res-add` 10→8（machines baseline 行 PASS）、`res-dropzone` 10→8、
`res-cand` 10→8（skills smoke）、`prj-file-row` 6→8、`prj-tasks-menu-row`
6→8（project smoke）、`prj-set-delete` 6→8（随 Button 收编）、
`team-create-agent` 10→8（team baseline 行 0.9629 PASS）、
`chief-gate-btn` 6→8、`chief-switcher-row` 6→8（chief smoke）。

## 保留散写清单（记录每处选择）

**submit 族类（选项 B——保留族类别名）**：`dlg-secret-create /
dlg-mcp-create / dlg-provider-create / dlg-agent-create / chief-dlg-primary /
chief-dlg-ghost / dlg-form-ghost / dlg-form-add / dlg-form-primary`——
`ui/dialog.css` 已是族层唯一样式源（Phase 1 提升），e2e spec
（dialog-viewport / secret / mcp / provider / team-create-agent / chief-settings）
钉死类名；改接 Button 会引入 ghost 底色/描边 token 差异与两套规则竞争。

**形态档外 / 复合形（原语不载，保留散写）**：

- `sched-empty-new` 75×30（r7 11 capture 像素钉死；30 不在三档）
- `sched-form-cancel / save` 30px、`keys-create` 30px+0 20、
  `apikey-form-create / cancel` padding 8 16 形、`authorize-submit`
  padding 8 0 形（token-gate 族）、`prj-new-submit` / `prj-new-input` /
  `prj-new-repo` 40px r2 07 表单族（与 repo selector 行配对，单收 input 破坏行齐）
- `res-add` / `team-create-agent` / `res-dropzone` dashed 形态
- `res-sort`（88 固定宽三段复合）、`res-scan`（36px 高）、
  `account-select` / `chief-select`（30px select 触发复合）、
  `res-search`（div 展示面）/ `prj-tasks-search` / `chief-pick-search`
  （复合搜索框，内嵌 input 非裸框形态）
- FAB ×4（res/page/secondary/chief 9999 圆 canon）、`chief-send` 32 icon 钮、
  `chief-set-back` / `sched-card-more` / `sched-form-close` 24px icon 钮、
  `account-switch` toggle

**链形/轻量字钮（text variant 值差，保留）**：`res-new`（a/button 双态 +
gap 8）、`page-new-action`（14px 字）、`prj-set-change`（12px/indigo-400
capture chrome）、`res-doclink` / `keys-docs`（text-dim 无框）。

**ring 家族 chip 6px 圆角（不动）**：`res-tab / page-tab /
sched-form-freq-tab / prj-files-seg-tab / prj-tasks-view-btn /
team-layout-tab / chief-tab / dlg-seg-tab`——#138 hairline ring 几何
（容器 8 = 1 边 + 2 内距 + chip 6 + 2 + 1），chip 归 8 会顶到容器圆角出血。

**静态/装饰圆角（不动）**：`res-tile` 族（票面点名不动）、
`prj-branch-chip / prj-set-branch / prj-set-chip / sched-card-chip /
chief-chip-todo / chief-chip-agent / chief-example-tile / chief-code /
prj-task-check`；容器卡 10px（`res-card / keys-row / keys-once /
team-agent-card / keys-empty-tile`）为卡表面非控件。

**textarea（票面口径：保持散写并记录）**：`dlg-form-textarea` /
`chief-dlg-charter-input`（ui/dialog.css 族类）、`chief-composer-input`
（chief.css 散写）。

**无收编点文件**：`resources/shell.tsx`（back=a、FAB）、`pages/shell.tsx`
（TabGroup=ring tab）、`board-page.tsx`（chief-fab FAB）、
`todo-detail-page.tsx`（全数消费 detail/overlay 域组件）、
`create-machine-dialog.tsx`（纯命令块，dlg-enroll 样式在 detail/overlays.css
域外）、`chief-drawer.tsx` / `chief-wake.tsx` / `chief-model-select.tsx` /
`chief-agent-dialog.tsx`（composer textarea / FAB / anchored popover /
内嵌搜索框）、`secondary/shell.tsx`、`machine-authorize.css`（8px 已合规）。

## 未决问题（移交主线裁决）

1. **res-pill 的 chip canon 全圆角归一 deferred**：现零像素差异保留
   （20px 高/4px 圆角/text-dim）。若后续要纯 Chip 形（18px/9999/secondary
   字），动 machines/providers 两个真 baseline 行，需 diff-audit 增裁决
   （「4px→9999 是否属圆角归一许可」目前口径只写了 6/10/4→8px）。
2. **sched-card-chip（r3 93 色族 chip）未收编**：票面动作 3 字面范围 =
   `.pill-idle-bg` 消费点，它用 `--chip-*-bg/fg` 色族但形态差大
   （12px 字/6px 圆角/无固定高 vs Chip 11px/9999/18px）——收编需新增
   per-face 裁决或 Chip 加变体。
3. **prj-new-input 40px**：r2 07 表单族（与 40px repo selector 行配对），
   不归 36 实测族——若归一需 Input 原语扩 40 档（ui/ 域，本票禁令内不动）
   并解行齐问题。
4. **apikey-form-create / cancel padding 形**：35px 上下文（非 32 档）+
   footer 是 row-flex 动作对（非 dlg-form-foot 全宽形）；若收编需
   Button standard 32 + 弹窗 footer 形改造，属独立小票。
