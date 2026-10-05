// PROTOTYPE surface (#909): 弹层 — the new-task dialog (672×439 family
// geometry) over a dimmed board. Shell hand-built on token classes so the
// variant geometry (radius/shadow/pad) drives it end to end.

import { cn } from 'cn';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Kbd } from '../components/ui/kbd.js';
import { TagChip } from '../components/ui/tag-chip.js';
import { Plus, X } from '../icons/index.js';
import { BoardFace } from './board-face.js';

const MODELS = ['GLM-5.3', 'Kimi-K3', 'Qwen3.8', 'DeepSeek-V4'];

export function NewTaskOverlayFace({ worst = false }: { worst?: boolean }) {
  return (
    <div className="relative h-full">
      <BoardFace worst={worst} />
      {/* scrim + panel on the z ladder */}
      <div className="fixed inset-0 z-(--z-modal-scrim) bg-(--overlay-scrim)" aria-hidden="true" />
      <div
        role="dialog"
        aria-label="新任务"
        className="fixed top-1/2 left-1/2 z-(--z-dialog) flex h-[439px] w-[672px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-(--edge-radius) bg-(--dialog-bg) text-sm text-popover-foreground [box-shadow:var(--edge-ring),var(--dialog-shadow)]"
      >
        <header className="flex h-12 shrink-0 items-center px-4">
          <h2
            className="text-sm text-foreground"
            style={{ fontWeight: 'var(--title-weight)' as never, letterSpacing: 'var(--title-tracking)' }}
          >
            新任务
          </h2>
          <Button variant="ghost" size="icon-xs" aria-label="关闭" className="ml-auto">
            <X />
          </Button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
          <textarea
            className="min-h-24 w-full resize-none rounded-(--radius-md) border border-input bg-transparent p-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            placeholder="描述任务…（正文单字段，agent 回填标题/标签）"
            defaultValue="mea 上的 pacman 控制面断线重连后自动重新 enroll daemon，systemd 三件套逐个探测，失败走有界重试。"
          />
          <div className="flex items-center gap-2 text-xs text-content-tertiary">
            <span
              style={{
                fontFamily: 'var(--font-label)',
                fontSize: 'var(--label-size)',
                letterSpacing: 'var(--label-spacing)',
                textTransform: 'var(--label-transform)' as never,
              }}
            >
              项目
            </span>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-(--radius-md) bg-surface-secondary px-2 py-1 text-content-secondary"
            >
              <span className="grid size-3.5 place-items-center rounded-full bg-(--project-avatar-bg) text-[8px] font-semibold text-(--project-avatar-fg)">
                P
              </span>
              pacman
            </button>
            <span
              className="ml-3"
              style={{
                fontFamily: 'var(--font-label)',
                fontSize: 'var(--label-size)',
                letterSpacing: 'var(--label-spacing)',
                textTransform: 'var(--label-transform)' as never,
              }}
            >
              标签
            </span>
            <TagChip tag={{ id: 't-be', name: '后端', color: '#4e81ee' }} />
            <button
              type="button"
              aria-label="添加标签"
              className="grid size-5 place-items-center rounded-full text-content-dim hover:bg-sidebar-hover"
            >
              <Plus className="size-3" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-content-tertiary">
            <span
              style={{
                fontFamily: 'var(--font-label)',
                fontSize: 'var(--label-size)',
                letterSpacing: 'var(--label-spacing)',
                textTransform: 'var(--label-transform)' as never,
              }}
            >
              模型
            </span>
            <div className="flex gap-0.5 rounded-4xl bg-surface-secondary p-0.5">
              {MODELS.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  className={cn(
                    'rounded-4xl px-2.5 py-1 font-mono text-[11px] transition-colors',
                    i === 0
                      ? 'bg-(--pick-selected-bg) text-(--pick-selected-fg)'
                      : 'text-content-tertiary hover:bg-sidebar-hover',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-auto flex items-center gap-2 pb-1 text-[10px] text-content-dim">
            <Kbd className="text-[10px]">⌘↵</Kbd> 创建 · <Kbd className="text-[10px]">esc</Kbd> 丢弃
          </div>
        </div>
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-4 py-3">
          <Button variant="outline" size="sm">
            取消
          </Button>
          <Button variant="brand" size="sm">
            建任务
          </Button>
        </footer>
      </div>
    </div>
  );
}
