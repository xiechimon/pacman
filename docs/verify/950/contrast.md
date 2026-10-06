# #944 resources domain — measured contrast (better-colors pass)

Fixture stack http://127.0.0.1:8403, 1440×732, chromium. Foreground = computed color /
svg fill / element background (per measure mode); background = the ancestor
background stack composited (alpha layers folded, canvas-normalized so
oklab/color(srgb) serializations measure exactly). Thresholds: 4.5 text,
3.0 large text (≥24px or ≥18.66px bold) and non-text UI. Palette sealed
(#909), values = #915 flip (spec/22 §1.7/1.8); #944 is an equal-value
migration, so every finding below predates this ticket. Failing pairs are
reported, not repainted (better-colors report-not-repaint).

| surface › pair | kind | light | dark | threshold | verdict |
| --- | --- | --- | --- | --- | --- |
| drawer head + model row (111) › chip title (15px/600) | text | 6.34 | 7.25 | 4.5 | PASS |
| drawer head + model row (111) › head icon glyph (新主题) | ui | 6.34 | 7.25 | 3 | PASS |
| drawer head + model row (111) › head icon glyph (关闭) | ui | 6.34 | 7.25 | 3 | PASS |
| drawer head + model row (111) › model row label | text | 6.34 | 7.25 | 4.5 | PASS |
| drawer head + model row (111) › model runtime mark (pi) | ui | 6.34 | 7.25 | 3 | PASS |
| drawer model popover (open) › pick row name (selected) | text | 7.64 | 6.74 | 4.5 | PASS |
| drawer model popover (open) › pick row check | ui | 7.64 | 6.74 | 3 | PASS |
| drawer switcher (116) › switcher row (active) | text | 10.12 | 9.21 | 4.5 | PASS |
| drawer switcher (116) › switcher row hash glyph | ui | 5.98 | 6.55 | 3 | PASS |
| drawer unbound gate (100) › gate copy | text | 10.12 | 9.21 | 4.5 | PASS |
| drawer unbound gate (100) › gate 设置 (brand) | text | 6.34 | 7.25 | 4.5 | PASS |
| drawer hero examples (111) › hero heading | text | 15.86 | 13.09 | 4.5 | PASS |
| drawer hero examples (111) › example card text | text | 10.12 | 9.21 | 4.5 | PASS |
| drawer hero examples (111) › example tile glyph | ui | 5.55 | 5.03 | 3 | PASS |
| drawer stream (114) › note line (dim) | text | 6.34 | 7.25 | 4.5 | PASS |
| drawer stream (114) › robot paragraph | text | 15.86 | 13.09 | 4.5 | PASS |
| drawer stream (114) › todo chip (plan pair) | text | 7.64 | 6.74 | 4.5 | PASS |
| drawer stream (114) › agent chip (seg-active) | text | 9.38 | 7.07 | 4.5 | PASS |
| drawer stream (114) › msg foot (完成 44s) | text | 6.34 | 7.25 | 4.5 | PASS |
| drawer stream (114) › msg tool glyph (复制) | ui | 6.34 | 7.25 | 3 | PASS |
| drawer stream (114) › user bubble text | text | 14.96 | 11.81 | 4.5 | PASS |
| drawer turn tools disclosed (114) › tool row (mono) | text | 5.98 | 6.55 | 4.5 | PASS |
| drawer rewind confirm (114) › confirm copy | text | 15.86 | 13.09 | 4.5 | PASS |
| drawer rewind confirm (114) › confirm 取消 (outline) | text | 16.71 | 11.83 | 4.5 | PASS |
| drawer rewind confirm (114) › confirm 恢复到此处 (brand) | text | 7.41 | 8.24 | 4.5 | PASS |
| composer tools + send (111 drafted / 114 idle) › composer placeholder | text | 5.98 | 6.55 | 4.5 | PASS |
| composer tools + send (111 drafted / 114 idle) › composer draft text | text | 14.96 | 11.81 | 4.5 | PASS |
| composer tools + send (111 drafted / 114 idle) › send on (on-accent) | ui | 7.41 | 8.24 | 3 | PASS |
| composer tools + send (111 drafted / 114 idle) › tool glyph (提及) | ui | 5.98 | 6.55 | 3 | PASS |
| composer send idle (114) › send idle (dim on seg-active) | ui | 5.55 | 5.03 | 3 | PASS |
| settings agent tab (101) › set title | text | 15.86 | 13.09 | 4.5 | PASS |
| settings agent tab (101) › back chevron | ui | 6.34 | 7.25 | 3 | PASS |
| settings agent tab (101) › tab selected (on pill) | text | 14.96 | 11.81 | 4.5 | PASS |
| settings agent tab (101) › tab unselected | text | 10.12 | 9.21 | 4.5 | PASS |
| settings agent tab (101) › agent row label (未设置) | text | 10.12 | 9.21 | 4.5 | PASS |
| settings agent tab (101) › agent row dashed glyph | ui | 5.98 | 6.55 | 3 | PASS |
| settings agent tab (101) › compress h3 | text | 14.96 | 11.81 | 4.5 | PASS |
| settings agent tab (101) › compress desc | text | 5.98 | 6.55 | 4.5 | PASS |
| settings agent tab (101) › model trigger value | text | 15.86 | 13.09 | 4.5 | PASS |
| settings agent tab (101) › machine h3 | text | 14.96 | 11.81 | 4.5 | PASS |
| settings agent tab (101) › machine trigger value | text | 15.86 | 13.09 | 4.5 | PASS |
| settings model menu (open) › menu row name (selected) | text | 7.64 | 6.74 | 4.5 | PASS |
| settings model menu (open) › menu row name (unselected) | text | 15.86 | 13.09 | 4.5 | PASS |
| settings model menu (open) › menu row provider | text | 6.34 | 7.25 | 4.5 | PASS |
| settings model menu (open) › menu check (selected) | ui | 7.64 | 6.74 | 3 | PASS |
| settings machine menu (101-machines, open) › host row name | text | 15.86 | 13.09 | 4.5 | PASS |
| settings machine menu (101-machines, open) › host dot online | ui | 5.23 | 8.49 | 3 | PASS |
| settings machine menu (101-machines, open) › host dot offline | ui | 5.54 | 8.06 | 3 | PASS |
| settings machine menu (101-machines, open) › host check (selected) | ui | 6.34 | 7.25 | 3 | PASS |
| settings charter tab (102) › charter empty card | text | 5.98 | 6.55 | 4.5 | PASS |
| settings charter tab (102) › edit button (outline) | text | 16.71 | 11.83 | 4.5 | PASS |
| charter dialog (open) › charter textarea placeholder | text | 10.72 | 6.56 | 4.5 | PASS |
| charter dialog (open) › charter textarea text | text | 15.86 | 11.83 | 4.5 | PASS |
| charter dialog (open) › dialog 取消 (outline) | text | 16.71 | 11.83 | 4.5 | PASS |
| charter dialog (open) › dialog 保存章程 (brand) | text | 7.41 | 8.24 | 4.5 | PASS |
| agent dialog (open from 101) › agent search placeholder | text | 6.34 | 7.25 | 4.5 | PASS |
| agent dialog (open from 101) › agent row name | text | 15.86 | 13.09 | 4.5 | PASS |
| fab + badge (fab-avatar) › fab badge | text | 7.41 | 8.24 | 4.5 | PASS |

## Findings & disposition (human review, #944)

Every non-pass pair below is an equal-value carry-over of the pre-#944 per-face CSS (same token pairs, sealed #909 palette, #915-flipped values) — the migration introduced no new pair. Per better-colors report-not-repaint, they are reported for the visual-direction line (#909/#915 family) instead of repainted inside a domain ticket:

1. **`--text-dim` small text (12–13px) on card/panel surfaces — FIXED in this ticket by consumer slot swap.** First measurement: 2.73:1 light / 3.12:1 dark on `--surface-secondary` (2.89/3.46 on `--surface`), below the 4.5 text threshold; canon §1.7/1.8 had registered `--text-dim on --background` at threshold 3 only, which does not cover these surfaces. Per the #908 ruling (comment-6001887439, item 2: domain tickets may change consumer slot references, token values stay frozen) every affected consumer swapped `text-(--text-dim)` → `text-(--text-tertiary)`: machine row desc / shell-switch label / 添加机器 dashed action / orchestration running+waiting / runtime-head status + install hint / model-row id desc / secrets empty hint / mcp kind+url+ago / row chevron / status pill ink. Re-measured after the swap: 5.98–6.68:1 light, 6.55–7.86:1 dark — all PASS (see the rows above).
2. **pi/Claude Code brand marks (light) — reported, not repaintable.** First glyph fill #F09082 on `--surface-secondary` = 1.82:1 (off state 35% opacity composites to 1.35:1); dark theme passes (6.14 / 1.71→state also carried by data-enabled). Official brand assets (#887 icon-only law): aria-hidden decoration, readable name rides `role=img + aria-label + title`, on/off state rides `data-enabled` + opacity (not color alone), so the WCAG 1.4.1 state carrier is satisfied; graphical contrast (1.4.11) is not, in light theme. Brand colors are assets, not consumer slot references — outside the ruling-2 authority; left for the visual-direction line.

## Surfaces not measurable on the fixture stack

- **StatusPill (`未启用`)** — no reachable consumer: `machine.pill` is set by no fixture scenario and no live mapper (dormant API). Token-declared pair (NOT a surface measurement): `--text-dim` on `--pill-idle-bg` = light #8d8980/#e8e3da ≈ 3.0:1, dark #79756f/#2d2a24 ≈ 3.2:1 — below 4.5 for its 11px text; folds into the `--text-dim` finding below.
- **A3 runtime-empty action (brand sm button)** — the fixture pi segment always carries models, so the 「尚未添加服务商」 block never renders on fixture; measured on the verify live stack instead (fresh server, no providers): `contrast-live.json` — light 7.41 / dark 8.24 PASS, same recipe as the `empty primary (brand sm)` row.

