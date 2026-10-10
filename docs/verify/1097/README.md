# #1097 项目 Files 面目录下钻 — 验证证据

probe:`.claude/skills/verify-pacman/scripts/drive-1097-folder-drill.mjs`(live 栈,零 daemon 零 LLM)。
栈坐标见 `result.json` 的 `stack` 段(server 8791 / web 5273 / scratch PACMAN_HOME)。
**20/20 PASS**(hosted 与 local 双形态,2026-10-10)。

fixture 面与 stub 面回归 = `apps/web/e2e/project-files-tree.spec.ts`(W1-W7 七条,
stubBoot 钉 web 半边)+ `apps/web/e2e/file-viewer.spec.ts` / `project-files-local.spec.ts`
(既有零回归);服务端路由透传 = `apps/server/test/project-local.test.ts`
「tree 路由 path 参数透传(#1097)」P1-P5 五条。

## 判读

| 文件 | 内容 |
|---|---|
| `result.json` | 20 条 checks 逐条 ok/label + 截图清单 + 栈坐标 |
| `responses.json` | REST 真值:hosted/local 项目创建、API key、tree 顶层/?path=docs/?path=docs/guide、file?path=docs/README.md、SQLite project 行 |
| `H1-hosted-top-level.png` | hosted 顶层:docs/guide 文件夹行(Folder 字形)+ README.md 文件行(FileTab 字形) |
| `H2-hosted-docs-drill.png` | 下钻 docs:面包屑「根目录 › docs」(当前段回显)+ 该层三行 |
| `H3-hosted-docs-readme-viewer.png` | docs/README.md → 查看器出 docs 标记内容(同名不串) |
| `H4-hosted-samename-no-cross.png` | 回根后根 README.md 不顶替选中态,预览仍 docs 内容 |
| `H5-hosted-deep-breadcrumb.png` | 3 层下钻 deep.md + 面包屑「根目录 › docs › guide」 |
| `L1-local-top-level.png` | local 形态顶层:chip=HEAD + 文件夹行 |
| `L2-local-drill-viewer.png` | local 下钻 docs → setup.md → 查看器标记内容 |

## 复跑

```sh
node .claude/skills/verify-pacman/scripts/launch.mjs   # worktree 车道加 VERIFY_REPO_ROOT
node .claude/skills/verify-pacman/scripts/doctor.mjs
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  node .claude/skills/verify-pacman/scripts/drive-1097-folder-drill.mjs
node .claude/skills/verify-pacman/scripts/cleanup.mjs
```

空目录/切目录加载态不在 live 面演(git 不跟踪空目录,live 造不出真空目录):
定义态由 e2e W5/W6 + server vitest P5 钉住。
