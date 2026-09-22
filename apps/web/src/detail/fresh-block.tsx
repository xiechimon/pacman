// Fresh-state block (issue #56, r7 23): title h2, tag add row, 「尚无描述」
// and the creation-time meta row with its three action icons.

import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import type { TFunc } from '../i18n/translate.js';
import { Copy, PlusSmall, SquarePen, Tag } from '../icons/index.js';

/** 「2026年9月21日 13:21 创建」 — capture-verbatim format, pinned to the
 *  +08:00 zone the r7 session ran in so parity never drifts with host TZ.
 *  #74: the line is one dict template — the zh vars reproduce the capture
 *  byte-for-byte; the en value consumes {monthShort} ([设计], no observed
 *  en workspace). */
export function formatCreatedAt(ms: number, t: TFunc): string {
  const base = {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  } as const;
  const parts = new Intl.DateTimeFormat('zh-CN', {
    ...base,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).formatToParts(ms);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const monthShort =
    new Intl.DateTimeFormat('en-US', { ...base, month: 'short' })
      .formatToParts(ms)
      .find((p) => p.type === 'month')?.value ?? '';
  return t('{y}年{mo}月{d}日 {hh}:{mm} 创建', {
    y: get('year'),
    mo: get('month'),
    d: get('day'),
    hh: get('hour'),
    mm: get('minute'),
    monthShort,
  });
}

interface FreshBlockProps {
  todo: TodoRecord;
}

export function FreshBlock({ todo }: FreshBlockProps) {
  const { t } = useI18n();
  return (
    <div className="fresh-block">
      <h2 className="fresh-title">{todo.title}</h2>
      <div className="fresh-tags">
        <Tag width={14} height={14} />
        <PlusSmall width={9} height={9} />
      </div>
      <div className="fresh-nodesc">{t('尚无描述')}</div>
      <div className="fresh-meta">
        <SquarePen width={13} height={13} />
        <Copy width={13} height={13} />
        <Copy width={13} height={13} />
        <span className="fresh-meta-time">{formatCreatedAt(todo.phaseAt, t)}</span>
      </div>
    </div>
  );
}
