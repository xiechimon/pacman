# #1005 逐面人审对照表（判决 → 旧正典 → 新正典 → 探针/截图）

口径：#980 裁决②④ + ADR 0012 D1（registry 默认几何为正典）+ 2026-10-08 协调更正
（对齐 = 逐件对照 `scripts/ui-upstream-snapshots.json`，非「方角」）。截图见 `shots/`。

| 面 | 判决来源 | 旧正典 | 新正典（registry 默认） | 探针/截图 |
|---|---|---|---|---|
| skills 搜索盒 | #981 input-group 引入 | div 盒 + 零装饰 Input + #388 outline 环 | InputGroup + Addon(Search) + InputGroupInput（rounded-lg 官方环） | shots/skills-data |
| skills 排序盘 | #982 dropdown 回源 | V2 壳 rounded-none + clip-path 箭头 + plate-shadow | DropdownMenuContent 默认 rounded-lg/zoom-95 | shots/skills-data |
| skills/secrets/mcp 行卡 | #983 panel→Card 族 | CARD_SKIN_CLS 灭皮（ring-0/自描边/自底/12px） | Card 默认 rounded-xl/ring-1/bg-card | shots/skills-data、mcp-rows |
| 空态（skills/secrets/mcp/api-keys） | registry Empty 默认 | 左对齐零间隙列 + h2/p | Empty 居中 compound；**h2/p 语义保留**（实审裁决 2） | shots/*-empty、api-keys-empty |
| StatusPill / slot chip | #983 badge 零皮 | rounded-[4px]/11px 灭皮 | Badge secondary/outline 默认 rounded-4xl | shots/machines、providers-pi |
| machines 添加钮 / team 创建槽 | registry Button | ghost 七通道中和 + 46/76px 灭皮 | outline 默认 + border-dashed（dashed 为唯一语义补充） | shots/machines、team-grid |
| machines chief 徽标 | #983 badge | 手写 span pill | Badge outline 默认 | shots/machines-chief |
| providers runtime tabs | #982 tabs 回源 | SEG_* 分段皮肤（30px/方角/--card 片） | registry default Tabs（bg-muted 组 + bg-background 选中片） | shots/providers-pi；重钉 segmented-controls:199 |
| providers RuntimeHead | #983 panel→Card | rounded-(--radius-popover) 自描边自底 | Card 默认 | shots/providers-pi |
| account 语言 dropdown | #983 floating-shell 族拆→Popover | FloatingShell+ClickCatcher 卡内锚定 + V2 壳 | registry Popover（Portal+Positioner，rounded-lg）；外点原生穿透（实审裁决 3） | shots/account-lang-open |
| account/team 卡盒 | #983 panel→Card | Panel outlined 12px + 逻辑角 11px | Card rounded-xl + 逻辑角 calc(radius-xl−1px) | shots/account、team-grid |
| team 布局钮 | #982 tabs 回源 | SEG_* | registry default Tabs | shots/team-grid；重钉 segmented-controls:199 |
| team Agent 卡 | #983 Card 皮肤 | rounded-(--radius-popover)+border+--secondary | rounded-xl+ring-1+bg-card（Card 同配方，Link 承载） | shots/team-grid |
| team-chart 节点/创建槽 | bespoke（#981 划出 registry） | rounded-[8px] 参考产品实测 | **保留 8px**（实审裁决 1，登记偏离） | shots/team-chart |
| api-keys 行/明文块 | #983 Card | rounded-(--radius-popover)+--secondary | Card 默认 | shots/api-keys-rows |
| machine-authorize 卡/钮 | #980 裁决④ | rounded-[12px]+shadow-lg / 32px·13px 钉回 | Card 默认 rounded-xl / Button 默认 | shots/machine-authorize |
| 资源/api-key 表单 | #981 field 引入 | LABEL_CLS 手排 rhythm | Field/FieldLabel/FieldDescription/FieldError compound | shots/dialog-secret、dialog-provider-picker |
| ghost 文字钮（返回/添加模型/disclosure/快捷） | #982 button 回源 | 七通道中和灭 hover/按下 | registry ghost 默认（hover bg-muted、按下位移回归） | shots/dialog-* |
| shell「+ 新建」/ team「设置」 | 2026-10-08 裁决（--primary neutral） | text-(--card-button) 品牌墨当文字 | registry link 档 text-primary | shots/skills-data、team-grid |
| spot 强调（语言勾、皇冠） | #991 Q10（激活态/强调面留品牌） | --card-button | **保留** --card-button（spot 强调，非文字档） | shots/account-lang-open、team-chart |

探针终态：`probe/probe-comparison.md` 127 行 KEPT / 0 DRIFT / 0 VIOLATION；唯一几何重钉 =
team 布局钮（segmented-controls:199，已重钉并绿）。三方归因见 README ②。
