# #946 pages domain — measured contrast (better-colors pass)

Fixture stack http://localhost:8399, 1440×732, chromium. Foreground = computed color /
svg fill / element background (per measure mode); background = the ancestor
background stack composited (alpha layers folded, canvas-normalized so
oklab/color(srgb) serializations measure exactly). Thresholds: 4.5 text,
3.0 large text (≥24px or ≥18.66px bold) and non-text UI. Palette sealed
(#909), values = #915 flip (spec/22 §1.7/1.8); #946 is an equal-value
migration apart from the two slot swaps recorded in Findings below. Failing
pairs are dispositioned per #908 ruling 2 (consumer slot references may
move; token values stay frozen).

| surface › pair | kind | light | dark | threshold | verdict |
| --- | --- | --- | --- | --- | --- |
| schedules empty (r7 11) › topbar title | text | 15.86 | 13.09 | 4.5 | PASS |
| schedules empty (r7 11) › back chevron | ui | 6.34 | 7.25 | 3 | PASS |
| schedules empty (r7 11) › 新建 action (brand ink on surface) | text | 6.14 | 7.61 | 4.5 | PASS |
| schedules empty (r7 11) › empty tile glyph | ui | 10.12 | 9.21 | 3 | PASS |
| schedules empty (r7 11) › empty title | text | 15.86 | 13.09 | 4.5 | PASS |
| schedules empty (r7 11) › empty desc | text | 6.34 | 7.25 | 4.5 | PASS |
| schedules empty (r7 11) › empty primary (brand fill) | text | 7.41 | 8.24 | 4.5 | PASS |
| schedules empty (r7 11) › empty hint (dim) | text | 6.34 | 7.25 | 3 | PASS |
| schedules list card (r3 93) › card tile glyph | ui | 9.38 | 7.07 | 3 | PASS |
| schedules list card (r3 93) › card title | text | 14.96 | 11.81 | 4.5 | PASS |
| schedules list card (r3 93) › card line (secondary) | text | 10.12 | 9.21 | 4.5 | PASS |
| schedules list card (r3 93) › card line dim + seps | text | 5.98 | 6.55 | 3 | PASS |
| schedules list card (r3 93) › card phase chip | text | 8.38 | 7.84 | 4.5 | PASS |
| schedules list card (r3 93) › kebab glyph | ui | 5.98 | 6.55 | 3 | PASS |
| sched card menu (open) › delete row ink (--stop) | text | 6.01 | 8.83 | 4.5 | PASS |
| sched card menu (open) › delete row glyph | ui | 6.01 | 8.83 | 3 | PASS |
| 新建定时 dialog (r3 92) › dialog title | text | 15.86 | 13.09 | 4.5 | PASS |
| 新建定时 dialog (r3 92) › close glyph | ui | 6.34 | 7.25 | 3 | PASS |
| 新建定时 dialog (r3 92) › row label | text | 10.72 | 10.2 | 4.5 | PASS |
| 新建定时 dialog (r3 92) › row value + chevron ink | text | 15.86 | 13.09 | 4.5 | PASS |
| 新建定时 dialog (r3 92) › freq tab selected | text | 15.86 | 13.09 | 4.5 | PASS |
| 新建定时 dialog (r3 92) › freq tab unselected | text | 10.12 | 9.21 | 4.5 | PASS |
| 新建定时 dialog (r3 92) › field label | text | 10.72 | 10.2 | 4.5 | PASS |
| 新建定时 dialog (r3 92) › select trigger text | text | 15.86 | 13.09 | 4.5 | PASS |
| 新建定时 dialog (r3 92) › select trigger chevron | ui | 6.34 | 7.25 | 3 | PASS |
| 新建定时 dialog (r3 92) › tz note (dim) | text | 6.34 | 7.25 | 3 | PASS |
| 新建定时 dialog (r3 92) › cancel (surface-secondary fill) | text | 10.12 | 9.21 | 4.5 | PASS |
| 新建定时 dialog (r3 92) › save (brand fill) | text | 7.41 | 8.24 | 4.5 | PASS |
| sched select menu (open) › select row text | text | 15.86 | 13.09 | 4.5 | PASS |
| sched select menu (open) › select row selected | text | 15.86 | 13.09 | 4.5 | PASS |
| sched select menu (open) › select check glyph | ui | 15.86 | 13.09 | 3 | PASS |
| project files pane (r2 24) › topbar tab selected | text | 15.86 | 13.09 | 4.5 | PASS |
| project files pane (r2 24) › topbar tab unselected | text | 15.86 | 13.09 | 4.5 | PASS |
| project files pane (r2 24) › branch chip text | text | 10.12 | 9.21 | 4.5 | PASS |
| project files pane (r2 24) › branch chip glyph | ui | 5.98 | 6.55 | 3 | PASS |
| project files pane (r2 24) › files seg selected | text | 15.86 | 13.09 | 4.5 | PASS |
| project files pane (r2 24) › files seg unselected | text | 10.12 | 9.21 | 4.5 | PASS |
| project files pane (r2 24) › file row name | text | 10.72 | 10.2 | 4.5 | PASS |
| project files pane (r2 24) › file row glyph | ui | 6.34 | 7.25 | 3 | PASS |
| project files pane (r2 24) › viewer placeholder (dim) | text | 6.34 | 7.25 | 3 | PASS |
| project file content (row selected) › file content pre | text | 15.86 | 13.09 | 4.5 | PASS |
| project file content (row selected) › selected row name (on surface-hover) | text | 10.12 | 9.21 | 4.5 | PASS |
| project file content (row selected) › history seg unselected | text | 10.12 | 9.21 | 4.5 | PASS |
| project tasks toolbar + rows (prj-tasks) › search input placeholder | text | 6.34 | 7.25 | 4.5 | PASS |
| project tasks toolbar + rows (prj-tasks) › search input text | text | 15.86 | 13.09 | 4.5 | PASS |
| project tasks toolbar + rows (prj-tasks) › filter trigger text | text | 10.72 | 10.2 | 4.5 | PASS |
| project tasks toolbar + rows (prj-tasks) › filter trigger chevron (dim) | ui | 6.34 | 7.25 | 3 | PASS |
| project tasks toolbar + rows (prj-tasks) › view tab selected glyph | ui | 15.86 | 13.09 | 3 | PASS |
| project tasks toolbar + rows (prj-tasks) › view tab idle glyph | ui | 5.98 | 6.55 | 3 | PASS |
| project tasks toolbar + rows (prj-tasks) › task row title link | text | 14.96 | 11.81 | 4.5 | PASS |
| project tasks toolbar + rows (prj-tasks) › task row time (dim) | text | 5.98 | 6.55 | 3 | PASS |
| project tasks toolbar + rows (prj-tasks) › avatar status dot | ui | 14.96 | 11.81 | 3 | PASS |
| tasks toolbar menu (open) › menu row text | text | 15.86 | 13.09 | 4.5 | PASS |
| tasks toolbar menu (open) › menu check glyph (brand) | ui | 6.14 | 7.61 | 3 | PASS |
| tasks grid cards › card title link | text | 14.96 | 11.81 | 4.5 | PASS |
| tasks grid cards › card time (dim) | text | 5.98 | 6.55 | 3 | PASS |
| tasks empty state (r2 24b) › empty title | text | 15.86 | 13.09 | 4.5 | PASS |
| tasks empty state (r2 24b) › empty desc (dim) | text | 6.34 | 7.25 | 3 | PASS |
| tasks empty state (r2 24b) › empty new (brand fill) | text | 7.41 | 8.24 | 4.5 | PASS |
| project settings (r2 24c) › settings tab selected | text | 15.86 | 13.09 | 4.5 | PASS |
| project settings (r2 24c) › avatar initial | text | 9.38 | 7.07 | 4.5 | PASS |
| project settings (r2 24c) › row label | text | 10.12 | 9.21 | 4.5 | PASS |
| project settings (r2 24c) › row value | text | 14.96 | 11.81 | 4.5 | PASS |
| project settings (r2 24c) › hosted chip (dim on tertiary) | text | 5.55 | 5.03 | 3 | PASS |
| project settings (r2 24c) › branch chip text | text | 15.86 | 13.09 | 4.5 | PASS |
| project settings (r2 24c) › danger label | text | 10.72 | 10.2 | 4.5 | PASS |
| project settings (r2 24c) › danger title | text | 14.96 | 11.81 | 4.5 | PASS |
| project settings (r2 24c) › danger desc (tertiary) | text | 15.86 | 13.09 | 4.5 | PASS |
| project settings (r2 24c) › delete btn (--danger solid fill) | text | 7.25 | 9.56 | 4.5 | PASS |
| new project form (01) › avatar tile glyph (dim) | ui | 5.98 | 6.55 | 3 | PASS |
| new project form (01) › caption (dim) | text | 6.34 | 7.25 | 3 | PASS |
| new project form (01) › field label | text | 10.72 | 10.2 | 4.5 | PASS |
| new project form (01) › name input placeholder | text | 6.34 | 7.25 | 4.5 | PASS |
| new project form (01) › name input text | text | 15.86 | 13.09 | 4.5 | PASS |
| new project form (01) › repo trigger placeholder span | text | 6.34 | 7.25 | 4.5 | PASS |
| new project form (01) › repo trigger chevron (dim) | ui | 6.34 | 7.25 | 3 | PASS |
| new project local face (browse + swap) › path input text | text | 15.86 | 13.09 | 4.5 | PASS |
| new project local face (browse + swap) › browse btn text | text | 10.72 | 10.2 | 4.5 | PASS |
| new project local face (browse + swap) › swap chevron (dim) | ui | 6.34 | 7.25 | 3 | PASS |
| github picker (github-picker) › picker head login | text | 10.72 | 10.2 | 4.5 | PASS |
| github picker (github-picker) › disconnect link (dim) | text | 6.34 | 7.25 | 3 | PASS |
| github picker (github-picker) › search input text | text | 15.86 | 13.09 | 4.5 | PASS |
| github picker (github-picker) › repo option row | text | 15.86 | 13.09 | 4.5 | PASS |
| github picker (github-picker) › footer manual link (dim) | text | 6.34 | 7.25 | 3 | PASS |

