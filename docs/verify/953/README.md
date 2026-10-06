# #953 sealed 封版证据（#908 波 4 终点票）

封版树 = 本 PR 分支（基线 main `90169aa8`）。全部判据机器可判；本目录即 #913 验收模板 v2 的封版形态（②探针对照表 + ③对比度实测 + ④本证据归档 + ⑤⑥⑦终态核账与豁免声明）。

## 目录

| 路径 | 内容 |
| --- | --- |
| `audit-terminal-state.py` / `.txt` | 票面第 4 项终态核账：可复跑脚本（`python3 docs/verify/953/audit-terminal-state.py`，rc=0 全过）+ 本次输出 |
| `probe-sealed/probe-comparison.md` + `probe-dump.json` | 封版 probe-dump 全量对照表（104 spec，run @ commit `93d979f2`，port 8397，tests 811 passed / 0 failed；#921 工具，#910 裁定 5 口径）：**805 行 — KEPT 805 / DRIFT 0 / VIOLATION 0 / NOT-RUN 0 / other 0** |
| `measure-sealed/token-scale-912*.{json,md}` | 封版树色面复跑（迁移后的 `apps/web/e2e/measure-912.mjs`）：双模 flip=0 / new=0 / retired=2 / unchanged=109，AA 门控 0 未过（dark min 3.46 / light min 3.05） |
| `live/` | verify-pacman live 栈证据：四面双模截图抽样（board / 新建任务 dialog / detail / resources）+ `result.json`（16/16 PASS）+ ROW_SELECTED 裁决前后对比 |
| `908-destination-check.md` | #908 destination 逐句核对 + 未竟面清单（关图建议随附） |

## 全量运行账（封版复跑，caffeinate 防睡眠）

- e2e 全量：104 spec，**811/811 全过（1.8m）**（E2E_PORT=8398，fixture 栈，caffeinate 防睡眠）
- vitest：192 文件 / 2083 条全过；integration：21 文件 / 60 条全过；`pnpm -r typecheck`、`biome ci` 全绿
- 闸：ui-debt-gate（含 `--base` D3）/ ui-drift-gate / css-mechanism-gate 全 PASS

### 睡眠假红判例（首轮全量 5 红的处置记录）

首轮全量 e2e 5 failed / 806 passed：attachment-strip 图像预览、machine-add-dialog 与 team-create-agent 的 family law、shell-consistency team 路由、team-org-chart 皇冠徽标。判为机器睡眠附带损伤而非回归，判据三条：① 三条失败耗时 14.6–14.7 分钟 = 测试超时冻结形；② 失败现场是「退场过渡冻在 `data-ending-style`」「5s 内页面未 boot」等挂起签名，与本轮改动面（sidebar 死档摘除、probe-dump argv、docs）零交集；③ **同树重跑该 5 spec 全绿（38/38，11.4s）**，随后全量复跑绿。与既有记忆「CI check 会 flake——判据 = 重跑同 sha」同律。

## ROW_SELECTED 终账裁决（#908 comment-6001887439 观察 2）

**裁决：摘除编译序恒败的 `text-foreground` 死档；`--selected` 别名状态类按 spec/22 §5.0 原位保留。**

- 事实：`ROW_SELECTED` 的 `text-foreground` 与 `ROW_BASE` 的 `text-muted-foreground` 在无 tailwind-merge 的模板串里共存，编译序恒让 muted 胜——选中行墨自 #414 以来即 muted，选择信号由 pill 底承担（#943 实测在案：`docs/verify/943/contrast-943.md`，5.88/9.26）。
- 执行：摘除死档使载体与渲染真值一致，并消除「编译序若翻转则视觉静默变化」的潜在不稳定性。
- 实物验证（`live/row-selected-ruling.json`）：摘除前后双模逐字节一致——fg `rgb(179,175,168)`/`rgb(53,49,42)`、pill `rgba(255,252,248,0.1)`/`rgba(28,25,20,0.1)`、合成衬底对比 5.88/9.26（#943 数值复现）、跨域对比度 7 对双模全过；`renderIdentical: true`。
- 别名状态类（`.sidebar-row--selected`/`.sidebar-subrow--selected`/`.sidebar-team-row--active`）不摘：§5.0 别名残留律 + #943 对 team-row 的同款先例；spec 一律钉 `aria-current="page"`。live A1 审计钉「DOM 存活、CSS 零规则」。

