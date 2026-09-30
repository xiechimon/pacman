# B2 收尾：token-gate / machine-authorize 两面切 `components/ui` Button + Input（票 XMON-13）

两面（`overlay/token-gate.tsx`、`routes/machine-authorize-page.tsx`）剩下的 A3 原语消费点
（`ui/button` ×3、`ui/input` ×1）换成仓内 shadcn 件后的证据。范式沿 B2 热身片
（`docs/verify/426/README.md`）与第一片真域（`docs/verify/423/README.md`）。

> 目录名用 issue identifier（本票来自 Multica 票池，无 GitHub 编号可挂），不进 `docs/verify/<GitHub 票号>/` 序列。

## 迁移面（改动清单）

| 面 | 旧 | 新 |
|---|---|---|
| 门页输入 | `ui/Input`（A3 原语，36px 盒） | `components/ui/input` + per-face 取值钉 |
| 门页提交钮 | `ui/Button variant="primary" size="standard"` | `components/ui/button variant="brand"` + per-face 取值钉 |
| 授权页两处提交钮 | 同上（另挂 `w-full font-medium`） | 同上（`font-medium` 原样保留） |
| 文件头注释 | 两条已失效的保留理由（「components/ui 无 Input 件」「shadcn Button 无 brand primary 档」） | 删；改写为终态描述（换件后的取值口径与聚焦配方） |

无 CSS 文件改动（两面 per-face 样式已于 #426 随片退役）；**e2e spec 断言一行未动**。

## 取值口径（为什么把数值钉回 A3 档，不取 shadcn 默认档）

四条本仓既有口径同时成立：

1. `docs/spec/16`（铺开验收口径）像素纪律：逐域迁移是**纯结构**改动、零视觉重钉；per-face 数值仍是几何正本。
2. #417 施工事实：**圆角显式**写（shadcn 默认档半径 14/10px 与本仓不等值）、**focus 环保持仓级 #388 canon**。
3. A3 用户拍板三档（`docs/a3/diff-audit.md`）：按钮与可交互控件圆角一律 8px；按钮高度保留 26/28/32 三档；Input 高度跟实测 36px（DESIGN.md 已修正）。
4. 已迁面的按钮逐值先例：`board/todo-card` 钉 `h-[26px] rounded-md`、`board/tag-filter` 钉 `h-7`、`resources/parts` 用 `size="sm"`（半径落 `min(--radius-md,12px)` = 8px）+ `button.res-primary` 钉 `13px/400`——都钉回 A3 档。

故本轮一律「shadcn 件承载结构 + 工具类钉回 A3 实测档」。点名两处 shadcn 默认档与本仓 canon 的冲突：
`default` 尺寸半径 10px（`rounded-lg = var(--radius) = 10px`）、字号 14px（`text-sm`）。

钉法里有两处非平凡点，各带注解：

- **过渡窄写**（输入件）：TW 的 `transition-colors` 属性表含 `outline-color`，会把 focus 环吞进过渡初值——`ui/button.tsx` 的仓内偏离 2 已记同一坑，输入件照同法收窄。
- **提交钮加 `border-0`**：适配层默认 `border border-transparent` + `bg-clip-padding`，背景被裁到 padding box，钮面四周留 1px 透出卡底的缝。实测证据：不加时授权页两主题截图与基线**不**逐字节相同，加了才相同（下文像素差一节）。

## 证据清单

| 文件 | 内容 |
|---|---|
| `xmon13-token-gate-dark.png` | 门页（暗色默认）：全屏黑幕 + 360 宽 Card + 标题/引导语/标签/输入/提交钮（输入已 blur，非聚焦态） |
| `xmon13-token-gate-light.png` | 门页（浅色 `pacman-theme=light`） |
| `xmon13-machine-authorize-dark.png` | 授权页 idle 面（暗色默认）：画布底色铺满视口 + Card + 标题/引导语/全宽提交钮 |
| `xmon13-machine-authorize-light.png` | 授权页 idle 面（浅色） |

取数栈（沿 #426 的 live 栈口径）：`apps/server` 真进程（OS 分配空闲端口 + `PACMAN_HOME` scratch 目录 + `PACMAN_WEB_DIR` 指本 worktree 的 `dist` + `PACMAN_TOKEN` 设 = 鉴权开），Playwright 直连；门页从 `/app` 401 触发取得，授权页由 `localStorage['pacman.token']` 放行后走 `/app/machines/authorize`。每态读数前留 400ms 过渡落定。

## 三闸

