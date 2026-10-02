#!/usr/bin/env node
// verify-pacman 定制 probe — 647 / spec 17 T4：claude-code 工具面接线
// （remoteTools/localTools/mcpServers 经 createSdkMcpServer in-process 回调）。
//
// 断言对照（票 #647 验收）：
// after 面（本票栈）：
//   A. claude-code chief 回合全链路——总管绑 claude-code agent 发一轮：
//      claim 携 CHIEF_REMOTE_TOOLS 50 件 → claude-code 后端把工具面包成
//      `pacman` in-process MCP server → 模型真调 mcp__pacman__save_memory /
//      notify_user → relay 回服务端真执行（agent_memory 行 + chief_message
//      通知行）→ 步 done + sessionId 回传 + chief_message assistant 行。
//   B. mcpServers 第三面——绑定 agent 勾选 t4echo slug，daemon 读 probe 自备
//      config（PACMAN_MCP_CONFIG）映射 SDK stdio config，模型真调
//      mcp__t4echo__echo（transcript 铁证）。
//   C. 降级退役——daemon log 无任何 `[runtime] ... without ... (T4)` 行；
//      using model claude-code/<model> canon 行在。
//   D. pi chief remoteTools 零回归——同栈同 daemon，stub LLM pi 总管发一轮
//      真调 save_memory（pi customTool → relay 同径），memory 行落库。
//   E. localTools 面——claude-code worker 步（runtimeDrop 退役后工具面到达）
//      真调 mcp__pacman__remote_shell，预检落 shell_command 行（服务端铁证）。
// before 面（origin/main 一次性 worktree 栈，`run --before`）：同一 seed/派发
//   下 chief 步 failed，chief-err system 行含
//   `remoteTools not supported yet (T4)`——用户「总管本轮执行失败」现象。
//
// 用法（两段，段间由操作者起 daemon）：
//   段 1 seed（claude agent + chief 绑定 + api-key + MCP config，写 prep 文件）：
//     env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
//       VERIFY_REPO_ROOT=<栈仓根> VERIFY_DAEMON_HOME=<scratch> node <本脚本> seed
//   段 2 按打印行起 daemon（真实 HOME——claude 认证机器本地；代理 env 保留给
//   claude CLI 外联，daemon→server 回环自动 no-proxy；PACMAN_MCP_CONFIG 指向
//   seed 写出的 probe config），再以同 env 跑：
//     node <本脚本> run [--before]
//
// 环境契约：VERIFY_REPO_ROOT（栈仓根，缺省脚本相对 ../../..）；VERIFY_RUN_DIR
//   （缺省 <ROOT>/.claude/verify-run）；VERIFY_EVIDENCE_DIR（缺省本目录）；
//   VERIFY_DAEMON_HOME（daemon scratch——daemon.log 断言面）；prep 文件缺省
//   /tmp/pacman-647-prep.json（api-key 明文只落 /tmp，不进证据）。

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.VERIFY_REPO_ROOT
  ? resolve(process.env.VERIFY_REPO_ROOT)
  : resolve(SCRIPT_DIR, '../../..');
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(ROOT, '.claude', 'verify-run');
const EVIDENCE = process.env.VERIFY_EVIDENCE_DIR ?? SCRIPT_DIR;
const DAEMON_HOME = process.env.VERIFY_DAEMON_HOME ?? null;
const PREP_FILE = process.env.VERIFY_PREP_FILE ?? '/tmp/pacman-647-prep.json';
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
  // better-sqlite3 从栈仓解析（probe 自身零依赖；#622 同法）。
  const requireServer = createRequire(join(ROOT, 'apps', 'server', 'package.json'));
  const Database = requireServer('better-sqlite3');
  return new Database(DB_PATH, { readonly: true });
}

function chiefStepRow(database, threadId) {
  return database
    .prepare('SELECT id, kind, status, sessionId FROM step WHERE buildId = ? AND kind = ?')
    .get(threadId, 'chief');
}

function chiefMessages(database, threadId) {
  return database
    .prepare('SELECT id, role, content FROM chief_message WHERE threadId = ? ORDER BY createdAt')
    .all(threadId);
}

