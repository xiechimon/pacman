---
name: verify-pacman
description: pacman 行为验证——起隔离 live 栈(server VERIFY_PORT 8791 + vite dev VERIFY_WEB_PORT 5273,独立 PACMAN_HOME scratch),Playwright 走真用户路径(新建任务/建 API 密钥/搜索/主题),证据(截图 + API JSON + SQLite 行)归档进 docs/verify/<票号>/ 随 PR 提交、body 以 SHA 永久链引用。改动后要证明功能真的能跑、要可复核证据时用;fixture 面回归走 apps/web e2e(含视觉 spec 的几何断言),不用本 skill。
---

# verify-pacman

pacman = todos.dev 复刻(React/vite web + Hono REST/SSE/SQLite server)。本 skill 起一套**隔离实例**(独立端口 + 独立数据根,绝不碰用户真数据 `~/.pacman` 和 8787/5173 上的活跃 dev 栈),用仓库自带的 Playwright chromium 走真用户路径,产出证据后干净回收。脚本全在 `scripts/`,运行态与运行期证据在 `.claude/` 下(gitignored);收尾时证据归档进 `docs/verify/<票号>/` 随 PR 进仓(见「证据归档纪律」)。

变更历史:`changelog/` 每票一文件(`<日期>-<票号>.md`;原「Last updated:」单行链已按 #1039 退役——每条车道往链首挂条目,两条车道必撞同一 hunk)。车道记新条目 = **新建文件并随 PR 提交**,不改本行、不编辑旧条目文件;约定全文见 `changelog/README.md`。顺序以 `git log --oneline -- .claude/skills/verify-pacman/` 为准。
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

**lane 收尾必做**(证据随 worktree 消失是本 skill 最大的坑,见「证据归档纪律」):`VERIFY_REPO_ROOT` 只影响栈与运行态,证据默认落主仓;跑完仍须把证据 cp 进 PR 分支的 `docs/verify/<票号>/` 并 commit + 勾 issue 验收框(见「证据归档纪律」),否则 lane 一收工、运行机一回收,验证声明即不可查证。

## Launch

```sh
# 从 repo 根跑（脚本默认 VERIFY_REPO_ROOT = 自身位置上溯 4 级 = repo 根）
node .claude/skills/verify-pacman/scripts/launch.mjs
# worktree 车道:VERIFY_REPO_ROOT=<worktree> node <同上>
# 换端口:VERIFY_PORT=8792 VERIFY_WEB_PORT=5274 node <同上>
```

- 起两个 detached 进程组:`pnpm exec tsx src/index.ts`(server,无 watch 形态,等价 `dev:server` 去掉 watch)+ `node node_modules/vite/bin/vite.js --strictPort`(web dev,proxy 指向我们的 server)。
- **每次 launch 前清空运行目录 = 每次全新库**(首启 seed 单用户,无需登录态)。
- **重 launch 前必先 `cleanup.mjs`**:旧栈进程仍占着 `VERIFY_PORT`/`VERIFY_WEB_PORT`,新 launch 不会杀它们——就绪探针打到的是**旧栈**的 listener,新起的进程绑不上端口,probe 驱动的是上一轮的旧库(症状:「全新库」断言静默混入上轮状态,不报任何错;#950 实测踩过:上轮保存的章程让本轮空态检查全错)。
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
node .../scripts/drive-review-700.mjs <todoA> <todoB>             # verdict 提取真链(#700;stub-review-700 + setup-review-700-seed 前置,review-700.md)
node .../scripts/drive-failed-review-restore.mjs                 # failed→review 恢复双出口全链(#702;hosted 形态,机器面由探针走真 machine wire,自含 seed)
node .../scripts/drive-920-skills-manifest.mjs --phase=wire|daemon-success|daemon-incremental|daemon-fail  # 技能分发清单+按需拉(#920;wire 相位无 daemon 依赖,daemon-* 相位需 stub LLM+真 daemon;配方与判读 = docs/verify/920/README.md)
node .../scripts/drive-929-930.mjs   # 命令闸 tool_call 缝 + pi 原生 MCP 桥双票双向证据(#929/#930;自 spawn stub LLM + stdio MCP fixture + 真 daemon 并自回收;配方与判读 = docs/verify/929-930/README.md)
node .../scripts/drive-918-skill-facts.mjs   # 技能事实活行+详情汇总(#918;含 deny 挡下面与对照组;自 spawn stub LLM ×2 + 真 daemon 并自回收;配方与判读 = docs/verify/918/README.md)
node .../scripts/drive-919-skills-routing.mjs --phase=behavior|deny-ui  # 技能路由行为验收(#919;behavior=真模型腿——claude-code runtime + 本机 claude 登录态,票面零技能词看 lane 自己命中;deny-ui=内嵌脚本 stub 腿——deny 事件 UI 可见面 + LLM 输入面目录断言;配方与判读 = docs/verify/919/README.md)
node .../scripts/drive-925-pi-policy.mjs  # pi 会话策略取证(#925/#927,spec 26;纯 HTTP+fs+SQLite 无浏览器面——trust deny 四面 + 策略宣告行 + cost 落库 worked example + prompt_cache_retention 请求面;自 spawn stub LLM + 真 daemon 并自回收;配方与判读 = docs/verify/925/README.md)
node .../scripts/drive-904-plan-chain.mjs   # plan.md 落库通道全链(#904;withPlan build → plan 表落行 → confirm 卡/右栏方案面有物;三腿:hosted 正向 + 裸目录 #703 正向 + 负对照「缺物必红」;stub ×3 + 真 daemon 自 spawn 自回收;配方与判读 = docs/verify/904/README.md)
node .../scripts/drive-1025-plan-first-round.mjs   # 首轮 plan 契约注入(#1025;stub 收到的真实首轮请求体断言契约组合串 + plan v1 首轮落库零补写步 + 负对照补写轮兜底;stub ×2 + 真 daemon 自回收;配方与判读 = docs/verify/1025/README.md)
cd apps/daemon && corepack pnpm exec tsx .../scripts/drive-926-convergence.mts  # 重试与收敛时序显式化(#926;.mts 走 daemon 包 tsx,不起 web/server 栈——直接 import daemon 源码 + pi 包;三相:pi 真 SettingsManager 读回显式 retry 配置、真 pi AgentSession×stub LLM 捕获原始事件序 agent_end→agent_settled 且 done 只落 settled、mapPiSessionEvent 对照;自起 stub 并自回收,配方与判读 = docs/verify/926/README.md)
```

**纯 live 栈 probe**(无 daemon 依赖,launch 后直跑;配方见对应 feature 文件):

```sh
REVIEW_MACHINE_TOKEN=<t> node .../scripts/drive-review-reject.mjs <todoId>  # 审核关口人肉打回(#701,review-reject.md;前置 setup-review-seed,无 daemon/LLM 依赖)
node .../scripts/drive-avatars.mjs             # dicebear 头像(#387,avatars.md)
node .../scripts/drive-hotkeys.mjs             # C/Space 快捷键(#389,hotkeys.md)
node .../scripts/drive-newtask-key.mjs         # 新任务键位正负成对(XMON-41,hotkeys.md)
node .../scripts/drive-chief-model-select.mjs  # 总管压缩模型选择器(#358;选择器族)
node .../scripts/drive-agent-identity.mjs      # agent 身份可点进设置(#741;--expect=old 取 before 基线)
node .../scripts/drive-chief-segments.mjs      # 段行封口(#955/ADR 0011;按封口后的真 wire 序推帧 + 抽屉在飞态;三个探针坑见 docs/verify/955/README.md)
node .../scripts/drive-1033-avatar.mjs         # 总管思考行/工具行头像几何(#1033;真 Lorelei 形态桩 + 同帧几何量取;--expect=old 取 before 基线;证据 docs/verify/1033/)
node .../scripts/drive-1034-thinking-truncate.mjs --expect=new|old  # 思考行宽截断双向证据(#1034;chief 抽屉+详情对话两面几何/computed 实测,零 daemon 零 LLM;--expect=old 打 origin/main 一次性 worktree 基线栈复现缺陷;配方与判读 = docs/verify/1034/README.md)
node .../scripts/drive-902-gate-actor.mjs --expect=new|old  # 过闸 actor 审计三票联合(#902/#900/#901;真机器 wire 推到 confirm/review + REST/chief relay 过闸 + 浏览器真拖拽录像转 GIF;--expect=old 打 origin/main 基线栈取 before;证据 docs/verify/900/)
node .../scripts/drive-903-dispatch-judgment.mjs  # chief 派发判定(#903/ADR 0014;设置槽死态 + 逐次判定 + dispatchReason 回执三条腿,假机器 claim chief 回合步 relay run_builds 三形态对拍 SQLite,零 daemon 零 LLM;配方与 gotcha = features/chief-dispatch-judgment.md)
node .../scripts/drive-1033-avatar.mjs         # 总管思考行/工具行头像几何(#1033;真 Lorelei 形态桩 + 同帧几何量取;--expect=old 取 before 基线;证据 docs/verify/1033/)
node .../scripts/drive-952-finale.mjs          # 散件收尾(#952;dialog-shell 载体/表单族几何/详情-记忆-权限真值链/退役审计/双主题对比度)
node .../scripts/drive-1035-zoom-fit.mjs --expect=new|old  # 缩放宽视口看板自适应(#1035;live REST 铺底 + 逐档变视口量 .board-scroller 几何 + ⌘J 停靠/Escape 活翻;--expect=old 打 origin/main 一次性 worktree 栈(8793/5275)取 before 基线;配方与边界表 = docs/verify/1035/README.md)
node .../scripts/drive-detail-pane.mjs         # 详情页 3-pane(#366,detail-right-pane.md)
node .../scripts/drive-mcp.mjs                 # MCP 只读本地 config 面(spec 13/#368,mcp-servers.md)
node .../scripts/drive-project-new-form.mjs    # 新建项目表单(spec 12/#360,project-new-form.md)
node .../scripts/probe-github-oauth.mjs        # GitHub 认证 + repo picker(spec 12/#361,github-oauth-picker.md)
node .../scripts/probe-local-repos.mjs         # local 项目 API 三态(spec 12/#359,local-repo-api.md)
node .../scripts/drive-1030-local-files.mjs    # local 项目 Files tab 开闸读面+不可达降级(#1030,project-files-local.md;三相位:local 可读/hosted 对照/删仓降级)
node .../scripts/drive-1007-pages.mjs           # pages 域 live 面(#1007):schedules registry Dialog 真用户路径+设置页 Card 结构面
node .../scripts/drive-attachments.mjs / drive-branch-sync.mjs / drive-failed-send.mjs / drive-mentions.mjs / drive-tags.mjs  # M7 六功能族(各自 feature 文件)
```

前置:stub LLM(`scripts/stub-llm-verify.mjs`,门控延迟轮)+ seed(`scripts/setup-review-seed.mjs` 或其变体)+ 真 daemon(`apps/daemon` `pnpm exec tsx src/cli.ts start --foreground --server http://127.0.0.1:<VERIFY_PORT>`,**`--server` 必须显式写进命令行**——cleanup 残留回收靠端口钉选,env-only 形态命令行无标记、不可安全回收;守门见 stop-button.md Gotchas:6 proxy 全 unset / PACMAN_HOME export 透传 / vite PACMAN_DEV_SERVER_PORT)。

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

`.claude/verify-evidence/` 是 gitignored 本地目录,**永远进不了 PR**。带 verify 声明的交付必须把证据(截图 + API JSON + SQLite 行)归档进 `docs/verify/<票号>/`(票号 = issue 号,现形 `XMON-<n>` 如 XMON-104;历史纯数字如 319 同列)并随交付 PR 提交。无归档脚本(archive.mjs 已随 XMON-63 删除,旧版只认纯数字票号),收尾手工两步:

```sh
cp -R <主仓>/.claude/verify-evidence/<时间戳>-<probe> <PR 分支检出>/docs/verify/<票号>/
# 在该检出内:git add docs/verify/<票号> && git commit(随交付 PR,不单独为归档证据开 PR)
```

- **证据未随 PR 进仓引用的 verify 声明视为未验证**,核收方无从复核。
- **PR body 直接内嵌截图**用 commit SHA 永久链:`![说明](https://raw.githubusercontent.com/xiechimon/pacman/<head SHA>/docs/verify/<票号>/<file>.png)`——本仓 public,raw 匿名可读(#587/#589 同形态);必须钉 commit SHA,branch 名会随后续推送漂移。GitHub 无附件上传公开 API(web 拖拽生成的 `user-attachments` 链接需浏览器会话),agent 流程一律「证据进仓 + raw 永久链内嵌」。
- **若仓为私有**,`raw.githubusercontent.com` 恒 404(CDN 不透传鉴权),改用 `https://github.com/<owner>/<repo>/raw/<SHA>/<path>` 永久链(登录且有仓权限的查看者可见图)。
- PR body 写 probe 名 + checks 通过数(逐条对齐 `result.json` 的 ok 计数,不写约数)+ 栈坐标,让核收方能对着仓内证据复核;多组证据加 `docs/verify/<票号>/README.md` 索引(#587 形态)。
- **禁写「证据见本地路径」**:运行机上的 `.claude/verify-evidence/` 对读者不可达,仓内归档路径 + PR body 的 raw 链接是唯一凭证。
- 证据是 200-300KB/次(截图为主),量级可接受;真值三件套(截图 + API JSON + SQLite 行)照旧,归档只改落盘位置不改口径。

### 验收签字(硬规则,归档同日收尾)

证据归档进 PR 只完成「履约」,还差「签字」:issue 的 Acceptance criteria 勾选框不会因 `Closes #N` 自动勾上(#391 实测:票已关、证据在仓,三框仍空,用户视角 = 验收未发生)。PR 合并前后,lane 必须:

1. `gh issue view <ticket> --json body` 取正文,把已交付的 `- [ ]` 改 `- [x]`(只勾真有证据支撑的框);
2. 正文末尾追加「验收记录」段:PR 号 + 合并日 + 证据目录相对路径(`docs/verify/<票号>/`)+ probe/e2e 通过数(数字须与归档的 result.json / e2e 日志一致,不写约数);
3. `gh issue edit <ticket> --body-file <tmpfile>` 写回(长正文禁内联 `--body`)。

未交付的框**不勾**,在验收记录里写明缺口。「关票 ≠ 验收完成」——勾框 + 仓内证据指针才是可复核的终态。

## 机制生效验收:实物判据(硬规则)

机制类改动(CSS/动效、落盘/wire 格式、schema、配置透传、服务流量)的验收必须落到**编译产物 / 运行时实物**,不能只读源码——「依赖装了、类名写了、配置声明了」都不等于生效。验收声明里每条「声称 X 生效」必须能回答**「去哪里取 X 的实物」**;**取不到就不算验收过**。真值三件套(截图 + API JSON + SQLite 行)管「功能行为对不对」,本节管「机制通没通」——同一条判据两天三撞、另有三例同形(#746 汇总),实物取法逐类:

| 声称 | 实物在哪里取 | 实案 |
|---|---|---|
| 「动效/CSS 类生效了」 | **编译产物 CSS**:`pnpm --filter @pacman/web build` 后 grep `apps/web/dist/assets/*.css` 钉规则存在(证据形态先例 `docs/verify/656/built-css-mechanism.txt`);运行时加强 = 浏览器 probe `getAnimations()` 看 playState(`docs/verify/656/dialog-probe.json` 形态)。可自动化半已出票 #747 | #656/#677:依赖装了、类名写进 JSX、`@import` 声明了,但 B1 没接线,全部编译成空 |
| 「shim/转发服务有流量」 | **服务自己写的文件日志**(如 `/tmp/pi-shim*.log`,逐请求一行),不是 journal/systemd——正本 `docs/research/machine-execution-plane.md`「shim 类服务的流量正本在 /tmp 而非 journal」 | pi-relay-shim 流量账:配置看着对,journal 恒空 |
| 「X 的消费点已归零,可删 / 还活着」 | **执行当天的当前树 grep**:固定子串全仓(apps/、packages/、integration/、e2e)+ 枚举动态拼接点核对值域,方法正本 `docs/verify/t-0031/README.md`;审计时点的清单只是快照,不作执行依据 | t-0019 判 H 组时还有 6 个消费点,执行当天已归零 |
| 「落盘/wire 格式改了,各层仍兼容」 | **各层实际读者清单 + 各层实跑**:单元 pin(如 `apps/daemon/test/`)与集成 pin(`integration/test/`,读者以 `grep -rl daemon.log integration/test/` 当前树为准,十余文件)是两套独立 pin——格式面变更必须**同 PR 迁移全部层的 harness**,本地实跑 `VITEST_PROJECT_SET=integration pnpm test` 而非只跑 unit;该耦合在运行时面(非 import 图),`vitest related` 选不中 | #735:daemon.log 加 wall-clock 前缀,unit pin 已同步、integration 没动,首轮 CI 全层红 |
| 「shared schema 改了没事」 | **`packages/shared/test/snapshot.test.ts` 本地实跑**:钉 zod schema 的 JSON 投影,动任何 schema 槽必红;有意更新投影用 `-u`,逐块核 diff 再推 | #700:`machineDoneBodySchema` 加 `foundingsError`,本地漏跑,靠 CI 抓回 |
| 「字段 Y 可作判据 X」 | **Y 在该形态下的运行时值**:live 栈 `curl /api/...` JSON + SQLite 只读行(本文 Observe 面),且必须在目标形态(如 manual 项目)上取——「代码里读的是那个字段」≠「该字段在该形态下有值」 | #703/#704:服务端 `changes` 投影在手动项目上恒空,读它做判据会把手动项目全拦死 |

**与静态闸的边界**(仓规:能进静态分析的别留在文档):六行里「动效/CSS 类生效」的编译产物闸可自动化,已另开 #747;「shared schema」行的闸已存在(CI 跑快照套件),纪律是推前本地跑一遍;其余四行的实物在运行时/执行当天树上,下沉不了静态闸,靠本表。

## Cleanup

```sh
node .../scripts/cleanup.mjs
```

按 pid 文件组杀(SIGTERM → 6s 宽限 → SIGKILL),杀前用 `ps` 核对命令行含 `tsx|vite|pnpm` 标记(防陈旧 pid 误杀无辜进程);删 `VERIFY_RUN_DIR`(scratch home + 日志);回显证据目录仍在。**只杀自己 pid 文件里记录的进程,永不按进程名杀**。用户 dev 栈(8787/5173)与 e2e 车道不受影响。

另**钉选回收残留 daemon**(#691):launch/probe 失败泄漏的 ad-hoc daemon 不在 pid 文件里,cleanup 会按「`cli.ts start` + 本栈 `--server http://127.0.0.1:<VERIFY_PORT>`」双标记扫描回收(SIGTERM 优雅停 → 仍存活者升级 SIGKILL,升级前重核命令行;无端口钉选时拒扫并提示)。**硬规则:清残留 daemon 禁止按 `cli.ts start` / `tsx` 裸形状杀进程**——用户主检出的 dev daemon 就是 `tsx src/cli.ts start -f`,同形必中(2026-10-02 23:38:17 实锤 #691:某 lane 用 `ps aux | grep "cli.ts start" | kill -9` 清自家残留,连带 SIGKILL 用户 dev daemon——daemon 零输出无痕死,pmset 只见 caffeinate ClientDied,pnpm 报 ELIFECYCLE exit 1,排障极易误判为 daemon 自身崩溃)。

## Helpers

| 脚本 | 作用 |
|---|---|
| `scripts/launch.mjs` | 起隔离栈,写运行态;失败自杀不留孤儿 |
| `scripts/doctor.mjs` | 只读体检 |
| `scripts/drive.mjs` | Playwright probe(本文 Drive 节用法) |
| `scripts/cleanup.mjs` | 回收栈,保证据 |

env 契约(脚本一致):`VERIFY_REPO_ROOT` / `VERIFY_RUN_DIR` / `VERIFY_PORT` / `VERIFY_WEB_PORT` / `VERIFY_EVIDENCE_DIR`。无归档脚本:收尾手工 cp 证据目录进 PR 分支 `docs/verify/<票号>/` 并 commit(本文「证据归档纪律」)。

## 何时不用本 skill

- 视觉回归 → `apps/web` playwright e2e(视觉 spec 的 computed-style 几何断言钉圆角/高度/字号等硬契约)。
- fixture 面回归(UI 弹层/交互链)→ `apps/web` playwright e2e(`?scenario=`,E2E_PORT 8399)。开发期只跑相关几条,禁全量。
- 只想 curl API 快检 → 直接 `curl http://127.0.0.1:<VERIFY_PORT>/api/...` 即可,不必起浏览器。
