# A4-cleanup 报告：死代码清理

分支 `a4-cleanup`。范围 = 票面三文件，`git diff --stat`：3 files changed, 3 insertions(+), 73 deletions(-)（净删 70 行）。

## 删行清单

### apps/web/src/detail/detail.css（-66）

裸 `.history-*` 规则族整组删除（含组注释 `/* 运行历史 rows (r8 57/77) */`）：

- `.history-row`
- `.history-row + .history-row`
- `.history-glyph`
- `.history-glyph--failed::before`
- `.history-glyph--open::before`
- `.history-row-text`
- `.history-row-title`
- `.history-current`
- `.history-row-sub`

### apps/web/src/styles/tokens.css（-5/+2）

- `:root` 的 `--new-task-primary-disabled: #373380;` 删除；其上 overlay batch A (#66) 注释中描述该 token 的从句（"the new-task disabled primary = primary at 50% over the footer surface (04 vs 14)"）一并删除，`--dialog-shadow` / `--danger` 措辞保留。
- `.light` 的 `--new-task-primary-disabled: #9f9ae2;` 删除；该处注释为多 token 共享描述，对其余 token 仍成立，未动。

### apps/web/src/overlay/overlay.css（-2/+1）

`:296` 注释改写为终态措辞：`.new-task-start:disabled 走原语 --primary-disabled。`——移除已删 token 的引用及「token 冗余待主线清理，tokens.css 本票冻结」过渡语。

## 删前复验（票面动作 1 要求）

- grep `className="history-` 与 `'history-` 于 `apps/web/src`（tsx/ts）：0 命中——tsx 侧消费的确为 `dlg-history-*` / `prj-history-*`。
- `grep -- '--new-task-primary-disabled'` 全仓（apps + packages）：仅 tokens.css 两处定义 + overlay.css:296 注释，无 `var()` 消费者。
- e2e / parity / integration 目录 grep 裸 `.history-`（排除 `dlg-`/`prj-` 前缀）：0 命中，无钉扎。

## 验证结果

| 闸 | 结果 |
|---|---|
| `pnpm lint`（biome ci） | 通过（exit 0；175 warnings 均为存量，非本票引入——本票只删 CSS） |
| `pnpm typecheck` | 通过（shared / server / web / daemon / integration 全 Done） |
| `PARITY_PORT=8395 pnpm parity` | 229/229 pairs green |

## 未决问题

无。
