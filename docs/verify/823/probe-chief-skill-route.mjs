#!/usr/bin/env node
// #823 发送后 skill 路由 live 证据探针（docs/verify/823 归档，随 PR 进仓）。
//
// 测的是 claim 面机制（worker 开工前路由位）：用户消息发送之后、机器认领时，
// 服务端按消息文本检测技能，提示节只进 chief.systemPrompt，step.prompt 原文不动。
// 栈内无真模型：
// - UI 全程（GIF）= 抽屉发送 → 消息落线程流；
// - 自动检测实物 = claim 载荷 JSON（systemPrompt 尾节 + instruction 原文）与
//   SQLite step 行（prompt 列逐字对账）。
// LLM 侧"核对后调用"由单测 test/chief-skill-route.test.ts 与 systemPrompt 约定行覆盖。
//
// 用法：栈先起（launch.mjs，端口见 VERIFY_RUN_DIR/ports.json），然后
//   node docs/verify/823/probe-chief-skill-route.mjs
// 依赖：一新库（重验先重 launch）；技能目录取 ports.json 的 skillsDir（scratch）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(REPO, '.claude/verify-run');
const EVIDENCE = HERE;
const portsFile = join(RUN_DIR, 'ports.json');
if (!existsSync(portsFile)) {
  process.stderr.write('无栈：' + portsFile + ' 不存在。先跑 launch.mjs\n');
  process.exit(1);
}
const stack = JSON.parse(readFileSync(portsFile, 'utf8'));
const SERVER = 'http://127.0.0.1:' + (stack.serverPort ?? 8791);
const WEB = 'http://127.0.0.1:' + (stack.webPort ?? 5273);
const SKILLS_DIR = stack.skillsDir;
const DB_PATH = join(stack.homeDir, 'server', 'server.db');

const checks = [];
function check(name, ok, detail) {
  if (typeof ok !== 'boolean') throw new TypeError('check ok 位须为 boolean: ' + name);
  checks.push({ name, ok, detail: detail ?? null });
  process.stdout.write((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : '') + '\n');
}

async function sendJson(url, body, method, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const res = await fetch(url, {
    method: method ?? 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}
async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('GET ' + url + ' → ' + res.status);
  return res.json();
}

// —— 技能种子（scratch 技能目录，空集起步）——————————————
mkdirSync(join(SKILLS_DIR, 'morning-reminder'), { recursive: true });
writeFileSync(
  join(SKILLS_DIR, 'morning-reminder', 'SKILL.md'),
  '---\nname: morning-reminder\ndescription: 定时提醒与日程通知\n---\n\n到点提醒用户。\n',
);

// —— 铺底（全 REST，非被测路径，drive-agent-identity 铺底律）——————
const teams = await getJson(SERVER + '/api/teams');
const teamId = teams[0]?.id;
if (!teamId) throw new Error('无 team——先重 launch');
await sendJson(SERVER + '/api/teams/' + teamId + '/providers', {
  providerId: 'stub-gw',
  label: 'Stub Gateway',
  baseUrl: 'http://127.0.0.1:9/v1',
  api: 'openai-completions',
  authHeader: true,
  compat: { supportsDeveloperRole: false },
  models: [{ id: 'stub-model', name: 'stub-model' }],
});
const agent = await sendJson(SERVER + '/api/teams/' + teamId + '/agents', {
  displayName: '路由探针 Agent',
  provider: 'stub-gw',
  modelId: 'stub-model',
});
const AGENT_ID = agent.body?.id ?? agent.body?.agentId;
if (!AGENT_ID) throw new Error('agent 无 id：' + JSON.stringify(agent.body));
const bind = await sendJson(
  SERVER + '/api/teams/' + teamId + '/chief',
  { agent: { agentId: AGENT_ID, thinkingLevel: null } },
  'PATCH',
);
if (bind.status !== 200) throw new Error('chief bind → ' + bind.status);

const key = await sendJson(SERVER + '/api/teams/' + teamId + '/api-keys', {
  name: 'route-823-probe',
  gitAccess: false,
  mcpAccess: false,
  toolGrants: { read: [], write: [] },
});
const keyPlain = key.body?.plaintext ?? key.body?.record?.plaintext;
if (!keyPlain) throw new Error('api-key 无 plaintext');
const enroll = await sendJson(
  SERVER + '/api/machine/enroll',
  { teamId, name: 'route-823-machine', cliVersion: '0.1.0' },
  'POST',
  keyPlain,
);
const machineToken = enroll.body?.token;
if (enroll.status !== 200 || !machineToken) throw new Error('enroll → ' + enroll.status);

async function claimStep() {
  // wire 形 = { step: ClaimedStep }，其中 ClaimedStep.step 才是 step 行——
  // 取整层 ClaimedStep（instruction/chief 在此层，不在内层行上）。
  const claim = await sendJson(SERVER + '/api/machine/tasks/claim', {}, 'POST', machineToken);
  const claimed = claim.body?.step;
  if (!claimed?.step?.id) throw new Error('claim 失败：' + JSON.stringify(claim.body));
  return { stepId: claimed.step.id, instruction: claimed.instruction, chief: claimed.chief };
}
async function finishStepOk(stepId, replyText) {
  const transcript = {
    stepId,
    messages: [{ id: 'probe-' + stepId, role: 'assistant', content: replyText, createdAt: Date.now() }],
  };
  const urls = await sendJson(
    SERVER + '/api/machine/upload-urls/' + stepId,
    { files: [{ name: 'transcript.json', size: JSON.stringify(transcript).length }] },
    'POST',
    machineToken,
  );
  const upload = urls.body?.uploads?.find((u) => u.name === 'transcript.json');
  if (!upload) throw new Error('upload-urls 无槽');
  const put = await fetch(upload.url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...upload.headers, authorization: 'Bearer ' + machineToken },
    body: JSON.stringify(transcript),
    signal: AbortSignal.timeout(8000),
  });
  if (!put.ok) throw new Error('PUT transcript → ' + put.status);
  const done = await sendJson(SERVER + '/api/machine/done/' + stepId, { status: 'success' }, 'POST', machineToken);
  if (done.status !== 200) throw new Error('done → ' + done.status);
}

