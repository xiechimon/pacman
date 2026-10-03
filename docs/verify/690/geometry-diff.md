# Zero-pixel comparison — checkbox primitive onto Base UI Checkbox (#690)

before: http://127.0.0.1:4310 (origin/main 62d38e06 fixture build)
after:  http://127.0.0.1:4311 (branch fixture build)

Visible parts and screenshot md5s must match exactly; `mechanism` parts (how the native input is hidden) are recorded below the table and intentionally differ.

| part | before | after | verdict |
|---|---|---|---|
| accept.checked | `{"inputChecked": true}` | `{"inputChecked": true}` | match |
| accept.unchecked | `{"inputChecked": false}` | `{"inputChecked": false}` | match |
| accept.focus | `{"found": true}` | `{"found": true}` | match |
| accept.checked.label | — | — | match (declared: position 'relative' -> 'static') |
| accept.checked.tile | — | — | match (declared: role None -> 'checkbox') |
| accept.checked.svg | x=435.0 y=397.0 w=12.0 h=12.0 | x=435.0 y=397.0 w=12.0 h=12.0 | match |
| accept.checked.text | x=458.0 y=393.7 w=130.0 h=18.6 | x=458.0 y=393.7 w=130.0 h=18.6 | match |
| accept.accept-checked.png | `7442cdda3b4b4efe97ed025bfa768ed4` | `7442cdda3b4b4efe97ed025bfa768ed4` | match |
| accept.accept-checked-full-md5 | `b851a3a6b8330c6b963e16ab5cd437b7` | `b851a3a6b8330c6b963e16ab5cd437b7` | match |
| accept.unchecked.label | — | — | match (declared: position 'relative' -> 'static') |
| accept.unchecked.tile | — | — | match (declared: role None -> 'checkbox') |
| accept.uncheckedSvgCount | `0` | `0` | match |
| accept.unchecked.text | x=458.0 y=393.7 w=130.0 h=18.6 | x=458.0 y=393.7 w=130.0 h=18.6 | match |
| accept.accept-unchecked.png | `2585aaedec3181fc2f18d4425d688fb1` | `2585aaedec3181fc2f18d4425d688fb1` | match |
| accept.accept-unchecked-full-md5 | `adf46e9188be2428390c986f0efcb289` | `adf46e9188be2428390c986f0efcb289` | match |
| accept.focus.tile | — | — | match (declared: role None -> 'checkbox') |
| accept.accept-focus.png | `66bdb800473c462b56374e210a1552b6` | `66bdb800473c462b56374e210a1552b6` | match |
| accept.accept-focus-full-md5 | `f3e2f34534a564f20363cc0145afa71c` | `f3e2f34534a564f20363cc0145afa71c` | match |
| provider.checked | `{}` | `{}` | match |
| provider.unchecked | `{"inputChecked": false}` | `{"inputChecked": false}` | match |
| provider.authInputPresent | `True` | `True` | match |
| provider.authInputChecked | `True` | `True` | match |
| provider.checked.label | — | — | match (declared: position 'relative' -> 'static') |
| provider.checked.tile | — | — | match (declared: role None -> 'checkbox') |
| provider.checked.svg | x=435.0 y=593.0 w=12.0 h=12.0 | x=435.0 y=593.0 w=12.0 h=12.0 | match |
| provider.checked.text | x=458.0 y=589.7 w=269.4 h=18.6 | x=458.0 y=589.7 w=269.4 h=18.6 | match |
| provider.provider-checked.png | `5da9a12868c7aa69b098417c2f2b7887` | `5da9a12868c7aa69b098417c2f2b7887` | match |
| provider.provider-checked-full-md5 | `e214427d22cdc57dae01bc7db2c13a67` | `e214427d22cdc57dae01bc7db2c13a67` | match |
| provider.unchecked.label | — | — | match (declared: position 'relative' -> 'static') |
| provider.unchecked.tile | — | — | match (declared: role None -> 'checkbox') |
| provider.uncheckedSvgCount | `0` | `0` | match |
| provider.provider-unchecked.png | `e25469b7dc9ec1aae7d6cb32390512a7` | `e25469b7dc9ec1aae7d6cb32390512a7` | match |
| provider.provider-unchecked-full-md5 | `128bb952b250fd5cc018059d9454b716` | `128bb952b250fd5cc018059d9454b716` | match |

## Mechanism parts (not compared)

- `accept.checked.input`
  - before: box={'x': 432, 'y': 393.7, 'width': 18, 'height': 18}, opacity=0, position=absolute, tag=input
  - after:  box={'x': 415, 'y': 327.7, 'width': 1, 'height': 1}, opacity=1, position=fixed, clip-path=see json, tag=input
- `provider.checked.input`
  - before: box={'x': 432, 'y': 589.7, 'width': 18, 'height': 18}, opacity=0, position=absolute, tag=input
  - after:  box={'x': 415, 'y': 25.2, 'width': 1, 'height': 1}, opacity=1, position=fixed, clip-path=see json, tag=input

## Declared non-visual diffs (excluded from the pixel verdict)

- `tile role: null -> checkbox` — the official Root publishes the ARIA role on the visual element (span). Metadata, not paint.
- `label position: relative -> static` — the wrapper only anchored the retired opacity-0 input overlay; Base UI hides its input with `position: fixed`, so the anchor is dead code and was removed. No positioned descendant remains.

## Verdict

**PASS** — every visible part (box + computed styles, minus the two declared non-visual diffs above) and every screenshot md5 matches; zero pixel change.
