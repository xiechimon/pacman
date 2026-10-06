// #951 live 栈 seed（stop-button.md 配方，seed-945-live 同源改号）：
// stub-gw-951 provider + verify-builder agent + daemon api-key + project +
// todo。todo 留 todo 相位，build 由 drive-stop 自己点「开始」触发。结果写
// /tmp/951-seed.json。providerId/key/project 与 branch-sync seed 错开防 409。
const API = process.env.SEED_API ?? 'http://127.0.0.1:8795';

const jreq = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text === '' ? null : JSON.parse(text);
  } catch {
    parsed = text;
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  return parsed;
};

const teams = await jreq('GET', '/api/teams');
const teamId = teams[0].id;

await jreq('POST', `/api/teams/${teamId}/providers`, {
  providerId: 'stub-gw-951',
  label: 'Stub GW 951',
  baseUrl: 'http://127.0.0.1:8919/v1',
  api: 'openai-completions',
  authHeader: true,
  compat: { supportsDeveloperRole: false },
  models: [{ id: 'stub-model', name: 'stub-model' }],
});

const agent = await jreq('POST', `/api/teams/${teamId}/agents`, {
  displayName: 'verify-builder',
  provider: 'stub-gw-951',
  modelId: 'stub-model',
});
const agentId = agent.id;

const key = await jreq('POST', `/api/teams/${teamId}/api-keys`, {
  name: 'daemon-951',
  gitAccess: false,
  mcpAccess: false,
  toolGrants: { read: [], write: [] },
});
const apiKey = key.plaintext ?? key.token;
if (apiKey == null) throw new Error(`api-key body: ${JSON.stringify(key)}`);

const project = await jreq('POST', '/api/projects', {
  name: '951-detail-probe',
  repoKind: 'hosted',
});
const projectId = project.id;

const todo = await jreq('POST', `/api/projects/${projectId}/todos`, {
  title: '951 live 探针任务',
  spec: '探针任务：写一行说明',
});

const out = { teamId, agentId, apiKey, projectId, todoId: todo.id };
const { writeFileSync } = await import('node:fs');
writeFileSync('/tmp/951-seed.json', JSON.stringify(out, null, 1));
console.log(`seed ok: team=${teamId} agent=${agentId} project=${projectId} todo=${todo.id}`);
