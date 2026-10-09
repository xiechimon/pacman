# Probe dump — old baseline → new measured (#921)

Run 2026-10-08T11:25:08.509Z · commit `0664af2a` · port 8402 · playwright 1.63.0 · workers 4

Specs: hotkeys shadcn-primitives chip-assign chip-hotzone composer-inline-mention mention-picker-center composer-slash chief-drawer-slash newtask-project-select newtask-machine-pin newtask-machine-persist newtask-single-field newtask-project-persist project-empty-new-task project-new-dir-browser project-new-fs-pick project-new-repo project-new-github overlay-focus escape-wiring detail-esc z-ladder dead-buttons detail-3pane review-reject account-controls (27 files) · tests 233 passed / 0 failed

## Coverage

Enumerated = static scan of spec source. Collected = distinct runtime call sites that returned a value (polls/themed loops record repeatedly; distinct de-dupes by file:line).

| probe surface | enumerated | collected |
| --- | --- | --- |
| getComputedStyle occurrences (headline count) | 11 | — (captured per evaluate call below) |
| probe-carrying evaluate/waitForFunction call sites | 16 | 16 |
| .boundingBox() call sites | 7 | 7 |
| .toHaveCSS() call sites | 1 | 1 |
| visual-matcher assertion sites | 113 | 117 joined |

Comparison rows: 91 — KEPT 91, DRIFT 0, NOT-RUN 0, VIOLATION 0, other 0.

