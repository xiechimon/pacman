#!/usr/bin/env node
// #701 续轮指令投递对账（协调者指令 2026-10-03）：人肉打回 → 重规划步的
// instruction（buildReviewRejectPrompt 携用户反馈）是否真的到达 agent。
// 跑在 origin/main + #721(本票) + #719(#703 runner 修复) 的合并态一次性检出上——
// 单独 #721 分支上 runner 的 continue 步仍发 CONTINUE_PROMPTS 占位句
// （#703 修的正是这条），合并态才是落地后的真实行为。
//
// 双面对账（#703 证据同款方法，不从截断请求体推结论——请求体全文落证据）：
//   face 1  server→daemon wire：claim 载荷 instruction 全文 === 模板合成值，
//           session.action='continue'（HTTP 机器面直取，todo A）；
//   face 2  daemon→LLM 请求时间线：真 daemon claim 重规划步后，stub LLM 收到
//           的请求 messages 里出现意图文本（全文捕获，todo B）；
//   face 3  transcript DB 真值：步收尾上传后 message 表 user-<stepId> 行
//           content === instruction 全文（SQLite 只读）。
//
// 前置：合并树 launch.mjs 已起栈（VERIFY_PORT/VERIFY_WEB_PORT 见 ports.json）。
// 用法：node drive-701-delivery.mjs   （VERIFY_REPO_ROOT 指合并树）

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(process.env.VERIFY_REPO_ROOT ?? '.');
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(REPO, '.claude/verify-run');
const ports = JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'));
const SERVER = `http://127.0.0.1:${ports.serverPort}`;
const DB_PATH = join(RUN_DIR, 'home/server/server.db');
const STUB_PORT = Number(process.env.STUB_PORT ?? 8919);
const DAEMON_HOME = process.env.DAEMON_HOME ?? '/tmp/pacman-701-delivery-daemon-home';
const EVIDENCE =
  process.env.VERIFY_EVIDENCE_DIR ?? join(REPO, `.claude/verify-evidence/${Date.now()}-701-delivery`);
mkdirSync(EVIDENCE, { recursive: true });
mkdirSync(DAEMON_HOME, { recursive: true });

const require2 = createRequire(join(REPO, 'apps/server/package.json'));
const Database = require2('better-sqlite3');

// 模板逐字节 = shared buildReviewRejectPrompt（单源在 packages/shared/src/records/prompts.ts，
// 此处按 wire 契约字面量对拍——对不上即契约漂移，正是要抓的失败）。
const HEAD = '用户在审核关口请求修改。修改反馈：「';
const TAIL =
  '」。本轮改动仍保留在会话分支上，不要丢弃既有产物：对照反馈输出更新后的 plan.md（覆盖 Context/Changes/Edge cases/Verification 四段），写清改动将如何调整；执行轮会在同一分支上继续修改。结尾一句话摘要本次调整了什么。';
