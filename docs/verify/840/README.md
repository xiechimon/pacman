# docs/verify/840 — drive-project-new-form 探针期望同步 spot 系

探针 `drive-project-new-form.mjs` 仍期望主题翻转前的 indigo 焦点边
(`--indigo-500` rgb(100,102,233))，实际渲染吃 `--focus-ring`（spot 系，
暗 `#cba6f7`）。本票把期望同步到 spot 系；同因另带一处 `--danger`
（#839 起并流 `--destructive` 暗 `#e05a5a`，旧 `#ca3a32` 作废）。

改动（3 文件）：

- `.claude/skills/verify-pacman/scripts/drive-project-new-form.mjs` —
  `INDIGO_500` → `FOCUS_RING = 'rgb(203, 166, 247)'`，
  `DANGER` → `'rgb(224, 90, 90)'`，截图 `03-focus-ring-indigo.png` →
  `03-focus-ring-spot.png`，头注释同步。
- `.claude/skills/verify-pacman/features/project-new-form.md`、
  `features/README.md` — feature map 同步（indigo → spot 系/--focus-ring）。

验证（本目录 = 第 3 轮干净证据，全新库）：

- live 探针：19/19 PASS（`result.json`；含 focus
  `{"outline":"none","border":"rgb(203, 166, 247)","shadow":"…1px"}` 与
  danger `rgb(224, 90, 90)` 实测行）。栈：server :8792 + web :5274
  （默认 8791/5273 被邻 lane 占用，按纪律换口，未动他人进程）。
- fixture 面：`project-new-repo.spec.ts` 16/16 PASS（含 focus ring
  brand 断言；`E2E_PORT=8400`，8398/8399 被占）。

轮次备注：第 1 轮 18/19（focus 已过，danger 旧值红——即本票之外
的同类残留，就地修掉）；第 2 轮 19/19 但复用旧库；第 3 轮清栈重跑
19/19，本目录即第 3 轮产物。
