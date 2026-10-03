# #703 产物闸验证证据

票：https://github.com/xiechimon/pacman/issues/703（B-C10 / B-C11 / B-C14）。
日期：2026-10-03。栈：verify-pacman 隔离 live 栈（server 8791 + web 5273 +
独立 PACMAN_HOME scratch，全新库），machine wire 直驱（claim / done /
upload-urls，与 daemon 上报字节同形）。

## 形态与结论（25/25 PASS，逐条见 result.json）

| 形态 | 驱动 | 结果 |
|---|---|---|
| M1 空方案（B-C10 弱模型） | withPlan 两轮 plan 步 done success 不上传 plan.md | 首轮 → #113 补写轮（claim 载荷 instruction 携补写指令 + continue session）；补写轮仍空 → todo failed，`errorMessage=规划未产出方案`，confirm 不可达，两轮封顶无第三补写 |
| M2 零改动（B-C11） | 直执行步 done success + hasChanges=false | todo failed，`errorMessage=构建零改动`，review 不可达 |
| M3 假完成（B-C14 run16 形状） | done success + sessionId、零 usage 零产物 | 同按失败收尾，不当 done |
| N 负例（有物过闸） | plan.md 经 upload-urls 上传 → confirm（hasPlan）；confirm → build done hasChanges=true → review（hasChanges） | 两道闸对有产物的步照常放行 |

## 文件

- `result.json` — 25 checks 逐条 ok + 栈坐标
- `board-failed-column.png` — 看板失败列：三形态卡落 failed
- `detail-plan-gate-failed.png` — 形态一详情页：失败行「规划未产出方案」可见，无确认入口
- `sqlite-truth.json` — SQLite 真值（todo 相位 / build.errorMessage / plan 行数）
- `drive-artifact-gate.mjs` — 本次驱动脚本（复跑：launch 后 `node <repo>/.claude/verify-shots/drive-artifact-gate.mjs` 或本目录副本）

## 单测与 e2e

- `apps/server/test/artifact-gate.test.ts`（10 条，票面五失败方式 + 负例 + restart 重试判据）
- `apps/server/test/plan-handoff.test.ts`（#113 语义随票更新：补写轮仍无 → 失败收尾）
- `apps/daemon/test/runner-artifact.test.ts`（8 条：no-repo plan.md 收集 / 空白文件不算产物 / 续轮指令投递 / Edit 大小写归一）
- `apps/web/test/transcript-user-words.test.ts`（F12：补写指令行按合成模板过滤）
- e2e 受影响面 `transcript-user-words.spec.ts` 6/6 绿
