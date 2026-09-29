// Board todo card（#414 shadcn 试点）：视觉层切到 shadcn 组件 + B（neutral）
// token——Card 承载盒型（bg-card/border/rounded-xl/shadow-sm），动作钮走
// shadcn Button。行为与锚点原位：stretched title link、data-todo-id、
// todo-card/todo-card-action--* 类别名、相对时间、phase 徽标全部保留；
// 几何沿用 r7 实测（9.5-13.5-11.5 padding / 26 底行）；宽度随 #351 的
// 四列流体网格铺满列宽（原 262 定宽随横向滚动一起退役）。
// 阶段点与徽标的语义色（蓝/琥珀/绿/灰）不随 B 换——它们承载 phase 语义，
// 不是中性表面；全面 chart 化留待铺开期裁决。

import { Link, useLocation } from 'react-router';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { PROJECT_INITIAL, PROJECT_NAME } from '../fixtures/fixtures.js';
import type { TodoRecord } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import {
  CheckWhite,
  Download,
  FileText,
  GitCommit,
  SearchWhite,
  UserCircle,
} from '../icons/index.js';
import { Avatar } from '../ui/avatar.js';
import { cardAction } from './columns.js';
import { relativeTime } from './rel-time.js';

interface TodoCardProps {
  todo: TodoRecord;
  now: number;
  /** Card action button (确认/完成/回复); the page decides what it does
   *  (issue #68: review-phase 完成 opens the accept dialog). */
  onAction?: (todo: TodoRecord) => void;
  /** Card branch icon (issue #68): opens the 分支与 PR dialog. */
  onBranch?: (todo: TodoRecord) => void;
  /** M5 live：项目 chip 真名（fixture.projectNames 位）；缺省 = capture
   *  canon 常量（r7 22 `r3-lifecycle`）。 */
  projectName?: string;
}

/** Badge on the agent avatar: amber magnifier while the run is waiting on
 *  the user (待确认 02 #9, 待验收 33 #9, 等待回复 01 #1), green check once
 *  done (r7 01b #2, 35 #9). Fresh cards carry a gray idle badge with the
 *  same magnifier glyph (r7 22/22d — badge shape pixel-matches the amber
 *  one at gray #9ea3ae). */
function badgeFor(todo: TodoRecord): 'idle' | 'attention' | 'done' | 'failed' | null {
  if (todo.phase === 'done') return 'done';
  // r8 55: the failed card's avatar carries the red `!` badge
  if (todo.phase === 'failed') return 'failed';
  if (todo.phase === 'confirm' || todo.phase === 'review' || todo.awaitingReply === true) {
    return 'attention';
  }
  if (todo.phase === 'todo' || todo.phase === 'queued') return 'idle';
  return null;
}

export function TodoCard({ todo, now, onAction, onBranch, projectName }: TodoCardProps) {
  const chipName = projectName ?? PROJECT_NAME;
  const chipInitial = projectName ? projectName.charAt(0).toLowerCase() : PROJECT_INITIAL;
  const { t } = useI18n();
  const action = cardAction(todo);
  const badge = badgeFor(todo);
  const fresh = badge === 'idle';
  const { search } = useLocation();
  return (
    <Card
      data-todo-id={todo.id}
      className="todo-card relative w-full gap-0 rounded-xl px-[13.5px] pt-[9.5px] pb-[11.5px]"
    >
      <div className="todo-card-row1 flex h-4 items-center">
        <span className="project-avatar">{chipInitial}</span>
        <span className="todo-project-name ml-1 truncate text-[11px] leading-4 text-muted-foreground">
          {chipName}
        </span>
        <span className="todo-card-seq mr-[13px] ml-auto flex-none text-[11px] leading-4 text-muted-foreground/70">
          #{todo.seqNum}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="todo-card-branch relative z-10 -mr-[1.5px] h-4 w-[13px] text-muted-foreground"
          aria-label={t('分支与 PR')}
          onClick={() => onBranch?.(todo)}
        >
          <Download className="size-[13px]" />
        </Button>
      </div>

      <h3 className="todo-card-title mt-1 wrap-break-word text-sm leading-5 font-medium text-card-foreground">
        <Link
          className="todo-card-link text-inherit no-underline after:absolute after:inset-0 after:content-['']"
          to={{ pathname: `/app/todo/${todo.id}`, search }}
        >
          {todo.title}
        </Link>
      </h3>

      <div className="todo-card-bottom mt-[7.5px] flex h-[26px] items-center">
        <span className="todo-agent-avatar relative size-5 flex-none [&_img]:block [&_img]:size-5">
          {fresh ? (
            // owner placeholder while no agent run exists (r7 22/22d)
            <UserCircle width={20} height={20} className="text-muted-foreground/70" />
          ) : (
            // #387: 执行者头像按 agent displayName 种子生成;未指派退静态资产
            <Avatar name={todo.agent?.displayName} fallback="/avatar-robot-1.svg" />
          )}
          {badge != null && (
            <span
              aria-hidden={badge === 'failed' ? true : undefined}
              className={`todo-agent-badge todo-agent-badge--${badge} absolute -top-[2px] -right-1 flex size-[9px] items-center justify-center rounded-full text-[8px] leading-none font-bold ${
                badge === 'idle'
                  ? 'bg-(--badge-idle)'
                  : badge === 'attention'
                    ? 'bg-(--badge-attention)'
                    : badge === 'done'
                      ? 'bg-(--badge-done)'
                      : 'bg-(--stop) text-white'
              }`}
            >
              {badge === 'failed' ? (
                '!'
              ) : badge === 'done' ? (
                <CheckWhite width={9} height={9} />
              ) : (
                <SearchWhite width={9} height={9} />
              )}
            </span>
          )}
        </span>
        <span className="todo-card-time relative top-[1.5px] ml-[7px] text-[11px] leading-4 text-muted-foreground">
          {relativeTime(todo.phaseAt, now, t)}
        </span>
        {todo.hasPlan && (
          <span
            className="todo-card-metric ml-[10.5px] flex flex-none items-center text-muted-foreground"
            role="img"
            aria-label={t('方案')}
          >
            <FileText />
          </span>
        )}
        {todo.hasChanges && (
          <span
            className={`todo-card-metric flex flex-none items-center text-muted-foreground ${todo.hasPlan ? 'ml-[2px]' : 'ml-[10.5px]'}`}
            role="img"
            aria-label={t('变更')}
          >
            <GitCommit />
          </span>
        )}
        <span className="todo-card-spacer flex-1" />
        {action != null && (
          <Button
            variant={action.kind === 'primary' ? 'default' : 'outline'}
            size="xs"
            className={`todo-card-action todo-card-action--${action.kind} relative z-10 h-[26px] flex-none rounded-md px-[7.25px] text-xs`}
            onClick={() => onAction?.(todo)}
          >
            {t(action.label)}
          </Button>
        )}
      </div>
    </Card>
  );
}