| 闸 | 命令 | 实际输出 |
|---|---|---|
| typecheck | `pnpm -r typecheck` | shared / server / daemon / web / integration 五包全 `Done` |
| lint | `rtk proxy pnpm exec biome ci .` | `Checked 462 files` / **0 error** / 4 warnings + 25 infos（全部基线存量，本片文件零诊断） |
| e2e | `cd apps/web && E2E_PORT=8435 pnpm exec playwright test` | **483 passed / 1 failed（44.9s）** |

**唯一红灯不在本片**：`e2e/agent-detail.spec.ts:227` 断言的是团队密钥副文案的旧句
（"任务执行时将团队密钥以环境变量注入该 Agent 的 shell。"），而 `packages/shared/src/records/agent.ts:42`
现行文案是 #508（XMON-7）改成的按需取用句。`git show HEAD:apps/web/e2e/agent-detail.spec.ts`
证该断言在**未改动的 HEAD 上就已经过期**（`git log -S` 指向 commit `142c6cb`）；本片只触
`token-gate.tsx` / `machine-authorize-page.tsx` 两个文件（`git diff --stat` 2 files），与红项无因果。

域内四例专项（`token-gate.spec.ts` 4 例 + `machine-authorize.spec.ts` 4 例）**8/8 绿**，spec 零改动。

## 像素影响声明（两主题生产 DOM 读数）

读数 = `getComputedStyle` + `getBoundingClientRect`（live 栈生产 DOM）。未列出的项（背板、Card、输入静止态、按钮盒尺寸/底色/圆角/内垫/字级/行高/z-index）**逐值相同**。

| 面 | 项 | 旧（A3 原语） | 新（shadcn 件 + 钉） | 类型 |
|---|---|---|---|---|
| 门页输入 | 聚焦描边 | `border-color` `rgb(100,102,233)` = `--indigo-500` | 不动，保持 `rgb(39,39,42)` = `--card-border`（暗）/ `rgb(226,219,209)`（浅） | 配方类 |
| 门页输入 | 聚焦环 | `box-shadow: 0 0 0 1px var(--indigo-500)`，无 outline | `outline: 2px solid rgb(78,71,221)` = `--focus-ring`，offset 2；环形 `box-shadow` 宽 0 | 配方类：**归仓级 #388 canon**（与 #423 搜索框同法，见下文） |
| 门页输入 | 盒 / 底 / 描边 / 圆角 / 垫 / 字级 | `312x36 @579,360.25`；`rgb(24,24,27)`=`--surface`（暗）/`rgb(250,247,243)`（浅）；1px `--card-border`；8px；`0 12px`；14px/400/20px | 同 | 零漂移（钉回 A3 档） |
| 两面提交钮 | 盒 / 底 / 白字 / 圆角 / 垫 / 字级 | `312x32 @579,408.25`（门页）/ `@579,370.25`（授权页）；`rgb(78,71,221)`=`--card-button`；`rgb(255,255,255)`；8px；`0 12px`；门页 13px/400、授权页 13px/500 | 同 | 零漂移 |
| 两面提交钮 | 边框色 | `border-width: 0`，色 = currentColor 白 | `border-width: 0`（`border-0` 并除默认 1px 透明边框），色读作 `rgba(0,0,0,0)` | 无色差（宽度 0，色不可观测） |
| 两面提交钮 | 光标 | `pointer` | `default` | 全仓已迁面同态：实测 board 页四处 `[data-slot=button]` 均为 `default`（shadcn 件不自带 `cursor:pointer`），非本片引入 |

**唯一有意的可见改动 = 输入聚焦环**：A3 的 `1px --indigo-500` 发丝环换成仓级 #388 canon（2px `--focus-ring` + offset 2）。
理由（#426 已记账、#423 已执行）：A3 那条输入 focus 配方与 #388 家族律不同源，属迁移期该收的口；
#423 的搜索框（本仓唯一已迁输入件先例）即按 #388 canon 落，本片与它对齐。提交钮的聚焦环**两态相同**
（旧态由 app.css base 兜底给的就是 #388 canon，新态由 `ui/button` 显式携带）。

## 像素差实测（截图逐像素对拍）

同一探针脚本、同一 viewport（1470×705）、同一浏览器，先对基线（`HEAD` 两份原文件重构建）取一遍，再对改后取一遍：

