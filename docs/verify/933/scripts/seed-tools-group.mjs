// #933 repro seed: a real-dialog transcript whose first agent activity is a
// tool-call group — the exact arrival order the coordinator measured live
// (agent runs tools before it speaks, so the collapsed group lands under the
// run stamp and above the first agent message). Walks the production machine
// wire (enroll → claim → PUT transcript.json → done), the same data path a
// real daemon uploads over; no daemon and no LLM in the loop, so the run is
// deterministic. withPlan:false keeps the transcript free of the 确认 bubble
// — the group must be the first row under the stamp.
//
//   usage: node seed-tools-group.mjs   (reads VERIFY_RUN_DIR/ports.json)
//   prints: {"todoId":...}
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

async function jpost(path, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${SERVER}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = await res.text();
  }
  return { status: res.status, body: parsed };
}
async function jget(path) {
  const res = await fetch(`${SERVER}${path}`);
  return { status: res.status, body: await res.json() };
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

const project = await jpost(`/api/projects`, { name: '折叠工具组读感探针' });
const projectId = project.body.id;
const todo = await jpost(`/api/projects/${projectId}/todos`, {
  title: '写一个 hello.txt',
  spec: '在仓库根写 hello.txt，内容一行问候。',
});
const todoId = todo.body.id;

const build = await jpost(`/api/projects/${projectId}/builds`, {
  todoIds: [todoId],
  assignment: { plan: { agentId: AGENT_ID }, build: { agentId: AGENT_ID } },
  withPlan: false,
});
const buildId = build.body.builds?.[0]?.id;

const apiKey = await jpost(`/api/teams/${teamId}/api-keys`, {
  name: 'tools-group-probe',
  gitAccess: false,
  mcpAccess: false,
  toolGrants: { read: [], write: [] },
});
const apiKeyPlain = apiKey.body?.plaintext ?? apiKey.body?.token;
const enroll = await jpost(
  '/api/machine/enroll',
  { teamId, name: 'tools-group-probe', cliVersion: '0.1.0' },
  apiKeyPlain,
);
const machineToken = enroll.body?.token;

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

const step = await claimOwn(buildId);

const t0 = Date.now();
const tag = String(t0).slice(-6);
const toolCall = (n, command, result) => ({
  id: `${tag}-call-${n}`,
  name: 'bash',
  arguments: { command },
  result,
  startedAt: t0 + n * 1000,
  endedAt: t0 + n * 1000 + 700,
});
const messages = [
  // the agent reaches for tools before it says a word — the group therefore
  // lands above the first agent message, the measured #933 arrangement
  { id: `${tag}-c1`, role: 'assistant', content: { kind: 'toolcall', call: toolCall(1, 'ls -la', 'total 16\ndrwxr-xr-x@ 4 xmon  staff  128 Sep 30 10:00 .') }, createdAt: t0 + 1000 },
  { id: `${tag}-c2`, role: 'assistant', content: { kind: 'toolcall', call: toolCall(2, 'printf "hello\\n" > hello.txt', '') }, createdAt: t0 + 2000 },
  { id: `${tag}-a1`, role: 'assistant', content: '已写入 hello.txt，内容一行问候。', createdAt: t0 + 3000 },
];
const transcript = { stepId: step.id, messages };
const urls = await fetch(`${SERVER}/api/machine/upload-urls/${step.id}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${machineToken}` },
  body: JSON.stringify({ files: [{ name: 'transcript.json', size: JSON.stringify(transcript).length }] }),
});
const slot = (await urls.json()).uploads?.find((u) => u.name === 'transcript.json');
if (!slot) throw new Error(`no transcript slot: ${JSON.stringify(await urls.json())}`);
const put = await fetch(`${SERVER}${slot.url.replace(/^https?:\/\/[^/]+/, '')}`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${machineToken}` },
  body: JSON.stringify(transcript),
});
if (put.status !== 200) throw new Error(`PUT transcript ${put.status}`);

const done = await jpost(`/api/machine/done/${step.id}`, { status: 'success' }, machineToken);
if (done.status !== 200) throw new Error(`done ${done.status}`);

process.stdout.write(`${JSON.stringify({ todoId, buildId, stepId: step.id })}\n`);