const rejectPrompt = (feedback) => `${HEAD}${feedback}${TAIL}`;

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: detail ?? null });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}\n`);
}

// —— 捕获型 stub LLM：openai-completions SSE，300ms 门控；每个请求体全文
//    落 timeline（face 2 的证据本体，不截断）。——
const stubRequests = [];
const stub = createServer((req, res) => {
  if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
    res.writeHead(404).end();
    return;
  }
  let body = '';
  req.on('data', (d) => {
    body += d;
  });
  req.on('end', () => {
    stubRequests.push({ ts: Date.now(), url: req.url, body });
    let responded = false;
    const timer = setTimeout(() => {
      responded = true;
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      const base = {
        id: 'chatcmpl-stub',
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'stub-model',
      };
      res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: 'assistant' } }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { content: '收到，按反馈调整方案。' } }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 } })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }, 300);
    res.on('close', () => {
      if (!responded) clearTimeout(timer);
    });
  });
});
await new Promise((r) => stub.listen(STUB_PORT, '127.0.0.1', r));

async function jget(path, token) {
  const res = await fetch(`${SERVER}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: res.status, body: await res.json() };
}
async function jpost(path, body, token) {
  const res = await fetch(`${SERVER}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = await res.text();
  }
  return { status: res.status, body: parsed };
}

let daemonProc = null;
try {
  // —— seed ——
  const teamId = (await jget('/api/teams')).body[0].id;
  await jpost(`/api/teams/${teamId}/providers`, {
    providerId: 'stub-gw',
    label: 'Stub Gateway',
    baseUrl: `http://127.0.0.1:${STUB_PORT}/v1`,
    api: 'openai-completions',
    authHeader: true,
    compat: { supportsDeveloperRole: false },
    models: [{ id: 'stub-model', name: 'stub-model' }],
  });
  const AGENT_ID = (await jpost(`/api/teams/${teamId}/agents`, {
    displayName: 'delivery-builder',
    provider: 'stub-gw',
    modelId: 'stub-model',
  })).body.id;
  const projectId = (await jpost('/api/projects', { name: '投递对账' })).body.id;
  const key1 = (await jpost(`/api/teams/${teamId}/api-keys`, {
    name: 'wire-mbp', gitAccess: false, mcpAccess: false, toolGrants: { read: [], write: [] },
  })).body.plaintext;
  const TOKEN = (await jpost('/api/machine/enroll', { teamId, name: 'wire-mbp', cliVersion: '0.1.0' }, key1)).body.token;
  const key2 = (await jpost(`/api/teams/${teamId}/api-keys`, {
    name: 'daemon-mbp', gitAccess: false, mcpAccess: false, toolGrants: { read: [], write: [] },
  })).body.plaintext;

  const newTodo = async (title) =>
    (await jpost(`/api/projects/${projectId}/todos`, { title, spec: '按反馈调整的探针任务。' })).body.id;
  const startBuild = async (todoId) =>
    (await jpost(`/api/projects/${projectId}/builds`, {
      todoIds: [todoId],
      assignment: { plan: { agentId: AGENT_ID }, build: { agentId: AGENT_ID } },
      withPlan: true,
    })).body.builds[0].id;
  const claimWire = async () => {
    const res = await jpost('/api/machine/tasks/claim', {}, TOKEN);
    return res.body.step ?? res.body;
  };
  const uploadPlan = async (stepId, content) => {
    const urls = await jpost(`/api/machine/upload-urls/${stepId}`, { files: [{ name: 'plan.md' }] }, TOKEN);
    const up = urls.body.uploads[0];
    const target = up.url.startsWith('http') ? up.url : `${SERVER}${up.url}`;
    const put = await fetch(target, {
      method: 'PUT',
      headers: { 'content-type': 'text/markdown', authorization: `Bearer ${TOKEN}`, ...(up.headers ?? {}) },
      body: content,
    });
    return put.status;
  };
  const doneWire = (stepId, body) => jpost(`/api/machine/done/${stepId}`, body, TOKEN);
  const todoOf = async (id) => (await jget(`/api/todos/${id}`)).body;
  const stepsOf = async (id) => (await jget(`/api/builds/${id}/steps`)).body;

  /** HTTP 机器面把一个 todo 驱到 review 静息态（plan.md 上传 + done 携
   *  sessionId——continue 语义的会话锚，daemon 侧解析不到会回退 new session，
   *  prompt 投递不受影响）。 */
  async function driveToReview(todoId, sessionId) {
    const buildId = await startBuild(todoId);
    const planStep = await claimWire();
    if (planStep.step.kind !== 'plan') throw new Error(`expected plan, got ${planStep.step.kind}`);
    const putStatus = await uploadPlan(planStep.step.id, '# 方案 v1\nContext: 投递对账探针\n');
    if (putStatus !== 200) throw new Error(`upload plan status=${putStatus}`);
    const d1 = await doneWire(planStep.step.id, { status: 'success', sessionId });
    if (d1.status !== 200) throw new Error(`done plan status=${d1.status}`);
    const phaseMid = (await todoOf(todoId)).phase;
    if (phaseMid !== 'confirm') throw new Error(`expected confirm, got ${phaseMid}`);
    const c = await jpost(`/api/builds/${buildId}/steps`, { action: 'confirm' });
    if (c.status !== 202) throw new Error(`confirm status=${c.status}`);
    const buildStep = await claimWire();
    if (buildStep.step.kind !== 'build') throw new Error(`expected build, got ${buildStep.step.kind}`);
    const d2 = await doneWire(buildStep.step.id, { status: 'success', sessionId });
    if (d2.status !== 200) throw new Error(`done build status=${d2.status}`);
    const phase = (await todoOf(todoId)).phase;
    if (phase !== 'review') throw new Error(`expected review, got ${phase}`);
    return buildId;
  }

  // —— face 1（todo A）：claim 载荷 wire 真值 ——
  const todoA = await newTodo('投递对账 A：wire 面');
  const buildA = await driveToReview(todoA, 'pi-a');
  const FEEDBACK_A = '关闭按钮挪到左边，文案改成「返回」';
  const rejA = await jpost(`/api/builds/${buildA}/steps`, {
    action: 'revision', side: 'plan', feedback: FEEDBACK_A, clientMessageId: 'aaaaaaaa-0000-4000-8000-000000000001',
  });
  check('face1-reject-accepted-202', rejA.status === 202, `status=${rejA.status}`);
  const claimA = await claimWire();
  check('face1-claim-is-replan-step', claimA.step.kind === 'plan', `kind=${claimA.step.kind}`);
  check(
    'face1-session-continue',
    claimA.session?.action === 'continue' && claimA.session?.sessionId === 'pi-a',
    `session=${JSON.stringify(claimA.session)}`,
  );
  const expectedA = rejectPrompt(FEEDBACK_A);
  check(
    'face1-instruction-fulltext-equals-template',
    claimA.instruction === expectedA,
    `len=${String(claimA.instruction ?? '').length} expected len=${expectedA.length}`,
  );
  await doneWire(claimA.step.id, { status: 'success', sessionId: 'pi-a' });
  check('face1-phase-confirm-after-replan', (await todoOf(todoA)).phase === 'confirm');

  // —— face 2/3（todo B）：真 daemon + 捕获 stub ——
  const todoB = await newTodo('投递对账 B：daemon 面');
  const buildB = await driveToReview(todoB, 'pi-b');
  const daemonEnv = { ...process.env, PACMAN_HOME: DAEMON_HOME };
  for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'ALL_PROXY']) {
    delete daemonEnv[k];
  }
  daemonEnv.NO_PROXY = '*';
  daemonEnv.no_proxy = '*';
  daemonProc = spawn(
    'bash',
    [
      '-c',
      `cd ${JSON.stringify(join(REPO, 'apps/daemon'))} && exec corepack pnpm exec tsx src/cli.ts start --foreground --server ${SERVER} --api-key ${key2} --team ${teamId} --name daemon-mbp`,
    ],
    { env: daemonEnv, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const daemonOut = [];
  daemonProc.stdout.on('data', (d) => daemonOut.push(d.toString()));
  daemonProc.stderr.on('data', (d) => daemonOut.push(d.toString()));

  // 等机器上线
  let online = false;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const machines = (await jget(`/api/teams/${teamId}/machines`)).body ?? [];
    if (machines.some((m) => m.name === 'daemon-mbp' && m.online === true)) {
      online = true;
      break;
    }
  }
  check('face2-daemon-online', online, 'daemon 机器行 online:true');
  if (!online) throw new Error(`daemon never came online; tail=${daemonOut.join('').slice(-800)}`);

  const FEEDBACK_B = '列表页加分页，别一次全渲染';
  const rejB = await jpost(`/api/builds/${buildB}/steps`, {
    action: 'revision', side: 'plan', feedback: FEEDBACK_B, clientMessageId: 'bbbbbbbb-0000-4000-8000-000000000002',
  });
  check('face2-reject-accepted-202', rejB.status === 202, `status=${rejB.status}`);

  // 等重规划步收尾（daemon claim → pi 会话 → stub 应答 → transcript 上传 → done）
  let replanStep = null;
  let doneSeen = false;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const steps = await stepsOf(buildB);
    const planSteps = steps.filter((s) => s.kind === 'plan');
    replanStep = planSteps[planSteps.length - 1];
    if (replanStep && (replanStep.status === 'done' || replanStep.status === 'failed')) {
      doneSeen = true;
      break;
    }
  }
  check('face2-replan-step-finished', doneSeen, `status=${replanStep?.status}`);
  if (!doneSeen) throw new Error(`replan step never finished; daemon tail=${daemonOut.join('').slice(-1200)}`);
  check('face2-replan-step-done', replanStep.status === 'done', `status=${replanStep.status}`);

  // face 2：stub 请求时间线里出现意图文本（全文对账）
  const expectedB = rejectPrompt(FEEDBACK_B);
  const hit = stubRequests.find((r) => r.body.includes(expectedB));
  check('face2-stub-request-carries-full-intent', Boolean(hit), `stub requests=${stubRequests.length}`);
  check(
    'face2-stub-request-carries-feedback-verbatim',
    stubRequests.some((r) => r.body.includes(FEEDBACK_B)),
    `feedback=${FEEDBACK_B}`,
  );
  const placeholder = '请重新规划该任务，输出更新后的方案。';
  check(
    'face2-stub-request-not-placeholder-only',
    !stubRequests.some((r) => r.body.includes(placeholder) && !r.body.includes(expectedB)),
    'CONTINUE_PROMPTS 占位句没有顶替意图文本',
  );

  // face 3：DB transcript 行（content 列可能是 JSON 编码字符串，双形解析）
  const db = new Database(DB_PATH, { readonly: true });
  const rows = db
    .prepare(`select id, role, content from message where conversationId = ? and id like 'user-%'`)
    .all(buildB);
  db.close();
  const decode = (c) => {
    if (typeof c === 'string' && c.startsWith('"')) {
      try {
        return JSON.parse(c);
      } catch {
        return c;
      }
    }
    return c;
  };
  const promptRow = rows.find((r) => decode(r.content) === expectedB);
  check('face3-db-transcript-row-fulltext', Boolean(promptRow), `user-rows=${rows.length} id=${promptRow?.id}`);
  const stepPromptRow = (() => {
    const db2 = new Database(DB_PATH, { readonly: true });
    const row = db2.prepare(`select prompt from step where id = ?`).get(replanStep.id);
    db2.close();
    return row;
  })();
  check('face3-db-step-prompt-fulltext', stepPromptRow?.prompt === expectedB, `len=${String(stepPromptRow?.prompt ?? '').length}`);
  check('face3-phase-confirm-after-delivery', (await todoOf(todoB)).phase === 'confirm');

  // daemon 日志佐证（回退 new session 是预期路径——HTTP 驱的轮次没有本机
  // 会话文件；prompt 投递不受会话回退影响，这正是要对账的点）。
  const daemonLog = daemonOut.join('');
  const fallbackSeen = daemonLog.includes('falling back to new session');
  check('face2-daemon-fallback-logged', fallbackSeen, 'continue 会话不可解析 → 回退 new session（prompt 不丢）');

  // —— 证据落盘 ——
  writeFileSync(join(EVIDENCE, 'stub-requests.json'), `${JSON.stringify(stubRequests, null, 2)}\n`);
  writeFileSync(join(EVIDENCE, 'sqlite-truth.json'), `${JSON.stringify({ messageRows: rows.map((r) => ({ ...r, content: decode(r.content) })), stepPrompt: stepPromptRow?.prompt ?? null, expectedB }, null, 2)}\n`);
  writeFileSync(join(EVIDENCE, 'daemon-tail.out'), `${daemonLog.slice(-4000)}\n`);
  writeFileSync(
    join(EVIDENCE, 'result.json'),
    `${JSON.stringify(
      {
        probe: 'drive-701-delivery',
        ticket: 701,
        tree: 'origin/main + #721 + #719 (merged scratch)',
        stack: { server: SERVER, stubPort: STUB_PORT, db: DB_PATH },
        todoA, buildA, todoB, buildB,
        checks,
        pass: checks.filter((c) => c.ok).length,
        total: checks.length,
      },
      null,
      2,
    )}\n`,
  );
  process.stdout.write(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks PASS — evidence: ${EVIDENCE}\n`);
  if (checks.some((c) => !c.ok)) process.exitCode = 1;
} finally {
  if (daemonProc && daemonProc.exitCode === null) {
    daemonProc.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 2000));
    if (daemonProc.exitCode === null) daemonProc.kill('SIGKILL');
  }
  stub.close();
  // undici keep-alive 池 socket 吊住事件循环（2026-10-03 实测：checks 全部
  // 写完、进程仍不退出）——证据落盘后显式收尾。
  process.exit(process.exitCode ?? 0);
}
