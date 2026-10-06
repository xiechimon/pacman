# #951 verify evidence — detail-b 域施工（detail 域收尾）

域施工票 #951（#908 波 3）的验收证据。施工内容：`apps/web/src/detail/overlays.css`
（794 行）删除清零、本域面 shadcn 化（手工 toggle → Switch 件）、钉 overlays.css 面的
spec 按 #910 重钉（12 个 web spec + 2 个 integration 文件），以及 verify-pacman 技能
面的随票维护（10 个 drive 脚本 + 5 个 features 页迁语义载体）。`components/ui/` 共享件
一字未动，`tokens.css`/`shadcn.css` 值冻结未动。

取数正典：docs/spec/22（§1.7/1.8 槽表、§2 几何、§3 载体规约、§5.0–§5.6 退役正典表）；
钉扎口径 = #910 决议五裁定；探针工具 = `pnpm --filter @pacman/web probe:dump`（#921）。

## 目录

| 路径 | 内容 |
| --- | --- |
| `probe-dump/probe-comparison.md` | #921 探针对照表（旧基线 → 新实测，13 个重钉 spec）：**视觉行 123 全 KEPT，DRIFT 0 / VIOLATION 0 / NOT-RUN 0**（验收 2） |
| `probe-dump/probe-dump.json` / `probe-records.ndjson` / `probe-run.log` | 同次 dump 的结构化全量 |
| `parity/diff-{dark,light}.txt` | 等值迁移 parity 比对（before=origin/main per-face 规则栈，after=utility 载体栈）：**双主题 DRIFT 0**，EXPECTED 39/38（Switch 换代面 + TW 序列化等值对 + Switch 链 forceDesc.width 4px，票面注授权） |
| `parity/{before,after}-{dark,light}.json` | 同次采集的 computed-style + 几何原始真值（`scripts/probe-parity-951.mjs` 产出） |
| `contrast-951.md` / `.json` | better-colors 本域实测对照表（30 对 × 双主题 = 60 行，**FAIL 0**；report-only = §1.3 失能态槽与 §4-1 亮模 Switch unchecked 软对比项）（验收 3） |
| `before/*.png` `after/*.png` | 基线栈（origin/main @ d4f62649 一次性 worktree + fixture preview :8405）与本分支 fixture preview（:8402）截图，双主题 14×2 = 28 张（`scripts/shots-951.mjs`） |
| `live/` | verify-pacman 隔离 live 栈（launch.mjs :8795/:5277 + stub LLM :8919 门控轮 + 真 daemon enroll）真用户路径驱动：**branch-sync 15/15 + drive-951-detail 21/21 + review-reject 22/22**，截图 16 张 + result/contrast json（验收 4） |
| `local-full-e2e.log` | 换枝终态全量 web e2e：**809 passed (1.8m)**（验收 1） |
| `build-artifact-grep.txt` | 退役 per-face 选择器 × fixture 构建产物 grep 实证（33 组选择器零规则）（验收 5） |
| `scripts/probe-parity-951.mjs` | 等值迁移 parity 采集（before/after 共用结构选择子；Switch 换代面单列） |
| `scripts/diff-parity-951.mjs` | parity 比对闸（DRIFT 0 门槛；Switch 面 / 不可见边框序列化 / rounded-full used-value 机械判定） |
| `scripts/contrast-951.mjs` | 渲染对比度实测（祖先背景栈合成，双主题，WCAG 2.x 相对亮度；oklab/color(srgb) 通道解析） |
| `scripts/shots-951.mjs` | before/after 截图探针（同一脚本跑两栈，双主题） |
| `scripts/seed-951-live.mjs` | live 栈 seed（provider/agent/api-key/project/todo，错开 providerId 防 409） |
| `../../../.claude/skills/verify-pacman/scripts/drive-951-detail.mjs` | 本域定制 live probe（随 skill 入库；A 创建 Agent 面 / B 分支 live 面 + 停止弹层 / C 审核模态 + live 对比度 / D 运行时机制） |

## 读法

- **before/after 对照**：同名文件逐对看。等值迁移面（右 pane 三 section / 两个弹层 /
  创建 Agent 面）应零像素差。唯一有意差 = 强制同步拨杆换代（手搓 28×16 → Switch
  正典默认档 32×18.4，票面注 + spec/22 §2.5 冻结几何 / D2 授权）；screenshots 的
  `02/05` 各一张可直观看该差。
- **parity EXPECTED 项构成**：Switch 换代面（track/thumb 几何与配色换正典槽，
  --toggle-track/--toggle-knob 两槽就此孤儿化，槽删除归 #915/散件票）+ `forceDesc.width`
  4px（= 32−28，Switch 更宽的布局链后果）+ rounded-full 的 used value 记法。
  DRIFT 0 = 其余全键逐字节等值（含 61/39/27px token 行族、42px 分支行族、8px 圆角族、
  13px 控件字族与行高继承形——迁移中发现并修正了 TW text-* 自带行高与旧「仅 font-size」
  规则的 12 处漂移，改用 `text-[length:Npx]` / `leading-[calc(20/14)]` 等值形）。
