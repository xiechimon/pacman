# ADR 0001 · 订阅族 provider OAuth 接入

> 状态：**已裁决 —— 本次不首发**（2026-09-28）。
> 来源：#301（#284 裁决产物）；记录形式依该票 AC「ADR 或 06 册增补」。
> 位置说明：本仓既有决策记录形态是 spec 册（如 `09-前端风格统一-A6.md` 的 P 表）与 `06-开源与分化.md` 的 D 表；此处另立 `docs/adr/` 是因为 spec 编号正被并行车道占用（11/12 于同日落地），避免撞号。将来若统一，可并回 spec 册并保留本文件号。

## Problem Statement

订阅类模型（OpenAI Codex / SuperGrok / X Premium+）的 OAuth 是 **PKCE + 本机回环 redirect**，为本地 CLI 设计；而 pacman 的 OAuth 握手是 **server-callback**（授权码回 server，见 `apps/server/src/services/oauth.ts` 的 `startOAuthAuthorize` / `completeOAuthCallback`）。#284 据此把「往族表 `OAUTH_FAMILIES` 加行」证伪：加行只会产出**永远无法完成的死钮**（#222 律，web 连接段只渲染表内族）。

#301 因此立为「唯一能真正打通订阅族的架构路径」，票面给的方案方向是把授权发起方从 server 移到 daemon。**本 ADR 重跑了事实侦察，结论是该前提不成立**（见 F1）。

## 侦察事实（2026-09-28 实测，逐条出处）

| # | 事实 | 出处 |
|---|---|---|
| F1 | **device code 流已实现且无回环**：`login()` 让调用方在「Browser login (default)」与「Device code login (headless)」间选，后者走 `/api/accounts/deviceauth/usercode` + `/token`（验证页 `/codex/device`）并轮询 | `@earendil-works/pi-ai@0.86.0` `dist/auth/oauth/openai-codex.js`（本仓 daemon 直接依赖）。⇒ 授权码不经过 callback，「必须搬到 daemon」的**前提消失** |
| F2 | `toAuth(credential)` = `{ apiKey: credential.access }` —— OAuth 凭据在**请求期就等价于 apiKey** | 同上。⇒ 下游 wire（`StepCredentialBundle.provider.apiKey`）无需改动 |
| F3 | `refresh(credential, signal)` 是**纯 HTTP**（带 refresh_token），不需要执行机参与 | 同上 |
| F4 | 缝纪律**硬性禁止 server 侧 import pi-ai**：「只许经 AgentBackend 缝消费——实现落 `apps/daemon/src/backend/`」 | `biome.json` `noRestrictedImports`（机械拦截） |
| F5 | 缝的能力面**已声明 `oauthProviders: readonly string[]`** 且 daemon 已填 `['anthropic','openai-codex','github-copilot','xai']`；`providerConfigSchema.kind` 已含 `'oauth'`。二者**全仓无消费点**（仅声明 + 一条测试断言） | `packages/shared/src/agent-backend.ts`、`apps/daemon/src/backend/pi.ts:49`、`apps/daemon/test/map-pi-event.test.ts:182` |
| F6 | **不存在第三方可注册的 client**：xAI 明确「rejects loopback OAuth from non-allowlisted clients」，第三方靠**复用官方 Grok-CLI 的公开 `client_id`**（`b1a00492-…`）+ PKCE，`redirect_uri` 的 host:port 必须精确匹配注册值（`127.0.0.1:56121`）；codex 同构（pi 用官方 Codex CLI 的 `app_EMoamEEZ73f0CkXaXp7hrann`） | `pi-xai-supergrok` 包 `constants.ts`；pi `openai-codex.js` |
| F7 | xai **支持 RFC 8628 device code**：官方文档 `grok login --device-auth`「for headless or remote environments」，验证页 `accounts.x.ai/oauth2/device` 实存 | xAI docs（`docs.x.ai/build/enterprise`）、`accounts.x.ai` |
| F8 | pi 的刷新策略是「距过期不足 `minimumValidityMs` 即刷，且刷新后仍过快过期则抛错」——**整套机制假设运行时持有 refresh_token** | `dist/auth/resolve.js` |
| F9 | 今天的 github-copilot OAuth 用的是**本仓自己注册的 GitHub OAuth app**（`PACMAN_GITHUB_OAUTH_CLIENT_ID/SECRET`），与 F6 的「复用他人公开 client」性质不同 | `apps/server/src/services/oauth.ts` |

