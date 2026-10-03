#!/usr/bin/env node
// probe-705 — B-C3 复验：门页放行后首个页面生命周期内，服务端相位变化实时到达 UI。
//
// 复现 #519 B-C3 的观测形态（部署同源形：server 托管 apps/web/dist，非 vite dev
// 代理形），在**当前 main** 上重放完整时间线：
//
//   seed（REST，Bearer gate token）：agent → hosted 项目 → todo → api-key
//   机器面（/api/machine/* 豁免门 token，自有 Bearer）：enroll → 开 build
//   （withPlan）→ claim（phase → planning）
//   浏览器（全新 context = 清 storage）：/app → 401 → 门页 → 输 token 放行
//   → 看板 → 点卡进详情（chip=规划中，全程零 reload）
//   Node 侧：POST /api/machine/done/{stepId} {status:'failed'}
//   断言：详情 chip 规划中 → 失败 页内实时翻（无手动刷新），latency 记录。
//
// 观测面：
//   - EventSource 构造记录（addInitScript patch，含 open/error 时刻与 URL）
//   - Playwright request/response 日志（stream 端点的网络侧时间线）
//   - window.__probeAlive 标记 = 零 reload 证明（reload 即丢）
//   - SQLite 真值（todo.phase / step.status / build.errorMessage）
//
// 隔离：OS 空闲端口 + mkdtemp PACMAN_HOME scratch + PACMAN_SKILLS_DIR 空目录；
// 收尾只杀自己 spawn 的进程组（双标记 = 自持 pid），scratch 删除，证据保留。
//
// 用法：node .claude/verify-shots/probe-705-gate-sse.mjs
// 证据：VERIFY_EVIDENCE_DIR（缺省 <repo>/.claude/verify-evidence/<ts>-probe-705-gate-sse/）

import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
// repo 根定位与脚本落点解耦（.claude/verify-shots/ 与 docs/verify/705/ 两份同文）：
// VERIFY_REPO_ROOT 显式优先，否则 git toplevel（worktree 内即本检出根）。
const REPO =
  process.env.VERIFY_REPO_ROOT !== undefined && process.env.VERIFY_REPO_ROOT !== ''
    ? resolve(process.env.VERIFY_REPO_ROOT)
    : spawnSync('git', ['rev-parse', '--show-toplevel'], {
        cwd: SCRIPT_DIR,
        encoding: 'utf8',
      }).stdout.trim();
const GATE_TOKEN = 'pacman-probe-705-gate-token-0123456789abcdef';
const CARD_TITLE = 'B-C3 复验探针';
const FAIL_MESSAGE = 'probe-705 forced step failure (B-C3 replay)';
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const EVIDENCE =
  process.env.VERIFY_EVIDENCE_DIR ??
  join(REPO, `.claude/verify-evidence/${ts}-probe-705-gate-sse`);
mkdirSync(EVIDENCE, { recursive: true });

const HEAD_SHA = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' })
  .stdout.trim();

