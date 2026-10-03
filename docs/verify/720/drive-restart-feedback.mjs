#!/usr/bin/env node
// verify-pacman 定制 probe（#720）：失败重启轮的反馈指令真的进 agent 会话。
//
// 全链 = launch.mjs 隔离栈（8791/5273）+ 本进程内 stub LLM（8923，全量录请求体）
// + 真 daemon（tsx start -f，scratch home，进程退出时自回收）。
// 场景 A（票面验收）：failed todo → 详情页 composer 填返工理由 → 发送（restart
// wire）→ 新轮实跑 → agent 实际收到「任务文本 + 重启指令」组合串——证据三面：
// stub 请求体（agent 真收到的）、transcript 读面 wire 行、DB 真值（step.prompt /
// 反馈用户行）。
// 场景 B（票面负例）：空白反馈 restart → 无 instruction、无空白用户行、会话
// prompt = 纯任务文本。
// UI 面断言（F13 live）：组合行被过滤——时间线不出现「上一轮执行失败」字样的
// 气泡，反馈原文气泡在位。
//
// 用法（栈在跑）：node docs/verify/720/drive-restart-feedback.mjs
// 证据落本文件同目录（docs/verify/720/，随 PR 进仓）。

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const REPO = process.env.VERIFY_REPO_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(REPO, '.claude/verify-run');
const ports = existsSync(join(RUN_DIR, 'ports.json'))
  ? JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'))
  : {};
const SERVER = `http://127.0.0.1:${ports.serverPort ?? process.env.VERIFY_PORT ?? 8791}`;
const WEB = `http://127.0.0.1:${ports.webPort ?? process.env.VERIFY_WEB_PORT ?? 5273}`;
const DB_PATH = join(RUN_DIR, 'home/server/server.db');
const EVIDENCE = join(REPO, 'docs/verify/720');
const STUB_PORT = Number(process.env.STUB_PORT ?? 8923);
const require2 = createRequire(join(REPO, 'apps/server/package.json'));

// —— shared 单源对账常量（与实现同字面，driver 不自拼第二份）——————
const RESTART_HEAD = '上一轮执行失败。用户反馈：「';
const RESTART_TAIL =
  '」。请把反馈纳入本轮：涉及方案先输出更新后的 plan.md（覆盖 Context/Changes/Edge cases/Verification 四段），再忠实执行完成任务。';

const checks = [];
function check(name, ok, detail) {
  if (typeof ok !== 'boolean') {
    throw new TypeError(`check(${name}) ok 位须为 boolean`);
  }
  checks.push({ name, ok, detail: detail ?? null });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}\n`);
}

const getJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  return { status: res.status, body };
};
const postJson = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = await res.text();
  }
  return { status: res.status, body: parsed };
};

async function waitFor(desc, fn, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await fn()) return;
    if (Date.now() > deadline) throw new Error(`waitFor timeout: ${desc}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** message.content 是 JSON 列：字符串字面量解回裸文本，其余原样。 */
function decodeContent(raw) {
  if (typeof raw !== 'string') return raw;
  try {
    const v = JSON.parse(raw);
    return typeof v === 'string' ? v : raw;
  } catch {
    return raw;
  }
}

/** stub 请求里的 user 消息文本（openai 双形：string 或 text parts）。 */
function userWireText(m) {
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) {
    return m.content
      .filter((p) => p && typeof p === 'object' && p.type === 'text')
      .map((p) => p.text)
      .join('');
  }
  return null;
}

