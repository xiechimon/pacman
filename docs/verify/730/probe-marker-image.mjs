// #730 marker 探针（live 栈 + stub LLM 请求捕获）：
//   1. Playwright 渲染唯一 marker 文本 → 截图 PNG（「被贴的图片」）
//   2. 走 web 同款上传链（grant + upload）→ spec 整行 token
//   3. provider = anthropic-messages stub（记录请求体，回合法 SSE）
//   4. build 起步 → 真 daemon 认领 → daemon 解析 token → 下载 → pi 会话
//      → stub 收到 /v1/messages 请求
//   5. 断言：请求体含 image content block（base64 与上传 PNG 逐字节一致）、
//      展开锚行在位、原始 token 不在请求文本里、transcript 原文保留 token、
//      worktree git status clean、素材化目录在 worktree 外
// 网关侧（真实 vision 模型把 marker 复述出来）另走 probe-marker-relay.mjs
// ——stub 只证「像素以模型可见的唯一形态出了 pacman」。

import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUN_DIR = join(REPO, '.claude/verify-run');
const ports = JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'));
const SERVER = `http://127.0.0.1:${ports.serverPort}`;
const STUB_PORT = Number(process.env.STUB_PORT ?? 8931);
const EVIDENCE_DIR = process.env.VERIFY_EVIDENCE_DIR ?? join(REPO, '.claude/verify-evidence');
const OUT = join(EVIDENCE_DIR, `${Date.now()}-marker-image`);
mkdirSync(OUT, { recursive: true });

const MARKER_TEXT = 'XMON730-MARKER-PICTURE';
const checks = [];
const check = (ok, label, detail = '') => {
  checks.push({ ok, label, detail });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}\n`);
};

// —— stub LLM（anthropic-messages 形）：捕获请求体 + 回单轮文本 ————————
const capturedRequests = [];
const stub = createServer((req, res) => {
  if (req.method !== 'POST' || !req.url?.includes('/v1/messages')) {
    res.writeHead(404).end();
    return;
  }
  let body = '';
  req.on('data', (d) => {
    body += d;
  });
  req.on('end', () => {
    capturedRequests.push({ url: req.url, headers: req.headers, body });
    writeFileSync(join(OUT, 'stub-request.json'), body);
    // 单轮文本回复（SSE，anthropic-messages 事件流最小形）。
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const msgBase = JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: `stub echo: ${MARKER_TEXT}` },
    });
    const msgStop = JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' } });
    res.write(
      `event: message_start\ndata: ${JSON.stringify({
        type: 'message_start',
        message: {
          id: 'msg_stub',
          type: 'message',
          role: 'assistant',
          model: 'stub-model',
          content: [],
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      })}\n\n`,
    );
    res.write(`event: content_block_start\ndata: ${JSON.stringify({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    })}\n\n`);
    res.write(`event: content_block_delta\ndata: ${msgBase}\n\n`);
    res.write(
      `event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`,
    );
    res.write(`event: message_delta\ndata: ${msgStop}\n\n`);
    res.write(
      `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`,
    );
    res.end();
  });
});
await new Promise((r) => stub.listen(STUB_PORT, '127.0.0.1', r));
process.stdout.write(`stub listening on ${STUB_PORT}\n`);

// —— 1. marker PNG（Playwright 渲染文本 → 截图）————————————————————————
const { chromium } = await import('@playwright/test');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 160 } });
await page.setContent(
  `<div style="font-family: monospace; font-size: 44px; font-weight: 700;
    background: #fff; color: #000; padding: 24px; white-space: nowrap;">${MARKER_TEXT}</div>`,
);
const pngPath = join(OUT, 'marker.png');
await page.screenshot({ path: pngPath });
await browser.close();
const pngBytes = readFileSync(pngPath);
const pngB64 = pngBytes.toString('base64');
check(pngBytes.length > 100, 'marker PNG 生成（含唯一文本渲染）', `${pngBytes.byteLength} bytes`);

