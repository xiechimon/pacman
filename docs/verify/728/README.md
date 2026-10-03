# #728 evidence — inline `@` completion aligned with the Claude Code canon

## Before (origin/main, one-shot worktree)

Captured on a detached `origin/main` worktree (`git worktree add --detach
/tmp/pacman-before-728 origin/main` + `corepack pnpm install`) with the
archived probe `before-probe.spec.ts.txt` (copy back to `apps/web/e2e/` of
the MAIN checkout to rerun — it pins the OLD behavior and fails on this
branch by design):

```sh
cd /tmp/pacman-before-728/apps/web
E2E_PORT=8429 PACMAN_E2E_EVIDENCE=/tmp/before-728-shots \
  npx playwright test e2e/before-728-probe.spec.ts   # 5 passed (4.4s)
```

| file | defect observed on main | sequence |
|---|---|---|
| `before-midword-trigger.png` | no left-boundary check: `foo@` opens the list (canon rules 2-3 forbid) | type `foo@` |
| `before-enter-listbox-open.png` | state before the Enter probes | type `@bu` |
| `before-enter-sent.png` | Enter with the list open SENDS the message (r9 §5) — and leaves the stale popup floating over the emptied composer (send never closed the list) | type `@bu`, refocus textarea, Enter → POST count 1 with `@bu`, draft cleared, listbox still visible |
| `before-enter-wrong-row.png` | the OTHER side of the r9 §5 focus race: the open effect focuses the LAST row (one shared ref, `.current` = last), so a raw Enter activates deploy-bot and leaves the `@` residue | type `@`, wait for the steal, `page.keyboard.press('Enter')` → value `[deploy-bot](agent:agent-3)@` |
| `before-click-residue.png` | clicking a row inserts WITHOUT consuming the query and WITHOUT a trailing space | type `@bu`, click row 1 → value `[builder](agent:agent-1)@bu` |
| `before-focus-theft.png` | textarea lost focus to a row (`document.activeElement` = `.mention-inline-row`) — continuous typing and IME break | type `@` |