function daemonLogLines() {
  if (DAEMON_HOME === null) return [];
  try {
    return readFileSync(join(DAEMON_HOME, 'daemon.log'), 'utf8').split('\n');
  } catch {
    return [];
  }
}

const CLAUDE_AGENT_NAME = 'verify-647-claude';
const PI_AGENT_NAME = 'verify-647-pi-chief';
const DAEMON_NAME = 'verify-647-mbp';
const MODEL_ID = 'sonnet';
const MEMORY_TITLE = 't4-probe';
const PI_MEMORY_TITLE = 'pi-probe';
const ECHO_TOOL_TEXT = 'hello from chief';

const CHIEF_MESSAGE =
  '请依次完成三件事：' +
  '1) 调用 save_memory 工具保存一条记忆，title 填 "t4-probe"，content 填 "remoteTools relay executed via in-process MCP server"。' +
  '2) 调用 notify_user 工具，message 填 "T4 probe: relay tools executed"。' +
  `3) 调用 t4echo MCP 服务的 echo 工具，text 填 "${ECHO_TOOL_TEXT}"。` +
  '全部完成后，用一句话中文总结你调用了哪些工具。';

// —— 段 1：seed ——————————————————————————————————————————————————————————————

async function seedPhase() {
  const session = await api('GET', '/api/auth/session');
  check(session.status === 200, `GET /api/auth/session → 200（实际 ${session.status}）`);
  const teams = await api('GET', '/api/teams');
  const teamId = teams.json?.[0]?.id;
  check(Boolean(teamId), 'GET /api/teams → seed 团队在位');

  // claude-code agent（spec 17 backend 身份字面量）+ t4echo MCP 授权（第三面）。
  const agentRes = await api('POST', `/api/teams/${teamId}/agents`, {
    displayName: CLAUDE_AGENT_NAME,
    description: '验证总管：按指令调用工具并汇报。',
    provider: 'claude-code',
    modelId: MODEL_ID,
    mcpServers: ['t4echo'],
  });
  const agentId = agentRes.json?.id;
  check(agentRes.status === 201 && Boolean(agentId), 'POST /agents (claude-code) → 201');
  payloads.agentCreate = { status: agentRes.status, id: agentId };

  // chief 绑定 agent（总管主模型随绑定 Agent = claude-code/sonnet）。
  const bindRes = await api('PATCH', `/api/teams/${teamId}/chief`, {
    agent: { agentId, thinkingLevel: null },
  });
  check(bindRes.status === 200, `PATCH /chief 绑定 → 200（实际 ${bindRes.status}）`);
  payloads.bindChief = { status: bindRes.status };

  // 机器注册 key（daemon enroll 用；明文只落 /tmp prep，不进证据目录）。
  const keyRes = await api('POST', `/api/teams/${teamId}/api-keys`, {
    name: 'verify-647-machine',
    gitAccess: false,
    mcpAccess: false,
    toolGrants: { read: [], write: [] },
  });
  const plaintext = keyRes.json?.plaintext;
  check(keyRes.status === 201 && Boolean(plaintext), 'POST /api-keys → 201 + 明文一次');

  // daemon 侧 MCP config（PACMAN_MCP_CONFIG）：t4echo stdio 条目（第三面）。
  const mcpConfigPath = join(dirname(PREP_FILE), 'pacman-647-mcp.json');
  writeFileSync(
    mcpConfigPath,
    `${JSON.stringify(
      {
        mcpServers: {
          t4echo: { type: 'stdio', command: 'node', args: [join(SCRIPT_DIR, 't4-echo-server.mjs')] },
        },
      },
      null,
      2,
    )}\n`,
  );
  check(existsSync(mcpConfigPath), 'MCP config 已写（t4echo stdio 条目）', mcpConfigPath);

  writeFileSync(
    PREP_FILE,
    `${JSON.stringify({ teamId, agentId, apiKeyPlaintext: plaintext, mcpConfigPath }, null, 2)}\n`,
  );
  console.log('\nprep 已写:', PREP_FILE);
  console.log('起 daemon（真实 HOME；代理 env 保留——claude CLI 外联用，回环自动 no-proxy）:');
  console.log(`  cd ${join(ROOT, 'apps', 'daemon')} && \\`);
  console.log(
    `  env PACMAN_HOME=${DAEMON_HOME ?? '<scratch>'} PACMAN_MCP_CONFIG=${mcpConfigPath} \\`,
  );
  console.log(
    `    corepack pnpm exec tsx src/cli.ts start --foreground --server ${API} --api-key <prep 明文> --team ${teamId} --name ${DAEMON_NAME}`,
  );
}

