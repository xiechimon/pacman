# #947 secondary 域施工 — 验证证据

票：#947（#908 波 2 · secondary 域）。本目录 = 验收七项中「探针重钉」「better-colors 实测」「verify-pacman 证据归档」三项的实物，外加验收 1 的本地全量日志与验收 5/7 的编译产物机制 grep。

## 目录

| 路径 | 内容 | 对应验收项 |
| --- | --- | --- |
| `probe-dump/probe-comparison.md` | #921 工具对照表（18 spec 选集、184 视觉行）：**KEPT 184 / DRIFT 0 / VIOLATION 0 / NOT-RUN 0**——等值迁移，几何零漂移 | 2 |
| `probe-dump/probe-dump.json` | 结构化全量 dump（sites/values/rows） | 2 |
| `contrast-947.md` | better-colors 双模 28 对实测表（渲染对 + token 解析对，WCAG 2.x 公式）：门控对 **0 未过**；含实测抓出并修掉的五处 `--text-dim` 消费面配对（换槽 `--text-tertiary`，#908 裁决 2 授权，token 值零改动）与 Switch 冻结件的 §4-1 观察项记录 | 3 |
| `live-stack/drive-947-secondary/` | 定制探针（`drive-947-secondary.mjs`，随本 PR 进 `.claude/skills/verify-pacman/scripts/`）：A 几何 8 项（壳头 44 / back 28 / 版心 766 / 卡 76+radius-popover 12 / FAB 48 / chart 节点 220×56 圆角 8 / 连接线 44×1 / 括号 28）+ B 件槽 2 项 + C 交互真路径 13 项（布局往返 / 弹窗家族律 / 语言盘选择即关+双键持久 / 推送开关 denied 落定 / **API 密钥 live 全链**：空态 → 弹窗 → 授予全部·清空 104 枚权限位 → 创建 → 一次性明文块 + 掩码行）+ D 机制 1 项（37 个退役选择器样式表零规则）+ E 对比度双模 2 项 = **26 checks 全 PASS，failures 0**；截图 02–10（团队 grid/chart、帐号、语言盘、密钥空态/弹窗/已建屏，双主题）+ `result.json` + `contrast.json` | 3、4 |
| `local-full-e2e.log` | 验收 1「合并前本地全量一次」实物：终版代码全量 e2e（E2E_PORT=8400）**809 passed (2.1m)、0 failed** 全日志 | 1 |
| `build-artifact-grep.txt` | 编译产物机制实物：`vite build --mode fixture` 的 dist CSS 上 grep——37 个退役选择器 **0 命中**、`.secondary-main` 仅剩 chief.css dock portal 复合规则（#950 域合法残留）、8 个新 utility 载体在场 | 4、5、7 |

## 复现

```sh
# 探针对照表（#921 工具；直接调 node——pnpm 会把 `--` 原样转发撞 unknown flag）
cd apps/web
node e2e/probe-dump.mjs --specs account-team-cleanse team-org-chart \
  team-create-agent title-band-clicks agent-delete agent-create-model \
  avatar-dicebear agent-detail dialog-viewport dead-buttons chief-fab \
  chief-panel chief-drawer-model hotkeys shell-consistency \
  segmented-controls agent-identity-chip github-issue-writeback \
  --out ../../docs/verify/947/probe-dump

# live 栈（8791/5273 被邻道占则顺延，见 skill 端口纪律；本车道用 8795/5277）
VERIFY_REPO_ROOT=<worktree> VERIFY_PORT=8795 VERIFY_WEB_PORT=5277 \
  node .claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=<worktree> VERIFY_EVIDENCE_DIR=<worktree>/docs/verify/947/live-stack/drive-947-secondary \
  node .claude/skills/verify-pacman/scripts/drive-947-secondary.mjs
VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/cleanup.mjs
```

注意：drive 的 C5 链会真建一把 API 密钥（live 全链取证）——**重跑前先 cleanup + launch 换新库**，否则空态起点不在。

## 口径备注

- 对比度 floor：文本 4.5、非文本 UI 3.0（better-accessibility）；正典 §1.7/1.8 门控对之外的**消费面自造配对**按本 floor 实测（五处 dim 换槽即此类，修法是换消费面槽引用，token 值零改动）。Switch OFF 态 track/thumb 是 §1.5 封版冻结件皮肤 + §4-1 记录在案的观察项，不门控、不域内私改。
- `color(srgb …)` 序列化坑（#921 工具记录）：`--spot-soft` 这类 color-mix 槽的 computed 值按 0–1 浮点折算回 rgb 再算比值（chart-crown 亮模 4.95 即折算后值；不折算会误读成近黑假红）。
- D1 机制扫描的合法排除与 drive-943 同款：chief.css 的 `.secondary-main > [data-base-ui-portal]` dock 复合规则（规则住址 chief.css = #950 域；`.secondary-main`/`.secondary-main-col` 是运行时钩子，零规则存活，spec/22 §5.0 残留律）与 Tailwind arbitrary-variant 编译产物选择器（`.\[...` 转义形）。
- probe-dump 选集 18 spec = 本域 9 条（agents/teams/account 组）+ 重钉触到的跨域 9 条（title-band / dead-buttons / dialog-viewport / chief 三件 / hotkeys / shell-consistency / segmented-controls）；跑批时 playwright 名称过滤另捎上 project-settings-dead-buttons（子串命中），229 用例全绿。
