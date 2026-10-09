# Probe dump — old baseline → new measured (#921)

Run 2026-10-08T16:18:58.691Z · commit `0c17239a` · port 8400 · playwright 1.63.0 · workers 4

Specs: dialog-viewport machine-add-dialog provider-add-dialog provider-oauth secret-add-dialog agent-create-model team-create-agent chief-settings skills-write merge-reject review-reject reject-chain rerun-close-family detail-esc detail-3pane checkbox-unified branch-button dead-buttons escape-wiring overlay-focus z-ladder board-dnd card-press attachment-strip attachment-title mention-picker-center search-close-flash search-focus search-result-rows newtask-project-select newtask-machine-persist newtask-single-field project-github-issues github-issue-writeback project-settings-delete agent-delete segmented-controls shadcn-primitives board-filter (41 files) · tests 285 passed / 0 failed

## Coverage

Enumerated = static scan of spec source. Collected = distinct runtime call sites that returned a value (polls/themed loops record repeatedly; distinct de-dupes by file:line).

| probe surface | enumerated | collected |
| --- | --- | --- |
| getComputedStyle occurrences (headline count) | 43 | — (captured per evaluate call below) |
| probe-carrying evaluate/waitForFunction call sites | 45 | 45 |
| .boundingBox() call sites | 49 | 49 |
| .toHaveCSS() call sites | 13 | 13 |
| visual-matcher assertion sites | 262 | 304 joined |

Comparison rows: 253 — KEPT 253, DRIFT 0, NOT-RUN 0, VIOLATION 0, other 0.

