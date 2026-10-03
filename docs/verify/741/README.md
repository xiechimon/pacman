# #741 验收证据索引 — agent 身份可点进设置

probe = `verify-pacman/scripts/drive-agent-identity.mjs`（本票随票新增；铺底全走
公开 REST + 假机器认领/终稿上传/收尾，零 daemon 零 LLM，回合数据面与真机器同形）。
栈 = 隔离 live 实例（`VERIFY_PORT` 8791/8792 + `VERIFY_WEB_PORT` 5273/5274，
scratch `PACMAN_HOME`，全新库 seed），驱动 = 仓内 Playwright chromium 1440×732。

| 目录 | 内容 | 结果 |
|---|---|---|
| `after/` | 本分支代码，`--expect=new`（缺省）全链：身份 chip 渲染/hover 正典/点击导航/键盘 Tab+Enter/提及 chip 成链与导航 | **9/9 PASS**（`after/result.json`） |
| `before/` | `origin/main`（c91f3961）一次性 detached worktree 栈，同 probe `--expect=old` 取同等场景基线：身份 chip 不存在（头像惰性、无名字）、提及 chip 死 span 点击零导航 | **3/3 PASS**（`before/result.json`） |
| `reference/` | 参考站实拍（todos.dev，2026-10-03 ego-browser 实测，t-0090 出票线程 library 复用）：身份 chip hover / Agent 设置页落点 / 总管设置绑定行 / 换绑 picker | 正典依据，非断言产物 |

checks 明细（与 `result.json` 逐条对应）：

- `after`：seed 终稿行落库（REST 双真值）· N1 头像+名字 chip · N2 href 指
  `/app/resources/agents/<id>` · N3 hover 仅 cursor 无背景态 · N4 点击同 tab
  SPA 导航进三 tab 设置页 · N5 键盘 Tab 可达 · N6 Enter 激活 · N7 提及 chip
  成 anchor 指同一路由 · N8 提及 chip 点击导航。
- `before`：O1 身份 chip 零出现（旧态 robot 行头像不可点、无名字）· O2 提及
  chip = SPAN、无 href、点击后 URL 不动。

fixture/e2e 面回归不在本目录：`apps/web/e2e/agent-identity-chip.spec.ts`（8 条）
+ `chief-stream-markdown.spec.ts`（F-R1 href 钉 + F-R15 live mock 全链）。
