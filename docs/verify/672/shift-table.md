# 672 shift table — #471 braille reel → loading-dev LinearDots size=16

Probe: `.claude/verify-shots/probe-spinner-672.mjs` (identical before/after), fixture-mode
build served by `vite preview` on 127.0.0.1:8400, chromium headless, viewport 1440×732,
colorScheme dark, deviceScaleFactor 2. Geometry values are CSS px from getBoundingClientRect.
Δ = after − before. Animated properties (transform/opacity mid-cycle) are excluded from the
hashed dumps; they live in `animated-*.json` / `reduced-motion-*.json` (not hashed by design).

## Scenario `26` (streaming)

| element | metric | before | after | Δ |
|---|---|---:|---:|---:|
| row .chat-streaming | x | 294 | 294 | 0 |
| row .chat-streaming | y | 482 | 482 | 0 |
| row .chat-streaming | w | 96.703 | 103.5 | 6.797 |
| row .chat-streaming | h | 20 | 20 | 0 |
| row .chat-streaming | style.height | 20px | 20px | — |
| indicator .chat-spinner | x | 294 | 294 | 0 |
| indicator .chat-spinner | y | 484 | 484 | 0 |
| indicator .chat-spinner | w | 8.203 | 15 | 6.797 |
| indicator .chat-spinner | h | 16 | 16 | 0 |
| indicator .chat-spinner | style.height | 16px | 16px | — |
| indicator .chat-spinner | aria-hidden | true | true | — |
| indicator .chat-spinner | dot count | 0 | 3 | 3 |
| secs .chat-streaming-secs | x | 308.203 | 315 | 6.797 |
| secs .chat-streaming-secs | y | 484 | 484 | 0 |
| secs .chat-streaming-secs | w | 14.125 | 14.125 | 0 |
| secs .chat-streaming-secs | h | 16 | 16 | 0 |
| secs .chat-streaming-secs | font-variant-numeric | tabular-nums | tabular-nums | — |
| chevron svg | x | 328.328 | 335.125 | 6.797 |
| chevron svg | y | 487 | 487 | 0 |
| chevron svg | w | 10 | 10 | 0 |
| chevron svg | h | 10 | 10 | 0 |
| label .chat-streaming-label | x | 344.328 | 351.125 | 6.797 |
| label .chat-streaming-label | y | 484 | 484 | 0 |
| label .chat-streaming-label | w | 46.375 | 46.375 | 0 |
| label .chat-streaming-label | h | 16 | 16 | 0 |
| rel x (row-left based) | indicatorX | 0 | 0 | 0 |
| rel x (row-left based) | secsX | 14.203 | 21 | 6.797 |
| rel x (row-left based) | chevronX | 34.328 | 41.125 | 6.797 |
| rel x (row-left based) | labelX | 50.328 | 57.125 | 6.797 |

## Scenario `spinner-quiescent` (quiescent)

| element | metric | before | after | Δ |
|---|---|---:|---:|---:|
| row .chat-streaming | x | 294 | 294 | 0 |
| row .chat-streaming | y | 482 | 482 | 0 |
| row .chat-streaming | w | 76.578 | 83.375 | 6.797 |
| row .chat-streaming | h | 20 | 20 | 0 |
| row .chat-streaming | style.height | 20px | 20px | — |
| indicator .chat-spinner | x | 294 | 294 | 0 |
| indicator .chat-spinner | y | 484 | 484 | 0 |
| indicator .chat-spinner | w | 8.203 | 15 | 6.797 |
| indicator .chat-spinner | h | 16 | 16 | 0 |
| indicator .chat-spinner | style.height | 16px | 16px | — |
| indicator .chat-spinner | aria-hidden | true | true | — |
| indicator .chat-spinner | dot count | 0 | 3 | 3 |
| chevron svg | x | 308.203 | 315 | 6.797 |
| chevron svg | y | 487 | 487 | 0 |
| chevron svg | w | 10 | 10 | 0 |
| chevron svg | h | 10 | 10 | 0 |
| label .chat-streaming-label | x | 324.203 | 331 | 6.797 |
| label .chat-streaming-label | y | 484 | 484 | 0 |
| label .chat-streaming-label | w | 46.375 | 46.375 | 0 |
| label .chat-streaming-label | h | 16 | 16 | 0 |
| rel x (row-left based) | indicatorX | 0 | 0 | 0 |
| rel x (row-left based) | chevronX | 14.203 | 21 | 6.797 |
| rel x (row-left based) | labelX | 30.203 | 37 | 6.797 |

## md5 manifest (hashed static-geometry dumps)

| file | md5 |
|---|---|
| before/geometry-streaming.json | `f71c810b5f74cf2690cb28a9ab03b69e` |
| before/animated-streaming.json | (time-dependent, not hashed) |
| before/row-streaming.png | `d9ebb3096727d8ada32d4f8f78eba44b` (screenshot bytes) |
| before/context-streaming.png | `9c30cee2f3440b2d04eec08bca57234f` (screenshot bytes) |
| before/reduced-motion-streaming.json | (time-dependent, not hashed) |
| before/geometry-quiescent.json | `0554a64f45a95d16338c035f5e82841c` |
| before/animated-quiescent.json | (time-dependent, not hashed) |
| before/row-quiescent.png | `22d2650d620d32edbb67da898de1a2b7` (screenshot bytes) |
| before/context-quiescent.png | `3f91966635b23721a6fed46a74f53632` (screenshot bytes) |
| before/reduced-motion-quiescent.json | (time-dependent, not hashed) |
| after/geometry-streaming.json | `052f7534e8e2fc2592f646915525c184` |
| after/animated-streaming.json | (time-dependent, not hashed) |
| after/row-streaming.png | `34cab9429109da79ecbe015da3114c3a` (screenshot bytes) |
| after/context-streaming.png | `325b9ca6d21efb75acb1bf3030438fcd` (screenshot bytes) |
| after/reduced-motion-streaming.json | (time-dependent, not hashed) |
| after/geometry-quiescent.json | `e85b3a87c44e40ef93f9c0fc519278a5` |
| after/animated-quiescent.json | (time-dependent, not hashed) |
| after/row-quiescent.png | `7b3bd90f33fb657ad120ab19d1c48b12` (screenshot bytes) |
| after/context-quiescent.png | `167e0edb284f4f86a0816f0ff74d27a4` (screenshot bytes) |
| after/reduced-motion-quiescent.json | (time-dependent, not hashed) |

## Verdict

- Row outer geometry unchanged: x 294 → 294, y 482 → 482, height 20px → 20px. Nothing outside the row moves; rows above/below and the transcript scroll height are untouched (indicator height stays 16px, row stays 20px).
- Indicator slot: height 16px before/after; width 8.203px → 15.000px (+6.797px). The old width was the 12px braille glyph advance; the new one is the library geometry 5 × 0.1875 × 16 = 15px.
- In-row tail (secs/chevron/label) shifts right by exactly the width delta (+6.797px, uniform — gaps stay 6px, no wrap, vertical axis untouched). This horizontal delta is unavoidable for ANY loading-dev indicator at 16px height: every candidate is square (Classic/ClassicV2/Pulse: 16×16) or wider (LinearDots/BouncingDots ≈ 15px) versus the old 8.2px glyph slot. LinearDots is the narrowest 16px-tall option and keeps the old 900ms period.
- Reduced motion: before = reel `animation-name: none` + `transform: none` (frozen ⠙); after = library sheet `animation: none` + static dots at opacity 0.75. Equivalent freeze contract, pinned by `spinner-live.spec.ts` L5.
