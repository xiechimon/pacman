# #408 · shadcn/ui 现行形态调研（CLI / TW4 / primitives / token 规约 / monorepo）

> 票：#408（wayfinder 地图 #406 子票）。调研时点 2026-09-29。
> 方法：一手来源 —— CLI 源码（`shadcn-ui/ui` 仓 `packages/shadcn/src/`，main 分支当日快照）、官方 registry JSON（`ui.shadcn.com/r/**`）、官方文档站（`ui.shadcn.com/docs/**`）、Radix/Base UI 两仓提交与发布记录；外加 pacman 仓内实测核对。
> pacman 地基（已查实）：React 19.3.0 + Tailwind 4.3.3（@tailwindcss/postcss 接线）+ Vite，零 Radix 依赖；自研 `tokens.css`（dark 为 `:root` 默认态、`.light` 类切浅色）。

## 0. 结论速览

1. **shadcn 现行 = CLI `shadcn@4.x` + registry copy-into-project**。npm 包名已从 `shadcn-ui`（止于 0.9.4）迁到 `shadcn`（现行 4.21.0，2026-09-04）。组件源码仍拷贝进消费仓，不是运行时组件库；唯一对 npm 包的运行时引用是 CSS 里一行 `@import "shadcn/tailwind.css"`，可用 `shadcn eject` 内联后摘除。
2. **primitives 层三选一，官方默认与推荐 = Base UI**。`init` 交互首选项标注 `Base UI (Recommended)`，`--defaults` 等价于 `--preset=base-nova`。Radix 退居第三选项，且官方形态已切换为统一包 `radix-ui`（不再是 `@radix-ui/react-*` 散包）。Radix 仓库 commits 止于 2026-07-31，Base UI 月度发版活跃（v1.8.0，2026-09-04）。
3. **对现有 Vite + TW4 仓，`init` 侵入面可控**：写 `components.json`、向指定 CSS 文件做 postcss AST 级增量注入（默认不覆盖已有变量）、装依赖、生成 `lib/utils.ts`。**前置硬条件：tsconfig/vite 的 import alias 必须已配好**，CLI 检测到缺失直接报错退出，不代改构建配置。
4. **token 规约与 pacman 自研 tokens.css 变量名零冲突，但 dark 语义相反**：shadcn 约定 `:root`=light + `.dark` 类覆盖；pacman 是 dark 默认 + `.light` 类。接入的核心工作量在这一处语义翻转，不在变量合并。
5. **官方 monorepo 摆法 = `packages/ui` 无构建源码包**（裸 `exports` 导出 `.tsx/.ts/.css`），与「暂不抽包但结构就绪」路线天然契合：单仓期 aliases 指 `@/components/ui`，抽包期只挪文件改 aliases。
6. **国内网络：CLI 代码层完整支持代理（HTTP(S)_PROXY/ALL_PROXY socks），registry 域名可整体覆写（`REGISTRY_URL`）；但本机实测 7890 代理反掐 registry 请求（other side closed），`env -u` 代理变量直连可通。**

## 1. CLI init：流程与侵入面（现有 Vite + TW4 + React 19 仓）

### 1.1 命令面

`shadcn` CLI 4.21.0 命令集（`packages/shadcn/src/commands/`）：`init`（别名 `create`）、`add`、`apply`、`build`、`diff`、`docs`、`eject`、`info`、`mcp`、`migrate`、`preset`、`search`、`view`。

`init` 关键 flags（源码 `commands/init.ts` 与文档 `/docs/cli`）：`-t/--template`（next/vite/start/react-router/laravel/astro）、`-b/--base`（base/radix/aria）、`-p/--preset`、`--monorepo`、`--defaults`（= `--template=next --preset=base-nova`）、`--css-variables/--no-css-variables`、`--rtl`、`--reinstall`、`--force`。

### 1.2 现有仓的 preflight（`src/preflights/preflight-init.ts`）

在已有 package.json 的仓里裸跑 `shadcn init`，依次硬性检查，任一不过即报错退出（不改任何文件）：

1. `components.json` 已存在且未带 `--force` → 退出并提示先删再跑；
2. **框架检测**：从依赖识别 Vite/Next 等，识别失败（`manual`）→ 退出；monorepo 根目录另有检测，命中则列出可 init 的 workspace 目标并退出（引导去具体 workspace 跑）；
3. **Tailwind 检测**：v4 只需找到一个 tailwind CSS 文件（`@import "tailwindcss"`），v3 需 config + css 双件；
4. **import alias 检测**：tsconfig `paths` 或 package.json `imports` 必须存在可用别名前缀（如 `@/*`）——**这是 Vite 仓最容易卡的前置条件**（官方 Vite 安装文档 `/docs/installation/vite` 把 tsconfig `baseUrl/paths` + `vite.config.ts` `resolve.alias` 手动配置列为 init 之前的步骤）。

