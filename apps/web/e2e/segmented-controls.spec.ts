import { expect, type Locator, type Page, test } from '@playwright/test';

// Issue #138 acceptance: the segmented-control family (PageShell .page-tab,
// sched-form freq, project files seg, tasks view toggle, detail doc/chat
// tabs, user-menu 外观, branch-dialog seg, skills-import tabs, team layout
// toggle, chief settings tabs) gives unselected items a visible hover tint
// in both themes, the selected chip keeps its own fill under hover, and the
// hover highlight rides the SAME box + radius as the selected chip (one
// geometry, two depths). Group geometry follows the official probes: the
// page-tab family carries the r2 24b/24c hairline ring (1px border + 2px
// padding, chip inset), the detail tab group the r7 §3.3 68×28 ring+plate.
// The freq dark active chip must read against its container (the
// --surface-elevated fill was container-identical in dark = invisible).

const PROJ = '/app/project/ZAQczKCu0MOAzC1ZqcFlX';
const TODO = '/app/todo/7ve0iOkQ-JBpSL98zSiGc';

const HOVER_DARK = 'rgba(255, 255, 255, 0.05)'; // --seg-hover dark
const HOVER_LIGHT = 'rgba(28, 25, 23, 0.05)'; // --seg-hover light
const CHIP_DARK = 'rgb(39, 39, 42)'; // --tab-chip-bg dark
const CHIP_LIGHT = 'rgb(250, 247, 243)'; // --tab-chip-bg light
const GROUP_DARK = 'rgb(31, 31, 35)'; // --surface-secondary dark
const GROUP_LIGHT = 'rgb(241, 237, 231)'; // --surface-secondary light

const bg = (loc: Locator) =>
  loc.evaluate((el) => getComputedStyle(el).backgroundColor);

async function themed(page: Page, theme: 'dark' | 'light', url: string) {
  await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
  await page.goto(url);
}

test('page-tab: unselected hover tints the chip — dark + light', async ({ page }) => {
  await page.goto(`${PROJ}?scenario=r2-24b`);
  const files = page.locator('.page-tab', { hasText: '文件' });

  expect(await bg(files)).toBe('rgba(0, 0, 0, 0)');
  await files.hover();
  await expect.poll(() => bg(files)).toBe(HOVER_DARK);

  await themed(page, 'light', `${PROJ}?scenario=r2-24b`);
  const lightFiles = page.locator('.page-tab', { hasText: '文件' });
  await lightFiles.hover();
  await expect.poll(() => bg(lightFiles)).toBe(HOVER_LIGHT);
});

test('page-tab: selected chip keeps its fill under hover, same geometry as the hover tint', async ({
  page,
}) => {
  await page.goto(`${PROJ}?scenario=r2-24b`);
  const tasks = page.locator('.page-tab', { hasText: '任务' });
  const files = page.locator('.page-tab', { hasText: '文件' });

  expect(await bg(tasks)).toBe(CHIP_DARK);
  await tasks.hover();
  await page.waitForTimeout(250); // past the 150ms color step
  expect(await bg(tasks)).toBe(CHIP_DARK); // hover must not wash the chip

  // one geometry for both states: same radius, and the hover tint paints
  // the chip's own box (no layout shift under hover)
  const geo = await page.evaluate(() => {
    const [active, plain] = [
      document.querySelector('.page-tab--active')!,
      [...document.querySelectorAll('.page-tab')].find((el) => !el.classList.contains('page-tab--active'))!,
    ];
    return {
      activeRadius: getComputedStyle(active).borderRadius,
      plainRadius: getComputedStyle(plain).borderRadius,
    };
  });
  expect(geo.plainRadius).toBe(geo.activeRadius);
  const round = (b: NonNullable<Awaited<ReturnType<typeof files.boundingBox>>>) => ({
    x: Math.round(b.x),
    y: Math.round(b.y),
    width: Math.round(b.width),
    height: Math.round(b.height),
  });
  const restBox = round((await files.boundingBox())!);
  await files.hover();
  await page.waitForTimeout(250);
  expect(round((await files.boundingBox())!)).toEqual(restBox);
});

