# #1008 用户复核修正轮证据（2026-10-08）

两条复核意见的修复实物。半径期望值的地面真值 = 仓内 `--radius: 0.625rem = 10px`（shadcn.css，#988 实审裁决定版）⇒ `rounded-lg = 10px`、`rounded-md = 8px`、`rounded-xl = 12px`——与 `scripts/ui-upstream-snapshots.json` 的 popover/button/dropdown 默认几何一致（ADR 0012 D1）。

## 1) 直角残留清理（意见 1）

`radii.json` 逐面 computed border-radius（fixture 生产包实测，非估算）：

| 面 | 实测 | 判定 |
|---|---|---|
| 总管设置机器选择器触发钮（recipes SELECT_TRIGGER_CLS） | 10px | = Button 默认 rounded-lg ✅（用户截图那面） |
| 其菜单壳（MENU_SHELL_CLS 落 PopoverContent） | 10px | = Popover 默认 rounded-lg ✅ |
| 其行（HOST_ROW_BTN_CLS） | 10px | = Button 默认 ✅ |
| chip-popover 行/编辑行 | 8px | = DropdownMenuItem 的 rounded-md 词汇 ✅ |
| chip-popover 面板 | 10px + padding 10px | = PopoverContent 默认 rounded-lg + p-2.5 ✅ |
| account 语言触发钮 / sched-form 行盒 / new-task 机器 chip（带边框盒形） | 10px | = 控件默认 ✅ |

改动 = 22 处 `rounded-none` 覆写摘除（recipes.ts ×3 点名根因 + model-select-core PICK_ROW_BTN_CLS + new-task-dialog ×4 + mention-picker ×3 + dhead ×1 + dir-browser ×2 + account-page ×2 + schedules 表单面 ×5 + project-new repo-field/picker 面 ×6），全部落回件默认半径。截图：`16-chief-machine-select.png`（用户点名面开菜单态）。

**保留直角处（依据）**：① `overlays/dismiss.tsx` ClickCatcher——全屏透明捕点击层，半径不可见，且整件随 #1010 删除；② sidebar / chief-drawer 内部行钮——L1（#1058）/L6（#1062）在飞域文件的既有 per-face 配方，本车道不越界改（避免与在飞 PR 互踩），归各域批次；③ schedules 卡面/空态、project-new 页头 chrome（名称输入/72px tile/提交钮）——L4（#1061）在飞域，同上；④ chip-popover 标题行 radius 0 = 纯文本 div 无底，无形可圆。

## 2) chip-popover 内里节奏（意见 2）

对照同族浮层与 registry popover 默认内距重排（`17-chip-popover-rhythm.png` 特写 + `radii.json` 量值）：

| 维度 | 旧（密一档） | 新（同族节奏） |
|---|---|---|
| 面板内垫 | Content p-2.5 + 内里再叠 pt-[5px]/pb-2/pt-2 micro-padding | Content 默认 p-2.5 单源，内里零垫 |
| 段落间距 | 逐段手写 pt/pb | root `gap-1.5` + 节内 `gap-0.5` |
| 行 | h-[26px] / text-xs(12px) / pr-1 | min-h-8(31.3px 实测) / text-sm(14px) / rounded-md px-1.5 = DropdownMenuItem 拍 |
| 标题行 | text-xs | text-sm leading-5 |
| 节标签 | text-[11px] 一级墨 | text-xs medium muted = DropdownMenuLabel 词汇 |
| 选中节 | 满幅 bg 直角 | rounded-md bg 块 |
| 编辑行 | text-xs h-auto flex-1 | min-h-8 text-sm rounded-md（与行族同拍） |

载体零漂移：`data-row-kind` / `data-selected` / 别名类 / 头像 12px img 契约原样（chip-assign / chip-hotzone / shadcn-primitives 头像探针全绿）。

## 复跑

```sh
corepack pnpm --filter @pacman/web exec vite build --mode fixture
corepack pnpm --filter @pacman/web exec vite preview --mode fixture --port <p>
# 量面脚本走 Playwright：getComputedStyle(el).borderTopLeftRadius + getBoundingClientRect
# 路线：/app?scenario=101-machines（机器选择器）→ /app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=19（chip popover）
#      → /app/account?scenario=13-lang → /app/schedules?scenario=r3-92 → /app?scenario=06
```

回归面：受影响 spec 定向轮 **264/264 绿**（chip-assign/chip-hotzone/chief-drawer-model/chief-settings/shadcn-primitives/newtask-*/overlay-focus/account-controls/project-new-*/mention/composer/dead-buttons/detail-3pane/hotkeys/escape-wiring/detail-esc/z-ladder/visual-polish）。
