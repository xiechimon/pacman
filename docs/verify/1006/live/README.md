# #1006 detail-b segment — live-stack evidence (verify-pacman)

Stacks: branch = isolated verify stack (VERIFY_PORT 8791 / VERIFY_WEB_PORT 5273,
scratch PACMAN_HOME) on the merged segment-2 tree `0c17239a`; baseline = detached
`origin/main` (`dadf09d6`) worktree stack on 8793/5275 (the skill's --expect=old
recipe). Probes run from each tree's own copy of the scripts (worktree-lane rule).

## Directories

| dir | run | result |
| --- | --- | --- |
| `before-premerge-952/` | drive-952-finale on the segment-2 tree **before** merging #1061 (create-agent wrapper still present) | B3 FAIL: submit button 30px inside the flex-row band — the live capture of the w-full collapse this segment fixes |
| `branch-952-finale/` | drive-952-finale (migrated A4) on merged tree `0c17239a` | **A4 PASS** (registry duration-100 tier present, visibility bridge absent), **B3 PASS** (416 ≈ 416); remaining 7 fails attributed below |
| `main-baseline-952-finale/` | drive-952-finale (main's copy, old A4) on `dadf09d6` | **8 fails** = the same 7 + old-A4 (main carries the flipped shell from #1061 but not the migrated assertion) |
| `review-reject/` | drive-review-reject on the branch stack (setup-review-seed todo, real user paths: more-menu → 请求修改 → feedback → submit; composer direct reject) | **22/22 PASS** — reject dialog registry form live-wired (replan step enqueued, feedback row landed, prompt template + branch-artifact clause in SQLite, transcript bubbles) |

## Attribution of the 7 shared failures (branch == baseline, identical measured values)

| check | measured (both stacks) | owner / cause | disposition |
| --- | --- | --- | --- |
| B1 label 12px/18px/0.01em | 14px/14px/normal | #1061 (L4) migrated create-agent labels to registry Label — probe pin is #952-era | probe maintenance, L4/pages face — **not this PR** |
| C3 avatar circle 64 | 32 | #1003 seeded-avatar fixed-box rewrite / profile-card refactor — consumer size slot not re-pinned | probe maintenance, avatar consumers — **not this PR** |
| C4 card radius 10 | 14px | #1061 radius alignment (registry rounded language) | probe maintenance — **not this PR** |
| C10 Textarea 13px | 14px | #1061 registry Textarea default | probe maintenance — **not this PR** |
| D2 lang row border-0 | 1px/solid | account lang menu drifted pre-#1006 (floating-shell family, L5 territory) | probe maintenance, L5 — **not this PR** |
| G-dark / G-light contrast 4/6 pairs | select-trigger=1, profile-row-label≈1.3/1.5, detail-value=1, secret-add-link≈1.5/1.7 | pairs resolve fg≈bg on faces changed by #1053/#1057/#1061 — the #952-era selector set no longer hits the intended elements/faces | probe maintenance + contrast re-measure belongs to the owning lanes — **not this PR** |

Conclusion: the segment-2 tree introduces **zero** new live-probe failures and
fixes two (A4 migrated with its mechanism change; B3 via the w-full footer
cleanup that also lands for create-secret/create-provider/skill-dialog — the
latter three still ship collapsed on main, since #1061 only cleaned
create-agent). Probe-maintenance debt for B1/C3/C4/C10/D2/G is flagged to the
coordinator (belongs to a /maintain-verification-skill round or the owning
lanes; values above are the measured evidence).

## Reproduction

```sh
# branch stack
VERIFY_REPO_ROOT=<segment-2 checkout> node .claude/skills/verify-pacman/scripts/launch.mjs
VERIFY_REPO_ROOT=<segment-2 checkout> node .claude/skills/verify-pacman/scripts/drive-952-finale.mjs
VERIFY_REPO_ROOT=<segment-2 checkout> node .claude/skills/verify-pacman/scripts/setup-review-seed.mjs > seed.json
REVIEW_MACHINE_TOKEN=<machineToken> VERIFY_REPO_ROOT=<segment-2 checkout> \
  node .claude/skills/verify-pacman/scripts/drive-review-reject.mjs <todoId>
# baseline stack (detached origin/main worktree, shifted ports)
VERIFY_REPO_ROOT=<main worktree> VERIFY_PORT=8793 VERIFY_WEB_PORT=5275 node <main>/.../launch.mjs
VERIFY_REPO_ROOT=<main worktree> node <main>/.../drive-952-finale.mjs
```
