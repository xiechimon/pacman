---
labels: [wayfinder:map]
tracker: local-markdown
effort: craft-fork
---

# craft-fork · 从 craft-agents-oss 长出自己的桌面 agent

## Destination

产出一套 **spec + 施工票**：以「压缩导入 + vendor 分支」方式把 craft-agents-oss（上游 v0.13.3，Apache-2.0）接入本仓，裁掉 Craft 官方服务绑定、换皮成自用桌面 agent，核心子系统全留。地图跑完 = spec 可交接，不动工写产品代码。

## Notes

- 领域：fork 定制一个 Electron + Bun monorepo 桌面 agent（agent loop 在 SDK 里：claude-agent-sdk / pi-coding-agent）
- 每个 session 按需调用：`grilling`、`domain-modeling`（HITL 票）；`research`（research 票）
- 事实备忘：
  - 上游克隆保留在 `/tmp/craft-agents-oss-survey`（v0.13.3，1960 文件 / 约 36 万行 TS）
  - 本机**未装 bun**（node v24 + pnpm 有）——跑通票的第一步
  - Apache-2.0 义务：保留 LICENSE 与文件内版权声明，README 注明出处
  - mini-pi v2 历史留在本仓 git 中（工作区已清空，打 tag 封存后 main 换线）
- 本地 tracker 约定：ticket = `issues/NN-*.md`；claim = frontmatter `status: in-progress` + `owner`；frontier = `status: open` 且 `blockedBy` 全已 closed

## Decisions so far

- [01 · Craft 服务绑定与身份引用全清单](issues/01-craft-service-bindings.md)：裁剪/换皮触点全清单已产出——必须删 19 条（Sentry 全链路、feedback 工具、Craft MCP 校验器）、必须换 35 条（bundle id、`~/.craft-agent`、`@craft-agent/*` 包名等）、可选断开 10 条（含 Dockerfile 引用 4 个不存在目录，上游 Docker 构建本身是坏的）；pages publisher + viewer 不断开会持续向 Craft 服务器发数据
- [02 · 构建与分发路径](issues/02-build-and-packaging.md)：最短路径 = `bun install` → `bun run electron:start`；打包 electron-builder（asar 关、dmg+zip、默认不签名）。关键坑：bunfig 钉死 hoisted linker、OSS 导出缺部分 build 脚本、`electron:dist:mac` 直打会缺 pi-agent-server/session-mcp-server 两个 resources（需手工 stage）、pi-agent 子进程 dev 用系统 bun / 打包后用 vendored bun
- [03 · 原仓本地跑通验证](issues/03-upstream-smoke-run.md)：2026-09-15 实跑通过，bun 1.4.2 + v0.13.3，Electron dev 窗口成功启动。环境大坑：~/.bun 曾是指向未挂载外置盘的悬空 symlink，bun 对缓存目录创建失败会原地死循环（任何项目都复现）
- [04 · 命名与换皮](issues/04-naming-and-rebrand.md)：定名 **pacman**（`~/.pacman`、`pacman://`、`@pacman/*`、`PACMAN_`、`app.pacman`）；深换皮，35 条身份触点全换（代价：上游 merge 靠手工 diff）；v0.1 视觉沿用 craft 资产，对外分发前必须重做；词汇表落盘仓根 CONTEXT.md
- [05 · v0.1 验收标准](issues/05-v01-acceptance.md)：dev 跑通即过（dmg 归 v0.2）；provider 两条都验——Anthropic 兼容端点 + Claude Max OAuth；冒烟场景 = dogfood 用 pacman 改 pacman 仓一处换皮漏网文案；重子系统 v0.1 只要求代码在不启用
- [08 · OAuth 验证路径](issues/08-oauth-verification-path.md)：三家 OAuth 全部零注册（复用上游公共 client：Claude 手抄 code、ChatGPT localhost:1455 自动接、Copilot device flow 输码）；`pacman://` deep link 不参与 OAuth，改名安全。红线：client_id/端口/endpoint 等公共值一个不能改；Copilot 伪装请求头不能改；PBKDF2 盐改了存量凭据全废（新装无碍）
- [06 · 重子系统的自用启用范围](issues/06-heavy-subsystems-usage.md)：Pages 功能全留（对外发布仍按既定裁剪断开）；Automations 留代码不配触发器；IM 网关启用 Telegram（需用户 BotFather 建 bot，列为 HITL 施工票）；browser_tool 保持启用
- [07 · 产出 spec 与施工票](issues/07-spec-and-build-tickets.md)：**Destination 达成**——[spec.md](../spec.md) 2026-09-15 过稿，含 26 条 user story、两条测试缝、施工票 B0–B7。本地图走完，后续进入施工阶段
- Destination 形态：一份 spec + 施工票（纯规划，execution 不进地图）
- 起点：全新开始，不恢复 mini-pi v2 代码（历史打 tag 封存）
- 产品形态：对齐 craft 全形态——Electron 桌面 app + 无头 server + CLI + WebUI
- agent loop：用 SDK（claude-agent-sdk / pi-coding-agent），不自研
- provider 策略：llm-connections 矩阵（provider / auth / 模型正交）
- 重点借鉴：工具注册表模式、权限三模式 + bash AST 校验、连接矩阵
- 复用方式：整仓 fork 后裁剪（不是抽包重组）
- 项目目标：自用工具优先，裁剪到能跑、去 Craft 账号依赖即可
- 保留子系统：核心面（inbox/状态流/Sources/Skills/workspaces/projects/labels/views/scheduler/prompts/protocol）+ Pages + Automations + IM 网关 + server 矩阵 + OAuth 三方登录 + 文件附件转换 + browser_tool + 跨 session 消息 + background tasks
- 裁剪对象：Craft 官方服务绑定（Craft 文档 MCP、Cloudflare Pages sharing、官方更新/反馈/遥测通道），精确清单由 ticket 01 产出
- git 历史：压缩导入为一条初始提交 + `vendor/upstream` 只读分支保留上游全历史备用

