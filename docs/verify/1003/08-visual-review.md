# 动效 / 几何改动面 — 人审对照表（#1003）

每行 = 一个有意视觉变更：判决出处 → 旧正典 → 新正典 → 探针/钉扎状态。
「判决内」= #982 漂移审计判决表 / #991 十三问正典 / #983 手写件判决表直接
授权；无一行是本票自发的视觉发明。

| 面 | 旧正典 | 新正典 | 判决 | 钉扎状态 |
|---|---|---|---|---|
| checkbox 盒 | 16px 方角（radius 0）、--card-button 实底 + currentColor 勾、手作三值动效（100/140/90ms） | registry：16px radius 4px、border-input、data-checked:bg-primary、上游 transition-colors；三态 = MinusIcon 零皮肤映射 | #982「应回（最重）」+ #952 语义保留 | checkbox-unified.spec 重钉（几何 4px/16px/gap8/13px、data-slot 锚）；旧手作三值探针删除（动效内容由 #989 hash 账本冻结） |
| input / textarea 圆角 | rounded-none（方角语言 §2.6-6） | rounded-lg（registry 默认） | 裁决④「registry 几何赢」；#1002 裁决③显式归本票 | 几何探针随全量绿；视觉 e2e 无字面 radius 钉（04 gate 面） |
| button focus 环 | 2px solid --focus-ring outline（#388）+ transition 窄写（#15） | 官方 outline-none + focus-visible:ring-3 ring-ring/50（box-shadow）+ transition-all | #982 判决①②（窄写随环形态回归消失） | overlay-focus.spec 重钉：配方无关键正向断言 + UA 蓝框负断言 + 250ms 过渡落定 |
| button brand 档 | --card-button 实底 + --text-on-accent 白字 + hover brightness(1.07) + disabled --spot-disabled | 档退役；主 CTA = default 档（bg-primary，E 暖灰中性） | #982 判决③ + #991「primary 保持 neutral、品牌色只存 token 层」 | 36 处/26 文件迁移；accent-typo P4 hover-brightness 探针随档删除（注记在 spec）；new-task-dialog Kbd 角标墨 white→currentColor（暗底/亮底双模跟随按钮前景）；project-new-page disabled:bg-(--card-button) 残留清除 |
| switch | thumbClassName 扩展口 | 上游原样（口删除） | #982「死口，0 消费点直删」 | 零消费零钉扎 |
| avatar | XMON-14 偏离（无 after 环、Image 无 skin 类）+ seeded-avatar contents 根 | 上游现形：size prop、after: 发丝环（border-border + mix-blend）、Image aspect-square size-full rounded-full、Badge/Group/GroupCount 出口；seeded-avatar 定尺盒 | #982「重拉即回正」+ #983 联动判决（弃 contents 根恢复定尺盒） | shadcn-primitives.spec 重钉（定尺盒契约：Root 24×24 真盒、img 24×24 不变、chip 44 不变）；avatar-dicebear / chief-fab 48×48 / user-menu-trigger 间距探针全绿未动 |
| tabs | segmented（page-tabs-group/page-tab 类）+ bare（零 chrome）+ 全类串重写 default/line + context 递 variant | 上游原生 default/line（base 类 + data-[variant] 机制）+ TabsIndicator 零 chrome 透传保留；皮肤 = SEG_*/TAB_CLS 常量 + 上游基类中和段（h-8→30px/auto、font-medium→400、gap-0、data-active 漆面钉回） | #982「应回」+ #991 批次表「segmented/bare 档回」；TabsIndicator 去留显式归 #1009 | segmented-controls.spec 全绿（shell Button 承载面未动 + Tabs 承载面经中和段等值）；chief-tab-indicator pill 过渡钉（0.15s×4 列表）未动 |
| dropdown / popover 动效 | scale-fade：zoom-in/out-98 + ease-out、去 slide-in（#790/#805 V2 正典） | 上游默认：zoom-95 + slide-in-from-*-2 + duration-100 | #991 Q9「动效 = base-nova 形态一部分，保留自定义 = 皮肤适配超出语义映射」；ADR 0009 D3② 修订入账归 #1013 | dialog-shell / floating-shell 保留旧动效至 #1008 壳退役（本票不动）；探针面 chief-drawer-model.spec 的落定等待与动效名目无关，全绿 |
| 图标（dialog X / dropdown Check+ChevronRight / checkbox Check） | 生成件缝（strokeWidth 2.5、默认 14/15px） | lucide-react（XIcon/CheckIcon/ChevronRightIcon，strokeWidth 2、件内 size 档） | #982 横切 2（iconLibrary=lucide 契约下缝 = 皮肤）；lucide-react 入锁经用户批准 | select.tsx 仍在缝上（#1010 退役票）；icons/ 业务定制图标（Chief* 等）不在本票 |
| dialog / alert-dialog | 落后上游一版（cn-font-heading 缺） | 现版对齐；cn-font-heading 为宿主样式表 utility，R4 剥落（仓不 vendor） | #983 横切「开工先 add --diff 对齐」 | 零消费者现状不变；alert-dialog 本地已与新上游逐字同（对齐 = no-op） |
| 新引入面 | — | tooltip / field / label / input-group / separator（field 的 registryDependency）落地，零消费者 | #981 建议 4 件 + #991 正典 | 注册 pristine（tooltip 除外：z 梯 deviated）；biome per-file override ×2（a11y 规则与冻结上游形态冲突面，ui-registry-gate 守完整性） |

## 双模外观抽检

- `accept-checked.png` / `accept-unchecked.png`：accept 弹层复选行（E 暗模，
  官方几何 + primary 开态）。
- `provider-checked.png` / `provider-unchecked.png`：provider 表单 Bearer 行
  （id 契约面）。
