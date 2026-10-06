#!/usr/bin/env node

// #945 migration-fidelity probe: full computed-style + geometry capture of
// every detail.css surface, run identically before (per-face rules) and
// after (utility carriers) the retirement. The after run must byte-match the
// before run on every captured property, except the D2-authorized faces
// declared in ALLOW_DRIFT (chip 18→20px family, branch seg → Tabs default
// 档, chief-dlg-ghost → Button outline, bare textarea → Textarea 件底座).
//
// Usage:
//   node docs/verify/945/scripts/measure-945.mjs --base http://localhost:8402 \
//     --out docs/verify/945/measure/before
//
// Output: <out>/measure-<theme>.json

import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg('base', 'http://localhost:8402');
const OUT = resolve(REPO, arg('out', 'docs/verify/945/measure/before'));

const DETAIL = '/app/todo/7ve0iOkQ-JBpSL98zSiGc';

// One scene = one route + optional clicks to reach the face + the selector
// list to capture. `pseudo` entries capture ::before/::after of the selector.
const SCENES = [
  {
    name: 'review-17b',
    url: `${DETAIL}?scenario=17b`,
    selectors: [
      '.detail-shell', '.detail-main', '.detail-body', '.detail-center',
      '.detail-head', '.detail-back', '.detail-seq', '.detail-chip',
      '.detail-chip .chip', '.detail-chip-chevron', '.detail-title',
      '.detail-head-actions', '.detail-head-icon', '.detail-head-action',
      '.detail-right', '.doc-pane', '.doc-pane-head', '.doc-pane-select',
      '.doc-select-wrap', '.doc-pane-body', '.doc-block', '.doc-empty',
      '.chat-col', '.chat-pin', '.composer', '.composer-placeholder',
      '.composer-toolbar', '.composer-tool', '.composer-send',
    ],
  },
  {
    name: 'user-menu',
    url: `${DETAIL}?scenario=17b`,
    clicks: ['.sidebar-user'],
    selectors: [
      '.user-menu', '.user-menu-head', '.user-menu-head img',
      '.user-menu-name', '.user-menu-rows', '.user-menu-row',
      '.user-menu-seg', '.user-menu-seg button[data-active="true"]',
      '.user-menu-seg button[data-active="false"]',
    ],
    pseudos: { '.user-menu': ['::before', '::after'] },
  },
  {
    name: 'chip-popover',
    url: `${DETAIL}?scenario=27`,
    clicks: ['.detail-chip'],
    selectors: ['.detail-chip'],
  },
  {
    name: 'done-36',
    url: `${DETAIL}?scenario=36`,
    selectors: [
      '.chat-row', '.chat-avatar', '.chat-avatar img', '.chat-bubble',
      '.chat-text', '.chat-para', '.chat-code', '.chat-note',
      '.chat-row-icons', '.chat-copy', '.chat-taskline', '.chat-taskline-seq',
      '.chat-taskline-title', '.chat-stamp',
    ],
  },
  {
    name: 'streaming-26',
    url: `${DETAIL}?scenario=26`,
    selectors: [
      '.chat-streaming', '.chat-spinner', '.chat-streaming-secs',
      '.chat-streaming-label', '.composer-stop', '.composer-stop-glyph',
      '.composer-send', '.composer-send--ready',
    ],
  },
  {
    name: 'md-toolout',
    url: `${DETAIL}?scenario=md-toolout`,
    selectors: [
      '.chat-md-head', '.chat-md-item', '.chat-md-ordinal', '.chat-md-marker',
      '.chat-md-content', '.chat-md-code', '.chat-tool-output',
      'button.chat-row-icons--toggle', '.chat-foot-tools-label',
      '.chat-foot-elapsed', '.chat-foot-chevron', '.chat-text',
    ],
  },
  {
    name: 'tools-28',
    url: `${DETAIL}?scenario=28`,
    selectors: [
      '.chat-tools', '.chat-tool', '.chat-tool-pill', '.chat-tool-label',
      '.chat-tool-output', '.chat-collapse', '.chat-collapse-icon',
      '.chat-plan', '.chat-plan-title', '.chat-plan-open', '.chat-preview',
    ],
  },
  {
    name: 'fresh-23',
    url: '/app/todo/fresh-probe?scenario=23',
    selectors: [
      '.detail-fresh', '.fresh-block', '.fresh-title', '.fresh-tags',
      '.fresh-nodesc', '.fresh-meta', '.fresh-meta-time', '.fresh-actions',
      '.fresh-start', '.fresh-action-hint',
    ],
  },
  {
    name: 'diff-27b',
    url: `${DETAIL}?scenario=27b`,
    selectors: [
      '.doc-files', '.doc-file-row', '.doc-file-row svg', '.doc-file-eye',
      '.doc-file-add', '.diff-hunk-head', '.diff-line', '.diff-line--add',
      '.diff-no', '.diff-no--new', '.diff-mark', '.diff-text', '.diff-expand',
    ],
  },
  {
    name: 'plan-diff-66',
    url: '/app/todo/r8-15?scenario=66',
    selectors: [
      '.doc-changes-stat', '.doc-changes-add', '.doc-changes-del',
      '.doc-expand-all', '.doc-range-wrap', '.doc-range-chip',
    ],
  },
  {
    name: 'version-menu-66',
    url: '/app/todo/r8-15?scenario=66',
    clicks: ['.doc-range-chip'],
    selectors: ['.version-menu', '.version-menu-row', '.version-menu-label', '.version-menu-row svg'],
  },
  {
    name: 'pane-sections',
    url: `${DETAIL}?scenario=30`,
    selectors: ['.pane-section', '.pane-section-body'],
  },
  {
    name: 'pane-branch-31',
    url: `${DETAIL}?scenario=31`,
    selectors: ['.pane-branch-pr', '.pane-branch-foot', '.dlg-branch-body'],
  },
  {
    name: 'fab-detail-unread',
    url: `${DETAIL}?scenario=detail-unread`,
    selectors: ['.detail-fab', '.fab-badge'],
  },
  {
    name: 'rerun-overlay',
    url: '/app/todo/r8-12?scenario=56',
    selectors: [
      '.overlay', '.overlay-panel', '.overlay-head', '.overlay-title',
      '.overlay-close', '.overlay-body', '.rerun-info', '.overlay-actions',
    ],
  },
  {
    name: 'reuse-overlay',
    url: '/app/todo/r8-15?scenario=75',
    selectors: ['.overlay-back', '.reuse-body', '.reuse-prompt'],
  },
  {
    name: 'branch-dialog',
    url: '/app?scenario=01',
    clicks: ['.todo-card-branch'],
    selectors: ['.dlg-form-seg', '.dlg-seg-tab', '.dlg-seg-tab[data-active="true"]'],
  },
];

