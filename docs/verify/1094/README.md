# #1094 verify 证据（总管切换器长列表冲出窗底、尾部条目点不到）

probe = `drive-1094-threads-scroll`（`.claude/skills/verify-pacman/scripts/drive-1094-threads-scroll.mjs`），
2026-10-09 双向跑：

| 组 | 栈 | 代码 | 期望 | 结果 |
|---|---|---|---|---|
| `before/` | server 8793 + web 5275（`/tmp/pacman-main-1094` 一次性 detached worktree，独立 PACMAN_HOME scratch） | `origin/main` @ `e87186d3` | `--expect=old`（反转 = 复现缺陷） | **14/14 PASS** |
| `after/` | server 8791 + web 5273（本 lane worktree，独立 PACMAN_HOME scratch） | 本 PR 分支（修复在位） | `--expect=new` | **21/21 PASS** |

铺底全走公开 REST（`drive-1034` 同律）：零 daemon、零 LLM、零 SQL——
`POST /chief/threads` 建 22 条线程（先 2 条短列面、再补 20 条长列面；标题 =
首句截断，`api-chief-threads.json` 回读为准）。交互面断言用 `page.mouse`
坐标级真实点击——`locator.click()` 对 fixed 祖先裁剪不做命中测试，改前也会
放行，测不出「点不到」。

## 票面验收 ↔ 证据对照

| 验收（票面原文） | 证据 |
|---|---|
| 线程数 ≥ 20 时列表在窗内封顶、可滚动到底 | after N3–N6：`max-height` 220px / `overflow-y` auto / scroll/client = 668/220 / menuBottom 376 ≤ winBottom 724；对照 before O3–O6：none / visible / 668/668 / **menuBottom 824 > winBottom 724**（`02-long-list-clipped.png` 肉眼同判） |
| 尾部条目可点击切换（截图 + 点击后 active 切换断言） | after N7a–c（滚到底尾行在滚动口内且在窗内，`02-long-list-bottom.png` / `03-menu-scrolled.png`）+ N8a–c（坐标级真实点击尾行 → 切换器收起、头部 chip 从首行 `…2…` 切到尾行 `…0…`、`04-after-tail-click.png`）；对照 before O7–O8：尾行底 820 在窗外、尾行中心点 `elementFromPoint` = **null**（命中测试物理打不到，「点不到」的量化实物） |
| 线程数正常（≤ 5）时视觉零变化（对照截图） | A1–A4 两面逐值相同（2 行 / 自然高 68px / 无滚动 / 宽 262）+ `before/01-short-list.png` 与 `after/01-short-list.png` **逐字节相同**（sha `80354773…`）；A5 钉封顶形态差异（none/visible vs 220px/auto——封顶在短列面不咬合） |
| 键盘可达：Tab 进列表后能滚到尾部条目并回车切换 | after N9–N11：Tab ×21 到尾行获焦（`05-keyboard-focus-tail.png`）、焦点行在滚动口内（带焦滚动生效）、Enter 后头部标题仍钉尾行线程（`06-after-enter.png`） |
| 新增一条 e2e 覆盖「多线程时尾部条目可点」 | CI 腿（不在本目录）：`apps/web/e2e/chief-thread-switcher-scroll.spec.ts` 三条——22 行封顶+尾行可点（修复前实测 1 failed：menuBottom 824 > 724）、116 短列面自然高零变化、Tab 到尾行在滚动口内；修复后 3 passed |

## 上限形态裁决（票面二选一）

选**形态 1（写死像素，照 slash-menu `max-h-[220px]`）**。形态 2 的
`max-h-(--available-height)` 实测不可行：该变量由 Base UI Positioner 注入到
它自己的 popup 上（全仓仅 `dropdown-menu.tsx` / `select.tsx` 在 Positioner 内
消费），本容器是普通绝对定位 div、不在 Positioner 里——两面探针 N13/O12 实测
`getComputedStyle(menu).getPropertyValue('--available-height')` 恒为空串，
挂上去等于没挂。

## 复跑配方

```sh
# after（修复分支检出，端口被占则顺延并同步 probe env）
node .claude/skills/verify-pacman/scripts/launch.mjs
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  node .claude/skills/verify-pacman/scripts/drive-1094-threads-scroll.mjs --expect=new

# before（origin/main 一次性 detached worktree + 独立端口）
git worktree add --detach /tmp/pacman-main-1094 origin/main
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  VERIFY_REPO_ROOT=/tmp/pacman-main-1094 VERIFY_PORT=8793 VERIFY_WEB_PORT=5275 \
  node /tmp/pacman-main-1094/.claude/skills/verify-pacman/scripts/launch.mjs
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  VERIFY_REPO_ROOT=/tmp/pacman-main-1094 \
  node <lane>/.claude/skills/verify-pacman/scripts/drive-1094-threads-scroll.mjs --expect=old
```
