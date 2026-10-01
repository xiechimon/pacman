# Design Map

## Spacing Scale
Base unit **2px**. Observed scale: `2, 4, 6, 8, 10, 12, 16, 24`. Dominant: **6px** (×114), then 2px (×51), 10px (×31), 4px (×26). Fixed chrome: sidebar `240px` wide; pane header bars `44px` tall, padding `0 12px`; nav rows `32px`; file rows `37px` (padding `10px 12px`); badge `16×16`; send button `32×32`; composer `697×84`. Negative nudges: `-2px` ×10.

## Font Hierarchy
- **15px / 400 / lh 24px (1.6) Inter** — thread body, textarea input (the "content voice")
- **12px / 500 Inter** — ALL chrome: nav items, buttons, section headers, chips, warnings (the "app voice")
- **11px / 400** — timestamps (`#A8A29E`), diff stats (ui-monospace, `#059669`)
- **10px / 400 Inter** — keyboard hints (⌘K, N), right-aligned in nav rows
- Mono stack: `ui-monospace, "JetBrains Mono", "Fira Code", Menlo, Monaco, Consolas` — code spans, file names
- No h1–h6, no display sizes, weight 700 used once on the entire page

## Color Palette
- Background: `#FAF7F2` (95.4% of surface)
- Recessed surface (composer, panel header): `#F2EDE6`
- Active/hover fill (chips, send, task-id pills): `#E8E2D9`
- Hairline border: `#E2DBD1` @ 1px (44 elements)
- Text: `#1C1917` primary · `#57534E` body (most common) · `#78716C` secondary · `#A8A29E` tertiary
- Accent: `#6366F1` badges/links · `#4F46E5` primary button ONLY
- Signal: `#D97706` warning text · `#059669` diff-positive · `#F97316` project identity
- All neutrals warm-tinted (R>G>B); zero pure grays, zero pure white

## Image Ratios
- Avatars only: 1:1, rendered `24px`, square (`border-radius: 0` on img). No heroes, no illustrations, no decorative imagery.

## Component Tokens
- Radius: `4px` small elements · `6px` buttons/chips · `8px` send button · `12px` composer card (max) · `9999px` badges/dots · `2px 8px 8px` asymmetric message bubble
- Shadows: **none** — flat depth via background ladder + hairlines
- Grid: 3-pane shell `240px | ~730px fluid | 488px`, no max-width, panes abut with 1px rules; thread scrolls internally (document scrollHeight = viewport height)
- Motion: `width 0.2s cubic-bezier(0.2, 0, 0, 1)` for pane collapse; `:focus-visible` and `prefers-reduced-motion` both implemented

---

# Taste DNA

### Hairlines, Not Shadows
- **Trigger**: When separating three full-height working panes (sidebar / thread / changes) plus a floating composer
- **Decision**: They chose 1px `#E2DBD1` hairlines and a 3-step beige background ladder (`#FAF7F2` → `#F2EDE6` → `#E8E2D9`) over any box-shadow
- **Reason**: Shadows make each pane feel like a floating window competing for attention; on a screen you stare at for hours reviewing agent work, hairline-divided flat planes read as one calm instrument panel, not a stack of cards
- **Evidence**: `effects.shadows: []` (zero declarations); border `rgb(226,219,209) @ 1px` ×44; bg area ladder 95.4% / 4% / 0.4%

### Two Voices, Two Sizes
- **Trigger**: When fitting navigation, thread content, diff metadata, timestamps, and shortcut hints into one 1458px-wide shell
- **Decision**: They chose a two-register type system — 12px/500 for every piece of chrome, 15px/400 with 24px line-height for authored content — over a conventional 5-6 step scale with display headings
- **Reason**: Users of a task console must instantly distinguish "the app speaking" from "the work speaking"; a two-size split makes that subliminal, while bigger chrome would crowd out the content that matters
- **Evidence**: sizeDistribution 12px ×40 vs 15px ×21; `headings: {}` — zero h1-h6; max font size on page is 15px; primary button 12px/500

### Warm Paper over Blue-Gray
- **Trigger**: When picking the neutral ramp for a developer operations tool — a category defaulting to `#FFFFFF` backgrounds and blue-tinted slate grays
- **Decision**: They chose a fully warm stone ramp — `#FAF7F2` paper background, `#1C1917`→`#A8A29E` text, `#E2DBD1` borders — over cool gray/white, accepting a less tech-cliché first impression
- **Reason**: Warm neutrals read as paper and desk rather than terminal and datacenter; a tool built for long supervised sessions with an agent should feel like the document being reviewed, not the machine running it
- **Evidence**: all four text neutrals have R>G>B (28,25,23 / 87,83,78 / 120,113,108 / 168,162,158); page bg `rgb(250,247,242)` at 95.4% area; zero pure-gray or pure-white values in the color table
