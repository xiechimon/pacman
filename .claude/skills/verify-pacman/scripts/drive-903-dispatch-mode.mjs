#!/usr/bin/env node
// verify-pacman drive-903-dispatch-mode — chief 派发方式选择权（#903，ADR
// 0013）live 闭环：设置面 + 服务端强制两条腿。
//
// 真用户路径：抽屉齿轮进总管设置 → Agent tab「派发方式」槽（缺省回显
// 「先规划」）→ 选「直接执行」（live 写 = PATCH /chief dispatchWithPlan 槽）
// → 假机器认领 chief 回合步 → relay run_builds 直派实证（build.withPlan=0 +
// 首步 build）→ 翻回「先规划」→ relay run_builds **对抗性塞 withPlan:false**
// → clamp 实证（生效值仍 true，build.withPlan=1 + 首步 plan）。
//
// 铺底全走公开 REST（drive-agent-identity 铺底律，非被测路径）：provider +
// agent + PATCH chief 绑定 + project + 2 todo + api-key + machine enroll。
// 零 daemon、零 LLM：chief 回合数据面与真机器同形（claim → tool relay →
// done 全走真 machine wire）。claim 载荷顺带取两样运行时实物：合成后的
// systemPrompt 派发模式行（D4）+ run_builds 工具定义无 withPlan 参数（D3）。
// 依赖全新库：重验 = 重 launch。
// 用法：VERIFY_REPO_ROOT=<worktree> node drive-903-dispatch-mode.mjs

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
  process.env.VERIFY_EVIDENCE_DIR ??
  join(SCRIPT_REPO, '.claude/verify-evidence/' + ts + '-903-dispatch-mode');
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
function dbRead(fn) {
  const Database = require2('better-sqlite3');
  const db = new Database(DB_PATH, { readonly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

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
  displayName: '验证员 903',
  provider: 'stub-gw',
  modelId: 'stub-model',
});
if (![200, 201].includes(agent.status)) {
  throw new Error('agent → ' + agent.status + ' ' + JSON.stringify(agent.body));
}
const AGENT_ID = agent.body?.id ?? agent.body?.agentId ?? agent.body?.record?.id;
if (!AGENT_ID) throw new Error('agent 无 id：' + JSON.stringify(agent.body));

const bind = await sendJson(
  SERVER + '/api/teams/' + teamId + '/chief',
  { agent: { agentId: AGENT_ID, thinkingLevel: null } },
  'PATCH',
);
if (bind.status !== 200) throw new Error('chief bind → ' + bind.status + ' ' + JSON.stringify(bind.body));

const proj = await sendJson(SERVER + '/api/projects', { name: 'probe-903' });
const projectId = proj.body?.id ?? proj.body?.project?.id;
if (!projectId) throw new Error('project 无 id：' + JSON.stringify(proj.body));
const todoA = await sendJson(SERVER + '/api/projects/' + projectId + '/todos', {
  title: '直执行腿探针',
  spec: '用于 #903 直执行档实证。',
});
const todoB = await sendJson(SERVER + '/api/projects/' + projectId + '/todos', {
  title: '先规划腿探针',
  spec: '用于 #903 先规划档 + clamp 实证。',
});
const TASK_A = todoA.body?.id;
const TASK_B = todoB.body?.id;
if (!TASK_A || !TASK_B) throw new Error('todo 无 id：' + JSON.stringify([todoA.body, todoB.body]));

const key = await sendJson(SERVER + '/api/teams/' + teamId + '/api-keys', {
  name: 'dispatch-probe',
  gitAccess: false,
  mcpAccess: false,
  toolGrants: { read: [], write: [] },
});
const keyPlain = key.body?.plaintext ?? key.body?.record?.plaintext ?? key.body?.token;
if (!keyPlain) throw new Error('api-key 无 plaintext：' + JSON.stringify(key.body));
const enroll = await sendJson(
  SERVER + '/api/machine/enroll',
  { teamId, name: 'dispatch-probe-machine', cliVersion: '0.1.0' },
  'POST',
  keyPlain,
);
const machineToken = enroll.body?.token ?? enroll.body?.machine?.token;
if (enroll.status !== 200 || !machineToken) throw new Error('enroll → ' + enroll.status);

check(
  'S0 铺底：project + 双 todo 落库（REST 双真值）',
  Boolean(projectId && TASK_A && TASK_B),
  'project=' + projectId,
);

// —— chief 回合辅助（真 machine wire，零 LLM）——————————————————
// claim 响应双层包装 {step:{step:{…}, chief, remoteTools}}（machine-wire 律）。
async function claimChiefStep(tag) {
  const claim = await sendJson(SERVER + '/api/machine/tasks/claim', {}, 'POST', machineToken);
  const payload = claim.body?.step;
  const claimed = payload?.step ?? payload;
  if (!claimed?.id || claimed.kind !== 'chief') {
    throw new Error(tag + ' claim 非 chief 步：' + JSON.stringify(claim.body).slice(0, 400));
  }
  return { stepId: claimed.id, payload };
}
async function relayTool(stepId, name, params) {
  const res = await sendJson(
    SERVER + '/api/machine/tool/' + stepId,
    { name, params },
    'POST',
    machineToken,
  );
  if (res.status !== 200) throw new Error('relay ' + name + ' → ' + res.status + ' ' + JSON.stringify(res.body).slice(0, 300));
  return JSON.parse(res.body.text);
}
async function doneStep(stepId, status, errorMessage) {
  const res = await sendJson(
    SERVER + '/api/machine/done/' + stepId,
    errorMessage ? { status, errorMessage } : { status },
    'POST',
    machineToken,
  );
  if (res.status !== 200) throw new Error('done → ' + res.status + ' ' + JSON.stringify(res.body).slice(0, 300));
}
function openChiefThread(content) {
  return sendJson(SERVER + '/api/teams/' + teamId + '/chief/threads', { content });
}
function dispatchRows(todoId) {
  return dbRead((db) => {
    const builds = db
      .prepare('SELECT id, withPlan, triggerSource FROM build WHERE "todoId" = ? ORDER BY "createdAt"')
      .all(todoId);
    const steps = builds.flatMap((b) =>
      db
        .prepare('SELECT kind, status FROM step WHERE "buildId" = ? ORDER BY "createdAt"')
        .all(b.id)
        .map((s) => ({ buildId: b.id, ...s })),
    );
    return { builds, steps };
  });
}

// 派发模式行 canon（composeChiefSystemPrompt 合成产物，ADR 0013 D4）。
const MODE_LINE_PLAN = '派发模式（团队设置，服务端强制）：先规划';
const MODE_LINE_DIRECT = '派发模式（团队设置，服务端强制）：直接执行';

// —— 浏览器面（live 模式，无 scenario）————————————————————————
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
await page.route('**/api.dicebear.com/**', (route) =>
  route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#888"/></svg>',
  }),
);

