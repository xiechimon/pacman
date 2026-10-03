# #670 evidence — retirement of the old `ui/button` primitive

Pure deletion: `apps/web/src/ui/button.tsx` + `apps/web/src/ui/button.css`
removed (zero consumers since XMON-25/#607), plus comment/doc syncs in
`ui/README.md`, `COMPONENTS.md`, `pages.css` (5 provenance comments),
`detail/overlays.css` (XMON-89 note) and `overlay/token-gate.tsx`
(transition note). No selector, declaration or class-value changes.

Two fixture-mode builds, same machine, same Playwright chromium, viewport
1440x732, dark scheme:

- **before** = `origin/main` @ `633afa37` (detached one-shot worktree,
  `vite build --mode fixture` + `vite preview` on :8401)
- **after** = this branch (same build recipe, `vite preview` on :8399)

One shared probe (`probe.mjs`, committed here) visited every face carrying a
rule whose provenance comment this change synced, on both stacks. External
requests are blocked in the probe, so both runs are hermetic.

## Result

**1. The shipped bytes are identical.** Every one of the 21 files under
`apps/web/dist/` has the same md5 on both builds
(`dist-md5-{before,after}.txt` — diff is empty). The deleted files were
never bundled (zero importers), and the build strips comments, so the
comment syncs cannot reach the output. This subsumes the pixel claim:
identical bytes render identical pixels.

**2. Computed styles are byte-identical.** `computed-styles-{before,after}.json`
(getComputedStyle readings for every rule-carrying element on all 7 faces)
diff clean.

**3. Screenshots: 6 of 7 face pairs byte-identical (md5).**

| files | face (rule synced) | md5 |
|---|---|---|
| `board-{before,after}.png` | board, scenario 01 (context face) | identical `32ac2f08…` |
| `schedules-{before,after}.png` | `.sched-card-more` (pages.css) | identical `e8cc919a…` |
| `sched-form-{before,after}.png` | `.sched-form-close` (pages.css) | identical `6aa44baa…` |
| `prj-tasks-empty-{before,after}.png` | `.prj-tasks-empty-new` (pages.css) | identical `a9737f6a…` |
| `prj-settings-{before,after}.png` | `.prj-set-delete` (pages.css) | identical `d16cdcb0…` |
| `accept-dialog-{before,after}.png` | `.dlg-accept-done` / `.dlg-accept-cancel` (detail/overlays.css note) | identical `0f43e7ec…` |
| `gh-issues-{before,after}.png` | `.prj-issues-prev` / `.prj-issues-next` (pages.css) | DIFFERS — see below |

The gh-issues first-run pair differs by **9 pixels** inside a 57x30 bbox at
(1367, 56) — the topbar avatar region, where the blocked external avatar
request settles with run-order-dependent subpixel antialiasing. Proof that
this is per-run nondeterminism and not the change:

- re-running the probe on the **before** stack produced
  `gh-issues-before-rerun.png`, which is **byte-identical to the after
  shot** (md5 `7e09332a2da3471209671f8628ab9e15` on both);
- the same 9-pixel region is the only difference between the two
  same-stack before runs.

Faces with nothing to capture, by design:

- `.dlg-accept-block` — scenario 34 carries no blocked merge item, so the
  element does not render (reading is `null` on both stacks); the
  overlays.css edit is comment-only regardless.
- token-gate (`overlay/token-gate.tsx` comment sync) — renders only when
  the server enables token auth; no fixture face exists. Comment-only edit.

Regressions: full apps/web e2e suite result is recorded in the PR
description; vitest (incl. the `ui-reuse-inventory` machine gate) green.
