// XMON-53 预检：server + daemon 分体部署集成验证（#519 的 stage 2）。
//
// 与既有集成面（helpers.bootRealServer = 同进程 app.fetch + @hono/node-server
// 监听回环）的区别就是本票的判据本身：**两个真进程**——server 由 `apps/server`
// 的 CLI 入口起（`node --import tsx src/index.ts`），绑非回环地址 + PACMAN_TOKEN
// 常开；daemon 由 `apps/daemon` 的 CLI 入口起，用 PACMAN_SERVER 指向那个非回环
// URL。中间没有进程内直连：所有字节走 TCP。
//
// 验收面（逐条对应票面「分体启动 → 机器注册 → 任务 claim → 心跳」）：
//   A 非回环绑定 + token 闸（API JSON）
//   B 机器注册（daemon.log 行 + machine.json + SQLite machine 行 + API JSON）
//   C 任务 claim（daemon.log 行 + SQLite step 行 machineId/status）
//   D 心跳（SQLite step.lastHeartbeatAt 两拍递进 + machine.online）
//   E 步收尾（SQLite step 行 + todo phase + transcript 落库）
//
// 证据落盘：`XMON53_EVIDENCE_DIR`（缺省 <repo>/docs/verify/XMON-53/run-<ts>）下
// evidence.json + server.log + daemon.log 原文。

import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENV_VARS } from '@pacman/shared';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { type StubLlm, startStubLlm } from './stub-llm.js';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SERVER_DIR = join(REPO_ROOT, 'apps/server');
const DAEMON_DIR = join(REPO_ROOT, 'apps/daemon');

// 探针驱动从 apps/server 解析：better-sqlite3 是 apps/server 的依赖，
// integration 不重复声明（同一驱动、同一版本，与 server 自己打开的文件格式一致）。
const openProbeDatabase = createRequire(new URL('../../apps/server/package.json', import.meta.url))(
  'better-sqlite3',
) as new (
  path: string,
  opts?: { fileMustExist?: boolean },
) => ProbeDatabase;

interface ProbeStatement {
  all(...params: unknown[]): SqliteRow[];
  get(...params: unknown[]): SqliteRow | undefined;
}

interface ProbeDatabase {
  prepare(sql: string): ProbeStatement;
  close(): void;
}

interface SqliteRow {
  [column: string]: unknown;
}

/** 只读探针：直开 server 的 SQLite 文件（不跑 migration，避免与活进程争写）。 */
function openProbe(dbPath: string) {
  const db = new openProbeDatabase(dbPath, { fileMustExist: true });
  return {
    rows: (sql: string, ...params: unknown[]): SqliteRow[] => db.prepare(sql).all(...params),
    row: (sql: string, ...params: unknown[]): SqliteRow | undefined =>
      db.prepare(sql).get(...params),
    close: () => db.close(),
  };
}

/** 本机非回环 IPv4（票面「常开主机绑定」的意义所在）。 */
function nonLoopbackHost(): string {
  const override = process.env.XMON53_HOST;
  if (override !== undefined && override !== '') return override;
  const candidates: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) candidates.push(addr.address);
    }
  }
  const preferred =
    candidates.find((a) => a.startsWith('192.168.')) ??
    candidates.find((a) => a.startsWith('10.')) ??
    candidates.find((a) => /^172\.(1[6-9]|2\d|3[01])\./.test(a));
  const host = preferred ?? candidates[0];
  if (host === undefined) throw new Error('no non-loopback IPv4 interface found');
  return host;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '0.0.0.0', () => {
      const port = (probe.address() as { port: number }).port;
      probe.close(() => resolve(port));
    });
  });
}

interface Evidence {
  id: string;
  claim: string;
  command: string;
  observed: string;
}

const evidence: Evidence[] = [];

function record(id: string, claim: string, command: string, observed: unknown): void {
  evidence.push({
    id,
    claim,
    command,
    observed: typeof observed === 'string' ? observed : JSON.stringify(observed, null, 2),
  });
}

