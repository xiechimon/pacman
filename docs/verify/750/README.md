# #750 evidence: PR body image-link gate

Local runs of `scripts/pr-evidence-gate.py` against crafted bodies
(`gate-*.txt` = stdout plus exit code; `fixture-*.md` = input bodies).

- `fixture-plain-link.md` — raw PNG linked as `[label](url)` → RED, names the link.
- `fixture-bad-sha.md` — embedded link with a dead SHA → RED with HTTP 404.
- `fixture-good.md` — embedded link with a live SHA → GREEN.
- `fixture-empty.md` — no image links at all → GREEN.
- `fixture-bare-url.md` — raw PNG URL standing alone, no markdown → RED,
  names the URL and its line.
- `fixture-mixed.md` — one embedded link plus one bare URL → RED naming the
  bare line only, so the embedded occurrence is proven clean.

`real-body-858.txt` replays the body #858 actually shipped through the fixed
gate: un-wrapping its two embeds back to bare URLs turns the verdict RED and
names both lines, while the body as it stands now stays GREEN.

The bare-URL rule (added after #858 shipped two bare image URLs that the
gate did not see) is what `fixture-bare-url.md` and `fixture-mixed.md`
pin. Only `raw.githubusercontent.com` image URLs are in scope; bare links
to non-image evidence files stay allowed, which is why `fixture-good.md`,
`fixture-plain-link.md`, `fixture-bad-sha.md` and `fixture-empty.md`
produce byte-identical output before and after the change.

The good-case URL points at a file committed on main
(`docs/verify/308/.../00-detail-fresh.png` at the main tip SHA),
so the 200 is reproducible. The bad-SHA case uses 40 zeros, which can
never become a live object.
