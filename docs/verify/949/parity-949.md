# #949 等值迁移 parity 对照表（人审 diff，#910 裁定 5 流程）

采集：`probe-parity.mjs`（本目录）在两套一次性 fixture 栈上同脚本重放——before = `origin/main`
（034bf7d5，/tmp 一次性 worktree，端口 8405），after = 本分支（端口 8406）；双主题各一轮，
40 个测量面 / 每模 283 个标量。JSON 原件在 `parity/`。判定分类：

- **CANON** = 正典授权的有意变化（spec/22 §5.2 chip sm 档增长）
- **CANON-SWAP** = better-colors 实测未过 → #908 裁决 2 消费面换槽（token 值冻结不动）
- **CARRIER** = 载体换形、像素等价
- **ACCEPTED** = 件配方差额（#943 先例同款记录），不可感知

## light：283 标量，KEPT 263，DRIFT 20

| 测量点 | before | after | 判定 | 理由 |
| --- | --- | --- | --- | --- |
| `chip.box.h` | 14 | 16 | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `chip.box.w` | 32 | 34 | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `chip.box.x` | 932 | 930 | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `chip.box.y` | 230 | 229 | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `chip.style.borderRadius` | 9999px | 36.4px | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `chip.style.fontWeight` | 400 | 500 | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `chip.style.height` | 14px | 16px | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `chip.style.marginLeft` | 8.1875px | 6.1875px | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `inputRow.style.color` | rgb(141, 137, 128) | rgb(87, 83, 76) | CANON-SWAP | better-colors 换槽（#908 裁决 2）：--text-dim×--popover-bg 亮 2.89<地板 3 → --text-tertiary（contrast-949.md） |
| `kbdSelected.panelDataKbd` | True | False | CARRIER | #159 hover 让位律从 data-kbd CSS 覆写改渲染期条件类（同帧换类，机制时序不变）；属性随之退役 |
| `menuContent.style.boxShadow` | rgba(0, 0, 0, 0.12) 0px 6px 16px 0px | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0p... | CARRIER | TW v4 shadow 变量合成（透明零宽条目 + 同一真值尾项）；像素等价 |
| `navRowRest.style.transitionProperty` | background-color | color, background-color, border-color, filter | ACCEPTED | Button 件配方过渡表（#943 同款记录在案：行面无色变面，不可见） |
| `panel.style.boxShadow` | rgba(28, 25, 23, 0.14) 0px 8px 24px 0px | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0p... | CARRIER | TW v4 shadow 变量合成（透明零宽条目 + 同一真值尾项）；像素等价 |
| `panel.style.transitionDuration` | 0.1s, 0.1s | 0.1s | CARRIER | 单 transition 条目（旧 CSS 双条目同值 0.1s） |
| `panel.style.transitionProperty` | opacity, transform | opacity, scale | CARRIER | 退场缩放载体 transform→独立 scale 属性（TW v4，#943 lifted-card rotate 同律）；像素等价合成 |
| `panel.style.transitionTimingFunction` | ease-out, ease-out | cubic-bezier(0, 0, 0.2, 1) | ACCEPTED | TW ease-out(0,0,0.2,1) vs CSS ease-out(0,0,0.58,1)：100ms 退场淡出曲线差，不可感知；进场 keyframe（VIEWPORT_POP_ANIM）不动 |
| `popRow.img.borderRadius` | 9999px | 3.35544e+07px | CARRIER | rounded-full 的 computed 序列化形（3.35544e7px = 圆）；像素等价 |
| `popSeq.color` | rgb(141, 137, 128) | rgb(87, 83, 76) | CANON-SWAP | better-colors 换槽（#908 裁决 2）：--text-dim×--popover-bg 亮 2.89<地板 3 → --text-tertiary（contrast-949.md） |
| `popover.style.boxShadow` | rgba(28, 25, 23, 0.14) 0px 8px 24px 0px | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0p... | CARRIER | TW v4 shadow 变量合成（透明零宽条目 + 同一真值尾项）；像素等价 |
| `rowTime.color` | rgb(141, 137, 128) | rgb(87, 83, 76) | CANON-SWAP | better-colors 换槽（#908 裁决 2）：--text-dim×--popover-bg 亮 2.89<地板 3 → --text-tertiary（contrast-949.md） |

