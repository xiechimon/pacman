// 从 GitHub issue 建任务弹层（#446 / ADR 0005 读向）：项目页 issue 选择器——
// 状态过滤（打开/已关闭/全部）+ 分页（hasMore = server 依上游 Link 头判定）
// + 行点选即导入建任务。只读面：不在 GitHub 留任何痕迹（写向 = ADR 0006
// 另票）。数据面 = useGithubIssues / importGithubIssue（hooks 单源）；导入
// 成功由父面收弹层并导航任务详情（票面 e2e 真用户路径的落点）。
// 弹层家族律（#68 DialogShell 448 宽 + Esc/背板关闭）。#946：per-face 类
// （dlg-ghissues / prj-issues-*）退役——皮肤迁 token utility 等值，e2e 载体
// 迁语义位（role=dialog/menu、按钮文案、aria-pressed、文本）。

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

/** 过滤 chip（原 .prj-issues-filter）：24 高带框盒形，ghost 件配方按七通道
 *  律中和（hover 无涂底面——旧 per-face bg 简写恒压 hover 档）。选中态
 *  （原 --active）= 品牌描边 + tab-chip 填充，载体 aria-pressed。 */
const FILTER_CLS =
  'h-6 cursor-pointer rounded-none border border-(--border-default) bg-transparent px-2.5 text-xs font-normal leading-[inherit] text-(--text-secondary) hover:bg-transparent hover:text-(--text-secondary) dark:hover:bg-transparent active:not-aria-[haspopup]:translate-y-0';
const FILTER_ACTIVE_CLS =
  'border-(--card-button) bg-(--tab-chip-bg) text-(--text-primary) hover:bg-(--tab-chip-bg) hover:text-(--text-primary) dark:hover:bg-(--tab-chip-bg)';

/** 翻页钮（原 .prj-issues-prev/-next，老 ui/Button quiet 皮肤）：零内距 /
 *  无边框 / 透明底 / 13 字号 / 弱化墨；禁用态无降档（quiet 无
 *  :disabled 规则）→ opacity-100 + pointer-events-auto 保「禁用仍画 pointer
 *  光标」的现行为。leading-[inherit] = 应用内 preflight 对 button 置
 *  line-height: inherit，老面继承 foot 行高（13px×1.4286≈18.57）；base
 *  text-sm 的比例行高与 normal 都凑不齐该值，inherit 逐位对齐（像素对拍
 *  实测 normal 会把 foot 压矮 0.56px）。 */
const PAGER_BTN_CLS =
  'h-auto cursor-pointer rounded-none border-none bg-transparent p-0 text-[13px] font-normal leading-[inherit] text-(--text-tertiary) hover:bg-transparent hover:text-(--text-tertiary) dark:hover:bg-transparent active:not-aria-[haspopup]:translate-y-0 disabled:pointer-events-auto disabled:opacity-100';

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
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            variant="ghost"
            className={PAGER_BTN_CLS}
            disabled={page <= 1 || pending}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('上一页')}
          </Button>
          <span className="text-xs text-(--text-tertiary) tabular-nums">
            {t('第 {page} 页', { page })}
          </span>
          <Button
            variant="ghost"
            className={PAGER_BTN_CLS}
            disabled={data?.hasMore !== true || pending}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('下一页')}
          </Button>
        </div>
      }
    >
      <div className="flex gap-2 px-4 pt-3">
        {STATE_FILTERS.map((filter) => (
          <Button
            key={filter.id}
            variant="ghost"
            className={`${FILTER_CLS} ${state === filter.id ? FILTER_ACTIVE_CLS : ''}`}
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
        <div className="px-4 py-6 text-center text-[13px] leading-4 text-(--text-tertiary)">
          {t('issue 列表加载失败')}
        </div>
      ) : data === undefined ? (
        <div className="px-4 py-6 text-center text-[13px] leading-4 text-(--text-tertiary)">
          {t('加载中…')}
        </div>
      ) : data.issues.length === 0 ? (
        <div className="px-4 py-6 text-center text-[13px] leading-4 text-(--text-tertiary)">
          {t('这个状态下没有 issue')}
        </div>
      ) : (
        <div className="flex max-h-80 flex-col overflow-y-auto p-2">
          {data.issues.map((issue) => (
            // 行（原 .prj-issues-row）：ghost 底座，font:inherit 简写旧形由
            // text/leading inherit 等值承接；justify-start = text-align:left
            // 的 flex 等价位；whitespace-normal 恢复标题双行换行（base
            // whitespace-nowrap 会禁掉 wrap 面的 overflow-wrap）；h-auto 保
            // 内容高——base h-8 钉 32px，双行行（60px）会溢出盒外。
            <Button
              key={issue.number}
              variant="ghost"
              className="h-auto w-full cursor-pointer items-baseline justify-start gap-1.5 whitespace-normal rounded-none border-none bg-transparent p-2 text-left font-normal text-[length:inherit] leading-[inherit] hover:bg-transparent dark:hover:bg-transparent active:not-aria-[haspopup]:translate-y-0"
              disabled={pending}
              onClick={() => importIssue(issue.number)}
            >
              <span className="flex-none text-xs text-(--text-tertiary) tabular-nums">
                #{issue.number}
              </span>
              <span className="min-w-0 text-[13px] leading-[18px] text-(--text-primary) [overflow-wrap:anywhere]">
                {issue.title}
              </span>
              {issue.labels.length > 0 && (
                <span className="flex w-full flex-wrap gap-1">
                  {issue.labels.map((label) => (
                    <TagChip
                      key={label.name}
                      tag={{ id: label.name, name: label.name, color: label.color }}
                    />
                  ))}
                </span>
              )}
            </Button>
          ))}
        </div>
      )}
      {error !== null && <div className="mx-4 mb-3 text-xs leading-4 text-(--danger)">{error}</div>}
    </DialogShell>
  );
}
