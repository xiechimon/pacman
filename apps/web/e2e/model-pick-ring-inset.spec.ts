import { expect, type Browser, type Locator, type Page, test } from '@playwright/test';
import { evidencePanelShot, evidenceShot } from './evidence';

// Issue #883（#872 收尾复核留在两个 chief 模型 picker 上的既有缺陷，判据在
// origin/main 同样成立）：
// 1. 行焦点环被裁：全局 :focus-visible 环配方（app.css #388，2px solid，
//    offset +2px）把环带画在行盒外 2~4px，而行盒左右缘 == listbox 裁剪盒
//    （.chief-model-pick-list 是滚动容器，行铺满其内容盒）——左右段连顶边
//    被裁，键盘 Tab 只剩行下一条横杠；单行清单（fixture 抽屉面）连底边也
//    被裁，环整个不可见。修法 = 基类 .model-pick-row 的 outline-offset: -2px，
//    环带收回行盒内侧（色彩/线宽仍归全局单源，不另起配方）。
// 2. 两面行内缩不统一：抽屉面字墨距面板内缘 20px（历史遗留的 8px 行内衬
//    --model-pick-ink），设置面 12px。修法 = 摘除面级覆盖，两面同归基类
//    12px——与同面板内搜索框的 12px 横缩（#872）同节奏。
//
// 钉住的失败方式（在 origin/main 上全部为红）：
// - 环带越出行盒（outline-offset + outline-width > 0）→ 左右段必被滚动容器裁掉；
// - 环配方被退化（outline-style 非 solid / 宽 0）——以删环的方式「修」裁切；
// - Tab 未落到行上（:focus-visible 不匹配）；
// - 抽屉面行内衬 ≠ 设置面（内缩不统一），或任一面 ≠ 12px；
// - 字墨/行尾勾距面板外缘两面不等（内缩统一的另一读数）。
//
// 证据帧（PACMAN_E2E_EVIDENCE 未设时零写入）：环证据用 deviceScaleFactor 2
// 的独立 context 紧裁行盒——1440px 整页图上 2px 的环不可辨，1:1 紧裁也只在
// 放大后清楚；面板证据用 evidencePanelShot 常规帧。证据写入在断言之前——
// before 跑（origin/main）本 spec 必红，帧照样落盘（#872 取证配方）。

const E2E_BASE = `http://127.0.0.1:${process.env.E2E_PORT ?? '8399'}`;
const EVIDENCE_ON = process.env.PACMAN_E2E_EVIDENCE != null;

// 证据帧与 #872 的 picker 帧同用亮面（用户报障面）；几何本身与主题无关。
const lightInit = () => localStorage.setItem('pacman-theme', 'light');

/** 进场动画（V2 scale-fade 100ms，#790 P3）未落定时 rect 不是静息几何。 */
async function settle(menu: Locator): Promise<void> {
  await menu.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined),
  );
}

/** 抽屉头主模型弹层（scenario 111，fixture 面 modelOptions 未录 = 默认单行）。 */
async function openDrawerFace(page: Page): Promise<Locator> {
  await page.goto('/app?scenario=111');
  await expect(page.locator('.chief-drawer')).toBeVisible();
  await page.locator('.chief-model button.chief-model-btn').click();
  const menu = page.locator('.chief-model-pop');
  await expect(menu).toBeVisible();
  await settle(menu);
  return menu;
}

/** 设置面压缩模型弹层（scenario 101，默认行 + canon 单行）。 */
async function openSettingsFace(page: Page): Promise<Locator> {
  await page.goto('/app?scenario=101');
  const select = page.locator('button.chief-select');
  await expect(select).toBeVisible();
  await select.click();
  const menu = page.locator('.chief-model-menu');
  await expect(menu).toBeVisible();
  await settle(menu);
  return menu;
}

/** 开面后焦点在清单容器（ModelPickList 挂载即同步 focus；Base UI initialFocus
 *  是异步移入，等落定再走键盘——#756 同律）；Tab 一次 = 首行钮。 */
async function tabToFirstRow(page: Page, menu: Locator, rowSel: string): Promise<Locator> {
  const menuSel = await menu.evaluate((el) => {
    // 面壳类名进 waitForFunction（容器/行都是它的后代，焦点必先在面内）
    return el.classList.contains('chief-model-pop') ? '.chief-model-pop' : '.chief-model-menu';
  });
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return el != null && el.contains(document.activeElement);
    },
    menuSel,
  );
  await page.keyboard.press('Tab');
  const row = menu.locator(rowSel).first();
  await expect(row).toBeFocused();
  return row;
}

/** 环 × 裁剪盒几何（环带完全可见的判据 = offset + width 的外沿不越出行盒；
 *  行盒左右缘 == listbox 裁剪盒是「越界即被裁」的前提，一并钉住）。 */
function ringGeo(el: Element) {
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const list = el.closest('.chief-model-pick-list') as HTMLElement;
  const lr = list.getBoundingClientRect();
  return {
    focusVisible: el.matches(':focus-visible'),
    outlineStyle: cs.outlineStyle,
    outlineWidth: Number.parseFloat(cs.outlineWidth),
    outlineOffset: Number.parseFloat(cs.outlineOffset),
    clipLeftGap: r.left - lr.left,
    clipRightGap: lr.right - r.right,
  };
}

