#!/usr/bin/env node
// #638 mutation 失败反馈 live probe（票面验收第 4 条：createTodo / startBuilds /
// createProvider 三件后端语义面的失败注入 before/after 证据）。
//
// 注入法：浏览器网络层 page.route 对目标 POST 注入 server 单形状错误
// （HTTP 500 + {error}，client.ts settle() 的 ApiError 真输入）——请求不经
// 真 server，但 UI 侧走完整真链路（真 live 栈、真 React Query mutation、真
// onError 接线）。与 apps/web e2e composer-wire-reject.spec（#631/#635 canon）
// 同法。
//
// 两形态（同一脚本，期望反转仿 drive-newtask-key 的 --expect 配方）：
//   --expect=silence --tag=before  origin/main 栈：注入后应无声（缺陷本体），
//                                  server 真值证明数据没落。
//   --expect=toast   --tag=after   #638 分支栈：toast 标题句（i18n zh）+
//                                  server 原因 verbatim 进 description（#631 同律）。
//
// 栈坐标读 VERIFY_RUN_DIR/ports.json（launch.mjs 契约）；证据（截图 +
// result.json）落 VERIFY_EVIDENCE_DIR。口径与 e2e 一致：1440×732、dark。
// 铺底（建项目/建任务/改相）走公开 REST——非被测路径；被测路径全部真用户
// 交互（点侧栏新任务、点详情页「重开」、走服务商 picker 表单）。
// 任一断言失败退出码 1。

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);
const EXPECT = args.expect === 'toast' ? 'toast' : 'silence';
const TAG = typeof args.tag === 'string' && args.tag !== '' ? args.tag : EXPECT;

const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(process.cwd(), '.claude', 'verify-run');
const stack = JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'));
const API = `http://127.0.0.1:${stack.serverPort}`;
const WEB = `http://127.0.0.1:${stack.webPort}`;
const EVIDENCE =
  process.env.VERIFY_EVIDENCE_DIR ??
  join(process.cwd(), '.claude', 'verify-evidence', `638-${TAG}`);
mkdirSync(EVIDENCE, { recursive: true });

const now = new Date();
const checks = [];
const artifacts = [];
const extra = { expect: EXPECT, tag: TAG };
let failures = 0;
const check = (ok, label) => {
  checks.push({ ok, label });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures += 1;
};

const getJson = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`GET ${url} → ${r.status}`);
  return r.json();
};
const sendJson = async (method, url, body) => {
  const r = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json();
};

/** 注入消息 = server 原因透传的载荷（ASCII，e2e 'upstream refused' 同风格）。 */
const INJECT = {
  todos: 'injected(638): POST todos refused',
  builds: 'injected(638): POST builds refused',
  providers: 'injected(638): POST providers refused',
};

const browser = await chromium.launch();

/** 干净页 + 对 pattern 的 POST 注入 500 {error}（非 POST fallback 放行）。 */
const openInjected = async (pattern, message) => {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 732 },
    colorScheme: 'dark',
  });
  let hits = 0;
  await page.route(pattern, (route, request) => {
    if (request.method() !== 'POST') return route.fallback();
    hits += 1;
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: message }),
    });
  });
  return { page, hits: () => hits };
};

const waitHits = async (page, hits, ms = 6000) => {
  const t0 = Date.now();
  while (hits() === 0 && Date.now() - t0 < ms) await page.waitForTimeout(100);
};

