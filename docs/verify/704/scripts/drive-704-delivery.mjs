// #704 verify probe：真实构建后交付面三件套——「分支 / PR」meta（PR 回填）、
// changes 投影（daemon 上报真 diff）、项目页文件 tab 诚实降级 + GitHub 外链。
// 真值三面：HTTP API JSON + SQLite 行 + 截图；证据 = result.json + PNG。
// 用法：VERIFY_REPO_ROOT=<worktree> node drive-704-delivery.mjs <todoId>
//   env：VERIFY_EVIDENCE_DIR（缺省主仓 .claude/verify-evidence/<ts>-704-delivery）

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPO = process.env.VERIFY_REPO_ROOT ?? SCRIPT_REPO;
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(REPO, '.claude/verify-run');
const ports = existsSync(join(RUN_DIR, 'ports.json'))
  ? JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'))
  : {};
const SERVER = `http://127.0.0.1:${ports.serverPort ?? process.env.VERIFY_PORT ?? 8791}`;
const WEB = `http://127.0.0.1:${ports.web ?? process.env.VERIFY_WEB_PORT ?? 5273}`;
const todoId = process.argv[2];
if (!todoId) {
  process.stderr.write('usage: node drive-704-delivery.mjs <todoId>\n');
  process.exit(2);
}
const DB_PATH = join(RUN_DIR, 'home/server/server.db');
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const EVIDENCE =
  process.env.VERIFY_EVIDENCE_DIR ??
  join(SCRIPT_REPO, `.claude/verify-evidence/${ts}-704-delivery`);
mkdirSync(EVIDENCE, { recursive: true });

