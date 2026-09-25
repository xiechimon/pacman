# pacman

自托管、开源的 **agent workspace**：一块任务看板——你写任务，AI agent 在你自己的机器上把它们做出来。

[English](./README.md) | 简体中文

## 是什么

你在看板上立一个任务，agent 领取后检出 worktree 与分支，把过程以对话流实时打回界面——方案卡、diff、工具调用全程可见。运行到审核关口暂停，由人决定合不合。

- **任务与阶段** — 看板 + 带序号的任务、标签、按周期自动重跑的定时。
- **Agent** — 配了模型、职责、技能、MCP 服务器、密钥与记忆的执行角色；每用户一个「总管」agent 负责分派。
- **机器** — 在任意主机跑 daemon 即登记为执行机；build 在其上受监督执行。机器是你的，规则也是你的。
- **模型服务** — api_key / OAuth（GitHub Copilot、OpenAI Codex）/ 自定义端点三协议接入。
- **仓库** — server 自托管 git 仓（API key 走 push/pull），或从 GitHub 接入。
- **全实时** — 看板与会话走 SSE 流、通知、按 build × 模型记账 token 用量。

## 为什么

- **自托管。** 单一数据根（`~/.pacman`）+ SQLite，不经任何外部服务；代码与模型密钥不出你的机器。
- **开源。** Apache-2.0（见[许可](#许可)）。
- **出身透明。** pacman 起步于对 todos.dev 公开界面的 clean-room 研究（见[渊源](#渊源)），现为自主产品；分化路线从真实使用中涌现，不抄任何人的 spec。

## 快速开始

环境要求：Node.js >= 22.19、pnpm（可 `corepack enable`）。

```sh
pnpm install
pnpm start
```

`pnpm start` 构建 web UI 并由 server 同源托管。打开 **http://127.0.0.1:8787/app**。首启自动建库 + 迁移 + seed 默认团队。

换端口：`PORT=9000 pnpm start`。

### 可选：把本机登记为执行机

不起 daemon 也能用全部界面功能；要让 agent 真在本机跑 build 时再登记。

```sh
# 首次注册：网页 /app/api-keys 建 key（明文只显示一次），然后
pnpm dev:daemon start --api-key <pacman_...> --team <teamId>
# 日常（凭据已存 ~/.pacman/machine.json）：
pnpm dev:daemon start        # stop / restart / logs -f / status 同面
```

## 配置

server 环境变量（全部可选）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `PACMAN_TOKEN` | 未设 | 守护 `/api/*` 的 Bearer token。设 = 开鉴权（web 首访出 token 门页）；未设 = 关（默认）。两条 SSE stream 端点额外接受 `?token=`（EventSource 设不了 header）。绑非 localhost 接口时务必设。 |
| `PORT` | `8787` | HTTP 监听端口。 |
| `PACMAN_HOME` | `~/.pacman` | 数据根。server 状态在 `<PACMAN_HOME>/server/`（`server.db`、`secretbox.key`、托管裸仓）；daemon 的 `machine.json`、`daemon.log`、`workspaces/` 在根下。**备份 = 整目录拷走**——密文离了 keyfile 永久不可解，只拷 db 没用。 |
| `PACMAN_GITHUB_OAUTH_CLIENT_ID`<br>`PACMAN_GITHUB_OAUTH_CLIENT_SECRET` | 未设 | 自注册 GitHub OAuth App 的凭证对，开启 provider OAuth 登录。两件同设或同缺——只配一件 server 启动即报错，不静默。 |
| `PACMAN_WEB_DIR` | `apps/web/dist`（存在即托管） | SPA 静态托管根覆写；未设且无构建产物 = 纯 API 形态。 |

daemon 环境变量（上述 CLI flag 的等价覆写）：`PACMAN_SERVER`（默认 `http://127.0.0.1:8787`）、`PACMAN_API_KEY`、`PACMAN_TEAM`、`PACMAN_WORKSPACES_DIR`（默认 `<PACMAN_HOME>/workspaces`）。

## 开发

```sh
pnpm dev:server   # API server 热重载，http://127.0.0.1:8787（首启建库 + 迁移 + seed）
pnpm dev:web      # vite dev server，http://localhost:5173，/api 与 /git proxy 到 8787
```

提交前三闸：

```sh
pnpm lint         # biome ci
pnpm typecheck    # 全包 tsc
pnpm test         # vitest
```

### 仓库结构

| 路径 | 内容 |
|---|---|
| `CONTEXT.md` | 领域模型与术语表（中文界面词 ↔ 英文原词 ↔ 内部名，canonical） |
| `apps/web` | Web UI（React + vite） |
| `apps/server` | server：Hono REST + SSE + SQLite（包名 `@xiechimon/pacman`，目录名 ≠ 包名） |
| `apps/daemon` | 执行机 daemon（包名 `@xiechimon/pacman-cli`，目录名 ≠ 包名） |
| `packages/shared` | 协议词表 / 记录形状 / 品牌槽单源（`@pacman/shared`） |
| `docs/spec/` | 实现正典 00–06 册（中文） |
| `docs/research/` | r1–r8 复刻期原站盘点与证据（历史档案） |
| `parity/` | 像素对拍 harness（对 `docs/research/assets/` 基线；现身份 = 回归工具） |
| `scripts/` | 构建期工具（含 `generate-icons.mjs`） |

## 第三方署名

- 头像字体 [Lorelei](https://www.figma.com/community/file/1198749693280469639) — © Lisa Wischofsky, CC0 1.0
- 字体 Inter / JetBrains Mono — SIL Open Font License 1.1
- 图标 [lucide](https://lucide.dev) — ISC License
- emoji 策展数据 [gitmoji](https://gitmoji.dev) — MIT License
- 执行引擎 [pi SDK](https://github.com/badlogic/pi-mono) — MIT License

完整义务表见 `docs/spec/素材替换计划.md` §4。

## 许可

Apache-2.0 — 见 [LICENSE](./LICENSE)。

## 渊源

pacman 起步于对 todos.dev 公开界面与协议的 clean-room 研究——一次 agent-workspace 设计探索。现为独立项目，有自己的路线图，不使用 todos.dev 的任何代码或素材。
