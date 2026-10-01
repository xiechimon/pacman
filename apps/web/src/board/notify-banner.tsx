// 看板顶部通知引导条 (issue #114, 02 §9.1 / r2 §1.3 / r3 §7): the strip shows
// while Notification.permission === 'default'; 开启 calls
// Notification.requestPermission() and the bar hides on either resolution
// (granted → sse.ts fireDesktopNotification unlocks, denied → the in-app
// 未读面 stays the fallback, 04 §5 divergence). Copy single source = shared
// NOTIFICATION_BANNER_COPY canon (zh authoritative, en fallback via t()).
// Geometry/colors measured from the r2 01 (light) / 28 (dark) captures —
// the r7 board baselines predate the strip, so fixture scenarios opt in via
// ui.notificationBanner and the live board reads the real permission.

import { NOTIFICATION_BANNER_COPY } from '@pacman/shared';
import { useCallback, useState } from 'react';
import { Button } from '../components/ui/button.js';
import { useI18n } from '../i18n/provider.js';

/** The 铃铛 glyph (r2 01/28: indigo bell on the tinted disc). Inline because
 *  apps/web/src/icons is generated (scripts/generate-icons.mjs) from the r7
 *  icon dump, which has no bell — the banner predates that capture batch. */
function Bell() {
  return (
    <svg
      aria-hidden="true"
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export type NotificationPermissionState = NotificationPermission | 'unsupported';

function readPermission(): NotificationPermissionState {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

/** Permission state machine, single source for the #114 banner and the
 *  #148 account 推送通知 switch. `fixtureState` non-null freezes the initial
 *  read (scenario mode): the fixture build's headless chromium reports
 *  Notification.permission as 'denied', and the r7-baselined surfaces were
 *  captured without either affordance, so the real API may never leak into
 *  the fixture data面. Null = live: read the real permission. request()
 *  always calls the real Notification.requestPermission() and settles the
 *  state either way (granted unlocks sse.ts fireDesktopNotification, denied
 *  leaves the in-app 未读面 the fallback, 04 §5 divergence). */
export function useNotificationPermission(fixtureState: NotificationPermissionState | null): {
  permission: NotificationPermissionState;
  request: () => void;
} {
  const [permission, setPermission] = useState<NotificationPermissionState>(
    () => fixtureState ?? readPermission(),
  );
  const request = useCallback(() => {
    if (typeof Notification === 'undefined') return;
    try {
      // promise form (modern browsers); a rejection still settles the state
      void Promise.resolve(Notification.requestPermission()).then(
        (next) => setPermission(next),
        () => setPermission('denied'),
      );
    } catch {
      setPermission('denied');
    }
  }, []);
  return { permission, request };
}

export function useNotificationBanner(
  fixtureFlag: boolean,
  live: boolean,
): { visible: boolean; enable: () => void } {
  const { permission, request } = useNotificationPermission(
    live ? null : fixtureFlag ? 'default' : 'granted',
  );
  return { visible: permission === 'default', enable: request };
}

export function NotificationBanner({ onEnable }: { onEnable: () => void }) {
  const { t } = useI18n();
  return (
    <section className="board-notify-banner" aria-label={t(NOTIFICATION_BANNER_COPY.title)}>
      <span className="board-notify-banner-icon">
        <Bell />
      </span>
      <div className="board-notify-banner-text">
        <div className="board-notify-banner-title">{t(NOTIFICATION_BANNER_COPY.title)}</div>
        <div className="board-notify-banner-body">{t(NOTIFICATION_BANNER_COPY.body)}</div>
      </div>
      {/* spec16 #414 试点片收口（#561）：切 components/ui Button——brand 档
          = 轨 A3 primary 等价迁移位（同 --card-button 实底），sm = compact
          28px 档。像素纪律（零视觉重钉）：r2 实测 per-face 值（12px 内距 /
          13px 字号 / 400 字重）按 todo-card 口径以工具类钉回。件本体 B 配方
          差值（focus 环 #388 canon / 150ms 色过渡 / 1px 透明边）随全站
          shadcn 件统一，属该收的口，PR body 列明。board-notify-banner-action
          是 e2e(notify-banner.spec) 钉死的选择器别名，布局差值留在 board.css。 */}
      <Button
        variant="brand"
        size="sm"
        className="board-notify-banner-action px-3 text-[13px] font-normal"
        onClick={onEnable}
      >
        {t(NOTIFICATION_BANNER_COPY.action)}
      </Button>
    </section>
  );
}
