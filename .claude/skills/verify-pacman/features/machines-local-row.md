# 机器页本机行 + per-runtime 品牌 mark（machines 页，spec 11 A8/A9/A7，#353/#354；#503 开关 → 品牌 mark）

用户打开机器页（`/app/resources/machines`）看到本机钉在列表首（hostname 显示、不可删），行内带 pi / Claude Code 两个官方品牌 mark：启用 = 品牌原色，未启用 = 35% 透明——`enabledRuntimes` 的 read-only 展示面；界面不提供启停控件（#503 摘除开关，字段与 PATCH /api/machines/{id} 保留，以后要接回控件另说）。「Pacman 托管机器」facade 行已除——托管形态在本架构不存在；用户真正拥有的是本机 + 自行接入的 LAN/VPS 机器（添加机器 = 在目标机器上跑同一 CLI，dialog 流程不变）。规格源：`docs/spec/11-模型服务与机器本地化.md`（A7-A9）。

## Sub-features

- `mach-local-row` 本机行钉列表首：server 启动 seed（`os.hostname()` 匹配已有行则补 `kind='local'`，无则建行，idempotent）。契约句柄：`.res-grow[data-machine-id][data-kind="local"]`，行文本含 hostname。
- `mach-local-nodelete` 本机行不可删（行内无删除控件/三点菜单，负向）。
- `mach-facade-gone` 「Pacman 托管机器」facade 行已除（负向；现状残留 = 前端渲染的固定装饰行，非库内数据）。
- `mach-marks` 本机行内 per-runtime 品牌 mark：`.mach-runtime[data-runtime="pi"|"claude-code"]` 内 `.mach-mark`（官方 SVG）+ `.mach-runtime-label` 名称；启用态由 `.mach-runtime--on` 承载 = `enabledRuntimes.includes(runtime)`（#503 read-only 展示，非控件）。
- `mach-marks-consistent` mark 亮度分态与 `GET /api/teams/:id/machines` 的 `enabledRuntimes` 一致，且与 SQLite `machine.enabledRuntimes`（JSON 列）同集。
- `mach-no-controls` 行内零交互控件（无 `role=switch` / `button`，#503 负向）。
- `mach-no-subline` 本机行无副行（#503：id 尾巴与并发上限显示整行摘除，无 `.res-row-desc`，负向）。
- `mach-kind-column` machine 表两列（A9）：`kind`（默认 `'remote'`，本机行 `'local'`）+ `enabledRuntimes`（JSON，默认 `[]` = 全关）——列名 camelCase（与既有列同形），是下文 SQLite 断言的可观测真值。
- `mach-persist` reload 后 mark 亮度分态与 API 仍一致。
- `mach-add-intact` 「添加机器」（`.res-add`）→ CLI 命令 dialog 流程不变（dialog 结构不动）。
- `mach-no-affordance` 行无 chevron 装饰（负向句柄 = 现状装饰类 `.res-row-chev`，A7）。

## How to get to it (user POV)

- 看板侧栏 资源 → 机器（`/app/resources/machines`）。
- 本机行 = 列表首行；右侧 mark 只读展示本机启用哪些 runtime，无控件。
- 添加 LAN/VPS 机器：「添加机器」钮 → dialog 给可复制 CLI 命令（在目标机器上跑）。

## Driving it with verify-pacman

Preconditions:

1. `launch.mjs` 起隔离栈，`doctor.mjs` 全 PASS。**无需 daemon**——本机行走 server 启动 seed 路径；daemon loopback enroll 落 `kind='local'` 是另一条路径，不在本 probe 覆盖（需真 daemon，属 stop-button 家族配方）。
2. 依赖实现面：machine 两列 migration（A9/T1）+ server 启动 seed 与 PATCH 写回（T2）+ 页面重写（T4）。

- **本机行 + marks 全链。** **跑法：** `node <skill>/scripts/drive-machines-local.mjs`（自足）——13 checks：页面就绪 → facade 负向 → API 本机记录（kind='local'，name=os.hostname() 精确匹配）→ UI 本机行钉首 + hostname 文本 → 不可删负向 → 两 mark 在位（mark + 名称）→ **UI=API 一致基线**（mark 亮度分态 vs enabledRuntimes，幂等：不假设初值）→ 行内零控件负向 → 副行已除负向 → SQLite kind 列 → SQLite enabledRuntimes 与 API 同集 → reload 持久 → 添加机器 dialog 流程不变 → chevron 负向。
- **真值。** `GET /api/teams/:id/machines` 记录（kind/enabledRuntimes 字段）+ SQLite `machine` 行（`SELECT kind, enabledRuntimes FROM machine WHERE id=?`）与 UI `.mach-runtime--on` 三向对照。
- **幂等**：同栈重跑不假红——期望值从 API 态推导，不写死「初始全关」。

## Gotchas

- **红态语义**：同 providers-tabs.md——probe 先行于实现，红 ≠ harness 坏；实现与 map 冲突先改 map 再动 probe。
- A9 列名 camelCase（`kind` / `enabledRuntimes`）；`enabledRuntimes` 是 JSON text 列，读回要 `JSON.parse`。
- runtime 词表 `'pi'|'claude-code'` 单源在 shared（与 model-sources runtime、providers tab data-runtime 同词表）；品牌 mark 原件来源记在 `apps/web/src/components/brand-marks.tsx` 头部。
- 本机行 name 断言 = `os.hostname()` **精确匹配**（A8 seed 以 hostname 键）；机器改名后旧行按 hostname 匹配补 kind，不重复建行（idempotent 语义归 T2 实现钉）。
- 「不可删」的 probe 口径 = 行内无 `aria-label` 含「删除」的按钮且无 `.res-row-more`——若实现给出删除以外的行内菜单，先改 map 再改断言。
- 添加机器 dialog 只轻断言（开窗 + 含 `pacman` 命令文本）——CLI 命令细节面归 fixture e2e，本 probe 钉「流程不变」不钉内容。
