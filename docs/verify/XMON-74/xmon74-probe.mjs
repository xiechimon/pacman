#!/usr/bin/env node
// XMON-74/XMON-115 live 闭环探针（一次性，不进仓）：隔离栈上走真 HTTP +
// 真 UI + 真 SQLite，证明 chief set_remote_shell 授权环全链能跑：
// A. REST 建 agent → 默认 tools = ['推送分支']（XMON-74 Q1 live 证据）
// B. UI 权限 tab 截图：远程 shell OFF / 推送分支 ON（默认态）
// C. chief 线程 → 机器 claim：remoteTools = 50 词表含 set_remote_shell；
//    machine.shellEnabled=false → localTools 无 remote_shell（双闸关）
// D. relay set_remote_shell(enabled=true) → agent.tools 落「远程 shell」；
//    REST GET 与 SQLite 行同值（双入口单真相）
// E. relay(enabled=false) 撤回；不存在 agentId → 404 不写
// F. UI 权限 tab 截图：chief 写点后「远程 shell」开关 ON
// G. PATCH machine.shellEnabled=true → 新 chief 步 claim：localTools 含
//    remote_shell（双闸开，执法面消费同一开关字段）
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = process.env.VERIFY_REPO_ROOT ?? SCRIPT_REPO;
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(REPO, '.claude/verify-run');
const ports = JSON.parse(
  (await import('node:fs')).readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'),
);
const SERVER = `http://127.0.0.1:${ports.serverPort ?? 8791}`;
const WEB = `http://127.0.0.1:${ports.webPort ?? 5273}`;
const DB_PATH = join(RUN_DIR, 'home/server/server.db');
const EVIDENCE =
  process.env.VERIFY_EVIDENCE_DIR ??
  join(REPO, `.claude/verify-evidence/${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}-xmon74`);
mkdirSync(EVIDENCE, { recursive: true });

const require_ = createRequire(join(REPO, 'apps/server/package.json'));
const Database = require_('better-sqlite3');

const checks = [];
const check = (name, ok, detail) => {
  if (typeof ok !== 'boolean') throw new TypeError(`check(${name}) ok 位须 boolean`);
  checks.push({ name, ok, detail: detail ?? null });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}\n`);
};
const save = (name, data) => {
  writeFileSync(join(EVIDENCE, name), JSON.stringify(data, null, 2));
  process.stdout.write(`evid  ${name}\n`);
};
const shot = async (page, name) => {
  await page.screenshot({ path: join(EVIDENCE, name) });
  process.stdout.write(`shot  ${name}\n`
  );
};
const send = async (url, method, body, cred) => {
  const headers = {};
  if (cred) headers.authorization = `Bearer ${cred}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(45_000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
};

// —— A. setup：team / api key / machine enroll / agent / chief 绑定 / 线程 ——
const teams = (await send(`${SERVER}/api/teams`, 'GET')).json;
const teamId = teams[0].id;
const keyRes = await send(`${SERVER}/api/teams/${teamId}/api-keys`, 'POST', {
  name: 'xmon74-machine-bootstrap',
  gitAccess: false,
  mcpAccess: false,
  toolGrants: { read: [], write: [] },
});
const plainKey = keyRes.json?.plaintext ?? keyRes.json?.apiKey ?? keyRes.json?.key;
if (!plainKey) throw new Error(`api-keys 无明文: ${keyRes.text}`);
const enroll = await send(
  `${SERVER}/api/machine/enroll`,
  'POST',
  { teamId, name: 'xmon74-verify-machine', cliVersion: '0.1.0' },
  plainKey,
);
const token = enroll.json?.token;
if (!token) throw new Error(`enroll 无 token: ${enroll.text}`);
const meRes = await send(`${SERVER}/api/machine/me`, 'GET', undefined, token);
const machineId = meRes.json?.id ?? meRes.json?.machine?.id;
save('00-enroll-me.json', { enroll: enroll.json, me: meRes.json });
check('machine-enrolled-shell-off', machineId && meRes.json?.shellEnabled === false,
  `machineId=${machineId} shellEnabled=${meRes.json?.shellEnabled}`);

