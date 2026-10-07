# #919 验证证据索引 — 技能路由的行为验收

票：#919（integration: 技能路由的行为验收）。主判据 = **行为**：票面只写需求、
一个字不提技能，lane 干完活后能在产物/日志/界面指出它自己命中了哪个技能。
结构判据（目录全量、无截顶、硬挡、空清单、版本兼容）由 integration 与 unit
钉扎（`integration/test/skills-routing-e2e.test.ts`、
`apps/daemon/test/skills-version-skew.test.ts`），本目录是**真实派活**的
行为证据 + deny 事件 UI 可见面的 live 取证。

探针 = `.claude/skills/verify-pacman/scripts/drive-919-skills-routing.mjs`
（两相位；behavior 腿走真模型 = claude-code runtime + 本机 claude 登录态，
缺省 glm-5.3；deny-ui 腿走探针内嵌脚本 stub）。运行日 2026-10-07。

| 目录 | 相位 | checks | 覆盖的票面验收 seam |
|---|---|---|---|
| `behavior/` | `--phase=behavior` | 12/12 | 主判据：票面零技能词（自证 check）→ 真模型步 done → 产物 `haiku.txt` 含技能正文 marker `SKILL-ROUTE-919`（artifact 面）+ 提交面 `HEAD:haiku.txt` 含 marker（hosted 项目，步收尾 commit + push）+ transcript 的 SKILL.md 读取行（日志面）+ daemon.log `team: 1 skill(s) materialized` / `catalog: entries=1` / `deny: 2` + 详情页技能行与「技能」汇总节截图（真实用户路径前端面） |
| `deny/` | `--phase=deny-ui` | 11/11 | 被 deny 挡下的事件同样可见：blocked 行（红 + Ban 字形）+ 汇总节拦截计数截图；同跑取放侧（授权 read marker 落库）、拒侧（拒绝文案落库、未授权 marker 不落库）、`denied-read:` 行、live 栈 LLM 输入面目录断言（含点名技能、无白名单外条目） |

## 主判据的三面真值（behavior/）

- **产物面** `behavior-artifact-haiku.txt`：真模型写的 haiku.txt 全文——三行
  俳句 + 独占一行的 `SKILL-ROUTE-919`（该 marker 只存在于技能正文里，票面
  与任务文本都没有）。
- **日志面** `behavior-daemon-skills-log.txt` + `behavior-messages.json`：
  daemon.log 的 `[skills]` 行族（团队分发物化、目录 entries、硬挡集）；
  transcript 里模型对团队分发 SKILL.md 的 Read 命中行，含模型自己的思考
  段（「The skill says: write a haiku…」= 按 description 自主匹配的实录）。
- **界面面** 两张截图：线程列「读取技能 haiku-helper」一等行；右栏「技能」
  汇总节 `haiku-helper 读取 ×1`。

## 复跑配方

```sh
# 栈与 daemon（8791/5273 常被邻道占用，先 lsof 再换口）
node .claude/skills/verify-pacman/scripts/launch.mjs   # VERIFY_REPO_ROOT=<worktree> VERIFY_PORT=8795 VERIFY_WEB_PORT=5277 VERIFY_RUN_DIR=/tmp/pacman-919-run
TEAM=$(curl -s --noproxy '*' http://127.0.0.1:8795/api/teams | …取 [0].id)
KEY=$(curl -s --noproxy '*' -X POST http://127.0.0.1:8795/api/teams/$TEAM/api-keys -H 'content-type: application/json' -d '{"name":"probe-919-machine","gitAccess":true,"mcpAccess":false,"toolGrants":{"read":[],"write":[]}}' | …取 .plaintext)
cd apps/daemon && env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  PACMAN_HOME=/tmp/pacman-919-daemon-home PACMAN_SKILLS_DIR=/tmp/pacman-919-local-skills \
  pnpm exec tsx src/cli.ts start --foreground --server http://127.0.0.1:8795 \
  --api-key "$KEY" --team "$TEAM" --name verify-919 &
# 两相位（行为腿要求本机能经 claude 登录态到模型；relay 间歇故障按 ≤3 次整步重试）
node .claude/skills/verify-pacman/scripts/drive-919-skills-routing.mjs --phase=behavior
node .claude/skills/verify-pacman/scripts/drive-919-skills-routing.mjs --phase=deny-ui
```

## 结果判读（本轮实撞的四个坑）

- **enroll 缺省 `enabledRuntimes:['pi']`，#682 起是 claim 真闸**：claude-code
  runtime 的步在只开 pi 的机器上永远 pending 且 daemon 零日志（首轮三轮
  600s 空等的根因）。探针已内置 `PATCH /api/machines/:id` 打开两 runtime。
- **step 终态词表是 `done`**（shared stepStatusSchema），不是 `success`；
  build 表没有 status 列，失败根因在 `build.errorMessage`。drive-920 模板
  只见过 failed 形，抄它的终态列表会空等。
- **项目必须 `repoKind:'hosted'`**：缺省 manual 形态无仓库，产物进不了任何
  提交（提交面断言无真值可取），右栏变更面也空。
- **stub 的 toolcall id 必须跨进程唯一**：message 行以 toolcall id 为行 id
  全局去重——两个 probe 进程都发 `call-stub-N` 时后跑那次的行被 server
  静默丢弃（outbox 有行、DB 无行、UI 空等 60s）。探针已加 per-process salt。
- **agent.skills 的白名单引用按团队库现扫过滤**（死引用静默脱落）：要让
  daemon 本机技能进白名单，它必须同时是团队库已知 id（探针把整套 fixture
  库也建到团队侧；同名冲突团队条目胜，本机那份作 collision loser 不进拒绝
  集，读取照放行）。