const require2 = createRequire(join(REPO, 'apps/server/package.json'));
const Database = require2('better-sqlite3');

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: detail ?? null });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}\n`);
}

async function jget(path) {
  const res = await fetch(`${SERVER}${path}`);
  return { status: res.status, body: await res.json() };
}

// —— API 真值（先于浏览器：build 行回填 + changes 投影）——
const todo = await jget(`/api/todos/${todoId}`);
const buildId = todo.body.latestBuildId;
const buildFace = await jget(`/api/builds/${buildId}`);
check('api-build-pr-backfilled', buildFace.body.prUrl !== null, `prUrl=${buildFace.body.prUrl}`);
check(
  'api-build-pr-number',
  typeof buildFace.body.prNumber === 'number',
  `prNumber=${buildFace.body.prNumber}`,
);
const changes = await jget(`/api/builds/${buildId}/changes`);
const fileNames = (changes.body.files ?? []).map((f) => f.path);
check(
  'api-changes-nonempty',
  (changes.body.files ?? []).length > 0,
  `files=${JSON.stringify(fileNames)} additions=${JSON.stringify((changes.body.files ?? []).map((f) => f.additions))}`,
);
const projFace = await jget('/api/projects');
const project = projFace.body.find((p) => p.repoKind === 'github');

// —— SQLite 行真值（build.changes / prUrl 落库）——
const db = new Database(DB_PATH, { readonly: true });
const buildRow = db
  .prepare('select prUrl, prNumber, changes from build where id = ?')
  .get(buildId);
// changes 列 = drizzle json 文本态；读面解析成 DocumentDiffFile[]。
const changesFiles =
  typeof buildRow?.changes === 'string'
    ? JSON.parse(buildRow.changes)
    : (buildRow?.changes ?? []);
writeFileSync(
  join(EVIDENCE, 'build-row.json'),
  JSON.stringify(
    {
      buildId,
      prUrl: buildRow?.prUrl ?? null,
      prNumber: buildRow?.prNumber ?? null,
      changes: changesFiles,
    },
    null,
    2,
  ),
);
check('db-build-pr-url', typeof buildRow?.prUrl === 'string' && buildRow.prUrl.length > 0, `prUrl=${buildRow?.prUrl}`);
check('db-build-changes-files', Array.isArray(changesFiles) && changesFiles.length > 0, `files=${JSON.stringify(changesFiles.map((f) => f.path))}`);
db.close();

// —— 浏览器真值（「分支与 PR」面板 Git tab PR 槽 + changes 面 + 文件 tab 降级）——
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
  await page.goto(`${WEB}/app/todo/${todoId}`, { waitUntil: 'networkidle' });

  // 详情页 changes 面（review 相位右栏）：daemon 上报的真 diff 文件行。
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(EVIDENCE, '11-todo-changes.png'), fullPage: true });
  const bodyText = await page.evaluate(() => document.body.innerText);
  check(
    'ui-changes-file-row',
    bodyText.includes('VERIFY.md') || fileNames.some((f) => bodyText.includes(f)),
    `pane contains changed file name (VERIFY.md)`,
  );

  // 「分支与 PR」面板（详情页右栏 section，#366 静止承接 r7 31 Git tab）：
  // 面板视图下拉切到「分支与 PR」→ PR 槽 = 回填真值（#1 链接）。
  await page.goto(`${WEB}/app/todo/${todoId}`, { waitUntil: 'networkidle' });
  await page.locator('.doc-pane-head .doc-pane-select').first().click();
  await page.waitForSelector('.plan-dropdown[role="listbox"]', { timeout: 5_000 });
  await page.locator('.plan-dropdown [role="option"]', { hasText: '分支与 PR' }).first().click();
  const prSlot = page.locator('.pane-section .dlg-pr-link');
  await prSlot.waitFor({ timeout: 10_000 });
  const prHref = await prSlot.getAttribute('href');
  const prText = (await prSlot.textContent())?.trim();
  check(
    'ui-branch-pane-pr-slot',
    typeof prHref === 'string' && prHref.includes('/pull/') && prText === `#${buildFace.body.prNumber}`,
    `slot=${prText} href=${prHref}`,
  );
  await page.screenshot({ path: join(EVIDENCE, '12-branch-pane-pr.png') });

  // 项目页文件 tab：github 形态诚实降级 + GitHub 外链（B-C1）。
  await page.goto(`${WEB}/app/project/${project.id}`, { waitUntil: 'networkidle' });
  const filesTab = page.locator('.prj-tabs button:has-text("文件"), [role="tab"]:has-text("文件")').first();
  if ((await filesTab.count()) > 0) await filesTab.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(EVIDENCE, '20-project-files-github.png'), fullPage: true });
  const filesText = await page.evaluate(() => document.body.innerText);
  check(
    'ui-files-github-degradation',
    filesText.includes('GitHub 仓库项目的文件在 GitHub 上查看'),
    '文件 tab 明示文件在 GitHub（无 404 静默）',
  );
  const ghLink = page.locator('.prj-files-github-link');
  check(
    'ui-files-github-link',
    (await ghLink.count()) === 1,
    `link=${await ghLink.first().getAttribute('href').catch(() => null)}`,
  );
  // tree 请求不再发出（gate 在 hosted 形态）——统计本页 404。
  const badResponses = [];
  page.on('response', (r) => {
    if (r.status() === 404) badResponses.push(r.url());
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check(
    'ui-files-no-404-noise',
    badResponses.filter((u) => u.includes('/tree') || u.includes('/file')).length === 0,
    `tree/file 404 = 0（console 刷屏闭环）`,
  );
} finally {
  await browser.close();
}

const result = {
  probe: '704-delivery-surface',
  stack: { server: SERVER, web: WEB, repo: REPO },
  checks,
  ok: checks.every((c) => c.ok),
};
writeFileSync(join(EVIDENCE, 'result.json'), JSON.stringify(result, null, 2));
process.stdout.write(
  `\n${result.ok ? 'ALL PASS' : 'HAS FAIL'} — ${checks.filter((c) => c.ok).length}/${checks.length}\nevidence: ${EVIDENCE}\n`,
);
process.exit(result.ok ? 0 : 1);