const dispatchChip = page.locator('button[aria-label="派发方式"]');
const dispatchMenu = page.locator('[role="dialog"][aria-label="派发方式"]');
const dispatchRow = (label) =>
  dispatchMenu.locator('[data-testid="chief-dispatch-row"]').filter({ hasText: label });

async function gotoSettingsDispatchRow() {
  await page.goto(WEB + '/app');
  await page.locator('button[aria-label="总管"]').click();
  await page.locator('.chief-drawer').waitFor({ state: 'visible', timeout: 8000 });
  await page.locator('button[aria-label="总管设置"]').click();
  await page.locator('h1:text-is("总管设置")').waitFor({ state: 'visible', timeout: 8000 });
  await dispatchChip.waitFor({ state: 'visible', timeout: 8000 });
}
async function pickDispatch(label) {
  await dispatchChip.click();
  await dispatchMenu.waitFor({ state: 'visible', timeout: 8000 });
  await dispatchRow(label).click();
  await dispatchMenu.waitFor({ state: 'hidden', timeout: 8000 });
  // live 写 = PATCH → invalidateAll 重取回显（S8：无本地乐观态，等真值落定）。
  await dispatchChip.filter({ hasText: label }).waitFor({ timeout: 8000 });
}

// U1 缺省面：槽在位 + 回显「先规划」（ADR 0013 D2 默认档）。
await gotoSettingsDispatchRow();
check('U1 设置 Agent tab「派发方式」槽在位，缺省回显「先规划」', (await dispatchChip.textContent()).includes('先规划'));
await shot(page, '01-settings-dispatch-default-plan.png');

