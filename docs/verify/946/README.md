# #946 域施工 · pages —— 验证证据索引

pages.css（2058 行）清零 + 本域裸控件收编 + chip/seg 消费面 utility 化 + 本域
spec 按 #910 重钉。所有证据由本 PR 分支上的脚本产出，SHA 永久链在 PR body。

| 文件 | 内容 | 验收位 |
| --- | --- | --- |
| `probe-dump/probe-comparison.md` | #921 工具对照表（19 spec、218 视觉行）：**KEPT 218 / DRIFT 0 / VIOLATION 0 / NOT-RUN 0** | 2 |
| `probe-dump/probe-dump.json` | 同次 dump 的结构化全量（sites/values/rows） | 2 |
| `contrast-946.md` | better-colors 本域实测（fixture 栈、双主题 84 对）：**168/168 PASS**；含两处换槽的实测数字与处置（Findings 节） | 3 |
| `contrast-light.json` / `contrast-dark.json` | 逐对原始测量（computed fg + 合成 bg + 比值） | 3 |
| `scripts/probe-946-contrast.mjs` | 对比度探针（#944 probe-944-contrast 引擎同形，目标面换 pages 域；`floor` 位承载 spec/22 §1.7 的 --text-dim 角色地板） | 3 |
| `live/drive-946-result.json` | live 栈真用户路径 **23/23 PASS**（schedules 建/删定时全链、SchedSelect 时/分/日期、hosted 项目文件/任务面、新建项目仓库菜单/本地面、设置危险区、双主题） | 4 |
| `live/*.png` | live 栈截图 17 张（1440×732，light/dark） | 4 |
| `live/schedules-api.json` | `GET /api/schedules` 真值（once 档、at/tz 落库） | 4 |
| `live/schedule-sqlite-rows.json` | `<PACMAN_HOME>/server/server.db` schedule 表行级真值 | 4 |
| `live/project-tree-api.json` | hosted 种子仓 tree 真值（空树种子提交 → 查看器占位面） | 4 |
| `scripts/drive-946-pages-live.mjs` | live 驱动脚本（隔离栈 8795/5277；**浏览钮刻意不点**——live 点它会弹宿主 macOS 原生对话框，dir-browser 面由 stubbed e2e 全链覆盖） | 4 |
| `build-artifact-grep.txt` | 编译产物判据：fixture dist CSS 里 pages 域 per-face 选择器 **0 处**、退役类名（含留存别名）CSS 出现 **0 处** | 5/7 |
| `local-full-e2e.log` | 合并前本地全量 e2e：**809 passed（2.2m，E2E_PORT=8399）** | 1 |

## 复现

```sh
# 1) 本域 + 跨域守卫 spec（190 条）
E2E_PORT=8399 pnpm --filter @pacman/web e2e project-empty-new-task \
  project-files-local-disabled project-github-issues project-new-dir-browser \
  project-new-fs-pick project-new-github project-new-repo \
  project-settings-dead-buttons project-settings-delete project-tasks-toolbar \
  file-viewer segmented-controls overlay-focus dead-buttons accent-typo \
  shell-consistency sidebar-seam chief-panel avatar-dicebear

# 2) 探针对照表（#921 工具）
cd apps/web && node e2e/probe-dump.mjs --specs <同上 19 个> \
  --port 8399 --out ../../docs/verify/946/probe-dump

# 3) 对比度（fixture 栈 serve 后）
cd apps/web && npx vite build --mode fixture && npx vite preview --port 8399 --strictPort &
BASE=http://localhost:8399 node docs/verify/946/scripts/probe-946-contrast.mjs

# 4) live 全链（隔离栈；先 lsof 查 8795/5277，占用即顺延，不杀邻道）
VERIFY_PORT=8795 VERIFY_WEB_PORT=5277 VERIFY_REPO_ROOT=$PWD \
  node .claude/skills/verify-pacman/scripts/launch.mjs
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  VERIFY_PORT=8795 VERIFY_WEB_PORT=5277 \
  node docs/verify/946/scripts/drive-946-pages-live.mjs
node .claude/skills/verify-pacman/scripts/cleanup.mjs

# 5) 债务棘轮重冻 + 编译产物判据
node scripts/ui-debt-gate.mjs --write
```

## 关键事实

- **等值迁移**：全部皮肤值 = 原 pages.css 规则的 token 槽等值搬运（#915 翻值后的
  spec/22 §1.7/1.8 正本），probe-dump 218 行全 KEPT 即其机械证明；唯一有意色面
  变化 = contrast-946.md Findings 的两处换槽（--text-dim→--text-tertiary 全域、
  GitHub 文件链接 --accent→--card-button），均按 #908 裁决 2 记录实测数字。
- **SchedSelect**（schedules-page 局部组合件）：Select 共享件无 className 透传位，
  本面几何无法上件——按 #908 comment-6001887439 的共享件 API 缺口出路，就地消费
  Button+FloatingShell+ClickCatcher 底座 + 零 CSS 工具类皮肤，components/ui/ 一字
  未动；role=listbox/option、aria-label、选中即关等 XMON-75 契约逐项等同，
  integration 面语义钩子零漂移（m5-web-e2e 3/3 PASS）。回收（Select 加透传位）报
  #908 归 #952。
- **类名留存**：跨域 spec（dead-buttons/overlay-focus/segmented-controls/
  accent-typo/avatar-dicebear/chief-panel/shell-consistency/sidebar-seam）与
  chief-drawer DOCK_ROWS 功能位钉住的 pages 类名以无规则别名形态留在 DOM
  （#943 先例；build-artifact-grep 证明其 CSS 面为零），摘除归 #952/#953 终账。
