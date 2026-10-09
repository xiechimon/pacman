# #1036 dead-class gate — verification evidence

Gate: `scripts/ui-dead-class-gate.mjs` (advisory CI job `dead-class-gate`).
Run locally after `pnpm install`:

```sh
node scripts/ui-dead-class-gate.mjs            # dist if present, else postcss compile
node scripts/ui-dead-class-gate.mjs --audit    # full zero-hit inventory with dispositions
```

## Files

- `audit-inventory.txt` — full `--audit` output on the branch tree: every
  zero-rule class name with its disposition (245 selector-exempt with the
  referencing file, 3 manual exemptions with reasons, DEAD 0) and every
  rendered site. This is the ticket's "complete list" deliverable.
- `gate-red-historical-pre1033.txt` — the gate run on `1b875feeb0df…^`
  (main immediately before the #1033 fix landed). It reds on 266 names,
  including the exact defect the user hit: `chief-avatar` /
  `chief-avatar--img` (chief-drawer.tsx:890) and `chief-msg-col`
  (:901/:912). The collapsed rendering of that state is archived in
  `docs/verify/1033/before/`; the repaired one in `docs/verify/1033/after/`.
  Note: the run carries the branch's EXEMPTIONS list, so `chief-msg` /
  `chat-text` / `doc-code` show as manual-exempt there by design.
- `gate-red-injection.txt` — negative control on the branch tree: injecting
  one dead token (`board-injected-demo` into board-page.tsx's shell div)
  turns the gate red (exit 1, DEAD 1 with file:line); removing it returns
  green. The injection was never committed.
- `before/`, `after/` — inert-alias geometry proof for two picked sites:
  `before` = origin/main fixture build (aliases present), `after` = branch
  fixture build (aliases picked). `measurements.json` carries bounding
  boxes, computed styles and className attributes; `authorize.png` /
  `board.png` are viewport screenshots (1440×732, dark).

## Two-site comparison result

- `/app/machines/authorize` — picked: `authorize-card`, `authorize-title`,
  `authorize-desc`, `authorize-submit` (visible in the className diff of
  `measurements.json`).
- `/app?scenario=board-tags` — picked: `board-column-list` on the measured
  column list (plus `board-column-header/-label/-count/-dot` elsewhere on
  the page, covered by the pixel comparison).
- Every non-className field in the two `measurements.json` files is
  byte-identical; both screenshot pairs are pixel-identical (0 differing
  pixels, `ImageChops.difference`). The picked aliases carried zero rules —
  picking them is a rendering no-op, which is exactly the claim.

Reproduce (`<main-wt>` = a detached worktree at origin/main, both installs
via `corepack pnpm install`):

```sh
(cd <main-wt>/apps/web && pnpm exec vite build --mode fixture)
(cd apps/web && pnpm exec vite build --mode fixture)
# serve the two dists on separate ports, then:
node docs/verify/1036/scripts/probe-geometry.mjs http://127.0.0.1:<before-port> docs/verify/1036/before
node docs/verify/1036/scripts/probe-geometry.mjs http://127.0.0.1:<after-port>  docs/verify/1036/after
```

## Disposition totals (from `audit-inventory.txt` + the deletion diff)

- deleted: 256 zero-rule names with zero selector references anywhere in
  e2e / vitest / integration / scripts / verify-pacman drives — the final
  pick the spec/22 §5.0 alias-residue law parked. Skins live on the
  utility classes beside them; e2e anchors are testids/roles/ids and were
  not touched.
- selector-exempt: 245 names still referenced as CSS selectors by the test
  corpus — kept in place; the ledger rebuilds every run and cannot go
  stale.
- manual exemptions (3): `chief-msg` (#1033 row anchor), `chat-text`
  (#1034 body anchor), `doc-code` (CODE_SKIN map key in segments.tsx).
