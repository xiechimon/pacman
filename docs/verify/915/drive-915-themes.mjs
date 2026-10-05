#!/usr/bin/env node
// verify-pacman 定制 probe（#915 色板翻值明暗双模封版）：
// live 栈（launch.mjs 起，ports.json 取坐标）上走真用户路径——建任务、开
// 新建 dialog、进详情页——每面在 dark / light 两主题各截一图；并在运行时
// 断言关键 token 的 computed 值 = c.css 定版值（字面槽走
// getPropertyValue，color-mix 槽走探针元素实解析，几何走 rounded-lg 探针
// 元素实测 14px）。任一断言失败退出码 1；证据（截图 + result.json +
// API JSON）落 VERIFY_EVIDENCE_DIR。
//
// 用法（栈必须已在跑）：
//   VERIFY_REPO_ROOT=<worktree> node <worktree>/docs/verify/915/drive-915-themes.mjs
// 口径与 apps/web/playwright.config.ts 一致：1440×732。

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = process.env.VERIFY_REPO_ROOT
  ? resolve(process.env.VERIFY_REPO_ROOT)
  : resolve(SCRIPT_DIR, '../../..');
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(ROOT, '.claude', 'verify-run');

const stack = JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'));
const API = `http://127.0.0.1:${stack.serverPort}`;
const WEB = `http://127.0.0.1:${stack.webPort}`;

const EVIDENCE =
  process.env.VERIFY_EVIDENCE_DIR ?? join(SCRIPT_DIR, 'live-run');
mkdirSync(EVIDENCE, { recursive: true });

const checks = [];
const artifacts = [];
let failures = 0;
const check = (ok, label) => {
  checks.push({ ok, label });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures += 1;
};
const shot = async (page, name) => {
  await page.screenshot({ path: join(EVIDENCE, name) });
  artifacts.push(name);
  console.log(`shot  ${name}`);
};

// ---- 定版期望值（值正本 library/t-0909/src/themes/c.css @ 7340d0ab，
//      经 docs/spec/22 §1.7/§1.8/§2 实测表核对）----
const LITERAL_TOKENS = {
  dark: {
    '--background': '#1e1b16',
    '--foreground': '#ede9e1',
    '--card': '#25221d',
    '--card-button': '#d89cfc',
    '--focus-ring': '#d89cfc',
    '--destructive': '#ffaab9',
    '--destructive-foreground': '#47242b',
    '--text-on-accent': '#1e1b16',
    '--spot-text-on-tint': '#e0afff',
    '--input': '#3f3c36',
    '--border-default': '#2d2a24',
    '--project-avatar-bg': '#ff9b78',
    '--project-avatar-fg': '#47261a',
    '--radius': '0.875rem',
    '--edge-radius': '14px',
    '--radius-popover': '12px',
    '--pad-card': '16px',
    '--pad-page': '28px',
    '--row-h': '40px',
    '--label-size': '12px',
    '--title-weight': '590',
    '--plate-shadow': 'none',
  },
  light: {
    '--background': '#f4efe7',
    '--foreground': '#120f09',
    '--card': '#efe9e1',
    '--card-button': '#7f2da7',
    '--focus-ring': '#7f2da7',
    '--destructive': '#9d2c4c',
    '--destructive-foreground': '#ffffff',
    '--text-on-accent': '#ffffff',
    '--spot-text-on-tint': '#562071',
    '--input': '#c9c4bc',
    '--border-default': '#e8e3da',
    // .light 新增 override（#915 前亮侧无此两名、继承暗值）
    '--project-avatar-bg': '#cd5f37',
    '--project-avatar-fg': '#310a00',
    // 亮侧 tertiary 与 secondary 分档（不再别名压缩）
    '--surface-tertiary': '#e0dbd2',
    '--surface-secondary': '#e8e3da',
    '--plate-shadow': '0 6px 16px rgb(0 0 0 / 0.12)',
    '--card-shadow': '0 2px 8px rgb(28 25 23 / 0.08)',
  },
};
// color-mix 槽走探针元素实解析（spec/22 §1.7/§1.8：暗 #3e333c / 亮 #dfcfd9）
const SPOT_SOFT = { dark: [62, 51, 60], light: [223, 207, 217] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });

const readToken = (name) =>
  page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  );

