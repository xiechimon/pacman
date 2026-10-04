# docs/verify/755 — 拖回待开始任务重置闸

Live-stack proof (isolated verify stack, no daemon/LLM needed — the reset
path is server-side interrupt + delete; the daemon reach is the stop-button
signal path, M7 #308):

- Stack: server 8793 + vite 5275, fresh seed DB (launch.mjs).
- Probe: `/tmp` one-off `drive-reset-gate` (23 checks) — REST seed
  (project → todo → `POST builds` → manual `PATCH phase=building`), then a
  real pointer drag building → 待开始, dialog confirm, then API + SQLite
  truth reads. Script not committed (fixture e2e pins the faces durably).
- `result.json`: 23/23 PASS (both runs; first run caught the dialog row
  layout, fixed by the `.dlg-reset` per-face CSS, second run re-captured).
- `reset-gate.gif`: drag frames (10) → dialog → reset landing, 3 fps.
- `frame-dialog.png`: gate copy naming every cleared artifact.
- `frame-after-reset.png`: card back in 待开始 in reset form (开始 button).

Truth excerpts (`result.json` checks): phase back to `todo`, `hasPlan` /
`hasChanges` false, `latestBuildId` null, `buildHistory` empty; `build` /
`step` / `message` rows for the conversation gone; `todo` row kept
(title/spec intact).
