# #949 overlays/ 域 better-colors 对比度实测（不许估）

测量面：verify-pacman live 栈（8795/5277，独立 PACMAN_HOME），`drive-949-overlays.mjs` E 段；
渲染对取真实元素 computed color，token 解析对走 var() probe-div；透明/半透明底合成到真实画布。
WCAG 2.x 相对亮度公式；文本地板 4.5、非文本 UI 地板 3.0；report-only = spec/22 §1.3 软发丝线族（报数不判红）。

**消费面换槽（#908 裁决 2 授权，token 值冻结不动）**：`--text-dim × --popover-bg` 实测亮模 2.89:1 <
该槽 canon 地板 3（§1.8 的 3.05:1 是 on `--background` 对；popover 底更亮把它压穿）——时间列/序号/放大镜
三个消费点换 `--text-tertiary`（亮 4.97 / 暗 7.35，见下表 row-time / popover-seq / input-icon 行），
#943 notify-banner 同判例。

## dark（27 对门控 + 3 对 report-only）

| face | fg | bg | ratio | floor | verdict |
| --- | --- | --- | --- | --- | --- |
| row-text | rgb(211 207 199) | rgb(37 34 29) | 10.2:1 | 4.5 | PASS |
| row-title | rgb(237 233 225) | rgb(37 34 29) | 13.09:1 | 4.5 | PASS |
| row-sub | rgb(179 175 168) | rgb(37 34 29) | 7.25:1 | 4.5 | PASS |
| row-time | rgb(179 175 168) | rgb(37 34 29) | 7.25:1 | 4.5 | PASS |
| chip-idle-rendered | rgb(179 175 168) | rgb(45 42 36) | 6.55:1 | 4.5 | PASS |
| group-label | rgb(179 175 168) | rgb(37 34 29) | 7.25:1 | 4.5 | PASS |
| input-text | rgb(237 233 225) | rgb(37 34 29) | 13.09:1 | 4.5 | PASS |
| row-text-lit | rgb(211 207 199) | rgb(45 42 36) | 9.21:1 | 4.5 | PASS |
| icon-tile-glyph | rgb(179 175 168) | rgb(63 60 54) | 5.03:1 | 3 | PASS |
| chip-idle-token | rgb(179 175 168) | rgb(45 42 36) | 6.55:1 | 4.5 | PASS |
| chip-plan-token | rgb(224 175 255) | rgb(62 51 60) | 6.73:1 | 4.5 | PASS |
| chip-confirm-token | rgb(244 185 115) | rgb(66 43 13) | 7.6:1 | 4.5 | PASS |
| chip-done-token | rgb(141 219 162) | rgb(25 56 34) | 7.84:1 | 4.5 | PASS |
| chip-failed-token | rgb(255 170 185) | rgb(71 36 43) | 7.52:1 | 4.5 | PASS |
| popover-title | rgb(237 233 225) | rgb(37 34 29) | 13.09:1 | 4.5 | PASS |
| popover-row | rgb(179 175 168) | rgb(37 34 29) | 7.25:1 | 4.5 | PASS |
| popover-row-selected | rgb(179 175 168) | rgb(62 51 60) | 5.51:1 | 4.5 | PASS |
| popover-label-selected | rgb(237 233 225) | rgb(62 51 60) | 9.93:1 | 4.5 | PASS |
| popover-seq | rgb(179 175 168) | rgb(37 34 29) | 7.25:1 | 4.5 | PASS |
| input-icon | rgb(179 175 168) | rgb(37 34 29) | 7.25:1 | 3 | PASS |
| popover-check | rgb(216 156 252) | rgb(62 51 60) | 5.77:1 | 3 | PASS |
| popover-divider | rgb(45 42 36) | rgb(37 34 29) | 1.11:1 | — | report-only |
| panel-border | rgb(45 42 36) | rgb(37 34 29) | 1.11:1 | — | report-only |
| popover-border | rgb(45 42 36) | rgb(30 27 22) | 1.2:1 | — | report-only |
| project-avatar | rgb(71 38 26) | rgb(255 155 120) | 6.55:1 | 4.5 | PASS |
| menu-row | rgb(237 233 225) | rgb(37 34 29) | 13.09:1 | 4.5 | PASS |
| menu-row-checked | rgb(237 233 225) | rgb(62 51 60) | 9.93:1 | 4.5 | PASS |
| menu-indicator | rgb(216 156 252) | rgb(62 51 60) | 5.77:1 | 3 | PASS |
| focus-ring | rgb(216 156 252) | rgb(37 34 29) | 7.61:1 | 3 | PASS |
| sidebar-dim-row | rgb(211 207 199) | rgb(30 27 22) | 11.05:1 | 4.5 | PASS |

