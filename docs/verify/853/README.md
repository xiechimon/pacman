# #853 evidence — chip skins into the ui chip primitive

## What changed (4 files)

- `apps/web/src/overlays/search-panel.tsx` — search-row chip renders
  `<Chip variant size="mini" className="search-row-chip">`.
- `apps/web/src/overlays/overlays.css` — the six `.search-row-chip*` rules
  collapse to a positioning hook (`flex:none; margin-left:auto`); the five
  tone pairs and the mini geometry now come from `ui/chip`.
- `apps/web/src/detail/dhead.tsx` — header chip renders `<Chip>` instead of
  `Badge` + a `CHIP_TONE_CLASS` utility transcription (deleted, 8 lines);
  the `detail-chip--<tone>` locator alias stays in the DOM via passthrough.
- `apps/web/src/detail/detail.css` — comment updated to the new consumer.

## Face verdicts (all four ticket faces)

| Face | Verdict |
|---|---|
| `search-row-chip--*` | Consolidated: exact Chip-mini duplicate, rules deleted. |
| `detail-chip--*` | Consolidated: Badge+utilities transcription swapped for `<Chip>`, alias kept. |
| `mention-chip--*` | Distinct style, untouched: inline transcript token (3px radius, 12px/500, per-kind accent colors), already single-sourced in `overlay/mention-picker.css`. Forcing it into the 18px status pill would change reference-measured visuals (r9, #675/#741 captures). Kind-accent color vs state color is the same boundary `TagChip` documents against `Chip`. |
| `spec-chip--*` | Distinct style, untouched: bordered attachment card with thumbnails (6px radius, up to 160px images, #310 contract), already single-sourced in `detail/detail.css`. Not a pill and cannot become one. |

`mention-chip` kind colors are `rgb()` literals, which the G2 hex gate does
not cover — flagged for the #851 gate owner, not changed here.

## Zero-visual-change proof (runtime truth, fixture build)

`853-computed.json` (written by `probe-853-chips.mjs` on this branch's
fixture build) vs the deleted declarations in `git diff`:

- search chip: `chip chip--confirm chip--mini search-row-chip` →
  height 14px, padding 0 6px, radius 9999px, font 10px/14px.
  Deleted `.search-row-chip` declared exactly 14px / 0 6px / 9999px / 10px / 14px.
- detail chip: `chip chip--confirm detail-chip--confirm …` →
  height 18px, padding 0 7px, radius 9999px, font 11px/16px.
  Deleted utilities declared exactly h-[18px] / px-[7px] / rounded-full /
  text-[11px] / leading-4. Same confirm token pair on both faces.

Screenshots: `853-search-chip.png`, `853-detail-chip.png`.

## Gate and test summary (full logs in `checks.txt`)

- `ui-drift-gate.mjs` (sibling #851 lane script, run read-only against this
  tree): PASS — no live `.btn`, no hex escapes, 6 chip variants single-sourced.
- `pnpm -r typecheck`: all 5 projects pass.
- `pnpm lint`: exit 0.
- `pnpm --filter @pacman/web e2e:affected` (port 8402, 8398 held by a
  neighbor lane): 24/101 specs selected, 152 passed.
- Pinned-face top-up (specs the affected set did not select):
  review-reject, composer-inline-mention, attachment-strip,
  agent-identity-chip, chief-composer-tools — 61 passed.
