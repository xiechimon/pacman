# Pacman Development Rules

> 仓库级 agent / 人类共同规则。规则**可覆写**但需用户显式确认（见末尾"User Override"）。
> 项目背景与历史决策在 `~/.claude/projects/-Users-xmon-Code-AgentProjects-pacman/memory/MEMORY.md`——本文件只列规则不重复事实。

## Conversational Style

- 技术散文。commit / issue / PR / 代码里**禁 emoji**。
- 禁套话（"Thanks @user!"、"Great question"、"Sure thing"），直接回答。
- 解释非平凡设计时按"问题 → 具体例子 / 短 trace → 方案；为何必要 vs 可选复杂度"四段走。
- 用户提问时**先答问题，再动编辑**。
- 同意/不同意用户反馈时先表态（"同意/不同意，因为 X"），再列改动。

## Code Quality

- **缝纪律先于一切**：biome 的 `noRestrictedImports` 已经把 `@earendil-works/*`、`@modelcontextprotocol/sdk`、`simple-git`、`isomorphic-git`、`cron-parser` 锁死只能经薄桥模块消费。**改这些 import 路径前先看 `biome.json` 注释**（缝纪律 01 §5/§7.3 等条款）——改文件位置之前先校验 seam 是否仍然成立。
- 改自己没完整读过的文件前先 Read；不要靠搜索片段做广义修改。
- 默认无 `any`；需要时写明 `any intentionally - <理由>`。
- 单行 helper 且唯一调用点 → inline。
- 外部包 API: bundled types → 读 `node_modules/<pkg>/dist/*.d.ts`; 仅 `@types/` → 读 `node_modules/@types/<pkg>/index.d.ts` + 同包 JS 源; 无类型 → 跑 `node -e` 或查 docs, 不靠记忆推。pnpm 仓顶层 node_modules 只挂直接依赖——路径不存在就去 `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/`（本仓实测）。钉 `npm ls <pkg>` 版本。详 `~/.agents/wiki/wiki/外部包 API 事实源调研.md`。
- **禁 inline import**（`await import()`、`import("pkg").Type`、动态类型导入）；top-level only。
- `apps/daemon/src/backend/` 是 GitOps / MCP / LLM provider 缝；其它模块要把他们当成接口边界 import，不要从外部模块绕过去。
- 移除"看起来是有意写的"功能或代码前**先问**。

## Commands

代码改动后（仅文档改动不跑）：
```sh
pnpm lint       # biome ci . —— CI 视角
pnpm format     # biome format --write . —— 不写文件就别跑
pnpm typecheck  # pnpm -r typecheck
```
三类必须先通过才能提交。**别跑 `pnpm build`**（vite 全量；不值得 commit 前做）。

测试规则（强制）：
- **禁止写完实现再补 unit test**——要测就先于实现。
- **E2E 为主**：复杂功能用真 e2e 验证能跑通；开发期只跑与本次改动相关的几条；**禁止一次跑全套 e2e**（`apps/web` e2e 完整跑要 1h+）——收尾/PR 时再执行。
- **先列失败方式，再写实现**：动某块系统前，先枚举它可能失败的所有场景，写代码是让场景通过的手段。
- **e2e spec 文件合并/解冲突后必跑 `npx playwright test <spec> --list` 验解析**（M7 实战：typecheck 不覆盖 spec 语法，手工解冲突吞 `});` 到 EOF 才炸——typecheck 绿≠playwright 能解析）。

跑验证服务（port 与 dist/ 互斥）：
- `dev:web` / `dev:server` / `dev:daemon` ——dev server。
- **E2E_PORT** 默认 8399——跑前先 `lsof -iTCP:8399` 查占用，占用的是别的车道**不能杀**，换端口。
- **同 worktree 内不要并跑两个 playwright**——`vite build --mode fixture` 写同一个 `dist/`，会互踩。跨 worktree 各用各的 dist 无碍。

## Dependencies & Install Security

