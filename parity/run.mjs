#!/usr/bin/env node
// Parity harness (issue #53): builds apps/web, serves it, captures every
// matrix row at 1440×732 / DPR 1 via Playwright, then scores each pair
// with the ffmpeg `ssim` filter (same methodology as prototype #42) and
// writes side-by-side + 50% blend ghost images to parity/output/.
// Rows with a baseline are gated at 0.85; rows without one are smoke
// rows compared against themselves (SSIM must be exactly 1.0), proving
// the capture → ffmpeg → report pipeline end to end.
// #58: the build runs with `--mode parity` — the only production-grade
// build in which the ?scenario= fixture parameter stays live (see
// apps/web/src/fixtures/scenario.ts); a plain `vite build` ignores it.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { DEFAULT_BASELINE_THRESHOLD, matrix, SMOKE_THRESHOLD, VIEWPORT } from './matrix.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const OUT_DIR = resolve(ROOT, 'parity/output');
// Baselines live per capture batch under docs/research/assets/ (04 册 §2):
// bare filenames resolve to r7/, `r8/<file>` rows to the companion batch.
// D3 品牌槽切换（#109，素材替换计划 §2/§3.4）：原站基线含 tds_/Todos 字样的
// 行重定基线——新基线切自渲染产物，存 parity/baselines/（`rebaseline/<file>`
// 行指向）；原站截图按 D4(a) 留 docs/research/assets/ 作研究证据不删。
const ASSETS_DIR = resolve(ROOT, 'docs/research/assets');
const BASELINE_DIR = resolve(ASSETS_DIR, 'r7');
const REBASELINE_DIR = resolve(ROOT, 'parity/baselines');
// parallel sessions (worktrees) run this harness concurrently — PARITY_PORT
// lets each pick its own preview port instead of fighting over 8390
const PORT = Number(process.env.PARITY_PORT ?? 8390);
const BASE_URL = `http://127.0.0.1:${PORT}`;
// 注入键 = 品牌槽（brand.ts localStoragePrefix / client-state.ts 登记处；
// D3 替换相位 pacman- / pacman. 同形，#109）
const THEME_KEY = 'pacman-theme'; // same key as apps/web/src/theme.ts THEME_STORAGE_KEY
const SIDEBAR_KEY = 'pacman.sidebar-collapsed'; // apps/web/src/routes/board-page.tsx SIDEBAR_STORAGE_KEY
const LOCALE_KEYS = ['pacman.locale', 'pacman-locale']; // apps/web/src/i18n/locale.ts dual-key contract (r2 §1.5 原键 tds.* 同形替换)

/** baseline 路径解析：bare = r7 批，`r8/…` = 随拍批（04 §2 A6），
 *  `rebaseline/…` = D3 重定基线批（渲染产物，parity/baselines/）。 */
function resolveBaseline(path) {
  if (path.startsWith('rebaseline/'))
    return resolve(REBASELINE_DIR, path.slice('rebaseline/'.length));
  return resolve(path.includes('/') ? ASSETS_DIR : BASELINE_DIR, path);
}

mkdirSync(OUT_DIR, { recursive: true });

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts });
  if (r.status !== 0) {
    console.error(`${cmd} ${args.join(' ')} failed:\n${r.stdout}\n${r.stderr}`);
    process.exit(1);
  }
  return r;
}

function ffmpeg(args) {
  return run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
}

/** SSIM score of two same-size PNGs via the ffmpeg ssim filter. */
function ssim(a, b) {
  const r = run('ffmpeg', ['-i', a, '-i', b, '-lavfi', 'ssim', '-f', 'null', '-']);
  const m = `${r.stdout}${r.stderr}`.match(/All:([\d.]+)/);
  if (m == null) throw new Error(`no SSIM score in ffmpeg output for ${a} vs ${b}`);
  return Number.parseFloat(m[1]);
}

async function waitForServer(url, tries = 100) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`preview server never came up at ${url}`);
}