### 1.3 init 实际写入面

通过 preflight 后（`commands/init.ts` `runInit` → `addComponents`）：

| 写入对象 | 内容 | 覆盖语义 |
|---|---|---|
| `components.json`（新建） | schema 指向 `ui.shadcn.com/schema.json`；含 `style`（如 `base-nova`）、`tailwind.css` 路径、`baseColor`、`cssVariables: true`、`iconLibrary`、aliases 五元组（components/ui/lib/hooks/utils） | 已存在则需 `--force`；merge 时保留既有 `registries` 配置 |
| tailwind.css 指定文件（pacman 即 `app.css` 或 tokens.css，取决于 components.json 指向） | postcss AST 级注入，详见 §4.2 | **默认不覆盖已有声明**（`overwriteCssVars=false`；仅 `--reinstall` 或换主题时覆盖） |
| `lib/utils.ts` | 一行 `export { cn } from "cn"`（2026-09 起，`cn` 从仓内 helper 变为官方 npm 包，见 §3.4） | init 时新建 |
| 组件源码 | 按 aliases 落盘（默认 `@/components/ui/<name>.tsx`）；裸 init 会顺带装 style index 与一枚 `button` | init 恒 `overwrite: true`（仅限 init 自己装的那批） |
| `package.json` | 安装依赖：`@base-ui/react`（base 选型时）、`class-variance-authority`、`cn`、`lucide-react`、`tw-animate-css` 等 | 包管理器安装，尊重仓内 PM |

**对构建/配置文件零改动**：vite.config、tsconfig、postcss 配置均为 preflight 只读检查项，不满足即退出，不存在「帮你改坏」的路径。

### 1.4 `@tailwindcss/postcss` vs `@tailwindcss/vite`

官方 Vite 模板（仓内 `templates/vite-app`）用 `@tailwindcss/vite` 插件接线；pacman 用 `@tailwindcss/postcss`。CLI 对此无感知——它只定位 tailwind CSS 入口文件做 AST 注入，两条接线等价，**不构成阻塞**。

## 2. primitives 层：Radix vs Base UI

### 2.1 现行默认

`src/preset/presets.ts` `promptForBase()` 交互选项原文：

```
choices: [
  { title: "Base UI (Recommended)", value: "base" },
  { title: "React Aria", value: "aria" },
  { title: "Radix UI", value: "radix" },
]
```

`--defaults` 的官方释义（`init.ts` flag 帮助文本）= `--template=next --preset=base-nova`，base 缺省值在多处兜底为 `"base"`。文档站组件页 URL 形态 `/docs/components/base/<name>`，theming 文档的 components.json 示例 `"style": "base-nova"`——**官方叙事、默认值、文档展示三层全部指向 Base UI 为现行默认**。

三个 base 的定义在 `apps/v4/registry/bases.ts`：`base` → 依赖 `@base-ui/react`；`aria` → `react-aria-components`；`radix` → **`radix-ui`（统一单包）**。

### 2.2 两方维护状态（2026-09-29 实测）

| | Radix UI (`radix-ui/primitives`) | Base UI (`mui/base-ui`) |
|---|---|---|
| 最近 commit | **2026-07-31**（约两个月无活动） | **2026-09-29**（当天仍在提交） |
| 发布形态 | 无 GitHub release，走统一 npm 包 `radix-ui`（实测组件依赖 `^1.6.7`） | 月度节奏：v1.6.0（06-18）→ v1.7.0（08-04）→ v1.8.0（09-04） |
| 在 shadcn 的位置 | 第三选项，遗产兼容 | 默认 + Recommended |

### 2.3 官方迁移指引

- **新项目**：无需迁移，`init` 直接选 base。
- **已有 Radix 组件的仓**：重新 `init --base base`（或交互切换），CLI 检测 base 变更时显式警告 `Components outside the ui directory that depend on radix primitives may need manual updates`（`init.ts` `confirmBaseSwitch`），确认后按新 base 重写 `ui` 目录组件；ui 目录外手写引用需人工改。
- **散包→统一包**：`shadcn migrate radix` 把 `@radix-ui/react-*` import 改写为 `import { Dialog as DialogPrimitive } from "radix-ui"` 并安装统一包（CLI 文档 `/docs/cli#migrate-radix`）。
- **Tailwind v3 旧栈**整体归档至 `v3.shadcn.com`（文档站 `/docs/legacy` 页明示）。

