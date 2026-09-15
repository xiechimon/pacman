---
labels: [ready-for-agent]
status: approved
source: .scratch/craft-fork/map.md（ticket 01–06、08 决策汇总）
---

# pacman · 从 craft-agents-oss 长出自用桌面 agent

## Problem Statement

我需要一个属于自己的桌面 agent 产品。craft-agents-oss（上游，v0.13.3，Apache-2.0）已经是一个完整产品，但它绑死了 Craft 的身份与服务：品牌、配置目录、包名全是 craft；Sentry / Plausible / feedback 通道持续向 Craft 服务器发数据；Pages 发布依赖 Craft 的 Cloudflare 设施。直接用等于住在别人的房子里。

## Solution

以「压缩导入 + vendor 分支」把上游 v0.13.3 接入 pacman 仓，做一次彻底的收房手术：**裁剪**掉全部 Craft 服务绑定，**深换皮**成 pacman（35 条身份触点全换），核心子系统全留，最后按 v0.1 验收标准实跑验收。git 历史干净归我，上游历史封存于 `vendor/upstream` 分支备用。

## User Stories

仓库手术：

1. As the owner, I want mini-pi v2 的历史打 tag 封存、main 换成 pacman 代码线，so that 仓库外观干净、旧探索可追溯。
2. As the owner, I want 上游以一条「初始导入 v0.13.3」压缩提交进入 main，so that git log 全是我自己的历史。
3. As the owner, I want 上游全量历史存在 `vendor/upstream` 只读分支，so that 以后捡上游修复有对照底本。
4. As the owner, I want LICENSE 与文件内版权声明保留、README 注明出处，so that 履行 Apache-2.0 义务。

环境前提：

5. As the owner, I want bun（brew 安装）可用且缓存目录在本机磁盘，so that `bun install` 不死循环（03 票实录的 ~/.bun 悬空 symlink 大坑）。
6. As the owner, I want 依赖装齐、Electron postinstall 正常下载，so that dev 模式能起。

裁剪（依据 01 票清单，四类触点以该文件为准）：

7. As the owner, I want Sentry 全链路移除（主/渲染/preload/依赖），so that 没有任何崩溃数据外发。
8. As the owner, I want viewer 的 Plausible 移除，so that 分享页不向上报。
9. As the owner, I want `send_developer_feedback` 工具链移除，so that agent 不会把反馈写给 Craft 团队。
10. As the owner, I want Craft 文档 MCP 校验器与 README 宣传移除，so that 没有指向 mcp.craft.do 的死代码。
11. As the owner, I want Pages 对外发布断开（feature flag 关闭），so that pages publisher 与 viewer 不再持续向 Craft 服务器发数据。
12. As the owner, I want auto-update feed、install 脚本、Slack OAuth relay 等可选断开项逐一处置，so that 没有暗中回连 Craft 基础设施的通路。

深换皮（依据 01 票 b 类 35 条触点）：

13. As the owner, I want 打包身份换成 pacman（appId `app.pacman`、productName、copyright），so that 产物是我名下的应用。
14. As the owner, I want 运行时 app 名与 `craftagents://` scheme 换成 `pacman://`，so that 菜单、协议注册、内部跳转全是新身份。
15. As the owner, I want 配置目录 `~/.craft-agent` 换成 `~/.pacman`（含 10 处硬编码绕行点），so that 不出现双配置目录并存。
16. As the owner, I want `@craft-agent/*` 12 个 workspace 包名换成 `@pacman/*`，so that 代码库内部身份一致。
17. As the owner, I want UA、MCP clientInfo/serverInfo 名、i18n 七语言文案同步替换，so that 对外报文与用户可见文案都不自报 craft。
18. As the owner, I want `CRAFT_` env 前缀换成 `PACMAN_`，so that 配置面也是新身份。
19. As the owner, I want v0.1 沿用上游图标与主题色，so that 视觉不阻塞交付（自用不分发；对外分发前必须重做，见风险）。

连接与使用：

20. As a user, I want 配一条 Anthropic 兼容端点连接（pi_compat，沿用 mini-pi 凭据），so that 零等待开聊。
21. As a user, I want Claude Max OAuth 连接验通（手抄 code 流程），so that 订阅额度可用。
22. As a user, I want 凭据加密落盘到 `~/.pacman/credentials.enc`，so that 凭据不明文。
23. As a user, I want 权限三模式（safe / ask / allow-all）可用，so that 工具调用有安全边界。
24. As the owner, I want Telegram 网关启用（我在 BotFather 建 bot 提供 token），so that agent 能从 IM 触达。

验收：

25. As the owner, I want dogfood 冒烟：用 pacman 在 pacman 仓改一处换皮漏网文案并提交，so that 验收同时产出真实价值。
26. As the owner, I want 一套可重复执行的验收脚本，so that 以后每次大改后能一键复检。

## Implementation Decisions

