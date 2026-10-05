#!/usr/bin/env node
// #881 verify probe — 两条「无界等待」缝的 before/after 行为验证。
//
// 形态:纯 REST 世界搭建 + SQLite 步行回拨(有界复现——不烧 10 分钟真等,
// 回拨 createdAt 让宽限已过)+ 真 scheduler tick / 真 claim 端点判定。
// EXPECT=new 走修复后语义(断言收口生效);EXPECT=old 走基线语义(断言缝
// 仍在——步无期 pending / 亲和永久让行),同脚本反转关键断言(#741 先例)。
//
// 缝 ①(钉选在线但 runtime 闸挡):M-pin 在线、只开 pi;claude-code agent 的
//   钉选 build 步 → 钉选 SQL 过滤下唯 M-pin 可见 + claim 闸恒 false = 无期。
// 缝 ②(会话机在线但楔住):X 在线持有会话、不领步;Y 在线旁观。步超宽限
//   → 修复前 Y 的 claim 永远 null(亲和让行无界);修复后 Y 领走(换机降级
//   契约 = continue 载荷原样,daemon 注记不在本探针面,#862 T1 已钉)。
// 忙保护(Y 不误抢):X 手上挂一条 claimed 步 → Y 仍空手(两种 EXPECT 下都
//   成立——忙 = 合法等待不是楔住)。
//
// env:VERIFY_PORT(必填)、DB_PATH(必填)、OUT_DIR(必填)、EXPECT=new|old
// (必填)。产物:result.json(逐条 check)+ 各中途态 JSON。

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PORT = process.env.VERIFY_PORT;
const DB_PATH = process.env.DB_PATH;
const OUT_DIR = process.env.OUT_DIR;
const EXPECT = process.env.EXPECT;
const REPO = process.env.VERIFY_REPO_ROOT ?? join(import.meta.dirname, '../../../..');
if (!PORT || !DB_PATH || !OUT_DIR || !EXPECT || !['new', 'old'].includes(EXPECT)) {
  console.error('usage: VERIFY_PORT=… DB_PATH=… OUT_DIR=… EXPECT=new|old node drive-881.mjs');
  process.exit(2);
}
const API = `http://127.0.0.1:${PORT}`;
mkdirSync(OUT_DIR, { recursive: true });

const require2 = createRequire(join(REPO, 'apps/server/package.json'));
const GRACE_MS = 10 * 60_000; // 与 PIN_OFFLINE_GRACE_MS / SESSION_WEDGE_GRACE_MS 同值(回拨量)

