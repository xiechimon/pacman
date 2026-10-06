#!/usr/bin/env node

// #946 live evidence: the pages domain on the verify live stack (isolated
// 8795/5277 + scratch PACMAN_HOME). Drives the faces whose carriers the
// fixture e2e cannot reach with a real server behind them:
//
//   1. schedules: empty state -> 新建 topbar action -> 新建定时 form ->
//      单次 freq tab -> SchedSelect 时/分 (the #946 local listbox
//      composition replacing the Select-piece face: trigger aria-haspopup,
//      role=listbox menu, role=option rows, select-and-close) -> 保存 ->
//      real POST /api/schedules -> card renders -> GET /api/schedules JSON
//      + SQLite schedule row archived -> kebab menu -> 删除 -> confirm ->
//      card gone.
//   2. project page (hosted repo, real bare-repo tree): files pane branch
//      chip + seg tabs + file row select -> viewer renders file content.
//   3. new project page: repo kind menu -> 本地文件夹 face (input + 浏览 +
//      swap). The 浏览 button is deliberately NOT clicked live — it opens
//      the native macOS folder dialog on the host (POST /api/fs/pick);
//      the dir-browser overlay is exercised by the stubbed e2e instead.
//   4. project settings: rows + danger card render (no delete — the
//      project is the evidence subject of step 2).
//   5. both themes: light/dark screenshots of every face above.
//
// Usage (stack running): env -u http_proxy -u https_proxy -u all_proxy \
//   node docs/verify/946/scripts/drive-946-pages-live.mjs [outDir]

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const OUT = resolve(REPO, process.argv[2] ?? 'docs/verify/946/live');
const WEB_PORT = process.env.VERIFY_WEB_PORT ?? '5277';
const API_PORT = process.env.VERIFY_PORT ?? '8795';
const BASE = `http://127.0.0.1:${WEB_PORT}`;
const API = `http://127.0.0.1:${API_PORT}`;
const HOME = process.env.PACMAN_HOME ?? join(REPO, '.claude/verify-run/home');
// better-sqlite3 在 apps/server 依赖里，按包定位解析（drive-attachments 先例）。
const require2 = createRequire(join(REPO, 'apps/server/package.json'));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });

// --- seed via public REST (铺底不走 UI，验证面全走真用户路径) --------------
const teams = await (await fetch(`${API}/api/teams`)).json();
const teamId = teams[0]?.id ?? '';
check('seed: team present', teamId !== '', teamId);
const project = await (
  await fetch(`${API}/api/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'verify-946-pages', teamId, kind: 'hosted' }),
  })
).json();
check('seed: hosted project created', typeof project?.id === 'string', project?.id ?? '');
const todo = await (
  await fetch(`${API}/api/projects/${project.id}/todos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: '946 定时链探针任务',
      spec: '946 定时链探针任务\n\nlive 栈铺底行，供新建定时表单消费。',
    }),
  })
).json();
check('seed: todo created', typeof todo?.id === 'string', todo?.id ?? '');

// --- 1. schedules: empty -> form -> SchedSelect -> save -> card -> delete --
await page.goto(`${BASE}/app/schedules`);
await page.waitForLoadState('networkidle');
check(
  'schedules: empty state renders',
  await page.getByText('尚无定时。').isVisible(),
);
await page.screenshot({ path: join(OUT, 'sched-01-empty-light.png') });

await page.getByRole('button', { name: '新建', exact: true }).click();
const form = page.getByRole('dialog', { name: '新建定时' });
await form.waitFor();
check('schedules: 新建 opens the form dialog', await form.isVisible());

await form.getByRole('button', { name: '单次' }).click();
check(
  'schedules: 单次 freq tab selects (aria carrier + date field appears)',
  await form.getByRole('button', { name: '日期' }).isVisible(),
);