// —— SDK transcript 读取面 ————————————————————————————————————————————————

/** ~/.claude/projects 下按 sessionId 找 CLI 会话文件（A7：transcript 在 CLI
 * 自有 store；#622 同法——按文件名全局搜，单命中即证位置唯一）。 */
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

// —— 段 2：run ——————————————————————————————————————————————————————————————

async function runPhase() {
  const prep = JSON.parse(readFileSync(PREP_FILE, 'utf8'));
  const { teamId, agentId } = prep;
  const database = db();
  check(DAEMON_HOME !== null, 'VERIFY_DAEMON_HOME 已给（daemon.log 断言面）');

  // 0. daemon 在线（操作者已在段间起好）。
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

  // 证据面纪律：中途异常也落盘（before 面红也是证据）。
  let threadId = null;
  let transcript = null;
  try {
    // 1. 总管发一轮（首条用户消息 = 工具指令）。
    const sent = await api('POST', `/api/teams/${teamId}/chief/threads`, { content: CHIEF_MESSAGE });
    threadId = sent.json?.thread?.id ?? null;
    check(sent.status === 201 && Boolean(threadId), `POST /chief/threads → 201（实际 ${sent.status}）`);
    payloads.chiefThread = { status: sent.status, threadId };

    // 2. chief 步终态（真 claude 回合 + 工具链，预算 420s）。
    const stepRow = await poll(
      () => {
        const row = chiefStepRow(database, threadId);
        return row && ['done', 'failed', 'stopped'].includes(row.status) ? row : null;
      },
      420_000,
      'chief step terminal',
    );
    payloads.chiefStep = stepRow;

    const messages = chiefMessages(database, threadId);
    const errorRow = messages.find((m) => m.id.startsWith('chief-err-'));
    const errorText = (() => {
      // chief_message content 是 json 列（存串再编码一次）——解析到对象为止
      // （最多两层），解析不动就回原始文本：断言按 includes 走，两种形都吃。
      let value = errorRow?.content;
      for (let i = 0; i < 2 && typeof value === 'string'; i += 1) {
        try {
          value = JSON.parse(value);
        } catch {
          return String(errorRow?.content ?? '');
        }
      }
      return typeof value?.message === 'string' ? value.message : String(errorRow?.content ?? '');
    })();

    if (BEFORE) {
      // before 面：T1 的 fail-closed —— chief 步 failed + chief-err system 行
      // 含 T4 字样（web 面即渲染「总管本轮执行失败」+ 该原因）。
      check(stepRow.status === 'failed', `before：chief 步 failed（实际 ${stepRow.status}）`);
      check(
        errorText.includes('remoteTools not supported yet (T4)'),
        'before：失败原因含 remoteTools not supported yet (T4)',
        errorText.slice(0, 200),
      );
      writeEvidence(database, threadId, null);
      return;
    }

    // A. chief claude-code 回合全链路。
    check(stepRow.status === 'done', `A：chief 步 done（实际 ${stepRow.status}）`, errorText.slice(0, 200));
    check(
      typeof stepRow.sessionId === 'string' && stepRow.sessionId.length > 0,
      'A：chief 步 sessionId 非空（引擎会话标识回传）',
      String(stepRow.sessionId),
    );
    check(!errorRow, 'A：无 chief-err system 行（用户面「总管本轮执行失败」不复现）', errorText.slice(0, 120));

    const transcriptPath = stepRow.sessionId ? findSdkTranscript(stepRow.sessionId) : null;
    check(Boolean(transcriptPath), 'A：SDK transcript 文件在 ~/.claude/projects 唯一命中', transcriptPath);
    if (transcriptPath) {
      transcript = parseTranscript(transcriptPath);
      check(
        transcript.toolUses.some((n) => n === 'mcp__pacman__save_memory'),
        'A：transcript 含 mcp__pacman__save_memory toolcall（remoteTools 面 + MCP 命名）',
        transcript.toolUses.join(','),
      );
      check(
        transcript.assistantText.length > 0,
        'A：transcript 含 assistant text 行',
        transcript.assistantText[0]?.slice(0, 60),
      );
      // B. mcpServers 第三面：授权 slug → SDK stdio config → 真连真调。
      check(
        transcript.toolUses.some((n) => n === 'mcp__t4echo__echo'),
        'B：transcript 含 mcp__t4echo__echo toolcall（mcpServers 面端到端）',
        transcript.toolUses.join(','),
      );
    }

    // relay 服务端真执行（工具面不是只进了 prompt——结果回模型且服务端落库）。
    const memoryRow = database
      .prepare('SELECT title, content FROM agent_memory WHERE agentId = ? AND title = ?')
      .get(agentId, MEMORY_TITLE);
    check(
      Boolean(memoryRow) && String(memoryRow?.content ?? '').includes('in-process MCP server'),
      'A：agent_memory 行 t4-probe（save_memory 经 relay 服务端执行）',
      JSON.stringify(memoryRow ?? null),
    );
    const notifyRow = database
      .prepare("SELECT id, type FROM notification WHERE entityId = ? AND type = 'chief_message'")
      .get(threadId);
    check(
      Boolean(notifyRow),
      'A：notification chief_message 行（notify_user 经 relay 服务端执行）',
      JSON.stringify(notifyRow ?? null),
    );
    const assistantRows = messages.filter((m) => m.role === 'assistant');
    check(
      assistantRows.length > 0,
      'A：chief_message assistant 行（transcript 上传落库）',
      `n=${assistantRows.length}`,
    );

    // C. 降级退役：canon 行在、[runtime] T4 降级行消失。
    const lines = daemonLogLines();
    check(
      lines.some((l) => l.includes(`using model claude-code/${MODEL_ID}`)),
      'C：canon 行 using model claude-code/<model>',
    );
    check(
      !lines.some((l) => l.includes('(T4)')),
      'C：daemon log 无任何 (T4) 降级行（runtimeDrop 退役）',
    );

    // D. pi chief remoteTools 零回归（同栈同 daemon，pi 总管一轮真调工具）。
    await piChiefFace(database, teamId);

    // E. localTools 面：claude-code worker 步带 remote_shell 走 in-process
    //    工具（runtimeDrop 退役后 worker 步工具面到达后端）——预检落
    //    shell_command 行即服务端真执行铁证。
    await workerLocalToolsFace(database, teamId);
  } catch (err) {
    check(false, 'probe 异常终止（已观察事实仍落盘）', String(err?.message ?? err));
  }
  writeEvidence(database, threadId, transcript);
}

