# #1006 detail-a segment — probe three-way diff ledger (#986 step 2/3)

Three bases, per the #991 canon (「以侦察账 + #953 封版 JSON 三方 diff 定钉」):

| round | tree | spec list | result | file |
| --- | --- | --- | --- | --- |
| sealed base | #953 封版 (`docs/verify/953/probe-sealed/probe-dump.json`, run @ `93d979f2`) | full suite | 805 rows all KEPT | (in tree) |
| round 0 — pre-construction recon | lane branch @ `034cd149` (untouched) | 24 domain specs | 185 visual rows: KEPT 185 / DRIFT 0 / VIOLATION 0 — main at lane start == sealed baseline | `round0-pre-construction-comparison.md` |
| round 1 — post-construction | `ui/1006-detail-a` @ `897e96b7` + detail-a segment | 31 specs (domain + chip fallout neighbors) | 265 visual rows: KEPT 259 / **DRIFT 3** / NOT-RUN 3 / VIOLATION 0 | `round1-post-construction-comparison.md` |
| round 2 — post-re-pin (final) | same + spec re-pins | same 31 | **267 visual rows: KEPT 267 / DRIFT 0 / NOT-RUN 0 / VIOLATION 0** | `round2-final-comparison.md` (+ `round2-final-dump.json`) |

## Round-1 DRIFT classification (human review, #910 裁定 5)

| spec:line | old → new | classification | disposition |
| --- | --- | --- | --- |
| `board-filter.spec.ts:524` | chipH 16 → 20 | **expected drift** — R5 prototype-review ruling (user 2026-10-08): todo-card row-flush 16px consumer override folded into registry Badge default 20px; the equal-card-height contract is superseded by the ruling (tagged card grows 4px, row1 = min-h-4) | re-pinned: chipH/row1H → 20, card-equality → +4 delta, comments cite the ruling |
| `shadcn-primitives.spec.ts:103` | card-face chip 16 → 20 | **expected drift** — same R5 ruling; the 「卡面 16 / 面板面 20」 dual-tier contract is retired (不要两个尺寸并存) | re-pinned: single 20px canon both faces, test title updated |
| `board-dnd.spec.ts:872` | flash trace `[]` → `[{t:4,col:todo}]` | **flake under 4-worker probe load** — rAF frame-trace caught a 4ms frame pre-commit; not a geometry/value pin | verified: isolated `board-dnd` run 29/29 green; round-2 (same 4-worker harness) green — no code/spec change |

No suspected regressions: zero code-fix dispositions. No VIOLATION in any round (all
values rgb/hex per the #411 notation contract).

## Segment-2 rounds (detail-b construction, post-#1059)

| round | tree | spec list | result | file |
| --- | --- | --- | --- | --- |
| seg2 round 1 | segment-2 constructed @ merge e1cf000a tree | 35 dialog-family + detail-b + chip-fallout specs | 265 rows: KEPT 259* / DRIFT 1 / NOT-RUN 2 / VIOLATION 0 (*segment-1 rows included in the list) | `seg2-round1-comparison.md` |
| seg2 round 2 | + checkbox-unified accept re-pin (13px→14px, ruling 4 lineage) | same | **198 rows: KEPT 198 / DRIFT 0 / NOT-RUN 0 / VIOLATION 0** | `seg2-round2-final-comparison.md` (+dump) |
| seg2 round 3 | merged tree 0c17239a (main dadf09d6 incl. #1061/#1062/#1063/#1064 + segment 2) | 38 specs (segment-2 list + segment-1 surfaces) | **253 rows: KEPT 253 / DRIFT 0 / NOT-RUN 0 / VIOLATION 0** — proves the #1061 shell-flip overlap and L4 pages work introduce zero drift against this lane's pins | `seg2-round3-merged-comparison.md` (+dump) |

seg2 round-1 DRIFT classification: `checkbox-unified.spec.ts:112` accept label
font-size 13px → 14px — expected drift, ACCEPT_LABEL retired, registry
DialogContent text-sm wins (#980 ruling 4); re-pinned in-PR with the ruling
cited. No suspected regressions; no VIOLATION in any round.

## Scope note

Round 1/2 spec list = the 24-spec domain account + the chip-verdict fallout neighbors
(`board-dnd`, `card-press`, `board-overflow`, `chip-assign`, `chip-hotzone`,
`search-result-rows`, `search-focus`, `dead-buttons`, `escape-wiring`,
`title-band-clicks`, `segmented-controls`) because the R5 ruling and the StatusChip sm-tier
retirement move card/row geometry outside the detail panes. Dialog-face specs
(`dialog-viewport`, `merge-reject`, `review-reject`, `rerun-close-family`) stay KEPT in
this segment by construction — the dialog-shell flip ships in the detail-b segment PR
(lane-serial per #913/#1006), and round-1 confirms they do not drift from detail-a work.
