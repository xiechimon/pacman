# #949 overlays/ 域施工 — 验证证据

票：#949（#908 波 2 · overlays/ 目录族，与 overlay/ 目录票 #948 以目录为文件边界并行）。本目录 = 验收七项中「探针重钉」「better-colors 实测」「verify-pacman 证据归档」三项的实物 + 等值迁移 parity 人审记录。

## 目录

| 路径 | 内容 | 对应验收项 |
| --- | --- | --- |
| `parity-949.md` | 等值迁移人审对照表：before（origin/main 034bf7d5 一次性 worktree 栈）× after（本分支栈）双主题 283 标量/模，DRIFT 全数落 CANON / CANON-SWAP / CARRIER / ACCEPTED 四授权类，**零 UNCLASSIFIED** | 2 |
| `parity/*.json` | 四轮 parity 采集原件（before/after × light/dark） | 2 |
| `probe-parity.mjs` | parity 采集脚本（40 测量面：面板盒/行盒/hover/选中/kbd 让位/scrim/pill 调暗/popover 锚定/Arrow/catcher/菜单行全态）；`--carrier after` 切语义载体，`--scheme` 切主题 | 2 |
| `probe-dump/probe-comparison.md` | #921 工具对照表（12 个重钉 spec、47 视觉行）：**KEPT 47 / DRIFT 0 / VIOLATION 0 / NOT-RUN 0** | 2 |
| `probe-dump/probe-dump.json` | 结构化全量 dump（sites/values/rows） | 2 |
| `contrast-949.md` | better-colors 双模 27 对门控实测表（渲染对 + token 解析对，WCAG 2.x 公式）：**0 未过**，域最低 4.5:1；含实测抓出并换槽的 `--text-dim × --popover-bg` 三面（亮 2.89 < 槽地板 3 → `--text-tertiary`，#908 裁决 2 授权、token 值零改动）；report-only 软发丝线 3 对与 §1.7/1.8 表值逐位吻合 | 3 |
| `live-stack/` | 定制探针（`drive-949-overlays.mjs`，随本 PR 进 `.claude/skills/verify-pacman/scripts/`）：A ⌘K 面板真路径 9 项（几何/皮肤/行钮收编/hover pill/键盘光标 data-selected/StatusChip sm/常亮互斥调暗律/scrim 点击关/退出透明度单调）+ B chip popover 真路径 7 项（锚定几何/V2 壳+Arrow/ClickCatcher 收编/data-selected section/行 hover tint/编辑分配中和/Esc 分层）+ D 机制 2 项（退役选择子零规则/调暗 utility 在场）+ E 对比度双模 2 项 = **38 checks 全 PASS，failures 0**（双主题）；截图 01/02/03/05 + `result.json` + `contrast.json` | 3、4 |
| `build-artifact-grep.txt` | 编译产物机制实物：`vite build --mode fixture` 的 dist 上 grep——18 个退役选择子 **0 规则**；类别名存活面与报备一致（`.doc-select-wrap` css 1 = detail.css 兄弟选择器活住址、`.doc-pane-select` css 5 = #945 账、sidebar/rail 别名仅 JS 类串）；新载体（data-row-kind / data-selected / chip-chevron / html[data-search-open] utility）全在场 | 4、5 |
| `local-full-e2e.log` | 验收 1「合并前本地全量一次」实物：终版代码全量 e2e（E2E_PORT=8402）**809 passed (1.8m)** 全日志 | 1 |
| `local-full-e2e-merged.log` | merge origin/main（#947 落地）后的合并头全量复跑：**809 passed (3.9m)**；同头 web unit 446/446、integration 60/60 | 1 |

C 段（plan dropdown）live 面声明：型选盘挂在详情右 pane 的 doc 面上，live 栈到达它需要 build 载荷数据（daemon + LLM 全链）——本 probe 显式声明跳过该面的 live 走查，覆盖面 = fixture e2e（detail-3pane / dead-buttons §6 / m7-branch-dialog integration，全绿）+ parity 探针菜单行全态（含 hover/focus/checked 复合态，双模 KEPT）。

## 复现

```sh
# parity（两套一次性 fixture 栈，端口自选、开跑前 lsof 复查）
git worktree add --detach /tmp/pacman-before-949 origin/main
(cd /tmp/pacman-before-949 && corepack pnpm install \
  && cd apps/web && pnpm exec vite build --mode fixture \
  && pnpm exec vite preview --port 8405 --strictPort &)
(cd apps/web && pnpm exec vite build --mode fixture \
  && pnpm exec vite preview --port 8406 --strictPort &)
node docs/verify/949/probe-parity.mjs --url http://localhost:8405 --out /tmp/before.json
node docs/verify/949/probe-parity.mjs --url http://localhost:8405 --scheme dark --out /tmp/before-dark.json
node docs/verify/949/probe-parity.mjs --url http://localhost:8406 --carrier after --out /tmp/after.json
node docs/verify/949/probe-parity.mjs --url http://localhost:8406 --scheme dark --carrier after --out /tmp/after-dark.json

# 探针对照表（#921 工具；直接调 node——pnpm 会把 `--` 原样转发撞 unknown flag）
cd apps/web
node e2e/probe-dump.mjs --specs search-focus search-result-rows search-close-flash \
  chip-hotzone chip-assign detail-esc avatar-dicebear detail-3pane dead-buttons \
  hotkeys escape-wiring sidebar-search-offboard \
  --out ../../docs/verify/949/probe-dump

# live 栈（默认口被占则顺延，见 skill 端口纪律；本车道实测 8791/5273 被
# 邻道占用，顺延 8795/5277）
VERIFY_REPO_ROOT=<worktree> VERIFY_PORT=8795 VERIFY_WEB_PORT=5277 \
  node .claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/drive.mjs new-task
VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/drive-949-overlays.mjs
VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/cleanup.mjs
```

## 口径备注

- 对比度 floor：文本 4.5、非文本 UI 3.0（better-accessibility）；`--text-dim` 槽 canon 地板 3 是 on `--background` 对（§1.7/1.8 的 3.75/3.05），压 popover 底（更亮）实测 2.89 击穿地板——消费面换槽处置同 #943 notify-banner 判例。
- report-only 族（spec/22 §1.3）：软发丝线 `--overlay-divider`/`--card-border`/`--border-default` 三对报数不判红，实测值与 §1.7/1.8 表列逐位一致（暗 1.11/1.11/1.2、亮 1.06/1.06/1.12）。
- D1 机制扫描走样式表规则枚举（含 @media/嵌套下钻；CSSStyleRule 的空 cssRules 不当组下钻，否则选择子全漏读——本车道首轮实测踩中，脚本已修）。
- Base UI Menu 的两个载体事实（重钉时实测）：① popup 可及名被 `aria-labelledby` 绑到触发钮（压过 `aria-label="面板视图"`），spec 钉裸 `getByRole('menu')`（开着的 menu 恒唯一）；② menu 内 hover 即移焦，hover tint 必须带 `hover:focus:` 复合档才压得住件底座的 `focus:bg-*` 中和类（迁移前实测序：hover 压 checked/focus）。
- modal 面板开着时 Base UI 给背景挂 `aria-hidden`：scrim 下调暗页层 pill 的断言要用 `getByRole('complementary', { includeHidden: true })`，否则 role 引擎整个滤掉地标（旧 CSS 类名 locator 无此过滤，载体等价性靠本开关保住）。
