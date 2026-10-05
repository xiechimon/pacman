// PROTOTYPE status chip (#909) — previews the destination-side answer to the
// map's fog item "老 ui/chip 五态 → badge 语义适配层": the five tone token
// pairs carried on the shadcn Badge skeleton, no per-face CSS.

import { cn } from 'cn';
import { Badge } from '../components/ui/badge.js';
import { PHASE_UI, type Tone } from '../mock.js';

const TONE_CLASS: Record<Tone, string> = {
  idle: 'bg-(--chip-idle-bg) text-(--chip-idle-fg)',
  plan: 'bg-(--chip-plan-bg) text-(--chip-plan-fg)',
  confirm: 'bg-(--chip-confirm-bg) text-(--chip-confirm-fg)',
  done: 'bg-(--chip-done-bg) text-(--chip-done-fg)',
  failed: 'bg-(--chip-failed-bg) text-(--chip-failed-fg)',
};

export function StatusChip({
  phase,
  className,
}: {
  phase: string;
  className?: string;
}) {
  const ui = PHASE_UI[phase] ?? PHASE_UI.todo;
  return (
    <Badge
      className={cn(
        'h-[18px] rounded-4xl border-0 px-1.5 text-[10.5px] leading-none font-medium',
        TONE_CLASS[ui.tone],
        className,
      )}
    >
      {ui.label}
    </Badge>
  );
}

export function toneClass(tone: Tone) {
  return TONE_CLASS[tone];
}
