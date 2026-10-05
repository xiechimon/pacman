# #947 secondary 域对比度实测（better-colors，不许估）

测法：`drive-947-secondary.mjs`（运行产物在 `live-stack/drive-947-secondary/`）在 live 栈（8795/5277，独立 PACMAN_HOME）上取**渲染元素 computed color**（团队卡三行 / 设置 link / 创建槽 / FAB 字形 / 语言触发器与开盘行勾 / 开关 / 密钥行）与 **token 解析对**（probe-div 走 var() 解析——chart 面、空态、弹窗面这类不恒在渲染的角色），WCAG 2.x 相对亮度公式算比值。透明/半透明底一律合成到实际画布（--background）再算；`color-mix` 定义的槽（--spot-soft）computed 序列化成 `color(srgb …)`，解析器按 #921 工具记录的折算规则无损转回 rgb。floor：文本 4.5、非文本 UI 3.0。双主题各 28 对（同一配对集）。

| 面 | 类型 | 暗模 fg / bg / 比值 | 亮模 fg / bg / 比值 | floor | 判定 |
|---|---|---|---|---|---|
| `team-card-name` | text | `rgb(237 233 225)` on `rgb(45 42 36)` = **11.81** | `rgb(18 15 9)` on `rgb(232 227 218)` = **14.96** | 4.5 | PASS |
| `team-card-model` | text | `rgb(179 175 168)` on `rgb(45 42 36)` = **6.55** | `rgb(87 83 76)` on `rgb(232 227 218)` = **5.98** | 4.5 | PASS |
| `team-card-role` | text | `rgb(179 175 168)` on `rgb(45 42 36)` = **6.55** | `rgb(87 83 76)` on `rgb(232 227 218)` = **5.98** | 4.5 | PASS（换槽后） |
| `secondary-link` | text | `rgb(216 156 252)` on `rgb(37 34 29)` = **7.61** | `rgb(127 45 167)` on `rgb(239 233 225)` = **6.14** | 4.5 | PASS |
| `team-create-slot` | text | `rgb(179 175 168)` on `rgb(37 34 29)` = **7.25** | `rgb(87 83 76)` on `rgb(239 233 225)` = **6.34** | 4.5 | PASS |
| `secondary-fab-glyph` | ui | `rgb(179 175 168)` on `rgb(37 34 29)` = **7.25** | `rgb(87 83 76)` on `rgb(239 233 225)` = **6.34** | 3 | PASS |
| `chart-crown` | ui | `rgb(216 156 252)` on `rgb(62 51 60)` = **5.77** | `rgb(127 45 167)` on `rgb(223 207 217)` = **4.95** | 3 | PASS |
| `chart-provider` | ui | `rgb(237 233 225)` on `rgb(45 42 36)` = **11.81** | `rgb(18 15 9)` on `rgb(232 227 218)` = **14.96** | 3 | PASS |
| `chart-model` | text | `rgb(179 175 168)` on `rgb(37 34 29)` = **7.25** | `rgb(87 83 76)` on `rgb(239 233 225)` = **6.34** | 4.5 | PASS（换槽后） |
| `chart-name` | text | `rgb(237 233 225)` on `rgb(37 34 29)` = **13.09** | `rgb(18 15 9)` on `rgb(239 233 225)` = **15.86** | 4.5 | PASS |
| `chart-create` | text | `rgb(179 175 168)` on `rgb(37 34 29)` = **7.25** | `rgb(87 83 76)` on `rgb(239 233 225)` = **6.34** | 4.5 | PASS（换槽后） |
| `title-glyph` | ui | `rgb(179 175 168)` on `rgb(37 34 29)` = **7.25** | `rgb(87 83 76)` on `rgb(239 233 225)` = **6.34** | 3 | PASS（换槽后） |
| `lang-trigger` | text | `rgb(237 233 225)` on `rgb(37 34 29)` = **13.09** | `rgb(18 15 9)` on `rgb(239 233 225)` = **15.86** | 4.5 | PASS |
| `lang-row` | text | `rgb(237 233 225)` on `rgb(37 34 29)` = **13.09** | `rgb(18 15 9)` on `rgb(239 233 225)` = **15.86** | 4.5 | PASS |
| `lang-check` | ui | `rgb(216 156 252)` on `rgb(37 34 29)` = **7.61** | `rgb(127 45 167)` on `rgb(239 233 225)` = **6.14** | 3 | PASS |
| `switch-track-off[§4-1]` | obs | `rgb(6 5 4)` on `rgb(37 34 29)` = **1.28** | `rgb(201 196 188)` on `rgb(239 233 225)` = **1.44** | 记录 | 观察项（见下） |
| `switch-thumb-off[§4-1]` | obs | `rgb(237 233 225)` on `rgb(6 5 4)` = **16.78** | `rgb(244 239 231)` on `rgb(201 196 188)` = **1.52** | 记录 | 观察项（见下） |
| `switch-track-on` | ui | `rgb(237 233 225)` on `rgb(37 34 29)` = **13.09** | `rgb(18 15 9)` on `rgb(239 233 225)` = **15.86** | 3 | PASS |
| `keys-empty-desc` | text | `rgb(179 175 168)` on `rgb(37 34 29)` = **7.25** | `rgb(87 83 76)` on `rgb(239 233 225)` = **6.34** | 4.5 | PASS |
| `keys-empty-title` | text | `rgb(237 233 225)` on `rgb(37 34 29)` = **13.09** | `rgb(18 15 9)` on `rgb(239 233 225)` = **15.86** | 4.5 | PASS |
| `keys-empty-tile` | ui | `rgb(211 207 199)` on `rgb(45 42 36)` = **9.21** | `rgb(53 49 42)` on `rgb(232 227 218)` = **10.12** | 3 | PASS |
| `keys-cta-invert` | text | `rgb(30 27 22)` on `rgb(216 156 252)` = **8.24** | `rgb(255 255 255)` on `rgb(127 45 167)` = **7.41** | 4.5 | PASS |
| `keys-row-chevron` | ui | `rgb(179 175 168)` on `rgb(45 42 36)` = **6.55** | `rgb(87 83 76)` on `rgb(232 227 218)` = **5.98** | 3 | PASS（换槽后） |
| `apikey-label` | text | `rgb(179 175 168)` on `rgb(37 34 29)` = **7.25** | `rgb(87 83 76)` on `rgb(239 233 225)` = **6.34** | 4.5 | PASS |
| `apikey-toolname` | text | `rgb(211 207 199)` on `rgb(37 34 29)` = **10.2** | `rgb(53 49 42)` on `rgb(239 233 225)` = **10.72** | 4.5 | PASS |
| `apikey-quickbtn` | text | `rgb(179 175 168)` on `rgb(37 34 29)` = **7.25** | `rgb(87 83 76)` on `rgb(239 233 225)` = **6.34** | 4.5 | PASS |
| `keys-row-name` | text | `rgb(237 233 225)` on `rgb(45 42 36)` = **11.81** | `rgb(18 15 9)` on `rgb(232 227 218)` = **14.96** | 4.5 | PASS |
| `keys-row-mask` | text | `rgb(179 175 168)` on `rgb(45 42 36)` = **6.55** | `rgb(87 83 76)` on `rgb(232 227 218)` = **5.98** | 4.5 | PASS |

