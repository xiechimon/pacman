# #1007 证据索引（wave 1 L4 pages 域）

## prototype/（原型实审面，18 张）

fixture 栈（vite build --mode fixture + preview 8401）截图，覆盖本域全部迁移面：
设置页 Card 双模 / 项目页文件+任务面 / 定时页空态+卡片+表单双频档 / 新建项目
（基础+repo 菜单+gh picker+dir-browser）/ GitHub issue 弹层 / agent 详情三 tab
双模 / 创建 agent 弹层。实审裁决 2026-10-08：通过（外点穿透接受原生、plan
档保紫、形态清单过目）。

## probe/（验收模板 v3 项 2）

- `probe-dump.json` / `probe-comparison.md` — after 账（24 spec，180 视觉行
  KEPT 180 / DRIFT 0 / VIOLATION 0）。
- `probe-three-way.md` — #953 封版 → before（origin/main 034cd149 一次性
  worktree 栈 8404）→ after 三方 diff 人审表：值变化 20 站点逐条判定 + 退役
  43 / 新增 45 钉点清单（载体迁移 = #910 裁定 3）。

## contrast.md（验收模板 v3 项 3）

本域增量色对 6 组 × 双模 = 12 对实测（token hex 直取 + alpha 合成，WCAG
4.5:1 门）全 PASS；全局 109 对与 chip 五对槽引 #988 封账不重测。

## live/（验收模板 v3 项 4，verify-pacman 隔离栈 8795/5277）

| 目录 | probe | 结果 |
|---|---|---|
| 20261008-194354-project-new-form | drive-project-new-form | 19/19 |
| 20261008-194843-github-oauth-picker | probe-github-oauth | 13/13 |
| 20261008-194237-local-repos-api | probe-local-repos | 13/13 |
| 20261008-200136-1030-local-files | drive-1030-local-files | 20/20 |
| 2026-10-08T11-43-10-607Z-agent-identity | drive-agent-identity | 9/9 |
| 20261008-195647-1007-pages | drive-1007-pages（本票新增） | 13/13 |

drive-1007-pages = 本域 live 真用户路径：schedules 新建定时 registry Dialog
（开面/频率 Tabs/时 Select/保存落库 + SQLite schedule 行 + Esc/背板/X 三路
关闭）与设置页 Panel→Card 结构面（data-slot 计数 + 零 Panel 残留）。

## 探针维护（随本票）

- 新增 `drive-1007-pages.mjs`（SKILL.md 已登记）。
- drive-project-new-form：focus 环断言迁 registry 形（border-ring + ring-3，
  过渡落定等待）；.prj-new-* 别名（#946 已退役）迁语义载体；DANGER 值随
  #1002 色板翻值更新。
- probe-github-oauth：同上载体迁；认证钮按 e2e 同律钉 #prj-new-repo id +
  文案判面（label「仓库」关联命名覆盖可及名，project-new-github.spec 注）。
- drive-1030-local-files：文件|历史 seg 载体 role=button → role=tab。