// —— 2. 上传链（web 同款 grant + upload）—————————————————————————————
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

const grant = await jpost('/api/uploads/grant', {
  kind: 'attachment',
  fileName: 'marker.png',
  mimeType: 'image/png',
  size: pngBytes.byteLength,
  scope: 'spec',
});
if (grant.status !== 200) throw new Error(`grant ${grant.status}: ${JSON.stringify(grant.body)}`);
const g = grant.body;
const form = new FormData();
form.set('grant', g.grant);
form.set('file', new Blob([pngBytes], { type: 'image/png' }), 'marker.png');
const up = await jpost('/api/uploads/upload', null, { form });
if (up.status !== 201) throw new Error(`upload ${up.status}: ${JSON.stringify(up.body)}`);
const tokenLine = `![marker.png](attachment:${g.key})`;
check(true, '附件上传链（grant + upload → token）', g.key);

// —— 3. provider/agent/project/todo/build ————————————————————————————
const teams = await jget('/api/teams');
const teamId = teams.body[0].id;
const providerId = 'marker-stub';
await jpost(`/api/teams/${teamId}/providers`, {
  providerId,
  label: 'Marker Stub (anthropic-messages)',
  baseUrl: `http://127.0.0.1:${STUB_PORT}`,
  api: 'anthropic-messages',
  authHeader: true,
  compat: { supportsDeveloperRole: false },
  models: [{ id: 'stub-model', name: 'stub-model' }],
});
const agent = await jpost(`/api/teams/${teamId}/agents`, {
  displayName: 'marker-builder',
  provider: providerId,
  modelId: 'stub-model',
});
const AGENT_ID = agent.body.id ?? agent.body?.id;
const project = await jpost('/api/projects', {
  name: 'marker-project',
  repoKind: 'local',
  localPath: '/tmp/pacman-730-marker-repo',
});
const projectId = project.body.id ?? project.body.record?.id;
const spec = [
  '任务：下面附着一张图片。图里有一段文本，把它原样复述出来。',
  '',
  tokenLine,
  '',
  '完成后把复述结果写进 README.md。',
].join('\n');
const todo = await jpost(`/api/projects/${projectId}/todos`, { title: 'marker 复述', spec });
const todoId = todo.body.id ?? todo.body.record?.id;
check(true, 'seed（provider/agent/project(local repo)/todo + 整行 token spec）', todoId);

const build = await jpost(`/api/projects/${projectId}/builds`, {
  todoIds: [todoId],
  assignment: { plan: null, build: { agentId: AGENT_ID } },
  withPlan: false,
});
if (build.status !== 201) throw new Error(`build ${build.status}: ${JSON.stringify(build.body)}`);

// —— 4. 等 daemon 跑完（步 done + transcript 上传）———————————————
const BUILD_ID = build.body.builds[0].id;
let todoRow = null;
let stepsBody = null;
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const t = await jget(`/api/todos`);
  todoRow = t.body.find?.((row) => row.id === todoId) ?? null;
  stepsBody = await jget(`/api/builds/${BUILD_ID}/steps`);
  const rows = Array.isArray(stepsBody.body) ? stepsBody.body : (stepsBody.body?.steps ?? []);
  const buildStep = rows.find((r) => r.kind === 'build');
  if (buildStep && buildStep.status !== 'claimed' && buildStep.status !== 'running') break;
}
// transcript 真值：conversation messages 面
const conversation = await jget(`/api/conversations/${BUILD_ID}/messages`);
const convBody = JSON.stringify(conversation.body);

