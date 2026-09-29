import { expect, test } from '@playwright/test';

// Issue #390 acceptance (品牌与排版组, 2026-09-28 triage #6/#8/#9):
// - 字重基线: 正文 computed font-weight = 400 (DESIGN.md §Typography 三档
//   400/500/600 的锚点; inter-var fvar wght 100–900 default 400 且
//   @font-face 已声明全档范围, 浏览器按请求档实例化, 无需
//   font-variation-settings)。500/600 档抽钉 .todo-card-title /
//   .sched-empty-title, 顺带钉 var 字体真载入 (font-display: optional 下
//   fallback 静默接管是本面最隐蔽的回退)。
// - 侧栏头 = 品牌槽: mark 用仓内 icon-512.png 透明稿作 alpha mask, 随
//   currentColor 双主题换色 (mark 图单点替换位 = 该 mask url);
//   名 = BRAND.manifestName。头部 43px 行几何与 /app/team 导航由
//   sidebar-seam / sidebar-nav 既有断言守。
// - .res-back: hover 无背景变化 (现状即无 hover 面, 此处把律钉死防回潮),
//   键盘 focus 保留 2px --card-button 环 (同 .mach-switch 配方, a11y 不回退)。
// - 侧栏底 = 主区 --surface: 断言行放在 visual-polish.spec.ts (原 #123
//   层级断言的翻转, 同票更新)。

for (const theme of ['light', 'dark'] as const) {
  test(`font baseline: body 400, card title 500, var font really loaded (${theme})`, async ({
    page,
  }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=01');

    const m = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        bodyWeight: getComputedStyle(document.body).fontWeight,
        cardTitleWeight: getComputedStyle(document.querySelector('.todo-card-title')!).fontWeight,
        interLoaded: document.fonts.check('400 14px "inter"'),
      };
    });
    expect(m.interLoaded).toBe(true);
    expect(m.bodyWeight).toBe('400');
    expect(m.cardTitleWeight).toBe('500');
  });

  test(`headline tier 600 holds (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app/schedules?scenario=11');
    const w = await page.evaluate(
      () => getComputedStyle(document.querySelector('.sched-empty-title')!).fontWeight,
    );
    expect(w).toBe('600');
  });

  test(`sidebar header carries the Pacman brand mark + name (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app?scenario=01');

    const m = await page.evaluate(() => {
      const row = document.querySelector('.sidebar-team-row');
      const mark = row?.querySelector('.sidebar-brand-mark');
      const name = row?.querySelector('.sidebar-team-name');
      if (!row || !mark || !name) throw new Error('sidebar brand head missing');
      const ms = getComputedStyle(mark);
      const r = mark.getBoundingClientRect();
      return {
        maskImage: ms.getPropertyValue('mask-image') || ms.getPropertyValue('-webkit-mask-image'),
        // the glyph paints in the row ink through the mask
        markPaint: ms.backgroundColor,
        rowInk: getComputedStyle(row).color,
        markBox: { w: r.width, h: r.height },
        nameText: name.textContent,
        nameHref: name.getAttribute('href'),
      };
    });
    expect(m.maskImage).toContain('/icon-512.png');
    expect(m.markPaint).toBe(m.rowInk);
    expect(m.markPaint).not.toBe('rgba(0, 0, 0, 0)');
    expect(m.markBox).toEqual({ w: 16, h: 16 });
    expect(m.nameText).toBe('Pacman');
    // the head row keeps its /app/team navigation law
    expect(m.nameHref).toContain('/app/team');
  });

  test(`res-back hover shows no background change (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
    await page.goto('/app/resources/skills?scenario=06');

    const read = () =>
      page.evaluate(() => {
        const cs = getComputedStyle(document.querySelector('.res-back')!);
        return { bg: cs.backgroundColor, color: cs.color };
      });
    const rest = await read();
    await page.hover('.res-back');
    await page.waitForTimeout(300); // past any 150ms color step
    const hovered = await read();
    expect(hovered).toEqual(rest);
  });
}

test('res-back keeps a keyboard focus ring', async ({ page }) => {
  await page.goto('/app/resources/skills?scenario=06');
  // keyboard modality: tab until the back chevron owns focus
  for (let i = 0; i < 40; i++) {
    const onBack = await page.evaluate(
      () => document.activeElement?.classList.contains('res-back') ?? false,
    );
    if (onBack) break;
    await page.keyboard.press('Tab');
  }
  await expect(page.locator('.res-back')).toBeFocused();
  const ring = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.res-back')!);
    return { w: cs.outlineWidth, style: cs.outlineStyle, color: cs.outlineColor };
  });
  expect(ring.style).toBe('solid');
  expect(ring.w).toBe('2px');
  // the codebase ring recipe rides --card-button (#4e47dd, both themes)
  expect(ring.color).toBe('rgb(78, 71, 221)');
});
