#!/usr/bin/env node
// Parity harness (issue #53): builds apps/web, serves it, captures every
// matrix row at 1440×732 / DPR 1 via Playwright, then scores each pair
// with the ffmpeg `ssim` filter (same methodology as prototype #42) and
// writes side-by-side + 50% blend ghost images to parity/output/.
// Rows with a baseline are gated at 0.85; rows without one are smoke
// rows compared against themselves (SSIM must be exactly 1.0), proving
// the capture → ffmpeg → report pipeline end to end.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { DEFAULT_BASELINE_THRESHOLD, matrix, SMOKE_THRESHOLD, VIEWPORT } from './matrix.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const OUT_DIR = resolve(ROOT, 'parity/output');
const BASELINE_DIR = resolve(ROOT, 'docs/research/assets/r7');
const PORT = 8390;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const THEME_KEY = 'tds-theme'; // same key as apps/web/src/theme.ts THEME_STORAGE_KEY

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

async function captureEntry(entry, browser) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  await context.addInitScript(
    ([key, theme]) => {
      localStorage.setItem(key, theme);
    },
    [THEME_KEY, entry.theme],
  );
  const page = await context.newPage();
  const url = `${BASE_URL}${entry.route}?scenario=${entry.scenario}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));

  if (entry.scrollLeft != null) {
    await page.evaluate((value) => {
      const el = document.querySelector('[data-parity-scroll]');
      if (el == null) throw new Error('no [data-parity-scroll] element for scrollLeft entry');
      el.scrollLeft = value === 'max' ? el.scrollWidth - el.clientWidth : value;
    }, entry.scrollLeft);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
  }

  const shot = resolve(OUT_DIR, `${entry.id}.png`);
  await page.screenshot({ path: shot });
  await context.close();
  return shot;
}

async function main() {
  console.log('building apps/web …');
  run('pnpm', ['--filter', '@pacman/web', 'build']);

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
  let browser;
  const results = [];
  try {
    await waitForServer(`${BASE_URL}/app`);
    // --no-proxy-server: developer machines often export http_proxy, and
    // Chromium would otherwise route 127.0.0.1 through it
    browser = await chromium.launch({ args: ['--no-proxy-server'] });

    for (const entry of matrix) {
      const capture = await captureEntry(entry, browser);
      const baseline = entry.baseline ? resolve(BASELINE_DIR, entry.baseline) : capture; // smoke row: compare the capture against itself
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
