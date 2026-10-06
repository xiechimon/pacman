# #945 verify evidence — detail-a 域施工

域施工票 #945（#908 波 2）的验收证据。施工内容：`apps/web/src/detail/detail.css`
（2147 行，全库最大 per-face CSS 文件）删除清零、本域裸控件与 chip 消费 shadcn 化
（StatusChip / Button / Textarea / Tabs / Checkbox 残余项声明见 PR）、钉 detail.css
面的 spec 按 #910 决议重钉（17 个 spec 文件）、`--text-dim` 消费面按 #908 裁决 2
换槽 `--text-tertiary`（token 值冻结不动；#946/#947「dim 消费面同律」判例）。
`detail/overlays.css` 属 detail-b 票，本票未动。

取数正典：docs/spec/22（§1.7/1.8 槽表、§2 几何、§3 载体规约、§5.0–§5.6 退役正典表）；
钉扎口径 = #910 决议五裁定；探针工具 = `pnpm --filter @pacman/web probe:dump`（#921）。

## 目录

| 路径 | 内容 |
| --- | --- |
| `probe-dump/probe-comparison.md` | #921 探针对照表（旧基线 → 新实测，17 个重钉 spec / 135 passed）：**182 视觉行全 KEPT，DRIFT 0 / VIOLATION 0 / NOT-RUN 0**（验收 2） |
| `probe-dump/probe-dump.json` / `probe-records.ndjson` / `probe-run.log` | 同次 dump 的结构化全量（站点 + 记录 + playwright 运行日志） |
| `contrast-945.md` | better-colors 本域实测对照表（41 对 × 双主题 = 82 行，**FAIL 0**；floor 口径 #943 判例）（验收 3） |
| `contrast-945.json` | 同次实测原始记录（fg/bg 合成值 + ratio） |
| `measure/diff-report.txt` | 迁移保真 diff（before/after 全量 computed-style + geometry 采集比对）：**DRIFT 0 · ALLOWED 165 · skipped-internal 1858** |
| `before/*.png` | 基线栈截图（origin/main @ 034bf7d5 一次性 worktree `/tmp/945-before-main` + fixture preview :8403，旧 DOM 载体，双主题 32 张） |
| `after/*.png` | 本分支 fixture preview（:8402）截图（新载体 + 换槽终态，双主题 32 张） |
| `live/` | verify-pacman 隔离 live 栈（launch.mjs :8792/:5274 + stub LLM :8919 门控轮 + 真 daemon enroll）真用户路径驱动：**32 checks 0 failures** + 截图 5 张 + `result.json` / `contrast.json` |
| `local-full-e2e.log` | 换槽终态全量 e2e（`e2e:affected` 因共享面 live-row 回落全量）：**809 passed (1.8m)** |
| `build-artifact-grep.txt` | 退役 per-face 选择器 × CSS 构建产物 grep 实证（20 选择器零规则；`.dlg-form-foot/actions` 各 1 处 = `ui/dialog.css` 共享原语层，他域消费，非本票账） |
| `scripts/shots-945.mjs` | before/after 截图探针（同一脚本跑两栈，双主题） |
| `scripts/measure-945.mjs` | 全量 computed-style + geometry 采集（视觉属性白名单见 diff 脚本头注） |
| `scripts/diff-945.mjs` | before/after 比对闸（DRIFT 0 门槛；D2 授权链 / TW 序列化 / DIM_SWAP 值对豁免全部机械判定） |
| `scripts/contrast-945.mjs` | 渲染对比度实测（祖先背景栈合成，双主题，WCAG 2.x 相对亮度） |
| `scripts/seed-945-live.mjs` | live 栈 seed（provider/agent/api-key/project/todo；`SEED_API` 覆写端口） |
| `../../../.claude/skills/verify-pacman/scripts/drive-945-detail.mjs` | live 驱动脚本（随 skill 入库；A 静态 live 面 / B 运行中面 / C live 对比度） |

大文件说明：measure 的原始 JSON 采集（每主题 ~3MB × before/after）不入库，
落 `/tmp/945-measure-{before,after}/measure-{light,dark}.json`；入库的是比对
结论 `measure/diff-report.txt`（含全部 ALLOWED 行，人审记录）。

