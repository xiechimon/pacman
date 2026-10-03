# 672 shift table — #471 braille reel → loading-dev Atom (size 16, duration 900ms)

Probe: `probe-spinner-672.mjs` in this directory (identical invocation for both phases;
`before` ran against a one-shot detached worktree build of the branch point 55fdd5f8,
`after` against the branch build), fixture mode, `vite preview` on 127.0.0.1, chromium
headless, viewport 1440×732, colorScheme dark, deviceScaleFactor 2. Geometry values are
CSS px from getBoundingClientRect. Δ = after − before. Animated properties (transform /
rotation angle mid-cycle) are excluded from the hashed dumps; they live in
`animated-*.json` / `reduced-motion-*.json` (not hashed by design).

## Scenario `26` (streaming)

| element | metric | before | after | Δ |
|---|---|---:|---:|---:|
| row .chat-streaming | x | 294 | 294 | 0 |
| row .chat-streaming | y | 482 | 482 | 0 |
| row .chat-streaming | w | 96.703 | 104.5 | 7.797 |
| row .chat-streaming | h | 20 | 20 | 0 |
| row .chat-streaming | style.height | 20px | 20px | — |
| indicator .chat-spinner | x | 294 | 294 | 0 |
| indicator .chat-spinner | y | 484 | 484 | 0 |
| indicator .chat-spinner | w | 8.203 | 16 | 7.797 |
| indicator .chat-spinner | h | 16 | 16 | 0 |
| indicator .chat-spinner | style.height | 16px | 16px | — |
| indicator .chat-spinner | aria-hidden | true | true | — |
| indicator .chat-spinner | color | rgb(82, 82, 91) | rgb(82, 82, 91) | — |
| atom parts | shell/orbit/spin/ring | 0/0/0/0 | 1/3/3/3 | — |
| reel frames | count | 10 | 0 | -10 |
| shell circle (after only) | w × h | — | 16 × 16 | — |
| shell circle (after only) | border-top | — | 1px rgb(82, 82, 91) | — |
| secs .chat-streaming-secs | x | 308.203 | 316 | 7.797 |
| secs .chat-streaming-secs | y | 484 | 484 | 0 |
| secs .chat-streaming-secs | w | 14.125 | 14.125 | 0 |
| secs .chat-streaming-secs | h | 16 | 16 | 0 |
| secs .chat-streaming-secs | font-variant-numeric | tabular-nums | tabular-nums | — |
| chevron svg | x | 328.328 | 336.125 | 7.797 |
| chevron svg | y | 487 | 487 | 0 |
| chevron svg | w | 10 | 10 | 0 |
| chevron svg | h | 10 | 10 | 0 |
| label .chat-streaming-label | x | 344.328 | 352.125 | 7.797 |
| label .chat-streaming-label | y | 484 | 484 | 0 |
| label .chat-streaming-label | w | 46.375 | 46.375 | 0 |
| label .chat-streaming-label | h | 16 | 16 | 0 |
| rel x (row-left based) | indicatorX | 0 | 0 | 0 |
| rel x (row-left based) | secsX | 14.203 | 22 | 7.797 |
| rel x (row-left based) | chevronX | 34.328 | 42.125 | 7.797 |
| rel x (row-left based) | labelX | 50.328 | 58.125 | 7.797 |

## Scenario `spinner-quiescent` (quiescent)

| element | metric | before | after | Δ |
|---|---|---:|---:|---:|
| row .chat-streaming | x | 294 | 294 | 0 |
| row .chat-streaming | y | 482 | 482 | 0 |
| row .chat-streaming | w | 76.578 | 84.375 | 7.797 |
| row .chat-streaming | h | 20 | 20 | 0 |
| row .chat-streaming | style.height | 20px | 20px | — |
| indicator .chat-spinner | x | 294 | 294 | 0 |
| indicator .chat-spinner | y | 484 | 484 | 0 |
| indicator .chat-spinner | w | 8.203 | 16 | 7.797 |
| indicator .chat-spinner | h | 16 | 16 | 0 |
| indicator .chat-spinner | style.height | 16px | 16px | — |
| indicator .chat-spinner | aria-hidden | true | true | — |
| indicator .chat-spinner | color | rgb(82, 82, 91) | rgb(82, 82, 91) | — |
| atom parts | shell/orbit/spin/ring | 0/0/0/0 | 1/3/3/3 | — |
| reel frames | count | 10 | 0 | -10 |
| shell circle (after only) | w × h | — | 16 × 16 | — |
| shell circle (after only) | border-top | — | 1px rgb(82, 82, 91) | — |
| chevron svg | x | 308.203 | 316 | 7.797 |
| chevron svg | y | 487 | 487 | 0 |
| chevron svg | w | 10 | 10 | 0 |
| chevron svg | h | 10 | 10 | 0 |
| label .chat-streaming-label | x | 324.203 | 332 | 7.797 |
| label .chat-streaming-label | y | 484 | 484 | 0 |
| label .chat-streaming-label | w | 46.375 | 46.375 | 0 |
| label .chat-streaming-label | h | 16 | 16 | 0 |
| rel x (row-left based) | indicatorX | 0 | 0 | 0 |
| rel x (row-left based) | chevronX | 14.203 | 22 | 7.797 |
| rel x (row-left based) | labelX | 30.203 | 38 | 7.797 |

