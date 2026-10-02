# 复用清单（pacman web）

> 这份文件只回答一个问题：**要写一个新的 UI 件之前，先看这里——已有的能不能直接用。**
> 「长什么样」（颜色 / 字号 / 圆角 / 阴影 / 动效 / 各件的视觉规格）在 [DESIGN.md](./DESIGN.md)；本文件管「**有哪些、在哪、该复用谁**」。
> 三条机器门钉住它不腐烂（`test/ui-reuse-inventory.test.ts`）：新轨每件必须登记、清单里的件必须真实存在、旧轨冻结不许加件。

## 一、迁移期双轨（先看这条）

| 轨 | 位置 | 状态 |
|---|---|---|
| **新轨** | `src/components/ui/` | **新代码一律落这里。** shadcn 件 + Base UI 基（#410 裁决），带仓内偏离记录 |
| **旧轨** | `src/ui/` | 待退役的手工件（现存 `button` / `card` / `chip` / `dialog` / `input`，各带 `.css`；`avatar` / `kbd-hint` / `tag-chip` 已迁新轨，#535）。**只许删、不许加**（#417 裁决，机器门钉住） |
| 弹层族 | `src/overlay/` + `src/overlays/` | 挂在共享壳上（见第三节），**不自己手搓 OverlayMount + useEscClose** |

规矩一句话：**改已有消费点时才碰旧轨；写新件进新轨。**

<!-- inventory:old-track-frozen -->
```text
button.css
button.tsx
card.css
card.tsx
chip.css
chip.tsx
dialog.css
input.css
input.tsx
```
<!-- /inventory:old-track-frozen -->

（上面这段是机器门读的冻结名单：`src/ui/` 里出现名单外的新件即报错——迁移期的删除不报错。）

## 二、新轨原语（23）

<!-- inventory:new-track -->
```text
alert-dialog-shell.tsx   # 确认面共用底座（删除确认 / 丢草稿确认），走 Base UI AlertDialog
alert-dialog.tsx
avatar.tsx               # shadcn Avatar 三件套（Root/Image/Fallback，底座 Base UI）；头像消费别直接用三件套，走 seeded-avatar.tsx
badge.tsx                # 计数 / 标签 pill；任务状态语义色族见 DESIGN.md
button.tsx               # 三态 Primary/Ghost/Icon；仓内偏离：focus 环走仓级 #388 canon
card.tsx
checkbox.tsx             # 复选（原生 input + 自制 tile）；**别直接摆裸 `<input type="checkbox">`**——浏览器自带方框与仓内复选行不同族
dialog-shell.tsx         # 对话框共用底座（11 个消费点，API 与旧轨逐字相同）
dialog.tsx
dropdown-menu.tsx
empty.tsx
floating-shell.tsx       # 锚定浮层共用底座（plan-dropdown / chip-popover / more-menu / 用户菜单 / 排序 / chief-model-select / mention-picker）
input.tsx
kbd-hint.tsx             # 快捷键悬浮提示 chip（控件 hover/focus-visible 浮出、静息 visibility:hidden）；#468 快捷键提示一律用它
kbd.tsx                  # 按键角标原语（文档正文里的 ⌘K 角标）；悬浮提示 chip 是 kbd-hint.tsx
panel.tsx                # 静息内容容器消解（Panel/PanelHead/PanelRow/PanelLabel/PanelValue）：贴在页面里的方框一律用它；皮肤档 quiet/outlined，per-face 数值留属地 css
popover.tsx
seeded-avatar.tsx        # dicebear 种子头像适配层（src 覆盖 > name 种子 > 兜底换图，img 常驻 DOM）；头像一律用它
select.tsx               # 单选下拉（触发钮 + FloatingShell 弹层 + role=listbox）；**别再用原生 `<select>`**——它弹的是系统菜单，跟自制弹层并排就是两套弹窗
switch.tsx               # 仓内偏离：thumbClassName 适配口
tag-chip.tsx             # 用户数据色标签 chip（tag.color 走 inline style 白字）；落在 badge.tsx 上，别新建皮肤件
tabs.tsx
toaster.tsx              # toast 原语（sonner，shadcn 官方配方；#631）：App 根挂一次 <Toaster />，任意处 imperative `toast.*`；**失败反馈别再造静默 catch**——异常/toast 一律走它
```
<!-- /inventory:new-track -->

