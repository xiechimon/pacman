// AI 审核模态（M7 #312 / r8 §2.5/§3.1）：560 宽居中（448 弹层律之外新档） +
// 搜索行 + Agent 行（头像 + 名 + 模型 · 默认；选中行 bg-indigo-500/10）+ 可
// 选关注点 textarea + 32×32「开始审核」按钮。点击「开始审核」→ POST
// /api/builds/{id}/steps {action:"review", agentId, focus?};server 入队审核步 +
// 时间线插 REVIEW_ANNOUNCEMENT（r8 §3.1 实测）→ phase 留 confirm/review（审
// 核步是额外 agent 步，不推进主时序），chip 文案切「审核中」、composer
// placeholder 切「AI 审核进行中…」、停止钮复用 steer（#308）。findings 真
// emit + blocking 自动修订回路归 #326。

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/provider.js';
import { Button } from '../ui/button.js';
import { DialogShell } from '../ui/dialog-shell.js';

/** AI 审核选择器行最小投影（live = members 读面投影 + 模型槽；fixture =
 * canon 单默认行）。 */
export interface ReviewAgentOption {
  id: string;
  name: string;
  /** 模型标识（如「sonnet」）；fixture 面 canon 字符串 `默认`。 */
  model: string;
}

interface ReviewDialogProps {
  /** #73 retained-mount open flag。 */
  open?: boolean;
  onClose: () => void;
  /** 候选 Agent 集（live = members 读面 memberType:"agent" 行 + agent.modelId；
   * fixture 面 = canon 单默认行）；缺省 = fixture 兜底。 */
  agents?: ReviewAgentOption[];
  /** 默认选中行 id（live = 任务当前 binding；fixture = canon 单默认）。 */
  defaultAgentId?: string;
  /** 开始审核点击：POST steps {action:"review", agentId, focus?} 入队审核步。
   * 缺省 = fixture 静态面（仅关闭即止，不触发）。 */
  onStart?: (input: { agentId: string; focus: string }) => void;
}

const DEFAULT_AGENT: ReviewAgentOption = {
  id: 'r3-builder',
  name: 'r3-builder',
  model: '默认',
};

export function ReviewDialog({
  open,
  onClose,
  agents,
  defaultAgentId,
  onStart,
}: ReviewDialogProps) {
  const { t } = useI18n();
  const source = agents ?? [DEFAULT_AGENT];
  // 搜索态（r8 §2.5 搜索行实测）；空串视为不过滤。
  const [query, setQuery] = useState('');
  // 选中态（r8 §2.5「选中行 bg-indigo-500/10」）；retained-mount 重开回 default。
  const [selected, setSelected] = useState<string>(defaultAgentId ?? source[0]?.id ?? '');
  // 可选关注点 textarea（M7 #312 票 A 票面规格：r8 §3.1 实测有 textarea + 工具
  // 条；具体工具条配置 [推断] —— 票 A 不消费，本票只挂空容器）。
  const [focus, setFocus] = useState('');
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(defaultAgentId ?? source[0]?.id ?? '');
      setFocus('');
    }
  }, [open, defaultAgentId, source]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q === '' ? source : source.filter((row) => row.name.toLowerCase().includes(q));
  }, [source, query]);

  const submit = () => {
    if (selected === '') return;
    onStart?.({ agentId: selected, focus: focus.trim() });
    onClose();
  };

  return (
    <DialogShell
      title={t('AI 审核')}
      open={open}
      onClose={onClose}
      width={560}
      footer={
        <div className="dlg-form-foot">
          <div className="dlg-form-actions">
            <button type="button" className="chief-dlg-ghost" onClick={onClose}>
              {t('取消')}
            </button>
            <Button
              variant="primary"
              size="compact"
              className="review-start"
              onClick={submit}
              disabled={selected === ''}
            >
              {t('开始审核')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="review-body">
        <div className="review-search">
          <input
            className="review-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('搜索 Agent…')}
          />
        </div>
        <div className="review-agent-list" role="listbox" aria-label={t('选择审核 Agent')}>
          {rows.length === 0 ? (
            <div className="review-empty">{t('没有匹配的 Agent')}</div>
          ) : (
            rows.map((row) => {
              const isSelected = row.id === selected;
              return (
                <button
                  key={row.id}
                  type="button"
                  className="review-agent-row"
                  data-on={isSelected}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => setSelected(row.id)}
                >
                  <span className="review-agent-avatar" aria-hidden="true">
                    {row.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="review-agent-text">
                    <span className="review-agent-name">{row.name}</span>
                    <span className="review-agent-model">{row.model}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
        <div className="review-focus-row">
          <span className="dlg-form-label">{t('希望 Agent 审核时重点关注什么？（可选）')}</span>
          <textarea
            className="review-focus-input"
            value={focus}
            onChange={(event) => setFocus(event.target.value)}
            rows={3}
            placeholder={t('希望 Agent 审核时重点关注什么？（可选）')}
          />
        </div>
      </div>
    </DialogShell>
  );
}
