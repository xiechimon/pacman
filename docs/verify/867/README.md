# docs/verify/867 — T6 跨机凭据预检证据

票：#867（AMP 对齐 T6）。要证的一件事：**claude-code 步落在没有本机凭据的机器上
时，显式失败并点名「哪台机器、缺哪类凭据、怎么补」**——在此之前它是沉默的。

## 一、现状基线：缺凭据的机器上，这一步是「假成功 + 甩锅」

在**未改动的 main（`383bbaac`）**上，同一套探针（真 server + 真 daemon，daemon 进程
`HOME` 指向空白目录且环境无 `ANTHROPIC_*`）跑一个 claude-code build 步：

- `live-nocred-before.json` → `build.errorMessage = "构建零改动"`，transcript 里 agent 的
  回答原文是 **`Not logged in · Please run /login`**（CLI 的拒绝话术被当成了 agent 的产出
  记进会话），daemon 日志一路走完 `[workspace] 准备工作区...` → `new session ...`。
- 也就是说：机器没登录这件事，用户看到的是**一句和凭据无关的话**（"构建零改动"），
  真实原因（机器没登录）在任何界面面上都不存在。

根因两层：
1. SDK 的 `result` 帧在 API 出错时 **`subtype` 仍是 `"success"`，真话在 `is_error:true`**；
   映射只看 subtype → 这一轮被当成 `done`（正常收工）。
2. 没有任何地方问过「这台机器有没有 claude 凭据」。

## 二、改后：步前显式失败，文案三件齐

同一套探针、同样的空 HOME/空环境，跑在本次分支上：

- `live-nocred-after.json` → `build.errorMessage` =
  `claude-code 步骤无法在机器「t6-mac」上执行：该机器没有可用的 Claude Code 凭据（预检 `claude auth status` = 未登录）。补法（在该机器上做，任选其一）：① 运行 claude 完成 /login；② 在 ~/.claude/settings.json 的 env 里配 ANTHROPIC_API_KEY 或 ANTHROPIC_AUTH_TOKEN；③ 配 apiKeyHelper 输出密钥。凭据不跨机——每台要跑 claude-code 的机器各自配（pacman 不传登录态）。`
  ——机器名 / 凭据类 / 补法三件都在。
- daemon 日志证明**预检发生在工作区准备之前**：`claim step=…` → `[step] failed: <同一段文案>`，
  **没有** `Loading claude-code runtime…`、**没有** `[workspace] 准备工作区...`、**没有** `new session`。

## 三、跨机实测：远端 mea（WSL2 / Linux，另一套凭据落点）

本机 macOS 的凭据在 keychain，Linux 的落在 `~/.claude/.credentials.json` + settings env
——同一份预检在另一套落点上是否成立，在 `mea` 上按同一份探针跑了两遍（server 与 daemon
都在 mea 本机起，`/home/measure/pacman-t6-867` 独立检出，不碰用户自己的 `:8787` 部署）：

| 场景 | 预检判定 | 步的结果 |
|---|---|---|
| **A. 空 HOME + 无 `ANTHROPIC_*`**（`live-nocred-mea-remote.json`） | `loggedIn:false`（rc=1） | `[step] failed: <点名机器/凭据类/补法>`——日志里**没有** `Loading claude-code runtime…`、**没有** `[workspace]`、**没有** `new session` |
| **B. mea 真实凭据**（`live-credentialed-mea.json`） | `loggedIn:true`（oauth_token） | 预检放行 → `Loading claude-code runtime…` → `[workspace] 准备工作区...` → `new session` → 走到真模型调用（本探针用的 `claude-sonnet-4-5` 在该 relay 上不存在，于是 `model_not_found` 显式失败——**这也是本票 `is_error` 修复的现场**：改前同一轮会被折成 `done`） |

B 这一列是本票最要紧的反向证据：**有凭据的远端机器不会被误拦**（预检的假阳性代价是拦掉
本可跑的活，方向比漏放更危险）。

## 四、判定来源：CLI 自己的答案

预检跑 `claude auth status`（机器本地的 `claude`，实测 ~140ms，无网络无模型调用），
输出与退出码见 `claude-auth-status-probe.txt`：

| 机器状态 | stdout | 退出码 |
|---|---|---|
| 空白 HOME + 无 `ANTHROPIC_*` | `{"loggedIn": false, "authMethod": "none", ...}` | **1** |
| 正常登录态 | `{"loggedIn": true, "authMethod": "oauth_token", ...}` | 0 |

⚠️ **退出码 1 是「未登录」的正常形态**（JSON 照常写 stdout）——按退出码判会把这一步折成
「说不清」从而让预检静默失效；这一条是 live 跑踩到后修掉的，单测
`失败方式 6b`（真子进程 rc=1 + stdout 有 JSON）钉住了它。

「说不清」三态里的第三态（CLI 不在 PATH / 超时 / 输出不可解析）**不拦步**，只落一行
诊断（`[step] claude-code auth probe inconclusive: … (continuing)`）：预检的假阳性会拦掉
本可跑的任务，代价高于漏放；这条路径的运行期兜底是同一票修的
`result.is_error` 映射（见 `apps/daemon/test/map-claude-event.test.ts` 失败方式 10/11）。

## 五、复现

探针脚本不入仓（与本仓既有取证惯例一致：`862` 那轮的 live 探针同样是 lane 本地）。复现步骤：

```sh
# 1. 把探针放进 integration 包（它要解析 workspace 依赖）：
#    integration/test/t6-live-nocred.mts（真 server + 真 daemon，同进程）
# 2. 从仓根跑，HOME 指空白目录、清掉 ANTHROPIC_*（否则机器仍算「有凭据」）：
H=$(mktemp -d)
env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN -u ANTHROPIC_BASE_URL \
  HOME="$H" NO_PROXY=127.0.0.1,localhost,::1 \
  node node_modules/.pnpm/tsx@*/node_modules/tsx/dist/cli.mjs \
  integration/test/t6-live-nocred.mts /tmp/out
# 3. before 对照：git worktree add --detach /tmp/before origin/main + pnpm install，
#    同一份脚本同样跑法。
```

探针额外做的一件事：把机器的 `enabledRuntimes` PATCH 成 `['pi','claude-code']`
——`#682` 的 runtime 开关缺省只有 `pi`，机器不主动开 claude-code 就领不到 runtime 步
（与凭据是**两道独立的机器级闸**，本票只管第二道）。

## 六、测试面

- daemon 单测：46 文件 / 431 用例（含本票新增 `claude-code-auth.test.ts` 10 例、
  `map-claude-event` 失败方式 10/11、`runner-runtime` 失败方式 10/11/12、
  `machine-loop` 失败方式 4）。
- `pnpm -r typecheck` 全包绿；`pnpm lint` 零新增告警。
- integration 全套 20 文件 / 59 用例绿（改的是 daemon 跨层行为，受影响面判据
  `scripts/e2e-affected.mjs` 判「无 web e2e 面，覆盖在 integration 层」）。