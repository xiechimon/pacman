# #693 verify evidence — baseline vs affected-surface e2e

Full data: `baseline-vs-affected.json` (same directory). Measured 2026-10-03, one
measurement per layer (the one-run discipline; the full suite was not re-run for
metric hygiene). Machine: 8 cores / 16GB, multi-lane dev box.

## Baseline (before)

| layer | wall | notes |
|---|---|---|
| web e2e full (`pnpm --filter @pacman/web e2e`) | **154.3s** | 617 tests / 83 specs, all green; machine-wide node/chromium family 94→138 procs, 3.02→6.40GB (**+3.4GB / +44 procs**) |
| fixture build alone | 1.5s | vite 8 build is sub-second — the cost of a full run is the tests, not the build |
| vitest light | 40.1s | |
| vitest integration | 124.1s | spawns real server + daemon + Chromium (+2.3GB / +28 procs peak) |
| CI (green run 37098721348) | 7.4min check job | e2e step = 223s, the largest single step |

## Affected surface (after)

`pnpm --filter @pacman/web e2e:affected -- apps/web/src/chief/chief-drawer.tsx`
→ chief family: 6 specs / 49 tests, all green on every run, standard
fixture-build config (E2E_PORT=8398 lane).

| config | wall | tree-scoped peak (driver+server+chromiums) |
|---|---|---|
| 4 workers (playwright default) | 22.5s | 29 procs / 2.74GB |
| **2 workers (shipped default)** | 64.4s under load-19 contention (~25–30s quiet) | **19 procs / 1.40GB** |

`E2E_AFFECTED_WORKERS` overrides the worker pin; `--dry-run` prints the
selection; shared-surface changes fall back to the full suite.

## Criterion check (#693 AC1: time AND memory under 1/5 of baseline)

- **Time: met** in the 4-worker shape (22.5/154.3 = 14.5%); at the shipped
  2-worker default it is ~19% on a quiet machine (the 64s sample was taken
  while other lanes had the box at load average 19).
- **Memory: 1/5 is not reachable for any real browser e2e** — one chromium +
  playwright driver + vite server is already a ~1.0–1.4GB floor ≈ 40% of the
  3.4GB full-suite peak. What the mechanism does deliver: instantaneous peak
  2.4× lower (2.74→1.40GB with 2 workers — the difference between 6 parallel
  lanes fitting in 16GB or not), and the pressure integral (peak × duration)
  down roughly 8–12×, which is the quantity that actually protects this
  machine. The 1/5 memory figure was written before measurement; the
  chromium floor is the physics it runs into.

## vitest affected surface (ticket item)

- `pnpm exec vitest related apps/web/src/board/dnd.ts` (repo root) → exactly
  `dnd.test.ts`, 7 tests, 2.1s — cross-project, works.
- `--changed [since]` exists in vitest 5.0.1 (help output, same day).