// U2 清单面：两行 + 选中态跟值；选「直接执行」→ 回显翻。
await dispatchChip.click();
await dispatchMenu.waitFor({ state: 'visible', timeout: 8000 });
const optCount = await dispatchMenu.locator('[role="option"]').count();
check(
  'U2 清单两行（先规划 选中 / 直接执行）',
  optCount === 2 &&
    (await dispatchRow('先规划').getAttribute('aria-selected')) === 'true' &&
    (await dispatchRow('直接执行').getAttribute('aria-selected')) === 'false',
  'options=' + optCount,
);
await shot(page, '02-dispatch-menu-plan-selected.png');
await dispatchRow('直接执行').click();
await dispatchMenu.waitFor({ state: 'hidden', timeout: 8000 });
await dispatchChip.filter({ hasText: '直接执行' }).waitFor({ timeout: 8000 });
check('U3 选「直接执行」→ chip 回显翻（PATCH → invalidateAll 重取）', true);
await shot(page, '03-settings-dispatch-direct.png');

// A1 REST 回读（回读确认律）。
const envDirect = await getJson(SERVER + '/api/teams/' + teamId + '/chief');
check('A1 GET 回读 dispatchWithPlan=false', envDirect.chief?.dispatchWithPlan === false);
await saveJson('chief-envelope-direct.json', envDirect);

// E1 强制面·直执行腿：claim（systemPrompt + 工具定义实物）→ relay 直派。
const t1 = await openChiefThread('开始任务「直执行腿探针」，直接派发执行。');
if (t1.status !== 201) throw new Error('chief threads → ' + t1.status);
const claimDirect = await claimChiefStep('E1');
const promptDirect = claimDirect.payload?.chief?.systemPrompt ?? '';
const runBuildsDef = (claimDirect.payload?.remoteTools ?? []).find((t) => t.name === 'run_builds');
check(
  'E1a claim systemPrompt 派发模式行 = 直接执行，且无写死 withPlan:false',
  promptDirect.includes(MODE_LINE_DIRECT) && !promptDirect.includes('withPlan:false'),
);
check(
  'E1b claim 载荷 run_builds 工具定义已无 withPlan 参数（D3 词表实物）',
  runBuildsDef !== undefined && !('withPlan' in (runBuildsDef.parameters?.properties ?? {})),
  'props=' + JSON.stringify(Object.keys(runBuildsDef?.parameters?.properties ?? {})),
);
await saveJson('claim-direct.json', {
  stepId: claimDirect.stepId,
  systemPromptDispatchLine: promptDirect
    .split('\n')
    .find((l) => l.startsWith('- 派发模式')) ?? null,
  runBuildsToolDef: runBuildsDef ?? null,
});
const relayDirect = await relayTool(claimDirect.stepId, 'run_builds', {
  todoIds: [TASK_A],
  assignment: { build: { agentId: AGENT_ID } },
});
check(
  'E1c relay run_builds（不带 withPlan）→ 生效值 false + triggerSource chief',
  relayDirect.withPlan === false && relayDirect.triggerSource === 'chief',
  'withPlan=' + relayDirect.withPlan,
);
const rowsA = dispatchRows(TASK_A);
check(
  'E1d SQLite：build.withPlan=0 + 首步 kind=build（直执行实证）',
  rowsA.builds.length === 1 &&
    Number(rowsA.builds[0].withPlan) === 0 &&
    rowsA.builds[0].triggerSource === 'chief' &&
    rowsA.steps[0]?.kind === 'build',
  JSON.stringify(rowsA),
);
await saveJson('relay-direct.json', { relayResult: relayDirect, sqlite: rowsA });
await doneStep(claimDirect.stepId, 'success');
// 清道：把直执行腿的 build 步收掉（done failed），别挡 E2 的 claim。
const sweep = await sendJson(SERVER + '/api/machine/tasks/claim', {}, 'POST', machineToken);
const swept = sweep.body?.step?.step ?? sweep.body?.step;
if (swept?.id) await doneStep(swept.id, 'failed', 'probe sweep（#903 直执行腿收道）');

