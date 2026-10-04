# P1 证据：Herdr token 翻转 before/after（#788）

before 取自 P1 前 main（`origin/main` 一次性 worktree 栈，`launch.mjs`
默认端口），after 取自本分支同脚本栈。双主题 × 六组，每组各一张 1440×732
截图 + `contrast-*.json`（渲染对比度实测，better-colors 方法：以前景实际
落到的背景为准，透明逐层向上合成，`color-mix()` 的 `color(srgb …)` 计算值
按分数解析；阈值文本 4.5 / 非文本 3）。

拍摄脚本（lane 工具，未进仓）：Playwright 真用户路径（建任务 → 新任务弹层
→ 类型筛选弹层 → 项目新建页 → 项目设置删除确认 → 总管设置压缩模型菜单；
主题经 `localStorage pacman-theme` 切换）。

六组：`board` 看板 / `dialog` 新任务弹层 / `filter` 类型筛选弹层（含选中
勾选） / `buttons` 项目新建页（品牌提交钮 + 输入框焦点环） /
`danger` 项目删除确认弹层（只开不删） / `pick` 压缩模型菜单（选中行）。

## 对比度（after 实测 vs spec §5.1 门）

| 对 | 暗 after | 亮 after | 门 |
|---|---|---|---|
| 主钮字 brandBtn | 8.81（spec 8.81） | 5.41（spec 5.41） | 4.5 |
| 正文 cardTitle/bodyText | 13.67 | 14.40 | 4.5 |
| 次级字 secondaryText（`.prj-new-label`） | 10.41 | 8.02 | 4.5 |
| muted（`.todo-card-time`） | 7.64 | 6.02 | 4.5 |
| 危险字 solid（槽对，无渲染实例，token 级） | 4.92（spec 4.92） | 5.02（spec 5.02） | 4.5 |
| 危险字 tint（删除钮渲染对） | 4.57 | 3.92 FAIL | 4.5 |
| 选中对 selectedPair | 6.18（spec 6.19） | 4.59（spec 4.59） | 4.5 |
| 焦点环 focusRing（非文本） | 8.18 | 4.23 | 3 |

说明：

- 亮侧 danger tint（删除钮红字 `#c73e3e` 在 10% tint 上）3.92 是已知项：
  它沿用 Button destructive 变体的 tint 形态（红字 + tint 底），不是 §5.1
  的 solid 对（solid 对 5.02 通过）。before 同位 4.85 —— 翻转后弹层底变深，
  字色几乎不变，掉 0.9。P5（danger/焦点/环票）须收敛：要么把该变体改成
  solid 配 on-accent 字，要么把 tint 字加深。**本票不改**，只记录。
- `destructive-foreground` solid 在现行 UI 无渲染实例（全仓唯一消费是槽定义
  本身），按 token 级取值 4.92/5.02 记录；若 P5 给它找到渲染位，须重测渲染对。
- before 选中对实测 dark 5.21 / light 5.45，与 #751 记录值一致；after 6.18 /
  4.59。是同一槽对在新旧值下的两组数。

## e2e

`pnpm --filter @pacman/web e2e:affected`（共享面改动自动回落全量 93/93）：
首轮 713 passed / 6 failed —— 5 个旧值断言（segmented-controls、
spec-brief-card、brand-typo、overlay-focus、project-new-repo）按新值更新；
1 个真问题：chief-drawer-model 的选中行对比度自测 parser 读不懂
`color-mix()` 的 `color(srgb …)` 计算值（2.94 假红），parser 补 `color()`
分支后通过。末轮 **719 passed / 0 failed**。

## 范围外（留给后续 P 票）

- §2.7 阴影/动效 token（tokens.css 持值层）：本票只动了 drop-tint 色相
  （§2.3），`--dur-overlay` 200→150 与 H 档柔和投影/暗侧去投影留给 P6。
- mention `chip/icon--todo` 的 indigo 原始值有意保留（品类色系，与 skill 紫
  /agent 绿并列；改它会牵出 `#a855f7` 的去留，不属 P1）。
- 失能精确比（P0 暂定比）由 P5 实测钉死。
- `--menu-icon` 暗按图标 3:1 口径通过（见 contrast JSON）。
