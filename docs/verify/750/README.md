# #750 evidence: PR body image-link gate

Local runs of `scripts/pr-evidence-gate.py` against crafted bodies
(`gate-*.txt` = stdout plus exit code; `fixture-*.md` = input bodies).

- `fixture-plain-link.md` — raw PNG linked as `[label](url)` → RED, names the link.
- `fixture-bad-sha.md` — embedded link with a dead SHA → RED with HTTP 404.
- `fixture-good.md` — embedded link with a live SHA → GREEN.
- `fixture-empty.md` — no image links at all → GREEN.

The good-case URL points at a file committed on main
(`docs/verify/308/.../00-detail-fresh.png` at the main tip SHA),
so the 200 is reproducible. The bad-SHA case uses 40 zeros, which can
never become a live object.