test('page-tab group rides the official hairline ring (r2 24b/24c probe)', async ({ page }) => {
  await page.goto(`${PROJ}?scenario=r2-24b`);
  const ring = await page.evaluate(() => {
    const group = document.querySelector('.page-tabs-group')!;
    const tab = document.querySelector('.page-tab')!;
    const cs = getComputedStyle(group);
    const g = group.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    return {
      border: cs.borderTopWidth,
      groupBg: cs.backgroundColor,
      groupH: Math.round(g.height),
      insetTop: Math.round(t.top - g.top),
      insetLeft: Math.round(t.left - g.left),
    };
  });
  expect(ring.border).toBe('1px');
  expect(ring.groupBg).toBe(GROUP_DARK);
  expect(ring.groupH).toBe(30); // 1 border + 2 pad + 24 chip + 2 pad + 1 border
  expect(ring.insetTop).toBe(3);
  expect(ring.insetLeft).toBe(3);
});

test('page-tab click swaps the active chip and the pane', async ({ page }) => {
  await page.goto(`${PROJ}?scenario=r2-24b`);
  const files = page.locator('.page-tab', { hasText: '文件' });

  await files.click();
  await expect(files).toHaveClass(/page-tab--active/);
  await expect(page.locator('.prj-files')).toBeVisible();

  await page.locator('.page-tab', { hasText: '任务' }).click();
  await expect(files).not.toHaveClass(/page-tab--active/);
  await expect(page.locator('.prj-files')).toBeHidden();
});

test('sched freq: dark active chip reads against the container, hover tints the rest', async ({
  page,
}) => {
  await page.goto('/app/schedules?scenario=r3-92');
  const group = page.locator('.sched-form-freq');
  const active = page.locator('.sched-form-freq-tab--active');
  const weekly = page.locator('.sched-form-freq-tab', { hasText: '每周' });

  expect(await bg(group)).toBe(GROUP_DARK);
  expect(await bg(active)).toBe(CHIP_DARK); // was container-identical = invisible

  await weekly.hover();
  await expect.poll(() => bg(weekly)).toBe(HOVER_DARK);

  await themed(page, 'light', '/app/schedules?scenario=r3-92');
  expect(await bg(page.locator('.sched-form-freq-tab--active'))).toBe(CHIP_LIGHT);
  const lightWeekly = page.locator('.sched-form-freq-tab', { hasText: '每周' });
  await lightWeekly.hover();
  await expect.poll(() => bg(lightWeekly)).toBe(HOVER_LIGHT);
});

test('files seg + tasks view toggle: hover tints the unselected (dark)', async ({ page }) => {
  await page.goto(`${PROJ}?scenario=r2-24`);
  const history = page.locator('.prj-files-seg-tab', { hasText: '历史' });
  await history.hover();
  await expect.poll(() => bg(history)).toBe(HOVER_DARK);

  await page.goto(`${PROJ}?scenario=prj-tasks`);
  const grid = page.locator('.prj-tasks-view-btn[aria-label="网格视图"]');
  await grid.hover();
  await expect.poll(() => bg(grid)).toBe(HOVER_DARK);
});

