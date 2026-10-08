# #1030 local 项目 Files tab 开闸——验证证据

- ticket: https://github.com/xiechimon/pacman/issues/1030
- probe: `scripts/drive-1030-local-files.mjs`（verify-pacman 定制探针，live 栈 + Playwright 真用户路径）
- 栈坐标: server `127.0.0.1:8791` + vite dev `127.0.0.1:5273` + 独立 `PACMAN_HOME` scratch（launch.mjs 全新库，seed 用户 Owner）
- 运行日期: 2026-10-08
- 结果: **20/20 PASS**（逐条对齐 `result.json` 的 checks 计数）

## 复跑配方

```sh
corepack pnpm install
VERIFY_REPO_ROOT=$PWD node .claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=$PWD env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  node .claude/skills/verify-pacman/scripts/drive-1030-local-files.mjs
node .claude/skills/verify-pacman/scripts/cleanup.mjs
```

回环请求必须 unset proxy env（过代理 = 502 假阳性）。

## 三相位覆盖

| 相位 | 断言面 | 截图 |
|---|---|---|
| A local 可读 | REST 五读面（tree=HEAD/branches=trunk/commits/file/files）+ 浏览器 Files tab 开闸、分支 chip=HEAD 回显、文件行→查看器内容、历史 seg 提交行。仓默认分支钉 `trunk`（非 main）——钉「local 默认分支任意，web 不硬编码 ref」的根因面 | A1/A2/A3 |
| B hosted 对照 | push 真 README 后同页面链路（chip=main、行+内容），零回归 | B1 |
| C 不可达降级 | 删仓目录 → reload 出「本地仓库当前无法读取。」+ reason 分译「路径不存在」；FilesPane 不渲染（不空树、无历史假面）；API 侧 tree → 404 + reason=not_found | C1 |

`responses.json` = REST 五读面 JSON（可达 + 不可达双态）+ SQLite project 行（repoKind/localPath 落库）。

## 同票其它验证面

- server vitest: `apps/server/test/project-local.test.ts`「local 项目读面——Files tab 开闸（#1030）」F1–F4（可达真值/删目录 404+not_found/非 git 目录 404+not_git/localPath 列空 404 显式红），24/24；hosted 回归 `git-hosting.test.ts` 10/10。
- web e2e（fixture 面）: `apps/web/e2e/project-files-local.spec.ts` 4/4（退役旧 `project-files-local-disabled.spec.ts` 钉子）；受影响面全量 e2e 819/819。
