# #844 evidence: search panel flashes on 2nd Ctrl+K close

## Root cause (measured, not inferred)

The panel exit was a 100ms one-shot keyframe (`animate-out`, `VIEWPORT_POP_ANIM`).
Base UI holds the unmount window with a zero-visual `visibility` transition of
150ms (`--dur-fast`, `dialog.css`: `getAnimations` ignores subtrees), so the
keyframe finishes (~128ms) BEFORE the unmount (~156-181ms). With no
`fill-mode`, the panel snaps back to `opacity: 1 / transform: none` and paints
2-3 fully-opaque frames before removal — the flash on the 2nd Ctrl+K.

`close-trace-before.json` (rAF opacity sampler, `t844-recorder.mjs`):
opacity falls 1 -> 0.01 by t=96ms, jumps back to **1 at t=112ms**, stays 1
until detach at t=165ms. `OPACITY-RISE` verdict, probe exits 1.

## Fix (same law as #771/P2, spec `docs/spec/base-ui-theme.md` §1.2)

Exit rides a specified-style **transition** now (`overlays.css`:
`.dlg-viewport[data-closed] .search-panel` -> `opacity: 0; transform:
scale(0.98)`, 100ms ease-out) — the end state is held until unmount, so the
gap paints invisible instead of opaque. Enter keyframes untouched
(`VIEWPORT_POP_ANIM` is enter-only now). No duration was changed: the panel
still fades in 100ms, the shell still unmounts at ~150-180ms.

`close-trace-after.json`: opacity falls 1 -> 0 monotonically by t=111ms,
**held at 0** (`matrix(0.98,...)`) until detach at t=181ms. No rise.

## Method

- before stack: one-shot worktree `/tmp/844-before` at this branch's HEAD
  (detached, pre-fix), own install, `vite build --mode fixture`, preview on
  `:8406`. after stack: this branch, same build, preview on `:8405`.
- Strobe reconstruction (no time dilation — an 8x-dilation trial visibly
  altered the timing, so it was discarded): fresh open per shot, screenshot
  at post-close delays 0,15,...,195ms (`t844-strobe.mjs`), 14 shots per
  build, dark scheme. GIFs play the strobe at 6fps (~12x slow motion).
- Numeric traces: rAF opacity/transform sampler over a live 2nd-Ctrl+K close
  (`t844-recorder.mjs`), before verdict `FLASH: REPRODUCED` (exit 1), after
  `FLASH: not reproduced` (exit 0). Animation-event probe (`t844-events.mjs`)
  confirmed the unmount driver: panel `animationend` at ~128ms (before) /
  panel `transitionend` at ~104ms (after), removal both times ~156-181ms via
  the shell visibility window. Probe scripts are throwaway (not committed).
- Checkbox half of the ticket: rapid uncheck probe on the accept face shows
  the Indicator fading 1 -> 0 monotonically with no remount
  (`#771` holds, no change needed).

## Regression

- `apps/web/e2e/search-close-flash.spec.ts` (new, committed): close-flash
  monotonic-opacity test (failed pre-fix with `opacity rose back ... Received:
  1`, passes now) + triple-toggle lands-open-and-focused test.
- Family green on the after stack (32 passed): `search-focus`,
  `search-result-rows`, `sidebar-search-offboard`, `dialog-viewport`,
  `escape-wiring`, `checkbox-unified`, `search-close-flash`.
- `pnpm lint` clean on changed files; `pnpm typecheck` all workspaces pass.

## Files

- `before-close.gif` / `after-close.gif`: strobe slow-motion of the 2nd-Ctrl+K
  close. Before: the panel fades, then pops back fully opaque for a beat, then
  vanishes. After: one clean fade to gone.
- `before-flash-120ms.png`: strobe shot at +120ms into a 100ms fade-out —
  the panel is fully solid (the flash). `after-clean-120ms.png`: same delay
  post-fix — board only, panel gone.
- `close-trace-before.json` / `close-trace-after.json`: per-frame
  `{t, opacity, transform}` numbers behind the verdicts above.
