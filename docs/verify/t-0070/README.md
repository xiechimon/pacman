# t-0070 验证证据：pages 域手搓菜单选项行收编 dropdown-menu 原语

XMON-25（#607）收口声明的 pages 域残留菜单行，收编到
`components/ui/dropdown-menu.tsx`（Base UI Menu，本 PR 是其首个消费点）。

| 残留行 | 收编结果 |
|---|---|
| `prj-new-repo-menu-row` ×2（role=option） | `DropdownMenuRadioItem`（closeOnClick，select-and-close 家族律 #306） |
| `prj-tasks-menu-row`（role=option） | `DropdownMenuRadioItem`（同上） |
| `sched-card-menu-row`（role=menuitem） | `DropdownMenuItem`（role=menuitem 保持） |
| `prj-new-gh-row`（role=option） | **维持手搓（协调者裁决③）+ 键盘契约补齐到与收编面同等**——它长在带搜索框的 picker 内容板上，Menu 原语承载不了混合板；Command（cmdk）/Combobox 无 drop-in，见下节 |

## prj-new-gh-row：边界理由与键盘契约（裁决③）

**为什么不迁**：coverage map §3.9 对 mention-picker 内容层已有同形裁决先例——
「无 drop-in（Combobox 需自持 input）……机制层已是 Base UI Dialog，内容层
手搓合理」。picker 行表同构：搜索 input + 行表的混合板，Menu 原语的焦点/
typeahead 语义假定弹层内只有 item；引入 cmdk（新依赖）或自建 Combobox
wrapper（新原语）超出「收编到既有原语」的票面边界。**一致性优于新依赖。**

**但「不迁」≠「键盘可以坏」**：本 PR 给行表手搓补齐了与收编面同等的键盘
契约（实现 = project-new-page 的 ghListRef/onGhListKeyDown 一族；roving
tabindex、Arrow/Home/End 回环、typeahead 500ms 缓冲前缀优先、Enter 即选即关
真实生效、开面焦点进列表——OverlayMount 两段提交与 live 行表异步到位用有界
rAF 重试兜住、关面焦点归还续作控件——保活期 visibility:hidden 不立刻掉焦，
按「active 在面板子树内或已掉 body」判定重试）：

- **before（origin/main 0a1069fd 实测）**：开面后焦点不进列表——Arrow/
  typeahead 全部无效、Enter 只等价再按触发钮（toggle 关面），
  triggerBackfill 停在「选择 GitHub 仓库」= **激活从未真实发生**。
- **after（实测，`gh-keyboard-summary.txt` 全量转录）**：焦点开面即进首行；
  ArrowDown/Up 回环移动；typeahead `x`→xiechimon/pacman、`o`→octocat/
  hello-world；Enter 即选即关且生效（触发钮回填 octocat/spoon-knife）；
  Esc 与激活后焦点都归还触发钮；重开落选中行律由 e2e 第 10 用例钉住。
- 皮肤与 DOM 形态零变化（行仍是 `button[role=option]` + aria-selected，
  仅加 roving tabindex），像素面不涉及。

## 方法

- **before 栈** = `origin/main`（1877a835）detached worktree（/tmp/t0070-before），
  **after 栈** = 本分支；两侧同一 `vite build --mode fixture` 产物、`vite preview`
  独立端口（8401/8402），同一探针脚本重放（本目录 `t0070-probe.mjs` /
  `t0070-gif.mjs`，node 直跑，用法在文件头）。
- 静息几何在 `document.getAnimations()` 全部 finish 后取数（#677 后弹层有真动效，
  不 finish 会把入场中途态当静息）。
- 主题 dark+light、视口 1440×732；截图 deviceScaleFactor=1。
- 键盘语义 = 真键盘事件（Enter 开 / ArrowDown·Up / typeahead / Esc / 外点），
  逐步读 `document.activeElement` 与 ARIA 属性；两栈同脚本对照。

## 几何结论（`geometry-diff.txt` / `pixel-imgdiff.txt`）

- **全部 rect（plate / rows / trigger / field 锚）逐项相等**——含 swap 钮重开态
  （anchor 显式钉 field wrap，plate 恒贴 wrap 左缘，不跟触发钮走）。
- 字体/行高/字重/行色/底色/圆角/阴影/内边距全等；勾形 indicator 14×14、
  indigo-500、右缘 8px 位逐像素同位（per-face 槽选择器钉色，size-auto 中和
  base 强制 size-4）。
- **plate 截图**：repo-menu-none 逐像素 IDENTICAL；其余三面最大通道差 ≤5
  （勾形抗锯齿亚像素，阈值口径 >8 = #607 判据，未越线）。
- **viewport 截图**：唯一 >8 差异 = sched 卡 kebab 钮在菜单开启期间 16 px
  （墨色 113,113,122 → 212,212,216 = per-face `.sched-card-more:hover` 的
  text-secondary 增亮档）。机理：旧机制 ClickCatcher 全屏盖住触发钮使其不
  吃 hover；收编后无 catcher，鼠标停在钮上即呈现 hover 增亮——与全站 ghost
  触发钮「弹层开着时触发位增亮」的既有词汇（aria-expanded:bg-muted 族）
  一致，静息态（菜单关）零差异。
