# docs/verify/848 — 内联 @ 开五类（#727 D3 落地）

## What changed

The detail/chief inline `@` listbox grows from agents(+files) to all five
entity kinds + files, in one fuzzy pass (`buildInlineRows` in
`apps/web/src/overlay/mention-token.ts`, same CC rules 14-18 matcher as #728).
Order: agents → todo → skill → project → machine → files. Insert reuses
`serializeMention` (`[label](scheme:id)`, todo stays plain `#seq`); the `#812`
chip strip confirms scheme inserts. `/` menu, popover, trigger boundary,
Enter law, and IME guard are untouched.

## Shots (this spec only: `e2e/composer-inline-mention.spec.ts`)

| shot | shows |
|---|---|
| `five-kind-list.png` | bare `@`: 7 rows — 3 agents, todo `#9`, skill, project, machine |
| `five-kind-skill-insert.png` | `@code` + Tab → `[code-review](skill:skill-1)` + skill chip |
| `trigger-cjk-boundary.png` | CJK-punctuation trigger (unchanged #728 feel) |
| `filter-smart-case-empty.png` | smart-case empty state (unchanged) |
| `keyboard-highlight.png` | arrow cycling over the 5-row roster |
| `enter-inserts-not-sends.png` | Enter inserts, second Enter sends (unchanged) |
| `multiple-mentions.png` | two consecutive inserts (unchanged) |
| `hover-highlight.png` | hover highlight (unchanged) |
| `popover-multi-insert.png` | popover multi-select still lands both tokens |
| `files-unified-list.png` | empty query: entities then files in roster order |
| `files-insert-path.png` | file Enter-inserts the bare path |
| `chips-file-fresh.png` | file chip fresh pop |

Todo (`@内联` → `#9 `) and machine (`@mea` → `[mea](machine:…)`, send on
second Enter) are asserted by value in the spec; project (`@pacm` click →
`[pacman](project:proj-1)` + project chip) likewise. No separate shots:
the rows are visible in `five-kind-list.png` and the wire forms are
byte-asserted.

## Regenerate

```sh
E2E_PORT=<free-port> PACMAN_E2E_EVIDENCE=docs/verify/848 \
  pnpm --filter @pacman/web exec playwright test e2e/composer-inline-mention.spec.ts
```

Check the port first (`lsof -iTCP:<port>`): a squatter lane's preview server
plus `reuseExistingServer` silently tests THEIR build (this ticket caught
8401 serving `t-0166-849` mid-run — 9 phantom failures, evidence deleted
and re-shot). Never kill the squatter; move ports.
