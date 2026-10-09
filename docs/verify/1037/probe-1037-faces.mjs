#!/usr/bin/env node
// #1037 双面探针 — 新建定时「部分按钮点不动」三层成因的改前/改后实测读数。
//
// 票面三层（fixture 面全部可观测，无需 live 栈；live 面 POST 断言归
// apps/web/e2e/schedules-live.spec.ts）：
//   a. fixture 面哑按钮：空态「新建定时」/顶栏「新建」/频率 tab/「保存」
//      四个真 <button> 渲染成 onClick=undefined——看着能点、点下去零结果。
//   b. live 面假行：项目/任务/机器三行是 div/span + ChevronRight，无
//      onClick/role/tabindex，静态行读起来像 picker；日期档 onPick 空操作。
//   c. 对话框无上限：自组裸 DialogContent（无封顶/无滚动/footer 不钉底），
//      短视口下面板上下溢出，取消/保存/X 够不着。
//   d. ?scenario= 传播：fixture 模式无自我标识（改后 = .fixture-mode-chip）。
//
// 用法（dist 必须是当前相位刚构建的产物）：
//   cd apps/web && pnpm exec vite build --mode fixture && cd ../..
//   node docs/verify/1037/probe-1037-faces.mjs before   # 改前
//   node docs/verify/1037/probe-1037-faces.mjs after    # 改后
// 证据落 docs/verify/1037/<phase>/（readings.json + 截图）。
// 探针自起 vite preview（PROBE_PORT，缺省 5378），跑完自收。

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(SCRIPT_DIR, '../../..');
const WEB_DIR = join(REPO, 'apps/web');
const PHASE = process.argv[2];
if (PHASE !== 'before' && PHASE !== 'after') {
  console.error('usage: probe-1037-faces.mjs <before|after>');
  process.exit(2);
}
const PORT = Number(process.env.PROBE_PORT ?? 5378);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = join(SCRIPT_DIR, PHASE);
mkdirSync(OUT, { recursive: true });

const readings = [];
function read(name, value) {
  readings.push({ name, value });
  console.log(`[${PHASE}] ${name} = ${JSON.stringify(value)}`);
}

const preview = spawn('pnpm', ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
  cwd: WEB_DIR,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
});
const ready = new Promise((ok, fail) => {
  const timer = setTimeout(() => fail(new Error('vite preview not ready in 30s')), 30_000);
  preview.stdout.on('data', (buf) => {
    if (String(buf).includes(BASE) || String(buf).includes('Local:')) {
      clearTimeout(timer);
      ok();
    }
  });
  preview.on('exit', (code) => {
    clearTimeout(timer);
    fail(new Error(`vite preview exited ${code}`));
  });
});

const box = async (locator) => {
  const b = await locator.boundingBox();
  return b == null ? null : { x: round(b.x), y: round(b.y), width: round(b.width), height: round(b.height) };
};
const round = (n) => Math.round(n * 10) / 10;

