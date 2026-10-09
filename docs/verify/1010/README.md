# #1010 验收证据 — select.tsx 手写件退役 → registry compound select

波 2 单件最小面（#983 认定的第 9 个手写件；判决清单 8 件之外，被 floating-shell
退役硬阻塞，#1008 合入后解锁）。验收模板 v3 七项按单件最小面对账。

## 改了什么

- `apps/web/src/components/ui/select.tsx`：手写 options 单体件（触发钮 +
  FloatingShell + ClickCatcher + role=listbox/option）→ **registry base-nova
  compound 族**（Base UI `Select/SelectTrigger/SelectValue/SelectContent/
  SelectItem/...`），逐字节 = vendored 上游快照（`scripts/ui-upstream-snapshots.json`
  的 `select` 项，shadcn@4.21.3），hash `ab19e7f4…` 与账本 `pristine` 相符。
- 删除 `apps/web/src/components/ui/floating-shell.tsx`（select.tsx 是其唯一存量
  消费者，#983/#1008 判决「随 #1010 删除」）与 `apps/web/src/overlays/dismiss.tsx`
  （ClickCatcher，唯一消费者是手写 select）。
- 消费点迁 compound 用法：`routes/agent-model-select.tsx`（两级级联壳）、
  `routes/agent-detail-page.tsx`（默认 skill 面）、`routes/create-agent-dialog.tsx`、
  `pages/schedules-page.tsx`（时/分/日期）。皮肤/几何常量（`AGENT_SELECT_*` /
  `DLG_AGENT_SELECT_*` / `SEL_TRIGGER_CLS`）退役——几何归 registry 默认（ADR 0012 D1），
  消费点只留布局位（弹窗触发钮 `w-full`、schedules `min-w-14`）。
- 账本 `scripts/ui-registry.json`：select.tsx `deviated → pristine`（S5 允许的升级），
  floating-shell.tsx 条目删除；`ui-registry-gate` PASS（28 件 = 15 pristine / 6 deviated / 7 adapter）。
- e2e 载体重钉：`agent-create-model.spec.ts` / `agent-detail.spec.ts` 的菜单/行
  locator 提到页面级（弹层 Portal 落 body），几何钉从手写右缘锚配方迁到 registry
  默认律（锚在触发钮上 + 整块视口内 + 行可达）。行为断言语义一字不动（#910 口径）。
- 集成钩子迁移（#735 教训）：`integration/test/m5-web-e2e.test.ts` 的
  `[role=listbox][aria-label=时|分]` → `[role=listbox]`（pristine 件下 aria-label
  落在 role=presentation 的外层 Popup，内层 listbox 的 aria-label 恒 null）。
- verify 探针维护：新增 `drive-1010-select.mjs`；`drive-agent-detail.mjs`（37/37）/
  `drive-1007-pages.mjs`（13/13）走 registry select 保持绿；`drive-952-finale.mjs`
  C6/C7 迁 registry 律（其余红是 #952 后各波历史漂移，非本票）。

## 证据索引

| 验收项 | 证据 | 结论 |
|---|---|---|
| ① e2e 行为 | 本地全量 web e2e **853 passed**；域 spec `agent-create-model`+`agent-detail` **48 passed**；集成 `m5-web-e2e` **3 passed** | 绿 |
| ② 探针重钉 | [`probe/probe-comparison-after.md`](probe/probe-comparison-after.md) + [`probe/probe-dump-after.json`](probe/probe-dump-after.json)（`probe:dump --specs agent-create-model agent-detail team-create-agent`） | **KEPT 28 / DRIFT 0 / VIOLATION 0** |
| ③ 增量面对比度 | [`contrast-1010.md`](contrast-1010.md) | 6 对双模全过，最低 11.87:1，零 fail |
| ④ verify-pacman live | [`live/sched-select/`](live/sched-select/)（`drive-1010-select`，**22/22**）+ [`live/agent-detail/`](live/agent-detail/)（`drive-agent-detail`，**37/37**） | PASS，含截图 + result.json |
| ⑤ 手写面退役对账 | 见下「#983 判决对账」 | select + floating-shell + ClickCatcher 三面执行 |
| ⑥ 未迁残留 | 见下「残留声明」 | 已声明 |
| ⑦ 非 registry 新增为零 | select.tsx = pristine registry；账本刷新；无新增手写 ui 件 | 零 |