// —— E 面：localTools（claude-code worker 步真调 remote_shell）———————————

const WORKER_AGENT_NAME = 'verify-647-worker';
const SHELL_ECHO_TEXT = 't4-local-tools-ok';
const SHELL_COMMAND = `echo ${SHELL_ECHO_TEXT}`;

async function workerLocalToolsFace(database, teamId) {
  // 机器 shell 开关（XMON-108 双闸的机器侧；agent 侧开关随创建带）。
  const machines = await api('GET', `/api/teams/${teamId}/machines`);
  const machineId = (machines.json ?? []).find((m) => m.online === true)?.id;
  check(Boolean(machineId), 'E：GET /machines → 在线机器行');
  const shellOn = await api('PATCH', `/api/machines/${machineId}`, { shellEnabled: true });
  check(shellOn.status === 200, 'E：PATCH /machines shellEnabled=true → 200');

  const agentRes = await api('POST', `/api/teams/${teamId}/agents`, {
    displayName: WORKER_AGENT_NAME,
    description: '验证 worker：按任务指令用 remote_shell 工具执行命令。',
    provider: 'claude-code',
    modelId: MODEL_ID,
    tools: ['远程 shell'],
  });
  const workerAgentId = agentRes.json?.id;
  check(agentRes.status === 201 && Boolean(workerAgentId), 'E：POST /agents (claude worker) → 201');

  // 裸项目（无 repo → 无 worktree/git 收尾面，单证 localTools）；repoKind
  // 缺席 = 普通项目（schema enum 无 null 档）。
  const projectRes = await api('POST', '/api/projects', {
    name: 'verify-647-plain',
    teamId,
  });
  const projectId = projectRes.json?.id;
  check(projectRes.status === 201 && Boolean(projectId), 'E：POST /projects (plain) → 201');

  const todoRes = await api('POST', `/api/projects/${projectId}/todos`, {
    title: '用 remote_shell 执行命令并汇报',
    spec:
      `使用 remote_shell 工具（不要用本地 shell 工具）执行命令 ${SHELL_COMMAND}，` +
      '然后在回复里逐字给出该工具返回的输出。',
  });
  const todoId = todoRes.json?.id;
  check(todoRes.status === 201 && Boolean(todoId), 'E：POST /todos → 201');

  const started = await api('POST', `/api/projects/${projectId}/builds`, {
    todoIds: [todoId],
    // assignment 两槽恒在（assignmentSchema：plan/build 各 nullable）——直派
    // = plan 空槽、build 指名。
    assignment: { plan: null, build: { agentId: workerAgentId } },
    withPlan: false,
  });
  const buildId = started.json?.builds?.[0]?.id;
  check(started.status === 201 && Boolean(buildId), 'E：POST /builds（直派 build 步）→ 201');

  const buildStep = await poll(
    () => {
      const row = database
        .prepare('SELECT id, kind, status, sessionId FROM step WHERE buildId = ? AND kind = ?')
        .get(buildId, 'build');
      return row && ['done', 'failed', 'stopped'].includes(row.status) ? row : null;
    },
    420_000,
    'worker build step terminal',
  );
  payloads.workerBuildStep = buildStep;
  check(buildStep.status === 'done', `E：build 步 done（实际 ${buildStep.status}）`);

  const transcriptPath = buildStep.sessionId ? findSdkTranscript(buildStep.sessionId) : null;
  let shellToolSeen = false;
  if (transcriptPath) {
    const t = parseTranscript(transcriptPath);
    payloads.workerTranscript = { toolUses: [...new Set(t.toolUses)] };
    shellToolSeen = t.toolUses.some((n) => n === 'mcp__pacman__remote_shell');
    check(
      shellToolSeen,
      'E：transcript 含 mcp__pacman__remote_shell toolcall（localTools 面注册 + 被调用）',
      t.toolUses.join(','),
    );
  } else {
    check(false, 'E：worker SDK transcript 未找到', String(buildStep.sessionId));
  }

  // 服务端铁证：预检落 shell_command 行（status done = 执行真跑完）。
  const shellRows = database
    .prepare('SELECT command, status FROM shell_command WHERE command = ?')
    .all(SHELL_COMMAND);
  check(
    shellRows.some((r) => r.status === 'done'),
    'E：shell_command 行 done（remote_shell 经预检闸 + 真执行）',
    JSON.stringify(shellRows),
  );
}