const checks = [];
function check(name, ok, detail) {
  // 断言位必须真是 boolean（仓内 drive-* 同款护栏）——写反会恒真。
  if (typeof ok !== 'boolean') {
    throw new TypeError(`check(${JSON.stringify(name)}) 的 ok 位须为 boolean，收到 ${typeof ok}`);
  }
  checks.push({ name, ok, detail: detail ?? null });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}\n`);
}

const artifacts = [];

/** 时间线：全部 Date.now()（Node 与页面同机同时钟，可直接相减）。 */
const timeline = {};
const mark = (name) => {
  timeline[name] = Date.now();
};

let serverProc = null;
let serverLogFd = null;
let homeDir = null;
let browser = null;
let base = null;

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address !== null && typeof address === 'object') {
        const { port } = address;
        probe.close(() => resolvePort(port));
      } else {
        probe.close(() => reject(new Error('freePort: no address')));
      }
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(method, path, body, token) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token !== undefined ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  return { status: res.status, body: text === '' ? null : JSON.parse(text) };
}

async function main() {
  // —— 1. web dist（fixture 模式构建，live 面 = URL 不带 ?scenario=，
  //       token-gate.spec 同款形态）———————————————————————————————
  const distDir = join(REPO, 'apps/web/dist');
  if (!existsSync(join(distDir, 'index.html'))) {
    process.stdout.write('building web dist (vite build --mode fixture)...\n');
    const built = spawnSync('pnpm', ['exec', 'vite', 'build', '--mode', 'fixture'], {
      cwd: join(REPO, 'apps/web'),
      stdio: 'inherit',
    });
    if (built.status !== 0) throw new Error('vite build failed');
  }

  // —— 2. 隔离栈：空闲端口 + scratch home + 同源托管 ————————————————
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  homeDir = mkdtempSync(join(tmpdir(), 'pacman-probe-705-home-'));
  mkdirSync(join(homeDir, 'skills'), { recursive: true });
  serverLogFd = openSync(join(EVIDENCE, 'server.log'), 'a');
  serverProc = spawn('pnpm', ['exec', 'tsx', 'src/index.ts'], {
    cwd: join(REPO, 'apps/server'),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      PACMAN_HOME: homeDir,
      PACMAN_SKILLS_DIR: join(homeDir, 'skills'),
      PACMAN_WEB_DIR: distDir,
      PACMAN_TOKEN: GATE_TOKEN,
    },
    detached: true,
    stdio: ['ignore', serverLogFd, serverLogFd],
  });
  serverProc.unref();
  mark('serverSpawn');

  // ready = /api/teams 打出 401（鉴权开）且 /app 200（dist 托管）
  {
    const deadline = Date.now() + 60_000;
    let apiUp = false;
    let webUp = false;
    for (;;) {
      if (!apiUp) {
        try {
          const res = await fetch(`${base}/api/teams`, { signal: AbortSignal.timeout(2000) });
          if (res.status === 401) apiUp = true;
        } catch { /* 未就绪 */ }
      }
      if (apiUp && !webUp) {
        try {
          const res = await fetch(`${base}/app`, { signal: AbortSignal.timeout(2000) });
          if (res.status === 200) webUp = true;
        } catch { /* 未就绪 */ }
      }
      if (apiUp && webUp) break;
      if (Date.now() > deadline) throw new Error(`server not ready on ${base}`);
      await sleep(300);
    }
  }
  mark('serverReady');

  // —— 3. seed（REST，Bearer gate token）—————————————————————————————
  const teams = await json('GET', '/api/teams', undefined, GATE_TOKEN);
  if (teams.status !== 200) throw new Error(`GET /api/teams → ${teams.status}`);
  const teamId = teams.body[0].id;

  const key = await json(
    'POST',
    `/api/teams/${teamId}/api-keys`,
    { name: 'probe-705-machine', gitAccess: false, mcpAccess: false, toolGrants: { read: [], write: [] } },
    GATE_TOKEN,
  );
  if (key.status !== 201) throw new Error(`api-keys → ${key.status}`);
  const apiKey = key.body.plaintext;

  const agent = await json(
    'POST',
    `/api/teams/${teamId}/agents`,
    { displayName: 'probe-builder', provider: 'probe-gw', modelId: 'probe-model' },
    GATE_TOKEN,
  );
  if (agent.status !== 201) throw new Error(`agents → ${agent.status}`);
  const agentId = agent.body.id;

  const project = await json(
    'POST',
    '/api/projects',
    { name: 'probe-705', teamId, kind: 'hosted' },
    GATE_TOKEN,
  );
  if (project.status !== 201) throw new Error(`projects → ${project.status}`);
  const projectId = project.body.id;

  const todo = await json(
    'POST',
    `/api/projects/${projectId}/todos`,
    { title: CARD_TITLE, spec: '门页放行后 SSE 活性复验（#705 / B-C3）' },
    GATE_TOKEN,
  );
  if (todo.status !== 201 && todo.status !== 200) throw new Error(`todos → ${todo.status}`);
  const todoId = todo.body.id;

  // 机器面（/api/machine/* 豁免门 token）：enroll → build → claim
  const enroll = await json(
    'POST',
    '/api/machine/enroll',
    { teamId, name: 'probe-machine-705' },
    apiKey,
  );
  if (enroll.status !== 200) throw new Error(`enroll → ${enroll.status}`);
  const machineToken = enroll.body.token;

  const started = await json(
    'POST',
    `/api/projects/${projectId}/builds`,
    {
      todoIds: [todoId],
      assignment: { plan: { agentId }, build: { agentId } },
      withPlan: true,
    },
    GATE_TOKEN,
  );
  if (started.status !== 201) throw new Error(`builds → ${started.status} ${JSON.stringify(started.body)}`);
  const buildId = started.body.builds[0].id; // buildId ≡ conversationId

  const claim = await json('POST', '/api/machine/tasks/claim', {}, machineToken);
  if (claim.status !== 200) throw new Error(`claim → ${claim.status}`);
  // 双层包装（{step:{step,agent,session}}）——两形防御取 stepId
  const stepId = claim.body.step?.step?.id ?? claim.body.step?.id;
  if (!stepId) throw new Error(`claim shape unknown: ${JSON.stringify(claim.body).slice(0, 300)}`);

  const prePhase = await json('GET', `/api/todos/${todoId}`, undefined, GATE_TOKEN);
  if (prePhase.body.phase !== 'planning') {
    throw new Error(`pre-fail phase = ${prePhase.body.phase}, expected planning`);
  }
  mark('seedDone');
  process.stdout.write(`seed ok: todo=${todoId} build=${buildId} step=${stepId} phase=planning\n`);

  // —— 4. 浏览器：清 storage（全新 context）→ 门页 → 放行 → 详情 ——————————
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 732 } });
  const page = await context.newPage();

  /** 网络侧 stream 时间线（独立于页内 patch 的第二观测面）。 */
  const netLog = [];
  page.on('request', (req) => {
    if (req.url().includes('/stream')) netLog.push({ kind: 'request', url: req.url(), t: Date.now() });
  });
  page.on('response', (res) => {
    if (res.url().includes('/stream')) {
      netLog.push({ kind: 'response', url: res.url(), status: res.status(), t: Date.now() });
    }
  });

  // EventSource 构造记录（token-gate.spec 同款 patch + open/error 时刻；
  // statics/prototype 补齐——sse-connection 的 watchdog 读 EventSource.OPEN）。
  await page.addInitScript(() => {
    const log = [];
    window.__esLog = log;
    const Native = window.EventSource;
    const Patched = function (url, init) {
      const entry = { url: String(url), tConstruct: Date.now(), events: [] };
      log.push(entry);
      const es = new Native(url, init);
      es.addEventListener('open', () => entry.events.push({ type: 'open', t: Date.now() }));
      es.addEventListener('error', () =>
        entry.events.push({ type: 'error', t: Date.now(), readyState: es.readyState }),
      );
      return es;
    };
    Patched.prototype = Native.prototype;
    Patched.CONNECTING = Native.CONNECTING;
    Patched.OPEN = Native.OPEN;
    Patched.CLOSED = Native.CLOSED;
    window.EventSource = Patched;
  });

  mark('navStart');
  await page.goto(`${base}/app`, { waitUntil: 'domcontentloaded' });

  // 失败方式 1（#253 契约）：清 storage 首访 → 401 → 门页盖住 UI
  await page.locator('.token-gate').waitFor({ state: 'visible', timeout: 30_000 });
  mark('gateVisible');
  await page.screenshot({ path: join(EVIDENCE, '01-gate.png') });
  artifacts.push('01-gate.png');

  // 门页期零建流断言素材：此刻 __esLog 应为空（#519 的「启动即建流→401」形态
  // 在当前 main 上不发生——门页开着不建流）。
  const esLogAtGate = await page.evaluate(() => window.__esLog ?? []);

  await page.locator('.token-gate-input').fill(GATE_TOKEN);
  await page.locator('.token-gate-submit').click();
  await page.locator('.token-gate').waitFor({ state: 'detached', timeout: 30_000 });
  await page.locator('.board-sidebar').waitFor({ state: 'visible', timeout: 30_000 });
  mark('gatePassed');

  // 放行后看板呈现，卡在飞列（planning）——点卡进详情（client-side，零 reload）
  const card = page.locator('.todo-card-link', { hasText: CARD_TITLE }).first();
  await card.waitFor({ state: 'visible', timeout: 30_000 });
  await page.screenshot({ path: join(EVIDENCE, '02-board-after-pass.png') });
  artifacts.push('02-board-after-pass.png');
  await card.click();

  const chip = page.locator('.detail-chip');
  await chip.waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(
    () => document.querySelector('.detail-chip')?.textContent?.includes('规划中') === true,
    null,
    { timeout: 30_000 },
  );
  mark('detailPlanning');
  await page.screenshot({ path: join(EVIDENCE, '03-detail-planning.png') });
  artifacts.push('03-detail-planning.png');

  // 零 reload 标记：任何整页重载都会丢它（addInitScript 不恢复此值）。
  await page.evaluate(() => {
    window.__probeAlive = 'probe-705';
  });

  const esLogPreFail = await page.evaluate(() => window.__esLog ?? []);

  // —— 5. 服务端步失败（机器面回写，B-C3 的触发事件）————————————————
  mark('failPost');
  const done = await json(
    'POST',
    `/api/machine/done/${stepId}`,
    { status: 'failed', errorMessage: FAIL_MESSAGE },
    machineToken,
  );
  if (done.status !== 200) throw new Error(`done → ${done.status} ${JSON.stringify(done.body)}`);

  // —— 6. 核心断言：chip 页内实时翻 规划中 → 失败（无手动刷新）—————————
  await page.waitForFunction(
    () => document.querySelector('.detail-chip')?.textContent?.includes('失败') === true,
    null,
    { timeout: 30_000 },
  );
  mark('chipFlipped');
  await page.screenshot({ path: join(EVIDENCE, '04-detail-failed-flipped.png') });
  artifacts.push('04-detail-failed-flipped.png');

  const alive = await page.evaluate(() => window.__probeAlive ?? null);
  const esLogFinal = await page.evaluate(() => window.__esLog ?? []);

  // failed 相位的 header 主按钮 = 重跑（PHASE_UI.failed.action）——相位驱动
  // 渲染更新的第二信号（best-effort，短超时）。
  let rerunVisible = false;
  try {
    await page
      .locator('button', { hasText: '重跑' })
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 });
    rerunVisible = true;
  } catch {
    rerunVisible = false;
  }

  // —— 7. SQLite 真值（服务端侧确认失败已落库）————————————————————
  const require2 = createRequire(join(REPO, 'apps/server/package.json'));
  const Database = require2('better-sqlite3');
  const dbPath = join(homeDir, 'server/server.db');
  const db = new Database(dbPath, { readonly: true });
  const todoRow = db.prepare('SELECT phase FROM todo WHERE id = ?').get(todoId);
  const stepRow = db.prepare('SELECT status FROM step WHERE id = ?').get(stepId);
  const buildRow = db.prepare('SELECT errorMessage FROM build WHERE id = ?').get(buildId);
  db.close();

  // —— 8. 判定汇总 ————————————————————————————————————————————————
  const streamUrls = esLogFinal.map((e) => e.url);
  const tokenStreams = streamUrls.filter(
    (u) => u.includes('/stream?') && new URL(u, base).searchParams.get('token') === GATE_TOKEN,
  );
  const teamStream = tokenStreams.find((u) => u.includes(`/api/teams/${teamId}/stream`));
  const convStream = tokenStreams.find((u) => u.includes(`/api/conversations/${buildId}/stream`));
  const noTokenStreams = streamUrls.filter((u) => !u.includes('token='));

  check('清 storage 首访 → 门页盖住 UI（#253 失败方式 1）', true, `t=${timeline.gateVisible}`);
  check(
    '门页期零 EventSource 构造（#519「启动即建流→401」形态不存在）',
    esLogAtGate.length === 0,
    `门页期构造数 = ${esLogAtGate.length}`,
  );
  check(
    '放行后零 reload 进详情，chip=规划中（首个页面生命周期内）',
    alive === 'probe-705',
    `__probeAlive = ${JSON.stringify(alive)}`,
  );
  check(
    '放行后 team stream 以 ?token= 建流',
    teamStream !== undefined,
    teamStream ?? `实际 URL 集 = ${JSON.stringify(streamUrls)}`,
  );
  check(
    '进详情后 conversation stream 以 ?token= 建流',
    convStream !== undefined,
    convStream ?? `实际 URL 集 = ${JSON.stringify(streamUrls)}`,
  );
  check('全程无「不带 token 的裸 stream」构造', noTokenStreams.length === 0, JSON.stringify(noTokenStreams));
  check(
    '服务端步失败 → chip 页内实时翻「失败」（零 reload）',
    alive === 'probe-705' && todoRow?.phase === 'failed',
    `flip latency = ${timeline.chipFlipped - timeline.failPost}ms`,
  );
  check('failed 相位 header 出现「重跑」主按钮', rerunVisible);
  check('SQLite 真值：todo.phase=failed', todoRow?.phase === 'failed', JSON.stringify(todoRow));
  check('SQLite 真值：step.status=failed', stepRow?.status === 'failed', JSON.stringify(stepRow));
  check(
    'SQLite 真值：build.errorMessage 落库',
    buildRow?.errorMessage === FAIL_MESSAGE,
    JSON.stringify(buildRow),
  );

  const result = {
    probe: 'probe-705-gate-sse',
    issue: 705,
    verdict: checks.every((c) => c.ok) ? 'NOT_REPRODUCIBLE_ON_CURRENT_MAIN' : 'CHECKS_FAILED',
    headSha: HEAD_SHA,
    stack: {
      base,
      shape: 'same-origin production-like (server hosts apps/web/dist, PACMAN_TOKEN on)',
      distDir,
      homeDir,
    },
    timeline,
    flipLatencyMs: timeline.chipFlipped - timeline.failPost,
    gateToDetailMs: timeline.detailPlanning - timeline.gatePassed,
    checks,
    esLog: esLogFinal,
    esLogAtGate,
    netLog,
    dbTruth: { todo: todoRow, step: stepRow, build: buildRow },
    artifacts,
  };
  writeFileSync(join(EVIDENCE, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(
    `\nverdict: ${result.verdict}\nflip latency: ${result.flipLatencyMs}ms\nevidence: ${EVIDENCE}\n`,
  );
  if (!checks.every((c) => c.ok)) process.exitCode = 1;
}

function groupAlive(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function cleanup() {
  // 只杀自己 spawn 的进程组（自持 pid = 双标记纪律的单机形态），绝不按名扫杀。
  if (serverProc?.pid && groupAlive(serverProc.pid)) {
    process.kill(-serverProc.pid, 'SIGTERM');
    const deadline = Date.now() + 6_000;
    while (groupAlive(serverProc.pid) && Date.now() < deadline) await sleep(300);
    if (groupAlive(serverProc.pid)) process.kill(-serverProc.pid, 'SIGKILL');
  }
  if (serverLogFd !== null) {
    try {
      // server.log 收进证据（连接/请求侧旁证）
      closeSync(serverLogFd);
    } catch { /* already closed */ }
  }
  await browser?.close();
  if (homeDir) rmSync(homeDir, { recursive: true, force: true });
}

main()
  .catch((err) => {
    process.stdout.write(`\nPROBE ERROR: ${err?.stack ?? err}\n`);
    // 失败路径也留现场记录
    try {
      writeFileSync(
        join(EVIDENCE, 'result.json'),
        `${JSON.stringify({ probe: 'probe-705-gate-sse', verdict: 'PROBE_ERROR', error: String(err?.message ?? err), timeline, checks, headSha: HEAD_SHA }, null, 2)}\n`,
      );
    } catch { /* evidence dir gone */ }
    process.exitCode = 1;
  })
  .finally(cleanup);