## Findings & disposition (human review, #946)

The migration itself is equal-value (same token pairs as the retired pages.css rules, sealed #909 palette, #915-flipped values) — it introduced no new pair except the one deliberate slot swap in item 2. Per better-colors report-not-repaint + #908 ruling 2 (comment-6001887439: domain tickets may move consumer slot references, token values stay frozen):

1. **`--text-dim` small text/glyphs (11–13px) on surface/carrier faces — below the canon floor in light mode.** First measurement: 2.89:1 on `--surface` / 2.73:1 on `--surface-secondary` / 2.53:1 on `--surface-tertiary` (light); dark passes except the hosted chip on `--surface-tertiary` (2.40:1). Canon §1.7/1.8 gates `--text-dim` at floor 3 via its `--text-dim on --background` pair (3.75/3.05) — every pages face renders dim ink on a lifted surface, so the whole light-mode dim family falls under the canon's own floor. Same finding and disposition as #944 (resources): per ruling 2 EVERY affected pages-domain consumer swapped `text-(--text-dim)` → `text-(--text-tertiary)` (~20 faces: sched card dim line + seps, tz note, empty hint, select/filter/branch/file-row/swap chevrons, viewer placeholder, history meta, task+card time, tasks nomatch, issues num/page/empty, pager buttons, settings hosted chip, new-project caption + tile glyph, gh disconnect/manual links, picker empty, dir-browser dots/empty/trunc/crumb-sep — the last four are live-only faces carrying the identical pairs). Re-measured after the swap: see the table rows — all PASS both themes.
2. **GitHub files link slot swap (`--accent` → `--card-button`).** The retired `.prj-files-github-link` rule referenced `--accent` — a soft-divider slot (≈1.1:1 on surface in both themes, invisible as link ink) contradicting the face's own comment (「链接用主题色」= brand). Per ruling 2 the consumer now references the brand slot `--card-button`; the pair `--card-button on --surface` is the measured `新建 action` row (8.24 dark / 6.14-class light — PASS ≥4.5). This is the ticket's only intentional color change beyond item 1.
3. **Report-only families (not gated, per canon §1.3):** seg-hover tint (`--seg-hover` translucent over group fill — interactive-state tint, state also carried by fill/aria), overlay scrim (`--overlay-scrim`), disabled opacities (0.55 chains — state carried by the disabled attribute, not color). Not repainted.

## Surfaces not measurable on the fixture stack

- **dir-browser overlay + inline error/hint rows (prj-new)** — live-only faces (fs/pick 422 / server 400 stubs); their pairs are identical to measured rows: error ink `--danger` on plate/surface (canon §1.7/1.8 gate pair 9.56/6.33 ≥3), hint `--text-secondary` on `--surface` (11.05/11.3), plate rows `--text-primary` on `--popover-bg` (13.09/15.86), dim-family faces swapped with item 1.
- **github-project files link** — requires a live github-kind project; pair = item 2 (measured via the identical `--card-button on --surface` row).

