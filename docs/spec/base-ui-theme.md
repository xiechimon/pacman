# Base UI 主题：黑白骨架 + 手作动效 + Herdr 紫（V2 方向落仓）

> 状态：spec 待施工。前身作废票 #782（只换色不动几何，范围写错，用户已关）。
> 用户原话（2026-10-04，三遍一致）：V2 方向是黑白骨架加手作动效加主题色，不只是换个颜色。
> 主题色用 Herdr 紫那对：亮底米色纸加深紫、暗底暖黑加浅紫。
> 输入材料正本：`library/t-accent-prototype/`（README + `accent-compare-prototype.html`
> + `HERDR-THEME-TOKENS.md`，2026-10-04 从 herdr.dev CSS 直接拉取）与
> `library/t-0068-prototype/`（V2 骨架与动效来源，Base UI 文档正典 demo）。
> 本 spec 只回答「落仓成什么样」；施工与验收拆票见 §6。

## 0. 失败方式清单（先列再施工，仓内纪律）

动任何一块之前，执行票必须先把对应的失败方式写成该票的验收否决项：

| # | 失败方式 | 护栏 |
|---|---|---|
| F1 | token 值翻转但视觉 spec 基线没重拍：全站视觉 spec 变红，施工者逐条 `--update-snapshots` 蒙混过关，把真回归也洗成新基线 | 每个含视觉变更的 PR 先贴受影响 spec 清单，重拍前后各跑一次 `e2e:affected`，diff 逐条说明（见 §5.3） |
| F2 | 暗色 destructive 配白字出货：`#ffffff` on `#e05a5a` 实测只有 3.63:1 | `--destructive-foreground` 暗侧必须是深字（§2.1），T-accept 对比度门逐对重测 |
| F3 | 亮色 pick 选中行按原型 14% tint 配亮紫字出货：实测 3.50:1，大幅低于 4.5 | 亮侧选中对按 §2.5 的加深紫方案（4.59:1），不许直抄原型值 |
| F4 | herdr `faint` 系被当正文色用：亮侧 `#86826f` 在纸面上只有 3.27:1 | faint/faint2 在本仓只许做装饰（边框、占位、非文本图标），正文 ramp 见 §2.4 的刻意偏离 |
| F5 | 手作动效与 tw 默认打架：同一弹层同时跑 `animate-in` 和手写 keyframe，进出场叠成双份 | 手作只许以「覆写值」形态落在已迁移面（§1.2），单面单机制，grep 可复核 |
| F6 | 圆角清零 silently 打断几何钉扎：checkbox 18px→16px、弹层 radius 10px→0，`checkbox-unified` / `visual-polish` 等断言静默失效 | 每个骨架 PR 列出触碰的几何断言并同步更新，禁止只改 CSS 不改 spec（§5.2） |
| F7 | 状态色与新 spot 色相撞：chip-plan 之外的某处把紫色同时当品牌和状态用，用户分不清「可点」和「计划中」 | 15° 规则（§2.5）：与 spot 同 hue ±15° 的槽一律回 spot 族，其余状态色保留 |
| F8 | 主题切换整页 smear：颜色/背景/边框/阴影上的 transition 在 `.light` 翻转时齐爆 | 凡动 token 值的 PR 必须带主题切换抑制（better-ui recipe，`transition:none` + reflow + 下帧恢复），`theme-toggle.spec` 覆盖 |
| F9 | fixture 基线拍到别的车道的栈：`reuseExistingServer` + 端口相撞导致证据拍成别人的构建 | 选口在开跑前一刻 `lsof` 复查（实锤先例），撞口换口重跑，该轮结果作废 |

## 1. 范围：三件各到什么深度

### 1.1 骨架：从现行换到黑白骨架的面

骨架 = V2 原型 `html[data-v="v2"]` 那套几何与结构语言，原型行号指
`accent-compare-prototype.html`。分两批，第一批是原型已钉死的面，第二批是同方向・值待面票实测：

第一批（原型有 exact 值，直接落仓）：

