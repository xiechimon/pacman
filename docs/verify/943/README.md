# #943 board/sidebar 域施工 — 验证证据

票：#943（#908 波 1 · 验收模板 v2 首验车道）。本目录 = 验收七项中「探针重钉」「better-colors 实测」「verify-pacman 证据归档」三项的实物。

## 目录

| 路径 | 内容 | 对应验收项 |
| --- | --- | --- |
| `probe-dump/probe-comparison.md` | #921 工具对照表（18 spec、224 视觉行）：**KEPT 224 / DRIFT 0 / VIOLATION 0 / NOT-RUN 0** | 2 |
| `probe-dump/probe-dump.json` | 结构化全量 dump（sites/values/rows） | 2 |
| `contrast-943.md` | better-colors 双模 32 对实测表（渲染对 + token 解析对，WCAG 2.x 公式）：**0 未过**；含实测抓出并修掉的 notify-body 配对（2.73→10.12） | 3 |
| `live-stack/drive-943-board-sidebar/` | 定制探针（`drive-943-board-sidebar.mjs`，随本 PR 进 `.claude/skills/verify-pacman/scripts/`）：A 几何 4 项 + B 件槽 1 项 + C 交互真路径 14 项 + D 机制 2 项 + E 对比度双模 2 项 = **23 checks 全 PASS，failures 0**；截图 02–07（板面/rail/筛选面板/用户菜单，双主题）+ `result.json` + `contrast.json` | 3、4 |
| `live-stack/drive-board/`、`live-stack/drive-new-task/` | 既有 probe 回归（board 布局 / 新建任务全链落库）：PASS | 4 |
| `build-artifact-grep.txt` | 编译产物机制实物：`vite build --mode fixture` 的 dist CSS 上 grep——board.css 退役选择器 0 命中、`body[data-board-dragging]` 在场、工具类新载体在场 | 4、5 |

## 复现

```sh
# 探针对照表（#921 工具；直接调 node——pnpm 会把 `--` 原样转发撞 unknown flag）
cd apps/web
node e2e/probe-dump.mjs --specs board-dnd board-dnd-live board-docked-reflow \
  board-filter board-overflow card-press sidebar-nav sidebar-seam \
  sidebar-search-offboard sidebar-visual shell-consistency user-menu-nav \
  user-menu-trigger hotkeys notify-banner chief-fab theme-toggle footer-copy \
  --out ../../docs/verify/943/probe-dump

# live 栈（默认口被占则顺延，见 skill 端口纪律）
VERIFY_REPO_ROOT=<worktree> VERIFY_PORT=8795 VERIFY_WEB_PORT=5277 \
  node .claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/drive.mjs new-task
VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/drive-943-board-sidebar.mjs
VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/cleanup.mjs
```

## 口径备注

- 对比度 floor：文本 4.5、非文本 UI 3.0（better-accessibility）；正典 §1.7/1.8 门控对之外的**消费面自造配对**按本 floor 实测（notify-body 即此类，修法是换消费面槽引用，token 值零改动）。
- D1 机制扫描的两类合法排除：chief.css 的 `.board-shell > [data-base-ui-portal]` dock 复合规则（规则住址 chief.css = #950 域；`.board-shell` 是运行时钩子）与 Tailwind arbitrary-variant 编译产物选择器（`.\[...` 转义形，工具类不是 per-face CSS）。
- 拖拽倾角载体：board.css 的 `transform: rotate(2deg)` 迁 TW v4 `rotate-2` 后 computed 载体是独立 `rotate` 属性（`transform` 恒 none），与 dnd-kit wrapper 的 translate 合成像素同形；board-dnd 的抬升面探针按新载体钉 `rotate === '2deg'`（probe-dump 表内该行 KEPT）。
