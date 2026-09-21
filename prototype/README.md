# prototype · todos.dev 双屏像素级复刻试做（issue #42）

THROWAWAY PROTOTYPE — 不入库主干，结论回写 #42 后由 throwaway 分支保存。
目的：验证「像素级 1:1」口径的实际工作量与保真度上限，产出难点清单与每屏工时估算输入。

## 运行

仓库根起静态服务（字体与截图走相对路径，需 serve 整个 repo）：

```bash
python3 -m http.server 8742
# 浏览器开：
#   http://localhost:8742/prototype/compare.html        对拍台（真截图 vs 复刻，overlay/并排）
#   http://localhost:8742/prototype/board.html          屏 1 看板（?theme=dark|light）
#   http://localhost:8742/prototype/todo-detail.html    屏 2 详情流（?phase=fresh|plan|review）
```

页面底部 dark/light 切换 pill 是原型 harness（`?noharness=1` 隐藏，对拍截图用）。

## 内容

- `replica.css` — 设计 token + 组件样式。token 双源：landing 公开 CSS（r1 §4）与 workspace 截图实测采样（见下）。
- `board.html` — 屏 1：看板主页（侧栏 240 / 顶栏 / 通知 banner / 6 列 + 卡片 + 空态）。
- `todo-detail.html` — 屏 2：项目页（48px 图标轨）+ 任务列表 + 右侧任务面板消息流
  （开始执行卡 / 流式文案 / 方案·v1 卡 / 确认方案 / 执行 transcript 工具行 / composer），三 phase 变体。
- `compare.html` — 对拍台：真截图（r2/r3 assets）与 iframe 复刻 overlay（透明度滑杆）或并排。
- `fonts/` — Inter / JetBrains Mono variable woff2，字节级同 r1 记录（48,256 / 40,404 B），直接取自 todos.dev 公开静态资源。
- `shots/` — 对拍产物：mine-*.png（复刻截图）、blend-*.png（50% 叠图，鬼影=偏差）。

## 实测口径（对拍基线）

- 真截图 PNG 宽度 ≠ CSS 宽度：r2 批 1190px = 1280 CSS（×0.9297），r3 批 1206px = 1280 CSS（×0.9422）；
  r2 看板窗口宽 ≈1422 CSS（顶栏标题居中反推），截图为左 1280 裁切。对拍时复刻按 1422×800 视口截图再裁左 1280 归一。
- SSIM（ffmpeg，归一后同尺）：看板 dark vs 28 全帧 **0.929**；看板 light vs 01 左 700CSS 干净区 **0.870**
  （01 含「正在删除…」toast 与开着的任务面板两个状态元素，复刻未建模， penalize 属预期）；
  详情面板 vs 58（plan 态，面板区裁切）**0.713**。
- 叠图鬼影读数：剩余偏差集中在 ±1–3px 文本基线与 CJK 字形渲染差异，结构层（列宽 299/pitch 313、banner 60–130、
  卡顶 182、侧栏行 pitch 38.5、面板左缘 810）已对齐。
- **源截图自身是裁切**：两批 PNG 均为 ~1422 CSS 宽窗口的左 1280 裁切（r2 ×0.9297、r3 ×0.9422，r3 窗口高 659 CSS）。
  任务面板右缘 = 窗口右缘 1422，故面板右侧 ≈142 CSS px（header 右图标组末端、composer 发送按钮等）
  在全部 r3 与 r2 面板截图里**不可见**；复刻该区域为 [推断]（面板宽 612 由 r2-01 窗口算式反推）。
- **图标来源**：workspace 为 RNW 原子类 DOM、无 sprite 可扒，盘点只留截图未留 DOM；本原型 40+ 枚图标为
  目测手绘 inline SVG（lucide 风 stroke），仅 r1 §6 记录的 3 枚 path（check/X/clock）为实测原文。
  逐枚形状/stroke 偏差是叠图鬼影的主要来源之一。

## r5 补拍后（第二轮，#48 素材）

- 图标：45 枚目测手绘 SVG 已全量替换为 `icons.json` 真 markup（r5 dump，viewBox 24 单源、currentColor 主题无关）。
- 几何改按 r5 DOM/像素实测：content-left 43、列宽 307/gap 15、列底固定 y=840（banner 有无决定列顶 62/145）、
  面板 560（DOM）但 fresh 截图实测 ~492 —— **面板宽随状态变，开放项**；顶栏标题居中公式不成立
  （r5-02 中心 1013、r5-05 中心 600，均非几何中心），暂按 02 的 65.3% 硬编码 —— 开放项。
- 新基线 SSIM：看板 light state=r5 vs r5-02（去 toast 带）**0.911**；fresh 面板 vs r5-05 **0.915**。
- 站点漂移实锤：r2（09-19）与 r5（09-20）同元素不同位（列 left 276→283、标题居中→偏右、banner 消失）。
  **像素平价必须钉死单一截图批次为基线**，否则验收标准随上游漂移。

## r5b 生命周期补拍后（第三轮，#49 素材）

- **详情屏重建为全页模型**（`/app/todo/:id`，560 overlay 面板已下线）：header 返回·#N·芯片▾·tabs[文档|聊天]·更多/分支与PR/Token/历史·主按钮；
  流列 884 居中；composer 响应式贴底。四态参数 `?phase=planning|confirm|review|done`，芯片两套词表（列名 vs 芯片：待验收↔审核、待确认↔确认）。
