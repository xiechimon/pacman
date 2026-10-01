#!/usr/bin/env node
// verify-pacman 定制 probe — XMON-115 chief set_remote_shell 写入点回摆。
// 复用法:先起隔离 live 栈(launch.mjs),再跑本脚本(仓根 docs/verify/XMON-115/
// 自带,证据落同目录,随 PR 提交——本票证据纪律 2026-10-02 用户拍板:证据进
// PR 不进 Multica 评论):
//   env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
//     node docs/verify/XMON-115/probe-set-remote-shell.mjs
//
// 验收对照(票 XMON-115):
// 1. chief 会话内 relay set_remote_shell 授予/撤销 → 该 agent 下一次 worker
//    claim 的 localTools 反映(词 = wire 词 remote_shell)。
// 2. 与 REST PATCH /agents/{aid} 同字段:chief 写后 REST GET 回读一致;反向
//    同律(REST PATCH 写 → claim 反映);UI 权限 tab 回读「远程 shell」开关勾选。
// 3. SQLite agent.tools 行 = 开关词「远程 shell」(label 落库,wire 词只在
//    claim 载荷——两层词汇判定的钉点)。
// 运行前置:proxy env 全 unset(回环请求过代理会 502 假阳性)。

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.VERIFY_REPO_ROOT
  ? resolve(process.env.VERIFY_REPO_ROOT)
  : resolve(SCRIPT_DIR, '../../..');
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(ROOT, '.claude', 'verify-run');
const EVIDENCE = process.env.VERIFY_EVIDENCE_DIR ?? SCRIPT_DIR;

let stack;
try {
  stack = JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'));
} catch {
  console.error(`无栈:${join(RUN_DIR, 'ports.json')} 不存在或损坏。先跑 launch.mjs`);
  process.exit(1);
}
const API = `http://127.0.0.1:${stack.serverPort}`;
const WEB = `http://127.0.0.1:${stack.webPort}`;
const DB_PATH = join(stack.homeDir, 'server', 'server.db');

mkdirSync(EVIDENCE, { recursive: true });

