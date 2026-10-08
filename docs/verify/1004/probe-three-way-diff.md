# #1004 domain probe three-way diff (sealed #953 / canon #1003 / this lane)

Join key = spec file + assertion line + matcher, restricted to rows present in all
three dumps (line-number drift between seals is excluded, not a value change).
Every listed row is an intended #1004 re-pin; the lane dump itself is DRIFT 0 / VIOLATION 0.

| spec | line | matcher | #953 sealed | #1003 canon | this lane | lane status |
|---|---|---|---|---|---|---|
| card-press.spec.ts | 56 | toBe | rgb(224, 219, 210) | rgb(226, 220, 215) | rgb(226, 220, 215) | KEPT (negated) |
| card-press.spec.ts | 60 | toHaveCSS | background-color: rgb(224, 219, 210) | background-color: rgb(226, 220, 215) | background-color: rgb(226, 220, 215) | KEPT |
| card-press.spec.ts | 74 | toHaveCSS | background-color: rgb(239, 233, 225) | background-color: rgb(240, 235, 230) | background-color: rgb(240, 235, 230) | KEPT |
| sidebar-nav.spec.ts | 118 | toBe | rgba(28, 25, 20, 0.05) | rgba(28, 25, 21, 0.05) | rgba(28, 25, 21, 0.05) | KEPT |
| sidebar-seam.spec.ts | 53 | toBe | rgb(232, 227, 218) | rgb(234, 228, 224) | rgb(234, 228, 224) | KEPT |
| sidebar-seam.spec.ts | 60 | toBe | rgb(232, 227, 218) | rgb(234, 228, 224) | rgb(234, 228, 224) | KEPT |
| sidebar-seam.spec.ts | 105 | toBe | rgb(232, 227, 218) | rgb(234, 228, 224) | rgb(234, 228, 224) | KEPT |
| sidebar-seam.spec.ts | 128 | toBe | rgb(232, 227, 218) | rgb(234, 228, 224) | rgb(234, 228, 224) | KEPT |
| sidebar-seam.spec.ts | 152 | toBe | rgb(232, 227, 218) | rgb(234, 228, 224) | rgb(234, 228, 224) | KEPT |
| sidebar-seam.spec.ts | 153 | toBe | rgb(232, 227, 218) | rgb(234, 228, 224) | rgb(234, 228, 224) | KEPT |
| sidebar-visual.spec.ts | 155 | toBeGreaterThan | > 38.05000000000004 | > 38.45000000000002 | > 38.45000000000002 | KEPT |
| sidebar-visual.spec.ts | 165 | toBe | rgba(28, 25, 20, 0.1) | rgba(28, 25, 21, 0.1) | rgba(28, 25, 21, 0.1) | KEPT |
| visual-polish.spec.ts | 100 | toBe | rgb(232, 227, 218) | rgb(234, 228, 224) | 1px | KEPT |
| visual-polish.spec.ts | 198 | toBe | false | false | auto | KEPT |

value-changed rows present in all three dumps: 14.

## Reading this table

- Rows where "this lane" == "#1003 canon" are the #1002 palette-reselect deltas
  (warm-gray ramp shift); they were already canon before this lane and this lane
  did not touch them.
- Rows where "this lane" differs from both seals inside visual-polish.spec.ts are
  line-key artifacts: this lane's re-pin comments shifted assertion line numbers,
  so the (file,line,matcher) join mis-pairs those two rows. The authoritative
  per-row review for this lane is probe-comparison.md in this directory
  (DRIFT 0 / VIOLATION 0 / 162 passed).
- The lane's own re-pins (card+banner radius 0->14px, kbd chip border 1px->0,
  tooltip-kbd carriers) are line-shifted out of the join for the same reason;
  they are reviewed inline in the spec comments citing the rulings.
