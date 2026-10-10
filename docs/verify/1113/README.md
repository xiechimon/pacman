# #1113 — chief-thread-switcher-scroll subpixel flake: root cause and fix evidence

`apps/web/e2e/chief-thread-switcher-scroll.spec.ts` pinned the thread-switcher
menu width with `expect(geom.width).toBe(262)` where `width` came from
`getBoundingClientRect()`. That rect is transform-affected: the chief drawer
window enters with `zoom-in-95` (scale 0.95→1 over `--dur-overlay` = 200ms,
`WINDOW_MOTION_CLS` in `apps/web/src/chief/chief-drawer.tsx`), so any sample
taken inside the 200ms entry window reads `262 × scale(t)` instead of 262.
The CI flakes (`261.78` on PR #1105, `260.3448486328125` on main runs
`94663b5b` / `5de41c8b`) are late-entry samples under load; a fast local
machine always measures after the animation and stays green.

The fix reads `el.offsetWidth` instead — the layout integer, transform-invariant
by definition — and keeps the exact `toBe(262)` pin. No tolerance is introduced:
covering the worst-case sample (the animation's first frame, 248.9) would need
ε ≥ 13.1px, which would swallow real width regressions of that size.

Files:

- `probe-animation-drift.txt` — per-frame probe on the **unfixed** code: an
  init-script sampler records `getBoundingClientRect().width` and `offsetWidth`
  from the menu's first frame, 12 fresh loads. Every load shows rect drift
  (first frame 248.9 = 262×0.95; mid-entry 261.784 ≈ CI's 261.78) while
  `offsetWidth` is 262 on every frame of every load (0 bad frames).
- `red-cap-removed.txt` — counterexample 1 (ticket acceptance): with the #1094
  cap (`max-h-[220px] overflow-y-auto`) removed from the menu, the spec goes
  red — test 1 fails `menuBox bottom 824 > window bottom 724`.
- `red-width-300.txt` — counterexample 2: with `w-[262px]` changed to
  `w-[300px]`, the fixed assertion goes red — `Expected: 262, Received: 300`.
  The exact pin still catches real width regressions.
- `green-10-rounds.txt` — the fixed spec, 10 full rounds (`--repeat-each 10`):
  30/30 passed.
- `subpixel-flake.drawio` / `subpixel-flake.drawio.svg` — the explanatory
  diagram embedded in the PR body (source + export pair, #1107 contract).

All runs against the fixture build (`vite build --mode fixture` + `vite preview`
on port 8399), each phase served from a dist verified by grepping the served
bundle for the phase's class string — the `reuseExistingServer` race (a
shutting-down server from the previous run answering the port probe, which
silently skips the rebuild) bit the first counterexample attempt and made it
pass against a stale bundle.
