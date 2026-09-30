# B2 · secondary 面原语收口验证（XMON-20）

secondary 域六个文件按 `docs/spec/16` 的 B2 · secondary 面裁决切 `components/ui` 件后的
证据。范式沿 B2 收尾（`docs/verify/xmon-13/README.md`）与第一片真域
（`docs/verify/423/README.md`）。迁移是**纯结构**改动——per-face 数值仍是几何与配色的
正本（§2 像素纪律），换成 shadcn 件只换承载结构。

## 迁移面落地状态（票面六文件逐条）

| 文件 | 落地 |
|---|---|
| `apps/web/src/routes/team-page.tsx` | 布局切换片两枚裸 `<button>` → `Button` ghost 档（role=tab / aria-selected / `team-layout-tab--active` 档位原样）；创建 Agent 槽 → `Button` ghost |
| `apps/web/src/routes/team-chart.tsx` | 虚线「创建 Agent」节点卡 → `Button` ghost（`justify-start` / `text-left` 顶回散写形） |
| `apps/web/src/routes/account-page.tsx` | 语言触发器 + 语言选项行 → `Button` ghost；推送通知钮 → `components/ui/Switch`（`thumbClassName` 递进 `.account-switch-knob`，并掉底座默认 checked 位移，避免与域 css 的 left/right 定位叠成双位移） |
| `apps/web/src/routes/api-keys-page.tsx` | 空态「新建密钥」裸钮 + `ui/Button` 复制钮 → `Button` brand / brand+sm |
| `apps/web/src/routes/api-key-create-dialog.tsx` | 创建/取消裸钮 → `Button` brand / ghost；`ui/Button` ×2（全选/清空）→ `Button` ghost + per-face 工具类；`ui/Input` → `components/ui/Input` + per-face 工具类 |
| `apps/web/src/routes/create-agent-dialog.tsx` | 提交钮裸 `<button>` → `Button` brand；`ui/Input` → `components/ui/Input`（几何仍由 `ui/dialog.css` 的 `.dlg-form-input` 承载） |

**边界口径（与 #423 同法）**：`per-face 规则仍是几何正本`——`secondary.css` 的
`.team-layout-tab*` / `.team-create-agent` / `.team-chart-create` / `.account-select` /
`.account-switch*` / `.lang-dropdown*` / `.keys-create` / `.apikey-form-create|cancel` 与
`ui/dialog.css` 的 `.dlg-agent-create` / `.dlg-form-input` **原样保留**。域 css 是
unlayered，按仓律压 Tailwind utility 层，所以契约面逐值不动；底座带进来的差额（按下位移
`active:translate-y-px`、`font-medium`、`px-2.5`、`gap-1.5`、`[&_svg]:size-4`、placeholder
色、line-height）在消费点就地并掉。**只有两处 `.btn.*` 选择子被删**
（`.btn.keys-once-copy`、`.btn.apikey-form-quickbtn`）——它们的 per-face 值改随消费点
工具类走，因为 `components/ui/Button` 不输出 `.btn` 类。

## 证据清单

| 目录 | probe | checks | 覆盖的迁移面 |
|---|---|---|---|
| `20261001-052002-api-key` | `drive.mjs api-key`（技能常驻 probe） | 6/6 ok | `.keys-create`（Button brand）开弹窗 → `.apikey-form-create`（Button brand）提交 → 一次性明文 `pacman_…` + 掩码行 + `GET /api/teams/{id}/api-keys` 掩码 + SQLite `api_key.keyHash` 非明文 |
| `20261001-052003-secondary` | ad-hoc（脚本沿 probe 配方，全文见下） | 15/15 ok | team 页布局切换片（Button ghost ×2：data-slot=button / variant=ghost、chart 空态、aria-selected）、创建 Agent 槽 → 弹窗提交（Button brand）→ `POST /api/teams/{id}/agents` → `GET members` 含新名 + grid 卡片 + SQLite `agent` 表 1 行；account 页语言触发器/选项行（Button）× 点选生效、推送通知 Switch（role=switch / aria-checked / `.account-switch-knob` 在位） |

live 栈 = verify-pacman 隔离栈（本次 `VERIFY_PORT=8793` / `VERIFY_WEB_PORT=5275`——默认
8791 被别的车道占，不动它；scratch `PACMAN_HOME` = worktree `.claude/verify-run/home`，
全新库 seed 用户 Owner，不碰 `~/.pacman`）。`VERIFY_REPO_ROOT=<worktree>` 且从 worktree
路径跑脚本；两 probe 之间**重 launch 过一次**——`api-key` 的「新建密钥」只在空态出现，
且 chart 空态断言依赖 0 成员。回环命令一律 `env -u http_proxy … NO_PROXY='*'` 前缀。

`doctor.mjs`：all PASS（server/vite 进程组存活、session=Owner、teams 非空、projects 200、
`/app` 200）。

## 像素对拍（#411 政策 4 的验收面）

`apps/web` e2e 的视觉 spec 钉的是分组几何，钉不到本次这批元素；本片另跑了一次
**逐元素 computed-style + 截图像素对拍**：fixture 构建（`vite build --mode fixture`
+ `vite preview`）下按 34 个靶点 × 两主题取 `getComputedStyle` 全量属性 + boundingBox +
截图，迁移前后各一遍。

- **迁移前 vs 迁移后**：68 个靶点里 65 个逐像素相同；余 3 个（`keys.onceCopy` 明暗各一
  + 图表域 1 个）差额 ≤1/255 或 ≤3/255。
