# ui/ — pacman 共享原语层

DESIGN.md 轨 A 的代码侧落地。**新代码必须用原语，不新写 per-face 样式。**

| 原语 | 入口 | 形态 |
|---|---|---|
| Button | `ui/button.tsx` | variant: primary / ghost / danger / text；size: card(26) / compact(28) / standard(32) |
| Chip | `ui/chip.tsx` | 任务五态 idle/plan/confirm/done/failed + neutral |
| Card | `ui/card.tsx` | edge 家族配方；tone: card / inset / elevated |
| Input | `ui/input.tsx` | 36px 标准（实测族 #221） |
| DialogShell | `ui/dialog-shell.tsx` | 弹窗壳 + form 族（样式 = `ui/dialog.css`，含 dlg-form-* 类族） |

规则：

1. 原语表达不了的形态 → **先扩原语（加 variant），不绕过新写**。
2. per-face 类名仅在 e2e spec 钉死时保留（作为族类别名），见 dialog.css 头注。
3. 散写差异与归一裁决清单：`docs/a3/diff-audit.md`。
