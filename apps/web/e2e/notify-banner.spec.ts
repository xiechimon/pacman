import { expect, test } from '@playwright/test';

// Issue #114 acceptance: the 看板顶部通知引导条 (r2 §1.3 / 02 §9.1) shows
// while Notification.permission === 'default', the 开启 button drives
// Notification.requestPermission(), and the strip hides on either
// resolution (granted/denied). Copy assertions are the shared
// NOTIFICATION_BANNER_COPY canon verbatim.
//
// The fixture scenario (ui.notificationBanner) freezes the pre-permission
// state — the parity harness's headless chromium reports the real API as
// 'denied', so the live permission can never pin a fixture row. The stub
// below replaces window.Notification to make the requestPermission()
// resolution deterministic and observable (call count).

declare global {
  interface Window {
    __permCalls: number;
  }
}

/** Replace window.Notification: permission reads `initial` until
 *  requestPermission() settles it to `resolution` (mirroring the real
 *  API, where the property reflects the decision), counting calls. */
function stubNotification(
  page: import('@playwright/test').Page,
  initial: string,
  resolution: string,
) {
  return page.addInitScript(
    ({ p, r }) => {
      let perm = p;
      window.__permCalls = 0;
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: {
          get permission() {
            return perm;
          },
          requestPermission() {
            window.__permCalls++;
            perm = r;
            return Promise.resolve(r);
          },
        },
      });
    },
    { p: initial, r: resolution },
  );
}

test('permission=default → banner renders the canon copy', async ({ page }) => {
  await stubNotification(page, 'default', 'granted');
  await page.goto('/app?scenario=notify-banner');

  const banner = page.locator('.board-notify-banner');
  await expect(banner).toBeVisible();
  await expect(banner.locator('.board-notify-banner-title')).toHaveText('浏览器通知未开启');
  await expect(banner.locator('.board-notify-banner-body')).toHaveText(
    '标签页切换到后台时，通过桌面通知提醒你。',
  );
  await expect(banner.locator('.board-notify-banner-action')).toHaveText('开启');
});

test('开启 → requestPermission() fires; granted hides the bar', async ({ page }) => {
  await stubNotification(page, 'default', 'granted');
  await page.goto('/app?scenario=notify-banner');

  const banner = page.locator('.board-notify-banner');
  await expect(banner).toBeVisible();
  await banner.locator('.board-notify-banner-action').click();

  await expect(banner).toHaveCount(0);
  expect(await page.evaluate(() => window.__permCalls)).toBe(1);
  // the sse.ts fireDesktopNotification gate reads this exact slot —
  // granted here is what unlocks the 后台桌面通知 chain
  expect(await page.evaluate(() => Notification.permission)).toBe('granted');
});

test('开启 → denied resolution also hides the bar', async ({ page }) => {
  await stubNotification(page, 'default', 'denied');
  await page.goto('/app?scenario=notify-banner');

  const banner = page.locator('.board-notify-banner');
  await expect(banner).toBeVisible();
  await banner.locator('.board-notify-banner-action').click();

  await expect(banner).toHaveCount(0);
  expect(await page.evaluate(() => window.__permCalls)).toBe(1);
});

test('scenarios without the flag never render the strip', async ({ page }) => {
  // even at a 'default' permission the fixture board stays banner-free —
  // the r7-baselined matrix rows depend on it
  await stubNotification(page, 'default', 'granted');
  await page.goto('/app?scenario=01');
  await expect(page.locator('.board-notify-banner')).toHaveCount(0);
  expect(await page.evaluate(() => window.__permCalls)).toBe(0);
});