// —— 5. 断言 ——————————————————————————————————————————————————
const req = capturedRequests[0];
check(capturedRequests.length >= 1, 'stub 收到 ≥1 次 /v1/messages 请求');
if (req) {
  const parsed = JSON.parse(req.body);
  const blocks = [];
  for (const msg of parsed.messages ?? []) {
    if (typeof msg.content === 'string') continue;
    for (const b of msg.content ?? []) blocks.push(b);
  }
  const imgBlocks = blocks.filter((b) => b.type === 'image');
  check(
    imgBlocks.length === 1,
    '请求含 1 个 image content block（内联交付面）',
    `${imgBlocks.length} blocks`,
  );
  const img = imgBlocks[0];
  if (img) {
    check(img.source?.type === 'base64', 'image block source = base64（CC 本尊同形态）');
    check(img.source?.media_type === 'image/png', 'media_type = image/png', img.source?.media_type);
    check(
      img.source?.data === pngB64,
      'image base64 与上传 PNG 逐字节一致（像素真到模型侧）',
      `${(img.source?.data ?? '').length} vs ${pngB64.length} chars`,
    );
  }
  const textAll = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  check(textAll.includes('[image attached: marker.png]'), '请求文本含展开锚行');
  check(!textAll.includes(`attachment:${g.key}`), '请求文本不含原始 token（已展开）');
  check(textAll.includes('原样复述'), '任务指令文本随请求携带');
}

// transcript 原文保留 token（web chip 渲染面不丢）
check(convBody.includes(`attachment:${g.key}`), 'transcript 原文保留整行 token（chip 渲染面不丢）');

// worktree git status clean（素材/图片不落 worktree）
const daemonHome = process.env.PACMAN_HOME_OF_DAEMON ?? join('/tmp', 'pacman-730-daemon-home');
const wsRoot = join(daemonHome, 'workspaces');
let gitClean = null;
let gitDetail = '';
try {
  const dirs = existsSync(wsRoot) ? execFileSync('ls', [wsRoot]).toString().trim().split('\n') : [];
  for (const d of dirs) {
    const cwd = join(wsRoot, d);
    if (!existsSync(join(cwd, '.git'))) continue;
    const status = execFileSync('git', ['-C', cwd, 'status', '--porcelain']).toString();
    if (status.trim() !== '') {
      gitClean = false;
      gitDetail = `${d}: ${status.trim().slice(0, 120)}`;
    }
  }
  if (gitClean === null) gitClean = true;
} catch (err) {
  gitDetail = String(err);
  gitClean = false;
}
check(gitClean, 'worktree git status clean（素材化在 worktree 外）', gitDetail);

// 素材化目录断言（无 svg 附件时目录可能不存在——本链全是 png，无素材化预期）
const stepAttDir = join(daemonHome, 'step-attachments');
check(!existsSync(stepAttDir) || execFileSync('ls', [stepAttDir]).toString().trim() === '', 'step-attachments 素材化面零污染（全 png 走内联）');

// 步终态（build 步 status；失败时 errorMessage 上浮——可见失败律）
const stepRows = Array.isArray(stepsBody.body) ? stepsBody.body : (stepsBody.body?.steps ?? []);
const buildStep = stepRows.find((r) => r.kind === 'build');
check(
  buildStep?.status === 'done',
  'build 步收尾 done（daemon→pi→stub 全链无失败）',
  `status=${buildStep?.status} todo=${todoRow?.phase}`,
);
const buildRecord = await jget(`/api/builds/${BUILD_ID}`);
if (buildRecord.body?.errorMessage) {
  check(false, '失败原因可见（#708 链）', String(buildRecord.body.errorMessage).slice(0, 160));
}

writeFileSync(
  join(OUT, 'result.json'),
  JSON.stringify(
    {
      probe: 'marker-image',
      markerText: MARKER_TEXT,
      checks,
      stack: { server: SERVER, stub: STUB_PORT },
      capturedRequests: capturedRequests.length,
    },
    null,
    2,
  ),
);
process.stdout.write(`\nevidence → ${OUT}\n`);
const failed = checks.filter((c) => !c.ok);
stub.close();
process.exit(failed.length > 0 ? 1 : 0);
