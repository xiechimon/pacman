# #1006 wave-1 L3 prototype — detail-a + detail-b registry alignment (HITL review evidence)

Fixture-stack captures (vite preview of the `--mode fixture` build, 1440×900, port 8405),
taken at the prototype commit of branch `hp/pacman/t-0236-1-l3-detail-a-b-1006`.
Canon: map #980 (rulings 2/4), verdict table #983, batch canon #991; ground truth for
registry form = `scripts/ui-upstream-snapshots.json` (ADR 0012 D1 — registry default
geometry wins; square corners are a defect to fix, not a target).

| file | face | what to look at |
| --- | --- | --- |
| {dark,light}-accept-dialog.png | `/app?scenario=34` 完成任务 dialog | registry Dialog form: `bg-black/10`+blur scrim (was `bg-black/60`), rounded-xl panel, DialogTitle head (no h-12 band), DialogFooter muted band, outline 取消 / default 完成 (frozen 50×28 geometry retired) |
| {dark,light}-rerun-dialog.png | `/app/todo/r8-12?scenario=56` 开始任务/重跑 | hand-rolled Overlay retired → registry Dialog; `.overlay*` aliases preserved; frozen 30px/13px button recipe → registry variants |
| light-reuse-panel.png | `/app/todo/r8-15?scenario=75` 复用方案 | back arrow = ghost icon-sm in DialogHeader; outline 查看方案 / default 直接执行 |
| {dark,light}-branch-dialog-sync.png | board `.todo-card-branch` click | Tabs headerCenter centered in DialogHeader; Label fields; MachinePicker = outline trigger (live face: Popover); Input registry default; Switch; full-width default 同步 (spot-disabled paint retired); BranchBox rounded-lg border-input |
| light-branch-dialog-git.png | same dialog, Git tab | PR slot in READONLY_BOX (Input geometry language) |
| light-version-menu.png | `/app/todo/r8-12?scenario=65`, range chip clicked | hand-rolled absolute panel → registry DropdownMenu (rounded-lg p-1 shadow-md ring-1, rounded-md rows, focus:bg-accent); `.version-menu*` aliases kept |
| light-version-compare.png | same, 与其他版本对比… clicked | face-swap contract kept (single content swaps, no nested submenu); `.version-menu--sub` |
| {dark,light}-detail-head-chip-popover.png | `/app/todo/…?scenario=27`, chip clicked | dhead: back/more = ghost icon-sm with hover feedback (neutralization retired), primary action = registry default tier (50.5×28 retired), chip trigger = ghost with hover:bg-muted; StatusChip h-5 registry geometry; chip popover itself unchanged (L5 floating-shell territory) |
| light-detail-docpane.png | `/app/todo/…?scenario=17b` | pane head: ghost xs type-select + version chip (plan-dropdown skin recipes retired, registry menu default) |
| light-fresh-block.png | `/app/todo/fresh-probe?scenario=23` | TagChip at Badge default 12px/h-5 (11px tier retired); fresh-start = registry default button |

Not captured here: review/reject/stop-confirm dialogs (live-stub faces — drive them on a
live stack during review), transcript/composer (out of scope: #1009 A2 / #991 Q7),
user-menu (trigger wiring lives in sidebar, L1 — deferred, see report).

Segment scope note: this capture set is the HITL-reviewed prototype record of the whole
L3 lane (user approved 2026-10-08, rulings R1–R10). The detail-a segment PR carries the
chip family + detail-a faces in code; the dialog-face captures (accept / rerun / reuse /
branch) document the detail-b segment, which ships in the follow-up segment PR per the
lane-serial discipline (#913/#1006) — its code is not in this PR.

Behavior evidence: domain suite 209/209 green on E2E_PORT 8400 (`e2e-1006-domain.log` run);
cross-domain dialog-shell consumers 143/145 green — the 2 reds triaged in the thread
report (segmented-controls fixed by restoring the `--seg-hover` token-layer tint;
checkbox-unified accept 13px→14px is the intended registry typography drift,
construction-phase re-pin per #986 step 3).
