# A3-board：board 域收编到 ui/ 原语

把 board 域的散写 UI 收编到共享原语层，并执行圆角归一（6px → 8px，本域是主要差异面）。

## 先读（动手前全部读完）

- `AGENTS.md`（仓库规则：显式 git add、禁 inline import、注释风格）
- `apps/web/DESIGN.md`、`apps/web/src/ui/README.md`、`docs/a3/diff-audit.md`

## 范围（只准动这些文件）

- `apps/web/src/board/*.tsx`
- `apps/web/src/board/*.css`

## 收编动作

1. **按钮**：`board-new-task`（text 变体）、`todo-card-action--primary/--ghost`（card 26 档）、`board-guide`（icon 按钮，保留散写或就近归原语，报告记录选择）等 → `ui/button.tsx` 的 Button 组件。类名移除、样式收编进原语；e2e/parity fixture 若按类名选择器定位，**保留原类名作别名**（className 透传叠加，不删）。
2. **圆角归一**：本域按钮与可交互控件 `border-radius: 6px` → `8px`（用户裁决 2026-09-26）。装饰性小圆角（`.project-avatar` 4px、徽章 9999px 等）不动。
3. **卡片**：`.todo-card` / `.board-column` / `.board-notify-banner` 已是 edge 家族配方（ring+radius+card-shadow token 消费）——把散写三行收进 `Card` 组件或保留 CSS 类但确认值全部来自 token；若 TSX 结构改动大则记报告不进本票。
4. **chip**：本域无状态 chip（状态点在列头 dot），跳过。

## 禁令

- 不动 `apps/web/src/ui/`、不动 `tokens.css`——原语表达不了的形态收编到最近 variant 并在报告记录；缺 token 同理只记录。
- 不动其他域文件（detail/ overlays/ pages/ resources/ routes/ secondary/ chief/ overlay/）。
- 不动 parity 基准文件。
- 不 push、不 merge、不开 PR——worktree 与分支留主线收。

## 验证（全绿才交付）

```sh
pnpm lint && pnpm typecheck
PARITY_PORT=8391 pnpm parity   # 红项只允许来自圆角归一；其余红 = bug，修掉再交付
```

parity 若遇端口占用换 8395+，不得杀其他进程。同 worktree 内 parity 与 playwright 不并跑。

## 交付

- `git add <显式路径>` 逐文件 add，commit 格式：`web(a3-board): <subject>`
- 报告写到 worktree 内 `docs/a3/report-board.md`：收编清单（文件 原类名 → 原语 variant）、parity 红项列表、未决问题。