- **噪声地板**：同一构建、同一份代码**连跑两次**，这 3 个靶点出现**逐计数相同**的差额
  （`keys.onceCopy` 6/1664 与 13/1664，图表域 3 个靶点 43 / 11985 / 11985 px，max 3）。
  即这 3 处是探针噪声（`team-org-chart` 页的渲染时序），**不是本片引入的差异**——迁移前
  vs 迁移后在这 3 个靶点上的读数与噪声地板逐值一致。
- 整屏 16 张（8 个 fixture 面 × 明暗两主题）的差异同样全部落在同一处噪声区。
- 元素级的 boundingBox 全部不变（32×24 的 chip、76 高的槽、56 高的虚线卡、29×16 的
  开关、88×30 的语言钮、416×32 的弹窗钮都在原位），computed style 的几何/配色属性
  逐值相同（差额只在 `flex-shrink` / `user-select` / `white-space` / `transition-*` 这类
  不改变渲染的属性上，且经元素级对拍确认不可见）。

对拍过程里抓到并修掉的底座差额（都已并进消费点工具类）：Button 的
`active:not-aria-[haspopup]:translate-y-px`、`font-medium`、`text-sm` 自带 line-height、
`gap-1.5`、`[&_svg:not([class*='size-'])]:size-4`（会盖过 `width={12}` 属性）、
`components/ui/Input` 的 `placeholder:text-muted-foreground`（旧面是浏览器默认的
`currentColor 50%`）、`components/ui/Switch` 的 Thumb checked 位移。

> 对拍脚本与 dump 是本次一次性产物，未入仓（`/tmp/probe-secondary.mjs` 类）；口径与
> 靶点清单见本节的读数描述，复核时可按同样方法重跑。

## ad-hoc probe 全文（可复跑）

栈 launch 后：

```sh
VERIFY_REPO_ROOT=<repo> node .claude/verify-run/adhoc-secondary.mjs
```

脚本要点（完整实现按 `drive.mjs` 的 `check` / `shot` / `dbQuery` 三件套）：进
`/app/team` → 断 `.team-layout-tab` ×2 的 `data-slot=button` / `data-variant=ghost` →
点 chart chip → 断 `.team-chart-empty` + `aria-selected` → 回 grid → 点
`.team-create-agent` → 断 `.dlg-agent-create` 空名禁用 / `data-variant=brand` → 填名 →
点提交 → `GET /api/teams/{id}/members` 找 `actor.displayName` → 断 grid 卡片 →
`SELECT count(*) FROM agent WHERE displayName=?` → 进 `/app/account` → 断
`.account-select` 的 `data-slot=button` + `aria-haspopup=listbox` → 开 `.lang-dropdown`
→ 点第二行 → 断触发器文本变化 → 断 `.account-switch` 的 `role=switch` / `data-slot=switch`
/ `aria-checked` 与 `.account-switch-knob` 计数 1。

secondary 面的**常驻** probe 与 feature map 条目尚未建（本片只落一次性 ad-hoc），归
`/maintain-verification-skill` 维护轮——下一张 secondary 面执行票开工前应先补。

## 验证口径（三闸 + 测试）

- **typecheck**：`pnpm -r typecheck` 五包全 Done。
- **lint**：`rtk proxy pnpm exec biome ci .` → 465 files / **0 error** / 4 warnings + 25
  infos（全为基线存量，本片文件零诊断）。
- **e2e**：域内 15 个 spec（team-create-agent / team-org-chart / account-team-cleanse /
  segmented-controls / dead-buttons / agent-create-model / dialog-viewport /
  avatar-dicebear / shadcn-primitives / visual-polish / brand-typo / notify-banner /
  escape-wiring / hotkeys / shell-consistency）**142/142 绿**（`E2E_PORT=8441`）；全量
  `E2E_PORT=8442 pnpm exec playwright test` → **487 passed / 1 failed**，唯一红是
  `e2e/agent-detail.spec.ts:227`（测试声明在 219 行）的过期文案断言——canon 文案由
  #508（commit `142c6cbf`）改过，该 spec 最后一次改动是 #530，**HEAD 上即红**，与本片
  7 个文件零因果（`apps/web/src/routes/agent-detail-page.tsx` 未被本片触碰）。
- **web vitest**：`pnpm test` → 99 文件 / 974 例全绿。
- **spec 零改动**：`apps/web/e2e/*.spec.ts` **一行未动**（#411 别名优先的验收信号）。

## 未迁残留声明（本片故意留旧的面）

- **`secondary.css` 的 per-face 规则全部保留**（见上「边界口径」）——本次换的是承载结构
  不是几何正本，`.team-layout-tab*` 等类名仍是 e2e 定位锚（#411 政策 1）。
- **`routes/` 与 `board/` 的其余裸控件不在本片**：`routes/agent-detail-page.tsx`（3 处）、
  `routes/agent-model-select.tsx`（3 处）、`routes/board-page.tsx`（1 处）分属第一片真域与
  #414 试点片，账在 `docs/spec/16` §5.3，本片不动。
- **`ui/` 原语未退役**：`ui/button.tsx` / `ui/input.tsx` / `ui/chip.tsx` 仍有 17 文件 / 18
  处消费点（B3 / B4 / #414 面），本片只清掉 secondary 域的 3 文件 / 4 处。
- **`Switch` 的焦点环与 `Input` 的聚焦环按仓级 #388 canon 走**（2px `--focus-ring` +
  offset 2）：旧面是浏览器默认轮廓（Input）与 `--indigo-500` 发丝环（旧 `.input`），
  属 B2 门页 #534 已定的同一处对齐，不在本片重钉。