# #1009 A0 原型证据（ADR 0013 壳形态反转：贴右竖板 → Multica 式悬浮窗）

> 阶段：**原型就绪，等用户实审**（#991 正典车道生命周期：原型 commit → 滚动实审 →
> 同分支续跑施工）。施工面（载体重钉 ⑨ / 验收模板 v3 / A1–A2–B）不在本证据集内。
> 复跑配方见各节命令；栈纪律 = verify-pacman SKILL.md（隔离 live 栈，绝不碰 8787/5173）。

## 0. 结论速览

| 面 | 结果 | 产物 |
|---|---|---|
| fixture 位形 smoke（五路由 + 交互契约，50 checks） | **50/50 PASS** | `drive-1009-a0-smoke.mjs` + `result-a0-fixture-smoke.json` + 截图 01–13 |
| live 栈取证（真数据，24 checks） | **24/24 PASS** | `drive-1009-a0-live.mjs`（skill scripts/ 内）+ `result-a0-live.json` + `live-*.png` |
| chief 域 + 邻接 e2e（17 spec / 179 用例） | 136 绿 / 43 红（红 = 重钉账，逐条分类见 §3） | `e2e-domain-status.txt` + `e2e-failed-list.txt` |
| 视觉探针三方 diff（开工侦察 vs 原型后 vs #953 封版） | KEPT 52 / DRIFT 5 / NOT-RUN 33 / VIOLATION 0 | `probe-pre-a0/` + `probe-after-a0/` |
| 单测（web 全量 468） | 全绿（含 i18n-coverage 新键「最小化」） | — |
| typecheck / lint | 全绿 | — |

## 1. 复跑配方

```sh
# fixture smoke（preview 栈）
cd apps/web && pnpm exec vite build --mode fixture
pnpm exec vite preview --host 127.0.0.1 --port 8403 --strictPort &   # 跑前 lsof 查占用
E2E_PORT=8403 node docs/verify/1009/drive-1009-a0-smoke.mjs

# live 取证（隔离栈）
node .claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_EVIDENCE_DIR=$PWD/docs/verify/1009 \
  node .claude/skills/verify-pacman/scripts/drive-1009-a0-live.mjs
node .claude/skills/verify-pacman/scripts/cleanup.mjs

# 域 e2e 现状（红 = 重钉账，非回归——见 §3 分类）
cd apps/web && E2E_PORT=8403 pnpm exec playwright test chief-panel chief-stream-markdown \
  chief-send-fallback chief-composer-tools chief-drawer-slash chief-drawer-model chief-fab \
  chief-settings hotkeys shell-consistency z-ladder board-docked-reflow board-zoom-fit \
  detail-3pane detail-narrow machines-chief-state overlay-focus

# 探针三方 diff
pnpm --filter @pacman/web probe:dump --specs chief-panel chief-stream-markdown \
  chief-send-fallback chief-composer-tools chief-drawer-slash chief-drawer-model \
  chief-fab chief-settings --out docs/verify/1009/probe-after-a0
```

## 2. registry 逐件对照表（协调者 2026-10-08 口径更正：判据 = `scripts/ui-upstream-snapshots.json`）

本轮（A0 原型）**对 `components/ui/` 零写入**。逐件对照：

| 件 | 上游快照形态 | 本地形态 | 判定 |
|---|---|---|---|
| `button.tsx` | base-nova registry（快照 hash `1df2d803…`） | 未改；消费点沿用 #950 七通道中和 utility（HEAD_ICON_BTN_CLS 等，先于本轮存在） | ledger `deviated` 已登记（#411/#425 语义映射零皮肤）——本轮未新增偏离 |
| `dialog-shell.tsx`（adapter） | 非 registry 件（本地组合层） | 未改（rewind 确认层消费点原样） | ledger `adapter` 已登记；**L3/#1006 已翻面为 registry dialog 组合——合并序撞上时 rewind 消费点按 L3 示范对齐（去自携 padding 包装、裸内容进 DialogFooter），归属施工面** |
| `message-scroller / message / bubble / attachment / marker`（A1 五件） | base-nova registry，`ui-registry-refresh.mjs --items` 管线产物 | 已 vendored 至 `/tmp/a1-primitives-1009/`（**未提交**，A0/A1 分段纪律）；与快照**逐字节同源**（hash 即管线 hash：ed1dd557 / dc60c69f / b6812e3f / 33d34435 / 59574fed） | A1 段登记（pristine）；本轮不进 commit |
| 悬浮窗本体（`chief-drawer.tsx` aside） | **非 registry 件**——承载机制 = Base UI 非模态 Dialog + Portal（ADR 0013 D10/F11，不触 0012 D3） | 几何/皮肤 = ADR 0013 D2 整套 Multica 原值（380×600、8px inset、12px 圆角、`--floating-shadow` 双主题原值、不透明卡底、edge-ring 发丝环） | 依据 = ADR 0013（用户 2026-10-08 十三问定案），非「方角/圆角」形容词判读 |
| FAB（`chief-root.tsx`） | 非 registry 件（应用面 launcher） | 40px 正圆 / 8px inset / floating-shadow + edge-ring = ADR 0013 D4 Multica 原值 | 同上 |