- 逐项对拍中 12 条 [PIXEL] 标记的白名单解释：
  1. `plate.color` ×8：原语 base 给 plate 挂 text-popover-foreground；plate
     无直接文本子节点（行色各自 per-face 钉死），**不可见**——plate 截图
     逐像素结果即其证明。
  2. `sched trigger.color` ×2：上述 hover 增亮档（开启期状态，非静息）。
  3. `repo-menu-swap extra.field.text` ×2：plate 从 field 子树迁入 portal，
     field 的 textContent 不再含菜单行文案——**DOM 树位变化的探针读数**，
     field rect 未变，非像素差异。

## ARIA 契约变化（票面指定方向：role=option → 原语语义）

| 位 | before | after |
|---|---|---|
| plate role | listbox | menu |
| 行 role | option | menuitemradio（sched 面 menuitem 不变） |
| 行选中标记 | aria-selected | aria-checked |
| 触发钮 | aria-haspopup=listbox（部分面手挂） | aria-haspopup=menu + aria-expanded 归原语（swap 钮从「无任何 popup 语义」补齐） |

e2e 钉扎随之改拼写不改断言语义（3 处 aria-selected → aria-checked，
project-new-repo ×2 / project-tasks-toolbar ×1；#411 别名优先：类钩子全部原样输出）。

## 键盘语义结论（`keyboard-summary.txt`，本票真正验收物）

**before（基线实测）**：菜单打开后焦点**不进弹层**——ArrowDown/Up 无效、
typeahead 无效、Enter 只等价于再按触发钮（toggle 关闭），**行键盘不可达**：
tasks 面「Enter 激活」实际未改筛选（rows=2 不变）、repo 面 selectionEffect
= unexpected、sched 面 = none。Esc / 外点关有效（家族律）。

**after（收编后逐项实测）**：
- Enter 开面后焦点落首行（menuitemradio/menuitem）✓
- ArrowDown/Up 在行间移动（roving focus）✓
- typeahead：`g` → 焦点跳「GitHub 仓库」行 ✓（CJK 文案无法用合成 keydown
  驱动，属输入法路径，未测）
- Enter 激活选中行：即选即关、选择真实生效（tasks rows 2→1、repo 切 local
  输入面、sched 弹删除确认）✓
- 焦点归还：Esc / 激活关闭后回触发钮 ✓；repo 面激活即分支切换（原触发钮
  卸载）→ 焦点接续到常驻 swap 钮（不落 body）✓；sched 面焦点交给删除确认
  弹层（其 close 钮）✓
- Esc 关 ✓；外点关且**不穿透**（tasks 面实证：点排序钮坐标，筛选菜单关、
  排序菜单不开——原语 modal 缺省档 = ClickCatcher「外点只关浮层」家族律
  同语义）✓
- 菜单行 :focus-visible 环按 #388 配方 per-face 补钉（行是 div，不在全局
  :where 名单内且 base 带 outline-hidden）

**附带的原语行为**（记录，非回归）：modal 菜单开启期间锁页面滚动（原生菜单
law；旧 ClickCatcher 不锁滚）。

## 动效（GIF，暂停 + currentTime 逐帧 scrub，两栈同脚本）

- `before-menu-motion.gif`：入场 overlay-pop keyframes 150ms + 出场
  opacity/transform transition 150ms（OverlayMount 手动保活机制）。
- `after-menu-motion.gif`：入/出场 data-open/data-closed 驱动 tw-animate-css
  enter/exit 各 100ms（ADR 0009 D3 shadcn 缺省档）——即 #656 的目标机制形态，
  换官方件自动达成。
- 帧序 = enter 0/25/50/75/100% + exit 0/25/50/75/95% + 终态（真关面后）。

## e2e

**首跑 42 红 = 「先列失败方式」的实测清单，不是事故**：全部同根因——
RadioItem 缺省 `closeOnClick=false`（原生菜单 radio 的保开语义）撞本面
select-and-close 家族律（#306）。42 条红把「单选不关面」这一个失败模式在
全部消费路径上钉了出来；显式 `closeOnClick` 一处修复后清零。这是收编类改动
该有的产出形态：失败方式先于修复现形。

- 受影响 14 spec 173 用例全绿；picker 邻接 5 spec 53 用例全绿。
- 新增钉扎：project-new-github.spec 第 10 用例 = gh-row 键盘契约（焦点进
  列表 / Arrow 回环 / typeahead 缓冲窗 / Enter 激活生效 / 焦点归还 / 重开落
  选中行）。
- 全量结果见 PR body。

## 本目录文件

- `t0070-probe.mjs` / `t0070-gif.mjs` / `t0070-ghprobe.mjs`：三个探针脚本
  （node 直跑，双栈同脚本；用法在文件头）。
- `before/after-results.json` + `geometry-diff.txt` + `pixel-imgdiff.txt`：
  四面几何/样式对拍。
- `keyboard-summary.txt`：四面键盘契约对照（收编面）。
- `gh-before/gh-after-results.json` + `gh-keyboard-summary.txt`：picker 行表
  键盘契约对照（手搓面）。
- `*-plate.png` / `*-viewport.png` ×16、`*-menu-motion.gif` ×2。