**上游重拉纪律**：`button.tsx`（#414/#423/#425 三处偏离）与 `switch.tsx`（#423 一处）记了仓内偏离，重拉 shadcn 上游时**勿丢**——丢一处就顶掉 focus 环或 per-face 几何契约，视觉 e2e 会红。

## 三、什么时候用哪个

| 要做的面 | 用什么 | 别做什么 |
|---|---|---|
| 按钮 / 图标按钮 | `components/ui/button.tsx` | 别新写 `<button>` + 自造类 |
| 输入框 | `components/ui/input.tsx` | 别沿用旧轨 `ui/input.tsx` 新起消费点 |
| 开关 | `components/ui/switch.tsx` | — |
| 标签页 | `components/ui/tabs.tsx` | — |
| 计数 / 标签 pill | `components/ui/badge.tsx`（状态色族） | 旧轨 `chip.tsx` 待退役，别加新消费 |
| 空态 | `components/ui/empty.tsx` | 别每处自写空态文案块 |
| 确认对话框 | `components/ui/alert-dialog-shell.tsx` | 别手搓 `OverlayMount` + `useEscClose` |
| 普通对话框 | `components/ui/dialog-shell.tsx` | 消费点只改 import 路径即可（API 逐字相同） |
| 锚定浮层（下拉 / 菜单 / popover） | `floating-shell.tsx`，或它上面的 `dropdown-menu.tsx` / `popover.tsx` | 别自造定位壳 |
| **单选下拉**（选一个值出来） | `components/ui/select.tsx` | 别用原生 `<select>`（弹系统菜单，与自制弹层并排两套）、别各面自写触发钮+弹层 |
| 复选 | `components/ui/checkbox.tsx` | 别摆裸 `<input type="checkbox">`——浏览器自带方框与仓内复选行不同族 |
| **静息方框**（页面里不动的卡 / 面板 / 设置块） | `components/ui/panel.tsx`（`Panel` + `PanelHead` / `PanelRow` / `PanelLabel` / `PanelValue`） | 别新起 `.xxx-card` 手写类——皮肤（描边 / 底色 / 圆角）只住 Panel 一处 |
| 布局块（要自带皮肤的容器） | `components/ui/card.tsx`（shadcn 布局壳；消费点自覆盖 `ring-0` / `py-0` / 圆角） | 别拿它当视觉原件——它的 `ring-1` + `rounded-xl` + `bg-card` 与仓内需求错配，真卡是 per-face 类族 |
| **头像** | `components/ui/seeded-avatar.tsx`（dicebear 种子 + 兜底换图，img 常驻 DOM） | 别直接用 `avatar.tsx` 三件套——尺寸正本在各面 per-face 几何，Root 需走 `contents` |
| 快捷键提示 chip | `components/ui/kbd-hint.tsx`（落在 `kbd.tsx` 上） | 别自写绝对定位 + 显隐；文档正文里的按键角标用 `kbd.tsx` |
| 标签 chip（用户数据色） | `components/ui/tag-chip.tsx` | 状态色族仍走 `badge.tsx`；别混两种色来源 |
| **toast / 轻量失败反馈** | `toast.*`（imperative；`components/ui/toaster.tsx` 已在 App 根挂载） | 别静默吞 mutation 错误；**面内已有 scoped 红字行 canon 的（XMON-80/P2）继续走面内，不叠 toast** |

## 四、消费现状（2026-09-30 快照，仅供判断，不进门）

- `Button` 消费点最广（22/38 面），是原语层的骨干；`Card` 消费 0——**真实卡片是 7 个 per-face 类族**，说明「Card」这个原语抽象与仓内实际需求错配。**迁移时以消费点为准，不以原语名号为准。**
- 弹层族实测 **19 个挂载文件**（共享壳 14 消费点 + 2 手工壳，见 #418），整族先迁、排在各域之前，避免半迁移的缝合线在每个域重复出现。
- 类名钉扎 872 处 / 302 distinct，视觉回归靠 computed-style 探针（无位图基线）。

## 五、指针

- **#417** — 全站铺开 shadcn/ui 的批次表与验收口径（本文件的迁移期前提）
- **#409** — 散件分级盘点（低 2 / 中 9 / 高 3）
- **#410** — primitives 选型裁决（Base UI / `@base-ui/react`）
- **#418** — 弹层族实测对照矩阵
- [DESIGN.md](./DESIGN.md) — 视觉身份与各件视觉规格；跨 shell 的缝色 `--border-default` 与 focus 环 canon 是契约，改动走视觉 spec