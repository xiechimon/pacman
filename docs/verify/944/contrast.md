# #944 resources domain — measured contrast (better-colors pass)

Fixture stack http://127.0.0.1:8400, 1440×732, chromium. Foreground = computed color /
svg fill / element background (per measure mode); background = the ancestor
background stack composited (alpha layers folded, canvas-normalized so
oklab/color(srgb) serializations measure exactly). Thresholds: 4.5 text,
3.0 large text (≥24px or ≥18.66px bold) and non-text UI. Palette sealed
(#909), values = #915 flip (spec/22 §1.7/1.8); #944 is an equal-value
migration, so every finding below predates this ticket. Failing pairs are
reported, not repainted (better-colors report-not-repaint).

| surface › pair | kind | light | dark | threshold | verdict |
| --- | --- | --- | --- | --- | --- |
| skills rows + search/sort › topbar title | text | 15.86 | 13.09 | 4.5 | PASS |
| skills rows + search/sort › topbar 新建 action | text | 6.14 | 7.61 | 4.5 | PASS |
| skills rows + search/sort › topbar back chevron | ui | 6.34 | 7.25 | 3 | PASS |
| skills rows + search/sort › search input text | text | 15.86 | 13.09 | 4.5 | PASS |
| skills rows + search/sort › search placeholder | text | 6.34 | 7.25 | 4.5 | PASS |
| skills rows + search/sort › sort trigger | text | 10.72 | 10.2 | 4.5 | PASS |
| skills rows + search/sort › row title | text | 14.96 | 11.81 | 4.5 | PASS |
| skills rows + search/sort › row desc (strong) | text | 10.12 | 9.21 | 4.5 | PASS |
| skills rows + search/sort › row chevron | ui | 2.73 | 3.12 | 3 | FAIL |
| skills rows + search/sort › tile glyph (orange sm) | ui | 5.53 | 7.6 | 3 | PASS |
| skills sort menu (open) › menu row text | text | 15.86 | 13.09 | 4.5 | PASS |
| skills sort menu (open) › menu row checked (on spot-soft) | text | 12.81 | 9.95 | 4.5 | PASS |
| skills sort menu (open) › menu check indicator | ui | 4.96 | 5.78 | 3 | PASS |
| skills empty state › empty title | text | 15.86 | 13.09 | 4.5 | PASS |
| skills empty state › empty desc | text | 6.34 | 7.25 | 4.5 | PASS |
| skills empty state › empty primary (brand sm) | text | 7.41 | 8.24 | 4.5 | PASS |
| skills empty state › hero tile glyph | ui | 4.71 | 7.6 | 3 | PASS |
| skill dialog (filled, submit enabled) › dialog label | text | 15.86 | 13.09 | 4.5 | PASS |
| skill dialog (filled, submit enabled) › dialog input text | text | 15.86 | 11.83 | 4.5 | PASS |
| skill dialog (filled, submit enabled) › dialog textarea text | text | 15.86 | 11.83 | 4.5 | PASS |
| skill dialog (filled, submit enabled) › dialog note | text | 6.34 | 7.25 | 4.5 | PASS |
| skill dialog (filled, submit enabled) › dialog submit (brand) | text | 7.41 | 8.24 | 4.5 | PASS |
| machines rows › machine row title | text | 14.96 | 11.81 | 4.5 | PASS |
| machines rows › machine row desc | text | 2.73 | 3.12 | 4.5 | FAIL |
| machines rows › online dot (done green) | ui | 4.94 | 7.66 | 3 | PASS |
| machines rows › runtime mark on (pi) | ui | 1.82 | 6.14 | 3 | FAIL |
| machines rows › runtime mark off (cc, 35%) | ui | 1.35 | 1.71 | 3 | FAIL |
| machines rows › shell switch label | text | 2.73 | 3.12 | 4.5 | FAIL |
| machines rows › 添加机器 dashed action | text | 2.89 | 3.46 | 4.5 | FAIL |
| machines rows (offline dot) › offline dot (idle) | ui | 5.23 | 7.27 | 3 | PASS |
| machines rows (offline dot) › orchestration host badge | text | 14.96 | 11.81 | 4.5 | PASS |
| machines rows (offline dot) › orchestration running | text | 2.73 | 3.12 | 4.5 | FAIL |
| machines rows (offline dot) › orchestration waiting | text | 2.73 | 3.12 | 4.5 | FAIL |
| machines rows (offline dot) › status dot leading running | ui | 4.94 | 7.66 | 3 | PASS |
| machine dialog (disclosure open) › enroll lead | text | 10.72 | 10.2 | 4.5 | PASS |
| machine dialog (disclosure open) › enroll desc | text | 6.34 | 7.25 | 4.5 | PASS |
| machine dialog (disclosure open) › enroll step label | text | 15.86 | 13.09 | 4.5 | PASS |
| machine dialog (disclosure open) › enroll code | text | 14.96 | 11.81 | 4.5 | PASS |
| machine dialog (disclosure open) › enroll copy (brand xs) | text | 7.41 | 8.24 | 4.5 | PASS |
| machine dialog (disclosure open) › enroll disclosure (ghost) | text | 14.96 | 11.81 | 4.5 | PASS |
| machine dialog (disclosure open) › enroll key link | text | 15.86 | 13.09 | 4.5 | PASS |
| machine dialog (disclosure open) › enroll browser link | text | 15.86 | 13.09 | 4.5 | PASS |
| providers tabs + pi model rows › runtime head name | text | 14.96 | 11.81 | 4.5 | PASS |
| providers tabs + pi model rows › runtime head status | text | 2.73 | 3.12 | 4.5 | FAIL |
| providers tabs + pi model rows › runtime head desc | text | 5.98 | 6.55 | 4.5 | PASS |
| providers tabs + pi model rows › model row title | text | 14.96 | 11.81 | 4.5 | PASS |
| providers tabs + pi model rows › model row id desc | text | 2.73 | 3.12 | 4.5 | FAIL |
| providers tabs + pi model rows › tab selected | text | 15.86 | 13.09 | 4.5 | PASS |
| providers tabs + pi model rows › tab unselected | text | 10.12 | 9.21 | 4.5 | PASS |
| providers cc tab (slot tags + 未安装 missing state) › model slot tag | text | 5.26 | 8.2 | 4.5 | PASS |
| providers cc tab (slot tags + 未安装 missing state) › runtime head name (cc) | text | 14.96 | 11.81 | 4.5 | PASS |
| providers cc-missing (未安装 hint + runtime-empty) › runtime head 未安装 (orange) | text | 5.26 | 8.2 | 4.5 | PASS |
| providers cc-missing (未安装 hint + runtime-empty) › runtime head install hint | text | 2.73 | 3.12 | 4.5 | FAIL |
| providers no-source (runtime-empty text) › runtime empty text | text | 6.34 | 7.25 | 4.5 | PASS |
| provider picker (rows before filter) › picker row text | text | 15.86 | 13.09 | 4.5 | PASS |
| provider picker (rows before filter) › picker OAuth chip | text | 5.98 | 6.55 | 4.5 | PASS |
| provider picker (rows before filter) › picker unwired note chip | text | 6.34 | 7.25 | 4.5 | PASS |
| provider picker (rows before filter) › picker custom entry | text | 15.86 | 13.09 | 4.5 | PASS |
| provider picker (rows before filter) › picker search text | text | 15.86 | 11.83 | 4.5 | PASS |
| provider picker (rows before filter) › picker search placeholder | text | 10.72 | 6.56 | 4.5 | PASS |
| provider key form › form label | text | 15.86 | 13.09 | 4.5 | PASS |
| provider key form › form input text | text | 15.86 | 11.83 | 4.5 | PASS |
| provider key form › form seg tab selected | text | 16.71 | 10.95 | 4.5 | PASS |
| provider key form › form seg tab unselected | text | 4.62 | 6.55 | 4.5 | PASS |
| provider key form › form note | text | 6.34 | 7.25 | 4.5 | PASS |
| provider key form › checkbox row label | text | 7.41 | 8.24 | 4.5 | PASS |
| provider key form › model-add (ghost) | text | 10.72 | 10.2 | 4.5 | PASS |
| provider key form › back (ghost) | text | 10.72 | 10.2 | 4.5 | PASS |
| provider key form › submit (brand) | text | 7.41 | 8.24 | 4.5 | PASS |
| secrets empty (with hint) › empty title | text | 15.86 | 13.09 | 4.5 | PASS |
| secrets empty (with hint) › empty desc | text | 6.34 | 7.25 | 4.5 | PASS |
| secrets empty (with hint) › empty hint row | text | 2.89 | 3.46 | 4.5 | FAIL |
| mcp rows › mcp row title | text | 14.96 | 11.81 | 4.5 | PASS |
| mcp rows › mcp row kind | text | 2.73 | 3.12 | 4.5 | FAIL |
| mcp rows › mcp row url desc | text | 2.73 | 3.12 | 4.5 | FAIL |
| mcp rows › mcp row ago | text | 2.73 | 3.12 | 4.5 | FAIL |

## Findings & disposition (human review, #944)

Every non-pass pair below is an equal-value carry-over of the pre-#944 per-face CSS (same token pairs, sealed #909 palette, #915-flipped values) — the migration introduced no new pair. Per better-colors report-not-repaint, they are reported for the visual-direction line (#909/#915 family) instead of repainted inside a domain ticket:

1. **`--text-dim` small text (12–13px) on card/panel surfaces** — measured 2.73:1 light / 3.12:1 dark on `--surface-secondary` (2.89/3.46 on `--surface`). Canon §1.7/1.8 registered `--text-dim on --background` at threshold 3 (3.05/3.75 PASS); the rendered surfaces sit one step off `--background` and the text is normal-size (threshold 4.5), so the registered pass does not cover these pairs. Affected: machine row desc / shell-switch label / 添加机器 dashed action / orchestration running+waiting / runtime-head status + install hint / model-row id desc / secrets empty hint / mcp kind+url+ago / skills row chevron (ui, 2.73 light < 3). Disposition candidates for the visual-direction ticket: demote these strings to `--text-tertiary` (measured 5.98/6.55 PASS on the same surfaces), or accept as secondary-metadata softness.
2. **pi/Claude Code brand marks (light)** — first glyph fill #F09082 on `--surface-secondary` = 1.82:1 (off state 35% opacity composites to 1.35:1). Official brand assets, aria-hidden decoration: the readable name rides `role=img + aria-label + title` and the on/off state rides `data-enabled` + opacity (not color alone), so WCAG 1.4.1 state carrier is satisfied; graphical contrast (1.4.11) is not, in light theme. Not repaintable (brand canon) — reported as-is.

## Surfaces not measurable on the fixture stack

- **StatusPill (`未启用`)** — no reachable consumer: `machine.pill` is set by no fixture scenario and no live mapper (dormant API). Token-declared pair (NOT a surface measurement): `--text-dim` on `--pill-idle-bg` = light #8d8980/#e8e3da ≈ 3.0:1, dark #79756f/#2d2a24 ≈ 3.2:1 — below 4.5 for its 11px text; folds into the `--text-dim` finding below.
- **A3 runtime-empty action (brand sm button)** — fixture pi segment always carries models, so the 「尚未添加服务商」 block with its action never renders on fixture; the recipe is byte-identical to the measured `empty primary (brand sm)` row (same Button brand/sm + text override), and the live-stack run re-measures it (see live/contrast-live.json when present).

## Non-pass rows (detail)

- **skills rows + search/sort › row chevron**
  - light: {"step":"skills rows + search/sort","label":"row chevron","kind":"ui","theme":"light","ratio":2.73,"threshold":3,"status":"FAIL","fgCss":"rgb(141, 137, 128)","fgRgb":"141,137,128,1","bgRgb":"232,227,218","fontSize":"14px","fontWeight":"400"}
  - dark: {"step":"skills rows + search/sort","label":"row chevron","kind":"ui","theme":"dark","ratio":3.12,"threshold":3,"status":"PASS","fgCss":"rgb(121, 117, 111)","fgRgb":"121,117,111,1","bgRgb":"45,42,36","fontSize":"14px","fontWeight":"400"}
- **machines rows › machine row desc**
  - light: {"step":"machines rows","label":"machine row desc","kind":"text","theme":"light","ratio":2.73,"threshold":4.5,"status":"FAIL","fgCss":"rgb(141, 137, 128)","fgRgb":"141,137,128,1","bgRgb":"232,227,218","fontSize":"12px","fontWeight":"400"}
  - dark: {"step":"machines rows","label":"machine row desc","kind":"text","theme":"dark","ratio":3.12,"threshold":4.5,"status":"FAIL","fgCss":"rgb(121, 117, 111)","fgRgb":"121,117,111,1","bgRgb":"45,42,36","fontSize":"12px","fontWeight":"400"}
- **machines rows › runtime mark on (pi)**
  - light: {"step":"machines rows","label":"runtime mark on (pi)","kind":"ui","theme":"light","ratio":1.82,"threshold":3,"status":"FAIL","fgCss":"rgb(240, 144, 130)","fgRgb":"240,144,130,1","bgRgb":"232,227,218","fontSize":"14px","fontWeight":"400"}
  - dark: {"step":"machines rows","label":"runtime mark on (pi)","kind":"ui","theme":"dark","ratio":6.14,"threshold":3,"status":"PASS","fgCss":"rgb(240, 144, 130)","fgRgb":"240,144,130,1","bgRgb":"45,42,36","fontSize":"14px","fontWeight":"400"}
- **machines rows › runtime mark off (cc, 35%)**
  - light: {"step":"machines rows","label":"runtime mark off (cc, 35%)","kind":"ui","theme":"light","note":"glyph opacity 0.35 composited into effective ink","ratio":1.35,"threshold":3,"status":"FAIL","fgCss":"rgb(217, 119, 87)","fgRgb":"227,189,172,1","bgRgb":"232,227,218","fontSize":"14px","fontWeight":"400"}
  - dark: {"step":"machines rows","label":"runtime mark off (cc, 35%)","kind":"ui","theme":"dark","note":"glyph opacity 0.35 composited into effective ink","ratio":1.71,"threshold":3,"status":"FAIL","fgCss":"rgb(217, 119, 87)","fgRgb":"105,69,54,1","bgRgb":"45,42,36","fontSize":"14px","fontWeight":"400"}
- **machines rows › shell switch label**
  - light: {"step":"machines rows","label":"shell switch label","kind":"text","theme":"light","ratio":2.73,"threshold":4.5,"status":"FAIL","fgCss":"rgb(141, 137, 128)","fgRgb":"141,137,128,1","bgRgb":"232,227,218","fontSize":"12px","fontWeight":"400"}
  - dark: {"step":"machines rows","label":"shell switch label","kind":"text","theme":"dark","ratio":3.12,"threshold":4.5,"status":"FAIL","fgCss":"rgb(121, 117, 111)","fgRgb":"121,117,111,1","bgRgb":"45,42,36","fontSize":"12px","fontWeight":"400"}
- **machines rows › 添加机器 dashed action**
  - light: {"step":"machines rows","label":"添加机器 dashed action","kind":"text","theme":"light","ratio":2.89,"threshold":4.5,"status":"FAIL","fgCss":"rgb(141, 137, 128)","fgRgb":"141,137,128,1","bgRgb":"239,233,225","fontSize":"13px","fontWeight":"400"}
  - dark: {"step":"machines rows","label":"添加机器 dashed action","kind":"text","theme":"dark","ratio":3.46,"threshold":4.5,"status":"FAIL","fgCss":"rgb(121, 117, 111)","fgRgb":"121,117,111,1","bgRgb":"37,34,29","fontSize":"13px","fontWeight":"400"}
- **machines rows (offline dot) › orchestration running**
  - light: {"step":"machines rows (offline dot)","label":"orchestration running","kind":"text","theme":"light","ratio":2.73,"threshold":4.5,"status":"FAIL","fgCss":"rgb(141, 137, 128)","fgRgb":"141,137,128,1","bgRgb":"232,227,218","fontSize":"12px","fontWeight":"400"}
  - dark: {"step":"machines rows (offline dot)","label":"orchestration running","kind":"text","theme":"dark","ratio":3.12,"threshold":4.5,"status":"FAIL","fgCss":"rgb(121, 117, 111)","fgRgb":"121,117,111,1","bgRgb":"45,42,36","fontSize":"12px","fontWeight":"400"}
- **machines rows (offline dot) › orchestration waiting**
  - light: {"step":"machines rows (offline dot)","label":"orchestration waiting","kind":"text","theme":"light","ratio":2.73,"threshold":4.5,"status":"FAIL","fgCss":"rgb(141, 137, 128)","fgRgb":"141,137,128,1","bgRgb":"232,227,218","fontSize":"12px","fontWeight":"400"}
  - dark: {"step":"machines rows (offline dot)","label":"orchestration waiting","kind":"text","theme":"dark","ratio":3.12,"threshold":4.5,"status":"FAIL","fgCss":"rgb(121, 117, 111)","fgRgb":"121,117,111,1","bgRgb":"45,42,36","fontSize":"12px","fontWeight":"400"}
- **providers tabs + pi model rows › runtime head status**
  - light: {"step":"providers tabs + pi model rows","label":"runtime head status","kind":"text","theme":"light","ratio":2.73,"threshold":4.5,"status":"FAIL","fgCss":"rgb(141, 137, 128)","fgRgb":"141,137,128,1","bgRgb":"232,227,218","fontSize":"12px","fontWeight":"400"}
  - dark: {"step":"providers tabs + pi model rows","label":"runtime head status","kind":"text","theme":"dark","ratio":3.12,"threshold":4.5,"status":"FAIL","fgCss":"rgb(121, 117, 111)","fgRgb":"121,117,111,1","bgRgb":"45,42,36","fontSize":"12px","fontWeight":"400"}
- **providers tabs + pi model rows › model row id desc**
  - light: {"step":"providers tabs + pi model rows","label":"model row id desc","kind":"text","theme":"light","ratio":2.73,"threshold":4.5,"status":"FAIL","fgCss":"rgb(141, 137, 128)","fgRgb":"141,137,128,1","bgRgb":"232,227,218","fontSize":"12px","fontWeight":"400"}
  - dark: {"step":"providers tabs + pi model rows","label":"model row id desc","kind":"text","theme":"dark","ratio":3.12,"threshold":4.5,"status":"FAIL","fgCss":"rgb(121, 117, 111)","fgRgb":"121,117,111,1","bgRgb":"45,42,36","fontSize":"12px","fontWeight":"400"}
- **providers cc-missing (未安装 hint + runtime-empty) › runtime head install hint**
  - light: {"step":"providers cc-missing (未安装 hint + runtime-empty)","label":"runtime head install hint","kind":"text","theme":"light","ratio":2.73,"threshold":4.5,"status":"FAIL","fgCss":"rgb(141, 137, 128)","fgRgb":"141,137,128,1","bgRgb":"232,227,218","fontSize":"12px","fontWeight":"400"}
  - dark: {"step":"providers cc-missing (未安装 hint + runtime-empty)","label":"runtime head install hint","kind":"text","theme":"dark","ratio":3.12,"threshold":4.5,"status":"FAIL","fgCss":"rgb(121, 117, 111)","fgRgb":"121,117,111,1","bgRgb":"45,42,36","fontSize":"12px","fontWeight":"400"}
- **secrets empty (with hint) › empty hint row**
  - light: {"step":"secrets empty (with hint)","label":"empty hint row","kind":"text","theme":"light","ratio":2.89,"threshold":4.5,"status":"FAIL","fgCss":"rgb(141, 137, 128)","fgRgb":"141,137,128,1","bgRgb":"239,233,225","fontSize":"13px","fontWeight":"400"}
  - dark: {"step":"secrets empty (with hint)","label":"empty hint row","kind":"text","theme":"dark","ratio":3.46,"threshold":4.5,"status":"FAIL","fgCss":"rgb(121, 117, 111)","fgRgb":"121,117,111,1","bgRgb":"37,34,29","fontSize":"13px","fontWeight":"400"}
- **mcp rows › mcp row kind**
  - light: {"step":"mcp rows","label":"mcp row kind","kind":"text","theme":"light","ratio":2.73,"threshold":4.5,"status":"FAIL","fgCss":"rgb(141, 137, 128)","fgRgb":"141,137,128,1","bgRgb":"232,227,218","fontSize":"12px","fontWeight":"400"}
  - dark: {"step":"mcp rows","label":"mcp row kind","kind":"text","theme":"dark","ratio":3.12,"threshold":4.5,"status":"FAIL","fgCss":"rgb(121, 117, 111)","fgRgb":"121,117,111,1","bgRgb":"45,42,36","fontSize":"12px","fontWeight":"400"}
- **mcp rows › mcp row url desc**
  - light: {"step":"mcp rows","label":"mcp row url desc","kind":"text","theme":"light","ratio":2.73,"threshold":4.5,"status":"FAIL","fgCss":"rgb(141, 137, 128)","fgRgb":"141,137,128,1","bgRgb":"232,227,218","fontSize":"12px","fontWeight":"400"}
  - dark: {"step":"mcp rows","label":"mcp row url desc","kind":"text","theme":"dark","ratio":3.12,"threshold":4.5,"status":"FAIL","fgCss":"rgb(121, 117, 111)","fgRgb":"121,117,111,1","bgRgb":"45,42,36","fontSize":"12px","fontWeight":"400"}
- **mcp rows › mcp row ago**
  - light: {"step":"mcp rows","label":"mcp row ago","kind":"text","theme":"light","ratio":2.73,"threshold":4.5,"status":"FAIL","fgCss":"rgb(141, 137, 128)","fgRgb":"141,137,128,1","bgRgb":"232,227,218","fontSize":"12px","fontWeight":"400"}
  - dark: {"step":"mcp rows","label":"mcp row ago","kind":"text","theme":"dark","ratio":3.12,"threshold":4.5,"status":"FAIL","fgCss":"rgb(121, 117, 111)","fgRgb":"121,117,111,1","bgRgb":"45,42,36","fontSize":"12px","fontWeight":"400"}

