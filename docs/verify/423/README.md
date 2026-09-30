# 第一片真域收编验证（票 #423）

resources 域（machines / providers / secrets / skills / mcp-servers）按 #422 裁决切
shadcn 件后的证据。范式沿 B1（`docs/verify/425/README.md`）与 B2 热身
（`docs/verify/426/README.md`）。

## 迁移面落地状态（#422 清单逐条）

| 面 | 落地 |
|---|---|
| 卡片系收编（裁决 a）：`res-card` / `res-rowcard`(+`--mcp`) / `res-model-row` | `components/ui/card` 底座 + 域内组合件 `RowCard` / `GroupCard`（parts.tsx）；`res-tile` 系为组合件内图标 tile，无 registry 对应件，保持 per-face span |
| `res-pill` / `res-tag` → Badge | `components/ui/badge` 底座，per-face 形留 resources.css |
| 原语消费点：Button（parts.tsx、providers-page.tsx） | 轨 A3 `ui/Button` → `components/ui/button` **brand 档**（新增变体，= A3 primary 等价：`--card-button` 实底 / `--text-on-accent` 白字 / disabled 换 `--primary-disabled`、无 hover 档，偏离注 3 记在 button.tsx） |
| 原语消费点：Chip（parts.tsx） | 轨 A3 `ui/Chip` → `components/ui/badge`（StatusPill） |
| 新增 registry 件：`tabs` | shadcn base-nova registry 拉取（`shadcn add tabs`），providers 页受控消费（`?runtime=` 驱动） |
| 新增 registry 件：`switch` | 同上拉取 + 仓内偏离一处：`thumbClassName`（Thumb 的 per-face 几何在域 CSS 时须能并掉默认 checked 位移，注记在 switch.tsx） |
| 新增 registry 件：`input` | 同上拉取；skills「搜索框」由 div+占位 span 换真 `Input`（#422：`res-search-ph` 连 CSS 都没有 → 零样式债） |
| 新增 registry 件：`empty` | 同上拉取；EmptyState 底座（子件 Header/Title/… 暂不消费，标题/描述保 `h2`/`p` 语义标签——Empty 子件是 div，换用即降级语义） |
| `label` / `textarea` / `checkbox` | **未新增**——#422 列的消费点（secrets 表单 / provider 表单）全在排除面 `create-*-dialog` 内（B1 承接壳、内容族归 B3），本片加件即死代码；随内容族迁移时落 |
| 3 处 DialogShell + skills 排序浮层 | 排除面（#422 裁 B1 承接，B1 已落）——本片 markup/CSS 零触碰 |

## 证据清单

| 目录 | probe | checks | 覆盖的迁移面 |
|---|---|---|---|
| `2026-09-30T05-48-22-175Z-providers-tabs` | drive-providers-tabs | 19/19 ok | Tabs 收编（tablist/切换/深链/URL 同步）、GroupCard 模型行、空态引导钮（brand Button）开 picker |
| `2026-09-30T05-48-24-520Z-provider-picker` | drive-provider-picker | 17/17 ok | topbar 新建（shell 面）→ picker 弹层（B1 面）→ 建 provider → 模型行投影 |
| `2026-09-30T05-48-27-666Z-machines-local` | drive-machines-local | 15/15 ok | Switch 收编全链：本机行 + per-runtime 开关点按 → PATCH enabledRuntimes → API/SQLite/UI 三向真值 |
| `2026-09-30T05-53-10-708Z-adhoc-resources` | ad-hoc（脚本沿 probe 配方） | 8/8 ok | skills live 行（RowCard 底座 data-slot=card）+ 真 Input 可键入；secrets 空态（Empty 底座 + brand Button）→ POST 密钥 → live 行；值只写不读 API 真值 |
| `2026-09-30T05-57-16-166Z-light-reads` | ad-hoc 浅色侧 | 5/5 ok | 迁移四面 light 主题 computed 读数对拍 token 正本（#426「浅色侧同步实测」纪律） |
| `20260930-134829-mcp` | drive-mcp | 8/13（红=环境漂移，见下） | mcp 行卡面（RowCard `--mcp`）；UI=API 行集自洽 |
| `mcp-host-drift-control` | drive-mcp 对照跑（主仓旧码） | 8/13（同五项红） | 证明 mcp 红与本片迁移无关 |

