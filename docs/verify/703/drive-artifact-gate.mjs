#!/usr/bin/env node
// #703 产物闸 live 验证（verify 栈 + machine wire 直驱）：
//   形态 1（B-C10 弱模型不写方案）：withPlan 两轮 plan 步 done 无 plan.md
//     → 失败收尾「规划未产出方案」，confirm 不可达；首轮后补写轮入队且
//     claim 载荷 instruction 携补写指令（server→daemon 续轮指令通道）。
//   形态 2（B-C11 零改动 build）：直执行步 done success + hasChanges=false
//     → 失败收尾「构建零改动」，review 不可达。
//   形态 3（B-C14 假完成）：done success 带 sessionId、零 usage 零产物
//     → 同按失败收尾，不当 done。
//   负例（有物过闸）：plan.md 经 upload-urls 上传 → confirm（hasPlan）；
//     confirm → build done hasChanges=true → review（hasChanges）。
// 真值：REST 读（todo/build/steps）+ SQLite todo/build/plan 行 + 截图（board
// 失败列 + 详情失败行）。证据落 VERIFY_EVIDENCE_DIR。任一断言失败退出码 1。
// 用法：栈已在跑（launch.mjs）；node drive-artifact-gate.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const ROOT = process.env.VERIFY_REPO_ROOT
  ? resolve(process.env.VERIFY_REPO_ROOT)
  : SCRIPT_ROOT;
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(ROOT, '.claude', 'verify-run');
const ports = JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'));
const SERVER = `http://127.0.0.1:${ports.serverPort}`;
const WEB = `http://127.0.0.1:${ports.webPort}`;
const EVIDENCE = process.env.VERIFY_EVIDENCE_DIR ?? join(ROOT, '.claude', 'verify-evidence', `${Date.now()}-artifact-gate`);
mkdirSync(EVIDENCE, { recursive: true });

const checks = [];
let failed = 0;
function ok(label, cond, detail) {
  checks.push({ ok: Boolean(cond), label, ...(detail !== undefined ? { detail } : {}) });
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
}

