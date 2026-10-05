// PROTOTYPE surface (#909): 看板 — 4-column fluid grid (280px floor), the
// 44px header strip, and the todo-card family on Card skeletons with the
// hairline-ring + card-shadow elevation recipe from the token layer.

import { cn } from 'cn';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { TagChip } from '../components/ui/tag-chip.js';
import {
  ArrowUpDown,
  BarChart3,
  EllipsisVertical,
  Funnel,
  GitBranch,
  Plus,
} from '../icons/index.js';
import { COLUMNS, TASKS, WORST_TASKS, type MockTask } from '../mock.js';
import { StatusChip } from './status-chip.js';

const CARD_SURFACE =
  'rounded-(--edge-radius) bg-card p-(--pad-card) ring-0 [box-shadow:var(--edge-ring),var(--card-shadow)]';

function AgentDisc({ name }: { name: string }) {
  const initials = name
    .split(/[-\s]/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-(--agent-avatar-bg) font-mono text-[9px] text-content-secondary">
      {initials}
    </span>
  );
}

function TodoCard({ task }: { task: MockTask }) {
  return (
    <Card className={cn(CARD_SURFACE, 'gap-1.5 py-0 transition-colors hover:bg-surface-hover')}>
      {/* row 1: identity */}
      <div className="flex h-4 items-center gap-1.5 text-[11px]">
        <span className="grid size-4 shrink-0 place-items-center rounded-full bg-(--project-avatar-bg) text-[9px] font-semibold text-(--project-avatar-fg)">
          {task.projectInitial}
        </span>
        <span className="truncate text-content-tertiary">{task.projectName}</span>
        {task.tags.map((t) => (
          <TagChip key={t.id} tag={t} className="h-4 px-1.5 text-[10px] leading-4" />
        ))}
        <span className="ml-auto shrink-0 font-mono text-[10px] text-content-dim">#{task.seq}</span>
        {task.branch && (
          <Button variant="ghost" size="icon-xs" aria-label="分支" className="shrink-0 text-content-dim">
            <GitBranch />
          </Button>
        )}
      </div>
      {/* row 2: title */}
      <div
        className="text-sm leading-5 text-card-foreground [overflow-wrap:anywhere]"
        style={{
          fontWeight: 'var(--title-weight)' as never,
          letterSpacing: 'var(--title-tracking)',
        }}
      >
        {task.title}
      </div>
      {/* row 3: footer meta */}
      <div className="flex h-[26px] items-center gap-1.5">
        {task.agentName ? (
          <>
            <AgentDisc name={task.agentName} />
            <span className="max-w-20 truncate text-[11px] text-content-secondary">
              {task.agentName}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-content-dim">未分配</span>
        )}
        <StatusChip phase={task.phase} />
        {task.tokenCount && (
          <span className="flex items-center gap-0.5 font-mono text-[10px] text-content-dim">
            <BarChart3 className="size-3" />
            {task.tokenCount}
          </span>
        )}
        {task.awaitingReply && (
          <Badge className="h-[18px] rounded-4xl border-0 bg-(--badge-attention) px-1.5 text-[10px] leading-none text-(--badge-attention-fg)">
            待回复
          </Badge>
        )}
        <span className="ml-auto shrink-0 font-mono text-[10px] text-content-dim">{task.ago}</span>
        <Button variant="ghost" size="icon-xs" aria-label="更多" className="shrink-0 text-content-dim">
          <EllipsisVertical />
        </Button>
      </div>
    </Card>
  );
}

export function BoardFace({ worst = false }: { worst?: boolean }) {
  const source = worst ? WORST_TASKS : TASKS;
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-4">
        <h1 className="text-sm font-semibold tracking-[-0.015em]">看板</h1>
        <span className="font-mono text-[11px] text-content-dim">pacman</span>
        <Badge variant="secondary" className="ml-1 font-mono text-[10px]">
          {source.length}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="筛选">
            <Funnel />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="排序">
            <ArrowUpDown />
          </Button>
          <Button variant="brand" size="sm" className="ml-1">
            <Plus data-icon="inline-start" />
            新任务
          </Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-4 content-start gap-4 overflow-auto p-(--pad-page)">
        {COLUMNS.map((col) => {
          const tasks = source.filter((t) => t.column === col.key);
          return (
            <section
              key={col.key}
              className="flex min-w-(--board-col-min) flex-col gap-2 rounded-(--edge-radius) bg-column p-1.5"
            >
              <header className="flex h-7 items-center gap-2 px-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: `var(${col.dotVar})` }}
                />
                <span
                  className="text-xs text-(--col-head-text)"
                  style={{ fontWeight: 500, letterSpacing: 'var(--label-spacing)' }}
                >
                  {col.label}
                </span>
                <span className="font-mono text-[10px] text-content-dim">{tasks.length}</span>
              </header>
              {tasks.length === 0 && (
                <div className="grid h-24 place-items-center rounded-(--edge-radius) border border-dashed border-line text-[11px] text-content-dim">
                  空列
                </div>
              )}
              {tasks.map((t) => (
                <TodoCard key={t.id} task={t} />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