const checks = [];
let failures = 0;
const check = (ok, label, detail) => {
  checks.push({ ok, label, detail: detail ?? null });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const payloads = {};
async function api(method, path, body, cred) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cred) headers.authorization = `Bearer ${cred}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const WORKER_NAME = 'verify-115-shell';
const CHIEF_NAME = 'verify-115-chief';

try {
  // 0. 栈健康
  const session = await api('GET', '/api/auth/session');
  payloads.session = session;
  check(session.status === 200, `GET /api/auth/session → 200(实际 ${session.status})`);

  const teams = await api('GET', '/api/teams');
  const teamId = teams.json?.[0]?.id;
  check(Boolean(teamId), 'GET /api/teams → seed 团队在位');
  payloads.team = { id: teamId };

  // 1. 目标 agent(REST 创建,缺省 tools = AGENT_TOOL_DEFAULTS「推送分支」)
  const agentRes = await api('POST', `/api/teams/${teamId}/agents`, {
    displayName: WORKER_NAME,
    provider: 'stub-gw',
    modelId: 'stub-model',
  });
  payloads.agentCreated = agentRes;
  const agentId = agentRes.json?.id;
  check(
    agentRes.status === 201 && Boolean(agentId),
    `POST /agents → 201 {id}(实际 ${agentRes.status})`,
  );
  // 创建响应只有 {id}(r5 §1/§8);缺省 tools 用 GET 回读证。
  const agentInitial = await api('GET', `/api/teams/${teamId}/agents/${agentId}`);
  payloads.agentInitial = agentInitial;
  check(
    JSON.stringify(agentInitial.json?.tools) === JSON.stringify(['推送分支']),
    `新建 agent 缺省 tools = [推送分支](GET 回读,实际 ${JSON.stringify(agentInitial.json?.tools)})`,
  );

  // 2. chief 绑定 Agent(会话触发面)
  const chiefAgentRes = await api('POST', `/api/teams/${teamId}/agents`, {
    displayName: CHIEF_NAME,
    provider: 'stub-gw',
    modelId: 'stub-model',
  });
  const chiefAgentId = chiefAgentRes.json?.id;
  const bindRes = await api('PATCH', `/api/teams/${teamId}/chief`, {
    agent: { agentId: chiefAgentId, thinkingLevel: null },
  });
  payloads.chiefBind = bindRes;
  check(bindRes.status === 200, `PATCH /chief 绑定 → 200(实际 ${bindRes.status})`);

  // 3. 机器 enroll + 机器 shell 闸(XMON-108 双闸的机器半;agent 半是本票写点)
  const keyRes = await api('POST', `/api/teams/${teamId}/api-keys`, {
    name: 'verify-115-machine',
    gitAccess: false,
    mcpAccess: false,
    toolGrants: { read: [], write: [] },
  });
  const plain = keyRes.json?.plaintext ?? keyRes.json?.apiKey ?? keyRes.json?.key;
  check(keyRes.status === 201 && Boolean(plain), 'POST /api-keys → 201 + 明文一次');
  const enrollRes = await api(
    'POST',
    '/api/machine/enroll',
    { teamId, name: 'verify-115-mbp', cliVersion: '0.1.0' },
    plain,
  );
  payloads.enroll = { status: enrollRes.status, machineId: enrollRes.json?.machineId };
  const machineToken = enrollRes.json?.token;
  const machineId = enrollRes.json?.machineId;
  check(enrollRes.status === 200 && Boolean(machineToken), 'POST /machine/enroll → 200 + token');
  const machineShellRes = await api('PATCH', `/api/machines/${machineId}`, {
    shellEnabled: true,
  });
  payloads.machineShellOn = machineShellRes;
  check(
    machineShellRes.status === 200 && machineShellRes.json?.shellEnabled === true,
    `PATCH /machines/{id} shellEnabled:true → 200 回显(实际 ${machineShellRes.status})`,
  );

  // 4. chief 会话:发消息 → 机器领 chief 步 → relay set_remote_shell(daemon 真实
  //    调用形态 {name, params} → {text})
  const msgRes = await api('POST', `/api/teams/${teamId}/chief/threads`, {
    content: `给 ${WORKER_NAME} 开远程 shell。`,
  });
  payloads.chiefMessage = msgRes;
  check(msgRes.status === 201, `POST /chief/threads → 201(实际 ${msgRes.status})`);
  const claimRes = await api('POST', '/api/machine/tasks/claim', {}, machineToken);
  payloads.chiefClaim = { status: claimRes.status, kind: claimRes.json?.step?.step?.kind };
  const chiefStepId = claimRes.json?.step?.step?.id;
  check(
    claimRes.status === 200 && claimRes.json?.step?.step?.kind === 'chief',
    `claim → chief 步(实际 kind=${claimRes.json?.step?.step?.kind})`,
  );

  const grantRes = await api(
    'POST',
    `/api/machine/tool/${chiefStepId}`,
    { name: 'set_remote_shell', params: { agentId, enabled: true } },
    machineToken,
  );
  payloads.chiefGrant = grantRes;
  check(
    grantRes.status === 200 && String(grantRes.json?.text ?? '').includes('"remoteShell":true'),
    `chief relay 授予 → 200 + text 含 remoteShell:true(实际 ${grantRes.status} ${grantRes.json?.text})`,
  );

  // 5. 授予后 REST 回读(验收 #2 前半;字段 = agent.tools 开关词)
  const afterGrant = await api('GET', `/api/teams/${teamId}/agents/${agentId}`);
  payloads.agentAfterGrant = afterGrant;
  check(
    JSON.stringify(afterGrant.json?.tools) === JSON.stringify(['推送分支', '远程 shell']),
    `授予后 GET /agents/{aid}.tools = [推送分支,远程 shell](实际 ${JSON.stringify(afterGrant.json?.tools)})`,
  );

  // 6. 授予后下一次 worker claim:localTools 含 remote_shell(验收 #1)
  let localToolsAfterGrant = null;
  {
    const projRes = await api('POST', '/api/projects', { name: 'verify-115-proj' });
    const projectId = projRes.json?.id;
    const todoRes = await api('POST', `/api/projects/${projectId}/todos`, {
      title: 'verify-115 shell 任务',
      spec: '跑一行探针命令',
    });
    const todoId = todoRes.json?.id;
    await api('POST', `/api/projects/${projectId}/builds`, {
      todoIds: [todoId],
      assignment: { plan: null, build: { agentId } },
      withPlan: false,
    });
    const workerClaim = await api('POST', '/api/machine/tasks/claim', {}, machineToken);
    payloads.workerClaimAfterGrant = {
      status: workerClaim.status,
      kind: workerClaim.json?.step?.step?.kind,
      localTools: workerClaim.json?.step?.localTools,
    };
    localToolsAfterGrant = workerClaim.json?.step?.localTools ?? [];
    check(
      localToolsAfterGrant.includes('remote_shell'),
      `授予后 worker claim localTools 含 remote_shell(实际 ${JSON.stringify(localToolsAfterGrant)})`,
    );
  }

  // 7. chief 会话撤销 → REST 回读不含 + 下一次 claim 不含(fail-closed:机器闸
  //    仍开,只关 agent 闸)
  const revokeRes = await api(
    'POST',
    `/api/machine/tool/${chiefStepId}`,
    { name: 'set_remote_shell', params: { agentId, enabled: false } },
    machineToken,
  );
  payloads.chiefRevoke = revokeRes;
  check(
    revokeRes.status === 200 && String(revokeRes.json?.text ?? '').includes('"remoteShell":false'),
    `chief relay 撤销 → 200 + text 含 remoteShell:false(实际 ${revokeRes.status})`,
  );
  const afterRevoke = await api('GET', `/api/teams/${teamId}/agents/${agentId}`);
  payloads.agentAfterRevoke = afterRevoke;
  check(
    JSON.stringify(afterRevoke.json?.tools) === JSON.stringify(['推送分支']),
    `撤销后 GET /agents/{aid}.tools = [推送分支](实际 ${JSON.stringify(afterRevoke.json?.tools)})`,
  );
  {
    const projList = await api('GET', '/api/projects');
    const projectId = projList.json?.[0]?.id;
    const todoRes = await api('POST', `/api/projects/${projectId}/todos`, {
      title: 'verify-115 shell 任务 2',
      spec: '跑一行探针命令',
    });
    const todoId = todoRes.json?.id;
    await api('POST', `/api/projects/${projectId}/builds`, {
      todoIds: [todoId],
      assignment: { plan: null, build: { agentId } },
      withPlan: false,
    });
    const workerClaim = await api('POST', '/api/machine/tasks/claim', {}, machineToken);
    payloads.workerClaimAfterRevoke = {
      status: workerClaim.status,
      kind: workerClaim.json?.step?.step?.kind,
      localTools: workerClaim.json?.step?.localTools,
    };
    const localTools = workerClaim.json?.step?.localTools ?? [];
    check(
      !localTools.includes('remote_shell'),
      `撤销后 worker claim localTools 不含 remote_shell(实际 ${JSON.stringify(localTools)})`,
    );
  }

  // 8. 反向同律(验收 #2 后半):REST PATCH 写「远程 shell」→ claim 反映
  //    (双入口单真值:两条写路径同一字段同一 filterAgentTools)
  const patchRes = await api('PATCH', `/api/teams/${teamId}/agents/${agentId}`, {
    tools: ['推送分支', '远程 shell'],
  });
  payloads.restPatch = patchRes;
  check(
    patchRes.status === 200 && patchRes.json?.tools?.includes('远程 shell'),
    `REST PATCH /agents/{aid} 授予 → 200 回显含「远程 shell」(实际 ${patchRes.status})`,
  );
  {
    const projList = await api('GET', '/api/projects');
    const projectId = projList.json?.[0]?.id;
    const todoRes = await api('POST', `/api/projects/${projectId}/todos`, {
      title: 'verify-115 shell 任务 3',
      spec: '跑一行探针命令',
    });
    const todoId = todoRes.json?.id;
    await api('POST', `/api/projects/${projectId}/builds`, {
      todoIds: [todoId],
      assignment: { plan: null, build: { agentId } },
      withPlan: false,
    });
    const workerClaim = await api('POST', '/api/machine/tasks/claim', {}, machineToken);
    payloads.workerClaimAfterRest = {
      status: workerClaim.status,
      kind: workerClaim.json?.step?.step?.kind,
      localTools: workerClaim.json?.step?.localTools,
    };
    const localTools = workerClaim.json?.step?.localTools ?? [];
    check(
      localTools.includes('remote_shell'),
      `REST 授予后 worker claim localTools 含 remote_shell(实际 ${JSON.stringify(localTools)})`,
    );
  }

  // 9. SQLite 只读真值:agent 行 tools = 开关词(不是 wire 词)
  const requireServer = createRequire(join(ROOT, 'apps', 'server', 'package.json'));
  const Database = requireServer('better-sqlite3');
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const row = db.prepare('SELECT id, displayName, tools FROM agent WHERE id = ?').get(agentId);
    payloads.sqliteAgentRow = row;
    check(
      JSON.parse(String(row?.tools ?? '[]')).join(',') === '推送分支,远程 shell',
      `SQLite agent.tools = [推送分支,远程 shell](列存 JSON 串,实际 ${row?.tools})`,
    );
  } finally {
    db.close();
  }

  // 10. UI 回读(验收 #2 的 UI 半):agent 详情路由(团队页卡片的 href)→
  //     权限 tab → 「远程 shell」开关勾选(chief 写后 UI 真值一致)
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 732 },
    colorScheme: 'dark',
  });
  try {
    await page.goto(`${WEB}/app/resources/agents/${agentId}`);
    await page.waitForSelector('.agent-overview', { timeout: 15_000 });
    await page.locator('.agent-tab').nth(2).click();
    await page.waitForSelector('.agent-perms', { timeout: 15_000 });
    const shellSwitch = page.locator('.agent-tool-switch[aria-label="远程 shell"]');
    const shellCount = await shellSwitch.count();
    const ariaChecked = shellCount === 1 ? await shellSwitch.getAttribute('aria-checked') : null;
    payloads.uiShellSwitch = { count: shellCount, ariaChecked };
    check(
      shellCount === 1 && ariaChecked === 'true',
      `UI 权限 tab「远程 shell」开关唯一且勾选(实际 count=${shellCount} checked=${ariaChecked})`,
    );
    await page.screenshot({ path: join(EVIDENCE, 'XMON-115-permissions-after-chief-grant.png') });
    console.log('shot  XMON-115-permissions-after-chief-grant.png');
  } finally {
    await browser.close();
  }
} catch (err) {
  check(false, 'probe 异常终止', String(err?.message ?? err));
}

const result = {
  probe: 'set-remote-shell',
  ticket: 'XMON-115',
  at: new Date().toISOString(),
  checks,
  stack: { api: API, web: WEB, homeDir: stack.homeDir, root: ROOT },
};
writeFileSync(join(EVIDENCE, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
writeFileSync(join(EVIDENCE, 'responses.json'), `${JSON.stringify(payloads, null, 2)}\n`);
console.log(`\n${checks.length - failures}/${checks.length} PASS`);
console.log(`evidence:${EVIDENCE}`);
process.exit(failures === 0 ? 0 : 1);
