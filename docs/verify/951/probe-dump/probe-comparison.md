# Probe dump — old baseline → new measured (#921)

Run 2026-10-06T03:50:23.069Z · commit `d4f62649` · port 8404 · playwright 1.63.0 · workers 4

Specs: merge-reject reject-chain review-reject rerun-close-family branch-button dialog-viewport detail-3pane board-dnd agent-create-model team-create-agent dead-buttons avatar-dicebear checkbox-unified (15 files) · tests 126 passed / 0 failed

## Coverage

Enumerated = static scan of spec source. Collected = distinct runtime call sites that returned a value (polls/themed loops record repeatedly; distinct de-dupes by file:line).

| probe surface | enumerated | collected |
| --- | --- | --- |
| getComputedStyle occurrences (headline count) | 18 | — (captured per evaluate call below) |
| probe-carrying evaluate/waitForFunction call sites | 15 | 15 |
| .boundingBox() call sites | 38 | 38 |
| .toHaveCSS() call sites | 3 | 3 |
| visual-matcher assertion sites | 105 | 139 joined |

Comparison rows: 123 — KEPT 123, DRIFT 0, NOT-RUN 0, VIOLATION 0, other 0.

Review procedure (#910 裁定 5): every DRIFT row is either expected drift (the new canon — re-pin the spec inline value to “new measured”) or a suspected regression (fix the code, keep the baseline). KEPT rows need no action. NOT-RUN rows are assertion sites whose test failed earlier, was skipped, or was filtered out. The `note` column flags values whose source notation is not rgb/hex: `color(srgb …)` is folded to rgba for comparison (re-pin should write the rgb/hex form); oklch/lab/lch and non-sRGB `color()` cannot fold under the #411 contract and are flagged VIOLATION, never converted.

## KEPT — baseline holds on this build (123)

| spec | line | matcher | old baseline | new measured | note | test |
| --- | --- | --- | --- | --- | --- | --- |
| agent-create-model.spec.ts | 180 | toBeGreaterThanOrEqual | ≥ 201.65292358398438 | 309.2462463378906 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 181 | toBeLessThanOrEqual | ≤ 530.3471069335938 | 394.6287536621094 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 192 | toBeGreaterThanOrEqual | ≥ 201.65292358398438 | 307.4756164550781 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 193 | toBeLessThanOrEqual | ≤ 530.3471069335938 | 482.7118835449219 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 195 | toBeGreaterThanOrEqual | ≥ 0 | 307.4756164550781 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 196 | toBeGreaterThanOrEqual | ≥ 0 | 514.2000122070312 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 197 | toBeLessThanOrEqual | ≤ 1440 | 729.7999877929688 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 229 | toBeGreaterThanOrEqual | ≥ 195 | 294.41998291015625 | — | 模型很多：选过运行时后菜单不越出裁剪盒，首行可点，40 行一个不少 |
| agent-create-model.spec.ts | 230 | toBeLessThanOrEqual | ≤ 537 | 482.58001708984375 | — | 模型很多：选过运行时后菜单不越出裁剪盒，首行可点，40 行一个不少 |
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
| dialog-viewport.spec.ts | 37 | toBeLessThanOrEqual | ≤ 452.5 | 431.01042556762695 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 37 | toBeLessThanOrEqual | ≤ 452.5 | 424.32056045532227 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 37 | toBeLessThanOrEqual | ≤ 452.5 | 452 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 37 | toBeLessThanOrEqual | ≤ 452.5 | 290.836669921875 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 37 | toBeLessThanOrEqual | ≤ 452.5 | 232.6637725830078 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 37 | toBeLessThanOrEqual | ≤ 452.5 | 156.3824462890625 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 37 | toBeLessThanOrEqual | ≤ 452.5 | 139.54132080078125 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 38 | toBeGreaterThanOrEqual | ≥ 0 | 34.49479293823242 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 38 | toBeGreaterThanOrEqual | ≥ 0 | 37.839717864990234 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 38 | toBeGreaterThanOrEqual | ≥ 0 | 24 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 38 | toBeGreaterThanOrEqual | ≥ 0 | 104.5816650390625 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 38 | toBeGreaterThanOrEqual | ≥ 0 | 133.66810607910156 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 38 | toBeGreaterThanOrEqual | ≥ 0 | 171.80877685546875 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 38 | toBeGreaterThanOrEqual | ≥ 0 | 180.22933959960938 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 39 | toBeLessThanOrEqual | ≤ 500.5 | 465.5052185058594 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 39 | toBeLessThanOrEqual | ≤ 500.5 | 462.1602783203125 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 39 | toBeLessThanOrEqual | ≤ 500.5 | 476 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 39 | toBeLessThanOrEqual | ≤ 500.5 | 395.4183349609375 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 39 | toBeLessThanOrEqual | ≤ 500.5 | 366.3318786621094 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 39 | toBeLessThanOrEqual | ≤ 500.5 | 328.19122314453125 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 39 | toBeLessThanOrEqual | ≤ 500.5 | 319.7706604003906 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 47 | toBeGreaterThan | > 404 | 1480 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 47 | toBeGreaterThan | > 210 | 308 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
| dialog-viewport.spec.ts | 75 | toEqual | {"x":192,"y":428,"width":416,"height":32} | {"x":192,"y":428,"width":416,"height":32} | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 144 | toBeLessThanOrEqual | ≤ 312.5 | 299.86529541015625 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
| merge-reject.spec.ts | 247 | toBe | 1 | {"__fn":"() => merges"} | — | 看板入口：server 真拒（403）时弹层不关，server 文案原样显出 |
| merge-reject.spec.ts | 263 | toBe | 1 | {"__fn":"() => merges"} | — | 合并成功（202）时弹层照常关，不留错误行 |
| review-reject.spec.ts | 167 | toBe | 1 | {"__fn":"() => stepPosts"} | — | FM1/FM2: 静息 review 发送 = steps revision 动作面，draft 清空、chip 即时翻规划中 |
| review-reject.spec.ts | 168 | toBe | 0 | 0 | — | FM1/FM2: 静息 review 发送 = steps revision 动作面，draft 清空、chip 即时翻规划中 |
| review-reject.spec.ts | 205 | toBe | 1 | {"__fn":"() => stepPosts"} | — | FM3: 更多菜单出现「请求修改」入口，弹层收反馈后走同一动作面 |
| review-reject.spec.ts | 260 | toBe | 1 | {"__fn":"() => steerPosts"} | — | FM4: 运行中 review（claimed 步在场）发送保持 steer 语义，不抢动作面 |
| review-reject.spec.ts | 261 | toBe | 0 | 0 | — | FM4: 运行中 review（claimed 步在场）发送保持 steer 语义，不抢动作面 |
| review-reject.spec.ts | 281 | toBe | 1 | {"__fn":"() => stepPosts"} | — | FM2: 打回被拒（409 竞态）draft 逐字保留 + 提示行显性，不静默吞 |
