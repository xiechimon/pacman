#!/usr/bin/env node
// shots-942-before — #942 抽查两面的 before 基线截图（origin/main 一次性
// worktree 的 fixture dist，同场景同视口重放）。无断言，纯取证：after 面
// 的断言实物在 drive-942-spots / probe-942-fixture。
// 用法：BEFORE_DIR=/tmp/pacman-before-942 node shots-942-before.mjs [port]

import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BEFORE = process.env.BEFORE_DIR ?? '/tmp/pacman-before-942';
const WEB_DIR = join(BEFORE, 'apps/web');
const PORT = Number(process.argv[2] ?? 8402);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = join(SCRIPT_REPO, 'docs/verify/942/before');
mkdirSync(OUT, { recursive: true });

const waitSettled = async (locator) => {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const tf = await locator.evaluate((el) => getComputedStyle(el).transform);
    if (tf === 'none' || tf === 'matrix(1, 0, 0, 1, 0, 0)') return;
    await new Promise((r) => setTimeout(r, 100));
  }
};

const preview = spawn(
  process.execPath,
  [join(WEB_DIR, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort', '--mode', 'fixture'],
  { cwd: WEB_DIR, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_PROXY: '*' } },
);
const waitReady = async () => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/app`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('before preview 未就绪');
};

const browser = await chromium.launch();
try {
  await waitReady();
  for (const scheme of ['dark', 'light']) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 732 },
      colorScheme: scheme,
    });
    await page.addInitScript((s) => localStorage.setItem('pacman-theme', s), scheme);

    // 面 1：添加密钥弹层（旧 36px input 族 / 裸 button / dlg-form-* 类）
    await page.goto(`${BASE}/app/resources/secrets?scenario=01`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.res-new', { timeout: 15_000 });
    await page.click('.res-new');
    const dialog = page.locator('.dlg');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    await waitSettled(dialog);
    await page.screenshot({ path: join(OUT, `01-secret-dialog-${scheme}.png`) });
    const h = await dialog.locator('#dlg-secret-name').evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      cls: el.className,
    }));
    process.stdout.write(`before secret input: h=${h.height} class="${h.cls}"\n`);
    await page.close();

    // 面 2：agent 详情任务行 chip（旧 Chip mini 14px / .chip 基类）
    const page2 = await browser.newPage({
      viewport: { width: 1440, height: 732 },
      colorScheme: scheme,
    });
    await page2.addInitScript((s) => localStorage.setItem('pacman-theme', s), scheme);
    await page2.goto(`${BASE}/app/resources/agents/r3-builder?scenario=agent-detail-active`, {
      waitUntil: 'networkidle',
    });
    await page2.locator('.agent-task-row').first().waitFor({ state: 'visible', timeout: 15_000 });
    await page2.locator('.agent-tasks').screenshot({ path: join(OUT, `02-agent-task-chips-${scheme}.png`) });
    const chip = await page2
      .locator('.agent-task-row')
      .nth(0)
      .locator('.chip')
      .evaluate((el) => ({
        height: el.getBoundingClientRect().height,
        cls: el.className,
      }));
    process.stdout.write(`before chip: h=${chip.height} class="${chip.cls}"\n`);
    await page2.close();
  }
} finally {
  await browser.close();
  preview.kill('SIGTERM');
}
process.stdout.write(`shots: ${OUT}\n`);
