# #1008 波 1 L5：overlay+overlays 域 registry 族拆 — 验证证据

floating-shell（12 挂载点）族拆退役 + kbd-hint → Tooltip+Kbd + ClickCatcher 裁决落地（#983 判决表；#991 正典波 1；原型实审三裁决 2026-10-08 用户「全按推荐走」：①外点接受 Base UI 原生穿透 ②Shift+Tab 离触发钮即关（原生 focus guards）③可见背板/视口居中/tooltip 进可及树接受）。

## 证据地图

| 路径 | 内容 |
|---|---|
| `live/` | verify-pacman 定制 probe `drive-1008-overlay-registry.mjs` 的 live 栈实物：**32/32 PASS**（15 截图暗模+亮模 + result.json 逐检查项）。面 = 新建任务 dialog 的 Popover 双 chip/Tab tooltip/AlertDialog discard/Dialog 提及 picker、detail chip popover + 穿透裁决实物 + DropdownMenu more-menu 跨组件锚定、account 语言盘、schedules registry Dialog、tooltip 三消费点、保存链 API+SQLite 双真值 |
| `probe/` | 验收 v3 第 2 项探针账：`probe-comparison-kickoff-baseline.md` = 开工新鲜侦察（迁移前，本域 26 spec，85 visual rows，DRIFT 0 / VIOLATION 0——与 #953 封版零漂移）；`probe-comparison-after.md` + `probe-dump-after.json` = 迁移+重钉后同口径复跑（233 用例全绿，91 visual rows，**DRIFT 0 / VIOLATION 0**）。三方 diff 结论：#953 封版 ↔ 开工基线 ↔ 迁移后，钉值面零漂移（迁移改的是壳与载体，spec 内联几何钉在触发钮/行/头带等未动面上保持成立；mention-picker 400 宽/居中/transform-none 三钉在 registry translate 居中之下字面依旧成立） |
| `contrast-1008.md` | 验收 v3 第 3 项：better-colors 增量面双模 22 对全 PASS（最低 6.09:1） |

## 复跑配方

```sh
# live 面（全新库）
VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/cleanup.mjs
VERIFY_REPO_ROOT=<worktree> node .claude/skills/verify-pacman/scripts/launch.mjs   # 8791/5273 被占则 VERIFY_PORT/VERIFY_WEB_PORT 顺延
VERIFY_REPO_ROOT=<worktree> VERIFY_EVIDENCE_DIR=<out> node .claude/skills/verify-pacman/scripts/drive-1008-overlay-registry.mjs
# 探针账（本域 26 spec；端口用车道自己的）
corepack pnpm --filter @pacman/web probe:dump -- --specs hotkeys shadcn-primitives chip-assign chip-hotzone composer-inline-mention mention-picker-center composer-slash chief-drawer-slash newtask-project-select newtask-machine-pin newtask-machine-persist newtask-single-field newtask-project-persist project-empty-new-task project-new-dir-browser project-new-fs-pick project-new-repo project-new-github overlay-focus escape-wiring detail-esc z-ladder dead-buttons detail-3pane review-reject account-controls --port <lane-port> --out <dir>
```

probe 判读：A 组 = 新建任务 dialog 的 registry 壳族实物（slot 载体 / portal 落 body / Positioner 锚定 / side=top / Esc 分层 / keep 送焦）；B 组 = detail 面 + **裁决 1 穿透实物**（popover 开着点 更多 = 同击双效，即预期行为）；C/D = 语言盘与定时表单；E = tooltip 三消费点；F = 亮模走查；G = 数据面零回归双真值。实测坑两枚已写进脚本注释：①量 400 宽须等进场动画落定（zoom-in-95 动画中量得 380）；②宿主 DialogShell 与 picker 各有一张 `data-slot="dialog-overlay"`，取 `.last()`。

## 残留与归属

- `components/ui/select.tsx` 仍骑 FloatingShell+ClickCatcher（XMON-75 手写件）→ **#1010 波 2**（Blocked-By 本票，本票合并即解锁）；`floating-shell.tsx` / `overlays/dismiss.tsx` 随之删除。
- 本域 dialog-shell 消费点（new-task-dialog bare / attachment-strip / search-panel viewportRoot）等 **L3 翻面合入后**按 detail 六点示范清法对齐双垫（协调者通报 2026-10-08）。
- `plan-dropdown` / `user-menu` 本车道零触碰（跨车道通报纪律）。
- 历史 probe `drive-948-overlay.mjs` 的壳级载体（V2 弹层壳几何 / z-30 / 冻结坐标）已被本票退役——该脚本按其归档口径保留不复跑，overlay 域 live 复跑入口 = 本票 `drive-1008-overlay-registry.mjs`。