// chief 派发要求绑定 agent 带模型（chief.ts requireBoundAgent 409），照
// drive-agent-detail 配方先建 custom provider 再建 agent。
await send(`${SERVER}/api/teams/${teamId}/providers`, 'POST', {
  providerId: 'xmon74-gw',
  label: 'xmon74-gw',
  baseUrl: 'https://gw.invalid/v1',
  api: 'anthropic-messages',
  models: [{ id: 'stub-model', name: 'stub-model' }],
}); // 409 = 重跑已存在，忽略
const AGENT_NAME = 'XMON-74 权限闭环验证';
const created = await send(`${SERVER}/api/teams/${teamId}/agents`, 'POST', {
  displayName: AGENT_NAME,
  provider: 'xmon74-gw',
  modelId: 'stub-model',
});
const agentId = created.json?.id;
// 创建响应 = 201 {id}（r5 §1），全记录走 GET。
const createdGet = await send(`${SERVER}/api/teams/${teamId}/agents/${agentId}`, 'GET');
save('01-agent-created-defaults.json', { create: created.json, get: createdGet.json });
check(
  'agent-default-tools-push-only',
  JSON.stringify(createdGet.json?.tools) === JSON.stringify(['推送分支']),
  `tools=${JSON.stringify(createdGet.json?.tools)}（XMON-74 Q1：并非全 off，推送分支默认开）`,
);

const projRes = await send(`${SERVER}/api/projects`, 'POST', { name: 'xmon74-proj' });
const projectId = projRes.json?.id;
if (!projectId) throw new Error(`project 创建失败: ${projRes.text}`);
const chiefBind = await send(`${SERVER}/api/teams/${teamId}/chief`, 'PATCH', {
  agent: { agentId, thinkingLevel: null },
});
check('chief-bound', chiefBind.status === 200, `status=${chiefBind.status}`);
const thread1 = await send(`${SERVER}/api/teams/${teamId}/chief/threads`, 'POST', {
  content: '请把验证 agent 的远程 shell 权限打开，并说明理由。',
});
check('chief-thread-queued', thread1.status === 201, `status=${thread1.status}`);

// —— B. UI 默认态截图 ——————————————————————————————————————————————
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 732 },
  colorScheme: 'dark',
});
const openPermsTab = async () => {
  await page.goto(`${WEB}/app/resources/agents/${agentId}`);
  await page.waitForSelector('.agent-overview', { timeout: 15_000 });
  await page.locator('.agent-tab').nth(2).click();
  await page.waitForSelector('.agent-perms', { timeout: 15_000 });
};
const switchState = async (re) => {
  const switches = page.locator('.agent-tool-switch');
  const n = await switches.count();
  for (let i = 0; i < n; i++) {
    const label = (await switches.nth(i).getAttribute('aria-label')) ?? '';
    if (re.test(label)) return { label, checked: await switches.nth(i).getAttribute('aria-checked') };
  }
  return null;
};
await openPermsTab();
const shellBefore = await switchState(/shell/i);
const pushBefore = await switchState(/推送分支|push/i);
check('ui-perm-six-switches', (await page.locator('.agent-tool-switch').count()) === 6);
check(
  'ui-default-shell-off-push-on',
  shellBefore?.checked === 'false' && pushBefore?.checked === 'true',
  `${shellBefore?.label}=${shellBefore?.checked} ${pushBefore?.label}=${pushBefore?.checked}`,
);
await shot(page, '02-perms-default.png');

// —— C. claim #1：50 词表 + 双闸关 ————————————————————————————————
const claim1 = await send(`${SERVER}/api/machine/tasks/claim`, 'POST', {}, token);
const claim1Body = claim1.json?.step;
if (!claim1Body) throw new Error(`claim1 空: ${claim1.text}`);
const step1 = claim1Body; // ClaimedStep 信封：id 在 .step.id
const remoteNames = (step1.remoteTools ?? []).map((t) => t.name ?? t);
save('03-claim1-remoteTools.json', {
  stepId: step1.step.id,
  remoteToolCount: remoteNames.length,
  hasSetRemoteShell: remoteNames.includes('set_remote_shell'),
  remoteToolNames: remoteNames,
  localTools: step1.localTools ?? null,
});
check('claim1-remote-tools-50', remoteNames.length === 50, `n=${remoteNames.length}`);
check('claim1-has-set-remote-shell', remoteNames.includes('set_remote_shell'));
check(
  'claim1-local-tools-no-shell（机器闸关）',
  !(step1.localTools ?? []).includes('remote_shell'),
  `localTools=${JSON.stringify(step1.localTools ?? [])}`,
);