## 裸控件豁免（票面第 4 项「裸控件 = 0」的显式处置）

终态账面 = **3 处，全部显式豁免**（票面出口二选一之「显式豁免并给理由」，不静默保留）：

| 位置 | 形态 | 豁免理由（源内 #855 marker 原文要旨） |
| --- | --- | --- |
| `chief/chief-drawer.tsx:1262` | `<input type="file">`，`display:none` | 隐藏文件选择触发器（编程式打开），可见皮肤在附件 Button 上；Input 原语是可见输入框皮肤，无可收编之物 |
| `detail/composer.tsx:305` | 同上 | 同上 |
| `overlay/new-task-dialog.tsx:776` | 同上 | 同上 |

- 三处均带 `deliberate-native`（#855）marker 注释，drift-gate G4 机器闸绿（3 sites / 3 deliberate-native）。
- 共享件缺口口径核对：裁决（comment-6001887439 第 1 条）的合规出路是「直消费 Base UI 官方 Root + 零 CSS 皮肤」——Base UI 无 file-input Root（file chooser 是浏览器原生能力，非皮肤件），三处即「无可收编之物」的终态，非欠账。
- `scripts/ui-debt-baseline.json` 冻结于 3 = 封版终态；D2/D3 棘轮保证只减不增。

## t-0909 沙盒退役（票面第 3 项）

- `library/t-0909/` 已自工作树删除；150 文件按 main 历史 `144698cb` 全量可取回（gen-palettes.mjs 与 A/B 草稿在内——ADR 0010「换脸后悔」回退路据此仍成立）。`7340d0ab` 是 squash 前分支提交、非 main 祖先，内容一致性以 c.css sha1 逐字节核对（`beb289f6…`，audit 第 7 项）。
- 随迁两件套（spec/22 附录预定规则）：`apps/web/e2e/measure-912.mjs`（路径重基、`--out`、toggle 两对按 #952 既成事实摘除）+ `apps/web/e2e/palette-c.css`（定版色板冻结副本）。封版树期望读数已记入 spec/22 附录。
- 旧库 `t-0068` / `t-accent`：#909 resolution 已核「实测不在当前树，无需归档动作」。
- 归档再跑性注记：`docs/verify/915/contrast-recheck.mjs` 读沙盒路径，退役后不可复跑——历史证据原样保留（不复跑、不改写），色面对账由迁移后的 measure-912 承接（本目录 `measure-sealed/` 即封版复跑）。

## docs/spec 审计（票面第 4 项余面）

- **撞号**：00–25 各号唯一（audit 第 4 项）；22 号撞号已由 #952 按正本表 §0 规则将功能地图重编至 25 解决，25 册头部编号注在案。
- **spec/16**：头部 superseded-in-part 退役声明就位（#911/ADR 0010）。
- **余册 06 D1 / 11 / 18**（核到什么写什么）：**11** 已加 superseded-in-part 头注（唯一失效面 = `resources.css` 实现落点指针，随 #944 per-face 清零死亡；页面语义/结构/验收不受影响）；**06** 无需新标注（头部已载「D1 由 18 册修订（修订不取代）」+ §1 明文解除像素对拍义务）；**18** 无需新标注（§不做清单自身已排除像素对拍；定位面与 UI 换代无交集）。

## probe:dump `--specs` 转发坑修复（裁决第 4 条，归本票）

pnpm 把 npm 风格 `--` 原样转发进脚本（实测：`pnpm probe:dump -- --specs x` → `unknown flag --`）。修复 = parseArgs 跳过裸 `--`，两种调用形态（带/不带分隔符）行为一致；#921 工具头注释同步（`apps/web/e2e/probe-dump.mjs` Usage 节）。
