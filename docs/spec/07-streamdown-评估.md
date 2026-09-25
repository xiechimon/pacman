# 07 · streamdown 引入评估（W4 #290——只评估不实装）

> 状态：**评估稿，未裁决**。本册 = 05 册 §6.3 后票（「streamdown 归后票评估——引入即
> DOM 契约变更需矩阵重验」）的产出物，供产品负责人晨间裁决。
> 红线：本册不伴随任何代码改动。

## 1. streamdown 是什么

[外部知识·未核验] streamdown = Vercel 开源的流式 markdown 渲染器（React），为 LLM
流式输出设计：未闭合的代码块/表格/列表在中途渲染不抖动（partial markdown 容错）、
内置组件样式、数学公式（KaTeX）与打字机动画面。典型消费方 = Vercel 的 AI chatbot
模板。**引入前需联网核验当前版本/许可证/依赖面**（见 §6 核验清单）。

## 2. 它会替换什么（measured，仓内现状）

本仓 transcript 渲染 = **自有分段渲染器**（05 §6.3）：

- `apps/web/src/detail/transcript.tsx`（272 行）+ `segments.tsx`——按 `TranscriptItem`
  分段模型渲染：user 行 / robot `paragraphs[].segments[]`（内联样式 code/link）/
  bullet / footer.seconds / note / fail 卡；
- 数据模型 = fixture 与 live 两模式**同一呈现面**（fixture 的 transcript 段落记录
  与 daemon 上传的终稿消息走同一 mapper 投影）——这是 parity 像素契约的根基。

## 3. DOM 契约变更面（引入 = 什么会变）

1. **分段模型让位**：streamdown 消费的是**纯 markdown 字符串**，不是本仓的
   `paragraphs/segments` 记录模型。引入后要么（a）把消息 content 侧统一成
   markdown 串（mapper/fixtures 双改），要么（b）分段模型→markdown 的序列化桥
   （双源真理，长期税）。
2. **像素契约全量重验**：transcript DOM 结构整体换血——parity 全矩阵 174 行中
   **凡带会话面的行全部重定基线**（board 空态除外，估 60-90 行，覆盖 16/17/26/27
   详情族 + chief 面族）。重定基线 = 一次性成本（#109 形态），但**此后 fixture
   transcript 记录模型与 DOM 解耦**（fixture 面要从「分段记录」迁「markdown 串」）。
3. **流式面**：现 text_delta 直写 `liveTextStore`（纯文本追加）；streamdown 的
   partial-markdown 流式渲染可换掉这一面——收益位主要在此。

## 4. 成本与收益

| | 估量 |
|---|---|
| 引入成本 | mapper/fixtures 双侧模型改造 + 60-90 parity 行重定基线 + 组件样式对齐 tokens.css 主题（light/dark 双态）+ bundle +（streamdown + 依赖，[外部知识] 数量级 ~50-100KB） |
| 收益 | 富 markdown（表格/标题/数学）+ 流式 partial 容错（现渲染器对未闭合结构无面）+ 少维护一个自研渲染器 |
| 不引入的后果 | 富面继续缺（表格/数学不渲染为结构）；流式面保持纯文本追加（现状可用） |

## 5. 建议（评估人立场，非裁决）

**暂缓引入**。理由：
1. 05 册定位 pacman 为自主产品——transcript 富 markdown 无真实使用反馈驱动的
   需求证据（复刻期的像素契约已解除，但「用户要表格渲染」未涌现）；
2. 引入即 174 行矩阵的重定基线批 + fixture 模型迁移——一次性大成本砸在无实测
   需求的面上；
3. **建议的触发线**：当真实使用中出现「贴 markdown 表格/长文档」的投诉或 chief
   产出富文档的常态化证据时再启，且届时以 live 面先行（parity 行按 #109 形态
   分批重定基线，不搞一刀切）。

## 6. 若裁决引入——核验清单（晨间第一步）

- [ ] streamdown 当前版本 / 许可证 / 依赖树 / bundle 实测（agent-reach 联网核验）
- [ ] 与 React 19 / Tailwind 4.3.3 共栈面
- [ ] 主题 tokens.css 双态（light/dark）样式对齐方案
- [ ] 分段模型 → markdown 串的迁移策略（fixtures 记录模型同迁）
- [ ] parity 重定基线批的行清单与顺序（#109 rebaseline 形态）

## 裁决位

留给产品负责人（2026-09-26 晨）：引入 / 暂缓（建议）/ 触发线调整。
