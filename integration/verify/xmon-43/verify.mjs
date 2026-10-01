// XMON-43 independent verification probe for the two board bugs reported in
// XMON-38. The acceptance wording is the issue's, verbatim:
//   1. 同一张看板内切换卡片有 bug，两张不同的看板切换就没事。
//   2. 看板最上端卡片被切掉一小截。
// The probe drives the real fixture build over HTTP (no product code touched,
// nothing imported from apps/ or packages/); every check reports the failure
// way it pins, and a check only passes on its own reading.
//
//   BASE_URL=http://127.0.0.1:8477 node integration/verify/xmon-43/verify.mjs \
//     --out docs/verify/XMON-43/evidence --label pr
//
// Exit code 0 = every check passed, 1 = at least one failed (the JSON result
// file carries the per-check detail either way).

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8477';
const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const OUT = resolve(argOf('out', 'docs/verify/XMON-43/evidence'));
const LABEL = argOf('label', 'run');
const VIEWPORT = { width: 1440, height: 900 };

mkdirSync(OUT, { recursive: true });
const shots = resolve(OUT, 'shots');
mkdirSync(shots, { recursive: true });

const checks = [];
function record(id, title, ok, detail, evidence = {}) {
  checks.push({ id, title, ok, detail, evidence });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${title}${detail ? ` — ${detail}` : ''}`);
}

// ---------------------------------------------------------------- png probe
/** Minimal PNG decoder for Chromium screenshots (#391 recipe): 8-bit
 *  RGB/RGBA, non-interlaced; anything else throws so a format change is loud. */
function decodePng(buf) {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i += 1) if (buf[i] !== SIG[i]) throw new Error('decodePng: bad signature');
  let width = 0;
  let height = 0;
  let channels = 0;
  let offset = 8;
  const idat = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || (data[9] !== 2 && data[9] !== 6) || data[12] !== 0) {
        throw new Error(`decodePng: unsupported (depth=${data[8]} color=${data[9]} interlace=${data[12]})`);
      }
      channels = data[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xff;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return {
    width,
    height,
    at: (x, y) => [out[y * stride + x * channels], out[y * stride + x * channels + 1], out[y * stride + x * channels + 2]],
  };
}

// ------------------------------------------------------------- page helpers
const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Everything a user can see on the board: per column, the card ids in view
 *  order — the whole fixture data face as it is painted. */
const readBoard = (page) =>
  page.evaluate(() => {
    const columns = [...document.querySelectorAll('.board-column')].map((col) => ({
      column: col.getAttribute('data-column'),
      cards: [...col.querySelectorAll('.todo-card')].map((c) => c.getAttribute('data-todo-id')),
    }));
    return {
      path: location.pathname + location.search,
      text: (document.querySelector('.board')?.innerText ?? document.body.innerText).replace(/\s+/g, ' ').trim(),
      columns,
      menus: document.querySelectorAll('.more-menu-item').length,
      dialogs: document.querySelectorAll('[role="dialog"],[data-slot="dialog"]').length,
    };
  });

/** Everything a user can see on one todo detail: which card the route says,
 *  which card is painted, the painted text, and any overlay left mounted. */
const readDetail = (page) =>
  page.evaluate(() => ({
    path: location.pathname + location.search,
    shellId: document.querySelector('.detail-shell')?.getAttribute('data-todo-id') ?? null,
    text: (document.querySelector('.detail-shell')?.innerText ?? '').replace(/\s+/g, ' ').trim(),
    menus: document.querySelectorAll('.more-menu-item').length,
    dialogs: document.querySelectorAll('[role="dialog"],[data-slot="dialog"],.dlg-shell,.del-confirm').length,
    rightPane: document.querySelector('.detail-right')?.innerText?.replace(/\s+/g, ' ').trim() ?? '',
  }));

const sameDetail = (a, b) => {
  const diffs = [];
  if (a.path !== b.path) diffs.push(`path ${a.path} != ${b.path}`);
  if (a.shellId !== b.shellId) diffs.push(`data-todo-id ${a.shellId} != ${b.shellId}`);
  if (a.text !== b.text) diffs.push(`text differs (${a.text.length} vs ${b.text.length} chars)`);
  if (a.rightPane !== b.rightPane) diffs.push('right pane differs');
  return diffs;
};

const sameBoard = (a, b) => {
  const diffs = [];
  const json = (x) => JSON.stringify(x.columns);
  if (json(a) !== json(b)) diffs.push(`columns ${json(a)} != ${json(b)}`);
  if (a.text !== b.text) diffs.push('board text differs');
  return diffs;
};

/** Every page carries a fault log: an switch path that "looks right" while
 *  throwing or fetching into a 4xx/5xx is not normal behaviour. */
const faults = new WeakMap();
const allFaults = [];
function watchFaults(page) {
  const log = [];
  faults.set(page, log);
  allFaults.push(log);
  page.on('console', (m) => {
    if (m.type() === 'error') log.push(`console: ${m.text().slice(0, 160)}`);
  });
  page.on('pageerror', (e) => log.push(`pageerror: ${String(e).slice(0, 160)}`));
  page.on('requestfailed', (r) => log.push(`requestfailed: ${r.url().slice(0, 120)}`));
  page.on('response', (r) => {
    if (r.status() >= 400) log.push(`http ${r.status()}: ${r.url().slice(0, 120)}`);
  });
  return page;
}

async function openBoard(browser, scenario) {
  const page = watchFaults(await browser.newPage({ viewport: VIEWPORT }));
  await page.goto(`${BASE}/app?scenario=${scenario}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.board-column', { timeout: 15000 });
  return page;
}

