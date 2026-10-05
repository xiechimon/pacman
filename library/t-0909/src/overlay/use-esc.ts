// Esc closes any open overlay (r7 §4.1.4 observes Esc as the popover
// dismiss path). Shared by the batch A overlays (#66).
// 挂接保持被动 effect（弹层族既有节奏）：改 layout effect 会把重挂接塞进
// 同一事件派发（内层关 → 同步重挂 → 外层同键吃到），破坏 Esc 分层律
// （newtask-tags/newtask-project-select 钉着）。开层瞬间的 Esc 丢失风险
// 由 e2e 重试律兜底（search-focus 先例），不动挂载时序。
// #466：接线按 enabled 周期注册一次，永不按渲染注册——最新 onClose 走
// ref（#67 家族旧手写 Esc hook 的同法修复，该 hook 已随 #656 退役；
// 重渲染重挂的丢失机理见 escape-wiring.spec.ts 的失败面记录）。

import { useEffect, useRef } from 'react';

export function useEscClose(onClose: () => void, enabled = true): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
}