// —— D. relay 授权 + 双入口单真相 ————————————————————————————————
const relay = async (name, params) =>
  send(`${SERVER}/api/machine/tool/${step1.step.id}`, 'POST', { name, params }, token);
const grant = await relay('set_remote_shell', { agentId, enabled: true });
save('04-relay-grant.json', { status: grant.status, response: grant.json, text: grant.json?.text });
const grantPayload = JSON.parse(grant.json?.text ?? 'null');
check(
  'relay-grant-writes-shell-switch',
  grant.status === 200 &&
    grantPayload?.remoteShell === true &&
    (grantPayload?.tools ?? []).includes('远程 shell'),
  `text=${grant.json?.text}`,
);
const agentGet = await send(`${SERVER}/api/teams/${teamId}/agents/${agentId}`, 'GET');
save('05-agent-get-after-grant.json', agentGet.json);
check('rest-get-sees-chief-write', (agentGet.json?.tools ?? []).includes('远程 shell'),
  `tools=${JSON.stringify(agentGet.json?.tools)}`);
const db = new Database(DB_PATH, { readonly: true });
const sqliteRow = db.prepare('SELECT id, displayName, tools FROM agent WHERE id = ?').get(agentId);
save('06-sqlite-agent-row.json', sqliteRow);
check(
  'sqlite-row-shell-on',
  JSON.parse(sqliteRow.tools).includes('远程 shell'),
  `agent.tools=${sqliteRow.tools}`,
);

// —— E. 撤回 + 越权守卫 ————————————————————————————————————————————
const revoke = await relay('set_remote_shell', { agentId, enabled: false });
const revokePayload = JSON.parse(revoke.json?.text ?? 'null');
check(
  'relay-revoke-removes-only-shell',
  revoke.status === 200 && JSON.stringify(revokePayload?.tools) === JSON.stringify(['推送分支']),
  `text=${revoke.json?.text}`,
);
const missing = await relay('set_remote_shell', { agentId: 'no-such-agent', enabled: true });
check('relay-unknown-agent-404-no-write', missing.status === 404, `status=${missing.status}`);
const afterMissing = await send(`${SERVER}/api/teams/${teamId}/agents/${agentId}`, 'GET');
check(
  'unknown-agent-left-tools-untouched',
  JSON.stringify(afterMissing.json?.tools) === JSON.stringify(['推送分支']),
  `tools=${JSON.stringify(afterMissing.json?.tools)}`,
);
const regrant = await relay('set_remote_shell', { agentId, enabled: true });
check('relay-regrant-for-ui', regrant.status === 200, `text=${regrant.json?.text}`);
save('07-relay-revoke-guard-regrant.json', {
  revoke: { status: revoke.status, text: revoke.json?.text },
  missingAgent: { status: missing.status, body: missing.json ?? missing.text },
  regrant: { status: regrant.status, text: regrant.json?.text },
});

// 双闸 live 证据的派工前置：chief 亲手（同一 step1 relay 面）建两个 todo 并
// run_builds 直派给验证 agent → 两个 pending worker 步，供 G 阶段先后 claim。
const todoSpec = 'XMON-74 双闸验证：README 补一行说明。';
const mkTodo = async (title) => {
  const r = await relay('create_todo', { projectId, title, spec: todoSpec });
  return JSON.parse(r.json?.text ?? 'null');
};
const todo1 = await mkTodo('xmon74 双闸验证一');
const todo2 = await mkTodo('xmon74 双闸验证二');
const run1 = await relay('run_builds', { todoIds: [todo1.id], assignment: { build: { agentId } } });
const run2 = await relay('run_builds', { todoIds: [todo2.id], assignment: { build: { agentId } } });
save('07b-chief-dispatch-workers.json', { todo1, todo2, run1: run1.json, run2: run2.json });
check(
  'chief-dispatched-two-workers',
  run1.status === 200 && run2.status === 200,
  `run1=${run1.status} run2=${run2.status}`,
);

