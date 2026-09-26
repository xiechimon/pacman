# A3-pages：次级页面群收编到 ui/ 原语

把 resources/ pages/ routes/ secondary/ chief/ 五区的散写 UI 收编到共享原语层。本域面广、多为表单页——Input/Button 收编是重点。

## 先读（动手前全部读完）

- `AGENTS.md`、`apps/web/DESIGN.md`、`apps/web/src/ui/README.md`、`docs/a3/diff-audit.md`

## 范围（只准动这些文件）

- `apps/web/src/resources/*.tsx` + `resources.css`
- `apps/web/src/pages/*.tsx` + `pages.css`
- `apps/web/src/routes/*.tsx` + `routes/*.css`
- `apps/web/src/secondary/*.tsx` + `secondary.css`
- `apps/web/src/chief/*.tsx` + `chief.css`

## 收编动作

1. **按钮**：各页 submit/主钮（多已消费 `.dlg-form-primary` 族类——可选择改接 Button 原语或保留族类别名，报告记录每处选择）、`prj-tasks-view-btn`、`chief-edit-btn`、`apikey-form-quickbtn` 等散写按钮 → Button 原语。e2e 按类名定位的保留别名叠加。
2. **input**：各表单字段、API key 输入 → Input 原语（36px）。textarea 保持散写并记录。
3. **chip/badge**：状态 pill（`.pill-idle-bg` 消费点）→ Chip neutral；tile 状态色块（tile-orange/indigo/hero）是语义色块不是 chip，不动。
4. **圆角归一**：按钮/可交互控件 6/10/4px → 8px；装饰性圆角不动。

## 禁令

- 不动 `apps/web/src/ui/`、不动 `tokens.css`、不动其他域（board/ detail/ overlays/ overlay/）。
- 不动 parity 基准。不 push、不 merge、不开 PR。

## 验证（全绿才交付）

```sh
pnpm lint && pnpm typecheck
PARITY_PORT=8394 pnpm parity   # 红项只允许来自圆角归一
```

端口占用换 8395+，不得杀其他进程。

## 交付

- `git add <显式路径>`，commit 格式：`web(a3-pages): <subject>`
- 报告写 worktree 内 `docs/a3/report-pages.md`。
