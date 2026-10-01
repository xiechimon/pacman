# server + daemon 分体部署集成验证（XMON-53 预检，#519 stage 2）

> 目录名用 issue identifier（本票来自 Multica 票池，无 GitHub 编号可挂），不进 `docs/verify/<GitHub 票号>/` 序列。

## 验证的是什么

`xiechimon/pacman#519` 的目标状态（02 册 A1）：server 以 `HOST` 绑常开主机、`PACMAN_TOKEN` 常开；daemon 在另一台机器用 `PACMAN_SERVER` 指过去；笔记本只当浏览器。本票是**部署裁定前的预检**——在现有机器（mea）上把「分体启动 → 机器注册 → 任务 claim → 心跳」走通，逐项留可核证据。

与既有集成面（`integration/test/helpers.ts`：同进程 `app.fetch` + 回环监听）的区别就是本票的判据本身：**两个真进程**。server 由 `apps/server` CLI 入口起，绑 mea 的非回环地址 `172.16.10.126`、`PACMAN_TOKEN` 常开；daemon 由 `apps/daemon` CLI 入口起，`PACMAN_SERVER` 指向那个 URL。中间没有进程内直连，字节全走 TCP。

## 结论

四条验收面全部**通过**，无断裂。

| 验收面 | 判定 | 证据 |
|---|---|---|
| 分体启动（真进程 × 非回环 HTTP，非同进程内存直连） | 通过 | A1 / A2 / B2 |
| 机器注册 | 通过 | B2 / B3 / B4 / B5 |
| 任务 claim | 通过 | C1 / C2 |
| 心跳 | 通过 | D1 / D2 |
| 附加：步收尾回程（done → phase 推进 → transcript 落库） | 通过 | E1 / E2 / E3 / E4 |

`kind: local` 的 seed 机器行 `DESKTOP-N9CSRE4` 与本次验证无关（server 首启 seed 产物，`online:false`）；本次注册的机器是 `kind: remote`。

## 跑法

```sh
# 依赖装好后（pnpm install），在仓库根：
cd integration
pnpm exec vitest run test/xmon53-split-deploy-e2e.test.ts
```

- 主机取本机第一个非回环 IPv4（`os.networkInterfaces()`，优先 192.168/10./172.16-31），可用 `XMON53_HOST` 覆写；端口动态取空闲口。
- 两个子进程各用独立 `PACMAN_HOME`（`mkdtempSync`），代理环境变量清空。
- 证据落盘目录 `XMON53_EVIDENCE_DIR`，缺省 `docs/verify/XMON-53/run-<epoch ms>/`：`evidence.json`（下表逐条原文）、`server.log`、`daemon.log`。
- 用例内文档：`integration/test/xmon53-split-deploy-e2e.test.ts`。测试用 `stub-llm`（OpenAI Chat Completions 兼容的假网关）当 provider，不需要真模型密钥；首轮响应延迟 75s，制造步内 ≥2 拍心跳的观测窗。

本次实测运行的证据目录：`docs/verify/XMON-53/run-1790834552103/`。

## 证据逐条

完整原文见该目录的 `evidence.json`；下表是每条的实际观测。

