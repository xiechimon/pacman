# Probe dump — old baseline → new measured (#921)

Run 2026-10-05T19:01:13.317Z · commit `4c9149d6` · port 8400 · playwright 1.63.0 · workers 4

Specs: skills-page skills-write provider-add-dialog provider-oauth providers-tabs secret-add-dialog machine-add-dialog machines-chief-state machines-local machines-shell-switch dialog-viewport dead-buttons accent-typo title-band-clicks shell-consistency chief-panel sidebar-seam checkbox-unified agent-detail (20 files) · tests 217 passed / 0 failed

## Coverage

Enumerated = static scan of spec source. Collected = distinct runtime call sites that returned a value (polls/themed loops record repeatedly; distinct de-dupes by file:line).

| probe surface | enumerated | collected |
| --- | --- | --- |
| getComputedStyle occurrences (headline count) | 34 | — (captured per evaluate call below) |
| probe-carrying evaluate/waitForFunction call sites | 27 | 27 |
| .boundingBox() call sites | 37 | 37 |
| .toHaveCSS() call sites | 6 | 6 |
| visual-matcher assertion sites | 180 | 277 joined |

Comparison rows: 241 — KEPT 241, DRIFT 0, NOT-RUN 0, VIOLATION 0, other 0.

Review procedure (#910 裁定 5): every DRIFT row is either expected drift (the new canon — re-pin the spec inline value to “new measured”) or a suspected regression (fix the code, keep the baseline). KEPT rows need no action. NOT-RUN rows are assertion sites whose test failed earlier, was skipped, or was filtered out. The `note` column flags values whose source notation is not rgb/hex: `color(srgb …)` is folded to rgba for comparison (re-pin should write the rgb/hex form); oklch/lab/lch and non-sRGB `color()` cannot fold under the #411 contract and are flagged VIOLATION, never converted.

## KEPT — baseline holds on this build (241)

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
| accent-typo.spec.ts | 170 | toEqual | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(53, 49, 42)","opacity":"1","iconX":204,"iconY":14.5,"ico… | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(53, 49, 42)","opacity":"1","iconX":204,"iconY":14.5,"ico… | — | the sidebar toggles hold face and geometry while pressed (light) |
| accent-typo.spec.ts | 170 | toEqual | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(179, 175, 168)","opacity":"1","iconX":204,"iconY":14.5,"… | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(179, 175, 168)","opacity":"1","iconX":204,"iconY":14.5,"… | — | the sidebar toggles hold face and geometry while pressed (dark) |
| accent-typo.spec.ts | 175 | toBe | 1 | 1 | — | the sidebar toggles hold face and geometry while pressed (light) |
| accent-typo.spec.ts | 175 | toBe | 1 | 1 | — | the sidebar toggles hold face and geometry while pressed (dark) |
| accent-typo.spec.ts | 176 | toEqual | {"bg":"rgba(28, 25, 20, 0.05)","shadow":"none","color":"rgb(53, 49, 42)","opacity":"1","iconX":13,"iconY":14.5… | {"bg":"rgba(28, 25, 20, 0.05)","shadow":"none","color":"rgb(53, 49, 42)","opacity":"1","iconX":13,"iconY":14.5… | — | the sidebar toggles hold face and geometry while pressed (light) |
| accent-typo.spec.ts | 176 | toEqual | {"bg":"rgba(255, 252, 248, 0.05)","shadow":"none","color":"rgb(179, 175, 168)","opacity":"1","iconX":13,"iconY… | {"bg":"rgba(255, 252, 248, 0.05)","shadow":"none","color":"rgb(179, 175, 168)","opacity":"1","iconX":13,"iconY… | — | the sidebar toggles hold face and geometry while pressed (dark) |
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
| agent-detail.spec.ts | 182 | toBeLessThanOrEqual | ≤ 8 | 0 | — | 概览：两级菜单贴触发钮右缘且在内容列内（几何） |
| agent-detail.spec.ts | 183 | toBeLessThanOrEqual | ≤ 8 | 8 | — | 概览：两级菜单贴触发钮右缘且在内容列内（几何） |
| agent-detail.spec.ts | 184 | toBeGreaterThanOrEqual | ≥ 455 | 1027 | — | 概览：两级菜单贴触发钮右缘且在内容列内（几何） |
| agent-detail.spec.ts | 185 | toBeLessThanOrEqual | ≤ 1225 | 1207 | — | 概览：两级菜单贴触发钮右缘且在内容列内（几何） |
| agent-detail.spec.ts | 247 | toBeGreaterThan | > -1 | 3 | — | 概览：运行时档在模型之上，值由 provider 派生 |
| agent-detail.spec.ts | 248 | toBeLessThan | < 4 | 3 | — | 概览：运行时档在模型之上，值由 provider 派生 |
| agent-detail.spec.ts | 394 | toBe | 1 | {"__fn":"() => patches"} | — | 权限 tab：保存失败出可见错误反馈，开关不回弹 |
| agent-detail.spec.ts | 449 | toEqual | ["验收只看真机跑通","PROBE 探针的历史轮次"] | ["验收只看真机跑通","PROBE 探针的历史轮次"] | — | 记忆 tab：搜索扫 content 且 ASCII 大小写不敏感 |
| agent-detail.spec.ts | 467 | toEqual | ["构建分支的命名规律","验收只看真机跑通","PROBE 探针的历史轮次"] | ["构建分支的命名规律","验收只看真机跑通","PROBE 探针的历史轮次"] | — | 记忆 tab：`添加时间` 档按新 → 旧重排 |
| agent-detail.spec.ts | 479 | toEqual | ["PROBE 探针的历史轮次","验收只看真机跑通","构建分支的命名规律"] | ["PROBE 探针的历史轮次","验收只看真机跑通","构建分支的命名规律"] | — | 记忆 tab：`添加时间` 档按新 → 旧重排 |
| agent-detail.spec.ts | 498 | toEqual | ["PROBE 探针的历史轮次","验收只看真机跑通"] | ["PROBE 探针的历史轮次","验收只看真机跑通"] | — | 记忆 tab：搜索与排序叠加——排序只在命中集内生效 |
| agent-detail.spec.ts | 589 | toEqual | ["名称","职责","默认 skill","运行时","模型","思考强度"] | ["名称","职责","默认 skill","运行时","模型","思考强度"] | — | 概览：六个字段行长在同一张模板卡里，头像头在卡内 |
| agent-detail.spec.ts | 637 | toEqual | ["11px","11px"] | ["11px","11px"] | — | 记忆/权限卡：首行不吃卡的上圆角与描边（无方角外溢、无 2px 顶边） |
| agent-detail.spec.ts | 638 | toBe | 0px | 0px | — | 记忆/权限卡：首行不吃卡的上圆角与描边（无方角外溢、无 2px 顶边） |
| checkbox-unified.spec.ts | 69 | toBeLessThanOrEqual | ≤ 1 | 1 | — | accept: 原生 input 走官方遮蔽（不画 Mac 复选框） |
| checkbox-unified.spec.ts | 70 | toBeLessThanOrEqual | ≤ 1 | 1 | — | accept: 原生 input 走官方遮蔽（不画 Mac 复选框） |
| checkbox-unified.spec.ts | 71 | toHaveCSS | clip-path: inset(50%) | inset(50%) | — | accept: 原生 input 走官方遮蔽（不画 Mac 复选框） |
| checkbox-unified.spec.ts | 102 | toBeGreaterThan | > 15.5 | 16 | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 103 | toBeLessThan | < 16.5 | 16 | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 104 | toBeGreaterThan | > 15.5 | 16 | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 105 | toBeLessThan | < 16.5 | 16 | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 106 | toHaveCSS | border-radius: 0px | 0px | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 108 | toHaveCSS | font-size: 13px | 13px | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 113 | toBeGreaterThan | > 7.5 | 8 | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 114 | toBeLessThan | < 8.5 | 8 | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 128 | toContain | 0.1s | background-color, box-shadow, transform \| 0.1s, 0.1s, 0.08s \| ease-out, ease-out, ease-out | — | accept: 手作三值 = tile 底色 100ms / 勾进场 140ms overshoot / 勾退场 90ms |
| checkbox-unified.spec.ts | 129 | toContain | 0.08s | background-color, box-shadow, transform \| 0.1s, 0.1s, 0.08s \| ease-out, ease-out, ease-out | — | accept: 手作三值 = tile 底色 100ms / 勾进场 140ms overshoot / 勾退场 90ms |
| checkbox-unified.spec.ts | 136 | toContain | 0.14s | 0.14s, 0.14s \| cubic-bezier(0.34, 1.4, 0.64, 1), cubic-bezier(0.34, 1.4, 0.64, 1) | — | accept: 手作三值 = tile 底色 100ms / 勾进场 140ms overshoot / 勾退场 90ms |
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
| dialog-viewport.spec.ts | 32 | toBeLessThanOrEqual | ≤ 452.5 | 434.39524841308594 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 32 | toBeLessThanOrEqual | ≤ 452.5 | 424.33039474487305 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 32 | toBeLessThanOrEqual | ≤ 452.5 | 452 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 32 | toBeLessThanOrEqual | ≤ 452.5 | 290.82994079589844 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 32 | toBeLessThanOrEqual | ≤ 452.5 | 232.6639404296875 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 32 | toBeLessThanOrEqual | ≤ 452.5 | 160.19483947753906 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 32 | toBeLessThanOrEqual | ≤ 452.5 | 139.54132080078125 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 33 | toBeGreaterThanOrEqual | ≥ 0 | 32.80238342285156 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 33 | toBeGreaterThanOrEqual | ≥ 0 | 37.83479690551758 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 33 | toBeGreaterThanOrEqual | ≥ 0 | 24 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 33 | toBeGreaterThanOrEqual | ≥ 0 | 104.58503723144531 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 33 | toBeGreaterThanOrEqual | ≥ 0 | 133.66802978515625 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 33 | toBeGreaterThanOrEqual | ≥ 0 | 169.90257263183594 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 33 | toBeGreaterThanOrEqual | ≥ 0 | 180.22933959960938 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 34 | toBeLessThanOrEqual | ≤ 500.5 | 467.1976318359375 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 34 | toBeLessThanOrEqual | ≤ 500.5 | 462.1651916503906 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 34 | toBeLessThanOrEqual | ≤ 500.5 | 476 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 34 | toBeLessThanOrEqual | ≤ 500.5 | 395.41497802734375 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 34 | toBeLessThanOrEqual | ≤ 500.5 | 366.33197021484375 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 34 | toBeLessThanOrEqual | ≤ 500.5 | 330.097412109375 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 34 | toBeLessThanOrEqual | ≤ 500.5 | 319.7706604003906 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThan | > 404 | 1480 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThan | > 210 | 308 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
| dialog-viewport.spec.ts | 70 | toEqual | {"x":192,"y":428,"width":416,"height":32} | {"x":192,"y":428,"width":416,"height":32} | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 136 | toBeLessThanOrEqual | ≤ 312.5 | 297.4943103790283 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
| machines-chief-state.spec.ts | 73 | toBe | 60 | 60 | — | 行高契约保持：标注行不破行高（首行 60 / 分隔行 59+1px） |
| machines-chief-state.spec.ts | 80 | toBe | 59 | 59 | — | 行高契约保持：标注行不破行高（首行 60 / 分隔行 59+1px） |
| machines-chief-state.spec.ts | 81 | toBe | 1 | 1 | — | 行高契约保持：标注行不破行高（首行 60 / 分隔行 59+1px） |
| machines-local.spec.ts | 142 | toBe | 16 | 16 | — | mark 几何：16×16 mark，on/off 透明度分离，行高契约不破 |
| machines-local.spec.ts | 143 | toBe | 16 | 16 | — | mark 几何：16×16 mark，on/off 透明度分离，行高契约不破 |
| machines-local.spec.ts | 145 | toBe | 1 | 1 | — | mark 几何：16×16 mark，on/off 透明度分离，行高契约不破 |
| machines-local.spec.ts | 146 | toBe | 0.35 | 0.35 | — | mark 几何：16×16 mark，on/off 透明度分离，行高契约不破 |
| machines-local.spec.ts | 147 | toBe | 16 | 16 | — | mark 几何：16×16 mark，on/off 透明度分离，行高契约不破 |
| machines-local.spec.ts | 148 | toBe | 60 | 60 | — | mark 几何：16×16 mark，on/off 透明度分离，行高契约不破 |
| machines-shell-switch.spec.ts | 126 | toBe | 1 | {"__fn":"() => state.patches.length"} | — | 拨 on：PATCH 单字段 {shellEnabled:true}，刷新后仍 on（读侧真值一致） |
| machines-shell-switch.spec.ts | 127 | toEqual | {"shellEnabled":"true"} | {"shellEnabled":"true"} | — | 拨 on：PATCH 单字段 {shellEnabled:true}，刷新后仍 on（读侧真值一致） |
| machines-shell-switch.spec.ts | 142 | toBe | 1 | {"__fn":"() => state.patches.length"} | — | 拨 off：同律回写 false 并持久 |
| machines-shell-switch.spec.ts | 143 | toEqual | {"shellEnabled":"false"} | {"shellEnabled":"false"} | — | 拨 off：同律回写 false 并持久 |
| machines-shell-switch.spec.ts | 179 | toBe | 1 | {"__fn":"() => patches"} | — | PATCH 失败：开关回滚 + 可见错误反馈 |
| providers-tabs.spec.ts | 140 | toBe | 456 | 456 | — | 几何：tablist/header/模型行卡同贴内容列左缘，tab 序 pi 左 claude-code 右 |
| providers-tabs.spec.ts | 142 | toBe | 456 | 456 | — | 几何：tablist/header/模型行卡同贴内容列左缘，tab 序 pi 左 claude-code 右 |
| providers-tabs.spec.ts | 144 | toBe | 768 | 768 | — | 几何：tablist/header/模型行卡同贴内容列左缘，tab 序 pi 左 claude-code 右 |
| providers-tabs.spec.ts | 145 | toBe | 768 | 768 | — | 几何：tablist/header/模型行卡同贴内容列左缘，tab 序 pi 左 claude-code 右 |
| providers-tabs.spec.ts | 150 | toBeLessThanOrEqual | ≤ 518.109375 | 518.109375 | — | 几何：tablist/header/模型行卡同贴内容列左缘，tab 序 pi 左 claude-code 右 |
| shell-consistency.spec.ts | 45 | toEqual | {"x":0,"y":0,"width":240,"height":732} | {"x":0,"y":0,"width":240,"height":732} | — | expanded sidebar keeps identical geometry across /app ↔ /app/team ↔ resources hops |
| shell-consistency.spec.ts | 45 | toEqual | {"x":0,"y":0,"width":40,"height":732} | {"x":0,"y":0,"width":40,"height":732} | — | collapsed rail survives route hops (storage-backed on every shell) |
| shell-consistency.spec.ts | 162 | toEqual | {"iconX":19,"nameX":46,"toggleX":197} | {"__fn":"() => headContentX(page)"} | — | the brand head holds its inner geometry across the /app → /app/team hop |
| shell-consistency.spec.ts | 191 | toBe | 1 | {"__fn":"() => page.evaluate(k => localStorage.getItem(k), SIDEBAR_KEY)"} | — | the collapse toggle works off-board and the state rides back |
| shell-consistency.spec.ts | 213 | toEqual | {"theme":"light","light":"true"} | {"theme":"light","light":"true"} | — | no storage + system light boots light |
| shell-consistency.spec.ts | 219 | toEqual | {"theme":"dark","light":"false"} | {"theme":"dark","light":"false"} | — | no storage + system dark boots dark |
| shell-consistency.spec.ts | 226 | toEqual | {"theme":"dark","light":"false"} | {"theme":"dark","light":"false"} | — | a stored theme beats the system scheme |
| sidebar-seam.spec.ts | 45 | toBe | 1px | 1px | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 45 | toBe | 1px | 1px | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 46 | toBe | solid | solid | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 46 | toBe | solid | solid | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 47 | toBe | none | none | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 47 | toBe | none | none | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 48 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 48 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 49 | toBe | 240 | 240 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 49 | toBe | 240 | 240 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 52 | toBe | 43 | 43 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 52 | toBe | 43 | 43 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 53 | toBe | 43 | 43 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 53 | toBe | 43 | 43 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 54 | toBe | 1px | 1px | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 54 | toBe | 1px | 1px | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 55 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 55 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 56 | toBe | 44 | 44 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 56 | toBe | 44 | 44 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 72 | toBe | 43 | 43 | — | team page: the r7 12 active pill geometry survives the divider row (light) |
| sidebar-seam.spec.ts | 72 | toBe | 43 | 43 | — | team page: the r7 12 active pill geometry survives the divider row (dark) |
| sidebar-seam.spec.ts | 98 | toBe | 1px | 1px | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 98 | toBe | 1px | 1px | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 99 | toBe | none | none | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 99 | toBe | none | none | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 100 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 100 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 101 | toBe | 40 | 40 | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 101 | toBe | 40 | 40 | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 103 | toBe | 44 | 44 | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 103 | toBe | 44 | 44 | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 104 | toBe | 1px | 1px | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 104 | toBe | 1px | 1px | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 123 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | pages shell: the divider runs full width on schedules too (light) |
| sidebar-seam.spec.ts | 123 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | pages shell: the divider runs full width on schedules too (dark) |
| sidebar-seam.spec.ts | 124 | toBe | 43 | 43 | — | pages shell: the divider runs full width on schedules too (light) |
| sidebar-seam.spec.ts | 124 | toBe | 43 | 43 | — | pages shell: the divider runs full width on schedules too (dark) |
| sidebar-seam.spec.ts | 125 | toBe | 44 | 44 | — | pages shell: the divider runs full width on schedules too (light) |
| sidebar-seam.spec.ts | 125 | toBe | 44 | 44 | — | pages shell: the divider runs full width on schedules too (dark) |
| sidebar-seam.spec.ts | 145 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | resources: the full-width line reads one color across the seam (light) |
| sidebar-seam.spec.ts | 145 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | resources: the full-width line reads one color across the seam (dark) |
| sidebar-seam.spec.ts | 146 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | resources: the full-width line reads one color across the seam (light) |
| sidebar-seam.spec.ts | 146 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | resources: the full-width line reads one color across the seam (dark) |
| sidebar-seam.spec.ts | 147 | toBe | 43 | 43 | — | resources: the full-width line reads one color across the seam (light) |
| sidebar-seam.spec.ts | 147 | toBe | 43 | 43 | — | resources: the full-width line reads one color across the seam (dark) |
| skills-page.spec.ts | 86 | toBeGreaterThan | > 0 | 1 | — | live 列表消费 GET /api/skills（server 换源后 wire 形状不变） |
| skills-page.spec.ts | 144 | toBe | 768 | 768 | — | 回归 #486/#494：技能列表可由滚轮到达，且滚动条贴面板右缘 |
| skills-page.spec.ts | 151 | toBeCloseTo | 1440 ±0.5 | 1440 | — | 回归 #486/#494：技能列表可由滚轮到达，且滚动条贴面板右缘 |
| skills-page.spec.ts | 152 | toBeGreaterThan | > 768 | 1200 | — | 回归 #486/#494：技能列表可由滚轮到达，且滚动条贴面板右缘 |
| skills-page.spec.ts | 161 | toBeGreaterThanOrEqual | ≥ 0 | 668 | — | 回归 #486/#494：技能列表可由滚轮到达，且滚动条贴面板右缘 |
| skills-page.spec.ts | 162 | toBeLessThanOrEqual | ≤ 733 | 732 | — | 回归 #486/#494：技能列表可由滚轮到达，且滚动条贴面板右缘 |
| skills-page.spec.ts | 165 | toBe | 768 | 768 | — | 回归 #486/#494：技能列表可由滚轮到达，且滚动条贴面板右缘 |
| skills-page.spec.ts | 167 | toBe | 0 | 0 | — | 回归 #486/#494：技能列表可由滚轮到达，且滚动条贴面板右缘 |
| skills-page.spec.ts | 168 | toBe | 44 | 44 | — | 回归 #486/#494：技能列表可由滚轮到达，且滚动条贴面板右缘 |
| skills-page.spec.ts | 169 | toBe | 0 | 0 | — | 回归 #486/#494：技能列表可由滚轮到达，且滚动条贴面板右缘 |
| skills-write.spec.ts | 231 | toBeGreaterThanOrEqual | ≥ 2 | 2 | — | live 编辑预填读 404：表单让位错误块，列表失效重取 |
| title-band-clicks.spec.ts | 47 | toBeGreaterThan | > 0 | 1 | — | team right-slot action owns its hit area (设置 slot under the same band) |