/** 失败观测：toast 面等弹出并钉标题句 + 原因透传；silence 面等足 2.5s 钉零 toast。 */
const observe = async (page, name, title, reason) => {
  const file = `${name}-${TAG}.png`;
  if (EXPECT === 'toast') {
    await page.waitForSelector('[data-sonner-toast]', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(400); // 入场动画落定再取字/取像
    const text = (await page.locator('[data-sonner-toast]').first().innerText()).replace(
      /\s*\n\s*/g,
      ' | ',
    );
    check(text.includes(title), `${name}: toast 标题句「${title}」（实测「${text}」）`);
    check(text.includes(reason), `${name}: server 原因 verbatim 进 description（#631 同律）`);
    extra[`${name}ToastText`] = text;
  } else {
    await page.waitForTimeout(2500); // before 面：等足 toast 默认弹出台，无声即缺陷本体
    const n = await page.locator('[data-sonner-toast]').count();
    check(n === 0, `${name}: 注入后 2.5s 零 toast（实测 ${n} 枚）——静默失败 = #638 缺陷本体`);
    extra[`${name}ToastText`] = null;
  }
  await page.screenshot({ path: join(EVIDENCE, file) });
  artifacts.push(file);
  console.log(`shot  ${file}`);
};

const stamp = now.getTime() % 100000;

try {
  // —— 铺底（公开 REST，非被测路径）：项目 + 任务 + done 相位任务 ——————
  const proj = await sendJson('POST', `${API}/api/projects`, {
    name: `注入验证项目 ${stamp}`,
    repoKind: 'hosted',
  });
  const doneSpec = `重开注入验证 ${stamp}`;
  const doneTodo = await sendJson('POST', `${API}/api/projects/${proj.id}/todos`, {
    title: doneSpec,
    spec: doneSpec,
  });
  // 手动面同 wire（#160 看板拖拽 = PATCH phase，routes.ts manualPhase:true，
  // canManualMovePhase 放行 todo→done）。
  await sendJson('PATCH', `${API}/api/todos/${doneTodo.id}`, { phase: 'done' });
  const teams = await getJson(`${API}/api/teams`);
  const teamId = teams[0]?.id;
  check(proj?.id != null && doneTodo?.id != null && teamId != null, '铺底：项目/任务/teamId 就绪');

  // —— A. createTodo：新任务对话框 保存 → POST /projects/:id/todos 500 ————
  {
    const spec = `注入验证任务 ${stamp}`;
    const { page, hits } = await openInjected('**/api/projects/*/todos', INJECT.todos);
    await page.goto(`${WEB}/app`);
    await page.waitForSelector('[data-route="board"]', { timeout: 15_000 });
    await page.click('.sidebar-new-task');
    await page.waitForSelector('.new-task-dialog', { timeout: 5000 });
    await page.fill('.new-task-spec', spec);
    await page.waitForTimeout(600); // board eager 项目查询落定，保存走「已有项目」腿
    await page.click('.new-task-save');
    await page.waitForSelector('.new-task-dialog', { state: 'hidden', timeout: 5000 });
    await waitHits(page, hits);
    check(hits() === 1, `createTodo: 注入命中 POST /api/projects/:id/todos ×${hits()}`);
    await observe(page, 'createTodo', '新建任务失败，请重试。', INJECT.todos);
    // server 真值：任务没建上（失败是真的失败，不是只拦了响应）
    const todos = await getJson(`${API}/api/todos`);
    const saved = Array.isArray(todos) && todos.some((row) => (row.title ?? '').includes(spec));
    check(!saved, 'createTodo: server 真值——GET /api/todos 无该任务行（数据没落）');
    await page.close();
  }

  // —— B. startBuilds：done 任务详情「重开」→ POST /projects/:id/builds 500 ——
  {
    const { page, hits } = await openInjected('**/api/projects/*/builds', INJECT.builds);
    await page.goto(`${WEB}/app/todo/${doneTodo.id}`);
    const btn = page.locator('.fresh-start');
    await btn.waitFor({ state: 'visible', timeout: 15_000 });
    const label = (await btn.innerText()).trim();
    check(label === '重开', `startBuilds: done 面主按钮 =「重开」（实测「${label}」）`);
    await btn.click();
    await waitHits(page, hits);
    check(hits() === 1, `startBuilds: 注入命中 POST /api/projects/:id/builds ×${hits()}`);
    await observe(page, 'startBuilds', '开始运行失败，请重试。', INJECT.builds);
    // server 真值：相位仍 done（没有 build 被排上）
    const todos = await getJson(`${API}/api/todos`);
    const row = Array.isArray(todos) ? todos.find((t) => t.id === doneTodo.id) : undefined;
    check(
      row?.phase === 'done',
      `startBuilds: server 真值——相位仍 done（实测 ${row?.phase ?? '缺失'}），未半启动`,
    );
    await page.close();
  }

  // —— C. createProvider：服务商 picker → deepseek 密钥表单 → POST 500 ————
  {
    const { page, hits } = await openInjected('**/api/teams/*/providers', INJECT.providers);
    await page.goto(`${WEB}/app/resources/providers`);
    const shell = '[data-route="/app/resources/providers"]';
    await page.waitForSelector(shell, { timeout: 15_000 });
    await page.click(`${shell} .res-new`);
    const dlg = '[role="dialog"]';
    await page.waitForSelector(dlg, { timeout: 5000 });
    await page.click(`${dlg} .dlg-picker-row[data-preset-id="deepseek"]`);
    await page.waitForSelector('#dlg-provider-apikey', { timeout: 5000 });
    // ready 闸 = providerId/label/baseUrl 三非空；preset 只预填身份两位，
    // baseUrl 留用户填（create-provider-dialog enterForm）。
    await page.fill('#dlg-provider-baseurl', 'https://api.deepseek.com/v1');
    await page.fill('#dlg-provider-apikey', `sk-inject-${stamp}`);
    await page.click(`${dlg} .dlg-provider-create`);
    await waitHits(page, hits);
    check(hits() === 1, `createProvider: 注入命中 POST /api/teams/:id/providers ×${hits()}`);
    await observe(page, 'createProvider', '添加模型服务失败，请重试。', INJECT.providers);
    // server 真值：providers 封套无行新增
    const env = await getJson(`${API}/api/teams/${teamId}/providers`);
    const rows = env?.providers ?? [];
    check(
      Array.isArray(rows) && rows.length === 0,
      `createProvider: server 真值——providers 封套零行（实测 ${Array.isArray(rows) ? rows.length : '?'}）`,
    );
    await page.close();
  }
} catch (err) {
  check(false, `probe 异常：${String(err?.message ?? err)}`);
} finally {
  await browser.close();
}

const ok = failures === 0;
const result = {
  probe: '638-mutation-toast',
  ok,
  at: now.toISOString(),
  expect: EXPECT,
  tag: TAG,
  stack: { api: API, web: WEB, homeDir: stack.homeDir, root: stack.root },
  checks,
  artifacts,
  ...extra,
};
writeFileSync(join(EVIDENCE, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);

console.log(ok ? `probe 638 (${TAG}):PASS` : `probe 638 (${TAG}):FAIL(${failures} 项)`);
console.log(`evidence:${EVIDENCE}`);
process.exit(ok ? 0 : 1);
