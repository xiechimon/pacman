// #704 verify seed：手动 github 项目（B-C1 形态：owner/repo 无 connection）+
// relay provider（glm-5.3，compat 预翻 max_tokens/无 store——relay-186 实测形）
// + agent + todo（窄化指令，540s 墙内存活）+ api-key + machine enroll。
// 输出 JSON { teamId, projectId, todoId, agentId, machineToken, apiKey } 供
// daemon 启动与驱动脚本消费。用法：
//   VERIFY_REPO_ROOT=<worktree> node setup-704-seed.mjs
// env：P704_GITHUB_REPO（缺省 xiechimon/pacman-verify-704）
//      P704_RELAY_TOKEN（缺省读 ~/.claude/settings.json env.ANTHROPIC_AUTH_TOKEN）

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO =
  process.env.VERIFY_REPO_ROOT ??
  resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(REPO, '.claude/verify-run');
const ports = existsSync(join(RUN_DIR, 'ports.json'))
  ? JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'))
  : {};
const SERVER = `http://127.0.0.1:${ports.serverPort ?? process.env.VERIFY_PORT ?? 8791}`;
const GITHUB_REPO = process.env.P704_GITHUB_REPO ?? 'xiechimon/pacman-verify-704';
const RELAY_TOKEN =
  process.env.P704_RELAY_TOKEN ??
  JSON.parse(readFileSync(join(homedir(), '.claude', 'settings.json'), 'utf8')).env
    .ANTHROPIC_AUTH_TOKEN;

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
if (teams.status !== 200 || !teams.body?.[0]) throw new Error(`teams status=${teams.status}`);
const teamId = teams.body[0].id;

const providerId = 'relay-704';
const prov = await jpost(`/api/teams/${teamId}/providers`, {
  providerId,
  label: 'relay-704 (glm-5.3)',
  baseUrl: 'http://112.80.47.186:8783/v1',
  api: 'openai-completions',
  authHeader: true,
  apiKey: RELAY_TOKEN,
  // relay-186 实测形：pi 默认的 max_completion_tokens + store 半数通道 400；
  // 预翻旧式形态（mea shim 229 调用零重试耗尽的同款），省首次撞错学费。
  compat: { maxTokensField: 'max_tokens', supportsStore: false },
  models: [{ id: 'glm-5.3', name: 'glm-5.3' }],
});
if (![200, 201, 409].includes(prov.status)) {
  throw new Error(`provider status=${prov.status} body=${JSON.stringify(prov.body)}`);
}

const agent = await jpost(`/api/teams/${teamId}/agents`, {
  displayName: 'verify-704-builder',
  provider: providerId,
  modelId: 'glm-5.3',
});
if (![200, 201].includes(agent.status)) {
  throw new Error(`agent status=${agent.status} body=${JSON.stringify(agent.body)}`);
}
const agentId = agent.body?.id ?? agent.body?.record?.id;

const project = await jpost('/api/projects', {
  name: '704-github-manual',
  kind: 'github',
  githubRepo: GITHUB_REPO,
});
if (project.status !== 201) {
  throw new Error(`project status=${project.status} body=${JSON.stringify(project.body)}`);
}
const projectId = project.body.id;

const todo = await jpost(`/api/projects/${projectId}/todos`, {
  title: '704 PR backfill probe',
  spec: [
    `在 VERIFY.md 文件末尾追加一行「#704 probe <当前时间>」。`,
    '步骤：1) 编辑 VERIFY.md 追加该行；2) git add -A && git commit -m "probe: append line"；',
    '3) git push origin HEAD；4) gh pr create --fill --head 当前分支。',
    '时间上限：8 分钟内完成。禁止：跑测试、装依赖、改动其它文件、开 review。',
  ].join('\n'),
});
if (todo.status !== 201) {
  throw new Error(`todo status=${todo.status} body=${JSON.stringify(todo.body)}`);
}
const todoId = todo.body.id;

const apiKey = await jpost(`/api/teams/${teamId}/api-keys`, {
  name: 'verify-704-machine',
  gitAccess: false,
  mcpAccess: false,
  toolGrants: { read: [], write: [] },
});
const apiKeyPlain = apiKey.body?.plaintext ?? apiKey.body?.record?.plaintext;
if (!apiKeyPlain) {
  throw new Error(`api-key missing plaintext: ${JSON.stringify(apiKey.body)}`);
}

const enroll = await jpost(
  '/api/machine/enroll',
  { teamId, name: 'verify-704-mbp', cliVersion: '0.1.0' },
  apiKeyPlain,
);
if (enroll.status !== 200) {
  throw new Error(`enroll status=${enroll.status} body=${JSON.stringify(enroll.body)}`);
}
const machineToken = enroll.body?.token ?? enroll.body?.machine?.token;

process.stdout.write(
  `${JSON.stringify({ teamId, projectId, todoId, agentId, machineToken, apiKey: apiKeyPlain })}\n`,
);