| 面 / 主题 | 基线 md5 | 改后 md5 | 逐像素差 |
|---|---|---|---|
| machine-authorize · 暗 | `1ecab91368be37f4694ce6e5b2817572` | 同 | **0 px** |
| machine-authorize · 浅 | `79d8584447c5017837660a1d6a949d2e` | 同 | **0 px** |
| token-gate · 暗 | `3184fcb34d71a9940db50f33804eb1ed` | `656c48c0fb894d5e1966ea6bed670225` | 209 px / 1,036,350 px（0.02%），包围盒 `[579,410]-[890,437]`，单通道最大差 **2/255** |
| token-gate · 浅 | `0de8b3bb9c19e90a10a515b7adb54528` | `268d45fe191d42a9f4ff82819f67d1c7` | 208 px（0.02%），包围盒 `[579,410]-[890,435]`，单通道最大差 **2/255** |

授权页两主题**逐字节相同**。门页残余差全部落在提交钮矩形内、量级 ≤2/255，分布与字形反锯齿、圆角弧重合
（未再深挖到浏览器内部成因）。可控性核查：钮的盒 `312x32 @579,408.25`、`background-color`、圆角、内垫、
字级、行高、`border-width` 两版逐值相同；`transition-none` 与 `bg-clip-border`/`border-0` 三档开关实测对该
209 px 均无影响（授权页的 1px 透缝由 `border-0` 消除，已在上一节记），故不叠加无谓类。视觉上不可见。

## 重钉清单（#411 政策 4 形态）

来源口径 = #409 三面钉扎点清单；本片按四面全仓实测复核（grep：`token-gate*`、`authorize*`、两文件全部
`var(--…)`、`getComputedStyle`/`toHaveCSS`/`boundingBox`/`toHaveScreenshot`）。

| 钉扎面 | 类型 | 处置 |
|---|---|---|
| `token-gate.spec.ts` 13 处类名锚（`.token-gate` ×5、`-title`、`-input` ×2、`-submit` ×2、`-error` 等） | 类名锚 | **别名保留 → 零改动**（实测改后 4 例全绿，逐行未动） |
| `machine-authorize.spec.ts` 唯一类锚 `.authorize-backdrop` + 语义 locator 面 | 类名锚 / 语义 | **零改动** |
| web e2e / vitest / integration / server test 里的值探针与几何断言 | 值探针 | 两面 **0 处**（#426 复核结论在本片仍然成立；全仓 grep 结果为空集） |
| 视觉 spec（`visual-polish.spec.ts` / `sidebar-visual.spec.ts`） | 几何断言 | 两面 **0 处** |

**结论：本片重钉清单为空集**——两面钉扎 100% 是类名锚（别名保留律直接消化）；唯一数值改动（输入 focus 环）
没有既有探针引用它，故本片以 live 栈读数留档（上表），不新增 e2e 钉（新增面按 #411 政策 1 走语义 locator 的
权限属后续做该面新用例时）。

## 未迁残留声明（#421 验收第 5 件）

1. **A3 原语文件不删不改**：`ui/button.tsx` / `ui/button.css` / `ui/input.tsx` / `ui/input.css` 仍被其余未迁域消费
   ——改后全仓实测（`grep -rn "from '\(\.\./\)*ui/\(button\|input\)\.js'" apps/web/src`）：`ui/button` 16 个消费文件
   （16 处 import：pages ×4、detail ×6、chief ×2、routes ×2、board ×1、overlay ×1）、`ui/input` 5 处
   （overlays/search-panel、routes/api-key-create-dialog、routes/create-agent-dialog、resources 两个 create-\*-dialog）。
2. **授权页无输入件**：本页表单面是「无输入」的（idle/pending 只有钮），故只动 `ui/button`。
3. **token-gate 的 `token-gate*` / 授权页的 `authorize-*` 类名**原样留在元素上（e2e 定位锚，#411 政策 1），
   它们已不再承载任何样式。

## 未覆盖

- **verify-pacman 例行档案未做**：该 skill 的 features 面里仍没有 `token-gate` / `machine-authorize` 两条路径
  （#426 记录的同一缺口），起正式档案要先写新 driver（属另一票）。本片证据由 live 栈读数 + 逐像素对拍 + 两 spec 承载。
- **授权页 `confirm` 失败面（`.authorize-error`）**仍无 e2e（需 stub 409/404，缺口同 #426），本轮只覆盖 idle 面的纽形态。
- **门页提交钮的 disabled 态样式**未单列读数（本片未改其禁用档配方：`bg-(--primary-disabled)` + `disabled:opacity-100`
  与 A3 `.btn--primary:disabled` 同值；改动点只在盒装结构与光标，见上表）。