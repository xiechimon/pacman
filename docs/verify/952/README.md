# #952 散件收尾 — verify-pacman 证据索引

栈：verify-pacman 隔离 live 栈（server `VERIFY_PORT` 8791 + vite dev `VERIFY_WEB_PORT`
5273，`PACMAN_HOME` = worktree 内 `.claude/verify-run/home` 全新库，seed 单用户
Owner）。每个 probe 组独立 launch（全新库），跑完 cleanup 回收。视口 1440×732，
与 `apps/web/playwright.config.ts` 同口径。

## 定制 probe（本票新增）

| 目录 | probe | 结果 | 覆盖 |
| --- | --- | --- | --- |
| `drive-952-finale/` | `scripts/drive-952-finale.mjs` | **32/32 PASS**（result.json） | A dialog-shell 语义载体（role=dialog 可及名 / dialog-head·-body·-foot testid / 关闭钮 aria-label / 退场 visibility 桥 computed）；B create-agent 表单族几何（label 12px/18px/0.01em、Input 32 高、提交钮 w-full）+ 创建落 REST 真值；C agent 详情（模板行高 49/41、头像 64、进行中卡 radius 10 + canon 空态、运行时菜单右缘锚几何、名称/职责编辑落 PATCH 真值、Textarea 件收编、记忆配额头、权限开关翻转落库）；D account（语言行 57、语言盘选项行 border-0 = #947 遗留补丁实物、推送开关 role=switch）；E 组织图创建槽 svg 12px（#947 遗留补丁实物）；F 退役审计（退役选择器运行时零规则 ×32 名单、`--toggle-track`/`--toggle-knob` computed 为空，双主题）；G better-colors 对比度 6 对 token 解析实测双主题全过（contrast.json） |
| `drive-agent-detail/` | `scripts/drive-agent-detail.mjs` | **37/37 PASS** | #485 详情编辑面全链回归（卡链接 → 三 tab → 四处编辑各对 server 真值 → 创建弹窗 → 删除流程三真值）。随票维护三处 stale：`.team-agent-card` → testid（#947 欠账）、模型槽两条断言迁 #770/t-0024 后语义（两级选择 + model-sources 投影 + XMON-84 默认工具集） |
| `drive-943-board-sidebar/` | `scripts/drive-943-board-sidebar.mjs` | **27/27 PASS** | board 筛选面板回归——含全选行三态 checkbox（本票把该行从直消费 Base UI Root 回收进共享 Checkbox 件，`aria-checked` false/mixed/true 三态与满选清除律全过）；前置 = `drive new-task` 同栈落卡 |
| `drive-947-secondary/` | `scripts/drive-947-secondary.mjs` | **24/24 PASS** | secondary 域回归（team 组织图/语言 dropdown/推送开关/API 密钥全链 + 28 对对比度双主题）——profile-card 模板清零与 account 面 #947 遗留补丁后全绿 |
| `drive-new-task/` | `scripts/drive.mjs new-task` | **4/4 PASS** | 看板新建任务真值链冒烟（943 的前置，同栈证据一并归档） |

合计 **124/124 checks PASS**。壳级 `.dlg*` 类名 locator 已随 dialog-shell 别名
摘除从全部 probe 脚本退役（11 个脚本迁 `[role="dialog"]` / `button[aria-label=关闭]`
/ `dialog-head·-body·-foot` testid 载体，断言语义不动）。

## probe-dump 重钉对照表（#921 工具，#910 裁定 5 口径）

| 目录 | 时点 | 结果 |
| --- | --- | --- |
| `probe-before/` | 迁移前（main @ dff26b8e 树） | 811 tests passed；visual rows 805，KEPT 805 / DRIFT 0 / VIOLATION 0 |
| `probe-after/` | 迁移 + spec 重钉后（本分支树） | 811 tests passed；visual rows 805，**KEPT 805 / DRIFT 0 / VIOLATION 0**（与 before 同一行集：重钉只换载体、内联期望值零改动；全量 e2e 亦 811/811 绿） |

人审 diff = 两次 run 的 `probe-comparison.md` 对照；几何/皮肤等值迁移的判据
以 KEPT 行为准（期望值未动的行实测仍命中），重钉行（dialog 壳载体、
agent-create-model 的 foot/body 结构盒）在 after 表内期望=实测。
