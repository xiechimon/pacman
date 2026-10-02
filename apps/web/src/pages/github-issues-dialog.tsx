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
import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { TagChip } from '../components/ui/tag-chip.js';
import { useI18n } from '../i18n/provider.js';

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
          {/* XMON-25 收编：老 ui/Button quiet 的皮肤（padding 0 / text-dim /
              13px）下沉 per-face .prj-issues-prev,.prj-issues-next 新规则；
              禁用态原本无降档（quiet 无 :disabled 规则）→ opacity-100 +
              pointer-events-auto 保「禁用仍画 pointer 光标」的现行为。
              leading-[inherit] = 应用内 preflight 对 button 置
              line-height: inherit，老面继承 foot 行高（13px×1.4286≈18.57）；
              base text-sm 的比例行高与 normal 都凑不齐该值，inherit 逐位对
              齐（像素对拍实测 normal 会把 foot 压矮 0.56px）。 */}
          <Button
            variant="ghost"
            className="prj-issues-prev h-auto font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0 disabled:pointer-events-auto disabled:opacity-100"
            disabled={page <= 1 || pending}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('上一页')}
          </Button>
          <span className="prj-issues-page">{t('第 {page} 页', { page })}</span>
          <Button
            variant="ghost"
            className="prj-issues-next h-auto font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0 disabled:pointer-events-auto disabled:opacity-100"
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
          // XMON-25 收编：ghost；--active 选中态正本在 per-face（unlayered）；
          // leading-[inherit] 对齐 preflight 继承行高（同 prev/next 注释）。
          <Button
            key={filter.id}
            variant="ghost"
            className={`prj-issues-filter font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0${
              state === filter.id ? ' prj-issues-filter--active' : ''
            }`}
            aria-pressed={state === filter.id}
            onClick={() => {
              setState(filter.id);
              setPage(1);
            }}
          >
            {t(filter.label)}
          </Button>
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
            // XMON-25 收编：ghost；per-face font:inherit 简写已压掉 base 的
            // text-sm/font-medium/行高（无需字体中和位）。justify-start =
            // text-align:left 的 flex 等价位；whitespace-normal 恢复标题
            // 双行换行（base whitespace-nowrap 会禁掉 wrap 面的 overflow-wrap）；
            // h-auto 保内容高——base h-8 钉 32px，双行行（60px）会溢出盒外。
            <Button
              key={issue.number}
              variant="ghost"
              className="prj-issues-row h-auto justify-start whitespace-normal active:not-aria-[haspopup]:translate-y-0"
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
            </Button>
          ))}
        </div>
      )}
      {error !== null && <div className="prj-issues-error">{error}</div>}
    </DialogShell>
  );
}
