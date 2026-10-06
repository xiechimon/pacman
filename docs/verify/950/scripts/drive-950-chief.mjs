#!/usr/bin/env node
// drive-950-chief — #950 chief 域 per-face 清零的 live 栈真用户路径证据。
//
// 覆盖（全走迁移后的 #910 载体：role/testid/aria，零旧类名）：
//   1. board FAB（aria-label 总管）开抽屉（role=dialog 总管）；
//   2. 抽屉头三钮 / gate 面 / composer（testid chief-composer-input）占位
//      空闲 canon；发送钮歇态/亮态双态底色（--seg-active → --card-button，
//      旧 .is-on 状态类退役后的条件 utility 机制实证）；
//   3. 齿轮进设置视图（heading 总管设置）：4 tab（role=tab）+ 滑动指示条
//      testid + transitionProperty 四元列表（#644 机制在 live 面成立）；
//   4. 章程 tab：空态卡 → 编辑 dialog（role=textbox）→ 填文保存 →
//      PATCH 落库 → GET /api/teams/:id/chief 回读 → SQLite chief 行级 pin
//      → 设置面实文呈现（真值三件套：截图 + API JSON + SQLite 行）；
//   5. Agent tab：未设置行钮 → 选择总管 dialog（placeholder 搜索 Agent…、
//      空态文案）；压缩模型 menu（dialog+listbox+默认行）；主力机 menu
//      （chief-host-auto 行）；
//   6. 双主题截图（dark/light 各面）。
//
// 依赖全新库：重验 = 重 launch。用法：
//   VERIFY_REPO_ROOT=<worktree> node docs/verify/950/scripts/drive-950-chief.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const REPO = process.env.VERIFY_REPO_ROOT ?? SCRIPT_REPO;
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(REPO, '.claude/verify-run');
const portsFile = join(RUN_DIR, 'ports.json');
if (!existsSync(portsFile)) {
  process.stderr.write('无栈：' + portsFile + ' 不存在或损坏。先跑 launch.mjs\n');
  process.exit(1);
}
const stack = JSON.parse(readFileSync(portsFile, 'utf8'));
const SERVER = 'http://127.0.0.1:' + (stack.serverPort ?? process.env.VERIFY_PORT ?? 8791);
const WEB = 'http://127.0.0.1:' + (stack.webPort ?? process.env.VERIFY_WEB_PORT ?? 5273);
const HOME_DIR = stack.homeDir ?? join(RUN_DIR, 'home');
const DB_PATH = join(HOME_DIR, 'server', 'server.db');
const require2 = createRequire(join(REPO, 'apps/server/package.json'));
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const EVIDENCE =
  process.env.VERIFY_EVIDENCE_DIR ?? join(REPO, '.claude/verify-evidence/' + ts + '-950-chief');
mkdirSync(EVIDENCE, { recursive: true });

const checks = [];
function check(name, ok, detail) {
  if (typeof ok !== 'boolean') {
    throw new TypeError('check(' + JSON.stringify(name) + ') 的 ok 位须为 boolean');
  }
  checks.push({ name, ok, detail: detail ?? null });
  process.stdout.write((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : '') + '\n');
}
const artifacts = [];
async function shot(page, name) {
  await page.screenshot({ path: join(EVIDENCE, name) });
  artifacts.push(name);
  process.stdout.write('shot  ' + name + '\n');
}
async function saveJson(name, data) {
  writeFileSync(join(EVIDENCE, name), JSON.stringify(data, null, 2));
  artifacts.push(name);
  process.stdout.write('json  ' + name + '\n');
}
async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('GET ' + url + ' → ' + res.status);
  return res.json();
}
function dbRead(fn) {
  const Database = require2('better-sqlite3');
  const db = new Database(DB_PATH, { readonly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

const CHARTER = '模型路由：轻活走 qwen，重活走 kimi。';

const session = await getJson(SERVER + '/api/auth/session');
check('live 栈 session = seed Owner', session?.displayName === 'Owner', session?.displayName);
const teams = await getJson(SERVER + '/api/teams');
const teamId = teams[0]?.id;
check('teams 读面非空', typeof teamId === 'string' && teamId.length > 0, teamId);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 732 } });
await context.addInitScript(() => localStorage.setItem('pacman-theme', 'dark'));
const page = await context.newPage();