- **仓库手术**：mini-pi v2 历史打 tag（如 `archive/mini-pi-v2`）；上游以压缩导入进 main；上游全历史进 `vendor/upstream` 分支。
- **裁剪与换皮的唯一事实源**：`.scratch/craft-fork/issues/01-craft-service-bindings.md` 的四类触点清单（必须删 19 / 必须换 35 / 可选断开 10 / 可保留 5），施工时逐条勾销，不另起炉灶。
- **OAuth 红线**（08 票）：三家 OAuth 的 client_id / endpoint / redirect / 端口 1455 / device URL 全是上游公共值，一个不能改；Copilot 的伪装请求头不能改；PBKDF2 盐不改（改了存量凭据全废）。`pacman://` deep link 不参与 OAuth，可安全改名。
- **子系统启用矩阵**（06 票）：Pages 功能全留（仅断开对外发布）；Automations 留代码不配触发器；IM 仅启用 Telegram；browser_tool 保持启用。
- **构建链**（02 票）：`bun install` → `bun run electron:start`；bunfig 的 hoisted linker 不可覆盖；dmg 打包归 v0.2（需补 `electron:dist:mac` 缺两个子进程资源的 stage 缺口）。
- **Docker**：上游 Dockerfile 引用 4 个不存在的目录，构建必挂——v0.1 弃用 Docker 部署形态，只用本地 dev。
- **视觉**：v0.1 沿用上游图标与主题色。

## Testing Decisions

好测试的标准：只验外部可观察行为（进程起来没有、字符串还有没有、连接通不通），不碰内部实现。

**两条测试缝（seam）**：

1. **身份与裁剪审计脚本（自动）**：一条 grep 审计——对仓内源码断言零命中：`craftagents://`、`~/.craft-agent`、`@craft-agent/`、Sentry DSN、Plausible、`mcp.craft.do` 等 01 票列出的死名单。这是最高层的缝，一条命令覆盖裁剪与换皮两大部分，可重复执行。
2. **v0.1 验收跑（HITL，按 05 票标准）**：`bun run electron:start` 起窗 → Anthropic 兼容端点连接通 → Claude Max OAuth 连接通 → dogfood 冒烟（改一处漏网文案并提交）→ 权限三模式各试一次。

Prior art：03 票的实跑验证就是缝 2 的首次执行；缝 1 无既有先例，新建一个脚本即可（上游自带 config_validate 类工具可参考其形态）。

模块级单测：本项目不改写上游逻辑，不新增模块级测试；上游已有测试（`bun test`）保持绿即可。

## Out of Scope

- 自研 agent loop（复用 SDK）；恢复 mini-pi v2 代码；TUI 形态
- dmg 打包与公证（归 v0.2）；Docker 部署（上游已坏，弃用）
- WhatsApp / Lark 网关；Automations 触发器配置
- Pages 对外发布能力（Cloudflare sharing）
- 向上游提 PR、商业化、多用户 / SaaS 化、对外分发

## Further Notes

- **法律**：Apache-2.0——保留 LICENSE、文件内版权声明、README 注明出处。上游 TRADEMARK 要求 fork 更换 bundle id（已覆盖）；图标/主题色的沿用仅限自用不分发。
- **上游同步**：`vendor/upstream` 分支 + 手工 diff 捡修复（深换皮后 merge 冲突面大，接受此代价）。同步节奏暂不定，第一次同步发生时再立规矩。
- **环境备忘**：bun 缓存目录必须在已挂载本机磁盘（03 票大坑）；Electron 下载慢时用 `ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"`。

## 施工票（按依赖排序，每票带完成条件）

| # | 施工票 | 完成条件 |
|---|---|---|
| B0 | 仓库手术：mini-pi tag 封存、压缩导入、vendor/upstream 分支 | main 只有一条导入提交起的新历史；`git log vendor/upstream` 可见上游全史 |
| B1 | 环境固化：bun 装好、~/.bun 本机化写入文档 | 干净机器按文档能复现 `bun install` 成功 |
| B2 | 裁剪：01 票 a 类 19 条必删 + c 类 10 条逐项处置 | 审计脚本对死名单零命中；`bun run electron:start` 起窗无报错 |
| B3 | 深换皮：01 票 b 类 35 条触点全换 | 审计脚本对身份名单零命中；UI 标题、菜单、配置目录均为 pacman |
| B4 | 双 provider 验收：Anthropic 兼容端点 + Claude Max OAuth | 两条连接各自完成一轮真实对话 |
| B5 | Telegram 网关（HITL：我在 BotFather 建 bot 给 token） | 从 Telegram 发消息，agent 回话 |
| B6 | dogfood 冒烟：用 pacman 改 pacman 仓一处漏网文案并提交 | 该 commit 存在且由 pacman 自己产出 |
| B7 | 权限三模式各试一次 | safe 只读、ask 弹批、allow-all 直跑，行为符合预期 |
