# Probe dump — old baseline → new measured (#921)

Run 2026-10-08T11:25:25.055Z · commit `eab204aa` · port 8401 · playwright 1.63.0 · workers 4

Specs: project-empty-new-task project-files-local project-github-issues project-new-dir-browser project-new-fs-pick project-new-github project-new-repo project-settings-dead-buttons project-settings-delete project-tasks-toolbar file-viewer agent-detail agent-create-model agent-delete account-team-cleanse team-org-chart team-create-agent agent-identity-chip segmented-controls overlay-focus dead-buttons dialog-viewport accent-typo (23 files) · tests 231 passed / 0 failed

## Coverage

Enumerated = static scan of spec source. Collected = distinct runtime call sites that returned a value (polls/themed loops record repeatedly; distinct de-dupes by file:line).

| probe surface | enumerated | collected |
| --- | --- | --- |
| getComputedStyle occurrences (headline count) | 30 | — (captured per evaluate call below) |
| probe-carrying evaluate/waitForFunction call sites | 26 | 26 |
| .boundingBox() call sites | 23 | 23 |
| .toHaveCSS() call sites | 5 | 5 |
| visual-matcher assertion sites | 158 | 210 joined |

Comparison rows: 180 — KEPT 180, DRIFT 0, NOT-RUN 0, VIOLATION 0, other 0.

