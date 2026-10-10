# #1095 修复证据：model picker 行焦点环内描 + 两面行内缩统一

判定：**已修**。判据（继承 #883 / #1011）= 归因探针两面
`diffOverflowVisible.changed == 0`——实测两面均为 0（`drawer-attr.json` /
`settings-attr.json`），即再无任何环墨被 listbox 滚动容器裁掉；且聚焦帧上环墨
完整可见（`*-menu-focused-row1.png`、`*-row-left-edge-zoom.png`）。

## 改了什么

单源三处（改前改后均经探针实测，不读源码推断）：

1. **行焦点环改内描**（票面候选 a）：`model-select-core.tsx` 的
   `PICK_ROW_BTN_CLS` 加 `focus-visible:ring-0`（摘 Button 底座画在行盒外的
   3px 灰环）+ `focus-visible:outline-solid focus-visible:outline-2
   focus-visible:outline-offset-[-2px] focus-visible:outline-(--focus-ring)`
   ——2px 环墨落进行盒内缘，滚动容器裁不到；环色收敛到 #388 全局律的
   `--focus-ring`（行灰环 `--ring`/50 双源退役）。
   **`outline-solid` 不可省**：Button 底座 `outline-none` 把
   `--tw-outline-style` 钉成 `none`，`outline-2` 的
   `outline-style: var(--tw-outline-style)` 会算出 `none`——computed 宽度/
   偏移全对、像素零墨的静默失败（施工期实测踩到，见下「探针自身的坑」）。
   不动 #872 整行铺满律：`rowFlushWithListbox` 三面仍全 true。
2. **两面行内缩统一 12px**：抽屉面 `ROW_SKIN.row` `px-5` → `px-3`
   （chief-model-popover.tsx）。实测 name 墨缘距弹层内缘两面均 12px
   （`indent-compare.png`）。**取值 12 是产品裁决**（票面建议、与仓内菜单行族
   `px-3` / `HOST_ROW_BTN_CLS` 同档），PR body 点名供否决；抽屉行形不随缩进
   变档（13px 名 + 11px 副题 + 7px 纵衬原样）。
3. **附带（同焦点面）**：
   - listbox 容器键盘聚焦的 UA 默认蓝环 → 仓内配方内描环
     （`ModelPickList` 清单容器加同款 `focus-visible:outline-*` 三件；内描因
     容器横缘与壳内缘齐平，外描会越出弹层描边）。证据帧
     `*-container-focus-ring.png`（键盘模态开面，容器程序焦点命中
     :focus-visible）。
   - 焦点词表双源收敛：行环色改走 `--focus-ring`（见 1）。
   - 行级 transition 收窄为 `transition-[background-color,color]`（只过渡真会
     变的属性）。**Button 底座 `transition-all` 同病但不在本票修**：
     `components/ui` 已冻结（#1003，唯一写入口 = #989 刷新脚本），底座级改动
     需用户裁决解冻——PR body 点名。

## 实测方法

探针复用 #1011 两件套：`apps/web/e2e/probe-1011.mjs`（几何 / computed / 键盘
导航压测 / 帧）与 `probe-1011-attr.mjs`（环墨归因），fixture 构建
（`vite build --mode fixture` + `vite preview`，端口 8398）、deviceScaleFactor
4、亮面。归因判据不变：同聚焦态只改一个变量拍两帧逐像素 diff——
`diffShadowRemoved`（行 box-shadow 实际画出的墨）与 `diffOverflowVisible`
（被滚动容器裁掉的墨）。

**探针自身修了一处序 bug（本票随修）**：旧序把键盘导航压测放在环渲染实测
前面，压测的 Tab/Escape 把输入模态留在键盘，第二次开面时容器程序焦点命中
:focus-visible 吃环——「开面零环」的基线帧带环，base-vs-focused 的 diff 归因
全错（施工期实测：overlay 红框归到容器环而非行环）。现序 = 环渲染实测先跑
（鼠标模态基线干净），导航压测后跑并改键盘开面（focus + Enter），顺带产出
容器环证据帧。

## 实测数字（亮面，css px）

- 两面行聚焦 computed：`outline: 2px solid var(--focus-ring)`、
  `outline-offset: -2px`、box-shadow 全零宽（外环已摘）；
  `:focus-visible` 命中。
- 归因：两面 `diffOverflowVisible.changed == 0`、`diffShadowRemoved.changed
  == 0`（无外环墨可裁、无 box-shadow 墨残留）。
- 环墨位置：base-vs-focused diff 变化像素 settings 面 row1 24961 / row2
  24969、抽屉面 row1 19329（DSF4 像素），**行盒外四带计数全 0**——墨全在行
  盒内（内描设计使然；#1011 的外环形态下四带才是判据位），叠加图见
  `*-ring-diff-overlay-row1.png`。
- 内缩：两面 `rowPadding` 12/12、`nameInkInsetFromDialogInner` 12（抽屉面旧值
  20）。
- #872 铺满律：`rowFlushWithListbox` 左/右/上三面仍全 true（律未破）。
- 阳性对照：触发钮（弹层外无裁剪祖先）同配方环四带全非零
  （settings 1029/807/7316/6632，抽屉 737/603/6777/6777）——配方没坏。
- 键盘导航契约不变：开面焦点在 listbox 容器；Tab 进首行、设置面行间顺序移
  动、Shift+Tab 回退、抽屉面单行第二次 Tab 焦点出弹层关面（Base UI 非模态
  律）、Escape 关面焦点归还触发钮（`measurements.json.nav`）。

## 文件

| 文件 | 内容 |
| --- | --- |
| `measurements.json` | 两面几何 / computed 焦点样式 / 键盘导航压测（含键盘模态开面容器命中记录） |
| `drawer-attr.json` / `settings-attr.json` | 归因 diff：**判据位**，两面 `diffOverflowVisible.changed == 0` |
| `*-menu-base-no-ring.png` | 鼠标模态开面基线帧（全菜单零环，序 bug 修后干净） |
| `*-menu-focused-row1.png`（+ settings row2） | 键盘 Tab 聚焦行的整菜单帧：环四段完整可见 |
| `*-row-left-edge-zoom.png` | 行左缘 4x 放大：内描环墨在行盒内 |
| `before-after-row-edge-*.png` | 行左缘 before（#1011 档，无墨）/ after 并排对照 |
| `*-container-focus-ring.png` | 键盘模态开面：容器焦点环走仓内配方（UA 蓝环退役） |
| `*-trigger-ring-control.png` | 阳性对照：触发钮环四段完整 |
| `*-ring-diff-overlay-row1.png` | base-vs-focused 变化像素染红叠加：环墨落在行盒内缘 |
| `indent-compare.png` | 两面聚焦帧并排：name 墨缘内缩均 12px |

before 档不重拍：#883 / #1011 的既有帧即 before（`docs/verify/1011/`，本目录
`before-after-*` 合成帧直接引其 zoom 档）。
