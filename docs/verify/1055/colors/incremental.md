# #1055 品牌墨角色改动面 — better-colors 增量实测

Formula: WCAG 2.1 relative luminance, `(Lhi+0.05)/(Llo+0.05)`，与
measure-912 canon 逐字节同法。Source: 两套 fixture 栈渲染后的 computed
token 值（probe 元素解 `var()`/`color-mix`，before = origin/main @
`5d9d91d6` 一次性 worktree 栈 :8412，after = 本分支栈 :8413），双模，
measured not estimated。工具 = `../../1054/probe/probe-evidence.mjs`，
原始输出 = `../../1054/measure-{before,after}.{md,json}`。
门：文本 4.5 / 非文本 UI 3。截图 = `../shots/`（mention-foot 与
account-hover 的 before/after 同场景对，双模）。

## 改动面 1：mention-picker insert 钮（品牌墨文字 → registry default 档）

| 面 | 主题 | 实测 fg | 实测 bg | ratio | 门 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| before：ghost 钮品牌墨文字 | dark | rgb(242, 148, 216)（--card-button） | 透明，落 --popover rgb(38, 34, 31) | 7.52 | 4.5 | PASS（E 色板已修对比度；**缺陷是角色**，非读数） |
| before：同上 | light | rgb(151, 34, 126) | --popover rgb(240, 235, 230) | 6.23 | 4.5 | PASS（同上） |
| after：default 档 label on primary fill | dark | rgb(31, 27, 24)（--primary-foreground） | rgb(238, 232, 228)（--primary） | 14.08 | 4.5 | PASS |
| after：同上 | light | rgb(250, 250, 250) | rgb(18, 15, 11) | 18.31 | 4.5 | PASS |

角色依据：#1055 分槽表「主操作按钮 → --primary（中性）」；disabled 走
registry opacity 降档（source-issue #1006 同款退役）。

## 改动面 2：account 名称值钮 hover（品牌墨 hover 换墨 → ghost 件默认 hover）

| 面 | 主题 | 实测 hover fg | 实测 hover bg | ratio | 门 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| before：hover:text-(--card-button)，bg 透明 | dark | rgb(242, 148, 216) | 落页面底 --background rgb(31, 27, 24) | 8.14 | 4.5 | PASS（缺陷是角色） |
| before：同上 | light | rgb(151, 34, 126) | --background rgb(246, 241, 236) | 6.57 | 4.5 | PASS（同上） |
| after：ghost 件默认 hover（accent 涂底） | dark | rgb(238, 232, 228)（--accent-foreground） | rgb(45, 41, 38)（--accent） | 11.87 | 4.5 | PASS |
| after：同上 | light | rgb(18, 15, 11) | rgb(234, 228, 224) | 15.17 | 4.5 | PASS |

裁决镜像：agent-detail 面 #980「hover 换墨配方退役，hover 涂底 =
registry 可供性」（AGENT_NAME_CLS 先例）；账户面 e2e 载体走 role/text
（#910 裁定 1），无类名钉移动。

## 登记面（台账 brandInkText 7 条 / 9 行）— spot 角色对比度复测

| pair | 主题 | fg | bg | ratio | 门 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| 铃字形 on --notify-icon-bg（badge-glyph） | dark | rgb(242, 148, 216) | rgb(64, 60, 57) | 5.2 | 3 (ui) | PASS |
| 同上 | light | rgb(151, 34, 126) | spot-soft 合成 srgb(0.892, 0.811, 0.845) | 4.99 | 3 (ui) | PASS |
| 勾 on popover 盘（selection-mark） | dark | rgb(242, 148, 216) | rgb(38, 34, 31) | 7.52 | 3 (ui) | PASS |
| 同上 | light | rgb(151, 34, 126) | rgb(240, 235, 230) | 6.23 | 3 (ui) | PASS |
| 勾 on dialog 底（selection-mark） | dark | rgb(242, 148, 216) | rgb(31, 27, 24) | 8.14 | 3 (ui) | PASS |
| 同上 | light | rgb(151, 34, 126) | rgb(246, 241, 236) | 6.57 | 3 (ui) | PASS |
| spinner on 流底（indicator） | dark | rgb(242, 148, 216) | rgb(31, 27, 24) | 8.14 | 3 (ui) | PASS |
| spinner on card 面（indicator） | dark | rgb(242, 148, 216) | rgb(38, 34, 31) | 7.52 | 3 (ui) | PASS |
| spinner 两底 | light | rgb(151, 34, 126) | rgb(246, 241, 236) / rgb(240, 235, 230) | 6.57 / 6.23 | 3 (ui) | PASS |
| crown on --spot-soft（badge-glyph） | dark | rgb(242, 148, 216) | srgb(0.261, 0.196, 0.223) | 5.7 | 3 (ui) | PASS |
| 同上 | light | rgb(151, 34, 126) | srgb(0.892, 0.811, 0.845) | 4.99 | 3 (ui) | PASS |
| 参照（非增量）：link 档 primary on card（#1006 R4） | dark / light | rgb(238, 232, 228) / rgb(18, 15, 11) | rgb(38, 34, 31) / rgb(240, 235, 230) | 13 / 16.14 | 4.5 | PASS |

全表 0 FAIL。暗侧最小裕量 = 铃字形 5.2 vs 门 3；亮侧最小 = crown/铃
4.99 vs 3。文本门侧最小 = 亮侧品牌墨旧文字位 6.23 vs 4.5——E 色板
（#988 定版）下品牌墨读数达标，**本票改的是角色错位**（正典槽用错
位置），不是读数不达标；两件事分开陈述，避免把角色修复误读成对比度
修复。

## 闸双向验证（本目录 gate-demo-*.txt）

1. `gate-demo-1-red.txt` — 消费文件塞一行未登记的 `text-(--card-button)`：G6 红，exit 1。
2. `gate-demo-2-green.txt` — 登记 role+reason+contrast 后：绿，exit 0。
3. `gate-demo-3-stale-red.txt` — 改对墨色但留台账条目：STALE 红，exit 1。
4. `gate-demo-4-green.txt` — 条目随修复同 PR 删除：绿，exit 0。
