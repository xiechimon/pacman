---
name: Pacman
colors:
  # 画布层级（dark 默认主题；深 → 浅逐级抬升）
  canvas: '#09090b'
  surface: '#18181b'
  surface-secondary: '#1f1f23'
  surface-tertiary: '#27272a'
  sidebar: '#1c1c1f'
  # 文字阶梯（标题 → 正文 → 辅助 → 元信息）
  text-primary: '#fafaf9'
  text-secondary: '#d4d4d8'
  text-tertiary: '#71717a'
  text-dim: '#52525b'
  # 描边
  border: '#27272a'
  border-strong: '#3f3f46'
  # 品牌主色（board 实测值 #6466e9 优先于 landing 采样 #6366f1）
  primary: '#6466e9'
  primary-strong: '#4f46e5'
  accent-blue: '#3b82f6'
  # 状态
  success: '#22c55e'
  warning: '#f59e0b'
  danger: '#ca3a32'
  # 语义 chip 色族（bg/fg 成对使用，禁跨对混用）
  chip-idle-bg: '#202733'
  chip-idle-fg: '#9ea3ae'
  chip-plan-bg: '#1c2740'
  chip-plan-fg: '#8b93f8'
  chip-confirm-bg: '#33221b'
  chip-confirm-fg: '#f2c24b'
  chip-done-bg: '#14291c'
  chip-done-fg: '#5ec26a'
  chip-failed-bg: '#351c1a'
  chip-failed-fg: '#dd524c'
typography:
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.015em
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 4px
  DEFAULT: 8px
  lg: 12px
  full: 9999px
spacing:
  space-1: 4px
  space-2: 8px
  space-3: 12px
  space-4: 16px
  space-6: 24px
---

## Brand & Style

pacman 是多 lane coding agent 编排台：看板管理并行 agent 任务，详情页追踪单任务对话流。受众是键盘优先的工程师——设计服务密度与可扫读性，不服务装饰。

设计哲学：高密度极简 + 触觉层级。暗色画布按灰度分层，边界用发丝线（hairline）而非投影划分，彩色只留给状态与主操作。整体气质接近 Linear / 代码编辑器，而非营销页。

## Colors

**暗色优先（dark-first）**：`:root` 即暗色，`.light` 类切换到浅色。本文件 frontmatter 列暗色值；浅色对应值见 `apps/web/src/styles/tokens.css` 的 `.light` 块（暖白底 #faf7f3 系，非冷灰）。

- **画布层级**：canvas `#09090b`（页面底色）→ surface `#18181b`（主面板）→ surface-secondary `#1f1f23`（卡片/弹层）→ surface-tertiary `#27272a`（嵌入控件底）。sidebar `#1c1c1f` 是画布的半阶偏移，不换色相。
- **文字四级**：标题/激活态 text-primary；正文/字段值 text-secondary；时间戳/元信息 text-tertiary；禁用/占位 text-dim。禁在正文用 text-dim。
- **彩色纪律**：indigo 只给主操作与焦点态（按钮、focus ring、激活 tab）；蓝/琥珀/绿/玫红只给状态语义（进行中/待确认/完成/失败），不作装饰。
- **chip 色族**：idle/plan/confirm/done/failed 五对 bg+fg，表达任务状态机。跨对混用是 bug。

## Typography

双引擎：**Inter** 承载界面叙事（标题、正文、标签）；**JetBrains Mono** 承载机器读数（任务 ID、token 计数、快捷键、代码）。正文 400、元信息 500、标题 600——禁 700+。15px 以上标题用负字距。

## Layout & Spacing

4px 基数阶梯（space-1 到 space-6）。卡片内边距 space-3（12px），栏间距 space-4（16px），页面边距 space-6（24px）。顶栏 44px（43 内容 + 1px 发丝缝），侧栏 240px。现有像素级实测值向该阶梯收敛，新增代码一律走 token。

## Elevation & Depth

不用扩散投影堆层级，用**灰度分层 + 发丝环**：

- **Level 0 画布**：canvas 纯色。
- **Level 1 卡片**：surface-secondary + `inset 0 0 0 1px border`（用 inset shadow 画环而非 border——分数缩放（110%/125%）下真 1px border 会光栅化不均，shadow-spread 环在任何缩放级别保持均匀发丝）+ 12px 圆角 + 静态微影 `0 2px 4px rgb(0 0 0 / 0.2)`。
- **Level 2 弹层/对话**：同级 fill，投影升档 `0 5px 14px rgb(0 0 0 / 0.4)`（浮于内容之上需要可见分离）。

## Shapes

- **12px（rounded-lg）**：卡片、弹层、对话框——elevated surface 的统一半径。
- **全圆角（9999px）**：状态徽章、chip、快捷键键帽。
- **8px（DEFAULT）**：按钮、输入框等基础控件。

## Motion

三档时长：150ms 常规过渡 / 200ms 浮层挂载 / 300ms 抽屉滑移。缓动：标准 cubic-bezier(0.4,0,0.2,1)，出场 ease-out，弹性入场 cubic-bezier(0.22,1,0.36,1)。无弹簧物理动画。

## Components

### Button
- **Primary**：solid primary indigo 底 + 白字，28px（紧凑）/32px（标准）高，8px 圆角。禁用态不透明度降档而非灰化。
- **Ghost**：透明底 + 1px border，文字 text-secondary，hover 升 text-primary + 描边增亮。
- **Icon**：28×28 方，图标 text-tertiary，hover 增亮。

### Card（看板任务卡 / 资源行卡）
surface-secondary 底 + 发丝环 + 12px 圆角 + 12px 内边距 + card 级微影。头部 mono 11px 任务 ID（text-tertiary），标题 Inter 13px medium，尾行元信息 + 状态 chip。

### Chip / Badge
全圆角 pill，高 18-20px，语义色族 bg+fg 成对。任务状态用 chip 色族；计数/标签用 surface-tertiary 底 + text-secondary。

### Input
canvas 底（比所在面板深一阶）+ 1px border，**36px 高**（dlg-form-input 实测族，2026-09-26 裁决：实测赢文档），14px 字。focus = 1px primary 描边，禁外发光 halo。

### Dialog / Popover
surface-secondary 底 + 发丝环 + 12px 圆角 + 弹层级投影。footer 按钮右对齐，danger 操作用 danger 色实心。

### 状态语义
任务五态（idle/planning/confirm/building/done/failed）有固定色对，见 chip 色族。新增状态先扩色族，不临时取色。
