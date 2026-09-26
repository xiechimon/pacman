# A4-deep：全站深收编（icon / quiet / mini / 危险禁用形）

契约上游 = `7e4f104bb`（Button icon/quiet variant + danger:disabled、Chip mini）。把各 lane 报告「缓收清单」里因原语缺口而保留的点位收编进来。

## 范围（按域列文件，只准动这些 tsx + 对应 css）

| 域 | 文件 | 点位 |
|---|---|---|
| board | `board.tsx` | `.board-guide`（28×28 icon 钮）、`.board-column-collapse`（25×25） |
| board | `todo-card.tsx` | `.todo-card-branch`（13×16） |
| detail | `branch-dialog.tsx` | `.dlg-copy`（24×24） |
| overlays | `new-task-dialog.tsx` | `.new-task-close`（24×24）、`.new-task-tag-add`、`.new-task-tools` ×3 |
| overlays | 删除确认弹窗（delete-confirm） | cancel 钮 → quiet variant；delete 钮收编后删本面 `:disabled` 规则（原语已载 opacity .5） |
| pages/chief | `chief.tsx` 族、`chief-drawer.tsx`、schedules 相关 | `.chief-send`（32 icon）、`.chief-set-back` / `.sched-card-more` / `.sched-form-close`（24 icon） |

## 收编方法（皮肤/几何拆分律）

icon variant 是**皮肤层**（居中 + tertiary 墨 + hover 增亮），不锁几何——收编形态 = `Button variant="icon" className="原类名"`：类名叠加保几何（宽高）+ e2e 锚点；散写 css 里的**皮肤规则**（color/cursor/background/居中）删除、**几何规则**（width/height/position）保留。quiet 同理（text-dim 皮肤，几何 per-face）。

## 钉扎四面检查（动手前逐点位过）

上批双 CI 红教训：类名收编检查 = ① apps/web e2e spec ② integration/test 的 locator ③ parity 点击矩阵 ④ 视觉 spec 的 computed-style 几何断言（grep `radius).toBe\|height).toBe`）。每处收编前 grep 验证，钉了类名就保留叠加。

## 明确不做（未决项，不属本票）

⌘K 搜索框（Input 无 palette variant）、`.overlay-btn` 族（ghost token 差异待裁决）、res-pill chip canon（待 diff-audit 增裁决）、delete-confirm-input 30px 紧凑形、FAB（9999 圆 canon 自成一族）。

## 验证（全绿才交付）

```sh
pnpm lint && pnpm typecheck
PARITY_PORT=8397 pnpm parity                       # 229/229（皮肤等值替换零像素）
cd apps/web && npx playwright test                 # 全量 E2E ~30s（四面兜底）
cd integration && npx vitest run test/m5-web-e2e.test.ts   # ~12s
```

## 交付

- `git add <显式路径>`，commit 格式：`web(a4-deep): <subject>`
- 报告写 `docs/a3/report-deep.md`：收编清单（点位 → variant + 拆分决策）、钉扎检查记录、验证结果。
- 不 push、不 merge、不删 worktree。