## live 栈取数纪律

栈 = verify-pacman 隔离栈（server 8791 + vite dev 5273 默认口，占用即换、不动他人
进程；scratch `PACMAN_HOME` = worktree `.claude/verify-run/home`，全新库 seed 用户
Owner，不碰 `~/.pacman`）。`VERIFY_REPO_ROOT=<worktree>` 且从 worktree 路径跑脚本
（SKILL worktree 车道律）；改码后重 launch。probe 跑序沿 SKILL spec-11 组纪律：
tabs（依赖全新库空态）→ picker → machines（幂等）。回环命令一律
`env -u http_proxy … NO_PROXY='*'` 前缀（本机代理拦回环假阳性，项目记忆在案）。

## drive-mcp 红态说明（环境漂移，非回归）

drive-mcp 以 **server 宿主机真实 `~/.claude.json`** 的 mcpServers 段为数据源，探针
期望值钉的是撰写时的宿主条目集。当前宿主已有 3 个条目（playwright / micu-image /
codegraph），5 项红全是「期望条目集过期」（行数 3≠2、按键名取条目 undefined）；
UI 面自洽项（页面渲染行数=API 行数、行标题=当前 config 键名、无新建入口、写面
404、SQLite 无表、密钥值不出接口）全 PASS。**对照实验**：主仓旧码（迁移前）起
第二套栈（8793/5275）跑同一探针 → **同 5 项红、同 8/13**（`mcp-host-drift-control/
result.json`），红态与本片零关联。探针期望值的宿主无关化归
`/maintain-verification-skill` 维护轮。

## drive-providers-tabs 探针竞态修正（本片唯一探针改动）

`tab-switch-url` 原实现「先等 URL、再单读 aria-selected」：本仓是 data router
（react-router v7 `createBrowserRouter`），路由态更新包在 `startTransition` 里，
`history.push` 恒先于 React commit 一拍（实测 0–50ms 窗口）——单读会读到 commit 前
旧值。旧 DOM 树 commit 快，该竞态靠时序侥幸不炸；shadcn Tabs 迁移后 commit 变长即
翻车。**修正**：URL 与 aria-selected 两条件并收进同一次有界 `waitForFunction`
（5s），断言语义不变（spec 11 A1：切换同步 `?runtime=` 且选中态翻转）且更强（合取
原子）；真断链仍红（超时路径保留）。e2e `providers-tabs.spec.ts` 用自动重试断言，
无此面，零改动。

## 验证口径

- **三闸**：`typecheck`（`pnpm -r typecheck`）全绿；`lint`（`biome ci .`，经
  `rtk proxy` 取真值——Bash 手跑 `pnpm lint` 有 rtk 重写假红，#426 取数纪律）
  零 error（5 warnings + 25 infos 全为基线存量，本片文件零诊断）；format 经
  `biome check --write` 落盘。
- **e2e 全量**：`E2E_PORT=8427`（跑前 `lsof` 查占用），fixture 构建单次，
  **404/404 绿**（#422 时点计数 336，其后 main 已增票）；域内 17 spec 子集先行
  148/148 绿。
- **spec 零改动**：#422 重钉预判的 13 个 spec（provider-add-dialog / dead-buttons /
  providers-tabs / skills-readonly / title-band-clicks / machines-local / brand-typo /
  dialog-viewport / provider-oauth / machine-add-dialog / secret-add-dialog /
  sidebar-seam / shell-consistency）**断言一行未动**（#411 别名优先的验收信号）。
- **web vitest**：10 文件 83 例全绿（i18n-coverage 含）；本片**零新增中文键**
  （搜索框 aria-label 复用 placeholder 既有键 `搜索技能...`）。
