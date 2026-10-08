# #1034 verify 证据（思考行宽截断：w-fit + nowrap 撑成整段文本宽）

probe = `drive-1034-thinking-truncate`（`.claude/skills/verify-pacman/scripts/drive-1034-thinking-truncate.mjs`），
2026-10-08 双向跑：

| 组 | 栈 | 代码 | 期望 | 结果 |
|---|---|---|---|---|
| `before/` | server 8793 + web 5275（`/tmp/pacman-main-1034` 一次性 detached worktree，独立 PACMAN_HOME scratch） | `origin/main` @ `6c75da9a` | `--expect=old`（反转 = 复现缺陷） | **13/13 PASS** |
| `after/` | server 8791 + web 5273（本 lane worktree，独立 PACMAN_HOME scratch） | 本 PR 分支（修复在位） | `--expect=new` | **17/17 PASS** |

铺底全走公开 REST + 假机器（`drive-chief-segments` 同律）：零 daemon、零 LLM。
C 面 = chief 抽屉（长思考段两条：CJK 65 字符 + 拉丁 130 字符，均 < PREVIEW_CHARS
= 150——**字符切片不触发**，能收住宽度的只剩 CSS）；D 面 = 详情对话（187 字符
> 150——切片先触发、CSS 截断接力）。

## 票面验收 ↔ 证据对照

| 验收（票面原文） | 证据 |
|---|---|
| 长预览在窄列里显示省略号（`text-overflow: ellipsis` 生效 + 可见宽 < 内容宽） | `after/result.json` C1/C2（CJK：ellipsis + hidden，scroll/client = 774/365）、C4/C5（拉丁：699/365）、D4/D5（详情：1810/625）；对照 `before/` C1o–C4o：`clip` 且 scroll == client（774/774——span 根本没有可溢出的盒） |
| 按钮宽 ≤ 列宽，页面级不出现横向溢出 | C3/C6：btn/col = 383/383（对照 before：CJK **792/383**、拉丁 **717/383**——票面 626/380 同款形态，本探针文本更长故更宽）；D6：643/643（before **1828/677**）；C7/D7 `documentElement.scrollWidth - clientWidth` = 0。注：改前两面页面级读数也是 0（上游滚动容器把横溢吃在容器内），页面级读数是护栏不是判据——真判据是钮宽/列宽与 ellipsis |
| 中英混排各一条 | C 面 CJK（无空格、无断行点）+ 拉丁（票面截图同款形态）各一条，两面三形截图 `01-chief-drawer.png` / `02-chief-cjk-button.png` |
| 详情面同源缺陷一并修（`transcript.tsx:441,443` 既无 flex 也无宽度上限，头像压在文字上） | D1/D2/D3：display flex、头像→文字列 gap = 11px（robot 行 `ml-[11px]` 同距）、`chat-text` max-width 643.477px（68ch）+ min-width 0px；对照 before D1o–D3o：block、**gap = -677**（头像压在文字上的量化实物）、max-width none |
| CI 能测到（长预览 stub） | e2e 面（CI 腿，不在本目录）：`chief-stream-markdown.spec.ts` F-R21 + `thinking-row-truncate.spec.ts` T1–T4，**修复前实测 4 failed**（clip ≠ ellipsis / block ≠ flex / max-width none / scroll==client）、修复后 23 passed（两文件全量） |

字符切片与 CSS 的分工口径（票面「切片可以留，宽度截断必须由 CSS 承担」）：
C8 钉「切片未触发时截断仍生效」（预览 = 全文 65/130 字符、无字面 …，钮宽照样
收进 383px）；D8 钉「切片触发后 CSS 接力」（151 字符预览以字面 … 收尾，可见宽
625 < 内容宽 1810）；D9 钉展开交互不被砸（pre 见全文 187 字符，`05-detail-expanded.png`）。

## 复跑配方

```sh
# after（修复分支检出，端口被占则顺延并同步 probe env）
VERIFY_REPO_ROOT=<检出> node <检出>/.claude/skills/verify-pacman/scripts/launch.mjs
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  VERIFY_REPO_ROOT=<检出> node <检出>/.claude/skills/verify-pacman/scripts/drive-1034-thinking-truncate.mjs --expect=new

# before（origin/main 一次性 detached worktree + 独立端口）
git worktree add --detach /tmp/pacman-main-1034 origin/main
cd /tmp/pacman-main-1034 && corepack pnpm install
VERIFY_REPO_ROOT=/tmp/pacman-main-1034 VERIFY_PORT=8793 VERIFY_WEB_PORT=5275 \
  node /tmp/pacman-main-1034/.claude/skills/verify-pacman/scripts/launch.mjs
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  VERIFY_REPO_ROOT=/tmp/pacman-main-1034 \
  node <检出>/.claude/skills/verify-pacman/scripts/drive-1034-thinking-truncate.mjs --expect=old

# 收尾：两套栈各跑一次 cleanup.mjs（按各自 VERIFY_REPO_ROOT），再
git worktree remove --force /tmp/pacman-main-1034
```

判读：`result.json` 的 checks 逐条 ok + `measurements.json` 的原始几何读数；
截图看 `01`（抽屉整面：两行思考预览收在列宽内出省略号）对 `before/01`
（预览整段直出、把钮撑到 792px 冲出抽屉列）。
