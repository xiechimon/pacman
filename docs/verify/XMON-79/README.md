# ⌘K 搜索框插入符被圆角裁切 —— 验证记录（XMON-79）

**结论：通过（pass）。**

验收标准原文（本 issue 描述）：

> macOS 按 ⌘K（本机等价 Ctrl+K）打开面板，插入符完整可见，不被图标或边框裁切；
> 输入字符后插入符跟随正常；改动不破坏面板其它视觉/交互（占位符、结果列表、关闭行为）。
> 证据须含修复前的复现截图与修复后的空输入态、输入态截图各一张。

## 根因

`apps/web/src/ui/input.css` 的 `.input--palette` 覆盖了 `.input` 盒状皮肤的边框、背景、
内边距，**但漏了圆角**，于是行内裸输入仍带着基类的 `border-radius: 8px`。
Blink 的 UA 样式表给 `<input>` 强制 `overflow: clip`，裁切区是 padding box 且沿圆角走：
本形态 `height: auto` + `line-height: 16px` 得 16px 高，配 8px 圆角即胶囊形。
插入符画在文本原点（padding box 左沿 x=0）——正是圆角吃掉高度的位置，于是被裁成
一段楔形残条。空输入态（⌘K 打开后的默认态）插入符恰在 0 位，症状即此。

受控实验（同一页面，仅切圆角这一条声明）：

| 声明 | 插入符实测高度 / 16px 输入框 |
|---|---|
| 原样（继承 8px） | 6px |
| `border-radius: 0` | 16px |
| 仅 `overflow-clip-margin: 20px` | 6px（无效） |

## 判定拆解

| 标准分句 | 判定 | 依据 |
|---|---|---|
| 未输入时插入符完整可见 | 通过 | 修复前 4x 截图 `before-empty.png`：插入符为楔形残条（逐列实测 2.75 / 4.5 / 6.25 / 7px）。修复后 `after-empty.png`：满高 16px（逐列实测 16 / 16 / 16 / 16px） |
| 输入字符后插入符跟随正常 | 通过 | `after-typed.png`：插入符在「r3 lifecycle」末尾，满高、紧随最后一个字形 |
| 不被图标或边框裁切 | 通过 | 插入符左沿与放大镜之间保留原有 3px 间隙（`.search-input-row` 的 `gap`），未改间距；裁切来源即输入框自身圆角（见根因表） |
| 占位符不受影响 | 通过 | `after-empty.png` 占位符「搜索任务、项目、成员…」转灰正常，文字位置与修复前逐像素一致 |
| 结果列表 / 关闭行为不受影响 | 通过 | `search-focus.spec.ts` 既有 5 条（聚焦、打字过滤、中途重开重聚焦、scrim 点击关闭、常亮互斥）全绿；`search-result-rows.spec.ts` / `sidebar-search-offboard.spec.ts` / `escape-wiring.spec.ts` / `hotkeys.spec.ts` 共 24 条全绿 |
| 改动不破坏面板其它视觉 | 通过 | 修复前后整面板截图逐像素比对：1040×880 中仅 61 px 不同（0.0067%），全部落在 x 66..71 / y 24..55 —— 插入符所在的那一列 |

基线对照说明：插入符位于**文本原点**时才落进圆角区，因此修复后输入态与修复前输入态本就同形
（`before-typed.png` 与 `after-typed.png` 肉眼一致）；本票的差异集中在空输入态这一张上，
这也正是用户报的场景。

## 复现步骤

```sh
multica repo checkout https://github.com/xiechimon/pacman.git --ref <分支>
cd <worktree> && pnpm install
PACMAN_DEV_WEB_PORT=5373 pnpm dev:web          # 5173 被别的车道占用时按端口纪律换口
# 浏览器开 http://localhost:5373/app?scenario=01，Ctrl+K
```

回归测试（先于实现写，修复前必红）：

```sh
cd apps/web && E2E_PORT=8499 npx playwright test search-focus.spec.ts
```

`E2E_PORT` 默认 8399 被占用时**不能杀**别的车道的进程，换口；本仓配置
`reuseExistingServer: true`，撞在别人的端口上会静默测到别人的构建。

## 实测结果

- `search-focus.spec.ts` 6 条全绿（含本票新增的插入符像素探针）。
  探针在修复前实测 6px、修复后 16px，断言 `>= 输入框高度 - 2`。
- 面板相关四条 spec 共 24 条全绿。
- 逐像素比对：整面板仅插入符一列变化（见上表）。

## 环境

- 截图口径：1440×732、dark、DPR 4（行内裁切，便于看清单像素插入符）；
  面板全图 DPR 2。与 e2e 同视口。
- dev server `5373`（`5173` 属别的车道，未触碰）。

## 记录之外

- 未改 `packages/shared/`：根因在 `apps/web/src/ui/input.css`，契约层无涉。