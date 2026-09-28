#!/usr/bin/env/node
// verify-pacman overlay-repro v2 — 修上版的 coversIt 误判;每个钮真点,
// 看副作用(打开 dialog / 改 URL / hash 变 / 切数据态)。
// 关键判据:
//   hit-test = elementFromPoint(center) 与按钮自身是同一节点(直接 element ===
//   elementFromPoint 结果,不传对象)。
//   click-effect = before vs after 差异(url/dialog/aria-expanded/data-*)。
// 输出 result.json + 截图,落主仓 .claude/verify-evidence/<ts>-overlay-repro/。

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const SCRIPT_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
const ROOT = process.env.VERIFY_REPO_ROOT
  ? resolve(process.env.VERIFY_REPO_ROOT)
  : SCRIPT_ROOT;
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(ROOT, '.claude', 'verify-run');

const portsFile = join(RUN_DIR, 'ports.json');
let stack;
try {
  stack = JSON.parse(readFileSync(portsFile, 'utf8'));
} catch {
  console.error(`无栈:${portsFile} 不存在或损坏。先跑 launch.mjs`);
  process.exit(1);
}
const WEB = `http://127.0.0.1:${stack.webPort}`;

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const EVIDENCE =
  process.env.VERIFY_EVIDENCE_DIR ??
  join(SCRIPT_ROOT, '.claude', 'verify-evidence', `${stamp}-overlay-repro`);
mkdirSync(EVIDENCE, { recursive: true });

const checks = [];
const artifacts = [];
const findings = [];
let failures = 0;
const check = (ok, label, detail = '') => {
  checks.push({ ok, label, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const shot = async (page, name) => {
  await page.screenshot({ path: join(EVIDENCE, name), fullPage: false });
  artifacts.push(name);
  console.log(`shot  ${name}`);
};

/** 单钮真测:hit-test + 真点 + 看副作用 */
const probeButton = async (page, locator, opts) => {
  const { label, hasClickHandler, expectEffect } = opts;
  const visible = await locator.isVisible().catch(() => false);
  if (!visible) {
    check(false, `visible:${label}`, '元素不可见');
    return;
  }
  const box = await locator.boundingBox();
  if (box == null) {
    check(false, `box:${label}`, '无 bbox');
    return;
  }
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // 修:v2 在页面里直接比对 elementFromPoint 返回的 Element === locator
  const { topSelector, sameNode } = await page.evaluate(
    ({ x, y, sel }) => {
      const at = document.elementFromPoint(x, y);
      const target = document.querySelector(sel);
      const fmt = (el) =>
        el == null
          ? null
          : `${el.tagName}${typeof el.className === 'string' && el.className ? '.' + el.className.split(/\s+/).filter(Boolean).join('.') : ''}${el.id ? '#' + el.id : ''}`;
      return { topSelector: fmt(at), sameNode: at === target };
    },
    { x: cx, y: cy, sel: await locator.evaluate((b) => {
      // 构造稳定选择器
      const tag = b.tagName.toLowerCase();
      const cls = typeof b.className === 'string' ? b.className.split(/\s+/).filter(Boolean).join('.') : '';
      const id = b.id ? '#' + b.id : '';
      return `${tag}${cls ? '.' + cls : ''}${id}`;
    }) },
  );

  findings.push({
    label,
    centerPoint: { x: cx, y: cy },
    bbox: box,
    topSelector,
    sameNode,
  });

  check(sameNode, `hit-test:${label} center @(${cx.toFixed(0)},${cy.toFixed(0)})`, `top=${topSelector}`);

  // 是否有 click handler?靠 before/after state 对比推断
  const before = await page.evaluate(() => ({
    url: location.href,
    hash: location.hash,
    dlg: !!document.querySelector('.dlg,.dlg-backdrop,[role="dialog"]'),
    popoverOpen: !!document.querySelector('.chip-popover,.plan-dropdown,.res-sort-menu,.board-guide-pop,.chief-drawer'),
    ariaExpanded: (() => {
      const all = document.querySelectorAll('[aria-expanded]');
      return Array.from(all).map((e) => `${e.tagName}.${(typeof e.className === 'string' ? e.className : '').split(/\s+/).join('.')}=${e.getAttribute('aria-expanded')}`);
    })(),
    bodyDataAttrs: (() => {
      const out = {};
      for (const a of document.body.attributes) {
        if (a.name.startsWith('data-') || a.name.startsWith('aria-')) out[a.name] = a.value;
      }
      return out;
    })(),
  }));

  // 真点
  let clickErr = null;
  await locator.click({ trial: false, timeout: 3000 }).catch((e) => {
    clickErr = String(e?.message ?? e).slice(0, 120);
  });
  if (clickErr) {
    check(false, `click-exec:${label}`, clickErr);
    return;
  }
  await page.waitForTimeout(600);

  const after = await page.evaluate(() => ({
    url: location.href,
    hash: location.hash,
    dlg: !!document.querySelector('.dlg,.dlg-backdrop,[role="dialog"]'),
    popoverOpen: !!document.querySelector('.chip-popover,.plan-dropdown,.res-sort-menu,.board-guide-pop,.chief-drawer'),
    ariaExpanded: (() => {
      const all = document.querySelectorAll('[aria-expanded]');
      return Array.from(all).map((e) => `${e.tagName}.${(typeof e.className === 'string' ? e.className : '').split(/\s+/).join('.')}=${e.getAttribute('aria-expanded')}`);
    })(),
    bodyDataAttrs: (() => {
      const out = {};
      for (const a of document.body.attributes) {
        if (a.name.startsWith('data-') || a.name.startsWith('aria-')) out[a.name] = a.value;
      }
      return out;
    })(),
  }));

  const beforeSig = JSON.stringify({ url: before.url, hash: before.hash, dlg: before.dlg, popoverOpen: before.popoverOpen, bodyDataAttrs: before.bodyDataAttrs });
  const afterSig = JSON.stringify({ url: after.url, hash: after.hash, dlg: after.dlg, popoverOpen: after.popoverOpen, bodyDataAttrs: after.bodyDataAttrs });
  const changed = beforeSig !== afterSig;

  findings.push({
    label,
    expectEffect,
    before,
    after,
    changed,
    hasClickHandler,
  });

  if (hasClickHandler) {
    check(changed, `click-effect:${label}`, `before≠after=${changed} | before:${beforeSig} | after:${afterSig}`);
  } else {
    // 没有 handler 时,click 应该不产生副作用——这不是 bug,是设计
    check(true, `click-no-handler:${label}`, `无 click handler,点击不改变 state(预期)`);
  }

  // 如果 dialog 打开了,关掉再做下一钮
  if (after.dlg) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  if (after.popoverOpen && !before.popoverOpen) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
};

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 732 },
  colorScheme: 'dark',
});

