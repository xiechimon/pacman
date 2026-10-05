# #873 验收证据索引 — 对话面统一（秒数 / 行尾控制 / 自动下滑）

驱动 = `scripts/evidence-873.mjs`：**同一个脚本、同一视口（1440×732）、同一组坐标**
跑两套栈——`before/` = `origin/main` 的一次性 detached worktree 栈，`after/` =
本分支栈。视频由 Playwright `recordVideo` 录制，ffmpeg 裁到会话列
（`crop=712:692:240:40`，8fps / 96 色 / 640 宽）后转 GIF。

场景铺底 = `scripts/seed-long.mjs`（公开 REST + 假机器认领在跑步；长线程 =
14 轮问答，列表必溢出；零 daemon 零 LLM）。栈 = 隔离 live 实例，
`before` 用 `VERIFY_PORT=8801` / `VERIFY_WEB_PORT=5283`，`after` 用 8796/5278，
各自 scratch `PACMAN_HOME`（全新库 seed）。

| 目录 | 内容 | 结果 |
|---|---|---|
| `after/` | 本分支代码，同脚本同视角 | 秒数 **2s → 5s → 8s**（真走秒）；行尾控制点击 **展开 1 个面板**；自己发送后视口 **落最新**（scrollTop −2922 → 0，newestVisible false → true） |
| `before/` | `origin/main` 同脚本同视角 | 秒数 **1s → 1s → 1s**（冻结，与用户原话一致）；行尾控制点击 **0 个面板**；自己发送后视口 **不动**（scrollTop −2904 → −2990，newestVisible 恒 false） |

数值逐条来自同一次运行的 `result.json`（GIF 与数字同一跑）。

## 三个症状 ↔ 根因 ↔ 修法

| 症状 | 根因（实测钉死） | 修法（单源） |
|---|---|---|
| 秒数卡 `1s` | `mapTranscript` 在**投影期**把 `Math.max(1, round((now − createdAt)/1000))` 算成一个死数；投影只在别的依赖变化时重跑，静默窗口无事件驱动重渲 → 冻结在首次算出的值（实测：8 次采样恒 `39s`；有 text_delta 时才会跳） | 投影只挂真实起点 `startedAt`；走秒归渲染层的 `useLiveSeconds`（1s 计时器），两面共用 |
| 行尾控制点不动 | 详情 streaming 行的 `›` 是**裸 `ChevronRight`**（无 button、无 handler）；总管同形行在 #822 已接真，详情面留了死形 | 共享 `LiveRow`：有披露面才是 button + chevron，没有就不渲形（#634「形必须带义」） |
| 要手动往下滑 | 详情列靠 `column-reverse` 纯布局贴底——**读者上翻后自己发出去的那条不会回到视野**（实测：发送后 scrollTop 恒负、newestVisible false）；总管面旧实现另有 80px 阈值写死在其内部 | 共享 `useChatFollow`：读者在原位时才跟随增长；**自己发送永远跳最新**——两面同一条规则 |

## 复现

```sh
# 本分支栈
VERIFY_REPO_ROOT=<repo> VERIFY_PORT=8796 VERIFY_WEB_PORT=5278 node <repo>/.claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=<repo> node docs/verify/873/scripts/seed-long.mjs      # 打印 {todoId,…}
VERIFY_REPO_ROOT=<repo> EVIDENCE_TAG=after node docs/verify/873/scripts/evidence-873.mjs <todoId>

# before 栈（origin/main）
git worktree add --detach /tmp/pacman-873-before origin/main && (cd /tmp/pacman-873-before && corepack pnpm install)
VERIFY_REPO_ROOT=/tmp/pacman-873-before VERIFY_PORT=8801 VERIFY_WEB_PORT=5283 node .../launch.mjs
VERIFY_REPO_ROOT=/tmp/pacman-873-before node docs/verify/873/scripts/seed-long.mjs
VERIFY_REPO_ROOT=/tmp/pacman-873-before EVIDENCE_TAG=before node docs/verify/873/scripts/evidence-873.mjs <todoId>
```

GIF = webm → `ffmpeg -i in.webm -vf "crop=712:692:240:40,fps=8,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer" -loop 0 out.gif`。

## 不在本目录的回归面

- `apps/web/test/chat-follow.test.ts` — 跟随规则的两轴几何（新增）。
- `apps/web/test/transcript-quiescent.test.ts` — F9/F18：活行挂起点而非预算死数。
- `apps/web/e2e/*` 全量 784 条（改动面含 fixtures / i18n / api / styles → 回落全量）。