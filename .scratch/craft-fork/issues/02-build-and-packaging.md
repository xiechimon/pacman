---
labels: [wayfinder:research]
status: closed
blockedBy: []
---

# 02 · 构建与分发路径

## Question

以 `/tmp/craft-agents-oss-survey`（v0.13.3）为准，搞清 macOS 上的完整构建链：

1. `bun install` 的 workspace 结构与已知坑（postinstall、原生模块、Electron 版本钉版）
2. Electron 开发模式的最短启动命令（从 clone 到看到窗口）
3. 打包机制：electron-builder 还是其他？配置文件在哪、产物形态（dmg/zip）、未签名包在本机运行的限制（Gatekeeper/quarantine）
4. 无头 server 怎么跑（`bun run` 还是 build 产物）、CLI 怎么连
5. pi-agent 子进程在 dev 与打包两种形态下分别怎么被拉起

输出：从 clone 到跑起来的**最短命令序列** + 各形态产物清单。是 ticket 03（实跑验证）与 ticket 05（验收标准）的输入。

## Answer

调研对象：`/tmp/craft-agents-oss-survey`（craft-agents-oss v0.13.3 本地 clone，纯静态阅读，未执行任何 install/build/git 命令）。

### a. 从 clone 到看到 Electron 窗口的最短命令序列

```bash
git clone https://github.com/lukilabs/craft-agents-oss.git
cd craft-agents-oss
bun install
bun run electron:start
```

与 README「Build from Source」完全一致（`README.md:79-86`）。各条前提：

1. `git clone` / `cd` — 无前提。
2. `bun install` — 需要本机已装 Bun（CI 用 1.3.10，`.github/workflows/validate.yml:22-23`；打包脚本钉 bun-v1.3.9，`apps/electron/scripts/build-dmg.sh:81`）。`bunfig.toml:9-10` 强制 `linker = "hoisted"`，不要用 `--linker=isolated` 覆盖。`package.json:8-17` 的 `trustedDependencies` 白名单（electron、esbuild、sharp、koffi、@vscode/ripgrep、@sentry/cli、protobufjs、electron-winstaller）决定哪些依赖的 lifecycle script 会被执行；其中 electron 的 postinstall 负责下载 Electron 二进制，`@vscode/ripgrep` 的 postinstall 负责落地 `bin/rg`（`apps/electron/scripts/build-dmg.sh:184-185` 的报错提示明确要求它跑过）。另需 Node.js ≥18 在 PATH 上（`CONTRIBUTING.md:9-10`），因为后续 build 脚本用 `node --check` 校验产物（`scripts/electron-build-main.ts:108-119`）。
3. `bun run electron:start` — 即 `bun run electron:build && electron apps/electron`（`package.json:67-68`）。`electron:build` 串起 main/preload/renderer/resources/assets 五段构建（`package.json:61-67`），其中 `scripts/electron-build-main.ts` 会先构建 session-mcp-server、pi-agent-server、interceptor、WhatsApp worker 再打包 main（`scripts/electron-build-main.ts:312-341`）。渲染进程在无 `VITE_DEV_SERVER_URL` 时 `loadFile(dist/renderer/index.html)`（`apps/electron/src/main/window-manager.ts:351`）。`.env` 可选（OAuth define 缺省为空串，`scripts/electron-build-main.ts:52-66`；`.env.example` 存在）。

如需 HMR 开发回路则用 `bun run electron:dev`（`CONTRIBUTING.md:32-35`）：起 Vite dev server（端口 5173，`--strictPort`）+ esbuild watch + Electron（`scripts/electron-dev.ts:540-605`）。注意首次运行会联网下载 uv 到 `apps/electron/resources/bin/<platform>-<arch>/`（`scripts/electron-dev.ts:53-75`），clone 里不带该二进制。

### b. 各形态产物清单

