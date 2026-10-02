# serve-live profile — XMON-25 pages 域 shadcn 迁移体验实例

- 形态:生产同源单端口(vite build 产物 `apps/web/dist` 由 server 静态托管,非 dev server;构建 = 本 worktree 迁移后代码,普通模式非 fixture)
- 地址:
  - **本机(= 用户的 MacBook Air,本 lane 就跑在这台)**:`http://localhost:8796/app`
  - **tailnet 其它机器**:`http://100.125.21.46:8796/app`(本机 tailnet 名 xmons-macbook-air)
- 端口:8796(HOST=0.0.0.0,全网卡)
- 数据根:`/Users/xmon/.herdr/worktrees/pacman/hp-pacman-t-0005-xmon-25-b4-pages-shadcn/.serve-live/home`(scratch,首启 seed 单用户 Owner,无鉴权;用户真数据 `~/.pacman` 与 8787/5173 真栈零触碰)
- 种子数据(真 API 写路径):
  - 项目「pacman (local)」`ILEg9tgoU-PQswinbigH1` — repoKind=local,localPath 指向本 worktree(真 git 仓,文件面可浏览)
  - 项目「演示项目」`krKlFMSmgOkKMcj8zqXGn` — 无 repo + 2 条 todo(任务面工具栏非空态)
  - 日程面 = 空态(无 daemon/agent,空态本身是迁移面之一);GitHub issues 弹窗 = 未连接面
- 日志:`/Users/xmon/.herdr/worktrees/pacman/hp-pacman-t-0005-xmon-25-b4-pages-shadcn/.serve-live/server.out`
- 进程:wrapper PID `89217` / PGID `89214`;实际监听 node PID `89226`(`lsof` 见 `*:8796 LISTEN`)
- 启动命令(复现用):
  ```sh
  cd /Users/xmon/.herdr/worktrees/pacman/hp-pacman-t-0005-xmon-25-b4-pages-shadcn/apps/server
  env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
    HOST=0.0.0.0 PORT=8796 \
    PACMAN_HOME=/Users/xmon/.herdr/worktrees/pacman/hp-pacman-t-0005-xmon-25-b4-pages-shadcn/.serve-live/home \
    nohup pnpm exec tsx src/index.ts >> .../.serve-live/server.out 2>&1 &
  ```
- 停止命令:`kill -TERM -89214`(按进程组杀;先 `ps -o pid,pgid,command -g 89214` 核对命令行含 tsx/pacman 再杀,永不按进程名杀)
- 存活语义:**best-effort**——无 supervisor(无 systemd/launchd 托管),机器重启或进程被回收后不会自拉起

## 对端实测(serve-live 硬规则:对端实测才叫通)

拓扑事实:本 lane 跑在**用户本人的 MacBook Air** 上(hostname `xmonsMac-3574` = tailnet `xmons-macbook-air` / `100.125.21.46`)——「对端 Mac」即本机,浏览器直接开 localhost 即是;真正的第二台 tailnet 节点是 `mea`(WSL2,100.65.44.76)。

| 源 | 地址 | 结果 |
|---|---|---|
| 本机 | `http://127.0.0.1:8796/app` | 200 |
| 本机 | `http://100.125.21.46:8796/app` | 200 |
| mea(WSL2,tailnet 对端) | `http://100.125.21.46:8796/app` | **200**(`--noproxy '*'`;裸 curl 走 mea 自己的 proxy env 会 502,非服务问题) |
| mea(WSL2,tailnet 对端) | `http://100.125.21.46:8796/api/auth/session` | **200**(同上) |
| mea → `ssh mac`(验收单字面形态) | `http://100.125.21.46:8796/app` | **200** |

## 无头自检(shots/ 6 张,9/9 PASS)

打的是构建产物端口 8796(非 dev):project/new 表单(Input data-slot 断言)→ 仓库菜单选「本地文件夹」→ 浏览钮开 dir-browser(面包屑 Button data-slot 断言,行列表渲染)→ 演示项目「任务」tab(搜索 Input data-slot 断言)→ local 项目文件面 → schedules 空态(新建钮可见)→ 项目设置(删除钮 Button data-slot 断言)。截图 `shots/01-project-new.png` … `shots/06-settings.png`。

## 服务端裸绑定 WARN(原文照转)

```
WARN (89226): 绑定 0.0.0.0(全网卡可达)且 PACMAN_TOKEN 未设——API 面裸奔于所有网络接口;设 PACMAN_TOKEN=<token> 开启 Bearer 鉴权,或 HOST=127.0.0.1 收回本机
```
