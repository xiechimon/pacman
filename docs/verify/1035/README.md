# #1035 缩放宽视口看板自适应 — verify-pacman 证据

修法：列宽地板按 `.board-shell` 的既有 `data-chief-open` 标记劈两态——常态
`--board-col-min: 200px` / ⌘J 停靠 `--board-col-min-docked: 280px`
（`apps/web/src/styles/tokens.css` 单源，切换工具类挂 `board-page.tsx` 的
shell，与 detail-shell D7 的 `--detail-pane-right` 两态同式）。轨道规则本身
不分支、不进 min()（票面反例）。

## 结论速览

| 面 | 结果 |
|---|---|
| after（本分支栈 8791/5273） | `drive-1035-zoom-fit.mjs --expect=new` **10/10 PASS** |
| before（origin/main 一次性 worktree 栈 8793/5275） | `--expect=old` **6/6 PASS**（病灶复现） |
| fixture e2e | 新增 `apps/web/e2e/board-zoom-fit.spec.ts` 6 用例；`board-docked-reflow` 10 + `chief-panel` 14 全绿；web 全量 824 passed（E2E_PORT 8403） |
| 机制实物（编译产物 CSS） | `after/compiled-css-after.txt` vs `before/compiled-css-before.txt` |

## 实测边界表（after/result.json 的 sweep 原值，1440 物理宽）

缩放以 CSS 视口等价宽模拟（1440/z；布局几何只由 CSS 像素决定）。

| 档位 | CSS 视口 | scroller client/scroll | 四列全见 | 每列宽 | 页面级溢出 |
|---|---|---|---|---|---|
| 100% | 1440 | 1200/1200 | 是 | 281（1fr 主导，与改前逐值一致） | 0 |
| 110% | 1309 | 1069/1069 | 是 | 248.3 | 0 |
| 120% | 1200 | 960/960 | 是 | 221 | 0 |
| 125% | 1152 | 912/912 | 是 | 209 | 0 |
| ~129% | 1116 | 876/876 | 是（恰好贴地板） | 200 | 0 |
| ~129% | 1115 | 875/876 | 否（地板接管，诚实横滚） | 200 | 0 |
| ~141% | 1024 | 784/876 | 否（诚实横滚） | 200 | 0 |

翻转点实测 = 1116/1115 之间（计算值 240 侧栏 + 34 px + 42 gap + 4×200 =
1116，逐像素吻合）；即 1440 物理宽下缩放 ≤129% 四列全见。改前同一扫描
（before/result.json）：≤1440 的**每一档**（1309/1200/1152/1116/1115/1024）
scroll 恒 1196 > client、四列恒 280 地板接管——110% 第 4 列出屏 110px，
与票面指纹（1196 > 1069）一致。

## 停靠态不动（#692 语义前后一致）

⌘J 停靠于 1309：before 与 after 读数**逐项相同**——cols=[280,280,280,280]、
scroll 1196 > client 651、页面级溢出 0（`before/before-docked-1309-floor-280.png`
vs `after/docked-1309-floor-280.png`）。after 另验活翻：Escape 关抽屉即回
常态几何（scroll 1069 ≤ client 1069、cols 248.3）。

## 机制实物（「CSS 生效」的验收判据）

编译产物 grep（`pnpm --filter @pacman/web build` 后 `grep -o` dist/assets/*.css）：

- after：`--board-col-min:200px` + `--board-col-min-docked:280px` +
  `--board-col-min:var(--board-col-min-docked)`（data-chief-open 覆写规则）
  三形齐在 → `after/compiled-css-after.txt`
- before：仅 `--board-col-min:280px` 单形 → `before/compiled-css-before.txt`

## 复跑配方

```sh
# after（本分支检出根目录）
node .claude/skills/verify-pacman/scripts/launch.mjs
node .claude/skills/verify-pacman/scripts/drive-1035-zoom-fit.mjs --expect=new
node .claude/skills/verify-pacman/scripts/cleanup.mjs

# before 基线（origin/main 一次性 worktree，独立端口）
git worktree add --detach /tmp/pacman-before-1035 origin/main
cd /tmp/pacman-before-1035 && corepack pnpm install
VERIFY_REPO_ROOT=/tmp/pacman-before-1035 VERIFY_PORT=8793 VERIFY_WEB_PORT=5275 \
  node /tmp/pacman-before-1035/.claude/skills/verify-pacman/scripts/launch.mjs
# 探针用交付分支的副本打 before 栈（--expect=old 反转期望）：
VERIFY_REPO_ROOT=/tmp/pacman-before-1035 VERIFY_RUN_DIR=/tmp/pacman-before-1035/.claude/verify-run \
  node <交付分支>/.claude/skills/verify-pacman/scripts/drive-1035-zoom-fit.mjs --expect=old
VERIFY_REPO_ROOT=/tmp/pacman-before-1035 \
  node /tmp/pacman-before-1035/.claude/skills/verify-pacman/scripts/cleanup.mjs
git worktree remove --force /tmp/pacman-before-1035
```

回环请求全程 `env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*'`
（本机代理会拦 127.0.0.1）。探针自含 REST 铺底（项目 + 4 任务），栈必须
全新（launch 每次清运行目录，天然满足）。

## 文件索引

- `after/result.json` — 10 checks 逐条 + sweep 原值（after 栈 8791/5273）
- `after/*.png` — 110%/120%/125% 常态、1115 边界横滚、⌘J 停靠截图
- `after/compiled-css-after.txt` — 编译产物 CSS token 三形
- `before/result.json` — 6 checks + sweep 原值（before 栈 8793/5275）
- `before/*.png` — 病灶复现（1309/1152 溢出、停靠对照）
- `before/compiled-css-before.txt` — 改前单形 280px
