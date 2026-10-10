# #1102 提交详情面验收证据

票：xiechimon/pacman#1102（项目页「历史」列表加提交详情面——点一行看该提交的 diff）。
探针：`.claude/skills/verify-pacman/scripts/drive-1102-commit-detail.mjs`（纯 live 栈，零
daemon 零 LLM；hosted + local 双形态 + 不可达降级三相位）。

## 复跑配方

```sh
# 隔离栈（worktree 车道传 VERIFY_REPO_ROOT；proxy env 全 unset）
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  VERIFY_REPO_ROOT=<repo> node <repo>/.claude/skills/verify-pacman/scripts/launch.mjs
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  VERIFY_REPO_ROOT=<repo> node <repo>/.claude/skills/verify-pacman/scripts/drive-1102-commit-detail.mjs
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  VERIFY_REPO_ROOT=<repo> node <repo>/.claude/skills/verify-pacman/scripts/cleanup.mjs
```

fixture/stub 面回归 = `apps/web/e2e/project-commit-detail.spec.ts`（C1-C7：点行出 diff、
元信息与行一致、切换不串、(projectId, sha) 选中不串项目、reason 分译降级、aria-current
载体与关闭钮、hosted/local 两 fixture 形态含根提交与种子空提交定义态）。服务端真值 =
`apps/server/test/git-hosting.test.ts`（merge 第一父 / 种子空 / 不可达与注入形 404 /
github 形态 404）+ `apps/server/test/project-local.test.ts` F6（根提交全文件新增 +
local 目录消失 reason 同闸）。

## live/ —— 2026-10-10 跑（25/25 PASS，栈 8791/5273，全新库）

| 文件 | 内容 |
|---|---|
| `result.json` | 25 条 checks 逐条 ok/label + 栈坐标 |
| `responses.json` | REST 真值：hosted 列表 5 行、README/merge/种子三详情、未知 sha 与注入形 404、local 根/二次提交详情、删仓后 404+reason、SQLite 双项目行 |
| `H1-hosted-history-list.png` | hosted 历史 seg 五行列表（可点行形） |
| `H2-hosted-readme-diff.png` | 点 README 行 → 详情面：头带元信息与行一致 + README.md +3 diff |
| `H3-hosted-merge-first-parent.png` | 切 merge 提交 → side.txt 单文件（第一父 diff，README 退场） |
| `H4-hosted-seed-empty.png` | 种子空提交 → 「该提交没有可显示的改动。」定义态 |
| `L1-local-root-commit.png` | local 根提交 → README 全新增、零删行 |
| `D1-local-unreachable-degradation.png` | 删 local 仓目录 → 整 pane 人话降级（主行 + reason 分译） |

## commit-detail.drawio / .drawio.svg

PR body「What」节解释图：before（静态行 + 无详情端点）vs after（行钮 → 新读端点 →
parseUnifiedDiff → DiffFileBlock 复用面；边界三口径）。文字出框闸
`scripts/check-diagram-text-fit.py` 通过（OK）。