- 复选 tile：18px 方角 4px 圆角 → **16px、圆角 0、1px 墨线框**（原型 L321–329）。
  关态透明底（面板色底）+ 墨线框；开态翻主题色实底 + 主题色字勾（原型 L337–341，
  H 档即主题色填充，不是黑白反相）。hover 未勾选框描边提示可点（L342）。
  现行 `checkbox.css` 的 `--card-button` 实底 + 白勾语义保留，只是换值与几何。
- 按钮：高 32px、圆角 0、14px/400（L344–352）。主按钮主题色实底 + 主题色字，
  hover `brightness(1.07)`（L365，不降透明度）；次按钮面板底 + 墨线框，
  hover 走 hover-token、press 走 active-token（L353–359）。
- 弹层壳：12px 内边距、1px 墨线框、圆角 0、顶部锚距 8px、最小宽 220px（现行
  220px 弹层宽度不变，L373–380），带 12×6 描边 Arrow（原型 L371）。
- 行 hover：一律跟主题色走——行与更多钮吃主题色淡 tint（`accent-soft` =
  `color-mix(in srgb, spot 14%, transparent)`，原型 L103），主按钮保持实色；
  删除行吃 danger 淡 tint（原型 README §操作）。

第二批（同方向，值由面票从原型方法复测，不许拍脑袋）：

- 看板卡片、侧栏行、chief 抽屉、detail 面、pages 面：骨架语言一致（墨线框、
  方角、主题色 hover tint），但这些面的几何被 e2e 几何钉扎锁着
  （18px tile、220px 弹层、12px 圆角等），逐面迁移 + 逐面重审钉扎。
- 用户原话已接受与 todos.dev 脱钩（t-0068 README 代价列明：放弃复刻纪律与
  像素纪律）。几何钉扎不是冻结不让改，是改了必须同步改断言（F6）。

不碰的面：`--radius` 基与卡片圆角不在第一批动；board 列宽 token、z 阶梯、
字体栈与本 spec 无关。

### 1.2 动效：手作哪些，与 motion.css / ADR 0009 是什么关系

先写清关系，再列手作清单。

**关系一句话：手作动效是 ADR 0009 默认档在已迁移面上的有界覆写，不是第二套系统。**
ADR 0009（方向 B，全站进出场收敛 shadcn/tw-animate-css 默认）继续有效：
未迁移的面一切照旧（dialog `zoom-in-95`、dropdown/popover `duration-100` +
slide -8px、挂载淡入 tw 默认档，ADR D3 追认值不变）。已迁移的面把其中与
V2 骨架冲突的**值**换成原型 exact 值，机制仍是单套（transition 语义、
可中途打断，better-ui 律），落点与 motion.css D4 保留面（tab 指示条滑动、
hover/press tint、`prefers-reduced-motion` 全站降级律）并存。
验收形态：单面单机制——任一已迁移面 grep 到 `animate-in` 与手写 keyframe
并存即红（F5）。

手作清单（全部来自原型，有 exact 值；生产形态由面票定 transition 写法，
better-ui 律：交互态变化用 transition，不用一次性 keyframe）：

- 勾选入场：底色 100ms ease-out 反相 + 勾 scale .5→1 微 overshoot 140ms，
  曲线 `cubic-bezier(0.34, 1.4, 0.64, 1)`（原型 L796）；取消：勾缩退 90ms +
  底色回翻 100ms（L802–806）。复选行 press：tile 缩 0.92，80ms ease-out（L330）。
- 弹层进出场：scale .98 + fade，100ms ease-out，origin 随锚位（L371，Base UI
  文档正典值）。已迁移的 overlay 面用它**替代** ADR D3 的 slide -8px。
- 焦点环：2px 实线 + offset 2（复选 tile，L331–334；沿用仓内 #388 家族律，
  颜色换 `--focus-ring` 新值）；弹层内按钮环 offset -1（L366–368）。
- 主题切换抑制：换肤 PR 必带（better-ui recipe：`transition:none` 注入 +
  reflow + 下帧恢复），F8。

「动效不是 Base UI 给的」仍成立（t-0068 README §事实）：库只给
`data-open` / `data-starting-style` / `data-ending-style` 钩子，CSS 全手写。
本仓 checkbox 已迁 Base UI 官方件（#690），钩子现成，手作值直接落上去。