async function clickCard(page, id) {
  await page.locator(`.todo-card[data-todo-id="${id}"] a.todo-card-link`).click();
  await page.waitForSelector('.detail-shell');
  await page.waitForFunction((want) => document.querySelector('.detail-shell')?.getAttribute('data-todo-id') === want, id, {
    timeout: 10_000,
  });
  await page.waitForTimeout(250);
}

/** A fresh load of the same detail URL, in its own page — the reference the
 *  "switched to it" reading is compared against. */
async function freshDetail(browser, path) {
  const page = watchFaults(await browser.newPage({ viewport: VIEWPORT }));
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.detail-shell', { timeout: 15000 });
  await page.waitForTimeout(250);
  const read = await readDetail(page);
  await page.close();
  return read;
}

async function openSearchPanel(page, query) {
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Meta+k');
    const open = await page
      .locator('.search-panel')
      .waitFor({ state: 'visible', timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (open) break;
    if (i === 7) throw new Error('⌘K never opened the search panel');
  }
  await page.keyboard.type(query);
  await page.waitForTimeout(300);
}

// ================================================================== checks
const browser = await chromium.launch();

// --- A. bug 2: the topmost card is clipped ---------------------------------
const SCENARIOS = ['01', 'board-overflow', 'board-repos'];
const baseline = [];
for (const scenario of SCENARIOS) {
  const page = await openBoard(browser, scenario);
  const geo = await page.evaluate(() => {
    const rows = [];
    for (const col of document.querySelectorAll('.board-column')) {
      const list = col.querySelector('.board-column-list');
      const cards = col.querySelectorAll('.todo-card');
      if (!list || cards.length === 0) continue;
      const lr = list.getBoundingClientRect();
      const first = cards[0].getBoundingClientRect();
      const last = cards[cards.length - 1].getBoundingClientRect();
      rows.push({
        column: col.getAttribute('data-column'),
        count: cards.length,
        firstId: cards[0].getAttribute('data-todo-id'),
        padTop: getComputedStyle(list).paddingTop,
        padBottom: getComputedStyle(list).paddingBottom,
        gapTop: +(first.top - lr.top).toFixed(2),
        gapLeft: +(first.left - lr.left).toFixed(2),
        gapRight: +(lr.right - first.right).toFixed(2),
        gapBottomAtRest: +(lr.bottom - last.bottom).toFixed(2),
        scrollable: list.scrollHeight > list.clientHeight,
      });
    }
    return rows;
  });

  const worstTop = Math.min(...geo.map((g) => g.gapTop));
  record(
    `A1.${scenario}`,
    `最上端卡片上缘与滚动容器裁切线有让位（${scenario}）`,
    worstTop >= 1,
    `min gapTop=${worstTop}px（列 ${geo.map((g) => `${g.column}:${g.gapTop}`).join(' ')}，padTop=${geo[0]?.padTop}）`,
    { geo },
  );

  const worstSide = Math.min(...geo.flatMap((g) => [g.gapLeft, g.gapRight]));
  record(
    `A2.${scenario}`,
    `左右卡缘让位未被本次改动影响（${scenario}）`,
    worstSide >= 1,
    `min 横向 gap=${worstSide}px`,
    {},
  );

  // pixel: what colour sits on the 1px line just above the topmost card's
  // border box — the ring, or the column background showing through a clipped
  // edge.
  const probe = await page.evaluate(() => {
    for (const col of document.querySelectorAll('.board-column')) {
      const list = col.querySelector('.board-column-list');
      const card = col.querySelector('.todo-card');
      if (!list || !card) continue;
      const lr = list.getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      return {
        column: col.getAttribute('data-column'),
        id: card.getAttribute('data-todo-id'),
        x: Math.round(cr.left + cr.width / 2),
        cardTop: Math.round(cr.top),
        // reference: the column's own surface — the list's inline padding
        // strip beside the card, which no card paints over
        bgX: Math.round(lr.left + 2),
        bgY: Math.round(cr.top + 5),
        listBg: getComputedStyle(list).backgroundColor,
      };
    }
    return null;
  });
  if (probe === null) {
    record(`A3.${scenario}`, `首卡上缘像素（${scenario}）`, false, '未找到带卡的列');
  } else {
    const strip = decodePng(
      await page.screenshot({ clip: { x: probe.x, y: probe.cardTop - 3, width: 1, height: 6 } }),
    );
    const rows = [];
    for (let i = 0; i < 6; i += 1) rows.push({ y: probe.cardTop - 3 + i, rgb: strip.at(0, i) });
    const edge = rows.find((r) => r.y === probe.cardTop - 1);
    const bgRef = decodePng(
      await page.screenshot({ clip: { x: probe.bgX, y: probe.bgY, width: 1, height: 1 } }),
    ).at(0, 0);
    const isBg = edge.rgb.join(',') === bgRef.join(',');
    record(
      `A3.${scenario}`,
      `首卡上缘 1px 画的是卡环不是列底色（${scenario}）`,
      !isBg,
      `y=${edge.y} rgb=${edge.rgb.join(',')}；列底色参考 rgb=${bgRef.join(',')} → ${isBg ? '被裁（露出底色）' : '卡环在位'}`,
      { strip: rows, bgRef, cardTop: probe.cardTop, column: probe.column, card: probe.id },
    );
    baseline.push({ scenario, probe, rows, bgRef });
  }

  // scrolled to the end: the bottom edge of the last card sits on the same
  // padding-box clip line.
  const bottom = await page.evaluate(async () => {
    const out = [];
    for (const col of document.querySelectorAll('.board-column')) {
      const list = col.querySelector('.board-column-list');
      const cards = col.querySelectorAll('.todo-card');
      if (!list || cards.length === 0) continue;
      if (list.scrollHeight <= list.clientHeight) continue;
      list.scrollTo({ top: list.scrollHeight });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const lr = list.getBoundingClientRect();
      const last = cards[cards.length - 1].getBoundingClientRect();
      out.push({
        column: col.getAttribute('data-column'),
        lastId: cards[cards.length - 1].getAttribute('data-todo-id'),
        scrollTop: list.scrollTop,
        gapBottom: +(lr.bottom - last.bottom).toFixed(2),
        x: Math.round(last.left + last.width / 2),
        lastBottom: Math.round(last.bottom),
      });
    }
    return out;
  });
  if (bottom.length === 0) {
    record(`A4.${scenario}`, `滚到底末卡下缘让位（${scenario}）`, true, '该场景无滚动列，跳过（不适用）', {});
  } else {
    const worst = Math.min(...bottom.map((b) => b.gapBottom));
    record(
      `A4.${scenario}`,
      `滚到底末卡下缘与裁切线有让位（${scenario}）`,
      worst >= 1,
      `min gapBottom=${worst}px，scrollTop=${bottom[0].scrollTop}`,
      { bottom },
    );
  }

  await page.close();
}

// --- A5: visual evidence, 4x zoom on the top of the first column -----------
{
  const shots4 = [];
  for (const [zoom, name, w, h, dx, dy] of [
    [8, 'card-corner-8x', 64, 26, -4, -8],
    [4, 'column-top-4x', 260, 46, 0, -3],
  ]) {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: zoom });
    const page = await context.newPage();
    await page.goto(`${BASE}/app?scenario=board-overflow`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.todo-card');
    const box = await page.evaluate(
      ([dx, dy, w, h]) => {
        const col = document.querySelector('[data-column="todo"]');
        const list = col.querySelector('.board-column-list');
        const card = col.querySelector('.todo-card');
        const lr = list.getBoundingClientRect();
        const cr = card.getBoundingClientRect();
        return { x: Math.round(cr.left) + dx, y: Math.round(cr.top) + dy, w, h, cardTop: cr.top, listTop: lr.top };
      },
      [dx, dy, w, h],
    );
    const path = resolve(shots, `${LABEL}-${name}.png`);
    await page.screenshot({ path, clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
    if (zoom === 4) await page.screenshot({ path: resolve(shots, `${LABEL}-board-1x.png`) });
    await context.close();
    shots4.push({ name, zoom, box, path });
  }
  record(
    'A5',
    '首卡上缘截图留证（8× 左上角 + 4× 列顶 + 1× 整屏）',
    true,
    shots4.map((s) => s.name).join(', '),
    { shots: shots4 },
  );
}

// --- B. bug 1: switching cards inside one board ----------------------------
const BOARD01 = '01';
const CARD_A = 'r3-legacy-1';
const CARD_B = 'r3-legacy-2';

// B1: board → A → back → B → back → A  (consecutive switching on one board)
{
  const page = await openBoard(browser, BOARD01);
  const boardFresh = await readBoard(page);
  const landings = [];
  const diffs = [];
  for (const id of [CARD_A, CARD_B, CARD_A]) {
    await clickCard(page, id);
    const got = await readDetail(page);
    const fresh = await freshDetail(browser, got.path);
    const d = sameDetail(got, fresh);
    if (got.shellId !== id) d.push(`rendered ${got.shellId}, clicked ${id}`);
    diffs.push({ id, diffs: d, residMenus: got.menus, residDialogs: got.dialogs });
    landings.push({ id, path: got.path, shellId: got.shellId, menus: got.menus, dialogs: got.dialogs });
    await page.goBack();
    await page.waitForSelector('.board-column');
    await page.waitForTimeout(200);
  }
  const back = await readBoard(page);
  const boardDiffs = sameBoard(boardFresh, back);
  const log = faults.get(page);
  const ok =
    diffs.every((d) => d.diffs.length === 0 && d.residMenus === 0 && d.residDialogs === 0) &&
    boardDiffs.length === 0 &&
    log.length === 0;
  record(
    'B1',
    '同看板内连续切换卡片：每次落点与整页新开逐字一致，返回后看板如初',
    ok,
    ok
      ? '三轮（A→B→A）落点全等，看板复原，无控制台/网络故障'
      : `落点差异 ${JSON.stringify(diffs)}；看板差异 ${JSON.stringify(boardDiffs)}；故障 ${JSON.stringify(log)}`,
    { landings, diffs, boardDiffs, faults: log },
  );
  await page.close();
}

// B4: sweep one whole board — open every card in turn, come back, compare
// each landing with a fresh load. The widest same-board switching loop the
// fixture surface can express (12 cards, three columns).
{
  const page = await openBoard(browser, 'board-overflow');
  const ids = await page.$$eval('.todo-card', (els) => els.map((e) => e.getAttribute('data-todo-id')));
  const mismatches = [];
  for (const id of ids) {
    await clickCard(page, id);
    const got = await readDetail(page);
    const fresh = await freshDetail(browser, got.path);
    const d = sameDetail(got, fresh);
    if (got.shellId !== id) d.push(`rendered ${got.shellId} for clicked ${id}`);
    if (got.menus !== 0 || got.dialogs !== 0) d.push(`residual overlay menus=${got.menus} dialogs=${got.dialogs}`);
    if (d.length > 0) mismatches.push({ id, diffs: d });
    await page.goBack();
    await page.waitForSelector('.board-column');
    await page.waitForTimeout(120);
  }
  const log = faults.get(page);
  const ok = mismatches.length === 0 && log.length === 0;
  record(
    'B4',
    `同看板内逐张扫掠（${ids.length} 张卡）：每张落点与新开一致，无残留状态`,
    ok,
    ok ? `${ids.length}/${ids.length} 张全等，无控制台/网络故障` : `异常 ${JSON.stringify(mismatches)}；故障 ${JSON.stringify(log)}`,
    { cards: ids.length, mismatches, faults: log },
  );
  await page.close();
}

// B2: in-place switch on the same route (detail A → ⌘K → detail B).
{
  const page = await openBoard(browser, BOARD01);
  await clickCard(page, CARD_A);
  const before = await readDetail(page);
  await openSearchPanel(page, 'r3 lifecycle probe');
  const rows = page.locator('.search-row--todo');
  const count = await rows.count();
  let ok = false;
  let detail = '';
  let after = null;
  let fresh = null;
  if (count < 2) {
    detail = `搜索结果只有 ${count} 行，无法换到第二张卡`;
  } else {
    await rows.nth(1).click();
    await page.waitForFunction(() => location.pathname.includes('r3-legacy-2'), null, { timeout: 10_000 });
    await page.waitForTimeout(400);
    after = await readDetail(page);
    fresh = await freshDetail(browser, after.path);
    const d = sameDetail(after, fresh);
    const stale = after.shellId !== 'r3-legacy-2';
    ok = d.length === 0 && after.menus === 0 && after.dialogs === 0 && !stale;
    detail = ok
      ? `换到 ${after.shellId}，与整页新开逐字一致，无残留浮层`
      : `差异 ${JSON.stringify(d)}；渲染 id=${after.shellId}；menus=${after.menus} dialogs=${after.dialogs}`;
  }
  record('B2', '同看板内换卡（同路由换参，不重挂载）：落点与新开一致', ok, detail, {
    before: { path: before.path, shellId: before.shellId },
    after: after && { path: after.path, shellId: after.shellId, menus: after.menus, dialogs: after.dialogs },
    rows: count,
  });
  await page.close();
}

// B3: same-board switch while an overlay is open — does the previous card's
// overlay ride along onto the next card?
{
  const page = await openBoard(browser, BOARD01);
  await clickCard(page, CARD_A);
  await page.locator('button[aria-label="更多"]').first().click();
  await page.waitForTimeout(300);
  const withMenu = await readDetail(page);
  await openSearchPanel(page, 'r3 lifecycle probe');
  const rows = page.locator('.search-row--todo');
  let ok = false;
  let detail = `菜单打开后搜索结果不足（${await rows.count()} 行）`;
  let after = null;
  if ((await rows.count()) >= 2) {
    await rows.nth(1).click();
    await page.waitForFunction(() => location.pathname.includes('r3-legacy-2'), null, { timeout: 10_000 });
    await page.waitForTimeout(400);
    after = await readDetail(page);
    const carried = after.menus > 0;
    ok = !carried && after.dialogs === 0 && after.shellId === 'r3-legacy-2';
    detail = carried
      ? `换到 ${after.shellId} 后上一张卡的更多菜单仍在（${after.menus} 项）`
      : `换到 ${after.shellId} 后浮层已关闭（menus=${after.menus} dialogs=${after.dialogs}）`;
  }
  record('B3', '开着「更多」菜单换卡：浮层不跟到下一张卡', ok, detail, {
    menuBefore: withMenu.menus,
    after: after && { shellId: after.shellId, menus: after.menus, dialogs: after.dialogs },
  });
  await page.close();
}

// --- C. regression: switching between two different boards -----------------
{
  const page = await openBoard(browser, BOARD01);
  const board01 = await readBoard(page);
  const other = await openBoard(browser, 'board-overflow');
  const boardOverflow = await readBoard(other);
  await other.close();

  await page.goto(`${BASE}/app?scenario=board-overflow`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.board-column');
  await clickCard(page, 'overflow-01');
  const first = await readDetail(page);
  const firstFresh = await freshDetail(browser, first.path);

  await page.goto(`${BASE}/app?scenario=01`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.board-column');
  const back01 = await readBoard(page);
  await clickCard(page, CARD_A);
  const second = await readDetail(page);
  const secondFresh = await freshDetail(browser, second.path);

  const d1 = sameDetail(first, firstFresh);
  const d2 = sameDetail(second, secondFresh);
  const boardDiffs = sameBoard(board01, back01);
  const ok =
    d1.length === 0 &&
    d2.length === 0 &&
    boardDiffs.length === 0 &&
    first.shellId === 'overflow-01' &&
    second.shellId === CARD_A &&
    first.menus === 0 &&
    second.menus === 0;
  record(
    'C1',
    '两张不同看板之间来回切换：各自落点与新开一致，数据面不串',
    ok,
    ok
      ? `board-overflow → ${first.shellId}、01 → ${second.shellId} 均与新开逐字一致`
      : `差异 landing1=${JSON.stringify(d1)} landing2=${JSON.stringify(d2)} board=${JSON.stringify(boardDiffs)}`,
    {
      boardOverflowColumns: boardOverflow.columns,
      board01Columns: board01.columns,
      backColumns: back01.columns,
      landings: [
        { path: first.path, shellId: first.shellId, menus: first.menus, dialogs: first.dialogs },
        { path: second.path, shellId: second.shellId, menus: second.menus, dialogs: second.dialogs },
      ],
    },
  );
  await page.close();
}

// --- D2: where board surfaces live (evidence for the criterion-1 wording) --
{
  const ROUTES = [
    '/app?scenario=01',
    '/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=prj-tasks',
    '/app/project/ZAQczKCu0MOAzC1ZqcFlX/settings?scenario=prj-tasks',
    '/app/todo/r3-legacy-1?scenario=01',
    '/app/team?scenario=01',
    '/app/schedules?scenario=01',
    '/app/account?scenario=01',
    '/app/resources/machines?scenario=01',
    '/app/resources/skills?scenario=01',
  ];
  // this sweep walks surfaces outside the acceptance scope, so it keeps its
  // own fault read (the live-API 404s of the fixture build belong to them,
  // not to the board) — only the board + detail pages feed check D1.
  const page = await browser.newPage({ viewport: VIEWPORT });
  const found = [];
  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    const columns = await page.locator('.board-column').count();
    found.push({ route, boardColumns: columns });
  }
  await page.close();
  const boardSurfaces = found.filter((f) => f.boardColumns > 0).map((f) => f.route);
  record(
    'D2',
    '仓内看板面（.board-column 结构）只出现在 /app 一条路由',
    boardSurfaces.length === 1 && boardSurfaces[0] === '/app?scenario=01',
    `带看板列的路由：${boardSurfaces.join(' ') || '（无）'}`,
    { found },
  );
}

await browser.close();

// D. no new fault surfaced anywhere in the driven surface
{
  const entries = allFaults.flat();
  record(
    'D1',
    '全流程无 console error / 页面异常 / 失败请求',
    entries.length === 0,
    entries.length === 0 ? `0 条（${allFaults.length} 个页面上下文）` : `${entries.length} 条：${JSON.stringify(entries.slice(0, 5))}`,
    { faults: entries.slice(0, 20) },
  );
}

const failed = checks.filter((c) => !c.ok);
const result = {
  label: LABEL,
  baseUrl: BASE,
  ranAt: new Date().toISOString(),
  checks,
  passed: checks.length - failed.length,
  total: checks.length,
  failedIds: failed.map((c) => c.id),
};
writeFileSync(resolve(OUT, `${LABEL}-result.json`), `${JSON.stringify(result, null, 2)}\n`);
console.log(`\n${result.passed}/${result.total} checks passed → ${resolve(OUT, `${LABEL}-result.json`)}`);
process.exit(failed.length === 0 ? 0 : 1);