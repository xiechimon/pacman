# #860 evidence: dialog composer ordered-list continuation + height/grow + skin unification

Live verify stack (`launch.mjs`, server 8795 + web 5277, fresh seed DB) plus a
fake-machine API seed (enroll → startBuilds → claim → plan.md upload → done →
confirm, no daemon, no LLM) for the detail thread face. Playwright true user
path, 1440×732 dark. Custom probe
(`.claude/verify-shots/drive-composer-860.mjs`, 15/15 PASS, `result.json`):

- `composer-860-flow.gif` — full motion flow on both faces: type `1. xxx` →
  Shift+Enter continues `2. ` → type `yyy` → Shift+Enter continues `3. ` →
  Enter sends (chief drawer clears; detail confirm submits).
- `01-chief-base.png` — drawer textarea base 60px (13px/20px × 3 lines).
- `02-chief-continued.png` — `1. xxx` + Shift+Enter → `2. ` (no send).
- `03-chief-sent.png` — Enter on a list line sends (POST left the browser).
- `04-chief-grown.png` — 10 lines: grown to the 120px cap, internal scroll.
- `05-detail-thread.png` — confirm-face thread with the 48px-base composer.
- `06-detail-continued.png` — same Shift+Enter continuation on detail.
- `07-detail-after-enter.png` — Enter submits (POST, no `\n2. ` appended).

Measured growth (from `result.json`): chief 60 → 120 cap (scroll 220 > client
120); detail 48 → 96 cap (scroll 189 > client 96), card 84 → 98 riding along.

Key semantics (wire faces only; new-task dialog untouched): Enter always sends
(the #819 plain-Enter continuation is removed from the wire); Shift+Enter is
the list-aware newline (continue / empty-item exit, #814 helper unchanged);
IME composition and modified Enter keep their ambient meaning.

Skin unification (detail → drawer, spec-pinned items kept — see issue #860
comment `5981941264`): tool glyphs 16px + hover brightening, send/stop idle
fill to `seg-active`; border, insets, placeholder size and tool-box geometry
stay (pinned by `detail-3pane` / `chat-type-measure`).

Regression: `e2e:affected` 36/101 specs, 269 passed 0 failed (log
`/tmp/lane-860-e2e.log` on the run machine); `pnpm lint` green;
`pnpm -r typecheck` green (5 projects).
