# L4 pages 探针三方 diff（#986 机械步骤，#1007 验收模板 v3 项 2）

三账同 spec 集（24 spec）：#953 封版（docs/verify/953/probe-sealed）→ before（origin/main 034cd149 一次性 worktree 栈 8404 侦察账）→ after（本车道重钉后 8401 账：**180 视觉行 KEPT 180 / DRIFT 0 / VIOLATION 0**）。

- before∩after 站点 36；值变化 20（下表，逐条预期 registry 形态漂移，spec 内基线已随重钉更新）
- before 有 after 无（载体退役删探针）43；after 新增（重钉补钉点）45
- sealed→before 差 = 批次 0（#1002 色板 / #1003 registry 对齐）已审面，不在本表重审

## 值变化站点（人审对照）

| spec:line | 探针 | before | after | 判定 |
|---|---|---|---|---|
| agent-create-model.spec.ts:171 | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） | {"x": 506.40191650390625, "y": 205.3246612548828, "width": 427.1961669921875, "height": 321.35069... | {"x": 512, "y": 226.5, "width": 416, "height": 246} | 预期：registry 形态（已重钉） |
| agent-create-model.spec.ts:172 | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） | {"x": 504.7242431640625, "y": 527.9373168945312, "width": 430.551513671875, "height": 46.13055419... | {"x": 496, "y": 488.5, "width": 448, "height": 65} | 预期：registry 形态（已重钉） |
| agent-create-model.spec.ts:180 | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） | {"x": 513.7999877929688, "y": 307.2462463378906, "width": 176.4000244140625, "height": 85.3825073... | {"x": 512, "y": 277.375, "width": 180, "height": 87.125} | 预期：registry 形态（已重钉） |
| agent-create-model.spec.ts:192 | 创建弹窗：两级菜单不被底栏压住、不越出弹窗体（几何） | {"x": 514.2000122070312, "y": 305.4756164550781, "width": 215.5999755859375, "height": 175.236267... | {"x": 512, "y": 253.6875, "width": 220, "height": 178.8125} | 预期：registry 形态（已重钉） |
| agent-create-model.spec.ts:228 | 模型很多：选过运行时后菜单不越出裁剪盒，首行可点，40 行一个不少 | {"x": 514.2000122070312, "y": 292.41998291015625, "width": 215.5999755859375, "height": 188.16003... | {"x": 512, "y": 240.5, "width": 220, "height": 192} | 预期：registry 形态（已重钉） |
| agent-create-model.spec.ts:229 | 模型很多：选过运行时后菜单不越出裁剪盒，首行可点，40 行一个不少 | {"x": 496, "y": 197.5, "width": 448, "height": 337} | {"x": 512, "y": 226.5, "width": 416, "height": 246} | 预期：registry 形态（已重钉） |
| agent-detail.spec.ts:165 | 概览：两级菜单贴触发钮右缘且在内容列内（几何） | {"x": 456, "y": 44, "width": 768, "height": 613} | {"x": 456, "y": 44, "width": 768, "height": 612} | 预期：registry 形态（已重钉） |
| agent-detail.spec.ts:178 | 概览：两级菜单贴触发钮右缘且在内容列内（几何） | {"x": 1022.421875, "y": 453, "width": 184.578125, "height": 32} | {"x": 1023.421875, "y": 455, "width": 184.578125, "height": 32} | 预期：registry 形态（已重钉） |
| agent-detail.spec.ts:179 | 概览：两级菜单贴触发钮右缘且在内容列内（几何） | {"x": 987, "y": 493, "width": 220, "height": 57.5} | {"x": 988, "y": 495, "width": 220, "height": 56.5625} | 预期：registry 形态（已重钉） |
| agent-detail.spec.ts:631 | 记忆/权限卡：首行不吃卡的上圆角与描边（无方角外溢、无 2px 顶边） | {"topLeft": ["11px", "11px"], "topBorder": "0px"} | {"topLeft": ["14px", "14px"], "topBorder": "0px"} | 预期：registry 形态（已重钉） |
| agent-identity-chip.spec.ts:55 | F-E1/E2/E10: 头像+名字并排成链，href 指 Agent 设置页，几何 canon 不漂移 | {"x": 1262.287841796875, "y": 202.15625, "width": 24, "height": 24} | {"x": 1040, "y": 202.15625, "width": 24, "height": 24} | 预期：registry 形态（已重钉） |
| dialog-viewport.spec.ts:38 | accept(34): 取消/完成在视口 | {"x": 180.7570037841797, "y": 180.23252868652344, "width": 438.48597717285156, "height": 139.5349... | {"x": 176, "y": 154.21875, "width": 448, "height": 191.5625} | 预期：registry 形态（已重钉） |
| dialog-viewport.spec.ts:38 | charter: 取消/保存章程在视口 | {"x": 186.409423828125, "y": 133.66941833496094, "width": 427.18115234375, "height": 232.66114807... | {"x": 176, "y": 103.5, "width": 448, "height": 293} | 预期：registry 形态（已重钉） |
| dialog-viewport.spec.ts:38 | chief-agent 列表态(无按钮读面)面板整体不越视口 | {"x": 184.72836303710938, "y": 171.19520568847656, "width": 430.5432434082031, "height": 157.6095... | {"x": 176, "y": 160, "width": 448, "height": 180} | 预期：registry 形态（已重钉） |
| dialog-viewport.spec.ts:38 | create-agent: submit 在视口 | {"x": 184.7162322998047, "y": 105.35621643066406, "width": 430.56752014160156, "height": 289.2875... | {"x": 176, "y": 107.5, "width": 448, "height": 285} | 预期：registry 形态（已重钉） |
| dialog-viewport.spec.ts:38 | secret: 静态表单面 submit 在视口 | {"x": 186.40687561035156, "y": 37.83718490600586, "width": 427.18626403808594, "height": 424.3256... | {"x": 176, "y": 24, "width": 448, "height": 452} | 预期：registry 形态（已重钉） |
| dialog-viewport.spec.ts:74 | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 | {"x": 192, "y": 428, "width": 416, "height": 32} | {"x": 486, "y": 412, "width": 106, "height": 32} | 预期：registry 形态（已重钉） |
| dialog-viewport.spec.ts:78 | provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移 | {"x": 192, "y": 428, "width": 416, "height": 32} | {"x": 486, "y": 412, "width": 106, "height": 32} | 预期：registry 形态（已重钉） |
| dialog-viewport.spec.ts:145 | branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常 | {"x": 182.61627197265625, "y": 28.607765197753906, "width": 434.7674560546875, "height": 302.7844... | {"x": 176, "y": 24, "width": 448, "height": 312} | 预期：registry 形态（已重钉） |
| overlay-focus.spec.ts:21 | click + key on 新建任务/topbar buttons: never the UA blue bo | {"cls": "group/button inline-flex shrink-0 items-center justify-center border border-transparent ... | {"cls": "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-t... | 预期：registry 形态（已重钉） |

## 退役探针（before 有 after 无）

- accent-typo.spec.ts:51 headline tier 600 holds (dark)
- accent-typo.spec.ts:51 headline tier 600 holds (light)
- accent-typo.spec.ts:61 sidebar header carries the Pacman brand mark + name (dark)
- accent-typo.spec.ts:61 sidebar header carries the Pacman brand mark + name (light)
- accent-typo.spec.ts:92 resources back chevron hover shows no background change (dark)
- accent-typo.spec.ts:92 resources back chevron hover shows no background change (light)
- accent-typo.spec.ts:108 the sidebar collapse toggle shows no hover face (dark)
- accent-typo.spec.ts:108 the sidebar collapse toggle shows no hover face (light)
- accent-typo.spec.ts:136 the sidebar toggles hold face and geometry while pressed (dark)
- accent-typo.spec.ts:136 the sidebar toggles hold face and geometry while pressed (light)
- accent-typo.spec.ts:156 the sidebar toggles hold face and geometry while pressed (dark)
- accent-typo.spec.ts:156 the sidebar toggles hold face and geometry while pressed (light)
- accent-typo.spec.ts:194 resources back chevron keeps a keyboard focus ring (dark)
- accent-typo.spec.ts:194 resources back chevron keeps a keyboard focus ring (light)
- accent-typo.spec.ts:210 P4 row hover rides accent-soft, delete row rides danger-soft (dark)
- accent-typo.spec.ts:210 P4 row hover rides accent-soft, delete row rides danger-soft (light)
- accent-typo.spec.ts:210 P5 danger: destructive resolves and reads on card, passes 4.5 (dark)
- accent-typo.spec.ts:210 P5 danger: destructive resolves and reads on card, passes 4.5 (light)
- accent-typo.spec.ts:210 P5 main-button pair passes 4.5 in both themes (dark)
- accent-typo.spec.ts:210 P5 main-button pair passes 4.5 in both themes (light)
- project-new-repo.spec.ts:244 the name input focus ring is the brand ring, not the UA default
- project-new-repo.spec.ts:325 a 400 localPath reason renders the error row: invalid body at localPat
- project-new-repo.spec.ts:325 a 400 localPath reason renders the error row: 不是 git 仓库
- project-new-repo.spec.ts:325 a 400 localPath reason renders the error row: 路径不存在
- project-new-repo.spec.ts:325 a 400 localPath reason renders the error row: 需要绝对路径
- segmented-controls.spec.ts:31 branch-dialog seg: hover tints Git, click swaps the tab body
- segmented-controls.spec.ts:31 chief tabs: hover tints, click swaps the view
- segmented-controls.spec.ts:31 chief tabs: indicator pill slides between chips — 150ms ease on left/t
- segmented-controls.spec.ts:31 files seg + tasks view toggle: hover tints the unselected (dark)
- segmented-controls.spec.ts:31 page-tab: selected chip keeps its fill under hover, same geometry as t
- segmented-controls.spec.ts:31 page-tab: unselected hover tints the chip — dark + light
- segmented-controls.spec.ts:31 sched freq: dark active chip reads against the container, hover tints 
- segmented-controls.spec.ts:31 team layout toggle: official ring border + hover tint + chip token
- segmented-controls.spec.ts:31 user-menu 外观 seg: hover tints, click switches the theme
- segmented-controls.spec.ts:66 page-tab: selected chip keeps its fill under hover, same geometry as t
- segmented-controls.spec.ts:83 page-tab: selected chip keeps its fill under hover, same geometry as t
- segmented-controls.spec.ts:86 page-tab: selected chip keeps its fill under hover, same geometry as t
- segmented-controls.spec.ts:91 page-tab group rides the official hairline ring (r2 24b/24c probe)
- segmented-controls.spec.ts:199 team layout toggle: official ring border + hover tint + chip token
- segmented-controls.spec.ts:244 chief tabs: indicator pill slides between chips — 150ms ease on left/t
- segmented-controls.spec.ts:258 chief tabs: indicator pill slides between chips — 150ms ease on left/t
- segmented-controls.spec.ts:265 chief tabs: indicator pill slides between chips — 150ms ease on left/t
- segmented-controls.spec.ts:322 chief tabs: reduced motion freezes the pill slide (#644)

## 新增探针（after 有 before 无）

- accent-typo.spec.ts:56 empty-state headline rides the registry EmptyTitle tier (dark)
- accent-typo.spec.ts:56 empty-state headline rides the registry EmptyTitle tier (light)
- accent-typo.spec.ts:66 sidebar header carries the Pacman brand mark + name (dark)
- accent-typo.spec.ts:66 sidebar header carries the Pacman brand mark + name (light)
- accent-typo.spec.ts:97 resources back chevron hover shows no background change (dark)
- accent-typo.spec.ts:97 resources back chevron hover shows no background change (light)
- accent-typo.spec.ts:113 the sidebar collapse toggle shows no hover face (dark)
- accent-typo.spec.ts:113 the sidebar collapse toggle shows no hover face (light)
- accent-typo.spec.ts:141 the sidebar toggles hold face and geometry while pressed (dark)
- accent-typo.spec.ts:141 the sidebar toggles hold face and geometry while pressed (light)
- accent-typo.spec.ts:161 the sidebar toggles hold face and geometry while pressed (dark)
- accent-typo.spec.ts:161 the sidebar toggles hold face and geometry while pressed (light)
- accent-typo.spec.ts:199 resources back chevron keeps a keyboard focus ring (dark)
- accent-typo.spec.ts:199 resources back chevron keeps a keyboard focus ring (light)
- accent-typo.spec.ts:215 P4 row hover rides accent-soft, delete row rides danger-soft (dark)
- accent-typo.spec.ts:215 P4 row hover rides accent-soft, delete row rides danger-soft (light)
- accent-typo.spec.ts:215 P5 danger: destructive resolves and reads on card, passes 4.5 (dark)
- accent-typo.spec.ts:215 P5 danger: destructive resolves and reads on card, passes 4.5 (light)
- accent-typo.spec.ts:215 P5 main-button pair passes 4.5 in both themes (dark)
- accent-typo.spec.ts:215 P5 main-button pair passes 4.5 in both themes (light)
- project-new-repo.spec.ts:249 the name input focus ring is the registry ring, not the UA default
- project-new-repo.spec.ts:330 a 400 localPath reason renders the error row: invalid body at localPat
- project-new-repo.spec.ts:330 a 400 localPath reason renders the error row: 不是 git 仓库
- project-new-repo.spec.ts:330 a 400 localPath reason renders the error row: 路径不存在
- project-new-repo.spec.ts:330 a 400 localPath reason renders the error row: 需要绝对路径
- segmented-controls.spec.ts:52 files seg + tasks view toggle: hover steps the unselected ink (dark)
- segmented-controls.spec.ts:52 page-tab: selected chip keeps its fill under hover, same geometry as t
- segmented-controls.spec.ts:52 page-tab: unselected hover steps the chip ink — dark + light
- segmented-controls.spec.ts:52 sched freq: dark active chip reads against the container, hover steps 
- segmented-controls.spec.ts:75 branch-dialog seg: hover tints Git, click swaps the tab body
- segmented-controls.spec.ts:75 chief tabs: hover tints, click swaps the view
- segmented-controls.spec.ts:75 chief tabs: indicator pill slides between chips — 150ms ease on left/t
- segmented-controls.spec.ts:75 page-tab: unselected hover steps the chip ink — dark + light
- segmented-controls.spec.ts:75 sched freq: dark active chip reads against the container, hover steps 
- segmented-controls.spec.ts:75 team layout toggle: official ring border + hover tint + chip token
- segmented-controls.spec.ts:75 user-menu 外观 seg: hover tints, click switches the theme
- segmented-controls.spec.ts:114 page-tab: selected chip keeps its fill under hover, same geometry as t
- segmented-controls.spec.ts:131 page-tab: selected chip keeps its fill under hover, same geometry as t
- segmented-controls.spec.ts:134 page-tab: selected chip keeps its fill under hover, same geometry as t
- segmented-controls.spec.ts:141 page-tab group rides the registry TabsList form (bg-muted, 32px, 3px i
- segmented-controls.spec.ts:255 team layout toggle: official ring border + hover tint + chip token
- segmented-controls.spec.ts:300 chief tabs: indicator pill slides between chips — 150ms ease on left/t
- segmented-controls.spec.ts:314 chief tabs: indicator pill slides between chips — 150ms ease on left/t
- segmented-controls.spec.ts:321 chief tabs: indicator pill slides between chips — 150ms ease on left/t
- segmented-controls.spec.ts:378 chief tabs: reduced motion freezes the pill slide (#644)

## 结论

after 账 DRIFT 0 / VIOLATION 0：全部视觉断言的 spec 内基线 = 实测值。上表值变化逐条对应 #983/#982 判决的 registry 形态（Tabs 默认档 / Card ring 面 / Popover·Dialog 件默认 / Empty 件族 / registry token 词汇），无疑似回归；退役探针 = 手写皮肤档的断言面（#138 发丝环 hover tint、--active 状态类、品牌 focus 环配方），新增探针 = 重钉后的 registry 载体钉点。