## light（27 对门控 + 3 对 report-only）

| face | fg | bg | ratio | floor | verdict |
| --- | --- | --- | --- | --- | --- |
| row-text | rgb(53 49 42) | rgb(239 233 225) | 10.72:1 | 4.5 | PASS |
| row-title | rgb(18 15 9) | rgb(239 233 225) | 15.86:1 | 4.5 | PASS |
| row-sub | rgb(87 83 76) | rgb(239 233 225) | 6.34:1 | 4.5 | PASS |
| row-time | rgb(87 83 76) | rgb(239 233 225) | 6.34:1 | 4.5 | PASS |
| chip-idle-rendered | rgb(87 83 76) | rgb(232 227 218) | 5.98:1 | 4.5 | PASS |
| group-label | rgb(87 83 76) | rgb(239 233 225) | 6.34:1 | 4.5 | PASS |
| input-text | rgb(18 15 9) | rgb(239 233 225) | 15.86:1 | 4.5 | PASS |
| row-text-lit | rgb(53 49 42) | rgb(232 227 218) | 10.12:1 | 4.5 | PASS |
| icon-tile-glyph | rgb(87 83 76) | rgb(224 219 210) | 5.55:1 | 3 | PASS |
| chip-idle-token | rgb(87 83 76) | rgb(232 227 218) | 5.98:1 | 4.5 | PASS |
| chip-plan-token | rgb(86 32 113) | rgb(223 207 217) | 7.63:1 | 4.5 | PASS |
| chip-confirm-token | rgb(130 81 0) | rgb(255 229 200) | 5.53:1 | 4.5 | PASS |
| chip-done-token | rgb(0 76 35) | rgb(194 245 206) | 8.38:1 | 4.5 | PASS |
| chip-failed-token | rgb(107 31 51) | rgb(255 220 225) | 8.87:1 | 4.5 | PASS |
| popover-title | rgb(18 15 9) | rgb(239 233 225) | 15.86:1 | 4.5 | PASS |
| popover-row | rgb(87 83 76) | rgb(239 233 225) | 6.34:1 | 4.5 | PASS |
| popover-row-selected | rgb(87 83 76) | rgb(223 207 217) | 5.11:1 | 4.5 | PASS |
| popover-label-selected | rgb(18 15 9) | rgb(223 207 217) | 12.79:1 | 4.5 | PASS |
| popover-seq | rgb(87 83 76) | rgb(239 233 225) | 6.34:1 | 4.5 | PASS |
| input-icon | rgb(87 83 76) | rgb(239 233 225) | 6.34:1 | 3 | PASS |
| popover-check | rgb(127 45 167) | rgb(223 207 217) | 4.95:1 | 3 | PASS |
| popover-divider | rgb(232 227 218) | rgb(239 233 225) | 1.06:1 | — | report-only |
| panel-border | rgb(232 227 218) | rgb(239 233 225) | 1.06:1 | — | report-only |
| popover-border | rgb(232 227 218) | rgb(244 239 231) | 1.12:1 | — | report-only |
| project-avatar | rgb(49 10 0) | rgb(205 95 55) | 4.5:1 | 4.5 | PASS |
| menu-row | rgb(18 15 9) | rgb(239 233 225) | 15.86:1 | 4.5 | PASS |
| menu-row-checked | rgb(18 15 9) | rgb(223 207 217) | 12.79:1 | 4.5 | PASS |
| menu-indicator | rgb(127 45 167) | rgb(223 207 217) | 4.95:1 | 3 | PASS |
| focus-ring | rgb(127 45 167) | rgb(239 233 225) | 6.14:1 | 3 | PASS |
| sidebar-dim-row | rgb(53 49 42) | rgb(244 239 231) | 11.3:1 | 4.5 | PASS |

结论：门控 27 对 × 双主题全过，域最低 4.5:1。report-only 三对与 §1.7/1.8 表值逐位吻合（1.06–1.2 软发丝线族）。
