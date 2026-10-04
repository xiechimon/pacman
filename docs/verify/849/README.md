# #849 evidence: input border-radius converged to 0 (Base UI official language)

Base UI official hero demos (Input, Field, Form, NumberField, Combobox, OTP,
Button, Menu trigger/popup, Checkbox, Toggle) all use `border-radius: 0`;
the only circle is the Avatar demo (`border-radius: 100%`).
Source: `mui/base-ui` `docs/src/app/(docs)/react/components/*/demos/hero/css-modules/index.module.css`
plus `docs/src/css/index.css` (radius scale, unused by form controls).

## What changed

27 input faces from 8px/6px/`rounded-lg`/`rounded-md`/`rounded` to 0,
across 15 files (see PR diff). First-batch zeroed faces untouched
(checkbox tile, overlay shells, in-face buttons verified still 0).
`--radius` base / `--radius-popover` / `--edge-radius` tokens untouched:
no input face consumes them (sweep R5 verified).

## Runtime before/after (fixture preview + playwright computed style)

- `before.json`: project-new input computed `8px` (`rounded-lg` base);
  search-panel input `0px`; chief composer `0px`.
- `after.json`: every rendered `input, textarea, select` computes to `0px`.
- Screenshots: `before-*.png` / `after-*.png` pairs per surface.

## Verification

- `pnpm -r typecheck`: clean (web, server, daemon, integration).
- `pnpm --filter @pacman/web e2e:affected`: 778 passed, 0 failed.
- Closing re-sweep with the same six grep routes: remaining non-zero radii
  are out-of-scope faces (cards, menu shells, rows, code blocks, buttons —
  owned by face tickets) or proposed exemptions (avatars, fabs, switches,
  dots, pills — listed in the PR body for approval).
