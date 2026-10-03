// #730 marker 终证（真网关 + 真 vision 模型）：spec 整行 token → daemon 解析
// 下载 → pi 会话内联 image block → 公司 relay → gpt-5.6-sol 看图 → agent
// 输出复述图内唯一文本 ZQX730KIWI。复述命中 = 模型真看到了像素（票面
// 终证形态，不接受间接证据）。relay 拒图片时（旧 400 形态）本探针按
// 「可见失败」记录 errorMessage 而非造假绿。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUN_DIR = join(REPO, '.claude/verify-run');
const ports = JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'));
const SERVER = `http://127.0.0.1:${ports.serverPort}`;
const EVIDENCE_DIR = process.env.VERIFY_EVIDENCE_DIR ?? join(REPO, '.claude/verify-evidence');
const OUT = join(EVIDENCE_DIR, `${Date.now()}-marker-relay`);
mkdirSync(OUT, { recursive: true });

const MARKER = 'ZQX730KIWI';
const MODEL = process.env.MARKER_MODEL ?? 'gpt-5.6-sol';
const MARKER_PNG = process.env.MARKER_PNG ?? '/tmp/pacman-730-marker-big/marker2.png';
const RELAY = JSON.parse(readFileSync(`${process.env.HOME}/.claude/settings.json`, 'utf8')).env
  .ANTHROPIC_BASE_URL;
const RELAY_TOKEN = JSON.parse(readFileSync(`${process.env.HOME}/.claude/settings.json`, 'utf8'))
  .env.ANTHROPIC_AUTH_TOKEN;

