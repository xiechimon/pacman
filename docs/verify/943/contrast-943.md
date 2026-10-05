# #943 board/sidebar 域对比度实测（better-colors，不许估）

测法：`drive-943-board-sidebar.mjs`（运行产物在 live-stack/drive-943-board-sidebar/）在 live 栈（8795/5277，独立 PACMAN_HOME）上取**渲染元素 computed color**（导航行/选中行 pill 合成面/kbd 角标/列头/卡标题/筛选钮）与 **token 解析对**（probe-div 走 var() 解析，态色与双面件），WCAG 2.x 相对亮度公式算比值。透明/半透明底一律合成到实际画布（--background 或侧栏底）再算。floor：文本 4.5、非文本 UI 3.0。双主题各 16 对。

| 面 | 类型 | 暗模 fg / bg / 比值 | 亮模 fg / bg / 比值 | floor | 判定 |
|---|---|---|---|---|---|
| `sidebar-nav-text` | text | `rgb(179 175 168)` on `rgb(30 27 22)` = **7.86** | `rgb(53 49 42)` on `rgb(244 239 231)` = **11.3** | 4.5 | PASS |
| `sidebar-selected-pill` | text | `rgb(179 175 168)` on `rgb(53 50 45)` = **5.88** | `rgb(53 49 42)` on `rgb(222 218 210)` = **9.26** | 4.5 | PASS |
| `sidebar-kbd` | text | `rgb(179 175 168)` on `rgb(30 27 22)` = **7.86** | `rgb(53 49 42)` on `rgb(244 239 231)` = **11.3** | 4.5 | PASS |
| `column-header` | text | `rgb(179 175 168)` on `rgb(30 27 22)` = **7.86** | `rgb(53 49 42)` on `rgb(244 239 231)` = **11.3** | 4.5 | PASS |
| `card-title` | text | `rgb(237 233 225)` on `rgb(37 34 29)` = **13.09** | `rgb(18 15 9)` on `rgb(239 233 225)` = **15.86** | 4.5 | PASS |
| `filter-trigger` | text | `rgb(237 233 225)` on `rgb(30 27 22)` = **14.17** | `rgb(18 15 9)` on `rgb(244 239 231)` = **16.71** | 4.5 | PASS |
| `focus-ring` | ui | `rgb(216 156 252)` on `rgb(30 27 22)` = **8.24** | `rgb(127 45 167)` on `rgb(244 239 231)` = **6.47** | 3 | PASS |
| `checkbox-check` | text | `rgb(30 27 22)` on `rgb(216 156 252)` = **8.24** | `rgb(250 250 250)` on `rgb(127 45 167)` = **7.09** | 4.5 | PASS |
| `invert-link` | text | `rgb(216 156 252)` on `rgb(37 34 29)` = **7.61** | `rgb(127 45 167)` on `rgb(239 233 225)` = **6.14** | 4.5 | PASS |
| `project-avatar` | text | `rgb(71 38 26)` on `rgb(255 155 120)` = **6.55** | `rgb(49 10 0)` on `rgb(205 95 55)` = **4.5** | 4.5 | PASS |
| `notify-title` | text | `rgb(237 233 225)` on `rgb(45 42 36)` = **11.81** | `rgb(18 15 9)` on `rgb(232 227 218)` = **14.96** | 4.5 | PASS |
| `notify-body` | text | `rgb(179 175 168)` on `rgb(45 42 36)` = **6.55** | `rgb(53 49 42)` on `rgb(232 227 218)` = **10.12** | 4.5 | PASS |
| `option-count` | text | `rgb(179 175 168)` on `rgb(37 34 29)` = **7.25** | `rgb(53 49 42)` on `rgb(239 233 225)` = **10.72** | 4.5 | PASS |
| `badge-attention` | text | `rgb(66 43 13)` on `rgb(238 169 83)` = **6.59** | `rgb(76 46 0)` on `rgb(250 171 63)` = **6.46** | 4.5 | PASS |
| `filter-chip` | text | `rgb(30 27 22)` on `rgb(237 233 225)` = **14.17** | `rgb(244 239 231)` on `rgb(18 15 9)` = **16.71** | 4.5 | PASS |
| `drop-tint-border` | ui | `rgb(216 156 252)` on `rgb(30 27 22)` = **8.24** | `rgb(127 45 167)` on `rgb(244 239 231)` = **6.47** | 3 | PASS |

**结论：双模 16 对 × 2 = 32 实测全过，0 未过；全域最低比值 4.5:1（亮模 project-avatar，贴 4.5 线过）。**

## 实测抓出并修掉的一处（本票唯一色面改动）

`notify-banner` 正文旧配对 `--text-dim × --surface-secondary`：暗 3.12:1 / 亮 **2.73:1**——低于 spec/22 §1.7 给 `--text-dim` 定的 floor 3（正典门控对是 text-dim × --background；本面底是 surface-secondary，配对是 #114 面自造、未进正典账）。12px 正文按 AA 需 4.5。处置：换角色正确的次级文本 token `--muted-foreground`（仓内 todo-card 时间/列计数同款习语），修后暗 6.55 / 亮 10.12（上表 notify-body 行）。token 值零改动（shadcn.css 冻结），只动消费面的槽引用。

## 观察（不改，记录在案）

`sidebar-selected-pill` 行 fg = muted-foreground：选中行的 `text-foreground`（ROW_SELECTED）与行基底 `text-muted-foreground`（ROW_BASE）在无 tailwind-merge 的模板串里共存，编译序让 muted 恒胜——**#414 以来的既有渲染态**（选中信号由 pill 承担，本票探针双模 5.88/9.26 全过）。类名载体退役后此冲突面归 #952/#953 终账，不在本票动（动了是视觉语义变更，越 D2 授权外的行为面）。