**本轮没有任何「改得更方」的动作**：窗 12px 圆角与 FAB 正圆均取自 ADR 钉死的 Multica 原值；
消费点中和 utility（rounded-none 族）全部先于本轮存在（#950 七通道配方），未扩未改。
12px 圆角落点记票：一次性 arbitrary 值（§3.1(a)），**不**消费 #983 退役面 token
`--radius-popover`（ADR 0012 D4 明令）；窗是该值唯一消费点，若施工面裁决提 token 再迁。

## 3. e2e 43 红分类（重钉账，ADR 0013 D11 / 票面 ⑨；行为断言语义一字不动）

| spec | 红数 | 分类 |
|---|---|---|
| board-docked-reflow | 8 | 整 spec 钉已退役的停靠让位态（0004 D8 废）——重钉为「覆盖层零让位」语义 |
| chief-panel | 11 | docked 418 几何 pin ×6 + 让位 pin + Esc 关窗 pin（D3 反转）+ 刷新不持久 pin（D5 反转）+ D7 互斥 pin |
| hotkeys | 9 | `data-chief-open` 标记族 + count-0 断言族（D6「关 = 在 DOM 但 inert」新契约） |
| shell-consistency | 5 | 族 FAB 类名/几何（48×48/16 族律退役，D4） |
| chief-fab | 5 | 同上 + unreadOnly 门载体 |
| chief-stream-markdown | 2 | F-R16 气泡几何随窗宽 418→380 重钉；F-R18 进场动画 settle 谓词（scale 动画期间 boundingBox 读缩放值——重钉加等待谓词，同 #984 对 A2 的预警形态） |
| detail-3pane | 1 | 418 chief dock 态 pin（D7 互斥退役） |
| chief-drawer-model | 1 | 关窗回收 popover 的 count 载体族 |
| board-zoom-fit | 1 | `data-chief-open` 两态地板切换（#1035 面随让位退役收敛单态） |

**非重钉的真回归：0**——43 红逐条对到上表；136 绿覆盖设置面/ composer 面/ slash 面/
发送回落/ machines-chief-state/ overlay-focus/ z-ladder/ detail-narrow 等行为契约。

## 4. 本轮工程裁决记录（施工面/实审可翻）

1. **z 新 rung = `--z-floating: 15`**（--z-docked 之上、--z-backdrop-low 之下）：#688 律
   「活动面恒压常驻面」原样成立；F8 单点裁决 = 渲染中的 registry 弹层件经已登记 deviation
   骑 --z-dialog，未渲染件（ui/dialog、ui/alert-dialog）保持上游 z-50 原文（永不竞争）。
2. **clearance 预约制度落地**：`--chief-launcher-size/inset/clearance` + `pe-/pb-/above-chief-launcher`
   三 utility（app.css @utility，Multica base.css 同形）。本轮零消费点：右下角落位经 smoke
   逐路由核对无吸底元素被撞（detail composer 发送钮在中心列、board 无吸底条）；消费点
   出现时按 Multica 三分类选 utility。
3. **autofocus 只认 closed→open 迁移**（MUL-5522 同律）：持久化开态的加载不抢焦点；
   keepMounted 后节点常驻，旧「OverlayMount 滞后一帧 ref callback 首焦」径退役。
4. **草稿跨整页刷新不持久**（与现状 main 同行为）：D5 只持久化开态；Multica 的草稿
   per-workspace 持久化如需对齐另票。
5. **抑制路由集 = agent 详情 + 机器授权**（覆盖面 = 现状，不发明新面）：根 host 保持
   hook 实例存活（状态跨绕行保留）但不渲染 launcher/窗、解除 ⌘J 注册。全站统一覆盖
   （含这两路由）是否为终态 = 实审裁决点。
6. **scrollAnchor（registry anchoring）A1 再裁**：A1 设计侦察已定「不挂 anchor、发送跳最新
   走 useMessageScroller().scrollToEnd」以保 #873 跟随律；anchoring 作为增强面留实审裁决。

## 5. 截图清单

fixture：01 board FAB 关态 / 02 board 窗开 / 03 新建任务 dialog 压窗（z 律）/ 04 最小化后 /
05 schedules 窗开（SPA 常驻）/ 06–08 pages·resources·secondary 三壳窗开 / 09 detail 窗开+右栏共存 /
10·10b fixture 111 hero·114 线程捕获形 / 11 抑制路由 / 12 设置视图内容交换 / 13 live 窗开。
live：live-01 真线程窗开 / live-03 刷新恢复开态 / live-05 schedules 常驻 / live-06 detail 覆盖位形 /
live-07 设置深链 / live-09 抑制路由。