| 形态 | 入口命令 | 产物路径 | 产物形态 |
| --- | --- | --- | --- |
| Electron dev | `bun run electron:dev`（HMR）或 `bun run electron:start`（一次性构建） | `apps/electron/dist/`：`main.cjs`、`bootstrap-preload.cjs`、`browser-toolbar-preload.cjs`、`interceptor.cjs`、`renderer/`、`resources/` | 目录（直接 `electron apps/electron` 加载，`apps/electron/package.json:5` 的 `main: dist/main.cjs`） |
| Electron 安装包 | `bun run electron:dist:mac`（`package.json:79`）或 `cd apps/electron && bun run dist:mac`（= `scripts/build-dmg.sh arm64`，`apps/electron/package.json:32`） | `apps/electron/release/`：`Craft-Agents-arm64.dmg`、`Craft-Agents-x64.dmg`、同名 `.zip`（electron-updater 用），以及未压缩的 `mac-arm64/Craft Agents.app` | dmg + zip + .app 目录（`apps/electron/electron-builder.yml:10-11,95-103,129,137`） |
| headless server | 源码直跑：`bun run server:start`（= `bun run packages/server/src/index.ts`，`package.json:31`）；开发态 `bun run server:dev` 会先构建子进程 bundle 并设 `CRAFT_BUNDLED_ASSETS_ROOT`（`package.json:32`）；构建产物：`bun run server:build`（`package.json:33`） | 源码形态无产物；构建形态输出 `dist/server/`（含 vendored bun、uv、resources，可选 `.tar.gz`，`scripts/build-server.ts:11-16`）；另有 `Dockerfile.server`（`oven/bun:1.3-slim` 基底，`ENTRYPOINT ["bun","run","packages/server/src/index.ts"]`，EXPOSE 9100） | 源码 / 目录 / tar.gz / Docker 镜像 |
| CLI | `bun run apps/cli/src/index.ts ...`（`apps/cli/package.json:12`） | 无构建产物，TypeScript 源码由 Bun 直接执行 | 源码脚本（bin 名 `craft-cli`，`apps/cli/package.json:8-10`） |

### c. 五个问题逐条结论

**1. `bun install` 的 workspace 结构与已知坑**

