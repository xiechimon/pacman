# serve-live: pacman XMON-115（chief set_remote_shell 恢复）

- 状态: RUNNING（best-effort，无 supervisor；机器重启 / WSL 关闭即失效）
- 起于: 2026-10-02
- 票号: XMON-115（R4 chief `set_remote_shell` 写入点恢复）
- 分支: hp/pacman/t-0010-xmon-115-r4-chief-set-remote-shell @ `e44848a`（浅克隆 --depth 1）
- 代码: /home/measure/serve-live/xmon-115/pacman（**独立克隆**，未碰 /home/measure/pacman 用户部署）
- 形态: 生产构建 web（`pnpm --filter @pacman/web build` = 本分支产物）+ `tsx src/index.ts` 同源单端口 28115；真 daemon（enrolled 到本栈）+ 本地脚本桩 LLM（无真密钥，模型决策面顶替；链路其余全真）

## 进程（停法精确到 PGID，从不按进程名杀）

| 角色 | PGID | 子 PID | 端口 | 停法 |
|---|---|---|---|---|
| server（node tsx src/index.ts） | 1103829 | 1103841 | 28115（HOST=0.0.0.0） | `kill -TERM -1103829` |
| daemon（pacman cli.ts start --foreground） | 1105085 | 1105098 | — | `kill -TERM -1105085` |
| stub LLM（node stub-llm.mjs） | 1102519 | 1102519 | 28116（0.0.0.0） | `kill -TERM -1102519` |

一行停全栈：`kill -TERM -1102519 -1103829 -1105085`

重启（workdir = 上面「代码」路径；PID 会变，按 ss -ltnp 认）：

```sh
D=/home/measure/serve-live/xmon-115
TSX=$D/pacman/node_modules/.pnpm/tsx@4.23.15/node_modules/tsx/dist/cli.mjs

# 1. stub LLM
setsid nohup node $D/stub-llm.mjs 28116 >> $D/stub.log 2>&1 < /dev/null &

# 2. server
cd $D/pacman/apps/server && PORT=28115 HOST=0.0.0.0 NO_PROXY='*' \
  PACMAN_HOME=$D/home PACMAN_SKILLS_DIR=$D/skills PACMAN_MCP_CONFIG=$D/no-mcp.json \
  setsid nohup node $TSX src/index.ts >> $D/server.log 2>&1 < /dev/null &

# 3. daemon（api-key 明文在 $D/apikey.txt，scratch 内，勿外传）
cd $D/pacman/apps/daemon && PACMAN_SERVER=http://127.0.0.1:28115 NO_PROXY='*' \
  PACMAN_HOME=$D/daemon-home PACMAN_SKILLS_DIR=$D/skills PACMAN_MCP_CONFIG=$D/no-mcp.json \
  setsid nohup node $TSX src/cli.ts start --foreground \
    --api-key "$(cat $D/apikey.txt)" --team FK1S8b3UJFA4Og3PMiQPx --name xmon115-daemon \
    >> $D/daemon.log 2>&1 < /dev/null &
```

- 数据根（scratch，未碰真 `~/.pacman`）: server = $D/home（DB: home/server/server.db）；daemon = $D/daemon-home
- 日志: $D/server.log / $D/daemon.log / $D/stub.log
- 自检: `NO_PROXY='*' node $D/selfcheck.mjs 28115`（无头浏览器打生产构建端口）

## 对端 → 地址 → 实测结果（2026-10-02 本 run 实测）

| 对端 | 地址 | 结果 |
|---|---|---|
| 用户那台 Mac（tailnet `xmons-macbook-air` / 100.125.21.46；mea 的 ssh 别名 `mac`） | http://100.65.44.76:28115/ | **200**（0.90s） |
| 同上 | http://100.65.44.76:28115/api/auth/session | 200 |
| 同上 | http://100.65.44.76:28115/app/resources/agents/nMoSPo8fUSQ5lH-PS69Or | 200 |
| 本机（mea / WSL2） | http://127.0.0.1:28115/ | 200 |

注：mea 是 WSL2，只与 Windows 宿主共享 loopback；对外只给 tailnet 地址 `100.65.44.76`。Windows 宿主走 `http://localhost:28115`（未实测）。

## 种子数据（scratch 内，供直接复验）

- teamId `FK1S8b3UJFA4Og3PMiQPx`（首启 seed 单用户 Owner，自动登录）
- provider `stub-gw`（baseUrl = 本地脚本桩 http://127.0.0.1:28116/v1）
- **目标 agent** `xmon115-shell-agent`（id `nMoSPo8fUSQ5lH-PS69Or`，tools 当前 = `[推送分支, 远程 shell]`）
- chief 绑定 agent `xmon115-chief`（id `tMSrC9fPzgqO9FtkenZMu`）
- 机器 `xmon115-daemon`（id `E9taURccp9PpCZdSMGNgp`，online，**shellEnabled=true**）；另有一条 server 自 seed 的本机行 DESKTOP-N9CSRE4（shellEnabled=false，未动）
- 项目 `xmon115-shell-demo`（id `lvadfGvU9x4cEYdLCKC3A`）+ 一条演示任务
- 已跑 3 轮 chief 会话（授予 → 撤销 → 授予）
- api-key / machine token 明文: $D/apikey.txt（scratch 内，勿外传）

## 脚本桩行为（本演示唯一的非真面）

`stub-llm.mjs` 对 chief 回合固定回一个 `set_remote_shell` 工具调用：目标 agentId 读
`$D/target-agent.txt`，**授予/撤销交替**（第 1 次授予、第 2 次撤销、第 3 次授予…）。
所以在总管会话里每发一条消息，那个开关就翻一次。除模型决策外全链真实：
daemon 领 chief 步 → remoteTools relay 到 server → server executor 写 agent.tools。
