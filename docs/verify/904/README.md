# #904 验证证据索引 — plan.md 落库通道全链（withPlan build → plan 表 → confirm 有物可看）

探针 = `.claude/skills/verify-pacman/scripts/drive-904-plan-chain.mjs`（真 daemon + stub LLM ×3 + Playwright 浏览器面，自 spawn 自回收）。
运行日 2026-10-07；栈 = 本分支 worktree（server 8791 / web 5273，scratch `PACMAN_HOME` = `.claude/verify-run/home`）；daemon = 本分支代码 `tsx src/cli.ts start --foreground --server http://127.0.0.1:8791`（home `/tmp/pacman-904-daemon-home{,-r2}`）；stub LLM = 探针内嵌（drive-918 同款 .mjs 移植，ephemeral 端口，每腿一只免轮次串扰）。

**结论：通道完好。** 两遍独立运行均 **20/20 checks 全绿**（run 1 = 2026-10-07T18-00-31Z，run 2 = 2026-10-07T18-01-38Z，本目录归档 run 2）。#892 量闸实证的「28 build / 0 行 plan.md / 0 样本」因此**不是通道断裂**，而是使用面无流量：web 的 todo 开始入口走总管编排回合（`use-new-task-surface.ts:152`），而 chief 派发提示词把 `withPlan:false` 写死成默认（`chief.ts:790`，8/8 实证）——「派发走 plan」的选择权归 #892 §6 建议 4（另票），不在本票地界。

## 三腿 ↔ 票面 seam 对照

| 腿 | 形态 | checks | 钉住的 hop（红即指认断点） |
|---|---|---|---|
| A | hosted repo，withPlan:true | 10 | plan 步入队 kind=plan → 真 daemon 认领（step.machineId）→ agent bash 写 plan.md → daemon 收集上传 → **plan 表落行 v1、content 与 agent 所写逐字节等值、build.planDocId 指向该行** → step done → phase=confirm + hasPlan=1 → REST `/api/builds/:id/plans` 200 恰一版字节等值 → web confirm 卡「方案 · v1」+ preview=plan.md 首个有效行 → 右栏方案面全文 marker 在屏 → 「打开方案」点击后仍持全文 |
| B | 无 repo 裸任务目录，withPlan:true | 7 | #703 修复面的活栈实证（此前无 repo withPlan 恒无方案）：同款落行字节等值 + confirm + hasPlan + REST + 卡面/方案面 |
| C | 负对照：agent 两轮都不写 plan.md | 3 | **缺物必红**（证明 A/B 绿不是表演型绿）：首轮无产物 → #113 自动补写步入队（第二个 plan 步、prompt 含 `plan.md`）→ 补写轮仍无产物 → #703 闸 1 失败收尾（phase=failed、plan 行 0、build.errorMessage=「规划未产出方案」、chip=失败、零方案卡） |

真值三件套齐：截图（`leg-{a,b}-confirm.png` / `leg-{a,b}-docpane.png` / `leg-c-failed.png`）+ API JSON（`leg-a-plans-rest.json`）+ SQLite 行（`leg-*-plan-row.json` / `leg-*-build.json` / `leg-*-steps.json` / `leg-*-todo.json`）。`result.json` = 20 checks 逐条 ok/label。marker 形 `PLAN-904-MARKER-{A,B}-<runTag>`（每 run 唯一，字节等值断言用它排除「读到自己上一轮」的假阳）。

## 复跑配方

```sh
# 栈（worktree 车道；端口撞了顺延 VERIFY_PORT/VERIFY_WEB_PORT，别杀邻道）
VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/launch.mjs
# 探针（自 spawn stub ×3 + 真 daemon，finally 全回收）
env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY NO_PROXY='*' \
  VERIFY_REPO_ROOT=<worktree> DAEMON_HOME=/tmp/pacman-904-daemon-home-<新后缀> \
  node .claude/skills/verify-pacman/scripts/drive-904-plan-chain.mjs
node .claude/skills/verify-pacman/scripts/cleanup.mjs
```

同栈可重复跑（项目/agent/provider/stub 端口每 run 唯一后缀）；换 run 必须换 `DAEMON_HOME`（探针会 rmSync 重建）。

## 结果判读（复跑会撞的点）

- **C 腿的「失败」chip 是预期**：负对照钉的是闸的判别力（无 plan.md 不得放行 confirm），不是链断了。C 腿红（phase=confirm 或有 plan 行）才说明 #113/#703 闸失效——那是真断点。
- **A 腿 hosted 依赖 server 自供给 bare repo**（`<PACMAN_HOME>/server/repos/<teamId>/<repoName>.git`，项目创建即 init + 种子 main）；git 走 per-step `issueStepGitCredential` 下发，探针的 api-key 仍带 `gitAccess:true` 兜底。
- **plan.md 字节等值含末尾 `\n`**：heredoc `cat > plan.md <<'EOF'` 写入 = 内容行 + 结尾换行；期望值按同构字符串拼（`planDoc()`），差一个换行 A3/B1 就红。
- **stub call id 必须每 run 唯一**（message 表主键 = call id，upsert 不动 conversationId——跨 run 复用会把工具行钉进旧会话；918 同款坑，探针已内建 runTag）。
- **vite dev 冷编译**：探针先暖机 `/app` 再建任务，否则详情页首访迟到、卡面断言在空 DOM 上超时。
- 预算：A 腿 confirm 300s、B/C 腿 240s；实跑单 run 全程约 3 分钟（stub delay 500–1500ms）。
