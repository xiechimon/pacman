# t-0031 死 CSS 零渲染风险组清理——像素同一性证据

本目录是 PR「死 CSS 零渲染风险组清理（C+D+E+J）」的验证证据：证明被删除的
8 处死规则/死选择器腿对渲染的影响为**零像素**。

## 删除清单（只删不补，数值逐字未动）

| 组 | 位置 | 删除物 | 死因 |
|---|---|---|---|
| C | detail/detail.css | `.chat-done--solo`（含其专属注释） | #97 transcript 重构丢发射点，规则遗留 |
| C | detail/detail.css | `.chat-done-label` | 同上 |
| C | detail/detail.css | `.chat-done` | 同上 |
| C | detail/detail.css | `.chat-done svg` | 同上 |
| D | detail/detail.css | `.overlay-actions--history` | #97 出生即死：只加了 CSS，TSX 从未发射；基类 `.overlay-actions` 活，保留 |
| E | resources/resources.css | `.res-row-more` 整规则 | RowCard 收编后无人发射；e2e 三处 `toHaveCount(0)` 反向钉死 |
| E | resources/resources.css | `.res-row-more ~ .res-row-chev` 死腿 | 同规则活腿 `.res-pill ~ .res-row-chev` 原样保留 |
| J | ui/dialog.css | `.dlg-form-ghost,` 死腿 | 规则本体经活腿 `.chief-dlg-ghost` 仍在命中 |
| J | ui/dialog.css | `.dlg-form-add,` 死腿 | 规则本体经活腿 `.dlg-provider-model-add` 仍在命中 |

每条删除前独立复核：固定子串 grep 全仓零命中（含 apps/、packages/、
integration/、e2e），并枚举全仓全部 BEM 动态拼接点核对值域——
select.tsx 的 `${prefix}-*` 后缀集为 wrap/select/shell/menu/row/row-name/
row-meta/check，不含 `-ghost`/`-add`；无任何拼接可产出上述 token。

## 验证方法

双栈对照 + 同一探针脚本 + 严格像素比对：

1. **before 栈**：`origin/main`（ee636a5）一次性 detach worktree，
   `vite build --mode fixture`，preview 于 127.0.0.1:8401。
2. **after 栈**：本分支（f099089 删除提交 + a4fe602 merge main），
   同法 build，preview 于 127.0.0.1:8400。
3. **探针**（probe.spec.ts + playwright.config.ts，本目录有副本）：
   10 个受影响面（看板、todo 详情 transcript、复用方案弹层、providers
   列表/模型 tab、mcp、machines、skills 行、总管章程弹窗、新建服务商
   弹窗）。确定性处理：固定时钟（2026-10-02T09:00:00Z）、拦截全部
   外部请求（头像走本地兜底）、`reducedMotion: reduce`、截图前 blur
   焦点并 finish 全部动画。
4. **比对**：先在 before 栈 `--update-snapshots` 存基准，再在 after 栈
   以 `toHaveScreenshot({ maxDiffPixels: 0 })` 严格比对。
5. **运行时选择器审计**：每面截图前统计 8 个被删选择器与 5 个活体
   对照选择器的 `querySelectorAll` 命中数，落 selector-audit-*.json。

## 结果

- **像素比对 10/10 通过（maxDiffPixels: 0）**——见 pixel-compare-run.log。
- **逐字节层面**：10 面中 9 面 before/after PNG 逐字节相同。唯一例外
  board：21 个像素（1,054,080 中的 0.002%，最大通道差 7/255）落在两枚
  agent 状态徽标（9px 圆、亚像素定位 883.75/1178.75）的抗锯齿边缘，
  见 board-pixel-diff.json。该残差与样式无关，排除链如下：
  1. CSS 产物差**恰为本次 9 处删除**——把 before 的 index css 按删除
     回放后与 after 的 index css 逐字节相同（无其它差异）；
  2. JS chunk 除文件名哈希外逐字节相同；静态资源相同；
  3. 两栈在 board 面的 DOM 几何（getBoundingClientRect）与计算样式
     （含徽标链五层）逐项相同；被删 8 选择器命中数两侧皆 0；
  4. 各栈自身跨次截图 0 像素差、同树重 build 重 serve 亦 0 像素差
     （确定性成立），故残差是 Chromium 对亚像素 SVG 圆的光栅化
      snapping 对 CSS 字节流的敏感点，非布局/配色变化；
  5. 该量级低于 pixelmatch 阈值（阈值 0.2 下 diff=0）、低于人眼与
     本仓 board 几何断言容差（visual-polish / board 系 spec 全绿）。
- **被删的 8 个选择器在全部 10 面命中数均为 0**（before 与 after 两侧
  一致）：元素不存在，规则本就无渲染贡献。
- **活体对照全部命中**：`.overlay-actions`（复用方案弹层）、
  `.chief-dlg-ghost`（章程弹窗）、`.dlg-provider-model-add`（新建
  服务商弹窗）、`.res-row-chev`（skills 行）——证明审计不是「全零
  假象」，活腿/基类规则仍在生效。
- `.res-pill` 在现有 fixture 场景无一发射（`machine.pill` 均空），故
  活腿 `.res-pill ~ .res-row-chev` 未被任一截图面视觉行使；该腿本次
  **一字未动**，删除同规则另一腿对它的匹配无任何影响（CSS 选择器
  列表各腿独立）。
- before/after 两侧 selector-audit.json 逐字节相同（diff 为空）。

## 回归面

- apps/web e2e 全量：merge main 前 587 全绿（1.8m）、merge 后 588 全绿（1.6m）。
- apps/web vitest：160 全绿。
- `pnpm lint` / `pnpm typecheck`：通过（merge 后复跑）。

## 复现

```sh
# before 栈
git worktree add --detach /tmp/css-before origin/main
cd /tmp/css-before && corepack pnpm install --frozen-lockfile
cd apps/web && pnpm exec vite build --mode fixture
pnpm exec vite preview --host 127.0.0.1 --port 8401 --strictPort &

# after 栈（清理分支检出）
cd apps/web && pnpm exec vite build --mode fixture
pnpm exec vite preview --host 127.0.0.1 --port 8400 --strictPort &

# 探针：把本目录 probe.spec.ts / playwright.config.ts 拷到 apps/web/probe-t0031/
PROBE_BASE=http://127.0.0.1:8401 PROBE_OUT=/tmp/ev/before \
  pnpm exec playwright test -c probe-t0031 --update-snapshots
PROBE_BASE=http://127.0.0.1:8400 PROBE_OUT=/tmp/ev/after \
  pnpm exec playwright test -c probe-t0031   # 10 passed = 零像素差异
```