- 主按钮文案表 `确认/完成/重开`（50.3×28，`确认方案` 在当前 build 不存在）；卡片主钮 42.3×25.8（`回复` 透明底）。
- **截图语义更正**：r5b §0.2 证伪 r5 §0.1「无裁切」——截图=窗口面位图，本机物理上限 ≈1293×727 CSS，
  为 1422×800 布局的左上裁切；对拍捕获法=视口 1422×800 截图后 crop 1293×727（1:1，不再 ×0.909）。
- 几何改 r5b DOM 值：列宽 277/gap 15/content-left 33（r5-02 像素读 257/307 —— **两批间站点漂移 16px**，r5b 更新更权威）。
- SSIM（1:1 新基线）：看板 light vs r5-02 **0.898**（含 16px 批间漂移 + toast）；详情待确认 vs r5b-05b **0.859**
  （CJK 文本 AA 地板 + fixed-header 位图滞后 §0.2）。
- 板端 bug 修复：board.html 注入的面板此前未按 `?panel=` 隐藏（泄漏进所有截图），已修。

## r6 基线重拍后（第四轮，#50 素材，站点又更新）

- **更新点**：侧栏导航图标统一 16×16（重绘，markup 多为同族微调）；新建任务抽屉 → 居中 dialog 672×480（`保存`+`保存并开始` 双钮）；用户菜单重构（帐号/API密钥/MCP/反馈/新功能/快捷键 收进用户菜单）；详情返回钮纯图标化。**几何/文案零漂移**（列 292 pitch、rail 40、按钮尺寸、chip 词表、主按钮文案全同 r5b）。
- **标题居中公式闭合**：居中基准 = 内容区（侧栏右缘→窗口右缘），非视口。r5 截图里标题偏右是 r5b §0.2 的 fixed-header 位图滞后假象——**截图对拍不能当几何真理，DOM 实测才是**。
- 图标 dump 刷新：r6 `icons.json` 383 条/83 唯一（15 scope），与 r5 差异：+21/−31；侧栏图标全组换代。
- 图标 dump 刷新：r6 `icons.json` 383 条/83 唯一（15 scope），与 r5 差异：+21/−31；侧栏图标全组换代。
- 原型改动：标题/tab 组回退内容区居中（50%）、详情流列右贴（宽 876 右缘 16）、nav 图标 16×16、行距 pitch 39、tab 组 68×28。

## 像素级复刻难点清单（票面产出 1）

1. **字体许可**：Inter / JetBrains Mono 为 OFL 可内嵌；但 Agent 头像字体 Lorelei 仅 CC0 素材含 attribution 义务（r1 §2.2），
   复刻需保留署名串；CJK 无 webfont，跨平台观感依赖访客系统字体——「像素级」在 CJK 正文上只能承诺布局与字重，不能承诺字形。
2. **图标**：workspace 为 RNW 原子类 DOM，图标无 sprite 可扒，逐枚目测重画（本原型 40+ 枚 inline SVG），
    stroke 粗细/圆角需逐枚对拍修正，是工时黑洞。
3. **动效**：r1 §4.4 13 个 keyframes（机器人眨眼/沙漏/text-draw）+ 全站 `motion-reduce:` 降级约定；静态对拍覆盖不到，需逐条补。
4. **密度/状态矩阵**：6 列 × 卡片态 × 面板 3 phase × 双主题 × 侧栏展开/收起 = 组合爆炸；
   单屏对拍通过 ≠ 状态间切换一致（计数联动、chip 变色、composer 占位符换文案）。
5. **双源 token**：landing 公开 CSS token 表与 workspace 实测采样不一致（如 dark 列底 `#09090b`、卡底 `#1f1f23`、
   light 卡底 `#fcfcfc`/白描边），复刻须以 workspace 采样为准，r1 表仅兜底——文档若不区分两处会误导实现。
7. **站点日级漂移**：r2(09-19)→r5(09-20)→r5b(09-21) 三天内：banner 消失、面板 560→全页、列位漂 16px、`确认方案` 文案下线、rail 48→40。像素平价 spec 必须钉死单一基线批次 + 记录基线日期，否则验收随上游移动。
6. **截图基线自身不齐**：两批截图缩放比不同、窗口宽不同、含瞬态元素（toast/门控弹窗），对拍前必须归一+选干净区，
   否则 SSIM 读数无意义（本原型 light 全帧 0.876 vs 干净区 0.870 的差异即来自 toast 块）。

## 每屏工时估算输入（票面产出 2）

- 屏 1 看板（含双主题）：结构 + token 0.5d；图标逐枚对拍 0.5d；状态态（折叠列/拖拽/hover/计数联动）1d；动效 0.5d → **≈2.5d**。
- 屏 2 详情流（3 phase + composer）：消息流组件 1d；plan 卡/transcript 折叠 0.5d；phase×chip×按钮矩阵 0.5d；双主题 0.5d → **≈2.5d**。
- 上述不含：⌘K 命令面板、门控弹窗、总管面板等浮层（r2 §3 清单另计），以及验收工具链（逐屏 diff 脚本）0.5d。
- 结论口径：单屏「分不出真伪」在静态+双主题下可达（本原型叠图结构层已无可见鬼影）；
  含动效与状态矩阵后每屏成本约 ×2，像素级承诺应写为「布局/色/字重平价 + 动效清单逐条兑现」，而非逐帧位图相等。
