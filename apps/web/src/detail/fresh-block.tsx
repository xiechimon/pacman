// Fresh-state block (issue #56, r7 23): title h2, tag chips row, 「尚无描述」
// and the creation-time meta row. XMON-55 P0 turned it into the page's task
// brief: the block now owns the whole center column (the right pane no longer
// renders in fresh phases), so the title steps up to 22px, the brief sits on
// a centred 720px measure instead of hugging the left edge of a 1200px
// column, and the phase's primary action sits with it. The r7 23 meta row's
// three glyphs (edit + two identical copies) are gone — unlabelled duplicate
// icons carry no meaning.
// spec 15 #394 (ADR 0002 D5): 标签只读——chips 仅在有标签时成行；手动添加
// affordance 移除（固定词表由执行 agent 回填）。#445 起看板卡也渲染标签
// chip（ADR 0002 F4 修订——「看板卡不渲染标签」校准退役），本块仍是详情
// 页的唯一标签消费面。

import { TagChip, type TagChipData } from '../components/ui/tag-chip.js';
import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import type { TFunc } from '../i18n/translate.js';
import { Button } from '../ui/button.js';

/** 「2026年9月21日 13:21 创建」 — capture-verbatim format, pinned to the
 *  +08:00 zone the r7 session ran in so fixture output never drifts with host TZ.
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
   *  fixture 面缺省 = 无 chip(r7 23 基线原样,视觉零漂移)。 */
  tags?: TagChipData[];
  /** Phase primary-button copy (PHASE_UI.action); null = this phase has no
   *  primary (closed) → the action row drops out whole. */
  action?: string | null;
  /** The page's single primary handler — same one the head button calls. */
  onAction?: () => void;
}

export function FreshBlock({ todo, tags, action, onAction }: FreshBlockProps) {
  const { t } = useI18n();
  return (
    <div className="fresh-block">
      <h2 className="fresh-title">{todo.title}</h2>
      {/* #394：chips 只读，无标签时整行不渲染（原静态添加 affordance 移除） */}
      {(tags ?? []).length > 0 && (
        <div className="fresh-tags">
          {(tags ?? []).map((tag) => (
            <TagChip key={tag.id} tag={tag} className="fresh-tag-chip" />
          ))}
        </div>
      )}
      <div className="fresh-nodesc">{t('尚无描述')}</div>
      <div className="fresh-meta">
        <span className="fresh-meta-time">{formatCreatedAt(todo.phaseAt, t)}</span>
      </div>
      {action != null && onAction != null && (
        <div className="fresh-actions">
          <Button variant="primary" size="standard" className="fresh-start" onClick={onAction}>
            {t(action)}
          </Button>
          <span className="fresh-action-hint">{t('点开始后选执行机器，Agent 在你的机器上跑')}</span>
        </div>
      )}
    </div>
  );
}
