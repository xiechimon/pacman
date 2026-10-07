# #923 证据索引——pi-coding-agent 0.86.0 → 1.0.4（技能目录注入链路 before/after 对照）

日期 2026-10-07。形态：integration harness 同构（`integration/test/skills-inject-e2e.test.ts`
的引导面）——真 HTTP server + 真 daemon machine-loop + 真 PiBackend + stub LLM
（openai-completions SSE），全进程内、随机端口，一次派发一个真实 build 步：
claim → pi 会话 → read 工具真读 SKILL.md → bash 真改动过 #703 闸 → 步 done →
相位翻 review。

- **before 面**：origin/main（a0475e0f）一次性 worktree `/tmp/pacman-923-before`，
  pi 0.86.0。
- **after 面**：本分支 worktree，pi 1.0.4。
- 两面跑同一份 `probe-923-catalog.mjs`，fixture 技能目录用固定路径
  `/tmp/pacman-923-skills`（catalog location 是绝对路径，两面同径才能逐字节 diff）。

## 验收 seam 2 判定：catalog 内容与升级前一致或更好

**一致（主判定）**：daemon 受控目录逐字节相同——`catalog-diff.txt` 为空
（两面各 1169 字节）；`[skills]` 日志行两面相同（`loaded: 4` + allowlist 外
`filtered` 行）；简报文件通道（#958）生命周期行两面相同。

**更好的面（如实记录）**：

1. **崩溃恢复语义升级（本次唯一行为面迁移）**：pi 1.0.x 把会话 jsonl 的首次落盘
   从「assistant 首条到达」提前到「user 首条消息」（上游 #10000——「keeps the
   prompt on disk if the first turn never completes」）。步中 SIGKILL 崩溃后会话
   文件在位可续：recover 从 0.86 的「journal 兜底 → new session 重发任务文本」
   升级为「continue session 真续跑（同会话续接）」。两面 daemon.log 对照 =
   `before/after-crash-recover-daemon-log.txt`（before 走 `continue session
   unavailable → falling back to new session` 回退行；after 直接 `continue
   session <convId>`）。归因实证：同一测试在 before worktree（0.86.0）4.26s
   PASS、在本 worktree（1.0.4）红——纯升级行为变化，非 flake。
   `integration/test/crash-recover.test.ts` 同 PR 迁移钉新行为；journal 兜底
   回退面（会话文件缺失/不可续，跨机认领形态 #862 T1）仍由
   `apps/daemon/test/runner-resume-note.test.ts` 单测钉住，无覆盖损失。
   `docs/spec/02-架构平价.md` 的「步 journal recover 细节」对账行同步更新。
2. pi 引擎自身 system prompt 的文档指针行在 1.0.4 多了 MCP servers（docs/mcp.md）
   与 codemode（docs/codemode.md）两个指针（`brief-context-diff.txt` 第 31 行对）
   ——上游新功能的文档指引，非 pacman 契约面变化；其余 5 处 diff 全是安装路径 /
   temp 目录噪声。

**静态根因**：`dist/core/skills.js`（loadSkillsFromDir 发现面 + formatSkillsForPrompt
输出面）0.86.0 与 1.0.4 全部 diff 只有 10 行——formatSkillsForPrompt 新增第三种
`fileReadTool` 模式；pacman 走 `'read'` 模式，产物不受影响。逐字节一致是代码级
必然，probe 给的是运行时实证。

## 断言面（probe 18 项 × 两面全 PASS）

- 版本钉：安装版本 = 面别期望（before 0.86.0 / after 1.0.4）。
- 步端到端：POST /builds 201、todo 相位到 review（真实步完成）。
- A 面（daemon 受控目录，进 LLM 首轮真 wire 载荷）：`<available_skills>` 块在位；
  demo-skill 带绝对路径 location；分组目录嵌套技能 nested-skill 被发现；
  handtyped（frontmatter `disable-model-invocation: true`，已勾选 allowlist）
  整条剔除；longdesc 截 200 + `…`、原文全长不在；恰 3 条；agent 职责文本在位
  （追加不覆盖）。
- 连通性硬验收：第二轮请求携 read 工具结果 = SKILL.md 正文 marker
  （catalog 不是装饰品，read 路径可达）。
- #372 allowlist：unauthorized-skill 被滤 + `[skills] filtered` canon 行。
- #958 简报通道：`brief written …(create)` / `brief removed` 行在位、步收尾后
  worktree 不留 AGENTS.md。
- B 面 facts（两面记录不硬断言）：pi 宿主机自动目录（DefaultResourceLoader 自扫
  `~/.agents/skills`，0.86 与 1.0.4 同有此扫描）条目数 104 = 104、嵌套分组
  条目 0 = 0——宿主面零漂移。

## 场景复现（两面同一脚本）

