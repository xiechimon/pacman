# docs/verify/862 — T1 跨机续跑证据

两轮 live 证据：先同机（两个 scratch home 都在本机）打底，再 **跨物理机**
（Mac ↔ mea/WSL2）按票面验收口径补跑。两轮都用真模型跑通，全部 check 通过。

## 一、同机 live（首轮，2026-10-05 00:5x）

scratch 栈（server 8796 + web 5278，全新库）+ 真 daemon ×2（独立 PACMAN_HOME、
独立机器身份 daemon-a / daemon-b）+ stub LLM（门控 30s/轮，OpenAI SSE 兼容）。
探针脚本：`/tmp/pacman-t1-862/drive-reclaim.mjs`（lane 本地）。

链路（build `01a107d2-b5ab-7d26-9d67-e97fa370ae28`，`result.json` 有完整 check 表）：
daemon-a 认领 → kill -9 整进程组 → 失联释放回 pending（machineId 清空）→ 历史会话行
（sqlite 直插 done 步）使 daemon-b 的认领载荷为 `continue sess-seed-1` → `SessionNotResumable`
→ 回退新会话 + transcript 显式 system 注记 → 步收尾。8 项中 7 通过；第 8 项是 stub agent
零改动触发的产物闸（闸行为正确，非机制失败）。

文件：`result.json` / `steps.json` / `transcript.json` / `daemon-a-tail.log` /
`daemon-b-tail.log` / `probe.log`。

## 二、物理机跑：Mac daemon-A ↔ mea(WSL2) daemon-B（2026-10-05 补跑）

票面验收要求「在 mea 上钉选跑长任务，kill 本机 daemon，mea 捡起步并推完」。上面那份
是**同机**双 daemon；这一份的 B 端是真正的另一台机器（mea，WSL2），模型是**真模型**。

### 拓扑

- **server**：本机（Mac）scratch 栈，`VERIFY_PORT=8795`；mea 侧经 tailnet
  `http://100.125.21.46:8795` 访问同一 server。
- **daemon-A**：本机进程（`PACMAN_HOME=/tmp/pacman-t1-862-phys/home-a`，机器名 `daemon-mac`）。
- **daemon-B**：mea 上的独立进程（checkout `/home/measure/pacman-t1-862`、
  `PACMAN_HOME=/home/measure/.pacman-t1-862`，机器名 `daemon-mea`）。**不碰 mea 上用户
  自己的部署**（`:8787` 的 server / daemon / vite 三件套全程 active）。
- **模型**：真模型 `glm-5.3` 经 relay（api `openai-completions`，compat = `max_tokens` +
  无 store + 无 developer 角色）；provider 的 key 取自 mea 自己的 `~/.claude/settings.json`
  （用户既有配置，未新建）。
- 探针：`.claude/verify-shots/t1-physical-862/drive-physical.mjs`（lane 本地，未进仓）。

### 链路（19 项 check 全过，见 `mea-physical-result.json`）

1. daemon-B 先注册拿 machine id，随即停掉并**验证进程确实消失**。
2. build P（todo.machineId = **mea 的 machine id**，钉选）→ A 空闲在线但**拒领**
   （钉选过滤；A 忙着别的步时「拒领」说明不了什么，所以 P 建在 U 之前）。
3. build U（**未钉选**，6 个文件 × 20 行的长活）→ A 认领并**跑真模型**。
4. 认领之后直插一行 `done` 步带 sessionId（等价于「本 build 上一轮已在 A 上跑完、
   会话文件留在 A 本地」）——A 的 claim 已是 new，插行只影响**后续**认领（= B 的
   `continue` 载荷）。
5. daemon-B 起（mea）→ pin 命中，B 领 P 并跑真模型到 done。
6. `kill -9` 本机 daemon-A **整进程组**（本机「关机」，A 的步停在运行中）。
7. 心跳停更超 120s + tick → `sweepAbandonedBuildSteps` 把 U 的步释放回 pending
   （machineId 清空；`released-to-pending-null-machine` 实测）。
8. B 认领 U 的步：claim 载荷 `continue sess-prior-on-mac` → mea 上没有该会话文件 →
   B 侧日志 `continue session unavailable (sess-prior-on-mac) — falling back to new session`
   → transcript 显式 system 注记（`resume-note-<stepId>`，内容 = 共享 canon
   `原会话不可复用，已用新会话重跑（上下文可能不完整）`）→ 真模型把 6 个文件写完并推到
   终态 `done`（托管裸仓出现 conv 分支）。

### runner 对照（WSL2 执行语义，票面 T1 附加项）

