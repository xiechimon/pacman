#!/usr/bin/env node
// PROTOTYPE #988 — variant 运行时自检 + 证据留存（throwaway 分支
// ui/988-palette-reselect）。variant(now/d/e/f) × mode(dark/light) ×
// page(board/detail) 逐组合：
//   1. 断言 <html> data-variant / data-radius 与 URL 参数一致；
//   2. 断言 --background 令牌文本与探针元素实解析底色 == 值正本文献字面
//      （now → src/styles/shadcn.css，d/e/f → src/styles/proto-988/<x>.css；
//      期望值现场解析文件，不硬编码）；
//   3. 断言圆角基：--radius 令牌 + --radius-lg 探针 computed px
//      （official = 0.625rem/10px，current = 0.875rem/14px）；
//   4. 截图 1440×900 落 proto-988/shots/。
// pageerror（未捕获异常）计为失败；console error 记录不失败（dev 噪声容差）。
// 任一断言失败退出码 1。
//
// 用法：node proto-988/shoot.mjs [webBase]
//   默认 http://localhost:5199（dev 起法：PACMAN_DEV_WEB_PORT=5199
//   PACMAN_DEV_SERVER_PORT=8999 pnpm dev:web——proxy 指死口，fixture 数据源）。
//   本机代理环境需 env -u http_proxy -u https_proxy -u all_proxy 前缀。

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url)); // apps/web/proto-988
const WEB = join(HERE, '..'); // apps/web
const BASE = process.argv[2] ?? 'http://localhost:5199';
const SHOTS = join(HERE, 'shots');
mkdirSync(SHOTS, { recursive: true });

const DETAIL_ID = '7ve0iOkQ-JBpSL98zSiGc'; // e2e detail fixture 通用 id（16/17/27/36 系）
const PAGES = [
  ['board', '/app?scenario=01'],
  ['detail', `/app/todo/${DETAIL_ID}?scenario=17b`],
];
const VARIANTS = ['now', 'd', 'e', 'f'];
const MODES = ['dark', 'light'];
const RADIUS_PX = { official: '10px', current: '14px' };
const RADIUS_REM = { official: '0.625rem', current: '0.875rem' };

// ---------- 值正本文献解析（期望值来源 = 文件字面，非硬编码） ----------

function blockBody(css, sel) {
  const i = css.indexOf(sel);
  if (i < 0) throw new Error(`selector not found: ${sel}`);
  const open = css.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, j);
    }
  }
  throw new Error(`unbalanced block: ${sel}`);
}

function declOf(css, sel, prop) {
  const body = blockBody(css, sel).replace(/\/\*[\s\S]*?\*\//g, '');
  const m = body.match(new RegExp(`${prop.replace(/[-]/g, '\\-')}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

const shadcnCss = readFileSync(join(WEB, 'src/styles/shadcn.css'), 'utf8');
const variantCss = Object.fromEntries(
  ['d', 'e', 'f'].map((k) => [k, readFileSync(join(WEB, `src/styles/proto-988/${k}.css`), 'utf8')]),
);

function expectedBackground(variant, mode) {
  if (variant === 'now') {
    return declOf(shadcnCss, mode === 'dark' ? ':root {' : '.light {', '--background');
  }
  const sel =
    mode === 'dark'
      ? `:root[data-variant="${variant}"] {`
      : `:root[data-variant="${variant}"].light {`;
  return declOf(variantCss[variant], sel, '--background');
}

function hexToRgbStr(hex) {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

// ---------- drive ----------

const results = [];
let failures = 0;

function check(combo, label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  results.push({ ...combo, check: label, expected, actual, ok });
  if (!ok) console.error(`FAIL ${JSON.stringify(combo)} ${label}: ${actual} != ${expected}`);
}

const browser = await chromium.launch();
try {
  for (const variant of VARIANTS) {
    for (const mode of MODES) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      });
      await context.addInitScript((theme) => {
        localStorage.setItem('pacman-theme', theme);
      }, mode);
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (e) => pageErrors.push(String(e)));
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text());
      });

      for (const [pageName, path] of PAGES) {
        // now 基线额外拍一张 radius=current（封版原形对照）；其余全 official。
        const radiusRuns = variant === 'now' && pageName === 'board' ? ['current', 'official'] : ['official'];
        for (const radius of radiusRuns) {
          const url = `${BASE}${path}&variant=${variant}&radius=${radius}`;
          await page.goto(url, { waitUntil: 'load' });
          await page.waitForSelector('[data-testid="proto988-switcher"]', { timeout: 10000 });
          // 板面卡渲染完成再拍（fixture 数据同步注入，等首张卡/详情主区即可）
          await page
            .waitForSelector(pageName === 'board' ? '.todo-card, [data-testid]' : 'main', {
              timeout: 10000,
            })
            .catch(() => {});

          const combo = { variant, mode, page: pageName, radius };
          const probe = await page.evaluate(() => {
            const root = document.documentElement;
            const el = document.createElement('div');
            el.style.background = 'var(--background)';
            el.style.borderRadius = 'var(--radius-lg)';
            document.body.appendChild(el);
            const cs = getComputedStyle(el);
            const out = {
              dataVariant: root.dataset.variant ?? null,
              dataRadius: root.dataset.radius ?? null,
              lightClass: root.classList.contains('light'),
              tokenBg: cs.getPropertyValue('--background').trim(),
              probeBg: cs.backgroundColor,
              tokenRadius: getComputedStyle(root).getPropertyValue('--radius').trim(),
              probeRadius: cs.borderRadius,
            };
            el.remove();
            return out;
          });

          check(combo, 'data-variant', probe.dataVariant, variant === 'now' ? null : variant);
          check(combo, 'data-radius', probe.dataRadius, radius);
          check(combo, 'light-class', probe.lightClass, mode === 'light');
          const expectedHex = expectedBackground(variant, mode);
          check(combo, 'token --background', probe.tokenBg.toLowerCase(), expectedHex.toLowerCase());
          check(combo, 'probe background-color', probe.probeBg, hexToRgbStr(expectedHex));
          check(combo, 'token --radius', probe.tokenRadius, RADIUS_REM[radius]);
          check(combo, 'probe radius-lg px', probe.probeRadius, RADIUS_PX[radius]);
          if (pageErrors.length > 0) {
            failures++;
            results.push({ ...combo, check: 'pageerror', ok: false, actual: pageErrors.join(' | ') });
            console.error(`FAIL ${JSON.stringify(combo)} pageerror: ${pageErrors.join(' | ')}`);
          }

          const shot = join(
            SHOTS,
            `${variant}-${mode}-${pageName}-${radius}.png`,
          );
          await page.screenshot({ path: shot });
          results.push({ ...combo, check: 'screenshot', ok: true, actual: shot });
        }
      }
      if (consoleErrors.length > 0) {
        results.push({ variant, mode, check: 'console-errors(noted)', ok: true, actual: consoleErrors.slice(0, 5).join(' | ') });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

writeFileSync(
  join(HERE, 'shoot-result.json'),
  JSON.stringify({ base: BASE, failures, results }, null, 2),
);
console.log(
  `${results.filter((r) => r.check === 'screenshot').length} screenshots -> ${SHOTS}; checks: ${results.filter((r) => r.ok !== undefined).length}, failures: ${failures}`,
);
process.exit(failures === 0 ? 0 : 1);
