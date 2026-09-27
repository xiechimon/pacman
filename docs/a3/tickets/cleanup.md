# A4-cleanup：死代码清理

零冲突小票（与 PR #315 / ui 扩 variant 均不相交）。

## 范围（只准动这些）

- `apps/web/src/detail/detail.css`：`.history-*` 死选择器族
- `apps/web/src/styles/tokens.css`：`--new-task-primary-disabled`（:root 与 .light 两处）
- `apps/web/src/overlay/overlay.css`：296 行注释中对该 token 的引用措辞

## 动作

1. 删 detail.css 的裸 `.history-*` 规则族（2026-09-26 主线验证：tsx 侧消费的是 `dlg-history-*` / `prj-history-*`，无裸 `.history-*` 消费；动手前自己 grep `className="history-\|'history-` 复验一遍再删）。
2. 删 tokens.css 的 `--new-task-primary-disabled` 两处（2026-09-26 验证：全仓唯一命中是 overlay.css:296 的注释——顺带把该注释里已失效的 token 引用措辞清掉）。

## 禁令

- 不动其他文件；不动 ui/；不动 e2e/parity 基准。
- 不 push、不 merge、不删 worktree。

## 验证（全绿才交付）

```sh
pnpm lint && pnpm typecheck
PARITY_PORT=8395 pnpm parity   # 229/229 全绿——纯删死代码零视觉
```

## 交付

- `git add <显式路径>`，commit 格式：`web(a4-cleanup): <subject>`
- 报告写 worktree 内 `docs/a3/report-cleanup.md`：删行清单 + 验证结果。
