#!/usr/bin/env node
// verify-pacman 定制 probe — 622 / spec 17 T1：claude-code 第二运行时最小闭环。
//
// 断言对照（票 #622 验收）：
// after 面（本票栈）：
//   A. claude-code agent 跑通 worker 步全链路——plan 步 claim → claude 后端
//      执行 → SDK transcript 出 text/toolcall 行 → done 携 usage
//      （token_usage 行 claude-code/<model>）→ 步 done + sessionId 回传 +
//      plan.md 交接落库（build.planDocId）。
//   B. resume——confirm 后 build 步 claim 收 continue → SDK resume 续同一
//      会话：build 步 sessionId === plan 步、transcript 行数增长、daemon log
//      「continue session」canon 行；conv 分支推回用户仓（真产物 poem.txt）。
//   C. pi 混跑零回归——同栈同 daemon：stub LLM pi agent 走同链
//      （plan+build done + usage r3-stub/stub-model + conv 分支产物）。
// before 面（origin/main 一次性 worktree 栈，`run --before`）：同一 seed/派发
//   下 plan 步 failed，errorMessage 含 claude-code（pi 侧 model not found 形）。
//
// 用法（两段，段间由操作者起 daemon）：
//   段 1 seed（agent/项目/todo/api-key，写 prep 文件，打印 daemon 启动行）：
//     env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
//       VERIFY_REPO_ROOT=<栈仓根> VERIFY_DAEMON_HOME=<scratch> node <本脚本> seed
//   段 2 按打印行起 daemon（真实 HOME——claude 认证机器本地，spec 17 失败方式 2
//   环境契约；代理 env 保留给 claude CLI 外联，daemon→server 回环自动 no-proxy），
//   再以同 env 跑：
//     node <本脚本> run [--before]
//
// 环境契约：VERIFY_REPO_ROOT（栈仓根，缺省脚本相对 ../../..）；VERIFY_RUN_DIR
//   （缺省 <ROOT>/.claude/verify-run）；VERIFY_EVIDENCE_DIR（缺省本目录）；
//   VERIFY_DAEMON_HOME（daemon scratch——daemon.log/workspaces 断言面）；
//   prep 文件缺省 /tmp/pacman-622-prep.json（api-key 明文只落 /tmp，不进证据）。

import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.VERIFY_REPO_ROOT
  ? resolve(process.env.VERIFY_REPO_ROOT)
  : resolve(SCRIPT_DIR, '../../..');
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(ROOT, '.claude', 'verify-run');
const EVIDENCE = process.env.VERIFY_EVIDENCE_DIR ?? SCRIPT_DIR;
const DAEMON_HOME = process.env.VERIFY_DAEMON_HOME ?? null;
const PREP_FILE = process.env.VERIFY_PREP_FILE ?? '/tmp/pacman-622-prep.json';
const MODE = process.argv[2] ?? '';
const BEFORE = process.argv.includes('--before');

let stack;
try {
  stack = JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'));
} catch {
  console.error(`无栈：${join(RUN_DIR, 'ports.json')} 不存在或损坏。先跑 launch.mjs`);
  process.exit(1);
}
const API = `http://127.0.0.1:${stack.serverPort}`;
const DB_PATH = join(stack.homeDir, 'server', 'server.db');
const FACE = BEFORE ? 'before' : 'after';

mkdirSync(EVIDENCE, { recursive: true });

