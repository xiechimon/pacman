// Zero-pixel probe for the ui/button retirement (#670).
// Usage: node t0056-probe.mjs <baseURL> <outDir>
// Visits every face carrying a per-face rule whose provenance comment was
// synced in this change, screenshots it (viewport 1440x732, dark scheme,
// animations disabled) and records getComputedStyle readings for the
// rule-carrying elements. External requests are blocked so both runs are
// hermetic and deterministic.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [baseURL, outDir] = process.argv.slice(2);
if (!baseURL || !outDir) {
  console.error('usage: node t0056-probe.mjs <baseURL> <outDir>');
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const PROPS = [
  'display',
  'alignItems',
  'justifyContent',
  'width',
  'height',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderTopStyle',
  'borderRadius',
  'backgroundColor',
  'color',
  'fontSize',
  'lineHeight',
  'cursor',
  'opacity',
];

// face key -> { url, waitFor (selector or null), styles: {selectorKey: cssSelector} }
const FACES = [
  { key: 'board', url: '/app?scenario=01', waitFor: '.todo-card', styles: {} },
  {
    key: 'schedules',
    url: '/app/schedules?scenario=r3-93',
    waitFor: '.sched-card-more',
    styles: { 'sched-card-more': '.sched-card-more' },
  },
  {
    key: 'sched-form',
    url: '/app/schedules?scenario=r3-92',
    waitFor: '.sched-form-close',
    styles: { 'sched-form-close': '.sched-form-close' },
  },
  {
    key: 'prj-tasks-empty',
    url: '/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=r2-24b&tab=tasks',
    waitFor: '.prj-tasks-empty-new',
    styles: { 'prj-tasks-empty-new': '.prj-tasks-empty-new' },
  },
  {
    key: 'prj-settings',
    url: '/app/project/ZAQczKCu0MOAzC1ZqcFlX/settings?scenario=r2-24c',
    waitFor: '.prj-set-delete',
    styles: { 'prj-set-delete': '.prj-set-delete' },
  },
  {
    key: 'accept-dialog',
    url: '/app?scenario=34',
    waitFor: '.dlg-accept-done',
    styles: {
      'dlg-accept-done': '.dlg-accept-done',
      'dlg-accept-cancel': '.dlg-accept-cancel',
      'dlg-accept-block': '.dlg-accept-block', // may be absent in this scenario
    },
  },
  // gh-issues dialog: no fixture scenario, stub world copied from
  // e2e/project-github-issues.spec.ts (pagination face for .prj-issues-prev/next).
  { key: 'gh-issues', url: '/app/project/proj-gh?tab=tasks', waitFor: null, stub: true, styles: {
      'prj-issues-prev': '.prj-issues-prev',
      'prj-issues-next': '.prj-issues-next',
    } },
];

const PROJECTS = [
  { id: 'proj-gh', name: 'alpha', teamId: 'team-1', repoKind: 'github', githubRepo: 'octo/alpha' },
];
const TAGS = [{ id: 'tag-bug', projectId: 'proj-gh', name: 'bug', color: '#d73a4a', createdAt: 0, v: 1 }];
const ISSUES_PAGE_1 = {
  issues: [
    { number: 7, title: '登录偶发 500：重试风暴', state: 'open', labels: [{ name: 'bug', color: '#d73a4a' }] },
    { number: 9, title: 'second issue', state: 'open', labels: [] },
  ],
  page: 1,
  hasMore: true,
};
const json = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL,
  viewport: { width: 1440, height: 732 },
  colorScheme: 'dark',
});
// Hermetic: block anything not aimed at the local preview.
await context.route('**/*', (route) => {
  const host = new URL(route.request().url()).hostname;
  if (host === '127.0.0.1' || host === 'localhost') return route.continue();
  return route.abort();
});

const stylesOut = {};
for (const face of FACES) {
  const page = await context.newPage();
  if (face.stub) {
    await page.route('**/api/**', (route, request) => {
      const url = new URL(request.url());
      const path = url.pathname;
      if (request.method() !== 'GET') return route.fulfill(json({ error: 'probe: no writes' }, 500));
      if (path === '/api/teams') {
        return route.fulfill(json([{ id: 'team-1', name: 'Team', createdAt: 0, plan: 'free', avatarStyle: null }]));
      }
      if (path === '/api/user/me') return route.fulfill(json({ id: 'user-1', displayName: '我', avatarUrl: null }));
      if (path === '/api/projects') return route.fulfill(json(PROJECTS));
      if (path === '/api/todos') return route.fulfill(json([]));
      if (path === '/api/teams/team-1/github/connection') {
        return route.fulfill(json({ connected: true, login: 'octo', scope: 'repo' }));
      }
      if (path === '/api/projects/proj-gh/tags') return route.fulfill(json(TAGS));
      if (path === '/api/projects/proj-gh/github/issues') return route.fulfill(json(ISSUES_PAGE_1));
      return route.fulfill(json({ error: 'probe stub: not covered' }, 500));
    });
  }
  await page.goto(face.url, { waitUntil: 'networkidle' });
  if (face.stub) {
    await page.locator('.prj-issues-entry').click();
    await page.locator('.dlg-ghissues').waitFor({ state: 'visible' });
  } else if (face.waitFor) {
    await page.locator(face.waitFor).first().waitFor({ state: 'visible' });
  }
  await page.waitForTimeout(500); // settle fonts/animations
  await page.screenshot({
    path: join(outDir, `${face.key}.png`),
    animations: 'disabled',
    caret: 'hide',
  });
  const readings = {};
  for (const [name, selector] of Object.entries(face.styles)) {
    readings[name] = await page.evaluate(
      ({ selector, props }) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const cs = getComputedStyle(el);
        const out = {};
        for (const p of props) out[p] = cs[p];
        return out;
      },
      { selector, props: PROPS },
    );
  }
  stylesOut[face.key] = readings;
  console.log(`face ${face.key}: shot + ${Object.keys(readings).length} style readings`);
  await page.close();
}

writeFileSync(join(outDir, 'computed-styles.json'), JSON.stringify(stylesOut, null, 2) + '\n');
await browser.close();
console.log(`done -> ${outDir}`);
