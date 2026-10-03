// t-0070 evidence probe: resting geometry + keyboard semantics for the four
// pages-domain menu faces. Runs against a fixture-mode vite preview stack.
// usage: node /tmp/t0070-probe.mjs <baseURL> <outDir> <label>
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const [base, outDir, label] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const NEW = '/app/project/new?scenario=01';
const TASKS = '/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=prj-tasks';
const SCHED = '/app/schedules?scenario=r3-93';

async function settleAnims(page) {
  await page.evaluate(async () => {
    await Promise.allSettled(
      document.getAnimations().flatMap((a) => {
        try {
          a.finish();
          return [a.finished];
        } catch {
          return [];
        }
      }),
    );
  });
}

const FACES = [
  {
    id: 'repo-menu-none',
    url: NEW,
    plate: '.prj-new-repo-menu',
    rows: '.prj-new-repo-menu-row',
    trigger: '#prj-new-repo',
    openSel: '#prj-new-repo',
  },
  {
    id: 'repo-menu-swap',
    url: NEW,
    plate: '.prj-new-repo-menu',
    rows: '.prj-new-repo-menu-row',
    trigger: '.prj-new-repo-swap',
    openSel: '.prj-new-repo-swap',
    extra: { field: '.prj-new-repo-field' },
    setup: async (page) => {
      await page.locator('#prj-new-repo').click();
      await page.locator('.prj-new-repo-menu-row', { hasText: '本地文件夹' }).click();
      await page.waitForSelector('.prj-new-repo-menu', { state: 'hidden' });
    },
  },
  {
    id: 'tasks-filter-menu',
    url: TASKS,
    plate: '.prj-tasks-menu',
    rows: '.prj-tasks-menu-row',
    trigger: '.prj-tasks-filter',
    openSel: '.prj-tasks-filter',
    openText: '筛选',
  },
  {
    id: 'sched-card-menu',
    url: SCHED,
    plate: '.sched-card-menu',
    rows: '.sched-card-menu-row',
    trigger: '.sched-card-more',
    openSel: '.sched-card-more',
  },
];

async function openFace(page, face) {
  const loc = face.openText
    ? page.locator(face.openSel, { hasText: face.openText })
    : page.locator(face.openSel);
  await loc.first().click();
}

async function measureFace(page, face) {
  await page.goto(face.url);
  await page.waitForLoadState('networkidle');
  if (face.setup) await face.setup(page);
  await openFace(page, face);
  await page.waitForSelector(face.plate, { state: 'visible' });
  await settleAnims(page);
  return page.evaluate(
    ({ plate, rows, trigger, extra }) => {
      const snap = (sel) => {
        const el = sel ? document.querySelector(sel) : null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          rect: {
            x: +r.x.toFixed(1),
            y: +r.y.toFixed(1),
            w: +r.width.toFixed(1),
            h: +r.height.toFixed(1),
          },
          font: `${cs.fontSize}/${cs.lineHeight} ${cs.fontWeight} ${cs.fontFamily.split(',')[0]}`,
          color: cs.color,
          bg: cs.backgroundColor,
          radius: cs.borderRadius,
          shadow: cs.boxShadow.slice(0, 120),
          padding: cs.padding,
          role: el.getAttribute('role'),
          ariaLabel: el.getAttribute('aria-label'),
          ariaHaspopup: el.getAttribute('aria-haspopup'),
          ariaExpanded: el.getAttribute('aria-expanded'),
          text: (el.textContent ?? '').trim().slice(0, 40),
        };
      };
      const plateEl = document.querySelector(plate);
      const out = {
        plate: snap(plate),
        rows: [...document.querySelectorAll(rows)].map((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          // per-row check indicator: BEFORE renders .prj-*-menu-check spans
          // only on the selected row; AFTER always renders the wrapper's
          // indicator span but the Check svg only when checked — capture the
          // svg when present, else null.
          const ind = el.querySelector(
            '[data-slot$="indicator"], .prj-tasks-menu-check, .prj-new-repo-menu-check',
          );
          const svg = ind?.querySelector('svg') ?? null;
          let indicator = null;
          if (svg) {
            const ir = svg.getBoundingClientRect();
            indicator = {
              rect: {
                x: +ir.x.toFixed(1),
                y: +ir.y.toFixed(1),
                w: +ir.width.toFixed(1),
                h: +ir.height.toFixed(1),
              },
              color: getComputedStyle(svg).color,
            };
          }
          return {
            rect: {
              x: +r.x.toFixed(1),
              y: +r.y.toFixed(1),
              w: +r.width.toFixed(1),
              h: +r.height.toFixed(1),
            },
            font: `${cs.fontSize}/${cs.lineHeight} ${cs.fontWeight}`,
            color: cs.color,
            bg: cs.backgroundColor,
            radius: cs.borderRadius,
            padding: cs.padding,
            role: el.getAttribute('role'),
            ariaChecked: el.getAttribute('aria-checked'),
            ariaSelected: el.getAttribute('aria-selected'),
            text: (el.textContent ?? '').trim().slice(0, 40),
            indicator,
          };
        }),
        trigger: snap(trigger),
        extra: {},
      };
      void plateEl;
      for (const [k, sel] of Object.entries(extra ?? {})) out.extra[k] = snap(sel);
      return out;
    },
    { plate: face.plate, rows: face.rows, trigger: face.trigger, extra: face.extra },
  );
}

