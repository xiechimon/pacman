## Summary

The repo gains a project-level PR body skill (`pr-pacman`) carrying the
six-section contract, and `pr-evidence` failures now name the canonical
template. Fixes #1110.

```text
lane writes PR body
  follows global /pr (show-me)
    body: Summary / Evidence / Merge Danger
      pr-evidence gate -> RED (no Upstream, no Verified)

follows repo skill pr-pacman
  body: What / Verified / Upstream / Risk / Acceptance / Issues
    pr-evidence gate -> GREEN
```

## Evidence

- **Before:** a lane following the global `/pr` skill fails `pr-evidence`
  and hand-rewrites the body (four lanes in one day: #1100, #1103,
  #1105, #1111).
  **After:** a lane following `pr-pacman` passes both gates without
  touching the body (this PR).

## Merge Danger

**Door:** two-way

Remove the skill or the routing note and lanes fall back to guessing.

**Blast Radius:** PR body writing only

The gate change adds output lines; the verdict logic is untouched.
