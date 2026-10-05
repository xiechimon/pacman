// #873 repro seed: a long transcript (overflowing .chat-col) plus a live
// claimed step, so all three symptoms can be observed on one screen.
// plan step: claim → upload transcript.json (many rows) → done (phase=confirm)
// → POST steps {action:'confirm'} → build step pending → claim → stays running.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO =
  process.env.VERIFY_REPO_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(REPO, '.claude/verify-run');
const ports = existsSync(join(RUN_DIR, 'ports.json'))
  ? JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'))
  : {};
const SERVER = `http://127.0.0.1:${ports.serverPort ?? process.env.VERIFY_PORT ?? 8791}`;

async function jget(path) {
  const res = await fetch(`${SERVER}${path}`);
  return { status: res.status, body: await res.json() };
}
async function jpost(path, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${SERVER}${path}`, {
    method: 'POST',
    headers,
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

const teams = await jget('/api/teams');
const teamId = teams.body[0].id;

const providerId = 'stub-gw';
await jpost(`/api/teams/${teamId}/providers`, {
  providerId,
  label: 'Stub Gateway',
  baseUrl: 'http://127.0.0.1:9/v1',
  api: 'openai-completions',
  authHeader: true,
  compat: { supportsDeveloperRole: false },
  models: [{ id: 'stub-model', name: 'stub-model' }],
});

const agent = await jpost(`/api/teams/${teamId}/agents`, {
  displayName: 'verify-builder',
  provider: providerId,
  modelId: 'stub-model',
});
const AGENT_ID = agent.body?.id ?? agent.body?.agentId;

const project = await jpost('/api/projects', { name: '会话面统一探针' });
const projectId = project.body.id;

const todo = await jpost(`/api/projects/${projectId}/todos`, {
  title: '会话面统一',
  spec: '验证流式行秒数、右侧按钮与自动下滑。',
});
const todoId = todo.body.id;

const build = await jpost(`/api/projects/${projectId}/builds`, {
  todoIds: [todoId],
  assignment: { plan: { agentId: AGENT_ID }, build: { agentId: AGENT_ID } },
  withPlan: true,
});
const buildId = build.body.builds?.[0]?.id;

const apiKey = await jpost(`/api/teams/${teamId}/api-keys`, {
  name: 'stream-probe',
  gitAccess: false,
  mcpAccess: false,
  toolGrants: { read: [], write: [] },
});
const apiKeyPlain = apiKey.body?.plaintext ?? apiKey.body?.token;

const enroll = await jpost(
  '/api/machine/enroll',
  { teamId, name: 'stream-probe', cliVersion: '0.1.0' },
  apiKeyPlain,
);
const machineToken = enroll.body?.token;

async function uploadTranscript(stepId, messages) {
  const transcript = { stepId, messages };
  const urls = await fetch(`${SERVER}/api/machine/upload-urls/${stepId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${machineToken}` },
    body: JSON.stringify({
      files: [
        { name: 'transcript.json', size: JSON.stringify(transcript).length },
        { name: 'plan.md', size: 200 },
      ],
    }),
  });
  const body = await urls.json();
  const up = body.uploads?.find((u) => u.name === 'transcript.json');
  if (!up) throw new Error(`no transcript slot: ${JSON.stringify(body)}`);
  const put = await fetch(`${SERVER}${up.url.replace(/^https?:\/\/[^/]+/, '')}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${machineToken}` },
    body: JSON.stringify(transcript),
  });
  if (put.status !== 200) throw new Error(`PUT transcript ${put.status}: ${await put.text()}`);

  const planUp = body.uploads?.find((u) => u.name === 'plan.md');
  if (planUp) {
    const putPlan = await fetch(`${SERVER}${planUp.url.replace(/^https?:\/\/[^/]+/, '')}`, {
      method: 'PUT',
      headers: { 'content-type': 'text/markdown', authorization: `Bearer ${machineToken}` },
      body: '# 方案 v1\n\n会话面统一。\n',
    });
    if (putPlan.status !== 200) throw new Error(`PUT plan.md ${putPlan.status}`);
  }
}

// Claim is team-wide FIFO, so stale pending steps from earlier seeds come
// first; drain them (mark failed) until the step belongs to this build.
async function claimOwn(targetBuildId) {
  for (let i = 0; i < 8; i++) {
    const res = await jpost('/api/machine/tasks/claim', {}, machineToken);
    const step = res.body?.step?.step ?? res.body?.step;
    if (!step?.id) throw new Error(`claim failed ${JSON.stringify(res.body)}`);
    if (step.buildId === targetBuildId) return step;
    await jpost(`/api/machine/done/${step.id}`, { status: 'failed' }, machineToken);
  }
  throw new Error(`no step for build ${targetBuildId}`);
}

// plan step: long transcript then done
const planStep = await claimOwn(buildId);

const t0 = Date.now();
const tag = String(t0).slice(-6); // message ids are primary keys: unique per run
const messages = [];
for (let i = 1; i <= 14; i++) {
  messages.push({
    id: `probe-${tag}-u-${i}`,
    role: 'user',
    content: `第 ${i} 条：请检查模块 ${i} 的实现，并说明为什么这样设计。`,
    createdAt: t0 + i * 1000,
  });
  messages.push({
    id: `probe-${tag}-a-${i}`,
    role: 'assistant',
    content: `第 ${i} 条回复。这个模块负责把请求路由到正确的处理器，之所以这样切分，是为了让每一层只依赖它下面一层的接口，改动不会向上冒泡。\n\n- 入口只做参数校验\n- 中间层只做编排\n- 底层只做副作用`,
    createdAt: t0 + i * 1000 + 500,
  });
}
await uploadTranscript(planStep.id, messages);
const donePlan = await jpost(`/api/machine/done/${planStep.id}`, { status: 'success' }, machineToken);
if (donePlan.status !== 200) throw new Error(`plan done ${donePlan.status}`);

// confirm → build step queued → claim → stays running
const confirm = await jpost(`/api/builds/${buildId}/steps`, { action: 'confirm' });
if (confirm.status !== 202) throw new Error(`confirm ${confirm.status} ${JSON.stringify(confirm.body)}`);

const buildStep = await claimOwn(buildId);

process.stdout.write(
  `${JSON.stringify({ todoId, buildId, stepId: buildStep.id, kind: buildStep.kind, teamId, machineToken })}\n`,
);