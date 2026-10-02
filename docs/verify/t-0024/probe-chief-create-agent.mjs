#!/usr/bin/env node
// verify-pacman 定制 probe — t-0024 诉求 1：chief create_agent / update_agent
// 执行面取证（模型字段真落库）。
// 复用法:先起隔离 live 栈(launch.mjs;建议 HOME 指合成 settings.json 的 scratch
// 目录,免得 claude-code 段带出真人配置),再跑本脚本:
//   env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
//     node docs/verify/t-0024/probe-chief-create-agent.mjs
//
// 取证对照(诉求 1「通过 chief 创建 agent 并指定模型」):
// 1. chief 步 claim 载荷的 remoteTools 含 create_agent,且其 parameters 带
//    provider / modelId 两参数——词表真到达 chief 会话(模型可指定不是纸面)。
// 2. chief 会话 relay 形态(POST /api/machine/tool/<stepId> {name, params},
//    与 daemon 真实调用同形)调 create_agent 带 provider/modelId → 200,
//    agent 行真建出且两字段落库(REST GET 回读 + SQLite 行双真值)。
// 3. update_agent 改 modelId / 改 provider 各自生效(REST GET 回读)。
// 4. chief 建的 agent 在 UI 详情概览回读得到(runtime 行 + 模型行)——截图。
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

const CHIEF_NAME = 'verify-t0024-chief';
const MADE_NAME = 'chief-made-agent';

