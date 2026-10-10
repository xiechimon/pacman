# #1106 派发技能注入——验证证据

票面：派发管线技能注入（目录粗分发 + description 细触发注入任务 brief）。
机制：worker 步 claim（= 任务 brief 的组装投递位，#823 chief 路由同位）时，
服务端对「任务文本（title+spec）× 授予集」做规则选择（候选基 = 授予集正本，
server 现扫只联接描述——daemon 本机库的授予技能以 id/名参与点名），结果随
同一次 claim 原子落 step 行（`skillInjection` 列，含每条命中的规则与原因），
ids 经 claim 载荷 `agent.injectedSkills` 透传 daemon 收窄目录注入（daemon
半由 apps/daemon 单测钉住，见下）。

探针：`.claude/skills/verify-pacman/scripts/drive-1106-skill-inject.mjs`
（wire 相位——live 栈 + 裸 HTTP 扮机器 + 浏览器详情面；无 daemon/LLM 依赖）。
fixture：21 个授予技能（票面 ≥20 量级；前端/测试/调试域 + 求职/知识库无关族）。

## 结果

| 腿 | 栈 | 结果 |
|---|---|---|
| after | 本分支（8791/5273） | 17/17 PASS（`after/result.json`） |
| before | origin/main 一次性 worktree（8793/5275） | 8/17——9 FAIL = 机制缺席基线（`before/result.json`：payload 无 `injectedSkills`、step 表无 `skillInjection` 列、详情面无 injected-skills 行） |

## 验收 → 实物路径

| 票面验收 | 判据（result.json check 名） | 实物 |
|---|---|---|
| 1 ≥20 技能只注入相关 | 「注入只含相关技能」：domain 任务注入 = [better-colors, better-layout, better-typography, kami]（前端域），求职/知识库 12 族零注入 | `after/claim-domain.json`（agent.injectedSkills vs agent.skills=21） |
| 2 agent 可答「为何没用未注入技能」 | 注入 ⊆ 授予 + 未注入技能 description 不进 brief（选择面只有 4/21） | `after/claim-domain.json`；daemon 目录收窄单测 `apps/daemon/test/skills-catalog.test.ts` #1106 块（选中条目全文、未选条目 filtered 出目录、deny 面不收窄） |
| 3 零命中正常派发 | claim 200 + `injectedSkills=[]` + step 行 `hits=[]` + 授权集仍全量 | `after/steps-zero.json`、`after/claim-domain.json` 对照 |
| 4 选择过程详情面可查 | steps REST + SQLite step 行带规则与原因；浏览器 DOM 断言 + 截图 | `after/steps-domain.json`、`after/result.json`（SQLite 行一致性 check）、`after/detail-domain.png`（注入行含技能与原因）、`after/detail-zero.png`（「未注入技能」占位） |
| 细触发：显式点名 | 任务文本点名 tdd → 注入含 tdd、rule=explicit-mention、原因点名任务文本 | `after/claim-mention.json`、`after/result.json` |

## 命中原因实物（after/result.json）

domain 任务（「修复看板卡片的字号过小与换行溢出」）四条命中均为 domain 规则，
原因同时点名任务侧与技能侧关键词，例：

> better-typography — 任务文本与技能同域「前端界面」（任务命中「字号」，技能描述命中「ui」）

零命中任务（「把首页轮播图换成静态图」）：`hits=[]` 落库（配置事实非故障），
详情面渲染「未注入技能（任务文本未命中任何技能）」。

## daemon 半（注入收窄 + 描述全文）单测钉面

wire 相位证到「选择正本落库 + ids 进载荷」；daemon 侧目录按选择收窄、
未选条目 `filtered: ... not in injected selection`、选中条目 description
超 200 字不截断、`injectedSkills` 缺省回落白名单全量（旧 server 零回归）、
deny 面（#917 授权硬挡）不受选择影响——由 `apps/daemon/test/skills-catalog.test.ts`
「注入选择收窄（#1106）」块 7 用例钉住（34/34 绿）。

## 复跑配方（自足可复现）

```sh
# after 腿（本分支）：
node .claude/skills/verify-pacman/scripts/launch.mjs                 # 8791/5273，全新库
node .claude/skills/verify-pacman/scripts/drive-1106-skill-inject.mjs   # 17/17
node .claude/skills/verify-pacman/scripts/cleanup.mjs

# before 腿（origin/main 一次性 worktree，8793/5275）：
git worktree add --detach /tmp/pacman-1106-before origin/main
(cd /tmp/pacman-1106-before && corepack pnpm install --prefer-offline)
VERIFY_REPO_ROOT=/tmp/pacman-1106-before VERIFY_PORT=8793 VERIFY_WEB_PORT=5275 \
  node /tmp/pacman-1106-before/.claude/skills/verify-pacman/scripts/launch.mjs
SERVER=http://127.0.0.1:8793 WEB_URL=http://127.0.0.1:5275 \
  SKILLS_DIR=/tmp/pacman-1106-before/.claude/verify-run/home/skills \
  DB=/tmp/pacman-1106-before/.claude/verify-run/home/server/server.db \
  node <本仓>/.claude/skills/verify-pacman/scripts/drive-1106-skill-inject.mjs   # 8/17（9 FAIL = 基线）

# 单测面：
(cd packages/shared && corepack pnpm exec vitest run)   # 323（含 skill-inject 17）
(cd apps/server && corepack pnpm exec vitest run test/skill-inject-claim.test.ts)  # 5
(cd apps/daemon && corepack pnpm exec vitest run test/skills-catalog.test.ts)      # 34
(cd apps/web && corepack pnpm exec vitest run test/injected-skills-row.test.ts)    # 5
(cd apps/web && corepack pnpm exec playwright test e2e/skill-inject.spec.ts)       # 3
```

探针环境前提：全新库（launch 自清）；技能 fixture 由探针自建（21 个 SKILL.md
落 `<RUN_DIR>/home/skills`）；机器面 = enroll 换 token 的裸 HTTP 扮机器
（不依赖 daemon/LLM）。