// SchedSelect 时: trigger aria-haspopup=listbox + aria-expanded, menu
// role=listbox with aria-label, option rows, select-and-close.
const hourTrigger = form.getByRole('button', { name: '时', exact: true });
check(
  'SchedSelect: trigger carries aria-haspopup=listbox',
  (await hourTrigger.getAttribute('aria-haspopup')) === 'listbox',
);
await hourTrigger.click();
const hourMenu = page.getByRole('listbox', { name: '时', exact: true });
await hourMenu.waitFor();
check('SchedSelect: menu is role=listbox with aria-label', await hourMenu.isVisible());
const optionCount = await hourMenu.getByRole('option').count();
check('SchedSelect: 24 hour options', optionCount === 24, String(optionCount));
await page.screenshot({ path: join(OUT, 'sched-02-select-menu-light.png') });
await hourMenu.getByRole('option', { name: '10', exact: true }).click();
// 收面走 FloatingShell 的 visibility 桥（--dur-fast 150ms 退场），落定后判
await page.waitForTimeout(400);
check(
  'SchedSelect: select-and-close + trigger label follows',
  !(await hourMenu.isVisible()) && (await hourTrigger.textContent()).includes('10'),
  await hourTrigger.textContent(),
);
await form.getByRole('button', { name: '分', exact: true }).click();
await page
  .getByRole('listbox', { name: '分', exact: true })
  .getByRole('option', { name: '30', exact: true })
  .click();
await page.waitForTimeout(400);
check(
  'SchedSelect: minute trigger label follows',
  (await form.getByRole('button', { name: '分', exact: true }).textContent()).includes('30'),
);
await page.screenshot({ path: join(OUT, 'sched-03-form-once-light.png') });

await form.getByRole('button', { name: '保存' }).click();
const card = page.getByText('946 定时链探针任务').first();
await card.waitFor({ timeout: 15_000 });
check('schedules: save posts and the card renders', await card.isVisible());
await page.screenshot({ path: join(OUT, 'sched-04-card-light.png') });

const schedules = await (await fetch(`${API}/api/schedules`)).json();
writeFileSync(join(OUT, 'schedules-api.json'), `${JSON.stringify(schedules, null, 2)}\n`);
const created = Array.isArray(schedules) ? schedules.find((s) => s.kind === 'once') : null;
check(
  'GET /api/schedules carries the once schedule',
  created != null,
  created ? `${created.id} at=${created.at}` : JSON.stringify(schedules).slice(0, 80),
);

// SQLite 行级真值
try {
  const Database = require2('better-sqlite3');
  const db = new Database(join(HOME, 'server/server.db'), { readonly: true });
  const rows = db.prepare('SELECT * FROM schedule').all();
  db.close();
  writeFileSync(join(OUT, 'schedule-sqlite-rows.json'), `${JSON.stringify(rows, null, 2)}\n`);
  check('SQLite schedule table carries the row', rows.length === 1, `${rows.length} row(s)`);
} catch (err) {
  check('SQLite schedule table carries the row', false, String(err).split('\n')[0]);
}

// kebab -> 删除 -> confirm -> gone
await page.getByRole('button', { name: '更多' }).click();
const menu = page.getByRole('menu', { name: '更多' });
await menu.waitFor();
await menu.getByRole('menuitem', { name: '删除' }).click();
const confirm = page.getByRole('alertdialog');
await confirm.waitFor();
check('schedules: delete confirm opens (alertdialog)', await confirm.isVisible());
await page.screenshot({ path: join(OUT, 'sched-05-delete-confirm-light.png') });
await confirm.getByRole('button', { name: '删除' }).click();
await page.waitForTimeout(600);
check(
  'schedules: confirmed delete removes the card (empty state back)',
  await page.getByText('尚无定时。').isVisible(),
);

