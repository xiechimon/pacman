// 任务详情描述区（#310, r9 §3.1）：用户新建任务时填写的 spec 文本 + 附
// 件 token 渲染。新建任务对话框把 spec textarea 内容（含附件 token）随
// POST /api/projects/{id}/todos 入 todo.spec，本组件据此渲染。
//
// #612 起本组件是「用户原话」的唯一展示面（daemon 把 title+spec 合成 prompt
// 记进会话，此前同一份文本又以首条用户气泡二次呈现——套娃；mapper 现按
// shared records/prompts 词表过滤该行）。渲染 = ChatMarkdown 单源（agent
// 回复、用户气泡、任务简报同一套块级语法：标题/列表/围栏/附件 token 行），
// 此前这里只有 \n\n 切段 + inline code chip，`#`/`-`/围栏全按字面裸排，且
// .spec-block/.spec-chip 三个类从未有过样式规则。
//
// dirty 钩：本票范围内 spec 详情面只读渲染（无编辑 UI）——#310 AC 只要求
// 「详情页可见」,编辑 + dirty 闸归 #318 后续编辑器票,届时复用本组件的受控
// spec 接口即可。

import { ChatMarkdown } from './chat-markdown.js';

interface SpecBlockProps {
  /** todo.spec 原文（含 `![name](attachment:key)` token 行）。 */
  spec: string;
}

export function SpecBlock({ spec }: SpecBlockProps) {
  return (
    <section className="spec-block">
      <ChatMarkdown text={spec} />
    </section>
  );
}
