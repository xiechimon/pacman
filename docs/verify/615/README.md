# #615 总管抽屉四连报 —— 验证证据索引

probe：`.claude/skills/verify-pacman/scripts/drive-chief-drawer.mjs`（本票随 PR 入库）。
栈坐标见各 `result.json` 的 `stack` 字段（隔离实例：server 8795/8798 + vite 5277/5280 + 独立 PACMAN_HOME）。

| 目录 | 代码面 | 结果 |
|---|---|---|
| `before/` | `origin/main`（一次性 worktree 起栈，取证后即删） | 5 项 FAIL = 死面台账：非 board 门控条设置死钮、模型行纯显示、行首无头像、复制裸 glyph、恢复/chevron 死 glyph |
| `after/` | 本 PR head | 12/12 PASS：主模型 显示→可改→落库（GET 封套 + SQLite 双真值）→回显→重载回显→默认行清回继承；头像闭环；死钮接通；死 glyph 出账 |

截图对照（PR body 内嵌同组）：

- `06-drawer-head.png`：抽屉头部元素截——before = `⊐` 坏 trace glyph + 纯显示行；after（首版）= 绑定 Agent 头像脸；after（返工版，用户裁决要运行时标记）= π 运行时字形 + 可控行。首版头像脸留档 `after/avatar-face-drawer-head.png` 供「原来的脸 vs 运行时的图」对照。
- `02-bound-model-row.png` / `03-model-dialog.png` / `04-after-pick.png`：主模型闭环三步。
- `01-offboard-settings.png`：非 board 面门控条设置落地 board 设置视图。
- `05-copy-feedback.png`：消息行复制钮 + 剪贴板读回对拍。

fixture 面回归：`apps/web/e2e/chief-drawer-model.spec.ts`（4 条）+ `shell-consistency.spec.ts` gear 全族 pin 更新；server 面：`apps/server/test/chief.test.ts` 新增 2 条（槽往返 + claim 载荷消费覆盖）。
