// Esc closes any open overlay (r7 §4.1.4 observes Esc as the popover
// dismiss path). Shared by the batch A overlays (#66).
// 挂接保持被动 effect（弹层族既有节奏）：改 layout effect 会把重挂接塞进
// 同一事件派发（内层关 → 同步重挂 → 外层同键吃到），破坏 Esc 分层律
// （newtask-tags/newtask-project-select 钉着）。开层瞬间的 Esc 丢失风险
// 由 e2e 重试律兜底（search-focus 先例），不动挂载时序。

import { useEffect } from 'react';

export function useEscClose(onClose: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, enabled]);
}
