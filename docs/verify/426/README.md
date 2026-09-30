# B2 热身片收编验证（票 #426）

两件散件（`overlay/token-gate.css` 30 decl + `routes/machine-authorize.css` 41 decl）切仓内
shadcn 件后的证据。范式沿 B1（`docs/verify/425/README.md`）。

## 证据清单

| 文件 | 内容 |
|---|---|
| `426-token-gate.png` | Token 门页（暗色默认）：全屏黑幕 + Card 面板（360 宽居中）+ 标题/引导语/标签/输入/提交钮 |
| `426-machine-authorize.png` | 授权页（暗色默认）：画布底色铺满视口 + Card 卡（360 宽居中）+ 标题/引导语/全宽提交钮 |

## live 栈真人路径

栈 = `apps/server` 真进程（PORT 8461 + `PACMAN_TOKEN` 设 = 鉴权开 + `PACMAN_WEB_DIR` 指本
worktree 的 fixture 构建 `apps/web/dist` + scratch `PACMAN_HOME`，跑完即停、不碰 `~/.pacman`）。
先落 `/app` 取门页（401 触发），再 `localStorage['pacman.token']` 放行转到
`/app/machines/authorize` 取授权页。两页各出一张截图 + 一份 computed-style/几何读数。

| 面 | 读数（暗色默认，生产 DOM 实测） |
|---|---|
| 门页背板 | `position:fixed` inset 0（视口 1470×705）、`rgba(0,0,0,0.6)` = `--overlay-scrim`、`z-index:60` |
| 门页面板 | Card→`div`：360×223.5 @ x=555（居中）、`#1f1f23` = `--card`、radius 12px、padding 24px、环 `1px`（box-shadow oklab/0.1）+ `shadow-lg` 两层 |
| 门页字样 | 标题 `h1` 16px/600/24px `#fafaf9`(--foreground)；引导语 13px/400/19.5px `#d4d4d8`(--text-secondary)；标签 12px `#71717a`(--text-tertiary) |
| 门页输入/提交 | `ui/Input` 高 **36px**（不变）、radius 8；`ui/Button` 312×32、radius 8、13px、禁用底 `--primary-disabled` |
| 授权页背板 | `position:fixed` inset 0、`#09090b` = `--background`（画布第一档，board-main 同款） |
| 授权页卡 | Card→`div`：360 宽 @ x=555、`--card`、radius 12px、padding 24px、`gap:12px`、环+`shadow-lg`、`role="region"` + `aria-label="授权机器"` |
| 授权页提交 | **312×32 全宽**、底 `#4e47dd` = `--card-button`（品牌 indigo 保留）、字 `#fff`、radius 8、13px/**500** |

浅色侧同步实测一遍（`pacman-theme=light`），两主题值与下述漂移表一致。

**Card 默认类的合并事实**（防「合成 markup 复测」误读）：Card 自带
`py-(--card-spacing)` / `gap-(--card-spacing)` / `rounded-xl`，但组件经 `cn`
（tailwind-merge）合并 className——`p-6` / `gap-3` / `rounded-[12px]` 传入时**冲突的默认类被
整体移除**，生产 DOM 的 className 里不含被移除项（实测 class 串可证）。上表 padding 24px /
radius 12px / gap 12px 即生产读数，不是把两串类名手工拼在裸元素上的排序结果。
两面的 gap 位置差是结构性的：门页 Card 只有一个子节点（内层 `form`），12px 间隙由 form 的
`gap-3` 承载；授权页 Card 是多子节点，`gap-3` 直接挂 Card。

## 验证口径

- **三闸**：`typecheck` 全绿；`lint`（`biome ci .`）**零 error**——实测 `Checked 444 files`，
  5 warnings + 25 infos，全部为基线存量（本片文件零诊断）；pre-commit 钩子按同一链
  （format --write + ci + typecheck）实际跑过并通过。
  **取数纪律**：在 Bash 工具里手跑 `pnpm lint` 会拿到「Found 2 errors」的**假红**——rtk hook
  重写了 biome 调用（按 JSON reporter 解析、吞输出并置失败码，`~/.agents` 已记此坑）。真值以
  `rtk proxy pnpm exec biome ci .` 或 pre-commit 钩子内的原样执行为准。
- **e2e**：`token-gate` 4 + `machine-authorize` 4 + `overlay-focus` 6 + `providers-tabs` +
  `visual-polish`，**34/34 绿**（E2E_PORT=8425，单次构建）；修订后两面 spec 复跑再绿。
- **TW 工具类上机核对**：构建产物逐条 grep——本片新增工具类全部生成
  （`bg-(--overlay-scrim)`→`var(--overlay-scrim)`、`z-60`→`z-index:60`、
  `max-w-[calc(100vw-48px)]`、`rounded-[12px]`、`text-content-secondary`→`var(--text-secondary)`、
  `text-accent-rose`→`var(--rose-500)`、`break-all`→`word-break:break-all`、
  `bg-background`→`var(--background)` 等，0 缺失）。
  这条是类名锚 e2e **抓不到**的面（工具类没生成时 e2e 仍全绿），故单列。
- **spec 零改动**：`token-gate.spec.ts` 13 处类名锚一行未动（别名优先 #411 的验收信号）。
- **钉扎四面核对**：web e2e / integration locator / 视觉 spec 几何断言 / 值探针四面全仓 grep
  复核——两面在 integration 与视觉 spec 中零引用（结果为空集，但「查过」在此记账）。

## 重钉清单（#411 政策 4 形态）

来源口径 = #409 三面钉扎点清单；本片未照抄附录，按四面全仓实测复核（grep：`token-gate*`、
`authorize*`、两文件全部 `var(--…)`），结果如下：

| 钉扎面 | 类型 | 处置 |
|---|---|---|
| `token-gate.spec.ts` 13 处（`.token-gate` ×5、`-title`、`-input` ×2、`-submit` ×2、`-error`） | 类名锚 | **别名保留 → 零改动** |
| `token-gate.spec.ts` 非 CSS 面（localStorage 键 / `/api/teams` + Bearer 头 / SSE `?token=` / `.board-sidebar`） | 路由/存储/网络 | 零改动 |
| `machine-authorize` 全站 | **0 处**（web e2e / vitest / integration / server test 全无） | 新增语义 locator 面（`machine-authorize.spec.ts`，政策 1「新增面允许直接写语义 locator」；唯一类锚 `.authorize-backdrop` = 无语义角色的布局 wrapper） |
| 值探针（`getComputedStyle` / `toHaveCSS` / `boundingBox` / `toHaveScreenshot`） | 两面 **0 处** | 无需重钉 |

**结论：本片重钉清单为空集**——低 2 面钉扎 100% 是类名锚，别名保留律直接消化。

## 像素影响声明（逐条）

| 面 | 旧 | 新 | 类型 |
|---|---|---|---|
| 面板底（两面） | `--surface`（暗 #18181b / 浅 #faf7f3） | `bg-card`（暗 #1f1f23 / 浅 #ffffff） | 配方类：B 卡片底（+1 阶） |
| 面板描边 | `1px solid --border-default` | `ring-1 ring-foreground/10`（box-shadow 1px 扩） | 配方类（#139 edge 环 → B 卡片环） |
| 面板投影 | `--edge-shadow`（`0 5px 14px`） | `shadow-lg`（TW 两层） | 配方类 |
| 授权页背板 | `--surface-secondary`（暗 #1f1f23 / 浅 #f1ede7） | `--background`（暗 #09090b / 浅 #f2ede6） | 配方类：画布第一档。**暗色下旧值与 `--card` 同值 #1f1f23**——若沿用，面板与背板同色、只剩发丝环分层；换画布档拉开一档（board-main 同款语义），浅色侧差 1/255 不可见 |
| 圆角 | `--edge-radius` 12px | `rounded-[12px]` 12px | 等值零像素（B 已迁面 todo-card / dialog-shell Popup 同款字面量；`rounded-xl` 在本仓 = 14px，非 12） |
| 内边距 / 间隙 / 宽 / 上限 | 24 / 12 / 360 / `calc(100vw-48px)` | `p-6` / `gap-3` / `w-[360px]` / `max-w-[calc(100vw-48px)]` | 等值零像素（经 cn 合并，生产读数 24/12/360） |
| 门页背板 | `--overlay-scrim` | 同 token 直引（`bg-(--overlay-scrim)`） | 等值零像素 |
| 标题 / 引导语 / 标签 / 错误 / 元信息 | 16px600 `--text-primary`；13px1.5 `--text-secondary`；12px `--text-tertiary`；12px `--rose-500` | `text-base font-semibold text-foreground`；`text-[13px] leading-normal text-content-secondary`；`text-xs text-content-tertiary`；`text-xs text-accent-rose` | 等值零像素（token 正本同名同值，生产读数逐一比对） |
| 授权页提交钮 | 散写 `padding:8px 0` + `--card-button` + 500 字重 | `ui/Button primary standard` + `w-full font-medium` | 等值（高 ~32→32 定格、字重保 500、底色同 `--card-button`） |

按 #411 政策 2，以上四处「配方类」即本片全部可见漂移；无值探针需要重钉（该面 0 处）。

## 未迁残留声明（#421 验收第 5 件）

1. **输入**：`.token-gate-input` 仍走 A3 原语 `ui/Input`（36px 实测族）——`components/ui/` 无
   Input 件；输入样式本就住在 `ui/input.css`（A3 已收编），不在本片两个 CSS 文件的 decl 计数内。
   新增 shared 件属另一票。
2. **提交钮**：两面提交钮仍走 A3 原语 `ui/Button variant="primary" size="standard"`（门页原样；
   授权页从 8 decl 散写收编到此）。`components/ui/button.tsx` 的 variant 表无 brand primary 档，
   换 shadcn Button 即改填充色（`--card-button` #4e47dd → `--primary` 中性），属未请求的视觉变更，
   且与 dialog 族 footer 钮（仍 A3）脱族。shadcn Button 的 brand 档裁决属铺开期。
3. **焦点配方**：`ui/input.css` 的 `.input:focus-visible`（1px primary 描边 + 发丝环）与 #388
   家族律（2px `--focus-ring` + offset 2）不同源——unlayered 层恒压过 `app.css` base 兜底。
   随第 1 条一起留在 A3。
4. **相邻域共享件**：`ui/button.css` / `ui/input.css` / `ui/card.css` 仍被其余未迁域消费，
   本片不删不改。

## a11y 面

- 门页 `role="dialog"` + `aria-modal` + `aria-label` 由内层 `form` 上移到 Card（面板边界）；
  `form` 与 `type="submit"` 保留（回车提交语义不变）。
- 授权页 `<section aria-label>` → Card `div` + `role="region"` + `aria-label`（`section` 带名即
  region，故作 role 等价映射）；两页标题仍是 `h1`（未降级为 div）。

## 未覆盖

- **verify-pacman 例行档案未做**：该 skill 的 features 面里没有 `token-gate` / `machine-authorize`
  两条路径（现行 feature 名单无此二面），起正式档案要先写新 driver（属另一票）。本片证据
  改由 live 栈 ad-hoc 读数 + 两 spec 承载（门页的 API 真值面——401→token→200 + Bearer 头 +
  SSE `?token=`——由 `token-gate.spec.ts` 的真 server 断言覆盖），口径与缺口一并列在此。
- **授权页 `confirm` 失败面（`.authorize-error` + `role="alert"`）未落 e2e**：需要 stub 409/404
  的 confirm 端点；本片只覆盖 poll 驱动的四个相位，错误分支的样式未单独取证。