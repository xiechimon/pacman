# docs/verify/731 — `/` slash completion evidence (#731)

Live-stack probe (verify-pacman isolation: server 8792 + web 5274, scratch
PACMAN_HOME, 2 seeded skills `code-review` / `deploy-app`, confirm-phase
todo): 9/9 checks PASS — see `result.json`.

| Shot | State |
|---|---|
| `01-menu-open.png` | `/` opens the menu: 5 builtins (confirm phase, no active run so no `/stop`) then 2 team skills in roster order |
| `02-empty-state.png` | `/zzz` matches nothing: `没有匹配"/zzz"的命令` |
| `03-skill-token.png` | skill accept lands `[code-review](skill:code-review) ` in the draft (raw token by design; the chip renders in transcript) |
| `04-help-panel.png` | `/help` opens the centered command panel: 5 available builtins + skill-count footer |

Regression cover (same tree, pre-PR): unit `test/slash-commands.test.ts`
(23) + neighbors green; full web unit 361 green; full e2e 728 green;
`pnpm lint` 0 errors; `pnpm typecheck` all packages green.
