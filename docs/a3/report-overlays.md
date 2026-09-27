# A3-overlays 域收编报告

> 票：docs/a3/tickets/overlays.md（浮层域散写 UI 收编到 ui/ 原语层）。
> 范围：`apps/web/src/overlays/*.tsx + overlays.css`、`apps/web/src/overlay/*.tsx + overlay.css + token-gate.css`。
> detail/overlays.* 未触碰。ui/、tokens.css、parity 基准未触碰。

## 收编结果

**结构收编（JSX 换原语，5 处）：**

| # | 点 | 原语 | 类名处置 |
|---|---|---|---|
| 1 | token-gate 输入 | `Input`（36px 实测族） | `token-gate-input` 保留为 e2e 别名（token-gate.spec.ts），散写规则删除 |
| 2 | token-gate 提交 | `Button primary standard` | `token-gate-submit` 保留为 e2e 别名，散写规则删除 |
| 3 | 新建任务·保存 | `Button ghost standard` | 无 e2e/parity 钉扎，类名与规则全删 |
| 4 | 新建任务·保存并开始 | `Button primary standard` | 同上；disabled 走原语 `--primary-disabled` |
| 5 | 删除确认·删除（任务 + 项目两处） | `Button danger standard` | `delete-confirm-delete` 保留为 e2e 别名（project-settings-delete.spec.ts）；`:disabled` 降透明度留本面（原语 danger 无禁用形态） |

**CSS 归一（7 处）：**

- 圆角归一 8px（diff-audit #1）：`delete-confirm-input`（6→8，可见）、`plan-dropdown-row`（10→8，透明底零像素差）。
- 面板 12px 字面量 → `var(--edge-radius)`（等值零像素）：`search-panel`、`chip-popover`、`new-task-dialog`、`delete-confirm`、`more-menu`。

**像素影响声明（gated 面）：**

- 等值零像素：edge-radius 归 token 5 处。
- 圆角归一（票面许可红项来源）：仅 `delete-confirm-input` 6→8。
- 原语档位归一（diff-audit #2「收编按语义选档」）：弹窗 footer 钮 30px/12px 字 → 原语 32px/13px 档；ghost 描边 `--border-default` → `--card-ghost-border`；primary disabled `--new-task-primary-disabled` → `--primary-disabled`。gated 行全部过线（见下）。
- token-gate 全套：不在 parity 矩阵（`overlay-token-*` 行是 detail 域 Token 用量弹层），像素自由——输入 ~33→36px、bg `--surface-inset`→`--surface`、描边 `--border-strong`→`--card-border`、focus 加 1px ring、提交 ~33→32px。

**其他工程变化：**

- token-gate 聚焦从 ref 改走 `htmlFor`/id 锚点 `pacman-token-input`（`InputProps` 无 ref 类型位，原语缺口）。

## 验证证据

```sh
pnpm lint       # exit 0（175 存量 warning 与本域无关，15 个域内文件零诊断）
pnpm typecheck  # shared/web/server/daemon/integration 全 Done
PARITY_PORT=8393 pnpm parity  # 229/229 pairs green，exit 0，红项 0
```

被改动波及的 gated 行分数（threshold 0.85）：

| 行 | ssim | 行 | ssim |
|---|---|---|---|
| overlay-new-task-light | 0.9479 | overlay-delete-light | 0.8764 |
| overlay-new-task-filled-light | 0.9439 | overlay-delete-fresh-dark | 0.9602 |
| overlay-new-task-dark | 0.8961 | search-empty-light | 0.9507 |
| overlay-more-confirm-light | 0.8649 | search-results-light | 0.9181 |
| overlay-more-fresh-light | 0.9599 | chip-popover-confirm-light | 0.8661 |
| overlay-more-fresh-dark | 0.9623 | plan-dropdown-light | 0.8647 |

（overlay-delete-dark 为 threshold=0 的 report-only 行，8160 系其既有背景漂移，非本票引入。）

## 缓收清单（原语表达不了，ui/ 本票冻结）

| 点 | 缓收原因 | 出路 |
|---|---|---|
| ⌘K 搜索框 → Input | palette 无框 40px 行（r7 05 实测 canon）≠ Input 盒状 36px；05/05b gated，票面只许圆角红 | Input 扩 bare/palette variant + 主线 rebaseline 裁决 |
| delete-confirm-input → Input | 30px 紧凑内联形态（透明底），票面 input 点名名单不含它 | Input 扩 compact 档或维持 |
| delete-confirm-cancel → Button | r7 25 canon 无框弱文字钮（text-dim），原语无 quiet variant | Button 扩 quiet variant |
| 图标钮 ×5（new-task-close / delete-confirm-close / new-task-tag-add / new-task-tools ×3） | DESIGN 有 Icon 形态，原语无 icon variant | Button 扩 icon variant |
| 菜单行（more-menu-item / chip-popover-edit / plan-dropdown-row / new-task-project-row / search-row 族） | 行形态非钮形态，非 Button 收编对象 | 维持（行族归 motion/hover 层契约） |
| search-row-chip → Chip | 14px 迷你 chip（05b 实测）vs 原语 18px | Chip 扩 size 档 |
| token-gate 面板 → Card | form 元素 + Level-2 阴影（`--edge-shadow`）+ `--surface` 底，Card 三 tone 均不匹配；值已全 token（action #4 审计通过） | Card 扩 dialog tone 或维持 |

## 未决问题（主线裁决）

1. ⌘K 搜索框：票面「搜索框 → Input」与「parity 红项只许圆角归一」在 05/05b gated 行上直接冲突，本票按验证条款缓收，需主线二选一（扩 variant / rebaseline）。
2. Button 原语缺口：icon 钮、quiet 文字钮、danger `:disabled` 三形态——本票以类别名 + 本面 CSS 承接（`delete-confirm-delete:disabled` 降透明度）。
3. Input/Chip 缺口：`InputProps` 无 ref 位（token-gate 已绕行）；Chip 无 mini 尺寸；Input 无紧凑档。
4. 面板半径 10px（plan-dropdown / board-guide-pop / new-task-project-menu，r7 20 实测 canon）与 DESIGN「弹层 12px」不一致，非 8px 化范围，设计归一属主线。
5. `--new-task-primary-disabled` token 收编后零消费（tokens.css 冻结未删）；`.btn`/`.input` 未声明 font-family（按钮现渲染 UA 默认字体，与存量同行为、无回归，显式声明属原语后续收紧）。

## 交付

- 分支 a3-overlays，commit：`web(a3-overlays): 浮层域收编 ui/ 原语——token-gate Input/Button、弹窗 footer 钮 Button 化、圆角归一 8px`
- 未 push、未 merge、未开 PR、worktree 保留。
