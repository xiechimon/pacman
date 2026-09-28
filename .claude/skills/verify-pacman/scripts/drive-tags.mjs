#!/usr/bin/env node
// verify-pacman drive-tags — 标签全链真用户路径（#309/#323，r9 §3.4）。
//
// 走真用户路径：看板「新建任务」→ 对话框 footer 虚线圆钮开标签面板 → 内联
// 新建一个标签（建后自动选中）→ 关面板 → 保存任务 → 详情页 meta 区出 chip。
//
// 真值：POST /api/projects/{id}/tags 建行 / GET /api/todos/{id} 的 tagIds 含新
// tag / SQLite `tag` 行 + `todo_tag` 联结行 / 详情 `.fresh-tag-chip` 文本。
// 负向（#309 AC 校准，r9 §3.4 实测）：**看板卡不渲染标签**——`.todo-card` 内
// 不应出现 tag chip，别按直觉断言卡面有标签。
//
// 标签是 UI + server 写路径，无需 daemon。无项目时新建标签会先触发「默认项目」
// 自动创建（同 board-new-task 的无项目路径）。
// 用法：node drive-tags.mjs

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
  process.env.VERIFY_EVIDENCE_DIR ?? join(SCRIPT_REPO, `.claude/verify-evidence/${ts}-tags`);
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

const extra = {};
const stamp = Date.now() % 100000;
const tagName = `验证标签-${stamp}`;
const title = `标签验证任务 ${stamp}`;
extra.tagName = tagName;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 732 },
  colorScheme: 'dark',
});

try {
  await page.goto(`${WEB}/app`);
  await page.waitForSelector('[data-route="board"]', { timeout: 15_000 });
  check('board-ready', true, '看板 shell 就绪');
  await page.click('.board-new-task');
  await page.waitForSelector('.new-task-dialog', { timeout: 5000 });
  await page.fill('.new-task-input', title);
  check('dialog-open', true, '新建任务 dialog 打开且标题已填');

  // 开标签面板 → 内联新建
  await page.click('.new-task-tag-add');
  await page.waitForSelector('.new-task-tag-panel', { timeout: 5000 });
  check('tag-panel-open', true, '虚线圆钮开标签面板');
  await shot(page, '01-tag-panel.png');

  await page.click('.new-task-tag-new');
  await page.waitForSelector('.new-task-tag-form', { timeout: 5000 });
  await page.fill('.new-task-tag-input', tagName);
  await page.click('.new-task-tag-save');
  // 建后自动选中：面板里出现同名 pill 且 data-on=true
  await page
    .waitForFunction(
      (name) =>
        [...document.querySelectorAll('.new-task-tag-pill')].some(
          (el) => el.textContent?.trim() === name && el.getAttribute('data-on') === 'true',
        ),
      tagName,
      { timeout: 10_000 },
    )
    .catch(() => {});
  const pillState = await page.evaluate(
    (name) =>
      [...document.querySelectorAll('.new-task-tag-pill')]
        .filter((el) => el.textContent?.trim() === name)
        .map((el) => el.getAttribute('data-on'))[0] ?? null,
    tagName,
  );
  check('tag-created-selected', pillState === 'true', `内联新建后自动选中(data-on=${pillState ?? '无 pill'})`);
  await shot(page, '02-tag-selected.png');

  // 关面板 → 保存任务
  await page.click('.new-task-tag-panel .dlg-close');
  await page.waitForSelector('.new-task-tag-panel', { state: 'hidden', timeout: 5000 });
  await page.click('.new-task-save');
  await page.waitForSelector('.new-task-dialog', { state: 'hidden', timeout: 5000 });
  check('task-saved', true, '关面板后保存任务，dialog 关闭');
  await shot(page, '03-card-saved.png');

  // 真值 1：API 面 tag 建行 + todo.tagIds 含它
  const todos = await getJson(`${SERVER}/api/todos`);
  const apiTodo = Array.isArray(todos) ? todos.find((t) => t.title === title) : undefined;
  const projects = await getJson(`${SERVER}/api/projects`);
  const projectId = Array.isArray(projects) ? (projects[0]?.id ?? null) : null;
  const tags = projectId ? await getJson(`${SERVER}/api/projects/${projectId}/tags`) : [];
  const apiTag = Array.isArray(tags) ? tags.find((t) => t.name === tagName) : undefined;
  check('api-tag-row', apiTag != null, `POST tags 建行(name=${apiTag?.name ?? '缺失'}, color=${apiTag?.color ?? '?'})`);
  check(
    'api-todo-tagids',
    Array.isArray(apiTodo?.tagIds) && apiTag != null && apiTodo.tagIds.includes(apiTag.id),
    `todo.tagIds 含新 tag(${Array.isArray(apiTodo?.tagIds) ? apiTodo.tagIds.length : '?'} 个)`,
  );
  extra.tagId = apiTag?.id ?? null;
  extra.todoId = apiTodo?.id ?? null;

  // 真值 2：SQLite tag 行 + todo_tag 联结行
  const dbTruth = dbQuery((db) => ({
    tag: db.prepare('SELECT id, name, color FROM tag WHERE name = ?').get(tagName),
    join: apiTodo?.id
      ? db.prepare('SELECT COUNT(*) AS n FROM todo_tag WHERE todoId = ?').get(apiTodo.id)
      : null,
  }));
  check('db-tag-row', dbTruth.tag != null, `SQLite tag 表有行(color=${dbTruth.tag?.color ?? '?'})`);
  check('db-todo-tag-join', (dbTruth.join?.n ?? 0) >= 1, `todo_tag 联结行(${dbTruth.join?.n ?? '?'} 行)`);

  // 真值 3：详情页 meta 区 chip + 负向（看板卡不渲染标签）
  await page.goto(`${WEB}/app/todo/${apiTodo?.id ?? ''}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.composer, .fresh-block', { timeout: 15_000 });
  const chipTexts = await page.locator('.fresh-tag-chip').allTextContents();
  check(
    'detail-meta-chip',
    chipTexts.some((t) => t.trim() === tagName),
    `详情 fresh meta 区出 chip(${chipTexts.join('/') || '无'})`,
  );
  await shot(page, '04-detail-chip.png');

  await page.goto(`${WEB}/app`);
  await page.waitForSelector('[data-route="board"]', { timeout: 15_000 });
  const cardHasChip = await page
    .locator('[data-column-list="todo"] .todo-card', { hasText: title })
    .locator('[class*="tag-chip"]')
    .count();
  check('board-card-no-chip', cardHasChip === 0, `看板卡不渲染标签(#309 AC 校准，命中 ${cardHasChip} 个)`);
} finally {
  await browser.close();
}

const ok = checks.every((c) => c.ok);
const result = {
  probe: 'tags',
  ok,
  at: new Date().toISOString(),
  stack: { api: SERVER, web: WEB, homeDir: join(RUN_DIR, 'home') },
  checks,
  artifacts,
  ...extra,
};
writeFileSync(join(EVIDENCE, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(
  `\nevidence: ${EVIDENCE}\nallOk=${ok}\n${ok ? 'drive tags:PASS' : 'drive tags:FAIL'}\n`,
);
process.exit(ok ? 0 : 1);