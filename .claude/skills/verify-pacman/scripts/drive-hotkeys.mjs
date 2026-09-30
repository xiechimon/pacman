#!/usr/bin/env node
// verify-pacman drive-hotkeys — 快捷键组全链真用户路径（#389 / #442 / #468）。
//
// 走真用户路径：侧栏「新任务」行（N 角标）点击开 dialog → Esc → N 热键开
// dialog → 填标题保存（board 面 live createTodo）→ FAB 的 ⌘J 悬浮提示
// （#468；XMON-14 起落在 components/ui 的 kbd 落点上）→ ⌘K 面板输入态负向
// （N 与 ⌘J 均不误触）→ ⌘J 呼出总管抽屉且焦点在草稿框（#442 起 ⌘J 取代
// Space）→ /app/schedules 非看板页 N 开全局 dialog 保存（AppSidebar 内面，
// live save 同路）。
//
// 真值：GET /api/todos 两行（board 面 + schedules 面各一）+ SQLite `todo`
// 表行。UI 面热键 + server 写路径，无需 daemon。
// 用法：node drive-hotkeys.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const REPO = process.env.VERIFY_REPO_ROOT ?? SCRIPT_REPO;
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(REPO, '.claude/verify-run');
const ports = existsSync(join(RUN_DIR, 'ports.json'))
  ? JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'))
  : {};
const SERVER = `http://127.0.0.1:${ports.serverPort ?? process.env.VERIFY_PORT ?? 8791}`;
const WEB = `http://127.0.0.1:${ports.webPort ?? process.env.VERIFY_WEB_PORT ?? 5273}`;
const DB_PATH = join(RUN_DIR, 'home/server/server.db');
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const EVIDENCE =
  process.env.VERIFY_EVIDENCE_DIR ?? join(SCRIPT_REPO, `.claude/verify-evidence/${ts}-hotkeys`);
mkdirSync(EVIDENCE, { recursive: true });

const require2 = createRequire(join(REPO, 'apps/server/package.json'));