try {
  // 0. 栈健康
  const session = await api('GET', '/api/auth/session');
  payloads.session = session;
  check(session.status === 200, `GET /api/auth/session → 200(实际 ${session.status})`);

  const teams = await api('GET', '/api/teams');
  const teamId = teams.json?.[0]?.id;
  check(Boolean(teamId), 'GET /api/teams → seed 团队在位');
  payloads.team = { id: teamId };

  // 1. 两个 custom provider(模型候选源;chief 建 agent 时指定的 provider 必须
  //    真存在,落库回读才有对照)
  const provA = await api('POST', `/api/teams/${teamId}/providers`, {
    providerId: 'r3-gw',
    label: 'r3-gw',
    baseUrl: 'https://gw.example/v1',
    api: 'anthropic-messages',
    authHeader: true,
    models: [
      { id: 'glm-5.3', name: 'glm-5.3' },
      { id: 'qwen3.8-max', name: 'qwen3.8-max' },
    ],
    apiKey: null,
  });
  const provB = await api('POST', `/api/teams/${teamId}/providers`, {
    providerId: 'b-gw',
    label: 'b-gw',
    baseUrl: 'https://b.example/v1',
    api: 'anthropic-messages',
    authHeader: true,
    models: [{ id: 'deepseek-v4-pro', name: 'deepseek-v4-pro' }],
    apiKey: null,
  });
  payloads.providers = { a: provA.status, b: provB.status };
  check(provA.status === 201 && provB.status === 201, `POST /providers ×2 → 201(实际 ${provA.status}/${provB.status})`);

  // 2. chief 绑定 Agent
  const chiefAgentRes = await api('POST', `/api/teams/${teamId}/agents`, {
    displayName: CHIEF_NAME,
    provider: 'r3-gw',
    modelId: 'glm-5.3',
  });
  const chiefAgentId = chiefAgentRes.json?.id;
  const bindRes = await api('PATCH', `/api/teams/${teamId}/chief`, {
    agent: { agentId: chiefAgentId, thinkingLevel: null },
  });
  payloads.chiefBind = bindRes;
  check(bindRes.status === 200, `PATCH /chief 绑定 → 200(实际 ${bindRes.status})`);

  // 3. 机器 enroll(chief 步的 claim/relay 凭据面)
  const keyRes = await api('POST', `/api/teams/${teamId}/api-keys`, {
    name: 'verify-t0024-machine',
    gitAccess: false,
    mcpAccess: false,
    toolGrants: { read: [], write: [] },
  });
  const plain = keyRes.json?.plaintext ?? keyRes.json?.apiKey ?? keyRes.json?.key;
  check(keyRes.status === 201 && Boolean(plain), 'POST /api-keys → 201 + 明文一次');
  const enrollRes = await api(
    'POST',
    '/api/machine/enroll',
    { teamId, name: 'verify-t0024-mbp', cliVersion: '0.1.0' },
    plain,
  );
  const machineToken = enrollRes.json?.token;
  check(enrollRes.status === 200 && Boolean(machineToken), 'POST /machine/enroll → 200 + token');

  // 4. chief 会话:发消息 → 机器领 chief 步
  const msgRes = await api('POST', `/api/teams/${teamId}/chief/threads`, {
    content: `帮我创建一个叫 ${MADE_NAME} 的 agent,用 r3-gw 的 qwen3.8-max。`,
  });
  payloads.chiefMessage = msgRes;
  check(msgRes.status === 201, `POST /chief/threads → 201(实际 ${msgRes.status})`);
  const claimRes = await api('POST', '/api/machine/tasks/claim', {}, machineToken);
  payloads.chiefClaim = {
    status: claimRes.status,
    kind: claimRes.json?.step?.step?.kind,
    remoteToolNames: (claimRes.json?.step?.remoteTools ?? []).map((t) => t.name),
  };
  const chiefStepId = claimRes.json?.step?.step?.id;
  check(
    claimRes.status === 200 && claimRes.json?.step?.step?.kind === 'chief',
    `claim → chief 步(实际 kind=${claimRes.json?.step?.step?.kind})`,
  );

  // 5. 词表面:create_agent 在 chief 会话拿到的工具定义里,且带 provider/modelId
  const createTool = (claimRes.json?.step?.remoteTools ?? []).find(
    (t) => t.name === 'create_agent',
  );
  payloads.createAgentTool = createTool ?? null;
  const props = createTool?.parameters?.properties ?? {};
  check(
    createTool !== undefined && 'provider' in props && 'modelId' in props,
    'claim 载荷 remoteTools 的 create_agent 带 provider/modelId 参数',
    `properties=${Object.keys(props).join(',')}`,
  );
  const updateTool = (claimRes.json?.step?.remoteTools ?? []).find(
    (t) => t.name === 'update_agent',
  );
  const uprops = updateTool?.parameters?.properties ?? {};
  check(
    updateTool !== undefined && 'provider' in uprops && 'modelId' in uprops,
    'claim 载荷 remoteTools 的 update_agent 带 provider/modelId 参数',
    `properties=${Object.keys(uprops).join(',')}`,
  );

  // 6. chief relay create_agent(daemon 真实调用形态 {name, params} → {text})
  const createRes = await api(
    'POST',
    `/api/machine/tool/${chiefStepId}`,
    {
      name: 'create_agent',
      params: {
        displayName: MADE_NAME,
        description: 'chief 建的探针 agent',
        provider: 'r3-gw',
        modelId: 'qwen3.8-max',
      },
    },
    machineToken,
  );
  payloads.chiefCreateAgent = createRes;
  const madeId = (() => {
    try {
      return JSON.parse(String(createRes.json?.text ?? '{}')).id;
    } catch {
      return undefined;
    }
  })();
  check(
    createRes.status === 200 && Boolean(madeId),
    `chief relay create_agent → 200 + text 含 id(实际 ${createRes.status} ${String(createRes.json?.text ?? '').slice(0, 60)})`,
  );

  // 7. 落库回读:REST GET 与 SQLite 双真值
  const madeGet = await api('GET', `/api/teams/${teamId}/agents/${madeId}`);
  payloads.madeAgentGet = madeGet;
  check(
    madeGet.status === 200 &&
      madeGet.json?.displayName === MADE_NAME &&
      madeGet.json?.provider === 'r3-gw' &&
      madeGet.json?.modelId === 'qwen3.8-max',
    'chief 建的 agent REST 回读 provider/modelId 与指定一致',
    `provider=${madeGet.json?.provider} modelId=${madeGet.json?.modelId}`,
  );
  const requireServer = createRequire(join(ROOT, 'apps', 'server', 'package.json'));
  const Database = requireServer('better-sqlite3');
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const row = db
      .prepare('SELECT id, displayName, provider, modelId FROM agent WHERE id = ?')
      .get(madeId);
    payloads.sqliteMadeRow = row;
    check(
      row?.provider === 'r3-gw' && row?.modelId === 'qwen3.8-max',
      'SQLite agent 行 provider/modelId 落库',
      `provider=${row?.provider} modelId=${row?.modelId}`,
    );
  } finally {
    db.close();
  }

  // 8. update_agent 改模型 / 改 provider 各自生效
  const updModel = await api(
    'POST',
    `/api/machine/tool/${chiefStepId}`,
    { name: 'update_agent', params: { agentId: madeId, modelId: 'glm-5.3' } },
    machineToken,
  );
  payloads.chiefUpdateModel = updModel;
  const afterModel = await api('GET', `/api/teams/${teamId}/agents/${madeId}`);
  check(
    updModel.status === 200 && afterModel.json?.modelId === 'glm-5.3',
    `chief relay update_agent 改 modelId → 回读生效(实际 ${afterModel.json?.modelId})`,
  );
  const updProv = await api(
    'POST',
    `/api/machine/tool/${chiefStepId}`,
    { name: 'update_agent', params: { agentId: madeId, provider: 'b-gw' } },
    machineToken,
  );
  payloads.chiefUpdateProvider = updProv;
  const afterProv = await api('GET', `/api/teams/${teamId}/agents/${madeId}`);
  check(
    updProv.status === 200 &&
      afterProv.json?.provider === 'b-gw' &&
      afterProv.json?.modelId === 'glm-5.3',
    `chief relay update_agent 改 provider → 回读生效且不动 modelId(实际 ${afterProv.json?.provider}/${afterProv.json?.modelId})`,
  );

  // 9. UI 回读:chief 建的 agent 详情概览见 runtime 行 + 模型行(截图;本票 B 改
  //    前的平铺形态即 before 证据之一)
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 732 },
    colorScheme: 'dark',
  });
  try {
    await page.goto(`${WEB}/app/resources/agents/${madeId}`);
    await page.waitForSelector('.agent-overview', { timeout: 15_000 });
    const runtimeText = await page.locator('.agent-runtime').textContent();
    payloads.uiRuntime = runtimeText;
    check(
      String(runtimeText ?? '').includes('b-gw'),
      `UI 概览运行时行回读 chief 写的 provider(实际 ${runtimeText})`,
    );
    await page.screenshot({ path: join(EVIDENCE, 'chief-created-agent-detail.png') });
    console.log('shot  chief-created-agent-detail.png');
  } finally {
    await browser.close();
  }
} catch (err) {
  check(false, 'probe 异常终止', String(err?.message ?? err));
}

const result = {
  probe: 'chief-create-agent',
  ticket: 't-0024',
  at: new Date().toISOString(),
  checks,
  stack: { api: API, web: WEB, homeDir: stack.homeDir, root: ROOT },
};
writeFileSync(join(EVIDENCE, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
writeFileSync(join(EVIDENCE, 'responses.json'), `${JSON.stringify(payloads, null, 2)}\n`);
console.log(`\n${checks.length - failures}/${checks.length} PASS`);
console.log(`evidence:${EVIDENCE}`);
process.exit(failures === 0 ? 0 : 1);