## md5 manifest (hashed static-geometry dumps)

| file | md5 |
|---|---|
| before/geometry-streaming.json | `8e418c73d0221765301230e64865fc5b` |
| before/animated-streaming.json | (time-dependent, not hashed) |
| before/row-streaming.png | `459f835fc3042c1764bc2a5d8b02e6cc` (screenshot bytes) |
| before/context-streaming.png | `481a0ae970225ea1ba27a8d2a88ee5ff` (screenshot bytes) |
| before/reduced-motion-streaming.json | (time-dependent, not hashed) |
| before/geometry-quiescent.json | `110ff7f7cecfd46d6f460e836814dd95` |
| before/animated-quiescent.json | (time-dependent, not hashed) |
| before/row-quiescent.png | `22d2650d620d32edbb67da898de1a2b7` (screenshot bytes) |
| before/context-quiescent.png | `3f91966635b23721a6fed46a74f53632` (screenshot bytes) |
| before/reduced-motion-quiescent.json | (time-dependent, not hashed) |
| after/geometry-streaming.json | `713013f14ac44f1f96a99df45453734c` |
| after/animated-streaming.json | (time-dependent, not hashed) |
| after/row-streaming.png | `fc069aea7192905912ba6220c96e9d8b` (screenshot bytes) |
| after/context-streaming.png | `77e6a9a45d133066a19dbbe93934f1a3` (screenshot bytes) |
| after/reduced-motion-streaming.json | (time-dependent, not hashed) |
| after/geometry-quiescent.json | `26ff2e282243575fe22ba63bfed236e9` |
| after/animated-quiescent.json | (time-dependent, not hashed) |
| after/row-quiescent.png | `ca48acc7c5cb42a822ad30321296fdb2` (screenshot bytes) |
| after/context-quiescent.png | `edd346eafc9189e2dc2df02ca3e4b9c0` (screenshot bytes) |
| after/reduced-motion-quiescent.json | (time-dependent, not hashed) |

## Verdict

- Row outer geometry unchanged: x 294 → 294, y 482 → 482, height 20px → 20px. Nothing outside the row moves; the indicator slot height stays 16px, so rows above/below and the transcript scroll height are untouched.
- Indicator slot: height 16px before/after; width 8.203px → 16.000px (+7.797px). The old width was the 12px braille glyph advance; Atom is a size×size square by design (shell circle + 3 tilted orbit rings).
- In-row tail (secs/chevron/label) shifts right by exactly the width delta (+7.797px, uniform — gaps stay 6px, no wrap, vertical axis untouched). No loading-dev indicator is narrower at 16px height (Atom/Classic/ClassicV2/Pulse are 16×16 squares; LinearDots/BouncingDots ≈ 15px), so a width-identical swap is geometrically impossible with this library. Atom was picked by the user after viewing the live preview; `duration={900}` pins the cycle to the old reel period (atom default 1000ms).
- Reduced motion: before = reel `animation-name: none` + `transform: none` (frozen first frame); after = library sheet `animation: none` on every part + a static `rotate(60deg)` settle on the spins (matrix(0.5, 0.866025, -0.866025, 0.5, 0, 0)). Equivalent freeze contract, pinned by `spinner-live.spec.ts` L5.
- Animation contract: before = 1 × `spinner-reel` 900ms steps(10) infinite; after = 3 × `ld-atom-rotate` 900ms linear infinite, staggered −0.9s/−0.6s/−0.3s, `playState: running` — pinned by the same spec (L4). Shell/ring strokes resolve to rgb(82, 82, 91) = `--text-dim`, the exact color the reel glyphs rendered in (L9).