/** 内缩几何：行内衬 + 字墨/行尾勾距面板外缘（含 1px 面板边框）。 */
function inkGeo(el: Element) {
  const cs = getComputedStyle(el);
  const panel = el.closest('.chief-model-pop, .chief-model-menu') as HTMLElement;
  const p = panel.getBoundingClientRect();
  const name = el.querySelector('.model-pick-name') as HTMLElement;
  const check = el.querySelector('.model-pick-check') as HTMLElement;
  return {
    padLeft: Number.parseFloat(cs.paddingLeft),
    padRight: Number.parseFloat(cs.paddingRight),
    nameFromPanel: name.getBoundingClientRect().left - p.left,
    checkFromPanel: check == null ? null : p.right - check.getBoundingClientRect().right,
  };
}

/** 放大证据帧：dsf 2 的独立 context 重开同一面、Tab 到首行、紧裁行盒。
 *  pad 8px 容纳 before 态外扩的环带（offset +2 + width 2 = 行盒外 4px）。 */
async function focusRingShot(
  browser: Browser,
  name: string,
  openFace: (page: Page) => Promise<Locator>,
  rowSel: string,
): Promise<void> {
  if (!EVIDENCE_ON) return;
  const context = await browser.newContext({
    baseURL: E2E_BASE,
    viewport: { width: 1440, height: 732 },
    colorScheme: 'dark',
    deviceScaleFactor: 2,
  });
  await context.addInitScript(lightInit);
  const page = await context.newPage();
  try {
    const menu = await openFace(page);
    await tabToFirstRow(page, menu, rowSel);
    const box = await menu.locator(rowSel).first().boundingBox();
    const viewport = page.viewportSize();
    if (box != null && viewport != null) {
      const pad = 8;
      const x = Math.max(0, box.x - pad);
      const y = Math.max(0, box.y - pad);
      const right = Math.min(viewport.width, box.x + box.width + pad);
      const bottom = Math.min(viewport.height, box.y + box.height + pad);
      await evidenceShot(page, name, { x, y, width: right - x, height: bottom - y });
    }
  } finally {
    await context.close();
  }
}

test('the drawer-face row focus ring stays inside the clip box (#883)', async ({
  page,
  browser,
}) => {
  await page.addInitScript(lightInit);
  const menu = await openDrawerFace(page);
  await tabToFirstRow(page, menu, '.chief-model-pick-row');
  await focusRingShot(browser, '883-drawer-focus.png', openDrawerFace, '.chief-model-pick-row');

  const geo = await menu.locator('.chief-model-pick-row').first().evaluate(ringGeo);
  expect(geo.focusVisible).toBe(true);
  expect(geo.outlineStyle).toBe('solid');
  expect(geo.outlineWidth).toBe(2);
  // 环带外沿不越出行盒——越界即被滚动容器裁（#883 缺陷本身：main 上 2+2=4）
  expect(geo.outlineOffset + geo.outlineWidth).toBeLessThanOrEqual(0);
  expect(geo.outlineOffset).toBe(-2);
  // 裁切前提：行盒左右缘 == listbox 裁剪盒（#872 整行铺满的既有几何）
  expect(geo.clipLeftGap).toBeCloseTo(0, 1);
  expect(geo.clipRightGap).toBeCloseTo(0, 1);
});

test('the settings-face row focus ring stays inside the clip box (#883)', async ({
  page,
  browser,
}) => {
  await page.addInitScript(lightInit);
  const menu = await openSettingsFace(page);
  await tabToFirstRow(page, menu, '.chief-model-row');
  await focusRingShot(browser, '883-settings-focus.png', openSettingsFace, '.chief-model-row');

  const geo = await menu.locator('.chief-model-row').first().evaluate(ringGeo);
  expect(geo.focusVisible).toBe(true);
  expect(geo.outlineStyle).toBe('solid');
  expect(geo.outlineWidth).toBe(2);
  expect(geo.outlineOffset + geo.outlineWidth).toBeLessThanOrEqual(0);
  expect(geo.outlineOffset).toBe(-2);
  expect(geo.clipLeftGap).toBeCloseTo(0, 1);
  expect(geo.clipRightGap).toBeCloseTo(0, 1);
});

test('both faces inset the row ink by the same 12px (#883)', async ({ page }) => {
  await page.addInitScript(lightInit);

  // 抽屉面：Tab 到行后再拍面板帧——环与内缩同帧可辨
  const pop = await openDrawerFace(page);
  await tabToFirstRow(page, pop, '.chief-model-pick-row');
  await evidencePanelShot(page, '883-drawer-panel.png', pop);
  const drawer = await pop.locator('.chief-model-pick-row').first().evaluate(inkGeo);

  // 设置面
  const menu = await openSettingsFace(page);
  await tabToFirstRow(page, menu, '.chief-model-row');
  await evidencePanelShot(page, '883-settings-panel.png', menu);
  const settings = await menu.locator('.chief-model-row').first().evaluate(inkGeo);

  // 内缩统一：两面行内衬同为基类 12px（main 上抽屉面 20 ≠ 设置面 12）
  expect(drawer.padLeft).toBe(12);
  expect(settings.padLeft).toBe(12);
  // 字墨位从面板外缘量（1px 边框 + 12px 行内衬）两面一致
  expect(drawer.nameFromPanel).toBeCloseTo(settings.nameFromPanel, 1);
  expect(drawer.nameFromPanel).toBeCloseTo(13, 1);
  // 行尾勾对称（首行 = 选中默认行，两面都有勾）
  expect(drawer.checkFromPanel).not.toBeNull();
  expect(drawer.checkFromPanel).toBeCloseTo(settings.checkFromPanel ?? Number.NaN, 1);
  expect(drawer.checkFromPanel).toBeCloseTo(13, 1);
});
