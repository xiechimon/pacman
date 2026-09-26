# A3-overlays：overlays/overlay 域收编到 ui/ 原语

把浮层域（搜索面板、chip-popover、plan-dropdown、board-guide、token-gate 等）的散写 UI 收编到共享原语层。

## 先读（动手前全部读完）

- `AGENTS.md`、`apps/web/DESIGN.md`、`apps/web/src/ui/README.md`、`docs/a3/diff-audit.md`

## 范围（只准动这些文件）

- `apps/web/src/overlays/*.tsx` + `overlays.css`
- `apps/web/src/overlay/*.tsx` + `overlay.css` + `token-gate.css`

注意：`detail/overlays.css` 与 `detail/overlays.tsx` 属于 detail 域，**不在本票**。

## 收编动作

1. **按钮**：浮层内动作钮（overlay-btn 等在 detail 域，勿碰；本域按实际散写收编）→ Button 原语。e2e 按类名定位的保留别名叠加。
2. **input**：搜索框、token-gate 输入 → Input 原语（36px）。
3. **圆角归一**：按钮/可交互控件 → 8px；装饰性圆角不动。
4. **card**：浮层面板若消费 edge 家族配方（ring+radius+shadow），确认值全部来自 token；结构收编 Card 组件仅限改动小的点，大改记报告。

## 禁令

- 不动 `apps/web/src/ui/`、不动 `tokens.css`、不动其他域。
- 不动 parity 基准。不 push、不 merge、不开 PR。

## 验证（全绿才交付）

```sh
pnpm lint && pnpm typecheck
PARITY_PORT=8393 pnpm parity   # 红项只允许来自圆角归一
```

端口占用换 8395+，不得杀其他进程。

## 交付

- `git add <显式路径>`，commit 格式：`web(a3-overlays): <subject>`
- 报告写 worktree 内 `docs/a3/report-overlays.md`。
