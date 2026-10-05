// Shared live row (#873): one behaviour source for every chat surface that
// shows a running step — the detail transcript (r7 16/26 `准备工作区...`) and
// the chief drawer (#739 in-flight presence row). The two used to be separate
// copies that drifted: the chief's row became a real disclosure in #822 while
// the detail's kept a bare chevron, and only the detail carried a seconds
// counter — frozen, because nothing re-rendered it.
//
// Failure ways this component closes (enumerated before the code):
//   F1 the seconds only advanced when something ELSE re-rendered the row
//      (a text delta, a refetch): in a silent window the label froze at the
//      value it had when the row first painted (the reported `1s`). Fix =
//      the row owns a 1s ticker over a real `startedAt`.
//   F2 the row tail carried a chevron with nothing behind it (#634's「形必须
//      带义」violation, the detail-page twin of #822): a disclosure glyph is
//      rendered only when the caller supplies a panel.
//   F3 the surfaces disagreed: same situation, different affordances. Fix =
//      both render through this row, with the skin and the panel content as
//      the only per-surface inputs.
//
// #471 law: seconds never lie. The counter reads a real start timestamp and
// stops the moment the row unmounts; a surface with no start timestamp (the
// chief's activeRun envelope has none) passes `startedAt` null and renders no
// counter at all — an absent number, not a frozen one.

import { Atom } from 'loading-dev';
import { type ReactNode, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/provider.js';
import type { TVars } from '../../i18n/translate.js';
import { ChevronDown, ChevronRight } from '../../icons/index.js';
import { Button } from '../ui/button.js';

/** Elapsed whole seconds since `startedAt`, re-read on a 1s beat while a
 *  start stamp is present. Returns null when there is no stamp — the caller
 *  then renders no counter (never a fabricated one). */
export function useLiveSeconds(startedAt: number | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt == null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (startedAt == null) return null;
  return Math.max(1, Math.round((now - startedAt) / 1000));
}

/** Per-surface skin. The row skeleton and every behaviour stay shared.
 *  detail 面仍走类名（detail.css，#945 清零面）；chief 面 #950 清零后 =
 *  token utility（旧 .chief-streaming 族等值）。headBtn = 仅 Button 形态
 *  （disclosure 在位）追加的行钮中和：#885 靶高律（自然内容高 21px 的
 *  font:inherit 行框 = text-sm leading-normal，+2×1.5px 内边距 = 24px 命中
 *  盒，纵向内边距被等量负 margin 抵掉、墨迹零位移）+ ghost 件配方七通道
 *  归零（旧 button.chief-streaming 的 background:none/border:none unlayered
 *  恒压件层——迁移后逐通道显式钉回：无 hover 涂底、无 hover/expanded 墨变、
 *  tertiary 墨常驻）。detail 面 headBtn 留空：其 per-face CSS 自有同款律。 */
const SKIN = {
  detail: {
    head: 'chat-streaming',
    headBtn: '',
    spinner: 'chat-spinner',
    secs: 'chat-streaming-secs',
    label: 'chat-streaming-label',
  },
  chief: {
    head: 'flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs leading-4 text-(--text-tertiary)',
    headBtn:
      '-my-[1.5px] cursor-pointer border-none bg-transparent py-[1.5px] text-left text-sm leading-normal hover:bg-transparent hover:text-(--text-tertiary) dark:hover:bg-transparent dark:hover:text-(--text-tertiary) aria-expanded:bg-transparent aria-expanded:text-(--text-tertiary)',
    spinner:
      'flex-none animate-[spinner-breathe_1800ms_var(--ease-standard)_infinite] text-(--card-button) motion-reduce:animate-none',
    secs: 'tabular-nums',
    label: 'truncate text-(--text-dim)',
  },
} as const;

/** 「最近信号：Ns 前」（#905，两面共用的披露行）：对 activity 事件的 server
 *  盖章时刻走 1s 表（useLiveSeconds 复用）——数字持续增长即「卡住」的诚实
 *  呈现，daemon 只在真有流事件时上报，静默期无人推新（#471 律：没有真实
 *  时刻就整行不渲染，绝不摆冻结数）。 */
export function LiveSignal({ at, className }: { at?: number | null; className: string }) {
  const { t } = useI18n();
  const secs = useLiveSeconds(at ?? null);
  if (secs == null) return null;
  return <span className={className}>{t('最近信号：{n}s 前', { n: secs })}</span>;
}

export interface LiveRowProps {
  variant: keyof typeof SKIN;
  /** Already-translated row label (`处理中...` / `正在停止…` / …). */
  label: string;
  /** t(label) 的插值参数（#905 活动标签 `正在执行工具：{n}` 等）。 */
  labelVars?: TVars;
  /** Live start stamp — the row ticks `Ns` from it. Null/absent = no counter. */
  startedAt?: number | null;
  /** Static capture value (fixture records carry a frozen `3s`). Ignored when
   *  `startedAt` is present: a live row reads the clock, a capture reads the
   *  capture. */
  seconds?: number | null;
  /** Present ⇒ the row head is a real button (with a chevron) that toggles
   *  `children`; absent ⇒ plain text, and no chevron is rendered at all. */
  disclosure?: { expand: string; collapse: string } | null;
  /** The disclosure panel. Rendered only while expanded. */
  children?: ReactNode;
}

export function LiveRow({
  variant,
  label,
  labelVars,
  startedAt,
  seconds,
  disclosure = null,
  children,
}: LiveRowProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const tick = useLiveSeconds(startedAt);
  const shown = tick ?? seconds ?? null;
  const skin = SKIN[variant];
  const body = (
    <>
      <Atom size={16} duration={900} className={skin.spinner} />
      {shown != null && <span className={skin.secs}>{shown}s</span>}
      {disclosure != null &&
        (expanded ? (
          <ChevronDown width={10} height={10} />
        ) : (
          <ChevronRight width={10} height={10} />
        ))}
      <span className={skin.label}>{t(label, labelVars)}</span>
    </>
  );
  return (
    <>
      {disclosure == null ? (
        <span className={skin.head}>{body}</span>
      ) : (
        <Button
          variant="ghost"
          className={`${skin.head} ${skin.headBtn} h-auto rounded-none justify-start font-normal active:not-aria-[haspopup]:translate-y-0 [&_svg:not([class*='size-'])]:size-auto`}
          aria-label={t(expanded ? disclosure.collapse : disclosure.expand)}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {body}
        </Button>
      )}
      {disclosure != null && expanded && children}
    </>
  );
}
