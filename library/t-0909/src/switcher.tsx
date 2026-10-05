// PROTOTYPE floating switcher (#909) — deliberately NOT part of the design
// being evaluated: fixed high-contrast pill, bottom-center. Left/right arrows
// cycle variants (keyboard ← → too, unless an input has focus); the middle
// segment switches the representative face; the right segment flips the
// light/dark mode.

import { cn } from 'cn';
import { ChevronLeft, ChevronRight } from './icons/index.js';
import type { ProtoState } from './state.js';
import { FACE_LABELS, VARIANTS } from './state.js';

const FACES = Object.keys(FACE_LABELS) as (keyof typeof FACE_LABELS)[];

export function PrototypeSwitcher({
  state,
  patch,
}: {
  state: ProtoState;
  patch: (p: Partial<ProtoState>) => void;
}) {
  const variant = VARIANTS[state.variant];
  return (
    <div
      className="fixed bottom-4 left-1/2 z-[9999] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-black/85 px-2 py-1.5 text-white shadow-[0_8px_24px_rgb(0_0_0/0.5)] backdrop-blur-sm select-none"
      role="toolbar"
      aria-label="原型切换器"
    >
      <button
        type="button"
        aria-label="上一个视觉方向"
        className="rounded-full p-1 hover:bg-white/15"
        onClick={() => patch({ variant: cycleVariant(state.variant, -1) })}
      >
        <ChevronLeft className="size-4" />
      </button>
      <div className="min-w-36 px-1 text-center">
        <div className="text-xs font-semibold">{variant.name}</div>
        <div className="text-[10px] text-white/60">{state.variant.toUpperCase()} 版</div>
      </div>
      <button
        type="button"
        aria-label="下一个视觉方向"
        className="rounded-full p-1 hover:bg-white/15"
        onClick={() => patch({ variant: cycleVariant(state.variant, 1) })}
      >
        <ChevronRight className="size-4" />
      </button>

      <div className="mx-1 h-5 w-px bg-white/20" />

      <div className="flex items-center gap-0.5">
        {FACES.map((f) => (
          <button
            key={f}
            type="button"
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px]',
              state.face === f ? 'bg-white text-black font-semibold' : 'text-white/70 hover:bg-white/15',
            )}
            onClick={() => patch({ face: f })}
          >
            {FACE_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="mx-1 h-5 w-px bg-white/20" />

      <button
        type="button"
        className="rounded-full px-2 py-0.5 text-[11px] text-white/80 hover:bg-white/15"
        onClick={() => patch({ mode: state.mode === 'dark' ? 'light' : 'dark' })}
      >
        {state.mode === 'dark' ? '☀ 浅色' : '☾ 暗色'}
      </button>

      <button
        type="button"
        className={cn(
          'rounded-full px-2 py-0.5 text-[11px]',
          state.data === 'worst' ? 'bg-amber-400 text-black font-semibold' : 'text-white/80 hover:bg-white/15',
        )}
        onClick={() => patch({ data: state.data === 'worst' ? 'normal' : 'worst' })}
      >
        最坏数据
      </button>
    </div>
  );
}

export function cycleVariant(v: ProtoState['variant'], dir: 1 | -1): ProtoState['variant'] {
  const order = ['a', 'b', 'c'] as const;
  const i = order.indexOf(v);
  return order[(i + dir + order.length) % order.length];
}