const checks = [];
const check = (ok, label, detail = '') => {
  checks.push({ ok, label, detail });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}\n`);
};

async function jpost(path, body, opts = {}) {
  const headers = { ...(opts.form ? {} : { 'content-type': 'application/json' }), ...(opts.headers ?? {}) };
  const res = await fetch(`${SERVER}${path}`, {
    method: 'POST',
    headers,
    body: opts.form ?? JSON.stringify(body),
  });
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
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = await res.text();
  }
  return { status: res.status, body: parsed };
}

// 1. marker PNG（已由前置渲染；这里断言存在）
const pngBytes = readFileSync(MARKER_PNG);
writeFileSync(join(OUT, 'marker.png'), pngBytes);
check(pngBytes.length > 100, 'marker PNG 在位（唯一文本 ZQX730KIWI 渲染）', `${pngBytes.byteLength} bytes`);

// 2. 上传
const grant = await jpost('/api/uploads/grant', {
  kind: 'attachment',
  fileName: 'marker.png',
  mimeType: 'image/png',
  size: pngBytes.byteLength,
  scope: 'spec',
});
const form = new FormData();
form.set('grant', grant.body.grant);
form.set('file', new Blob([pngBytes], { type: 'image/png' }), 'marker.png');
const up = await jpost('/api/uploads/upload', null, { form });
if (up.status !== 201) throw new Error(`upload ${up.status}`);
const tokenLine = `![marker.png](attachment:${grant.body.key})`;

// 3. provider（真 relay）+ agent + todo + build
const teams = await jget('/api/teams');
const teamId = teams.body[0].id;
const providerId = 'relay-marker';
await jpost(`/api/teams/${teamId}/providers`, {
  providerId,
  label: 'Relay (marker proof)',
  baseUrl: RELAY,
  api: 'anthropic-messages',
  authHeader: true,
  compat: { supportsDeveloperRole: false },
  models: [{ id: MODEL, name: MODEL }],
  apiKey: RELAY_TOKEN,
});
const agent = await jpost(`/api/teams/${teamId}/agents`, {
  displayName: 'relay-marker-builder',
  provider: providerId,
  modelId: MODEL,
});
const project = await jpost('/api/projects', {
  name: 'marker-relay-project',
  repoKind: 'local',
  localPath: '/tmp/pacman-730-marker-repo',
});
const projectId = project.body.id ?? project.body.record?.id;
const spec = [
  '任务：下面附着一张图片，图里有一个大写的 code。',
  '把图里的 code 原样复述出来，直接写在回答里。',
  '不要调用任何工具，直接回答即可。',
  '',
  tokenLine,
].join('\n');
const todo = await jpost(`/api/projects/${projectId}/todos`, { title: 'marker 终证', spec });
const todoId = todo.body.id ?? todo.body.record?.id;
const build = await jpost(`/api/projects/${projectId}/builds`, {
  todoIds: [todoId],
  assignment: { plan: null, build: { agentId: agent.body.id } },
  withPlan: false,
});
const BUILD_ID = build.body.builds[0].id;
check(true, `seed（provider=${RELAY} model=${MODEL} + spec 整行 token）`, BUILD_ID);

// 4. 等步终态（gpt-5.6-sol 单轮直答，预算 5 分钟）
let stepsBody = null;
for (let i = 0; i < 300; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  stepsBody = await jget(`/api/builds/${BUILD_ID}/steps`);
  const rows = Array.isArray(stepsBody.body) ? stepsBody.body : (stepsBody.body?.steps ?? []);
  const buildStep = rows.find((r) => r.kind === 'build');
  if (buildStep && buildStep.status !== 'claimed' && buildStep.status !== 'running') break;
}

// 5. 断言：transcript 里 agent 输出复述 marker
const conversation = await jget(`/api/conversations/${BUILD_ID}/messages`);
const rows = Array.isArray(conversation.body) ? conversation.body : (conversation.body?.messages ?? []);
const fullText = JSON.stringify(rows);
writeFileSync(join(OUT, 'transcript.json'), JSON.stringify(rows, null, 2));
const stepRows = Array.isArray(stepsBody.body) ? stepsBody.body : (stepsBody.body?.steps ?? []);
const buildStep = stepRows.find((r) => r.kind === 'build');
check(buildStep?.status === 'done', 'build 步收尾 done', `status=${buildStep?.status}`);
check(fullText.includes(MARKER), `agent 输出复述图内唯一文本「${MARKER}」（终证：模型看到了像素）`);
const userRow = rows.find((r) => r.role === 'user');
check(String(userRow?.content).includes(`attachment:${grant.body.key}`), 'transcript user 行保留原始 token');

// worktree clean
const daemonHome = process.env.PACMAN_HOME_OF_DAEMON ?? '/tmp/pacman-730-daemon-home';
const wsRoot = join(daemonHome, 'workspaces');
let gitClean = true;
let gitDetail = '';
try {
  if (existsSync(wsRoot)) {
    for (const d of execFileSync('ls', [wsRoot]).toString().trim().split('\n')) {
      if (d === '') continue;
      const cwd = join(wsRoot, d);
      if (!existsSync(join(cwd, '.git'))) continue;
      const status = execFileSync('git', ['-C', cwd, 'status', '--porcelain']).toString();
      if (status.trim() !== '') {
        gitClean = false;
        gitDetail += `${d}: ${status.trim().slice(0, 80)}; `;
      }
    }
  }
} catch (err) {
  gitClean = false;
  gitDetail = String(err).slice(0, 120);
}
check(gitClean, 'worktree git status clean', gitDetail);

// 失败原因上浮（可见失败律——relay 拒图片时的证据面）
const buildRecord = await jget(`/api/builds/${BUILD_ID}`);
if (buildRecord.body?.errorMessage) {
  check(false, '失败原因可见（#708 链）', String(buildRecord.body.errorMessage).slice(0, 200));
  writeFileSync(join(OUT, 'failure-reason.txt'), String(buildRecord.body.errorMessage));
}

writeFileSync(
  join(OUT, 'result.json'),
  JSON.stringify(
    { probe: 'marker-relay', marker: MARKER, model: MODEL, checks, buildId: BUILD_ID },
    null,
    2,
  ),
);
process.stdout.write(`\nevidence → ${OUT}\n`);
const failed = checks.filter((c) => !c.ok);
process.exit(failed.length > 0 ? 1 : 0);