// #73: enter/exit transitions are real animations now — a lone rAF would
// catch them mid-flight. Wait for every finite animation/transition to
// finish (capped at 2s so an infinite spinner can never hang a capture),
// then one more frame so the settled style is what gets shot.
async function settle(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const cap = setTimeout(() => resolve(null), 2000);
        let quiet = 0;
        const wait = () => {
          const live = document.getAnimations().filter((anim) => {
            const timing = anim.effect?.getTiming();
            return timing?.iterations !== Infinity && anim.playState !== 'finished';
          });
          if (live.length === 0) {
            quiet += 1;
            // a few quiet frames: the enter animation is created one style
            // recalc after mount, and under CI load the compositor can lag
            // the timeline — both would otherwise shoot mid-fade
            if (quiet >= 4) {
              clearTimeout(cap);
              requestAnimationFrame(() => resolve(null));
            } else {
              requestAnimationFrame(wait);
            }
            return;
          }
          quiet = 0;
          Promise.all(live.map((anim) => anim.finished.catch(() => null))).then(wait);
        };
        wait();
      }),
  );
}

async function captureEntry(entry, browser) {
  const context = await browser.newContext({
    viewport: entry.viewport ?? VIEWPORT,
    deviceScaleFactor: 1,
  });
  await context.addInitScript(
    ([key, theme, sidebarKey, sidebarCollapsed, localeKeys, locale]) => {
      localStorage.setItem(key, theme);
      if (sidebarCollapsed != null) localStorage.setItem(sidebarKey, sidebarCollapsed);
      if (locale != null) for (const k of localeKeys) localStorage.setItem(k, locale);
    },
    [
      THEME_KEY,
      entry.theme,
      SIDEBAR_KEY,
      entry.sidebarCollapsed ? '1' : null,
      LOCALE_KEYS,
      entry.locale ?? null,
    ],
  );
  const page = await context.newPage();
  const url = `${BASE_URL}${entry.route}?scenario=${entry.scenario}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await settle(page);

  if (entry.scrollLeft != null) {
    await page.evaluate((value) => {
      const el = document.querySelector('[data-parity-scroll]');
      if (el == null) throw new Error('no [data-parity-scroll] element for scrollLeft entry');
      el.scrollLeft = value === 'max' ? el.scrollWidth - el.clientWidth : value;
    }, entry.scrollLeft);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
  }

  if (process.env.PARITY_DEBUG != null) {
    console.log(
      `debug ${entry.id}:`,
      await page.evaluate(() => ({
        todoId: document.querySelector('[data-todo-id]')?.getAttribute('data-todo-id'),
        overlay: document.querySelector('.overlay') != null,
        href: location.href,
      })),
    );
  }

  // overlay rows (#66): open the surface by clicking through it, one
  // selector per step, settling a frame after each so the popover/dialog
  // is painted before the shot
  if (entry.clicks != null) {
    for (const selector of entry.clicks) {
      await page.click(selector);
      await settle(page);
    }
  }

  // filled-input states (#66, r7 14): type after the clicks opened the surface
  if (entry.fills != null) {
    for (const fill of entry.fills) {
      await page.fill(fill.selector, fill.text);
      await settle(page);
    }
  }

  // drag gestures (#73): a real pointer sequence — the board's dnd layer
  // needs trusted pointermoves past its 5px threshold. `at` picks the
  // vertical drop point inside the target box (top = insertion index 0).
  if (entry.drag != null) {
    // #160: a drag row whose target sits past the horizontal fold needs a
    // row-level scrollLeft — pointer events outside the viewport never
    // reach the sensor, so an unscrolled gesture silently no-ops (the
    // pre-#160 drag rows never actually dragged)
    const fromBox = await page.locator(entry.drag.from).first().boundingBox();
    const toBox = await page.locator(entry.drag.to).first().boundingBox();
    if (fromBox == null || toBox == null) throw new Error(`drag boxes missing: ${entry.id}`);
    const at = entry.drag.at ?? 'center';
    const targetY =
      at === 'top'
        ? toBox.y + 30
        : at === 'bottom'
          ? toBox.y + toBox.height * 0.85
          : toBox.y + toBox.height / 2;
    await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(fromBox.x + fromBox.width / 2 + 8, fromBox.y + fromBox.height / 2 + 6, {
      steps: 4,
    });
    await page.mouse.move(toBox.x + toBox.width / 2, targetY, { steps: 12 });
    await page.mouse.up();
    await settle(page);
  }

  // hover states (#73): park the pointer on the selector for the shot
  if (entry.hover != null) {
    await page.hover(entry.hover);
    await settle(page);
  }

  // expectText gives the no-baseline (smoke) rows content teeth: the string
  // must appear in the rendered text or the serialized DOM (aria labels)
  if (entry.expectText != null) {
    const hit = await page.evaluate(
      (needle) =>
        document.body.innerText.includes(needle) ||
        document.documentElement.outerHTML.includes(needle),
      entry.expectText,
    );
    if (!hit) {
      await context.close();
      throw new Error(`${entry.id}: expectText ${JSON.stringify(entry.expectText)} not found`);
    }
  }

  // Chromium can hand back a stale composite right after the first paint
  // storm (torn captures showed a correct DOM over fallback pixels); a
  // discard shot plus the #73 paint grace forces a fresh frame for the
  // kept one
  await page.screenshot();
  await page.waitForTimeout(100);

  const shot = resolve(OUT_DIR, `${entry.id}.png`);
  await page.screenshot({ path: shot });
  await context.close();
  return shot;
}

async function main() {
  console.log('building apps/web (mode=parity) …');
  // --mode parity keeps ?scenario= live in the built bundle (#58 gate);
  // `pnpm build` alone would produce the scenario-blind production bundle
  run('pnpm', ['--filter', '@pacman/web', 'exec', 'vite', 'build', '--mode', 'parity']);

  console.log('starting preview server …');
  // detached + process-group kill: pnpm wraps vite in a child process, so a
  // plain child.kill() would orphan the actual server
  const preview = spawn(
    'pnpm',
    [
      '--filter',
      '@pacman/web',
      'exec',
      'vite',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(PORT),
      '--strictPort',
    ],
    { cwd: ROOT, stdio: 'ignore', detached: true },
  );
  // a squatter on PORT (stale harness run) would otherwise answer
  // waitForServer with an old bundle and silently fake the verdicts
  preview.on('exit', (code, signal) => {
    if (code === 0 || signal != null) return;
    console.error(`preview server exited early (code ${code}) — is port ${PORT} taken?`);
    process.exit(1);
  });
  let browser;
  const results = [];
  try {
    await waitForServer(`${BASE_URL}/app`);
    // --no-proxy-server: developer machines often export http_proxy, and
    // Chromium would otherwise route 127.0.0.1 through it
    browser = await chromium.launch({ args: ['--no-proxy-server'] });

    // PARITY_ONLY=id1,id2 limits the run to those row ids (local
    // iteration; CI runs the full matrix)
    const only = process.env.PARITY_ONLY?.split(',').filter(Boolean);
    for (const entry of matrix.filter((e) => only == null || only.includes(e.id))) {
      const capture = await captureEntry(entry, browser);
      // baseline = bare r7 filename, `r8/…` batch switch (04 §2 A6), or
      // `rebaseline/…` D3 重定基线批（#109，渲染产物存 parity/baselines/）
      const baseline = entry.baseline ? resolveBaseline(entry.baseline) : capture; // smoke row: compare the capture against itself
      const threshold =
        entry.threshold ?? (entry.baseline ? DEFAULT_BASELINE_THRESHOLD : SMOKE_THRESHOLD);

      const score = ssim(capture, baseline);
      const sideBySide = resolve(OUT_DIR, `${entry.id}.side-by-side.png`);
      const ghost = resolve(OUT_DIR, `${entry.id}.blend.png`);
      ffmpeg(['-i', capture, '-i', baseline, '-filter_complex', 'hstack', sideBySide]);
      ffmpeg(['-i', capture, '-i', baseline, '-filter_complex', 'blend=all_mode=average', ghost]);

      const pass = score >= threshold;
      results.push({
        id: entry.id,
        scenario: entry.scenario,
        theme: entry.theme,
        baseline: entry.baseline ?? '(self)',
        score,
        threshold,
        pass,
      });
      console.log(
        `${pass ? 'PASS' : 'FAIL'}  ${entry.id}  ssim=${score.toFixed(4)}  threshold=${threshold}  baseline=${entry.baseline ?? '(self)'}`,
      );
    }
  } finally {
    await browser?.close();
    try {
      process.kill(-preview.pid, 'SIGTERM');
    } catch {
      // group already gone
    }
  }

  writeFileSync(
    resolve(OUT_DIR, 'report.json'),
    `${JSON.stringify({ viewport: VIEWPORT, results }, null, 2)}\n`,
  );

  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n${results.length - failed.length}/${results.length} pairs green — artefacts in parity/output/`,
  );
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
