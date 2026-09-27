// 任务详情描述区（#310, r9 §3.1）：用户新建任务时填写的 spec 文本 + 附
// 件 token 渲染。新建任务对话框把 spec textarea 内容（含附件 token）随
// POST /api/projects/{id}/todos 入 todo.spec，本组件据此渲染。
//
// 渲染策略：
//   - spec 按 \n\n 切段，每段一个 <p>
//   - 段内扫描 `![name](attachment:key)` token → 渲染成 AttachmentChip
//   - 段内文本按 `inlineSegments` 切 inline code chip（与 plan/changes
//     渲染一致，复用 mappers 的 inlineSegments）
//   - 文本无法切分时退化为 <span>
// 附件 chip 策略：
//   - image/* → 内联 <img>，src 直指 GET /api/attachments/{id}
//   - 其它类型 → 链接新标签打开（content-type 由浏览器原生处理）
//
// dirty 钩：本票范围内 spec 详情面只读渲染（无编辑 UI）——#310 AC 只要求
// 「详情页可见」,编辑 + dirty 闸归 #318 后续编辑器票,届时复用本组件的受控
// spec 接口即可。

import { inlineSegments } from '../api/mappers.js';
import type { DocSegment } from '../fixtures/records.js';

/** `![name](attachment:key)` —— key 形如 `<teamId>/<id>.<ext>`。 */
const ATTACHMENT_TOKEN = /!\[([^\]]*)\]\(attachment:([^)]+)\)/g;

interface AttachmentRef {
  /** markdown alt = 原始 fileName（取自 grantBody.fileName）。 */
  name: string;
  /** 存盘 key = `<teamId>/<id>.<ext>`，GET 端点 = `<id>`。 */
  key: string;
  /** 端点需要的纯 id：从 key 末段去扩展名。 */
  attachmentId: string;
}

/** key `<teamId>/<id>.<ext>` → `<id>`：取末段去扩展名，兼容无扩展名情形。 */
function attachmentIdFromKey(key: string): string {
  const lastSlash = key.lastIndexOf('/');
  const tail = lastSlash >= 0 ? key.slice(lastSlash + 1) : key;
  const dot = tail.lastIndexOf('.');
  return dot > 0 ? tail.slice(0, dot) : tail;
}

function parseSpec(spec: string): Array<{ segments: DocSegment[]; attachments: AttachmentRef[] }> {
  // 按双换行切段（textarea 段间距），无空段跳过
  const paragraphs = spec.split(/\n{2,}/).filter((p) => p.trim() !== '');
  return paragraphs.map((para) => {
    const segments: DocSegment[] = [];
    const attachments: AttachmentRef[] = [];
    let cursor = 0;
    // 用 matchAll + 游标推进把 token 之间的纯文本塞进 segments
    for (const match of para.matchAll(ATTACHMENT_TOKEN)) {
      const before = para.slice(cursor, match.index);
      if (before !== '') segments.push(...inlineSegments(before));
      const name = match[1] ?? '';
      const key = match[2] ?? '';
      attachments.push({ name, key, attachmentId: attachmentIdFromKey(key) });
      // 用零宽字符占位让后续段长守恒（实际 chip 单独渲染,不入 segments）
      segments.push({ text: '​' });
      cursor = (match.index ?? 0) + match[0].length;
    }
    const tail = para.slice(cursor);
    if (tail !== '') segments.push(...inlineSegments(tail));
    return { segments, attachments };
  });
}

function AttachmentChip({ ref: attachment }: { ref: AttachmentRef }) {
  const href = `/api/attachments/${encodeURIComponent(attachment.attachmentId)}`;
  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(attachment.key);
  if (isImage) {
    return (
      <a
        className="spec-chip spec-chip--image"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={attachment.name}
      >
        <img src={href} alt={attachment.name} className="spec-chip-img" />
      </a>
    );
  }
  return (
    <a
      className="spec-chip"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={attachment.name}
    >
      {attachment.name}
    </a>
  );
}

interface SpecBlockProps {
  /** todo.spec 原文（含 `![name](attachment:key)` token）。 */
  spec: string;
  /** doc-code 类的 chip className（沿用 doc pane 风格）。 */
  codeClassName?: string;
}

export function SpecBlock({ spec, codeClassName = 'doc-code' }: SpecBlockProps) {
  const paragraphs = parseSpec(spec);
  return (
    <section className="spec-block">
      {paragraphs.map((para, i) => (
        // 段顺序固定，无 id
        <p key={i} className="spec-block-paragraph">
          {para.segments.map((seg, j) => {
            if (seg.style === 'code') {
              return (
                <code key={j} className={codeClassName}>
                  {seg.text}
                </code>
              );
            }
            return <span key={j}>{seg.text}</span>;
          })}
          {para.attachments.map((attachment, j) => (
            <AttachmentChip key={j} ref={attachment} />
          ))}
        </p>
      ))}
    </section>
  );
}
