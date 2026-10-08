# #1004 board/sidebar — #983 execution reconciliation + un-migrated residue

验收模板 v3 items 5 & 6. Scope = consumption points inside board/sidebar.

## #983 per-item execution (this domain)

| item | verdict | execution in this lane |
|---|---|---|
| panel | 换 registry Card | not consumed in board/sidebar → N/A |
| dialog-shell | 零皮肤适配层 | rewrite is L3's single point (#1006). Board's 2 consumers keep behavior; double-pad strip = hang-account (PR body + code comment), executed at L3-merge |
| alert-dialog-shell | 退役回消费点 | not consumed in domain → N/A |
| floating-shell | 退役回消费点(族拆) | not consumed in domain → N/A |
| kbd-hint | 退役回 Tooltip+Kbd | EXECUTED at lane consumers: sidebar rail ⌘K, expanded ⌘K/C chips (→ registry Kbd), board-page FAB ⌘J. File deletion cross-lane (3 consumers in other lanes) |
| seeded-avatar | 零皮肤适配层(收紧) | adapter retained; lane consumers (sidebar×2, todo-card) unchanged; adapter-internal rewrite = cross-domain residue |
| status-chip | 零皮肤适配层 | not consumed in domain → N/A |
| tag-chip | 零皮肤适配层 | adapter retained; lane consumers unchanged (todo-card row-flush 16px = consumer className, ruled kept; filter-panel 20px canon); adapter-internal font-tier retirement = cross-domain residue |

## Un-migrated residue (v3 item 6)

- kbd-hint.tsx file: deleted only after chief-wake / chief-drawer / new-task-dialog migrate (other lanes; coordinator-sequenced).
- seeded-avatar / tag-chip adapter internals: cross-domain, coordinator-sequenced.
- filter-panel per-row CheckBox: kept as an aria-hidden indicator but on registry checkbox geometry/tone (rounded-[4px] + --primary). Full registry Checkbox adoption would nest a real control inside the row Button (a11y violation) — documented, not done.
- dialog double-pad + ACCEPT_FOOTER/ACCEPT_CANCEL_BTN: merge-time hang-account (#1006 shell into main), code comments + PR body.
- detail/user-menu.tsx and overlays/plan-dropdown: ownership pending coordinator; untouched.
- board-column rounded-none: not among the five ruled faces; residue for a later ruling.
- FilterChips rounded-full pill and project-avatar rounded-[4px]: KEPT as registered reasoned deviations (实审裁决 4/5), comments at call sites.
- chief FAB rounded-full: circular FAB, deliberate, residue.