try {
  // —— 1/2. FAB 开抽屉 + 头部/gate/composer 载体面（dark）——
  await page.goto(WEB + '/app');
  const fab = page.getByRole('button', { name: '总管', exact: true });
  await fab.waitFor({ state: 'visible', timeout: 15000 });
  await fab.click();
  const drawer = page.getByRole('dialog', { name: '总管' });
  await drawer.waitFor({ state: 'visible', timeout: 8000 });
  check('FAB(role+aria-label) 开抽屉(role=dialog 总管)', true);
  await drawer.getByTestId('chief-body').waitFor({ state: 'visible', timeout: 5000 });
  check('抽屉体 testid chief-body 在位', true);
  for (const name of ['新主题', '总管设置', '关闭']) {
    const visible = await drawer.getByRole('button', { name, exact: true }).isVisible();
    check(`头部钮 aria-label=${name}`, visible);
  }
  const gateCopy = '请先为总管选择一个 Agent。';
  check('未绑定 gate 文案（live 全新库）', await drawer.getByText(gateCopy).isVisible());
  const composer = page.getByTestId('chief-composer-input');
  check('composer testid 载体在位', await composer.isVisible());
  check(
    'composer 占位 = 空闲 canon',
    (await composer.getAttribute('placeholder')) === '有什么可以帮你的？',
  );
  await shot(page, '01-drawer-dark.png');

  // 发送钮双态：歇态 seg-active → 有草稿 card-button（旧 .is-on 类退役后的
  // 条件 utility 机制）。dark 正典值：--seg-active #3f3c36 / --card-button #d89cfc。
  const send = drawer.getByRole('button', { name: '发送' });
  const sendBgIdle = await send.evaluate((el) => getComputedStyle(el).backgroundColor);
  check('发送钮歇态底 = --seg-active(dark #3f3c36)', sendBgIdle === 'rgb(63, 60, 54)', sendBgIdle);
  await composer.fill('证据');
  // 亮态是 React 状态（wire.draft）驱动的条件 utility——轮询等重渲落定，
  // 不在 fill 返回帧上抢读。
  const sendOn = await page
    .waitForFunction(
      () => {
        const btn = document.querySelector('[aria-label="发送"]');
        return btn != null && getComputedStyle(btn).backgroundColor === 'rgb(216, 156, 252)';
      },
      null,
      { timeout: 5000 },
    )
    .then(
      () => true,
      () => false,
    );
  const sendBgOn = await send.evaluate((el) => getComputedStyle(el).backgroundColor);
  check('发送钮亮态底 = --card-button(dark #d89cfc)', sendOn && sendBgOn === 'rgb(216, 156, 252)', sendBgOn);
  await composer.fill('');

  // —— 3. 设置视图 + tab 载体 + 指示条机制 ——
  await drawer.getByRole('button', { name: '总管设置', exact: true }).click();
  const setHead = page.getByRole('heading', { name: '总管设置' });
  await setHead.waitFor({ state: 'visible', timeout: 8000 });
  check('设置视图载体 = heading 总管设置', true);
  const tabs = page.getByRole('tab');
  check('tab 数 = 4', (await tabs.count()) === 4);
  const indicator = page.getByTestId('chief-tab-indicator');
  check('指示条 testid 在位', await indicator.isVisible());
  const transProp = await indicator.evaluate((el) => getComputedStyle(el).transitionProperty);
  check('指示条 transitionProperty 四元', transProp === 'left, top, width, height', transProp);
  await shot(page, '02-settings-agent-dark.png');

  // —— 4. 章程 tab：空态 → 编辑 → 保存 → API/SQLite 双回读 → 实文呈现 ——
  await page.getByRole('tab', { name: '章程' }).click();
  check('章程空态卡文案', await page.getByText('尚无章程。点击编辑，为总管添加常设指示。').isVisible());
  await page.getByRole('button', { name: '编辑' }).click();
  const charterDlg = page.getByRole('dialog', { name: '编辑章程' });
  await charterDlg.waitFor({ state: 'visible', timeout: 8000 });
  const textbox = charterDlg.getByRole('textbox');
  check('charter 载体 = dialog scope role=textbox', await textbox.isVisible());
  await shot(page, '03-charter-dialog-dark.png');
  await textbox.fill(CHARTER);
  await charterDlg.getByRole('button', { name: '保存章程' }).click();
  await charterDlg.waitFor({ state: 'hidden', timeout: 8000 });
  check('保存即关（accept 律 live 面：PATCH onSuccess 关窗）', true);
  const chiefEnv = await getJson(`${SERVER}/api/teams/${teamId}/chief`);
  const apiCharter = chiefEnv?.chief?.charter;
  check('API 回读 chief.charter == 保存文', apiCharter === CHARTER, JSON.stringify(apiCharter));
  const dbRows = dbRead((db) => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);
    const table = tables.includes('chief') ? 'chief' : tables.find((t) => t.startsWith('chief'));
    const rows = table ? db.prepare(`SELECT * FROM "${table}"`).all() : [];
    return { tables, table, rows };
  });
  const dbCharter = dbRows.rows.flatMap((r) => Object.values(r)).includes(CHARTER);
  check('SQLite chief 行含保存文', dbCharter === true, 'table=' + dbRows.table);
  check('设置面呈现章程实文', await page.getByText('模型路由：轻活走 qwen').isVisible());
  await shot(page, '04-charter-saved-dark.png');
  await saveJson('chief-envelope.json', chiefEnv);
  await saveJson('sqlite-chief.json', dbRows);

  // —— 5. Agent tab：行钮 / agent dialog / 两 menu ——
  await page.getByRole('tab', { name: 'Agent' }).click();
  const agentRow = page.getByRole('button', { name: '未设置' });
  check('agent 行钮（未设置）在位', await agentRow.isVisible());
  await agentRow.click();
  const agentDlg = page.getByRole('dialog', { name: '选择总管 Agent' });
  await agentDlg.waitFor({ state: 'visible', timeout: 8000 });
  check('agent dialog 搜索占位', await agentDlg.getByPlaceholder('搜索 Agent…').isVisible());
  check('agent dialog 空态（全新库无 agent）', await agentDlg.getByText('没有匹配的 Agent').isVisible());
  await agentDlg.getByRole('button', { name: '关闭' }).click();
  await agentDlg.waitFor({ state: 'hidden', timeout: 8000 });

  await page.getByRole('button', { name: '压缩模型' }).click();
  const modelMenu = page.getByRole('dialog', { name: '压缩模型' });
  await modelMenu.waitFor({ state: 'visible', timeout: 8000 });
  const modelOpts = modelMenu.getByRole('option');
  check('压缩模型 menu：listbox 默认行在位', (await modelOpts.count()) >= 1);
  check('默认行文案', await modelOpts.nth(0).getByText('默认（与 Chief 相同）').isVisible());
  await shot(page, '05-model-menu-dark.png');
  await page.keyboard.press('Escape');
  await modelMenu.waitFor({ state: 'hidden', timeout: 8000 });

  await page.getByRole('button', { name: '机器' }).click();
  const machineMenu = page.getByRole('dialog', { name: '机器' });
  await machineMenu.waitFor({ state: 'visible', timeout: 8000 });
  check('主力机 menu：自动行 testid', await machineMenu.getByTestId('chief-host-auto').isVisible());
  await shot(page, '06-machine-menu-dark.png');
  await page.keyboard.press('Escape');
  await machineMenu.waitFor({ state: 'hidden', timeout: 8000 });

  // —— 6. light 主题复走关键面 ——
  await page.evaluate(() => localStorage.setItem('pacman-theme', 'light'));
  await page.reload();
  await page.getByRole('button', { name: '总管', exact: true }).click();
  const drawerL = page.getByRole('dialog', { name: '总管' });
  await drawerL.waitFor({ state: 'visible', timeout: 8000 });
  check('light：FAB 开抽屉', true);
  await shot(page, '07-drawer-light.png');
  await drawerL.getByRole('button', { name: '总管设置', exact: true }).click();
  await page.getByRole('heading', { name: '总管设置' }).waitFor({ state: 'visible', timeout: 8000 });
  await shot(page, '08-settings-light.png');
  await page.getByRole('tab', { name: '章程' }).click();
  check('light：章程实文仍呈现', await page.getByText('模型路由：轻活走 qwen').isVisible());
  await shot(page, '09-charter-light.png');
} finally {
  await browser.close();
}

const ok = checks.every((c) => c.ok);
const result = {
  probe: 'drive-950-chief',
  ticket: 950,
  ts,
  stack: { server: SERVER, web: WEB, home: HOME_DIR, db: DB_PATH, repo: REPO },
  checks,
  artifacts,
  ok,
};
writeFileSync(join(EVIDENCE, 'result.json'), JSON.stringify(result, null, 2) + '\n');
process.stdout.write(
  '\n' +
    (ok
      ? 'drive-950-chief:ALL PASS(' + checks.length + ' 项) → ' + EVIDENCE
      : 'drive-950-chief:FAIL(' + checks.filter((c) => !c.ok).length + ' 项) → ' + EVIDENCE) +
    '\n',
);
process.exit(ok ? 0 : 1);
