# #942 老 ui/ 原语退役正典表 — 验证证据

正典表正本：`docs/spec/22-色彩与几何token-scale正本表.md` §5（chip 五态 → StatusChip、
input 36px 老族 → shadcn Input h-8、`ui/dialog.css` `.dlg-*` 逐条处置、壳级别名同族登记）。
抽查实装点（§5.6）：`routes/agent-detail-page.tsx` mini chip（C3）与
`resources/create-secret-dialog.tsx` 全弹窗迁移（I2）。

## 声称 → 实物

| 声称 | 实物 | 位置 |
| --- | --- | --- |
| Input 36px 老族退役，正典高 h-8 = 32px（§2.6-1/§5.3） | live 栈真用户路径 computed 高度 32px（暗/亮双模），`data-slot="input"` 件证据 | `live/result.json` checks `input-h8-32px` / `light-input-h8-32px`，截图 `live/01,03` |
| 裸 textarea → registry Textarea 件，方角 + min-h-16（§5.3） | `data-slot="textarea"`、radius 0px、h 64px | `live/result.json` check `textarea-canonical` |
| 裸 button `.dlg-secret-create` → Button brand 档 32px 全宽（§2.6-3） | `data-variant="brand"`、h 32px、宽 = 面板 448 − 2×16 | `live/result.json` check `submit-brand-32px` |
| label utility 化后 getByLabel 一级载体成立（§5.4） | getByLabel 命中同一 id 节点；note 12px | `live/result.json` checks `label-carrier` / `note-face` |
| secret 面老类 token 清零（`.dlg-form*`/`.dlg-secret-*`/老 `.input`） | dialog 子树 classList 精确 token 扫描 0 命中 | `live/result.json` check `legacy-classes-zero` |
| 行为语义不变（disabled 闸、提交落库、值只写不读） | 提交后掩码行上页 + API secrets 行 + SQLite secret 行 + 库内无明文值 | `live/result.json` checks `submit-disabled-empty`…`db-no-plaintext-value`，截图 `live/02` |
| chip 五态 → StatusChip：data-tone 载体 + Badge 骨架 + sm 档 16px/10px + 皮肤 = `--chip-*` token 实值（§5.2） | fixture 场景 agent-detail-active 上 computed 实物：`data-tone=idle/plan`、`data-slot=badge`、h 16px、font 10px、bg/fg 与 `--chip-idle-bg/fg` 解析值逐字节相等，暗亮双模翻值相异 | `fixture/result.json` 全部 checks，截图 `fixture/01,02` |
| 老 `.chip`/`.chip--*` 类 token 清零（行内） | classList 扫描 0 命中 | `fixture/result.json` check `chip-legacy-zero` |
| e2e 行为断言语义不变（映射无损） | agent-detail（data-tone 载体重钉）、secret-add-dialog（getByLabel/getByRole/getByText 重钉）、dialog-viewport（secret 提交钮载体重钉）+ 邻接面 dead-buttons、title-band-clicks 共 90 条全绿 | `e2e-run.log` |

## Before 基线（`before/`）

`origin/main` 一次性 detach worktree 的 fixture dist、同场景同视口重放
（`scripts/shots-942-before.mjs`）。实测旧形：secret 输入 `h=36
class="input dlg-form-input"`；agent 任务行 chip `h=14 class="chip
chip--idle chip--mini"`。对照 after：32px `data-slot="input"`（§2.6-1）与
16px `[data-tone="idle"][data-slot="badge"]`（§5.2）——两处几何差都是 D2
授权的有意结果，行为断言语义不变（e2e-run.log 90 条全绿）。

## 复现

```sh
# live 面（隔离栈；端口被撞就顺延，别杀邻道）
VERIFY_REPO_ROOT=$PWD VERIFY_PORT=8795 VERIFY_WEB_PORT=5277 \
  node .claude/skills/verify-pacman/scripts/launch.mjs
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  VERIFY_PORT=8795 VERIFY_WEB_PORT=5277 node docs/verify/942/scripts/drive-942-spots.mjs
VERIFY_PORT=8795 VERIFY_WEB_PORT=5277 node .claude/skills/verify-pacman/scripts/cleanup.mjs

# fixture 面（自含 vite preview，需 apps/web/dist 的 fixture 构建产物：
# cd apps/web && npx playwright test <任一 spec> 即产出）
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  node docs/verify/942/scripts/probe-942-fixture.mjs 8401

# e2e 面
cd apps/web && env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' E2E_PORT=8400 \
  npx playwright test e2e/agent-detail.spec.ts e2e/secret-add-dialog.spec.ts \
  e2e/dialog-viewport.spec.ts e2e/dead-buttons.spec.ts e2e/title-band-clicks.spec.ts
```

## Gotchas（复跑会撞的）

- 弹窗进场是 `data-open` zoom-in-95 + fade：transform scale 会污染 boundingBox 实物
  （32px 量成 30px）。测几何前必须等 computed transform 落定（脚本内 `waitSettled`）。
- `vite preview` 默认绑 localhost（IPv6）：探针 fetch 127.0.0.1 打不通，起服务要显式
  `--host 127.0.0.1`。
- StatusChip 半径 = Badge 骨架 `rounded-4xl`（当前 `--radius` 10px 解析 26px，#915 翻值
  随动），不是旧 chip 的 9999px 死值；≥ h/2 即胶囊视效，探针按此判，不钉死数值。
- Playwright 的 label 载体 API 是 `getByLabel`（没有 `getByLabelText`——那是 Testing
  Library 的名字）。
