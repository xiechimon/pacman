# serve-live profile — XMON-24 详情域 shadcn 迁移体验实例

- 形态：生产同源单端口（vite build 产物 `apps/web/dist` 由 server 静态托管，非 dev server）
- 地址：`http://100.65.44.76:8795/app`（Tailscale IP；mea 是 WSL2，127.0.0.1 对端不可达）
- 端口：8795（HOST=0.0.0.0，全网卡）
- 数据根：`/home/measure/multica_workspaces/xmon-debb4a8be717/xmon-24-9ac89583b42e/workdir/.serve-live/home`（scratch，首启 seed 单用户 Owner，无鉴权）
- 日志：`/home/measure/multica_workspaces/xmon-debb4a8be717/xmon-24-9ac89583b42e/workdir/.serve-live/server.out`
- 进程：wrapper PID/PGID `93338`（setsid 会话首进程）；实际监听 node PID `93448`（同进程组）
- 启动命令（复现用）：
  ```sh
  cd /home/measure/multica_workspaces/xmon-debb4a8be717/xmon-24-9ac89583b42e/workdir/pacman/apps/server
  setsid nohup env HOST=0.0.0.0 PORT=8795 \
    PACMAN_HOME=/home/measure/multica_workspaces/xmon-debb4a8be717/xmon-24-9ac89583b42e/workdir/.serve-live/home \
    pnpm exec tsx src/index.ts >> .../.serve-live/server.out 2>&1 &
  ```
- 停止命令：`kill -TERM -93338`（按进程组杀；先 `ps -o pid,pgid,cmd -g 93338` 核对命令行含 tsx/pacman 再杀，永不按进程名杀）
- 存活语义：**best-effort**——无 supervisor（无 systemd/launchd 托管），mea 重启或 OOM 后不会自拉起

## 对端实测（serve-live 硬规则：对端实测才叫通）

| 源 | 地址 | 结果 |
|---|---|---|
| mea 本机 | `http://127.0.0.1:8795/api/auth/session` | 200 |
| mea 本机 | `http://127.0.0.1:8795/app` | 200 |
| 对端 Mac（`ssh mac` curl） | `http://100.65.44.76:8795/app` | **200** |
| 对端 Mac（`ssh mac` curl） | `http://100.65.44.76:8795/api/auth/session` | **200** |

`ss -ltnp`：`LISTEN 0.0.0.0:8795 node pid=93448` 在位。

## 服务端裸绑定 WARN（原文照转）

> WARN (93448): 绑定 0.0.0.0（全网卡可达）且 PACMAN_TOKEN 未设——API 面裸奔于所有网络接口；设 PACMAN_TOKEN=<token> 开启 Bearer 鉴权，或 HOST=127.0.0.1 收回本机

（本机在 tailnet 内，暴露面 = tailnet；未设 token 是有意的——用户体验实例免登录。）

## 种子数据（看什么）

| todo | 相位 | 看点 |
|---|---|---|
| `g4rv54hX4XI_L8Avgo-ry`（审核探针） | confirm | thread 面三栏 + 右 pane（文档/分支与 PR/Token/运行历史 型选钮）、AI 审核对话框（review-dialog）、composer |
| `Z8XYCcJ_hFZiA0R6p4P2r`（详情域迁移体验任务） | fresh | fresh 面左中贴合、composer 空态、更多菜单（user-menu） |

branch-dialog fixture 面：看板 `?scenario=01` → 卡片分支钮（live 看板不挂 branch 弹层是 #560 既定行为，非迁移回归）。
