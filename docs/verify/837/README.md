# #837 evidence: theme residue convergence

Residue list (face / element / before / after). P6 (#807) converged geometry
only, so there is no color overlap to dedupe — this ticket owns all color items.

| # | face / element | before (rendered) | after (rendered) |
|---|---|---|---|
| 1 | board card primary action (开始/确认/完成/重试) | `Button` variant `default` = neutral `--primary` (light #171717 near-black, dark #e5e5e5); the only primary app-wide not on `brand` (21 other primaries verified `brand`) | variant `brand` = spot (`#8839ef` / `#cba6f7`), same as detail header + project submit |
| 2 | sidebar 工作台 count badge | `bg-primary` pill (light black, dark gray) | `bg-(--badge-attention)` + new `--badge-attention-fg` `#17171a` both themes, 8.26:1 |
| 3 | input placeholders + repo-picker placeholder row (project-new, chief/detail/new-task composers, searches) | `var(--text-dim)`, light 2.14:1 (below legibility) | `var(--text-tertiary)`, light 6.47:1; resources search already used tertiary (precedent) |
| 4 | review face danger/amber (`chat-review-tag--error`, blocking/suggestion bars + severity, `review-notice`) | undefined `var(--color-danger, #dc2626)` / `var(--color-warning, #f59e0b)` fallbacks (always active, off-palette) | `--destructive` / `--badge-attention`, tag wash `--danger-soft` |

Audited, deliberately unchanged: machine dot (online green / offline gray,
token-driven status semantics — offline render confirmed on a daemon-less
stack); mention-picker type hues (reference-aligned category encoding, six
types must stay distinguishable); external logo fills in `brand-marks.tsx`.

Gates: `pnpm lint` exit 0; `pnpm typecheck` green (4 packages);
`e2e:affected` 767 passed on `E2E_PORT=8410`; `vitest related --changed`
selects no tests (changed files are tsx/css without unit coverage).

Before/after (same sweep script, same seed shape):
`board-{light,dark}-{before,after}.png`,
`project-new-{light,dark}-{before,after}.png`,
`badge-{light,dark}-after.png` (element shots) +
`badge-light-before-seal.png` (P7 seal showing the old black pill),
`machines-light-after.png` (dot unchanged).
Rendered pairs: `contrast-837.txt`.
