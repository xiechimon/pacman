// #706 live probe: build 步失联扫尾的端到端实测（真 wire）。
// 场景 B (B-C7): claim 后零心跳 + 机器在线 → 120s 级按失败收尾。
// 场景 N (负例): 同窗口内 pending 步 + 机器在线 → 保持 pending。
// 场景 A (离线死): claim + 1 次心跳 + SSE 断连下线 → 120s 级按失败收尾。
// 全程真 HTTP (enroll/presence/claim/heartbeat/SSE)，阈值走生产 120s + 15s tick。
import { setTimeout as sleep } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';

const API = 'http://127.0.0.1:8791';
const DB = `${process.env.VERIFY_REPO_ROOT ?? process.cwd()}/.claude/verify-run/home/server/server.db`;
const OUT = process.argv[2] ?? '/tmp/probe-706';
const EVIDENCE = `${OUT}/evidence`;

async function api(method, path, { cred, body } = {}) {
  const headers = {};
  if (cred) headers.authorization = `Bearer ${cred}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text: text.slice(0, 300) };
}

function dbAll(sql) {
  const out = execFileSync('sqlite3', ['-json', DB, sql], { encoding: 'utf8' });
  return out.trim() ? JSON.parse(out) : [];
}

function dbRun(sql) {
  execFileSync('sqlite3', [DB, sql]);
}

const checks = [];
function check(label, ok, detail = '') {
  checks.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
}

async function pollFor(label, fn, timeoutMs, intervalMs = 10_000) {
  const start = Date.now();
  for (;;) {
    let got = null;
    try {
      got = await fn();
    } catch {}
    if (got) return { ok: true, elapsedMs: Date.now() - start, value: got };
    if (Date.now() - start > timeoutMs) return { ok: false, elapsedMs: Date.now() - start };
    await sleep(intervalMs);
  }
}

/** claim 响应解包：body = {step: claimedStep | null}，claimedStep.step = 步行。 */
function unwrapClaim(body) {
  const cs = body?.step;
  if (!cs) return null;
  return { stepId: cs.step.id, buildId: cs.step.buildId };
}

// ---- setup ----
const teams = (await api('GET', '/api/teams')).json;
const teamId = teams[0].id;
const keyRes = await api('POST', `/api/teams/${teamId}/api-keys`, {
  body: { name: 'probe-706', gitAccess: false, mcpAccess: false, toolGrants: { read: [], write: [] } },
});
const key = keyRes.json.plaintext ?? keyRes.json.id;
const now = Date.now();
dbRun(
  `INSERT INTO provider (id, teamId, kind, providerId, label, baseUrl, api, authHeader, compat, models, createdBy, createdAt, updatedAt) VALUES ('prov-706','${teamId}','custom','stub-gw','Stub','http://127.0.0.1:9/v1','openai-completions',1,'{\"supportsDeveloperRole\":false}','[{\"id\":\"stub-model\",\"name\":\"stub-model\"}]','owner',${now},${now});`,
);
dbRun(
  `INSERT INTO agent (id, teamId, displayName, provider, modelId) VALUES ('agent-706','${teamId}','probe-builder','stub-gw','stub-model');`,
);
const project = (await api('POST', '/api/projects', { body: { name: 'sweep-706' } })).json;
const projectId = project.id;
const todos = {};
for (const name of ['todoA-death-online', 'todoB-pending-neg', 'todoC-death-offline']) {
  const t = (
    await api('POST', `/api/projects/${projectId}/todos`, {
      body: { title: name, spec: 'probe-706 sweep target' },
    })
  ).json;
  todos[name] = t.id;
}
const builds = {};
for (const [name, todoId] of Object.entries(todos)) {
  const b = (
    await api('POST', `/api/projects/${projectId}/builds`, {
      body: {
        todoIds: [todoId],
        assignment: { plan: { agentId: 'agent-706' }, build: { agentId: 'agent-706' } },
        withPlan: false,
      },
    })
  ).json;
  builds[name] = b.builds[0].id;
}
const enroll = (
  await api('POST', '/api/machine/enroll', {
    cred: key,
    body: { teamId, name: 'probe-706-box', cliVersion: '0.1.0' },
  })
).json;
const token = enroll.token;
const machineId = enroll.machineId ?? enroll.machine?.id;
console.log('setup ok:', JSON.stringify({ teamId, projectId, machineId, builds }));

const stepOf = (buildId) => dbAll(`SELECT id,status,machineId,createdAt,claimedAt,lastHeartbeatAt FROM step WHERE buildId='${buildId}'`)[0];
const machineOnline = () => dbAll(`SELECT online FROM machine WHERE id='${machineId}'`)[0]?.online;

// ---- 场景 B: B-C7（claim 后零心跳 + 机器在线）----
await api('POST', '/api/machine/presence', { cred: token, body: {} });
const claimA = unwrapClaim((await api('POST', '/api/machine/tasks/claim', { cred: token, body: {} })).json);
check('B: claim 拿到 todoA 的步', claimA?.buildId === builds['todoA-death-online'], JSON.stringify(claimA));
const t0 = Date.now();
// 负例 N 同窗口：todoB/C 的步保持 pending（机器在线）。
const rB = await pollFor(
  'B: todoA 步翻 failed（机器在线，零心跳进展）',
  async () => stepOf(builds['todoA-death-online']).status === 'failed' || null,
  220_000,
);
check('B: 有界时间内失败（~120s 阈值 + tick）', rB.ok, `${Math.round(rB.elapsedMs / 1000)}s`);
const sB = stepOf(builds['todoB-pending-neg']);
check('N: 同窗口 pending 步保持 pending（机器在线）', sB.status === 'pending', `status=${sB.status}`);
check('N: 机器仍在线', machineOnline() === 1, `online=${machineOnline()}`);
const todoA = (await api('GET', `/api/todos/${todos['todoA-death-online']}`)).json;
check('B: todo 相位翻 failed', todoA.phase === 'failed' || todoA.todo?.phase === 'failed', JSON.stringify(todoA.phase ?? todoA.todo?.phase));

// ---- 场景 A：离线死（claim + 心跳 + SSE 断连）----
// claim#2 取最老 pending（todoB 的步）；todoC 全程 pending 见证 pending-离线判据。
const claimC = unwrapClaim((await api('POST', '/api/machine/tasks/claim', { cred: token, body: {} })).json);
console.log('claim2 ->', claimC?.stepId, claimC?.buildId);
check('A: claim#2 拿到 todoB 的步', claimC?.buildId === builds['todoB-pending-neg'], JSON.stringify(claimC));
await api('POST', `/api/machine/heartbeat/${claimC.stepId}`, { cred: token, body: {} });
// SSE 建连后主动断开 = daemon 死亡的真 wire 形态（服务端 onAbort → markOffline）。
const ctrl = new AbortController();
const sseP = fetch(`${API}/api/machine/stream`, {
  headers: { authorization: `Bearer ${token}` },
  signal: ctrl.signal,
}).catch(() => {});
await sleep(3000);
ctrl.abort();
await sseP;
const offR = await pollFor('A: SSE 断连后机器下线', async () => (machineOnline() === 0 ? true : null), 60_000);
check('A: 机器下线（presence 面）', offR.ok, `${Math.round(offR.elapsedMs / 1000)}s`);
const rA = await pollFor(
  'A: 离线步翻 failed',
  async () => stepOf(claimC.buildId).status === 'failed' || null,
  220_000,
);
check('A: 有界时间内失败', rA.ok, `${Math.round(rA.elapsedMs / 1000)}s`);
const rC = await pollFor(
  'A+: 零在线机器后超龄 pending 步（todoC）同样失败',
  async () => stepOf(builds['todoC-death-offline']).status === 'failed' || null,
  120_000,
);
check('A+: pending-离线判据 live 生效', rC.ok, `${Math.round(rC.elapsedMs / 1000)}s`);

// ---- 证据 ----
execFileSync('mkdir', ['-p', EVIDENCE]);
const evidence = {
  probe: 'probe-706',
  stack: { api: API, thresholdMs: 120_000, tickMs: 15_000 },
  checks,
  todos: dbAll(`SELECT id,title,phase FROM todo WHERE projectId='${projectId}'`),
  builds: dbAll(`SELECT id,todoId,errorMessage FROM build WHERE id IN ('${Object.values(builds).join("','")}')`),
  steps: dbAll(`SELECT id,buildId,kind,status,machineId,createdAt,claimedAt,lastHeartbeatAt FROM step WHERE buildId IN ('${Object.values(builds).join("','")}')`),
  machines: dbAll(`SELECT id,name,online FROM machine WHERE id='${machineId}'`),
};
await import('node:fs/promises').then((fs) => fs.writeFile(`${EVIDENCE}/result.json`, JSON.stringify(evidence, null, 2)));
console.log(`evidence -> ${EVIDENCE}/result.json`);
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? 'ALL GREEN' : `${failed.length} FAILURES`);
