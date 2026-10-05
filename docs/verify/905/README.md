# #905 验收证据索引 — 规划黑盒 → 可读的「在做什么」

驱动 = `scripts/evidence-905.mjs`：**同一个脚本、同一视口（1440×732）、同一组
坐标**跑两套栈——`before/` = `origin/main` 的一次性 detached worktree 栈
（`/tmp/pacman-before-905`，8801/5283），`after/` = 本分支栈（8796/5278），
各自 scratch `PACMAN_HOME`（全新库 seed）。方法沿用 `docs/verify/873/`：
铺底全走公开 REST + **假机器**认领规划步（零 daemon 零 LLM），假机器按真实
daemon 的 wire 形状在 `POST /api/machine/tool/{stepId}` 上重放活动上报、
工具行回传与文本增量；Playwright `recordVideo` 录制，ffmpeg 裁到会话列
（`crop=712:692:240:40`，8fps / 96 色 / 640 宽）转 GIF。

| 目录 | 内容 | 结果 |
|---|---|---|
| `after/` | 本分支代码，同脚本同视角 | 活行标签逐相位可读：`处理中...` → `准备工作区...` → `正在连接模型...` → `模型思考中...` → `正在执行工具：bash` → `模型输出中...`；披露面板三行 `本步：规划中 / 执行机器：activity-probe / 最近信号：Ns 前`；静默期新鲜度诚实增长 **6s → 10s → 14s**（「在动 vs 卡住」判据）；activity 上报 **8/8 收下** |
| `before/` | `origin/main` 同脚本同视角 | 全程 8 个采样点恒 `处理中...`（用户报告的黑盒原样）；披露面板只有 `本步 / 执行机器` 两行，无新鲜度；activity 上报 **8/8 被拒（400）**——旧 server 无第四形，脚本如实记录不隐藏 |

数值逐条来自同一次运行的 `result-{before,after}.json`（GIF、截图与数字同一跑）。

## 症状 ↔ 根因 ↔ 修法

| 症状（票面） | 根因（baseline.md §B 钉死） | 修法（单源） |
|---|---|---|
| 「一直处于处理中，黑盒」 | 思考期 `thinking_delta` 与工具执行期（`toolcall_end` 无 result 的半段）在 runner 被丢弃，UI 无任何信号；规划步真实时长中位 15s、长尾 137s，长窗口全静默 | daemon 从**既有** StepEvent 派生相位（词表 15 件零改动），经 tool/{stepId} 第四形上报；server 盖 `{stepId, at}` 瞬态进会话流 `activity` 事件；活行标签 = 相位词（详情 + 总管共用 #873 `LiveRow`，不新起一套） |
| 「不知道是正常慢还是卡住」 | 秒数只能证明行活着，不能证明模型活着 | 披露面 `最近信号：Ns 前` 走表：daemon 只在**真事件到达**时上报（静默期零重发，无定时器），数字增长 = 卡住的诚实呈现（#471 律：没有真实时刻整行不渲染） |
| 「为什么久」无解释 | 自动重试 / 上下文压缩只进 daemon 日志 | `retrying(attempt)` / `compacting` 相位直接上行成可读标签 |

## 守住的既有律

- **#471**：新鲜度行只在有真实 `at`（server 盖章）时渲染并 1s 走表；fixture /
  旧 server / 静默窗口 = 整行缺席，绝不摆冻结数。走秒复用 `useLiveSeconds`。
- **#873**：两面一套 `LiveRow`——本票只加 `labelVars` 与共享 `LiveSignal` 行，
  行骨架 / 展开律 / 走秒律零复制。
- **词表锁**：`stepEventSchema` 15 件与 pi 1:1 锁不碰（vocabulary.test 不动）；
  activity 是独立 wire 形（machine-wire 第四形 + 会话流第五事件）。
- **旧↔新互通**：旧 daemon → 新 server = 无 activity 事件，UI 回落既有标签；
  新 daemon → 旧 server = 第四形 400，daemon fire-and-forget 只警告一次，步不受影响
  （before 栈的 8×400 即实证）。

## 复现

```sh
# after（本分支栈）
VERIFY_PORT=8796 VERIFY_WEB_PORT=5278 node .claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=$PWD EVIDENCE_TAG=after node docs/verify/905/scripts/evidence-905.mjs
# before（origin/main 一次性 worktree 栈）
git worktree add --detach /tmp/pacman-before-905 origin/main && (cd /tmp/pacman-before-905 && corepack pnpm install)
VERIFY_REPO_ROOT=/tmp/pacman-before-905 VERIFY_PORT=8801 VERIFY_WEB_PORT=5283 \
  node /tmp/pacman-before-905/.claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=/tmp/pacman-before-905 EVIDENCE_TAG=before node docs/verify/905/scripts/evidence-905.mjs
# GIF（两栈同方）
ffmpeg -i <tag>.webm -vf "fps=8,crop=712:692:240:40,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse" <tag>.gif
```

时长/信号基线数据（票面验收第 3 条）见 `baseline.md`。
