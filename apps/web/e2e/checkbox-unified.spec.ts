import { expect, type Page, test } from '@playwright/test';
import { evidenceShot } from './evidence';

// 复选框样式统一（XMON-72）：仓内复选正典 = components/ui/checkbox.tsx
// （XMON-75 原语：18px 方角 tile / 4px 圆角 / --card-button 实底 + 白勾，关态
// 透明底 + 1px --border-strong 内描边；真 input opacity-0 垫在 tile 下，键盘 /
// 表单语义 / 屏幕阅读器走原生）。三处老手搓各写各的 CSS，其中两处带真 bug：
//   1. accept / stop-confirm 的 .dlg-accept-check 从无隐藏 input 的规则——
//      18px tile 里骑着一个 13px 的 Mac 原生复选框，白勾 svg 被挤成 0 宽甩在
//      旁边（票面截图的主症状）；
//   2. provider 的 .dlg-provider-check 藏了 input 但白勾无条件渲染——未选中
//      态在透明 tile 上露一个白勾。
// 本 spec 钉住的失败方式（逐条对应一个测试）：
//   1. accept：原生 input 可见（opacity ≠ 0）——票面主症状；
//   2. accept：未选中态露勾（svg 不随 checked 走）；
//   3. accept：整行点击不切换（文字在 label 外；原语 children 契约 = 整行
//      可点，与 api-key 弹窗先例同）；
//   4. accept：tile 几何漂移（18×18 / 4px 圆角 / 与文字 gap 8 / 文字 13px）
//      ——像素纪律：对齐既有自制档数值，不新造；
//   5. provider：未选中态露白勾（与 2 同族）；
//   6. accept：键盘 Space 不切换（原语保真 input 的键盘契约）。
// stop-confirm dialog 与 accept 同形（同类同 JSX），但 fixture 面没有
// running 态可开它（OverlayKind 无 stop、fixtures 无 activeRun）：由 live 面
// verify-pacman 的 drive-stop 探针 + 截图证据覆盖，见 docs/verify/XMON-72/。
//
// 证据截图走 evidenceShot（默认不落盘；要为本票 PR 再生证据时设
// PACMAN_E2E_EVIDENCE=docs/verify/<ticket> 再跑，见 e2e/evidence.ts）。
// 历史证据 = 已提交的 docs/verify/XMON-72/，回归跑不许再重写它。

/** r7 34：accept 弹层冻开在看板面上，merge 默认勾选。 */
async function openAccept(page: Page) {
  await page.goto('/app?scenario=34');
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  // #656: the .dlg enter animation (tw-animate-css zoom-in-95) scales the panel
  // from 0.95 — settle it so interior-geometry measures ride the laid-out box
  // (the same getAnimations().finished wait the drawer specs use).
  await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  return dialog;
}

/** spec 11 §A6：picker 面进自定义端点表单，Bearer 复选默认 on（r3 §2）。 */
async function openProviderForm(page: Page) {
  await page.goto('/app/resources/providers?scenario=01');
  await page.locator('.res-new').click();
  const dialog = page.locator('.dlg');
  await expect(dialog).toBeVisible();
  await dialog.locator('.dlg-provider-custom').click();
  await expect(dialog.locator('#dlg-provider-id')).toBeVisible();
  return dialog;
}

test('accept: 原生 input 藏在 tile 下（不画 Mac 复选框）', async ({ page }) => {
  const dialog = await openAccept(page);
  const input = dialog.locator('.dlg-accept input[type="checkbox"]');
  await expect(input).toBeChecked();
  await expect(input).toHaveCSS('opacity', '0');
  await evidenceShot(page, 'accept-checked.png');
});

test('accept: 未选中态不露勾', async ({ page }) => {
  const dialog = await openAccept(page);
  const input = dialog.locator('.dlg-accept input[type="checkbox"]');
  await input.click();
  await expect(input).not.toBeChecked();
  await expect(dialog.locator('.dlg-accept label svg')).toHaveCount(0);
  await evidenceShot(page, 'accept-unchecked.png');
});

test('accept: 整行可点（文字也是点击目标）', async ({ page }) => {
  const dialog = await openAccept(page);
  const input = dialog.locator('.dlg-accept input[type="checkbox"]');
  await dialog.locator('.dlg-accept-label').click();
  await expect(input).not.toBeChecked();
  await dialog.locator('.dlg-accept-label').click();
  await expect(input).toBeChecked();
});

test('accept: tile 几何 = 18×18 / 4px 圆角 / 与文字 gap 8 / 文字 13px', async ({
  page,
}) => {
  const dialog = await openAccept(page);
  const tile = dialog.locator('.ui-checkbox-tile');
  const box = await tile.boundingBox();
  expect(box).not.toBeNull();
  if (box == null) return;
  expect(box.width).toBeGreaterThan(17.5);
  expect(box.width).toBeLessThan(18.5);
  expect(box.height).toBeGreaterThan(17.5);
  expect(box.height).toBeLessThan(18.5);
  await expect(tile).toHaveCSS('border-radius', '4px');
  const label = dialog.locator('.dlg-accept-label');
  await expect(label).toHaveCSS('font-size', '13px');
  const lb = await label.boundingBox();
  expect(lb).not.toBeNull();
  if (lb == null) return;
  const gap = lb.x - (box.x + box.width);
  expect(gap).toBeGreaterThan(7.5);
  expect(gap).toBeLessThan(8.5);
});

test('provider: 未选中态不露白勾（#dlg-provider-authheader id 存活）', async ({
  page,
}) => {
  const dialog = await openProviderForm(page);
  const input = dialog.locator('#dlg-provider-authheader');
  await expect(input).toBeChecked();
  await evidenceShot(page, 'provider-checked.png');
  await input.click();
  await expect(input).not.toBeChecked();
  await expect(dialog.locator('.dlg-provider-authrow label svg')).toHaveCount(0);
  await evidenceShot(page, 'provider-unchecked.png');
});

test('accept: 键盘 Space 切换真 input', async ({ page }) => {
  const dialog = await openAccept(page);
  const input = dialog.locator('.dlg-accept input[type="checkbox"]');
  await input.focus();
  await page.keyboard.press('Space');
  await expect(input).not.toBeChecked();
  await page.keyboard.press('Space');
  await expect(input).toBeChecked();
});