async function jget(path, token) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${SERVER}${path}`, { headers });
  return { status: res.status, body: await res.json() };
}
async function jpost(path, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${SERVER}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = await res.text();
  }
  return { status: res.status, body: parsed };
}

// —— seed 面（与 setup-review-seed 同款）——
const teams = await jget('/api/teams');
const teamId = teams.body[0].id;
await jpost(`/api/teams/${teamId}/providers`, {
  providerId: 'stub-gw',
  label: 'Stub Gateway',
  baseUrl: 'http://127.0.0.1:9/v1',
  api: 'openai-completions',
  authHeader: true,
  compat: { supportsDeveloperRole: false },
  models: [{ id: 'stub-model', name: 'stub-model' }],
});
const agent = await jpost(`/api/teams/${teamId}/agents`, {
  displayName: 'gate-builder',
  provider: 'stub-gw',
  modelId: 'stub-model',
});
const AGENT_ID = agent.body.id;
const project = await jpost('/api/projects', { name: '闸验收' });
const projectId = project.body.id;
const apiKey = await jpost(`/api/teams/${teamId}/api-keys`, {
  name: 'gate-mbp',
  gitAccess: false,
  mcpAccess: false,
  toolGrants: { read: [], write: [] },
});
const enroll = await jpost('/api/machine/enroll', { teamId, name: 'gate-mbp', cliVersion: '0.1.0' }, apiKey.body.plaintext);
const TOKEN = enroll.body.token;

async function newTodo(title, spec) {
  const res = await jpost(`/api/projects/${projectId}/todos`, { title, spec });
  return res.body.id;
}
async function startBuild(todoId, withPlan) {
  const res = await jpost(`/api/projects/${projectId}/builds`, {
    todoIds: [todoId],
    assignment: { plan: { agentId: AGENT_ID }, build: { agentId: AGENT_ID } },
    withPlan,
  });
  return res.body.builds[0].id;
}
async function claimStep() {
  const res = await jpost('/api/machine/tasks/claim', {}, TOKEN);
  return res.body.step ?? res.body; // ClaimedStep 载荷（step + instruction + session…）
}
async function doneStep(stepId, body) {
  const res = await jpost(`/api/machine/done/${stepId}`, body, TOKEN);
  return res.status;
}
async function uploadPlan(stepId, content) {
  const urls = await jpost(`/api/machine/upload-urls/${stepId}`, { files: [{ name: 'plan.md' }] }, TOKEN);
  const up = urls.body.uploads[0];
  const target = up.url.startsWith('http') ? up.url : `${SERVER}${up.url}`;
  const put = await fetch(target, {
    method: 'PUT',
    headers: {
      'content-type': 'text/markdown',
      authorization: `Bearer ${TOKEN}`,
      ...(up.headers ?? {}),
    },
    body: content,
  });
  return put.status;
}
const todoOf = async (id) => (await jget(`/api/todos/${id}`)).body;
const buildOf = async (id) => (await jget(`/api/builds/${id}`)).body;
const stepsOf = async (id) => (await jget(`/api/builds/${id}/steps`)).body;

// —— 形态 1：弱模型两轮不写方案（B-C10）——
{
  const todoId = await newTodo('形态一：不写方案', '# 任务\n写一行探针。');
  const buildId = await startBuild(todoId, true);
  const first = await claimStep();
  ok('M1 首步 = plan', first.step.kind === 'plan', { kind: first.step.kind });
  await doneStep(first.step.id, { status: 'success', sessionId: 'pi-m1' });
  ok('M1 首轮 done(success) 无 plan.md → 留 planning', (await todoOf(todoId)).phase === 'planning', { phase: (await todoOf(todoId)).phase });
  const rewrite = await claimStep();
  ok('M1 补写步入队（claim 得第二个 plan 步）', rewrite?.step?.kind === 'plan', { kind: rewrite?.step?.kind });
  ok('M1 补写轮续会话 + instruction 携补写指令（server→daemon 续轮指令通道）', rewrite?.session?.action === 'continue' && typeof rewrite?.instruction === 'string' && rewrite.instruction.includes('plan.md'), { session: rewrite?.session, instructionHead: String(rewrite?.instruction ?? '').slice(0, 24) });
  // 补写轮仍不写 plan.md → 闸失败收尾。
  await doneStep(rewrite.step.id, { status: 'success', sessionId: 'pi-m1' });
  const todo = await todoOf(todoId);
  const build = await buildOf(buildId);
  ok('M1 补写轮仍无方案 → todo failed（confirm 不可达）', todo.phase === 'failed', { phase: todo.phase });
  ok('M1 失败原因 = 规划未产出方案', build.errorMessage === '规划未产出方案', { errorMessage: build.errorMessage });
  const steps = await stepsOf(buildId);
  ok('M1 步数 = 2（有界，无第三补写）', Array.isArray(steps) && steps.length === 2, { count: steps.length });
  ok('M1 末步状态 = failed', steps[1]?.status === 'failed', { status: steps[1]?.status });
}

// —— 形态 2：零改动 build（B-C11）——
{
  const todoId = await newTodo('形态二：零改动构建', '# 任务\n改一行探针。');
  const buildId = await startBuild(todoId, false);
  const buildStep = await claimStep();
  ok('M2 直执行首步 = build', buildStep.step.kind === 'build', { kind: buildStep.step.kind });
  await doneStep(buildStep.step.id, { status: 'success', hasChanges: false, sessionId: 'pi-m2' });
  const todo = await todoOf(todoId);
  const build = await buildOf(buildId);
  ok('M2 零改动 → todo failed（review 不可达）', todo.phase === 'failed', { phase: todo.phase });
  ok('M2 失败原因 = 构建零改动', build.errorMessage === '构建零改动', { errorMessage: build.errorMessage });
  const steps = await stepsOf(buildId);
  ok('M2 步状态 = failed', steps[0]?.status === 'failed', { status: steps[0]?.status });
}

// —— 形态 3：假完成（B-C14：done success + sessionId + 零产出零用量）——
{
  const todoId = await newTodo('形态三：假完成', '# 任务\n再改一行探针。');
  const buildId = await startBuild(todoId, false);
  const buildStep = await claimStep();
  // run16 形状：流中断 + auto_retry 后 daemon 报 success，零 usage、零产物。
  await doneStep(buildStep.step.id, { status: 'success', hasChanges: false, sessionId: 'pi-m3' });
  const todo = await todoOf(todoId);
  const build = await buildOf(buildId);
  ok('M3 假完成不当 done → todo failed', todo.phase === 'failed', { phase: todo.phase });
  ok('M3 失败原因 = 构建零改动', build.errorMessage === '构建零改动', { errorMessage: build.errorMessage });
}

// —— 负例：有物过闸（有方案 → confirm；有改动 → review）——
{
  const todoId = await newTodo('负例：正常产出', '# 任务\n按方案改探针。');
  const buildId = await startBuild(todoId, true);
  const planStep = await claimStep();
  const put = await uploadPlan(planStep.step.id, '# 方案\n\n## Context\n探针任务。\n\n## Changes\n- README.md 增加一行。\n\n## Edge cases\n无。\n\n## Verification\n查 diff。');
  ok('N plan.md 上传 200', put === 200, { put });
  await doneStep(planStep.step.id, { status: 'success', sessionId: 'pi-n1' });
  let todo = await todoOf(todoId);
  ok('N 有方案 → confirm（闸 1 过）', todo.phase === 'confirm', { phase: todo.phase });
  ok('N hasPlan 置位', todo.hasPlan === true, { hasPlan: todo.hasPlan });
  const confirmRes = await jpost(`/api/builds/${buildId}/steps`, { action: 'confirm' });
  ok('N confirm 202', confirmRes.status === 202, { status: confirmRes.status });
  const buildStep = await claimStep();
  ok('N 确认后 build 步入队', buildStep?.step?.kind === 'build', { kind: buildStep?.step?.kind });
  await doneStep(buildStep.step.id, { status: 'success', hasChanges: true, sessionId: 'pi-n2' });
  todo = await todoOf(todoId);
  ok('N 有改动 → review（闸 2 过）', todo.phase === 'review', { phase: todo.phase });
  ok('N hasChanges 置位', todo.hasChanges === true, { hasChanges: todo.hasChanges });
}

// —— SQLite 真值（todo/build/plan 行）——
{
  const require = createRequire(join(ROOT, 'apps', 'server', 'package.json'));
  const Database = require('better-sqlite3');
  const db = new Database(join(RUN_DIR, 'home', 'server', 'server.db'), { readonly: true });
  const rows = {
    todos: db.prepare("select title, phase, hasPlan, hasChanges from todo where title like '形态%' or title like '负例%'").all(),
    builds: db.prepare('select id, todoId, errorMessage from build where errorMessage is not null').all(),
    plans: db.prepare('select buildId, version, length(content) as contentLen from plan').all(),
  };
  db.close();
  writeFileSync(join(EVIDENCE, 'sqlite-truth.json'), JSON.stringify(rows, null, 2));
  ok('DB 失败 build 行 = 3（三形态）', rows.builds.length === 3, { count: rows.builds.length });
  ok('DB plan 行 = 1（仅负例上传）', rows.plans.length === 1, { count: rows.plans.length });
}

// —— 截图（board 失败列 + 负例 confirm/review 卡 + 详情失败行）——
{
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${WEB}/app`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(EVIDENCE, 'board-failed-column.png') });
  // 详情页失败行：形态一 todo。通过 todo 卡片点击进入。
  const card = page.locator('.board-card, [data-slot="card"], article').filter({ hasText: '形态一' }).first();
  if (await card.count() > 0) {
    await card.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(EVIDENCE, 'detail-plan-gate-failed.png') });
    const bodyText = await page.locator('body').innerText();
    ok('UI 失败行可见「规划未产出方案」', bodyText.includes('规划未产出方案'), null);
    ok('UI 不出现「确认方案」入口（confirm 不可达）', !bodyText.includes('确认方案'), null);
  } else {
    ok('UI 详情可达（形态一卡片）', false, { hint: 'card not found on board' });
  }
  await browser.close();
}

writeFileSync(join(EVIDENCE, 'result.json'), JSON.stringify({ probe: 'artifact-gate', checks, failed, stack: { server: SERVER, web: WEB } }, null, 2));
console.log(`\n${checks.length - failed}/${checks.length} PASS · evidence: ${EVIDENCE}`);
process.exit(failed > 0 ? 1 : 0);
