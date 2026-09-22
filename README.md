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
| `docs/research/` | r1–r7 原站盘点与证据（站点/UI/协议/地基/图标/生命周期/重基线，含抓包与截图基线） |
| `docs/spec/` | 实现正典：`00-地基决议`（#39）· `01-stack-v2`（#43）· `02-架构平价`（#41）· `素材替换计划`（#44） |
| `apps/web` | 复刻 Web UI（React，从零自建，见 00 D5） |
| `parity/` | 像素对拍门禁（对 `docs/research/assets/` 基线截图） |
| `scripts/` | 构建期工具（含 `generate-icons.mjs`） |

## 第三方署名

- 头像字体 [Lorelei](https://www.figma.com/community/file/1198749693280469639) — © Lisa Wischofsky, CC0 1.0
- 字体 Inter / JetBrains Mono — SIL Open Font License 1.1
- 图标 [lucide](https://lucide.dev) — ISC License
- emoji 策展数据 [gitmoji](https://gitmoji.dev) — MIT License
- 执行引擎 [pi SDK](https://github.com/badlogic/pi-mono) — MIT License

完整义务表见 `docs/spec/素材替换计划.md` §4。