Review procedure (#910 裁定 5): every DRIFT row is either expected drift (the new canon — re-pin the spec inline value to “new measured”) or a suspected regression (fix the code, keep the baseline). KEPT rows need no action. NOT-RUN rows are assertion sites whose test failed earlier, was skipped, or was filtered out. The `note` column flags values whose source notation is not rgb/hex: `color(srgb …)` is folded to rgba for comparison (re-pin should write the rgb/hex form); oklch/lab/lch and non-sRGB `color()` cannot fold under the #411 contract and are flagged VIOLATION, never converted.

## KEPT — baseline holds on this build (253)

| spec | line | matcher | old baseline | new measured | note | test |
| --- | --- | --- | --- | --- | --- | --- |
| agent-create-model.spec.ts | 184 | toBeGreaterThanOrEqual | ≥ 228.9540557861328 | 277.51507568359375 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 185 | toBeLessThanOrEqual | ≤ 470.7447509765625 | 364.35992431640625 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 196 | toBeGreaterThanOrEqual | ≥ 228.9540557861328 | 253.80540466308594 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 197 | toBeLessThanOrEqual | ≤ 470.7447509765625 | 432.382080078125 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 199 | toBeGreaterThanOrEqual | ≥ 0 | 253.80540466308594 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 200 | toBeGreaterThanOrEqual | ≥ 0 | 512.1450805664062 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 201 | toBeLessThanOrEqual | ≤ 1440 | 731.85498046875 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 233 | toBeGreaterThanOrEqual | ≥ 226 | 240.80772399902344 | — | 模型很多：选过运行时后菜单不越出裁剪盒，首行可点，40 行一个不少 |
| agent-create-model.spec.ts | 234 | toBeLessThanOrEqual | ≤ 473 | 432.1922607421875 | — | 模型很多：选过运行时后菜单不越出裁剪盒，首行可点，40 行一个不少 |
| agent-delete.spec.ts | 48 | toHaveCSS | font-size: 14px | 14px | — | 概览页脚有删除入口，点开二次确认（canon 原文逐字） |
| agent-delete.spec.ts | 49 | toHaveCSS | line-height: 20px | 20px | — | 概览页脚有删除入口，点开二次确认（canon 原文逐字） |
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
| board-dnd-live.spec.ts | 140 | toBeGreaterThanOrEqual | ≥ 1 | 1 | — | live: done(有变更)→待处理 fires PATCH phase=review, optimistic landing never flashes back |
| board-dnd-live.spec.ts | 154 | toBeGreaterThanOrEqual | ≥ 0 | 2 | — | live: done(有变更)→待处理 fires PATCH phase=review, optimistic landing never flashes back |
| board-dnd-live.spec.ts | 156 | toEqual | [] | [] | — | live: done(有变更)→待处理 fires PATCH phase=review, optimistic landing never flashes back |
| board-dnd-live.spec.ts | 190 | toBeGreaterThanOrEqual | ≥ 1 | 1 | — | live: PATCH 409 = 乐观值作废，卡片弹回源列 + toast 点名失败（#638） |
| board-dnd-live.spec.ts | 212 | toEqual | [] | [] | — | live: review(有变更)→已完成 开 done 闸，取消 = 零 PATCH、卡停源列 (#901) |
| board-dnd-live.spec.ts | 219 | toEqual | [] | [] | — | live: review(有变更)→已完成 开 done 闸，取消 = 零 PATCH、卡停源列 (#901) |
| board-dnd-live.spec.ts | 236 | toEqual | [] | [] | — | live: review(有变更)→已完成 确认后发 PATCH phase=done，乐观落位 (#901) |
| board-dnd-live.spec.ts | 244 | toBeGreaterThanOrEqual | ≥ 1 | 1 | — | live: review(有变更)→已完成 确认后发 PATCH phase=done，乐观落位 (#901) |
| board-dnd.spec.ts | 365 | toEqual | ["r3-legacy-1","r3-legacy-2"] | ["r3-legacy-1","r3-legacy-2"] | — | 已完成(有变更) → 待处理: reopen commits review, lands after the pinned group |
| board-dnd.spec.ts | 506 | toEqual | [] | [] | — | 重置闸·取消：零提交（卡片不动、计数不动、无请求发出）(#755) |
| board-dnd.spec.ts | 566 | toEqual | [] | [] | — | done 闸·取消：review(有变更) 拖已完成开弹层，取消零提交（卡不动、计数不动、无写请求）(#901) |
| board-dnd.spec.ts | 641 | toBe | 0.4 | 0.4 | — | cards from every column arm the drag gesture (#753) |
| board-dnd.spec.ts | 693 | toEqual | [{"id":"7ve0iOkQ-JBpSL98zSiGc","x":265,"y":95},{"id":"r3-legacy-1","x":855,"y":95},{"id":"r3-legacy-2","x":115… | [{"id":"7ve0iOkQ-JBpSL98zSiGc","x":265,"y":95},{"id":"r3-legacy-1","x":855,"y":95},{"id":"r3-legacy-2","x":115… | — | same-column gesture: siblings never shift, drop is a no-op |
| board-dnd.spec.ts | 698 | toBe | 0 | 0 | — | same-column gesture: siblings never shift, drop is a no-op |
| board-dnd.spec.ts | 749 | toBe | rgba(0, 0, 0, 0.18) 0px 8px 24px 0px | rgba(0, 0, 0, 0.18) 0px 8px 24px 0px | — | lifted card rides the compact drag-tier recipe (light) |
| board-dnd.spec.ts | 749 | toBe | rgba(0, 0, 0, 0.18) 0px 8px 24px 0px | rgba(0, 0, 0, 0.18) 0px 8px 24px 0px | — | lifted card rides the compact drag-tier recipe (dark) |
| board-dnd.spec.ts | 750 | toBe | 2deg | 2deg | — | lifted card rides the compact drag-tier recipe (light) |
| board-dnd.spec.ts | 750 | toBe | 2deg | 2deg | — | lifted card rides the compact drag-tier recipe (dark) |
| board-dnd.spec.ts | 751 | toBe | 0.92 | 0.92 | — | lifted card rides the compact drag-tier recipe (light) |
| board-dnd.spec.ts | 751 | toBe | 0.92 | 0.92 | — | lifted card rides the compact drag-tier recipe (dark) |
| board-dnd.spec.ts | 752 | toBe | 0px | 0px | — | lifted card rides the compact drag-tier recipe (light) |
| board-dnd.spec.ts | 752 | toBe | 0px | 0px | — | lifted card rides the compact drag-tier recipe (dark) |
| board-dnd.spec.ts | 766 | toBeLessThanOrEqual | ≤ 1 | 0 | — | lifted card rides the compact drag-tier recipe (light) |
| board-dnd.spec.ts | 766 | toBeLessThanOrEqual | ≤ 1 | 0 | — | lifted card rides the compact drag-tier recipe (dark) |
| board-dnd.spec.ts | 772 | toBe | 0.4 | 0.4 | — | lifted card rides the compact drag-tier recipe (light) |
| board-dnd.spec.ts | 772 | toBe | 0.4 | 0.4 | — | lifted card rides the compact drag-tier recipe (dark) |
| board-dnd.spec.ts | 816 | toBe | rgba(151, 34, 126, 0.1) | rgba(151, 34, 126, 0.1) | — | valid targets tint base tier, hovered column tints hot (light) |
| board-dnd.spec.ts | 816 | toBe | rgba(242, 148, 216, 0.1) | rgba(242, 148, 216, 0.1) | — | valid targets tint base tier, hovered column tints hot (dark) |
| board-dnd.spec.ts | 817 | toBe | rgb(151, 34, 126) | rgb(151, 34, 126) | — | valid targets tint base tier, hovered column tints hot (light) |
| board-dnd.spec.ts | 817 | toBe | rgb(242, 148, 216) | rgb(242, 148, 216) | — | valid targets tint base tier, hovered column tints hot (dark) |
| board-dnd.spec.ts | 818 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | valid targets tint base tier, hovered column tints hot (light) |
| board-dnd.spec.ts | 818 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | valid targets tint base tier, hovered column tints hot (dark) |
| board-dnd.spec.ts | 822 | toBe | rgba(151, 34, 126, 0.05) | rgba(151, 34, 126, 0.05) | — | valid targets tint base tier, hovered column tints hot (light) |
| board-dnd.spec.ts | 822 | toBe | rgba(242, 148, 216, 0.05) | rgba(242, 148, 216, 0.05) | — | valid targets tint base tier, hovered column tints hot (dark) |
| board-dnd.spec.ts | 823 | toBe | rgb(151, 34, 126) | rgb(151, 34, 126) | — | valid targets tint base tier, hovered column tints hot (light) |
| board-dnd.spec.ts | 823 | toBe | rgb(242, 148, 216) | rgb(242, 148, 216) | — | valid targets tint base tier, hovered column tints hot (dark) |
| board-dnd.spec.ts | 829 | not.toBe | rgba(151, 34, 126, 0.05) | rgb(246, 241, 236) | — | valid targets tint base tier, hovered column tints hot (light) |
| board-dnd.spec.ts | 829 | not.toBe | rgba(242, 148, 216, 0.05) | rgb(31, 27, 24) | — | valid targets tint base tier, hovered column tints hot (dark) |
| board-dnd.spec.ts | 830 | not.toBe | rgba(151, 34, 126, 0.05) | rgb(246, 241, 236) | — | valid targets tint base tier, hovered column tints hot (light) |
| board-dnd.spec.ts | 830 | not.toBe | rgba(242, 148, 216, 0.05) | rgb(31, 27, 24) | — | valid targets tint base tier, hovered column tints hot (dark) |
| board-dnd.spec.ts | 872 | toEqual | [] | [] | — | committed drop never flashes the card back to the source column |
| board-filter.spec.ts | 119 | toContain | rgba(0, 0, 0, 0) | ["rgba(0, 0, 0, 0)","transparent"] | — | 旧场景（无 projectNames）不渲染仓库面；右动作区恰好一钮 = 无底色类型钮；+任务 不存在 |
| board-filter.spec.ts | 494 | toHaveCSS | background-color: rgb(239, 68, 68) | rgb(239, 68, 68) | — | 任务卡渲染标签 chip：词表配色、无标签零占位、卡面 chip 20px 默认档 |
| board-filter.spec.ts | 525 | toBe | 20 | 20 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、卡面 chip 20px 默认档 |
| board-filter.spec.ts | 526 | toBe | 16 | 16 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、卡面 chip 20px 默认档 |
| board-filter.spec.ts | 527 | toBe | 20 | 20 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、卡面 chip 20px 默认档 |
| board-filter.spec.ts | 529 | toBe | 4 | 4 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、卡面 chip 20px 默认档 |
| board-filter.spec.ts | 531 | toBe | 26.5 | 26.5 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、卡面 chip 20px 默认档 |
| card-press.spec.ts | 56 | not.toBe | rgb(226, 220, 215) | rgb(240, 235, 230) | — | press tints the whole card one surface step (light) |
| card-press.spec.ts | 56 | not.toBe | rgb(64, 60, 57) | rgb(38, 34, 31) | — | press tints the whole card one surface step (dark) |
| card-press.spec.ts | 60 | toHaveCSS | background-color: rgb(226, 220, 215) | rgb(226, 220, 215) | — | press tints the whole card one surface step (light) |
| card-press.spec.ts | 60 | toHaveCSS | background-color: rgb(64, 60, 57) | rgb(64, 60, 57) | — | press tints the whole card one surface step (dark) |
| card-press.spec.ts | 65 | toBe | 1 | 1 | — | press tints the whole card one surface step (light) |
| card-press.spec.ts | 65 | toBe | 1 | 1 | — | press tints the whole card one surface step (dark) |
| card-press.spec.ts | 74 | toHaveCSS | background-color: rgb(240, 235, 230) | rgb(240, 235, 230) | — | press tints the whole card one surface step (light) |
| card-press.spec.ts | 74 | toHaveCSS | background-color: rgb(38, 34, 31) | rgb(38, 34, 31) | — | press tints the whole card one surface step (dark) |
| card-press.spec.ts | 81 | toHaveCSS | user-select: none | none | — | card face is selection- and native-drag-locked (「小链接」绝迹) |
| card-press.spec.ts | 85 | toBe | none | none | — | card face is selection- and native-drag-locked (「小链接」绝迹) |
| card-press.spec.ts | 114 | toBe | 0 | 0 | — | card face is selection- and native-drag-locked (「小链接」绝迹) |
| checkbox-unified.spec.ts | 72 | toBeLessThanOrEqual | ≤ 1 | 1 | — | accept: 原生 input 走官方遮蔽（不画 Mac 复选框） |
| checkbox-unified.spec.ts | 73 | toBeLessThanOrEqual | ≤ 1 | 1 | — | accept: 原生 input 走官方遮蔽（不画 Mac 复选框） |
| checkbox-unified.spec.ts | 74 | toHaveCSS | clip-path: inset(50%) | inset(50%) | — | accept: 原生 input 走官方遮蔽（不画 Mac 复选框） |
| checkbox-unified.spec.ts | 111 | toBeGreaterThan | > 15.5 | 16 | — | accept: 盒几何 = 16×16 / 圆角 4px / 与文字 gap 8 / 文字 14px |
| checkbox-unified.spec.ts | 112 | toBeLessThan | < 16.5 | 16 | — | accept: 盒几何 = 16×16 / 圆角 4px / 与文字 gap 8 / 文字 14px |
| checkbox-unified.spec.ts | 113 | toBeGreaterThan | > 15.5 | 16 | — | accept: 盒几何 = 16×16 / 圆角 4px / 与文字 gap 8 / 文字 14px |
| checkbox-unified.spec.ts | 114 | toBeLessThan | < 16.5 | 16 | — | accept: 盒几何 = 16×16 / 圆角 4px / 与文字 gap 8 / 文字 14px |
| checkbox-unified.spec.ts | 115 | toHaveCSS | border-radius: 4px | 4px | — | accept: 盒几何 = 16×16 / 圆角 4px / 与文字 gap 8 / 文字 14px |
| checkbox-unified.spec.ts | 117 | toHaveCSS | font-size: 14px | 14px | — | accept: 盒几何 = 16×16 / 圆角 4px / 与文字 gap 8 / 文字 14px |
| checkbox-unified.spec.ts | 122 | toBeGreaterThan | > 7.5 | 8 | — | accept: 盒几何 = 16×16 / 圆角 4px / 与文字 gap 8 / 文字 14px |
| checkbox-unified.spec.ts | 123 | toBeLessThan | < 8.5 | 8 | — | accept: 盒几何 = 16×16 / 圆角 4px / 与文字 gap 8 / 文字 14px |
| chief-settings.spec.ts | 79 | toBeCloseTo | 16 ±0.05 | 16 | — | agent dialog search keeps its own 16px inset (#872 blast radius) |
| chief-settings.spec.ts | 229 | not.toBe | rgba(0, 0, 0, 0) | rgb(228, 207, 215) | color(srgb …) folded to rgb(228, 207, 215); re-pin the spec to the rgb/hex form (#411) | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 230 | toBeCloseTo | 1 ±0.05 | 1 | — | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 231 | toBeCloseTo | 1 ±0.05 | 1 | — | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 232 | toBeCloseTo | 12 ±0.05 | 12 | — | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 233 | toBeCloseTo | 12 ±0.05 | 12 | — | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 241 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 245 | toBe | 367 | 367 | — | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 268 | toBeCloseTo | 12 ±0.05 | 12 | — | 压缩模型 selected row fill bleeds to the menu edges (#872) |
| chief-settings.spec.ts | 330 | toBeLessThanOrEqual | ≤ 202 | 200 | — | 压缩模型 long value truncates, full name on title (dark, #772) |
| chief-settings.spec.ts | 330 | toBeLessThanOrEqual | ≤ 202 | 200 | — | 压缩模型 long value truncates, full name on title (light, #772) |
| dead-buttons.spec.ts | 526 | toBeLessThan | < 1.5 | 0 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
| dead-buttons.spec.ts | 527 | toBeCloseTo | 28 ±0.5 | 28 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
| dead-buttons.spec.ts | 528 | toBeCloseTo | 28 ±0.5 | 28 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
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
| detail-3pane.spec.ts | 178 | toBe | rgb(64, 60, 57) | rgb(64, 60, 57) | — | composer controls share one bottom row: stop is the send button's sibling |
| detail-3pane.spec.ts | 179 | toBe | 1 | 1 | — | composer controls share one bottom row: stop is the send button's sibling |
| detail-3pane.spec.ts | 181 | toBeLessThanOrEqual | ≤ 2 | 2 | — | composer controls share one bottom row: stop is the send button's sibling |
| detail-3pane.spec.ts | 198 | toBe | 712 | 712 | — | composer width tracks the center column; the floating window overlays without moving it (ADR 0013 D1) |
| detail-3pane.spec.ts | 199 | toBeCloseTo | 680 ±0.5 | 680 | — | composer width tracks the center column; the floating window overlays without moving it (ADR 0013 D1) |
| detail-3pane.spec.ts | 207 | toBeCloseTo | 712 ±0.5 | 712 | — | composer width tracks the center column; the floating window overlays without moving it (ADR 0013 D1) |
| detail-3pane.spec.ts | 208 | toBeCloseTo | 680 ±0.5 | 680 | — | composer width tracks the center column; the floating window overlays without moving it (ADR 0013 D1) |
| detail-3pane.spec.ts | 290 | toBe | 1200 | 1200 | — | fresh phase: the brief owns the whole center column, right pane collapses |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 442.4139518737793 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 430.30250549316406 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 452 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 273.89440155029297 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 281.58265686035156 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 171 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 148.4373779296875 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 28.793018341064453 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 34.84873962402344 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 24 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 113.05280303955078 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 109.20866394042969 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 164.5 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 175.78131103515625 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 471.20697021484375 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 465.1512451171875 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 476 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 386.94720458984375 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 390.79132080078125 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 335.5 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 324.21868896484375 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 51 | toBeGreaterThan | > 388 | 1480 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 51 | toBeGreaterThan | > 167 | 302 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
| dialog-viewport.spec.ts | 79 | toEqual | {"x":192,"y":428,"width":416,"height":32} | {"x":192,"y":428,"width":416,"height":32} | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 148 | toBeLessThanOrEqual | ≤ 312.5 | 299.8768196105957 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
| escape-wiring.spec.ts | 89 | toEqual | {"winAdds":0,"winRems":0,"docAdds":0,"docRems":0} | {"winAdds":0,"winRems":0,"docAdds":0,"docRems":0} | — | 开着的层不被重渲染重挂 Escape 接线：URL 写回后单次 Escape 仍收层 |
| escape-wiring.spec.ts | 157 | toEqual | {"winAdds":0,"winRems":0} | {"winAdds":0,"winRems":0} | — | 确认弹层不被根组件重渲染重挂 Escape 接线：⌘K 往返后单次 Escape 仍收层 |
| escape-wiring.spec.ts | 158 | toBe | 6 | 6 | — | 确认弹层不被根组件重渲染重挂 Escape 接线：⌘K 往返后单次 Escape 仍收层 |
| github-issue-writeback.spec.ts | 169 | toBe | 0 | 0 | — | 4. 未建成：状态行 + 重试入口；重试成功 → 行升级为回显态（AC3） |
| github-issue-writeback.spec.ts | 174 | toBe | 1 | 1 | — | 4. 未建成：状态行 + 重试入口；重试成功 → 行升级为回显态（AC3） |
| mention-picker-center.spec.ts | 21 | toHaveCSS | transform: none | none | — | mention picker stays centered in the production bundle (#448) |
| mention-picker-center.spec.ts | 26 | toBe | 400 | 400 | — | mention picker stays centered in the production bundle (#448) |
| mention-picker-center.spec.ts | 28 | toBeLessThanOrEqual | ≤ 1 | 0 | — | mention picker stays centered in the production bundle (#448) |
| merge-reject.spec.ts | 251 | toBe | 1 | {"__fn":"() => merges"} | — | 看板入口：server 真拒（403）时弹层不关，server 文案原样显出 |
| merge-reject.spec.ts | 267 | toBe | 1 | {"__fn":"() => merges"} | — | 合并成功（202）时弹层照常关，不留错误行 |
| overlay-focus.spec.ts | 72 | not.toBe | auto | solid | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 73 | not.toBe | rgb(0, 95, 204) | rgb(242, 148, 216) | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 89 | not.toBe | auto | none | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 90 | not.toBe | rgb(0, 95, 204) | rgb(242, 148, 216) | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 148 | toHaveCSS | animation-name: enter | enter | — | backdrop click closes; entry rides the registry fade-in |
| project-github-issues.spec.ts | 200 | toEqual | [{"number":7}] | [{"number":7}] | — | 1. 已连接 github 项目：入口 → 弹层 → 点选导入 → 详情见 issue 标题与全部标签 |
| project-github-issues.spec.ts | 223 | toEqual | ["state=open&page=1"] | ["state=open&page=1"] | — | 4. 状态过滤与分页参数直达请求面；hasMore=false 下一页禁用 |
| project-github-issues.spec.ts | 229 | toEqual | ["state=open&page=1","state=closed&page=1"] | ["state=open&page=1","state=closed&page=1"] | — | 4. 状态过滤与分页参数直达请求面；hasMore=false 下一页禁用 |
| project-github-issues.spec.ts | 237 | toEqual | ["state=open&page=1","state=closed&page=1","state=open&page=2"] | ["state=open&page=1","state=closed&page=1","state=open&page=2"] | — | 4. 状态过滤与分页参数直达请求面；hasMore=false 下一页禁用 |
| review-reject.spec.ts | 167 | toBe | 1 | {"__fn":"() => stepPosts"} | — | FM1/FM2: 静息 review 发送 = steps revision 动作面，draft 清空、chip 即时翻规划中 |
| review-reject.spec.ts | 168 | toBe | 0 | 0 | — | FM1/FM2: 静息 review 发送 = steps revision 动作面，draft 清空、chip 即时翻规划中 |
| review-reject.spec.ts | 205 | toBe | 1 | {"__fn":"() => stepPosts"} | — | FM3: 更多菜单出现「请求修改」入口，弹层收反馈后走同一动作面 |
| review-reject.spec.ts | 260 | toBe | 1 | {"__fn":"() => steerPosts"} | — | FM4: 运行中 review（claimed 步在场）发送保持 steer 语义，不抢动作面 |
| review-reject.spec.ts | 261 | toBe | 0 | 0 | — | FM4: 运行中 review（claimed 步在场）发送保持 steer 语义，不抢动作面 |
| review-reject.spec.ts | 281 | toBe | 1 | {"__fn":"() => stepPosts"} | — | FM2: 打回被拒（409 竞态）draft 逐字保留 + 提示行显性，不静默吞 |
| search-close-flash.spec.ts | 36 | toHaveCSS | transform: none | none | — | 第二下 Ctrl+K 关闭不闪：退出透明度单调递减 |
| search-close-flash.spec.ts | 36 | toHaveCSS | transform: none | none | — | 三连击：关→开落在开态且输入聚焦 |
| search-close-flash.spec.ts | 82 | toBeLessThanOrEqual | ≤ 0.434761 | 0.314761 | — | 第二下 Ctrl+K 关闭不闪：退出透明度单调递减 |
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
| segmented-controls.spec.ts | 94 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | page-tab: unselected hover steps the chip ink — dark + light |
| segmented-controls.spec.ts | 95 | toBe | rgb(179, 174, 170) | rgb(179, 174, 170) | — | page-tab: unselected hover steps the chip ink — dark + light |
| segmented-controls.spec.ts | 97 | toBe | rgb(238, 232, 228) | {"__fn":"() => ink(files)"} | — | page-tab: unselected hover steps the chip ink — dark + light |
| segmented-controls.spec.ts | 101 | toBe | rgba(18, 15, 11, 0.6) | rgba(18, 15, 11, 0.6) | — | page-tab: unselected hover steps the chip ink — dark + light |
| segmented-controls.spec.ts | 103 | toBe | rgb(18, 15, 11) | {"__fn":"() => ink(lightFiles)"} | — | page-tab: unselected hover steps the chip ink — dark + light |
| segmented-controls.spec.ts | 113 | toBe | rgba(64, 60, 57, 0.3) | rgba(64, 60, 57, 0.3) | — | page-tab: selected chip keeps its fill under hover, same geometry as the rest state |
| segmented-controls.spec.ts | 116 | toBe | rgba(64, 60, 57, 0.3) | rgba(64, 60, 57, 0.3) | — | page-tab: selected chip keeps its fill under hover, same geometry as the rest state |
| segmented-controls.spec.ts | 130 | toBe | 8px | 8px | — | page-tab: selected chip keeps its fill under hover, same geometry as the rest state |
| segmented-controls.spec.ts | 140 | toEqual | {"x":840,"y":9,"width":54,"height":25} | {"x":840,"y":9,"width":54,"height":25} | — | page-tab: selected chip keeps its fill under hover, same geometry as the rest state |
| segmented-controls.spec.ts | 161 | toBe | 0px | 0px | — | page-tab group rides the registry TabsList form (bg-muted, 32px, 3px inset) |
| segmented-controls.spec.ts | 162 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | page-tab group rides the registry TabsList form (bg-muted, 32px, 3px inset) |
| segmented-controls.spec.ts | 163 | toBe | 32 | 32 | — | page-tab group rides the registry TabsList form (bg-muted, 32px, 3px inset) |
| segmented-controls.spec.ts | 165 | toBe | 4 | 4 | — | page-tab group rides the registry TabsList form (bg-muted, 32px, 3px inset) |
| segmented-controls.spec.ts | 166 | toBe | 3 | 3 | — | page-tab group rides the registry TabsList form (bg-muted, 32px, 3px inset) |
| segmented-controls.spec.ts | 190 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | sched freq: dark active chip reads against the container, hover steps the rest ink |
| segmented-controls.spec.ts | 191 | toBe | rgba(64, 60, 57, 0.3) | rgba(64, 60, 57, 0.3) | — | sched freq: dark active chip reads against the container, hover steps the rest ink |
| segmented-controls.spec.ts | 193 | toBe | rgb(179, 174, 170) | rgb(179, 174, 170) | — | sched freq: dark active chip reads against the container, hover steps the rest ink |
| segmented-controls.spec.ts | 195 | toBe | rgb(238, 232, 228) | {"__fn":"() => ink(weekly)"} | — | sched freq: dark active chip reads against the container, hover steps the rest ink |
| segmented-controls.spec.ts | 198 | toBe | rgb(246, 241, 236) | rgb(246, 241, 236) | — | sched freq: dark active chip reads against the container, hover steps the rest ink |
| segmented-controls.spec.ts | 202 | toBe | rgba(18, 15, 11, 0.6) | rgba(18, 15, 11, 0.6) | — | sched freq: dark active chip reads against the container, hover steps the rest ink |
| segmented-controls.spec.ts | 204 | toBe | rgb(18, 15, 11) | {"__fn":"() => ink(lightWeekly)"} | — | sched freq: dark active chip reads against the container, hover steps the rest ink |
| segmented-controls.spec.ts | 210 | toBe | rgb(179, 174, 170) | rgb(179, 174, 170) | — | files seg + tasks view toggle: hover steps the unselected ink (dark) |
| segmented-controls.spec.ts | 212 | toBe | rgb(238, 232, 228) | {"__fn":"() => ink(history)"} | — | files seg + tasks view toggle: hover steps the unselected ink (dark) |
| segmented-controls.spec.ts | 217 | toBe | rgb(238, 232, 228) | {"__fn":"() => ink(grid)"} | — | files seg + tasks view toggle: hover steps the unselected ink (dark) |
| segmented-controls.spec.ts | 226 | toBe | rgba(28, 25, 21, 0.05) | {"__fn":"() => bg(dark)"} | — | user-menu 外观 seg: hover tints, click switches the theme |
| segmented-controls.spec.ts | 250 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => bg(git)"} | — | branch-dialog seg: hover tints Git, click swaps the tab body |
| segmented-controls.spec.ts | 272 | toBe | 0px | 0px | — | team layout toggle: registry default Tabs form (muted group, background chip, no ring) |
| segmented-controls.spec.ts | 273 | toBe | rgb(234, 228, 224) | rgb(234, 228, 224) | — | team layout toggle: registry default Tabs form (muted group, background chip, no ring) |
| segmented-controls.spec.ts | 274 | toBe | rgb(246, 241, 236) | rgb(246, 241, 236) | — | team layout toggle: registry default Tabs form (muted group, background chip, no ring) |
| segmented-controls.spec.ts | 280 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | team layout toggle: registry default Tabs form (muted group, background chip, no ring) |
| segmented-controls.spec.ts | 282 | toBe | rgba(0, 0, 0, 0) | {"__fn":"() => bg(chart)"} | — | team layout toggle: registry default Tabs form (muted group, background chip, no ring) |
| segmented-controls.spec.ts | 293 | toBe | rgba(28, 25, 21, 0.05) | {"__fn":"() => bg(charter)"} | — | chief tabs: hover tints, click swaps the view |
| segmented-controls.spec.ts | 320 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 321 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 322 | toBeLessThanOrEqual | ≤ 1 | 0.015625 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 323 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 327 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 333 | toEqual | {"pillZ":"0","pillPe":"none","tabZ":"1"} | {"pillZ":"0","pillPe":"none","tabZ":"1"} | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 371 | toEqual | ["left","width"] | {"__fn":"() => page.evaluate(() => [...new Set(window.__pillRuns)].sort())"} | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 384 | toBeLessThanOrEqual | ≤ 1 | {"__fn":"async () => {\n    const [p, c] = await Promise.all([box(pill), box(charter)]);\n    return Math.max(… | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| shadcn-primitives.spec.ts | 71 | not.toBe | contents | flex | — | avatar 落点定尺盒（#983/#1003）：Root 生成真盒承上游发丝环，img 几何不变 |
| shadcn-primitives.spec.ts | 74 | toBe | 24 | 24 | — | avatar 落点定尺盒（#983/#1003）：Root 生成真盒承上游发丝环，img 几何不变 |
| shadcn-primitives.spec.ts | 75 | toBe | 24 | 24 | — | avatar 落点定尺盒（#983/#1003）：Root 生成真盒承上游发丝环，img 几何不变 |
| shadcn-primitives.spec.ts | 76 | toBe | 24 | 24 | — | avatar 落点定尺盒（#983/#1003）：Root 生成真盒承上游发丝环，img 几何不变 |
| shadcn-primitives.spec.ts | 77 | toBe | 24 | 24 | — | avatar 落点定尺盒（#983/#1003）：Root 生成真盒承上游发丝环，img 几何不变 |
| shadcn-primitives.spec.ts | 78 | toBe | 44 | 44 | — | avatar 落点定尺盒（#983/#1003）：Root 生成真盒承上游发丝环，img 几何不变 |
| shadcn-primitives.spec.ts | 107 | toBe | 20 | 20 | — | tag-chip 落点：落在 registry Badge 上，别名类保留、几何单档 20px 正本 |
| shadcn-primitives.spec.ts | 118 | toBe | 20 | 20 | — | tag-chip 落点：落在 registry Badge 上，别名类保留、几何单档 20px 正本 |
| skills-write.spec.ts | 231 | toBeGreaterThanOrEqual | ≥ 2 | 2 | — | live 编辑预填读 404：表单让位错误块，列表失效重取 |
| z-ladder.spec.ts | 64 | toEqual | ["true","true","true","true","true"] | ["true","true","true","true","true"] | — | every probe point of the new-task panel hit-tests inside the panel |
