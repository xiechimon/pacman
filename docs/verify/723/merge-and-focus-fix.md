# PR #723 re-fold：merge origin/main + 未保存闸焦点真回归修（证据）

分支：`hp/pacman/t-0053-b-656-close`，merge 提交 `b495e20d`（merge origin/main，
禁 rebase；7 个冲突文件全部取 main 新演进侧：z 阶梯 token、DropdownMenu 收编、
#682 机器 chip、#732 composer 提及线、#739/#741 chief 行）。

## 真回归与修法

- 现象：`e2e/hotkeys.spec.ts`「Tab cycles nothing while the 未保存闸 confirm
  layer is up」`expect(layer.locator('.new-task-discard-keep')).toBeFocused()`
  落空（`dead-buttons.spec.ts` #318 同断言同病）。
- 根因：#723 退役 overlay-mount 注册表后，闸层壳（FloatingShell sibling root）
  的缺省 initialFocus 不再送焦，焦点停在 composer。
- 修法（`apps/web/src/overlay/new-task-dialog.tsx`）：开层 effect 显式
  `keepBtnRef.current?.focus()`（父 effect 后于壳子树 effect，无竞态）；
  继续编辑三路（keep / Esc / 外点）经 `closeDiscard` 关层并焦点回 composer，
  还旧终态；drop 路关整 dialog，走 dialog 自身归还。Tab/⌘↵ 的
  `discardOpen` 缺席门不动。
- 失败方式清单：初始落点（修）、Tab 循环边界（缺席门已覆盖，无改）、
  Esc 归位（closeDiscard 回 composer）、他面契约（改动仅闸层，
  MentionPicker 的 initialFocus=false 与 dialog autofocus 不动）。

## 本地验证（E2E_PORT=8398，8399 被邻道占用）

- `hotkeys.spec.ts` + `overlay-focus.spec.ts`：35 passed（含落空那条）。
- `dead-buttons.spec.ts -g "gates unsaved closes"`：1 passed。
- 全量 `apps/web` e2e：**717 passed (2.3m)**，零失败。
- `pnpm lint`：通过（543 文件；告警不在本次改动面）。
- `pnpm typecheck`（web/server/daemon/integration 四仓）：全绿。
