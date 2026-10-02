# 672 · transcript loading indicator: #471 braille reel → loading-dev LinearDots (size 16)

Pilot swap of the site's only loading surface (`apps/web/src/detail/transcript.tsx`,
`.chat-spinner`). User decision 2026-10-03; ADR 0009 D4 revised in the same PR.

## Layout

- `before/` — dumps on the pre-change build (braille reel, main @ branch point)
- `after/` — dumps on the post-change build (LinearDots)
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
pnpm -C apps/web exec vite build --mode fixture
pnpm -C apps/web exec vite preview --host 127.0.0.1 --port 8400 --strictPort &  # any free port
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  PROBE_BASE=http://127.0.0.1:8400 PROBE_OUT=docs/verify/672/<phase> \
  node docs/verify/672/probe-spinner-672.mjs
```

`<phase>` = the checked-out code state (`before` = reel, `after` = LinearDots).
Environment: macOS, node v26.8.1, chromium via @playwright/test 1.63.0, viewport
1440×732, colorScheme dark.

## Verdict (details + numbers in shift-table.md)

- **Zero shift outside the row**: row x/y/height identical (20px), indicator slot height
  identical (16px), aria-hidden preserved; nothing above/below the row moves.
- **In-row tail shifts +6.797px right**, uniformly (secs/chevron/label, gaps unchanged at
  6px, no wrap): indicator width 8.203px → 15px. The old width was the 12px braille glyph
  advance; 15px is the library geometry (5 × 0.1875 × 16). No loading-dev indicator is
  narrower at 16px height (Classic/ClassicV2/Pulse are 16×16 squares), so a literal
  zero-horizontal-delta swap is geometrically impossible with this library; LinearDots is
  the narrowest 16px-tall candidate and keeps the old 900ms period.
- **Reduced motion equivalent**: before = reel `animation-name: none` + `transform: none`
  (frozen ⠙); after = library sheet `animation: none` + static dots at opacity 0.75,
  fill `rgb(82, 82, 91)` = `--text-dim` (same color the reel glyphs rendered in).
  Pinned by `apps/web/e2e/spinner-live.spec.ts` (L5).
- Animation contract: 3 × `ld-linear-dots-fade`, 900ms linear infinite, staggered
  −0.9s/−0.6s/−0.3s (left→right wave), `playState: running` — pinned by the same spec (L4).