```sh
# after 面（本 worktree，pi 1.0.4）
env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY \
    -u ALL_PROXY NO_PROXY='*' FACE=after EXPECT_PI_VERSION=1.0.4 \
    apps/daemon/node_modules/.bin/tsx docs/verify/923/probe-923-catalog.mjs

# before 面（origin/main 一次性 worktree，pi 0.86.0）
git worktree add --detach /tmp/pacman-923-before origin/main
cd /tmp/pacman-923-before && corepack pnpm install
mkdir -p docs/verify/923 && cp <本目录>/probe-923-catalog.mjs docs/verify/923/
env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY \
    -u ALL_PROXY NO_PROXY='*' FACE=before EXPECT_PI_VERSION=0.86.0 \
    VERIFY_EVIDENCE_DIR=<本目录绝对路径> \
    apps/daemon/node_modules/.bin/tsx docs/verify/923/probe-923-catalog.mjs
```

## 文件

| 文件 | 内容 |
| --- | --- |
| probe-923-catalog.mjs | 定制 probe（断言对照图 + 环境契约见文件头；两面同一份） |
| before-result.json | before 面 18 项检查全 PASS + facts（pi 0.86.0） |
| after-result.json | after 面 18 项检查全 PASS + facts（pi 1.0.4） |
| before-catalog.txt | before 面 daemon 受控目录全文（首轮 LLM 请求原样切出） |
| after-catalog.txt | after 面同上——与 before 逐字节相同 |
| catalog-diff.txt | `diff before-catalog.txt after-catalog.txt` 产物（空 = 逐字节一致） |
| before-skills-log.txt | before 面 daemon.log `[skills]` 行族 |
| after-skills-log.txt | after 面同上——与 before 相同 |
| before-brief-context.txt | before 面首轮请求含 catalog/职责文本的完整 text 块（宿主自动目录已脱敏为计数占位） |
| after-brief-context.txt | after 面同上 |
| brief-context-diff.txt | 两面 brief-context 全量 diff（6 对：5 处路径噪声 + 1 处引擎文档指针行） |
| before-crash-recover-daemon-log.txt | before 面 crash-recover 集成测试的 daemon.log 恢复段（journal 兜底回退路径） |
| after-crash-recover-daemon-log.txt | after 面同上——continue session 真续跑路径 |

## 关键事实

- **注入面有两路，证据分开取**：A = daemon 受控目录（PACMAN_SKILLS_DIR →
  buildSkillsCatalog → 简报文件通道）；B = pi 引擎宿主机自动目录
  （DefaultResourceLoader 自扫 `~/.agents/skills`，两版本同有）。B 面内容是宿主机
  私有技能清单，**证据只记条目数 facts，文本脱敏不落盘**（本仓 public）。
- **frontmatter 正典键是 kebab-case `disable-model-invocation`**（skills.js:262
  两版同式）：写成 camelCase `disableModelInvocation` 会被 pi 静默忽略、技能照常
  进目录（probe 首轮实测踩中，18 项里红 2 项后修正 fixture）。
- **allowlist 语义**：seed agent 的 `skills` 缺省 `[]` = 不注入任何技能；probe 按
  skills-inject 同法直写 DB 勾选。REST 写侧 `filterKnownSkillIds` 吃 server 自己的
  skillsDir（集成 harness 里是隔离空目录），fixture slug 从 API 过不去。
- **changelog 核对**：0.86 → 1.0.4 唯一 Breaking Changes 段在 0.87.0
  （`shouldStopAfterTurn` 移除、`SessionEntry`/`ExtensionEvent` 联合扩位、
  SessionManager 正典化）——pacman 缝全不消费这些面；1.0.3 的 Azure preset 改名
  与 pacman 无关（custom provider 自物化 models.json）；1.0.4 无 breaking。
  `mapPiSessionEvent` 对事件族宽松投影（default 空集），新事件形态天然兼容。
- **版本口径**：票面钉 1.0.3；实施时点（2026-10-07）npm latest 已是 1.0.4
  （2026-10-05 21:51 发布），按验收 seam「等于当时 npm latest」与版本漂移直接升
  口径取 1.0.4。
- **lockfile 伴随面**：`pi-ai` / `pi-agent-core` 与 `pi-coding-agent` 同步升 1.0.4
  （上游内部依赖 `^1.0.4`，三包 dedupe 同一份）；`openai` 6.40.0 → 7.19.0、
  `@anthropic-ai/sdk` 0.124.0 → 0.129.0 是 pi-ai 的传递依赖漂移，
  claude-agent-sdk 的 peer 范围（>=0.93.0）仍满足；新增传递依赖 pi-codemode /
  pi-mcp / quickjs-wasi。全部为依赖变更伴随的合法 lockfile diff。