### live 探针实物要点（`live/sched-select/result.json`）

- **B2/B4/B5**：外层 Popup `role="presentation"`（`data-slot="select-content"`），
  `role="listbox"` 落在内层 `Select.List`（div），其 `aria-label` 恒 `null`——这是
  m5 集成钩子从 `[role=listbox][aria-label]` 迁到 `[role=listbox]` 的**实物因**。
- **B8–B12**：触发钮 = `button` + `aria-label=时` + `aria-haspopup=listbox` +
  `aria-expanded` + `aria-controls→listbox`（`base-ui-…-list`）。
- **A1/A3**：时选 08、分选 30 均回显触发钮（`SelectValue` 承载）。
- 截图：`02-time-listbox-open-light.png` / `03-minute-listbox-open-light.png` /
  `04-time-listbox-open-dark.png`（开面态双模）。

## 复跑配方

```sh
# 栈（隔离，绝不碰 8787/5173 用户真栈）
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  node .claude/skills/verify-pacman/scripts/launch.mjs
# live 探针
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  VERIFY_EVIDENCE_DIR="$(pwd)/docs/verify/1010/live/sched-select" \
  node .claude/skills/verify-pacman/scripts/drive-1010-select.mjs
# 探针重钉（域过滤）
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  corepack pnpm --filter @pacman/web probe:dump -- \
  --specs agent-create-model agent-detail team-create-agent --port 5313 \
  --out docs/verify/1010/probe
# 账本闸
node scripts/ui-registry-gate.mjs
```

## #983 判决对账（验收项 ⑤）

- **select.tsx（第 9 个手写件，#982「漂移-应回」判决）**：执行——重拉 registry 件
  （快照同源，pristine），3 消费点（schedules / agent-detail / agent-model-select）
  迁 compound 用法；箭头三角 / 13px / 方角皮肤全弃；`--z-popover` 消费随件退役。✅
- **floating-shell.tsx（#983 判决表「退役回消费点组合」，12 挂载点的最后一个）**：
  执行——族拆在 #1008 完成 11/12，select.tsx 是第 12 个；本票迁走后 floating-shell.tsx
  删除、账本条目删除。✅
- **ClickCatcher（overlays/dismiss.tsx，#983「非本 8 件、去留单独判」）**：执行——
  唯一存量消费者是手写 select；#1060 裁决① 外点关归 Base UI 原生 outside-press
  （穿透），dismiss.tsx 删除。✅

## 残留声明（验收项 ⑥）

- `--z-popover`（tokens.css，值 30）与 `--z-catcher`（值 29）：手写 select 弹层与
  ClickCatcher 是其最后消费者，随件退役后成**死槽**。tokens.css 自批次 0b 冻结
  （唯一写入口 = #989 刷新脚本），本票不动它——死槽清理归 #987 槽收敛的后续账，
  此处仅声明。
- `integration/verify/xmon-40-*.mjs`（8 个归档 live-verify 驱动）：用 `.dlg-agent-model-select`
  / `-menu` 句柄类，非 CI 接线（历史证据驱动）。`.dlg-agent-model-select` 触发钮句柄类
  本票保留（消费点透传），`.dlg-agent-model-menu` 现在挂在 role=presentation 的 Popup 上
  （弹层 Portal 落 body）——归档驱动按历史证据口径保留不复跑，select 面现行 live 入口
  = `drive-1010-select.mjs` + `drive-agent-detail.mjs`。
- `pages/schedules-page.tsx` 的时/分/日期 Select 无 prefix 句柄类（本就没有），行/菜单
  定域靠 role + aria-controls + 值唯一性（见 SKILL.md #1010 实测坑③）。
