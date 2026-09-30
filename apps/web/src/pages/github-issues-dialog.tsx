// 从 GitHub issue 建任务弹层（#446 / ADR 0005 读向）：项目页 issue 选择器——
// 状态过滤（打开/已关闭/全部）+ 分页（hasMore = server 依上游 Link 头判定）
// + 行点选即导入建任务。只读面：不在 GitHub 留任何痕迹（写向 = ADR 0006
// 另票）。数据面 = useGithubIssues / importGithubIssue（hooks 单源）；导入
// 成功由父面收弹层并导航任务详情（票面 e2e 真用户路径的落点）。
// 弹层家族律（#68 DialogShell 448 宽 + Esc/背板关闭；per-face 类名
// dlg-ghissues / prj-issues-* 作 e2e 定位别名）。

import type { GithubIssueState, TodoRecord } from '@pacman/shared';
import { useEffect, useState } from 'react';
import { useApiMutations, useGithubIssues } from '../api/hooks.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { useI18n } from '../i18n/provider.js';
import { Button } from '../ui/button.js';
import { TagChip } from '../ui/tag-chip.js';

const STATE_FILTERS: { id: GithubIssueState; label: string }[] = [
  { id: 'open', label: '打开' },
  { id: 'closed', label: '已关闭' },
  { id: 'all', label: '全部' },
];

interface GithubIssuesDialogProps {
  /** #73 retained-mount open flag（DialogShell 家族律）。 */
  open: boolean;
  onClose: () => void;
  projectId: string;
  teamId: string | undefined;
  /** 导入成功（201 全 record：标题/正文/多标签/来源两列已落）。 */
  onImported: (record: TodoRecord) => void;
}

export function GithubIssuesDialog({
  open,
  onClose,
  projectId,
  teamId,
  onImported,
}: GithubIssuesDialogProps) {
  const { t } = useI18n();
  const [state, setState] = useState<GithubIssueState>('open');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  // retained-mount 存活态：重开不带上一轮的导入错误（delete-project-confirm
  // 同律）。过滤/页码保留 = 重开续看上次位置。
  useEffect(() => {
    if (open) setError(null);
  }, [open]);
  const issuesQ = useGithubIssues(projectId, state, page, open);
  const mutations = useApiMutations(teamId);
  const data = issuesQ.data;
  const pending = mutations.importGithubIssue.isPending;
  const importIssue = (issueNumber: number) => {
    setError(null);
    mutations.importGithubIssue.mutate(
      { projectId, number: issueNumber },
      {
        onSuccess: (record) => onImported(record),
        // 导入失败留在弹层内联呈现（server {error} 消息 verbatim，
        // project-new 错误面同律）；列表与已建任务不受影响。
        onError: (err) => setError(err instanceof Error ? err.message : String(err)),
      },
    );
  };
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={t('从 GitHub issue 建任务')}
      className="dlg-ghissues"
      footer={
        <div className="prj-issues-foot">
          <Button
            variant="quiet"
            className="prj-issues-prev"
            disabled={page <= 1 || pending}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('上一页')}
          </Button>
          <span className="prj-issues-page">{t('第 {page} 页', { page })}</span>
          <Button
            variant="quiet"
            className="prj-issues-next"
            disabled={data?.hasMore !== true || pending}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('下一页')}
          </Button>
        </div>
      }
    >
      <div className="prj-issues-filters">
        {STATE_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`prj-issues-filter${state === filter.id ? ' prj-issues-filter--active' : ''}`}
            aria-pressed={state === filter.id}
            onClick={() => {
              setState(filter.id);
              setPage(1);
            }}
          >
            {t(filter.label)}
          </button>
        ))}
      </div>
      {issuesQ.isError ? (
        <div className="prj-issues-empty">{t('issue 列表加载失败')}</div>
      ) : data === undefined ? (
        <div className="prj-issues-empty">{t('加载中…')}</div>
      ) : data.issues.length === 0 ? (
        <div className="prj-issues-empty">{t('这个状态下没有 issue')}</div>
      ) : (
        <div className="prj-issues-list">
          {data.issues.map((issue) => (
            <button
              key={issue.number}
              type="button"
              className="prj-issues-row"
              disabled={pending}
              onClick={() => importIssue(issue.number)}
            >
              <span className="prj-issues-num">#{issue.number}</span>
              <span className="prj-issues-title">{issue.title}</span>
              {issue.labels.length > 0 && (
                <span className="prj-issues-labels">
                  {issue.labels.map((label) => (
                    <TagChip
                      key={label.name}
                      tag={{ id: label.name, name: label.name, color: label.color }}
                      className="prj-issues-tag"
                    />
                  ))}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {error !== null && <div className="prj-issues-error">{error}</div>}
    </DialogShell>
  );
}
