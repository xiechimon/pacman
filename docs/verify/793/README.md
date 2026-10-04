# docs/verify/793 — P7 dual-theme contrast re-measure + fixture baseline seal

Ticket: #793 (`web(theme): dual-theme contrast re-measure and fixture baseline seal (P7)`).
Spec: `docs/spec/base-ui-theme.md` §5 (all items). P2–P6 merged; tree = main tip at work time.

## 1. Contrast re-measure (§5.1, better-colors method: rendered pairs, not estimates)

Token-level recomputation (`/tmp/p7-contrast.mjs`, WCAG relative luminance, sRGB straight calc,
tint pairs interpolated per the `color-mix` recipe first; tolerance ±0.02) **plus** in-browser
rendered probes on the final fixture build (`contrast-seal.json`: computed style resolution +
in-page ratio, same formula as `accent-typo.spec.ts`). Both agree to the digit:

| pair | dark | light | gate |
|---|---|---|---|
| main-button `--text-on-accent` on `--card-button` | 8.81 | 5.41 | 4.5 |
| body `--foreground` on `--background` | 14.72 | 15.63 | 4.5 |
| secondary `--text-secondary` on bg | 11.21 | 8.71 | 4.5 |
| muted `--muted-foreground` on bg | 8.22 | 6.54 | 4.5 |
| danger solid `--destructive-foreground` on `--destructive` | 4.92 | 5.02 | 4.5 |
| selected `--spot-text-on-tint` on `--spot-soft` (14% mix) | 6.19 | 4.59 | 4.5 |
| chip-idle (kept pair, §2.6 retest) | 5.95 | 5.87 | 4.5 |
| ring vs paper (non-text) | 5.58 | 3.27 | 3.0 |
| ring vs panel (non-text) | 5.19 | 3.02 | 3.0 |
| menu-icon dark on panel (icon) | 3.44 | — | 3.0 |

Result: **19/19 gate pairs pass, drift 0.00 vs the spec §5.1 gates on every row.**
Guards hold: white-on-dark-red still 3.63 (F2: dark side must stay deep ink) and
spot-on-light-tint still 3.50 (F3: light selected text must stay the deepened `#6d28d9`) —
proving the shipped values are the fix, not the hue.

`--spot-soft` resolves to `#363140` (dark) / `#dacbdd` (light), matching the P1/P5 records.

## 2. Known-open (not a gate, reported not repainted)

`Button` destructive **tint** variant (`bg-destructive/10 text-destructive`,
dark `/20`): token-level 3.56 dark / 3.46 light — below 4.5. It is **not** a §5.1 gate
(spec gates the solid pair, which passes), and better-colors says report-don't-repaint, so
P7 changes no pixels. Status per consumer:

- Converged already (solid per-face skin, `--danger` bg + `--text-on-accent` fg):
  project settings `.prj-set-delete` (XMON-25 pattern; this seal's danger shots show it).
- Still riding the tint variant: delete-confirm dialog confirm (`.delete-confirm-delete`,
  via `alert-dialog-shell`), new-task discard (`.new-task-discard-drop`), agent delete
  (`.agent-delete`). Recommended follow-up: extend the XMON-25 solid pattern to these
  three faces in one ticket (no scope expansion inside P7).

## 3. Fixture baseline seal (§5.3)

Twelve shots, 1440×732, final tree fixture build, dual theme × six groups
(board / dialog / filter / buttons / danger-confirm-opened-not-confirmed / pick-selected-row).
Every overlay shot asserts its face visible before capture (menu/popover/dialog `waitFor` +
animation settle; the seal script's first pass caught two overlay-less frames and re-shot
them with fresh pages — voided frames discarded, not sealed).

- `board-*-seal.png` — four square columns, selected sidebar pill, both themes.
- `dialog-*-seal.png` — new-task dialog open over dimmed board, square shell, brand submit.
- `filter-*-seal.png` — type-filter popover with checked rows over tagfilter board.
- `buttons-*-seal.png` — project-new page, solid brand submit + field ring.
- `danger-*-seal.png` — settings danger card (solid square delete) + open delete-confirm
  with type-to-confirm gate. Nothing was confirmed or deleted.
- `pick-*-seal.png` — chief model menu open, selected row in spot tint + tint ink.
- `contrast-seal.json` — rendered probes (main-button 8.81/5.41, danger-solid 4.92/5.02,
  ring-vs-paper 5.58/3.27, ring-vs-panel 5.19/3.02).

## 4. Checks

- `e2e` theme subset on a dedicated port (E2E_PORT=8411, config loaded from `apps/web`):
  accent-typo, theme-toggle, checkbox-unified, card-press, overlay-focus, sidebar-visual,
  visual-polish, dialog-viewport — **73 passed, 0 failed** (`/tmp/p7-e2e.log`).
  (One voided round: run from the repo root never loaded `playwright.config.ts`, so no
  baseURL/server — 73 fast failures, discarded per the F9 rule, re-run correctly.)
- Full local e2e intentionally not run (multi-lane memory pressure; CI 4-shard full covers it).
- Docs-only change: no `lint`/`typecheck` per repo rules (no product code touched).

## 5. Third-batch convergence list (edge faces, for the coordinator — no expansion in P7)

Faces whose card/row/panel/composer/tab/button shells still carry radius, grouped for a
follow-up ticket. Kept-by-rule items (circles/avatars 50%, pills/chips/kbd, code blocks,
form fields, shared Card/Button/Badge bases, `var(--radius-popover)` popover shells,
team org-chart nodes) are excluded:

- `routes/agent-detail.css`: `.agent-tasks` 10px panel (inputs/selects are fields → keep).
- `secondary/secondary.css` (settings/account/keys/lang): `.team-agent-card`, `.keys-empty-tile`,
  `.keys-once`, `.keys-row` (popover-radius cards/rows), `.team-create-agent` 8px,
  `.team-chart-create` 8px, `.lang-dropdown-row` 8px, `.apikey-form-*` buttons 8px.
- `resources/resources.css`: `.res-card`, `.res-runtime-head` (popover), `.res-tile(-lg/-hero)`
  6/8/12px tiles, `.res-runtime-empty`, `.res-add` 8px (search/sort are fields → keep).
- `detail/overlays.css`: `.dlg-branch-box/.dlg-machine/.dlg-dir/.dlg-toggle/.dlg-sync` 8px boxes,
  `.review-agent-row`, `.review-notice` 6px, `.dlg-provider-custom/note`, `.dlg-enroll-cmd` 8px.
- `overlay/mention-picker.css`: `.mention-picker` 12px shell, `.mention-inline` rows.
- `overlay/overlay.css`, `chief/chief.css`, `detail/detail.css`, `pages/pages.css`,
  `ui/dialog.css`: 8px/6px/12px remnants on sub-elements (per-face triage needed).
- No live `--indigo-*` value references remain (only alias slot names now pointing at spot,
  plus one `#4e47dd` bitmap comment in `board/columns.ts`); `#a855f7` mention purple
  intentionally retained (category color, P1 record).
