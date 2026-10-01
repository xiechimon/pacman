# XMON-104 验证证据：Panel 原语收编 `.account-card` / `.prj-set-card`

## 验收口径

本次改动是**皮肤搬家**，不是改版：`.account-card` 与 `.prj-set-card` 的描边 / 底色 / 圆角
从属地 CSS 搬进 `apps/web/src/components/ui/panel.tsx`，视觉输出必须逐个像素不变。

## 逐像素证据

改动前后各用 fixture 构建（`vite build --mode fixture`）在 1440×900 / dark / deviceScaleFactor 2
下截图，同一份 Playwright 脚本、同一台机器。前后 PNG 的 md5 逐一相等：

| 页面 | 文件 | md5 |
|---|---|---|
| 账号页 `/app/account` | `account-before.png` / `account-after.png` | `035cac714515c3b606cbc3023544ef23` |
| 项目设置 `/app/project/p1/settings` | `project-settings-before.png` / `project-settings-after.png` | `c5d0f33d9157aa173f1b22151ba62862` |

md5 相等 ⇒ 位图逐字节相同，差异像素数 0、最大通道差 0。另有元素级（卡片裁剪）截图
同时相等（账号卡 `9e5e229a86d77ccb7f72a0131448624e`、项目设置卡 `de5719ef6e6cc0141d1dc1d62e49170f`，
未入库为省体积）。

`*-after-fingerprint.json` 是改动后的 computed-style 探针（每元素 path / box / border / radius /
bg / shadow / padding / font），用于核对皮肤确实由 Panel 发出：账号卡根元素实测
`rounded-[12px] border border-line bg-surface` + `border: 1px solid rgb(39,39,42)` + `radius: 12px`
+ `bg: rgb(24,24,27)`，与改动前一致。

## 回归

- `pnpm exec playwright test e2e/account-team-cleanse.spec.ts e2e/project-settings-dead-buttons.spec.ts e2e/project-settings-delete.spec.ts e2e/dead-buttons.spec.ts e2e/visual-polish.spec.ts` — 52 passed
- `pnpm exec vitest run`（`apps/web`）— 142 passed / 16 files，含 `test/ui-reuse-inventory.test.ts` 的四道机器门
- `pnpm typecheck`、`pnpm lint` — 通过