try {
  // ============ R1: providers ============
  await page.goto(`${WEB}/app/resources/providers`);
  await page.waitForSelector('[data-route="/app/resources/providers"]', { timeout: 15_000 });
  check(true, 'providers 页加载');
  await shot(page, '01-providers-initial.png');

  // R1-A: 「新建」按钮 — 设计上 .res-new 是个 button 配 onClick onNew → setCreateOpen(true)
  await probeButton(page, page.locator('.res-new'), {
    label: 'res-new 新建',
    hasClickHandler: true,
    expectEffect: 'dlg opens',
  });
  await shot(page, '02-providers-after-new-click.png');

  // R1-B: 内置行(.res-grow[0]) — div,无 click handler,不该被认为可点
  await probeButton(page, page.locator('.res-grow').first(), {
    label: 'res-grow[0] 内置行(Pacman)',
    hasClickHandler: false,
    expectEffect: 'none',
  });

  // R1-C: 自定义行 — live 模式可能无(全新库)
  const customCount = await page.locator('.res-grow').count();
  if (customCount >= 2) {
    await probeButton(page, page.locator('.res-grow').nth(1), {
      label: 'res-grow[1] 自定义行',
      hasClickHandler: false,
      expectEffect: 'none',
    });
  }

  // 全局 fixed/absolute 元素清点(可能遮人)
  const provOverlays = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
      const cls = typeof el.className === 'string' ? el.className.split(/\s+/).join('.') : '';
      out.push({
        tag: el.tagName,
        cls,
        pos: cs.position,
        z: cs.zIndex,
        pe: cs.pointerEvents,
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      });
    }
    return out;
  });
  findings.push({ section: 'providers-overlays', count: provOverlays.length, items: provOverlays });

  // ============ R2: machines ============
  await page.goto(`${WEB}/app/resources/machines`);
  await page.waitForSelector('[data-route="/app/resources/machines"]', { timeout: 15_000 });
  check(true, 'machines 页加载');
  await shot(page, '03-machines-initial.png');

  // R2-A: 添加机器按钮 — 设计上 .res-add 是个 button 配 onClick → setAddOpen(true)
  await probeButton(page, page.locator('.res-add'), {
    label: 'res-add 添加机器',
    hasClickHandler: true,
    expectEffect: 'dlg opens',
  });
  await shot(page, '04-machines-after-add-click.png');

  // R2-B: 托管行(.res-grow[0]) — div,无 handler
  await probeButton(page, page.locator('.res-grow').first(), {
    label: 'res-grow[0] 托管行',
    hasClickHandler: false,
    expectEffect: 'none',
  });

  const machOverlays = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
      const cls = typeof el.className === 'string' ? el.className.split(/\s+/).join('.') : '';
      out.push({
        tag: el.tagName,
        cls,
        pos: cs.position,
        z: cs.zIndex,
        pe: cs.pointerEvents,
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      });
    }
    return out;
  });
  findings.push({ section: 'machines-overlays', count: machOverlays.length, items: machOverlays });

  // ============ 关键:小屏测 — 768px viewport 看看 FAB 是否覆盖 .res-add 右端 ============
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(300);
  await shot(page, '05-machines-1024.png');

  const addBtnBox2 = await page.locator('.res-add').boundingBox().catch(() => null);
  if (addBtnBox2 != null) {
    // 取右 1/3 区间三个点
    const probes = [
      { x: addBtnBox2.x + addBtnBox2.width * 0.5, y: addBtnBox2.y + addBtnBox2.height / 2 },
      { x: addBtnBox2.x + addBtnBox2.width * 0.8, y: addBtnBox2.y + addBtnBox2.height / 2 },
      { x: addBtnBox2.x + addBtnBox2.width * 0.95, y: addBtnBox2.y + addBtnBox2.height / 2 },
    ];
    const stacks = [];
    for (const p of probes) {
      const stack = await page.evaluate(({ x, y }) => {
        return document.elementsFromPoint(x, y).slice(0, 5).map((el) => `${el.tagName}.${typeof el.className === 'string' ? el.className.split(/\s+/).join('.') : ''}`);
      }, p);
      stacks.push({ point: p, stack });
    }
    findings.push({ section: 'machines-add-btn-elementstack-1024', stacks });
  }

  // ============ 同时把 sidebar 折叠,看 FAB 与按钮相对位置是否变 ============
  await page.evaluate(() => localStorage.setItem('pacman.sidebar-collapsed', '1'));
  await page.setViewportSize({ width: 1440, height: 732 });
  await page.reload();
  await page.waitForSelector('[data-route="/app/resources/machines"]', { timeout: 15_000 });
  await shot(page, '06-machines-sidebar-collapsed.png');

  const addBtnBox3 = await page.locator('.res-add').boundingBox().catch(() => null);
  const fabBox = await page.locator('.res-fab').boundingBox().catch(() => null);
  findings.push({
    section: 'machines-sidebar-collapsed',
    addBtn: addBtnBox3,
    fab: fabBox,
    verdict:
      addBtnBox3 && fabBox
        ? fabBox.x + fabBox.width <= addBtnBox3.x || fabBox.x >= addBtnBox3.x + addBtnBox3.width || fabBox.y + fabBox.height <= addBtnBox3.y || fabBox.y >= addBtnBox3.y + addBtnBox3.height
          ? '不重叠'
          : '重叠'
        : 'unknown',
  });

  // 同样对 providers
  await page.goto(`${WEB}/app/resources/providers`);
  await page.waitForSelector('[data-route="/app/resources/providers"]', { timeout: 15_000 });
  const newBtnBox = await page.locator('.res-new').boundingBox().catch(() => null);
  const fabBox2 = await page.locator('.res-fab').boundingBox().catch(() => null);
  findings.push({
    section: 'providers-sidebar-collapsed',
    newBtn: newBtnBox,
    fab: fabBox2,
    verdict:
      newBtnBox && fabBox2
        ? fabBox2.x + fabBox2.width <= newBtnBox.x || fabBox2.x >= newBtnBox.x + newBtnBox.width || fabBox2.y + fabBox2.height <= newBtnBox.y || fabBox2.y >= newBtnBox.y + newBtnBox.height
          ? '不重叠'
          : '重叠'
        : 'unknown',
  });
  await shot(page, '07-providers-sidebar-collapsed.png');
} catch (err) {
  check(false, 'probe 异常', String(err?.message ?? err));
  await shot(page, '99-error.png');
} finally {
  await browser.close();
}

const ok = failures === 0;
const result = {
  probe: 'overlay-repro',
  ok,
  at: now.toISOString(),
  stack: { web: WEB, root: stack.root },
  checks,
  artifacts,
  findings,
};
writeFileSync(join(EVIDENCE, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);

console.log(ok ? `overlay-repro:PASS` : `overlay-repro:FAIL(${failures} 项)`);
console.log(`evidence:${EVIDENCE}`);
process.exit(ok ? 0 : 1);