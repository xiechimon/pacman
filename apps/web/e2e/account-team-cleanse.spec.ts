import { expect, type Page, test } from '@playwright/test';

// Issue #148 acceptance (台账 #136 account/team 行, local-first 裁决):
// - account: 退出登录 / 删除 (the SaaS account-deletion face) no longer
//   render; 更换 removed by #306 (M7 二分律出账: no avatar upload face,
//   the asset is static — supersedes #148's keep-as-chrome ruling).
// - account 推送通知 switch mirrors the real Notification.permission and an
//   off click drives the same requestPermission() path as the #114 banner
//   (shared useNotificationPermission). Live mode only — no ?scenario= —
//   because the fixture rows freeze the switch granted for the r7 13
//   baseline (parity's headless chromium reports the real API 'denied').
// - team: 设置 routes to the account surface (the app's only settings
//   face); the grid|chart tablist is a real toggle persisted to
//   pacman.teamMembersLayout — chart swaps the content block for the
//   暂无成员 empty state and drops the stats bar + 创建 Agent slot.

declare global {
  interface Window {
    __permCalls: number;
  }
}

/** Replace window.Notification: permission reads `initial` until
 *  requestPermission() settles it to `resolution` (mirroring the real
 *  API, where the property reflects the decision), counting calls. Same
 *  stub as notify-banner.spec.ts. */
function stubNotification(
  page: Page,
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

test('account: 退出登录 / 删除 / 更换 removed (avatar stays)', async ({ page }) => {
  await page.goto('/app/account?scenario=13');
  await expect(page.locator('.account-card')).toBeVisible();
  await expect(page.locator('.account-logout')).toHaveCount(0);
  await expect(page.locator('.account-delete')).toHaveCount(0);
  await expect(page.locator('.account-swap')).toHaveCount(0);
  await expect(page.locator('.account-avatar img')).toBeVisible();
});

test('account switch: default permission renders off; click requests and grants', async ({
  page,
}) => {
  await stubNotification(page, 'default', 'granted');
  await page.goto('/app/account');
  const sw = page.locator('.account-switch');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => window.__permCalls)).toBe(1);
});

test('account switch: granted permission renders checked without a click', async ({ page }) => {
  await stubNotification(page, 'granted', 'granted');
  await page.goto('/app/account');
  await expect(page.locator('.account-switch')).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => window.__permCalls)).toBe(0);
});

test('account switch: denied stays off; a click settles without granting', async ({ page }) => {
  await stubNotification(page, 'denied', 'denied');
  await page.goto('/app/account');
  const sw = page.locator('.account-switch');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => window.__permCalls)).toBe(1);
});

test('team: 设置 routes to the account surface', async ({ page }) => {
  await page.goto('/app/team?scenario=12');
  await page.locator('.secondary-link').click();
  await expect(page).toHaveURL(/\/app\/account/);
  await expect(page.locator('.account-card')).toBeVisible();
});

test('team: chart tab swaps to the 暂无成员 empty state, persists, and returns', async ({
  page,
}) => {
  await page.goto('/app/team?scenario=12');
  const gridTab = page.locator('.team-layout-tab[aria-label="grid"]');
  const chartTab = page.locator('.team-layout-tab[aria-label="chart"]');
  await expect(page.locator('.team-agent-card').first()).toBeVisible();

  await chartTab.click();
  await expect(page.locator('.team-chart-empty')).toHaveText('暂无成员');
  await expect(page.locator('.team-agent-card')).toHaveCount(0);
  await expect(page.locator('.team-create-agent')).toHaveCount(0);
  await expect(page.locator('.team-members')).toHaveCount(0);
  await expect(chartTab).toHaveAttribute('aria-selected', 'true');
  await expect(gridTab).toHaveAttribute('aria-selected', 'false');

  // the choice survives a reload (pacman.teamMembersLayout)
  await page.reload();
  await expect(page.locator('.team-chart-empty')).toBeVisible();

  // and the tablist is the way back — no trap in chart layout
  await page.locator('.team-layout-tab[aria-label="grid"]').click();
  await expect(page.locator('.team-agent-card').first()).toBeVisible();
  await expect(page.locator('.team-members')).toBeVisible();
});
