# #812 evidence — composer `@` select renders a chip

## What was stiff (pinned on hardware before the fix)

After Tab/Enter/click accepted a row, the composer showed dead text only:
a bare path for files (`apps/web/src/ui/button.tsx `), raw markdown for
agents (`[builder](agent:agent-1)`). No chip, no transition — the listbox
just vanished. `before-select.gif` freezes that beat frame by frame.

## What the fix does

The detail composer grows a confirmation strip above the card: once the
listbox closes, the settled mentions in the draft render as chips in the
transcript's own `.mention-chip` face (agents green, files slate), and each
first-appearance chip pops in with the listbox's enter animation
(`animate-in fade-in-0 zoom-in-98`, 100ms; covered by the site-wide
reduced-motion reset). The strip yields while any completion popup is open
and unmounts on an empty row, so the static/fixture composer DOM is
byte-identical. The wire is untouched — files stay bare paths (#760 stands),
Tab/Enter/click converge on the same insert chain so all three render the
identical chip.

`after-select.gif` freezes the fixed beat: list open → Enter → chip pops
above the composer while the raw path stays in the textarea.

## Proof

- `apps/web/test/mention-token.test.ts` → `parseDraftChips` block, 11 tests
  (roster-exact file match, whitespace boundaries, quoted paths, dir `/`
  labels, longest-first overlap, attachment tokens never chip, draft order).
- `apps/web/e2e/composer-inline-mention.spec.ts` → `chips:` block, 5 tests:
  file chip + fresh pop on Enter, agent chip, Tab/click identical chip,
  edit retires the chip / pop plays once, strip yields to the listbox. The
  fresh-pop test also pins the mechanism (`getComputedStyle().animationName
  !== 'none'` — the class compiled and applies, #746 discipline).
- Full affected run: **753/753 passed** (`/tmp/812-affected.log` on the run
  machine; rerun `pnpm --filter @pacman/web e2e:affected` to reproduce).
- `chips-file-fresh.png` — the settled state (chip above, path in draft).
- `before-select.gif` / `after-select.gif` — the select→render beat before
  (dead text) and after (chip pop). Before frames taken on an
  `origin/main` one-shot worktree running the same probe script.

## Files

- `before-select.gif` — before: select lands dead text, no chip.
- `after-select.gif` — after: select pops the file chip with a light transition.
- `chips-file-fresh.png` — after still frame (chip + draft path).