- **TW 工具类上机核对**（#426 纪律，类名锚 e2e 抓不到的面）：构建产物逐条 grep——
  `bg-(--card-button)` / `text-(--text-on-accent)` / `disabled:bg-(--primary-disabled)` /
  `disabled:opacity-100`、Switch/Tabs 消费点的 `border-0` / `transition-none` /
  `focus-visible:ring-0` / `data-checked:translate-x-0`（同 modifier 并除）全部生成，
  0 缺失。
- **tailwind-merge 合并事实**（#426 已档）：`RowCard`/`GroupCard` 的
  `flex-row`/`gap-0`/`py-0`/`ring-0` 经 `cn` 把 Card 默认档冲突类整体移除，生产 DOM
  className 不含被移除项；Card 其余默认（`rounded-xl`/`bg-card`/`text-sm`）由
  resources.css 的 unlayered per-face 规则恒压（`--radius-popover` 10px /
  `--surface-secondary`），生产读数见下。

## 重钉清单（#411 政策 4 形态）

| 钉扎面 | 类型 | 处置 |
|---|---|---|
| #422 预判 13 spec 的全部类名锚（`res-*` ×18 选择子、`mach-*`） | 类名锚 | **别名保留 → 零改动**（含 `.res-sort-*` 排除面原样） |
| `providers-tabs.spec.ts` 几何（`.res-col` x=456、tabs/head/card 同贴左缘、head/card 宽=列宽、tab 序） | boundingBox | **逐值保住 → 零改动**（#423 围栏项达成，无需走 #411 重钉口径） |
| `machines-local.spec.ts` switch 几何（36×20 / knob 16 / off 2 ↔ on 18 / radius 9999px / 双态底色分离 / 行高 60） | 值探针 | **配方类零漂移保住 → 零改动**（#422 预判需重钉；实测 Switch 适配层默认档溢出项——1px 透明边框、checked 位移、灰 focus ring——经 cn/CSS 并除后，rerun-switch 先例形逐值成立） |
| `dead-buttons.spec.ts:181` `.res-grow button` count=0 | 负向类名锚 | **零改动**。#422 裁决预判「shadcn Switch 渲染 button → 收窄为 `.res-row-text button`」；实测本仓底座 Base UI 的 Switch.Root 渲染 **span[role=switch] + 隐藏 input**（d.ts 与生产 DOM 双证），非 button——负向钉原意（行体无动作钮）原样成立，收窄不再必要（事实修正记于 machines-page.tsx 实现位注） |
| `sidebar-seam`（`.res-topbar` 底线=缝同色）/ `brand-typo`（`.res-back` focus 环）/ `shell-consistency`（`.res-fab`）/ `title-band-clicks`（五路由 hit-test）/ `dialog-viewport`（`.res-new`/`.res-add` 开层） | 值探针/行为 | **零改动**（shell 面本片未触） |
| integration 面 | locator | **0 处**（#422 预判复核成立，第二面不牵动） |
| live 探针 `drive-providers-tabs` tab-switch-url | 探针实现竞态 | **修正为合取有界轮询**（见上节；断言语义不变，非弱化） |

**结论：web e2e 重钉清单为空集**；唯一探针层改动是竞态修正，唯一裁决预判偏差
（dead-buttons 收窄）以实测事实修正并留档。

## 像素影响声明（零漂移，两主题生产读数）

#411：#435 值正本并流后「逐域迁移纯结构、零视觉重钉」——本片按此执行，无配方类
漂移。关键读数（dark / light，live 栈生产 DOM）：

