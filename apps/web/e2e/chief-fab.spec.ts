import { expect, type Page, test } from '@playwright/test';

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

// Issue #444 acceptance: FAB 图标 = 绑定 Agent 头像. The icon source switches
// at the consumption points (ChiefFabIcon, shared by ChiefWake and the board
// inline button) — the script-generated ChiefFab asset stays untouched. The
// avatar semantics belong to the Avatar primitive (dicebear seed / avatarUrl
// override / onError 退静态资产 — pinned by avatar-dicebear.spec.ts); pinned
// here is the FAB-level 绑定态二选一 + pass-through. Failure modes:
//   1. a bound face still renders the static glyph (either consumer missed:
//      board inline / the ChiefWake families)
//   2. an unbound face loses the glyph (avatar or a new placeholder face
//      renders where the ruling keeps the static asset)
//   3. the avatarUrl override loses to the generated face (src not passed
//      through at the FAB level)
//   4. the avatar does not fill the 48×48 circle, or the badge/geometry
//      drift on the avatar face

const R3_SRC = 'https://api.dicebear.com/9.x/lorelei/svg?seed=r3-builder';
const SVG_BODY =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="12"/></svg>';

/** Hermetic dicebear: the generated avatar "loads" without network
 *  (avatar-dicebear.spec.ts idiom). */
async function stubDicebear(page: Page) {
  await page.route('**/api.dicebear.com/**', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: SVG_BODY }),
  );
}

test.describe('FAB icon follows the bound agent (#444)', () => {
  test('bound: the board FAB swaps the glyph for the seeded avatar, badge and geometry stay', async ({
    page,
  }) => {
    await stubDicebear(page);
    await page.goto('/app?scenario=fab-avatar');
    const fab = page.locator('.chief-fab');
    const img = fab.locator('.fab-avatar img');
    await expect(img).toHaveAttribute('src', R3_SRC);
    await expect(fab.locator('svg')).toHaveCount(0);
    await expect(fab.locator('.fab-badge')).toHaveText('2');
    // 头像铺满 48×48 圆（board 面无边框），FAB 几何不动
    const fabBox = await fab.boundingBox();
    const imgBox = await img.boundingBox();
    expect(fabBox?.width).toBeCloseTo(48, 0);
    expect(fabBox?.height).toBeCloseTo(48, 0);
    expect(imgBox?.x).toBeCloseTo(fabBox?.x ?? Number.NaN, 0);
    expect(imgBox?.y).toBeCloseTo(fabBox?.y ?? Number.NaN, 0);
    expect(imgBox?.width).toBeCloseTo(48, 0);
    expect(imgBox?.height).toBeCloseTo(48, 0);
  });

  test('bound: a ChiefWake family swaps at the shared consumption point', async ({ page }) => {
    await stubDicebear(page);
    await page.goto('/app/team?scenario=fab-avatar');
    // button 限定：fab-avatar 场景抽屉开态即挂载，面板本体也带 aria-label
    // 总管（chief-drawer.tsx）——裸属性选择器会双匹配（#947 重钉实测）。
    const fab = page.locator('button[aria-label="总管"]');
    await expect(fab.locator('.fab-avatar img')).toHaveAttribute('src', R3_SRC);
    await expect(fab.locator('svg')).toHaveCount(0);
    await expect(fab.locator('.fab-badge')).toHaveText('2');
  });

  test('avatarUrl override wins over the generated face', async ({ page }) => {
    await page.goto('/app?scenario=fab-avatar-override');
    await expect(page.locator('.chief-fab .fab-avatar img')).toHaveAttribute(
      'src',
      '/avatar-robot-2.svg',
    );
  });

  test('unbound: the static glyph stays, no avatar face', async ({ page }) => {
    await page.goto('/app/team?scenario=12');
    const fab = page.locator('button[aria-label="总管"]');
    await expect(fab.locator('svg')).toHaveCount(1);
    await expect(fab.locator('.fab-avatar')).toHaveCount(0);
  });
});
