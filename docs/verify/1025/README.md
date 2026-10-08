# #1025 验证证据索引 — 首轮规划提示词注入 plan.md 契约

探针 = `.claude/skills/verify-pacman/scripts/drive-1025-plan-first-round.mjs`（真 daemon + stub LLM ×2 + Playwright 浏览器面，自 spawn 自回收）。
运行日 2026-10-08；栈 = 本分支 worktree（server 8791 / web 5273，scratch `PACMAN_HOME` = `.claude/verify-run/home`）；daemon = 本分支代码 `tsx src/cli.ts start --foreground --server http://127.0.0.1:8791`（home `/tmp/pacman-1025-daemon-home`）；stub LLM = 探针内嵌（drive-904 同款 .mjs 移植，ephemeral 端口，每腿一只免轮次串扰）。

**结论：首轮 plan 步的会话 prompt 含 plan.md 契约（正典组合串形），首轮即落 plan 行 v1（无补写轮）；agent 首轮不写时链路行为有明确定义（#113 补写轮兜住、#703 闸红）。** 两遍独立运行均 **13/13 checks 全绿**（run A = 2026-10-08T14-04-09Z，run B = 2026-10-08T14-07-11Z，本目录归档 run B 全套 + run A 的 `result.json` 副本）。

## 两腿 ↔ 票面 seam 对照

| 腿 | 形态 | checks | 钉住的 hop（红即指认断点） |
|---|---|---|---|
| A | hosted repo，withPlan:true，stub 首轮即写 plan.md | 10 | 首步 kind=plan 且 claim 前零 prompt（server 不动，注入归 daemon）→ **stub 收到的真实请求体首条 user 消息 = 任务文本 + 契约指令组合串**（composeTaskPromptWithInstruction 单源形状，指令殿后；非读码「看着像」）→ 契约段逐字（plan.md + 四段名）→ plan 行 v1 首轮落库（content 字节等值、planDocId 指向）→ 恰一个 plan 步且 done（无补写轮）→ transcript wire 行 `user-<stepId>` = 同一组合串 → web confirm 卡「方案 · v1」+ 组合行不成用户气泡（#612 套娃负例）+ 右栏方案面 marker 全文 |
| B | 无 repo 裸目录，withPlan:true，stub 收到契约仍不写 | 3 | **负对照**：首轮请求同样携带契约（agent 是「被告知后仍不写」）→ #113 补写轮入队（第二个 plan 步、prompt = 补写指令）→ 补写轮仍无物 → #703 闸 1 失败收尾（phase=failed、plan 行 0、errorMessage=「规划未产出方案」）——「缺物必红」，A 腿绿不是表演型绿 |

真值三件套齐：截图（`leg-a-confirm.png` / `leg-b-failed.png`）+ 请求体 JSON（`leg-a-first-request-user-text.json` = expected/actual 对拍）+ SQLite 行（`leg-a-plan-row.json` / `leg-a-steps.json` / `leg-a-message-rows.json` / `leg-b-*.json`）。`result.json` = 13 checks 逐条 ok/label。契约期望文本在探针里独立重述一遍（与 shared 单源两边各自出现且逐字相等才证明注入的是正典契约，不是别的指令）。

## 复跑配方

```sh
# 栈（worktree 车道；端口撞了顺延 VERIFY_PORT/VERIFY_WEB_PORT，别杀邻道）
VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/launch.mjs
# 探针（自 spawn stub ×2 + 真 daemon，finally 全回收）
env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY NO_PROXY='*' \
  VERIFY_REPO_ROOT=<worktree> DAEMON_HOME=/tmp/pacman-1025-daemon-home-<新后缀> \
  node .claude/skills/verify-pacman/scripts/drive-1025-plan-first-round.mjs
node .claude/skills/verify-pacman/scripts/cleanup.mjs
```

同栈可重复跑（项目/agent/provider/stub 端口每 run 唯一后缀）；换 run 必须换 `DAEMON_HOME`（探针会 rmSync 重建）。

## 结果判读（复跑会撞的点）

- **B 腿的 failed 终态是预期**：负对照钉的是补写轮兜底 + 闸判别力，不是链断了。B2 红（无第二个 plan 步）才是补写轮断链。
- **背靠背重跑可能撞「僵尸 claim 窗口」**（本票实测两中两过，pattern = 上一个 daemon 被杀后 <75s 内起新 run）：daemon 被杀时其 claim 长轮询的 `waitWake` 仍在 server 侧挂着，到期（≤75s）后它替**死机**跑 `tryClaim`——新 run 的 pending 步被死机领走（waiter Set 按插入序，僵尸先注册先续跑），活 daemon 永远看不到该步，卡到 sweep 失败收尾。症状 = `waitFor timeout: leg A first stub request` + step 行 machineId 非空/终态 failed。**规避：杀上一个 daemon 后等 >75s（或重 launch 栈）再跑**。这是 server claim 面的真缝（建议另票：claimStep 第二次 tryClaim 前查请求 abort 态），不归本票。
- **message.content 是 drizzle json 列**：字符串值带引号存储（#902 坑），探针断言前 JSON.parse 剥引号——A5 的断言就是这么写的。
- **vite dev 冷编译**：探针先暖机 `/app` 再建任务（drive-918 同款）。
- 预算：A 腿 confirm 300s、B 腿 240s；暖栈实跑单 run 全程 <30s（stub delay 500–1500ms）。