const assertTokens = async (theme) => {
  for (const [name, expected] of Object.entries(LITERAL_TOKENS[theme])) {
    const actual = await readToken(name);
    check(actual === expected, `${theme} ${name} = ${expected}（实测 ${actual}）`);
  }
  // color-mix 实解析（±1/通道容差，浏览器合成取整）
  const spotSoft = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--spot-soft)';
    document.body.append(probe);
    const rgb = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return rgb;
  });
  const [wantR, wantG, wantB] = SPOT_SOFT[theme];
  // color-mix 定义的槽 computed 序列化可能是 color(srgb f1 f2 f3) 分数而非
  // rgb() 0–255 整数（#921 实测坑）——分数按 ×255 折算回整数通道再比。
  const srgb = spotSoft.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  const got = srgb
    ? [srgb[1], srgb[2], srgb[3]].map((v) => Number(v) * 255)
    : (spotSoft.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
  const near = got.length === 3 && got.every((v, i) => Math.abs(v - [wantR, wantG, wantB][i]) <= 1);
  check(near, `${theme} --spot-soft 解析 ≈ rgb(${wantR}, ${wantG}, ${wantB})（实测 ${spotSoft}）`);
  // 几何乘数族运行时实测：rounded-lg = --radius = 14px
  const lg = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'rounded-lg';
    document.body.append(probe);
    const r = getComputedStyle(probe).borderTopLeftRadius;
    probe.remove();
    return r;
  });
  check(lg === '14px', `${theme} rounded-lg 实测 = 14px（实测 ${lg}）`);
};

const setTheme = async (theme) => {
  await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
};

try {
  // ---- 铺底：真用户路径建一条任务（全新库无项目 → 自动建默认项目）----
  const title = `纸兰封版任务 ${Date.now() % 100000}`;
  await page.goto(`${WEB}/app`);
  await page.waitForSelector('[data-route="board"]', { timeout: 15_000 });
  await page.click('.sidebar-new-task');
  await page.waitForSelector('.new-task-dialog', { timeout: 5000 });
  await page.fill('.new-task-spec', title);
  await page.click('.new-task-save');
  await page.waitForSelector('.new-task-dialog', { state: 'hidden', timeout: 5000 });
  const card = page.locator('.todo-card', { hasText: title });
  await card
    .first()
    .waitFor({ state: 'visible', timeout: 8000 })
    .catch(() => {});
  check(await card.first().isVisible(), `任务上板（${title}）`);
  const detailHref = await page
    .locator('.todo-card-link', { hasText: title })
    .first()
    .getAttribute('href');
  check(typeof detailHref === 'string' && detailHref.startsWith('/app/todo/'), `详情链接 ${detailHref}`);

  // API 真值
  const todosRes = await fetch(`${API}/api/todos`, { signal: AbortSignal.timeout(8000) });
  const todos = await todosRes.json();
  writeFileSync(join(EVIDENCE, 'api-todos.json'), JSON.stringify(todos, null, 2));
  const row = todos.find((t) => (t.title ?? t.spec ?? '').includes(title.slice(0, 6)));
  check(row != null, 'GET /api/todos 命中新任务行');

  for (const theme of ['dark', 'light']) {
    await setTheme(theme);
    // 1) board
    await page.goto(`${WEB}/app`);
    await page.waitForSelector('[data-route="board"]', { timeout: 15_000 });
    await page.locator('.todo-card').first().waitFor({ timeout: 5000 });
    const rootClass = await page.evaluate(() => document.documentElement.className);
    check(
      theme === 'light' ? rootClass.includes('light') : !rootClass.includes('light'),
      `${theme} 主题挂载正确（html class="${rootClass}"）`,
    );
    await assertTokens(theme);
    await shot(page, `01-board-${theme}.png`);
    // 2) new-task dialog（dialog-shadow / scrim 面）
    await page.click('.sidebar-new-task');
    await page.waitForSelector('.new-task-dialog', { timeout: 5000 });
    await shot(page, `02-dialog-${theme}.png`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.new-task-dialog', { state: 'hidden', timeout: 5000 });
    // 3) detail（chip 族 / surface 层次面）
    await page.goto(`${WEB}${detailHref}`);
    await page.waitForSelector('[data-route="todo-detail"], .detail-head', { timeout: 15_000 });
    await shot(page, `03-detail-${theme}.png`);
  }

  const result = {
    probe: 'drive-915-themes',
    ticket: 915,
    stack: { api: API, web: WEB },
    checks,
    artifacts,
    failures,
  };
  writeFileSync(join(EVIDENCE, 'result.json'), JSON.stringify(result, null, 2));
  console.log(`\n${checks.length - failures}/${checks.length} checks PASS；证据 → ${EVIDENCE}`);
} finally {
  await browser.close();
}
process.exit(failures === 0 ? 0 : 1);
