// Fresh-state block (issue #56, r7 23): title h2, tag add row, 「尚无描述」
// and the creation-time meta row with its three action icons.

import type { TodoRecord } from '../fixtures/records.js';
import { Copy, PlusSmall, SquarePen, Tag } from '../icons/index.js';

/** 「2026年9月21日 13:21 创建」 — capture-verbatim format, pinned to the
 *  +08:00 zone the r7 session ran in so parity never drifts with host TZ. */
export function formatCreatedAt(ms: number): string {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}年${get('month')}月${get('day')}日 ${get('hour')}:${get('minute')} 创建`;
}

interface FreshBlockProps {
  todo: TodoRecord;
}

export function FreshBlock({ todo }: FreshBlockProps) {
  return (
    <div className="fresh-block">
      <h2 className="fresh-title">{todo.title}</h2>
      <div className="fresh-tags">
        <Tag width={14} height={14} />
        <PlusSmall width={9} height={9} />
      </div>
      <div className="fresh-nodesc">尚无描述</div>
      <div className="fresh-meta">
        <SquarePen width={13} height={13} />
        <Copy width={13} height={13} />
        <Copy width={13} height={13} />
        <span className="fresh-meta-time">{formatCreatedAt(todo.phaseAt)}</span>
      </div>
    </div>
  );
}