Review procedure (#910 裁定 5): every DRIFT row is either expected drift (the new canon — re-pin the spec inline value to “new measured”) or a suspected regression (fix the code, keep the baseline). KEPT rows need no action. NOT-RUN rows are assertion sites whose test failed earlier, was skipped, or was filtered out. The `note` column flags values whose source notation is not rgb/hex: `color(srgb …)` is folded to rgba for comparison (re-pin should write the rgb/hex form); oklch/lab/lch and non-sRGB `color()` cannot fold under the #411 contract and are flagged VIOLATION, never converted.

## KEPT — baseline holds on this build (180)

| spec | line | matcher | old baseline | new measured | note | test |
| --- | --- | --- | --- | --- | --- | --- |
| accent-typo.spec.ts | 44 | toBe | 400 | 400 | — | font baseline: body 400, card title 500, var font really loaded (light) |
| accent-typo.spec.ts | 44 | toBe | 400 | 400 | — | font baseline: body 400, card title 500, var font really loaded (dark) |
| accent-typo.spec.ts | 45 | toBe | 500 | 500 | — | font baseline: body 400, card title 500, var font really loaded (light) |
| accent-typo.spec.ts | 45 | toBe | 500 | 500 | — | font baseline: body 400, card title 500, var font really loaded (dark) |
| accent-typo.spec.ts | 59 | toBe | 500 | 500 | — | empty-state headline rides the registry EmptyTitle tier (light) |
| accent-typo.spec.ts | 59 | toBe | 500 | 500 | — | empty-state headline rides the registry EmptyTitle tier (dark) |
| accent-typo.spec.ts | 84 | toBe | rgb(18, 15, 11) | rgb(18, 15, 11) | — | sidebar header carries the Pacman brand mark + name (light) |
| accent-typo.spec.ts | 84 | toBe | rgb(238, 232, 228) | rgb(238, 232, 228) | — | sidebar header carries the Pacman brand mark + name (dark) |
| accent-typo.spec.ts | 85 | not.toBe | rgba(0, 0, 0, 0) | rgb(18, 15, 11) | — | sidebar header carries the Pacman brand mark + name (light) |
| accent-typo.spec.ts | 85 | not.toBe | rgba(0, 0, 0, 0) | rgb(238, 232, 228) | — | sidebar header carries the Pacman brand mark + name (dark) |
| accent-typo.spec.ts | 86 | toEqual | {"w":16,"h":16} | {"w":16,"h":16} | — | sidebar header carries the Pacman brand mark + name (light) |
| accent-typo.spec.ts | 86 | toEqual | {"w":16,"h":16} | {"w":16,"h":16} | — | sidebar header carries the Pacman brand mark + name (dark) |
| accent-typo.spec.ts | 105 | toEqual | {"bg":"rgba(0, 0, 0, 0)","color":"rgb(89, 84, 80)"} | {"bg":"rgba(0, 0, 0, 0)","color":"rgb(89, 84, 80)"} | — | resources back chevron hover shows no background change (light) |
| accent-typo.spec.ts | 105 | toEqual | {"bg":"rgba(0, 0, 0, 0)","color":"rgb(179, 174, 170)"} | {"bg":"rgba(0, 0, 0, 0)","color":"rgb(179, 174, 170)"} | — | resources back chevron hover shows no background change (dark) |
| accent-typo.spec.ts | 122 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | the sidebar collapse toggle shows no hover face (light) |
| accent-typo.spec.ts | 122 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | the sidebar collapse toggle shows no hover face (dark) |
| accent-typo.spec.ts | 123 | toBe | none | none | — | the sidebar collapse toggle shows no hover face (light) |
| accent-typo.spec.ts | 123 | toBe | none | none | — | the sidebar collapse toggle shows no hover face (dark) |
| accent-typo.spec.ts | 127 | toEqual | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(54, 50, 46)"} | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(54, 50, 46)"} | — | the sidebar collapse toggle shows no hover face (light) |
| accent-typo.spec.ts | 127 | toEqual | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(179, 174, 170)"} | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(179, 174, 170)"} | — | the sidebar collapse toggle shows no hover face (dark) |
| accent-typo.spec.ts | 173 | toBe | 1 | 1 | — | the sidebar toggles hold face and geometry while pressed (light) |
| accent-typo.spec.ts | 173 | toBe | 1 | 1 | — | the sidebar toggles hold face and geometry while pressed (dark) |
| accent-typo.spec.ts | 174 | toEqual | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(54, 50, 46)","opacity":"1","iconX":203,"iconY":13.5,"ico… | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(54, 50, 46)","opacity":"1","iconX":203,"iconY":13.5,"ico… | — | the sidebar toggles hold face and geometry while pressed (light) |
| accent-typo.spec.ts | 174 | toEqual | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(179, 174, 170)","opacity":"1","iconX":203,"iconY":13.5,"… | {"bg":"rgba(0, 0, 0, 0)","shadow":"none","color":"rgb(179, 174, 170)","opacity":"1","iconX":203,"iconY":13.5,"… | — | the sidebar toggles hold face and geometry while pressed (dark) |
| accent-typo.spec.ts | 179 | toBe | 1 | 1 | — | the sidebar toggles hold face and geometry while pressed (light) |
| accent-typo.spec.ts | 179 | toBe | 1 | 1 | — | the sidebar toggles hold face and geometry while pressed (dark) |
| accent-typo.spec.ts | 180 | toEqual | {"bg":"rgba(28, 25, 21, 0.05)","shadow":"none","color":"rgb(54, 50, 46)","opacity":"1","iconX":12,"iconY":13.5… | {"bg":"rgba(28, 25, 21, 0.05)","shadow":"none","color":"rgb(54, 50, 46)","opacity":"1","iconX":12,"iconY":13.5… | — | the sidebar toggles hold face and geometry while pressed (light) |
| accent-typo.spec.ts | 180 | toEqual | {"bg":"rgba(255, 252, 248, 0.05)","shadow":"none","color":"rgb(179, 174, 170)","opacity":"1","iconX":12,"iconY… | {"bg":"rgba(255, 252, 248, 0.05)","shadow":"none","color":"rgb(179, 174, 170)","opacity":"1","iconX":12,"iconY… | — | the sidebar toggles hold face and geometry while pressed (dark) |
| accent-typo.spec.ts | 203 | toBe | solid | solid | — | resources back chevron keeps a keyboard focus ring (light) |
| accent-typo.spec.ts | 203 | toBe | solid | solid | — | resources back chevron keeps a keyboard focus ring (dark) |
| accent-typo.spec.ts | 204 | toBe | 2px | 2px | — | resources back chevron keeps a keyboard focus ring (light) |
| accent-typo.spec.ts | 204 | toBe | 2px | 2px | — | resources back chevron keeps a keyboard focus ring (dark) |
| accent-typo.spec.ts | 206 | toBe | rgb(151, 34, 126) | rgb(151, 34, 126) | — | resources back chevron keeps a keyboard focus ring (light) |
| accent-typo.spec.ts | 206 | toBe | rgb(242, 148, 216) | rgb(242, 148, 216) | — | resources back chevron keeps a keyboard focus ring (dark) |
| accent-typo.spec.ts | 266 | toBe | rgb(158, 44, 73) | rgb(158, 44, 73) | — | P5 danger: destructive resolves and reads on card, passes 4.5 (light) |
| accent-typo.spec.ts | 266 | toBe | rgb(255, 171, 183) | rgb(255, 171, 183) | — | P5 danger: destructive resolves and reads on card, passes 4.5 (dark) |
| accent-typo.spec.ts | 267 | toBe | rgb(240, 235, 230) | rgb(240, 235, 230) | — | P5 danger: destructive resolves and reads on card, passes 4.5 (light) |
| accent-typo.spec.ts | 267 | toBe | rgb(38, 34, 31) | rgb(38, 34, 31) | — | P5 danger: destructive resolves and reads on card, passes 4.5 (dark) |
| accent-typo.spec.ts | 268 | toBeGreaterThanOrEqual | ≥ 4.5 | 6.092504029110813 | — | P5 danger: destructive resolves and reads on card, passes 4.5 (light) |
| accent-typo.spec.ts | 268 | toBeGreaterThanOrEqual | ≥ 4.5 | 8.836100618782584 | — | P5 danger: destructive resolves and reads on card, passes 4.5 (dark) |
| accent-typo.spec.ts | 276 | toBe | rgb(151, 34, 126) | rgb(151, 34, 126) | — | P5 main-button pair passes 4.5 in both themes (light) |
| accent-typo.spec.ts | 276 | toBe | rgb(242, 148, 216) | rgb(242, 148, 216) | — | P5 main-button pair passes 4.5 in both themes (dark) |
| accent-typo.spec.ts | 277 | toBe | rgb(255, 255, 255) | rgb(255, 255, 255) | — | P5 main-button pair passes 4.5 in both themes (light) |
| accent-typo.spec.ts | 277 | toBe | rgb(31, 27, 24) | rgb(31, 27, 24) | — | P5 main-button pair passes 4.5 in both themes (dark) |
| accent-typo.spec.ts | 278 | toBeGreaterThanOrEqual | ≥ 4.5 | 7.378921178215861 | — | P5 main-button pair passes 4.5 in both themes (light) |
| accent-typo.spec.ts | 278 | toBeGreaterThanOrEqual | ≥ 4.5 | 8.14426711269384 | — | P5 main-button pair passes 4.5 in both themes (dark) |
| accent-typo.spec.ts | 295 | toHaveCSS | background-color: rgba(151, 34, 126, 0.14) | rgba(151, 34, 126, 0.14) | color(srgb …) folded to rgba(151, 34, 126, 0.14); re-pin the spec to the rgb/hex form (#411) | P4 row hover rides accent-soft, delete row rides danger-soft (light) |
| accent-typo.spec.ts | 295 | toHaveCSS | background-color: rgba(242, 148, 216, 0.14) | rgba(242, 148, 216, 0.14) | color(srgb …) folded to rgba(242, 148, 216, 0.14); re-pin the spec to the rgb/hex form (#411) | P4 row hover rides accent-soft, delete row rides danger-soft (dark) |
| accent-typo.spec.ts | 300 | toHaveCSS | background-color: rgba(158, 44, 73, 0.14) | rgba(158, 44, 73, 0.14) | color(srgb …) folded to rgba(158, 44, 73, 0.14); re-pin the spec to the rgb/hex form (#411) | P4 row hover rides accent-soft, delete row rides danger-soft (light) |
| accent-typo.spec.ts | 300 | toHaveCSS | background-color: rgba(255, 171, 183, 0.14) | rgba(255, 171, 183, 0.14) | color(srgb …) folded to rgba(255, 171, 183, 0.14); re-pin the spec to the rgb/hex form (#411) | P4 row hover rides accent-soft, delete row rides danger-soft (dark) |
| account-team-cleanse.spec.ts | 85 | toBe | 1 | 1 | — | account switch: default permission renders off; click requests and grants |
| account-team-cleanse.spec.ts | 95 | toBe | 0 | 0 | — | account switch: granted permission renders checked without a click |
| account-team-cleanse.spec.ts | 105 | toBe | 1 | 1 | — | account switch: denied stays off; a click settles without granting |
| agent-create-model.spec.ts | 184 | toBeGreaterThanOrEqual | ≥ 226 | 277.375 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 185 | toBeLessThanOrEqual | ≤ 473 | 364.5 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 196 | toBeGreaterThanOrEqual | ≥ 226 | 253.6875 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 197 | toBeLessThanOrEqual | ≤ 473 | 432.5 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 199 | toBeGreaterThanOrEqual | ≥ 0 | 253.6875 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 200 | toBeGreaterThanOrEqual | ≥ 0 | 512 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 201 | toBeLessThanOrEqual | ≤ 1440 | 732 | — | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） |
| agent-create-model.spec.ts | 233 | toBeGreaterThanOrEqual | ≥ 226 | 240.5 | — | 模型很多：选过运行时后菜单不越出裁剪盒，首行可点，40 行一个不少 |
| agent-create-model.spec.ts | 234 | toBeLessThanOrEqual | ≤ 473 | 432.5 | — | 模型很多：选过运行时后菜单不越出裁剪盒，首行可点，40 行一个不少 |
| agent-delete.spec.ts | 48 | toHaveCSS | font-size: 14px | 14px | — | 概览页脚有删除入口，点开二次确认（canon 原文逐字） |
| agent-delete.spec.ts | 49 | toHaveCSS | line-height: 20px | 20px | — | 概览页脚有删除入口，点开二次确认（canon 原文逐字） |
| agent-detail.spec.ts | 183 | toBeLessThanOrEqual | ≤ 8 | 0 | — | 概览：两级菜单贴触发钮右缘且在内容列内（几何） |
| agent-detail.spec.ts | 184 | toBeLessThanOrEqual | ≤ 8 | 8 | — | 概览：两级菜单贴触发钮右缘且在内容列内（几何） |
| agent-detail.spec.ts | 185 | toBeGreaterThanOrEqual | ≥ 455 | 1028 | — | 概览：两级菜单贴触发钮右缘且在内容列内（几何） |
| agent-detail.spec.ts | 186 | toBeLessThanOrEqual | ≤ 1225 | 1208 | — | 概览：两级菜单贴触发钮右缘且在内容列内（几何） |
| agent-detail.spec.ts | 248 | toBeGreaterThan | > -1 | 3 | — | 概览：运行时档在模型之上，值由 provider 派生 |
| agent-detail.spec.ts | 249 | toBeLessThan | < 4 | 3 | — | 概览：运行时档在模型之上，值由 provider 派生 |
| agent-detail.spec.ts | 395 | toBe | 1 | {"__fn":"() => patches"} | — | 权限 tab：保存失败出可见错误反馈，开关不回弹 |
| agent-detail.spec.ts | 450 | toEqual | ["验收只看真机跑通","PROBE 探针的历史轮次"] | ["验收只看真机跑通","PROBE 探针的历史轮次"] | — | 记忆 tab：搜索扫 content 且 ASCII 大小写不敏感 |
| agent-detail.spec.ts | 468 | toEqual | ["构建分支的命名规律","验收只看真机跑通","PROBE 探针的历史轮次"] | ["构建分支的命名规律","验收只看真机跑通","PROBE 探针的历史轮次"] | — | 记忆 tab：`添加时间` 档按新 → 旧重排 |
| agent-detail.spec.ts | 480 | toEqual | ["PROBE 探针的历史轮次","验收只看真机跑通","构建分支的命名规律"] | ["PROBE 探针的历史轮次","验收只看真机跑通","构建分支的命名规律"] | — | 记忆 tab：`添加时间` 档按新 → 旧重排 |
| agent-detail.spec.ts | 499 | toEqual | ["PROBE 探针的历史轮次","验收只看真机跑通"] | ["PROBE 探针的历史轮次","验收只看真机跑通"] | — | 记忆 tab：搜索与排序叠加——排序只在命中集内生效 |
| agent-detail.spec.ts | 590 | toEqual | ["名称","职责","默认 skill","运行时","模型","思考强度"] | ["名称","职责","默认 skill","运行时","模型","思考强度"] | — | 概览：六个字段行长在同一张模板卡里，头像头在卡内 |
| agent-detail.spec.ts | 640 | toEqual | ["14px","14px"] | ["14px","14px"] | — | 记忆/权限卡：首行不吃卡的上圆角与描边（无方角外溢、无 2px 顶边） |
| agent-detail.spec.ts | 641 | toBe | 0px | 0px | — | 记忆/权限卡：首行不吃卡的上圆角与描边（无方角外溢、无 2px 顶边） |
| agent-identity-chip.spec.ts | 56 | toBe | 24 | 24 | — | F-E1/E2/E10: 头像+名字并排成链，href 指 Agent 设置页，几何 canon 不漂移 |
| agent-identity-chip.spec.ts | 57 | toBe | 24 | 24 | — | F-E1/E2/E10: 头像+名字并排成链，href 指 Agent 设置页，几何 canon 不漂移 |
| agent-identity-chip.spec.ts | 61 | toBe | 12px | 12px | — | F-E1/E2/E10: 头像+名字并排成链，href 指 Agent 设置页，几何 canon 不漂移 |
| agent-identity-chip.spec.ts | 69 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | F-E9: hover 只变 cursor，不发明背景态（参考站正典） |
| agent-identity-chip.spec.ts | 70 | toBe | pointer | pointer | — | F-E9: hover 只变 cursor，不发明背景态（参考站正典） |
| dead-buttons.spec.ts | 525 | toBeLessThan | < 1.5 | 0 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
| dead-buttons.spec.ts | 526 | toBeCloseTo | 28 ±0.5 | 28 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
| dead-buttons.spec.ts | 527 | toBeCloseTo | 28 ±0.5 | 28 | — | new-task dialog: the close control anchors to the head’s right edge (#574 re-key debt) |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 452 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 452 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 452 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 285 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 293 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 180 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 191.5625 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 24 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 24 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 24 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 107.5 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 103.5 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 160 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 154.21875 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 476 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 476 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 476 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 392.5 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 396.5 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 340 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 345.78125 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 51 | toBeGreaterThan | > 388 | 1480 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 51 | toBeGreaterThan | > 145 | 308 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
| dialog-viewport.spec.ts | 79 | toEqual | {"x":486,"y":412,"width":106,"height":32} | {"x":486,"y":412,"width":106,"height":32} | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 148 | toBeLessThanOrEqual | ≤ 312.5 | 312 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
| overlay-focus.spec.ts | 72 | not.toBe | auto | solid | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 73 | not.toBe | rgb(0, 95, 204) | rgb(242, 148, 216) | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 89 | not.toBe | auto | none | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 90 | not.toBe | rgb(0, 95, 204) | rgb(242, 148, 216) | — | click + key on 新建任务/topbar buttons: never the UA blue box |
| overlay-focus.spec.ts | 148 | toHaveCSS | animation-name: enter | enter | — | backdrop click closes; entry rides the registry fade-in |
| project-github-issues.spec.ts | 200 | toEqual | [{"number":7}] | [{"number":7}] | — | 1. 已连接 github 项目：入口 → 弹层 → 点选导入 → 详情见 issue 标题与全部标签 |
| project-github-issues.spec.ts | 223 | toEqual | ["state=open&page=1"] | ["state=open&page=1"] | — | 4. 状态过滤与分页参数直达请求面；hasMore=false 下一页禁用 |
| project-github-issues.spec.ts | 229 | toEqual | ["state=open&page=1","state=closed&page=1"] | ["state=open&page=1","state=closed&page=1"] | — | 4. 状态过滤与分页参数直达请求面；hasMore=false 下一页禁用 |
| project-github-issues.spec.ts | 237 | toEqual | ["state=open&page=1","state=closed&page=1","state=open&page=2"] | ["state=open&page=1","state=closed&page=1","state=open&page=2"] | — | 4. 状态过滤与分页参数直达请求面；hasMore=false 下一页禁用 |
| project-new-fs-pick.spec.ts | 138 | toBe | 1 | 1 | — | 在飞期按钮 disabled，双击单发 |
| project-new-repo.spec.ts | 254 | toBe | none | none | — | the name input focus ring is the registry ring, not the UA default |
| project-new-repo.spec.ts | 255 | not.toBe | none | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklab(0.… | — | the name input focus ring is the registry ring, not the UA default |
| project-new-repo.spec.ts | 256 | not.toContain | rgb(0, 95, 204) | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, oklab(0.… | — | the name input focus ring is the registry ring, not the UA default |
| project-new-repo.spec.ts | 270 | toEqual | [{"name":"Plain","teamId":"team-1"}] | [{"name":"Plain","teamId":"team-1"}] | — | untouched submit posts a repo-less body and navigates on 201 |
| project-new-repo.spec.ts | 286 | toEqual | [{"name":"my-repo","teamId":"team-1","kind":"local","localPath":"/tmp/my-repo"},{"name":"pacman","teamId":"tea… | [{"name":"my-repo","kind":"local","localPath":"/tmp/my-repo","teamId":"team-1"},{"name":"pacman","kind":"githu… | — | local and github submits carry kind + their wire field |
| project-new-repo.spec.ts | 330 | toBe | rgb(255, 171, 183) | rgb(255, 171, 183) | — | a 400 localPath reason renders the error row: 路径不存在 |
| project-new-repo.spec.ts | 330 | toBe | rgb(255, 171, 183) | rgb(255, 171, 183) | — | a 400 localPath reason renders the error row: 不是 git 仓库 |
| project-new-repo.spec.ts | 330 | toBe | rgb(255, 171, 183) | rgb(255, 171, 183) | — | a 400 localPath reason renders the error row: 需要绝对路径 |
| project-new-repo.spec.ts | 330 | toBe | rgb(255, 171, 183) | rgb(255, 171, 183) | — | a 400 localPath reason renders the error row: invalid body at localPath: case none |
| project-tasks-toolbar.spec.ts | 49 | toBe | grid | grid | — | view toggle swaps rows for grid cards and persists |
| segmented-controls.spec.ts | 88 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | page-tab: unselected hover steps the chip ink — dark + light |
| segmented-controls.spec.ts | 89 | toBe | rgb(179, 174, 170) | rgb(179, 174, 170) | — | page-tab: unselected hover steps the chip ink — dark + light |
| segmented-controls.spec.ts | 91 | toBe | rgb(238, 232, 228) | {"__fn":"() => ink(files)"} | — | page-tab: unselected hover steps the chip ink — dark + light |
| segmented-controls.spec.ts | 95 | toBe | rgba(18, 15, 11, 0.6) | rgba(18, 15, 11, 0.6) | — | page-tab: unselected hover steps the chip ink — dark + light |
| segmented-controls.spec.ts | 97 | toBe | rgb(18, 15, 11) | {"__fn":"() => ink(lightFiles)"} | — | page-tab: unselected hover steps the chip ink — dark + light |
| segmented-controls.spec.ts | 107 | toBe | rgba(64, 60, 57, 0.3) | rgba(64, 60, 57, 0.3) | — | page-tab: selected chip keeps its fill under hover, same geometry as the rest state |
| segmented-controls.spec.ts | 110 | toBe | rgba(64, 60, 57, 0.3) | rgba(64, 60, 57, 0.3) | — | page-tab: selected chip keeps its fill under hover, same geometry as the rest state |
| segmented-controls.spec.ts | 124 | toBe | 8px | 8px | — | page-tab: selected chip keeps its fill under hover, same geometry as the rest state |
| segmented-controls.spec.ts | 134 | toEqual | {"x":840,"y":9,"width":54,"height":25} | {"x":840,"y":9,"width":54,"height":25} | — | page-tab: selected chip keeps its fill under hover, same geometry as the rest state |
| segmented-controls.spec.ts | 155 | toBe | 0px | 0px | — | page-tab group rides the registry TabsList form (bg-muted, 32px, 3px inset) |
| segmented-controls.spec.ts | 156 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | page-tab group rides the registry TabsList form (bg-muted, 32px, 3px inset) |
| segmented-controls.spec.ts | 157 | toBe | 32 | 32 | — | page-tab group rides the registry TabsList form (bg-muted, 32px, 3px inset) |
| segmented-controls.spec.ts | 159 | toBe | 4 | 4 | — | page-tab group rides the registry TabsList form (bg-muted, 32px, 3px inset) |
| segmented-controls.spec.ts | 160 | toBe | 3 | 3 | — | page-tab group rides the registry TabsList form (bg-muted, 32px, 3px inset) |
| segmented-controls.spec.ts | 184 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | sched freq: dark active chip reads against the container, hover steps the rest ink |
| segmented-controls.spec.ts | 185 | toBe | rgba(64, 60, 57, 0.3) | rgba(64, 60, 57, 0.3) | — | sched freq: dark active chip reads against the container, hover steps the rest ink |
| segmented-controls.spec.ts | 187 | toBe | rgb(179, 174, 170) | rgb(179, 174, 170) | — | sched freq: dark active chip reads against the container, hover steps the rest ink |
| segmented-controls.spec.ts | 189 | toBe | rgb(238, 232, 228) | {"__fn":"() => ink(weekly)"} | — | sched freq: dark active chip reads against the container, hover steps the rest ink |
| segmented-controls.spec.ts | 192 | toBe | rgb(246, 241, 236) | rgb(246, 241, 236) | — | sched freq: dark active chip reads against the container, hover steps the rest ink |
| segmented-controls.spec.ts | 196 | toBe | rgba(18, 15, 11, 0.6) | rgba(18, 15, 11, 0.6) | — | sched freq: dark active chip reads against the container, hover steps the rest ink |
| segmented-controls.spec.ts | 198 | toBe | rgb(18, 15, 11) | {"__fn":"() => ink(lightWeekly)"} | — | sched freq: dark active chip reads against the container, hover steps the rest ink |
| segmented-controls.spec.ts | 204 | toBe | rgb(179, 174, 170) | rgb(179, 174, 170) | — | files seg + tasks view toggle: hover steps the unselected ink (dark) |
| segmented-controls.spec.ts | 206 | toBe | rgb(238, 232, 228) | {"__fn":"() => ink(history)"} | — | files seg + tasks view toggle: hover steps the unselected ink (dark) |
| segmented-controls.spec.ts | 211 | toBe | rgb(238, 232, 228) | {"__fn":"() => ink(grid)"} | — | files seg + tasks view toggle: hover steps the unselected ink (dark) |
| segmented-controls.spec.ts | 220 | toBe | rgba(28, 25, 21, 0.05) | {"__fn":"() => bg(dark)"} | — | user-menu 外观 seg: hover tints, click switches the theme |
| segmented-controls.spec.ts | 244 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => bg(git)"} | — | branch-dialog seg: hover tints Git, click swaps the tab body |
| segmented-controls.spec.ts | 262 | toBe | 1px | 1px | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 263 | toBe | rgb(234, 228, 224) | rgb(234, 228, 224) | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 264 | toBe | rgb(240, 235, 230) | rgb(240, 235, 230) | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 268 | toBe | rgba(28, 25, 21, 0.05) | {"border":"1px","groupBg":"rgb(234, 228, 224)"} | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 279 | toBe | rgba(28, 25, 21, 0.05) | {"__fn":"() => bg(charter)"} | — | chief tabs: hover tints, click swaps the view |
| segmented-controls.spec.ts | 306 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 307 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 308 | toBeLessThanOrEqual | ≤ 1 | 0.015625 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 309 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 313 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 319 | toEqual | {"pillZ":"0","pillPe":"none","tabZ":"1"} | {"pillZ":"0","pillPe":"none","tabZ":"1"} | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 357 | toEqual | ["left","width"] | {"__fn":"() => page.evaluate(() => [...new Set(window.__pillRuns)].sort())"} | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 370 | toBeLessThanOrEqual | ≤ 1 | {"__fn":"async () => {\n    const [p, c] = await Promise.all([box(pill), box(charter)]);\n    return Math.max(… | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
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