// ——— keyboard semantics ———
const activeInfo = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName,
      role: el?.getAttribute('role'),
      cls: typeof el?.className === 'string' ? el.className.slice(0, 70) : '',
      text: (el?.textContent ?? '').trim().slice(0, 24),
    };
  });

async function keyboardFace(page, face) {
  const k = { face: face.id };
  const triggerInfo = () =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return {
        haspopup: el?.getAttribute('aria-haspopup'),
        expanded: el?.getAttribute('aria-expanded'),
        activeIsTrigger: document.activeElement === el,
      };
    }, face.trigger);

  // 1. open with Enter from the focused trigger
  await page.goto(face.url);
  await page.waitForLoadState('networkidle');
  await page.evaluate((sel) => document.querySelector(sel)?.focus(), face.trigger);
  k.triggerClosed = await triggerInfo();
  await page.keyboard.press('Enter');
  await page.waitForSelector(face.plate, { state: 'visible' });
  await settleAnims(page);
  k.openedByEnter = true;
  k.focusAfterOpen = await activeInfo(page);
  k.triggerOpen = await triggerInfo();

  // 2. roving focus with arrows
  const order = [];
  for (let i = 0; i < (face.rowCount ?? 3); i += 1) {
    await page.keyboard.press('ArrowDown');
    order.push(await activeInfo(page));
  }
  k.arrowDownCycle = order;
  await page.keyboard.press('ArrowUp');
  k.afterArrowUp = await activeInfo(page);

  // 3. typeahead (Latin prefix; CJK labels are not key-dispatchable)
  if (face.typeaheadKey) {
    await page.keyboard.press(face.typeaheadKey);
    k.typeahead = { key: face.typeaheadKey, focused: await activeInfo(page) };
  }

  // 4. Esc closes, focus returns to the trigger
  await page.keyboard.press('Escape');
  await page.waitForSelector(face.plate, { state: 'hidden' });
  k.escClosed = true;
  k.focusAfterEsc = await activeInfo(page);

  // 5. outside click closes without passing through
  await page.evaluate((sel) => document.querySelector(sel)?.focus(), face.trigger);
  await page.keyboard.press('Enter');
  await page.waitForSelector(face.plate, { state: 'visible' });
  if (face.outsideProbe) {
    await face.outsideProbe(page, k);
  } else {
    await page.mouse.click(700, 650);
    await page.waitForSelector(face.plate, { state: 'hidden' });
    k.outsideClickClosed = true;
  }

  // 6. Enter on a row activates, closes, focus returns
  await page.goto(face.url);
  await page.waitForLoadState('networkidle');
  if (face.setup) await face.setup(page);
  await page.evaluate((sel) => document.querySelector(sel)?.focus(), face.trigger);
  await page.keyboard.press('Enter');
  await page.waitForSelector(face.plate, { state: 'visible' });
  await settleAnims(page);
  if (face.activateRow === 'last') {
    for (let i = 0; i < (face.rowCount ?? 3) - 1; i += 1) await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Enter');
  await page.waitForSelector(face.plate, { state: 'hidden' });
  k.enterActivatedClosed = true;
  k.focusAfterActivate = await activeInfo(page);
  k.selectionEffect = face.checkEffect ? await face.checkEffect(page) : undefined;
  return k;
}