- **live/**：branch-sync 四图 = 分支 section 打开 / 机器菜单 / 表单就绪（含 Switch on）/
  结果卡（终态 synced + 目标 git 现场真被复位）；detail 四图 = 创建 Agent 面 / live
  机器菜单 / Switch on / 停止确认弹层；review-reject 图 = 静息 review 面 / 更多菜单打回
  行 / 打回弹层填稿 / chip 即时翻。
- **运行时机制（drive-951-detail D 段）**：79 个退役选择器在 live 栈
  document.styleSheets 零规则；overlays.css 源文本不再进任何样式表。这是与
  build-artifact-grep 互为印证的双面实物判据（编译产物面 + 运行时面）。

## 未迁残留声明（验收 6）

1. **`.detail-chip`**（dhead 相位 chip 触发钮基类）：类名钩保留。它原属 detail.css
   （#945 已清零规则），chip-assign / chip-hotzone / integration m5-web-e2e /
   web-plans-convergence 四个已收官批次仍按它定位；本票已把 detail-b 名下两 spec
   （reject-chain/review-reject）改钉 `phase-chip` testid（dhead 新增二级载体）。
   终账归 #953。**理由**：跨批次共享钩，删类会连带砸已收官批次的 spec。
2. **`.plan-dropdown*` 与 `.overlay-*`**（#948/#949 面）：零规则别名钩，终账归 #953；
   本票只把跌在 detail-b 名下 spec 里的引用随手迁走。
3. **裸控件**：本域清零后全仓 7 → 6（branch-dialog 的强制同步隐藏 checkbox 随 Switch
   换代消失）；剩余 6 枚均为声明过的 deliberate-native / 件内部件（`.ckignore` 账见
   `scripts/ui-debt-baseline.json`）。

## 新面为零声明（验收 7）

diff 新 per-face CSS 0 行（`detail/overlays.css` 删除，全仓 per-face 文件 9 → 8、
1084 行由 `node scripts/ui-debt-gate.mjs` 现算）；新裸控件 0 处（同闸计数 7 → 6 只降
不升，棘轮已随本票重冻 `scripts/ui-debt-baseline.json`）。

## 随票维护（verify-pacman 技能面）

10 个 drive 脚本 + 5 个 features 页迁 #910 语义载体（旧 detail 域 dlg-\*/review-\*/
reject-\* 类名 locator 全退役）；新增定制 probe `drive-951-detail.mjs`。维护轮另修三处
先于本票的 stale：drive-stop / probe-error-lifecycle 的 ports.json 键名（server/web
→ serverPort/webPort，换端口车道会打到别人的栈）；假机器 claim 前的 presence 拍
（enroll 的 online 窗过期后 claimed 步被释放扫尾摘走）；`.plan-dropdown*` 类钉。
**未修、已在 features/stop-button.md 记 stale**：drive-stop 的 UI 开链写于 spec 21
单机编排默认策略之前——fresh 面「开始」现走 POST /orchestrate（chief 未绑定 409；
绑定后 chief 轮在门控 stub 下永不 dispatch），故其「详情页 开始 → streaming」前置段
不可达；本票 live 证据改由 drive-951-detail 走 REST POST builds 等价路径（daemon 认领
plan 步 → stub 门控轮 streaming → 停止窗仍在，drive-951-detail 的 B 段即此链）。

## 复现

```sh
# fixture 面 parity（before = origin/main 一次性 worktree + fixture preview :8405）
git worktree add --detach /tmp/951-before-main origin/main && corepack pnpm install
pnpm --filter @pacman/web exec vite build --mode fixture
# …两栈分别 preview（:8405 / :8402）后：
node docs/verify/951/scripts/probe-parity-951.mjs --url http://127.0.0.1:8405 --scheme dark --out /tmp/951-parity/before-dark.json
node docs/verify/951/scripts/probe-parity-951.mjs --url http://127.0.0.1:8402 --scheme dark --carrier after --out /tmp/951-parity/after-dark.json
node docs/verify/951/scripts/diff-parity-951.mjs --before /tmp/951-parity/before-dark.json --after /tmp/951-parity/after-dark.json --out docs/verify/951/parity/diff-dark.txt
node docs/verify/951/scripts/contrast-951.mjs --base http://127.0.0.1:8402 --out docs/verify/951
node docs/verify/951/scripts/shots-951.mjs --base http://127.0.0.1:8402 --out docs/verify/951/after

# 探针重钉对照表
pnpm --filter @pacman/web probe:dump --specs merge-reject reject-chain review-reject \
  rerun-close-family branch-button dialog-viewport detail-3pane board-dnd agent-create-model \
  team-create-agent dead-buttons avatar-dicebear checkbox-unified --port 8404 \
  --out ../../docs/verify/951/probe-dump

# live 面（stop-button.md seed 配方；默认口被邻道占 → VERIFY_PORT/VERIFY_WEB_PORT 换 8795/5277）
VERIFY_PORT=8795 VERIFY_WEB_PORT=5277 node .claude/skills/verify-pacman/scripts/launch.mjs
node .claude/skills/verify-pacman/scripts/doctor.mjs          # all PASS
STUB_PORT=8919 STUB_DELAY_MS=120000 node .claude/skills/verify-pacman/scripts/stub-llm-verify.mjs &
node docs/verify/951/scripts/seed-951-live.mjs                # → /tmp/951-seed.json
node .claude/skills/verify-pacman/scripts/setup-branch-sync-seed.mjs > /tmp/951-bs-seed.json
# daemon（PACMAN_HOME=/tmp scratch + 显式 --server http://127.0.0.1:8795 + proxy env 全 unset）
# 等 machines online:true 后：
node .claude/skills/verify-pacman/scripts/drive-branch-sync.mjs <todoId> <buildId>
VERIFY_EVIDENCE_DIR=docs/verify/951/live/detail node .claude/skills/verify-pacman/scripts/drive-951-detail.mjs
# 收尾：杀自起 daemon/stub → cleanup.mjs
```