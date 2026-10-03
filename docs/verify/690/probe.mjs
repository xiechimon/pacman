// Base UI checkbox pilot (#690) — zero-pixel probe.
// Usage: node /tmp/t0065-probe.mjs <baseUrl> <outDir> <before|after>
// Opens the two fixture-reachable checkbox faces (accept dialog, provider
// custom-endpoint form) in both states plus keyboard-focus state, records
// computed styles + bounding boxes of every visible part, screenshots the
// dialog clip and the full page, and writes geometry.json for diffing.
// The hidden/real <input> box is recorded but tagged mechanism (not compared):
// before = opacity-0 overlay over the tile, after = official visually-hidden
// 1px fixed input. Everything tagged visible must match byte-for-byte.

import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [, , baseUrl, outDir, world] = process.argv;
if (!baseUrl || !outDir || !world) {
  console.error('usage: node t0065-probe.mjs <baseUrl> <outDir> <before|after>');
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const { chromium } = await import(
  '/Users/xmon/.herdr/worktrees/pacman/hp-pacman-t-0065-base-ui/apps/web/node_modules/@playwright/test/index.mjs'
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const record = { world, baseUrl, faces: {} };

async function settle(doc = page) {
  await doc.evaluate(async () => {
    await document.fonts.ready;
    const anims = document
      .getAnimations()
      .filter((a) => {
        const t = a.effect?.getTiming?.();
        return t == null || t.iterations !== Infinity;
      })
      .map((a) => a.finished.catch(() => {}));
    await Promise.all(anims);
  });
}

const VISIBLE_PROPS = [
  'display',
  'position',
  'width',
  'height',
  'border-radius',
  'background-color',
  'box-shadow',
  'color',
  'font-size',
  'font-family',
  'font-weight',
  'line-height',
  'gap',
  'align-items',
  'justify-content',
  'flex',
  'cursor',
  'outline',
  'outline-offset',
  'opacity',
  'border',
  'padding',
  'margin',
];

async function partSnapshot(face, name, locator, tag) {
  const count = await locator.count();
  if (count === 0) {
    face[name] = { present: false };
    return;
  }
  const el = locator.first();
  const box = await el.boundingBox();
  const styles = await el.evaluate((node, props) => {
    const cs = getComputedStyle(node);
    const out = {};
    for (const p of props) out[p] = cs.getPropertyValue(p);
    out.tagName = node.tagName.toLowerCase();
    out.type = node.getAttribute('type');
    out.role = node.getAttribute('role');
    return out;
  }, VISIBLE_PROPS);
  face[name] = { present: true, tag: tag ?? 'visible', box, styles };
}

async function dialogClipMd5(face, dialogLoc, shotName) {
  const clipPath = outDir + '/' + shotName;
  const buf = await dialogLoc.screenshot();
  writeFileSync(clipPath, buf);
  face[shotName] = { md5: createHash('md5').update(buf).digest('hex') };
  const fullBuf = await page.screenshot();
  writeFileSync(clipPath.replace(/\.png$/, '-full.png'), fullBuf);
  face[shotName.replace(/\.png$/, '-full-md5')] = createHash('md5')
    .update(fullBuf)
    .digest('hex');
  return clipPath;
}

// ---- face 1: accept dialog (scenario 34, opens frozen, merge checked) ----
{
  const face = (record.faces.accept = {});
  face.checked = {}; face.unchecked = {}; face.focus = {};
  await page.goto(baseUrl + '/app?scenario=34');
  const dialog = page.locator('.dlg');
  await dialog.waitFor({ state: 'visible' });
  await settle();

  const label = dialog.locator('.dlg-accept .ui-checkbox');
  const tile = dialog.locator('.dlg-accept .ui-checkbox-tile');
  const input = dialog.locator('.dlg-accept input[type="checkbox"]');
  const text = dialog.locator('.dlg-accept-label');

  await partSnapshot(face, 'checked.label', label);
  await partSnapshot(face, 'checked.tile', tile);
  await partSnapshot(face, 'checked.svg', tile.locator('svg'));
  await partSnapshot(face, 'checked.text', text);
  await partSnapshot(face, 'checked.input', input, 'mechanism');
  face.checked.inputChecked = await input.isChecked();
  await dialogClipMd5(face, dialog, 'accept-checked.png');

  // toggle off via the row text (label activation in both worlds)
  await text.click();
  await settle();
  await partSnapshot(face, 'unchecked.label', label);
  await partSnapshot(face, 'unchecked.tile', tile);
  face.uncheckedSvgCount = await tile.locator('svg').count();
  await partSnapshot(face, 'unchecked.text', text);
  face.unchecked.inputChecked = await input.isChecked();
  await dialogClipMd5(face, dialog, 'accept-unchecked.png');

  // keyboard focus ring: Tab until the checkbox holds focus
  await text.click(); // back to checked for a stable focus shot
  await settle();
  let focused = false;
  for (let i = 0; i < 15; i += 1) {
    await page.keyboard.press('Tab');
    focused = await page.evaluate(() => {
      const a = document.activeElement;
      return (
        a != null &&
        (a.matches('input[type="checkbox"]') ||
          (a.getAttribute('role') === 'checkbox' &&
            a.closest('.dlg-accept') != null))
      );
    });
    if (focused) break;
  }
  face.focus.found = focused;
  if (focused) {
    await page.waitForTimeout(50); // focus-visible style application
    await partSnapshot(face, 'focus.tile', tile);
    await dialogClipMd5(face, dialog, 'accept-focus.png');
  }
}

// ---- face 2: provider custom-endpoint form (scenario 01) ----
{
  const face = (record.faces.provider = {});
  face.checked = {}; face.unchecked = {};
  await page.goto(baseUrl + '/app/resources/providers?scenario=01');
  await page.locator('.res-new').click();
  const dialog = page.locator('.dlg');
  await dialog.waitFor({ state: 'visible' });
  await dialog.locator('.dlg-provider-custom').click();
  await dialog.locator('#dlg-provider-id').waitFor({ state: 'visible' });
  await settle();

  const authInput = dialog.locator('#dlg-provider-authheader');
  const row = dialog.locator('.dlg-provider-authrow');
  const label = row.locator('.ui-checkbox');
  const tile = row.locator('.ui-checkbox-tile');
  const text = row.locator('.dlg-provider-authlabel');

  face.authInputPresent = (await authInput.count()) === 1;
  face.authInputChecked = await authInput.isChecked();
  await partSnapshot(face, 'checked.label', label);
  await partSnapshot(face, 'checked.tile', tile);
  await partSnapshot(face, 'checked.svg', tile.locator('svg'));
  await partSnapshot(face, 'checked.text', text);
  await partSnapshot(face, 'checked.input', authInput, 'mechanism');
  await dialogClipMd5(face, dialog, 'provider-checked.png');

  await text.click();
  await settle();
  await partSnapshot(face, 'unchecked.label', label);
  await partSnapshot(face, 'unchecked.tile', tile);
  face.uncheckedSvgCount = await tile.locator('svg').count();
  face.unchecked.inputChecked = await authInput.isChecked();
  await dialogClipMd5(face, dialog, 'provider-unchecked.png');
}

await browser.close();
writeFileSync(outDir + '/geometry.json', JSON.stringify(record, null, 2));
console.log('probe done:', world, '->', outDir + '/geometry.json');