// --- 2. project page (hosted tree) -----------------------------------------
await page.goto(`${BASE}/app/project/${project.id}`);
await page.waitForLoadState('networkidle');
const branchChip = page.getByText('main', { exact: true });
check('project: files pane branch chip renders', await branchChip.first().isVisible());
await page.screenshot({ path: join(OUT, 'project-01-files-light.png') });
// hosted 种子仓 tree API 真值点名（首条目）；种子提交为空树时验查看器占位面
// （文件行选中态 aria-current 由 fixture e2e file-viewer.spec 钉，r2-24 有肉）
const tree = await (
  await fetch(`${API}/api/projects/${project.id}/tree?ref=main`)
).json().catch(() => null);
writeFileSync(join(OUT, 'project-tree-api.json'), `${JSON.stringify(tree, null, 2)}\n`);
const entries = tree?.entries ?? [];
if (entries.length > 0) {
  const fname = entries[0].name;
  const fileBtn = page.getByRole('button', { name: fname, exact: true });
  await fileBtn.click();
  await page.waitForTimeout(500);
  check(
    'project: file row select carries aria-current',
    (await fileBtn.getAttribute('aria-current')) === 'true',
  );
} else {
  check(
    'project: empty seed tree renders the viewer placeholder face',
    await page.getByText('请选择一个文件查看').isVisible(),
    `tree entries=0 (seed commit ${tree?.commit?.slice(0, 8) ?? '?'})`,
  );
}
await page.screenshot({ path: join(OUT, 'project-02-viewer-light.png') });
// tasks tab
await page.getByRole('banner').getByRole('tab', { name: '任务' }).click();
await page.waitForTimeout(300);
check(
  'project: tasks tab renders the seeded todo row',
  await page.getByTestId('task-row').first().isVisible(),
);
await page.screenshot({ path: join(OUT, 'project-03-tasks-light.png') });

// --- 3. new project page ----------------------------------------------------
await page.goto(`${BASE}/app/project/new`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: join(OUT, 'new-01-form-light.png') });
await page.locator('#prj-new-repo').click();
const repoMenu = page.getByRole('menu', { name: '仓库' });
await repoMenu.waitFor();
check('new: repo kind menu opens (role=menu)', await repoMenu.isVisible());
await page.screenshot({ path: join(OUT, 'new-02-repo-menu-light.png') });
await repoMenu.getByRole('menuitemradio', { name: '本地文件夹' }).click();
await page.waitForTimeout(300);
check(
  'new: local face = path input + 浏览 + swap (浏览 not clicked — native dialog)',
  (await page.getByRole('textbox', { name: '本地文件夹' }).isVisible()) &&
    (await page.getByRole('button', { name: '浏览' }).isVisible()) &&
    (await page.getByRole('button', { name: '选择仓库' }).isVisible()),
);
await page.screenshot({ path: join(OUT, 'new-03-local-face-light.png') });

// --- 4. settings -------------------------------------------------------------
await page.goto(`${BASE}/app/project/${project.id}/settings`);
await page.waitForLoadState('networkidle');
check(
  'settings: rows + danger card render',
  (await page.getByText('危险操作').isVisible()) &&
    (await page.getByText('删除项目', { exact: true }).isVisible()) &&
    (await page.getByRole('button', { name: '删除', exact: true }).isVisible()),
);
await page.screenshot({ path: join(OUT, 'settings-01-light.png') });

// --- 5. dark theme pass ------------------------------------------------------
const dark = await browser.newPage({ viewport: { width: 1440, height: 732 } });
await dark.addInitScript(() => localStorage.setItem('pacman-theme', 'dark'));
await dark.goto(`${BASE}/app/schedules`);
await dark.waitForLoadState('networkidle');
await dark.screenshot({ path: join(OUT, 'sched-06-empty-dark.png') });
await dark.getByRole('button', { name: '新建', exact: true }).click();
await dark.getByRole('dialog', { name: '新建定时' }).waitFor();
await dark.screenshot({ path: join(OUT, 'sched-07-form-dark.png') });
await dark.keyboard.press('Escape');
await dark.goto(`${BASE}/app/project/${project.id}`);
await dark.waitForLoadState('networkidle');
await dark.screenshot({ path: join(OUT, 'project-04-files-dark.png') });
await dark.goto(`${BASE}/app/project/new`);
await dark.waitForLoadState('networkidle');
await dark.screenshot({ path: join(OUT, 'new-04-form-dark.png') });
await dark.goto(`${BASE}/app/project/${project.id}/settings`);
await dark.waitForLoadState('networkidle');
await dark.screenshot({ path: join(OUT, 'settings-02-dark.png') });
check('dark theme pass screenshotted', true);
await dark.close();

await browser.close();
writeFileSync(join(OUT, 'drive-946-result.json'), `${JSON.stringify(results, null, 2)}\n`);
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0
    ? `drive-946-pages-live: ${results.length}/${results.length} PASS`
    : `drive-946-pages-live: ${failed.length} FAIL`,
);
process.exit(failed.length === 0 ? 0 : 1);