// —— F. UI 截图：chief 写点反映到权限 tab ————————————————
await openPermsTab();
const shellAfter = await switchState(/shell/i);
check('ui-shell-on-after-chief-grant', shellAfter?.checked === 'true',
  `${shellAfter?.label}=${shellAfter?.checked}`);
await shot(page, '08-perms-chief-granted.png');

// —— G. worker 步双闸 live 证据：chief 步按设计不携带 localTools（无本机执行
// 面，XMON-108 R1；预检端点对 chief 步 409），双闸消费点在 worker claim
// （claimLocalTools = agent「远程 shell」开关 ∩ machine.shellEnabled）。
// E 阶段已由 chief relay 直派两个 worker 步：步一在机器闸关时 claim（agent
// 开关已开仍不给词 = fail-closed），开机器闸后步二 claim 拿到 remote_shell。
const doneBody = {
  status: 'success',
  sessionId: 'xmon74-verify-session',
  usage: [{ model: 'stub/stub', input: 1, output: 1, cacheRead: 0, cacheWrite: 0 }],
};
const done1 = await send(`${SERVER}/api/machine/done/${step1.step.id}`, 'POST', doneBody, token);
check('step1-done', done1.status === 200, `status=${done1.status}`);
const claimW1 = await send(`${SERVER}/api/machine/tasks/claim`, 'POST', {}, token);
const w1 = claimW1.json?.step;
if (!w1) throw new Error(`claim worker1 空: ${claimW1.text}`);
check('worker1-claimed', w1.step.kind !== 'chief', `kind=${w1.step.kind}`);
check(
  'worker1-no-shell（agent 开 ∩ 机器关 = 闸闭 fail-closed）',
  !(w1.localTools ?? []).includes('remote_shell'),
  `localTools=${JSON.stringify(w1.localTools ?? [])} agentTools=${JSON.stringify(w1.agent?.tools ?? null)}`,
);
const doneW1 = await send(`${SERVER}/api/machine/done/${w1.step.id}`, 'POST', doneBody, token);
check('worker1-done', doneW1.status === 200, `status=${doneW1.status}`);
const patchMachine = await send(`${SERVER}/api/machines/${machineId}`, 'PATCH', {
  shellEnabled: true,
});
save('09-machine-shell-enabled.json', { status: patchMachine.status, body: patchMachine.json });
check('machine-shell-enabled', patchMachine.status === 200 && patchMachine.json?.shellEnabled === true,
  `status=${patchMachine.status}`);
const claimW2 = await send(`${SERVER}/api/machine/tasks/claim`, 'POST', {}, token);
const w2 = claimW2.json?.step;
if (!w2) throw new Error(`claim worker2 空: ${claimW2.text}`);
save('10-worker-claims-localTools.json', {
  worker1: {
    stepId: w1.step.id,
    kind: w1.step.kind,
    localTools: w1.localTools ?? null,
    agentToolsAtClaim: w1.agent?.tools ?? null,
    machineShellEnabledAtClaim: false,
  },
  worker2: {
    stepId: w2.step.id,
    kind: w2.step.kind,
    localTools: w2.localTools ?? null,
    agentToolsAtClaim: w2.agent?.tools ?? null,
    machineShellEnabledAtClaim: true,
  },
});
check(
  'worker2-has-shell（agent 开 ∩ 机器开 = 双闸齐开）',
  (w2.localTools ?? []).includes('remote_shell'),
  `localTools=${JSON.stringify(w2.localTools ?? [])} agentTools=${JSON.stringify(w2.agent?.tools ?? null)}`,
);
const doneW2 = await send(`${SERVER}/api/machine/done/${w2.step.id}`, 'POST', doneBody, token);
check('worker2-done', doneW2.status === 200, `status=${doneW2.status}`);
db.close();
await browser.close();

const failed = checks.filter((c) => !c.ok);
writeFileSync(
  join(EVIDENCE, 'result.json'),
  JSON.stringify(
    {
      probe: 'xmon74-permission-loop',
      stack: { server: SERVER, web: WEB, db: DB_PATH, repo: REPO },
      agentId,
      machineId,
      checks,
      passed: checks.length - failed.length,
      total: checks.length,
    },
    null,
    2,
  ),
);
process.stdout.write(`\n${checks.length - failed.length}/${checks.length} checks passed\nevidence: ${EVIDENCE}\n`);
process.exit(failed.length > 0 ? 1 : 0);
