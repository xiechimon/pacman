// Fresh-state block (issue #56, r7 23): title h2, tag add row, 「尚无描述」
// and the creation-time meta row with its three action icons.
// #309 (r9 100): a tagged todo renders one chip per tag (TagChip 原语,
// 66×20 观测族) ahead of the static add affordance — the icon pair stays
// capture-verbatim (详情面添加行为不在 #309 垂直切片;共存形态 [推断],
// 看板卡不渲染标签 = spec 08 附录 A 校准行,r9 §3.4 实测).

import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import type { TFunc } from '../i18n/translate.js';
import { Copy, PlusSmall, SquarePen, Tag } from '../icons/index.js';
import { TagChip, type TagChipData } from '../ui/tag-chip.js';

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
  /** #309 live:todo.tagIds 解析出的标签记录序(useTags 真值投影);
   *  fixture 面缺省 = 无 chip(r7 23 基线原样,parity 零漂移)。 */
  tags?: TagChipData[];
}

export function FreshBlock({ todo, tags }: FreshBlockProps) {
  const { t } = useI18n();
  return (
    <div className="fresh-block">
      <h2 className="fresh-title">{todo.title}</h2>
      <div className="fresh-tags">
        {(tags ?? []).map((tag) => (
          <TagChip key={tag.id} tag={tag} className="fresh-tag-chip" />
        ))}
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