动效证据按既有纪律走 GIF（用户 2026-10-03 定：动效类改动验收证据必须含
GIF，before/after 各一条；做法照抄 t-0041：动画全 paused +
`__motionScrub(t)` 手动 scrub → 逐帧截图 → ffmpeg 合成；PR body 走 raw
永久链内嵌）。静态图只作补充。

### 1.3 主题色：Herdr 紫进哪些 token，用 H 档 exact 值

只用 H 档（Herdr 真值），A–D 自定档是原型过程资产，不落仓：

- 亮：纸面 `#efece5` + 主钮紫 `#8839ef` + 白字（5.41:1，复测一致）。
- 暗：暖黑底 `#17171a` + 主钮紫 `#cba6f7` + 深字 `#17171a`（8.81:1，复测一致；
  原型标注 8.8，复测 8.81，采用复测值）。

紫只进三类槽（原型 README §各档是什么：主行动按钮「完成」与勾选态复选框，
边框/文字/投影保持黑白）：

1. 主行动实底：`--card-button`（亮 `#8839ef` / 暗 `#cba6f7`）。
2. 焦点环：`--focus-ring`（同上两值；现行与 `--card-button` 同值关系保持）。
3. 勾选态 tile 填充 + 选中行文字：经 `--brand` / `--brand-fg` 语义（§2.5 派生规则）。

danger 另起红系（原型已修掉旧 V2「danger 吃白色」缺陷）：亮 `#c73e3e`、
暗 `#e05a5a`，均为 herdr 真值。注意暗侧红底**不许配白字**（3.63:1，F2），
`--destructive-foreground` 暗侧翻深字，见 §2.1。

`--spot-ink` 语义（herdr 站房：亮白字 / 暗底字）由 `--text-on-accent`
承接：亮 `#ffffff`、暗 `#17171a`。

## 2. Token 映射表：原型值 → 仓内槽位

记法：每行一槽，来源标记三档——[真值]（herdr.dev 站点 mode 层或原型 exact 值，
逐字采用）、[派生]（按本节规则算出，附实测对比度）、[保留]（现行值不动，
附不动的理由）。凡标[派生]/[保留]的槽，面票仍须按 §5.1 重测一遍才算落地。

主题机制不变：`:root` = 暗默认，根元素 `.light` = 浅色镜像（`theme.ts`，
localStorage `pacman-theme` + `data-theme` 镜像）；记法沿用 hex/rgb
（shadcn.css 头注：e2e 值探针按 rgb 解析）。

### 2.1 官方语义槽（`--background` 系 + `--primary` 系 + `--destructive` 系）

暗侧（`:root`）：

| 槽 | 新值 | 来源 |
|---|---|---|
| `--background` | `#17171a` | [真值] ink bg |
| `--foreground` | `#eae8ee` | [真值] ink |
| `--card` / `--popover` | `#1e1e22` | [真值] panel/pop |
| `--card-foreground` / `--popover-foreground` | `#eae8ee` | [真值] |
| `--primary` / `--primary-foreground` | `#e5e5e5` / `#171717` | [保留] 中性实底角色，V2 无对应，非品牌槽 |
| `--secondary` / `--secondary-foreground` | `#26262b` / `#eae8ee` | [真值] line 色兼 sedentary 填充 |
| `--muted` | `#26262b` | [真值] mass |
| `--muted-foreground` | `#b0afb6` | [真值] faint，8.22:1，正文通过 |
| `--accent` / `--accent-foreground` | `#26262b` / `#eae8ee` | [真值] 原型 hover |
| `--destructive` | `#e05a5a` | [真值] H 暗红 |
| `--destructive-foreground` | `#17171a` | [派生] 4.92:1；白字只有 3.63:1，**暗侧必须翻深**（F2）。现行两主题同白字的惯例就此断裂 |
| `--border` | `#26262b` | [真值] line，alpha 写法实色化 |
| `--input` | `#35353d` | [真值] line2 |
| `--ring` | `#908f96` | [派生] faint2，5.58:1，环按 3:1 验收通过 |

亮侧（`.light`）：

