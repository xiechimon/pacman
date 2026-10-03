#!/usr/bin/env python3
"""Compare BEFORE/AFTER probe geometry for the #690 checkbox pilot.

Rules:
- every md5 (dialog clip + full page) must match exactly
- every part tagged 'visible' must match exactly on box and computed styles,
  except DECLARED non-visual metadata the migration changes on purpose (each
  declared diff must still be backed by identical md5s to pass)
- parts tagged 'mechanism' (the native input hiding technique) are recorded,
  not compared — before = opacity-0 overlay, after = official visually-hidden
- scalar behavior fields (inputChecked, svg counts, focus.found) must match
Exit code 0 = zero-pixel pass.
"""
import json
import sys

# (part-suffix, property) -> (expected before, expected after). Non-visual by
# construction: role is ARIA metadata the official component adds on the
# visual element; label position:relative only anchored the retired input
# overlay (no positioned descendant remains, md5s identical).
DECLARED = {
    ('tile', 'role'): (None, 'checkbox'),
    ('label', 'position'): ('relative', 'static'),
}

before = json.load(open('/tmp/t0065-before/geometry.json'))
after = json.load(open('/tmp/t0065-after/geometry.json'))

lines = []
failures = []
mechanism = []


def cmp_scalar(face, key, b, a):
    if b != a:
        failures.append(f'{face}.{key}: before={b!r} after={a!r}')
        lines.append(f'| {face}.{key} | `{b}` | `{a}` | **MISMATCH** |')
    else:
        lines.append(f'| {face}.{key} | `{b}` | `{a}` | match |')


for fname in before['faces']:
    fb = before['faces'][fname]
    fa = after['faces'].get(fname, {})
    for key in fb:
        vb, va = fb[key], fa.get(key)
        if isinstance(vb, dict) and 'box' in vb:
            tag = vb.get('tag')
            if tag == 'mechanism':
                mechanism.append((f'{fname}.{key}', vb, va))
                continue
            part = key.split('.')[-1]
            if vb == va:
                box = vb['box']
                geom = f"x={box['x']:.1f} y={box['y']:.1f} w={box['width']:.1f} h={box['height']:.1f}"
                lines.append(f'| {fname}.{key} | {geom} | {geom} | match |')
            else:
                undeclared = []
                declared = []
                if vb['box'] != (va or {}).get('box'):
                    undeclared.append(f"box {vb['box']} vs {(va or {}).get('box')}")
                sb, sa = vb['styles'], (va or {}).get('styles', {})
                for prop in sb:
                    if sb[prop] != sa.get(prop):
                        exp = DECLARED.get((part, prop))
                        if exp == (sb[prop], sa.get(prop)):
                            declared.append(f'{prop} {sb[prop]!r} -> {sa.get(prop)!r}')
                        else:
                            undeclared.append(f"{prop}: {sb[prop]!r} vs {sa.get(prop)!r}")
                if undeclared:
                    failures.append(f'{fname}.{key}: ' + '; '.join(undeclared))
                    lines.append(f'| {fname}.{key} | — | — | **MISMATCH**: {"; ".join(undeclared)} |')
                else:
                    lines.append(f'| {fname}.{key} | — | — | match (declared: {"; ".join(declared)}) |')
        elif isinstance(vb, dict) and 'md5' in vb:
            cmp_scalar(f'{fname}', key, vb['md5'], (va or {}).get('md5'))
        elif isinstance(vb, dict):
            cmp_scalar(f'{fname}', key, json.dumps(vb, sort_keys=True), json.dumps(va, sort_keys=True))
        else:
            cmp_scalar(f'{fname}', key, vb, va)

out = []
out.append('# Zero-pixel comparison — checkbox primitive onto Base UI Checkbox (#690)\n')
out.append(f"before: {before['baseUrl']} (origin/main 62d38e06 fixture build)")
out.append(f"after:  {after['baseUrl']} (branch fixture build)\n")
out.append('Visible parts and screenshot md5s must match exactly; `mechanism` parts (how the native input is hidden) are recorded below the table and intentionally differ.\n')
out.append('| part | before | after | verdict |')
out.append('|---|---|---|---|')
out.extend(lines)
out.append('\n## Mechanism parts (not compared)\n')
for name, vb, va in mechanism:
    bb, ab = vb.get('box'), (va or {}).get('box')
    out.append(f'- `{name}`')
    out.append(f"  - before: box={bb and {k: round(v, 1) for k, v in bb.items()}}, opacity={vb['styles'].get('opacity')}, position={vb['styles'].get('position')}, tag={vb['styles'].get('tagName')}")
    if ab is not None or va:
        out.append(f"  - after:  box={ab and {k: round(v, 1) for k, v in ab.items()}}, opacity={(va or {}).get('styles', {}).get('opacity')}, position={(va or {}).get('styles', {}).get('position')}, clip-path=see json, tag={(va or {}).get('styles', {}).get('tagName')}")
out.append('\n## Declared non-visual diffs (excluded from the pixel verdict)\n')
out.append('- `tile role: null -> checkbox` — the official Root publishes the ARIA role on the visual element (span). Metadata, not paint.')
out.append('- `label position: relative -> static` — the wrapper only anchored the retired opacity-0 input overlay; Base UI hides its input with `position: fixed`, so the anchor is dead code and was removed. No positioned descendant remains.')
out.append('\n## Verdict\n')
if failures:
    out.append(f'**FAIL** — {len(failures)} mismatches:')
    out.extend(f'- {f}' for f in failures)
else:
    out.append('**PASS** — every visible part (box + computed styles, minus the two declared non-visual diffs above) and every screenshot md5 matches; zero pixel change.')

report = '\n'.join(out)
open('/tmp/t0065-compare.md', 'w').write(report + '\n')
print(report)
sys.exit(1 if failures else 0)