const KEY_FACES = [
  {
    id: 'repo-menu-none',
    url: NEW,
    plate: '.prj-new-repo-menu',
    trigger: '#prj-new-repo',
    rowCount: 2,
    typeaheadKey: 'g',
    activateRow: 'last', // 本地文件夹 (keeps the trigger id stable for focus-return)
    checkEffect: async (page) =>
      (await page.locator('input[aria-label="本地文件夹"]').count()) > 0
        ? 'local input face shown'
        : 'unexpected',
  },
  {
    id: 'tasks-filter-menu',
    url: TASKS,
    plate: '.prj-tasks-menu',
    trigger: '.prj-tasks-filter',
    rowCount: 3,
    activateRow: 'last', // 已完成
    checkEffect: async (page) => `task rows visible = ${await page.locator('.prj-task-row').count()}`,
    outsideProbe: async (page, k) => {
      // click the 排序 trigger while the 筛选 menu is open: the menu must
      // close and the click must NOT activate the sort trigger underneath
      const sort = page.locator('.prj-tasks-filter', { hasText: '排序' });
      const box = await sort.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForSelector('.prj-tasks-menu', { state: 'hidden' });
      await page.waitForTimeout(200);
      k.outsideClickClosed = true;
      k.outsideClickNoPassthrough = (await page.locator('.prj-tasks-menu').count()) === 0;
    },
  },
  {
    id: 'sched-card-menu',
    url: SCHED,
    plate: '.sched-card-menu',
    trigger: '.sched-card-more',
    rowCount: 1,
    checkEffect: async (page) => {
      const shown = await page.locator('.delete-confirm').isVisible().catch(() => false);
      if (shown) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
      return shown ? 'delete confirm shown' : 'none';
    },
  },
];

const browser = await chromium.launch();
const results = { label, base, geometry: {}, keyboard: {} };

for (const scheme of ['dark', 'light']) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width: 1440, height: 732 },
    colorScheme: scheme,
  });
  const page = await ctx.newPage();
  for (const face of FACES) {
    results.geometry[`${face.id} (${scheme})`] = await measureFace(page, face);
    if (scheme === 'dark') {
      await page.locator(face.plate).screenshot({
        path: `${outDir}/${label}-${face.id}-plate.png`,
      });
      await page.screenshot({ path: `${outDir}/${label}-${face.id}-viewport.png` });
    }
    await page.keyboard.press('Escape');
    await page.mouse.click(700, 690);
    await page.waitForTimeout(200);
  }
  await ctx.close();
}

const kctx = await browser.newContext({
  baseURL: base,
  viewport: { width: 1440, height: 732 },
  colorScheme: 'dark',
});
const kpage = await kctx.newPage();
for (const face of KEY_FACES) {
  results.keyboard[face.id] = await keyboardFace(kpage, face);
}
await kctx.close();

await browser.close();
writeFileSync(`${outDir}/${label}-results.json`, JSON.stringify(results, null, 2));
console.log(`done: ${outDir}/${label}-results.json`);
