# pacman 验证 feature map

本目录是 pacman 用户可见行为的验证正源。驱动前先读本索引,再按 feature 文件当配方执行。map 漏掉的入口 = 验证不完整:顺手的入口验过 ≠ 整个 feature 验过。

Last updated: 2026-09-29（spec 12/#362 G2-T2 + #366 详情页 3-pane 重排 + spec 13 #367 技能页只读本地目录面 + spec 13/#368 MCP 本地 config 只读面 + #371 skills 执行面注入 + spec 12/#361 G2-T4 + spec 12/#360 G2-T3 + spec 11/#354 + spec 12/#359 落地连续增）：

- spec 12 / #362 G2-T2：补 local 项目 daemon 执行面条目 local-daemon-executor.md（硬链接镜像 clone + conv 分支推回用户仓库 + merge 步 ff-only 落地 + github per-step token argv 纪律 + Files tab 禁用占位）；配方 = integration g2t2-local-lifecycle 等四面，live re-probe 待补。
- spec 12 / #361 G2-T4：补 GitHub 连接认证 + repo picker 条目 github-oauth-picker.md + 定制 probe `scripts/probe-github-oauth.mjs`（API 段 + chromium UI 段，authorize 双形自适应）；local-repo-api.md 回补 T4 落地指引。
- #366 详情页 3-pane 重排：branch-sync 入口从头部弹层迁到右 pane 型选→静止 section，drive-branch-sync.mjs 与 integration 判别式同步改道；token/运行历史两弹层退役为右 pane section，仍未铺 live 配方。
- spec 13 / #367：技能页只读本地目录面——新增 skills-page.md 条目；launch.mjs 增第四隔离轴 PACMAN_SKILLS_DIR=<HOME_DIR>/skills——不隔离会现扫用户真 ~/.agents/skills；「已知未入图面」的管理页清单移除技能。
- spec 13 / #368：MCP 本地 config 只读面——新增 mcp-servers.md 条目与 probe `drive-mcp.mjs`（API 投影 + 写面 404 + 密钥值不出接口 + SQLite 无表 + UI 只读钉扎），daemon 执行面配方指向 integration m4b-mcp-e2e（slug 解析 + 真连外部 MCP + 降级行族）。
- spec 14 / #371：skills 执行面注入——新增 skills-injection.md 条目；daemon 侧行为无 UI 面，canonical 证据走 integration 真栈探针（skills-inject-e2e）而非 launch.mjs。
- spec 12 / #360 G2-T3：补新建项目表单 web 面条目 project-new-form.md + 定制 probe `scripts/drive-project-new-form.mjs`；local-repo-api.md 的「UI 入口待回补」交叉引用改为已落地。
- spec 11 / #354 先行地图（合流自 main）：补三面条目——providers runtime tabs (providers-tabs.md)、machines 本机行 + switches (machines-local-row.md)、添加服务商 picker (provider-picker.md) + 三个先行 probe (drive-providers-tabs/drive-machines-local/drive-provider-picker.mjs)。先行语义 (spec 11 A12)：probe 先于实现票落地，红态 = 验收清单（FAIL detail 逐条指 spec 条款），实现票验收 = 转绿；跑序纪律见 Baseline。
- spec 12 / #359 G2-T1：补本地仓库项目与 GitHub 连接 server API 面条目 local-repo-api.md + 定制 probe `scripts/probe-local-repos.mjs`，live 验 11/11 PASS。
- 同日 M7 功能闭环维护：补 6 个 M7 新功能条目——AI 审核发起 review-modal、@提及 mentions、标签 tags、附件 attachments、分支同步 branch-sync、失败面发送 failed-send；stop-button.md 补 #318 统一 start dialog 步骤；drive-stop.mjs 修 #318 过时（点开始后先经 overlay-panel 选先做规划）；stub-llm-verify.mjs 修 Node ≥v20 close 事件 bug（req.on close→res.on close + responded 守卫）。mentions/tags 本会话 live 验通过，attachments/branch-sync/failed-send user path 从合并代码核实、live re-probe 待补。