const checks = [];
let failures = 0;
const check = (ok, label, detail) => {
  checks.push({ ok, label, detail: detail ?? null });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const payloads = {};
async function api(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function poll(fn, timeoutMs, label, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v !== null && v !== undefined && v !== false) return v;
    if (Date.now() > deadline) throw new Error(`poll timeout: ${label}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function db() {
  // better-sqlite3 从栈仓解析（probe 自身零依赖；t-0024 同法）。
  const requireServer = createRequire(join(ROOT, 'apps', 'server', 'package.json'));
  const Database = requireServer('better-sqlite3');
  return new Database(DB_PATH, { readonly: true });
}

function stepRow(database, buildId, kind) {
  return database
    .prepare('SELECT id, kind, status, sessionId, prompt FROM step WHERE buildId = ? AND kind = ?')
    .get(buildId, kind);
}

function daemonLogLines() {
  if (DAEMON_HOME === null) return [];
  try {
    return readFileSync(join(DAEMON_HOME, 'daemon.log'), 'utf8').split('\n');
  } catch {
    return [];
  }
}

/** git 子调用（seed 用户仓 + conv 分支回读）。 */
function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

const CLAUDE_AGENT_NAME = 'verify-622-claude';
const PI_AGENT_NAME = 'verify-622-pi';
const DAEMON_NAME = 'verify-622-mbp';
const MODEL_ID = 'sonnet';
const POEM_FILE = 'poem.txt';
const PI_PROBE_LINE = 'pi probe line 622';

// —— 段 1：seed ——————————————————————————————————————————————————————————————

async function seedPhase() {
  const session = await api('GET', '/api/auth/session');
  check(session.status === 200, `GET /api/auth/session → 200（实际 ${session.status}）`);
  const teams = await api('GET', '/api/teams');
  const teamId = teams.json?.[0]?.id;
  check(Boolean(teamId), 'GET /api/teams → seed 团队在位');

  // claude-code agent（spec 17：provider='claude-code' = backend 身份字面量；
  // 「推送分支」权限显式带上——XMON-77 推送闸，缺它 conv 分支提交留本地）。
  const agentRes = await api('POST', `/api/teams/${teamId}/agents`, {
    displayName: CLAUDE_AGENT_NAME,
    provider: 'claude-code',
    modelId: MODEL_ID,
    tools: ['推送分支'],
  });
  const agentId = agentRes.json?.id;
  check(agentRes.status === 201 && Boolean(agentId), `POST /agents (claude-code) → 201`);
  payloads.agentCreate = { status: agentRes.status, id: agentId };

  // 用户本机 git 仓（local 形态 clone 源 + conv 分支回读面；g2t2 同构）。
  const userRepo = join(mkdtempSync(join(tmpdir(), 'pacman-622-user-')), 'repo');
  git(['init', '-b', 'main', userRepo]);
  writeFileSync(join(userRepo, 'README.md'), '# 622 probe repo\n');
  git(['add', 'README.md'], userRepo);
  git(['-c', 'user.name=probe', '-c', 'user.email=probe@pacman.local', 'commit', '-m', 'init'], userRepo);

  const projectRes = await api('POST', '/api/projects', {
    name: 'verify-622-local',
    teamId,
    repoKind: 'local',
    localPath: userRepo,
  });
  const projectId = projectRes.json?.id;
  check(projectRes.status === 201 && Boolean(projectId), `POST /projects (local) → 201`);
  payloads.projectCreate = { status: projectRes.status, id: projectId };

  // 任务 spec 显式要 plan.md：规划步 prompt = title+spec 原文（#612 词表），
  // 首轮不含服务端 plan.md 指令——真实用户靠 spec 表达（#113：缺省时 server
  // 自动补 PLAN_REWRITE 轮，probe 不依赖该兜底循环）。
  const todoRes = await api('POST', `/api/projects/${projectId}/todos`, {
    title: '写五行情诗到 poem.txt',
    spec: `第一步：在仓库根目录创建 plan.md，写入任务方案（覆盖 Context/Changes/Edge cases/Verification 四段），到此为止，不要执行改动。方案确认后的第二步：在仓库根目录创建 ${POEM_FILE}，内容是一首五行情诗（中文，每行不超过 12 个字），完成后读回文件确认内容完整。`,
  });
  const todoId = todoRes.json?.id;
  check(todoRes.status === 201 && Boolean(todoId), 'POST /todos → 201');

  // 机器注册 key（daemon enroll 用；明文只落 /tmp prep，不进证据目录）。
  const keyRes = await api('POST', `/api/teams/${teamId}/api-keys`, {
    name: 'verify-622-machine',
    gitAccess: false,
    mcpAccess: false,
    toolGrants: { read: [], write: [] },
  });
  const plaintext = keyRes.json?.plaintext;
  check(keyRes.status === 201 && Boolean(plaintext), 'POST /api-keys → 201 + 明文一次');

  writeFileSync(
    PREP_FILE,
    `${JSON.stringify(
      { teamId, agentId, projectId, todoId, userRepo, apiKeyPlaintext: plaintext },
      null,
      2,
    )}\n`,
  );
  console.log('\nprep 已写:', PREP_FILE);
  console.log('起 daemon（真实 HOME；代理 env 保留——claude CLI 外联用，回环自动 no-proxy）:');
  console.log(`  cd ${join(ROOT, 'apps', 'daemon')} && env PACMAN_HOME=${DAEMON_HOME ?? '<scratch>'} \\`);
  console.log(
    `    pnpm exec tsx src/cli.ts start --foreground --server ${API} --api-key <prep 明文> --team ${teamId} --name ${DAEMON_NAME}`,
  );
}

// —— SDK transcript 读取面 ————————————————————————————————————————————————

/** 在 ~/.claude/projects 下按 sessionId 找 CLI 会话文件（A7：transcript 在
 * CLI 自有 store；cwd-slug 由后端 sdkTranscriptPath 同式复刻，这里按文件名
 * 全局搜——单命中即证位置唯一）。 */
function findSdkTranscript(sessionId) {
  const projectsDir = join(homedir(), '.claude', 'projects');
  if (!existsSync(projectsDir)) return null;
  const found = [];
  for (const dir of readdirSync(projectsDir)) {
    const p = join(projectsDir, dir, `${sessionId}.jsonl`);
    if (existsSync(p)) found.push(p);
  }
  return found.length === 1 ? found[0] : null;
}

function parseTranscript(path) {
  const rows = readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l));
  const toolUses = [];
  const assistantText = [];
  for (const row of rows) {
    if (row?.type !== 'assistant') continue;
    for (const block of row.message?.content ?? []) {
      if (block?.type === 'tool_use') toolUses.push(block.name);
      if (block?.type === 'text' && typeof block.text === 'string' && block.text.trim() !== '') {
        assistantText.push(block.text);
      }
    }
  }
  return { rowCount: rows.length, toolUses, assistantText };
}

// —— pi 混跑 stub（openai-completions SSE，integration/test/stub-llm.ts 同构）——

function startStub(responses) {
  let next = 0;
  const server = createServer((req, res) => {
    if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    req.on('data', (d) => {
      body += d;
    });
    req.on('end', () => {
      const rsp = responses[Math.min(next, responses.length - 1)] ?? { content: 'ok' };
      next += 1;
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      const chunk = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
      const base = {
        id: 'chatcmpl-stub',
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'stub-model',
      };
      chunk({
        ...base,
        choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
      });
      if (rsp.toolCall) {
        const callId = `call-stub-${next}`;
        chunk({
          ...base,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  { index: 0, id: callId, type: 'function', function: { name: rsp.toolCall.name, arguments: '' } },
                ],
              },
              finish_reason: null,
            },
          ],
        });
        chunk({
          ...base,
          choices: [
            {
              index: 0,
              delta: { tool_calls: [{ index: 0, function: { arguments: JSON.stringify(rsp.toolCall.arguments) } }] },
              finish_reason: null,
            },
          ],
        });
        chunk({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] });
      } else {
        for (const word of (rsp.content ?? 'ok').split(/(?<=。|\.|\s)/u)) {
          if (word === '') continue;
          chunk({ ...base, choices: [{ index: 0, delta: { content: word } }] });
        }
        chunk({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
      }
      chunk({
        ...base,
        choices: [],
        usage: { prompt_tokens: 12, completion_tokens: 48, total_tokens: 60, prompt_tokens_details: { cached_tokens: 0 } },
      });
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  return new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolveListen({
        url: `http://127.0.0.1:${port}/v1`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

// —— 段 2：run ——————————————————————————————————————————————————————————————

async function runPhase() {
  const prep = JSON.parse(readFileSync(PREP_FILE, 'utf8'));
  const { teamId, agentId, projectId, todoId, userRepo } = prep;
  const database = db();
  check(DAEMON_HOME !== null, 'VERIFY_DAEMON_HOME 已给（daemon.log/workspaces 断言面）');

  // 0. daemon 在线（操作者已在段间起好；不上线说明 daemon 启动失败——先查
  //    daemon 输出，再谈后端）。
  try {
    await poll(
      async () => {
        const machines = await api('GET', `/api/teams/${teamId}/machines`);
        return (machines.json ?? []).some((m) => m.online === true) ? true : null;
      },
      90_000,
      'machine online',
    );
    check(true, 'daemon enroll + online（GET /api/teams/{t}/machines）');
  } catch (err) {
    check(false, 'daemon enroll + online', String(err?.message ?? err));
  }

  // 证据面纪律：中途异常也落盘（poll timeout / 断言抛错不能吞掉已观察到的
  // 事实——before 面红也是证据）。
  let buildId = null;
  let planTranscript = null;
  let buildTranscript = null;
  try {
  // 1. 派发：withPlan 双步链（plan → confirm → build——resume 面）。
  const started = await api('POST', `/api/projects/${projectId}/builds`, {
    todoIds: [todoId],
    assignment: { plan: { agentId }, build: { agentId } },
    withPlan: true,
  });
  buildId = started.json?.builds?.[0]?.id ?? null;
  check(started.status === 201 && Boolean(buildId), `POST /builds (withPlan) → 201`);
  payloads.startBuilds = { status: started.status, buildId };

  // 2. plan 步终态（真 claude 回合，预算 300s）。
  const planStep = await poll(
    () => {
      const row = stepRow(database, buildId, 'plan');
      return row && ['done', 'failed', 'stopped'].includes(row.status) ? row : null;
    },
    300_000,
    'plan step terminal',
  );
  payloads.planStep = planStep;

  if (BEFORE) {
    // before 面：pi 后端不识 claude-code → 步 failed（brief 里的起点事实）。
    check(planStep.status === 'failed', `before：plan 步 failed（实际 ${planStep.status}）`);
    check(
      String(planStep.status) === 'failed' &&
        stepError(database, planStep.id).includes('claude-code'),
      'before：失败原因含 claude-code（pi 侧 model not found 形）',
      stepError(database, planStep.id).slice(0, 200),
    );
    writeEvidence(database, buildId, null, null);
    return;
  }

  check(planStep.status === 'done', `A：plan 步 done（实际 ${planStep.status}）`, stepError(database, planStep.id).slice(0, 200));
  check(
    typeof planStep.sessionId === 'string' && planStep.sessionId.length > 0,
    'A：plan 步 sessionId 非空（引擎会话标识回传）',
    String(planStep.sessionId),
  );

  const todoAfterPlan = database.prepare('SELECT phase FROM todo WHERE id = ?').get(todoId);
  check(todoAfterPlan?.phase === 'confirm', `A：plan 后 todo 相位 confirm（实际 ${todoAfterPlan?.phase}）`);

  const buildRow = database
    .prepare('SELECT withPlan, planDocId, errorMessage FROM build WHERE id = ?')
    .get(buildId);
  check(
    buildRow?.withPlan === 1 && typeof buildRow?.planDocId === 'string',
    'A：plan.md 交接落库（build.planDocId 非空）',
    `planDocId=${buildRow?.planDocId}`,
  );
  const planContent = database
    .prepare('SELECT content FROM plan WHERE buildId = ? ORDER BY version DESC LIMIT 1')
    .get(buildId);
  check(
    typeof planContent?.content === 'string' && planContent.content.length > 0,
    'A：plan 行内容非空（claude 真产物）',
    `${String(planContent?.content ?? '').length} chars`,
  );

  // usage 面（A6）：done 携 usage → token_usage 行 claude-code/<model>。
  const usageRows = database
    .prepare('SELECT model, input, output, cacheRead, cacheWrite FROM token_usage WHERE buildId = ?')
    .all(buildId);
  const claudeUsage = usageRows.find((r) => r.model.startsWith('claude-code/'));
  check(
    Boolean(claudeUsage) && claudeUsage.input + claudeUsage.output + claudeUsage.cacheRead > 0,
    'A：token_usage 行 claude-code/<model> 四维计数在位',
    JSON.stringify(usageRows),
  );

  // SDK transcript（A7：CLI 自有 store；text/toolcall 行）。
  const transcriptPath = findSdkTranscript(planStep.sessionId);
  check(Boolean(transcriptPath), 'A：SDK transcript 文件在 ~/.claude/projects 唯一命中', transcriptPath);
  if (transcriptPath) {
    planTranscript = parseTranscript(transcriptPath);
    check(
      planTranscript.assistantText.length > 0,
      'A：transcript 含 assistant text 行',
      planTranscript.assistantText[0]?.slice(0, 60),
    );
    check(
      planTranscript.toolUses.length > 0,
      'A：transcript 含 toolcall 行（native 工具真执行）',
      planTranscript.toolUses.join(','),
    );
  }

  // 3. confirm → build 步（续会话面）。
  const confirmed = await api('POST', `/api/builds/${buildId}/steps`, { action: 'confirm' });
  check(confirmed.status === 202, `POST /builds/{b}/steps confirm → 202（实际 ${confirmed.status}）`);

  const buildStep = await poll(
    () => {
      const row = stepRow(database, buildId, 'build');
      return row && ['done', 'failed', 'stopped'].includes(row.status) ? row : null;
    },
    300_000,
    'build step terminal',
  );
  payloads.buildStep = buildStep;
  check(buildStep.status === 'done', `B：build 步 done（实际 ${buildStep.status}）`, stepError(database, buildStep.id).slice(0, 200));

  // resume 三证：sessionId 相等 + transcript 增长 + canon 行。
  check(
    buildStep.sessionId === planStep.sessionId && Boolean(buildStep.sessionId),
    'B：build 步 sessionId === plan 步（同会话续跑）',
    `${planStep.sessionId} → ${buildStep.sessionId}`,
  );
  const lines = daemonLogLines();
  check(
    lines.some((l) => l.includes(`continue session ${buildId}`)),
    'B：daemon log「continue session」canon 行（resume 通道走通）',
  );
  check(lines.some((l) => l.includes(`new session ${buildId}`)), 'B：plan 步「new session」canon 行在（对照组）');
  check(
    lines.some((l) => l.includes('using model claude-code/')),
    'B：canon 行 using model claude-code/<model>',
  );
  check(
    lines.some((l) => l.includes('step without remoteTools (T4)')),
    'B：[runtime] 工具面降级行在（A10 显式缺席，非静默）',
  );
  if (transcriptPath) {
    buildTranscript = parseTranscript(transcriptPath);
    check(
      buildTranscript.rowCount > (planTranscript?.rowCount ?? 0),
      'B：transcript 行数增长（第二轮追加进同一会话文件）',
      `${planTranscript?.rowCount} → ${buildTranscript.rowCount}`,
    );
  }

  // 真产物：conv 分支推回用户仓 + poem.txt。
  const branch = `pacman/conv-${buildId}`;
  let branchSha = null;
  try {
    branchSha = git(['rev-parse', '--verify', `refs/heads/${branch}`], userRepo);
  } catch {
    branchSha = null;
  }
  check(
    /^[0-9a-f]{40}$/.test(branchSha ?? ''),
    'B：conv 分支推回用户仓',
    `${branch} → ${branchSha ?? '(missing)'}`,
  );
  check(
    lines.some((l) => l.includes(`pushed ${branch}`)),
    'B：daemon log「pushed <branch>」收尾行（XMON-77 推送闸放行）',
  );
  let poem = null;
  try {
    poem = git(['show', `${branch}:${POEM_FILE}`], userRepo);
  } catch {
    poem = null;
  }
  check(typeof poem === 'string' && poem.trim().length > 0, `B：${POEM_FILE} 真产物在分支上`, (poem ?? '').split('\n')[0]?.slice(0, 40));

  const messageCount = database
    .prepare('SELECT COUNT(*) AS n FROM message WHERE conversationId = ?')
    .get(buildId);
  check((messageCount?.n ?? 0) > 0, 'B：server 侧 transcript 行落库（message 表）', `n=${messageCount?.n}`);

  // 4. pi 混跑零回归（同栈同 daemon，stub LLM）。
  const stub = await startStub([
    {
      toolCall: {
        name: 'bash',
        arguments: {
          command:
            "cat > plan.md <<'EOF'\n# 方案\n\nContext: README 无探针行。\nChanges: 追加一行 pi probe line。\nEdge cases: 无。\nVerification: 读回确认。\nEOF",
        },
      },
    },
    { content: '方案已就绪，四段完整。' },
    { toolCall: { name: 'bash', arguments: { command: `printf '${PI_PROBE_LINE}\\n' >> README.md` } } },
    { content: '修改完成并验证通过。' },
  ]);
  try {
    const provRes = await api('POST', `/api/teams/${teamId}/providers`, {
      providerId: 'r3-stub',
      label: 'r3-stub',
      baseUrl: stub.url,
      api: 'openai-completions',
      authHeader: true,
      models: [{ id: 'stub-model', name: 'stub-model' }],
      apiKey: null,
    });
    check(provRes.status === 201, 'C：POST /providers (stub) → 201');

    const piAgentRes = await api('POST', `/api/teams/${teamId}/agents`, {
      displayName: PI_AGENT_NAME,
      description: '你是验证 Agent：按任务要求用 bash 工具完成文件改动，然后简短汇报。',
      provider: 'r3-stub',
      modelId: 'stub-model',
      tools: ['推送分支'],
    });
    const piAgentId = piAgentRes.json?.id;
    check(piAgentRes.status === 201 && Boolean(piAgentId), 'C：POST /agents (pi) → 201');

    const piTodoRes = await api('POST', `/api/projects/${projectId}/todos`, {
      title: 'pi 回归探针',
      spec: '在 README.md 追加一行 pi probe line。',
    });
    const piTodoId = piTodoRes.json?.id;
    const piStarted = await api('POST', `/api/projects/${projectId}/builds`, {
      todoIds: [piTodoId],
      assignment: { plan: { agentId: piAgentId }, build: { agentId: piAgentId } },
      withPlan: true,
    });
    const piBuildId = piStarted.json?.builds?.[0]?.id;
    check(piStarted.status === 201 && Boolean(piBuildId), 'C：pi 链 startBuilds → 201');

    const piPlan = await poll(
      () => {
        const row = stepRow(database, piBuildId, 'plan');
        return row && ['done', 'failed', 'stopped'].includes(row.status) ? row : null;
      },
      120_000,
      'pi plan step terminal',
    );
    check(piPlan.status === 'done', `C：pi plan 步 done（实际 ${piPlan.status}）`, stepError(database, piPlan.id).slice(0, 200));
    const piConfirm = await api('POST', `/api/builds/${piBuildId}/steps`, { action: 'confirm' });
    check(piConfirm.status === 202, 'C：pi confirm → 202');
    const piBuildStep = await poll(
      () => {
        const row = stepRow(database, piBuildId, 'build');
        return row && ['done', 'failed', 'stopped'].includes(row.status) ? row : null;
      },
      120_000,
      'pi build step terminal',
    );
    check(piBuildStep.status === 'done', `C：pi build 步 done（实际 ${piBuildStep.status}）`, stepError(database, piBuildStep.id).slice(0, 200));

    const piUsage = database
      .prepare('SELECT model, input, output FROM token_usage WHERE buildId = ?')
      .all(piBuildId);
    check(
      piUsage.some((r) => r.model === 'r3-stub/stub-model'),
      'C：pi usage 行 r3-stub/stub-model（记账面零回归）',
      JSON.stringify(piUsage),
    );
    const piBranch = `pacman/conv-${piBuildId}`;
    let piReadme = null;
    try {
      piReadme = git(['show', `${piBranch}:README.md`], userRepo);
    } catch {
      piReadme = null;
    }
    check(
      typeof piReadme === 'string' && piReadme.includes(PI_PROBE_LINE),
      'C：pi conv 分支产物在（真执行零回归）',
    );
  } finally {
    await stub.close();
  }

  } catch (err) {
    check(false, 'probe 异常终止（已观察事实仍落盘）', String(err?.message ?? err));
  }
  writeEvidence(database, buildId, planTranscript, buildTranscript);
}

/** 步失败原因（step 行无 errorMessage——build.errorMessage 承载；两位都查）。 */
function stepError(database, stepId) {
  const buildRow = database
    .prepare('SELECT errorMessage FROM build WHERE errorMessage IS NOT NULL AND id IN (SELECT buildId FROM step WHERE id = ?)')
    .get(stepId);
  return String(buildRow?.errorMessage ?? '');
}

function writeEvidence(database, buildId, planTranscript, buildTranscript) {
  const result = {
    probe: 'claude-code-worker',
    ticket: '622',
    face: FACE,
    at: new Date().toISOString(),
    checks,
    stack: { api: API, root: ROOT, daemonHome: DAEMON_HOME, db: DB_PATH },
    buildId,
  };
  writeFileSync(join(EVIDENCE, `${FACE}-result.json`), `${JSON.stringify(result, null, 2)}\n`);
  const redacted = JSON.parse(JSON.stringify(payloads));
  writeFileSync(join(EVIDENCE, `${FACE}-responses.json`), `${JSON.stringify(redacted, null, 2)}\n`);
  if (DAEMON_HOME !== null) {
    const lines = daemonLogLines().filter((l) =>
      /runtime|session|using model|pushed|workspace|Proxy|enroll|claim|stop|fail/i.test(l),
    );
    writeFileSync(join(EVIDENCE, `${FACE}-daemon-log.txt`), `${lines.join('\n')}\n`);
  }
  if (planTranscript) {
    writeFileSync(
      join(EVIDENCE, `${FACE}-transcript.json`),
      `${JSON.stringify(
        {
          plan: planTranscript,
          build: buildTranscript,
          toolUses: [...new Set([...(planTranscript?.toolUses ?? []), ...(buildTranscript?.toolUses ?? [])])],
          assistantTextSample: (buildTranscript ?? planTranscript)?.assistantText?.[0]?.slice(0, 400) ?? null,
        },
        null,
        2,
      )}\n`,
    );
  }
  console.log(`\n${checks.length - failures}/${checks.length} PASS（${FACE} 面）`);
  console.log(`evidence: ${EVIDENCE}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

// —— 入口 ——————————————————————————————————————————————————————————————————

if (MODE === 'seed') {
  await seedPhase();
} else if (MODE === 'run') {
  await runPhase();
} else {
  console.error('用法: node <本脚本> seed | run [--before]');
  process.exit(1);
}
