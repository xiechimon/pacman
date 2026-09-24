// Board-guide popover (issue #149): the dead 看板指南 topbar button wired to
// real content — 列语义（six columns, single source = board/columns.ts
// COLUMNS）+ 关口操作（02 §4.2 主时序）+ ⌘K hint. The official guide
// panel's content was never captured, so the copy is [设计] free content
// (whats-new precedent: 形状保留、内容自选). Anchored-overlay family law
// (#67/#127): the trigger toggles, Escape and the click-catcher close.

import { COLUMNS } from '../board/columns.js';
import { useI18n } from '../i18n/provider.js';
import './overlays.css';

/** column id → one-line semantic (order and names ride COLUMNS). */
const COLUMN_GUIDE: Record<string, string> = {
  todo: '已创建、尚未启动的任务在此排队',
  planning: 'Agent 正在起草方案，进详情页可实时查看',
  confirm: '方案就绪：确认后开工，或提出修改意见',
  building: 'Agent 正在执行；失败与待回复的任务钉在列首',
  review: '执行完成：审查变更后验收合并',
  done: '已合并收尾；重开可发起新一轮',
};

/** Gate actions (02 §4.2): the three human touchpoints of the lifecycle. */
const GATE_ROWS = [
  '待确认 → 确认方案，或在输入框提出修改',
  '待验收 → 审查变更，验收即合并',
  '失败 → 重跑，可复用已有方案',
];

export function BoardGuide() {
  const { t } = useI18n();
  return (
    <div className="board-guide-pop" role="dialog" aria-label={t('看板指南')}>
      <div className="board-guide-title">{t('看板指南')}</div>
      <div className="board-guide-label">{t('列语义')}</div>
      {COLUMNS.map((column) => (
        <div className="board-guide-row" key={column.id}>
          <span className="board-guide-dot" style={{ background: column.dot }} />
          <span className="board-guide-name">{t(column.name)}</span>
          <span className="board-guide-desc">{t(COLUMN_GUIDE[column.id] ?? '')}</span>
        </div>
      ))}
      <div className="board-guide-label">{t('关口操作')}</div>
      {GATE_ROWS.map((row) => (
        <div className="board-guide-row board-guide-row--gate" key={row}>
          {t(row)}
        </div>
      ))}
      <div className="board-guide-label">{t('快速跳转')}</div>
      <div className="board-guide-row board-guide-row--gate">
        <kbd className="board-guide-kbd">⌘K</kbd>
        {t('打开全局搜索，直达任务与资源')}
      </div>
    </div>
  );
}
