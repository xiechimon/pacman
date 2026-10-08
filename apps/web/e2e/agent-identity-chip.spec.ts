import { expect, type Page, test } from '@playwright/test';

// #741 agent 身份可点进设置（交互面 e2e；渲染缝单测在 test/segments-mention-nav.test.ts
// 与 test/chief-identity.test.ts，live mock 面的钉在 chief-stream-markdown.spec F-R15）。
// 参考站正典（todos.dev，2026-10-03 实拍 + 本票 DOM 实测）：身份 chip =
// 头像+名字并排、整块 cursor:pointer、hover 无背景变化（仅指针）、点击 =
// 同 tab 整页路由 /app/resources/agents/<id>（不是抽屉、不是新 tab）。
// 失败方式先行枚举：
//  F-E1 绑定 robot 行身份 chip 不渲染（头像+名字并排形态缺失）
//  F-E2 身份 chip 不成链 / href 不指 /app/resources/agents/<id>（缺口 1 本体）
//  F-E3 身份 chip 点击不 SPA 导航；scenario 不随行（#121）致详情页解析不出记录
//  F-E4 身份 chip 键盘不可达 / Enter 不能激活（真 anchor a11y 律）
//  F-E5 agent 提及 chip 仍是死 span / href 错（缺口 2 本体——抽屉面）
//  F-E6 详情页 transcript 面的 agent 提及 chip 不同律（segments 单源两消费面）
//  F-E7 skill/project/machine 提及越权成链（票面字面负例——落点未取证不入本票）
//  F-E8 无 agent 投影的 robot 行被波及（dashed 字形零变化、零 anchor）
//  F-E9 hover 发明参考站没有的背景态（正典：hover 仅 cursor 变化）
//  F-E10 几何收编漂移：头像槽 24px（XMON-105 canon）/ 名字 12px（参考实测）

const SCENARIO = '/app?scenario=chief-agent-chip';
const AGENT_HREF = '/app/resources/agents/r3-builder';

/** dicebear 桩：头像走名字种子（avatarUrl null），mock 掉外网防 8s 悬置
 *  （chief-stream-markdown.spec 同配方）。 */
function stubDicebear(page: Page) {
  return page.route('**/api.dicebear.com/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#888"/></svg>',
    }),
  );
}

test.describe('抽屉 robot 行身份 chip（fixture，#741 缺口 1）', () => {
  test.beforeEach(async ({ page }) => {
    await stubDicebear(page);
    await page.goto(SCENARIO);
    const drawer = page.locator('.chief-drawer');
    await expect(drawer).toBeVisible();
    // #1009 A0（ADR 0013 D7）：悬浮窗进场 fade+scale(0.95→1)——动画未落定时
    // boundingBox 读的是缩放值（F-E10 的 24px 几何 canon 会漂成 ~23.6），
    // settle 谓词同 chief-stream-markdown。
    await drawer.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  });

  test('F-E1/E2/E10: 头像+名字并排成链，href 指 Agent 设置页，几何 canon 不漂移', async ({
    page,
  }) => {
    // #950 载体：身份 chip = 名字可及名 link（.chief-identity 类退役；
    // markdown 面的 mention chip 也是 link，按 name 区分）。
    const chip = page.getByTestId('chief-stream').getByRole('link', { name: 'r3-builder' });
    await expect(chip).toHaveCount(1);
    // 参考站 chip 形态：头像 + 名字并排，名字 = 绑定 agent 的 displayName。
    const img = chip.locator('img');
    await expect(img).toBeVisible();
    await expect(chip.getByText('r3-builder')).toHaveText('r3-builder');
    // 整块 = router Link，href 携 scenario（#121 Link 律，详情页解析真记录）。
    await expect(chip).toHaveAttribute('href', `${AGENT_HREF}?scenario=chief-agent-chip`);
    // 几何 canon：头像槽 24px（XMON-105），名字 12px（参考站实测值）。
    const box = await img.boundingBox();
    expect(box?.width).toBe(24);
    expect(box?.height).toBe(24);
    const fontSize = await chip
      .getByText('r3-builder')
      .evaluate((el) => getComputedStyle(el).fontSize);
    expect(fontSize).toBe('12px');
  });

  test('F-E9: hover 只变 cursor，不发明背景态（参考站正典）', async ({ page }) => {
    const chip = page.getByTestId('chief-stream').getByRole('link', { name: 'r3-builder' });
    const bgBefore = await chip.evaluate((el) => getComputedStyle(el).backgroundColor);
    await chip.hover();
    const bgAfter = await chip.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bgAfter).toBe(bgBefore);
    expect(await chip.evaluate((el) => getComputedStyle(el).cursor)).toBe('pointer');
  });

  test('F-E3: 点击 → SPA 导航进 Agent 设置页，详情页解析出真记录', async ({ page }) => {
    await page.getByTestId('chief-stream').getByRole('link', { name: 'r3-builder' }).click();
    await page.waitForURL((u) => u.pathname === AGENT_HREF);
    // scenario 随行 → 详情页解析 AGENT_R3_BUILDER（不是「找不到该 Agent」回退）。
    await expect(page.locator('.agent-detail')).toBeVisible();
    await expect(page.locator('.agent-missing')).toHaveCount(0);
    await expect(page.locator('.agent-detail')).toContainText('r3-builder');
    // 落点 = 概览/记忆/权限三 tab 的设置页（参考站同款落点）。
    await expect(page.locator('.agent-tabs')).toBeVisible();
  });

  test('F-E4: 键盘可达——focus 落在 chip 上，Enter 激活导航', async ({ page }) => {
    const chip = page.getByTestId('chief-stream').getByRole('link', { name: 'r3-builder' });
    await chip.focus();
    const focused = await chip.evaluate((el) => el === document.activeElement);
    expect(focused).toBe(true);
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.pathname === AGENT_HREF);
  });
});

