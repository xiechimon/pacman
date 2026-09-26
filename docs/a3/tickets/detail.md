# A3-detail：detail 域收编到 ui/ 原语

把 detail 域的散写 UI 收编到共享原语层；chip 五态收编是本域重点。

## 先读（动手前全部读完）

- `AGENTS.md`、`apps/web/DESIGN.md`、`apps/web/src/ui/README.md`、`docs/a3/diff-audit.md`

## 范围（只准动这些文件）

- `apps/web/src/detail/*.tsx`
- `apps/web/src/detail/*.css`（detail.css、overlays.css）

## 收编动作

1. **chip**：`.detail-chip--idle/plan/confirm/done` → `ui/chip.tsx` 的 Chip 组件（variant 同名映射）。e2e/fixture 若按 `detail-chip--*` 类名定位，**保留原类名作别名**叠加，不删。
2. **按钮**：`.dhead` 区动作钮、各弹窗 footer 的主/次钮 → Button 原语（弹窗族 `.dlg-form-primary` 等已是族类，可选择改接 `btn--primary` 或保留族类——报告记录每处选择；圆角归一 8px 已满足）。
3. **input/textarea**：composer 输入区、对话框字段 → Input 原语（36px 标准）。textarea 本票只收单行 input，多行保持散写并记录。
4. **圆角归一**：本域按钮/可交互控件 6px 等 → 8px；`dlg-close` 6px → 8px（裁决 #4）。装饰性圆角不动。

## 禁令

- 不动 `apps/web/src/ui/`、不动 `tokens.css`。
- 不动其他域文件。`ui/dialog.css`（弹窗家族）不在本票范围。
- 不动 parity 基准。不 push、不 merge、不开 PR。

## 验证（全绿才交付）

```sh
pnpm lint && pnpm typecheck
PARITY_PORT=8392 pnpm parity   # 红项只允许来自圆角归一
```

parity 端口占用换 8395+，不得杀其他进程。

## 交付

- `git add <显式路径>`，commit 格式：`web(a3-detail): <subject>`
- 报告写 worktree 内 `docs/a3/report-detail.md`：收编清单、parity 红项、未决问题。
