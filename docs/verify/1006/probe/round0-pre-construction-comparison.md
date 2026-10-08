# Probe dump — old baseline → new measured (#921)

Run 2026-10-08T04:36:02.538Z · commit `034cd149` · port 8400 · playwright 1.63.0 · workers 4

Specs: detail-3pane detail-esc detail-narrow branch-button diff-full-file plan-diff-full-file file-viewer transcript-user-words spinner-live chat-md-toolout chat-tools-identity chat-type-measure composer-inline-mention composer-paste composer-slash composer-wire-reject merge-reject reject-chain review-reject rerun-close-family shadcn-primitives dialog-viewport agent-detail board-filter (24 files) · tests 209 passed / 0 failed

## Coverage

Enumerated = static scan of spec source. Collected = distinct runtime call sites that returned a value (polls/themed loops record repeatedly; distinct de-dupes by file:line).

| probe surface | enumerated | collected |
| --- | --- | --- |
| getComputedStyle occurrences (headline count) | 39 | — (captured per evaluate call below) |
| probe-carrying evaluate/waitForFunction call sites | 41 | 41 |
| .boundingBox() call sites | 11 | 11 |
| .toHaveCSS() call sites | 1 | 1 |
| visual-matcher assertion sites | 206 | 225 joined |

Comparison rows: 185 — KEPT 185, DRIFT 0, NOT-RUN 0, VIOLATION 0, other 0.

