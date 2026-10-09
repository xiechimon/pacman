# Probe dump — old baseline → new measured (#921)

Run 2026-10-08T18:05:25.094Z · commit `763c21f2` · port 5313 · playwright 1.63.0 · workers 4

Specs: agent-create-model agent-detail team-create-agent (3 files) · tests 53 passed / 0 failed

## Coverage

Enumerated = static scan of spec source. Collected = distinct runtime call sites that returned a value (polls/themed loops record repeatedly; distinct de-dupes by file:line).

| probe surface | enumerated | collected |
| --- | --- | --- |
| getComputedStyle occurrences (headline count) | 1 | — (captured per evaluate call below) |
| probe-carrying evaluate/waitForFunction call sites | 1 | 1 |
| .boundingBox() call sites | 5 | 5 |
| .toHaveCSS() call sites | 0 | 0 |
| visual-matcher assertion sites | 30 | 30 joined |

Comparison rows: 28 — KEPT 28, DRIFT 0, NOT-RUN 0, VIOLATION 0, other 0.

Review procedure (#910 裁定 5): every DRIFT row is either expected drift (the new canon — re-pin the spec inline value to “new measured”) or a suspected regression (fix the code, keep the baseline). KEPT rows need no action. NOT-RUN rows are assertion sites whose test failed earlier, was skipped, or was filtered out. The `note` column flags values whose source notation is not rgb/hex: `color(srgb …)` is folded to rgba for comparison (re-pin should write the rgb/hex form); oklch/lab/lch and non-sRGB `color()` cannot fold under the #411 contract and are flagged VIOLATION, never converted.

## KEPT — baseline holds on this build (28)

| spec | line | matcher | old baseline | new measured | note | test |
| --- | --- | --- | --- | --- | --- | --- |
| agent-create-model.spec.ts | 189 | toBeGreaterThanOrEqual | ≥ -0.5 | 374.5 | — | 创建弹窗：两级菜单整块落在视口内（几何） |
| agent-create-model.spec.ts | 190 | toBeGreaterThanOrEqual | ≥ -0.5 | 517 | — | 创建弹窗：两级菜单整块落在视口内（几何） |
| agent-create-model.spec.ts | 191 | toBeLessThanOrEqual | ≤ 732.5 | 430.5 | — | 创建弹窗：两级菜单整块落在视口内（几何） |
| agent-create-model.spec.ts | 192 | toBeLessThanOrEqual | ≤ 1440.5 | 933 | — | 创建弹窗：两级菜单整块落在视口内（几何） |
| agent-create-model.spec.ts | 202 | toBeGreaterThanOrEqual | ≥ -0.5 | 438.5 | — | 创建弹窗：两级菜单整块落在视口内（几何） |
| agent-create-model.spec.ts | 203 | toBeGreaterThanOrEqual | ≥ -0.5 | 517 | — | 创建弹窗：两级菜单整块落在视口内（几何） |
| agent-create-model.spec.ts | 204 | toBeLessThanOrEqual | ≤ 732.5 | 578.5 | — | 创建弹窗：两级菜单整块落在视口内（几何） |
| agent-create-model.spec.ts | 205 | toBeLessThanOrEqual | ≤ 1440.5 | 933 | — | 创建弹窗：两级菜单整块落在视口内（几何） |
| agent-create-model.spec.ts | 238 | toBeGreaterThanOrEqual | ≥ -0.5 | 438.5 | — | 模型很多：选过运行时后菜单不越出视口，首行可点，40 行一个不少 |
| agent-create-model.spec.ts | 239 | toBeLessThanOrEqual | ≤ 732.5 | 722 | — | 模型很多：选过运行时后菜单不越出视口，首行可点，40 行一个不少 |
| agent-detail.spec.ts | 186 | toBeLessThan | < 1208 | 1125.578125 | — | 概览：两级菜单锚在触发钮上且整块在视口内（几何） |
| agent-detail.spec.ts | 187 | toBeGreaterThan | > 1125.59375 | 1269.578125 | — | 概览：两级菜单锚在触发钮上且整块在视口内（几何） |
| agent-detail.spec.ts | 190 | toBeLessThanOrEqual | ≤ 454 | 414 | — | 概览：两级菜单锚在触发钮上且整块在视口内（几何） |
| agent-detail.spec.ts | 191 | toBeGreaterThanOrEqual | ≥ 406 | 470 | — | 概览：两级菜单锚在触发钮上且整块在视口内（几何） |
| agent-detail.spec.ts | 193 | toBeGreaterThanOrEqual | ≥ -0.5 | 1125.578125 | — | 概览：两级菜单锚在触发钮上且整块在视口内（几何） |
| agent-detail.spec.ts | 194 | toBeGreaterThanOrEqual | ≥ -0.5 | 414 | — | 概览：两级菜单锚在触发钮上且整块在视口内（几何） |
| agent-detail.spec.ts | 195 | toBeLessThanOrEqual | ≤ 1440.5 | 1269.578125 | — | 概览：两级菜单锚在触发钮上且整块在视口内（几何） |
| agent-detail.spec.ts | 196 | toBeLessThanOrEqual | ≤ 732.5 | 470 | — | 概览：两级菜单锚在触发钮上且整块在视口内（几何） |
| agent-detail.spec.ts | 258 | toBeGreaterThan | > -1 | 3 | — | 概览：运行时档在模型之上，值由 provider 派生 |
| agent-detail.spec.ts | 259 | toBeLessThan | < 4 | 3 | — | 概览：运行时档在模型之上，值由 provider 派生 |
| agent-detail.spec.ts | 405 | toBe | 1 | {"__fn":"() => patches"} | — | 权限 tab：保存失败出可见错误反馈，开关不回弹 |
| agent-detail.spec.ts | 460 | toEqual | ["验收只看真机跑通","PROBE 探针的历史轮次"] | ["验收只看真机跑通","PROBE 探针的历史轮次"] | — | 记忆 tab：搜索扫 content 且 ASCII 大小写不敏感 |
| agent-detail.spec.ts | 478 | toEqual | ["构建分支的命名规律","验收只看真机跑通","PROBE 探针的历史轮次"] | ["构建分支的命名规律","验收只看真机跑通","PROBE 探针的历史轮次"] | — | 记忆 tab：`添加时间` 档按新 → 旧重排 |
| agent-detail.spec.ts | 490 | toEqual | ["PROBE 探针的历史轮次","验收只看真机跑通","构建分支的命名规律"] | ["PROBE 探针的历史轮次","验收只看真机跑通","构建分支的命名规律"] | — | 记忆 tab：`添加时间` 档按新 → 旧重排 |
| agent-detail.spec.ts | 509 | toEqual | ["PROBE 探针的历史轮次","验收只看真机跑通"] | ["PROBE 探针的历史轮次","验收只看真机跑通"] | — | 记忆 tab：搜索与排序叠加——排序只在命中集内生效 |
| agent-detail.spec.ts | 600 | toEqual | ["名称","职责","默认 skill","运行时","模型","思考强度"] | ["名称","职责","默认 skill","运行时","模型","思考强度"] | — | 概览：六个字段行长在同一张模板卡里，头像头在卡内 |
| agent-detail.spec.ts | 651 | toEqual | ["14px","14px"] | ["14px","14px"] | — | 记忆/权限卡：首行不吃卡的上圆角与描边（无方角外溢、无 2px 顶边） |
| agent-detail.spec.ts | 652 | toBe | 0px | 0px | — | 记忆/权限卡：首行不吃卡的上圆角与描边（无方角外溢、无 2px 顶边） |
