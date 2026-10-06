# Probe dump — old baseline → new measured (#921)

Run 2026-10-06T14:11:33.326Z · commit `dff26b8e` · port 8397 · playwright 1.63.0 · workers 4

Specs: all (104 files) · tests 811 passed / 0 failed

## Coverage

Enumerated = static scan of spec source. Collected = distinct runtime call sites that returned a value (polls/themed loops record repeatedly; distinct de-dupes by file:line).

| probe surface | enumerated | collected |
| --- | --- | --- |
| getComputedStyle occurrences (headline count) | 153 | — (captured per evaluate call below) |
| probe-carrying evaluate/waitForFunction call sites | 141 | 142 |
| .boundingBox() call sites | 105 | 105 |
| .toHaveCSS() call sites | 17 | 17 |
| visual-matcher assertion sites | 811 | 994 joined |

Comparison rows: 805 — KEPT 805, DRIFT 0, NOT-RUN 0, VIOLATION 0, other 0.

Review procedure (#910 裁定 5): every DRIFT row is either expected drift (the new canon — re-pin the spec inline value to “new measured”) or a suspected regression (fix the code, keep the baseline). KEPT rows need no action. NOT-RUN rows are assertion sites whose test failed earlier, was skipped, or was filtered out. The `note` column flags values whose source notation is not rgb/hex: `color(srgb …)` is folded to rgba for comparison (re-pin should write the rgb/hex form); oklch/lab/lch and non-sRGB `color()` cannot fold under the #411 contract and are flagged VIOLATION, never converted.

## KEPT — baseline holds on this build (805)

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
| account-team-cleanse.spec.ts | 85 | toBe | 1 | 1 | — | account switch: default permission renders off; click requests and grants |
| account-team-cleanse.spec.ts | 95 | toBe | 0 | 0 | — | account switch: granted permission renders checked without a click |
| account-team-cleanse.spec.ts | 105 | toBe | 1 | 1 | — | account switch: denied stays off; a click settles without granting |
| agent-create-model.spec.ts | 180 | toBeGreaterThanOrEqual | ≥ 202.92141723632812 | 309.2462463378906 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 181 | toBeLessThanOrEqual | ≤ 529.07861328125 | 394.6287536621094 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 192 | toBeGreaterThanOrEqual | ≥ 202.92141723632812 | 307.4756164550781 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 193 | toBeLessThanOrEqual | ≤ 529.07861328125 | 482.7118835449219 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 195 | toBeGreaterThanOrEqual | ≥ 0 | 307.4756164550781 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 196 | toBeGreaterThanOrEqual | ≥ 0 | 514.2000122070312 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 197 | toBeLessThanOrEqual | ≤ 1440 | 729.7999877929688 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 229 | toBeGreaterThanOrEqual | ≥ 195 | 294.41998291015625 | — | 模型很多：选过运行时后菜单不越出裁剪盒，首行可点，40 行一个不少 |
| agent-create-model.spec.ts | 230 | toBeLessThanOrEqual | ≤ 537 | 482.58001708984375 | — | 模型很多：选过运行时后菜单不越出裁剪盒，首行可点，40 行一个不少 |
| agent-delete.spec.ts | 48 | toHaveCSS | font-size: 14px | 14px | — | 概览页脚有删除入口，点开二次确认（canon 原文逐字） |
| agent-delete.spec.ts | 49 | toHaveCSS | line-height: 20px | 20px | — | 概览页脚有删除入口，点开二次确认（canon 原文逐字） |
| agent-detail.spec.ts | 183 | toBeLessThanOrEqual | ≤ 8 | 0 | — | 概览：两级菜单贴触发钮右缘且在内容列内（几何） |
| agent-detail.spec.ts | 184 | toBeLessThanOrEqual | ≤ 8 | 8 | — | 概览：两级菜单贴触发钮右缘且在内容列内（几何） |
| agent-detail.spec.ts | 185 | toBeGreaterThanOrEqual | ≥ 455 | 1027 | — | 概览：两级菜单贴触发钮右缘且在内容列内（几何） |
| agent-detail.spec.ts | 186 | toBeLessThanOrEqual | ≤ 1225 | 1207 | — | 概览：两级菜单贴触发钮右缘且在内容列内（几何） |
| agent-detail.spec.ts | 248 | toBeGreaterThan | > -1 | 3 | — | 概览：运行时档在模型之上，值由 provider 派生 |
| agent-detail.spec.ts | 249 | toBeLessThan | < 4 | 3 | — | 概览：运行时档在模型之上，值由 provider 派生 |
| agent-detail.spec.ts | 395 | toBe | 1 | {"__fn":"() => patches"} | — | 权限 tab：保存失败出可见错误反馈，开关不回弹 |
| agent-detail.spec.ts | 450 | toEqual | ["验收只看真机跑通","PROBE 探针的历史轮次"] | ["验收只看真机跑通","PROBE 探针的历史轮次"] | — | 记忆 tab：搜索扫 content 且 ASCII 大小写不敏感 |
| agent-detail.spec.ts | 468 | toEqual | ["构建分支的命名规律","验收只看真机跑通","PROBE 探针的历史轮次"] | ["构建分支的命名规律","验收只看真机跑通","PROBE 探针的历史轮次"] | — | 记忆 tab：`添加时间` 档按新 → 旧重排 |
| agent-detail.spec.ts | 480 | toEqual | ["PROBE 探针的历史轮次","验收只看真机跑通","构建分支的命名规律"] | ["PROBE 探针的历史轮次","验收只看真机跑通","构建分支的命名规律"] | — | 记忆 tab：`添加时间` 档按新 → 旧重排 |
| agent-detail.spec.ts | 499 | toEqual | ["PROBE 探针的历史轮次","验收只看真机跑通"] | ["PROBE 探针的历史轮次","验收只看真机跑通"] | — | 记忆 tab：搜索与排序叠加——排序只在命中集内生效 |
| agent-detail.spec.ts | 590 | toEqual | ["名称","职责","默认 skill","运行时","模型","思考强度"] | ["名称","职责","默认 skill","运行时","模型","思考强度"] | — | 概览：六个字段行长在同一张模板卡里，头像头在卡内 |
| agent-detail.spec.ts | 638 | toEqual | ["11px","11px"] | ["11px","11px"] | — | 记忆/权限卡：首行不吃卡的上圆角与描边（无方角外溢、无 2px 顶边） |
| agent-detail.spec.ts | 639 | toBe | 0px | 0px | — | 记忆/权限卡：首行不吃卡的上圆角与描边（无方角外溢、无 2px 顶边） |
| agent-identity-chip.spec.ts | 56 | toBe | 24 | 24 | — | F-E1/E2/E10: 头像+名字并排成链，href 指 Agent 设置页，几何 canon 不漂移 |
| agent-identity-chip.spec.ts | 57 | toBe | 24 | 24 | — | F-E1/E2/E10: 头像+名字并排成链，href 指 Agent 设置页，几何 canon 不漂移 |
| agent-identity-chip.spec.ts | 61 | toBe | 12px | 12px | — | F-E1/E2/E10: 头像+名字并排成链，href 指 Agent 设置页，几何 canon 不漂移 |
| agent-identity-chip.spec.ts | 69 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | F-E9: hover 只变 cursor，不发明背景态（参考站正典） |
| agent-identity-chip.spec.ts | 70 | toBe | pointer | pointer | — | F-E9: hover 只变 cursor，不发明背景态（参考站正典） |
| attachment-strip.spec.ts | 296 | toBe | 120 | {"x":257,"y":543,"width":124,"height":84} | — | detail face: paste paints a placeholder, landing swaps it for a chip with zero geometry move |
| attachment-strip.spec.ts | 302 | toBe | 1 | {"x":257,"y":543,"width":124,"height":84} | — | detail face: paste paints a placeholder, landing swaps it for a chip with zero geometry move |
| attachment-strip.spec.ts | 304 | toBe | 1 | {"x":257,"y":543,"width":124,"height":84} | — | detail face: paste paints a placeholder, landing swaps it for a chip with zero geometry move |
| attachment-strip.spec.ts | 315 | toBe | 120 | {"x":257,"y":543,"width":124,"height":84} | — | detail face: paste paints a placeholder, landing swaps it for a chip with zero geometry move |
| attachment-strip.spec.ts | 317 | toEqual | {"x":257,"y":543,"width":124,"height":84} | {"x":257,"y":543,"width":124,"height":84} | — | detail face: paste paints a placeholder, landing swaps it for a chip with zero geometry move |
| attachment-strip.spec.ts | 330 | toBe | 1 | {"__fn":"() => deferred.held.length"} | — | detail face: clicking the settled chip opens the image preview; Esc closes it |
| attachment-strip.spec.ts | 332 | toBe | 1 | {"__fn":"() => deferred.held.length"} | — | detail face: clicking the settled chip opens the image preview; Esc closes it |
| attachment-strip.spec.ts | 345 | toBe | 120 | {"__fn":"() => view.evaluate(el => el.naturalWidth)"} | — | detail face: clicking the settled chip opens the image preview; Esc closes it |
| attachment-strip.spec.ts | 374 | toBe | 120 | {"__fn":"() => view.evaluate(el => el.naturalWidth)"} | — | detail face: clicking the in-flight placeholder previews the local bytes |
| attachment-strip.spec.ts | 385 | toBe | 1 | {"__fn":"() => deferred.held.length"} | — | detail face: clicking the in-flight placeholder previews the local bytes |
| attachment-strip.spec.ts | 415 | toBe | 1 | {"__fn":"() => held.length"} | — | detail face: a failed upload clears the placeholder, toasts, keeps the draft |
| attachment-strip.spec.ts | 457 | toBe | 1 | {"__fn":"() => deferred.held.length"} | — | new-task face: placeholder → settled chip → preview |
| attachment-strip.spec.ts | 459 | toBe | 1 | {"__fn":"() => deferred.held.length"} | — | new-task face: placeholder → settled chip → preview |
| attachment-strip.spec.ts | 469 | toBe | 120 | {"__fn":"() => view.evaluate(el => el.naturalWidth)"} | — | new-task face: placeholder → settled chip → preview |
| attachment-strip.spec.ts | 533 | toBe | 1 | {"__fn":"() => deferred.held.length"} | — | chief face: placeholder → settled chip → preview |
| attachment-strip.spec.ts | 535 | toBe | 1 | {"__fn":"() => deferred.held.length"} | — | chief face: placeholder → settled chip → preview |
| attachment-strip.spec.ts | 545 | toBe | 120 | {"__fn":"() => view.evaluate(el => el.naturalWidth)"} | — | chief face: placeholder → settled chip → preview |
| board-dnd-live.spec.ts | 139 | toBeGreaterThanOrEqual | ≥ 1 | 1 | — | live: done(有变更)→待处理 fires PATCH phase=review, optimistic landing never flashes back |
| board-dnd-live.spec.ts | 153 | toBeGreaterThanOrEqual | ≥ 0 | 1 | — | live: done(有变更)→待处理 fires PATCH phase=review, optimistic landing never flashes back |
| board-dnd-live.spec.ts | 155 | toEqual | [] | [] | — | live: done(有变更)→待处理 fires PATCH phase=review, optimistic landing never flashes back |
| board-dnd-live.spec.ts | 189 | toBeGreaterThanOrEqual | ≥ 1 | 1 | — | live: PATCH 409 = 乐观值作废，卡片弹回源列 + toast 点名失败（#638） |
| board-dnd.spec.ts | 362 | toEqual | ["r3-legacy-1","r3-legacy-2"] | ["r3-legacy-1","r3-legacy-2"] | — | 已完成(有变更) → 待处理: reopen commits review, lands after the pinned group |
| board-dnd.spec.ts | 503 | toEqual | [] | [] | — | 重置闸·取消：零提交（卡片不动、计数不动、无请求发出）(#755) |
| board-dnd.spec.ts | 546 | toBe | 0.4 | 0.4 | — | cards from every column arm the drag gesture (#753) |
| board-dnd.spec.ts | 598 | toEqual | [{"id":"7ve0iOkQ-JBpSL98zSiGc","x":265,"y":95},{"id":"r3-legacy-1","x":855,"y":95},{"id":"r3-legacy-2","x":115… | [{"id":"7ve0iOkQ-JBpSL98zSiGc","x":265,"y":95},{"id":"r3-legacy-1","x":855,"y":95},{"id":"r3-legacy-2","x":115… | — | same-column gesture: siblings never shift, drop is a no-op |
| board-dnd.spec.ts | 603 | toBe | 0 | 0 | — | same-column gesture: siblings never shift, drop is a no-op |
| board-dnd.spec.ts | 654 | toBe | rgba(0, 0, 0, 0.18) 0px 8px 24px 0px | rgba(0, 0, 0, 0.18) 0px 8px 24px 0px | — | lifted card rides the compact drag-tier recipe (light) |
| board-dnd.spec.ts | 654 | toBe | rgba(0, 0, 0, 0.18) 0px 8px 24px 0px | rgba(0, 0, 0, 0.18) 0px 8px 24px 0px | — | lifted card rides the compact drag-tier recipe (dark) |
| board-dnd.spec.ts | 655 | toBe | 2deg | 2deg | — | lifted card rides the compact drag-tier recipe (light) |
| board-dnd.spec.ts | 655 | toBe | 2deg | 2deg | — | lifted card rides the compact drag-tier recipe (dark) |
| board-dnd.spec.ts | 656 | toBe | 0.92 | 0.92 | — | lifted card rides the compact drag-tier recipe (light) |
| board-dnd.spec.ts | 656 | toBe | 0.92 | 0.92 | — | lifted card rides the compact drag-tier recipe (dark) |
| board-dnd.spec.ts | 657 | toBe | 0px | 0px | — | lifted card rides the compact drag-tier recipe (light) |
| board-dnd.spec.ts | 657 | toBe | 0px | 0px | — | lifted card rides the compact drag-tier recipe (dark) |
| board-dnd.spec.ts | 671 | toBeLessThanOrEqual | ≤ 1 | 0 | — | lifted card rides the compact drag-tier recipe (light) |
| board-dnd.spec.ts | 671 | toBeLessThanOrEqual | ≤ 1 | 0 | — | lifted card rides the compact drag-tier recipe (dark) |
| board-dnd.spec.ts | 677 | toBe | 0.4 | 0.4 | — | lifted card rides the compact drag-tier recipe (light) |
| board-dnd.spec.ts | 677 | toBe | 0.4 | 0.4 | — | lifted card rides the compact drag-tier recipe (dark) |
| board-dnd.spec.ts | 721 | toBe | rgba(127, 45, 167, 0.1) | rgba(127, 45, 167, 0.1) | — | valid targets tint base tier, hovered column tints hot (light) |
| board-dnd.spec.ts | 721 | toBe | rgba(216, 156, 252, 0.1) | rgba(216, 156, 252, 0.1) | — | valid targets tint base tier, hovered column tints hot (dark) |
| board-dnd.spec.ts | 722 | toBe | rgb(127, 45, 167) | rgb(127, 45, 167) | — | valid targets tint base tier, hovered column tints hot (light) |
| board-dnd.spec.ts | 722 | toBe | rgb(216, 156, 252) | rgb(216, 156, 252) | — | valid targets tint base tier, hovered column tints hot (dark) |
| board-dnd.spec.ts | 723 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | valid targets tint base tier, hovered column tints hot (light) |
| board-dnd.spec.ts | 723 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | valid targets tint base tier, hovered column tints hot (dark) |
| board-dnd.spec.ts | 727 | toBe | rgba(127, 45, 167, 0.05) | rgba(127, 45, 167, 0.05) | — | valid targets tint base tier, hovered column tints hot (light) |
| board-dnd.spec.ts | 727 | toBe | rgba(216, 156, 252, 0.05) | rgba(216, 156, 252, 0.05) | — | valid targets tint base tier, hovered column tints hot (dark) |
| board-dnd.spec.ts | 728 | toBe | rgb(127, 45, 167) | rgb(127, 45, 167) | — | valid targets tint base tier, hovered column tints hot (light) |
| board-dnd.spec.ts | 728 | toBe | rgb(216, 156, 252) | rgb(216, 156, 252) | — | valid targets tint base tier, hovered column tints hot (dark) |
| board-dnd.spec.ts | 734 | not.toBe | rgba(127, 45, 167, 0.05) | rgb(244, 239, 231) | — | valid targets tint base tier, hovered column tints hot (light) |
| board-dnd.spec.ts | 734 | not.toBe | rgba(216, 156, 252, 0.05) | rgb(30, 27, 22) | — | valid targets tint base tier, hovered column tints hot (dark) |
| board-dnd.spec.ts | 735 | not.toBe | rgba(127, 45, 167, 0.05) | rgb(244, 239, 231) | — | valid targets tint base tier, hovered column tints hot (light) |
| board-dnd.spec.ts | 735 | not.toBe | rgba(216, 156, 252, 0.05) | rgb(30, 27, 22) | — | valid targets tint base tier, hovered column tints hot (dark) |
| board-dnd.spec.ts | 777 | toEqual | [] | [] | — | committed drop never flashes the card back to the source column |
| board-docked-reflow.spec.ts | 75 | toBeGreaterThanOrEqual | ≥ 279 | 280 | — | docked columns hold the 280px floor and the first column is whole |
| board-docked-reflow.spec.ts | 78 | toBeGreaterThanOrEqual | ≥ 239 | 257 | — | docked columns hold the 280px floor and the first column is whole |
| board-docked-reflow.spec.ts | 79 | toBeGreaterThanOrEqual | ≥ 279 | 280 | — | docked columns hold the 280px floor and the first column is whole |
| board-docked-reflow.spec.ts | 81 | toBeGreaterThan | > 782 | 1196 | — | docked columns hold the 280px floor and the first column is whole |
| board-docked-reflow.spec.ts | 96 | toBeGreaterThanOrEqual | ≥ 16 | 177 | — | the clipped next column peeks >=16px at the scroll edge |
| board-docked-reflow.spec.ts | 112 | toBeGreaterThan | > 0 | {"x":240,"y":44,"width":782,"height":688} | — | overflow is reachable: wheel scrolls and the last column lands whole |
| board-docked-reflow.spec.ts | 118 | toBeLessThanOrEqual | ≤ 1023 | 1005 | — | overflow is reachable: wheel scrolls and the last column lands whole |
| board-docked-reflow.spec.ts | 119 | toBeGreaterThanOrEqual | ≥ 239 | 725 | — | overflow is reachable: wheel scrolls and the last column lands whole |
| board-docked-reflow.spec.ts | 120 | toBeGreaterThanOrEqual | ≥ 279 | 280 | — | overflow is reachable: wheel scrolls and the last column lands whole |
| board-docked-reflow.spec.ts | 131 | toHaveCSS | scrollbar-width: auto | auto | — | overflow discloses itself: the scroller no longer hides its scrollbar |
| board-docked-reflow.spec.ts | 150 | toBeLessThanOrEqual | ≤ 2 | 1 | — | cards keep their resting width while docked |
| board-docked-reflow.spec.ts | 169 | toBeLessThanOrEqual | ≤ 1 | 0 | — | worst-case data holds: long title wraps in-column, 120-count header fits, empty column survives |
| board-docked-reflow.spec.ts | 170 | toBeLessThanOrEqual | ≤ 1 | 0 | — | worst-case data holds: long title wraps in-column, 120-count header fits, empty column survives |
| board-docked-reflow.spec.ts | 176 | toBeLessThanOrEqual | ≤ 1 | 0 | — | worst-case data holds: long title wraps in-column, 120-count header fits, empty column survives |
| board-docked-reflow.spec.ts | 182 | toBeGreaterThanOrEqual | ≥ 279 | 280 | — | worst-case data holds: long title wraps in-column, 120-count header fits, empty column survives |
| board-docked-reflow.spec.ts | 199 | toBeGreaterThanOrEqual | ≥ 279 | 280 | — | narrowest usable viewport (1024) docked: floor holds and the page itself never scrolls |
| board-docked-reflow.spec.ts | 201 | toBeGreaterThanOrEqual | ≥ 239 | 257 | — | narrowest usable viewport (1024) docked: floor holds and the page itself never scrolls |
| board-docked-reflow.spec.ts | 205 | toBeLessThanOrEqual | ≤ 0 | 0 | — | narrowest usable viewport (1024) docked: floor holds and the page itself never scrolls |
| board-docked-reflow.spec.ts | 220 | toBeLessThanOrEqual | ≤ 1201 | 1183 | — | RTL mirror: the first column stays whole at the scroll-start edge |
| board-docked-reflow.spec.ts | 221 | toBeGreaterThanOrEqual | ≥ 279 | 280 | — | RTL mirror: the first column stays whole at the scroll-start edge |
| board-docked-reflow.spec.ts | 222 | toBeGreaterThan | > 609 | 903 | — | RTL mirror: the first column stays whole at the scroll-start edge |
| board-docked-reflow.spec.ts | 223 | toBeGreaterThan | > 315 | 609 | — | RTL mirror: the first column stays whole at the scroll-start edge |
| board-docked-reflow.spec.ts | 224 | toBeGreaterThan | > 21 | 315 | — | RTL mirror: the first column stays whole at the scroll-start edge |
| board-docked-reflow.spec.ts | 233 | toBeLessThanOrEqual | ≤ 1200 | 1200 | — | resting geometry at 1440 is untouched by the floor token |
| board-docked-reflow.spec.ts | 236 | toBeGreaterThan | > 280 | 281 | — | resting geometry at 1440 is untouched by the floor token |
| board-docked-reflow.spec.ts | 237 | toBeLessThan | < 282 | 281 | — | resting geometry at 1440 is untouched by the floor token |
| board-docked-reflow.spec.ts | 238 | toBeLessThanOrEqual | ≤ 1 | 0 | — | resting geometry at 1440 is untouched by the floor token |
| board-filter.spec.ts | 119 | toContain | rgba(0, 0, 0, 0) | ["rgba(0, 0, 0, 0)","transparent"] | — | 旧场景（无 projectNames）不渲染仓库面；右动作区恰好一钮 = 无底色类型钮；+任务 不存在 |
| board-filter.spec.ts | 494 | toHaveCSS | background-color: rgb(239, 68, 68) | rgb(239, 68, 68) | — | 任务卡渲染标签 chip：词表配色、无标签零占位、既有几何不漂移 |
| board-filter.spec.ts | 524 | toBe | 16 | 16 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、既有几何不漂移 |
| board-filter.spec.ts | 525 | toBe | 16 | 16 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、既有几何不漂移 |
| board-filter.spec.ts | 526 | toBe | 16 | 16 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、既有几何不漂移 |
| board-filter.spec.ts | 527 | toBe | 94.5 | 94.5 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、既有几何不漂移 |
| board-filter.spec.ts | 529 | toBe | 26.5 | 26.5 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、既有几何不漂移 |
| board-overflow.spec.ts | 37 | toBeLessThanOrEqual | ≤ 733 | 719 | — | 溢出列底边不冲出视口：列贴 scroller 可视高度（行高钉死） |
| board-overflow.spec.ts | 39 | toBeGreaterThanOrEqual | ≥ 43 | 56 | — | 溢出列底边不冲出视口：列贴 scroller 可视高度（行高钉死） |
| board-overflow.spec.ts | 51 | toBe | auto | auto | — | 卡片列表有滚动出口：scrollHeight > clientHeight 且容器可滚 |
| board-overflow.spec.ts | 52 | toBeGreaterThan | > 624 | 1224 | — | 卡片列表有滚动出口：scrollHeight > clientHeight 且容器可滚 |
| board-overflow.spec.ts | 60 | toBeGreaterThan | > 0 | 400 | — | 列表可滚：scrollTo 移动 scrollTop，滚轮同样生效 |
| board-overflow.spec.ts | 74 | toBeGreaterThan | > 0 | {"x":258,"y":94,"width":279,"height":624} | — | 列表可滚：scrollTo 移动 scrollTop，滚轮同样生效 |
| board-overflow.spec.ts | 83 | toBeLessThanOrEqual | ≤ 1 | 0 | — | 列头固定：列表滚动时 header 的视口位置不动 |
| board-overflow.spec.ts | 100 | toBeGreaterThanOrEqual | ≥ 1 | 1 | — | 卡片上下缘由块向内边距保位：首卡上缘、滚到底的末卡下缘都不贴裁切线 |
| board-overflow.spec.ts | 116 | toBeGreaterThan | > 0 | 600 | — | 卡片上下缘由块向内边距保位：首卡上缘、滚到底的末卡下缘都不贴裁切线 |
| board-overflow.spec.ts | 117 | toBeGreaterThanOrEqual | ≥ 1 | 1 | — | 卡片上下缘由块向内边距保位：首卡上缘、滚到底的末卡下缘都不贴裁切线 |
| board-overflow.spec.ts | 135 | toBeLessThanOrEqual | ≤ 733 | 719 | — | 存量场景零漂移：01 列完整贴视口、列底不超 scroller 底缘 |
| board-overflow.spec.ts | 139 | toBeLessThanOrEqual | ≤ 1 | 0 | — | 存量场景零漂移：01 列完整贴视口、列底不超 scroller 底缘 |
| card-press.spec.ts | 56 | not.toBe | rgb(224, 219, 210) | rgb(239, 233, 225) | — | press tints the whole card one surface step (light) |
| card-press.spec.ts | 56 | not.toBe | rgb(63, 60, 54) | rgb(37, 34, 29) | — | press tints the whole card one surface step (dark) |
| card-press.spec.ts | 60 | toHaveCSS | background-color: rgb(224, 219, 210) | rgb(224, 219, 210) | — | press tints the whole card one surface step (light) |
| card-press.spec.ts | 60 | toHaveCSS | background-color: rgb(63, 60, 54) | rgb(63, 60, 54) | — | press tints the whole card one surface step (dark) |
| card-press.spec.ts | 65 | toBe | 1 | 1 | — | press tints the whole card one surface step (light) |
| card-press.spec.ts | 65 | toBe | 1 | 1 | — | press tints the whole card one surface step (dark) |
| card-press.spec.ts | 74 | toHaveCSS | background-color: rgb(239, 233, 225) | rgb(239, 233, 225) | — | press tints the whole card one surface step (light) |
| card-press.spec.ts | 74 | toHaveCSS | background-color: rgb(37, 34, 29) | rgb(37, 34, 29) | — | press tints the whole card one surface step (dark) |
| card-press.spec.ts | 81 | toHaveCSS | user-select: none | none | — | card face is selection- and native-drag-locked (「小链接」绝迹) |
| card-press.spec.ts | 85 | toBe | none | none | — | card face is selection- and native-drag-locked (「小链接」绝迹) |
| card-press.spec.ts | 114 | toBe | 0 | 0 | — | card face is selection- and native-drag-locked (「小链接」绝迹) |
| chat-md-toolout.spec.ts | 87 | toBe | rgb(237, 233, 225) | rgb(237, 233, 225) | — | A3: the output block is left aligned, mono, normal contrast — not a chat-note |
| chat-md-toolout.spec.ts | 131 | toBeGreaterThan | > 290 | 308 | — | B3: nested list items indent past their parent |
| chat-tools-identity.spec.ts | 104 | toBe | 31px | 31px | — | I4: expand/collapse interaction and the #470 row geometry are untouched |
| chat-tools-identity.spec.ts | 105 | toBeLessThanOrEqual | ≤ 16 | 16 | — | I4: expand/collapse interaction and the #470 row geometry are untouched |
| chat-tools-identity.spec.ts | 128 | toEqual | [] | [] | — | I5: the identity row draws no rule — the transcript boundary stays air |
| chat-type-measure.spec.ts | 38 | toBe | 15px | 15px | — | chat body reads at 15px on a unitless 1.6 — the 24px pitch survives |
| chat-type-measure.spec.ts | 40 | toBe | 24px | 24px | — | chat body reads at 15px on a unitless 1.6 — the 24px pitch survives |
| chat-type-measure.spec.ts | 72 | toBe | 1.6 | 1.6 | — | chat body reads at 15px on a unitless 1.6 — the 24px pitch survives |
| chat-type-measure.spec.ts | 106 | toBeGreaterThan | > 67.5 | 67.95796699669967 | — | 68ch measure cap binds the body text and the centered note |
| chat-type-measure.spec.ts | 107 | toBeLessThanOrEqual | ≤ 68.5 | 67.95796699669967 | — | 68ch measure cap binds the body text and the centered note |
| chat-type-measure.spec.ts | 114 | toBe | center | center | — | 68ch measure cap binds the body text and the centered note |
| chat-type-measure.spec.ts | 115 | toBeGreaterThan | > 0 | 321.109 | — | 68ch measure cap binds the body text and the centered note |
| chat-type-measure.spec.ts | 116 | toBe | 321.109px | 321.109px | — | 68ch measure cap binds the body text and the centered note |
| chat-type-measure.spec.ts | 122 | toBeLessThanOrEqual | ≤ 1193 | 1192 | — | 68ch measure cap binds the body text and the centered note |
| chat-type-measure.spec.ts | 135 | toBe | 14px | 14px | — | composer placeholder steps to 14px — one notch under the 15px body |
| chat-type-measure.spec.ts | 136 | toBe | 15px | 15px | — | composer placeholder steps to 14px — one notch under the 15px body |
| chat-type-measure.spec.ts | 154 | toBe | 24 | 24 | — | bubble / avatar / footer keep their own geometry (#470 scope fence) |
| chat-type-measure.spec.ts | 155 | toBe | 15px | 15px | — | bubble / avatar / footer keep their own geometry (#470 scope fence) |
| chat-type-measure.spec.ts | 156 | toEqual | {"w":20,"h":20} | {"w":20,"h":20} | — | bubble / avatar / footer keep their own geometry (#470 scope fence) |
| chat-type-measure.spec.ts | 157 | toBe | 31px | 31px | — | bubble / avatar / footer keep their own geometry (#470 scope fence) |
| chat-type-measure.spec.ts | 199 | toEqual | [] | [] | — | turn boundary is air, not a rule: no divider between a user turn and the agent row |
| chat-type-measure.spec.ts | 203 | toBe | 0px | 0px | — | turn boundary is air, not a rule: no divider between a user turn and the agent row |
| chat-type-measure.spec.ts | 204 | toBe | 0px | 0px | — | turn boundary is air, not a rule: no divider between a user turn and the agent row |
| chat-type-measure.spec.ts | 207 | toBeGreaterThanOrEqual | ≥ 16 | 21 | — | turn boundary is air, not a rule: no divider between a user turn and the agent row |
| chat-type-measure.spec.ts | 208 | toBeLessThanOrEqual | ≤ 32 | 21 | — | turn boundary is air, not a rule: no divider between a user turn and the agent row |
| checkbox-unified.spec.ts | 74 | toBeLessThanOrEqual | ≤ 1 | 1 | — | accept: 原生 input 走官方遮蔽（不画 Mac 复选框） |
| checkbox-unified.spec.ts | 75 | toBeLessThanOrEqual | ≤ 1 | 1 | — | accept: 原生 input 走官方遮蔽（不画 Mac 复选框） |
| checkbox-unified.spec.ts | 76 | toHaveCSS | clip-path: inset(50%) | inset(50%) | — | accept: 原生 input 走官方遮蔽（不画 Mac 复选框） |
| checkbox-unified.spec.ts | 108 | toBeGreaterThan | > 15.5 | 16 | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 109 | toBeLessThan | < 16.5 | 16 | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 110 | toBeGreaterThan | > 15.5 | 16 | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 111 | toBeLessThan | < 16.5 | 16 | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 112 | toHaveCSS | border-radius: 0px | 0px | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 114 | toHaveCSS | font-size: 13px | 13px | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 119 | toBeGreaterThan | > 7.5 | 8 | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 120 | toBeLessThan | < 8.5 | 8 | — | accept: tile 几何 = 16×16 / 圆角 0 / 与文字 gap 8 / 文字 13px |
| checkbox-unified.spec.ts | 134 | toContain | 0.1s | background-color, box-shadow, transform \| 0.1s, 0.1s, 0.08s \| ease-out, ease-out, ease-out | — | accept: 手作三值 = tile 底色 100ms / 勾进场 140ms overshoot / 勾退场 90ms |
| checkbox-unified.spec.ts | 135 | toContain | 0.08s | background-color, box-shadow, transform \| 0.1s, 0.1s, 0.08s \| ease-out, ease-out, ease-out | — | accept: 手作三值 = tile 底色 100ms / 勾进场 140ms overshoot / 勾退场 90ms |
| checkbox-unified.spec.ts | 142 | toContain | 0.14s | 0.14s, 0.14s \| cubic-bezier(0.34, 1.4, 0.64, 1), cubic-bezier(0.34, 1.4, 0.64, 1) | — | accept: 手作三值 = tile 底色 100ms / 勾进场 140ms overshoot / 勾退场 90ms |
| chief-composer-tools.spec.ts | 333 | toBeLessThanOrEqual | ≤ 610 | 604 | — | geometry: the listbox anchors above the composer wrap inside the drawer (FM2) |
| chief-composer-tools.spec.ts | 335 | toBeLessThanOrEqual | ≤ 8 | 0 | — | geometry: the listbox anchors above the composer wrap inside the drawer (FM2) |
| chief-composer-tools.spec.ts | 336 | toBeLessThanOrEqual | ≤ 8 | 0 | — | geometry: the listbox anchors above the composer wrap inside the drawer (FM2) |
| chief-composer-tools.spec.ts | 408 | toBe | 1 | {"__fn":"() => uploads.grants.length"} | — | a mid-line image paste lands the token whole-line at the caret (FM6) |
| chief-composer-tools.spec.ts | 414 | toBe | 1 | {"__fn":"() => uploads.uploads"} | — | a mid-line image paste lands the token whole-line at the caret (FM6) |
| chief-composer-tools.spec.ts | 439 | toBe | 1 | {"__fn":"() => deferred.held.length"} | — | Enter during the upload does not send; after it lands Enter sends the token inside (FM6/FM10) |
| chief-composer-tools.spec.ts | 441 | toBe | 1 | {"__fn":"() => deferred.held.length"} | — | Enter during the upload does not send; after it lands Enter sends the token inside (FM6/FM10) |
| chief-composer-tools.spec.ts | 446 | toBe | 1 | {"__fn":"() => sent.length"} | — | Enter during the upload does not send; after it lands Enter sends the token inside (FM6/FM10) |
| chief-drawer-model.spec.ts | 59 | toBeLessThanOrEqual | ≤ 2 | 0.15625 | — | the model row is a control that opens the anchored model popover |
| chief-drawer-model.spec.ts | 60 | toBeLessThanOrEqual | ≤ 2 | 0 | — | the model row is a control that opens the anchored model popover |
| chief-drawer-model.spec.ts | 61 | toBeGreaterThanOrEqual | ≥ 1022 | 1036 | — | the model row is a control that opens the anchored model popover |
| chief-drawer-model.spec.ts | 62 | toBeLessThanOrEqual | ≤ 1440 | 1316 | — | the model row is a control that opens the anchored model popover |
| chief-drawer-model.spec.ts | 110 | toBeGreaterThanOrEqual | ≥ 4.5 | 6.727591984484132 | — | the selected model row is readable in both themes (#751 A) |
| chief-drawer-model.spec.ts | 111 | not.toBe | rgba(0, 0, 0, 0) | rgb(62, 51, 60) | color(srgb …) folded to rgb(62, 51, 60); re-pin the spec to the rgb/hex form (#411) | the selected model row is readable in both themes (#751 A) |
| chief-drawer-model.spec.ts | 159 | not.toBe | rgba(0, 0, 0, 0) | rgb(223, 207, 217) | color(srgb …) folded to rgb(223, 207, 217); re-pin the spec to the rgb/hex form (#411) | the selected row fill bleeds to the popover edges (#872) |
| chief-drawer-model.spec.ts | 160 | toBeCloseTo | 1 ±0.05 | 1 | — | the selected row fill bleeds to the popover edges (#872) |
| chief-drawer-model.spec.ts | 161 | toBeCloseTo | 1 ±0.05 | 1 | — | the selected row fill bleeds to the popover edges (#872) |
| chief-drawer-model.spec.ts | 163 | toBeCloseTo | 20 ±0.05 | 20 | — | the selected row fill bleeds to the popover edges (#872) |
| chief-drawer-model.spec.ts | 164 | toBeCloseTo | 20 ±0.05 | 20 | — | the selected row fill bleeds to the popover edges (#872) |
| chief-drawer-model.spec.ts | 170 | toBe | 278 | 278 | — | the selected row fill bleeds to the popover edges (#872) |
| chief-drawer-model.spec.ts | 188 | toBe | 1 | 1 | — | the picker search is typeahead-only: absent until a key, retracted on clear (#756) |
| chief-drawer-slash.spec.ts | 163 | toBe | 0 | 0 | — | `/clear` runs without sending and toasts confirmation (F1) |
| chief-drawer-slash.spec.ts | 174 | toBe | 0 | 0 | — | Tab completes without running; Enter without highlight sends (F4) |
| chief-drawer-slash.spec.ts | 179 | toBe | 1 | {"__fn":"() => posts"} | — | Tab completes without running; Enter without highlight sends (F4) |
| chief-drawer-slash.spec.ts | 191 | toBe | 0 | 0 | — | mid-prompt accept inserts literal text, never runs (F3) |
| chief-drawer-slash.spec.ts | 211 | toBeGreaterThanOrEqual | ≥ 0 | 230.19000244140625 | — | /help opens the command panel with the drawer builtins |
| chief-fab.spec.ts | 47 | toEqual | {"width":"48px","height":"48px","right":"504px","bottom":"104px"} | {"width":"48px","height":"48px","right":"504px","bottom":"104px"} | — | the gated FAB keeps the family geometry (48×48, pane offset, composer 让位) |
| chief-fab.spec.ts | 94 | toBeCloseTo | 48 ±0.5 | 48 | — | bound: the board FAB swaps the glyph for the seeded avatar, badge and geometry stay |
| chief-fab.spec.ts | 95 | toBeCloseTo | 48 ±0.5 | 48 | — | bound: the board FAB swaps the glyph for the seeded avatar, badge and geometry stay |
| chief-fab.spec.ts | 96 | toBeCloseTo | 1376 ±0.5 | 1376 | — | bound: the board FAB swaps the glyph for the seeded avatar, badge and geometry stay |
| chief-fab.spec.ts | 97 | toBeCloseTo | 668 ±0.5 | 668 | — | bound: the board FAB swaps the glyph for the seeded avatar, badge and geometry stay |
| chief-fab.spec.ts | 98 | toBeCloseTo | 48 ±0.5 | 48 | — | bound: the board FAB swaps the glyph for the seeded avatar, badge and geometry stay |
| chief-fab.spec.ts | 99 | toBeCloseTo | 48 ±0.5 | 48 | — | bound: the board FAB swaps the glyph for the seeded avatar, badge and geometry stay |
| chief-panel.spec.ts | 105 | toBeCloseTo | 1022 ±0.5 | 1022 | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 106 | toBeCloseTo | 0 ±0.5 | 0 | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 107 | toBeCloseTo | 418 ±0.5 | 418 | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 108 | toBeCloseTo | 732 ±0.5 | 732 | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 122 | toBe | static | static | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 123 | toBe | 0px | 0px | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 124 | toBe | none | none | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 127 | toBe | 1px | 1px | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 128 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | the panel docks flush right as a full-height 418 column (board) |
| chief-panel.spec.ts | 142 | toBeCloseTo | 782 ±0.5 | 782 | — | board content yields to the panel and the columns keep the D8 guard |
| chief-panel.spec.ts | 153 | toBeGreaterThanOrEqual | ≥ 280 | 280 | — | board content yields to the panel and the columns keep the D8 guard |
| chief-panel.spec.ts | 163 | toBeCloseTo | 1200 ±0.5 | 1200 | — | closing restores the board grid to its resting geometry |
| chief-panel.spec.ts | 170 | toBeGreaterThan | > 0 | 281 | — | closing restores the board grid to its resting geometry |
| chief-panel.spec.ts | 171 | toBeLessThanOrEqual | ≤ 1 | 0 | — | closing restores the board grid to its resting geometry |
| chief-panel.spec.ts | 198 | toBeCloseTo | 1200 ±0.5 | 1200 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 198 | toBeCloseTo | 1200 ±0.5 | 1200 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 198 | toBeCloseTo | 1200 ±0.5 | 1200 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 203 | toBeCloseTo | 1022 ±0.5 | 1022 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 203 | toBeCloseTo | 1022 ±0.5 | 1022 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 203 | toBeCloseTo | 1022 ±0.5 | 1022 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 204 | toBeCloseTo | 0 ±0.5 | 0 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 204 | toBeCloseTo | 0 ±0.5 | 0 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 204 | toBeCloseTo | 0 ±0.5 | 0 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 205 | toBeCloseTo | 418 ±0.5 | 418 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 205 | toBeCloseTo | 418 ±0.5 | 418 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 205 | toBeCloseTo | 418 ±0.5 | 418 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 206 | toBeCloseTo | 732 ±0.5 | 732 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 206 | toBeCloseTo | 732 ±0.5 | 732 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 206 | toBeCloseTo | 732 ±0.5 | 732 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 208 | toBeCloseTo | 782 ±0.5 | 782 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 208 | toBeCloseTo | 782 ±0.5 | 782 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 208 | toBeCloseTo | 782 ±0.5 | 782 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 213 | toBeCloseTo | 1200 ±0.5 | 1200 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 213 | toBeCloseTo | 1200 ±0.5 | 1200 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 213 | toBeCloseTo | 1200 ±0.5 | 1200 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 214 | toBeCloseTo | 240 ±0.5 | 240 | — | pages: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 214 | toBeCloseTo | 240 ±0.5 | 240 | — | resources: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 214 | toBeCloseTo | 240 ±0.5 | 240 | — | secondary: the main column narrows by 418 while docked and restores on close |
| chief-panel.spec.ts | 228 | toBeCloseTo | 1022 ±0.5 | 1022 | — | detail: the panel occupies the right-pane slot, mutually exclusive (D7) |
| chief-panel.spec.ts | 229 | toBeCloseTo | 44 ±0.5 | 44 | — | detail: the panel occupies the right-pane slot, mutually exclusive (D7) |
| chief-panel.spec.ts | 230 | toBeCloseTo | 418 ±0.5 | 418 | — | detail: the panel occupies the right-pane slot, mutually exclusive (D7) |
| chief-panel.spec.ts | 231 | toBeCloseTo | 688 ±0.5 | 688 | — | detail: the panel occupies the right-pane slot, mutually exclusive (D7) |
| chief-panel.spec.ts | 235 | toBeCloseTo | 782 ±0.5 | 782 | — | detail: the panel occupies the right-pane slot, mutually exclusive (D7) |
| chief-panel.spec.ts | 236 | toBe | 1022 | 1022 | — | detail: the panel occupies the right-pane slot, mutually exclusive (D7) |
| chief-panel.spec.ts | 242 | toBe | 712 | 712 | — | detail: the panel occupies the right-pane slot, mutually exclusive (D7) |
| chief-panel.spec.ts | 290 | toBe | 60 | 60 | — | composer keeps one fixed size whether or not a draft is restored (XMON-102) |
| chief-panel.spec.ts | 294 | toBe | 60px | 60px | — | composer keeps one fixed size whether or not a draft is restored (XMON-102) |
| chief-panel.spec.ts | 295 | toBe | 60px | 60px | — | composer keeps one fixed size whether or not a draft is restored (XMON-102) |
| chief-panel.spec.ts | 296 | toBe | auto | auto | — | composer keeps one fixed size whether or not a draft is restored (XMON-102) |
| chief-send-fallback.spec.ts | 151 | toBe | 1 | {"__fn":"() => posts"} | — | stale slot: send goes out, fallback toast names it, row heals to 默认 |
| chief-send-fallback.spec.ts | 187 | toBe | 1 | {"__fn":"() => posts"} | — | fresh slot: send goes out with no fallback toast |
| chief-send-fallback.spec.ts | 191 | toBeGreaterThan | > 0 | {"__fn":"() => chiefGets.length"} | — | fresh slot: send goes out with no fallback toast |
| chief-settings.spec.ts | 79 | toBeCloseTo | 16 ±0.05 | 16 | — | agent dialog search keeps its own 16px inset (#872 blast radius) |
| chief-settings.spec.ts | 229 | not.toBe | rgba(0, 0, 0, 0) | rgb(223, 207, 217) | color(srgb …) folded to rgb(223, 207, 217); re-pin the spec to the rgb/hex form (#411) | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 230 | toBeCloseTo | 1 ±0.05 | 1 | — | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 231 | toBeCloseTo | 1 ±0.05 | 1 | — | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 232 | toBeCloseTo | 12 ±0.05 | 12 | — | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 233 | toBeCloseTo | 12 ±0.05 | 12 | — | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 241 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 245 | toBe | 367 | 367 | — | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 268 | toBeCloseTo | 12 ±0.05 | 12 | — | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 330 | toBeLessThanOrEqual | ≤ 202 | 200 | — | 压缩模型 long value truncates, full name on title (dark, #772) |
| chief-settings.spec.ts | 330 | toBeLessThanOrEqual | ≤ 202 | 200 | — | 压缩模型 long value truncates, full name on title (light, #772) |
| chief-stream-markdown.spec.ts | 269 | toBe | 2 | 2 | — | F-R13: todo 提及渲成 chip，锚点指任务详情并可点击导航；字面 #seq/伪 scheme 不出 chip（#675） |
| chief-stream-markdown.spec.ts | 308 | toBe | auto | auto | — | F-R6/R8: 用户行头像 = 真人身份 img（XMON-105 单源），抽屉体可滚动 |
| chief-stream-markdown.spec.ts | 570 | toBe | 24 | 24 | — | F-R18: 在飞存在行可展开（#822）——点箭头看实时步骤，typing 接管不泄漏 |
| chief-stream-markdown.spec.ts | 576 | toBe | 1.5 | 1.5 | — | F-R18: 在飞存在行可展开（#822）——点箭头看实时步骤，typing 接管不泄漏 |
| chief-stream-markdown.spec.ts | 716 | toBe | 44 | 44 | — | F-R16: 单行纯文本气泡几何不漂移（44px 药丸）；多块气泡首/尾块 margin 修剪生效 |
| chief-stream-markdown.spec.ts | 717 | toBe | 14px | 14px | — | F-R16: 单行纯文本气泡几何不漂移（44px 药丸）；多块气泡首/尾块 margin 修剪生效 |
| chief-stream-markdown.spec.ts | 727 | toBe | 0px | 0px | — | F-R16: 单行纯文本气泡几何不漂移（44px 药丸）；多块气泡首/尾块 margin 修剪生效 |
| chief-stream-markdown.spec.ts | 728 | toBe | 0px | 0px | — | F-R16: 单行纯文本气泡几何不漂移（44px 药丸）；多块气泡首/尾块 margin 修剪生效 |
| collapse-family.spec.ts | 74 | toBe | 1 | 1 | — | both sidebar groups persist side by side |
| collapse-family.spec.ts | 77 | toBe | 1 | 1 | — | both sidebar groups persist side by side |
| composer-inline-mention.spec.ts | 286 | toBe | 1 | {"__fn":"() => sent.length"} | — | Enter with a highlight inserts WITHOUT sending; the second Enter sends (r9 §5 fix) |
| composer-inline-mention.spec.ts | 299 | toBe | 1 | {"__fn":"() => sent.length"} | — | Enter without a highlight sends as typed (F1: composer-wire-reject law survives) |
| composer-inline-mention.spec.ts | 361 | toBe | 29 | 29 | — | insert lands a trailing space and the caret after it — typing continues outside the token (F6) |
| composer-inline-mention.spec.ts | 536 | toBeLessThanOrEqual | ≤ 632 | 627 | — | geometry: the listbox stays anchored above the composer (#688 ladder untouched) |
| composer-inline-mention.spec.ts | 538 | toBeLessThanOrEqual | ≤ 8 | 2 | — | geometry: the listbox stays anchored above the composer (#688 ladder untouched) |
| composer-inline-mention.spec.ts | 539 | toBeLessThanOrEqual | ≤ 8 | 1 | — | geometry: the listbox stays anchored above the composer (#688 ladder untouched) |
| composer-inline-mention.spec.ts | 619 | toBe | 1 | {"__fn":"() => sent.length"} | — | files: Enter inserts the bare path with a trailing space and sends on second Enter |
| composer-inline-mention.spec.ts | 657 | not.toBe | none | enter | — | chips: Enter-select renders the file chip with a fresh pop |
| composer-inline-mention.spec.ts | 779 | toBe | 1 | {"__fn":"() => sent.length"} | — | five-kind: todo Enter-inserts the plain #seq token without sending |
| composer-inline-mention.spec.ts | 806 | toBe | 1 | {"__fn":"() => sent.length"} | — | five-kind: machine Enter-inserts without sending; second Enter sends |
| composer-paste.spec.ts | 296 | toBe | 1 | {"__fn":"() => uploads.grants.length"} | — | detail face: a mid-line image paste lands the token whole-line at the caret |
| composer-paste.spec.ts | 302 | toBe | 1 | {"__fn":"() => uploads.uploads"} | — | detail face: a mid-line image paste lands the token whole-line at the caret |
| composer-paste.spec.ts | 306 | toBe | 57 | {"__fn":"() => input.evaluate(el => el.selectionStart)"} | — | detail face: a mid-line image paste lands the token whole-line at the caret |
| composer-paste.spec.ts | 320 | toBe | 2 | {"__fn":"() => uploads.grants.length"} | — | detail face: one multi-image paste puts every token on its own line |
| composer-paste.spec.ts | 322 | toEqual | ["pasted-image-1.png","pasted-image-2.png"] | ["pasted-image-1.png","pasted-image-2.png"] | — | detail face: one multi-image paste puts every token on its own line |
| composer-paste.spec.ts | 339 | toEqual | [] | [] | — | detail face: a text-only paste is never preventDefaulted (FM7 zero change) |
| composer-paste.spec.ts | 356 | toEqual | [] | [] | — | detail face: a non-whitelisted paste is rejected with a toast, grant never fires |
| composer-paste.spec.ts | 375 | toEqual | [] | [] | — | detail face: an over-cap paste is rejected with a toast, grant never fires |
| composer-paste.spec.ts | 388 | toBe | 1 | {"__fn":"() => uploads.grants.length"} | — | detail face: a non-image whitelist file (text/plain) is accepted under its real name |
| composer-paste.spec.ts | 421 | toBe | 1 | {"__fn":"() => uploads.grants.length"} | — | detail face: a mixed file+text clipboard takes the files and drops the text |
| composer-paste.spec.ts | 472 | toBe | 0 | 0 | — | detail face: Enter during the upload does not send; after it lands, Enter sends the token |
| composer-paste.spec.ts | 475 | toBe | 1 | {"__fn":"() => deferred.held.length"} | — | detail face: Enter during the upload does not send; after it lands, Enter sends the token |
| composer-paste.spec.ts | 477 | toBe | 1 | {"__fn":"() => deferred.held.length"} | — | detail face: Enter during the upload does not send; after it lands, Enter sends the token |
| composer-paste.spec.ts | 482 | toBe | 1 | {"__fn":"() => steers"} | — | detail face: Enter during the upload does not send; after it lands, Enter sends the token |
| composer-paste.spec.ts | 525 | toBe | 1 | {"__fn":"() => uploads.grants.length"} | — | new-task face: paste inserts the token line-atomic into the spec and save carries it |
| composer-paste.spec.ts | 552 | toBe | 0 | 0 | — | new-task face: save is blocked while the paste upload is in flight |
| composer-paste.spec.ts | 554 | toBe | 1 | {"__fn":"() => deferred.held.length"} | — | new-task face: save is blocked while the paste upload is in flight |
| composer-paste.spec.ts | 556 | toBe | 1 | {"__fn":"() => deferred.held.length"} | — | new-task face: save is blocked while the paste upload is in flight |
| composer-paste.spec.ts | 561 | toBe | 1 | {"__fn":"() => creates"} | — | new-task face: save is blocked while the paste upload is in flight |
| composer-paste.spec.ts | 603 | toBe | 1 | {"__fn":"() => uploads.grants.length"} | — | detail face probe: a real Cmd/Ctrl+V clipboard image paste rides the same chain |
| composer-slash.spec.ts | 333 | toBeGreaterThanOrEqual | ≥ 0 | 229.2230224609375 | — | /help opens the command panel |
| composer-slash.spec.ts | 334 | toBeLessThanOrEqual | ≤ 732 | 445.7769775390625 | — | /help opens the command panel |
| composer-wire-reject.spec.ts | 160 | toBe | 1 | {"__fn":"() => posts"} | — | detail face: a rejected steer (409) keeps the draft word for word |
| composer-wire-reject.spec.ts | 183 | toBe | 1 | {"__fn":"() => posts"} | — | detail face: an accepted steer clears the draft |
| composer-wire-reject.spec.ts | 218 | toBe | 1 | {"__fn":"() => posts"} | — | chief face: a rejected send (500) keeps the draft and toasts |
| composer-wire-reject.spec.ts | 244 | toBe | 1 | {"__fn":"() => posts"} | — | chief face: an accepted send clears the draft |
| dead-buttons.spec.ts | 524 | toBeLessThan | < 1.5 | 0 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
| dead-buttons.spec.ts | 525 | toBeCloseTo | 28 ±0.5 | 28 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
| dead-buttons.spec.ts | 526 | toBeCloseTo | 28 ±0.5 | 28 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
| detail-3pane.spec.ts | 47 | toBe | 240 | 240 | — | three abutting panes: 240 sidebar \| fluid center \| 488 right |
| detail-3pane.spec.ts | 48 | toBe | 488 | 488 | — | three abutting panes: 240 sidebar \| fluid center \| 488 right |
| detail-3pane.spec.ts | 50 | toBe | 240 | 240 | — | three abutting panes: 240 sidebar \| fluid center \| 488 right |
| detail-3pane.spec.ts | 51 | toBe | 952 | 952 | — | three abutting panes: 240 sidebar \| fluid center \| 488 right |
| detail-3pane.spec.ts | 53 | toBe | 712 | 712 | — | three abutting panes: 240 sidebar \| fluid center \| 488 right |
| detail-3pane.spec.ts | 59 | toBe | 1px | 1px | — | three abutting panes: 240 sidebar \| fluid center \| 488 right |
| detail-3pane.spec.ts | 60 | toBe | none | none | — | three abutting panes: 240 sidebar \| fluid center \| 488 right |
| detail-3pane.spec.ts | 115 | toBe | 0px | 0px | — | composer stays in-flow inside the center column: card form, 16px insets, scroll port ends above it |
| detail-3pane.spec.ts | 116 | toBe | 1px | 1px | — | composer stays in-flow inside the center column: card form, 16px insets, scroll port ends above it |
| detail-3pane.spec.ts | 120 | toBe | relative | relative | — | composer stays in-flow inside the center column: card form, 16px insets, scroll port ends above it |
| detail-3pane.spec.ts | 122 | toBeCloseTo | 256 ±0.5 | 256 | — | composer stays in-flow inside the center column: card form, 16px insets, scroll port ends above it |
| detail-3pane.spec.ts | 123 | toBeCloseTo | 936 ±0.5 | 936 | — | composer stays in-flow inside the center column: card form, 16px insets, scroll port ends above it |
| detail-3pane.spec.ts | 125 | toBeCloseTo | 16 ±0.5 | 16 | — | composer stays in-flow inside the center column: card form, 16px insets, scroll port ends above it |
| detail-3pane.spec.ts | 128 | toBeCloseTo | 632 ±0.5 | 632 | — | composer stays in-flow inside the center column: card form, 16px insets, scroll port ends above it |
| detail-3pane.spec.ts | 130 | toBeGreaterThanOrEqual | ≥ 16 | 16 | — | composer stays in-flow inside the center column: card form, 16px insets, scroll port ends above it |
| detail-3pane.spec.ts | 168 | toBe | 32 | 32 | — | composer controls share one bottom row: stop is the send button's sibling |
| detail-3pane.spec.ts | 169 | toBe | 32 | 32 | — | composer controls share one bottom row: stop is the send button's sibling |
| detail-3pane.spec.ts | 173 | toBeCloseTo | 687 ±0.5 | 687 | — | composer controls share one bottom row: stop is the send button's sibling |
| detail-3pane.spec.ts | 174 | toBeLessThanOrEqual | ≤ 1 | 1 | — | composer controls share one bottom row: stop is the send button's sibling |
| detail-3pane.spec.ts | 176 | toBeCloseTo | 8 ±0.5 | 8 | — | composer controls share one bottom row: stop is the send button's sibling |
| detail-3pane.spec.ts | 178 | toBe | rgb(63, 60, 54) | rgb(63, 60, 54) | — | composer controls share one bottom row: stop is the send button's sibling |
| detail-3pane.spec.ts | 179 | toBe | 1 | 1 | — | composer controls share one bottom row: stop is the send button's sibling |
| detail-3pane.spec.ts | 181 | toBeLessThanOrEqual | ≤ 2 | 2 | — | composer controls share one bottom row: stop is the send button's sibling |
| detail-3pane.spec.ts | 198 | toBe | 712 | 712 | — | composer width tracks the center column across both pane states (488 pane / 418 chief dock) |
| detail-3pane.spec.ts | 199 | toBeCloseTo | 680 ±0.5 | 680 | — | composer width tracks the center column across both pane states (488 pane / 418 chief dock) |
| detail-3pane.spec.ts | 207 | toBeCloseTo | 782 ±0.5 | 782 | — | composer width tracks the center column across both pane states (488 pane / 418 chief dock) |
| detail-3pane.spec.ts | 208 | toBeCloseTo | 750 ±0.5 | 750 | — | composer width tracks the center column across both pane states (488 pane / 418 chief dock) |
| detail-3pane.spec.ts | 290 | toBe | 1200 | 1200 | — | fresh phase: the brief owns the whole center column, right pane collapses |
| detail-narrow.spec.ts | 57 | toBeLessThanOrEqual | ≤ 320 | 320 | — | N1: 320px degrades instead of clipping — no page overflow, no swallowed column scroll |
| detail-narrow.spec.ts | 60 | toBeLessThanOrEqual | ≤ 321 | 320 | — | N1: 320px degrades instead of clipping — no page overflow, no swallowed column scroll |
| detail-narrow.spec.ts | 61 | toBe | 320 | 320 | — | N1: 320px degrades instead of clipping — no page overflow, no swallowed column scroll |
| detail-narrow.spec.ts | 73 | toBeLessThanOrEqual | ≤ 360 | 360 | — | N2: 360 and 390 keep the same law |
| detail-narrow.spec.ts | 74 | toBeLessThanOrEqual | ≤ 361 | 360 | — | N2: 360 and 390 keep the same law |
| detail-narrow.spec.ts | 75 | toBe | 360 | 360 | — | N2: 360 and 390 keep the same law |
| detail-narrow.spec.ts | 102 | toBe | 240 | 240 | — | N3: the degradation stops at 768px — the 3-pane shell survives above it |
| detail-narrow.spec.ts | 103 | toBe | 488 | 488 | — | N3: the degradation stops at 768px — the 3-pane shell survives above it |
| detail-narrow.spec.ts | 122 | toBeLessThanOrEqual | ≤ 320 | 320 | — | N4: the docked chief panel cannot re-overflow the 320px shell |
| detail-narrow.spec.ts | 123 | toBeLessThanOrEqual | ≤ 320 | 320 | — | N4: the docked chief panel cannot re-overflow the 320px shell |
| detail-narrow.spec.ts | 124 | toBeLessThanOrEqual | ≤ 320 | 320 | — | N4: the docked chief panel cannot re-overflow the 320px shell |
| detail-narrow.spec.ts | 145 | toBeGreaterThanOrEqual | ≥ 0 | 12 | — | N5: head actions and the composer stay inside the 320px viewport |
| detail-narrow.spec.ts | 146 | toBeLessThanOrEqual | ≤ 320 | 320 | — | N5: head actions and the composer stay inside the 320px viewport |
| detail-narrow.spec.ts | 147 | toBeGreaterThanOrEqual | ≥ 0 | 16 | — | N5: head actions and the composer stay inside the 320px viewport |
| detail-narrow.spec.ts | 148 | toBeLessThanOrEqual | ≤ 320 | 304 | — | N5: head actions and the composer stay inside the 320px viewport |
| dialog-viewport.spec.ts | 37 | toBeLessThanOrEqual | ≤ 452.5 | 431.01557540893555 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 37 | toBeLessThanOrEqual | ≤ 452.5 | 424.325626373291 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 37 | toBeLessThanOrEqual | ≤ 452.5 | 452 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 37 | toBeLessThanOrEqual | ≤ 452.5 | 290.836669921875 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 37 | toBeLessThanOrEqual | ≤ 452.5 | 231.79998779296875 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 37 | toBeLessThanOrEqual | ≤ 452.5 | 155.79998779296875 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 37 | toBeLessThanOrEqual | ≤ 452.5 | 139.5390167236328 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 38 | toBeGreaterThanOrEqual | ≥ 0 | 34.49220657348633 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 38 | toBeGreaterThanOrEqual | ≥ 0 | 37.83718490600586 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 38 | toBeGreaterThanOrEqual | ≥ 0 | 24 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 38 | toBeGreaterThanOrEqual | ≥ 0 | 104.5816650390625 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 38 | toBeGreaterThanOrEqual | ≥ 0 | 134.10000610351562 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 38 | toBeGreaterThanOrEqual | ≥ 0 | 172.10000610351562 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 38 | toBeGreaterThanOrEqual | ≥ 0 | 180.23048400878906 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 39 | toBeLessThanOrEqual | ≤ 500.5 | 465.5077819824219 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 39 | toBeLessThanOrEqual | ≤ 500.5 | 462.1628112792969 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 39 | toBeLessThanOrEqual | ≤ 500.5 | 476 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 39 | toBeLessThanOrEqual | ≤ 500.5 | 395.4183349609375 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 39 | toBeLessThanOrEqual | ≤ 500.5 | 365.8999938964844 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 39 | toBeLessThanOrEqual | ≤ 500.5 | 327.8999938964844 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 39 | toBeLessThanOrEqual | ≤ 500.5 | 319.7695007324219 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 47 | toBeGreaterThan | > 404 | 1480 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 47 | toBeGreaterThan | > 210 | 308 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
| dialog-viewport.spec.ts | 75 | toEqual | {"x":192,"y":428,"width":416,"height":32} | {"x":192,"y":428,"width":416,"height":32} | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 144 | toBeLessThanOrEqual | ≤ 312.5 | 297.50451278686523 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
| escape-wiring.spec.ts | 89 | toEqual | {"winAdds":0,"winRems":0,"docAdds":0,"docRems":0} | {"winAdds":0,"winRems":0,"docAdds":0,"docRems":0} | — | 开着的层不被重渲染重挂 Escape 接线：URL 写回后单次 Escape 仍收层 |
| escape-wiring.spec.ts | 157 | toEqual | {"winAdds":0,"winRems":0} | {"winAdds":0,"winRems":0} | — | 确认弹层不被根组件重渲染重挂 Escape 接线：⌘K 往返后单次 Escape 仍收层 |
| escape-wiring.spec.ts | 158 | toBe | 6 | 6 | — | 确认弹层不被根组件重渲染重挂 Escape 接线：⌘K 往返后单次 Escape 仍收层 |
| footer-copy.spec.ts | 27 | toBeGreaterThan | > 20 | 54 | — | C1: robot row copy puts the row text on the clipboard |
| github-issue-writeback.spec.ts | 169 | toBe | 0 | 0 | — | 4. 未建成：状态行 + 重试入口；重试成功 → 行升级为回显态（AC3） |
| github-issue-writeback.spec.ts | 174 | toBe | 1 | 1 | — | 4. 未建成：状态行 + 重试入口；重试成功 → 行升级为回显态（AC3） |
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
| mention-picker-center.spec.ts | 21 | toHaveCSS | transform: none | none | — | mention picker stays centered in the production bundle (#448) |
| mention-picker-center.spec.ts | 26 | toBe | 400 | 400 | — | mention picker stays centered in the production bundle (#448) |
| mention-picker-center.spec.ts | 28 | toBeLessThanOrEqual | ≤ 1 | 0 | — | mention picker stays centered in the production bundle (#448) |
| merge-reject.spec.ts | 247 | toBe | 1 | {"__fn":"() => merges"} | — | 看板入口：server 真拒（403）时弹层不关，server 文案原样显出 |
| merge-reject.spec.ts | 263 | toBe | 1 | {"__fn":"() => merges"} | — | 合并成功（202）时弹层照常关，不留错误行 |
| notify-banner.spec.ts | 77 | toBe | 1 | 1 | — | 开启 → requestPermission() fires; granted hides the bar |
| notify-banner.spec.ts | 91 | toBe | 1 | 1 | — | 开启 → denied resolution also hides the bar |
| notify-banner.spec.ts | 100 | toBe | 0 | 0 | — | scenarios without the flag never render the strip |
| notify-click.spec.ts | 195 | toBe | 1 | {"__fn":"() => context.serviceWorkers().length"} | — | T1: 已开窗口点击 → 客户端路由到 href 且不整页重载，pending 槽被清 |
| notify-click.spec.ts | 195 | toBe | 1 | {"__fn":"() => context.serviceWorkers().length"} | — | T2: 无已开窗口点击 → openWindow(href) + pending 槽交接，落地页消费路由 |
| notify-click.spec.ts | 294 | toBe | 1 | 1 | — | T1: 已开窗口点击 → 客户端路由到 href 且不整页重载，pending 槽被清 |
| notify-click.spec.ts | 325 | toEqual | ["/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=16"] | {"__fn":"() => worker.evaluate(() => self.__opened)"} | — | T2: 无已开窗口点击 → openWindow(href) + pending 槽交接，落地页消费路由 |
| notify-click.spec.ts | 374 | toBe | 3 | {"__fn":"() => page.evaluate(() => window.__swNotifs.length)"} | — | T3b: SSE 通知 → 走 SW showNotification 且 href 逐类映射正确（页内构造器零调用） |
| notify-click.spec.ts | 380 | toEqual | {"href":"/app/todo/todo-x"} | {"href":"/app/todo/todo-x"} | — | T3b: SSE 通知 → 走 SW showNotification 且 href 逐类映射正确（页内构造器零调用） |
| notify-click.spec.ts | 383 | toEqual | {"href":"/app/todo/todo-def"} | {"href":"/app/todo/todo-def"} | — | T3b: SSE 通知 → 走 SW showNotification 且 href 逐类映射正确（页内构造器零调用） |
| notify-click.spec.ts | 387 | toEqual | {"href":"/app?chief=chief-xyz"} | {"href":"/app?chief=chief-xyz"} | — | T3b: SSE 通知 → 走 SW showNotification 且 href 逐类映射正确（页内构造器零调用） |
| notify-click.spec.ts | 389 | toBe | 0 | 0 | — | T3b: SSE 通知 → 走 SW showNotification 且 href 逐类映射正确（页内构造器零调用） |
| notify-click.spec.ts | 408 | toBe | 1 | {"__fn":"() => page.evaluate(() => window.__pageNotifs.length)"} | — | T3a: SW 注册失败 → 回退页内 Notification，onclick 整页跳 href |
| overlay-focus.spec.ts | 57 | not.toBe | auto | solid | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 58 | not.toBe | rgb(0, 95, 204) | rgb(216, 156, 252) | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 62 | toBe | solid | solid | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 63 | toBe | rgb(216, 156, 252) | rgb(216, 156, 252) | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 74 | not.toBe | auto | solid | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 75 | not.toBe | rgb(0, 95, 204) | rgb(216, 156, 252) | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 77 | toBe | solid | solid | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 78 | toBe | rgb(216, 156, 252) | rgb(216, 156, 252) | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 96 | toBe | solid | solid | — | Tab focus keeps the brand ring (keyboard reachability preserved) |
| overlay-focus.spec.ts | 97 | toBe | rgb(216, 156, 252) | rgb(216, 156, 252) | — | Tab focus keeps the brand ring (keyboard reachability preserved) |
| overlay-focus.spec.ts | 126 | toHaveCSS | animation-name: enter | enter | — | backdrop click closes; entry rides the tw-animate-css fade |
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
| providers-tabs.spec.ts | 140 | toBe | 456 | 456 | — | 几何：tablist/header/模型行卡同贴内容列左缘，tab 序 pi 左 claude-code 右 |
| providers-tabs.spec.ts | 142 | toBe | 456 | 456 | — | 几何：tablist/header/模型行卡同贴内容列左缘，tab 序 pi 左 claude-code 右 |
| providers-tabs.spec.ts | 144 | toBe | 768 | 768 | — | 几何：tablist/header/模型行卡同贴内容列左缘，tab 序 pi 左 claude-code 右 |
| providers-tabs.spec.ts | 145 | toBe | 768 | 768 | — | 几何：tablist/header/模型行卡同贴内容列左缘，tab 序 pi 左 claude-code 右 |
| providers-tabs.spec.ts | 150 | toBeLessThanOrEqual | ≤ 518.109375 | 518.109375 | — | 几何：tablist/header/模型行卡同贴内容列左缘，tab 序 pi 左 claude-code 右 |
| review-reject.spec.ts | 167 | toBe | 1 | {"__fn":"() => stepPosts"} | — | FM1/FM2: 静息 review 发送 = steps revision 动作面，draft 清空、chip 即时翻规划中 |
| review-reject.spec.ts | 168 | toBe | 0 | 0 | — | FM1/FM2: 静息 review 发送 = steps revision 动作面，draft 清空、chip 即时翻规划中 |
| review-reject.spec.ts | 205 | toBe | 1 | {"__fn":"() => stepPosts"} | — | FM3: 更多菜单出现「请求修改」入口，弹层收反馈后走同一动作面 |
| review-reject.spec.ts | 260 | toBe | 1 | {"__fn":"() => steerPosts"} | — | FM4: 运行中 review（claimed 步在场）发送保持 steer 语义，不抢动作面 |
| review-reject.spec.ts | 261 | toBe | 0 | 0 | — | FM4: 运行中 review（claimed 步在场）发送保持 steer 语义，不抢动作面 |
| review-reject.spec.ts | 281 | toBe | 1 | {"__fn":"() => stepPosts"} | — | FM2: 打回被拒（409 竞态）draft 逐字保留 + 提示行显性，不静默吞 |
| search-close-flash.spec.ts | 36 | toHaveCSS | transform: none | none | — | 第二下 Ctrl+K 关闭不闪：退出透明度单调递减 |
| search-close-flash.spec.ts | 36 | toHaveCSS | transform: none | none | — | 三连击：关→开落在开态且输入聚焦 |
| search-close-flash.spec.ts | 82 | toBeLessThanOrEqual | ≤ 0.43483 | 0.31483 | — | 第二下 Ctrl+K 关闭不闪：退出透明度单调递减 |
| search-focus.spec.ts | 135 | not.toBe | rgba(0, 0, 0, 0) | rgba(255, 252, 248, 0.1) | — | 常亮互斥: page-layer pill dims while the panel is open, restores on close |
| search-focus.spec.ts | 140 | toBe | rgba(0, 0, 0, 0) | {"__fn":"() => pillBg(pill)"} | — | 常亮互斥: page-layer pill dims while the panel is open, restores on close |
| search-focus.spec.ts | 150 | not.toBe | rgba(0, 0, 0, 0) | {"__fn":"() => pillBg(pill)"} | — | 常亮互斥: page-layer pill dims while the panel is open, restores on close |
| search-focus.spec.ts | 160 | not.toBe | rgba(0, 0, 0, 0) | rgba(255, 252, 248, 0.1) | — | 常亮互斥 holds on the collapsed rail form |
| search-focus.spec.ts | 163 | toBe | rgba(0, 0, 0, 0) | {"__fn":"() => pillBg(rail)"} | — | 常亮互斥 holds on the collapsed rail form |
| search-focus.spec.ts | 167 | not.toBe | rgba(0, 0, 0, 0) | {"__fn":"() => pillBg(rail)"} | — | 常亮互斥 holds on the collapsed rail form |
| search-focus.spec.ts | 194 | toHaveCSS | transform: none | none | — | the caret is not clipped where it meets the input edge |
| search-focus.spec.ts | 221 | toBeGreaterThanOrEqual | ≥ 14 | 16 | — | the caret is not clipped where it meets the input edge |
| search-result-rows.spec.ts | 100 | toBe | rgba(0, 0, 0, 0) | {"__fn":"() => rowBg(first)"} | — | 静息无常亮;hover 哪行亮哪行,且只亮一行 |
| search-result-rows.spec.ts | 138 | toBe | rgba(0, 0, 0, 0) | {"__fn":"() => rowBg(second)"} | — | 鼠标一动让位:键盘光标交还 hover |
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
| segmented-controls.spec.ts | 188 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => bg(git)"} | — | branch-dialog seg: hover tints Git, click swaps the tab body |
| segmented-controls.spec.ts | 206 | toBe | 1px | 1px | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 207 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 208 | toBe | rgb(239, 233, 225) | rgb(239, 233, 225) | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 212 | toBe | rgba(28, 25, 20, 0.05) | {"border":"1px","groupBg":"rgb(232, 227, 218)"} | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 223 | toBe | rgba(28, 25, 20, 0.05) | {"__fn":"() => bg(charter)"} | — | chief tabs: hover tints, click swaps the view |
| segmented-controls.spec.ts | 250 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 251 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 252 | toBeLessThanOrEqual | ≤ 1 | 0.015625 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 253 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 257 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 263 | toEqual | {"pillZ":"0","pillPe":"none","tabZ":"1"} | {"pillZ":"0","pillPe":"none","tabZ":"1"} | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 301 | toEqual | ["left","width"] | {"__fn":"() => page.evaluate(() => [...new Set(window.__pillRuns)].sort())"} | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 314 | toBeLessThanOrEqual | ≤ 1 | {"__fn":"async () => {\n    const [p, c] = await Promise.all([box(pill), box(charter)]);\n    return Math.max(… | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| shadcn-primitives.spec.ts | 66 | toBe | contents | contents | — | avatar 落点不生成盒：img 的 containing block 仍是 per-face 容器 |
| shadcn-primitives.spec.ts | 69 | toBe | 24 | 24 | — | avatar 落点不生成盒：img 的 containing block 仍是 per-face 容器 |
| shadcn-primitives.spec.ts | 70 | toBe | 24 | 24 | — | avatar 落点不生成盒：img 的 containing block 仍是 per-face 容器 |
| shadcn-primitives.spec.ts | 71 | toBe | 44 | 44 | — | avatar 落点不生成盒：img 的 containing block 仍是 per-face 容器 |
| shadcn-primitives.spec.ts | 96 | toBe | 16 | 16 | — | tag-chip 落点：落在 registry Badge 上，别名类与 per-face 几何双保（卡面 16 / 面板面 20） |
| shadcn-primitives.spec.ts | 107 | toBe | 20 | 20 | — | tag-chip 落点：落在 registry Badge 上，别名类与 per-face 几何双保（卡面 16 / 面板面 20） |
| shell-consistency.spec.ts | 45 | toEqual | {"x":0,"y":0,"width":240,"height":732} | {"x":0,"y":0,"width":240,"height":732} | — | expanded sidebar keeps identical geometry across /app ↔ /app/team ↔ resources hops |
| shell-consistency.spec.ts | 45 | toEqual | {"x":0,"y":0,"width":40,"height":732} | {"x":0,"y":0,"width":40,"height":732} | — | collapsed rail survives route hops (storage-backed on every shell) |
| shell-consistency.spec.ts | 174 | toEqual | {"iconX":19,"nameX":46,"toggleX":197} | {"__fn":"() => headContentX(page)"} | — | the brand head holds its inner geometry across the /app → /app/team hop |
| shell-consistency.spec.ts | 203 | toBe | 1 | {"__fn":"() => page.evaluate(k => localStorage.getItem(k), SIDEBAR_KEY)"} | — | the collapse toggle works off-board and the state rides back |
| shell-consistency.spec.ts | 226 | toEqual | {"theme":"light","light":"true"} | {"theme":"light","light":"true"} | — | no storage + system light boots light |
| shell-consistency.spec.ts | 232 | toEqual | {"theme":"dark","light":"false"} | {"theme":"dark","light":"false"} | — | no storage + system dark boots dark |
| shell-consistency.spec.ts | 239 | toEqual | {"theme":"dark","light":"false"} | {"theme":"dark","light":"false"} | — | a stored theme beats the system scheme |
| sidebar-nav.spec.ts | 107 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | hover tints the row pill — dark default + light theme |
| sidebar-nav.spec.ts | 111 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => pillBg(row)"} | — | hover tints the row pill — dark default + light theme |
| sidebar-nav.spec.ts | 118 | toBe | rgba(28, 25, 20, 0.05) | {"__fn":"() => pillBg(lightRow)"} | — | hover tints the row pill — dark default + light theme |
| sidebar-nav.spec.ts | 126 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | rail hover tints the 24px pill |
| sidebar-nav.spec.ts | 128 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => pillBg(row)"} | — | rail hover tints the 24px pill |
| sidebar-nav.spec.ts | 141 | toBe | rgba(255, 252, 248, 0.1) | rgba(255, 252, 248, 0.1) | — | selected row keeps its own pill under hover |
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
| sidebar-visual.spec.ts | 71 | toBe | absolute | absolute | — | ⌘K chip is a bordered pill clear of the label (light) |
| sidebar-visual.spec.ts | 71 | toBe | absolute | absolute | — | ⌘K chip is a bordered pill clear of the label (dark) |
| sidebar-visual.spec.ts | 73 | toBe | 1px | 1px | — | ⌘K chip is a bordered pill clear of the label (light) |
| sidebar-visual.spec.ts | 73 | toBe | 1px | 1px | — | ⌘K chip is a bordered pill clear of the label (dark) |
| sidebar-visual.spec.ts | 75 | toBeGreaterThanOrEqual | ≥ 72 | 196.421875 | — | ⌘K chip is a bordered pill clear of the label (light) |
| sidebar-visual.spec.ts | 75 | toBeGreaterThanOrEqual | ≥ 72 | 196.421875 | — | ⌘K chip is a bordered pill clear of the label (dark) |
| sidebar-visual.spec.ts | 76 | toBeGreaterThanOrEqual | ≥ 12 | 18 | — | ⌘K chip is a bordered pill clear of the label (light) |
| sidebar-visual.spec.ts | 76 | toBeGreaterThanOrEqual | ≥ 12 | 18 | — | ⌘K chip is a bordered pill clear of the label (dark) |
| sidebar-visual.spec.ts | 77 | toBeLessThanOrEqual | ≤ 22 | 18 | — | ⌘K chip is a bordered pill clear of the label (light) |
| sidebar-visual.spec.ts | 77 | toBeLessThanOrEqual | ≤ 22 | 18 | — | ⌘K chip is a bordered pill clear of the label (dark) |
| sidebar-visual.spec.ts | 79 | toBeGreaterThanOrEqual | ≥ 18 | 20 | — | ⌘K chip is a bordered pill clear of the label (light) |
| sidebar-visual.spec.ts | 79 | toBeGreaterThanOrEqual | ≥ 18 | 20 | — | ⌘K chip is a bordered pill clear of the label (dark) |
| sidebar-visual.spec.ts | 80 | toBeLessThanOrEqual | ≤ 22 | 20 | — | ⌘K chip is a bordered pill clear of the label (light) |
| sidebar-visual.spec.ts | 80 | toBeLessThanOrEqual | ≤ 22 | 20 | — | ⌘K chip is a bordered pill clear of the label (dark) |
| sidebar-visual.spec.ts | 115 | toEqual | {"top":"2px","bottom":"2px","left":"8px","right":"8px","radius":"0px"} | {"top":"2px","bottom":"2px","left":"8px","right":"8px","radius":"0px"} | — | hover and selected pills share one geometry (light) |
| sidebar-visual.spec.ts | 115 | toEqual | {"top":"2px","bottom":"2px","left":"8px","right":"8px","radius":"0px"} | {"top":"2px","bottom":"2px","left":"8px","right":"8px","radius":"0px"} | — | hover and selected pills share one geometry (dark) |
| sidebar-visual.spec.ts | 118 | toBe | 2px | 2px | — | hover and selected pills share one geometry (light) |
| sidebar-visual.spec.ts | 118 | toBe | 2px | 2px | — | hover and selected pills share one geometry (dark) |
| sidebar-visual.spec.ts | 119 | toBe | 2px | 2px | — | hover and selected pills share one geometry (light) |
| sidebar-visual.spec.ts | 119 | toBe | 2px | 2px | — | hover and selected pills share one geometry (dark) |
| sidebar-visual.spec.ts | 120 | toBe | 0px | 0px | — | hover and selected pills share one geometry (light) |
| sidebar-visual.spec.ts | 120 | toBe | 0px | 0px | — | hover and selected pills share one geometry (dark) |
| sidebar-visual.spec.ts | 124 | toBe | 0px | 0px | — | hover and selected pills share one geometry (light) |
| sidebar-visual.spec.ts | 124 | toBe | 0px | 0px | — | hover and selected pills share one geometry (dark) |
| sidebar-visual.spec.ts | 125 | toBe | 239 | 239 | — | hover and selected pills share one geometry (light) |
| sidebar-visual.spec.ts | 125 | toBe | 239 | 239 | — | hover and selected pills share one geometry (dark) |
| sidebar-visual.spec.ts | 126 | toBe | 240 | 240 | — | hover and selected pills share one geometry (light) |
| sidebar-visual.spec.ts | 126 | toBe | 240 | 240 | — | hover and selected pills share one geometry (dark) |
| sidebar-visual.spec.ts | 153 | toBeGreaterThan | > 6 | 32.05000000000004 | — | selected pill deepens the hover step (light) |
| sidebar-visual.spec.ts | 153 | toBeGreaterThan | > 6 | 33.8 | — | selected pill deepens the hover step (dark) |
| sidebar-visual.spec.ts | 155 | toBeGreaterThan | > 38.05000000000004 | 64.1 | — | selected pill deepens the hover step (light) |
| sidebar-visual.spec.ts | 155 | toBeGreaterThan | > 39.8 | 67.6 | — | selected pill deepens the hover step (dark) |
| sidebar-visual.spec.ts | 165 | toBe | rgba(28, 25, 20, 0.1) | rgba(28, 25, 20, 0.1) | — | selected pill deepens the hover step (light) |
| sidebar-visual.spec.ts | 165 | toBe | rgba(255, 252, 248, 0.1) | rgba(255, 252, 248, 0.1) | — | selected pill deepens the hover step (dark) |
| sidebar-visual.spec.ts | 188 | toBe | absolute | absolute | — | machine-online dot keeps its absolute anchor |
| sidebar-visual.spec.ts | 189 | toBeLessThan | < 2 | 0 | — | machine-online dot keeps its absolute anchor |
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
| spec-brief-card.spec.ts | 126 | toBe | 160px | 160px | — | 3. 图片附件受缩略约束——不再以原尺寸裸图撑破页面 |
| spec-brief-card.spec.ts | 128 | toBe | 100% | 100% | — | 3. 图片附件受缩略约束——不再以原尺寸裸图撑破页面 |
| spec-brief-card.spec.ts | 147 | toBe | 1px | 1px | — | 4. 简报卡配方 = composer 卡家族（1px 边线 / 方角 / surface-secondary 底） |
| spec-brief-card.spec.ts | 148 | toBe | 0px | 0px | — | 4. 简报卡配方 = composer 卡家族（1px 边线 / 方角 / surface-secondary 底） |
| spec-brief-card.spec.ts | 150 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | 4. 简报卡配方 = composer 卡家族（1px 边线 / 方角 / surface-secondary 底） |
| spec-brief-card.spec.ts | 151 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | 4. 简报卡配方 = composer 卡家族（1px 边线 / 方角 / surface-secondary 底） |
| spec-brief-card.spec.ts | 152 | toBe | 15px | 15px | — | 4. 简报卡配方 = composer 卡家族（1px 边线 / 方角 / surface-secondary 底） |
| spec-brief-card.spec.ts | 170 | toBeLessThanOrEqual | ≤ 2 | 0.04399999999998272 | — | 4b. 宽屏下行宽吃 68ch cap（#470 的 60–75 字符带同律） |
| spec-brief-card.spec.ts | 208 | toBe | baseline | baseline | — | 6. 有序列表序号与正文区分、与首行基线对齐、双位数不 jog 内容列 (#814 rework) |
| spec-brief-card.spec.ts | 209 | not.toBe | rgb(237, 233, 225) | rgb(179, 175, 168) | — | 6. 有序列表序号与正文区分、与首行基线对齐、双位数不 jog 内容列 (#814 rework) |
| spec-brief-card.spec.ts | 210 | toBeLessThanOrEqual | ≤ 1 | 0 | — | 6. 有序列表序号与正文区分、与首行基线对齐、双位数不 jog 内容列 (#814 rework) |
| spec-brief-card.spec.ts | 214 | toBeLessThanOrEqual | ≤ 1 | 0 | — | 6. 有序列表序号与正文区分、与首行基线对齐、双位数不 jog 内容列 (#814 rework) |
| spec-flow.spec.ts | 125 | toBeLessThan | < 44 | -797.296875 | — | 2. 简报卡随流滚走：滚到底出视口，滚到顶回列首 |
| spec-flow.spec.ts | 129 | toBeGreaterThanOrEqual | ≥ 43 | 78.703125 | — | 2. 简报卡随流滚走：滚到底出视口，滚到顶回列首 |
| spec-flow.spec.ts | 130 | toBeGreaterThan | > 200 | 876 | — | 2. 简报卡随流滚走：滚到底出视口，滚到顶回列首 |
| spec-flow.spec.ts | 140 | toBe | 712 | 712 | — | 3. 超长无断点行包进中栏：chat 横向 scrollWidth 等于 clientWidth |
| spinner-live.spec.ts | 76 | toEqual | ["0deg","60deg","120deg"] | ["0deg","60deg","120deg"] | — | Atom mounts: stylesheet injected, shell + 3 tilted orbits, staggered 900ms spin |
| spinner-live.spec.ts | 88 | toBe | 900 | 900 | — | Atom mounts: stylesheet injected, shell + 3 tilted orbits, staggered 900ms spin |
| spinner-live.spec.ts | 96 | toBe | 1800 | 1800 | — | Atom mounts: stylesheet injected, shell + 3 tilted orbits, staggered 900ms spin |
| spinner-live.spec.ts | 101 | toEqual | ["-0.9s","-0.6s","-0.3s"] | ["-0.9s","-0.6s","-0.3s"] | — | Atom mounts: stylesheet injected, shell + 3 tilted orbits, staggered 900ms spin |
| spinner-live.spec.ts | 109 | toBe | 16px | 16px | — | root is a 16px square, shell a 16px circle, row keeps 20px |
| spinner-live.spec.ts | 110 | toBe | 16px | 16px | — | root is a 16px square, shell a 16px circle, row keeps 20px |
| spinner-live.spec.ts | 111 | toBe | relative | relative | — | root is a 16px square, shell a 16px circle, row keeps 20px |
| spinner-live.spec.ts | 126 | toBe | 16 | 16 | — | root is a 16px square, shell a 16px circle, row keeps 20px |
| spinner-live.spec.ts | 127 | toBe | 16 | 16 | — | root is a 16px square, shell a 16px circle, row keeps 20px |
| spinner-live.spec.ts | 128 | toBe | 9999px | 9999px | — | root is a 16px square, shell a 16px circle, row keeps 20px |
| spinner-live.spec.ts | 131 | toBe | 1px | 1px | — | root is a 16px square, shell a 16px circle, row keeps 20px |
| spinner-live.spec.ts | 133 | toBe | 20px | 20px | — | root is a 16px square, shell a 16px circle, row keeps 20px |
| spinner-live.spec.ts | 149 | toBe | rgb(216, 156, 252) | rgb(216, 156, 252) | — | root is aria-hidden and shell/ring strokes ride currentColor; label stays the cue |
| spinner-live.spec.ts | 151 | toBe | rgb(216, 156, 252) | rgb(216, 156, 252) | — | root is aria-hidden and shell/ring strokes ride currentColor; label stays the cue |
| spinner-live.spec.ts | 174 | toBe | 0 | 0 | — | prefers-reduced-motion freezes the spins with the static settle transform |
| spinner-live.spec.ts | 176 | toBe | none | none | — | prefers-reduced-motion freezes the spins with the static settle transform |
| spinner-live.spec.ts | 177 | not.toBe | none | matrix(0.5, 0.866025, -0.866025, 0.5, 0, 0) | — | prefers-reduced-motion freezes the spins with the static settle transform |
| team-org-chart.spec.ts | 77 | toEqual | ["claude-sonnet-5 · 默认","qwen3.8-max","glm-5.3-flash"] | ["claude-sonnet-5 · 默认","qwen3.8-max","glm-5.3-flash"] | — | chart 组织图：每个节点带服务商徽标与模型行 |
| team-org-chart.spec.ts | 83 | toEqual | ["r3-builder","r5-scribe","r9-scout"] | ["r3-builder","r5-scribe","r9-scout"] | — | chart 组织图：每个节点带服务商徽标与模型行 |
| team-org-chart.spec.ts | 99 | toBe | dashed | dashed | — | chart 组织图：创建 Agent 是子列末位的虚线节点卡 |
| team-org-chart.spec.ts | 100 | toBe | 8px | 8px | — | chart 组织图：创建 Agent 是子列末位的虚线节点卡 |
| team-org-chart.spec.ts | 101 | toBe | 56 | 56 | — | chart 组织图：创建 Agent 是子列末位的虚线节点卡 |
| team-org-chart.spec.ts | 113 | toBe | 44 | 44 | — | chart 组织图：根与子列之间有 44×1 横向连接线 |
| team-org-chart.spec.ts | 114 | toBe | 1 | 1 | — | chart 组织图：根与子列之间有 44×1 横向连接线 |
| team-org-chart.spec.ts | 127 | toBe | 28 | 28 | — | chart 组织图：子列左缘括号连接件跨首末子节点中心 |
| team-org-chart.spec.ts | 128 | toBe | 127 | 127 | — | chart 组织图：子列左缘括号连接件跨首末子节点中心 |
| team-org-chart.spec.ts | 129 | toBe | 255 | 255 | — | chart 组织图：子列左缘括号连接件跨首末子节点中心 |
| theme-toggle.spec.ts | 30 | toEqual | {"theme":"dark","light":"false"} | {"theme":"dark","light":"false"} | — | default dark: 深色 active; 浅色 click repaints instantly + persists |
| theme-toggle.spec.ts | 36 | toEqual | {"theme":"light","light":"true"} | {"theme":"light","light":"true"} | — | default dark: 深色 active; 浅色 click repaints instantly + persists |
| theme-toggle.spec.ts | 45 | toEqual | {"theme":"light","light":"true"} | {"theme":"light","light":"true"} | — | selection survives reload |
| theme-toggle.spec.ts | 49 | toEqual | {"theme":"light","light":"true"} | {"theme":"light","light":"true"} | — | selection survives reload |
| theme-toggle.spec.ts | 55 | toEqual | {"theme":"dark","light":"false"} | {"theme":"dark","light":"false"} | — | selection survives reload |
| theme-toggle.spec.ts | 64 | toEqual | {"theme":"light","light":"true"} | {"theme":"light","light":"true"} | — | injected storage pins the initial segment (storage injection path) |
| theme-toggle.spec.ts | 72 | toEqual | {"theme":"dark","light":"false"} | {"theme":"dark","light":"false"} | — | clicking the active segment is a stable no-op |
| theme-toggle.spec.ts | 99 | toEqual | {"theme":"light","light":"true"} | {"theme":"light","light":"true"} | — | theme flip rides the transition suppression and drops it after the paint |
| theme-toggle.spec.ts | 125 | toEqual | [{"rel":"icon","href":"/logo.svg","media":"null"},{"rel":"icon","href":"/icon-192-dark.png","media":"(prefers-… | [{"rel":"icon","href":"/logo.svg","media":"null"},{"rel":"icon","href":"/icon-192-dark.png","media":"(prefers-… | — | icon + apple-touch-icon carry prefers-color-scheme variants that resolve |
| title-band-clicks.spec.ts | 50 | toBeGreaterThan | > 0 | 1 | — | team right-slot action owns its hit area (设置 slot under the same band) |
| token-gate.spec.ts | 206 | toBe | 200 | 200 | — | 鉴权关：零门页零 token 附带，行为与现状一致 |
| transcript-user-words.spec.ts | 225 | toBe | 24 | 24 | — | 5. 单段短消息气泡保持 24px 药丸高度（几何不漂移） |
| transcript-user-words.spec.ts | 226 | toBe | 15px | 15px | — | 5. 单段短消息气泡保持 24px 药丸高度（几何不漂移） |
| user-menu-trigger.spec.ts | 93 | toBe | 8 | 8 | — | expanded chip: click opens anchored above the chip, re-click closes |
| user-menu-trigger.spec.ts | 93 | toBe | 8 | 8 | — | rail chip opens the same popover, unclipped by the 40px rail |
| user-menu-trigger.spec.ts | 93 | toBe | 8 | 8 | — | #163 anchoring: bottom distance is viewport-invariant, the chip is never covered — both shapes |
| user-menu-trigger.spec.ts | 94 | toBe | 224 | 224 | — | expanded chip: click opens anchored above the chip, re-click closes |
| user-menu-trigger.spec.ts | 94 | toBe | 224 | 224 | — | rail chip opens the same popover, unclipped by the 40px rail |
| user-menu-trigger.spec.ts | 94 | toBe | 224 | 224 | — | #163 anchoring: bottom distance is viewport-invariant, the chip is never covered — both shapes |
| user-menu-trigger.spec.ts | 96 | toBeGreaterThanOrEqual | ≥ 3 | 4 | — | expanded chip: click opens anchored above the chip, re-click closes |
| user-menu-trigger.spec.ts | 96 | toBeGreaterThanOrEqual | ≥ 3 | 4 | — | rail chip opens the same popover, unclipped by the 40px rail |
| user-menu-trigger.spec.ts | 96 | toBeGreaterThanOrEqual | ≥ 3 | 4 | — | #163 anchoring: bottom distance is viewport-invariant, the chip is never covered — both shapes |
| user-menu-trigger.spec.ts | 97 | toBeLessThanOrEqual | ≤ 5 | 4 | — | expanded chip: click opens anchored above the chip, re-click closes |
| user-menu-trigger.spec.ts | 97 | toBeLessThanOrEqual | ≤ 5 | 4 | — | rail chip opens the same popover, unclipped by the 40px rail |
| user-menu-trigger.spec.ts | 97 | toBeLessThanOrEqual | ≤ 5 | 4 | — | #163 anchoring: bottom distance is viewport-invariant, the chip is never covered — both shapes |
| user-menu-trigger.spec.ts | 99 | toBeGreaterThan | > 0 | 14.5 | — | expanded chip: click opens anchored above the chip, re-click closes |
| user-menu-trigger.spec.ts | 99 | toBeGreaterThan | > 0 | 11 | — | rail chip opens the same popover, unclipped by the 40px rail |
| user-menu-trigger.spec.ts | 99 | toBeGreaterThan | > 0 | 14.5 | — | #163 anchoring: bottom distance is viewport-invariant, the chip is never covered — both shapes |
| user-menu-trigger.spec.ts | 177 | toBeLessThanOrEqual | ≤ 1 | 0 | — | #163 anchoring: bottom distance is viewport-invariant, the chip is never covered — both shapes |
| visual-polish.spec.ts | 83 | toBe | 0px | 0px | — | board card rides the single-source edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 83 | toBe | 0px | 0px | — | board card rides the single-source edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 84 | toBe | 0px | 0px | — | board card rides the single-source edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 84 | toBe | 0px | 0px | — | board card rides the single-source edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 85 | toContain | 0px 0px 0px 1px | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklab(0.… | — | board card rides the single-source edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 85 | toContain | 0px 0px 0px 1px | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklab(0.… | — | board card rides the single-source edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 86 | not.toContain | inset | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklab(0.… | — | board card rides the single-source edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 86 | not.toContain | inset | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklab(0.… | — | board card rides the single-source edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 98 | toBe | 1px | 1px | — | board column container rides the same edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 98 | toBe | 1px | 1px | — | board column container rides the same edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 99 | toBe | 0px | 0px | — | board column container rides the same edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 99 | toBe | 0px | 0px | — | board column container rides the same edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 100 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | board column container rides the same edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 100 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | board column container rides the same edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 101 | not.toContain | inset | none | — | board column container rides the same edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 101 | not.toContain | inset | none | — | board column container rides the same edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 114 | toBe | 0px | 0px | — | notify banner rides the same edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 114 | toBe | 0px | 0px | — | notify banner rides the same edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 115 | toBe | 0px | 0px | — | notify banner rides the same edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 115 | toBe | 0px | 0px | — | notify banner rides the same edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 118 | toContain | rgba(28, 25, 23, 0.08) 0px 2px 8px 0px | rgb(232, 227, 218) 0px 0px 0px 1px inset, rgba(28, 25, 23, 0.08) 0px 2px 8px 0px | — | notify banner rides the same edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 118 | toContain | rgba(0, 0, 0, 0.24) 0px 2px 6px 0px | rgb(45, 42, 36) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0.24) 0px 2px 6px 0px | — | notify banner rides the same edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 129 | toBe | 1px | 1px | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (light) |
| visual-polish.spec.ts | 129 | toBe | 1px | 1px | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (dark) |
| visual-polish.spec.ts | 130 | toBe | 0px | 0px | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (light) |
| visual-polish.spec.ts | 130 | toBe | 0px | 0px | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (dark) |
| visual-polish.spec.ts | 131 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (light) |
| visual-polish.spec.ts | 131 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (dark) |
| visual-polish.spec.ts | 138 | toBe | none | none | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (dark) |
| visual-polish.spec.ts | 140 | toContain | rgba(0, 0, 0, 0.12) 0px 6px 16px 0px | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, … | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (light) |
| visual-polish.spec.ts | 167 | toBe | rgb(244, 239, 231) | rgb(244, 239, 231) | — | sidebar shares the main-area surface, seam drawn in the divider token (light) |
| visual-polish.spec.ts | 167 | toBe | rgb(30, 27, 22) | rgb(30, 27, 22) | — | sidebar shares the main-area surface, seam drawn in the divider token (dark) |
| visual-polish.spec.ts | 168 | toBe | 1px | 1px | — | sidebar shares the main-area surface, seam drawn in the divider token (light) |
| visual-polish.spec.ts | 168 | toBe | 1px | 1px | — | sidebar shares the main-area surface, seam drawn in the divider token (dark) |
| visual-polish.spec.ts | 169 | toBe | rgb(232, 227, 218) | rgb(232, 227, 218) | — | sidebar shares the main-area surface, seam drawn in the divider token (light) |
| visual-polish.spec.ts | 169 | toBe | rgb(45, 42, 36) | rgb(45, 42, 36) | — | sidebar shares the main-area surface, seam drawn in the divider token (dark) |
| visual-polish.spec.ts | 170 | toBe | none | none | — | sidebar shares the main-area surface, seam drawn in the divider token (light) |
| visual-polish.spec.ts | 170 | toBe | none | none | — | sidebar shares the main-area surface, seam drawn in the divider token (dark) |
| visual-polish.spec.ts | 194 | toBe | auto | auto | — | board grid lays out four even columns with no horizontal scroll (light) |
| visual-polish.spec.ts | 194 | toBe | auto | auto | — | board grid lays out four even columns with no horizontal scroll (dark) |
| visual-polish.spec.ts | 195 | toBe | 0 | 0 | — | board grid lays out four even columns with no horizontal scroll (light) |
| visual-polish.spec.ts | 195 | toBe | 0 | 0 | — | board grid lays out four even columns with no horizontal scroll (dark) |
| visual-polish.spec.ts | 199 | toBe | 0 | 0 | — | board grid lays out four even columns with no horizontal scroll (light) |
| visual-polish.spec.ts | 199 | toBe | 0 | 0 | — | board grid lays out four even columns with no horizontal scroll (dark) |
| visual-polish.spec.ts | 207 | toBeGreaterThan | > 0 | 281 | — | board grid lays out four even columns with no horizontal scroll (light) |
| visual-polish.spec.ts | 207 | toBeGreaterThan | > 0 | 281 | — | board grid lays out four even columns with no horizontal scroll (dark) |
| visual-polish.spec.ts | 208 | toBeLessThanOrEqual | ≤ 1 | 0 | — | board grid lays out four even columns with no horizontal scroll (light) |
| visual-polish.spec.ts | 208 | toBeLessThanOrEqual | ≤ 1 | 0 | — | board grid lays out four even columns with no horizontal scroll (dark) |
| visual-polish.spec.ts | 223 | toBe | 1px | 1px | — | collapsed rail keeps the same drawn-seam treatment (#135 裁决 v2) |
| visual-polish.spec.ts | 224 | toBe | none | none | — | collapsed rail keeps the same drawn-seam treatment (#135 裁决 v2) |
| z-ladder.spec.ts | 64 | toEqual | ["true","true","true","true","true"] | ["true","true","true","true","true"] | — | every probe point of the new-task panel hit-tests inside the panel |