## Not yet specified

- 上游同步节奏（何时从 vendor/upstream 捡修复、怎么捡）——等 spec 成形后细化
- **Copilot model catalog bug**：OAuth 阶段 pi-server 用 `tier1-httpApi` 端点拉回的 enabled 模型清单（gpt-5.4-mini / gpt-5.6-luna / claude-haiku-4.5 / mai-code-1.* 等 10 个）与 `/v1/responses` 实际接受的清单不一致，所有 catalog enabled 模型都被 server 拒（`model_not_supported`）。是 pi-server 上游问题，pacman 控不了——但要把 retry 走通需要绕过：要么用 Copilot 的其他 catalog 端点（tier1-internal / user-snapshots）让 pi-server 探到，要么等 pi-server 上游修。**决策时机**：等下次跑 B4 或修 Copilot 时出票处理。
- pacman 默认模型选择策略：当前会选 catalog enabled 列表里的 `mai-code-1.1-flash`，但用户实际 tier 不接受。修复方向——默认选 enabled 列表里**最低 tier 稳接受**的（如 `gpt-5.4-mini` / `gpt-4.1`），或发送 400 后给用户明确"换这个试试"提示。
- IPC 超时设短：GitHub Copilot OAuth 全流程 ~40 秒（设备码 + 用户授权 + token 换 Copilot + 启用模型），但 `copilot:startOAuth` IPC 超时只设 30 秒，UI 在 token 完成前报 timeout。修法：handler 立即返回 "started" + push 进度事件，或把超时调长到 60+ 秒。
- 自用稳定后的差异化特性（方向未探，当前不设票）
- 打包分发给他人（超出自用范围时的签名/公证）——等 v0.1 验收后再议

## Out of scope

- 自研 agent loop（已定：复用 SDK，loop 不是本项目的心智负担）
- 恢复 / 演进 mini-pi v2 代码
- TUI 形态
- 向上游回馈 PR、商业化、多用户 / SaaS 化
