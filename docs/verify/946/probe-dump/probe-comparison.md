# Probe dump — old baseline → new measured (#921)

Run 2026-10-05T23:36:52.837Z · commit `034bf7d5` · port 8399 · playwright 1.63.0 · workers 4

Specs: project-empty-new-task project-files-local-disabled project-github-issues project-new-dir-browser project-new-fs-pick project-new-github project-new-repo project-settings-dead-buttons project-settings-delete project-tasks-toolbar file-viewer segmented-controls overlay-focus dead-buttons accent-typo shell-consistency sidebar-seam chief-panel avatar-dicebear (19 files) · tests 190 passed / 0 failed

## Coverage

Enumerated = static scan of spec source. Collected = distinct runtime call sites that returned a value (polls/themed loops record repeatedly; distinct de-dupes by file:line).

| probe surface | enumerated | collected |
| --- | --- | --- |
| getComputedStyle occurrences (headline count) | 38 | — (captured per evaluate call below) |
| probe-carrying evaluate/waitForFunction call sites | 30 | 30 |
| .boundingBox() call sites | 19 | 19 |
| .toHaveCSS() call sites | 4 | 4 |
| visual-matcher assertion sites | 173 | 246 joined |

Comparison rows: 218 — KEPT 218, DRIFT 0, NOT-RUN 0, VIOLATION 0, other 0.

