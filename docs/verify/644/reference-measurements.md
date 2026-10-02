# 参考站实测记录：总管设置 tabs 滑动（#644）

2026-10-02，ego-browser（登录态真实 Chromium）实测 https://todos.dev/app →
总管面板 → 齿轮「总管设置」→ 4 tab 组（Agent / 章程 / 记忆 / 关注与提醒）。
只读操作（切 tab），未动参考账号任何数据。

## 结构（DOM dump + getComputedStyle）

- 外层容器：`div` 带 `rounded-lg border border-line bg-surface-secondary overflow-hidden`；
  内层 `[role=tablist]` 为 `position: relative`，inline `padding: 2px; gap: 2px`。
- **tablist 第一个子元素是绝对定位的指示 pill**（滑动主体）：
  - inline：`position: absolute; left: 2px; top: 2px; width: 58px; height: 24px;
    border-radius: 6px; background-color: rgb(250, 247, 242); z-index: 0;
    box-shadow: rgba(0,0,0,0.05) 0px 1px 2px 0px`
  - 几何与激活 tab（Agent，rect x=474 w=58.2 h=24）逐位吻合。
- 4 个 `[role=tab]` chip：透明底 `rgba(0,0,0,0)`、`z-index: 1`、`rounded-md`（6px）、
  `px-3 py-1`、高 24px——文字压在 pill 上层。
- 标签颜色瞬切（tab 元素 `transition-duration: 0s`）：激活 `text-content`
  = rgb(28,25,23)，非激活 `text-content-tertiary`；字重无差（两边 font-medium）。

## 切换动效（点击 Agent → 章程，帧内取证）

点击后 pill 的 inline `left/width` 直接置为新值（`left: 62px; width: 48px`），
由 CSS transition 补间：

- computed：`transition-property: left, top, width, height`；
  `transition-duration: 0.15s`；`transition-timing-function: ease`；delay 0s。
- `document.getAnimations()` 在切换帧捕到 **2 条 running 的 CSSTransition**：
  `{ prop: "left", timing: { dur: 150, ease: "ease", delay: 0 } }` 与
  `{ prop: "width", 同 timing }`，target 均为 pill（`DIV.r-633pao`）。
- top/height 同行切换不变 → 不产生这两条属性的过渡（与捕获一致）。
- `ease` = cubic-bezier(0.25, 0.1, 0.25, 1)，**不是**本仓 --ease-standard
  （cubic-bezier(0.4, 0, 0.2, 1)）。

结论：滑动 = 底层 pill 的位移 + 宽度补间，**150ms ease**；chip 文字颜色瞬切。

## 仓内对齐方式

- Base UI `Tabs.Indicator` 把激活 tab 几何写进内联自定义属性
  `--active-tab-left/top/width/height`；`.chief-tab-indicator`（chief.css）消费
  四 var 定位，并挂 `transition: left/top/width/height var(--dur-fast) ease`
  （tokens.css 的 --dur-fast = 150ms，与实测 0.15s 一致）。
- pill：圆角 6px、底色 `--chief-tab-active`、`box-shadow 0 1px 2px 0 rgb(0 0 0 / 0.05)`、
  z-index 0 垫底、pointer-events none；chip z1 透明底，`.chief-tab.is-active`
  不再自绘背景（避免「新 chip 瞬亮 + pill 滑过去」的双重绘制）。
- `prefers-reduced-motion: reduce` 时 transition: none（motion.css 全站降级律同款）。
- 颜色面不在本票范围：实测参考站 pill 底色 rgb(250,247,242) 与本仓既有 token
  `--chief-tab-active`(light) #f7f4ef 有微差，属早前捕获基线的色值议题，#644 只迁移动效。

## 证据截图

- before（origin/main，一次性 worktree 起 fixture 栈重放同一脚本）：
  `tabs-before-1-idle-agent.png`（静止）、`tabs-before-2-at-75ms-already-swapped.png`
  （点击后 75ms 已瞬切完成——无中间态）、`tabs-before-3-settled-charter.png`。
- after（本分支）：`tabs-after-1-idle-agent.png`（静止，pill 在 Agent 下）、
  `tabs-after-2-mid-slide-75ms.png`（切换动画暂停在 75ms 中点：pill 正在
  Agent→章程 之间滑行且宽度 58→48 补间中）、`tabs-after-3-settled-charter.png`（落位）。
- 拍摄脚本：Playwright headless，`/app?scenario=101` light 主题，2x deviceScaleFactor，
  clip 到 tab 组外扩 14px；mid 帧用 `getAnimations().pause() + currentTime=75` 定格。
