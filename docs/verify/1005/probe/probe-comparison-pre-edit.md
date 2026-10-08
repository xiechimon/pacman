# Probe dump — old baseline → new measured (#921)

Run 2026-10-08T04:36:21.767Z · commit `034cd149` · port 8399 · playwright 1.63.0 · workers 4

Specs: machine- machines- provider- providers- secret- skills- title- segmented- dialog- shell- account-team-cleanse user-menu- team- avatar- (24 files) · tests 162 passed / 0 failed

## Coverage

Enumerated = static scan of spec source. Collected = distinct runtime call sites that returned a value (polls/themed loops record repeatedly; distinct de-dupes by file:line).

| probe surface | enumerated | collected |
| --- | --- | --- |
| getComputedStyle occurrences (headline count) | 14 | — (captured per evaluate call below) |
| probe-carrying evaluate/waitForFunction call sites | 15 | 15 |
| .boundingBox() call sites | 29 | 29 |
| .toHaveCSS() call sites | 0 | 0 |
| visual-matcher assertion sites | 118 | 160 joined |

Comparison rows: 126 — KEPT 126, DRIFT 0, NOT-RUN 0, VIOLATION 0, other 0.

Review procedure (#910 裁定 5): every DRIFT row is either expected drift (the new canon — re-pin the spec inline value to “new measured”) or a suspected regression (fix the code, keep the baseline). KEPT rows need no action. NOT-RUN rows are assertion sites whose test failed earlier, was skipped, or was filtered out. The `note` column flags values whose source notation is not rgb/hex: `color(srgb …)` is folded to rgba for comparison (re-pin should write the rgb/hex form); oklch/lab/lch and non-sRGB `color()` cannot fold under the #411 contract and are flagged VIOLATION, never converted.

## KEPT — baseline holds on this build (126)

| spec | line | matcher | old baseline | new measured | note | test |
| --- | --- | --- | --- | --- | --- | --- |
| account-team-cleanse.spec.ts | 85 | toBe | 1 | 1 | — | account switch: default permission renders off; click requests and grants |
| account-team-cleanse.spec.ts | 95 | toBe | 0 | 0 | — | account switch: granted permission renders checked without a click |
| account-team-cleanse.spec.ts | 105 | toBe | 1 | 1 | — | account switch: denied stays off; a click settles without granting |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 452 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 431.831485748291 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 452 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 292.08179473876953 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 234.49681091308594 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 156.3805694580078 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 41 | toBeLessThanOrEqual | ≤ 452.5 | 141.6593475341797 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 24 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 34.08425521850586 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 24 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 103.95909881591797 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 132.75160217285156 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 171.80970764160156 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 42 | toBeGreaterThanOrEqual | ≥ 0 | 179.1703338623047 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 476 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 465.9157409667969 | — | secret: 静态表单面 submit 在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 476 | — | machine: disclosure 展开(最高内容态)底部链接在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 396.0408935546875 | — | create-agent: submit 在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 367.2484130859375 | — | charter: 取消/保存章程在视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 328.1902770996094 | — | chief-agent 列表态(无按钮读面)面板整体不越视口 |
| dialog-viewport.spec.ts | 43 | toBeLessThanOrEqual | ≤ 500.5 | 320.8296813964844 | — | accept(34): 取消/完成在视口 |
| dialog-viewport.spec.ts | 51 | toBeGreaterThan | > 404 | 1480 | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 51 | toBeGreaterThan | > 210 | 308 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
| dialog-viewport.spec.ts | 79 | toEqual | {"x":192,"y":428,"width":416,"height":32} | {"x":192,"y":428,"width":416,"height":32} | — | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 |
| dialog-viewport.spec.ts | 148 | toBeLessThanOrEqual | ≤ 312.5 | 302.7672595977783 | — | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 |
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
| segmented-controls.spec.ts | 42 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | page-tab: unselected hover tints the chip — dark + light |
| segmented-controls.spec.ts | 44 | toBe | rgba(255, 252, 248, 0.05) | rgba(0, 0, 0, 0) | — | page-tab: unselected hover tints the chip — dark + light |
| segmented-controls.spec.ts | 49 | toBe | rgba(28, 25, 21, 0.05) | {"__fn":"() => bg(lightFiles)"} | — | page-tab: unselected hover tints the chip — dark + light |
| segmented-controls.spec.ts | 59 | toBe | rgb(38, 34, 31) | rgb(38, 34, 31) | — | page-tab: selected chip keeps its fill under hover, same geometry as the hover tint |
| segmented-controls.spec.ts | 62 | toBe | rgb(38, 34, 31) | rgb(38, 34, 31) | — | page-tab: selected chip keeps its fill under hover, same geometry as the hover tint |
| segmented-controls.spec.ts | 76 | toBe | 0px | 0px | — | page-tab: selected chip keeps its fill under hover, same geometry as the hover tint |
| segmented-controls.spec.ts | 86 | toEqual | {"x":840,"y":10,"width":50,"height":24} | {"x":840,"y":10,"width":50,"height":24} | — | page-tab: selected chip keeps its fill under hover, same geometry as the hover tint |
| segmented-controls.spec.ts | 105 | toBe | 1px | 1px | — | page-tab group rides the official hairline ring (r2 24b/24c probe) |
| segmented-controls.spec.ts | 106 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | page-tab group rides the official hairline ring (r2 24b/24c probe) |
| segmented-controls.spec.ts | 107 | toBe | 30 | 30 | — | page-tab group rides the official hairline ring (r2 24b/24c probe) |
| segmented-controls.spec.ts | 108 | toBe | 3 | 3 | — | page-tab group rides the official hairline ring (r2 24b/24c probe) |
| segmented-controls.spec.ts | 109 | toBe | 3 | 3 | — | page-tab group rides the official hairline ring (r2 24b/24c probe) |
| segmented-controls.spec.ts | 133 | toBe | rgb(45, 41, 38) | rgb(45, 41, 38) | — | sched freq: dark active chip reads against the container, hover tints the rest |
| segmented-controls.spec.ts | 134 | toBe | rgb(38, 34, 31) | rgb(38, 34, 31) | — | sched freq: dark active chip reads against the container, hover tints the rest |
| segmented-controls.spec.ts | 137 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => bg(weekly)"} | — | sched freq: dark active chip reads against the container, hover tints the rest |
| segmented-controls.spec.ts | 140 | toBe | rgb(240, 235, 230) | rgb(240, 235, 230) | — | sched freq: dark active chip reads against the container, hover tints the rest |
| segmented-controls.spec.ts | 143 | toBe | rgba(28, 25, 21, 0.05) | {"__fn":"() => bg(lightWeekly)"} | — | sched freq: dark active chip reads against the container, hover tints the rest |
| segmented-controls.spec.ts | 150 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => bg(history)"} | — | files seg + tasks view toggle: hover tints the unselected (dark) |
| segmented-controls.spec.ts | 155 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => bg(grid)"} | — | files seg + tasks view toggle: hover tints the unselected (dark) |
| segmented-controls.spec.ts | 164 | toBe | rgba(28, 25, 21, 0.05) | {"__fn":"() => bg(dark)"} | — | user-menu 外观 seg: hover tints, click switches the theme |
| segmented-controls.spec.ts | 188 | toBe | rgba(255, 252, 248, 0.05) | {"__fn":"() => bg(git)"} | — | branch-dialog seg: hover tints Git, click swaps the tab body |
| segmented-controls.spec.ts | 206 | toBe | 1px | 1px | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 207 | toBe | rgb(234, 228, 224) | rgb(234, 228, 224) | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 208 | toBe | rgb(240, 235, 230) | rgb(240, 235, 230) | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 212 | toBe | rgba(28, 25, 21, 0.05) | {"border":"1px","groupBg":"rgb(234, 228, 224)"} | — | team layout toggle: official ring border + hover tint + chip token |
| segmented-controls.spec.ts | 223 | toBe | rgba(28, 25, 21, 0.05) | {"__fn":"() => bg(charter)"} | — | chief tabs: hover tints, click swaps the view |
| segmented-controls.spec.ts | 250 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 251 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 252 | toBeLessThanOrEqual | ≤ 1 | 0.015625 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 253 | toBeLessThanOrEqual | ≤ 1 | 0 | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 257 | toBe | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 263 | toEqual | {"pillZ":"0","pillPe":"none","tabZ":"1"} | {"pillZ":"0","pillPe":"none","tabZ":"1"} | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 301 | toEqual | ["left","width"] | {"__fn":"() => page.evaluate(() => [...new Set(window.__pillRuns)].sort())"} | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| segmented-controls.spec.ts | 314 | toBeLessThanOrEqual | ≤ 1 | {"__fn":"async () => {\n    const [p, c] = await Promise.all([box(pill), box(charter)]);\n    return Math.max(… | — | chief tabs: indicator pill slides between chips — 150ms ease on left/top/width/height |
| shell-consistency.spec.ts | 45 | toEqual | {"x":0,"y":0,"width":240,"height":732} | {"x":0,"y":0,"width":240,"height":732} | — | expanded sidebar keeps identical geometry across /app ↔ /app/team ↔ resources hops |
| shell-consistency.spec.ts | 45 | toEqual | {"x":0,"y":0,"width":40,"height":732} | {"x":0,"y":0,"width":40,"height":732} | — | collapsed rail survives route hops (storage-backed on every shell) |
| shell-consistency.spec.ts | 174 | toEqual | {"iconX":19,"nameX":46,"toggleX":197} | {"__fn":"() => headContentX(page)"} | — | the brand head holds its inner geometry across the /app → /app/team hop |
| shell-consistency.spec.ts | 203 | toBe | 1 | {"__fn":"() => page.evaluate(k => localStorage.getItem(k), SIDEBAR_KEY)"} | — | the collapse toggle works off-board and the state rides back |
| shell-consistency.spec.ts | 226 | toEqual | {"theme":"light","light":"true"} | {"theme":"light","light":"true"} | — | no storage + system light boots light |
| shell-consistency.spec.ts | 232 | toEqual | {"theme":"dark","light":"false"} | {"theme":"dark","light":"false"} | — | no storage + system dark boots dark |
| shell-consistency.spec.ts | 239 | toEqual | {"theme":"dark","light":"false"} | {"theme":"dark","light":"false"} | — | a stored theme beats the system scheme |
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
| title-band-clicks.spec.ts | 50 | toBeGreaterThan | > 0 | 1 | — | team right-slot action owns its hit area (设置 slot under the same band) |
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
