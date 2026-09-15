---
labels: [wayfinder:task]
status: closed
owner: claude
blockedBy: [01, 02, 03, 04, 05, 06, 08]
---

# 07 · 产出 spec 与施工票

## Question

地图的 destination 本身：把 ticket 01–06 的决策汇总成 `.scratch/craft-fork/spec.md` + 按依赖排序的施工票列表（含每票的完成条件）。

spec 骨架（按决策展开，不重新决策）：

1. 背景与目标（fork 自 craft-agents-oss v0.13.3，自用桌面 agent）
2. 环境前提（ticket 03 事实）
3. 仓库手术（压缩导入 + vendor 分支 + mini-pi tag 封存）
4. 裁剪清单（ticket 01 的四类触点）
5. 换皮方案（ticket 04）
6. 子系统启用矩阵（ticket 06 + 全留清单）
7. v0.1 验收标准（ticket 05）
8. 施工票（含 bun 安装为第 0 步）

人工汇总，HITL 过稿。完成 = spec.md 落盘且用户确认。

## Answer

spec 已落盘并过稿：`.scratch/craft-fork/spec.md`（2026-09-15 用户确认）。含 26 条 user story、两条测试缝（grep 审计脚本 + v0.1 人工验收跑）、8 张施工票 B0–B7。裁剪/换皮以 01 票触点清单为唯一事实源。