Review procedure (#910 裁定 5): every DRIFT row is either expected drift (the new canon — re-pin the spec inline value to “new measured”) or a suspected regression (fix the code, keep the baseline). KEPT rows need no action. NOT-RUN rows are assertion sites whose test failed earlier, was skipped, or was filtered out. The `note` column flags values whose source notation is not rgb/hex: `color(srgb …)` is folded to rgba for comparison (re-pin should write the rgb/hex form); oklch/lab/lch and non-sRGB `color()` cannot fold under the #411 contract and are flagged VIOLATION, never converted.

## KEPT — baseline holds on this build (218)

| spec | line | matcher | old baseline | new measured | note | test |
| --- | --- | --- | --- | --- | --- | --- |
| accent-typo.spec.ts | 45 | toBe | 400 | 400 | — | font baseline: body 400, card title 500, var font really loaded (light) |
| accent-typo.spec.ts | 45 | toBe | 400 | 400 | — | font baseline: body 400, card title 500, var font really loaded (dark) |
| accent-typo.spec.ts | 46 | toBe | 500 | 500 | — | font baseline: body 400, card title 500, var font really loaded (light) |
| accent-typo.spec.ts | 46 | toBe | 500 | 500 | — | font baseline: body 400, card title 500, var font really loaded (dark) |
| accent-typo.spec.ts | 55 | toBe | 600 | 600 | — | headline tier 600 holds (light) |
| accent-typo.spec.ts | 55 | toBe | 600 | 600 | — | headline tier 600 holds (dark) |
| accent-typo.spec.ts | 80 | toBe | rgb(18, 15, 9) | rgb(18, 15, 9) | — | sidebar header carries the Pacman brand mark + name (light) |
| accent-typo.spec.ts | 80 | toBe | rgb(237, 233, 225) | rgb(237, 233, 225) | — | sidebar header carries the Pacman brand mark + name (dark) |
| accent-typo.spec.ts | 81 | not.toBe | rgba(0, 0, 0, 0) | rgb(18, 15, 9) | — | sidebar header carries the Pacman brand mark + name (light) |
| accent-typo.spec.ts | 81 | not.toBe | rgba(0, 0, 0, 0) | rgb(237, 233, 225) | — | sidebar header carries the Pacman brand mark + name (dark) |
| accent-typo.spec.ts | 82 | toEqual | {"w":16,"h":16} | {"w":16,"h":16} | — | sidebar header carries the Pacman brand mark + name (light) |
| accent-typo.spec.ts | 82 | toEqual | {"w":16,"h":16} | {"w":16,"h":16} | — | sidebar header carries the Pacman brand mark + name (dark) |
| accent-typo.spec.ts | 101 | toEqual | {"bg":"rgba(0, 0, 0, 0)","color":"rgb(87, 83, 76)"} | {"bg":"rgba(0, 0, 0, 0)","color":"rgb(87, 83, 76)"} | — | resources back chevron hover shows no background change (light) |
| accent-typo.spec.ts | 101 | toEqual | {"bg":"rgba(0, 0, 0, 0)","color":"rgb(179, 175, 168)"} | {"bg":"rgba(0, 0, 0, 0)","color":"rgb(179, 175, 168)"} | — | resources back chevron hover shows no background change (dark) |
| accent-typo.spec.ts | 118 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | the sidebar collapse toggle shows no hover face (light) |
| accent-typo.spec.ts | 118 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | the sidebar collapse toggle shows no hover face (dark) |
| accent-typo.spec.ts | 119 | toBe | none | none | — | the sidebar collapse toggle shows no hover face (light) |
| accent-typo.spec.ts | 119 | toBe | none | none | — | the sidebar collapse toggle shows no hover face (dark) |
| accent-typo.spec.ts | 123 | toEqual | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(53, 49, 42)"} | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(53, 49, 42)"} | — | the sidebar collapse toggle shows no hover face (light) |
| accent-typo.spec.ts | 123 | toEqual | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(179, 175, 168)"} | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(179, 175, 168)"} | — | the sidebar collapse toggle shows no hover face (dark) |
| accent-typo.spec.ts | 169 | toBe | 1 | 1 | — | the sidebar toggles hold face and geometry while pressed (light) |
| accent-typo.spec.ts | 169 | toBe | 1 | 1 | — | the sidebar toggles hold face and geometry while pressed (dark) |
| accent-typo.spec.ts | 170 | toEqual | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(53, 49, 42)","opacity":"1","iconX":203,"iconY":13.5,"ico… | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(53, 49, 42)","opacity":"1","iconX":203,"iconY":13.5,"ico… | — | the sidebar toggles hold face and geometry while pressed (light) |
| accent-typo.spec.ts | 170 | toEqual | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(179, 175, 168)","opacity":"1","iconX":203,"iconY":13.5,"… | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(179, 175, 168)","opacity":"1","iconX":203,"iconY":13.5,"… | — | the sidebar toggles hold face and geometry while pressed (dark) |
| accent-typo.spec.ts | 175 | toBe | 1 | 1 | — | the sidebar toggles hold face and geometry while pressed (light) |
| accent-typo.spec.ts | 175 | toBe | 1 | 1 | — | the sidebar toggles hold face and geometry while pressed (dark) |
| accent-typo.spec.ts | 176 | toEqual | {"bg":"rgba(28, 25, 20, 0.05)","shadow":"none","color":"rgb(53, 49, 42)","opacity":"1","iconX":12,"iconY":13.5… | {"bg":"rgba(28, 25, 20, 0.05)","shadow":"none","color":"rgb(53, 49, 42)","opacity":"1","iconX":12,"iconY":13.5… | — | the sidebar toggles hold face and geometry while pressed (light) |
| accent-typo.spec.ts | 176 | toEqual | {"bg":"rgba(255, 252, 248, 0.05)","shadow":"none","color":"rgb(179, 175, 168)","opacity":"1","iconX":12,"iconY… | {"bg":"rgba(255, 252, 248, 0.05)","shadow":"none","color":"rgb(179, 175, 168)","opacity":"1","iconX":12,"iconY… | — | the sidebar toggles hold face and geometry while pressed (dark) |
| accent-typo.spec.ts | 199 | toBe | solid | solid | — | resources back chevron keeps a keyboard focus ring (light) |
| accent-typo.spec.ts | 199 | toBe | solid | solid | — | resources back chevron keeps a keyboard focus ring (dark) |
| accent-typo.spec.ts | 200 | toBe | 2px | 2px | — | resources back chevron keeps a keyboard focus ring (light) |
| accent-typo.spec.ts | 200 | toBe | 2px | 2px | — | resources back chevron keeps a keyboard focus ring (dark) |
| accent-typo.spec.ts | 202 | toBe | rgb(127, 45, 167) | rgb(127, 45, 167) | — | resources back chevron keeps a keyboard focus ring (light) |
| accent-typo.spec.ts | 202 | toBe | rgb(216, 156, 252) | rgb(216, 156, 252) | — | resources back chevron keeps a keyboard focus ring (dark) |
| accent-typo.spec.ts | 258 | toBe | rgb(157, 44, 76) | rgb(157, 44, 76) | — | P5 danger pair: destructive bg + fg resolve and pass 4.5 (light) |
| accent-typo.spec.ts | 258 | toBe | rgb(255, 170, 185) | rgb(255, 170, 185) | — | P5 danger pair: destructive bg + fg resolve and pass 4.5 (dark) |
| accent-typo.spec.ts | 259 | toBe | rgb(255, 255, 255) | rgb(255, 255, 255) | — | P5 danger pair: destructive bg + fg resolve and pass 4.5 (light) |
| accent-typo.spec.ts | 259 | toBe | rgb(71, 36, 43) | rgb(71, 36, 43) | — | P5 danger pair: destructive bg + fg resolve and pass 4.5 (dark) |
| accent-typo.spec.ts | 260 | toBeGreaterThanOrEqual | ≥ 4.5 | 7.245744037415701 | — | P5 danger pair: destructive bg + fg resolve and pass 4.5 (light) |
| accent-typo.spec.ts | 260 | toBeGreaterThanOrEqual | ≥ 4.5 | 7.5249500743166395 | — | P5 danger pair: destructive bg + fg resolve and pass 4.5 (dark) |
| accent-typo.spec.ts | 268 | toBe | rgb(127, 45, 167) | rgb(127, 45, 167) | — | P5 main-button pair passes 4.5 in both themes (light) |
| accent-typo.spec.ts | 268 | toBe | rgb(216, 156, 252) | rgb(216, 156, 252) | — | P5 main-button pair passes 4.5 in both themes (dark) |
| accent-typo.spec.ts | 269 | toBe | rgb(255, 255, 255) | rgb(255, 255, 255) | — | P5 main-button pair passes 4.5 in both themes (light) |
| accent-typo.spec.ts | 269 | toBe | rgb(30, 27, 22) | rgb(30, 27, 22) | — | P5 main-button pair passes 4.5 in both themes (dark) |
| accent-typo.spec.ts | 270 | toBeGreaterThanOrEqual | ≥ 4.5 | 7.405412462698898 | — | P5 main-button pair passes 4.5 in both themes (light) |
| accent-typo.spec.ts | 270 | toBeGreaterThanOrEqual | ≥ 4.5 | 8.23891504188978 | — | P5 main-button pair passes 4.5 in both themes (dark) |
| accent-typo.spec.ts | 287 | toHaveCSS | background-color: rgba(127, 45, 167, 0.14) | rgba(127, 45, 167, 0.14) | color(srgb …) folded to rgba(127, 45, 167, 0.14); re-pin the spec to the rgb/hex form (#411) | P4 row hover rides accent-soft, delete row rides danger-soft (light) |
| accent-typo.spec.ts | 287 | toHaveCSS | background-color: rgba(216, 156, 252, 0.14) | rgba(216, 156, 252, 0.14) | color(srgb …) folded to rgba(216, 156, 252, 0.14); re-pin the spec to the rgb/hex form (#411) | P4 row hover rides accent-soft, delete row rides danger-soft (dark) |
| accent-typo.spec.ts | 292 | toHaveCSS | background-color: rgba(157, 44, 76, 0.14) | rgba(157, 44, 76, 0.14) | color(srgb …) folded to rgba(157, 44, 76, 0.14); re-pin the spec to the rgb/hex form (#411) | P4 row hover rides accent-soft, delete row rides danger-soft (light) |
| accent-typo.spec.ts | 292 | toHaveCSS | background-color: rgba(255, 170, 185, 0.14) | rgba(255, 170, 185, 0.14) | color(srgb …) folded to rgba(255, 170, 185, 0.14); re-pin the spec to the rgb/hex form (#411) | P4 row hover rides accent-soft, delete row rides danger-soft (dark) |
| accent-typo.spec.ts | 307 | toHaveCSS | filter: brightness(1.07) | brightness(1.07) | — | P4 brand button hover brightens 1.07 (light) |
| accent-typo.spec.ts | 307 | toHaveCSS | filter: brightness(1.07) | brightness(1.07) | — | P4 brand button hover brightens 1.07 (dark) |
| chief-panel.spec.ts | 102 | toBeCloseTo | 1022 ±0.5 | 1022 | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 103 | toBeCloseTo | 0 ±0.5 | 0 | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 104 | toBeCloseTo | 418 ±0.5 | 418 | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 105 | toBeCloseTo | 732 ±0.5 | 732 | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 119 | toBe | static | static | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 120 | toBe | 0px | 0px | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 121 | toBe | none | none | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 124 | toBe | 1px | 1px | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 125 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 139 | toBeCloseTo | 782 ±0.5 | 782 | — | board content yields to the panel and the columns keep the D8 guard |
| chief-panel.spec.ts | 150 | toBeGreaterThanOrEqual | ≥ 280 | 280 | — | board content yields to the panel and the columns keep the D8 guard |
| chief-panel.spec.ts | 160 | toBeCloseTo | 1200 ±0.5 | 1200 | — | closing restores the board grid to its resting geometry |
| chief-panel.spec.ts | 167 | toBeGreaterThan | > 0 | 281 | — | closing restores the board grid to its resting geometry |
| chief-panel.spec.ts | 168 | toBeLessThanOrEqual | ≤ 1 | 0 | — | closing restores the board grid to its resting geometry |
| chief-panel.spec.ts | 195 | toBeCloseTo | 1200 ±0.5 | 1200 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 195 | toBeCloseTo | 1200 ±0.5 | 1200 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 195 | toBeCloseTo | 1200 ±0.5 | 1200 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 200 | toBeCloseTo | 1022 ±0.5 | 1022 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 200 | toBeCloseTo | 1022 ±0.5 | 1022 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 200 | toBeCloseTo | 1022 ±0.5 | 1022 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 201 | toBeCloseTo | 0 ±0.5 | 0 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 201 | toBeCloseTo | 0 ±0.5 | 0 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 201 | toBeCloseTo | 0 ±0.5 | 0 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 202 | toBeCloseTo | 418 ±0.5 | 418 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 202 | toBeCloseTo | 418 ±0.5 | 418 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 202 | toBeCloseTo | 418 ±0.5 | 418 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 203 | toBeCloseTo | 732 ±0.5 | 732 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 203 | toBeCloseTo | 732 ±0.5 | 732 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 203 | toBeCloseTo | 732 ±0.5 | 732 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 205 | toBeCloseTo | 782 ±0.5 | 782 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 205 | toBeCloseTo | 782 ±0.5 | 782 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 205 | toBeCloseTo | 782 ±0.5 | 782 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 210 | toBeCloseTo | 1200 ±0.5 | 1200 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 210 | toBeCloseTo | 1200 ±0.5 | 1200 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 210 | toBeCloseTo | 1200 ±0.5 | 1200 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 211 | toBeCloseTo | 240 ±0.5 | 240 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 211 | toBeCloseTo | 240 ±0.5 | 240 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 211 | toBeCloseTo | 240 ±0.5 | 240 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 225 | toBeCloseTo | 1022 ±0.5 | 1022 | — | detail: the panel occupies the right-pane slot, mutually exclusive (D7) |
| chief-panel.spec.ts | 226 | toBeCloseTo | 44 ±0.5 | 44 | — | detail: the panel occupies the right-pane slot, mutually exclusive (D7) |
| chief-panel.spec.ts | 227 | toBeCloseTo | 418 ±0.5 | 418 | — | detail: the panel occupies the right-pane slot, mutually exclusive (D7) |
| chief-panel.spec.ts | 228 | toBeCloseTo | 688 ±0.5 | 688 | — | detail: the panel occupies the right-pane slot, mutually exclusive (D7) |
| chief-panel.spec.ts | 232 | toBeCloseTo | 782 ±0.5 | 782 | — | detail: the panel occupies the right-pane slot, mutually exclusive (D7) |
| chief-panel.spec.ts | 233 | toBe | 1022 | 1022 | — | detail: the panel occupies the right-pane slot, mutually exclusive (D7) |
| chief-panel.spec.ts | 239 | toBe | 712 | 712 | — | detail: the panel occupies the right-pane slot, mutually exclusive (D7) |
| chief-panel.spec.ts | 285 | toBe | 60 | 60 | — | composer keeps one fixed size whether or not a draft is restored (XMON-102) |
| chief-panel.spec.ts | 289 | toBe | 60px | 60px | — | composer keeps one fixed size whether or not a draft is restored (XMON-102) |
| chief-panel.spec.ts | 290 | toBe | 60px | 60px | — | composer keeps one fixed size whether or not a draft is restored (XMON-102) |
| chief-panel.spec.ts | 291 | toBe | auto | auto | — | composer keeps one fixed size whether or not a draft is restored (XMON-102) |
| dead-buttons.spec.ts | 505 | toBeLessThan | < 1.5 | 0 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
| dead-buttons.spec.ts | 506 | toBeCloseTo | 28 ±0.5 | 28 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
| dead-buttons.spec.ts | 507 | toBeCloseTo | 28 ±0.5 | 28 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
| overlay-focus.spec.ts | 56 | not.toBe | auto | solid | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 57 | not.toBe | rgb(0, 95, 204) | rgb(216, 156, 252) | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 61 | toBe | solid | solid | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 62 | toBe | rgb(216, 156, 252) | rgb(216, 156, 252) | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 73 | not.toBe | auto | solid | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 74 | not.toBe | rgb(0, 95, 204) | rgb(216, 156, 252) | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 76 | toBe | solid | solid | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 77 | toBe | rgb(216, 156, 252) | rgb(216, 156, 252) | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 95 | toBe | solid | solid | — | Tab focus keeps the brand ring (keyboard reachability preserved) |
| overlay-focus.spec.ts | 96 | toBe | rgb(216, 156, 252) | rgb(216, 156, 252) | — | Tab focus keeps the brand ring (keyboard reachability preserved) |
| overlay-focus.spec.ts | 125 | toHaveCSS | animation-name: enter | enter | — | backdrop click closes; entry rides the tw-animate-css fade |
| project-github-issues.spec.ts | 200 | toEqual | [{"number":7}] | [{"number":7}] | — | 1. 已连接 github 项目：入口 → 弹层 → 点选导入 → 详情见 issue 标题与全部标签 |
| project-github-issues.spec.ts | 223 | toEqual | ["state=open&page=1"] | ["state=open&page=1"] | — | 4. 状态过滤与分页参数直达请求面；hasMore=false 下一页禁用 |
| project-github-issues.spec.ts | 229 | toEqual | ["state=open&page=1","state=closed&page=1"] | ["state=open&page=1","state=closed&page=1"] | — | 4. 状态过滤与分页参数直达请求面；hasMore=false 下一页禁用 |
| project-github-issues.spec.ts | 237 | toEqual | ["state=open&page=1","state=closed&page=1","state=open&page=2"] | ["state=open&page=1","state=closed&page=1","state=open&page=2"] | — | 4. 状态过滤与分页参数直达请求面；hasMore=false 下一页禁用 |
| project-new-fs-pick.spec.ts | 138 | toBe | 1 | 1 | — | 在飞期按钮 disabled，双击单发 |
| project-new-repo.spec.ts | 248 | toBe | none | none | — | the name input focus ring is the brand ring, not the UA default |
| project-new-repo.spec.ts | 249 | toBe | rgb(216, 156, 252) | rgb(216, 156, 252) | — | the name input focus ring is the brand ring, not the UA default |
| project-new-repo.spec.ts | 250 | toContain | rgb(216, 156, 252) | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgb(216,… | — | the name input focus ring is the brand ring, not the UA default |
| project-new-repo.spec.ts | 251 | toContain | 1px | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgb(216,… | — | the name input focus ring is the brand ring, not the UA default |
| project-new-repo.spec.ts | 265 | toEqual | [{"name":"Plain","teamId":"team-1"}] | [{"name":"Plain","teamId":"team-1"}] | — | untouched submit posts a repo-less body and navigates on 201 |
| project-new-repo.spec.ts | 281 | toEqual | [{"name":"my-repo","teamId":"team-1","kind":"local","localPath":"/tmp/my-repo"},{"name":"pacman","teamId":"tea… | [{"name":"my-repo","kind":"local","localPath":"/tmp/my-repo","teamId":"team-1"},{"name":"pacman","kind":"githu… | — | local and github submits carry kind + their wire field |
| project-new-repo.spec.ts | 325 | toBe | rgb(255, 170, 185) | rgb(255, 170, 185) | — | a 400 localPath reason renders the error row: 路径不存在 |
| project-new-repo.spec.ts | 325 | toBe | rgb(255, 170, 185) | rgb(255, 170, 185) | — | a 400 localPath reason renders the error row: 不是 git 仓库 |
| project-new-repo.spec.ts | 325 | toBe | rgb(255, 170, 185) | rgb(255, 170, 185) | — | a 400 localPath reason renders the error row: 需要绝对路径 |
| project-new-repo.spec.ts | 325 | toBe | rgb(255, 170, 185) | rgb(255, 170, 185) | — | a 400 localPath reason renders the error row: invalid body at localPath: case none |
| project-tasks-toolbar.spec.ts | 49 | toBe | grid | grid | — | view toggle swaps rows for grid cards and persists |
| segmented-controls.spec.ts | 42 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | page-tab: unselected hover tints the chip — dark + light |
| segmented-controls.spec.ts | 44 | toBe | rgba(255, 252, 248, 0.05) | rgba(0, 0, 0, 0) | — | page-tab: unselected hover tints the chip — dark + light |
| segmented-controls.spec.ts | 49 | toBe | rgba(28, 25, 20, 0.05) | {"__fn":"() => bg(lightFiles)"} | — | page-tab: unselected hover tints the chip — dark + light |
| segmented-controls.spec.ts | 59 | toBe | rgb(37, 34, 29) | rgb(37, 34, 29) | — | page-tab: selected chip keeps its fill under hover, same geometry as the hover tint |
| segmented-controls.spec.ts | 62 | toBe | rgb(37, 34, 29) | rgb(37, 34, 29) | — | page-tab: selected chip keeps its fill under hover, same geometry as the hover tint |
| segmented-controls.spec.ts | 76 | toBe | 0px | 0px | — | page-tab: selected chip keeps its fill under hover, same geometry as the hover tint |
| segmented-controls.spec.ts | 86 | toEqual | {"x":840,"y":10,"width":50,"height":24} | {"x":840,"y":10,"width":50,"height":24} | — | page-tab: selected chip keeps its fill under hover, same geometry as the hover tint |
| segmented-controls.spec.ts | 105 | toBe | 1px | 1px | — | page-tab group rides the official hairline ring (r2 24b/24c probe) |
| segmented-controls.spec.ts | 106 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | page-tab group rides the official hairline ring (r2 24b/24c probe) |
| segmented-controls.spec.ts | 107 | toBe | 30 | 30 | — | page-tab group rides the official hairline ring (r2 24b/24c probe) |
| segmented-controls.spec.ts | 108 | toBe | 3 | 3 | — | page-tab group rides the official hairline ring (r2 24b/24c probe) |
| segmented-controls.spec.ts | 109 | toBe | 3 | 3 | — | page-tab group rides the official hairline ring (r2 24b/24c probe) |
| segmented-controls.spec.ts | 133 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | sched freq: dark active chip reads against the container, hover tints the rest |
| segmented-controls.spec.ts | 134 | toBe | rgb(37, 34, 29) | rgb(37, 34, 29) | — | sched freq: dark active chip reads against the container, hover tints the rest |
| segmented-controls.spec.ts | 137 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => bg(weekly)"} | — | sched freq: dark active chip reads against the container, hover tints the rest |
| segmented-controls.spec.ts | 140 | toBe | rgb(239, 233, 225) | rgb(239, 233, 225) | — | sched freq: dark active chip reads against the container, hover tints the rest |
| segmented-controls.spec.ts | 143 | toBe | rgba(28, 25, 20, 0.05) | {"__fn":"() => bg(lightWeekly)"} | — | sched freq: dark active chip reads against the container, hover tints the rest |
| segmented-controls.spec.ts | 150 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => bg(history)"} | — | files seg + tasks view toggle: hover tints the unselected (dark) |
| segmented-controls.spec.ts | 155 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => bg(grid)"} | — | files seg + tasks view toggle: hover tints the unselected (dark) |
| segmented-controls.spec.ts | 164 | toBe | rgba(28, 25, 20, 0.05) | {"__fn":"() => bg(dark)"} | — | user-menu 外观 seg: hover tints, click switches the theme |
| segmented-controls.spec.ts | 183 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => bg(git)"} | — | branch-dialog seg: hover tints Git, click swaps the tab body |
| segmented-controls.spec.ts | 199 | toBe | 1px | 1px | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 200 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 201 | toBe | rgb(239, 233, 225) | rgb(239, 233, 225) | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 205 | toBe | rgba(28, 25, 20, 0.05) | {"border":"1px","groupBg":"rgb(232, 227, 218)"} | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 214 | toBe | rgba(28, 25, 20, 0.05) | {"__fn":"() => bg(charter)"} | — | chief tabs: hover tints, click swaps the view |
| segmented-controls.spec.ts | 241 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 242 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 243 | toBeLessThanOrEqual | ≤ 1 | 0.015625 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 244 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 248 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 254 | toEqual | {"pillZ":"0","pillPe":"none","tabZ":"1"} | {"pillZ":"0","pillPe":"none","tabZ":"1"} | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 292 | toEqual | ["left","width"] | {"__fn":"() => page.evaluate(() => [...new Set(window.__pillRuns)].sort())"} | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 305 | toBeLessThanOrEqual | ≤ 1 | {"__fn":"async () => {\n    const [p, c] = await Promise.all([box(pill), box(charter)]);\n    return Math.max(… | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| shell-consistency.spec.ts | 45 | toEqual | {"x":0,"y":0,"width":240,"height":732} | {"x":0,"y":0,"width":240,"height":732} | — | expanded sidebar keeps identical geometry across /app ↔ /app/team ↔ resources hops |
| shell-consistency.spec.ts | 45 | toEqual | {"x":0,"y":0,"width":40,"height":732} | {"x":0,"y":0,"width":40,"height":732} | — | collapsed rail survives route hops (storage-backed on every shell) |
| shell-consistency.spec.ts | 164 | toEqual | {"iconX":19,"nameX":46,"toggleX":197} | {"__fn":"() => headContentX(page)"} | — | the brand head holds its inner geometry across the /app → /app/team hop |
| shell-consistency.spec.ts | 193 | toBe | 1 | {"__fn":"() => page.evaluate(k => localStorage.getItem(k), SIDEBAR_KEY)"} | — | the collapse toggle works off-board and the state rides back |
| shell-consistency.spec.ts | 216 | toEqual | {"theme":"light","light":"true"} | {"theme":"light","light":"true"} | — | no storage + system light boots light |
| shell-consistency.spec.ts | 222 | toEqual | {"theme":"dark","light":"false"} | {"theme":"dark","light":"false"} | — | no storage + system dark boots dark |
| shell-consistency.spec.ts | 229 | toEqual | {"theme":"dark","light":"false"} | {"theme":"dark","light":"false"} | — | a stored theme beats the system scheme |
| sidebar-seam.spec.ts | 50 | toBe | 1px | 1px | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 50 | toBe | 1px | 1px | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 51 | toBe | solid | solid | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 51 | toBe | solid | solid | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 52 | toBe | none | none | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 52 | toBe | none | none | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 53 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 53 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 54 | toBe | 240 | 240 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 54 | toBe | 240 | 240 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 57 | toBe | 43 | 43 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 57 | toBe | 43 | 43 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 58 | toBe | 43 | 43 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 58 | toBe | 43 | 43 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 59 | toBe | 1px | 1px | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 59 | toBe | 1px | 1px | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 60 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 60 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 61 | toBe | 44 | 44 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 61 | toBe | 44 | 44 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 77 | toBe | 43 | 43 | — | team page: the r7 12 active pill geometry survives the divider row (light) |
| sidebar-seam.spec.ts | 77 | toBe | 43 | 43 | — | team page: the r7 12 active pill geometry survives the divider row (dark) |
| sidebar-seam.spec.ts | 103 | toBe | 1px | 1px | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 103 | toBe | 1px | 1px | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 104 | toBe | none | none | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 104 | toBe | none | none | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 105 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 105 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 106 | toBe | 40 | 40 | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 106 | toBe | 40 | 40 | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 108 | toBe | 44 | 44 | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 108 | toBe | 44 | 44 | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 109 | toBe | 1px | 1px | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 109 | toBe | 1px | 1px | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 128 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | pages shell: the divider runs full width on schedules too (light) |
| sidebar-seam.spec.ts | 128 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | pages shell: the divider runs full width on schedules too (dark) |
| sidebar-seam.spec.ts | 129 | toBe | 43 | 43 | — | pages shell: the divider runs full width on schedules too (light) |
| sidebar-seam.spec.ts | 129 | toBe | 43 | 43 | — | pages shell: the divider runs full width on schedules too (dark) |
| sidebar-seam.spec.ts | 130 | toBe | 44 | 44 | — | pages shell: the divider runs full width on schedules too (light) |
| sidebar-seam.spec.ts | 130 | toBe | 44 | 44 | — | pages shell: the divider runs full width on schedules too (dark) |
| sidebar-seam.spec.ts | 152 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | resources: the full-width line reads one color across the seam (light) |
| sidebar-seam.spec.ts | 152 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | resources: the full-width line reads one color across the seam (dark) |
| sidebar-seam.spec.ts | 153 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | resources: the full-width line reads one color across the seam (light) |
| sidebar-seam.spec.ts | 153 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | resources: the full-width line reads one color across the seam (dark) |
| sidebar-seam.spec.ts | 154 | toBe | 43 | 43 | — | resources: the full-width line reads one color across the seam (light) |
| sidebar-seam.spec.ts | 154 | toBe | 43 | 43 | — | resources: the full-width line reads one color across the seam (dark) |
