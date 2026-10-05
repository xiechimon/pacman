# #854 证据：手搓 overlay 盘收编 + 颜色逃逸收敛

票：#854（#851 分面票之一）。设计正本：`docs/spec/base-ui-theme.md` +
`apps/web/src/styles/tokens.css`；先例 playbook：#714 菜单原语收编。

## 做了什么

### 1. 手搓盘收编到共享原语（同一样式只留一种实现）

票面五处 + 一处同款（agent-detail 记忆排序与 skills 排序共用同一组
`.res-sort*` 类名，盘面定位正本一改它必坏，故同 PR 一并收编）：

| 站点 | 原实现 | 现实现 |
|---|---|---|
| `overlays/plan-dropdown.tsx` | `FloatingShell` + `ClickCatcher` + 手搓 `role=listbox` | `ui/dropdown-menu`（Menu RadioGroup，`closeOnClick`） |
| `resources/skills-page.tsx`（排序） | 同上 | 同上 |
| `chief/chief-model-select.tsx` | 同上 | `ui/popover`（Popover + Positioner） |
| `chief/chief-model-popover.tsx` | 同上（抽屉头模型行） | `ui/popover` |
| `board/sidebar.tsx`（用户菜单） | 同上 | `ui/popover` |
| `routes/agent-detail-page.tsx`（记忆排序） | 同上 | `ui/dropdown-menu` |

定位正本从各面 CSS 的 `position/inset` 迁到 Positioner 参数
（`side` / `align` / `alignOffset` / `sideOffset`），逐站等值：`bottom+8`、
`top+4`、`alignOffset 8` 等按各面原值给。键盘契约（roving focus / Enter
激活 / Esc 归还焦点）归原语，probe 逐站实测。

`OverlayMount` 零残留（只有注释引用），未回引。

### 2. 颜色逃逸收敛

`overlay/attachment-strip.css` 的 `.attachment-pending-badge color:#fff`
→ `var(--text-on-veil)`。新 token 落在 `styles/shadcn.css` 两主题镜像
（主题恒定的黑罩上的白字，两主题同值），`tokens.css` 不改。

### 3. 盘三件套（用户 2026-10-05 取向）

参考站截图 `uploads/menu-square-reference.png` + Base UI 官方 menu hero
实测值：**直角 + 1px 实线 + 硬偏移投影**。五块盘统一：

- `border-radius: 0`、`border: 1px solid var(--border-default)`（原已如此）
- `box-shadow: var(--plate-shadow)` = `4px 4px 0 rgb(0 0 0 / 0.12)`
  （新 token，`tokens.css` 两主题同值；原吃 `--fab-shadow` / `--edge-shadow`
  的柔和档）
- 盘内选中行（`[data-checked]`）底色 = `--spot-soft`

### 4. 选中行高亮取色（截图实测）

`menu-square-reference.png` 逐像素取色：选中行底 `#d9ccdd`，四角满色
（无圆角），行文字仍是 ink `#15140f`，右侧勾形 `#8839ef`。
`#d9ccdd` ≈ `--spot-soft`（`color-mix(in srgb, #8839ef 14%, 面板)`）的
解算值，逐通道差 ≤1（截图压缩取整）——故直接消费既有 token，不新造色。
行文字保持 ink（不是 spec §2.5 的 tint 上紫字），因为截图实测就是 ink。

## 证据文件

- `probe-854-plates.mjs` —— 逐站开面，读**渲染值**（不是源码）：盘
  border/radius/box-shadow/padding + 选中行底色 + Esc 归还焦点 + 方向键
  roving。跑法：fixture 构建 + `vite preview`，`E2E_PORT=<port> node
  docs/verify/854/probe-854-plates.mjs`。
- `854-computed.json` —— 上探针的原始输出。
- `854-<盘名>.png` ×5 —— 五个盘的元素截图。
- `gate-output.txt` / `gate-negative-control.txt` —— 漂移闸正反两面。

## 检查

| 检查 | 结果 |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `pnpm lint` | exit 0（10 warning 全在 `integration/test/w3-steer-e2e.test.ts`，与本改动无关，main 上既有） |
| `vitest test/i18n-coverage.test.ts test/i18n-scan.test.ts` | 18 passed |
| `pnpm --filter @pacman/web e2e:affected` | 784 passed（改的是共享样式面，自动回落全量） |
| `node scripts/ui-drift-gate.mjs`（G2-ALLOW 条目已删） | PASS |

### 漂移闸

闸脚本 `scripts/ui-drift-gate.mjs` 由 #856 落仓（本分支已 `merge main`
取到）。#854 把 `HEX_ALLOWLIST` 清空（那条豁免是给这个颜色逃逸开的，
逃逸关掉了它就死了），两面证据都在：

- `gate-output.txt`：PASS（无 `.btn` 活选择器 / 无 hex 逃逸 / chip 变体单源）
- `gate-negative-control.txt`：把 `color: #fff` 放回去，同一条闸在
  `overlay/attachment-strip.css:76` 转红 —— 证明 PASS 不是空跑

## 需要协调者留意

1. **`scripts/ui-drift-gate.mjs` 有并发写者**：#859（#855）整份重写了这个
   文件，把 G1/G2/G3 换成输入面闸（不再是同一套闸的加面）。两条车道都在
   写同一文件且都已基于 main，合并顺序会决定最后一个版本是什么——先合
   #859 会把本 PR 清空的 allowlist 连同 G2 一起抹掉。不在本票范围，但合并
   顺序要人工判一次。
2. **盘投影与 spec §2.7 的口径**：spec §2.7 写「暗：无投影，线框承重」，
   本票按用户 2026-10-05 取向取 Base UI hero 的硬偏移值并**两主题同值**
   （取向只给了一条值）。若用户要按 Base UI 原样（暗侧 `none`），改
   `tokens.css` 一处即可。
3. **`.res-sort` 触发钮顺带归零圆角**（8px → 0）：取向里写了「trigger 同式」，
   同排的 `.res-search` 已由 #852 收敛到 0，二者原本一个 0 一个 8。