| 槽 | 新值 | 来源 |
|---|---|---|
| `--background` | `#efece5` | [真值] paper |
| `--foreground` | `#15140f` | [真值] ink |
| `--card` / `--popover` | `#e7e3da` | [真值] panel/pop（卡片与纸面只差一档，跟 herdr 站房同取舍） |
| `--card-foreground` / `--popover-foreground` | `#15140f` | [真值] |
| `--primary` / `--primary-foreground` | `#171717` / `#fafafa` | [保留] 同暗侧理由 |
| `--secondary` / `--secondary-foreground` | `#e7e3da` / `#15140f` | [真值] panel |
| `--muted` | `#ddd8cc` | [真值] mass |
| `--muted-foreground` | `#55534a` | [真值] dim，6.54:1 |
| `--accent` / `--accent-foreground` | `#e2ded4` / `#15140f` | [真值] 原型 hover |
| `--destructive` | `#c73e3e` | [真值] H 亮红 |
| `--destructive-foreground` | `#ffffff` | [派生] 5.02:1 |
| `--border` | `#e2ded4` | [真值] line |
| `--input` | `#cbc5b6` | [真值] line2 |
| `--ring` | `#86826f` | [派生] faint，3.27:1——环按 3:1 验收刚过，面票重测，不通过则退 dim（F4 相关） |

### 2.2 surface / text / 缝线族（补位族，同源压缩）

herdr 中性阶只有三档（底/面板/团块）加两档线，現行五档 surface ramp 按此压缩，
多余阶做别名，不许自创第四档灰：

| 槽 | 暗 | 亮 | 来源 |
|---|---|---|---|
| `--surface` | `#1e1e22` | `#e7e3da` | [真值] panel |
| `--surface-secondary` | `#26262b` | `#ddd8cc` | [真值] 暗=line 兼填充 / 亮=mass |
| `--surface-tertiary` | `#35353d` | `#ddd8cc`（别名，与 secondary 同值） | [真值] 暗=原型 active / 亮=herdr 无第四阶，并阶 |
| `--surface-elevated` | `#1e1e22`（别名，与 surface 同值） | `#e7e3da`（别名） | 并阶，理由同上 |
| `--surface-hover` | `#26262b` | `#e2ded4` | [真值] 原型 hover 两值 |
| `--surface-press` | `#35353d` | `#ddd8cc` | [真值] 原型 active 两值 |
| `--column` / `--col-bg` | `#17171a`（== background，保持现行关系） | `#efece5`（== background） | [真值] 关系保持 |
| `--border-default` | `#26262b` | `#e2ded4` | [真值] 两档 line |
| `--border-strong` | `#35353d` | `#cbc5b6` | [真值] 两档 line2 |
| `--sidebar-hover` / `--sidebar-active` / `--seg-hover` | 不动（ink alpha 梯 5%/10%，自适应） | 同左（warm-ink alpha 梯） | [保留] 机制自适应底色 |
| `--text-on-accent` / `--toggle-knob` / `--overlay-scrim` | `#17171a` / `#ffffff` / `rgb(0 0 0/0.6)` | `#ffffff` / `#ffffff` / `rgb(0 0 0/0.6)` | [真值] spot-ink 语义；knob/scrim 主题不变 |

### 2.3 品牌与焦点（§1.3 的三类槽）

| 槽 | 暗 | 亮 | 来源 |
|---|---|---|---|
| `--card-button` | `#cba6f7` | `#8839ef` | [真值] 两档 spot |
| `--focus-ring` | `#cba6f7` | `#8839ef` | [真值] 与卡按钮同值关系保持 |
| `--text-on-accent` | `#17171a`（8.81:1） | `#ffffff`（5.41:1） | [真值] 复测值 |
| `--drop-tint-border` / `-base` / `-hover` | `#cba6f7` 实色边 + `color-mix(spot 5%/10%)` | `#8839ef` 实色边 + `color-mix(spot 5%/10%)` | [派生] 只换色相，5%/10% 两档比例沿现行 |

### 2.4 正文 ramp：一次刻意的偏离（better-colors 实测结论）

herdr 自家的 `faint` 在亮纸面上只有 3.27:1（faint2 约 3.15:1），在 herdr 站房里
它们只做装饰。照抄进正文 ramp 会批量制造 F4。裁定：