- mea = WSL2（`Linux 6.18.40.1-microsoft-standard-WSL2`，git 2.53.0，node v22.23.2），
  daemon 是普通用户进程（本次 nohup + setsid 起）。
- 工作区 = 从 server 的托管 bare repo 经 HTTP 克隆（跨机走 tailnet）；**会话文件是执行机
  本地资产** → 换机认领必然降级新会话，这正是显式注记要标记的那件事。
- 与 Amp runner 语义对照：Amp 自有 runner 只能「暂停 / 重连」，本链路给的是「本机 daemon
  死了，另一台机器**接着跑完**」（wiki [[Amp Orbs 与编排对照]]）——前提 = 本票补的
  claimed-step 超时释放。

### 施工期环境事实（记下来）

- mea `/tmp` 是 13G tmpfs 且**已 100% 满**：一切落盘位改走 `/home/measure`。
- mea 的 daemon 从登录环境继承代理（`[pacman] Proxy: http://127.0.0.1:7890`）；scratch
  server 在 Mac 的 tailnet 地址上，daemon 必须把该地址并进 `NO_PROXY`，否则请求被代理
  吞掉返 502。
- 死机器的 claim 长轮询会在 server 侧留一轮 `waitWake`（75s），到点仍会 `tryClaim` 把步
  「认领给幽灵机器」（实测踩到一次）。等一轮 hold 过完再建票即可绕开。

## 三、真模型跑不起来的根因：provider baseUrl 少 `/v1`

上一轮的「real-model gap」现象是 daemon 侧 `[step] error: Stream ended without
finish_reason (retryable=false)`（4 次同形），据此判「relay 通道问题，留给 T6」。
本次用记录代理（`/tmp/t1-relay-proxy.mjs`：provider baseUrl 指到 `http://127.0.0.1:8799`，
代理原样转发并落盘）抓到 daemon→relay 的**真实请求/响应**：

- 请求 URL = `/chat/completions`（**不是** `/v1/chat/completions`，见
  `relay-capture-meta.json`）；
- 响应 = **200 + relay 的 SPA HTML**（`relay-capture-response-head.html`），不是 SSE，
  `finish_reason` 计数 0。

根因：**provider `baseUrl` 少了 `/v1`**。pi 只在 base 后面拼 `/chat/completions`，base 写成
`http://112.80.47.186:8783` 就会打到 relay 的站点首页路由；pi 解析不到任何 SSE chunk，于是
报「Stream ended without finish_reason」。请求本身是干净的：`store` 未发、`max_tokens` 在用、
12 个 tool 正常（`relay-capture-request-shape.json`）。

修法（配置面）：baseUrl 写全 `http://112.80.47.186:8783/v1`。改后同一 daemon、同一 key、
同一模型正常出活（本节物理机跑与首轮同机跑的 model 调用都是这么过的）。

## 四、文件清单

- 同机：`result.json`、`steps.json`、`transcript.json`、`daemon-a-tail.log`、
  `daemon-b-tail.log`、`probe.log`。
- 物理机：`mea-physical-result.json`（19 项 check + 两条 build 的步时间线 + 机器行 + 托管仓
  分支 + WSL2 runner 事实）、`mea-physical-steps.json`、`mea-physical-transcript.json`
  （终稿，含注记行）、`mea-physical-daemon-{mea,mac,mac-home}.log`。
- relay 取证：`relay-capture-meta.json`、`relay-capture-request-shape.json`、
  `relay-capture-response-head.html`。
- 上一轮的失败档（保留作对照）：`real-model-gap-deepseek.log`、`real-model-gap-glm.log`。

## 五、已知缺口（归后续票）

- **释放后仍无在线机器 → 下一轮按失败收尾**（`sweepAbandonedBuildSteps` 的 ① 分支），
  超时策略归 T3。
- **pin 与续跑的交互**：释放保留 `pinnedMachineId` → 钉选到**离线**机器的步他机接不了
  （本轮 P 实测 A 拒领）。会话亲和是 T2 的领地，此语义按 T2 定夺。
- **幽灵认领**：死机器的 claim 长轮询到点仍会 `tryClaim`，把步认领给已死机器；本轮由
  sweep 的 120s 释放兜住（同族于 B-C7）。
- **建议（不在本票范围）**：daemon 侧拿到非 SSE（`content-type: text/html`）响应时直接报
  「endpoint 形状不对（baseUrl 需含 /v1）」，别把它折成 `Stream ended without
  finish_reason` —— 后者把一次配置错误伪装成通道/模型故障。