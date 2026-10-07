# #918 验证证据索引 — 活行与详情显示「读了哪些技能」（含被 deny 挡下的事件）

探针 = `.claude/skills/verify-pacman/scripts/drive-918-skill-facts.mjs`（真 daemon + 内嵌
stub LLM ×2 + Playwright 浏览器面，单相位全链）。运行日 2026-10-07；栈 = 本分支 worktree
（server 8791 / web 5273，scratch `PACMAN_HOME`）；daemon = 本分支代码
`tsx src/cli.ts start --foreground --server http://127.0.0.1:8791`，独立 scratch home
（`/tmp/pacman-918-daemon-home`）+ `PACMAN_SKILLS_DIR=/tmp/pacman-918-skills`（探针自动落
fixture：授权 `demo-skill` + 白名单外 `extra-skill`）。

**13/13 checks 全绿**（`result.json`），票面验收 seam 对照：

| 验收 seam | 证据 | 判据 |
|---|---|---|
| 真实用户路径：活行实时冒技能条目 | `live-panel.png` | 步运行中展开活行披露面，`▶ skill: demo-skill` 在列（data-testid `skill-line`）；wire 面 `activity-wire.json` 同证（activity 事件 `skills` 累计集 + tool 相位显示名 `skill: extra-skill`） |
| deny 事件同线可见 | `live-panel.png` | 同一披露面 `✕ skill: extra-skill（已挡下）`（#917 门控 read 的 tool error 拒绝）；SQLite 面 `messages-918a.json` 拒绝文案 `not in the agent allowlist` 落库 |
| 步骤详情页汇总 | `summary.png` | 步终态后汇总行「技能：demo-skill · 挡下：extra-skill」（data-testid `skills-summary`，从落库 toolcall 行派生——activity 瞬态清掉后仍在） |
| 对照组：无技能命中零条目 | `control.png` + `activity-wire-control.json` | 第二任务（另一 agent/stub，脚本零技能读取）：详情页无汇总行、无条目行；wire 有 activity 事件（5 件）但零事件携带 `skills` 字段 |
| stepId 过滤 | `activity-wire.json` + web 单测 W8 | 事件均盖本步 stepId；陈旧步 activity 不挂当前 streaming 项（`apps/web/test/activity-live-row.test.ts` W8 钉住消费侧） |

## 复跑配方

```sh
node .claude/skills/verify-pacman/scripts/launch.mjs            # VERIFY_REPO_ROOT=<worktree>
env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY NO_PROXY='*' \
  node .claude/skills/verify-pacman/scripts/drive-918-skill-facts.mjs
# 探针自 spawn/自回收：stub LLM ×2（ephemeral 端口）+ 真 daemon（--server 指本栈）
```

## 结果判读（复跑会撞的五个点，全部实测踩过）

- **agent 白名单写入走 server 现扫校验**：`POST /api/teams/:id/agents` 的 `skills` 经
  `filterKnownSkillIds(ctx.skillsDir)` 过滤——**server 端技能目录里没有的名字被静默丢弃**
  （首跑实测：daemon 本地有、server 没有 → `skills=[]` → 双技能全 deny，授权读也变拒绝）。
  fixture 必须双落点：daemon `PACMAN_SKILLS_DIR` + 栈 home 的 `skills/`。
- **step 成功终态词 = `done`**（shared `stepStatusSchema`），不是 `success`——920 探针里写
  `'success'` 是它只跑失败步形态碰不到成功分支的潜伏笔误，勿抄。
- **stub 的 tool call id 必须每次运行唯一**：message 表主键 = call id，而 upsert 冲突更新
  不动 `conversationId`——跨运行复用同 id 会把本轮工具行钉进上一轮会话（第四跑实测：本轮
  会话缺工具行 → 汇总行永不出现）。
- **daemon.log 行带 wall-clock 前缀**（#735）：判活等 `[wake] push channel connected` 要子串
  匹配，不能整行相等。
- **活行披露面展开态是组件内 state**：transcript 条目增减会重挂载 LiveRow 把面板合上
  （#905 面板同款既有行为，非本票范围）——探针轮询里反复重展开；另冷栈首访 vite 编译可达
  数十秒，探针先暖机再建任务，否则详情页落地时步已终态。