const PROPS_SKIP = new Set(['']);

function capture(page, scene) {
  return page.evaluate(
    ({ scene }) => {
      const out = {};
      const dump = (key, el, pseudo) => {
        const cs = getComputedStyle(el, pseudo);
        const style = {};
        for (let i = 0; i < cs.length; i += 1) {
          const p = cs[i];
          style[p] = cs.getPropertyValue(p);
        }
        const r = el.getBoundingClientRect();
        out[key] = {
          style,
          rect: {
            x: Math.round(r.x * 100) / 100,
            y: Math.round(r.y * 100) / 100,
            w: Math.round(r.width * 100) / 100,
            h: Math.round(r.height * 100) / 100,
          },
        };
      };
      for (const sel of scene.selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length === 0) {
          out[sel] = null;
          continue;
        }
        // first + count: the migration must preserve both
        const entry = { count: els.length };
        const cs = getComputedStyle(els[0]);
        const style = {};
        for (let i = 0; i < cs.length; i += 1) style[cs[i]] = cs.getPropertyValue(cs[i]);
        const r = els[0].getBoundingClientRect();
        entry.style = style;
        entry.rect = {
          x: Math.round(r.x * 100) / 100,
          y: Math.round(r.y * 100) / 100,
          w: Math.round(r.width * 100) / 100,
          h: Math.round(r.height * 100) / 100,
        };
        out[sel] = entry;
      }
      for (const [sel, pseudos] of Object.entries(scene.pseudos ?? {})) {
        const el = document.querySelector(sel);
        if (el == null) continue;
        for (const p of pseudos) dump(`${sel} ${p}`, el, p);
      }
      return out;
    },
    { scene: { selectors: scene.selectors, pseudos: scene.pseudos } },
  );
}

async function run(browser, theme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
  await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
  const result = {};
  for (const scene of SCENES) {
    await page.goto(`${BASE}${scene.url}`);
    await page.waitForLoadState('networkidle');
    for (const sel of scene.clicks ?? []) {
      const loc = page.locator(sel).first();
      if ((await loc.count()) === 0) {
        if (scene.optional) continue;
        throw new Error(`${scene.name}: click target missing: ${sel}`);
      }
      await loc.click();
      await page.waitForTimeout(300);
    }
    result[scene.name] = await capture(page, scene);
  }
  await page.close();
  return result;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const data = await run(browser, theme);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(OUT, `measure-${theme}.json`), JSON.stringify(data, null, 1));
}
await browser.close();
console.log(`measure-945: wrote computed-style captures → ${OUT}`);