- workspace：`packages/*` + `apps/*`（`package.json:18-21`）。实际存在的包：`apps/{cli,electron,viewer,webui}` 与 `packages/{core,messaging-gateway,messaging-whatsapp-worker,pi-agent-server,server,server-core,session-mcp-server,session-tools-core,shared,ui}`。
- linker：`bunfig.toml:1-10` 钉死 `linker = "hoisted"`，注释明确说明 isolated linker 会让 Vite/esbuild 找不到 i18next、@tiptap/*、pdfjs-dist 等传递依赖。这是 install 阶段最关键的坑。
- 生命周期脚本白名单：`package.json:8-17` `trustedDependencies`。Bun 只对白名单内的包跑 postinstall：electron（下载运行时）、@vscode/ripgrep（落地 rg）、@sentry/cli、esbuild、koffi、protobufjs、sharp、electron-winstaller。若用 `--ignore-scripts` 或第三方镜像装，rg 与 Electron 二进制会缺。
- Electron 钉版：根 `package.json:130` 声明 `^39.2.7`，`bun.lock:2002` 锁定 `electron@39.2.7`；打包侧 `apps/electron/electron-builder.yml:5` 再钉 `electronVersion: "39.2.7"`，两处一致。
- 原生/平台依赖：sharp 0.34.5 走 per-platform optionalDependencies（`@img/sharp-darwin-arm64` 等，`package.json:208-217`），无需本地编译；koffi 是 N-API 原生模块，pi-agent-server 打包时对它 `--external`（`packages/pi-agent-server/package.json:12`），运行时从 node_modules 解析。
- 根 `package.json:107` 有 `"prepare": "husky"`，husky 在 devDependencies 内，install 时会执行。
- OSS 导出残缺坑：根 `package.json` 引用的 `scripts/build.ts`、`scripts/release.ts`、`scripts/upload.ts`、`scripts/sync-secrets.sh`、`scripts/fresh-start.ts`、`scripts/oss-sync.ts`、`scripts/check-version.ts`、`scripts/typecheck-staged.sh`、`scripts/electron-dev.sh`、`scripts/tail-electron-logs.sh` 及 4 个 lint 脚本在该 clone 中均不存在（逐个 `test -e` 核实），对应根脚本命令（`build`、`release`、`electron:dev:menu`、`fresh-start`、`sync-secrets` 等）直接跑会失败。

**2. Electron 开发模式最短启动命令**

见上面 a 节：`bun install && bun run electron:start`（README 官方序列）。要 watch/HMR 用 `bun run electron:dev`（`scripts/electron-dev.ts`：esbuild 一次性构建并 `node --check` 校验 → Vite dev server（5173，strictPort）+ main/preload 两个 esbuild watch context → spawn `node_modules/.bin/electron apps/electron`，注入 `VITE_DEV_SERVER_URL`，窗口 `loadURL` 到 dev server，`apps/electron/src/main/window-manager.ts:328-341`）。

**3. 打包机制**

- 打包器：electron-builder（根 devDep `electron-builder@^26.0.12`，`package.json:131`），配置文件 `apps/electron/electron-builder.yml`。`electron:dist*` 系列命令都是 `electron:build` 后进 `apps/electron` 跑 `electron-builder --config electron-builder.yml`（`package.json:78-84`）；`apps/electron/scripts/build-dmg.sh` 则在 `apps/electron` 下 `npx electron-builder --mac --<arch>`（`build-dmg.sh:245`），靠默认发现机制读到同一个 yml。
- 产物形态：macOS target 为 dmg + zip，各 arm64/x64（`electron-builder.yml:95-103`），输出目录 `apps/electron/release`（`:10-11`），命名 `Craft-Agents-${arch}.dmg/.zip`（`:129,137`）。`asar: false`（`:82`），因此没有 asarUnpack 问题。`afterPack` 钩子 `scripts/afterPack.cjs` 仅复制预编译的 macOS 26 Liquid Glass 图标 Assets.car。
- 签名/公证：`hardenedRuntime: true`、`gatekeeperAssess: false`、entitlements 用 `build/entitlements.mac.plist`（`electron-builder.yml:104-107`，文件存在）；`notarize` 段在 yml 里整体注释掉（`:130-133`），只有设了 `APPLE_ID`/`APPLE_TEAM_ID`/`APPLE_APP_SPECIFIC_PASSWORD` 时 build-dmg.sh 才导出 `NOTARIZE=true`（`build-dmg.sh:232-242`），签名身份由 `APPLE_SIGNING_IDENTITY`→`CSC_NAME` 注入（`build-dmg.sh:224-229`）。本地开发打包命令 `electron:dist:dev:mac` 显式 `CSC_IDENTITY_AUTO_DISCOVERY=false`，即不签名（`package.json:82`）。
- 未签名包在本机运行：配置上确认是不签名、不公证、开 hardenedRuntime。未签名未公证的 app 经下载/传输带上 quarantine 属性后会被 Gatekeeper 拦截（需 `xattr -dr com.apple.quarantine` 或系统设置放行）；本机自构建、未经网络传输的 `release/mac-arm64/Craft Agents.app` 通常不带 quarantine 可直接打开——后两条属 macOS 平台行为，未能从静态代码确认，仅配置侧可确认「默认不签名不公证」。

**4. 无头 server 与 CLI 连接**

- server 直接以 Bun 跑源码：`bun run packages/server/src/index.ts`（`package.json:31`，`packages/server/package.json:23`），无编译步骤。必需 `CRAFT_SERVER_TOKEN`；`CRAFT_RPC_HOST` 默认 127.0.0.1、`CRAFT_RPC_PORT` 默认 9100，TLS 由 `CRAFT_RPC_TLS_CERT/KEY/CA` 开启（`packages/server/src/index.ts:1-30` 头部注释）。`server:build`（`scripts/build-server.ts`）才产出带 vendored bun/uv 的自包含 `dist/server/` 目录或 tar.gz，用于 Linux 部署；Docker 镜像 (`Dockerfile.server`) 也是直接 `bun run packages/server/src/index.ts`。
- CLI：`bun run apps/cli/src/index.ts --url ws[s]://host:9100 --token <token>`，或环境变量 `CRAFT_SERVER_URL` / `CRAFT_SERVER_TOKEN`（`apps/cli/src/index.ts:149-150,1916,2011`）；协议是 WebSocket + MessageEnvelope 握手（`apps/cli/src/client.ts` 头部与 connect 逻辑）。无 unix socket。另外 `--validate-server` 路径会自动 spawn 一个临时 server：`Bun.spawn(['bun','run',packages/server/src/index.ts])`，随机 token + `CRAFT_RPC_PORT=0`，解析 stdout 里的 `CRAFT_SERVER_URL=` 行拿地址（`apps/cli/src/server-spawner.ts:55-124`）。Electron 桌面端也可以 thin-client 模式连远端：`CRAFT_SERVER_URL=... CRAFT_SERVER_TOKEN=... bun run electron:start`（`README.md:178-184`）。

**5. pi-agent 子进程的拉起**

- 构建：`packages/pi-agent-server` 由 `bun build src/index.ts --outdir=dist --target=bun --format=esm --external koffi` 打成单文件 ESM（`packages/pi-agent-server/package.json:12`；dev 路径 `scripts/electron-dev.ts:336-353`，prod 路径 `scripts/electron-build-main.ts:213-258`）。用 bun 而非 esbuild 的原因：Pi SDK 依赖是 ESM-only，esbuild 的 packages:external 会留下运行时报错的 `require()`（`scripts/electron-dev.ts:242-244,332-335` 注释）。
- 拉起方：`packages/shared/src/agent/pi-agent.ts:427-501` 的 `PiAgent.spawnSubprocess()`，用 Node `child_process.spawn(nodePath, args, { stdio: ['pipe','pipe','pipe'] })`，JSONL over stdio；有 interceptor 时 `args.unshift('--require', interceptorPath)`。路径来源：`runtime.paths.piServer` / `runtime.paths.node`，由 pi driver 从 `resolveBackendRuntimePaths()` 接线（`packages/shared/src/agent/backend/internal/drivers/pi.ts:219-226`）。
- dev 形态：`resolveServerPath` 在非 packaged 时从 appRootPath 向上最多 10 级找 `packages/pi-agent-server/dist/index.js`（`packages/shared/src/agent/backend/internal/runtime-resolver.ts:171-182`）；`nodePath` = 系统 PATH 上的 bun（非 packaged 允许 PATH fallback，`runtime-resolver.ts:63-82`），兜底 `process.execPath`。interceptor 在 dev 直接用 TS 源码 `packages/shared/src/unified-network-interceptor.ts`（`runtime-resolver.ts:154-165`，Bun 原生支持 `--require *.ts`）。Electron dev 下 spawn 的父进程就是 Electron main 进程（内嵌 server 走 `bootstrapServer`，默认端口 0，`apps/electron/src/main/index.ts:584-618`）；headless server 下父进程是跑 server 的 Bun 进程。
- 打包形态：`piServerPath` = `<app>/resources/pi-agent-server/index.js`（`runtime-resolver.ts:172-176`，`electron-builder.yml:23` 把该目录打进 app files）；`nodePath` = app 内 vendored `vendor/bun/bun`（`runtime-resolver.ts:63-69`，`electron-builder.yml:55-56` 打进 files，bun 二进制由 `build-dmg.sh:100-122` 按钉版 bun-v1.3.9 下载并校验 SHA256）；koffi 原生库按目标平台裁剪后放在 `resources/pi-agent-server/node_modules/koffi`（`scripts/build/common.ts:520-571`）；interceptor 用预构建的 `dist/interceptor.cjs`（`runtime-resolver.ts:167-168`）。packaged 判定走 `app.isPackaged`（Electron）或 `CRAFT_IS_PACKAGED=true`（headless，`packages/server-core/src/runtime/platform-headless.ts:51`）。
- **缺口（坑）**：把 `packages/pi-agent-server/dist` 拷贝到 `apps/electron/resources/pi-agent-server/` 的 `copyPiAgentServer()`（以及 session-mcp-server 的 `copySessionServer()`）定义在 `scripts/build/common.ts:489-571`，但在 OSS 导出里没有任何现存脚本调用它——`build-dmg.sh` 只拷 SDK/ripgrep/interceptor，不拷这两个 server（通读 `build-dmg.sh` 全文确认）；调用它们的编排脚本 `scripts/build.ts` 不在导出中。`.gitignore` 明确忽略 `apps/electron/resources/{session-mcp-server,pi-agent-server}/`，`electron-builder.yml:21-23` 又要求它们存在。结论：OSS clone 直接 `electron:dist:mac` 打出的包会缺 pi-agent-server / session-mcp-server bundle，Pi 会话与 Codex 会话工具会不可用（运行时只有 warn，见 `scripts/build/common.ts:526-528,648`）；需手工 `cp -r packages/pi-agent-server/dist apps/electron/resources/pi-agent-server/`（并补 koffi）后再打包。bridge-mcp-server 例外：`apps/electron/resources/bridge-mcp-server/index.js` 已随仓库提交。

### d. 坑清单

1. `bunfig.toml:9-10` 强制 hoisted linker；改用 isolated 会直接炸 renderer 构建。
2. `package.json:8-17` trustedDependencies 白名单：electron（下载运行时）、@vscode/ripgrep（落 rg 二进制）等 postinstall 必须被执行，禁 scripts 安装会缺二进制。
3. Electron 双钉版：根 `package.json:130` + `bun.lock:2002` + `electron-builder.yml:5` 都是 39.2.7，升版要三处一起动。
4. OSS 导出缺一批根脚本（`build.ts`/`release.ts`/`upload.ts`/`sync-secrets.sh`/`fresh-start.ts` 等），根 package.json 里对应命令（`build`、`release`、`fresh-start`、`sync-secrets`、`electron:dev:menu`…）是悬空引用。
5. pi-agent-server / session-mcp-server 的 resources  staging 在 OSS 导出里没有可执行入口（`copyPiAgentServer` 无调用方），本地打 dmg 前必须手工 stage，否则打出的 app 缺子进程 bundle。
6. `bun run electron:dev` 首次运行联网下载 uv（`scripts/electron-dev.ts:53-75`）；`electron:start` 不下载，main 进程只 warn（`apps/electron/src/main/index.ts:179-184`）。
7. 构建链依赖系统 Node（`node --check` 校验 esbuild 产物，`scripts/electron-build-main.ts:108-119`），纯 Bun 环境不够。
8. koffi 是原生 N-API 模块且被 `--external`，打包时按平台裁剪拷贝（`scripts/build/common.ts:556-570`）；pi-agent-server 必须 `--target=bun --format=esm` 构建，换 node/cjs 会在运行时炸 ESM-only 依赖（`scripts/electron-build-main.ts:227-229`）。注意 `Dockerfile.server` 里 pi-agent-server 用的是 `--target node --format cjs`，与桌面路径不一致。
9. `asar: false`（`electron-builder.yml:82`）：无 asarUnpack 问题，但整个 app 目录平铺。
10. 默认不签名不公证：`electron:dist:dev:mac` 显式关 `CSC_IDENTITY_AUTO_DISCOVERY`（`package.json:82`），yml 的 notarize 段注释掉（`electron-builder.yml:130-133`）；要公证必须走 `build-dmg.sh` + `APPLE_*` 环境变量。hardenedRuntime 开着，自签/不签的包经网络传输后会被 Gatekeeper 拦。
11. Electron main 里 WhatsApp worker 走 `ELECTRON_RUN_AS_NODE` 复用 Electron 内嵌 Node（`apps/electron/src/main/index.ts:679` 注释），而 Baileys 不能用 Bun 跑（`Dockerfile.server` 注释）——子进程运行时选型是分化的：pi-agent 用 Bun、wa-worker 用 Node。
