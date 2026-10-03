# 672 · transcript loading indicator: #471 braille reel → loading-dev Atom (size 16, duration 900ms)

Pilot swap of the site's only loading surface (`apps/web/src/detail/transcript.tsx`,
`.chat-spinner`). User decision 2026-10-03; the user picked Atom after viewing the live
preview. ADR 0009 D4 revised in the same PR.

## Layout

- `before/` — dumps on the pre-change build (braille reel; branch point 55fdd5f8 built in a
  one-shot detached worktree, served on its own port)
- `after/` — dumps on the post-change build (Atom)
- `shift-table.md` — before/after computed-style + boundingBox 对表 + md5 manifest + verdict
- `probe-spinner-672.mjs` — the probe (identical invocation for both phases)

Each phase directory holds, per scenario (`26` streaming with seconds,
`spinner-quiescent` quiescent gap):

- `geometry-<tag>.json` — static rects + computed styles (deterministic; md5 in `manifest.json`)
- `animated-<tag>.json` — live animation state (time-dependent, deliberately not hashed)
- `reduced-motion-<tag>.json` — freeze-contract dump under `prefers-reduced-motion: reduce`
- `row-<tag>.png` / `context-<tag>.png` — clips at deviceScaleFactor 2, dark scheme

## Reproduce

```sh
# after phase (branch build); before phase: same commands in a detached worktree of
# 55fdd5f8 with PROBE_BASE pointed at its own preview port
pnpm -C apps/web exec vite build --mode fixture
pnpm -C apps/web exec vite preview --host 127.0.0.1 --port 8400 --strictPort &  # any free port
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  PROBE_BASE=http://127.0.0.1:8400 PROBE_OUT=docs/verify/672/<phase> \
  node docs/verify/672/probe-spinner-672.mjs
```

Environment: macOS, node v26.8.1, chromium via @playwright/test 1.63.0, viewport
1440×732, colorScheme dark.

## Verdict (details + numbers in shift-table.md)

- **Zero shift outside the row**: row x/y/height identical (20px), indicator slot height
  identical (16px), aria-hidden preserved, stroke color identical (`--text-dim` =
  rgb(82,82,91)); nothing above/below the row moves.
- **In-row tail shifts +7.797px right**, uniformly (secs/chevron/label, gaps unchanged at
  6px, no wrap): indicator width 8.203px → 16px. The old width was the 12px braille glyph
  advance; Atom is a size×size square (shell circle 0.88px stroke + 3 orbit rings at
  0/60/120° tilt, 0.72px strokes). No loading-dev indicator is narrower at 16px height
  (Classic/ClassicV2/Pulse are also 16×16; LinearDots ≈ 15px), so a width-identical swap
  is geometrically impossible with this library — documented as the single deviation from
  the literal zero-shift acceptance.
- **Period alignment**: `duration={900}` prop pins the cycle to the old reel's 900ms
  (atom's library default is 1000ms); the 3 spins stagger −0.9s/−0.6s/−0.3s. Pinned by
  `apps/web/e2e/spinner-live.spec.ts` (L4).
- **Reduced motion equivalent**: before = reel `animation-name: none` + `transform: none`
  (frozen first frame); after = library sheet `animation: none` on every part + a static
  `rotate(60deg)` settle on the spins. Pinned by the same spec (L5).
