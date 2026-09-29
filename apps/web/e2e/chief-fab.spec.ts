import { expect, test } from '@playwright/test';

// Issue #443 acceptance: 详情页总管 FAB 仅未读才显示. The detail family is
// the intentional divergence from the #129 every-family-constant FAB ruling
// (出处行在 chief-wake.tsx 的 unreadOnly prop，ADR 0002 D7 之律) — the FAB
// carries the only constant unread-badge surface, so on the detail face it
// renders exactly when there is something unread. Failure modes pinned here
// (fixture face; the live 未读归零即消失 path rides the same reactive
// derivation — chiefUnread is query-derived, the button unmounts in the same
// render):
//   1. unread 0 still renders the FAB (gating not wired / prop ignored)
//   2. unread > 0 renders no FAB, or the badge value does not pass through
//      (a 1 would pass on presence alone — the pin rides 3)
//   3. the gated FAB loses the family geometry (r7 §3.4 48×48, #366
//      right-pane offset, #347 composer 让位) — gating must not touch layout
//   4. the wake surface unmounts with the FAB — the drawer walk on the
//      unread face rides the shell-consistency detail row (scenario
//      detail-unread); the hotkey path stays registered by useChiefSurface
//      regardless of the button (键位以 #442 落地为准, not pinned here)

const DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc';

test.describe('detail FAB renders only with unread (#443)', () => {
  test('unread 0: the detail route renders no FAB', async ({ page }) => {
    await page.goto(`${DETAIL}?scenario=16`);
    await expect(page.locator('[data-route="todo-detail"]')).toBeVisible();
    await expect(page.locator('.detail-fab')).toHaveCount(0);
  });

  test('unread > 0: the FAB renders with the badge value', async ({ page }) => {
    await page.goto(`${DETAIL}?scenario=detail-unread`);
    const fab = page.locator('.detail-fab');
    await expect(fab).toBeVisible();
    await expect(fab.locator('.fab-badge')).toHaveText('3');
  });

  test('the gated FAB keeps the family geometry (48×48, pane offset, composer 让位)', async ({
    page,
  }) => {
    await page.goto(`${DETAIL}?scenario=detail-unread`);
    const geometry = await page.locator('.detail-fab').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { width: cs.width, height: cs.height, right: cs.right, bottom: cs.bottom };
    });
    // r7 §3.4: 48×48; #366: right = --detail-pane-right 488 + 16; #347:
    // the planning surface carries a composer → the FAB yields to 104
    expect(geometry).toEqual({ width: '48px', height: '48px', right: '504px', bottom: '104px' });
  });
});