let browser;
try {
  await ready;
  browser = await chromium.launch();

  // ── a 面 + d 面：scenario 11 空态，1440×732 ─────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
    await page.goto(`${BASE}/app/schedules?scenario=11`);
    await page.locator('.sched-empty').waitFor({ state: 'visible' });
    read('d1.chip-count', await page.locator('.fixture-mode-chip').count());
    read('d1.chip-text', (await page.locator('.fixture-mode-chip').textContent().catch(() => null))?.trim() ?? null);

    await page.locator('.sched-empty-new').click();
    await page.waitForTimeout(400);
    read('a1.empty-new-click-opens-dialog', await page.getByRole('dialog', { name: '新建定时' }).count());
    await page.screenshot({ path: join(OUT, 'a1-after-empty-new-click.png') });

    // 模态 scrim 会拦后续点击——先经 取消 收层再测顶栏钮（改前此收层不存在：
    // 空态钮是哑的，从来没有层开着）。
    const a1dlg = page.getByRole('dialog', { name: '新建定时' });
    if ((await a1dlg.count()) > 0) {
      await a1dlg.getByRole('button', { name: '取消' }).click();
      await page.waitForTimeout(400);
    }

    await page.locator('.page-new-action').click();
    await page.waitForTimeout(400);
    read('a2.topbar-new-click-dialog-count', await page.getByRole('dialog', { name: '新建定时' }).count());

    // 若对话框开着（改后形态），点保存看落卡；改前对话框不存在，读数恒 0。
    const dlg = page.getByRole('dialog', { name: '新建定时' });
    if ((await dlg.count()) > 0) {
      await dlg.getByRole('button', { name: '保存' }).click();
      await page.waitForTimeout(400);
      read('a2b.save-closes-dialog', (await dlg.count()) === 0);
      read('a2c.card-count-after-save', await page.locator('.sched-card').count());
      await page.screenshot({ path: join(OUT, 'a2-after-save.png') });
    } else {
      read('a2b.save-closes-dialog', null);
      read('a2c.card-count-after-save', null);
    }
    await page.close();
  }

  // ── a 面（冻结屏）+ b 面：r3-92，1440×732 ───────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
    await page.goto(`${BASE}/app/schedules?scenario=r3-92`);
    const dlg = page.getByRole('dialog', { name: '新建定时' });
    await dlg.waitFor({ state: 'visible' });

    // b1: chevron 可供性计数（ChevronRight polyline 是其自身轮廓）
    read('b1.chevron-count-in-dialog', await dlg.locator('polyline[points="9 18 15 12 9 6"]').count());
    // b2: 三行结构读数——静态行读起来像 picker 的物证
    const rows = [];
    for (const label of ['项目', '任务', '机器']) {
      const row = dlg.locator('div.rounded-lg', { hasText: label }).first();
      if ((await row.count()) === 0) {
        rows.push({ label, found: false });
        continue;
      }
      rows.push({
        label,
        found: true,
        tag: await row.evaluate((el) => el.tagName),
        role: await row.evaluate((el) => el.getAttribute('role')),
        tabindex: await row.evaluate((el) => el.getAttribute('tabindex')),
        chevron: await row.locator('polyline[points="9 18 15 12 9 6"]').count(),
      });
    }
    read('b2.row-structure', rows);

    // a3: 频率 tab——点 每周 后选中位是否跟随
    const selectedTab = () =>
      dlg.locator('.sched-form-freq-tab[aria-selected="true"]').textContent();
    read('a3.selected-tab-before-click', (await selectedTab())?.trim());
    await dlg.getByRole('tab', { name: '每周' }).click();
    await page.waitForTimeout(300);
    read('a3.selected-tab-after-click-weekly', (await selectedTab())?.trim());

    // a4: 保存 → 关层 + 落卡（session 覆面）
    await dlg.getByRole('button', { name: '保存' }).click();
    await page.waitForTimeout(400);
    read('a4.dialog-count-after-save', await dlg.count());
    read('a4.card-count-after-save', await page.locator('.sched-card').count());
    await page.screenshot({ path: join(OUT, 'a4-after-save.png'), fullPage: false });
    await page.close();
  }

  // ── b3: 日期档回显（r3-92b 单次屏）──────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
    await page.goto(`${BASE}/app/schedules?scenario=r3-92b`);
    const dlg = page.getByRole('dialog', { name: '新建定时' });
    await dlg.waitFor({ state: 'visible' });
    const dateTrigger = dlg.locator('button[aria-label="日期"]');
    await dateTrigger.click();
    await page.waitForTimeout(200);
    const listbox = page.locator('[role="listbox"][aria-label="日期"]');
    read('b3.date-listbox-opens', await listbox.count());
    if ((await listbox.count()) > 0) {
      await listbox.getByRole('option', { name: '今天' }).click();
      await page.waitForTimeout(200);
      read('b3.date-trigger-text-after-pick', (await dateTrigger.textContent())?.trim());
      read('b3.date-listbox-closed', (await listbox.count()) === 0);
    }
    await page.close();
  }

  // ── c 面：r3-92b @ 900×420（票面实测口径）───────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 900, height: 420 } });
    await page.goto(`${BASE}/app/schedules?scenario=r3-92b`);
    const dlg = page.getByRole('dialog', { name: '新建定时' });
    await dlg.waitFor({ state: 'visible' });
    await page.waitForTimeout(300);
    read('c1.dialog-box', await box(dlg));
    read('c1.viewport', { width: 900, height: 420, cap: 420 - 48 });
    const save = dlg.getByRole('button', { name: '保存' });
    const cancel = dlg.getByRole('button', { name: '取消' });
    const close = dlg.getByRole('button', { name: '关闭' });
    const inViewport = async (loc) => {
      const b = await loc.boundingBox().catch(() => null);
      return b != null && b.y >= 0 && b.y + b.height <= 420;
    };
    read('c2.save-box', await box(save));
    read('c2.save-in-viewport', await inViewport(save));
    read('c2.cancel-in-viewport', await inViewport(cancel));
    read('c2.close-in-viewport', await inViewport(close));
    read('c3.dialog-body-present', await dlg.getByTestId('dialog-body').count());
    if ((await dlg.getByTestId('dialog-body').count()) > 0) {
      read(
        'c3.body-overflows',
        await dlg.getByTestId('dialog-body').evaluate((el) => el.scrollHeight > el.clientHeight),
      );
      const before = await box(save);
      await dlg.getByTestId('dialog-body').evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(200);
      const after = await box(save);
      read('c4.save-box-stable-under-scroll', JSON.stringify(before) === JSON.stringify(after));
      read('c4.save-in-viewport-after-scroll', await inViewport(save));
    }
    await page.screenshot({ path: join(OUT, 'c-face-900x420.png') });
    await page.close();
  }

  await browser.close();
  writeFileSync(join(OUT, 'readings.json'), `${JSON.stringify({ phase: PHASE, readings }, null, 2)}\n`);
  console.log(`[${PHASE}] wrote ${join(OUT, 'readings.json')}`);
} catch (error) {
  console.error(`[${PHASE}] probe failed:`, error);
  writeFileSync(join(OUT, 'readings.json'), `${JSON.stringify({ phase: PHASE, error: String(error), readings }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  // 错误路径也要收浏览器，否则 chromium 子进程吊住事件循环、探针不退出。
  await browser?.close().catch(() => {});
  preview.kill();
}