const checks = [];
const check = (label, ok, detail) => {
  checks.push({ ok, label, ...(detail !== undefined ? { detail } : {}) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? ` — ${detail}` : ''}`);
  return ok;
};

const api = async (method, path, body, token) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token !== undefined ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120_000), // claim 长轮询空手 ≈ 75s,盖住
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON 响应 */
  }
  return { status: res.status, json, text };
};

const dump = (name, data) => writeFileSync(join(OUT_DIR, name), `${JSON.stringify(data, null, 2)}\n`);

// SQLite 写入(回拨 createdAt / 种 busy/prior 行)。开 busy timeout 避开与
// server 短写的锁竞争,失败即整探针 FAIL(证据不静默降级)。
const sqlite = (fn) => {
  const Database = require2('better-sqlite3');
  const db = new Database(DB_PATH, { timeout: 5_000 });
  try {
    return fn(db);
  } finally {
    db.close();
  }
};

const now = () => Date.now();

// —— 世界搭建 ——————————————————————————————————————————————————————————————

const session = (await api('GET', '/api/auth/session')).json;
check('server session 200 (Owner seed)', session?.displayName === 'Owner', session?.displayName);
const teamId = (await api('GET', '/api/teams')).json[0]?.id;
if (!teamId) throw new Error('no team');

const project = (await api('POST', '/api/projects', { name: 'p881' })).json;
const projectId = project.id;

// agent:缝 ① 用 claude-code 档(runtime 反例位);缝 ② 用普通 pi 档。
const ccAgent = (
  await api('POST', `/api/teams/${teamId}/agents`, {
    displayName: 'cc-runner',
    provider: 'claude-code',
    modelId: 'stub-cc-model',
  })
).json;
const piAgent = (
  await api('POST', `/api/teams/${teamId}/agents`, {
    displayName: 'pi-runner',
    provider: 'stub-gw',
    modelId: 'stub-pi-model',
  })
).json;

// 一机一 key:enroll 按 (apiKeyId, teamId) 复用机器行——同一 key 注册三台
// 会坍缩成一台(名字被末次覆盖),世界必须每台机器独立 key。
const newKey = async (name) =>
  (
    await api('POST', `/api/teams/${teamId}/api-keys`, {
      name,
      gitAccess: false,
      mcpAccess: false,
      toolGrants: { read: [], write: [] },
    })
  ).json.plaintext;

const enroll = async (name) => {
  const res = await api(
    'POST',
    '/api/machine/enroll',
    { teamId, name, cliVersion: '0.1.0' },
    await newKey(`key-${name}`),
  );
  return { id: res.json.machineId, token: res.json.token };
};
const present = async (m) => {
  const res = await api('POST', '/api/machine/presence', {}, m.token);
  return res.status === 200;
};

const M_PIN = await enroll('pin-blocked'); // 缝 ①:在线但只开 pi(enroll 缺省)
const X_SESS = await enroll('session-owner'); // 缝 ②:在线楔住(claim 探针不来)
const Y_BY = await enroll('bystander'); // 缝 ②:健康旁观者(claim 探针)
const onlineOk = [await present(M_PIN), await present(X_SESS), await present(Y_BY)];
check('machines enrolled + online', onlineOk.every(Boolean), JSON.stringify(onlineOk));

const machines = (await api('GET', `/api/teams/${teamId}/machines`)).json ?? [];
const mPinRow = (machines.machines ?? machines).find?.((m) => m.id === M_PIN.id);
check(
  'pin machine online + runtimes [pi] (world shape)',
  Boolean(mPinRow?.online) && JSON.stringify(mPinRow?.enabledRuntimes) === '["pi"]',
  JSON.stringify(mPinRow?.enabledRuntimes),
);
dump('machines.json', { machines });

// —— 缝 ①:钉选在线 + runtime 闸挡 ———————————————————————————————————————

const todo1 = (
  await api('POST', `/api/projects/${projectId}/todos`, {
    title: 'p881 seam1 pinned runtime-blocked',
    spec: 'probe todo',
    machineId: M_PIN.id,
  })
).json;
const build1 = (
  await api('POST', `/api/projects/${projectId}/builds`, {
    todoIds: [todo1.id],
    assignment: { plan: null, build: { agentId: ccAgent.id } },
    withPlan: false,
  })
).json.builds[0];
const steps1 = (await api('GET', `/api/builds/${build1.id}/steps`)).json;
const step1 = (steps1.steps ?? steps1).find((s) => s.status === 'pending');
check('seam1: build started, step pending', Boolean(step1), JSON.stringify(steps1));

// 回拨步龄过宽限(有界复现:不真等 10 分钟)。
sqlite((db) => {
  db.prepare('update step set createdAt = ? where id = ?').run(now() - GRACE_MS - 60_000, step1.id);
});

// 等真实 scheduler tick(schedulerTickMs 15s)两拍,让 sweep 真跑。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(33_000);

const steps1b = (await api('GET', `/api/builds/${build1.id}/steps`)).json;
const step1b = (steps1b.steps ?? steps1b).find((s) => s.id === step1.id);
const build1b = (await api('GET', `/api/builds/${build1.id}`)).json;
const build1bRow = build1b.build ?? build1b;
const todos = (await api('GET', '/api/todos')).json;
const todo1Row = (todos.todos ?? todos).find((t) => t.id === todo1.id);
dump('seam1-after-tick.json', { step: step1b, build: build1bRow, todo: todo1Row });

if (EXPECT === 'new') {
  check('seam1: step failed (bounded wait closes)', step1b?.status === 'failed', step1b?.status);
  const msg = build1bRow?.errorMessage ?? '';
  check(
    'seam1: failure copy names machine + runtime + exit',
    msg.includes('pin-blocked') && msg.includes('claude-code') && msg.includes('改为其它在线机器'),
    msg,
  );
  check('seam1: pin preserved (no silent reassign)', build1bRow?.pinnedMachineId === M_PIN.id);
  check('seam1: todo phase failed', todo1Row?.phase === 'failed', todo1Row?.phase);
} else {
  check('seam1 BEFORE: step still pending (unbounded wait, the seam)', step1b?.status === 'pending', step1b?.status);
  check('seam1 BEFORE: no errorMessage', (build1bRow?.errorMessage ?? null) === null, build1bRow?.errorMessage);
  // 步从未被领取 → 相位停在 queued(queued→building 发生在 claim 面)。
  check('seam1 BEFORE: todo still queued (never claimed)', todo1Row?.phase === 'queued', todo1Row?.phase);
}

// —— 缝 ②:会话机在线但楔住 ——————————————————————————————————————————————

const todo2 = (
  await api('POST', `/api/projects/${projectId}/todos`, {
    title: 'p881 seam2 session wedge',
    spec: 'probe todo 2',
  })
).json;
const build2 = (
  await api('POST', `/api/projects/${projectId}/builds`, {
    todoIds: [todo2.id],
    assignment: { plan: null, build: { agentId: piAgent.id } },
    withPlan: false,
  })
).json.builds[0];
const steps2 = (await api('GET', `/api/builds/${build2.id}/steps`)).json;
const step2 = (steps2.steps ?? steps2).find((s) => s.status === 'pending');
check('seam2: build started, step pending', Boolean(step2), JSON.stringify(steps2));

// 种历史会话链(prior done 步持会话在 X)+ 回拨步龄过宽限。
sqlite((db) => {
  db.prepare('insert into step (id, buildId, kind, status, machineId, sessionId, createdAt) values (?,?,?,?,?,?,?)').run(
    `step-prior-${build2.id}`,
    build2.id,
    'build',
    'done',
    X_SESS.id,
    'sess-881',
    now() - GRACE_MS - 120_000,
  );
  db.prepare('update step set createdAt = ? where id = ?').run(now() - GRACE_MS - 60_000, step2.id);
});

// Y 的 claim:亲和闸判定面(长轮询空手 ≈ 75s,有界)。
const claimY = await api('POST', '/api/machine/tasks/claim', {}, Y_BY.token);
const claimedStep = claimY.json?.step ?? null;
dump('seam2-claim-bystander.json', { status: claimY.status, step: claimedStep });

if (EXPECT === 'new') {
  check(
    'seam2: bystander claims after grace (wedge bound)',
    claimedStep?.step?.id === step2.id,
    JSON.stringify(claimedStep?.step?.id ?? null),
  );
  check(
    'seam2: switch contract unchanged (continue payload)',
    claimedStep?.session?.action === 'continue' && claimedStep?.session?.sessionId === 'sess-881',
    JSON.stringify(claimedStep?.session ?? null),
  );
  // 收尾该步,别让后续 claim 误领(done 由机器报;探针直写终态即可,判据已取到)。
  sqlite((db) => {
    db.prepare('update step set status = ? where id = ?').run('done', step2.id);
  });
} else {
  check(
    'seam2 BEFORE: bystander starves (affinity hold unbounded, the seam)',
    claimedStep === null,
    JSON.stringify(claimedStep?.step?.id ?? null),
  );
  // BEFORE 栈没有收口:把步标 failed 防后续误领(判据已取到)。
  sqlite((db) => {
    db.prepare('update step set status = ? where id = ?').run('failed', step2.id);
  });
}

// —— 忙保护:X 忙(持有 claimed 步)时 Y 不误抢 ————————————————————————————

const todo3 = (
  await api('POST', `/api/projects/${projectId}/todos`, {
    title: 'p881 busy-guard',
    spec: 'probe todo 3',
  })
).json;
const build3 = (
  await api('POST', `/api/projects/${projectId}/builds`, {
    todoIds: [todo3.id],
    assignment: { plan: null, build: { agentId: piAgent.id } },
    withPlan: false,
  })
).json.builds[0];
const steps3 = (await api('GET', `/api/builds/${build3.id}/steps`)).json;
const step3 = (steps3.steps ?? steps3).find((s) => s.status === 'pending');

sqlite((db) => {
  db.prepare('insert into step (id, buildId, kind, status, machineId, sessionId, createdAt) values (?,?,?,?,?,?,?)').run(
    `step-prior-${build3.id}`,
    build3.id,
    'build',
    'done',
    X_SESS.id,
    'sess-881-b',
    now() - GRACE_MS - 120_000,
  );
  db.prepare('update step set createdAt = ? where id = ?').run(now() - GRACE_MS - 60_000, step3.id);
  // X 忙:另一条 claimed 步挂它名下,心跳新鲜。
  db.prepare(
    'insert into step (id, buildId, kind, status, machineId, createdAt, claimedAt, lastHeartbeatAt) values (?,?,?,?,?,?,?,?)',
  ).run(`step-busy-${build3.id}`, build3.id, 'build', 'claimed', X_SESS.id, now() - 300_000, now() - 300_000, now() - 10_000);
});

const claimY2 = await api('POST', '/api/machine/tasks/claim', {}, Y_BY.token);
const claimed2 = claimY2.json?.step ?? null;
dump('busy-guard-claim-bystander.json', { status: claimY2.status, step: claimed2 });
check(
  'busy guard: bystander still starves while session machine is busy (both modes)',
  claimed2 === null,
  JSON.stringify(claimed2?.step?.id ?? null),
);

// —— 汇总 ————————————————————————————————————————————————————————————————

const failed = checks.filter((c) => !c.ok);
dump('result.json', {
  probe: 'drive-881',
  expect: EXPECT,
  port: PORT,
  db: DB_PATH,
  repo: REPO,
  at: new Date().toISOString(),
  checks,
  summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length },
});
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed (expect=${EXPECT})`);
process.exit(failed.length > 0 ? 1 : 0);
