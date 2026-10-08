#!/usr/bin/env node
// verify-pacman 定制 probe — #1032 容器层滚动收口（live 真栈 + 真用户路径）。
//
// 票面：总管设置-记忆无法下滑（容器缺 overflow-y-auto），同类 6 处页面一并
// 收口。修复落两处容器层：chief-settings.tsx 内容列包一层
// `flex-1 overflow-x-hidden overflow-y-auto`；pages/shell.tsx 的 {children}
// 包一层 `flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto`。
//
// 本 probe 在隔离 live 栈（launch.mjs，8791/5273，scratch PACMAN_HOME）上：
//  A 铺真数据（REST 建项目/40 任务/30 定时/Agent/绑定+60 行章程；SQLite 直写
//    40 条 agent_memory + 30 条 chief.watches——两者无 REST 写面，seed 只进
//    scratch 库，UI 读的仍是真 GET 缝）；
//  B 真浏览器逐面走滚动（1440×732 主口径；项目设置/新建项目两个静态表单页
//    另加 1440×500 短窗口场景逼出溢出——真笔记本用户形态），每面钉四条：
//    F1 找到「可滚且内容确实超高」的滚动层（修复前恒找不到）
//    F2 鼠标滚轮真驱动它（用户报障的原始交互）
//    F3 能滚到底：末条元素完整落进视口
//    F4 页面级零溢出：documentElement 横纵 scrollWidth/Height ≤ client*
//       （问题没从「滚不动」搬成「整页滚」）
//  C 已安全四处（secondary/resources/todo 详情/machine-authorize）零回归：
//    页面可达 + 页面级零溢出 + 截图留档。
//
// 用法（栈必须先在跑）：
//   node .claude/skills/verify-pacman/scripts/launch.mjs
//   node docs/verify/1032/drive-1032-scroll.mjs
// 证据落本目录（截图 + result.json）。

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO = process.env.VERIFY_REPO_ROOT ?? resolve(SCRIPT_DIR, '../../..');
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(REPO, '.claude/verify-run');
const ports = existsSync(join(RUN_DIR, 'ports.json'))
  ? JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'))
  : {};
const SERVER = `http://127.0.0.1:${ports.serverPort ?? process.env.VERIFY_PORT ?? 8791}`;
const WEB = `http://127.0.0.1:${ports.webPort ?? process.env.VERIFY_WEB_PORT ?? 5273}`;
const DB_PATH = join(RUN_DIR, 'home/server/server.db');
const EVIDENCE = process.env.VERIFY_EVIDENCE_DIR ?? SCRIPT_DIR;
mkdirSync(EVIDENCE, { recursive: true });

const require2 = createRequire(join(REPO, 'apps/server/package.json'));

const MEMORY_COUNT = 40;
const WATCH_COUNT = 30;
const TASK_COUNT = 40;
const SCHEDULE_COUNT = 30;
const LONG_LINE = '这是一段足够长的内容，用来把这一面撑出真实的纵向滚动。';

const checks = [];
function check(name, ok, detail) {
  // 断言位必须真是 boolean（drive-tags 同款护栏）——写反会恒真。
  if (typeof ok !== 'boolean') {
    throw new TypeError(`check(${JSON.stringify(name)}) 的 ok 位须为 boolean，收到 ${typeof ok}`);
  }
  checks.push({ name, ok, detail: detail ?? null });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}\n`);
}
const artifacts = [];
const shot = async (page, name) => {
  await page.screenshot({ path: join(EVIDENCE, name) });
  artifacts.push(name);
  process.stdout.write(`shot  ${name}\n`);
};

const req = async (method, path, body) => {
  const res = await fetch(`${SERVER}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

// —— A. 铺数据（REST 真缝 + SQLite seed）————————————————————————————

const teams = await req('GET', '/api/teams');
const teamId = teams[0].id;
const project = await req('POST', '/api/projects', { name: '滚动验证项目' });

