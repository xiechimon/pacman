// PROTOTYPE surface (#909): 搜索 — the ⌘K panel (520×440, 60% scrim) over
// the board: 40px input row, 31px group labels, 40px result rows.

import { cn } from 'cn';
import { Kbd } from '../components/ui/kbd.js';
import { FileText, Monitor, Search } from '../icons/index.js';
import { SEARCH_RESULTS } from '../mock.js';
import { BoardFace } from './board-face.js';
import { StatusChip } from './status-chip.js';

export function SearchFace({ worst = false }: { worst?: boolean }) {
  return (
    <div className="relative h-full">
      <BoardFace worst={worst} />
      <div className="fixed inset-0 z-(--z-modal-scrim) bg-(--overlay-scrim)" aria-hidden="true" />
      <div
        role="dialog"
        aria-label="搜索"
        className="fixed top-[12vh] left-1/2 z-(--z-modal) flex h-[440px] w-[520px] -translate-x-1/2 flex-col overflow-hidden rounded-(--edge-radius) bg-(--dialog-bg) text-sm text-popover-foreground [box-shadow:var(--edge-ring),var(--dialog-shadow)]"
      >
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
          <Search className="size-4 shrink-0 text-content-dim" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            defaultValue="session"
            aria-label="搜索输入"
          />
          <Kbd className="text-[10px]">esc</Kbd>
        </div>
        <div className="min-h-0 flex-1 overflow-auto py-1">
          <div
            className="flex h-[31px] items-center px-3 text-content-dim"
            style={{
              fontFamily: 'var(--font-label)',
              fontSize: 'var(--label-size)',
              letterSpacing: 'var(--label-spacing)',
              textTransform: 'var(--label-transform)' as never,
            }}
          >
            结果 · 4
          </div>
          {SEARCH_RESULTS.map((r, i) => (
            <div
              key={r.title}
              className={cn(
                'flex h-10 items-center gap-2.5 px-3',
                i === 0 ? 'bg-(--row-selected)' : 'hover:bg-surface-hover',
              )}
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-(--radius-sm) bg-(--row-icon-bg) text-content-tertiary">
                {r.kind === '任务' ? <FileText className="size-3" /> : <Monitor className="size-3" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-popover-foreground">
                {r.title}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-content-dim">{r.meta}</span>
              {r.phase && <StatusChip phase={r.phase} className="shrink-0" />}
            </div>
          ))}
        </div>
        <div className="flex h-8 shrink-0 items-center gap-2 border-t border-line px-3 text-[10px] text-content-dim">
          <Kbd className="text-[10px]">↑↓</Kbd> 选择 <Kbd className="text-[10px]">↵</Kbd> 打开
          <span className="ml-auto">pacman · 2 台机器在线</span>
        </div>
      </div>
    </div>
  );
}
