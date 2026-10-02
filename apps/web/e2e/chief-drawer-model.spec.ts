import { expect, type Page, test } from '@playwright/test';

// Issue #615 (总管抽屉四连报 A/B/C 的 fixture 面回归): the drawer's model
// row used to be a display-only `<span>` carrying a broken π trace — the
// live loop (verify probe drive-chief-drawer) covers 显示→可改→落库→回显;
// this spec pins the fixture-face half of the same contract:
//   1. the model row is a control (button[aria-haspopup=dialog]) that opens
//      the model dialog; picking a row closes it (accept 律, #148 同律) and
//      the fixture face sends no PATCH (onPick absent).
//   2. the row carries the runtime mark (RuntimePi 块状 π / RuntimeClaudeCode
//      品牌星标 — 正本 = 参考站 providers 运行时 tab SVG; 用户返工裁决：运行时
//      SVG，不是 Agent 头像; the broken 「ㅋ」 trace is gone); unbound keeps the
//      plain `n/a` line with no control at all.
//   3. the message-row copy glyphs are real clipboard buttons (local-first
//      face exists); 恢复 / foot chevron had no backend and no local-first
//      object face, so per the #306/#146 二分律 they are gone, not inert.
//   4. the gear is reachable off-board: wake shells render it and it lands
//      on the board settings view via the ?chief=settings deep link.

const drawer = (page: Page) => page.locator('.chief-drawer');
const modelBtn = (page: Page) => page.locator('.chief-model button[aria-haspopup="dialog"]');

test.describe('chief drawer model row (#615)', () => {
  test('the model row is a control that opens the model dialog', async ({ page }) => {
    await page.goto('/app?scenario=111');
    await expect(drawer(page)).toBeVisible();
    const btn = modelBtn(page);
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('claude-sonnet-5 · 默认');

    await btn.click();
    const dialog = page.locator('.chief-model-pick');
    await expect(dialog).toBeVisible();
    // the inherit row rides first (compaction select 同律: null = 默认)
    await expect(dialog.locator('.chief-model-pick-row').nth(0)).toContainText(
      '默认（与绑定 Agent 相同）',
    );

    // fixture accept 律: picking closes; no live callback, no request
    await dialog.locator('.chief-model-pick-row').nth(0).click();
    await expect(dialog).toHaveCount(0);
    await expect(drawer(page)).toBeVisible();
  });

  test('the model row carries the runtime mark, not an agent avatar', async ({ page }) => {
    await page.goto('/app?scenario=fab-avatar');
    await expect(drawer(page)).toBeVisible();
    const btn = modelBtn(page);
    await expect(btn).toBeVisible();
    // #615 返工裁决：行首 = 运行时标记（fixture 未录 provider 位 = pi 正典
    // π 字形），不是 Agent 头像——头像脸归 FAB / 消息流各自的面
    await expect(btn.locator('.chief-model-mark svg')).toHaveCount(1);
    await expect(btn.locator('.chief-model-mark img')).toHaveCount(0);

    // unbound: plain n/a line, no control (nothing to pick until an agent binds)
    await page.goto('/app?scenario=100');
    await expect(drawer(page)).toBeVisible();
    await expect(modelBtn(page)).toHaveCount(0);
    await expect(page.locator('.chief-model')).toContainText('n/a');
  });

  test('message copy glyphs are clipboard buttons; restore/chevron are gone', async ({
    page,
  }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/app?scenario=114');
    await expect(drawer(page)).toBeVisible();

    const copy = page.locator('.chief-msg-tools button[aria-label="复制"]');
    await expect(copy).toBeVisible();
    await copy.click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('CONTRIBUTING.md');

    // the foot copy wires the assistant text the same way
    const footCopy = page.locator('.chief-msg-foot button[aria-label="复制"]');
    await expect(footCopy).toBeVisible();
    await footCopy.click();
    const footClip = await page.evaluate(() => navigator.clipboard.readText());
    expect(footClip).toContain('已创建并派工');

    // #306/#146 二分律: no backend face → removed, not inert (the copy
    // button's own svg rides inside the button; bare glyph children are gone)
    await expect(page.locator('.chief-msg-tools button')).toHaveCount(1);
    await expect(page.locator('.chief-msg-tools > svg')).toHaveCount(0);
    await expect(page.locator('.chief-msg-foot > svg')).toHaveCount(0);
  });

  test('the gear reaches board settings from a wake surface', async ({ page }) => {
    await page.goto('/app/team?scenario=12');
    await page.locator('.secondary-fab').click();
    await expect(drawer(page)).toBeVisible();
    const gear = drawer(page).locator('button[aria-label="总管设置"]');
    await expect(gear).toBeVisible();

    await gear.click();
    // the deep-link param is consumed (stripped) once the view lands — the
    // stable contract is the settings view itself, not the URL mid-consumption
    await expect(page.locator('.chief-settings')).toBeVisible();
  });
});
