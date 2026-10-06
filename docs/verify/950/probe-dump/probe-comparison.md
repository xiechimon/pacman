# Probe dump — old baseline → new measured (#921)

Run 2026-10-06T00:19:18.384Z · commit `0af4a78e` · port 8397 · playwright 1.63.0 · workers 4

Specs: chief-composer-tools chief-drawer-model chief-drawer-slash chief-fab chief-panel chief-send-fallback chief-settings chief-stream-markdown dialog-viewport segmented-controls agent-identity-chip (11 files) · tests 116 passed / 0 failed

## Coverage

Enumerated = static scan of spec source. Collected = distinct runtime call sites that returned a value (polls/themed loops record repeatedly; distinct de-dupes by file:line).

| probe surface | enumerated | collected |
| --- | --- | --- |
| getComputedStyle occurrences (headline count) | 33 | — (captured per evaluate call below) |
| probe-carrying evaluate/waitForFunction call sites | 29 | 30 |
| .boundingBox() call sites | 28 | 28 |
| .toHaveCSS() call sites | 0 | 0 |
| visual-matcher assertion sites | 152 | 192 joined |

Comparison rows: 168 — KEPT 168, DRIFT 0, NOT-RUN 0, VIOLATION 0, other 0.

Review procedure (#910 裁定 5): every DRIFT row is either expected drift (the new canon — re-pin the spec inline value to “new measured”) or a suspected regression (fix the code, keep the baseline). KEPT rows need no action. NOT-RUN rows are assertion sites whose test failed earlier, was skipped, or was filtered out. The `note` column flags values whose source notation is not rgb/hex: `color(srgb …)` is folded to rgba for comparison (re-pin should write the rgb/hex form); oklch/lab/lch and non-sRGB `color()` cannot fold under the #411 contract and are flagged VIOLATION, never converted.

## KEPT — baseline holds on this build (168)

| spec | line | matcher | old baseline | new measured | note | test |
| --- | --- | --- | --- | --- | --- | --- |
| agent-identity-chip.spec.ts | 56 | toBe | 24 | 24 | — | F-E1/E2/E10: 头像+名字并排成链，href 指 Agent 设置页，几何 canon 不漂移 |
| agent-identity-chip.spec.ts | 57 | toBe | 24 | 24 | — | F-E1/E2/E10: 头像+名字并排成链，href 指 Agent 设置页，几何 canon 不漂移 |
| agent-identity-chip.spec.ts | 61 | toBe | 12px | 12px | — | F-E1/E2/E10: 头像+名字并排成链，href 指 Agent 设置页，几何 canon 不漂移 |
| agent-identity-chip.spec.ts | 69 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | F-E9: hover 只变 cursor，不发明背景态（参考站正典） |
| agent-identity-chip.spec.ts | 70 | toBe | pointer | pointer | — | F-E9: hover 只变 cursor，不发明背景态（参考站正典） |
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
| chief-drawer-slash.spec.ts | 211 | toBeGreaterThanOrEqual | ≥ 0 | 228.69912719726562 | — | /help opens the command panel with the drawer builtins |
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
| dialog-viewport.spec.ts | 34 | toBeLessThanOrEqual | ≤ 452.5 | 434.37907791137695 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 34 | toBeLessThanOrEqual | ≤ 452.5 | 424.325626373291 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 34 | toBeLessThanOrEqual | ≤ 452.5 | 452 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 34 | toBeLessThanOrEqual | ≤ 452.5 | 290.82971954345703 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 34 | toBeLessThanOrEqual | ≤ 452.5 | 231.8016815185547 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 34 | toBeLessThanOrEqual | ≤ 452.5 | 155.79998779296875 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 34 | toBeLessThanOrEqual | ≤ 452.5 | 139.53916931152344 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 35 | toBeGreaterThanOrEqual | ≥ 0 | 32.81046676635742 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 35 | toBeGreaterThanOrEqual | ≥ 0 | 37.83718490600586 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 35 | toBeGreaterThanOrEqual | ≥ 0 | 24 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 35 | toBeGreaterThanOrEqual | ≥ 0 | 104.58513641357422 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 35 | toBeGreaterThanOrEqual | ≥ 0 | 134.0991668701172 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 35 | toBeGreaterThanOrEqual | ≥ 0 | 172.10000610351562 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 35 | toBeGreaterThanOrEqual | ≥ 0 | 180.2304229736328 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 36 | toBeLessThanOrEqual | ≤ 500.5 | 467.1895446777344 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 36 | toBeLessThanOrEqual | ≤ 500.5 | 462.1628112792969 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 36 | toBeLessThanOrEqual | ≤ 500.5 | 476 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 36 | toBeLessThanOrEqual | ≤ 500.5 | 395.41485595703125 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 36 | toBeLessThanOrEqual | ≤ 500.5 | 365.9008483886719 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 36 | toBeLessThanOrEqual | ≤ 500.5 | 327.8999938964844 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 36 | toBeLessThanOrEqual | ≤ 500.5 | 319.76959228515625 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 44 | toBeGreaterThan | > 404 | 1480 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 44 | toBeGreaterThan | > 210 | 308 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
| dialog-viewport.spec.ts | 72 | toEqual | {"x":192,"y":428,"width":416,"height":32} | {"x":192,"y":428,"width":416,"height":32} | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 141 | toBeLessThanOrEqual | ≤ 312.5 | 299.8368663787842 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
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
| segmented-controls.spec.ts | 216 | toBe | rgba(28, 25, 20, 0.05) | {"__fn":"() => bg(charter)"} | — | chief tabs: hover tints, click swaps the view |
| segmented-controls.spec.ts | 243 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 244 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 245 | toBeLessThanOrEqual | ≤ 1 | 0.015625 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 246 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 250 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 256 | toEqual | {"pillZ":"0","pillPe":"none","tabZ":"1"} | {"pillZ":"0","pillPe":"none","tabZ":"1"} | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 294 | toEqual | ["left","width"] | {"__fn":"() => page.evaluate(() => [...new Set(window.__pillRuns)].sort())"} | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 307 | toBeLessThanOrEqual | ≤ 1 | {"__fn":"async () => {\n    const [p, c] = await Promise.all([box(pill), box(charter)]);\n    return Math.max(… | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