const tasks = [];
for (let i = 0; i < TASK_COUNT; i++) {
  tasks.push(
    await req('POST', `/api/projects/${project.id}/todos`, {
      title: `滚动验证任务 ${i}`,
      spec: `第 ${i} 条：${LONG_LINE}`,
    }),
  );
}
for (let i = 0; i < SCHEDULE_COUNT; i++) {
  await req('POST', '/api/schedules', {
    todoId: tasks[i].id,
    projectId: project.id,
    kind: 'daily',
    at: Date.parse('2026-10-08T09:00:00Z'),
  });
}
const agent = await req('POST', `/api/teams/${teamId}/agents`, {
  displayName: '滚动验证代理',
});
const charter = Array.from({ length: 60 }, (_, i) => `章程第 ${i} 行：${LONG_LINE}`).join('\n');
await req('PATCH', `/api/teams/${teamId}/chief`, {
  agent: { agentId: agent.id, thinkingLevel: null },
  charter,
});

// SQLite 直写（记忆/关注无 REST 写面；只进 scratch 库）
const Database = require2('better-sqlite3');
const db = new Database(DB_PATH);
db.pragma('busy_timeout = 5000');
const insertMemory = db.prepare(
  `INSERT INTO agent_memory (id, agentId, teamId, title, content, projectId, sourceTodoId, sourceBuildId, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
);
const insertMany = db.transaction((rows) => {
  for (const r of rows) insertMemory.run(r.id, r.agentId, r.teamId, r.title, r.content, 0, 0);
});
insertMany(
  Array.from({ length: MEMORY_COUNT }, (_, i) => ({
    id: `mem-1032-${i}`,
    agentId: agent.id,
    teamId,
    title: `记忆条目 ${i}`,
    content: `第 ${i} 条沉淀：${LONG_LINE}`,
  })),
);
const watches = Array.from({ length: WATCH_COUNT }, (_, i) => ({
  todoId: tasks[i].id,
  projectId: project.id,
  seqNum: tasks[i].seqNum,
  title: `关注条目 ${i}`,
  projectName: project.name,
  phase: 'building',
  reason: 'Dispatched by the chief: report back when it parks at a gate or settles.',
  createdAt: Date.now(),
  threadId: `chief-1032-${i}`,
  threadTitle: '滚动验证线程',
}));
db.prepare('UPDATE chief SET watches = ? WHERE teamId = ?').run(JSON.stringify(watches), teamId);

// seed 真值回读（三件套的 API/DB 腿）
const memoriesBack = await req('GET', `/api/teams/${teamId}/agents/${agent.id}/memories`);
const chiefBack = await req('GET', `/api/teams/${teamId}/chief`);
const todosBack = await req('GET', `/api/todos?teamId=${teamId}`);
const schedulesBack = await req('GET', '/api/schedules');
const memoryRows = db
  .prepare('SELECT id, title FROM agent_memory WHERE agentId = ? ORDER BY id')
  .all(agent.id);
db.close();
check('seed 记忆 API 行数 = 40', memoriesBack.length === MEMORY_COUNT, `got ${memoriesBack.length}`);
check('seed 记忆 SQLite 行数 = 40', memoryRows.length === MEMORY_COUNT, `got ${memoryRows.length}`);
check(
  'seed 关注封套行数 = 30',
  Array.isArray(chiefBack.watches) && chiefBack.watches.length === WATCH_COUNT,
  `got ${chiefBack.watches?.length}`,
);
check('seed 章程非空', (chiefBack.chief.charter ?? '').includes('章程第 59 行'));
check(
  'seed 任务 API 行数 = 40',
  todosBack.filter((t) => t.projectId === project.id).length === TASK_COUNT,
  `got ${todosBack.filter((t) => t.projectId === project.id).length}`,
);
check('seed 定时 API 行数 = 30', schedulesBack.length === SCHEDULE_COUNT, `got ${schedulesBack.length}`);
writeFileSync(
  join(EVIDENCE, 'seed-truth.json'),
  `${JSON.stringify({ teamId, projectId: project.id, agentId: agent.id, counts: { memories: memoriesBack.length, watches: chiefBack.watches.length, todos: todosBack.length, schedules: schedulesBack.length }, memoryRowsSample: memoryRows.slice(0, 3), charterTail: (chiefBack.chief.charter ?? '').split('\n').at(-1) }, null, 2)}\n`,
);
artifacts.push('seed-truth.json');

// —— B. 浏览器逐面滚动验证 ————————————————————————————————————————

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 732 } });
const page = await context.newPage();

/** 复刻 e2e 同款 finder：从 probe 元素向上找第一个「overflow-y auto/scroll
 *  且 scrollHeight > clientHeight」的祖先，打标后回读几何。走 Playwright
 *  locator.evaluate（probe 选择器可能是 :text-is 这类仅 PW 支持的形态）。 */
async function measureSurface(probeLocator, tag) {
  return probeLocator.evaluate((el, mark) => {
    let node = el.parentElement;
    while (node != null && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      if (
        (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
        node.scrollHeight > node.clientHeight
      ) {
        node.setAttribute(mark, '');
        return {
          found: true,
          scrollHeight: node.scrollHeight,
          clientHeight: node.clientHeight,
          cls: (node.className ?? '').toString().slice(0, 80),
        };
      }
      node = node.parentElement;
    }
    return { found: false, reason: 'no scrollable ancestor' };
  }, tag);
}

const MARK = 'data-probe-1032';

async function verifyScrollable(page2, label, probeSel, lastSel, shotPrefix) {
  await shot(page2, `${shotPrefix}-top.png`);
  const probe = page2.locator(probeSel).first();
  const m = await measureSurface(probe, MARK);
  check(
    `${label} F1 找到超高滚动层`,
    m.found === true,
    m.found ? `${m.cls} ${m.scrollHeight}>${m.clientHeight}` : m.reason,
  );
  if (!m.found) return;
  // F2 滚轮驱动
  const box = await probe.boundingBox();
  await page2.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page2.mouse.wheel(0, 240);
  await page2.waitForTimeout(200);
  const wheeled = await page2.locator(`[${MARK}]`).evaluate((el) => el.scrollTop);
  check(`${label} F2 滚轮驱动滚动层`, wheeled > 0, `scrollTop=${wheeled}`);
  // F3 置底 + 末条完整入视口
  await page2.locator(`[${MARK}]`).evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page2.waitForTimeout(150);
  const bottomed = await page2
    .locator(`[${MARK}]`)
    .evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  const lastBox = await page2.locator(lastSel).last().boundingBox();
  const vp = page2.viewportSize();
  const lastInView =
    lastBox != null && lastBox.y >= 0 && lastBox.y + lastBox.height <= vp.height + 1;
  check(
    `${label} F3 滚到底且末条入视口`,
    bottomed === true && lastInView === true,
    `bottomed=${bottomed} lastBox=${lastBox ? `${Math.round(lastBox.y)}..${Math.round(lastBox.y + lastBox.height)}` : 'null'} vp=${vp.height}`,
  );
  await shot(page2, `${shotPrefix}-bottom.png`);
  // F4 页面级零溢出
  const overflow = await page2.evaluate(() => ({
    h: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    v: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  check(
    `${label} F4 页面级零溢出`,
    overflow.h <= 0 && overflow.v <= 0,
    `h=${overflow.h} v=${overflow.v}`,
  );
  // 复位，下一面复用同一 page
  await page2.locator(`[${MARK}]`).evaluate((el) => {
    el.scrollTop = 0;
    el.removeAttribute('data-probe-1032');
  });
}

// 总管设置（记忆/关注与提醒/章程三 tab）：FAB → 抽屉 → 齿轮内容交换
await page.goto(`${WEB}/app`, { waitUntil: 'domcontentloaded' });
await page.locator('button[aria-label="总管"]').click();
await page.getByRole('dialog', { name: '总管' }).waitFor({ state: 'visible', timeout: 15000 });
await page
  .getByRole('dialog', { name: '总管' })
  .locator('button[aria-label="总管设置"]')
  .click();
await page.getByRole('heading', { name: '总管设置' }).waitFor({ timeout: 15000 });
// 抽屉退场腿（absolute 离流滑出）会瞬时顶宽 documentElement——等它卸载再量
await page.waitForFunction(() => document.querySelector('.chief-drawer') == null, null, {
  timeout: 5000,
});

await page.getByRole('tab', { name: '记忆' }).click();
await page.getByText(`记忆 · ${MEMORY_COUNT} / 100`).waitFor({ timeout: 10000 });
await verifyScrollable(page, '总管设置-记忆', 'p.mt-\\[17px\\]', 'span:text-is("记忆条目 39")', '01-chief-memory');

await page.getByRole('tab', { name: '关注与提醒' }).click();
await page.getByText('关注条目 0', { exact: true }).waitFor({ timeout: 10000 });
await verifyScrollable(
  page,
  '总管设置-关注与提醒',
  'span:text-is("关注条目 0")',
  'span:text-is("关注条目 29")',
  '02-chief-watches',
);

await page.getByRole('tab', { name: '章程' }).click();
await page.waitForTimeout(300);
await verifyScrollable(
  page,
  '总管设置-章程',
  'text=章程第 0 行',
  'button:text-is("编辑")',
  '03-chief-charter',
);

// PageShell 四页（一处包装，四页受益）
await page.goto(`${WEB}/app/project/${project.id}?tab=tasks`, { waitUntil: 'domcontentloaded' });
await page.getByTestId('task-row').first().waitFor({ timeout: 15000 });
await verifyScrollable(
  page,
  '项目任务列表',
  'input[aria-label="搜索任务"]',
  '[data-testid="task-row"]',
  '04-project-tasks',
);

await page.goto(`${WEB}/app/schedules`, { waitUntil: 'domcontentloaded' });
await page.locator('.sched-card').first().waitFor({ timeout: 15000 });
await verifyScrollable(page, '排期', '.sched-card', '.sched-card', '05-schedules');

// 静态表单两页：真实内容不足一屏（732）时用 1440×500 短窗口逼出溢出——
// 笔记本用户的真实形态；e2e 侧同款断言用 360px。
await page.setViewportSize({ width: 1440, height: 500 });
await page.goto(`${WEB}/app/project/${project.id}/settings`, { waitUntil: 'domcontentloaded' });
await page.locator('.prj-set-avatar').waitFor({ timeout: 15000 });
await verifyScrollable(
  page,
  '项目设置',
  '.prj-set-avatar',
  'button:text-is("删除")',
  '06-project-settings',
);

// 新建项目表单在 1440×500 下恰好放得下（F1 正确地报「无可滚祖先」= 无溢出
// 即无滚动需求）——换 360px 短窗逼出真实溢出（e2e 侧同口径）。
await page.setViewportSize({ width: 1440, height: 360 });
await page.goto(`${WEB}/app/project/new`, { waitUntil: 'domcontentloaded' });
await page.getByText('可选。未设置时以首字母代替。').waitFor({ timeout: 15000 });
await verifyScrollable(
  page,
  '新建项目',
  'text=可选。未设置时以首字母代替。',
  'button:text-is("创建项目")',
  '07-project-new',
);

// —— C. 已安全四处零回归 ————————————————————————————————————————————

async function verifySafeArea(page2, label, url, markerSel, shotName) {
  await page2.goto(url, { waitUntil: 'domcontentloaded' });
  await page2.locator(markerSel).first().waitFor({ timeout: 15000 });
  const overflow = await page2.evaluate(() => ({
    h: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    v: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  check(
    `${label} 零回归（可达 + 页面级零溢出）`,
    overflow.h <= 0 && overflow.v <= 0,
    `h=${overflow.h} v=${overflow.v}`,
  );
  await shot(page2, shotName);
}

await page.setViewportSize({ width: 1440, height: 732 });
await verifySafeArea(page, 'secondary 团队页', `${WEB}/app/team`, '[data-testid="team-agent-grid"]', '08-safe-secondary.png');
await verifySafeArea(page, 'resources Agent 详情页', `${WEB}/app/resources/agents/${agent.id}`, '[data-testid="resource-col"]', '09-safe-resources.png');
await verifySafeArea(page, 'todo 详情页', `${WEB}/app/todo/${tasks[0].id}`, '.detail-fresh, [data-testid="transcript-col"]', '10-safe-todo-detail.png');
await verifySafeArea(page, 'machine-authorize 页', `${WEB}/app/machines/authorize`, '.authorize-card', '11-safe-machine-authorize.png');

await browser.close();

// —— result.json ————————————————————————————————————————————————

const passed = checks.filter((c) => c.ok).length;
writeFileSync(
  join(EVIDENCE, 'result.json'),
  `${JSON.stringify(
    {
      probe: 'drive-1032-scroll',
      ticket: 1032,
      stack: { server: SERVER, web: WEB, db: DB_PATH },
      viewport: '1440x732（静态表单两页 1440x500）',
      summary: `${passed}/${checks.length} PASS`,
      checks,
      artifacts,
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(`\n${passed}/${checks.length} PASS  evidence → ${EVIDENCE}\n`);
process.exit(passed === checks.length ? 0 : 1);
