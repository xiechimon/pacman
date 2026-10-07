import { expect, type Page, test } from '@playwright/test';

// Issue #388 acceptance (弹层与 focus 视觉缺陷组):
//   #15 — 点击 topbar 钮 / 新建任务钮后键盘交互（Esc/Tab）不再出现 UA 蓝框
//         (outline auto rgb(0,95,204))；:focus-visible 统一收编为品牌环
//         （配方沿 .rerun-switch:focus-visible 先例：2px --focus-ring, offset 2）。
//   #10 — /app/schedules 新建定时弹层升级全屏族（#656 起壳 = FloatingShell，
//         入场 = tw-animate-css fade）：scrim 盖全视口（含 sidebar——旧 z auto
//         被 sidebar z1 压过，阴影只盖右 pane）、Esc 关、背板点击关。
// Fixture 面（r3-92 冻结开屏）承载弹层断言：关闭 = 局部 UI 态，重载还原。

const BOARD = '/app?scenario=01';
const SCHED = '/app/schedules?scenario=r3-92';
/** UA (Chromium) default focus ring: outline auto + this blue. */
const UA_BLUE = 'rgb(0, 95, 204)';
/** --focus-ring (shadcn.css 值正本) — the family :focus-visible ring color. */
const RING = 'rgb(242, 148, 216)';

async function focusedOutline(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (el == null || el === document.body) return null;
    const cs = getComputedStyle(el);
    return {
      cls: typeof el.className === 'string' && el.className !== '' ? el.className : el.tagName,
      style: cs.outlineStyle,
      width: cs.outlineWidth,
      color: cs.outlineColor,
      focusVisible: el.matches(':focus-visible'),
    };
  });
}

test.describe('#15 focus ring收编', () => {
  test('click + key on 新建任务/topbar buttons: never the UA blue box', async ({ page }) => {
    await page.goto(BOARD);
    // #445：顶栏「+ 任务」撤除——新建触发位 = 侧栏「新任务」行
    const newTask = page.locator('.sidebar-new-task');
    await newTask.click();
    // keyboard interaction after a click flips the focused button into
    // :focus-visible (Chromium heuristic) — the exact dogfood symptom path
    // #389: 家族律 = 开时焦点入层、关时回还触发位——Esc 现在的职责是关
    // dialog（焦点回还按钮），读环前必须等关闭落定；重发律同 search-focus
    // （负载下渲染端输入处理可滞后于断言读，关层监听挂被动 effect）。
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await page.keyboard.press('Escape');
      // #948 载体重钉（#910 裁定 1）：dialog 类名锚换 role+name 一级载体。
      const closed = await page
        .getByRole('dialog', { name: '新建任务' })
        .waitFor({ state: 'hidden', timeout: 1000 })
        .then(() => true)
        .catch(() => false);
      if (closed) break;
    }
    const info = await focusedOutline(page);
    expect(info).not.toBeNull();
    expect(info!.style).not.toBe('auto');
    expect(info!.color).not.toBe(UA_BLUE);
    // 正向堵洞：键盘交互后 Chromium 必命中 :focus-visible——命中即环必须在
    // （防「整环删干净」的回归从负向断言溜过去；换皮，不是删皮）
    if (info!.focusVisible) {
      expect(info!.style).toBe('solid');
      expect(info!.color).toBe(RING);
    }

    // schedules topbar + 新建 (fixture face: the click is inert, the button
    // keeps focus — the key press must not surface the UA ring either)
    await page.goto('/app/schedules?scenario=11');
    const pageNew = page.locator('.page-new-action');
    await pageNew.click();
    await page.keyboard.press('Escape');
    const info2 = await focusedOutline(page);
    expect(info2).not.toBeNull();
    expect(info2!.style).not.toBe('auto');
    expect(info2!.color).not.toBe(UA_BLUE);
    if (info2!.focusVisible) {
      expect(info2!.style).toBe('solid');
      expect(info2!.color).toBe(RING);
    }
  });

  test('Tab focus keeps the brand ring (keyboard reachability preserved)', async ({ page }) => {
    await page.goto(BOARD);
    // tab through the chrome until the 新建任务 button owns focus
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      await page.keyboard.press('Tab');
      found = await page.evaluate(
        () => document.activeElement?.classList.contains('sidebar-new-task') ?? false,
      );
    }
    expect(found).toBe(true);
    const info = await focusedOutline(page);
    expect(info).not.toBeNull();
    expect(info!.focusVisible).toBe(true);
    expect(info!.style).toBe('solid');
    expect(info!.color).toBe(RING);
  });
});

test.describe('#10 schedules 新建定时弹层 = FloatingShell 全屏族（tw fade）', () => {
  test('scrim covers the full viewport — sidebar included', async ({ page }) => {
    await page.goto(SCHED);
    await expect(page.locator('.sched-form-overlay')).toBeVisible();
    const covers = await page.evaluate(() => {
      // a point deep inside the sidebar, far from the centered panel
      const el = document.elementFromPoint(100, 400);
      return el?.closest('.sched-form-overlay') != null;
    });
    expect(covers).toBe(true);
  });

  test('Esc closes the overlay', async ({ page }) => {
    await page.goto(SCHED);
    await expect(page.locator('.sched-form-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.sched-form-overlay')).toBeHidden();
  });

  test('backdrop click closes; entry rides the tw-animate-css fade', async ({ page }) => {
    await page.goto(SCHED);
    const overlay = page.locator('.sched-form-overlay');
    await expect(overlay).toBeVisible();
    // #656: the scrim's enter is the tw-animate-css enter keyframe gated on the
    // FloatingShell group (replaces the retired .anim-fade + .overlay-mount pair).
    await expect(overlay).toHaveCSS('animation-name', 'enter');
    await expect(page.locator('.overlay-mount')).toHaveCount(0);
    // scrim far from the 488-wide centered panel
    await page.mouse.click(80, 80);
    await expect(overlay).toBeHidden();
  });

  test('X and 取消 close the fixture face too (no dead buttons)', async ({ page }) => {
    await page.goto(SCHED);
    await page.locator('.sched-form-cancel').click();
    await expect(page.locator('.sched-form-overlay')).toBeHidden();

    await page.goto(SCHED);
    await page.locator('.sched-form-close').click();
    await expect(page.locator('.sched-form-overlay')).toBeHidden();
  });
});
