// Service-worker registration + notification-click routing consumer
// (issue #74). sw.js is the r1 capture carried over byte-for-byte: its
// live path is notificationclick deep-linking, whose page-side consumer
// the original names ServiceWorkerRegister.tsx (sw.js comment) — this
// component is its replica shape. Two wake paths per the sw.js design:
// postMessage (fast path, listening pages) and the CacheStorage
// `/__pending-nav` slot (iOS suspends background PWA pages and drops the
// message). The push handler stays as dead code by ruling: the server
// never sends push (04-验收口径 §5 divergence A5).

import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';

const SW_URL = '/sw.js';
const NAV_CACHE = 'nav'; // sw.js notificationclick writes here
const NAV_SLOT = '/__pending-nav';

/** Pull-and-consume the pending deep link the sw parked in CacheStorage. */
async function consumePendingNav(route: (href: string) => void): Promise<void> {
  try {
    const cache = await caches.open(NAV_CACHE);
    const response = await cache.match(NAV_SLOT);
    if (response == null) return;
    await cache.delete(NAV_SLOT);
    const payload: unknown = await response.json();
    const href = (payload as { href?: unknown }).href;
    if (typeof href === 'string' && href !== '') route(href);
  } catch {
    // CacheStorage unavailable (private mode / insecure context) — the
    // postMessage fast path still covers foreground clicks
  }
}

/** Pathless layout route: registers the worker once and routes deep links
 *  client-side (sw.js keeps only path+query+hash, the page owns routing). */
export function PwaBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(SW_URL).catch(() => {
      // registration is best-effort: the app is fully functional without it
    });
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; href?: unknown } | null;
      if (data?.type === 'notificationclick' && typeof data.href === 'string') {
        navigate(data.href);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    void consumePendingNav((href) => navigate(href));
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);
  return <Outlet />;
}