| 编号 | 断言 | 实测 |
|---|---|---|
| A1 | `HOST=<非回环>` 绑定后，`/api/teams` 无凭证 401、带 `PACMAN_TOKEN` 200 | 无凭证 `401 {"error":"Unauthorized"}`；带 token `200 [{"id":"LuHeCOCWXPvFE3_qw8gSY",…}]` |
| A2 | 显式 `HOST` 时回环口不监听（分体真的走那张网卡） | `http://127.0.0.1:38752/api/teams` → `connect ECONNREFUSED` |
| B1 | token 闸下签发机器 bootstrap apiKey | `201`，`masked:"pacman_c175a344…"` + 一次性 `plaintext` |
| B2 | daemon 经 `PACMAN_SERVER` 注册，polling 地址是非回环 URL | `Online (machineId=9HFRrZh-iWOZzCjCDoB_8); polling http://172.16.10.126:38752` |
| B3 | daemon 本机 `machine.json` 记下远端控制面地址 | `serverUrl: "http://172.16.10.126:38752"`（server 按请求源派生，非写死回环） |
| B4 | server 侧 SQLite `machine` 行 | `{id: qDzos…, name: "xmon53-mea", online: 1, kind: "remote", latestCliVersion: "0.2.0"}` |
| B5 | web 面 REST 可见该机器 | `GET /api/teams/<id>/machines` → `200`，含注册机器（`online:true`） |
| C1 | 远端 daemon 领到 server 派发的步 | `daemon.log`：`claim step=7weGMJL_MQNx7VRVbxyYX` |
| C2 | server 侧 `step` 行绑定到该机器 | `{id: 7weG…, kind: "plan", machineId: "9HFRrZh-iWOZzCjCDoB_8", status: "claimed", claimedAt: 1790834574274}` |
| D1 | 步级 30s 心跳真到达 server | `lastHeartbeatAt` 第 1 拍 `1790834574274`（claim 时置位）→ 第 2 拍 `1790834604365`，**间隔 30.091s** |
| D2 | presence 心跳把机器置 `online` | `machine.online = 1` |
| E1 | 步收尾 done，`sessionId` 回传落地 | `{status:"done", sessionId:"01a0f60f-0415-700f-a8e8-c286ec620fb3"}` |
| E2 | 规划步完成后 todo phase 推进 | `{phase:"confirm"}` |
| E3 | transcript 经 upload 回程落库 | `message` 表 5 行（`conversationId = <buildId>`） |
| E4 | 本轮两步（首轮 plan + 补写轮）均由同一远端机器执行 | 两行 `step`，`machineId` 均为 `9HFRrZh-iWOZzCjCDoB_8`，`status` 均 `done` |

D1 的口径：`services/machines.ts` 在 claim 时把 `lastHeartbeatAt` 置为 `claimedAt`，所以「第 1 拍」与 claim 时刻同值不是心跳到达；**第 2 拍才是 `POST /api/machine/heartbeat/:stepId` 的第一次真实到达**（+30.091s），命中 daemon 侧 30s 的步级 heartbeat 节拍。

## 本票未覆盖（等部署裁定）

- 常开主机搬家（mea vs dmit VPS）、笔记本关机、跨真机拓扑：主机未裁定，按票面等部署后再验，届时由编排更新范围或另开票。
- 浏览器面：本次 server 以 API-only 形态起（无 `apps/web/dist`），`phase` 推进在不接任何浏览器的情况下完成——「笔记本只当浏览器」在这条链路上成立，但 web 端 token 门页（`apps/web/src/overlay/token-gate.tsx`）未实测。
- MCP 面（`/api/mcp`）：不在本票验收面内。`PACMAN_TOKEN` 常开时该端点双凭证死锁是 XMON-49 记录并补口的缺口（PR `#553`，本分支未合并），部署前需确认那一支已落 main。
- presence 心跳的**节拍复现**没有独立计数：server 无请求日志，本票只有 `online` 由 0 置 1 这一条。步级心跳的 30s 节拍由 D1 两拍递进证到。

## 观察记录（非断裂）

- **#113 规划补写轮在分体形态下照常触发**：假网关只回文本、不落 `plan.md` 时，第一轮 plan 步 done 后 server 再入队一轮 plan（`prompt` 非空即放行 confirm），phase 停在 `planning` 直到补写轮收尾。这是既有设计，不是分体引入的行为；部署 runbook 记一笔：执行机上没有 `plan.md` 产物时，一次规划会跑两轮。
- `machine.json` 的 `serverUrl` 由 server 按**请求源**派生，不是配置回填。反向代理若不转发正确的 Host/scheme，这个值会指向内部地址——与 XMON-52 记录的同一条部署注意事项。