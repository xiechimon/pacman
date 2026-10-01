// 来源 issue 行（#452 / ADR 0006 D5/D6）：任务详情页的来源面，live 专属
// （fixture 面无来源数据源，不渲染）。三态：
// - 未建成（sourceKind='github-issue-self' 且 sourceRef=null）：一行状态 +
//   重试按钮（AC3 重试入口；POST retry 成功后查询失效重取，行自动升级）；
// - 已建成/导入：进入时拉一次回显（useGithubIssueEcho，staleTime ∞ 不轮询）
//   → issue 当前标题 + 状态；与本地标题不一致 → 一行中性提示，**不自动覆盖
//   本地值**（D5：issue 侧为真值，pacman 侧只显示差异）；
// - 拉不到（未连接/token 失效/限流/issue 被删）→ 整行隐藏，不显示陈旧值、
//   不弹错（D6：回显是补充信息，不该把详情页变成错误现场）。

import type { TodoRecord } from '@pacman/shared';
import { useGithubIssueEcho } from '../api/hooks.js';
import { Button } from '../components/ui/button.js';
import { useI18n } from '../i18n/provider.js';

interface SourceIssueLineProps {
  todo: TodoRecord;
  /** 未建成态的重试触发（mutations.retryGithubIssue）。 */
  onRetry: () => void;
  retryPending: boolean;
}

export function SourceIssueLine({ todo, onRetry, retryPending }: SourceIssueLineProps) {
  const { t } = useI18n();
  const echoQ = useGithubIssueEcho(todo.id, todo.sourceRef !== null);
  if (todo.sourceKind === null) return null;
  if (todo.sourceRef === null) {
    return (
      <div className="source-issue" data-testid="source-issue-pending">
        <span className="source-issue-label">{t('GitHub issue 未建成')}</span>
        {/* XMON-24：原 ui/button text 变体（透明底 + indigo 墨 + 零内边距，
            h32）逐值搬 utilities；老 text 钮无 hover/无 disabled 降档——
            中性化齐（hover 底双档：dark 是默认主题，不清会透 muted/50）。 */}
        <Button
          variant="ghost"
          className="source-issue-retry border-none p-0 text-[13px] font-normal text-(--indigo-500) cursor-pointer hover:bg-transparent dark:hover:bg-transparent hover:text-(--indigo-500) disabled:opacity-100 disabled:pointer-events-auto active:not-aria-[haspopup]:translate-y-0"
          data-testid="source-issue-retry"
          onClick={onRetry}
          disabled={retryPending}
        >
          {t('重试')}
        </Button>
      </div>
    );
  }
  // 拉不到（含首拉在飞——防闪半态）→ 整行隐藏（D6）。
  if (!echoQ.data) return null;
  const echo = echoQ.data;
  const mismatch = echo.title !== todo.title;
  return (
    <div className="source-issue" data-testid="source-issue-echo">
      <span className="source-issue-label">{t('来源 issue')}</span>
      <span className="source-issue-number">#{echo.number}</span>
      <span className="source-issue-state">{echo.state === 'open' ? t('打开') : t('已关闭')}</span>
      <span className="source-issue-title">{echo.title}</span>
      {mismatch && (
        <span className="source-issue-drift" data-testid="source-issue-drift">
          {t('与本地标题不一致')}
        </span>
      )}
    </div>
  );
}