- 锁文件 `pnpm-lock.yaml`：**入 commit 前先确认**——除非是依赖变更伴随的合法 lockfile diff，否则视为误操作（`git reset pnpm-lock.yaml` 退出 staging）。
- 本地 `pnpm install`；CI 用 `pnpm install --frozen-lockfile`。
- 引入第三方包前先看 `biome.json` 的禁列：simple-git / isomorphic-git 等已被缝纪律取代，**不要再装**。
- 不跑 postinstall 脚本除非用户明确允许。

## Git

仓库单 remote：`origin = xiechimon/pacman`（正主，开 PR 去这里）。曾挂的 upstream（craft-ai-agents/craft-agents-oss，项目起步时的借鉴来源）已于 2026-09-29 移除，勿再加回。

Commit 约定：
- 格式：`<scope>(<ticket>): <subject>` 或 `web(<PR>): <subject>`——scope 跟现有节奏（`web` / `daemon` / `server` / `shared` / `integration` / `docs` / `chore` 等）；subject 短、要点。
- PR 编号或 issue 编号挂末尾：`(#123)` PR 号；问题描述里出现 `closes #N` 关 issue。多 issue 用 `closes #N1, closes #N2`（不能合并写）。
- **只 commit 自己改过的文件**。`git add <path1> <path2>` 显式路径，**禁 `git add -A` / `git add .`**——同 cwd 可能多个 lane 并行（agent / 人类）。例外：merge 落盘（解决冲突后的 merge commit）语义上是全量 stage，允许 `git commit --no-edit` 完成 merge 而不再 add（merge 状态自带 index）；手工模拟 merge 落普通 commit 不在此例。
- 永远别 `git commit --no-verify`。

Worktree（pacman 是多 lane 设计，所以特别强调）：
- **建 worktree 必须绝对路径**。`git worktree add /Users/xmon/Code/AgentProjects/pacman/.claude/worktrees/<name>`。相对路径 + cwd 漂移（heredoc / cd 改变 cwd 后）会把 worktree 嵌进 `apps/web/src/.claude/worktrees/`，vite watcher 撞上去触发 reload 风暴拖死 dev server。
- 切 lane 时从 `origin/main` 切（本地 main 常落后）；PR 合并顺序撞上，GitHub 报 CLEAN 才合，冲突 rebase 重验。
- **半场交接必 commit**（M7 实战踩坑）：同一 worktree 换施工者（主线↔lane 或 lane↔lane）前，把手头改动 commit 落盘——未 commit 的解法会被下一手的 merge --abort / merge 尝试现场覆盖，对象不可恢复（05 册 M7 合并期 #309 位实测丢失一轮 drizzle 解法）。
- **drizzle migration 撞号纪律**：并发票都加表时序号必撞。序号永远以**合并时点** main 的尾部为准，lane 施工期不占固定号（票面不写死序号），合并期冲突时重编到 main 尾部+1。

Git 拦截（autoresearch / pre-commit 共识）：
- `git reset --hard` / `git checkout .` / `git clean -fd` / `git stash` ——**别跑**，会砸 lane 同事的活。
- `git branch -D` / `git restore` 在 autoresearch loop 内会被 hook 拦——绕法：`git branch -d` / `git worktree remove --force`。
- 永远别 `--force push`。

## Issues and PRs

仓库只有 origin（xiechimon/pacman），裸 `gh` 命令解析正确；显式 `-R xiechimon/pacman` 写法仍可用：
- `gh issue list -R xiechimon/pacman`
- `gh pr view 149 -R xiechimon/pacman`
- `gh repo view` 不支持 `-R`——用位置参数：`gh repo view xiechimon/pacman`

Worktree 车道开 PR：
```sh
gh pr create --repo xiechimon/pacman --head xiechimon:<branch>
```
裸 `--head <branch>` 曾在双 remote 时期报 `Head sha can't be blank`（worktree + 多 remote 下 head ref 解析走偏）；现单 remote 未复验，继续用全限定写法最稳。已误开裸 body 的 PR 用 `gh pr edit <n> --title --body-file /tmp/pr.md` 补全。

PR body / 长 issue 评论：**写临时文件再 `--body-file`**，不内联 `--body` 多行 markdown。

## User Override

本文件规则在用户指令冲突时可覆写——但**必须先得到用户显式确认**（"我同意打破 No X 规则，因为 Y"），再执行。仅执行确认过的部分。
