# 复用清单（pacman web）

> 这份文件只回答一个问题：**要写一个新的 UI 件之前，先看这里——已有的能不能直接用。**
> 「长什么样」（颜色 / 字号 / 圆角 / 阴影 / 动效 / 各件的视觉规格）在 [DESIGN.md](./DESIGN.md)；本文件管「**有哪些、在哪、该复用谁**」。
> 三条机器门钉住它不腐烂（`test/ui-reuse-inventory.test.ts`）：新轨每件必须登记、清单里的件必须真实存在、旧轨冻结不许加件。

## 一、迁移期双轨（先看这条）

| 轨 | 位置 | 状态 |
|---|---|---|
| **新轨** | `src/components/ui/` | **新代码一律落这里。** shadcn 件 + Base UI 基（#410 裁决），带仓内偏离记录 |
| **旧轨** | `src/ui/` | 待退役的手工件（`avatar` / `button` / `card` / `chip` / `dialog` / `input` / `kbd-hint` / `tag-chip`，各带 `.css`）。**只许删、不许加**（#417 裁决，机器门钉住） |
| 弹层族 | `src/overlay/` + `src/overlays/` | 挂在共享壳上（见第三节），**不自己手搓 OverlayMount + useEscClose** |

规矩一句话：**改已有消费点时才碰旧轨；写新件进新轨。**

<!-- inventory:old-track-frozen -->
```text
avatar.tsx
button.css
button.tsx
card.css
card.tsx
chip.css
chip.tsx
dialog.css
input.css
input.tsx
kbd-hint.css
kbd-hint.tsx
tag-chip.css
tag-chip.tsx
```
<!-- /inventory:old-track-frozen -->

（上面这段是机器门读的冻结名单：`src/ui/` 里出现名单外的新件即报错——迁移期的删除不报错。）

## 二、新轨原语（14）

<!-- inventory:new-track -->
```text
alert-dialog-shell.tsx   # 确认面共用底座（删除确认 / 丢草稿确认），走 Base UI AlertDialog
alert-dialog.tsx
badge.tsx                # 计数 / 标签 pill；任务状态语义色族见 DESIGN.md
button.tsx               # 三态 Primary/Ghost/Icon；仓内偏离：focus 环走仓级 #388 canon
card.tsx
dialog-shell.tsx         # 对话框共用底座（11 个消费点，API 与旧轨逐字相同）
dialog.tsx
dropdown-menu.tsx
empty.tsx
floating-shell.tsx       # 锚定浮层共用底座（plan-dropdown / chip-popover / more-menu / 用户菜单 / 排序 / chief-model-select / mention-picker）
input.tsx
popover.tsx
switch.tsx               # 仓内偏离：thumbClassName 适配口
tabs.tsx
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
| 计数 / 标签 pill | `components/ui/badge.tsx`（状态色族） | 旧轨 `chip.tsx` / `tag-chip.tsx` 待退役，别加新消费 |
| 空态 | `components/ui/empty.tsx` | 别每处自写空态文案块 |
| 确认对话框 | `components/ui/alert-dialog-shell.tsx` | 别手搓 `OverlayMount` + `useEscClose` |
| 普通对话框 | `components/ui/dialog-shell.tsx` | 消费点只改 import 路径即可（API 逐字相同） |
| 锚定浮层（下拉 / 菜单 / popover） | `floating-shell.tsx`，或它上面的 `dropdown-menu.tsx` / `popover.tsx` | 别自造定位壳 |
| 卡片 / 面板 | 先看 `components/ui/card.tsx`；**但注意下面的消费现状** | 别硬套原语——真卡是 per-face 类族 |
| **头像** | **只有旧轨 `ui/avatar.tsx`**（新轨尚无对应件） | 现在从旧轨 import 是已知在案状态；迁移到该域时补新轨件，别照抄第二份 |

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