### 2.4 旁证：组件源码实测（registry JSON 直取）

- `r/styles/base-nova/button.json`：`import { Button as ButtonPrimitive } from "@base-ui/react/button"`；
- `r/styles/radix-nova/button.json`：`import { Slot } from "radix-ui"`（统一包，pacman 原型施工实测依赖落位 `radix-ui@^1.6.7`，与本调研一致）。

### 3.4 `cn` 包化（2026-09 changelog）

2026-09 起所有 registry 组件的 className 合并改为 `import { cn } from "cn"`。npm `cn@0.4.0` 归属 `github.com/shadcn-ui/cn`（官方仓，自述 clsx+tailwind-merge 的 30× 替代品）；包名系受让旧名（npm 记录 created 2013），**是当前官方行为不是别名解析失败的降级**。`shadcn migrate cn` 可把存量仓的 clsx/tailwind-merge 收敛到 `cn`；init 生成的 `lib/utils.ts` 仅一行 re-export，兼容旧引用。

注意点（pacman 原型施工实测）：`add` 产物固定写 `from "cn"`、不经 components.json 的 utils 别名——**init/add 后应核查 `cn` 确为 shadcn-ui 官方包且 `lib/utils.ts` 指向它**，避免与仓内既有 cn helper 形成双源。

## 3. CSS 变量 token 规约（全文）

来源：文档 `/docs/theming` + 注入实现 `src/utils/updaters/update-css-vars.ts`。

### 3.1 变量清单（`:root` / `.dark` 双份）

语义 surface/foreground 成对约定（surface 名省略 `-background` 后缀）：

- `background` / `foreground` —— 页面壳与默认文本
- `card` / `card-foreground`、`popover` / `popover-foreground`
- `primary` / `primary-foreground`、`secondary` / `secondary-foreground`
- `muted` / `muted-foreground`、`accent` / `accent-foreground`
- `destructive`（无对）、`border`、`input`、`ring`
- `chart-1` … `chart-5`
- `sidebar` 族 8 枚：`sidebar` / `sidebar-foreground` / `sidebar-primary` / `sidebar-primary-foreground` / `sidebar-accent` / `sidebar-accent-foreground` / `sidebar-border` / `sidebar-ring`
- `radius` —— 基准圆角

色值现行默认用 **oklch**（neutral baseColor：light `--background: oklch(1 0 0)`、`--foreground: oklch(0.145 0 0)`；dark 反转并配 10%/15% alpha 的 border/input）。可选 baseColor 七种：`neutral / zinc / stone / mauve / olive / mist / taupe`。

### 3.2 light/dark 类约定

- 注入 `@custom-variant dark (&:is(.dark *))` —— **dark 模式 = 根元素挂 `.dark` 类**，`:root` 为 light 值、`.dark {}` 块覆盖。
- 组件内 `dark:*` 工具类经该 variant 编译。

### 3.3 Tailwind v4 接线：`@theme inline`

