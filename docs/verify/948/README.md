# #948 域施工 · overlay/ 族 —— 验证证据索引

四张 per-face CSS（overlay.css 644 / mention-picker.css 446 / slash-menu.css 117 /
attachment-strip.css 115，计 1322 行）清零；18 处裸控件收编 17 处（余 1 处 =
new-task-dialog 的隐藏 file input，#855 deliberate-native 既有裁决）；chip 家族
皮肤迁 `overlay/mention-chip.ts` 单源（实底封版槽对，色槽映射暂定正典见该文件
头注）。验收模板 v2 七项的实物证据逐目录：

| 目录/文件 | 内容 | 验收项 |
| --- | --- | --- |
| `live-stack/drive-948-overlay/` | verify-pacman 定制 probe（脚本正本 `.claude/skills/verify-pacman/scripts/drive-948-overlay.mjs`）：live 栈真用户路径 **34/34 PASS**（result.json 逐条），10 截图（暗 8 + 亮 2）。含 utility 迁移的 computed 实物断言（frozen-anchor 39.5/96.5、行带 40/37/41/45、picker 400 宽居中 transform:none、close 28×28 贴右缘 4px、backdrop z=40）与清零运行时机制断言（vite 样式表枚举：四张退役 CSS 从未加载、退役选择器零驻留非 carrier 层）。 | 4 |
| `contrast-948.md` + `contrast.json` | better-colors 本域实测（脚本 `scripts/contrast-948.mjs`，token 单源 shadcn.css，WCAG 2.x 实算不许估）：**48 配对（暗 24 / 亮 24）全 PASS，FAIL 0**。首轮 4 FAIL（chip 15% tint 形亮模 4.0~4.3:1 不过文本 4.5 ×3、keep 钮 --text-dim 亮模 2.89:1）按 #908 裁决 2 换消费面槽引用后清零：chip 族改实底封版槽对（StatusChip §5.2 同形），keep 钮 --text-dim → --muted-foreground（#943 notify-banner 同治）。 | 3 |
| `probe-dump/` | #921 探针 dump 对照表（本域 12 spec）：**visual rows 38 — KEPT 38 / DRIFT 0 / VIOLATION 0 / NOT-RUN 0**。1:1 utility 迁移零漂移；probe-comparison.md 即人审 diff 记录。 | 2 |
| `build-artifact-grep.txt` | 编译产物 CSS 机制 grep（`pnpm --filter @pacman/web build` 后 dist/assets/*.css）：四张退役文件的特征选择器零命中；`.more-menu-item`/`.new-task-*` 仅存 motion.css #73 家族 hover 律与 app.css backdrop z 档（carrier 层，白名单在册）。 | 5 |
| `local-full-e2e.log` | 本地全量 e2e（合并前一次，E2E_PORT 8401）尾段。 | 1 |

e2e 重钉面（#910 裁定 1/2）：本域 13 spec 中 10 个有钉点耦合，全部随本 PR 换
语义载体（role/label/text 一级 + 6 个新 testid 二级：new-task-head /
new-task-tools / new-task-project-chip / new-task-machine-dot / new-task-spec /
attachment-pending / composer-float——共 7 个，盲点均为无 role 结构钩子）；
token-gate / dialog-viewport / collapse-family 三 spec 焦点集零命中（ inventory
实测），无重钉面。跨目录 spec（composer-inline-mention / composer-slash /
composer-paste / hotkeys）的类名钩子全部原样存活于 DOM（别名残留合法），
归属域票重钉，本 PR 未触碰。

栈坐标：live probe 跑在隔离栈 `VERIFY_PORT=8797 / VERIFY_WEB_PORT=5279`
（8791/5273、8795/5277 被邻道占用，未动邻道进程）；PACMAN_HOME =
worktree `.claude/verify-run/home` 全新库；probe 完成即 cleanup 回收。