// —— stub LLM（响应脚本序：A 轮 400 失败 → A 重启轮文本 → B 轮 400 → B 重启轮文本）
const stubRequests = [];
let stubNext = 0;
const stubResponses = [
  { status: 400 },
  { content: '已把返工理由纳入本轮方案，重启轮执行完毕。' },
  { status: 400 },
  { content: '空白反馈重启轮照常执行。' },
];
const stubServer = createServer((req, res) => {
  if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
    res.writeHead(404).end();
    return;
  }
  let body = '';
  req.on('data', (d) => {
    body += d;
  });
  req.on('end', () => {
    stubRequests.push(JSON.parse(body));
    const rsp = stubResponses[Math.min(stubNext, stubResponses.length - 1)];
    stubNext += 1;
    if (rsp.status !== undefined && rsp.status >= 400) {
      res.writeHead(rsp.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'stub provider error', type: 'invalid_request_error' } }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const base = { id: 'chatcmpl-stub', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'stub-model' };
    res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: '' } }] })}\n\n`);
    for (const word of (rsp.content ?? 'ok').split(/(?<=。)/u)) {
      if (word === '') continue;
      res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { content: word } }] })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 9, total_tokens: 21 } })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });
});
await new Promise((r) => stubServer.listen(STUB_PORT, '127.0.0.1', r));
process.stdout.write(`stub listening on ${STUB_PORT}\n`);

// —— seed：team / provider / agent / project / todo ×2 / api-key ————————————
const teams = await getJson(`${SERVER}/api/teams`);
const teamId = teams.body?.[0]?.id;
if (!teamId) throw new Error('no team');
const prov = await postJson(`${SERVER}/api/teams/${teamId}/providers`, {
  providerId: 'stub-gw',
  label: 'Stub Gateway',
  baseUrl: `http://127.0.0.1:${STUB_PORT}/v1`,
  api: 'openai-completions',
  authHeader: true,
  compat: { supportsDeveloperRole: false },
  models: [{ id: 'stub-model', name: 'stub-model' }],
});
if (![201, 200, 409].includes(prov.status)) throw new Error(`provider ${prov.status}`);
const agent = await postJson(`${SERVER}/api/teams/${teamId}/agents`, {
  displayName: 'verify-720-builder',
  provider: 'stub-gw',
  modelId: 'stub-model',
});
const agentId = agent.body?.id;
if (!agentId) throw new Error('agent missing id');
const project = await postJson(`${SERVER}/api/projects`, { name: '720-restart-probe' });
const projectId = project.body?.id;

async function seedTodo(title, spec) {
  const t = await postJson(`${SERVER}/api/projects/${projectId}/todos`, { title, spec });
  return t.body.id;
}
const A_TITLE = '重启反馈探针';
const A_SPEC = '第一轮会失败，重启轮要把返工理由带进会话。';
const B_TITLE = '空白反馈探针';
const B_SPEC = '重启轮不注入空指令。';
const todoA = await seedTodo(A_TITLE, A_SPEC);
const todoB = await seedTodo(B_TITLE, B_SPEC);

const apiKey = await postJson(`${SERVER}/api/teams/${teamId}/api-keys`, {
  name: 'verify-720-mbp',
  gitAccess: false,
  mcpAccess: false,
  toolGrants: { read: [], write: [] },
});
const apiKeyPlain = apiKey.body?.plaintext;
if (!apiKeyPlain) throw new Error('api-key missing plaintext');

// —— daemon（真进程，scratch home；退出时自回收）—————————————————————
const daemonHome = `/tmp/pacman-720-daemon-${Date.now()}`;
mkdirSync(daemonHome, { recursive: true });
const daemonEnv = { ...process.env };
for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'ALL_PROXY']) {
  delete daemonEnv[k];
}
daemonEnv.PACMAN_HOME = daemonHome;
const daemon = spawn(
  'pnpm',
  [
    'exec',
    'tsx',
    'src/cli.ts',
    'start',
    '--foreground',
    '--server',
    SERVER,
    '--api-key',
    apiKeyPlain,
    '--team',
    teamId,
    '--name',
    'verify-720-mbp',
  ],
  // detached 成组：kill 要打进程组（-pid）——只杀 pnpm wrapper 会让真 daemon
  // 子进程孤儿化，孤儿会抢领后续轮（实测：上一轮孤儿领走下一轮的步后死亡，
  // 步卡 claimed）。
  { cwd: join(REPO, 'apps/daemon'), env: daemonEnv, stdio: ['ignore', 'pipe', 'pipe'], detached: true },
);
const daemonOut = [];
daemon.stdout.on('data', (d) => daemonOut.push(String(d)));
daemon.stderr.on('data', (d) => daemonOut.push(String(d)));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 }, colorScheme: 'dark' });

let killed = false;
async function cleanup() {
  if (!killed) {
    killed = true;
    const groupKill = (sig) => {
      try {
        process.kill(-daemon.pid, sig);
      } catch {
        daemon.kill(sig);
      }
    };
    groupKill('SIGTERM');
    await new Promise((r) => {
      const t = setTimeout(() => {
        groupKill('SIGKILL');
        r();
      }, 6000);
      daemon.once('exit', () => {
        clearTimeout(t);
        r();
      });
    });
  }
  await browser.close();
  stubServer.close();
  writeFileSync(join(EVIDENCE, 'daemon-output.txt'), daemonOut.join(''));
}