// —— D 面：pi chief remoteTools（stub LLM 真调 save_memory）———————————————

async function piChiefFace(database, teamId) {
  // stub LLM：第一回合发 save_memory 工具调用，第二回合回文本。
  const stub = await startStub([
    {
      toolCall: {
        name: 'save_memory',
        arguments: { title: PI_MEMORY_TITLE, content: 'pi chief relay regression ok' },
      },
    },
    { content: '已完成：保存了一条记忆。' },
  ]);
  try {
    const provRes = await api('POST', `/api/teams/${teamId}/providers`, {
      providerId: 'r3-stub-647',
      label: 'r3-stub-647',
      baseUrl: stub.url,
      api: 'openai-completions',
      authHeader: true,
      models: [{ id: 'stub-model', name: 'stub-model' }],
      apiKey: null,
    });
    check(provRes.status === 201, 'D：POST /providers (stub) → 201');

    const piAgentRes = await api('POST', `/api/teams/${teamId}/agents`, {
      displayName: PI_AGENT_NAME,
      description: 'pi 验证总管：按指令调用工具。',
      provider: 'r3-stub-647',
      modelId: 'stub-model',
    });
    const piAgentId = piAgentRes.json?.id;
    check(piAgentRes.status === 201 && Boolean(piAgentId), 'D：POST /agents (pi) → 201');

    const rebind = await api('PATCH', `/api/teams/${teamId}/chief`, {
      agent: { agentId: piAgentId, thinkingLevel: null },
    });
    check(rebind.status === 200, 'D：PATCH /chief 绑 pi agent → 200');

    const sent = await api('POST', `/api/teams/${teamId}/chief/threads`, {
      content: `调用 save_memory 工具保存 title "${PI_MEMORY_TITLE}" content "pi chief relay regression ok"，然后回复完成。`,
    });
    const piThreadId = sent.json?.thread?.id;
    check(sent.status === 201 && Boolean(piThreadId), 'D：POST /chief/threads (pi) → 201');

    const piStep = await poll(
      () => {
        const row = chiefStepRow(database, piThreadId);
        return row && ['done', 'failed', 'stopped'].includes(row.status) ? row : null;
      },
      120_000,
      'pi chief step terminal',
    );
    payloads.piChiefStep = piStep;
    check(piStep.status === 'done', `D：pi chief 步 done（实际 ${piStep.status}）`);

    const piMemory = database
      .prepare('SELECT title FROM agent_memory WHERE agentId = ? AND title = ?')
      .get(piAgentId, PI_MEMORY_TITLE);
    check(Boolean(piMemory), 'D：pi 总管 memory 行落库（customTool → relay 同径零回归）');
  } finally {
    await stub.close();
  }
}

