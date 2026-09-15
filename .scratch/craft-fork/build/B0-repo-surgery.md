---
labels: [build, ready-for-agent]
status: done
blockedBy: []
---

# B0 · 仓库手术

把 pacman 仓换成 pacman 产品的代码线。

- [x] 上游 v0.13.3 压缩导入 main（`32c85af`，2017 文件单一根提交）
- [x] LICENSE、版权声明保留，README 注明出处（Apache-2.0）
- [x] `.gitignore` 合并上游规则 + 本仓 `.claude/`、`.codegraph/`
- [x] 删除上游治理文档（CODE_OF_CONDUCT、CONTRIBUTING），README 开发节本地化
- [x] main 接入 origin/mini-pi 旧历史（113 mini-pi 提交 + 1 清空提交），push 无需 force
- [x] 删除 `vendor/upstream`、`mini-pi`、`archive/mini-pi-v2`，靠 `upstream` remote + GitHub 源访问上游全史

**完成条件**：main 起算 ✓；LICENSE 在 ✓；远程与本地只剩 main 一条线 ✓。

## Answer

2026-09-15 执行完毕。

- main = `b5433c6`，118 提交（mini-pi 旧史 113 + 清空 1 + pacman 新增 4）
- `upstream` remote 指向上游 GitHub（要 diff 时 `git fetch upstream` 即可）
- 导入树与上游逐字节一致，仅 4 处有意差异：`.gitignore`（追加本仓规则）、`README.md`（顶部标注 fork 出处）、`CONTEXT.md` + `.scratch/`（规划产物）

**下一步阻塞解除**：B2、B3、B5 可开工。