前序：2026-09-27 停止钮全栈链 #308；2026-09-25 初始 map。

## Baseline preconditions

- 先跑 `launch.mjs`:隔离栈就绪(默认 web `http://127.0.0.1:5273/app`、api `http://127.0.0.1:8791`、全新 scratch 库、seed 单用户 Owner,无 auth)。
- 全新库是每个 launch 的保证(probe `api-key` 依赖空态);重验 = 重 launch,不是复用旧库。
- 端口被占(8791/5273)→ 别的 lane,换 `VERIFY_PORT`/`VERIFY_WEB_PORT`,不杀。
- `doctor.mjs` 全 PASS 才开 drive。
- 永不驱动非本验证起的实例(用户 dev 栈 8787/5173 在跑也不碰)。
- spec 11 三先行 probe 跑序:`drive-providers-tabs`(pi 空态断言要求库内无 custom provider)→ `drive-provider-picker`(e2e 会建 provider)→ `drive-machines-local`(幂等,次序任意)。跑反 = tabs 空态假红。

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
- [分支同步(详情页右 pane section)](./branch-sync.md) 右 pane 型选→「分支与 PR」静止 section(#366 前为头部弹层)→选机器→同步钮→`POST branch-sync`→daemon git/worktree 执行→结果卡 pending→synced(#319/#328)。#366 后全链 live re-probe 待补。
- [详情页 3-pane 结构与右 pane 视图](./detail-right-pane.md) 240|fluid|488 三栏贴合、头部单图标、tab 组退役、型选四视图(文档/分支/Token/历史)静止 section、fresh 空占位、composer 唯一卡片;定制 probe `scripts/drive-detail-pane.mjs`(#366)。
- [失败面发送(详情页 composer)](./failed-send.md) failed 相位 composer 发送反馈→`{action:"restart"}`→新 build(withPlan 承接)+反馈入会话+failed→queued;相位门只收 failed(#320/#322)。live re-probe 待补。
- [本地仓库项目与 GitHub 连接(server API 面)](./local-repo-api.md) `POST /api/projects kind=local` 三态校验(live fs+真 git)+旧 hosted 面不回归+`GET /api/github/repos` 未连接 404+github_connection 表形(SQLite 只读);定制 probe `scripts/probe-local-repos.mjs`(spec 12 / #359)。**2026-09-28 live 验 11/11 PASS**。
- [新建项目表单(web 面)](./project-new-form.md) 菜单两行(GitHub/本地文件夹,hosted 创建入口移除)+名称回填(basename/repo 段,手改不覆盖)+本地路径 400 红色错误行+focus indigo 收编+三条创建链 API/SQLite 双真值;定制 probe `scripts/drive-project-new-form.mjs`(spec 12 / #360;OAuth picker 已落地,见 github-oauth-picker 条目)。
- [GitHub 连接认证 + repo picker(新建项目)](./github-oauth-picker.md) 未认证 = 认证钮 + 手动兜底;已认证 = picker 弹层(搜索/单选回填/断开);authorize 双形自适应(env 未配 400 内联 / 已配 200 URL 形状);手动兜底建 github 项目全链;定制 probe `scripts/probe-github-oauth.mjs`(spec 12 / #361)。
- [local 项目 daemon 执行面](./local-daemon-executor.md) 硬链接镜像 clone→worktree→conv 分支 push 回用户仓库→merge 步 ff-only 落地(脏区/非 ff = git 自拒 failed 含原文)+github per-step token 不进 argv(PATH shim 捕获)+Files tab 禁用占位;配方 = `integration/test/g2t2-local-lifecycle.test.ts` 等四面(spec 12 / #362)。live re-probe 待补。
- [模型服务 runtime tabs(providers 页)](./providers-tabs.md) spec 11 A1-A4/A7 先行地图：tablist pi/Claude Code + `?runtime=` 同步 + header 卡安装态 + pi = custom providers models[] 投影 + model-sources API 双真值 + facade / chevron 负向 (#353/#354)；定制 probe `scripts/drive-providers-tabs.mjs`。**实现票落地前红态**。
- [机器页本机行 + switches](./machines-local-row.md) spec 11 A8/A9/A7 先行地图：本机行 server seed (kind='local', name=hostname) 钉首不可删 + per-runtime role=switch 翻转写回 enabledRuntimes (API + SQLite 双真值，幂等) + 添加机器流程不变 + facade / chevron 负向 (#353/#354)；定制 probe `scripts/drive-machines-local.mjs`。**实现票落地前红态**。
- [添加服务商 picker dialog](./provider-picker.md) spec 11 A5/A6 先行地图：「新建」开 picker — 页面无 preset 投喂负向 + 搜索客户端过滤 38 项 + 显示名 canon 名称节点等值 (spec 名单) + OAuth 徽标两项 / xai 行负向 + xai oauthLabel 密钥表单正向 + api_key 族密钥表单 + 自定义端点 disclosure 展开现有表单 + 创建链回归护栏 (#353/#354)；定制 probe `scripts/drive-provider-picker.mjs`。**picker 结构实现票落地前红态；创建链段应绿**。
- [技能页(只读本地目录面)](./skills-page.md) 技能 = server 本地目录现扫投影:放含 SKILL.md 的子目录→刷新即现,无新建/导入入口,空态指路目录,id = frontmatter name 回落目录名(spec 13 #367)。栈隔离第四轴 `PACMAN_SKILLS_DIR`(launch.mjs 已带)。
- [MCP 页(只读本地 config 面)](./mcp-servers.md) `~/.claude.json` mcpServers 段投影列表+只读钉扎(无新建/更多入口、写面 404、密钥值不出接口、SQLite 无 mcp_server 表);定制 probe `scripts/drive-mcp.mjs`(#368);daemon 执行面配方 = integration m4b-mcp-e2e。
- [skills 执行面注入(daemon)](./skills-injection.md) PACMAN_SKILLS_DIR 扫描→`<available_skills>` catalog 追加进 systemPrompt→agent read SKILL.md 按需加载(#371,spec 14)。daemon 侧无 UI 面,canonical 证据 = integration 真栈探针(skills-inject-e2e)。

## 已知未入图面(验到这些别声称 map 覆盖)

- 任务详情页(`/app/todo/:id`)——live 面已铺:3-pane 结构与右 pane 四视图(detail-right-pane)、停止链(stop-button)、AI 审核发起(review-modal)、@提及(mentions)、附件(attachments)、分支同步(branch-sync,#366 起右 pane section 入口)、失败面发送(failed-send)。未铺:plan/changes/diff 文档面内容渲染、transcript 流渲染、编辑分配弹层。
- 总管抽屉/设置(`.chief-fab` 有 live wiring,数据面未铺)。
- 团队密钥管理页(routes 均在,fixture e2e 有覆盖,live 配方未铺)。技能页已入图 = skills-page.md；MCP 页已入图 = mcp-servers.md(#368)；机器/模型服务两页已铺三面(#354 先行地图:providers-tabs/machines-local-row/provider-picker——spec 11 实现票落地前红态,配方见各 feature 文件)。
- 看板拖拽改相(`PATCH /api/todos/:id`,#160)——fixture e2e 有 board-dnd 覆盖。
- 定时(schedules)增删改、项目设置页——fixture e2e/dead-buttons 覆盖,live 配方未铺。
- daemon 侧(`pnpm dev:daemon`)——需要真机器注册流程,超出 UI 验证范围;唯一已铺条目 = skills-injection(经 integration 真栈 harness,不经 launch.mjs)。

新功能落地后把入口补进 map(`/maintain-verification-skill`)。
