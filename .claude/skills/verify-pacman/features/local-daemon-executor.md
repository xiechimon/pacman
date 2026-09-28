# local 项目 daemon 执行面(镜像 clone + ff-only 落地 + Files tab 禁用)

local 仓库项目的任务执行链(spec 12 G2-T2,#362):daemon 对用户本机 git 仓做硬链接镜像 clone 开 worktree,每步 commit 后 conv 分支 push 回用户仓库;merge 步收尾在用户仓库 `git merge --ff-only` 落地(脏工作区/非 ff → git 自拒 → 步 failed,reason 含 git 拒绝原文,永不 force、永不动用户工作树)。web 面 v1:local 项目 Files tab 禁用(占位 + 一行 disable 文案)。GitHub 形态执行凭证(per-step x-access-token)同票接线,消费面在 daemon git spawn。

## Sub-features

- `local-clone` — runner 对 `repo.kind==='local'` 开 worktree:cloneUrl = 用户仓库绝对路径,`git clone` 本地路径默认硬链接(近零成本);托管存储面(server reposDir)零写入。
- `local-push-back` — 每步收尾 conv 分支 `pacman/conv-<buildId>` push 回用户仓库 refs/heads(非 bare 收 push;不触用户当前分支)。
- `ff-only-landing` — merge 步 push 后在用户仓库目录 `git merge --ff-only pacman/conv-<id>`:happy path 用户 main ff 到 merge checkpoint、工作树见改动且 status 干净;脏工作区/非 ff → failed + build.errorMessage 含 git 拒绝原文("would be overwritten by merge" / "Not possible to fast-forward")。
- `github-per-step-token` — github 项目 token 端点下发 `{username:'x-access-token', password:<connection token>}`;凭证只经 GIT_CONFIG_* env credential.helper 注入,fork+exec argv 全程无 token(PATH shim 捕获证明)。
- `files-tab-disabled` — local 项目页 文件 tab 钮 disabled;内容区占位一行「本地仓库项目暂不支持在线浏览文件」;任务 tab 不受影响。

## How to get to it (user POV)

- 执行面:新建 local 项目(见 [local-repo-api.md](./local-repo-api.md))→ 建任务 → 开始构建(withPlan)→ 确认 → 执行 → 发起合并;观察用户仓库分支/HEAD/工作树。
- Files tab 面:进入 local 项目详情页 `/app/project/:id`(默认落 文件 tab)→ 见占位文案,tab 钮不可点。

## Driving it with 集成 E2E + fixture e2e

Preconditions: proxy env 全 unset(回环过代理 = 假阳性);本机有 `git`。

- daemon 执行面全链(真 server + 真 daemon + stub LLM + 真 git):`cd integration && env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' npx vitest run test/g2t2-local-lifecycle.test.ts` → 2 测试(硬链接/推回/ff 落地 happy path + 脏工作区 failed 含 git 原文)。
- hosted 面不回归对照:`npx vitest run test/m3b-demo.test.ts`(runner 改动触碰共链,收尾必跑)。
- argv 凭证纪律 + workspace 原语三态:`cd apps/daemon && npx vitest run test/local-executor.test.ts`(PATH shim 捕获 fork+exec 命令行)。
- server claim/token 接线:`cd apps/server && npx vitest run test/g2t2-executor-wire.test.ts`。
- Files tab 面(fixture e2e):`cd apps/web && npx playwright test e2e/project-files-local-disabled.spec.ts`(scenario `prj-local-files`)。
- live re-probe(隔离栈真 daemon 走 UI 建 local 项目全链)待补。

## Gotchas

- **落地面只在 merge 步**:build/plan 步只 push conv 分支,用户工作树不动——验「用户仓库被改」必须走完整 merge 链,半途看 HEAD 不动是预期。
- 脏工作区判定是 git 自己的语义:只有改动与 ff 更新**重叠**才拒;不重叠的脏文件 git 放行(ff 照常)。别用「任意脏文件」断言必拒。
- 硬链接证据面(`nlink ≥ 2`)要求 clone 源与 workspacesRoot 同卷——测试道具都落 os.tmpdir();跨卷会静默退化为 copy。
- github 形态 token 下发前提是 github_connection 行在位(OAuth 面见 [github-oauth-picker.md](./github-oauth-picker.md));无行 = git 槽 null,私有仓失败原文浮在步 reason,不是 token 端点错。
- Files tab 占位是 v1 面(spec 12 Out of Scope:详细列表/编辑器响应式归后票)——别按 hosted 文件浏览面断言 tree/file 行为。