Review procedure (#910 裁定 5): every DRIFT row is either expected drift (the new canon — re-pin the spec inline value to “new measured”) or a suspected regression (fix the code, keep the baseline). KEPT rows need no action. NOT-RUN rows are assertion sites whose test failed earlier, was skipped, or was filtered out. The `note` column flags values whose source notation is not rgb/hex: `color(srgb …)` is folded to rgba for comparison (re-pin should write the rgb/hex form); oklch/lab/lch and non-sRGB `color()` cannot fold under the #411 contract and are flagged VIOLATION, never converted.

## KEPT — baseline holds on this build (185)

| spec | line | matcher | old baseline | new measured | note | test |
| --- | --- | --- | --- | --- | --- | --- |
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
| board-filter.spec.ts | 119 | toContain | rgba(0, 0, 0, 0) | ["rgba(0, 0, 0, 0)","transparent"] | — | 旧场景（无 projectNames）不渲染仓库面；右动作区恰好一钮 = 无底色类型钮；+任务 不存在 |
| board-filter.spec.ts | 494 | toHaveCSS | background-color: rgb(239, 68, 68) | rgb(239, 68, 68) | — | 任务卡渲染标签 chip：词表配色、无标签零占位、既有几何不漂移 |
| board-filter.spec.ts | 524 | toBe | 16 | 16 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、既有几何不漂移 |
| board-filter.spec.ts | 525 | toBe | 16 | 16 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、既有几何不漂移 |
| board-filter.spec.ts | 526 | toBe | 16 | 16 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、既有几何不漂移 |
| board-filter.spec.ts | 527 | toBe | 94.5 | 94.5 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、既有几何不漂移 |
| board-filter.spec.ts | 529 | toBe | 26.5 | 26.5 | — | 任务卡渲染标签 chip：词表配色、无标签零占位、既有几何不漂移 |
| chat-md-toolout.spec.ts | 87 | toBe | rgb(238, 232, 228) | rgb(238, 232, 228) | — | A3: the output block is left aligned, mono, normal contrast — not a chat-note |
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
| composer-slash.spec.ts | 333 | toBeGreaterThanOrEqual | ≥ 0 | 228.68968200683594 | — | /help opens the command panel |
| composer-slash.spec.ts | 334 | toBeLessThanOrEqual | ≤ 732 | 446.3103332519531 | — | /help opens the command panel |
| composer-wire-reject.spec.ts | 160 | toBe | 1 | {"__fn":"() => posts"} | — | detail face: a rejected steer (409) keeps the draft word for word |
| composer-wire-reject.spec.ts | 183 | toBe | 1 | {"__fn":"() => posts"} | — | detail face: an accepted steer clears the draft |
| composer-wire-reject.spec.ts | 218 | toBe | 1 | {"__fn":"() => posts"} | — | chief face: a rejected send (500) keeps the draft and toasts |
| composer-wire-reject.spec.ts | 244 | toBe | 1 | {"__fn":"() => posts"} | — | chief face: an accepted send clears the draft |
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
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 434.3957061767578 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 431.85606384277344 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 452 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 289.27679443359375 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 234.48358154296875 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 161.58604431152344 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 140.4672393798828 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 32.80213928222656 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 34.07197570800781 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 24 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 105.36160278320312 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 132.75820922851562 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 169.2069854736328 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 179.76637268066406 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 467.1978454589844 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 465.92803955078125 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 476 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 394.6383972167969 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 367.2417907714844 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 330.79302978515625 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 320.2336120605469 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 51 | toBeGreaterThan | > 404 | 1480 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 51 | toBeGreaterThan | > 210 | 308 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
| dialog-viewport.spec.ts | 79 | toEqual | {"x":192,"y":428,"width":416,"height":32} | {"x":192,"y":428,"width":416,"height":32} | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 148 | toBeLessThanOrEqual | ≤ 312.5 | 307.4111785888672 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
| merge-reject.spec.ts | 251 | toBe | 1 | {"__fn":"() => merges"} | — | 看板入口：server 真拒（403）时弹层不关，server 文案原样显出 |
| merge-reject.spec.ts | 267 | toBe | 1 | {"__fn":"() => merges"} | — | 合并成功（202）时弹层照常关，不留错误行 |
| review-reject.spec.ts | 167 | toBe | 1 | {"__fn":"() => stepPosts"} | — | FM1/FM2: 静息 review 发送 = steps revision 动作面，draft 清空、chip 即时翻规划中 |
| review-reject.spec.ts | 168 | toBe | 0 | 0 | — | FM1/FM2: 静息 review 发送 = steps revision 动作面，draft 清空、chip 即时翻规划中 |
| review-reject.spec.ts | 205 | toBe | 1 | {"__fn":"() => stepPosts"} | — | FM3: 更多菜单出现「请求修改」入口，弹层收反馈后走同一动作面 |
| review-reject.spec.ts | 260 | toBe | 1 | {"__fn":"() => steerPosts"} | — | FM4: 运行中 review（claimed 步在场）发送保持 steer 语义，不抢动作面 |
| review-reject.spec.ts | 261 | toBe | 0 | 0 | — | FM4: 运行中 review（claimed 步在场）发送保持 steer 语义，不抢动作面 |
| review-reject.spec.ts | 281 | toBe | 1 | {"__fn":"() => stepPosts"} | — | FM2: 打回被拒（409 竞态）draft 逐字保留 + 提示行显性，不静默吞 |
| shadcn-primitives.spec.ts | 71 | not.toBe | contents | flex | — | avatar 落点定尺盒（#983/#1003）：Root 生成真盒承上游发丝环，img 几何不变 |
| shadcn-primitives.spec.ts | 74 | toBe | 24 | 24 | — | avatar 落点定尺盒（#983/#1003）：Root 生成真盒承上游发丝环，img 几何不变 |
| shadcn-primitives.spec.ts | 75 | toBe | 24 | 24 | — | avatar 落点定尺盒（#983/#1003）：Root 生成真盒承上游发丝环，img 几何不变 |
| shadcn-primitives.spec.ts | 76 | toBe | 24 | 24 | — | avatar 落点定尺盒（#983/#1003）：Root 生成真盒承上游发丝环，img 几何不变 |
| shadcn-primitives.spec.ts | 77 | toBe | 24 | 24 | — | avatar 落点定尺盒（#983/#1003）：Root 生成真盒承上游发丝环，img 几何不变 |
| shadcn-primitives.spec.ts | 78 | toBe | 44 | 44 | — | avatar 落点定尺盒（#983/#1003）：Root 生成真盒承上游发丝环，img 几何不变 |
| shadcn-primitives.spec.ts | 103 | toBe | 16 | 16 | — | tag-chip 落点：落在 registry Badge 上，别名类与 per-face 几何双保（卡面 16 / 面板面 20） |
| shadcn-primitives.spec.ts | 114 | toBe | 20 | 20 | — | tag-chip 落点：落在 registry Badge 上，别名类与 per-face 几何双保（卡面 16 / 面板面 20） |
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
| spinner-live.spec.ts | 149 | toBe | rgb(242, 148, 216) | rgb(242, 148, 216) | — | root is aria-hidden and shell/ring strokes ride currentColor; label stays the cue |
| spinner-live.spec.ts | 151 | toBe | rgb(242, 148, 216) | rgb(242, 148, 216) | — | root is aria-hidden and shell/ring strokes ride currentColor; label stays the cue |
| spinner-live.spec.ts | 174 | toBe | 0 | 0 | — | prefers-reduced-motion freezes the spins with the static settle transform |
| spinner-live.spec.ts | 176 | toBe | none | none | — | prefers-reduced-motion freezes the spins with the static settle transform |
| spinner-live.spec.ts | 177 | not.toBe | none | matrix(0.5, 0.866025, -0.866025, 0.5, 0, 0) | — | prefers-reduced-motion freezes the spins with the static settle transform |
| transcript-user-words.spec.ts | 225 | toBe | 24 | 24 | — | 5. 单段短消息气泡保持 24px 药丸高度（几何不漂移） |
| transcript-user-words.spec.ts | 226 | toBe | 15px | 15px | — | 5. 单段短消息气泡保持 24px 药丸高度（几何不漂移） |