- 暗侧采用 herdr 全套：`--text-secondary` → dim `#cdccd2`（11.21:1），
  `--text-tertiary` → faint `#b0afb6`（8.22:1），`--text-dim` → faint2
  `#908f96`（5.58:1，仅装饰：时间戳/占位/非活动图标，沿 XMON-55 口径）。
- 亮侧**保留现行 warm ramp**：`--text-secondary` `#44403c`（纸面约 8.8:1）、
  `--text-tertiary` `#57534e`（复测 6.47:1）、`--text-dim` `#a8a29e`（仅装饰）。
  理由：现行值全部通过且与纸面暖调同源，换 herdr dim（6.54:1）是降级，
  换 faint 是违规。herdr faint 系在亮侧只许进装饰位（`--ring` 看 §2.1 末行）。
- `--col-head-text`：暗 → dim `#cdccd2`；亮保留 `#57534e`（6.47:1）。
- `--menu-icon`：亮保留 `#1c1917`；暗保留 `#71717a`——新面板上 3.44:1，
  按**非文本 3:1**验收（图标不是正文），面票注明口径。

### 2.5 选中/计划/徽标族：15° 规则（better-colors one color one meaning）

spot 紫 hue 约 270°。凡与 spot 差 ±15° 以内的槽（现行 indigo 族）一律回
spot 族；蓝绿橙红状态槽（色相差 >15°）全部保留——紫只许表示「品牌/可点」，
状态另有其色（F7）：

回 spot 族（`--brand`/`--brand-fg` 语义承载）：`--chip-plan-bg/fg`、
`--tile-indigo-bg/fg`、`--overlay-select-indigo`、`--pick-selected-bg/fg`、
`--indigo-500`/`--indigo-600`（品牌字形用途）、`--notify-icon-bg` + 其上字形、
`--primary-disabled` / `--indigo-disabled` / `--indigo-disabled-fg`
（spot 按底色 mix 降级，精确比由面票实测钉死，失能态不按 4.5 验收但须可辨）。

选中对 exact 值（已实测，面票复测）：

- 暗：底 = spot 14% mix 于 panel（≈`#363140`），字 `#cba6f7`，6.19:1。
- 亮：底 = spot 14% mix 于 panel，字取加深紫 `#6d28d9`，4.59:1。
  注意：亮侧若用 spot 原色做字只有 3.50:1（F3），**加深一档是强制项**，
  不是可选打磨。该槽是「tint 底上的字」专用阶，命名须含角色
  （如 `--spot-text-on-tint`），不许复用 `--card-button` 顶替。

保留（状态语义）：`--col-dot-*` 四槽、`--badge-*` 三槽、`--chip-confirm/done/failed`
及 `--tile-orange/hero`、`--diff-*`、`--fail-fg`、`--project-avatar-*`
（`#e97b35` 头像身份色）、palette 原语 `--blue/amber/green/rose/gray-500`、
`--stop`（与 destructive 同色相不同明度是现行双红并存，延续并在票据注明）。

### 2.6 浮层/对话框/行级槽：对齐到线与团块

