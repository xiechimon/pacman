---
name: verify-pacman
description: pacman 行为验证——起隔离 live 栈(server VERIFY_PORT 8791 + vite dev VERIFY_WEB_PORT 5273,独立 PACMAN_HOME scratch),Playwright 走真用户路径(新建任务/建 API 密钥/搜索/主题),证据(截图 + API JSON + SQLite 行)落 .claude/verify-evidence/ 并归档进 docs/verify/<ticket>/ 随 PR 提交。改动后要证明功能真的能跑、要可复核证据时用;fixture 面回归走 apps/web e2e(含视觉 spec 的几何断言),不用本 skill。
---

# verify-pacman

pacman = todos.dev 复刻(React/vite web + Hono REST/SSE/SQLite server)。本 skill 起一套**隔离实例**(独立端口 + 独立数据根,绝不碰用户真数据 `~/.pacman` 和 8787/5173 上的活跃 dev 栈),用仓库自带的 Playwright chromium 走真用户路径,产出证据后干净回收。脚本全在 `scripts/`,证据与运行态全在 `.claude/` 下(已被 .gitignore 忽略,不进 git)。

Last updated: 2026-10-01(XMON-14 落点票随票维护:`drive-hotkeys` 的「Space 呼出抽屉」步改 `⌘J`并补 ⌘J 提示 chip 的 registry 契约/可见性两 check——#442 起 Space 已退役,旧步是残留;`drive-tags` 补类型筛选弹层选中行的 TagChip 落点 check(`data-slot=badge` + 20px);features/avatars·hotkeys·tags 三页同步。前序:2026-09-29(/maintain-verification-skill 维护轮:#351 看板四列工作台落地后本轮 map 校正——三处 SKILL.md 修正:①worktree 车道表述(2026-09-28 起本 skill 已提交进仓,worktree 自带副本,必须从 worktree 路径跑脚本;主仓脚本验 lane 代码 = 旧脚本 fill 30s 超时假象,#386 实战);②定制 probe 清单补全(纯 live 栈组 9 脚本登记:avatars/hotkeys/chief-model-select/detail-pane/mcp/project-new-form/github-oauth/local-repos/M7 六功能族);③spec 11 三 probe 表述由「先行红态」转「落地后应全绿,红即回归」(实现票 #355-#358 全合)。board 条目本身各 lane 已随票维护到位(board-new-task.md 4 列 + 单字段面,证据 docs/verify/351/ 10/10 + 4/4)。前序:#391 验收复盘:「验收签字」硬规则——归档后必须勾 issue Acceptance criteria 框 + 追加验收记录段(关票 ≠ 验收完成,#391 实测票关了三框仍空);归档纪律补 PR 贴图形态(github.com/<owner>/<repo>/raw/<SHA>/ 永久链,私有仓 raw.githubusercontent 恒 404);前序 2026-09-28:#354 spec 11 先行地图:feature map 补三面条目(providers runtime tabs / machines 本机行+switches / 添加服务商 picker)+ 三个先行 probe(drive-providers-tabs / drive-machines-local / drive-provider-picker.mjs)——先行语义(spec 11 A12):实现票落地前红态,FAIL detail 逐条指 spec 条款,实现票验收 = 转绿,详见 features/README.md Last updated;前序同日:证据归档纪律(证据默认落主仓 + archive.mjs 归档进 docs/verify/<ticket>/ + 硬规则「无归档路径的 verify 声明视为未验证」)+ M7 功能闭环维护(feature map 补 6 条 + drive-stop.mjs 修 #318 + stub-llm-verify.mjs 修 Node ≥v20 close bug)。建成日 2026-09-25,5 probe 全 PASS;维护走 `/maintain-verification-skill`)

## 事实底座(2026-09-25 盘问;feature 面演化后跑 `/maintain-verification-skill` 校正)

| 维度 | 事实 |
|---|---|
| Surface | web UI(`apps/web`,vite)为主;HTTP API(`apps/server`,Hono REST+SSE+SQLite)。daemon 可选,UI 验证不需要。 |
| Run | `pnpm dev:server`(缺省 8787,首启自动建库+seed 单用户 **Owner**)+ `pnpm dev:web`(vite dev 5173,proxy `/api`、`/git` → server)。无 auth:seed 即自动登录,浏览器直开可用。生产形态 = 根 `pnpm start`(build web → server 同源托管 `apps/web/dist`)。 |
| Drive | Playwright(`@playwright/test` 根 devDep,chromium 已装)。live 模式 = URL **不带** `?scenario=`(带 = fixture 面,e2e 专用)。 |
| Observe | 截图(1440×732,与 e2e 同口径);HTTP JSON(`GET /api/auth/session`、`/api/todos`、`/api/teams`…);SQLite 行(`<PACMAN_HOME>/server/server.db`,better-sqlite3 只读);server 日志(`pacman-server online` 行)。 |
| Isolate | 三轴:`VERIFY_PORT`(server,默认 8791)/`VERIFY_WEB_PORT`(vite,默认 5273)/`PACMAN_HOME`(scratch)。vite dev 不写 `dist/`,与 e2e 的 dist 互踩无关。 |

## 端口与车道纪律(先读)

仓内端口舰队:**8787** server / **5173** vite / **8399** e2e。占用者是别的 lane(常含用户自己的 dev 栈)的活进程,**不能杀**。本 skill 默认 8791 + 5273;launch 发现被占就换端口(env 覆写 `VERIFY_PORT` / `VERIFY_WEB_PORT`),永远不要动别人的端口。查占用:`lsof -iTCP:8791 -sTCP:LISTEN`。

**worktree 车道**:2026-09-28 起 `.claude/skills/verify-pacman/` 已提交进仓(.gitignore 嵌套例外),**worktree 检出自带本 skill 的完整副本**。跑法:`VERIFY_REPO_ROOT=<worktree 绝对路径>` 起栈(worktree 须已 `pnpm install`),且**必须从 worktree 路径跑脚本自身**(`node <worktree>/.claude/skills/verify-pacman/scripts/...`)——从主仓路径跑会用主仓的旧 probe 脚本验 lane 的新代码,症状极迷惑(旧脚本在 fill 处 30s 超时,而非解析报错;#386 实战烧 5 轮才定位)。**改码后必须重 launch**:worktree 在 `.claude/worktrees/` 下,vite 配置的 `**/.claude/**` watch 忽略会把整个 worktree 罩住,栈运行中改码不会生效(实证见项目记忆),驱动到的就是旧代码。

**lane 收尾必做**(证据随 worktree 消失是本 skill 最大的坑,见「证据归档纪律」):`VERIFY_REPO_ROOT` 只影响栈与运行态,证据默认落主仓;跑完仍须 archive 进 `docs/verify/<ticket>/` 并 commit + 勾 issue 验收框(见「证据归档纪律」),否则 PR 的验证声明不可查证。

## Launch

```sh
# 从 repo 根跑（脚本默认 VERIFY_REPO_ROOT = 自身位置上溯 4 级 = repo 根）
node .claude/skills/verify-pacman/scripts/launch.mjs
# worktree 车道:VERIFY_REPO_ROOT=<worktree> node <同上>
# 换端口:VERIFY_PORT=8792 VERIFY_WEB_PORT=5274 node <同上>
```

- 起两个 detached 进程组:`pnpm exec tsx src/index.ts`(server,无 watch 形态,等价 `dev:server` 去掉 watch)+ `node node_modules/vite/bin/vite.js --strictPort`(web dev,proxy 指向我们的 server)。
- **每次 launch 前清空运行目录 = 每次全新库**(首启 seed 单用户,无需登录态)。
- 就绪判定:`GET /api/auth/session` 200(server)+ `GET /app` 200(vite SPA fallback),poll 到通为止;超时自动打印两份日志尾再自杀已起进程。
- **看日志用 Read 工具,别用 Bash `tail`**:本机 scout-block hook 的基线模式拦 `*.log`(Bash 命令引用任何 .log 路径都会被 BLOCK);launch/脚本自身用 fs 读不受影响。
- 运行态落 `VERIFY_RUN_DIR`(默认 `<repo>/.claude/verify-run/`):`server.pid`、`web.pid`、`server.log`、`web.log`、`ports.json`。launch 失败会自杀掉已起的进程,不留孤儿。

## Doctor

```sh
node .../scripts/doctor.mjs   # 只读,零写操作
```

校验:pid 组存活 → `GET /api/auth/session` 200 且 `displayName === "Owner"` → `GET /api/teams` 200 → `GET /api/projects` 200 → web `GET /app` 200。任一 FAIL 退出码 1。栈没起时提示先跑 launch。

## Drive

```sh
node .../scripts/drive.mjs <probe>    # probe ∈ board | new-task | api-key | search | theme
```

栈必须在跑(先 launch)。每个 probe = 真用户路径(点按钮/填表单,不走内部 setter),断言 + 截图 + API/SQLite 双真值,失败退出码 1。probe 细节、选择器与 gotcha 见 `features/`(map 是正源,别只验顺手的入口)。已映射:

| probe | 覆盖 | 关键真值 |
|---|---|---|
| `new-task` | 看板渲染 + 新建任务全链路(无项目时自动建「默认项目」) | 卡片上板 + `GET /api/todos` 行 + SQLite `todo` 表行 |
| `api-key` | `/app/api-keys` 建密钥 | 一次性明文 `pacman_…` + 掩码行 + SQLite 存 keyHash 非明文 |
| `search` | 侧栏搜索面板 | 结果行命中已建任务 |
| `theme` | 主题持久化(`pacman-theme` localStorage) | light/dark 双向重载生效 |
| `board` | 工作台 shell(#351 起 4 列) | 布局截图 |

注意:`api-key` probe 假定全新库(新建按钮只在空态)——重验先重跑 launch。

**定制 probe**(各自独立脚本,配方与前置见对应 feature 文件。全量清单=scripts/ 目录;下表为**需真 daemon + stub LLM 门控轮**的全栈链):

```sh
node .../scripts/drive-stop.mjs <todoId>                          # 停止钮全链(stop-button.md,#308;含 #318 start dialog)
node .../scripts/drive-review.mjs <todoId>                        # AI 审核发起+入队(review-modal.md,#312)
REVIEW_MACHINE_TOKEN=<t> node .../scripts/drive-review-blocking.mjs <todoId> <agentId>  # blocking 自动修订回路(#330/#332)
```

**纯 live 栈 probe**(无 daemon 依赖,launch 后直跑;配方见对应 feature 文件):

```sh
node .../scripts/drive-avatars.mjs             # dicebear 头像(#387,avatars.md)
node .../scripts/drive-hotkeys.mjs             # N/Space 快捷键(#389,hotkeys.md)
node .../scripts/drive-chief-model-select.mjs  # 总管压缩模型选择器(#358;选择器族)
node .../scripts/drive-detail-pane.mjs         # 详情页 3-pane(#366,detail-right-pane.md)
node .../scripts/drive-mcp.mjs                 # MCP 只读本地 config 面(spec 13/#368,mcp-servers.md)
node .../scripts/drive-project-new-form.mjs    # 新建项目表单(spec 12/#360,project-new-form.md)
node .../scripts/probe-github-oauth.mjs        # GitHub 认证 + repo picker(spec 12/#361,github-oauth-picker.md)
node .../scripts/probe-local-repos.mjs         # local 项目 API 三态(spec 12/#359,local-repo-api.md)
node .../scripts/drive-attachments.mjs / drive-branch-sync.mjs / drive-failed-send.mjs / drive-mentions.mjs / drive-tags.mjs  # M7 六功能族(各自 feature 文件)
```

前置:stub LLM(`scripts/stub-llm-verify.mjs`,门控延迟轮)+ seed(`scripts/setup-review-seed.mjs` 或其变体)+ 真 daemon(`apps/daemon` `pnpm exec tsx src/cli.ts start --foreground`,守门见 stop-button.md Gotchas:6 proxy 全 unset / PACMAN_HOME export 透传 / vite PACMAN_DEV_SERVER_PORT)。

**spec 11 probe**(feature map 先行于实现,A12/#354;实现票 #355/#356/#357/#358 已全数落地合入,**本组现应全绿**——红即回归;跑序:tabs(依赖全新库,pi 空态断言)→ picker(e2e 建 provider)→ machines(幂等);三脚本 fallback 页 `docs/spec/11-模型服务与机器本地化.md` 为条款正源):

```sh
node .../scripts/drive-providers-tabs.mjs    # providers runtime tabs(providers-tabs.md,spec 11 A1-A4/A7)
node .../scripts/drive-provider-picker.mjs   # 添加服务商 picker(provider-picker.md,spec 11 A5/A6)
node .../scripts/drive-machines-local.mjs    # machines 本机行+switches(machines-local-row.md,spec 11 A8/A9)
```

## Evidence

证据目录 = `VERIFY_EVIDENCE_DIR`(默认**主仓** `<主仓>/.claude/verify-evidence/<时间戳>-<probe>/`),含 `result.json`(probe、checks 逐条 ok/label、stack 坐标)+ 截图 PNG。**cleanup 不删证据**;proof 标准 = 截图可见动作前后态 + result.json 的 checks 全 ok + API/DB 真值字段(不是只看终屏)。

证据默认落**主仓**而非 `VERIFY_REPO_ROOT`——lane 的栈跑在 worktree,证据若落 worktree 会随 worktree 删除而永久丢失。这个坑 M7 实测踩过:#310/#319 的 PR body 声称跑过 verify-pacman,合并后主仓里证据目录根本不存在,验证声明不可查证(见 #345)。

## 证据归档纪律(硬规则)

`.claude/verify-evidence/` 是 gitignored 本地目录,**永远进不了 PR**。带 verify 声明的 PR 必须把证据归档进 `docs/verify/<ticket>/`(ticket = issue 号)并随 PR 提交:

```sh
node .../scripts/archive.mjs <证据目录> <ticket>   # → docs/verify/<ticket>/<时间戳>-<probe>/
```

- archive 落主仓(与 `VERIFY_REPO_ROOT` 无关),落盘后自检 `git check-ignore`——归档进被忽略的路径直接报错退出(等于没归档)。
- PR body 引用 archive 打印的仓库相对路径。**无归档路径的 verify 声明视为未验证**,reviewer 无从复核。
- **PR body 直接内嵌截图**用 `![说明](https://github.com/<owner>/<repo>/raw/<head SHA>/docs/verify/<ticket>/<run>/<file>.png)`——必须 `github.com/.../raw/...` 形态 + commit SHA 永久链:`raw.githubusercontent.com` 对私有仓恒 404(CDN 不透传鉴权),branch 名会随后续提交漂移。GitHub 无附件上传公开 API(web 拖拽生成的 `user-attachments` 链接需浏览器会话),agent 流程一律「证据进仓 + raw 永久链内嵌」,登录且有仓权限的查看者可见图。
- 证据是 200-300KB/次(截图为主),量级可接受;真值三件套(截图 + API JSON + SQLite 行)照旧,归档只改落盘位置不改口径。

### 验收签字(硬规则,归档同日收尾)

证据归档只完成「履约」,还差「签字」:issue 的 Acceptance criteria 勾选框不会因 `Closes #N` 自动勾上(#391 实测:票已关、证据在仓,三框仍空,用户视角 = 验收未发生)。PR 合并前后,lane 必须:

1. `gh issue view <ticket> --json body` 取正文,把已交付的 `- [ ]` 改 `- [x]`(只勾真有证据支撑的框);
2. 正文末尾追加「验收记录」段:PR 号 + 合并日 + 证据目录相对路径 + probe/e2e 通过数(数字须与归档的 result.json / e2e 日志一致,不写约数);
3. `gh issue edit <ticket> --body-file <tmpfile>` 写回(长正文禁内联 `--body`)。

未交付的框**不勾**,在验收记录里写明缺口。「关票 ≠ 验收完成」——勾框 + 证据指针才是可复核的终态。

## Cleanup

```sh
node .../scripts/cleanup.mjs
```

按 pid 文件组杀(SIGTERM → 6s 宽限 → SIGKILL),杀前用 `ps` 核对命令行含 `tsx|vite|pnpm` 标记(防陈旧 pid 误杀无辜进程);删 `VERIFY_RUN_DIR`(scratch home + 日志);回显证据目录仍在。**只杀自己 pid 文件里记录的进程,永不按进程名杀**。用户 dev 栈(8787/5173)与 e2e 车道不受影响。

## Helpers

| 脚本 | 作用 |
|---|---|
| `scripts/launch.mjs` | 起隔离栈,写运行态;失败自杀不留孤儿 |
| `scripts/doctor.mjs` | 只读体检 |
| `scripts/drive.mjs` | Playwright probe(本文 Drive 节用法) |
| `scripts/cleanup.mjs` | 回收栈,保证据 |
| `scripts/archive.mjs` | 证据归档进 `docs/verify/<ticket>/`(本文「证据归档纪律」) |

env 契约(脚本一致):`VERIFY_REPO_ROOT` / `VERIFY_RUN_DIR` / `VERIFY_PORT` / `VERIFY_WEB_PORT` / `VERIFY_EVIDENCE_DIR`。archive.mjs 不读这些——它固定落主仓,不受 `VERIFY_REPO_ROOT` 影响。

## 何时不用本 skill

- 视觉回归 → `apps/web` playwright e2e(视觉 spec 的 computed-style 几何断言钉圆角/高度/字号等硬契约)。
- fixture 面回归(UI 弹层/交互链)→ `apps/web` playwright e2e(`?scenario=`,E2E_PORT 8399)。开发期只跑相关几条,禁全量。
- 只想 curl API 快检 → 直接 `curl http://127.0.0.1:<VERIFY_PORT>/api/...` 即可,不必起浏览器。