## Decision

| ID | 裁决 |
|---|---|
| **O1** | **本次不新增任何族表行**，`OAUTH_FAMILIES` 维持单族（github-copilot）；copilot 现状（server-callback）不动 |
| **O2** | 「复用官方 CLI 公开 client」模式**接受**（F6 是该生态既成事实），但**不排期**——本次不首发 |
| **O3** | **xai 考证结论**：端点齐全（`auth.x.ai/oauth2/authorize|token`，scope 含 `grok-cli:access api:access`）+ 支持 RFC 8628 device code + **无第三方可注册 client** ⇒ 依票面 AC「不可 → 记录并除名」处理：**不进族表**。`PROVIDER_XAI_PRESET.oauthLabel` 保留——它是原站采集的保真字段（web 侧无消费点，不产生死钮） |
| **O4** | 若将来接手，**已定方案**见下节（本次 grilling 已把 5+ 个决策点钉完，接手者不必重跑） |
| **O5** | 缝里已声明但无消费点的 `oauthProviders` 与 `kind:'oauth'` **保持原样**：它们描述的是**后端能力**（pi 能为这 4 家做 OAuth），不是产品承诺；本 ADR 即其说明 |

## 若将来接手（warm start：grilling 已钉的设计）

前置事实支撑：F1（device code 免回环）、F2（OAuth→apiKey 降级）、F5（缝能力已声明）、F8（刷新机制在运行时）。

| 议题 | 已定 |
|---|---|
| 授权流 | **device code 为主**；族表加 `flow: 'server-callback' \| 'device-code'` 字段，为「只支持回环」的未来族留落点 |
| 执行方 | **daemon 执行 login**（复用 pi，激活 F5 的 `oauthProviders`；server 侧 import pi-ai 违 F4 缝纪律）；用户交互（user_code + 验证 URL）走**已有的 machine→server→web 事件通道**（与 steer/stop/sync 同形） |
| 凭据落点 | **server 密封**（沿用 02 §8 现有拓扑与 per-step 下发语义）；建议新增密封列 + `credentialKind` 判别列（而非复用 `apiKeyCipher` 塞 JSON，避免 `openProviderKey` 全部消费点加判别） |
| per-step 下发 | **推 refresh + access + expires 三件（内存态）**，daemon 侧进 pi 现成的 `InMemoryCredentialStore`，让 pi 按 F8 自刷——只推 access 会在长步跨 TTL 时断 |
| 首发族 | codex + xai（anthropic 虽在 F5 列表内但属 scope 扩张，另开票） |
| CLI 命令 | **不做** `pacman auth <provider>`：入口在 web UI（device code 天然适合）。若将来要 CLI-first，再定 |

## Premortem（假设将来接手，三种最可能死因 + 护栏）

| 死因 | 护栏 |
|---|---|
| **公开 client 被轮换或封禁**（F6：我们不是 client 属主，xAI 已明说会拒非白名单） | 族表登记 `clientProvenance: 'reused-official-cli'` 让风险可见；登录失败给**可诊断文案**（区分「凭据过期」与「client 被拒」）；保留 API key 路径作为回退，不做唯一依赖 |
| **长步跨 access TTL 断流**（F8：pi 只在有 refresh_token 时才会自刷） | 按上表推三件凭据；若做不到，则须在步前刷新并实测 TTL > 最长步（这条是接手时的**第一件事**） |
| **「连订阅先得有一台在线机器」的体验倒退**（今天 copilot 不需要 daemon） | UI 在该族入口明示该约束；文档记录；若该约束被判定不可接受，替代路线 = server 手写 device-code HTTP（3 个 REST 调用 + 轮询，不碰 pi-ai 故不违 F4），族表带 device 端点 |

## Consequences

- **正向**：零产品代码改动即收口，不承担复用第三方 client 的声誉面；把「已声明未消费的 OAuth 缝能力」的原委固定下来，后人不会误以为 codex/xai 已可用或「只差一行族表」。
- **负向**：订阅族（用 ChatGPT / Grok 订阅当模型源）本次不可用；该能力若要复活需走一条新主线（本 ADR 已把设计钉好，成本显著低于从零）。
- **重开触发**：订阅类模型的真实使用诉求涌现；或 provider 开放第三方可注册 client；或产品负责人显式启动。