// —— Case A：提醒消息 → 路由节在位 ————————————
const contentA = '明早 9 点提醒我开站会';
const threadA = await sendJson(SERVER + '/api/teams/' + teamId + '/chief/threads', { content: contentA });
if (threadA.status !== 201) throw new Error('threads A → ' + threadA.status);
const threadIdA = threadA.body?.thread?.id;
const claimedA = await claimStep();
const sysA = claimedA.chief?.systemPrompt ?? '';
check('A1 claim 载荷带路由节（发送后自动检测）', sysA.includes('发送后自动检测'));
check('A2 路由节点名已装技能 morning-reminder', sysA.includes('morning-reminder'));
check('A3 路由节带技能 description 供核对', sysA.includes('定时提醒与日程通知'));
check('A4 路由节给内置回落 set_wake', sysA.includes('set_wake'));
check('A5 用户原文不动（instruction 逐字一致）', claimedA.instruction === contentA, 'instruction=' + claimedA.instruction);
writeFileSync(
  join(EVIDENCE, 'claim-a-system-prompt.txt'),
  sysA.slice(sysA.indexOf('## 技能路由提示')),
);
writeFileSync(
  join(EVIDENCE, 'claim-a-payload.json'),
  JSON.stringify(
    { threadId: threadIdA, instruction: claimedA.instruction, trigger: claimedA.chief?.trigger },
    null,
    2,
  ) + '\n',
);
await finishStepOk(claimedA.stepId, '收到：明早 9 点提醒你开站会（set_wake 已登记）。');

// —— Case B：普通对话 → 零节 ————————————
const contentB = '明天的会议纪要帮我整理一下';
const threadB = await sendJson(SERVER + '/api/teams/' + teamId + '/chief/threads', { content: contentB });
if (threadB.status !== 201) throw new Error('threads B → ' + threadB.status);
const claimedB = await claimStep();
const sysB = claimedB.chief?.systemPrompt ?? '';
check('B1 普通对话无路由节（不劫持）', !sysB.includes('发送后自动检测'));
check('B2 用户原文不动', claimedB.instruction === contentB);
await finishStepOk(claimedB.stepId, '好的，我来整理明天的会议纪要。');

// —— SQLite 实物：step 行 prompt 列逐字对账 ————————————
const require = createRequire(join(REPO, 'apps/server/package.json'));
const Database = require('better-sqlite3');
const db = new Database(DB_PATH, { readonly: true });
const rows = db
  .prepare('SELECT id, status, prompt FROM step WHERE buildId IN (?, ?) ORDER BY createdAt')
  .all(threadIdA, threadB.body?.thread?.id);
db.close();
check('C1 落库两步均为 done 收尾', rows.length === 2 && rows.every((r) => r.status === 'done'));
check(
  'C2 step.prompt 与用户原文逐字一致（DB 实物）',
  rows[0]?.prompt === contentA && rows[1]?.prompt === contentB,
);
writeFileSync(join(EVIDENCE, 'step-rows.json'), JSON.stringify(rows, null, 2) + '\n');

// —— 浏览器面：抽屉真发送（录像转 GIF）——————————————
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 732 },
  recordVideo: { dir: join(EVIDENCE, 'video-tmp'), size: { width: 720, height: 366 } },
});
const page = await ctx.newPage();
await page.route('**/api.dicebear.com/**', (route) =>
  route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#888"/></svg>',
  }),
);
await page.goto(WEB + '/app');
await page.locator('.chief-fab').click();
await page.locator('.chief-drawer').waitFor({ state: 'visible', timeout: 8000 });
await page.locator('.chief-composer-input').fill('每天早上八点叫我起床');
await page.keyboard.press('Enter');
await page.locator('.chief-stream .chief-msg', { hasText: '每天早上八点叫我起床' }).first().waitFor({ timeout: 10000 });
check('D1 抽屉发送落流（真用户路径）', true);
await page.screenshot({ path: join(EVIDENCE, 'ui-sent.png') });
// UI 发出的线程同样走 claim 面检测（与 REST 发同形——全入口覆盖）。
const claimedC = await claimStep();
check(
  'D2 UI 发送的消息 claim 同样带路由节',
  (claimedC.chief?.systemPrompt ?? '').includes('发送后自动检测') &&
    claimedC.instruction === '每天早上八点叫我起床',
  'instruction=' + claimedC.instruction,
);
await finishStepOk(claimedC.stepId, '收到：每天早上八点叫你起床。');
const videoPath = await page.video().path();
await ctx.close();
await browser.close();
writeFileSync(join(EVIDENCE, 'video-path.txt'), videoPath + '\n');

// —— result.json ————————————
const failed = checks.filter((c) => !c.ok);
writeFileSync(
  join(EVIDENCE, 'result.json'),
  JSON.stringify(
    { probe: 'probe-chief-skill-route', ticket: 823, stack: { server: SERVER, web: WEB }, checks },
    null,
    2,
  ) + '\n',
);
process.stdout.write(failed.length === 0 ? 'ALL ' + checks.length + ' PASS\n' : failed.length + ' FAILED\n');
process.exit(failed.length === 0 ? 0 : 1);