try {
  // 机器在线（enroll + presence 起效）
  await waitFor('machine online', async () => {
    const ms = await getJson(`${SERVER}/api/teams/${teamId}/machines`);
    return (ms.body ?? []).some((m) => m.online === true);
  });
  check('machine-online', true, 'daemon enrolled + online');

  // —— 场景 A：失败轮（stub 400）→ failed ————————————————————————————
  const startA = await postJson(`${SERVER}/api/projects/${projectId}/builds`, {
    todoIds: [todoA],
    assignment: { plan: { agentId }, build: { agentId } },
    withPlan: true,
  });
  if (startA.status !== 201) throw new Error(`startA ${startA.status} ${JSON.stringify(startA.body)}`);
  const failedBuildA = startA.body?.builds?.[0]?.id;
  await waitFor('todo A failed', async () => (await getJson(`${SERVER}/api/todos/${todoA}`)).body?.phase === 'failed', 120_000);
  check('round1-failed', true, 'stub 400 → 步 failed → todo failed');

  const feedback = `把失败原因写进方案，并补上验证步骤 ${Date.now() % 100000}`;
  const taskTextA = `${A_TITLE}\n\n${A_SPEC}`;
  const expectedComposed = `${taskTextA}\n\n${RESTART_HEAD}${feedback}${RESTART_TAIL}`;

  // UI：failed 详情页 composer 填反馈 → 发送（restart wire）
  await page.goto(`${WEB}/app/todo/${todoA}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.composer', { timeout: 15_000 });
  await page.fill('.composer-input', feedback);
  const filled = await page.locator('.composer-input').inputValue();
  check('draft-filled', filled === feedback, '返工理由入 draft');
  await page.screenshot({ path: join(EVIDENCE, 'A1-failed-composer-filled.png') });
  // 发送钮被 .detail-fab 覆盖（既有 gotcha）：dispatchEvent 驱动 wire
  await page.locator('.composer-send').dispatchEvent('click');
  check('send-clicked', true, 'failed 相位发送 = restart 语义（UI composer 真路径）');

  // 新轮实跑到 confirm
  await waitFor('todo A confirm', async () => (await getJson(`${SERVER}/api/todos/${todoA}`)).body?.phase === 'confirm', 120_000);
  const todoAAfter = await getJson(`${SERVER}/api/todos/${todoA}`);
  const newBuildA = todoAAfter.body?.latestBuildId;
  check('round2-confirm', Boolean(newBuildA) && newBuildA !== failedBuildA, `重启轮实跑到 confirm（新 build ${String(newBuildA).slice(0, 8)}…）`);
  await page.waitForTimeout(1200); // SSE 收尾 + 终稿行落库后的稳定窗口
  await page.screenshot({ path: join(EVIDENCE, 'A2-restart-round-timeline.png') });

  // 对账面 1：stub 请求体——agent 实际收到的会话首条 user 消息 = 组合串
  const sawComposed = stubRequests.some((r) =>
    (r.messages ?? []).some((m) => m.role === 'user' && userWireText(m) === expectedComposed),
  );
  check('llm-received-composed', sawComposed, 'stub 请求体含「任务文本 + 重启指令」组合串（agent 真收到返工理由）');

  // 对账面 2：transcript 读面 wire 行（user-<stepId> 行 = 组合串）
  const face = await getJson(`${SERVER}/api/conversations/${newBuildA}/messages`);
  const rowsA = face.body?.messages ?? [];
  const wireRow = rowsA.find((m) => m.role === 'user' && m.content === expectedComposed);
  check('transcript-wire-row', Boolean(wireRow), 'transcript 读面含组合串 wire 行（票面验收：transcript 里可见）');
  writeFileSync(join(EVIDENCE, 'A-transcript.json'), `${JSON.stringify(rowsA, null, 2)}\n`);

  // 对账面 3：DB 真值（step.prompt = 重启指令；反馈用户行在位）
  const Database = require2('better-sqlite3');
  const db = new Database(DB_PATH, { readonly: true });
  const firstStepA = db
    .prepare('SELECT kind, status, prompt FROM step WHERE buildId = ? ORDER BY rowid ASC')
    .get(newBuildA);
  const userRowsA = db
    .prepare("SELECT role, content FROM message WHERE conversationId = ? AND role = 'user'")
    .all(newBuildA)
    .map((m) => ({ role: m.role, content: decodeContent(m.content) }));
  db.close();
  check(
    'first-step-instruction',
    firstStepA?.prompt === `${RESTART_HEAD}${feedback}${RESTART_TAIL}`,
    `step.prompt = 重启指令（kind=${firstStepA?.kind}, status=${firstStepA?.status}）`,
  );
  check('feedback-user-row', userRowsA.some((m) => m.content === feedback), '反馈原文 = 独立用户行（DB）');

  // UI 面（F13 live）：组合行被过滤——时间线不出现模板字样；反馈气泡在位
  const syntheticVisible = await page.getByText('上一轮执行失败').count();
  check('ui-no-synthetic-bubble', syntheticVisible === 0, `时间线无「上一轮执行失败」字样气泡（count=${syntheticVisible}）`);
  const bubbleVisible = await page.getByText(feedback.slice(0, 12)).first().isVisible().catch(() => false);
  check('ui-feedback-bubble', bubbleVisible, '反馈原文气泡在时间线可见');

  // —— 场景 B：空白反馈 restart（负例）——————————————————————————————
  const startB = await postJson(`${SERVER}/api/projects/${projectId}/builds`, {
    todoIds: [todoB],
    assignment: { plan: { agentId }, build: { agentId } },
    withPlan: true,
  });
  if (startB.status !== 201) throw new Error(`startB ${startB.status} ${JSON.stringify(startB.body)}`);
  const failedBuildB = startB.body?.builds?.[0]?.id;
  await waitFor('todo B failed', async () => (await getJson(`${SERVER}/api/todos/${todoB}`)).body?.phase === 'failed', 120_000);

  const sentB = await postJson(`${SERVER}/api/builds/${failedBuildB}/steps`, {
    action: 'restart',
    feedback: '   ',
    clientMessageId: 'verify-720-blank',
  });
  check('blank-restart-accepted', sentB.status === 202, `空白反馈 restart 被收为纯重启轮（HTTP ${sentB.status}）`);
  await waitFor('todo B confirm', async () => (await getJson(`${SERVER}/api/todos/${todoB}`)).body?.phase === 'confirm', 120_000);
  const newBuildB = (await getJson(`${SERVER}/api/todos/${todoB}`)).body?.latestBuildId;

  const db2 = new Database(DB_PATH, { readonly: true });
  const firstStepB = db2
    .prepare('SELECT kind, status, prompt FROM step WHERE buildId = ? ORDER BY rowid ASC')
    .get(newBuildB);
  // user 行 = daemon 的 prompt 行（任务文本 + 可能的 #113 补写轮指令行）——
  // 负例钉的是「空白反馈没有落成空气泡」，不是「零 user 行」。
  const userContentsB = db2
    .prepare("SELECT content FROM message WHERE conversationId = ? AND role = 'user'")
    .all(newBuildB)
    .map((m) => decodeContent(m.content));
  db2.close();
  check('blank-no-instruction', firstStepB?.prompt == null, `空白反馈 → 首步无 instruction（prompt=${JSON.stringify(firstStepB?.prompt)}）`);
  check(
    'blank-no-blank-user-row',
    userContentsB.every((c) => String(c).trim() !== ''),
    `空白反馈不落空气泡（user 行内容=${JSON.stringify(userContentsB.map((c) => String(c).slice(0, 24)))}）`,
  );

  const taskTextB = `${B_TITLE}\n\n${B_SPEC}`;
  await waitFor('blank round ran', () => stubRequests.length >= 4);
  // 重启轮会话以纯任务文本开面（区别于 A 轮的组合串）；后续 #113 补写轮是
  // continue 路径的既有语义，不属本票断言面。
  const bRestartOpenedPure = stubRequests.some((r) =>
    (r.messages ?? []).some((m) => m.role === 'user' && userWireText(m) === taskTextB),
  );
  const bRequests = stubRequests.filter((r) =>
    (r.messages ?? []).some((m) => userWireText(m)?.includes(B_SPEC) || userWireText(m)?.includes('plan.md 交接文件')),
  );
  const noTemplate = bRequests.every(
    (r) => !JSON.stringify(r).includes('上一轮执行失败') && !JSON.stringify(r).includes('用户反馈：「」'),
  );
  check(
    'blank-session-pure-task',
    bRestartOpenedPure && noTemplate,
    '空白重启轮会话 prompt = 纯任务文本，任何请求都不含重启指令模板/空壳',
  );

  writeFileSync(join(EVIDENCE, 'stub-requests.json'), `${JSON.stringify(stubRequests, null, 2)}\n`);
} finally {
  await cleanup();
}

const ok = checks.every((c) => c.ok);
const result = {
  probe: 'restart-feedback',
  ticket: 720,
  ok,
  at: new Date().toISOString(),
  stack: { api: SERVER, web: WEB, homeDir: join(RUN_DIR, 'home'), stub: STUB_PORT },
  checks,
  artifacts: ['A1-failed-composer-filled.png', 'A2-restart-round-timeline.png', 'A-transcript.json', 'stub-requests.json', 'daemon-output.txt'],
};
writeFileSync(join(EVIDENCE, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`\nevidence: ${EVIDENCE}\nallOk=${ok}\n${ok ? 'drive restart-feedback:PASS' : 'drive restart-feedback:FAIL'}\n`);
process.exit(ok ? 0 : 1);