`@theme inline` 块把变量映射成 utility token（`updateThemePlugin` 自动 upsert）：

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* …全部 surface/foreground 对、border/input/ring、chart-1..5、sidebar 族… */
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}
```

另有 `@layer base { * { @apply border-border outline-ring/50 } body { @apply bg-background text-foreground } }` 与两行 import（`tw-animate-css`、`shadcn/tailwind.css`——后者为 CLI 包附带的共享 custom variants/keyframes，`shadcn eject` 可内联摘除该依赖）。

### 4.2 注入语义（对既有 CSS 文件的精确行为，update-css-vars.ts 实测读码）

1. `@custom-variant`：**文件中已存在任何 `@custom-variant` 则整体跳过**（不看 params 是否相同）；
2. `:root` / `.dark` 变量：按名查重，**已存在即不覆盖**（默认 `overwriteCssVars=false`），只补缺；
3. `@theme inline`：找到现有节点则追加缺失映射，无则新建；
4. `@layer base`：找现有 `base` 层追加，无则新建；
5. `@import` / `@plugin`：去重后插在既有 import 序列尾部；
6. `--sidebar-background` 在 TW4 路径被改名 `--sidebar`（特例）。

## 4. 组件清单与 pacman 覆盖对照

三 base 的组件源码目录（`apps/v4/registry/bases/{base,aria,radix}/ui/`）文件清单逐一对齐，各 61 件。对照 pacman 在用件：

| pacman 需求 | shadcn 件 | 备注 |
|---|---|---|
| button | `button.tsx` | 6 variant × 7 size（含 xs/icon-xs 等） |
| card | `card.tsx` | |
| chip | — | **无独立 chip**；`badge.tsx` / `toggle.tsx` / `button-group.tsx` 充任 |
| badge | `badge.tsx` | |
| dialog | `dialog.tsx`（+ `alert-dialog` / `drawer` / `sheet`） | |
| input | `input.tsx`（+ `input-group` / `textarea` / `field` / `label`） | |
| popover | `popover.tsx` | |
| command | `command.tsx`（+ `combobox`） | |
| toast | base 版 `toast.tsx` 原生 + `sonner.tsx` 集成并存 | radix 版仅 sonner |
| tooltip | `tooltip.tsx` | |
| avatar | `avatar.tsx` | |
| tabs | `tabs.tsx` | |
| select | `select.tsx`（+ `native-select`） | |

覆盖 12/13 直接命中；另有 calendar/chart/data-table/sidebar/resizable/scroll-area 等 49 件超出当前需求面。

## 5. monorepo 摆法（官方方案）

来源：文档 `/docs/monorepo` + 仓内模板 `templates/vite-monorepo/`。

- **结构**：turbo + pnpm workspace；`apps/web` + `packages/ui`（包名 `@workspace/ui`）。`shadcn init --monorepo -t vite` 直接生成此结构。
- **ui 包无构建**：`package.json` 裸 `exports` 直出源码——`"./globals.css": "./src/styles/globals.css"`、`"./components/*": "./src/components/*.tsx"`、`"./lib/*"`、`"./hooks/*"`；消费方（app）的 Vite/Tailwind 负责编译。ui 包 `globals.css` 用 `@source "../../../apps/**/*.{ts,tsx}"` 等指令把 app 源文件纳入 Tailwind 扫描。
- **双 components.json**：`packages/ui` 的 aliases 指 `@workspace/ui/components` 等；`apps/web` 的 `ui`/`utils` 别名同样指 `@workspace/ui/*`，自身 `components` 指 `@/components`。两份须保持 `style`/`iconLibrary`/`baseColor` 一致。
- **`add` 的路由**：在 app 目录（或 `-c apps/web`）跑，`registry:ui` 件落 `packages/ui`、app 级 block 落 `apps/web/components`，import 自动按 aliases 生成。monorepo 根裸跑 init 会被拦截并列出 workspace 目标。
- **替代形态**：官方同时支持 `package.json#imports`（`#components/*` 包内别名 + workspace `exports` 跨界引用），不依赖 tsconfig paths。

**与 pacman「暂不抽包但结构就绪」的契合度**：单仓期 `components.json` 的 `ui` 别名指 `@/components/ui` 即可全功能使用；将来抽 `packages/ui` = 挪文件 + 两份 components.json 改别名指向 + 包 `exports`，组件内部 import 全部经别名生成、无需重写。结构就绪的边际成本仅是把别名约定提前定成与官方一致。

## 6. 国内网络 / 代理可靠性

### 6.1 拉取链路拆解

| 链路 | 目标 | 可配置性 |
|---|---|---|
| CLI 本体 | npm registry 的 `shadcn` 包（`pnpm dlx shadcn@latest`） | npm/pnpm registry 镜像（npmmirror 等）常规可配 |
| registry 数据 | **`https://ui.shadcn.com/r/**`**（Vercel 托管 JSON） | **`REGISTRY_URL` 环境变量整体覆写**（`src/registry/constants.ts`），可指自建镜像 |
| 新项目模板 scaffold | `git clone github.com/shadcn-ui/ui.git`（稀疏取 templates 目录） | **`SHADCN_GITHUB_URL` 环境变量覆写**（`src/templates/create-template.ts`） |
| 组件依赖 | npm registry（`@base-ui/react`、`cn`、`lucide-react` 等） | 同第 1 行 |
| 私有 GitHub registry（可选） | GitHub Contents API | 走 `gh` 凭据或 `GH_TOKEN` |

### 6.2 CLI 代理支持（`src/registry/proxy.ts` 全文核实）

`fetchWithProxy` 网络层：读 `HTTPS_PROXY/https_proxy/HTTP_PROXY/http_proxy` → undici `EnvHttpProxyAgent`（同时遵守 `no_proxy/NO_PROXY`，大小写均认）；`ALL_PROXY/all_proxy` 仅当 socks 系协议（socks/socks4/socks4a/socks5/socks5h，curl 惯例）→ `SocksClient` 直连代理。重定向手动跟随，跨 origin 自动剥自定义 header（私有 registry 防泄）。

### 6.3 实测结论（pacman 原型施工，2026-09）

- 代码层代理支持完备，**但本机 7890 代理实测会掐 registry 请求**（报错 `other side closed`）；`env -u http_proxy -u https_proxy -u all_proxy …` 直连 `ui.shadcn.com` 可通——与该站国内直连质量的常见报告一致，也提醒「代理可用性以实测为准、不以代码支持为准」。
- npm 依赖侧无特殊问题，`radix-ui@^1.6.7` 等经镜像可装。
- CI/脚本场景建议固化：`env -u` 系列变量或显式 `REGISTRY_URL` 指向自建镜像，避免依赖交互式网络环境。

## 7. 对 pacman 的接入含义（冲突点清单）

基于 pacman 仓内实测（`apps/web/src/styles/tokens.css`、`app.css`）：

1. **dark 语义相反（唯一实质冲突）**：pacman `@custom-variant dark (&:where(:not(.light):not(.light *)))`（dark 为默认态、`.light` 类切浅）；shadcn 约定 `:root`=light + `.dark` 类。因 addCustomVariant「已有即跳过」，CLI 不会覆写 pacman 的 variant——组件 `dark:*` 类恰好仍在 pacman 默认深色态生效（语义巧合一致）；但 **init 注入的 `:root`(light)/`.dark`(dark) 变量块在 pacman 体系下激活面是错的**，接入时须把 shadcn 的 light 值搬进 `.light`、dark 值留在 `:root`。
2. **变量名零冲突**：pacman 自研族 `--surface/--text-primary/--border-default/--indigo-*`，与 shadcn 族 `--background/--primary/...` 无重名；默认不覆盖语义下 init 只做纯增量。桥接方式可选：把 shadcn 变量值写成 `var(--surface)` 之类的引用，让两套语义单源化。
3. **`@layer base` 会叠出第二个 `body` 规则**（shadcn 的 `bg-background text-foreground` 与 pacman 现有 `body { background: var(--surface) }` 并存），接入时人工合并。
4. **`@theme inline` 已存在**（pacman 自研族映射），CLI 只追加 `--color-background` 等新键，不动既有键。
5. **前置条件**：tsconfig `paths` + `vite.config.ts` alias 须先配好（preflight 硬检查）；pacman 的 `@tailwindcss/postcss` 接线与官方 `@tailwindcss/vite` 等价，CLI 无感知。
6. **新增依赖面**：`@base-ui/react` + `class-variance-authority` + `cn` + `lucide-react` + `tw-animate-css`（base 选型时）；其中 `cn` 须核查为 shadcn-ui 官方包（§3.4）。

## 8. 来源清单

一手来源（抓取/阅读时点 2026-09-29）：

- CLI 源码（`github.com/shadcn-ui/ui` main）：`packages/shadcn/package.json`（shadcn@4.21.0）、`src/commands/init.ts`、`src/preflights/preflight-init.ts`、`src/preset/presets.ts` + `defaults.ts`、`src/registry/constants.ts` + `proxy.ts` + `bases.ts`（经 apps/v4）、`src/utils/updaters/update-css.ts` + `update-css-vars.ts`、`src/templates/{vite.ts,create-template.ts,monorepo.ts}`、`templates/vite-app/`、`templates/vite-monorepo/`
- 官方 registry JSON：`ui.shadcn.com/r/styles/base-nova/{index,button}.json`、`r/styles/radix-nova/button.json`
- 官方文档：`/docs/installation/vite`、`/docs/theming`、`/docs/cli`（含 migrate/eject 节）、`/docs/monorepo`、`/docs/components`、`/docs/changelog`（2026-09 cn 包化）、`/docs/legacy`
- 维护状态：`gh api repos/radix-ui/primitives/commits`、`gh api repos/mui/base-ui/{commits,releases}`、`gh api repos/shadcn-ui/ui/releases`
- npm：`npm view shadcn`（4.21.0）、`npm view cn`（0.4.0，repo 指向 shadcn-ui/cn）
- pacman 仓内：`apps/web/src/styles/{tokens.css,app.css}` 实测
- 原型施工实测反馈（2026-09）：radix-ui 统一包落位、代理掐断与 `env -u` 直连、cn 包落位