const checks = [];
function check(name, ok, detail) {
  // 断言位必须真是 boolean（本文件与 drive.mjs 的参数序相反）——写反会恒真。
  if (typeof ok !== 'boolean') {
    throw new TypeError(`check(${JSON.stringify(name)}) 的 ok 位须为 boolean，收到 ${typeof ok}`);
  }
  checks.push({ name, ok, detail: detail ?? null });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}\n`);
}
const artifacts = [];
const shot = async (page, name) => {
  await page.screenshot({ path: join(EVIDENCE, name) });
  artifacts.push(name);
  process.stdout.write(`shot  ${name}\n`);
};

const getJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
};

const dbQuery = (fn) => {
  try {
    const Database = require2('better-sqlite3');
    const db = new Database(DB_PATH, { readonly: true });
    try {
      return { ok: true, ...fn(db) };
    } finally {
      db.close();
    }
  } catch (err) {
    return { ok: false, skipped: true, reason: String(err?.message ?? err) };
  }
};

/** 热键监听注册在被动 effect（hydration 后）——丢键重按，目标可见即停
 *  （e2e search-focus/hotkeys 同配方；open-only 热键重按幂等）。 */
async function pressUntil(page, key, selector) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.keyboard.press(key);
    const opened = await page
      .waitForSelector(selector, { state: 'visible', timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (opened) return;
  }
  throw new Error(`${key} never opened ${selector}`);
}

const stamp = Date.now() % 100000;
const titleBoard = `热键验证任务-board ${stamp}`;
const titleSched = `热键验证任务-sched ${stamp}`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 732 },
  colorScheme: 'dark',
});

try {
  await page.goto(`${WEB}/app`);
  await page.waitForSelector('[data-route="board"]', { timeout: 15_000 });
  check('board-ready', true, '看板 shell 就绪');

  // 1. 侧栏「新任务」行 + N 角标（上游 todos.dev 形态，sidebar-kbd 同款）
  const row = page.locator('.sidebar-row', { hasText: '新任务' });
  await row.waitFor({ state: 'visible', timeout: 8000 });
  const kbdText = await row.locator('.sidebar-kbd').textContent();
  check('sidebar-row-badge', kbdText?.trim() === 'N', `侧栏新任务行角标=${kbdText?.trim() ?? '无'}`);
  await shot(page, '01-sidebar-row.png');

  // 2. 行点击开 dialog → Esc 关
  await row.click();
  await page.waitForSelector('.new-task-dialog', { timeout: 5000 });
  check('row-click-opens', true, '行点击开 dialog');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.new-task-dialog', { state: 'hidden', timeout: 5000 });

  // 3. N 热键开 dialog（焦点落标题框，dialog 家族 autofocus 律）→ 保存
  await pressUntil(page, 'n', '.new-task-dialog');
  const titleFocused = await page.evaluate(
    () => document.activeElement?.classList.contains('new-task-spec') ?? false,
  );
  check('n-opens-focused', titleFocused, 'N 开 dialog 且正文框持焦（#394 单字段面）');
  // #394 单字段面：正文单行 = 占位标题派生源（首行截断律）
  await page.fill('.new-task-spec', titleBoard);
  await page.click('.new-task-save');
  await page.waitForSelector('.new-task-dialog', { state: 'hidden', timeout: 5000 });
  check('board-save', true, 'board 面 N 开 → 保存');
  await shot(page, '02-board-saved.png');

  // 3b. FAB 的 ⌘J 悬浮提示（#468）在 XMON-14 后由 components/ui 的 kbd 落点
  // 承载：registry 数据属性契约 + 静息隐藏 / 父控件悬浮浮出两条可见性律。
  const hint = page.locator('.chief-fab .kbd-hint');
  const hintCount = await hint.count();
  const hintSlot = hintCount > 0 ? await hint.first().getAttribute('data-slot') : null;
  const hintHiddenAtRest = hintCount > 0 ? !(await hint.first().isVisible()) : false;
  check(
    'kbd-hint-registry',
    hintCount === 1 && hintSlot === 'kbd' && hintHiddenAtRest,
    `⌘J 提示 n=${hintCount} data-slot=${hintSlot ?? '缺失'} 静息隐藏=${hintHiddenAtRest}`,
  );
  await page.locator('.chief-fab').hover();
  await hint
    .first()
    .waitFor({ state: 'visible', timeout: 3000 })
    .catch(() => {});
  const hintRevealed = hintCount > 0 && (await hint.first().isVisible());
  check('kbd-hint-hover-reveals', hintRevealed, `父控件悬浮浮出=${hintRevealed}`);
  await shot(page, '02b-kbd-hint.png');
  await page.mouse.move(0, 0);

  // 4. 输入态负向：⌘K 面板输入框持焦时 N / ⌘J 均不误触，字符照常入框
  await pressUntil(page, 'Meta+k', '.search-panel');
  const searchField = '.search-input-row input';
  await page.keyboard.press('n');
  await page.keyboard.press(' ');
  // ⌘J 的守卫同律：输入态吞键（#442 editable-only guard）
  await page.keyboard.press('Meta+j');
  const dialogCount = await page.locator('.new-task-dialog').count();
  const drawerCount = await page.locator('.chief-drawer').count();
  const typed = await page.inputValue(searchField);
  check(
    'editable-guard',
    dialogCount === 0 && drawerCount === 0 && typed === 'n ',
    `输入态:dialog=${dialogCount} drawer=${drawerCount} 入框=${JSON.stringify(typed)}`,
  );
  await page.keyboard.press('Escape');

  // 5. ⌘J 呼出总管抽屉，焦点在草稿框；Esc 关（#442 起 ⌘J 取代 Space）
  await pressUntil(page, 'Meta+j', '.chief-drawer');
  const composerFocused = await page.evaluate(
    () => document.activeElement?.classList.contains('chief-composer-input') ?? false,
  );
  check('cmdj-wakes-focused', composerFocused, '⌘J 开抽屉且草稿框持焦');
  await shot(page, '03-chief-drawer.png');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.chief-drawer', { state: 'hidden', timeout: 5000 });

  // 6. 非看板页（/app/schedules）N 开全局 dialog（AppSidebar 内面）→ 保存
  await page.goto(`${WEB}/app/schedules`);
  await page.waitForSelector('.page-shell', { timeout: 15_000 });
  await pressUntil(page, 'n', '.new-task-dialog');
  check('schedules-n-opens', page.url().includes('/app/schedules'), 'schedules 页原地开 dialog');
  await page.fill('.new-task-spec', titleSched);
  await page.click('.new-task-save');
  await page.waitForSelector('.new-task-dialog', { state: 'hidden', timeout: 5000 });
  await shot(page, '04-schedules-saved.png');

  // 真值 1：API 面两条任务（board 面 + schedules 全局面各一）
  const todos = await getJson(`${SERVER}/api/todos`);
  const apiBoard = Array.isArray(todos) ? todos.find((t) => t.title === titleBoard) : undefined;
  const apiSched = Array.isArray(todos) ? todos.find((t) => t.title === titleSched) : undefined;
  check('api-todo-board', apiBoard != null, `board 面 todo 入 API(id=${apiBoard?.id ?? '缺失'})`);
  check(
    'api-todo-schedules',
    apiSched != null,
    `schedules 全局面 todo 入 API(id=${apiSched?.id ?? '缺失'})`,
  );

  // 真值 2：SQLite 两行
  const dbTruth = dbQuery((db) => ({
    board: db.prepare('SELECT id, title FROM todo WHERE title = ?').get(titleBoard),
    sched: db.prepare('SELECT id, title FROM todo WHERE title = ?').get(titleSched),
  }));
  check('db-todo-board', dbTruth.board != null, 'SQLite todo 表有 board 面行');
  check('db-todo-schedules', dbTruth.sched != null, 'SQLite todo 表有 schedules 面行');
} finally {
  await browser.close();
}

const ok = checks.every((c) => c.ok);
const result = {
  probe: 'hotkeys',
  ok,
  at: new Date().toISOString(),
  stack: { api: SERVER, web: WEB, homeDir: join(RUN_DIR, 'home') },
  checks,
  artifacts,
  titles: { board: titleBoard, schedules: titleSched },
};
writeFileSync(join(EVIDENCE, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(
  `\nevidence: ${EVIDENCE}\nallOk=${ok}\n${ok ? 'drive hotkeys:PASS' : 'drive hotkeys:FAIL'}\n`,
);
process.exit(ok ? 0 : 1);