/** 无凭证 / 带 token 的 REST 探针（真 HTTP，非 app.fetch）。 */
async function probe(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; raw: string; body: unknown }> {
  const res = await fetch(`http://${host}:${port}${path}`, init);
  const raw = await res.text();
  let body: unknown = null;
  try {
    body = raw === '' ? null : (JSON.parse(raw) as unknown);
  } catch {
    body = raw;
  }
  return { status: res.status, raw, body };
}

function authed(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; raw: string; body: unknown }> {
  return probe(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
  });
}

async function waitFor(fn: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (fn()) return;
    if (Date.now() > deadline) throw new Error(`waitFor timeout: ${label}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

const children: ChildProcess[] = [];
let stub: StubLlm;
let serverHome = '';
let daemonHome = '';
let evidenceDir = '';
let host = '';
let port = 0;
let token = '';
let serverUrl = '';
let teamId = '';
let apiKey = '';
let machineId = '';
let buildId = '';
let todoId = '';
let projectId = '';
let probeDb: ReturnType<typeof openProbe> | null = null;

function serverLines(): string[] {
  const path = join(evidenceDir, 'server.log');
  return existsSync(path) ? readFileSync(path, 'utf8').split('\n') : [];
}

function daemonLines(): string[] {
  const path = join(daemonHome, 'daemon.log');
  return existsSync(path) ? readFileSync(path, 'utf8').split('\n') : [];
}

/** 子进程环境：清空代理（本机 dev 代理不得介入局域网链路），隔离 PACMAN_HOME。 */
function childEnv(home: string, extra: Record<string, string>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    [ENV_VARS.home]: home,
    HTTP_PROXY: '',
    HTTPS_PROXY: '',
    http_proxy: '',
    https_proxy: '',
    NO_PROXY: '',
    ...extra,
  };
}

describe('XMON-53 server + daemon 分体部署（真进程 × 真 HTTP × 非回环绑定）', () => {
  beforeAll(async () => {
    host = nonLoopbackHost();
    port = await freePort();
    serverUrl = `http://${host}:${port}`;
    token = `xmon53-dev-${randomUUID()}`;
    serverHome = mkdtempSync(join(tmpdir(), 'xmon53-server-home-'));
    daemonHome = mkdtempSync(join(tmpdir(), 'xmon53-daemon-home-'));
    evidenceDir =
      process.env.XMON53_EVIDENCE_DIR ??
      join(REPO_ROOT, 'docs/verify/XMON-53', `run-${Date.now()}`);
    mkdirSync(evidenceDir, { recursive: true });

    // 第 1 拍慢响应：制造首步内 ≥2 拍心跳的观测窗（daemon 步级 heartbeat 固定
    // 30s）。第 2 拍快响应供 #113 的规划补写轮（stub 不落 plan.md → server 补写
    // 一轮，prompt 非空即放行 confirm）——否则补写轮会再占满一个 75s 慢窗。
    stub = await startStubLlm([
      { content: '规划完成：Context / Changes / Edge cases / Verification。', delayMs: 75_000 },
      { content: '规划补写完成：Context / Changes / Edge cases / Verification 四段齐备。' },
    ]);

    const serverLog = join(evidenceDir, 'server.log');
    const server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      cwd: SERVER_DIR,
      env: childEnv(serverHome, {
        HOST: host,
        PORT: String(port),
        PACMAN_TOKEN: token,
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(server);
    const sink = (chunk: Buffer) => {
      writeFileSync(serverLog, chunk.toString(), { flag: 'a' });
    };
    server.stdout?.on('data', sink);
    server.stderr?.on('data', sink);

    await waitFor(
      () => serverLines().some((l) => l.includes('listening') || l.includes(String(port))),
      60_000,
      'server listen line',
    );
    // 就绪以闸面应答为准（日志行文案不是契约）。
    for (let i = 0; i < 100; i += 1) {
      try {
        const res = await fetch(`${serverUrl}/api/teams`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (res.status === 200) break;
      } catch {
        // 尚未监听
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    probeDb = openProbe(join(serverHome, 'server', 'server.db'));
  }, 120_000);

  afterAll(async () => {
    writeFileSync(join(evidenceDir, 'evidence.json'), JSON.stringify(evidence, null, 2));
    const daemonLog = join(daemonHome, 'daemon.log');
    if (existsSync(daemonLog)) {
      writeFileSync(join(evidenceDir, 'daemon.log'), readFileSync(daemonLog));
    }
    probeDb?.close();
    for (const child of children) {
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    await stub?.close();
  });

  test('A 非回环绑定 + PACMAN_TOKEN 闸', async () => {
    expect(host).not.toBe('127.0.0.1');
    const open = await probe('/api/teams');
    const closed = await authed('/api/teams');
    record(
      'A1',
      'HOST=<非回环> 绑定后，/api/teams 无凭证 401、带 PACMAN_TOKEN 200',
      `curl -s -o /dev/null -w '%{http_code}' ${serverUrl}/api/teams`,
      `无凭证 → ${open.status} ${open.raw}\n带 token → ${closed.status} ${closed.raw}`,
    );
    expect(open.status).toBe(401);
    expect(closed.status).toBe(200);
    const teams = closed.body as { id: string }[];
    teamId = teams[0]!.id;
    expect(teamId).toBeTruthy();

    // 显式 HOST 的语义：只在该网卡上监听——回环口必须打不通，否则「经 HTTP URL
    // 连」这句话没有可证伪的边界（谁都能从本机回环直连进来）。
    let loopbackErr = '';
    try {
      await fetch(`http://127.0.0.1:${port}/api/teams`, {
        headers: { authorization: `Bearer ${token}` },
      });
      loopbackErr = 'connected';
    } catch (err) {
      loopbackErr =
        err instanceof Error
          ? ((err.cause as Error | undefined)?.message ?? err.message)
          : String(err);
    }
    record(
      'A2',
      'HOST=<非回环> 时回环口不监听（分体是真的走那张网卡）',
      `curl -s http://127.0.0.1:${port}/api/teams`,
      loopbackErr,
    );
    expect(loopbackErr).not.toBe('connected');
  });

  test('B 机器注册（daemon 在另一进程经 PACMAN_SERVER 指过来）', async () => {
    const issued = await authed(`/api/teams/${teamId}/api-keys`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'xmon53-bootstrap',
        gitAccess: true,
        mcpAccess: true,
        toolGrants: { read: [], write: [] },
      }),
    });
    expect(issued.status).toBe(201);
    apiKey = (issued.body as { plaintext: string }).plaintext;
    expect(apiKey.startsWith('pacman_')).toBe(true);
    record(
      'B1',
      'PACMAN_TOKEN 闸下签发机器 bootstrap apiKey',
      `curl -s -X POST -H 'Authorization: Bearer <TOKEN>' ${serverUrl}/api/teams/<teamId>/api-keys`,
      `${issued.status} ${issued.raw.slice(0, 200)}…`,
    );

    const daemon = spawn(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/cli.ts',
        'start',
        '--foreground',
        '--server',
        serverUrl,
        '--api-key',
        apiKey,
        '--team',
        teamId,
        '--name',
        'xmon53-mea',
      ],
      {
        cwd: DAEMON_DIR,
        env: childEnv(daemonHome, { [ENV_VARS.server]: serverUrl }),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    children.push(daemon);

    await waitFor(
      () => daemonLines().some((l) => l.includes('Online (machineId=')),
      90_000,
      'daemon enroll + online',
    );
    const enrolled = daemonLines().find((l) => l.includes('Online (machineId=')) ?? '';
    record(
      'B2',
      'daemon 经 PACMAN_SERVER 注册；polling 地址 = 非回环 URL（非 127.0.0.1）',
      `PACMAN_SERVER=${serverUrl} pacman start --foreground --api-key <k> --team <id>`,
      enrolled,
    );
    expect(enrolled).toContain(`polling ${serverUrl}`);

    const machineJson = JSON.parse(readFileSync(join(daemonHome, 'machine.json'), 'utf8')) as {
      serverUrl: string;
      machineId: string;
      token: string;
    };
    machineId = machineJson.machineId;
    record(
      'B3',
      'daemon 本机 machine.json 记录远端控制面地址',
      `cat ${daemonHome}/machine.json`,
      JSON.stringify({ ...machineJson, token: '<redacted>' }, null, 2),
    );
    expect(machineJson.serverUrl).toBe(serverUrl);

    const row = probeDb!.row(
      'SELECT id, name, online, kind, latestCliVersion FROM machine WHERE id = ?',
      machineId,
    );
    record(
      'B4',
      'server 侧 SQLite machine 行（注册落库）',
      `sqlite3 ${serverHome}/server/server.db "SELECT * FROM machine"`,
      JSON.stringify(row, null, 2),
    );
    expect(row?.id).toBe(machineId);
    expect(row?.name).toBe('xmon53-mea');

    const listed = await authed(`/api/teams/${teamId}/machines`);
    record(
      'B5',
      'web 面 REST 可见该机器',
      `curl -s -H 'Authorization: Bearer <TOKEN>' ${serverUrl}/api/teams/<teamId>/machines`,
      `${listed.status} ${listed.raw}`,
    );
    expect(listed.status).toBe(200);
    expect((listed.body as { id: string }[]).some((m) => m.id === machineId)).toBe(true);
  }, 150_000);

  test('C 任务 claim（真 daemon 领到真步）', async () => {
    const provider = await authed(`/api/teams/${teamId}/providers`, {
      method: 'POST',
      body: JSON.stringify({
        providerId: 'stub-gw',
        label: 'Stub Gateway',
        baseUrl: stub.url,
        api: 'openai-completions',
        authHeader: true,
        compat: { supportsDeveloperRole: false },
        models: [{ id: 'stub-model', name: 'stub-model' }],
      }),
    });
    expect(provider.status).toBe(201);

    const agent = await authed(`/api/teams/${teamId}/agents`, {
      method: 'POST',
      body: JSON.stringify({
        displayName: 'xmon53-builder',
        description: '你是分体部署验证 Agent：只输出一段简短规划，不使用工具。',
        provider: 'stub-gw',
        modelId: 'stub-model',
      }),
    });
    expect(agent.status).toBe(201);
    const agentId = (agent.body as { id: string }).id;

    const project = await authed('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'xmon53-split', teamId }),
    });
    expect(project.status).toBe(201);
    projectId = (project.body as { id: string }).id;

    const todo = await authed(`/api/projects/${projectId}/todos`, {
      method: 'POST',
      body: JSON.stringify({ title: '分体部署探针', spec: '写一行分体部署探针。' }),
    });
    expect(todo.status).toBe(201);
    todoId = (todo.body as { id: string }).id;

    const started = await authed(`/api/projects/${projectId}/builds`, {
      method: 'POST',
      body: JSON.stringify({
        todoIds: [todoId],
        assignment: { plan: { agentId }, build: { agentId } },
        withPlan: true,
      }),
    });
    expect(started.status).toBe(201);
    buildId = (started.body as { builds: { id: string }[] }).builds[0]!.id;

    await waitFor(
      () => daemonLines().some((l) => l.includes('claim step=')),
      90_000,
      'daemon claim step line',
    );
    const claimLine = daemonLines().find((l) => l.includes('claim step=')) ?? '';
    record(
      'C1',
      '远端 daemon 领到 server 派发的步',
      `grep 'claim step=' ${daemonHome}/daemon.log`,
      claimLine,
    );

    const claimed = probeDb!.row(
      'SELECT id, buildId, kind, machineId, status, claimedAt FROM step WHERE buildId = ? ORDER BY createdAt ASC LIMIT 1',
      buildId,
    );
    record(
      'C2',
      'server 侧 step 行绑定到该机器（machineId = 注册机器）',
      `sqlite3 ${serverHome}/server/server.db "SELECT * FROM step WHERE buildId='${buildId}'"`,
      JSON.stringify(claimed, null, 2),
    );
    expect(claimed?.machineId).toBe(machineId);
    expect(claimed?.status).toBe('claimed');
    expect(claimLine).toContain(`claim step=${String(claimed?.id)}`);
    expect(claimed?.id).toBeTruthy();
  }, 150_000);

  test('D 心跳（步级 lastHeartbeatAt 两拍递进 + presence 置 online）', async () => {
    const stepId = String(
      probeDb!.row('SELECT id FROM step WHERE buildId = ? ORDER BY createdAt ASC LIMIT 1', buildId)
        ?.id ?? '',
    );
    const beat = () =>
      probeDb!.row('SELECT lastHeartbeatAt FROM step WHERE id = ?', stepId)?.lastHeartbeatAt as
        | number
        | null
        | undefined;

    await waitFor(() => typeof beat() === 'number', 70_000, 'first step heartbeat');
    const first = beat() as number;
    await waitFor(
      () => {
        const now = beat();
        return typeof now === 'number' && now > first;
      },
      70_000,
      'second step heartbeat',
    );
    const second = beat() as number;

    record(
      'D1',
      '步内 30s 心跳真到达 server（lastHeartbeatAt 两拍递进）',
      `sqlite3 ${serverHome}/server/server.db "SELECT lastHeartbeatAt FROM step WHERE id='${stepId}'"`,
      `第 1 拍 = ${first} (${new Date(first).toISOString()})\n第 2 拍 = ${second} (${new Date(second).toISOString()})\n间隔 = ${Math.round((second - first) / 1000)}s`,
    );
    expect(second).toBeGreaterThan(first);
    expect(second - first).toBeGreaterThanOrEqual(25_000);

    const online = probeDb!.row('SELECT online FROM machine WHERE id = ?', machineId);
    record(
      'D2',
      'presence 心跳把机器置为 online',
      `sqlite3 ${serverHome}/server/server.db "SELECT online FROM machine WHERE id='${machineId}'"`,
      JSON.stringify(online, null, 2),
    );
    expect(Boolean(online?.online)).toBe(true);
  }, 170_000);

  test('E 步收尾回程（done → phase 推进 → transcript 落库）', async () => {
    await waitFor(
      () =>
        probeDb!.row(
          'SELECT status FROM step WHERE buildId = ? ORDER BY createdAt ASC LIMIT 1',
          buildId,
        )?.status === 'done',
      150_000,
      'step done',
    );
    const done = probeDb!.row(
      'SELECT status, sessionId, checkpointCommit FROM step WHERE buildId = ? ORDER BY createdAt ASC LIMIT 1',
      buildId,
    );
    record(
      'E1',
      '步收尾 done（sessionId 回传 = 引擎会话标识落地）',
      `sqlite3 ${serverHome}/server/server.db "SELECT status, sessionId FROM step"`,
      JSON.stringify(done, null, 2),
    );
    expect(done?.status).toBe('done');
    expect(done?.sessionId).toBeTruthy();

    const allSteps = probeDb!.rows(
      'SELECT id, kind, status, machineId FROM step WHERE buildId = ? ORDER BY createdAt ASC',
      buildId,
    );
    record(
      'E4',
      '本 build 的步队列（首轮 plan + #113 补写轮，两轮均由同一远端机器执行）',
      `sqlite3 ${serverHome}/server/server.db "SELECT id,kind,status,machineId FROM step WHERE buildId='${buildId}'"`,
      JSON.stringify(allSteps, null, 2),
    );
    expect(allSteps.every((s) => s.machineId === machineId)).toBe(true);

    // phase 推进经 #113 的规划补写轮（stub 不落 plan.md → server 补写一轮），
    // 补写轮为快响应，此处等待的是那一轮收尾后的 confirm。
    await waitFor(
      () => probeDb!.row('SELECT phase FROM todo WHERE id = ?', todoId)?.phase === 'confirm',
      90_000,
      'todo phase confirm',
    );
    const todoRow = probeDb!.row('SELECT id, phase FROM todo WHERE id = ?', todoId);
    record(
      'E2',
      '规划步完成后 todo phase 推进（远端点浏览器无关）',
      `sqlite3 ${serverHome}/server/server.db "SELECT phase FROM todo WHERE id='${todoId}'"`,
      JSON.stringify(todoRow, null, 2),
    );

    const messages = probeDb!.rows(
      'SELECT id, role FROM message WHERE conversationId = ?',
      buildId,
    );
    record(
      'E3',
      'transcript 经 upload 回程落库（消息行数）',
      `sqlite3 ${serverHome}/server/server.db "SELECT count(*) FROM message WHERE conversationId='${buildId}'"`,
      `${messages.length} 行`,
    );
    expect(messages.length).toBeGreaterThan(0);
  }, 180_000);
});
