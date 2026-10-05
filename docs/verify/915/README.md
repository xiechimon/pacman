# #915 验证证据索引 — 新色板 token 值翻转与明暗双模封版（C · 纸兰定版）

值正本：`library/t-0909/src/themes/c.css` @ `7340d0ab`，经 `docs/spec/22-色彩与几何token-scale正本表.md`（#912）逐槽映射。
翻值面：`apps/web/src/styles/shadcn.css`（色槽 + `--radius`）+ `apps/web/src/styles/tokens.css`（半径/投影/drop-tint/新增密度几何 token）。
live 栈坐标：server `127.0.0.1:8795` + vite dev `127.0.0.1:5277`，独立 `PACMAN_HOME` scratch（8791/5273 被他车道占用，顺延；用户 8787/5173 真栈全程未触碰）。

## 1. 对比度验收复测（票面判据：contrast.md C 段实测表复测，不许估）

| 文件 | 说明 |
| --- | --- |
| `contrast-recheck.mjs` | 对账器：复测快照 × `library/t-0909/reports/contrast.md` § C 段逐对比对（±0.005） |
| `contrast-recheck.md` | 对账结果：**C 段 64/64 对一致，0 不一致；双模门控 FAIL 0**（dark 门控 90 对最低 1.56:1 发丝线档 / light 90 对最低 1.52:1，text/ui 门控最低 dark 3.46:1 / light 3.05:1，与 spec/22 §1.2 一致） |
| `token-scale-912-postflip.json` | 复测器快照：翻值后重跑 `library/t-0909/scripts/measure-912.mjs`（解析 live shadcn.css/tokens.css，WCAG 2.1 逐对实测）的完整产物 |
| `token-scale-912-flip.diff` | 同一 json 翻值前（#912 提交态）→ 翻值后的 git diff：currentValues 逐槽 old→new，即本次翻转的机器可读账本 |

复测 digest（measure-912.mjs 实跑输出）：

```
dark: slots flip=0 new=0 retired=0 unchanged=109 | pairs=111 PASS=90 FAIL=0 report-only=21 | min gated ratio 3.46:1 (menu-icon)
light: slots flip=0 new=0 retired=0 unchanged=109 | pairs=111 PASS=90 FAIL=0 report-only=21 | min gated ratio 3.05:1 (ring)
```

`flip=0` = 翻值后 live 文件的每个色槽解析值与 c.css 定版值逐项一致（0 新增 0 退役，spec/22 §1.1 的 1:1 契约）。

## 2. 机制生效实物判据（编译产物 CSS）

| 文件 | 说明 |
| --- | --- |
| `built-css-mechanism.txt` | fixture 构建产物 `apps/web/dist/assets/index-CTcGtmwk.css` 的 grep 账：定版新值全命中（含 minifier 形态 `.875rem`、8 位 hex alpha `#d89cfc0d/1a`），旧色板值（`cba6f7`/`8839ef`/`e05a5a`/`c73e3e`/`0.625rem` 等）残值全 0 |

## 3. e2e 值探针重钉（#921 probe-dump 工具，#910 口径）

| 文件 | 说明 |
| --- | --- |
| `probe-dump/probe-comparison.md` | 翻值后全量跑（104 spec）的对照表：**786 视觉行 = KEPT 745 / DRIFT 26 / NOT-RUN 15 / VIOLATION 0**。26 条 DRIFT 全部人审归类为色板翻转预期漂移（旧钉扎值 = 旧色板），逐条重钉到 new measured；无一条判为回归 |
| `probe-dump/probe-dump.json` | 结构化 dump（sites/values/rows 全量） |

重钉落点（6 文件，值取对照表 new measured 列）：`accent-typo.spec.ts`（focus-ring/destructive/card-button/text-on-accent/destructive-foreground 双模）、`overlay-focus.spec.ts`（RING）、`project-new-repo.spec.ts`（FOCUS_RING/DANGER）、`segmented-controls.spec.ts`（HOVER/CHIP/GROUP 六常量）、`sidebar-nav.spec.ts`（sidebar-hover/active 暖白梯）、`spec-brief-card.spec.ts`（surface-secondary/border-default 暗侧）。

重钉后实跑：7 个受影响 spec **76/76 PASS**（E2E_PORT 8398，18.2s）；全量 **809/809 PASS**（2.0m）。翻值基线轮（probe-dump 采集轮）779 passed / 27 failed——27 条失败 = 26 条钉扎漂移 + 1 条 token-gate beforeAll 起栈超时（基础设施抖动，重钉轮同 spec 4/4 通过）。

## 4. 明暗双模运行时证据（live 栈真用户路径）

| 文件 | 说明 |
| --- | --- |
| `drive-915-themes.mjs` | 定制 probe：建任务（真 UI 路径）→ dark/light 各拍 board / new-task dialog / detail 三面 → 运行时断言 token computed 值 = c.css 定版值 |
| `live-run/result.json` | **48/48 checks PASS**。断言面：双模各 20 项字面槽（含 `.light` 新增 override `--project-avatar-bg/fg`、亮侧 `--surface-tertiary` 与 secondary 分档）、`--spot-soft` color-mix 实解析（暗 rgb(62,51,60) / 亮 rgb(223,207,217)，`color(srgb …)` 分数序列化按 #921 已知坑折算）、`rounded-lg` 运行时实测 = 14px（--radius 0.875rem 乘数族）、几何/投影新 token（`--pad-card` 16px / `--row-h` 40px / `--plate-shadow` 亮侧软 blur 档）、主题挂载（html.light class）、API 真值（GET /api/todos 命中） |
| `live-run/01-board-{dark,light}.png` | 工作台双面（1440×732，与 e2e 同口径） |
| `live-run/02-dialog-{dark,light}.png` | 新建任务 dialog 双面（dialog-shadow / scrim 面） |
| `live-run/03-detail-{dark,light}.png` | 详情页双面（chip 族 / surface 层次面） |
| `live-run/api-todos.json` | GET /api/todos 真值行 |

## 5. 施工期裁决记录（与 spec/22 §4.2 的时序偏离）

`--toggle-track`/`--toggle-knob` 两槽 spec/22 §4.2 写「#915 翻值时删除」，但其前提「消费点已孤儿化」当前为假——三处活消费点实测：`apps/web/src/detail/overlays.css:197,216`（.dlg-toggle，branch-dialog.tsx:176 在用）、`apps/web/src/secondary/secondary.css:537`（.account-switch-knob）。消费面迁移属波 2 #947（secondary）与波 3 #951（detail-b），删槽会让施工期活 UI 的 toggle 轨道/圆点失去持值。且 #915 票面施工边界明文「只翻槽里的值，槽架构不动」。处置：两槽按 §1.7/§1.8 表翻新值保槽（measure-912 状态位 retire-candidate），删槽移交消费面迁移票执行。
