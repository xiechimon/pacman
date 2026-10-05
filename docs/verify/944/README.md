# #944 verify evidence — resources domain retirement

域施工票 #944（#908 波 1）的验收证据。施工内容：`apps/web/src/resources/resources.css`
（806 行 per-face CSS）删除、本域 17 处裸控件收编 components/ui 件、老 ui/ 原语消费
（I1 provider ×6 / I3 skill-dialog 摘类）按 spec/22 §5.3 退役、`.dlg-form*` /
`.dlg-provider-*` / `.dlg-enroll*` 族按 §5.4 处置、本域 spec 按 #910 两级制重钉。

取数正典：docs/spec/22（§1.7/1.8 槽表、§2 几何、§3 载体规约、§5 退役正典表）；
钉扎口径 = #910 决议；探针工具 = `pnpm --filter @pacman/web probe:dump`（#921）。

## 目录

| 路径 | 内容 |
| --- | --- |
| `probe-dump/probe-comparison.md` | #921 探针 dump 对照表（旧基线 → 新实测）：**241 视觉行全 KEPT，DRIFT 0 / VIOLATION 0 / NOT-RUN 0**（验收 2） |
| `probe-dump/probe-dump.json` | 同次 dump 的结构化全量（站点 + 记录 + 行） |
| `contrast.md` | better-colors 本域实测对照表（152 测量，双主题；验收 3） |
| `contrast-light.json` / `contrast-dark.json` | 同次实测原始记录（含 fg/bg 合成值与阈值） |
| `scripts/probe-944-contrast.mjs` | 对比度探针（canvas 归一化 + 祖先背景栈合成；oklab/color(srgb)/alpha 层均实测不估） |
| `scripts/shots-944.mjs` | before/after 截图探针（`--dom old|new` 切载体集，同一脚本跑两栈） |
| `before/*.png` | origin/main 一次性 worktree 栈（fixture preview :8401）截图，旧 DOM 载体 |
| `after/*.png` | 本分支 fixture preview 栈截图，新载体 |
| `live/` | verify-pacman 隔离 live 栈（launch.mjs）真用户路径驱动结果 + 截图 |

## 读法

- **before/after 对照**：同名文件逐对看。等值迁移面（shell/行卡/空态/机器行/mcp 行/
  密钥空态）应零像素差；D2 吸收面 = 控件几何（input 36→32、seg 30→32 换 Tabs
  registry 几何、圆角随 --radius 翻值族）与 brand 按钮 hover 态——这些差是正典授权
  的有意结果，probe-dump 的 KEPT 表证明钉扎面数值未漂。
- **contrast.md 的 FAIL 行**：全部是 #944 之前就存在的 sealed 色板对（--text-dim 小字
  骑 surface-secondary/surface、品牌 mark 亮模），等值迁移未引入新对；处置 = 报告给
  视觉方向线（#909/#915 族），不在域票内重涂（better-colors report-not-repaint）。
  表内「Findings & disposition」节逐条给出处与候选处置。
- **live/**：verify-pacman 纪律的 live 全链证据（fixture 面回归走 apps/web e2e，
  live 面证明真 server/SQLite 路径未破）。

## 复现

```sh
# 探针对照表（fixture 栈自建，端口自选）
pnpm --filter @pacman/web probe:dump --specs skills-page skills-write \
  provider-add-dialog provider-oauth providers-tabs secret-add-dialog \
  machine-add-dialog machines-chief-state machines-local machines-shell-switch \
  dialog-viewport dead-buttons accent-typo title-band-clicks shell-consistency \
  chief-panel sidebar-seam checkbox-unified agent-detail \
  --port 8400 --out ../../docs/verify/944/probe-dump

# 对比度实测（需 fixture preview 在 BASE 上）
node docs/verify/944/scripts/probe-944-contrast.mjs

# before/after 截图（before 栈 = origin/main 一次性 worktree + fixture preview）
node docs/verify/944/scripts/shots-944.mjs --base <before-url> --dom old --out docs/verify/944/before
node docs/verify/944/scripts/shots-944.mjs --base <after-url>  --dom new --out docs/verify/944/after
```
