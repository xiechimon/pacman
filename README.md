# pacman

todos.dev 的 1:1 复刻研究项目（像素级 UI + 功能等价）。复刻产品名 **Pacman**，本地自用。

> **免责声明 / Disclaimer**
> 本仓库是 todos.dev 的 1:1 复刻研究项目（像素级 UI + 功能等价），仅供个人学习研究，
> 与 todos.dev 官方无任何关联，未获其认可或赞助。Todos、todos.dev 及其 logo、界面截图、
> 文案等素材版权归原权利人所有；仓库内 `docs/research/` 下的抓取记录与截图仅作研究证据引用。
> 复刻产品名为 Pacman，本地自用，不对外提供服务。
> 素材替换政策与逐项清单见 [`docs/spec/素材替换计划.md`](docs/spec/素材替换计划.md)（#44）。

## 仓库结构

| 路径 | 内容 |
|---|---|
| `CONTEXT.md` | 领域模型与术语表（中文界面词 ↔ 英文原词 ↔ 内部名，canonical） |
| `docs/research/` | r1–r8 原站盘点与证据（站点/UI/协议/地基/图标/生命周期/重基线/动态面补拍，含抓包与截图基线） |
| `docs/spec/` | 实现正典：`00-地基决议`（#39）· `01-stack-v2`（#43）· `02-架构平价`（#41）· `素材替换计划`（#44） |
| `apps/web` | 复刻 Web UI（React，从零自建，见 00 D5） |
| `apps/server` | 复刻 server（Hono REST + SSE + SQLite，包名 `@pacman/server`） |
| `apps/daemon` | 执行机 daemon（**包名 `@pacman/cli`**，目录名 ≠ 包名，`--filter` 时注意，见 02 §5.8 自发包名） |
| `packages/shared` | 协议词表 / 记录形状 / 品牌槽单源（包名 `@pacman/shared`） |
| `parity/` | 像素对拍门禁（对 `docs/research/assets/` 基线截图） |
| `scripts/` | 构建期工具（含 `generate-icons.mjs`） |

## 运行

```sh
pnpm install
pnpm dev:server   # 总部：首启自动建库+迁移+seed，日志打出 port/teamId（缺省 8787）
pnpm dev:web      # 老板界面：vite dev，proxy 同源指向 server（缺省 http://localhost:5173）
```

daemon（让本机成为执行机，可选——不起也能用全部界面功能）：

```sh
# 首次注册：网页 /app/api-keys 建 key（明文只显示一次），然后
pnpm dev:daemon start --api-key <pacman_…> --team <teamId>
# 日常（凭据已存 ~/.pacman/machine.json）：
pnpm dev:daemon start        # 后台 + 监工；stop / restart / logs -f / status 同面
```

数据根与共存：

- server 数据根 `~/.pacman/server/`（`server.db` + `secretbox.key`）；**备份 = 整目录拷走**，只拷 db 不拷 keyfile 则密文永久不可解（02 §8 护栏）
- daemon 状态根 `~/.pacman/`（machine.json / daemon.log / workspaces/）；env 覆写 = `PACMAN_HOME`
- 与正版 todos.dev（`~/.tds`、`tds` 命令、`TDS_*` env）**零路径/零命名冲突，可同机并行**（#109 品牌槽切换后）

## 第三方署名

- 头像字体 [Lorelei](https://www.figma.com/community/file/1198749693280469639) — © Lisa Wischofsky, CC0 1.0
- 字体 Inter / JetBrains Mono — SIL Open Font License 1.1
- 图标 [lucide](https://lucide.dev) — ISC License
- emoji 策展数据 [gitmoji](https://gitmoji.dev) — MIT License
- 执行引擎 [pi SDK](https://github.com/badlogic/pi-mono) — MIT License

完整义务表见 `docs/spec/素材替换计划.md` §4。