// U4 翻回「先规划」（真用户路径第二写）。
await pickDispatch('先规划');
check('U4 翻回「先规划」→ chip 回显', true);
await shot(page, '04-settings-dispatch-back-to-plan.png');
const envPlan = await getJson(SERVER + '/api/teams/' + teamId + '/chief');
check('A2 GET 回读 dispatchWithPlan=true', envPlan.chief?.dispatchWithPlan === true);
await saveJson('chief-envelope-plan.json', envPlan);

// E2 强制面·先规划腿 + clamp：报文对抗性塞 withPlan:false，生效值仍 true。
await browser.close();
const t2 = await openChiefThread('开始任务「先规划腿探针」，直接派发执行。');
if (t2.status !== 201) throw new Error('chief threads → ' + t2.status);
const claimPlan = await claimChiefStep('E2');
const promptPlan = claimPlan.payload?.chief?.systemPrompt ?? '';
check(
  'E2a claim systemPrompt 派发模式行 = 先规划（按设置合成，D4）',
  promptPlan.includes(MODE_LINE_PLAN) && !promptPlan.includes('withPlan:false'),
);
await saveJson('claim-plan.json', {
  stepId: claimPlan.stepId,
  systemPromptDispatchLine: promptPlan
    .split('\n')
    .find((l) => l.startsWith('- 派发模式')) ?? null,
});
const relayPlan = await relayTool(claimPlan.stepId, 'run_builds', {
  todoIds: [TASK_B],
  assignment: { build: { agentId: AGENT_ID } },
  withPlan: false, // 对抗腿：工具面已无此参数，塞值必须不生效（服务端 clamp）
});
check(
  'E2b relay run_builds 对抗性塞 withPlan:false → 生效值仍 true（clamp 实证）',
  relayPlan.withPlan === true,
  'withPlan=' + relayPlan.withPlan,
);
const rowsB = dispatchRows(TASK_B);
check(
  'E2c SQLite：build.withPlan=1 + 首步 kind=plan（按配置走 plan 实证）',
  rowsB.builds.length === 1 &&
    Number(rowsB.builds[0].withPlan) === 1 &&
    rowsB.builds[0].triggerSource === 'chief' &&
    rowsB.steps[0]?.kind === 'plan',
  JSON.stringify(rowsB),
);
await saveJson('relay-plan-clamp.json', { relayResult: relayPlan, sqlite: rowsB });
await doneStep(claimPlan.stepId, 'success');

const failed = checks.filter((c) => !c.ok);
writeFileSync(
  join(EVIDENCE, 'result.json'),
  JSON.stringify(
    {
      probe: '903-dispatch-mode',
      ticket: '#903',
      adr: 'docs/adr/0013-chief派发方式-选择权归人-服务端强制.md',
      stack: { server: SERVER, web: WEB, repo: REPO, db: DB_PATH },
      ids: { teamId, projectId, agentId: AGENT_ID, todoA: TASK_A, todoB: TASK_B },
      checks,
      artifacts,
    },
    null,
    2,
  ),
);
process.stdout.write(
  '\n' + (checks.length - failed.length) + '/' + checks.length + ' PASS  evidence=' + EVIDENCE + '\n',
);
process.exit(failed.length > 0 ? 1 : 0);
