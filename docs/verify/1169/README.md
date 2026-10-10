# #1169 agent.skills 拆字段——行为验证证据（drive-1169-skills-split）

[drive-1169-skills-split.mjs](../../../.claude/skills/verify-pacman/scripts/drive-1169-skills-split.mjs)
两相位取证（2026-10-10，worktree `hp-pacman-t-0288-…`，verify 栈 8796/5278 全新库）。
票面主修位：`defaultSkill`（携带，单值）与 `skillsAllowlist`（授权，null = 不限制）
分家；既有 `[]` 行迁为 null——「新建 agent 出生即全拒」随缺省形态退役。

| 目录 | 相位 | 结果 | 覆盖 |
|---|---|---|---|
| `api/` | `--phase=api` | 21/21 | 纯 live 栈零 daemon：REST 读写面（创建缺省 null、PATCH 显式 null↔[] 互转、单值槽拒数组、白名单死引用滤除、两槽互不影响）+ claim 载荷（null/null 恒携带、数组/单值原样、与缺省/[] 三态不塌缩）+ 技能清单（null → selection=all 全量、直取文件 200；子集 → whitelist 且名单外 404 零回归） |
| `behavior/` | `--phase=behavior` | 8/8 | 真模型腿（claude-code runtime + 本机 claude 登录态，glm-5.3）：**不设技能的新建 agent**（skillsAllowlist=null）跑任务 → 任务文本点名技能 → transcript 含 SKILL.md 读取与 marker 复述行（`behavior-messages.json`）+ daemon.log 目录行 entries≥1 且**零硬挡行**（`behavior-deny-lines.txt` 为空——旧代码里这个 Read 会被 [] 缺省硬挡）+ 俳句产物进收尾提交（`behavior-artifact-head-haiku.txt`）+ 详情页技能汇总行点名 haiku-helper 且零「挡下」列（截图 `behavior-detail-skills-summary.png`） |

## 复跑配方

```sh
# 栈（先 lsof 换口）
VERIFY_PORT=8796 VERIFY_WEB_PORT=5278 node .claude/skills/verify-pacman/scripts/launch.mjs
# api 相位（零 daemon）
SERVER=http://127.0.0.1:8796 node .claude/skills/verify-pacman/scripts/drive-1169-skills-split.mjs --phase=api
# behavior 相位（daemon 外部起；前置与 919 README 同——机器 runtime 闸由探针幂等打开）
TEAM=$(curl -s --noproxy '*' http://127.0.0.1:8796/api/teams | …取 [0].id)
KEY=$(curl -s --noproxy '*' -X POST http://127.0.0.1:8796/api/teams/$TEAM/api-keys …取 .plaintext)
cd apps/daemon && env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  PACMAN_HOME=/tmp/pacman-1169-daemon-home PACMAN_SKILLS_DIR=/tmp/pacman-1169-local-skills \
  pnpm exec tsx src/cli.ts start --foreground --server http://127.0.0.1:8796 \
  --api-key "$KEY" --team "$TEAM" --name verify-1169 &
SERVER=http://127.0.0.1:8796 WEB=http://127.0.0.1:5278 \
  node .claude/skills/verify-pacman/scripts/drive-1169-skills-split.mjs --phase=behavior
node .claude/skills/verify-pacman/scripts/cleanup.mjs   # 杀 daemon + 收栈
```

## 判读要点

- **api 相位的 claim 腿用独立新建行**（A3/A4 的 PATCH 游乐场已把首行改写成白名单形——判据行必须未触碰）。首轮实撞：判据行拿了 `["haiku-helper"]`，假红。
- **behavior 相位复用 919 前置**：机器 runtime 闸（#682——claude-code 步在只开 pi 的机器上永远 pending）、hosted 项目（提交面真值）、daemon 外部起（PACMAN_SKILLS_DIR 指本机技能根）。919 README 的五个坑对本探针同样生效。
- **主修位判据 = 零 deny 行**：null（不限制）agent 的 `[skills] deny:` 行应为零条（旧代码缺省 [] 时 Read 被硬挡——`docs/verify/917` 的对照组即那个形态）。
- 配套静态面：迁移回填 unit（`apps/server/test/agent-skills-split-backfill.test.ts`——0013 会把旧 skills 清空，截尾定位判据必须用 `json_extract(\`skills\`)` 而非 `UPDATE agent SET` 形态）、daemon runner 映射（`apps/daemon/test/machine-step-exec.test.ts`——null 折叠 + defaultSkill 绑定序首位）、详情页 e2e（`apps/web/e2e/agent-detail.spec.ts`——两控件互不影响 + null↔[] 序列化）。