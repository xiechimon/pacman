# #1011 再评证据：#883 model picker 行焦点环 + 两面行内缩

判定：**未自解**。官方几何（#1003 registry 对齐 + 波 1 施工 + #1010 select 退役）
落地后，#883 的两个缺陷在当前 main 上均可复现：

1. **行焦点环仍被裁**：行的焦点指示器 = Button 底座 `focus-visible:ring-3`
   （3px box-shadow，画在行盒外、offset 0；`outline-none` 已压掉 #388 全局
   outline 律）。行盒四缘与 listbox 裁剪盒齐平（#872 整行铺满律：壳横垫清零、
   行自带内衬），listbox 是 `overflow-y-auto` 滚动容器 → 贴裁剪盒的各段环被裁：
   - 设置面（压缩模型，scenario 101）：左/右/上三段消失，只剩行下一条横杠
     （+ 半透明选中底下的透墨）——与 #883 原报症状同形；
   - 抽屉面（总管主模型，scenario 111，单行）：行盒 == 裁剪盒四缘全贴，
     四段全裁，键盘聚焦后**没有任何可用外环**，只剩行内透墨。
2. **两面行内缩仍不统一**：抽屉面 20px vs 设置面 12px（实测 name 墨缘到弹层
   内缘距离）。

## 实测方法

探针 = `apps/web/e2e/probe-1011.mjs`（几何 / computed / 键盘导航压测 / 帧）与
`apps/web/e2e/probe-1011-attr.mjs`（环墨归因），在 fixture 构建
（`vite build --mode fixture` + `vite preview`，端口 8398）上跑，
deviceScaleFactor 4、亮面（与 #872 证据帧同面）。

**归因判据（判定依据，抗干扰）**：同一聚焦态下只改一个变量拍两帧做逐像素 diff——
- `*-attr.json` 的 `diffShadowRemoved`：`row.style.boxShadow='none'` 前后差 =
  行 box-shadow 在当前裁剪下**实际画出来的墨**；
- `diffOverflowVisible`：`listbox.style.overflow='visible'` 前后差 = **被滚动
  容器裁掉的墨**。
两帧之间无布局/定位变化，diff 只归因于被改的那一个属性。

`measurements.json` 里的 `ringRow1/ringRow2.bands`（基线帧 vs 聚焦帧两帧法）
作参考不作判据：popover 在两帧间有亚像素微移，行外条带计数会被弹层边缘像素污染。

键盘导航压测记录（`measurements.json.nav`）：开面焦点在 listbox 容器（typeahead
契约）；Tab 进首行（`:focus-visible` 命中）；设置面 Tab 在行间顺序移动、Shift+Tab
回退正常；抽屉面单行，第二次 Tab 焦点出弹层、弹层随焦点外出关闭（Base UI
非模态律）；Escape 关面焦点归还触发钮。

## 文件

| 文件 | 内容 |
| --- | --- |
| `measurements.json` | 两面几何（行/裁剪盒/弹层 rect、flush 判定、行内缩、computed focus 样式、token）、键盘导航压测记录 |
| `drawer-attr.json` / `settings-attr.json` | 环墨归因 diff（裁掉的墨 vs 画出的墨）bbox 与计数 |
| `drawer-menu-focused-row1.png` / `settings-menu-focused-row1.png` | 键盘聚焦首行的整菜单帧（当前裁剪态） |
| `settings-menu-focused-row2.png` | 设置面中部行聚焦帧（上下段在内容区内可见、左右段仍裁） |
| `drawer-attr-overflow-visible-C.png` / `settings-attr-overflow-visible-C.png` | 同聚焦态把 listbox overflow 改 visible 的参照帧 = 环本应有的完整形态 |
| `drawer-row-left-edge-zoom.png` / `settings-row-left-edge-zoom.png` | 行左缘 4x 放大：裁剪态下左段环无墨 |
| `drawer-trigger-ring-control.png` / `settings-trigger-ring-control.png` | 阳性对照：触发钮（弹层外、无裁剪祖先）同配方环四段完整 |
| `indent-compare.png` | 两面聚焦帧并排对照，标行内缩实测值（20px vs 12px） |

## 实测数字（亮面，css px）

- 设置面：行盒 [839,1206]×[233,265]，listbox [839,1206]×[233,297]，
  `overflow: auto`、零内垫；行盒左/右/上缘与裁剪盒差 < 0.5px。
  `diffShadowRemoved` bbox 止于行盒 + 下段（[233,267.75]），左/上段无墨；
  `diffOverflowVisible` bbox 扩到 [836,1208.75]×[230,263.25] = 左/右/上三段回归。
- 抽屉面：行盒 == listbox == [1066,1344]×[196.25,228.81]（单行铺满）；
  `diffShadowRemoved` 仅 1402 px 且 bbox 全在行盒内（透墨），四段外环全无；
  `diffOverflowVisible` 28278 px，bbox [1063,1346.75]×[193.25,232] = 四段全回归。
- 行内缩：抽屉面 name 墨缘距弹层内缘 20px（行 `px-5`）；设置面 12px（行 `px-3`）。
- 焦点指示器 computed：`outline-style: none`（`outline-none` 压掉 #388 全局律），
  `box-shadow: … oklab(0.634 … / 0.5) 0 0 0 3px`（ring-ring/50 灰环，画在盒外）。

## 附带观察（归重切票，不在本票修）

- listbox 容器键盘聚焦时吃 UA 默认蓝环（`:focus-visible` 命中 div，#388 全局律
  的元素表不含它）——与仓内环配方不同词。
- 焦点词表双源：行走 Button 灰环（`--ring`/50），#388 全局律走 `--focus-ring`。
- Button 底座 `transition-all` 违反「只过渡变化的属性」，且让环采样必须等落定。
