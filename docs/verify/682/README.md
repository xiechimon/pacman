# verify/682 — machine dispatch closure (pin from task entry, enabledRuntimes gate, offline wait)

Live-stack verification on 2026-10-03, branch `hp/pacman/t-0062` (verify-pacman skill,
VERIFY_PORT 8791 / VERIFY_WEB_PORT 5273, HOST=0.0.0.0 so the tailnet machine could enroll).

Machines participating (both real daemons, both scratch `PACMAN_HOME`, no LLM burn —
steps fail fast on an unreachable stub provider):

| machine id | name | kind | where the daemon ran |
|---|---|---|---|
| `JcnjIri8UufcbEvwut-7A` | xmonsMac-3574.local | local | this Mac (`apps/daemon` tsx) |
| `EU2zHDnO-Fo81DSZH0X4K` | DESKTOP-N9CSRE4 | remote | mea over ssh, server reached at `100.125.21.46:8791` (tailnet) |
| `DxWJmgKOv-39_vxdDEIAO` | ghost-offline | remote | never connected (curl enroll only — the offline-pin fixture) |

## dispatch/ — claim semantics (REST + SQLite truth)

- `01-todo1-build.json.txt` — createTodo body `machineId` → build `pinnedMachineId`
  (entry surface: REST; same surface the dialog chip writes).
- `02-todo1-steps.json` — todo pinned to mea: step claimed by
  `EU2zHDnO-Fo81DSZH0X4K` (mea) while the local daemon was enrolled and polling the
  whole time — the pin filter kept the local machine off it.
- `03-todo2-steps.json` — unpinned todo: claimed by the local machine (auto = any
  machine, unchanged).
- `04-gate-blocked-steps.json` — both machines PATCHed `enabledRuntimes: []`:
  step stayed `pending` with both daemons polling (the gate is real).
- `05-gate-restored-steps.json` — local restored `['pi']` + a new enqueue woke the
  poll: local claimed the previously blocked step.
- `06-ghost-pinned-steps.json` — todo pinned to the offline ghost machine: step
  stayed `pending` after 12 s with both online machines polling — no auto fallback.
- `07-orchestrate.json` — orchestrate on a mea-pinned todo: chief thread carries
  `pinnedMachineId: EU2zHDnO-Fo81DSZH0X4K` and the request message contains the
  `机器：DESKTOP-N9CSRE4` line.
- `08-chief-step.json` / `09-chief-step-db.txt` — the chief step was claimed by the
  pinned mea machine (local machine online with `['pi']` the whole time could not
  claim it — chief thread affinity). Claimed while mea had `['pi']` restored; it was
  correctly held while mea's gate was `[]` (pin + gate compose).

## ui-probe/ — Playwright real-user paths (result.json: 5/5 PASS)

- `01-dialog-default.png` — machine chip renders with the 自动 default.
- `02-machine-popover.png` — popover rows: 自动 + xmonsMac + ghost-offline +
  DESKTOP-N9CSRE4 (offline machines selectable by design).
- `03-dialog-machine-selected.png` — selecting DESKTOP-N9CSRE4 backfills the chip.
- `04-todo-machine-api.json` — the UI-selected machine lands in `todo.machineId`
  (API truth cross-checked against the machines list).
- `05-ghost-pinned-waiting.png` — ghost-pinned pending todo detail: meta machine row
  reads `ghost-offline（等待机器上线）` — the offline-pin wait annotation.
- `06-task-meta.txt` — the meta block text for the same todo.

## Coverage notes

- mea's own deployment (`pacman-dev-server.service`) was never touched; the mea
  daemon ran from the user's checkout with a scratch home against the verify server
  only. Daemon code is unchanged by this PR (all pin/gate logic is server-side), so
  running main-branch daemon code there is representative.
- The runtime-gate + backfill semantics are additionally pinned in
  `apps/server/test/machine-pin.test.ts` (11 tests) and the chip UI in
  `apps/web/e2e/newtask-machine-pin.spec.ts` (6 tests).