Note on the r9 §5 "focus race": both Enter facets are real on main and
which one fires depends on whether the focus-steal effect beat the
keystroke — the canon fix removes the race entirely (focus never leaves
the textarea; Enter's meaning is decided by the highlight state).

## After (this branch)

Stack: apps/web e2e on the live face (stubbed boot, no `?scenario=`), spec
`apps/web/e2e/composer-inline-mention.spec.ts`, port `E2E_PORT=8428`.
Regenerate every shot with:

```sh
cd apps/web
E2E_PORT=<free port> PACMAN_E2E_EVIDENCE=docs/verify/728 \
  npx playwright test e2e/composer-inline-mention.spec.ts
```

Roster stub: agents `builder` / `reviewer` / `deploy-bot`. Every row below is
a keyboard (or mouse) sequence → the observable result the spec asserts; the
shot is the state at the named moment. Canon rule numbers are #727 §1
(Claude Code v2.1.285 bundle recon).

| sequence | observed | pin |
|---|---|---|
| type `foo@`, type `a@b.com` | no listbox (mid-word / email never trigger) | spec `trigger:` (rules 2-3) |
| type `@` at start, `hi @bu` after space, `好的。@` after CJK punctuation | listbox opens on all three boundaries | `trigger-cjk-boundary.png` (rule 1) |
| type `@bld` | exactly 1 row `builder` — subsequence, not prefix | spec `filter: fuzzy` (rule 15) |
| type `@Bui` | 0 rows, empty state `没有与"@Bui"匹配的结果` — smart case makes an uppercase query case-sensitive against the lowercase roster | `filter-smart-case-empty.png` (rule 17/51) |
| type `@` | 3 rows in roster order, none highlighted | spec `filter:` + `keyboard:` (rules 8/13/56) |
| stub 20 agents, type `@` | exactly 15 rows | spec `caps at 15` (CN=15) |
| `@` then ↓ ↓ ↑ ↑ ↓ | highlight moves 0→1→0→2(wrap)→0(wrap) | `keyboard-highlight.png` (rule 20) |
| type `@bu`, ↓, Enter | value `[builder](agent:agent-1) ` — token + ONE trailing space, no `@bu` residue; listbox closed; steer POST count 0 | `enter-inserts-not-sends.png` (rules 21/23/26 — the r9 §5 conflict fix) |
| …then Enter again | steer POST count 1, body carries the token; draft clears on the 201 | spec `Enter with a highlight` (second-Enter send) |
| type `@bu`, Enter (no arrow) | POST count 1, body carries `@bu` verbatim — no-highlight Enter still sends | spec `Enter without a highlight` (rule 55/56 isomorph; composer-wire-reject law) |
| type `@bu`, Tab | top match inserted, no POST, textarea still focused | spec `Tab inserts` (rule 22) |
| type `@bu`, hover row | row gains `--active` + `aria-selected`; textarea `role=combobox` `aria-expanded=true` `aria-activedescendant=<row id>`; textarea focused | `hover-highlight.png` (rule 24 + combobox adaptation) |
| …click row | token inserted, textarea STILL focused (row mousedown prevented) | spec `mouse:` (focus-defect fix) |
| `hi @bu`, ↓, Enter, then type `x` | value `hi [builder](agent:agent-1) x` — the `x` lands after the trailing space, caret at end | spec `insert lands a trailing space` (failure mode 6) |
| `@bu`, Esc | listbox closed, URL still `/todo/` (Esc consumed, #634 ladder), text untouched; a following ArrowRight does NOT reopen it | spec `close set: Esc` (rule 32) |
| `@bui`, Backspace ×4 | rows 1→1(`@bu`)→2(`@b`: builder+deploy-bot)→3(`@`)→closed(`` past the trigger) | spec `close set: backspace` (rule 33, failure mode 7) |
| `@bu`, Space | closed — space ends the token | spec `close set: space` (rule 34) |
| `hi @bu`, ← ← ← | still open at `@b` / `@`, closed once the caret passes the `@` — pure selection move, no text change | spec `close set: caret-only moves` (failure mode 3) |
| `hi @bu`, click at textarea x=3 | closed (click caret move re-judges) | same spec |
| `@bu`, click conversation area | closed, draft survives | spec `close set: clicking outside` |
| `@bu` ↓ Enter, then type `@re`, ↓, Enter | value `[builder](agent:agent-1) [reviewer](agent:agent-2) ` — second trigger opens fresh, order preserved | `multiple-mentions.png` (rule 35, failure mode 10) |
| toolbar 提及 → Agents (3) → click builder + reviewer → 插入 (2) | BOTH tokens land in click order with trailing spaces (the old per-token loop kept only the last one) | `popover-multi-insert.png` (failure mode 11) |
| `@bu`, ↓, dispatch `keydown Enter {isComposing:true}` | nothing happens — no insert, no POST, highlight kept; the next real Enter inserts | spec `IME:` (failure mode 8) |
| geometry | listbox bottom ≤ composer top, spans the composer width — anchoring unchanged (#688 ladder untouched) | spec `geometry:` |

Unit pins (run before implementation, red first): `apps/web/test/completion.test.ts`
(33 cases — trigger boundary D1-D5, fuzzy F1-F5, keyboard K1-K7) and
`apps/web/test/mention-token.test.ts` (14 cases — trailing space + caret I1,
range replace I2/I4, shared-helper non-regression I3).

Regression neighbors re-run green on this branch: `composer-wire-reject.spec.ts`
(4/4 — the Enter-to-send law both faces), `detail-esc.spec.ts`,
`mention-picker-center.spec.ts`, `chief-panel.spec.ts`, `hotkeys.spec.ts`
(48/48 together).