| 槽 | 暗 | 亮 | 来源 |
|---|---|---|---|
| `--dialog-bg` / `--dialog-box-bg` | `#1e1e22`（box 沿 panel + 边框，保持现行关系） | `#e7e3da`（同左） | [真值] |
| `--dialog-ring` | `#35353d` | `#cbc5b6` | [真值] line2 |
| `--dialog-row-bg` | `#26262b`（mass，落在 panel dialog 上可见） | `#ddd8cc`（同左） | [派生] 关系保持 |
| `--row-selected` | `#26262b` | `#e2ded4`（== hover，选中即 hover 上限） | [真值] |
| `--row-icon-bg` | `#35353d` | `#ddd8cc` | [真值] mass 系 |
| `--overlay-divider` | `#26262b` | `#e2ded4` | [真值] line |
| `--range-chip-bg` / `-border` | `#26262b` / `#35353d` | `#e7e3da` / `#cbc5b6` | [对齐] |
| `--pill-idle-bg` | `#26262b` | `#ddd8cc` | [对齐] mass |
| `--dash-border` | `#35353d` | `#cbc5b6` | [真值] line2（虚线 add-machine 边框） |
| `--toggle-track` | `#35353d`（panel 上可见） | `#cbc5b6`（同左） | [派生] |
| `--chief-tab-bg` / `-active` | `#26262b` / `#35353d` | `#ddd8cc`（strip） / `#e7e3da`（active pill，方向沿现行：pill 浅于 strip） | [真值+关系] |
| `--seg-active` | `#35353d` | `#ddd8cc` | [真值] 原型 active |
| `--tab-chip-bg` | `#1e1e22` | `#e7e3da` | [真值] panel（落在 mass 组底上） |
| `--agent-avatar-bg` | `#26262b`（== chip-idle-bg，关系保持） | `#e7e3da`（同左） | [对齐] |
| `--chip-idle-bg` / `-fg` | `#26262b` / `#9ea3ae`（保留，面票按 4.5 复测） | `#e7e3da` / `#4d5562`（保留，面票复测） | [对齐+保留] |
| `--notify-icon-bg` | `#35353d`，字形走 spot `#cba6f7` | spot 14% tint，字形 `#8839ef` | [派生] 面票复测非文本 3:1 |

### 2.7 阴影/圆角/动效 token（better-ui 落仓口径）

用户选的是 Herdr 那对，不是 V2 通用档——阴影采用 H 档的柔和投影，
**不用** V2 通用 `4px 4px 0` 硬投影：

- 亮：卡片 `0 1px 2px rgb(26 26 24/0.08)`，弹层 `0 8px 24px rgb(26 26 24/0.16)`
 （H 亮真值）。暗：无投影，线框承重（H 暗真值）。
- `--edge-ring` 机制保留（inset spread ring，颜色跟 `--border-default` 走，
  自动适配；小数 zoom 下不断线，已是既有结论）。
- `--drag-shadow` 形状保留（`0 8px 24px`，参考站配方），颜色亮侧换
  `rgb(26 26 24/0.18)`，暗侧保留黑 tons（panel 上黑影弱，面票实物确认）。
  `--chief-shadow` 并入弹层 tier。`--fab-shadow` 仍是 `--edge-shadow` 别名。
- 圆角：第一批迁移面（复选 tile、弹层壳、面内主/次按钮）圆角清零；
  `--radius` 基与卡片圆角不动，等第二批面票逐面决定（默认跟 V2 归零，
  每面须经视觉 spec 重审）。同心圆角律（better-ui：外 = 内 + padding）
  在嵌套弹层上逐面核对。
- 动效 token：`--dur-fast` 150ms 与 tw 默认同值，保留；`--dur-overlay` 200ms
  → 收敛 150ms（ADR D3 挂载淡入归默认档）；easing 三档保留。
  手作值（140ms overshoot 曲线、100ms ease-out、brightness(1.07)）以面作用域
  token/类形态与 D4 保留面共处 `motion.css`，不另起文件（单系统可 grep）。

`taste` skill 结论：HERDR-THEME-TOKENS.md 即 2026-10-04 从 herdr.dev
`style.css` + `site.css` 直接拉取的 mode 层真值（一手 token 反推已完成），
无超出该表的面需要再跑浏览器反推。本 spec 不再为 taste 留票。

## 3. 迁移顺序：token 层先行，按面随后，每步可独立合

token 是全局单源（`shadcn.css` 唯一持值，`tokens.css` 只做别名），按面拆
token 会分叉系统——所以顺序是「一次 token 翻转 + N 个面骨架」，不是逐面
自带 token。每步独立合的含义：每步自带 `e2e:affected` + 视觉基线重拍，
合后 main 随时可发。