## 读法

- **before/after 对照**：同名文件逐对看。等值迁移面（壳/头带/transcript 行族/
  diff 面/composer 静态面/fresh 面）应零像素差。两类有意差：① D2 授权面 =
  chip 18→20px 档及其后果链；② 裁决 2 换槽面 = 安静档墨 `--text-dim` →
  `--text-tertiary`（light 模 dim 在 surface/surface-secondary/seg-active 实测
  2.4–2.89，低于槽地板 3——canon 门控对是 dim × background；#946/#947 已同律
  换槽）。逐面实测数字见 `contrast-945.md`。
- **diff-report 的 ALLOWED 165 构成**：72 条换槽值对（color/outline-color ×
  双主题，DIM_SWAP 精确值对豁免——只放行 dim→tertiary 四个值对，其余颜色漂移
  照常 DRIFT）+ D2 chip 链 + TW v4 序列化族（shadow 合成 4 占位层 /
  rounded-full=calc(infinity*1px) / transition 简写展开 / rotate 独立属性）+
  #949 跨车道 chevron 载体退役（`.detail-chip-chevron` → testid，nullOk）。
- **live/**：`01-detail-live.png` 基础面（StatusChip data-tone=plan 载体）、
  `02-composer-draft.png` 真 textarea + send 翻品牌实底、`03-chip-popover.png`
  role=dialog 开合、`04-user-menu-live.png` floating 形态、
  `05-live-row-button.png` 运行中披露钮（#885 24px 命中盒 + 2px 负 margin 律，
  fixture 盖不住的 button 形态）+ 停止钮在场。

## 复现

```sh
# fixture 面（本 worktree；8402 preview 自建，代理 env 全 unset + NO_PROXY）
pnpm --filter @pacman/web exec vite build --mode fixture
node docs/verify/945/scripts/shots-945.mjs   --base http://localhost:8402 --out docs/verify/945/after
node docs/verify/945/scripts/measure-945.mjs --base http://localhost:8402 --out /tmp/945-measure-after
node docs/verify/945/scripts/diff-945.mjs --before /tmp/945-measure-before --after /tmp/945-measure-after
node docs/verify/945/scripts/contrast-945.mjs --base http://localhost:8402 --out docs/verify/945
pnpm --filter @pacman/web probe:dump --specs branch-button chat-md-toolout \
  chat-tools-identity chat-type-measure composer-inline-mention composer-paste \
  composer-slash composer-wire-reject detail-3pane detail-esc detail-narrow \
  dialog-viewport diff-full-file plan-diff-full-file segmented-controls \
  spinner-live transcript-user-words --port 8400 --out ../../docs/verify/945/probe-dump

# before 基线（origin/main @ 034bf7d5 一次性 worktree + fixture preview :8403）
git worktree add /tmp/945-before-main 034bf7d5
# …install + build + preview 后：
node docs/verify/945/scripts/measure-945.mjs --base http://localhost:8403 --out /tmp/945-measure-before

# live 面（stop-button.md seed 配方；默认口被邻道占 → VERIFY_PORT/VERIFY_WEB_PORT 换 8792/5274）
VERIFY_PORT=8792 VERIFY_WEB_PORT=5274 node .claude/skills/verify-pacman/scripts/launch.mjs
node .claude/skills/verify-pacman/scripts/doctor.mjs          # all PASS
STUB_PORT=8919 node .claude/skills/verify-pacman/scripts/stub-llm-verify.mjs &
node docs/verify/945/scripts/seed-945-live.mjs                # → /tmp/945-seed.json
# daemon（PACMAN_HOME 指 /tmp scratch，proxy env 全 unset）→ 等 machines online:true
# POST /api/projects/{p}/builds {todoIds,assignment,withPlan:true} 起 build → phase=planning
RUNNING_ID=<todoId> VERIFY_EVIDENCE_DIR=docs/verify/945/live \
  node .claude/skills/verify-pacman/scripts/drive-945-detail.mjs
# 收尾：杀自起 daemon/stub → cleanup.mjs
```
