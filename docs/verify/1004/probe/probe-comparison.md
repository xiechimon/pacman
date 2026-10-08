# Probe dump — old baseline → new measured (#921)

Run 2026-10-08T11:10:37.658Z · commit `f8595334` · port 8397 · playwright 1.63.0 · workers 4

Specs: board sidebar card-press hotkeys chip avatar visual-polish (16 files) · tests 162 passed / 0 failed

## Coverage

Enumerated = static scan of spec source. Collected = distinct runtime call sites that returned a value (polls/themed loops record repeatedly; distinct de-dupes by file:line).

| probe surface | enumerated | collected |
| --- | --- | --- |
| getComputedStyle occurrences (headline count) | 49 | — (captured per evaluate call below) |
| probe-carrying evaluate/waitForFunction call sites | 41 | 41 |
| .boundingBox() call sites | 35 | 35 |
| .toHaveCSS() call sites | 5 | 5 |
| visual-matcher assertion sites | 188 | 273 joined |

Comparison rows: 241 — KEPT 241, DRIFT 0, NOT-RUN 0, VIOLATION 0, other 0.

Review procedure (#910 裁定 5): every DRIFT row is either expected drift (the new canon — re-pin the spec inline value to “new measured”) or a suspected regression (fix the code, keep the baseline). KEPT rows need no action. NOT-RUN rows are assertion sites whose test failed earlier, was skipped, or was filtered out. The `note` column flags values whose source notation is not rgb/hex: `color(srgb …)` is folded to rgba for comparison (re-pin should write the rgb/hex form); oklch/lab/lch and non-sRGB `color()` cannot fold under the #411 contract and are flagged VIOLATION, never converted.

## KEPT — baseline holds on this build (241)

| spec | line | matcher | old baseline | new measured | note | test |
| --- | --- | --- | --- | --- | --- | --- |
| agent-identity-chip.spec.ts | 56 | toBe | 24 | 24 | — | F-E1/E2/E10: 头像+名字并排成链，href 指 Agent 设置页，几何 canon 不漂移 |
| agent-identity-chip.spec.ts | 57 | toBe | 24 | 24 | — | F-E1/E2/E10: 头像+名字并排成链，href 指 Agent 设置页，几何 canon 不漂移 |
| agent-identity-chip.spec.ts | 61 | toBe | 12px | 12px | — | F-E1/E2/E10: 头像+名字并排成链，href 指 Agent 设置页，几何 canon 不漂移 |
| agent-identity-chip.spec.ts | 69 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | F-E9: hover 只变 cursor，不发明背景态（参考站正典） |
| agent-identity-chip.spec.ts | 70 | toBe | pointer | pointer | — | F-E9: hover 只变 cursor，不发明背景态（参考站正典） |
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
| sidebar-nav.spec.ts | 107 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | hover tints the row pill — dark default + light theme |
| sidebar-nav.spec.ts | 111 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => pillBg(row)"} | — | hover tints the row pill — dark default + light theme |
| sidebar-nav.spec.ts | 118 | toBe | rgba(28, 25, 21, 0.05) | {"__fn":"() => pillBg(lightRow)"} | — | hover tints the row pill — dark default + light theme |
| sidebar-nav.spec.ts | 126 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | rail hover tints the 24px pill |
| sidebar-nav.spec.ts | 128 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => pillBg(row)"} | — | rail hover tints the 24px pill |
| sidebar-nav.spec.ts | 141 | toBe | rgba(255, 252, 248, 0.1) | rgba(255, 252, 248, 0.1) | — | selected row keeps its own pill under hover |
| sidebar-seam.spec.ts | 50 | toBe | 1px | 1px | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 50 | toBe | 1px | 1px | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 51 | toBe | solid | solid | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 51 | toBe | solid | solid | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 52 | toBe | none | none | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 52 | toBe | none | none | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 53 | toBe | rgb(234, 228, 224) | rgb(234, 228, 224) | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 53 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 54 | toBe | 240 | 240 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 54 | toBe | 240 | 240 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 57 | toBe | 43 | 43 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 57 | toBe | 43 | 43 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 58 | toBe | 43 | 43 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 58 | toBe | 43 | 43 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 59 | toBe | 1px | 1px | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 59 | toBe | 1px | 1px | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 60 | toBe | rgb(234, 228, 224) | rgb(234, 228, 224) | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 60 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 61 | toBe | 44 | 44 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (light) |
| sidebar-seam.spec.ts | 61 | toBe | 44 | 44 | — | board expanded: 1px seam replaces the floating shadow, divider aligns with the topbar border (dark) |
| sidebar-seam.spec.ts | 77 | toBe | 43 | 43 | — | team page: the r7 12 active pill geometry survives the divider row (light) |
| sidebar-seam.spec.ts | 77 | toBe | 43 | 43 | — | team page: the r7 12 active pill geometry survives the divider row (dark) |
| sidebar-seam.spec.ts | 103 | toBe | 1px | 1px | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 103 | toBe | 1px | 1px | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 104 | toBe | none | none | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 104 | toBe | none | none | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 105 | toBe | rgb(234, 228, 224) | rgb(234, 228, 224) | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 105 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 106 | toBe | 40 | 40 | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 106 | toBe | 40 | 40 | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 108 | toBe | 44 | 44 | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 108 | toBe | 44 | 44 | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 109 | toBe | 1px | 1px | — | rail: seam inherits, toggle divider aligns with the topbar border row (light) |
| sidebar-seam.spec.ts | 109 | toBe | 1px | 1px | — | rail: seam inherits, toggle divider aligns with the topbar border row (dark) |
| sidebar-seam.spec.ts | 128 | toBe | rgb(234, 228, 224) | rgb(234, 228, 224) | — | pages shell: the divider runs full width on schedules too (light) |
| sidebar-seam.spec.ts | 128 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | pages shell: the divider runs full width on schedules too (dark) |
| sidebar-seam.spec.ts | 129 | toBe | 43 | 43 | — | pages shell: the divider runs full width on schedules too (light) |
| sidebar-seam.spec.ts | 129 | toBe | 43 | 43 | — | pages shell: the divider runs full width on schedules too (dark) |
| sidebar-seam.spec.ts | 130 | toBe | 44 | 44 | — | pages shell: the divider runs full width on schedules too (light) |
| sidebar-seam.spec.ts | 130 | toBe | 44 | 44 | — | pages shell: the divider runs full width on schedules too (dark) |
| sidebar-seam.spec.ts | 152 | toBe | rgb(234, 228, 224) | rgb(234, 228, 224) | — | resources: the full-width line reads one color across the seam (light) |
| sidebar-seam.spec.ts | 152 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | resources: the full-width line reads one color across the seam (dark) |
| sidebar-seam.spec.ts | 153 | toBe | rgb(234, 228, 224) | rgb(234, 228, 224) | — | resources: the full-width line reads one color across the seam (light) |
| sidebar-seam.spec.ts | 153 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | resources: the full-width line reads one color across the seam (dark) |
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
| sidebar-visual.spec.ts | 153 | toBeGreaterThan | > 6 | 32.45000000000002 | — | selected pill deepens the hover step (light) |
| sidebar-visual.spec.ts | 153 | toBeGreaterThan | > 6 | 33.65 | — | selected pill deepens the hover step (dark) |
| sidebar-visual.spec.ts | 155 | toBeGreaterThan | > 38.45000000000002 | 64.89999999999998 | — | selected pill deepens the hover step (light) |
| sidebar-visual.spec.ts | 155 | toBeGreaterThan | > 39.65 | 67.30000000000001 | — | selected pill deepens the hover step (dark) |
| sidebar-visual.spec.ts | 165 | toBe | rgba(28, 25, 21, 0.1) | rgba(28, 25, 21, 0.1) | — | selected pill deepens the hover step (light) |
| sidebar-visual.spec.ts | 165 | toBe | rgba(255, 252, 248, 0.1) | rgba(255, 252, 248, 0.1) | — | selected pill deepens the hover step (dark) |
| sidebar-visual.spec.ts | 188 | toBe | absolute | absolute | — | machine-online dot keeps its absolute anchor |
| sidebar-visual.spec.ts | 189 | toBeLessThan | < 2 | 0 | — | machine-online dot keeps its absolute anchor |
| visual-polish.spec.ts | 85 | toBe | 0px | 0px | — | board card rides the single-source edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 85 | toBe | 0px | 0px | — | board card rides the single-source edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 86 | toBe | 14px | 14px | — | board card rides the single-source edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 86 | toBe | 14px | 14px | — | board card rides the single-source edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 87 | toContain | 0px 0px 0px 1px | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklab(0.… | — | board card rides the single-source edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 87 | toContain | 0px 0px 0px 1px | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklab(0.… | — | board card rides the single-source edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 88 | not.toContain | inset | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklab(0.… | — | board card rides the single-source edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 88 | not.toContain | inset | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklab(0.… | — | board card rides the single-source edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 100 | toBe | 1px | 1px | — | board column container rides the same edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 100 | toBe | 1px | 1px | — | board column container rides the same edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 101 | toBe | 0px | 0px | — | board column container rides the same edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 101 | toBe | 0px | 0px | — | board column container rides the same edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 102 | toBe | rgb(234, 228, 224) | rgb(234, 228, 224) | — | board column container rides the same edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 102 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | board column container rides the same edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 103 | not.toContain | inset | none | — | board column container rides the same edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 103 | not.toContain | inset | none | — | board column container rides the same edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 118 | toBe | 0px | 0px | — | notify banner rides the same edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 118 | toBe | 0px | 0px | — | notify banner rides the same edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 119 | toBe | 14px | 14px | — | notify banner rides the same edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 119 | toBe | 14px | 14px | — | notify banner rides the same edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 122 | toContain | rgba(28, 25, 23, 0.08) 0px 2px 8px 0px | rgb(234, 228, 224) 0px 0px 0px 1px inset, rgba(28, 25, 23, 0.08) 0px 2px 8px 0px | — | notify banner rides the same edge ring + card-tier shadow (light) |
| visual-polish.spec.ts | 122 | toContain | rgba(0, 0, 0, 0.24) 0px 2px 6px 0px | rgb(45, 41, 38) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0.24) 0px 2px 6px 0px | — | notify banner rides the same edge ring + card-tier shadow (dark) |
| visual-polish.spec.ts | 133 | toBe | 1px | 1px | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (light) |
| visual-polish.spec.ts | 133 | toBe | 1px | 1px | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (dark) |
| visual-polish.spec.ts | 134 | toBe | 0px | 0px | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (light) |
| visual-polish.spec.ts | 134 | toBe | 0px | 0px | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (dark) |
| visual-polish.spec.ts | 135 | toBe | rgb(234, 228, 224) | rgb(234, 228, 224) | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (light) |
| visual-polish.spec.ts | 135 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (dark) |
| visual-polish.spec.ts | 142 | toBe | none | none | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (dark) |
| visual-polish.spec.ts | 144 | toContain | rgba(0, 0, 0, 0.12) 0px 6px 16px 0px | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, … | — | account popover rides the V2 shell border, keeps the overlay-plate hard shadow (light) |
| visual-polish.spec.ts | 171 | toBe | rgb(246, 241, 236) | rgb(246, 241, 236) | — | sidebar shares the main-area surface, seam drawn in the divider token (light) |
| visual-polish.spec.ts | 171 | toBe | rgb(31, 27, 24) | rgb(31, 27, 24) | — | sidebar shares the main-area surface, seam drawn in the divider token (dark) |
| visual-polish.spec.ts | 172 | toBe | 1px | 1px | — | sidebar shares the main-area surface, seam drawn in the divider token (light) |
| visual-polish.spec.ts | 172 | toBe | 1px | 1px | — | sidebar shares the main-area surface, seam drawn in the divider token (dark) |
| visual-polish.spec.ts | 173 | toBe | rgb(234, 228, 224) | rgb(234, 228, 224) | — | sidebar shares the main-area surface, seam drawn in the divider token (light) |
| visual-polish.spec.ts | 173 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | sidebar shares the main-area surface, seam drawn in the divider token (dark) |
| visual-polish.spec.ts | 174 | toBe | none | none | — | sidebar shares the main-area surface, seam drawn in the divider token (light) |
| visual-polish.spec.ts | 174 | toBe | none | none | — | sidebar shares the main-area surface, seam drawn in the divider token (dark) |
| visual-polish.spec.ts | 198 | toBe | auto | auto | — | board grid lays out four even columns with no horizontal scroll (light) |
| visual-polish.spec.ts | 198 | toBe | auto | auto | — | board grid lays out four even columns with no horizontal scroll (dark) |
| visual-polish.spec.ts | 199 | toBe | 0 | 0 | — | board grid lays out four even columns with no horizontal scroll (light) |
| visual-polish.spec.ts | 199 | toBe | 0 | 0 | — | board grid lays out four even columns with no horizontal scroll (dark) |
| visual-polish.spec.ts | 203 | toBe | 0 | 0 | — | board grid lays out four even columns with no horizontal scroll (light) |
| visual-polish.spec.ts | 203 | toBe | 0 | 0 | — | board grid lays out four even columns with no horizontal scroll (dark) |
| visual-polish.spec.ts | 211 | toBeGreaterThan | > 0 | 281 | — | board grid lays out four even columns with no horizontal scroll (light) |
| visual-polish.spec.ts | 211 | toBeGreaterThan | > 0 | 281 | — | board grid lays out four even columns with no horizontal scroll (dark) |
| visual-polish.spec.ts | 212 | toBeLessThanOrEqual | ≤ 1 | 0 | — | board grid lays out four even columns with no horizontal scroll (light) |
| visual-polish.spec.ts | 212 | toBeLessThanOrEqual | ≤ 1 | 0 | — | board grid lays out four even columns with no horizontal scroll (dark) |
| visual-polish.spec.ts | 227 | toBe | 1px | 1px | — | collapsed rail keeps the same drawn-seam treatment (#135 裁决 v2) |
| visual-polish.spec.ts | 228 | toBe | none | none | — | collapsed rail keeps the same drawn-seam treatment (#135 裁决 v2) |