| 步 | 内容 | 为何在这 | 独立合形态 |
|---|---|---|---|
| P0 | 基建：新增 `--spot-text-on-tint`（亮 `#6d28d9`）、`accent-soft`（spot 14% mix）语义槽、失能 mix 规则、主题切换抑制工具 | 无视觉变化，后续步的前置名 | token 加法 PR，零视觉 diff |
| P1 | token 值翻转：§2 全表落 `shadcn.css`（`.light` 镜像同步），别名层零改动 | 单源翻转，一次把颜色账算清；骨架几何本步不动，漂移面最小 | 全站变色 PR + 全量视觉基线重拍（§5.3），`e2e:affected` 回落全量（共享面） |
| P2 | 复选骨架：16px/圆角0/墨线框 + 开态主题色填充 + 勾选 140ms/取消 90ms 手作 + press 缩放 | 原型钉死最牢的面；checkbox 已是 Base UI 官方件（#690），钩子现成 | `checkbox-unified` + 视觉 spec 同步更新 |
| P3 | 弹层骨架：12px 内边距/墨线/圆角0/Arrow + 进场 scale.98+fade 100ms（替代 slide） | B1 弹层壳是 spec 16 既定先行面，同批人马顺手收 | overlay 系 spec + dialog-viewport 钉扎复审 |
| P4 | 行 hover/按钮：accent-soft tint、主钮 brightness(1.07)、次钮 hover/active token | 纯 token 消费，无几何变更，最易回滚 | hover 系 spec（card-press 等） |
| P5 | danger/焦点/环：红系两值 + 暗侧深字翻转 + `--ring` 两值 + 切换抑制 | 语义最重（可点性/危险操作），单独一票便于 revert | overlay-focus + brand-typo（改名见 §5.2） |
| P6 | 第二批面收口：board 卡片、侧栏、chief、detail、pages 骨架 + 圆角归零 | 体量与钉扎密度最大（spec 16 B4 同理最多两条车道），放最后 | 按面拆 2–3 票，可并行（错域），禁同文件配对（preferences §收口顺序） |
| P7 | 总验收：§5 全项 + fixture 基线封版 | 收尾票，不接受「下次再测」 | 绿了才算完 |

P1 与 spec 16 的关系：spec 16 未合的批次若与 P1 同期在飞，以「P1 先合、
结构票 rebase 跟进」为准（颜色正本单源，跟随方适配；反向会制造双正本）。

## 4. 与现行 Indigo 品牌的关系：直接切，不双轨

- 断。`--card-button`/`--focus-ring` 从 `#4e47dd` 直接换两档 spot 紫，
  无过渡期、无双轨、无 compat shim。理由：主题机制是单 `.light` 开关，
  双品牌等于把 §2 全表再 fork 一份，e2e 矩阵翻倍；原型 H 档本身已 drop
  indigo；现行 `#4e47dd` 恰是原型 A 档亮值，用户叙事是「紫从 indigo 搬到
  Herdr 紫」，连续性成立。
- 断裂点只有两处，写进 P5 票面：① `--destructive-foreground` 暗侧由白字翻
  深字（F2）；② `--pick-selected-fg` 亮侧由品牌实色改加深紫（F3）。
  其余 indigo 痕迹（chip-plan/tile-indigo 等）按 §2.5 回 spot 族，
  不留 `--indigo-*` 活引用（槽可留空值占位一版后删，或随 P1 直接删，
  面票定；消费方约 40 个文件由 P1 同 PR 切完，不许悬空）。
- `brand-typo.spec.ts` 更名（`accent-typo.spec.ts`）并更新断言，随 P5。

## 5. 验收

### 5.1 双主题对比度实测（better-colors 方法：测渲染对，不估算）

 bright用作物以 P1 落仓后的编译产物为准，下表是本 spec 已复测的门槛值，
 面票须逐对复测（容差 ±0.02，工具：本节同款相对亮度公式，双主题 × 明暗）：

文本对（≥4.5:1）：主钮字两档 5.41 / 8.81、正文两档 15.63 / 14.72、
次级字 6.54 / 11.21、 muted 两档 6.54 / 8.22、danger 字 5.02 / 4.92、
选中对 4.59（亮，加深紫方案） / 6.19（暗）、pick 现行对 5.45/5.21 作废。
非文本对（≥3:1）：`--ring` 亮 3.27（面票不通过则退 dim）、menu-icon 暗
3.44（按图标口径通过）。
装饰免测：faint 系亮侧值（3.27/3.15）只许出现在边框/占位/装饰图标，
出现在正文即红。

### 5.2 视觉 spec 更新清单

