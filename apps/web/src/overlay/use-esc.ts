// Esc closes any open overlay (r7 §4.1.4 observes Esc as the popover
// dismiss path). Shared by the batch A overlays (#66).

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