**结论：双模 28 对 × 2 = 56 实测，门控对 26×2 全过、0 未过；全域最低门控比值 4.95:1（亮模 chart-crown，非文本）。**

## 实测抓出并修掉的五处（本票唯一色面改动，#908 裁决 2 授权的消费面槽引用）

旧 secondary.css 有五处把 `--text-dim` 用在真文本/真图形上，配对底不是正典门控的 `--background`，全部低于 floor（修前实测）：

| 面 | 旧配对 | 暗模 | 亮模 | floor | 处置 |
|---|---|---|---|---|---|
| `team-card-role`（职责行 12px 文本） | dim × surface-secondary | 3.12 | **2.73** | 4.5 | 槽引用 → `--text-tertiary`（修后 6.55/5.98） |
| `chart-model`（模型行 10px 文本） | dim × surface | 3.46 | **2.89** | 4.5 | 同上（修后 7.25/6.34；与卡面模型行同墨，域内一致） |
| `chart-create`（虚线创建卡 12px 文本） | dim × surface | 3.46 | **2.89** | 4.5 | 同上（与 grid 创建槽 tertiary 墨统一） |
| `title-glyph`（壳标题 chevron 图形） | dim × surface | 3.46 | **2.89** | 3.0 | 同上（修后 7.25/6.34） |
| `keys-row-chevron`（行箭头图形） | dim × surface-secondary | 3.12 | **2.73** | 3.0 | 同上（与行内 icon tertiary 墨统一） |

与 #943 的 notify-body 处置同型（该处换 `--muted-foreground`，本域五处全是元数据/图形墨，换域内既有同角色 `--text-tertiary`——暗模两槽同值 #b3afa8，亮模 tertiary 比 muted 软一档，保住卡内 名字>模型>职责 的墨阶）。**token 值零改动**（shadcn.css/tokens.css 冻结），只动消费面的槽引用。

## 观察（不改，记录在案）

- **Switch OFF 态 track/thumb 软对比**（`switch-track-off` 暗 1.28 / 亮 1.44；`switch-thumb-off` 亮 1.52）：这是 spec/22 §1.5 实测封版的冻结件正典皮肤（track `--input`、thumb `--background`），§4-1 已记录亮模 thumb 1.52:1 为已知打磨项——状态可辨由 track 翻转承载（OFF `--input` → ON `--primary`，本表 `switch-track-on` 13.09/15.86），WCAG 1.4.11 满足；给 thumb 加描边/投影属件级改动，处置权在视觉方向票（#909），域票不自行加（§4-1 处置原文）。
- `--text-dim` 的正典门控对（dim × background，floor 3）不受本票影响；本域清零后 secondary 面已无 dim 消费点。
