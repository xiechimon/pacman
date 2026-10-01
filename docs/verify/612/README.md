# #612 证据索引——详情对话面用户话语单源 + markdown 渲染 + 简报卡

日期 2026-10-02。live 全栈真路径：verify-pacman 隔离栈（server 8793/8794 +
vite dev 5275/5276 + scratch PACMAN_HOME）+ stub LLM（8919，20s 门控轮）+
真 daemon（worktree 代码，`verify-mbp` / `verify-base` 两机名）。

## 场景复现（before/after 同一脚本）

1. seed：provider(stub-gw) → agent(verify-builder) → api-key → project →
   附件（grant + multipart upload，240×140 PNG）→ 任务 A（markdown spec：
   h1/h2、bullet、css 围栏、行内 code、附件 token 独立行）+ 任务 B（fresh 态，
   markdown spec、无附件）。
2. 派发 A（withPlan=true，POST builds）→ plan 步 claimed 后 2s 发 steer
   （POST conversations/{build}/messages，含 css 围栏的 markdown）→ confirm 关口
   POST steps {action:"confirm"} → build 步跑完 → phase=review。
3. Playwright（1440×732，chromium）截详情页 dark/light、线程列、简报卡特写、
   fresh 态 dark/light；DOM 事实探针取 computed style 与气泡清单。

before = origin/main（44b4266）检出为 /tmp 基线 worktree、同脚本重放；
after = 本分支代码。两栈独立端口/数据根，互不干扰。

## 文件

| 文件 | 内容 |
| --- | --- |
| before-01-detail-dark.png | 改前详情页（dark）：裸排 spec + 432px 任务原文气泡墙 ×2 + 泄漏的续轮指令气泡 |
| before-02-detail-light.png | 同上（light） |
| before-03-thread-top-dark.png | 改前线程列全览（dark） |
| before-04-spec-card-dark.png | 改前描述区特写：透明底、无边线、`#`/`**` 字面量、图片附件原尺寸裸图 |
| before-05-fresh-dark.png | 改前 fresh 态：「尚无描述」与下方裸排 spec 同屏自相矛盾 |
| before-06-fresh-light.png | 同上（light） |
| after-01-detail-dark.png | 改后详情页（dark）：简报卡（markdown + 附件缩略 chip）+ 仅真实用户话语气泡 |
| after-02-detail-light.png | 同上（light） |
| after-03-thread-top-dark.png | 改后线程列全览（dark） |
| after-04-spec-card-dark.png | 改后简报卡特写：h1/h2、bullet、围栏代码块、图片缩略 chip |
| after-05-fresh-dark.png | 改后 fresh 态：占位行让位，简报卡入 720px 居中轴 |
| after-06-fresh-light.png | 同上（light） |
| dom-facts-before.json | 改前 DOM 探针：specBlock 透明底/0 边线/0 圆角/14px/0 标题元素；5 气泡（432px 墙 ×2、steer 裸文本 120px、泄漏指令、确认） |
| dom-facts-after.json | 改后 DOM 探针：specBlock rgb(31,31,35)/1px/12px/15px/2 标题/2 bullet/1 围栏/chip 带端点 href；2 气泡（steer markdown 66px 含代码块、确认 24px）；taskline null |
| messages-after.json | 改后同一 build 的 wire 行（10 条）：合成行仍在库（数据面不动），只由呈现层按 shared 词表过滤 |

## 回归

- apps/web e2e 全量 572/572 绿（E2E_PORT 8401，含新增 spec-brief-card 6 条 +
  transcript-user-words 6 条、chat-type-measure 气泡几何钉扎、merge-reject）。
- apps/web vitest 160/160（含新增 transcript-user-words 11 条、i18n-coverage）。
- apps/server 566/566、apps/daemon 217/217、packages/shared 200/200。
- verify-pacman 探针：drive-detail-pane 19/19 ok、drive-attachments allOk=true
  （栈坐标 8793/5275，证据 `.claude/verify-evidence/20261002-073326-detail-pane`、
  `2026-10-01T23-33-44-555Z-attachments`——本地目录，复核以本仓 docs/verify/612 为准）。