| 面 | 读数 | 对照 |
|---|---|---|
| 行卡（RowCard） | bg `rgb(31,31,35)` / `rgb(241,237,231)` = `--surface-secondary`；border 1px `--border-default`；radius 10px = `--radius-popover`；h 64 | 迁移前 CSS 同值（Card 默认 `bg-card`/`rounded-xl`/`ring-1` 被 per-face 规则恒压或 cn 并除） |
| mcp 行卡 | h 62（`--mcp` 变体） | 同前 |
| 空态主钮（brand/sm） | bg `rgb(78,71,221)` = `--card-button` 两主题同值；白字；h 28；radius 8；13px/400 | = 轨 A3 primary/compact 逐值（含 `res-primary` 11px 垫 per-face） |
| tablist | w 768 = 内容列；底线 1px `--border-default`；tab 13px/400，未选 `--text-dim`、选中 `--text-primary` + 2px 指示条；tab 高 27 | 同前（line variant 的 w-fit/h-8/p-[3px]/after 指示条/flex-1 在 `.res-tabs`/`.res-tab` per-face 规则退回） |
| switch | 轨道 36×20、radius 9999px、off `--text-dim` / on `--card-button`、knob 16 白、left 2↔18 | = rerun-switch 先例形逐值 |
| 搜索盒 | 32px 盒形不变；真 input 内嵌零装饰（h 30 = 盒内容高），placeholder `--text-tertiary`、正文 `--text-primary`、focus 环 #388 律 2px `--focus-ring` | 盒形同前；「可键入」为新增能力（原装饰面） |

## 未迁残留声明（#421 验收第 5 件）

1. **3 个 create-\*-dialog**（machine / provider / secret）：壳已由 B1 迁
   DialogShell；**内容族**（`dlg-*` 散写、轨 A3 `ui/Input`、原生 checkbox 自绘勾）
   归 B3 弹层内容族，本片零触碰。
2. **skills 排序浮层**（`.res-sort` / `.res-sort-menu` / `.res-sort-row`）：B1 锚定
   面（FloatingShell 已收编），本片未动；`.res-sort` 仍是裸 button（排序钮形态
   registry 无对应档）。
3. **shell 散写**：`.res-new`（indigo 文字链钮）/ `.res-back`（图标锚）/
   `.res-add`（dashed 46px 大钮）/ `.res-topbar` 保持散写——非 A3 原语消费点，
   #422 清单未列，形态无 registry 变体承载。
4. **僵尸类未清**：`.res-row-more`（CSS 有、tsx 无）与 `.res-doclink` 负向钉引用
   原样（#422「顺手可清、非必做」→ 不做，避免与负向钉纠缠）。
5. **A3 原语文件不删不改**：`ui/button.css` / `ui/chip.css` / `ui/input.css` 仍被
   其余未迁域消费。
6. **Empty 子件**（Header/Title/Description/Content/Media）暂无消费点——registry
   件整件入库是仓内既有形态（popover.tsx 同例）；EmptyState 的 h2/p 语义标签有意
   保留（Empty 子件是 div）。
7. **skills 搜索过滤行为不实现**：#422 只裁「换真 Input」（零样式债），过滤无行为
   票；输入框真实可键入，键入不影响列表。

## a11y 面

- switch：手搓 span（自管 tabIndex/onKeyDown）→ Base UI 原语托管 role=switch、
  aria-checked、键盘激活；隐藏 input 提供表单语义。
- tabs：手搓 role=tablist/tab → Base UI Tabs（roving tabindex、←/→ 激活、
  aria-selected 托管）；aria-label 保留。
- 搜索：装饰 div → 真 `input[type=text]` + `aria-label`（placeholder 同键单源）。
- 空态：`h2` 标题 / `p` 描述语义未降级（见残留 6）。

## 未覆盖

- **mcp-servers 无绿 probe 档案**：drive-mcp 红为宿主环境漂移（对照在案），mcp 行
  卡面的绿灯证据由 e2e（dead-buttons mcp 专钉 `.res-rowcard--mcp` count=1 等）与
  drive-mcp 内 UI=API 自洽项承载；宿主无关化的 mcp probe 归维护轮。
- **`res-tag`（Badge 收编）无 live 专项读数**：live 全新库的 claude-code 槽位 tag
  可见于 `05-cc-tab.png`；字面/文本钉由 e2e providers-tabs（`toContainText
  ('default')`）承载，几何无钉扎面。
- **back 键跨 tab 回退**未单独取证（历史入栈语义与迁移前同构：selectRuntime 单
  通道未变；e2e 深链/刷新定位 PASS）。