test('detail tabs: 68×28 ring + plate (r7 §3.3), hover layers the tint over the plate', async ({
  page,
}) => {
  await themed(page, 'light', `${TODO}?scenario=17b`);
  const ring = await page.evaluate(() => {
    const group = document.querySelector('.detail-tabs-group')!;
    const tab = document.querySelector('.detail-tab')!;
    const g = group.getBoundingClientRect();
    return {
      w: Math.round(g.width),
      h: Math.round(g.height),
      groupBg: getComputedStyle(group).backgroundColor,
      plateBg: getComputedStyle(tab).backgroundColor,
    };
  });
  expect(ring).toMatchObject({ w: 68, h: 28, groupBg: GROUP_LIGHT, plateBg: CHIP_LIGHT });

  const chat = page.locator('.detail-tab').nth(1);
  await chat.hover();
  await expect
    .poll(() => chat.evaluate((el) => getComputedStyle(el).backgroundImage))
    .toContain(`linear-gradient(${HOVER_LIGHT}`);

  await themed(page, 'dark', `${TODO}?scenario=27`);
  const darkChat = page.locator('.detail-tab').nth(1);
  expect(await bg(darkChat)).toBe(CHIP_DARK);
  await darkChat.hover();
  await expect
    .poll(() => darkChat.evaluate((el) => getComputedStyle(el).backgroundImage))
    .toContain(`linear-gradient(${HOVER_DARK}`);
});

test('detail tabs click swaps doc/chat panes', async ({ page }) => {
  await page.goto(`${TODO}?scenario=17b`);
  const chat = page.locator('.detail-tab').nth(1);
  await chat.click();
  await expect(chat).toHaveClass(/detail-tab--active/);
  await page.locator('.detail-tab').nth(0).click();
  await expect(chat).not.toHaveClass(/detail-tab--active/);
});

test('user-menu 外观 seg: hover tints, click switches the theme', async ({ page }) => {
  await themed(page, 'light', '/app?scenario=01');
  await page.click('.sidebar-user');
  const dark = page.locator('.user-menu-seg button').nth(1);

  await dark.hover();
  await expect.poll(() => bg(dark)).toBe(HOVER_LIGHT);

  await dark.click();
  await expect(dark).toHaveAttribute('data-active', 'true');
  // 深色 selected = the .light root class drops (dark is the :root default)
  await expect(page.locator('html')).not.toHaveClass(/light/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.user-menu-seg button').nth(0)).toHaveAttribute('data-active', 'false');
});

test('branch-dialog seg: hover tints Git, click swaps the tab body', async ({ page }) => {
  await page.goto(`${TODO}?scenario=31`);
  const git = page.locator('.dlg-seg-tab').nth(1);
  await git.hover();
  await expect.poll(() => bg(git)).toBe(HOVER_DARK);

  await git.click();
  await expect(git).toHaveAttribute('data-active', 'true');
  await expect(git).toHaveAttribute('aria-selected', 'true');
});

test('team layout toggle: official ring border + hover tint + chip token', async ({ page }) => {
  await themed(page, 'light', '/app/team?scenario=12');
  const ring = await page.evaluate(() => {
    const group = document.querySelector('.team-layout-tabs')!;
    return {
      border: getComputedStyle(group).borderTopWidth,
      groupBg: getComputedStyle(group).backgroundColor,
    };
  });
  expect(ring.border).toBe('1px');
  expect(ring.groupBg).toBe(GROUP_LIGHT);
  expect(await bg(page.locator('.team-layout-tab--active'))).toBe(CHIP_LIGHT);

  const chart = page.locator('.team-layout-tab').nth(1);
  await chart.hover();
  await expect.poll(() => bg(chart)).toBe(HOVER_LIGHT);
});

test('skills-import tabs + chief tabs: hover tints, click swaps the view', async ({ page }) => {
  await themed(page, 'light', '/app/resources/skills/import?scenario=79');
  const github = page.locator('.res-tab').nth(1);
  await github.hover();
  await expect.poll(() => bg(github)).toBe(HOVER_LIGHT);
  await github.click();
  await expect(github).toHaveClass(/res-tab--active/);

  await page.goto('/app?scenario=101');
  const charter = page.locator('.chief-tab', { hasText: '章程' });
  await charter.hover();
  await expect.poll(() => bg(charter)).toBe(HOVER_LIGHT);
  await charter.click();
  await expect(charter).toHaveClass(/is-active/);
});
