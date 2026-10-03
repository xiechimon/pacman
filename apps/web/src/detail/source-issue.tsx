// 来源行（#452 / ADR 0006 D5/D6 + #640 / r14 §5.4 编排档）：任务详情页的
// 来源面，live 专属（fixture 面无来源数据源，不渲染）。四态：
// - 编排来源（sourceKind='orchestration'，#640）：一行「来源 · 总管编排
//   会话」，点击开总管抽屉定位该会话（sourceRef = chief:<uuid> 反解单源
//   parseOrchestrationSourceRef）——比参考站多给的一面（它详情页零来源，
//   r14 §5.4：pacman 的 sourceRef 有会话粒度，链回编排回合）；
// - 未建成（sourceKind='github-issue-self' 且 sourceRef=null）：一行状态 +
//   重试按钮（AC3 重试入口；POST retry 成功后查询失效重取，行自动升级）；
// - 已建成/导入：进入时拉一次回显（useGithubIssueEcho，staleTime ∞ 不轮询）
//   → issue 当前标题 + 状态；与本地标题不一致 → 一行中性提示，**不自动覆盖
//   本地值**（D5：issue 侧为真值，pacman 侧只显示差异）；
// - 拉不到（未连接/token 失效/限流/issue 被删）→ 整行隐藏，不显示陈旧值、
//   不弹错（D6：回显是补充信息，不该把详情页变成错误现场）。

import { parseOrchestrationSourceRef, type TodoRecord } from '@pacman/shared';
import { useGithubIssueEcho } from '../api/hooks.js';
import { Button } from '../components/ui/button.js';
import { useI18n } from '../i18n/provider.js';

interface SourceIssueLineProps {
  todo: TodoRecord;
  /** 未建成态的重试触发（mutations.retryGithubIssue）。 */
  onRetry: () => void;
  retryPending: boolean;
  /** #640 编排档：点开总管抽屉定位编排会话（缺省 = 静态行，不可点）。 */
  onOpenThread?: (threadId: string) => void;
}

export function SourceIssueLine({
  todo,
  onRetry,
  retryPending,
  onOpenThread,
}: SourceIssueLineProps) {
  const { t } = useI18n();
  // github 回显查询只吃 github 档（编排档无 issue 可拉，enabled 恒 false）。
  const echoQ = useGithubIssueEcho(
    todo.id,
    todo.sourceRef !== null && todo.sourceKind !== 'orchestration',
  );
  if (todo.sourceKind === null) return null;
  if (todo.sourceKind === 'orchestration') {
    // 畸形 ref（理论上不达——写入面走 orchestrationSourceRef 单源）退静态
    // 行不可点，不弹错（D6 同律）。
    const parsed = todo.sourceRef !== null ? parseOrchestrationSourceRef(todo.sourceRef) : null;
    return (
      <div className="source-issue" data-testid="source-orchestration">
        <span className="source-issue-label">{t('来源')}</span>
        <Button
          variant="ghost"
          className="source-orchestration-link border-none p-0 text-[13px] font-normal text-(--card-button) cursor-pointer hover:bg-transparent dark:hover:bg-transparent hover:text-(--card-button) disabled:pointer-events-none disabled:opacity-100 active:not-aria-[haspopup]:translate-y-0"
          data-testid="source-orchestration-link"
          onClick={
            parsed !== null && onOpenThread ? () => onOpenThread(parsed.threadId) : undefined
          }
          disabled={parsed === null || onOpenThread === undefined}
        >
          {t('总管编排会话')}
        </Button>
      </div>
    );
  }
  if (todo.sourceRef === null) {
    return (
      <div className="source-issue" data-testid="source-issue-pending">
        <span className="source-issue-label">{t('GitHub issue 未建成')}</span>
        {/* XMON-24：原 ui/button text 变体（透明底 + 品牌紫墨 + 零内边距，
            h32）逐值搬 utilities；老 text 钮无 hover/无 disabled 降档——
            中性化齐（hover 底双档：dark 是默认主题，不清会透 muted/50）。 */}
        <Button
          variant="ghost"
          className="source-issue-retry border-none p-0 text-[13px] font-normal text-(--card-button) cursor-pointer hover:bg-transparent dark:hover:bg-transparent hover:text-(--card-button) disabled:opacity-100 disabled:pointer-events-auto active:not-aria-[haspopup]:translate-y-0"
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
