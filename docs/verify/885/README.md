# #885 验收证据索引 — 活行靶高 20px / 320px 窄列横向溢出

两条 LOW 项的处置：**靶高修了**（详情面 + 总管面同一法），**320px 溢出记录在案**
（判定依据见下，改它属于另一张响应式设计票）。

## 项 1：活行命中盒 20px → 24px（WCAG 2.5.8）

驱动 = `scripts/probe-live-row.mjs`，同一脚本、同一视口（1440×732）跑两套栈：
`before/` = `origin/main` 一次性 detached worktree 栈（8798/5280），`after/` =
本分支栈（8797/5279），各自 scratch `PACMAN_HOME`，场景铺底 =
`docs/verify/873/scripts/seed-long.mjs`（在跑步的 build 步，零 daemon 零 LLM）。

| 指标 | before | after |
|---|---|---|
| 命中盒（border box） | y596 **h20** ×124 | y594 **h24** ×115（宽度差 = 走秒计数采样时刻不同） |
| 内边距 / margin-block | 0 / 0 | 2px 0 / −2px（等量互抵） |
| 标签墨迹 top | 595.5 | **595.5（纹丝不动）** |
| 会话区全部 30 行 row top | 基准 | **逐行相等（零位移）** |
| 墨迹锚定边缘点 (y=595) elementFromPoint | `div.chat-pin`（行隙，白点） | `button`（命中） |
| 该点点击后展开面板数 | 0 | **1** |

总管面同规（21px 自然行 → 24px，`e2e/chief-stream-markdown.spec.ts` F-R18 新钉
命中盒 24px + 墨迹内缩 1.5px）；F-R18 在 `origin/main` worktree 上先跑红
（received 21）记录改前值，改后跑绿。详情面 span 形态不是交互靶，保持 20px；
`spinner-live.spec.ts` L3 的 20px 内容高栅栏原样通过。

## 项 2：320px 窄列横向溢出 — 记录在案，本轮不修

`scripts/probe-narrow.mjs`（fixture 栈，detail scenario 26）：

| 指标 | 1440×732 | 320×732（before = after，本批未动） |
|---|---|---|
| 页面级横向溢出 | 无（1440/1440） | 无（内层滚动吸收） |
| `.chat-col` scrollWidth / clientWidth | 712 / 712 | **133 / 35** |
| 侧栏 | 240px | **仍 240px** |
| `aside.detail-right` | 488px | **仍 488px，右缘 728 > 320** |

**判定**：溢出不是会话列自己的病——是 240px 侧栏 + 730 fluid + 488px 文档栏的
三栏定格网格（参考站正典 `docs/design/todos.dev.md` grid 行）在 320px 下没有任何
窄视口策略。单修会话列改不了「侧栏吃掉 75% 屏宽」这个根因；正确修法是一个覆盖
全部路由的断点/收纳决策，属响应式设计票，不属本批观感打磨。数值与截图
（`before/detail-320-*.png`）留档备开票。

## 复现

```sh
# after 栈（本分支）
VERIFY_PORT=8797 VERIFY_WEB_PORT=5279 node .claude/skills/verify-pacman/scripts/launch.mjs
node docs/verify/873/scripts/seed-long.mjs                       # 打印 {todoId,…}
EVIDENCE_TAG=after node docs/verify/885/scripts/probe-live-row.mjs <todoId>
# before 栈：git worktree add --detach /tmp/<name> origin/main + corepack pnpm install，
# launch 时 VERIFY_REPO_ROOT 指过去；probe 用 VERIFY_RUN_DIR 指其运行目录、
# VERIFY_REPO_ROOT 仍指本仓（证据落本仓 docs/）。
```

320px 项：fixture 构建 + preview 后
`BASE=http://127.0.0.1:<port> EVIDENCE_TAG=before node docs/verify/885/scripts/probe-narrow.mjs`。