// —— stub LLM（openai-completions SSE，#622 同构）——————————————————————————

import { createServer } from 'node:http';

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
      chunk({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] });
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

// —— 证据落盘 ——————————————————————————————————————————————————————————————

function writeEvidence(database, threadId, transcript) {
  const result = {
    probe: 'claude-code-chief',
    ticket: '647',
    face: FACE,
    at: new Date().toISOString(),
    checks,
    stack: { api: API, root: ROOT, daemonHome: DAEMON_HOME, db: DB_PATH },
    threadId,
  };
  writeFileSync(join(EVIDENCE, `${FACE}-result.json`), `${JSON.stringify(result, null, 2)}\n`);
  const redacted = JSON.parse(JSON.stringify(payloads));
  writeFileSync(join(EVIDENCE, `${FACE}-responses.json`), `${JSON.stringify(redacted, null, 2)}\n`);
  if (DAEMON_HOME !== null) {
    const lines = daemonLogLines().filter((l) =>
      /runtime|session|using model|mcp|skills|Proxy|enroll|claim|stop|fail|step/i.test(l),
    );
    writeFileSync(join(EVIDENCE, `${FACE}-daemon-log.txt`), `${lines.join('\n')}\n`);
  }
  if (threadId !== null) {
    const rows = chiefMessages(database, threadId);
    writeFileSync(
      join(EVIDENCE, `${FACE}-chief-messages.json`),
      `${JSON.stringify(rows, null, 2)}\n`,
    );
  }
  if (transcript) {
    writeFileSync(
      join(EVIDENCE, `${FACE}-transcript.json`),
      `${JSON.stringify(
        {
          rowCount: transcript.rowCount,
          toolUses: [...new Set(transcript.toolUses)],
          assistantTextSample: transcript.assistantText[0]?.slice(0, 400) ?? null,
        },
        null,
        2,
      )}\n`,
    );
  }
  console.log(`\n${FACE} 面：${checks.length - failures}/${checks.length} PASS`);
  if (failures > 0) process.exitCode = 1;
}

if (MODE === 'seed') {
  await seedPhase();
} else if (MODE === 'run') {
  await runPhase();
} else {
  console.error('用法：node <本脚本> seed | run [--before]');
  process.exit(2);
}
