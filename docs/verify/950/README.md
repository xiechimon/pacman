# docs/verify/950 — chief 域 per-face CSS 清零（#950）证据索引

票面验收七项的实证材料。栈坐标：verify-pacman 隔离 live 栈（server `:8795` +
vite dev `:5277`，`PACMAN_HOME` = `.claude/verify-run/home` scratch，全新库；
8791/5273 被并行 lane 占用，按 skill 纪律顺延端口不杀邻道）+ fixture 栈
（`vite build --mode fixture` + preview `:8403`，本 lane 私有 E2E_PORT）。

| 路径 | 内容 | 结果 |
| --- | --- | --- |
| `probe-dump/probe-comparison.md` + `probe-dump.json` | #921 探针对照表（11 spec：chief 组 8 + dialog-viewport + segmented-controls + agent-identity-chip），#910 裁定 5 流程 | 116 tests passed；168 visual rows — **KEPT 168 / DRIFT 0 / VIOLATION 0**（终态代码含墨槽换引用后复跑） |
| `contrast.md` + `contrast-dark.json` / `contrast-light.json` | better-colors 本域实测（不许估）：chief 迁移面逐对 computed 前景 × 合成背景，双主题，WCAG 阈值 | **116 测量 / 116 PASS / 0 FAIL**（首轮 11 FAIL 全部为 dim 墨配对，按 #908 裁决 2 换消费面槽引用后清零；数字记录在 PR body） |
| `live/` | `drive-950-chief.mjs` live 真用户路径：FAB 开抽屉 / 头部钮 / gate / composer 占位与发送钮双态底色 / 设置 4 tab + 指示条 transitionProperty / 章程 编辑→保存→API 回读→SQLite 行→设置面实文 / agent·压缩模型·主力机三弹层 / 双主题截图 9 张 | **ALL PASS（30 checks）**，`live/result.json` 逐条 |
| `live-chief-model-select/` | 迁移后 verify-pacman 探针复跑（一）：`drive-chief-model-select.mjs`——#910 新载体（role=dialog/option + model-pick-name testid）+ 数据契约腿修到 #770 裁决后现行形（custom provider 模型抵达 model-sources 但被 picker 排除的裁决钉 + `toModelOptions(sources)` UI=API 并集一致；原「铺 provider → 行随之变」AC1 腿随 #770 退役，stale 先于本票） | **9/9 PASS**，`live-chief-model-select/result.json` 逐条 |
| `live-agent-identity/` | 迁移后 verify-pacman 探针复跑（二）：`drive-agent-identity.mjs`——#741 身份 chip live 闭环全链走新载体（REST 铺底 + 假机器认领回合步，N1–N8 渲染/href/hover/导航/键盘/提及 chip 八面） | **9/9 PASS**，`live-agent-identity/result.json` 逐条 |
| `scripts/drive-950-chief.mjs` | 上行探针源（归档随 PR；跑法见文件头） | — |
| `build-artifact-grep.txt` | 机制生效实物判据：编译产物 CSS grep（合并 origin/main #946–949 后的 fixture bundle 重生成）——chief per-face 选择器 16 组全 0 命中；迁移 utility 机制（418 dock 宽 / z-docked / spinner-breathe / clip-path 箭头 / aria-current / data-on / --active-tab-* / 四元 transition / important 覆盖 / edge-ring+card-shadow / field-sizing / pointer-fine）逐条在位；两枚零规则钩子类均无规则块（.chief-composer 原有的 1 块 overlay 外域规则已随 #948 内联进宿主 div utility，余下消费者 = spec 容器 scope） | 全部符合声称 |

复验：

```sh
# fixture 面（对照表 + 全量 e2e）
pnpm --filter @pacman/web probe:dump   # 或 node apps/web/e2e/probe-dump.mjs --specs …（#908 裁决 4 的 -- 转发坑）
# live 面
VERIFY_PORT=<port> VERIFY_WEB_PORT=<port> node .claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=$PWD node docs/verify/950/scripts/drive-950-chief.mjs
```
