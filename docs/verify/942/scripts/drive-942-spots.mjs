#!/usr/bin/env node
// verify-pacman drive-942-spots — #942 老 ui/ 原语退役正典表的抽查实装证据
// （spec/22 §5.6）。live 真用户路径：/app/resources/secrets 空态 → 添加密钥
// 弹层 → 正典载体实物（Input h-8 32px / Textarea registry 件方角 / Button
// brand / label utility + getByLabel 一级载体）→ 老类名消费清零 → 提交落库。
//
// 真值：computed style 实物（32px/0px/12px）+ data-slot/data-variant 件证据
// + 老类 token 清零扫描 + POST 后 API 掩码行 + SQLite secret 行。chip 面
// （StatusChip）live 无可达面（需在跑任务的 agent 详情），其证据走 fixture
// 探针 probe-942-fixture.mjs + agent-detail.spec e2e。
// 用法：node drive-942-spots.mjs（先 launch）

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
const WEB = `http://127.0.0.1:${ports.webPort ?? process.env.VERIFY_WEB_PORT ?? 5273}`;
const DB_PATH = join(RUN_DIR, 'home/server/server.db');
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const EVIDENCE =
  process.env.VERIFY_EVIDENCE_DIR ?? join(SCRIPT_REPO, `.claude/verify-evidence/${ts}-942-spots`);
mkdirSync(EVIDENCE, { recursive: true });

const require2 = createRequire(join(REPO, 'apps/server/package.json'));