test.describe('agent 提及 chip（fixture，#741 缺口 2）', () => {
  test.beforeEach(async ({ page }) => {
    await stubDicebear(page);
  });

  test('F-E5: 抽屉面 agent 提及 chip 成链并可点击导航（F-R13 同款配方）', async ({ page }) => {
    await page.goto(SCENARIO);
    await expect(page.locator('.chief-drawer')).toBeVisible();
    const chip = page.getByTestId('chief-stream').locator('.mention-chip--agent');
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveText('r5-scribe');
    // #675 todo chip 同款配方：裸 href（不带 scenario），SPA pushState 只钉 pathname。
    await expect(chip).toHaveAttribute('href', '/app/resources/agents/a1');
    await chip.click();
    await page.waitForURL((u) => u.pathname === '/app/resources/agents/a1');
  });

  test('F-E6: 详情页 transcript 面同律（segments 单源的第二消费面）', async ({ page }) => {
    await page.goto('/app/todo/r3-legacy-1?scenario=chief-agent-chip');
    // 场景同时播着总管抽屉（wake 面结构恒在）——钉 transcript 面要限定中栏，
    // 否则同文 chip 双面各一。
    const chip = page.locator('.detail-center .mention-chip--agent');
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveAttribute('href', '/app/resources/agents/a1');
    await chip.click();
    await page.waitForURL((u) => u.pathname === '/app/resources/agents/a1');
  });

  test('F-E7: skill/project/machine 提及仍是惰性 span（字面负例）', async ({ page }) => {
    await page.goto(SCENARIO);
    await expect(page.locator('.chief-drawer')).toBeVisible();
    const stream = page.getByTestId('chief-stream');
    for (const kind of ['skill', 'project', 'machine'] as const) {
      const chip = stream.locator(`.mention-chip--${kind}`);
      await expect(chip, kind).toHaveCount(1);
      expect(await chip.evaluate((el) => el.tagName), kind).toBe('SPAN');
      await expect(chip, kind).not.toHaveAttribute('href', /.*/);
    }
    // todo 提及照旧成链（#675 回归护栏）。
    await expect(stream.locator('.mention-chip--todo')).toHaveAttribute(
      'href',
      '/app/todo/r3-legacy-1',
    );
  });
});

test.describe('惰性面零变化（#741 负例）', () => {
  test('F-E8: 无 agent 投影的 robot 行保 dashed 字形，零 anchor（r5 114 冻结捕获面）', async ({
    page,
  }) => {
    await stubDicebear(page);
    await page.goto('/app?scenario=114');
    await expect(page.locator('.chief-drawer')).toBeVisible();
    const stream = page.getByTestId('chief-stream');
    // dashed 字形照旧（绑定但无 agent 投影 → ChiefFaceDashed，XMON-105 律；
    // 114 语料只有一条 robot 行）。#950 载体：行直接子级 svg = 头像槽字形
    // （identity 形头像在 link 内，字面路径 chip svg 更深，皆不匹配）。
    await expect(stream.getByTestId('chief-msg').locator('> svg')).toHaveCount(1);
    // 身份 chip 零出现：既不成链也不渲染名字（无 link、无翻列行）。
    await expect(stream.getByRole('link')).toHaveCount(0);
    await expect(
      stream.getByTestId('chief-msg').filter({ has: page.getByRole('link') }),
    ).toHaveCount(0);
  });
});
