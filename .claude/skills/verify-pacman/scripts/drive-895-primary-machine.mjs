#!/usr/bin/env node
// verify-pacman drive-895-primary-machine — 单机编排默认策略（#895，spec 21
// §验收口径 4）live 闭环：主力机一条链。
//
// 真用户路径：抽屉齿轮进总管设置 → Agent tab「机器」槽选定主力机（live 写 =
// PATCH /chief machineId 槽）→ 抽屉新主题（POST /chief/threads 走缺省链）→
// machines 页「总管主机」徽标（截图）→ 主力机离线 →「总管等待机器」标注
// （截图）→ 超宽限后 chief 回合失败、错误行点名机器 + 新出口文案（会话 API
// JSON + 抽屉失败行截图）→ 失败后 machines 页等待标注消失（计数回零）。
//
// 铺底全走公开 REST（drive-agent-identity 铺底律，非被测路径）：provider +
// agent + PATCH chief 绑定 + api-key + 双机 enroll（主力机 + 他机）。他机
// claim 空手 = 缺省链钉选的 REST 真值（别机领不走 pending chief 步）。
// 机器在线位与步龄直写 DB（生产置位路径 = presence SSE / 真实时间流逝，
// 单测同律的直插手法）。
// 依赖全新库：重验 = 重 launch。
// 用法：VERIFY_REPO_ROOT=<worktree> node drive-895-primary-machine.mjs

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
  process.env.VERIFY_EVIDENCE_DIR ?? join(SCRIPT_REPO, '.claude/verify-evidence/' + ts + '-895-primary-machine');
mkdirSync(EVIDENCE, { recursive: true });

