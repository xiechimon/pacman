# #638 静默 mutation 失败面接线——live 失败注入证据

票面验收第 4 条：抽 3 件有后端语义的写面（`createTodo` / `startBuilds` /
`createProvider`）做 live 失败注入的 before/after 对照。

## 注入法

真 live 栈（隔离 verify 栈：真 server + 真 vite dev + 全新 scratch 库），在
浏览器网络层用 Playwright `page.route` 把目标 POST 应答替换成 server 单形状
错误（HTTP 500 + `{error}`——`api/client.ts` `settle()` 的 ApiError 真输入）。
请求不到 server，但 UI 侧走完整真链路（真 React Query mutation → onError →
toast）。与 `apps/web/e2e/composer-wire-reject.spec.ts`（#631/#635 canon）同法。
铺底（建项目 / 建任务 / PATCH 相位 done）走公开 REST，非被测路径；被测路径
全部真用户交互：侧栏「新任务」对话框保存、done 任务详情页「重开」主按钮、
服务商 picker → deepseek 预设密钥表单 → 「添加模型服务」。

## 结果

| 面 | before（origin/main 1877a835 栈） | after（本分支栈） |
|---|---|---|
| createTodo | `createTodo-before.png`：对话框关闭、任务没建上、**零 toast**（2.5s 观测窗） | `createTodo-after.png`：toast「新建任务失败，请重试。」+ description 透传 `injected(638): POST todos refused` |
| startBuilds | `startBuilds-before.png`：点了「重开」无声无息，相位仍 done | `startBuilds-after.png`：toast「开始运行失败，请重试。」+ 原因透传；相位仍 done（未半启动） |
| createProvider | `createProvider-before.png`：弹窗留着、零反馈 | `createProvider-after.png`：toast「添加模型服务失败，请重试。」+ 原因透传；providers 封套零行 |

每面另钉 server 真值（GET /api/todos 无该行 / 相位未动 / providers 封套零行），
证明失败是真失败（数据没落），不是只拦了响应。

- `result-before.json`：13/13 checks PASS（--expect=silence 形态）。
- `result-after.json`：16/16 checks PASS（--expect=toast 形态；多出的 3 条 =
  标题句 + 原因透传断言）。

## 栈坐标

- after：server 8793 / web 5275，`VERIFY_REPO_ROOT=<本分支 worktree>`。
- before：server 8794 / web 5276，`VERIFY_REPO_ROOT=/tmp/638-before`
  （`git worktree add --detach /tmp/638-before origin/main` + corepack install，
  跑完已回收）。

## 复跑

```sh
# after（本分支）
VERIFY_REPO_ROOT=$PWD VERIFY_PORT=8793 VERIFY_WEB_PORT=5275 \
  node .claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_EVIDENCE_DIR=/tmp/638-evidence/after \
  node docs/verify/638/probe-638.mjs --expect=toast --tag=after
node .claude/skills/verify-pacman/scripts/cleanup.mjs

# before（origin/main 一次性 worktree）
git worktree add --detach /tmp/638-before origin/main
(cd /tmp/638-before && corepack pnpm install --frozen-lockfile)
VERIFY_REPO_ROOT=/tmp/638-before VERIFY_PORT=8794 VERIFY_WEB_PORT=5276 \
  node /tmp/638-before/.claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_RUN_DIR=/tmp/638-before/.claude/verify-run \
  VERIFY_EVIDENCE_DIR=/tmp/638-evidence/before \
  node docs/verify/638/probe-638.mjs --expect=silence --tag=before
VERIFY_REPO_ROOT=/tmp/638-before \
  VERIFY_RUN_DIR=/tmp/638-before/.claude/verify-run \
  node /tmp/638-before/.claude/skills/verify-pacman/scripts/cleanup.mjs
git worktree remove --force /tmp/638-before
```

`probe-638.mjs` 即本目录归档副本（运行时正本在 lane 的
`.claude/verify-shots/`，gitignored）；@playwright/test 从脚本所在位置向上
解析，须在装过依赖的检出内跑。
