// 任务元信息块（#476，#473 决策候选 A + C 尾注）：右栏方案空态的 meta 面——
// agent 产出方案之前的整个执行期，文档槽没有内容职责，由任务元信息承接。
// 字段序（#473 决策记录）：来源 issue（标题 + 链接）→ 分支 / PR → 机器 →
// 模型 → 创建时间 → 尾注引导句；字段缺省整行不渲染、不占空行。
// 几何：顶对齐右栏 head 下 16px inset（走 doc-pane-body padding-top 同值），
// 行距 = 中列 chat-row 的 18px 律；不引入新滚动区（字段数有界）。
// 数据 live 面供数（fixture 面无来源/机器/模型数据源——SourceIssueLine
// 同律），fixture 空态维持居中「暂无方案」字节不变。

import type { ReactNode } from 'react';
import { relativeTime } from '../board/rel-time.js';
import { useI18n } from '../i18n/provider.js';

export interface TaskMetaFields {
  /** 来源 issue（sourceRef 反解成功才有值）：#N + 标题，链接去 GitHub。
   *  标题 = issue 侧真值（echo，ADR 0006 D5），拉不到退本地标题。 */
  sourceIssue: { number: number; title: string; url: string } | null;
  /** conv 分支名（conversationBranch(buildId) 派生）；无 build = null。 */
  branch: string | null;
  /** PR（build.prUrl/prNumber；托管 repo / 未创建 = null）。 */
  pr: { number: number; url: string } | null;
  /** 执行机器名（steps.machineId × machines 读面）；未派发 = null。 */
  machine: string | null;
  /** 模型 id（指派 agent 的 members actor.modelId，退 usage 首行 model）。 */
  model: string | null;
  /** 创建时间 = 首轮运行 createdAt（todo 表无创建列，buildHistory 首条目
   *  是最早可得时点）；无运行且 build 未在飞 = null。 */
  createdAt: number | null;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="task-meta-row">
      <span className="task-meta-label">{label}</span>
      <span className="task-meta-value">{children}</span>
    </div>
  );
}

export function TaskMetaBlock({ meta, now }: { meta: TaskMetaFields; now: number }) {
  const { t } = useI18n();
  return (
    <div className="task-meta" data-testid="task-meta">
      {meta.sourceIssue != null && (
        <Row label={t('来源 issue')}>
          <a
            className="task-meta-link"
            href={meta.sourceIssue.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            #{meta.sourceIssue.number} {meta.sourceIssue.title}
          </a>
        </Row>
      )}
      {(meta.branch != null || meta.pr != null) && (
        <Row label={t('分支 / PR')}>
          {meta.branch != null && <code className="task-meta-code">{meta.branch}</code>}
          {meta.pr != null && (
            <a
              className="task-meta-link"
              href={meta.pr.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              #{meta.pr.number}
            </a>
          )}
        </Row>
      )}
      {meta.machine != null && <Row label={t('机器')}>{meta.machine}</Row>}
      {meta.model != null && (
        <Row label={t('模型')}>
          <code className="task-meta-code">{meta.model}</code>
        </Row>
      )}
      {meta.createdAt != null && (
        <Row label={t('创建时间')}>{relativeTime(meta.createdAt, now, t)}</Row>
      )}
      <div className="task-meta-foot">{t('方案产出后显示于此')}</div>
    </div>
  );
}