必碰：`sidebar-visual`、`visual-polish`、`theme-toggle`（加切换抑制断言）、
`brand-typo`（更名 + 换断言）、`checkbox-unified`（16px/圆角0/开态填充）、
`card-press`（press token 值）、`overlay-focus`（环色 + offset）。
可能碰（P6 按面列）：chief 系、detail 系、board 系视觉断言。
规则：改 CSS 必同 PR 改断言（F6）；`--update-snapshots` 前后各跑一次，
diff 逐条说明用途（F1）。

### 5.3 fixture 截图基线重拍计划

- 基建：fixture 构建只 1.5s（既有基线），贵的是拍摄不是构建。
- P1 合后：双主题 ×（看板 / 弹层 / 复选 / 按钮 / danger 确认 / pick 选中行）
  六组 before/after（before 取自 P1 前 main 的一次性 worktree 栈，
  不许拿旧图頂替；verify 栈 vite 热吃改动，server 不吃——before 必须在
  `origin/main` 一次性栈上跑，沿用既有纪律）。
- 动效面（P2/P3）：GIF before/after 各一条（§1.2 做法），静态图只作补充。
- 归档：`docs/verify/<票号>/` + PR body raw 永久链（SHA 从命令输出取，
  curl 到 200；Multica 通道已停，不走评论）。
- 跑法：开发期 `e2e:affected`（P1 触共享面自动回落全量），收尾全量归 CI
  四分片；本地全量 154s/617 条但多 lane 并行是内存压力源，不当日常。

## 6. 拆票清单（agent-ready，每票标题 + 一句话范围 + blocked 边）

1. `web(theme): land Herdr token values in shadcn.css (P1)` —— §2 全表翻转 + 别名零改 + 全量视觉基线重拍。blocked: P0。
2. `web(theme): add spot-soft, spot-text-on-tint, disabled-mix and theme-switch suppression (P0)` —— 新增语义槽与切换抑制工具，零视觉 diff。blocked: 无。
3. `web(theme): V2 checkbox bone 16px square plus hand-made check motion (P2)` —— tile 几何 + 开态填充 + 140/90ms 动效 + GIF 证据。blocked: #1。
4. `web(theme): V2 overlay bone plus scale-fade enter replacing slide (P3)` —— 弹层壳几何 + Arrow + 进场覆写 + 单机制 grep 验收。blocked: #1。
5. `web(theme): accent-soft row hovers, button brighten, danger reds and focus rings (P4+P5)` —— hover tint、主钮 hover、红系两值、暗侧深字翻转、环色、brand spec 更名。blocked: #1。
6. `web(theme): board/sidebar/chief/detail/pages bone convergence (P6)` —— 第二批面骨架 + 圆角归零，可再拆 2–3 面票（错域并行，禁同文件配对）。blocked: #1。
7. `web(theme): dual-theme contrast re-measure and fixture baseline seal (P7)` —— §5 全项复测 + 基线封版。blocked: #3, #4, #5, #6。

合并归协调者：spec 进 `docs/spec/` 随 PR 走，或直接落仓，票里写明。
本 spec 文件本身随首个 P 票 PR 进仓（`docs/spec/base-ui-theme.md`），
不单独开 PR。

## 附：事实源索引（取数位置，不重复抄值）

- V2 骨架 exact 值：`library/t-accent-prototype/accent-compare-prototype.html`
  L36–83（黑白骨架）、L92–103（主题色层）、L108–159（H 两档）、L316–380
  （复选/按钮/弹层几何与动效）、L772–806（WAAPI 动效引擎值）。
- Herdr 真值：同目录 `HERDR-THEME-TOKENS.md`（站点 mode 层 paper/ink +
  23 套 palette；备查，不进仓）。
- 现行正本：`apps/web/src/styles/shadcn.css`（颜色唯一持值）、
  `tokens.css`（别名 + 非颜色层）、`motion.css`（D4 保留面 + 待退役复刻值）、
  `docs/adr/0009-全站动效收敛-shadcn-默认.md`（动效关系正本）。
- 对比度：本 spec §5.1 数值由相对亮度公式复算（原型括号值 5.41/8.8/
  6.42/5.34/8.72/5.43/5.02/9.18/5.48/8.46 逐项核对一致，H 暗取复测 8.81）。