## dark：283 标量，KEPT 264，DRIFT 19

| 测量点 | before | after | 判定 | 理由 |
| --- | --- | --- | --- | --- |
| `chip.box.h` | 14 | 16 | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `chip.box.w` | 32 | 34 | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `chip.box.x` | 932 | 930 | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `chip.box.y` | 230 | 229 | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `chip.style.borderRadius` | 9999px | 36.4px | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `chip.style.fontWeight` | 400 | 500 | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `chip.style.height` | 14px | 16px | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `chip.style.marginLeft` | 8.1875px | 6.1875px | CANON | spec/22 §5.2 正典增长：mini 14px/400 → StatusChip sm 16px/Badge 骨架 font-medium/rounded-4xl；ml-auto 再分配随宽度 |
| `inputRow.style.color` | rgb(121, 117, 111) | rgb(179, 175, 168) | CANON-SWAP | better-colors 换槽（#908 裁决 2）：--text-dim×--popover-bg 亮 2.89<地板 3 → --text-tertiary（contrast-949.md） |
| `kbdSelected.panelDataKbd` | True | False | CARRIER | #159 hover 让位律从 data-kbd CSS 覆写改渲染期条件类（同帧换类，机制时序不变）；属性随之退役 |
| `navRowRest.style.transitionProperty` | background-color | color, background-color, border-color, filter | ACCEPTED | Button 件配方过渡表（#943 同款记录在案：行面无色变面，不可见） |
| `panel.style.boxShadow` | rgba(0, 0, 0, 0.4) 0px 8px 24px 0px | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0p... | CARRIER | TW v4 shadow 变量合成（透明零宽条目 + 同一真值尾项）；像素等价 |
| `panel.style.transitionDuration` | 0.1s, 0.1s | 0.1s | CARRIER | 单 transition 条目（旧 CSS 双条目同值 0.1s） |
| `panel.style.transitionProperty` | opacity, transform | opacity, scale | CARRIER | 退场缩放载体 transform→独立 scale 属性（TW v4，#943 lifted-card rotate 同律）；像素等价合成 |
| `panel.style.transitionTimingFunction` | ease-out, ease-out | cubic-bezier(0, 0, 0.2, 1) | ACCEPTED | TW ease-out(0,0,0.2,1) vs CSS ease-out(0,0,0.58,1)：100ms 退场淡出曲线差，不可感知；进场 keyframe（VIEWPORT_POP_ANIM）不动 |
| `popRow.img.borderRadius` | 9999px | 3.35544e+07px | CARRIER | rounded-full 的 computed 序列化形（3.35544e7px = 圆）；像素等价 |
| `popSeq.color` | rgb(121, 117, 111) | rgb(179, 175, 168) | CANON-SWAP | better-colors 换槽（#908 裁决 2）：--text-dim×--popover-bg 亮 2.89<地板 3 → --text-tertiary（contrast-949.md） |
| `popover.style.boxShadow` | rgba(0, 0, 0, 0.4) 0px 8px 24px 0px | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0p... | CARRIER | TW v4 shadow 变量合成（透明零宽条目 + 同一真值尾项）；像素等价 |
| `rowTime.color` | rgb(121, 117, 111) | rgb(179, 175, 168) | CANON-SWAP | better-colors 换槽（#908 裁决 2）：--text-dim×--popover-bg 亮 2.89<地板 3 → --text-tertiary（contrast-949.md） |

## 人审结论

全部 DRIFT 均落入四个授权类，零 UNCLASSIFIED；几何/皮肤/锚定/交互态测量点（面板盒、行盒、popover 锚定、
Arrow、scrim、catcher、hover/选中/焦点底、菜单行全态）逐值 KEPT。probe:dump（#921 工具，12 个重钉 spec）：
47 视觉行 KEPT 47 / DRIFT 0 / VIOLATION 0 / NOT-RUN 0（`probe-dump/probe-comparison.md`）。
