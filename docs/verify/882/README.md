# docs/verify/882 — daemon 撞到非 SSE 端点时点名真实响应形态

票：#882。要证的一件事：**provider 端点回的不是 SSE 流时，daemon 的失败文案把
真实形态报出来**（状态码 / content-type / 前若干字节 / 请求 URL / provider baseUrl
/ 哪台机器）——在此之前它只有 `Stream ended without finish_reason` 一句，看着像模型
或通道坏了，实际是端点形态不对。

## 一、现状基线：文案里一个字都没有

`live-before.json`（`origin/main` = `b16e6e2c`，同一份探针，真 pi 会话打真 HTTP）：

| 响应形态 | 宿主看到的失败文案 |
|---|---|
| 正确 SSE（`/ok/v1/chat/completions`） | 无失败（`done`） |
| **200 `text/html`**（baseUrl 少 `/v1` → 打到站点 SPA 路由） | `Stream ended without finish_reason` |
| 404 `application/json` | `404: {"message":"model not found","type":"invalid_request_error"}` |

第二行就是本票的现场：**状态码 200、content-type `text/html`、请求 URL、baseUrl、
机器名，一个都不在文案里**。第三行虽有状态码，但没有端点，也没有机器——跨机派发时
看不出「哪台机器打到了哪个 URL」。

## 二、改后：同一份探针，同一套条件

`live-after.json`：

```text
[sse]       done=true   error=(none)
[html]      done=false  error=Stream ended without finish_reason
                           provider response: POST http://127.0.0.1:61474/spa/chat/completions
                           -> 200 text/html; charset=utf-8 (not an SSE stream);
                           provider baseUrl "http://127.0.0.1:61474/spa"; machine "t6-mac";
                           first bytes: "<!doctype html><html lang=\"en\"><head>..."
[notfound]  done=false  error=404: {"message":"model not found","type":"invalid_request_error"}
                           provider response: POST http://127.0.0.1:61474/nope/chat/completions
                           -> 404 application/json (not an SSE stream);
                           provider baseUrl "http://127.0.0.1:61474/nope"; machine "t6-mac";
                           first bytes: "{\"error\":{\"message\":\"model not found\",...}}"
```

三件事同时成立：

1. **正确 SSE 一字未改**——`sse` 那一行照旧 `done`、零 error（正常路径不读体、
   不加延迟；非 SSE 才读前若干字节）。
2. **200 HTML 这一档，真凶三件齐**：真实状态码 + content-type（`text/html`，
   明写 `(not an SSE stream)`）+ 前若干字节，并点名请求 URL、provider baseUrl
   与机器名——`baseUrl "…/spa"` 与 `POST …/spa/chat/completions` 并排，少一段路径
   一眼可见。
3. **404 那一档与上面两档可区分**：它多了自己的状态码与 body，同时又拿到了端点与
   机器名（改前没有）。

判定：**三档文案两两不同**，且第二档是「从无到有」。

## 三、单测钉扎

- `apps/daemon/test/provider-response.test.ts`（新增 14 例）：起真 `node:http` 服务器
  供三种形态，断言记录面与文案面。失败方式 1–11 逐条对应（见文件头枚举）。
- `apps/daemon/test/map-pi-event.test.ts`：新增「装饰位生效 + `retryable` 取原始
  文案」的用例。`mapping-pin-before.txt` 是这条用例在 `origin/main` 上的实跑输出
  ——**红**（`Received: "Stream ended without finish_reason"`），在本分支上绿。

## 四、改动面

```diff
 apps/daemon/src/backend/
+  provider-response.ts      # 响应形态记录 + 文案（纯函数为主，不 import pi）
   pi.ts
+    MapState.diagnose       # 错误文案装饰位（#698 错误透传那条线上）
+    PiBackendOpts.machineName
+    open(): 把记录用的 fetch 接进本会话 runtime 的 streamSimple
     machine-loop.ts         # machineName = config.name（与 #867 同值来源）
```

接点说明：pi 的请求选项有 `fetch` 位（pi-ai `ProviderRequestOptions.fetch`，三家适配器
都消费），但 `createAgentSession` 没把它暴露出来——唯一接点是本会话 runtime 的
`streamSimple`（会话级私有对象，开出即抛）。包一层只做旁路记录 + 原样返回：请求与
响应都不改写，适配器不吃这个位时整条诊断静默降级（fail-open），绝不改坏既有文案。

## 五、复现

探针脚本不入仓（与本仓既有取证惯例一致：`862` / `867` 的 live 探针同样是车道本地）。
探针做的事：本地 `node:http` 起三个端点（正确 SSE / 200 HTML / 404 JSON），对每个端点
建一个 `createPiBackend({agentDir, sessionDir, machineName:'t6-mac'})` 会话、发一轮
`reply with exactly: ok`、把 `error` 事件的文案落盘。

```sh
# 探针放进 integration 包（它要解析 workspace 依赖）：integration/test/882-live-non-sse.mts
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY=127.0.0.1,localhost,::1 \
  node node_modules/.pnpm/tsx@*/node_modules/tsx/dist/cli.mjs \
  integration/test/882-live-non-sse.mts /tmp/882-after.json

# before 对照：一次性 worktree 停在 origin/main，同一份探针同样跑法
git worktree add --detach /tmp/pacman-882-before origin/main
cd /tmp/pacman-882-before && corepack pnpm install --frozen-lockfile
cp <lane>/integration/test/882-live-non-sse.mts integration/test/
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY=127.0.0.1,localhost,::1 \
  node node_modules/.pnpm/tsx@*/node_modules/tsx/dist/cli.mjs \
  integration/test/882-live-non-sse.mts /tmp/882-before.json
```

端口是探针自己 `listen(0)` 取的动态口，三档文案里的端口号因此逐次不同——形态判据
（状态码 / content-type / URL 路径 / 机器名）才是钉住的那部分。

## 六、测试与闸

| 层 | 命令 | 结果 |
|---|---|---|
| daemon 单测 | `vitest run apps/daemon/test/` | 47 文件 / **445 用例**绿 |
| integration（受影响面判据选中的层） | `vitest run integration/` | 20 文件 / **59 用例**绿 |
| 类型 | `pnpm typecheck` | 全包绿 |
| 静态 | `pnpm lint` | 零新增告警（改动文件零告警） |
| web e2e 面 | `node scripts/e2e-affected.mjs` | 「无 web e2e 面」（改动全在 daemon 侧） |