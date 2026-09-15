---
labels: [build, ready-for-agent]
status: done
blockedBy: []
---

# B0 · 仓库手术

把 pacman 仓换成 pacman 产品的代码线。

- [x] mini-pi v2 历史打 tag 封存（`archive/mini-pi-v2` → `c0d91e0`）
- [x] 上游 v0.13.3 压缩导入 main（`32c85af`，2017 文件单一根提交）
- [x] 上游全量历史进 `vendor/upstream` 只读分支（105 提交）
- [x] LICENSE、版权声明保留，README 注明出处（Apache-2.0）
- [x] `.gitignore` 合并上游规则 + 本仓 `.claude/`、`.codegraph/`

**完成条件**：main 从导入提交起算 ✓；`git log vendor/upstream` 可见上游全史 ✓；LICENSE 在 ✓。

## Answer

2026-09-15 执行完毕。

- `archive/mini-pi-v2` → `c0d91e0`，已核验覆盖 `origin/main` 全部提交
- main = `32c85af` 单一根提交（431,018 行导入）
- `vendor/upstream` = 上游 v0.13.3 及 105 个提交全史
- 新增 `upstream` remote 指向上游 GitHub
- 导入树与 `vendor/upstream` 逐字节一致，仅 4 处有意差异：`.gitignore`（追加本仓规则）、`README.md`（顶部标注 fork 出处）、`CONTEXT.md` + `.scratch/`（规划产物）

**下一步阻塞解除**：B2、B3、B5 可开工。