const checks = [];
function check(name, ok, detail) {
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

/** dialog 子树里老类 token 清零扫描（classList 精确 token 匹配，非子串）。 */
const LEGACY_TOKENS = [
  'dlg-form',
  'dlg-form-foot',
  'dlg-form-label',
  'dlg-form-input',
  'dlg-form-textarea',
  'dlg-secret-note',
  'dlg-secret-create',
  'input',
];
const scanLegacy = (root) =>
  root.evaluate((el, tokens) => {
    const hits = [];
    for (const node of el.querySelectorAll('*')) {
      for (const t of tokens) {
        if (node.classList.contains(t)) hits.push(`${t}@${node.tagName}`);
      }
    }
    return hits;
  }, LEGACY_TOKENS);

/** 弹窗进场是 data-open zoom-in-95 + fade（transform scale 会污染 boundingBox
 *  实物测量）——测几何前等 transform 落定。 */
const waitSettled = async (locator) => {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const tf = await locator.evaluate((el) => getComputedStyle(el).transform);
    if (tf === 'none' || tf === 'matrix(1, 0, 0, 1, 0, 0)') return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('弹窗 transform 4s 未落定');
};

const stamp = Date.now() % 100000;
const SECRET_NAME = `STRIPE_API_KEY_${stamp}`;
const SECRET_VALUE = `sk-live-942-${stamp}`;
const extra = { secretName: SECRET_NAME };

const browser = await chromium.launch();

try {
  // —— 暗模轮：几何/载体/清零/行为 ——
  const page = await browser.newPage({
    viewport: { width: 1440, height: 732 },
    colorScheme: 'dark',
  });
  await page.goto(`${WEB}/app/resources/secrets`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.res-new', { timeout: 15_000 });
  check('secrets-live-ready', true, 'live 密钥页空态就绪（真用户路径起点）');

  await page.click('.res-new');
  const dialog = page.locator('.dlg');
  await dialog.waitFor({ state: 'visible', timeout: 5000 });
  await waitSettled(dialog);

  // 实物 1：Input 正典高 32px（spec/22 §2.6-1：36px 老族退役）+ registry 件证据
  const inputBox = await dialog.locator('#dlg-secret-name').boundingBox();
  const inputSlot = await dialog.locator('#dlg-secret-name').getAttribute('data-slot');
  check(
    'input-h8-32px',
    Math.round(inputBox?.height ?? -1) === 32 && inputSlot === 'input',
    `h=${inputBox ? Math.round(inputBox.height) : '缺失'}px data-slot=${inputSlot ?? '缺失'}（正典 h-8=32px）`,
  );

  // 实物 2：getByLabel 一级载体可用（htmlFor/id 语义资产在 shadcn 件上成立）
  const byLabel = dialog.getByLabel('名称（环境变量名）');
  const labelId = await byLabel.getAttribute('id');
  check(
    'label-carrier',
    (await byLabel.count()) === 1 && labelId === 'dlg-secret-name',
    `getByLabel 命中 id=${labelId ?? '缺失'}`,
  );

  // 实物 3：Textarea registry 件（data-slot + 方角 rounded-none + min-h-16）
  const ta = dialog.locator('[data-slot="textarea"]');
  const taRadius = await ta.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  const taBox = await ta.boundingBox();
  check(
    'textarea-canonical',
    (await ta.count()) === 1 && taRadius === '0px' && Math.round(taBox?.height ?? -1) >= 64,
    `n=1 radius=${taRadius} h=${taBox ? Math.round(taBox.height) : '缺失'}px（registry 默认 min-h-16）`,
  );

  // 实物 4：提交钮 = Button brand 档（§2.6-3 迁移位），32px，全宽
  const submit = dialog.getByRole('button', { name: '添加密钥' });
  const submitVariant = await submit.getAttribute('data-variant');
  const submitBox = await submit.boundingBox();
  const dialogBox = await dialog.boundingBox();
  check(
    'submit-brand-32px',
    submitVariant === 'brand' &&
      Math.round(submitBox?.height ?? -1) === 32 &&
      Math.abs((submitBox?.width ?? 0) - ((dialogBox?.width ?? 0) - 32)) <= 2,
    `data-variant=${submitVariant ?? '缺失'} h=${submitBox ? Math.round(submitBox.height) : '缺失'}px 全宽(面板 ${Math.round(dialogBox?.width ?? 0)}px − 2×16 padding)`,
  );

  // 实物 5：note 一级 text 载体 + 12px utility
  const note = dialog.getByText('值将加密存储');
  const noteSize = await note.evaluate((el) => getComputedStyle(el).fontSize);
  check('note-face', (await note.count()) === 1 && noteSize === '12px', `font-size=${noteSize}`);

  // 实物 6：老类 token 在 dialog 子树清零（含老 ui/input 的 .input 基类）
  const legacyHits = await scanLegacy(dialog);
  check('legacy-classes-zero', legacyHits.length === 0, `命中 ${legacyHits.length} 处${legacyHits.length ? `: ${legacyHits.join(', ')}` : ''}`);
  await shot(page, '01-secret-dialog-dark.png');

  // 行为语义：disabled → 经 getByLabel 载体填写 → enabled（e2e 同断言的 live 面）
  check('submit-disabled-empty', await submit.isDisabled(), '空表单提交钮失能');
  await byLabel.fill(SECRET_NAME);
  await dialog.getByLabel('值').fill(SECRET_VALUE);
  check('submit-enabled-filled', await submit.isEnabled(), '填写后提交钮启用');

  // 真值 1：live 提交 → POST secrets → 弹层关 + 掩码行上页
  await submit.click();
  await dialog.waitFor({ state: 'hidden', timeout: 8000 });
  const row = page.locator('.res-row-title', { hasText: SECRET_NAME });
  await row.waitFor({ state: 'visible', timeout: 8000 });
  check('row-visible-after-submit', true, `掩码行 ${SECRET_NAME} 可见（值只写不读）`);
  await shot(page, '02-secret-row-live.png');

  // 真值 2：API + SQLite
  const teams = await getJson(`${SERVER}/api/teams`);
  const teamId = Array.isArray(teams) ? (teams[0]?.id ?? null) : null;
  const secrets = teamId ? await getJson(`${SERVER}/api/teams/${teamId}/secrets`) : [];
  const apiRow = Array.isArray(secrets) ? secrets.find((s) => s.name === SECRET_NAME) : undefined;
  check('api-secret-row', apiRow != null, `GET /api/teams/${teamId}/secrets 命中 name=${SECRET_NAME}`);
  extra.apiSecretId = apiRow?.id ?? null;

  let dbRow = null;
  try {
    const Database = require2('better-sqlite3');
    const db = new Database(DB_PATH, { readonly: true });
    try {
      const table = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%secret%'")
        .all()
        .map((r) => r.name)[0];
      dbRow = table
        ? db.prepare(`SELECT * FROM "${table}" WHERE name = ?`).get(SECRET_NAME)
        : null;
      extra.secretTable = table ?? null;
    } finally {
      db.close();
    }
  } catch (err) {
    extra.dbError = String(err?.message ?? err);
  }
  check('db-secret-row', dbRow != null, `SQLite ${extra.secretTable ?? '?'} 表行存在`);
  const plaintextLeak = dbRow
    ? Object.values(dbRow).some((v) => typeof v === 'string' && v.includes(SECRET_VALUE))
    : true;
  check('db-no-plaintext-value', !plaintextLeak, '库内无明文值（值只写不读语义）');

  // —— 亮模轮：同一 dialog 双面截图（明暗双模证据）——
  const lightPage = await browser.newPage({
    viewport: { width: 1440, height: 732 },
    colorScheme: 'light',
  });
  await lightPage.addInitScript(() => localStorage.setItem('pacman-theme', 'light'));
  await lightPage.goto(`${WEB}/app/resources/secrets`, { waitUntil: 'networkidle' });
  await lightPage.waitForSelector('.res-new', { timeout: 15_000 });
  await lightPage.click('.res-new');
  const lightDialog = lightPage.locator('.dlg');
  await lightDialog.waitFor({ state: 'visible', timeout: 5000 });
  await waitSettled(lightDialog);
  const lightInputH = Math.round(
    (await lightDialog.locator('#dlg-secret-name').boundingBox())?.height ?? -1,
  );
  check('light-input-h8-32px', lightInputH === 32, `亮模 h=${lightInputH}px`);
  await shot(lightPage, '03-secret-dialog-light.png');
  await lightPage.close();
  await page.close();
} finally {
  await browser.close();
}

const ok = checks.every((c) => c.ok);
const result = {
  probe: '942-spots',
  ok,
  at: new Date().toISOString(),
  stack: { api: SERVER, web: WEB, homeDir: join(RUN_DIR, 'home') },
  checks,
  artifacts,
  ...extra,
};
writeFileSync(join(EVIDENCE, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(
  `\nevidence: ${EVIDENCE}\nallOk=${ok}\n${ok ? 'drive 942-spots:PASS' : 'drive 942-spots:FAIL'}\n`,
);
process.exit(ok ? 0 : 1);
