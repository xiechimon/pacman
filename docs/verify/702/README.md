# verify 证据（#702：failed review 不锁死 done build 的合并路，B-C17）

一条探针全链跑完（`scripts` = `.claude/skills/verify-pacman/scripts/drive-failed-review-restore.mjs`，
verify 栈 8791/5273 + 独立 PACMAN_HOME scratch，hosted 项目形态）。**23/23 checks PASS**，
逐条对齐 `result.json` 的 ok 计数。

## 复现的 #519 死锁形态（修后栈上重建）

todo A：plan done → build done（真实 conv 分支 + commit `ccf9f305`，bare repo refs 可证）→
AI 审核步 done(failed)（`stream timeout` = 540s 墙形态）→ todo phase=failed。
修前行为 = `POST /api/builds/{id}/merge` → 409 `illegal phase transition: failed -> done`（#519 B-C17 原文；
本 TDD 红轮同样观测：单测先红后绿，见 `apps/server/test/failed-review-restore.test.ts`）。

## 出口 A：产品内合并（真实 UI 点击链）

`01` failed 详情页 → `02` 更多菜单「完成」重新可见（build 腿已交付；修前该钮禁用/消失）→
`03` 验收确认弹层 → merge API **202**（修前 409）→ `04` 恢复盘面 = review（恢复 ≠ done）→
机器领合并步 → done → `05` 终态 done + bare repo `main` fast-forward 到 conv HEAD
（`git-merge-landed-in-product`：合并 100% 在产品内落地，交付物不孤儿化）。

## 出口 B：只重跑审核（REST 动作面）

todo B 同形态到 failed → `POST /api/builds/{id}/steps {action:"review"}` **202**（修前 409
「当前相位 failed」）→ 恢复回 review + 新审核步 pending + build 腿一条 done 未动
（`06` 恢复后的审核关口）。`sqlite-rows.json` = 两个 todo 的 step 终态全列。

## 真值文件

- `result.json` — checks 逐条 ok/label + 栈坐标 + buildId/convSha。
- `api-todoA-*.json` / `api-buildA-*.json` / `api-todoB-restored.json` / `api-buildB-steps-restored.json` —
  死锁态与恢复/终态的 API 投影。
- `sqlite-rows.json` — step/todo 表行（better-sqlite3 只读）。
- `01…06 *.png` — 1440×732 截图（与 e2e 同口径）。