Review procedure (#910 裁定 5): every DRIFT row is either expected drift (the new canon — re-pin the spec inline value to “new measured”) or a suspected regression (fix the code, keep the baseline). KEPT rows need no action. NOT-RUN rows are assertion sites whose test failed earlier, was skipped, or was filtered out. The `note` column flags values whose source notation is not rgb/hex: `color(srgb …)` is folded to rgba for comparison (re-pin should write the rgb/hex form); oklch/lab/lch and non-sRGB `color()` cannot fold under the #411 contract and are flagged VIOLATION, never converted.

## KEPT — baseline holds on this build (91)

| spec | line | matcher | old baseline | new measured | note | test |
| --- | --- | --- | --- | --- | --- | --- |
| account-controls.spec.ts | 129 | toBe | 1 | {"__fn":"() => patchBodies.length"} | — | 改名 live：提交发 PATCH /api/user/me、刷新后仍是新名、失败有 toast 点名（R7–R9） |
| account-controls.spec.ts | 130 | toEqual | {"displayName":"落库名字"} | {"displayName":"落库名字"} | — | 改名 live：提交发 PATCH /api/user/me、刷新后仍是新名、失败有 toast 点名（R7–R9） |
| account-controls.spec.ts | 143 | toBe | 2 | {"__fn":"() => patchBodies.length"} | — | 改名 live：提交发 PATCH /api/user/me、刷新后仍是新名、失败有 toast 点名（R7–R9） |
| account-controls.spec.ts | 169 | toBe | 0 | 0 | — | 开关：granted 态能关掉、关档随刷新持久、能再开回来（S1/S2） |
| account-controls.spec.ts | 187 | toBe | 1 | 1 | — | 开关：denied 态开出偏好档 + 拦截解释、关得掉，两档都随刷新持久（S3/S4） |
| account-controls.spec.ts | 212 | toBe | 1 | 1 | — | 开关：default 态开出驱动 requestPermission，granted 落定后开档持久（S5） |
| account-controls.spec.ts | 271 | toBeGreaterThanOrEqual | ≥ 4 | 4 | — | 探针：帐号卡内每个控件点击都有可观察效果（P1，不只验改名与开关两个） |
| chief-drawer-slash.spec.ts | 163 | toBe | 0 | 0 | — | `/clear` runs without sending and toasts confirmation (F1) |
| chief-drawer-slash.spec.ts | 174 | toBe | 0 | 0 | — | Tab completes without running; Enter without highlight sends (F4) |
| chief-drawer-slash.spec.ts | 179 | toBe | 1 | {"__fn":"() => posts"} | — | Tab completes without running; Enter without highlight sends (F4) |
| chief-drawer-slash.spec.ts | 191 | toBe | 0 | 0 | — | mid-prompt accept inserts literal text, never runs (F3) |
| chief-drawer-slash.spec.ts | 211 | toBeGreaterThanOrEqual | ≥ 0 | 263.5939025878906 | — | /help opens the command panel with the drawer builtins |
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
| composer-slash.spec.ts | 333 | toBeGreaterThanOrEqual | ≥ 0 | 261.7683410644531 | — | /help opens the command panel |
| composer-slash.spec.ts | 334 | toBeLessThanOrEqual | ≤ 732 | 470.2316589355469 | — | /help opens the command panel |
| dead-buttons.spec.ts | 525 | toBeLessThan | < 1.5 | 0 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
| dead-buttons.spec.ts | 526 | toBeCloseTo | 28 ±0.5 | 28 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
| dead-buttons.spec.ts | 527 | toBeCloseTo | 28 ±0.5 | 28 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
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
| escape-wiring.spec.ts | 89 | toEqual | {"winAdds":0,"winRems":0,"docAdds":0,"docRems":0} | {"winAdds":0,"winRems":0,"docAdds":0,"docRems":0} | — | 开着的层不被重渲染重挂 Escape 接线：URL 写回后单次 Escape 仍收层 |
| escape-wiring.spec.ts | 157 | toEqual | {"winAdds":0,"winRems":0} | {"winAdds":0,"winRems":0} | — | 确认弹层不被根组件重渲染重挂 Escape 接线：⌘K 往返后单次 Escape 仍收层 |
| escape-wiring.spec.ts | 158 | toBe | 6 | 6 | — | 确认弹层不被根组件重渲染重挂 Escape 接线：⌘K 往返后单次 Escape 仍收层 |
| mention-picker-center.spec.ts | 21 | toHaveCSS | transform: none | none | — | mention picker stays centered in the production bundle (#448) |
| mention-picker-center.spec.ts | 26 | toBe | 400 | 400 | — | mention picker stays centered in the production bundle (#448) |
| mention-picker-center.spec.ts | 28 | toBeLessThanOrEqual | ≤ 1 | 0 | — | mention picker stays centered in the production bundle (#448) |
| overlay-focus.spec.ts | 72 | not.toBe | auto | solid | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 73 | not.toBe | rgb(0, 95, 204) | rgb(242, 148, 216) | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 89 | not.toBe | auto | none | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 90 | not.toBe | rgb(0, 95, 204) | rgb(242, 148, 216) | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| project-new-fs-pick.spec.ts | 138 | toBe | 1 | 1 | — | 在飞期按钮 disabled，双击单发 |
| project-new-repo.spec.ts | 248 | toBe | none | none | — | the name input focus ring is the brand ring, not the UA default |
| project-new-repo.spec.ts | 249 | toBe | rgb(242, 148, 216) | rgb(242, 148, 216) | — | the name input focus ring is the brand ring, not the UA default |
| project-new-repo.spec.ts | 250 | toContain | rgb(242, 148, 216) | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgb(242,… | — | the name input focus ring is the brand ring, not the UA default |
| project-new-repo.spec.ts | 251 | toContain | 1px | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgb(242,… | — | the name input focus ring is the brand ring, not the UA default |
| project-new-repo.spec.ts | 265 | toEqual | [{"name":"Plain","teamId":"team-1"}] | [{"name":"Plain","teamId":"team-1"}] | — | untouched submit posts a repo-less body and navigates on 201 |
| project-new-repo.spec.ts | 281 | toEqual | [{"name":"my-repo","teamId":"team-1","kind":"local","localPath":"/tmp/my-repo"},{"name":"pacman","teamId":"tea… | [{"name":"my-repo","kind":"local","localPath":"/tmp/my-repo","teamId":"team-1"},{"name":"pacman","kind":"githu… | — | local and github submits carry kind + their wire field |
| project-new-repo.spec.ts | 325 | toBe | rgb(255, 171, 183) | rgb(255, 171, 183) | — | a 400 localPath reason renders the error row: 路径不存在 |
| project-new-repo.spec.ts | 325 | toBe | rgb(255, 171, 183) | rgb(255, 171, 183) | — | a 400 localPath reason renders the error row: 不是 git 仓库 |
| project-new-repo.spec.ts | 325 | toBe | rgb(255, 171, 183) | rgb(255, 171, 183) | — | a 400 localPath reason renders the error row: 需要绝对路径 |
| project-new-repo.spec.ts | 325 | toBe | rgb(255, 171, 183) | rgb(255, 171, 183) | — | a 400 localPath reason renders the error row: invalid body at localPath: case none |
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
| shadcn-primitives.spec.ts | 106 | toBe | 16 | 16 | — | tag-chip 落点：落在 registry Badge 上，别名类与 per-face 几何双保（卡面 16 / 面板面 20） |
| shadcn-primitives.spec.ts | 117 | toBe | 20 | 20 | — | tag-chip 落点：落在 registry Badge 上，别名类与 per-face 几何双保（卡面 16 / 面板面 20） |
| z-ladder.spec.ts | 64 | toEqual | ["true","true","true","true","true"] | ["true","true","true","true","true"] | — | every probe point of the new-task panel hit-tests inside the panel |
