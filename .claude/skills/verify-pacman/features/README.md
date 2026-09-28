# pacman 验证 feature map

本目录是 pacman 用户可见行为的验证正源。驱动前先读本索引,再按 feature 文件当配方执行。map 漏掉的入口 = 验证不完整:顺手的入口验过 ≠ 整个 feature 验过。

Last updated: 2026-09-28(spec 12 / #359 G2-T1:补本地仓库项目与 GitHub 连接 server API 面条目 local-repo-api.md + 定制 probe `scripts/probe-local-repos.mjs`,live 验 11/11 PASS;同日 M7 功能闭环维护:补 6 个 M7 新功能条目——AI 审核发起 review-modal、@提及 mentions、标签 tags、附件 attachments、分支同步 branch-sync、失败面发送 failed-send;stop-button.md 补 #318 统一 start dialog 步骤;drive-stop.mjs 修 #318 过时(点开始后先经 overlay-panel 选先做规划);stub-llm-verify.mjs 修 Node ≥v20 close 事件 bug(req.on close→res.on close+responded 守卫)。mentions/tags 本会话 live 验通过,attachments/branch-sync/failed-send user path 从合并代码核实、live re-probe 待补。前序:2026-09-27 停止钮全栈链 #308;2026-09-25 初始 map)

## Baseline preconditions

- 先跑 `launch.mjs`:隔离栈就绪(默认 web `http://127.0.0.1:5273/app`、api `http://127.0.0.1:8791`、全新 scratch 库、seed 单用户 Owner,无 auth)。
- 全新库是每个 launch 的保证(probe `api-key` 依赖空态);重验 = 重 launch,不是复用旧库。
- 端口被占(8791/5273)→ 别的 lane,换 `VERIFY_PORT`/`VERIFY_WEB_PORT`,不杀。
- `doctor.mjs` 全 PASS 才开 drive。
- 永不驱动非本验证起的实例(用户 dev 栈 8787/5173 在跑也不碰)。

## Driving conventions

- 一律 live 面:URL 不带 `?scenario=`(那是 fixture 面)。
- 选择器优先稳定句柄:`data-route`、`data-column-list`、`data-todo-id`、aria-label、类名;不用坐标/tab 序。
- UI 证据 = 截图(1440×732,与 e2e 同口径)+ `result.json` 的逐条 checks。
- 变更类证明必须有第二只眼:`GET /api/...` JSON 真值 + SQLite 只读行(见各 feature 文件)。
- 收尾 `cleanup.mjs` 回收栈;证据默认落**主仓** `.claude/verify-evidence/`(不落 worktree),该目录 gitignored。
- **证据要随 PR 进 git 必须 `archive.mjs <证据目录> <ticket>`** 归档进 `docs/verify/<ticket>/` 并 commit;PR body 引用归档路径,无归档路径的 verify 声明视为未验证(SKILL.md「证据归档纪律」)。
- 报告跳过的入口时要带尝试过的命令与未满足的前置;不得把「从别的入口验过」当成「该入口已验」。

## Feature entry contract

每个 feature 文件:H1 标题 + 一段用户视角描述,然后固定四个 H2(顺序不变):

1. `Sub-features` — 短 ID + 一行行为。
2. `How to get to it (user POV)` — 每个用户入口。
3. `Driving it with <harness>` — 先 `Preconditions:`,再成对 bullet:用户动作 + 精确命令 + 可观测结果。
4. `Gotchas` — 会浪费或废掉一次验证的坑。

map 不写实现细节,只写用户路径、稳定句柄、必要状态、命令、可观测证明。

## Features

- [新建任务(看板)](./board-new-task.md) 看板渲染、新建任务 dialog、无项目自动建默认项目、持久化三重真值。
- [API 密钥](./api-keys.md) 空态建密钥、一次性明文、掩码行、DB 存哈希不存明文。
- [搜索](./search.md) 侧栏入口 → 面板输入 → 命中任务行。
- [主题](./theme.md) pacman-theme 持久化,light/dark 双向。
- [停止钮(详情页)](./stop-button.md) 全栈在跑(server+web+真 daemon+stub LLM 门控轮)的中断链:#318 统一 start dialog→streaming→确认弹层→正在停止…→已取消→gate 回落;定制 probe `scripts/drive-stop.mjs`(#308)。
- [AI 审核发起(详情页)](./review-modal.md) confirm/review 相位 composer「AI 审核」钮→560 模态选 Agent→发起→审核步入队+REVIEW_ANNOUNCEMENT;定制 probe `scripts/drive-review.mjs`(#312);blocking 自动修订回路 `scripts/drive-review-blocking.mjs`(#330/#332)。
- [@提及(composer+新建任务)](./mentions.md) 提及钮开五分组 picker / textarea 键入 `@` 内联补全→选实体→序列化 token(`[名](agent:{id})`/`#seq`)落文本(#311/#327)。**2026-09-28 live 验通过**。
- [标签(新建任务+详情meta)](./tags.md) 新建任务 footer 标签钮→面板 pill toggle+内联新建→tagIds 随 createTodo;详情 fresh meta 渲染 TagChip,**看板卡不渲染**(r9 §3.4 校准)(#309/#323)。**2026-09-28 live 验通过**。
- [附件(composer+新建任务)](./attachments.md) 添加附件钮(原生文件触发)→三步上传(grant→host→token)→`![名](attachment:…)` 注入 spec→执行面 agent 可读(#310/#331)。live re-probe 待补。
- [分支同步(详情页 branch-dialog)](./branch-sync.md) 分支与 PR 弹层「同步到机器」tab→选机器→同步钮→`POST branch-sync`→daemon git/worktree 执行→结果卡 pending→synced(#319/#328)。live re-probe 待补。
- [失败面发送(详情页 composer)](./failed-send.md) failed 相位 composer 发送反馈→`{action:"restart"}`→新 build(withPlan 承接)+反馈入会话+failed→queued;相位门只收 failed(#320/#322)。live re-probe 待补。
- [本地仓库项目与 GitHub 连接(server API 面)](./local-repo-api.md) `POST /api/projects kind=local` 三态校验(live fs+真 git)+旧 hosted 面不回归+`GET /api/github/repos` 未连接 404+github_connection 表形(SQLite 只读);定制 probe `scripts/probe-local-repos.mjs`(spec 12 / #359,UI 入口归 G2-T3/T4 后回补)。**2026-09-28 live 验 11/11 PASS**。

## 已知未入图面(验到这些别声称 map 覆盖)

- 任务详情页(`/app/todo/:id`)——live 面已铺:停止链(stop-button)、AI 审核发起(review-modal)、@提及(mentions)、附件(attachments)、分支同步(branch-sync)、失败面发送(failed-send)。未铺:plan/changes/diff 文档面、transcript 流渲染、运行历史弹层、编辑分配弹层。
- 总管抽屉/设置(`.chief-fab` 有 live wiring,数据面未铺)。
- 机器/模型服务/团队密钥/MCP/技能 各管理页(routes 均在,fixture e2e 有覆盖,live 配方未铺)。
- 看板拖拽改相(`PATCH /api/todos/:id`,#160)——fixture e2e 有 board-dnd 覆盖。
- 定时(schedules)增删改、项目设置页——fixture e2e/dead-buttons 覆盖,live 配方未铺。
- daemon 侧(`pnpm dev:daemon`)——需要真机器注册流程,超出 UI 验证范围。

新功能落地后把入口补进 map(`/maintain-verification-skill`)。