const checks = [];
function check(name, ok, detail) {
  if (typeof ok !== 'boolean') {
    throw new TypeError('check(' + JSON.stringify(name) + ') 的 ok 位须为 boolean，收到 ' + typeof ok);
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
async function sendJson(url, body, method, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const res = await fetch(url, {
    method: method ?? 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

/** SQLite 直写（placement 手法：机器在线位 / 步龄——生产置位路径是 presence
 *  SSE 与真实时间，测试直插同律）。WAL 下 server 即读即见。 */
function dbWrite(fn) {
  const Database = require2('better-sqlite3');
  const db = new Database(DB_PATH);
  try {
    return fn(db);
  } finally {
    db.close();
  }
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

const PRIMARY_NAME = 'verify-mbp-895';
const OTHER_NAME = 'verify-mini-895';
const GRACE_MIN = 10;

// —— 铺底（全 REST，非被测路径）—————————————————————————————
const teams = await getJson(SERVER + '/api/teams');
const teamId = teams[0]?.id;
if (!teamId) throw new Error('无 team——先重 launch（全新库 seed）');

const prov = await sendJson(SERVER + '/api/teams/' + teamId + '/providers', {
  providerId: 'stub-gw',
  label: 'Stub Gateway',
  baseUrl: 'http://127.0.0.1:9/v1',
  api: 'openai-completions',
  authHeader: true,
  compat: { supportsDeveloperRole: false },
  models: [{ id: 'stub-model', name: 'stub-model' }],
});
if (![200, 201, 409].includes(prov.status)) throw new Error('provider → ' + prov.status);

const agent = await sendJson(SERVER + '/api/teams/' + teamId + '/agents', {
  displayName: '验证员 Prime',
  provider: 'stub-gw',
  modelId: 'stub-model',
});
if (![200, 201].includes(agent.status)) throw new Error('agent → ' + agent.status + ' ' + JSON.stringify(agent.body));
const AGENT_ID = agent.body?.id ?? agent.body?.agentId ?? agent.body?.record?.id;
if (!AGENT_ID) throw new Error('agent 无 id：' + JSON.stringify(agent.body));

const bind = await sendJson(
  SERVER + '/api/teams/' + teamId + '/chief',
  { agent: { agentId: AGENT_ID, thinkingLevel: null } },
  'PATCH',
);
if (bind.status !== 200) throw new Error('chief bind → ' + bind.status + ' ' + JSON.stringify(bind.body));

async function issueKey(name) {
  const key = await sendJson(SERVER + '/api/teams/' + teamId + '/api-keys', {
    name,
    gitAccess: false,
    mcpAccess: false,
    toolGrants: { read: [], write: [] },
  });
  const keyPlain = key.body?.plaintext ?? key.body?.record?.plaintext ?? key.body?.token;
  if (!keyPlain) throw new Error('api-key 无 plaintext：' + JSON.stringify(key.body));
  return keyPlain;
}
// 双机各持各的 key：enrollment 按 key/team 认机器（schema 注释律）——同 key
// 重注册 = 复用同一 machine 行（首次实跑踩中：第二台顶掉第一台的行）。
const primary = { token: null, name: PRIMARY_NAME };
const other = { token: null, name: OTHER_NAME };

async function enroll(name, keyPlain) {
  const res = await sendJson(SERVER + '/api/machine/enroll', { teamId, name, cliVersion: '0.1.0' }, 'POST', keyPlain);
  const token = res.body?.token ?? res.body?.machine?.token;
  if (res.status !== 200 || !token) throw new Error('enroll ' + name + ' → ' + res.status);
  return { token, name };
}
primary.token = (await enroll(PRIMARY_NAME, await issueKey('prime-probe-primary'))).token;
other.token = (await enroll(OTHER_NAME, await issueKey('prime-probe-other'))).token;
const machineRows = await getJson(SERVER + '/api/teams/' + teamId + '/machines');
const primaryId = machineRows.find((m) => m.name === PRIMARY_NAME)?.id;
const otherId = machineRows.find((m) => m.name === OTHER_NAME)?.id;
if (!primaryId || !otherId) throw new Error('机器行缺失：' + JSON.stringify(machineRows.map((m) => m.name)));

// 回归红线基态：未设主力机 → 封套 machineId null + orchestration 空态。
const envBefore = await getJson(SERVER + '/api/teams/' + teamId + '/chief');
check(
  'S1 基态：未设主力机 → chief.machineId null + orchestration {defaultMachineId: null, activity: []}',
  envBefore.chief?.machineId == null &&
    envBefore.orchestration?.defaultMachineId === null &&
    Array.isArray(envBefore.orchestration?.activity) &&
    envBefore.orchestration.activity.length === 0,
);

// —— 浏览器面（live 模式，无 scenario）————————————————————————
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
await page.route('**/api.dicebear.com/**', (route) =>
  route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#888"/></svg>',
  }),
);

// N1 真用户路径设主力机：抽屉齿轮 → 设置 Agent tab「机器」槽选主力机。
// #950 载体迁移：chief per-face 类钩退役——FAB = button[aria-label="总管"]、
// 设置视图 = h1「总管设置」、机器槽触发钮 = button[aria-label="机器"]、菜单 =
// [role="dialog"][aria-label="机器"]（行 = role=option，「自动」行含在内；
// data-testid="chief-host-row" 只数机器行）。
await page.goto(WEB + '/app');
await page.locator('button[aria-label="总管"]').click();
await page.locator('.chief-drawer').waitFor({ state: 'visible', timeout: 8000 });
await page.locator('button[aria-label="总管设置"]').click();
await page.locator('h1:text-is("总管设置")').waitFor({ state: 'visible', timeout: 8000 });
const chip = page.locator('button[aria-label="机器"]');
await chip.waitFor({ state: 'visible', timeout: 8000 });
check('N1 设置 Agent tab「机器」槽在位（值 = 自动）', (await chip.textContent()).includes('自动'));
await chip.click();
const menu = page.locator('[role="dialog"][aria-label="机器"]');
await menu.waitFor({ state: 'visible', timeout: 8000 });
const row = menu.locator('[data-testid="chief-host-row"]').filter({ hasText: PRIMARY_NAME });
// 机器行集是异步查询（useMachines）——先等主力机行落定再数总数，别在查询
// 未决时数出 1/2 行的加载态。
await row.waitFor({ state: 'visible', timeout: 8000 });
const rowCount = await menu.locator('[role="option"]').count();
check(
  'N2 机器清单含双机行（自动 + server 本机 + 双机 = 4 行）',
  rowCount === 4,
  'rows=' + rowCount,
);
await shot(page, '01-settings-machine-slot.png');
await row.click();
await menu.waitFor({ state: 'hidden', timeout: 8000 });
// mutation 后 invalidateAll 重取回显（S8：无本地乐观态，等真值落定）。
await page
  .locator('button[aria-label="机器"]')
  .filter({ hasText: PRIMARY_NAME })
  .waitFor({ timeout: 8000 });
check('N3 选定后 chip 回显机器名（PATCH → invalidateAll 重取）', true);

// N4 REST 回读（回读确认，spec 验收 4 第 1 步）。
const envAfter = await getJson(SERVER + '/api/teams/' + teamId + '/chief');
check(
  'N4 PATCH 回读：chief.machineId + orchestration.defaultMachineId = 主力机',
  envAfter.chief?.machineId === primaryId && envAfter.orchestration?.defaultMachineId === primaryId,
  'primaryId=' + primaryId,
);
await saveJson('chief-envelope-after-patch.json', envAfter);

// N5 抽屉新主题（真用户路径：返回抽屉 → composer 发新主题）。
await page.locator('button[aria-label="返回"]').click();
await page.locator('.chief-drawer').waitFor({ state: 'visible', timeout: 8000 });
const composer = page.locator('[data-testid="chief-composer-input"]');
await composer.waitFor({ timeout: 8000 });
await composer.fill('主力机链路验证：编排回合请求');
await page.keyboard.press('Enter');
await page.locator('[data-testid="chief-stream"] [data-testid="chief-msg"]').first().waitFor({ timeout: 8000 });

// N6 行级真值：chief_thread.pinnedMachineId 落主力机（缺省链第二级接管）。
// SQLite 列名 = drizzle 定义的 camelCase（epochMs('createdAt') 等），SQL 里
// 加引号引用。
const threadId = await dbRead((db) => {
  const row = db
    .prepare('SELECT id, pinnedMachineId FROM chief_thread ORDER BY "createdAt" DESC LIMIT 1')
    .get();
  return row?.id;
});
const pinRow = await dbRead((db) =>
  db.prepare('SELECT id, pinnedMachineId FROM chief_thread WHERE id = ?').get(threadId),
);
check(
  'N6 SQLite 行级：chief_thread.pinnedMachineId 落主力机',
  pinRow?.pinnedMachineId === primaryId,
  'thread=' + threadId + ' pin=' + pinRow?.pinnedMachineId,
);

// N7 他机 claim 空手（钉选过滤的 REST 真值：步留 pending 等主力机）。claim 是
// 长轮询（空手 ~75s hold + wake 重试后才返回 null），走生产节奏等满——别用
// 8s 短超时把合法等待误判成网络错。
const claimRes = await fetch(SERVER + '/api/machine/tasks/claim', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + other.token },
  body: '{}',
  signal: AbortSignal.timeout(100_000),
});
const claimBody = await claimRes.json();
check('N7 他机 claim 空手（step null）', claimBody?.step == null, JSON.stringify(claimBody?.step ?? null));

// N8 machines 页「总管主机」徽标。
await page.goto(WEB + '/app/resources/machines');
// #944 载体迁移：.res-grow → div[data-machine-id]（div 元素名限定防串——
// shell 开关元素也带 data-machine-id）；.res-dot → [data-on]（状态载体属性值不变）。
const primaryRow = page.locator('div[data-machine-id="' + primaryId + '"]');
await primaryRow.waitFor({ state: 'visible', timeout: 8000 });
const hostBadge = primaryRow.locator('[data-orchestration="host"]');
check('N8 machines 页主力机行带「总管主机」徽标', (await hostBadge.textContent()) === '总管主机');
await shot(page, '02-machines-host-badge.png');
const envRunning = await getJson(SERVER + '/api/teams/' + teamId + '/chief');
await saveJson('chief-envelope-host-badge.json', envRunning);

// N9 主力机离线 → 等待标注（API 真值 + 截图）。
dbWrite((db) => db.prepare('UPDATE machine SET online = 0 WHERE id = ?').run(primaryId));
const envWaiting = await getJson(SERVER + '/api/teams/' + teamId + '/chief');
const waitingEntry = envWaiting.orchestration?.activity?.find((a) => a.machineId === primaryId);
check(
  'N9 主力机离线 → orchestration.activity 计 waiting=1',
  waitingEntry?.waiting === 1,
  JSON.stringify(envWaiting.orchestration?.activity ?? []),
);
await saveJson('chief-envelope-waiting.json', envWaiting);
await page.goto(WEB + '/app/resources/machines');
await primaryRow.waitFor({ state: 'visible', timeout: 8000 });
const waitingBadge = primaryRow.locator('[data-orchestration="waiting"]');
check(
  'N10 machines 页主力机行带「总管等待机器」标注 + 离线灰点',
  (await waitingBadge.textContent()) === '总管等待机器' &&
    (await primaryRow.locator('[data-on]').getAttribute('data-on')) === 'false',
);
await shot(page, '03-machines-waiting-badge.png');

// N11 超宽限 → 回合失败收尾（错误行点名机器 + 新出口文案）。步龄直插超龄
//（生产 = 真实 10 分钟流逝；placement 手法同 N9），scheduler tick 15s 内
// sweep 落 chief_turn_error 系统行。
dbWrite((db) => {
  const past = Date.now() - (GRACE_MIN + 1) * 60_000;
  db
    .prepare('UPDATE step SET "createdAt" = ? WHERE "buildId" = ? AND status = ?')
    .run(past, threadId, 'pending');
});
let failureRow = null;
const deadline = Date.now() + 45_000;
while (Date.now() < deadline && failureRow == null) {
  const msgs = await getJson(SERVER + '/api/conversations/' + threadId + '/messages');
  failureRow = (msgs?.messages ?? []).find((m) => {
    try {
      return JSON.parse(String(m.content ?? '{}')).kind === 'chief_turn_error';
    } catch {
      return false;
    }
  }) ?? null;
  if (failureRow == null) await new Promise((r) => setTimeout(r, 2000));
}
const failureMessage =
  failureRow == null ? null : JSON.parse(String(failureRow.content ?? '{}')).message ?? null;
check(
  'N11 超宽限失败行：点名主力机 + 新出口文案（改 chief 设置的主力机 / 清回自动）',
  failureMessage !== null &&
    failureMessage.includes('「' + PRIMARY_NAME + '」') &&
    failureMessage.includes('离线超过 ' + GRACE_MIN + ' 分钟') &&
    failureMessage.includes('改 chief 设置的主力机') &&
    failureMessage.includes('清回自动'),
  failureMessage,
);
const msgsFinal = await getJson(SERVER + '/api/conversations/' + threadId + '/messages');
await saveJson('conversation-failure-messages.json', msgsFinal);

// N12 抽屉失败行可见（真用户路径：#631 链 → toast + 失败行）。
await page.goto(WEB + '/app?chief=' + threadId);
await page.locator('.chief-drawer').waitFor({ state: 'visible', timeout: 8000 });
// #950 载体：失败行 = role=alert（原因文案在其内层 span；scope 到抽屉，
// 排除同页 toast 面）。
const errorReason = page.locator('.chief-drawer [role="alert"] span');
await errorReason.waitFor({ state: 'visible', timeout: 8000 });
check(
  'N12 抽屉失败行含机器名 + 主力机出口',
  ((await errorReason.textContent()) ?? '').includes(PRIMARY_NAME) &&
    ((await errorReason.textContent()) ?? '').includes('改 chief 设置的主力机'),
);
await shot(page, '04-drawer-failure-row.png');

// N13 失败后 machines 页等待标注消失（failed 步不再计数；徽标仍在）。
const envFailed = await getJson(SERVER + '/api/teams/' + teamId + '/chief');
check(
  'N13 失败后 waiting 归零（activity 不再含该机）',
  !(envFailed.orchestration?.activity ?? []).some((a) => a.machineId === primaryId && a.waiting > 0),
  JSON.stringify(envFailed.orchestration?.activity ?? []),
);
await page.goto(WEB + '/app/resources/machines');
await primaryRow.waitFor({ state: 'visible', timeout: 8000 });
check(
  'N14 machines 页等待标注消失、主机徽标保持',
  (await primaryRow.locator('[data-orchestration="waiting"]').count()) === 0 &&
    (await primaryRow.locator('[data-orchestration="host"]').count()) === 1,
);
await shot(page, '05-machines-after-failure.png');
await saveJson('chief-envelope-after-failure.json', envFailed);

await browser.close();

const failed = checks.filter((c) => !c.ok);
writeFileSync(
  join(EVIDENCE, 'result.json'),
  JSON.stringify(
    {
      probe: '895-primary-machine',
      ticket: '#895 / #865',
      stack: { server: SERVER, web: WEB, repo: REPO, db: DB_PATH },
      primaryMachine: { id: primaryId, name: PRIMARY_NAME },
      threadId,
      checks,
      artifacts,
    },
    null,
    2,
  ),
);
process.stdout.write('\n' + (checks.length - failed.length) + '/' + checks.length + ' PASS  evidence=' + EVIDENCE + '\n');
process.exit(failed.length > 0 ? 1 : 0);
