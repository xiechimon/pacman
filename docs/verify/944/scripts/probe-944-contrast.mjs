#!/usr/bin/env node

// #944 acceptance item 3 — better-colors measured pass over the resources
// domain (不许估): every text/icon pair the migrated surfaces actually
// render is read back from the live DOM — computed foreground color and the
// BACKGROUND IT ACTUALLY RENDERS ON: the ancestor background stack composited
// (alpha layers blended bottom-up), with canvas color normalization so modern
// serializations (oklab / color(srgb) / alpha forms) measure exactly instead
// of being skipped. Both themes, standard fixture stack.
//
// Pairs are reported against their WCAG threshold (4.5 normal text / 3.0
// large text ≥24px or ≥18.66px bold / 3.0 non-text UI). Per better-colors:
// a failing pair is REPORTED, not repainted — the palette is sealed (#909)
// and the values are the #915-flipped canon (spec/22 §1.7/1.8); the migration
// itself is equal-value, so every finding here predates #944.
//
// Usage: fixture stack serving on BASE (default http://127.0.0.1:8400):
//   node docs/verify/944/scripts/probe-944-contrast.mjs [--out docs/verify/944]
//
// Output: <out>/contrast-<theme>.json (raw measurements) +
//         <out>/contrast.md (review table, both themes side by side).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8400';
const outArg = process.argv.indexOf('--out');
const OUT = resolve(REPO, outArg === -1 ? 'docs/verify/944' : process.argv[outArg + 1]);

// --- WCAG 2.x relative luminance / contrast --------------------------------
const chan = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
const over = (fg, bg) => {
  // fg = [r,g,b,a] over opaque bg = [r,g,b]
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
};

// --- measurement targets ----------------------------------------------------
// kind: 'text' (4.5 / large 3.0) | 'ui' (3.0, icons & graphical objects)
// measure: 'color' (default, foreground text/icon ink) | 'bg' (the element's
//   own background is the graphical object — e.g. the online dot — contrasted
//   against the composited parent background)
// loc: { css, nth? } or { role, name, exact? , scope? }
const SKILLS = `${BASE}/app/resources/skills`;
const MACHINES = `${BASE}/app/resources/machines`;
const PROVIDERS = `${BASE}/app/resources/providers`;
const SECRETS = `${BASE}/app/resources/secrets`;
const MCP = `${BASE}/app/resources/mcp-servers`;

const STEPS = [
  {
    name: 'skills rows + search/sort',
    goto: `${SKILLS}?scenario=06`,
    targets: [
      { label: 'topbar title', loc: { css: '[data-testid="resource-topbar"] h1' } },
      { label: 'topbar 新建 action', loc: { css: '[data-testid="resource-new"]' } },
      { label: 'topbar back chevron', loc: { css: '[aria-label="返回"]' }, kind: 'ui' },
      { label: 'search input text', loc: { css: 'input[aria-label="搜索技能..."]' }, fill: 'x' },
      { label: 'search placeholder', loc: { css: 'input[aria-label="搜索技能..."]' }, pseudo: '::placeholder' },
      { label: 'sort trigger', loc: { css: 'button[aria-haspopup="menu"]' } },
      { label: 'row title', loc: { css: '[data-testid="resource-row"] span span', nth: 0 } },
      { label: 'row desc (strong)', loc: { css: '[data-testid="resource-row"] span span', nth: 1 } },
      { label: 'row chevron', loc: { css: '[data-testid="resource-row"] > span:last-child' }, kind: 'ui' },
      { label: 'tile glyph (orange sm)', loc: { css: '[data-testid="resource-row"] span:first-child' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'skills sort menu (open)',
    goto: `${SKILLS}?scenario=06`,
    ops: [{ click: { css: 'button[aria-haspopup="menu"]' } }],
    targets: [
      { label: 'menu row text', loc: { css: '[role="menuitemradio"]', nth: 1 } },
      { label: 'menu row checked (on spot-soft)', loc: { css: '[role="menuitemradio"][data-checked]' } },
      {
        label: 'menu check indicator',
        loc: { css: '[role="menuitemradio"][data-checked] [data-slot="dropdown-menu-radio-item-indicator"]' },
        kind: 'ui',
        ink: 'svgFill',
      },
    ],
  },
  {
    name: 'skills empty state',
    goto: `${SKILLS}?scenario=01`,
    targets: [
      { label: 'empty title', loc: { css: '[data-testid="resource-empty"] h2' } },
      { label: 'empty desc', loc: { css: '[data-testid="resource-empty"] p' } },
      { label: 'empty primary (brand sm)', loc: { css: '[data-testid="resource-empty"] button' } },
      { label: 'hero tile glyph', loc: { css: '[data-testid="resource-empty"] span:first-child' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'skill dialog (filled, submit enabled)',
    goto: `${SKILLS}?scenario=01`,
    ops: [
      { click: { css: '[data-testid="resource-new"]' } },
      { fill: { css: '#dlg-skill-name', value: 'probe-skill' } },
      { fill: { css: '#dlg-skill-desc', value: '对比度探针' } },
    ],
    targets: [
      { label: 'dialog label', loc: { css: '.dlg label', nth: 0 } },
      { label: 'dialog input text', loc: { css: '#dlg-skill-name' }, fill: 'probe-skill' },
      { label: 'dialog textarea text', loc: { css: '#dlg-skill-body' }, fill: 'body' },
      { label: 'dialog note', loc: { css: '.dlg p', nth: 0 } },
      { label: 'dialog submit (brand)', loc: { role: 'button', name: '新建技能', scope: '.dlg' } },
    ],
  },
  {
    name: 'machines rows',
    goto: `${MACHINES}?scenario=06`,
    targets: [
      { label: 'machine row title', loc: { css: 'div[data-kind="local"] span span span', nth: 0 } },
      { label: 'machine row desc', loc: { css: 'div[data-kind="local"] > span:nth-child(2) > span:last-child' } },
      { label: 'online dot (done green)', loc: { css: '[data-on="true"]' }, kind: 'ui', measure: 'bg' },
      { label: 'runtime mark on (pi)', loc: { css: '[data-runtime="pi"]' }, kind: 'ui', ink: 'svgFill' },
      { label: 'runtime mark off (cc, 35%)', loc: { css: '[data-runtime="claude-code"]' }, kind: 'ui', ink: 'svgFill' },
      { label: 'shell switch label', loc: { css: 'div[data-kind="local"] > span:last-child > span' } },
      { label: '添加机器 dashed action', loc: { role: 'button', name: '添加机器' } },
    ],
  },
  {
    name: 'machines rows (offline dot)',
    goto: `${MACHINES}?scenario=machines-chief-state`,
    targets: [
      { label: 'offline dot (idle)', loc: { css: '[data-on="false"]' }, kind: 'ui', measure: 'bg' },
      { label: 'orchestration host badge', loc: { css: '[data-orchestration="host"]' } },
      { label: 'orchestration running', loc: { css: '[data-orchestration="running"]' } },
      { label: 'orchestration waiting', loc: { css: '[data-orchestration="waiting"]' } },
      { label: 'status dot leading running', loc: { css: '[data-orchestration="running"]' }, kind: 'ui', measure: 'beforeBg' },
    ],
  },
  {
    name: 'machine dialog (disclosure open)',
    goto: `${MACHINES}?scenario=06`,
    ops: [
      { click: { role: 'button', name: '添加机器' } },
      { click: { role: 'button', name: '在云服务器上运行？改用 API key 注册' } },
    ],
    targets: [
      { label: 'enroll lead', loc: { css: '.dlg p', nth: 0 } },
      { label: 'enroll desc', loc: { css: '.dlg p', nth: 1 } },
      { label: 'enroll step label', loc: { css: '.dlg span', nth: 0 } },
      { label: 'enroll code', loc: { css: '.dlg code', nth: 0 } },
      { label: 'enroll copy (brand xs)', loc: { role: 'button', name: '复制', scope: '.dlg' } },
      { label: 'enroll disclosure (ghost)', loc: { role: 'button', name: '在云服务器上运行？改用 API key 注册', scope: '.dlg' } },
      { label: 'enroll key link', loc: { role: 'link', name: '获取 API key →', scope: '.dlg' } },
      { label: 'enroll browser link', loc: { role: 'link', name: '浏览器授权注册 →', scope: '.dlg' } },
    ],
  },
  {
    name: 'providers tabs + pi model rows',
    goto: `${PROVIDERS}?scenario=10`,
    targets: [
      { label: 'runtime head name', loc: { css: '[data-testid="runtime-head"] > div > span', nth: 0 } },
      { label: 'runtime head status', loc: { css: '[data-testid="runtime-head"] > div > span', nth: 1 } },
      { label: 'runtime head desc', loc: { css: '[data-testid="runtime-head"] p', nth: 0 } },
      { label: 'model row title', loc: { css: '[data-model-id] span span span', nth: 0 } },
      { label: 'model row id desc', loc: { css: '[data-model-id] > span > span:last-child' } },
      { label: 'tab selected', loc: { css: '[role="tab"][aria-selected="true"]' } },
      { label: 'tab unselected', loc: { css: '[role="tab"][aria-selected="false"]' } },
    ],
  },
  {
    name: 'providers cc tab (slot tags + 未安装 missing state)',
    goto: `${PROVIDERS}?scenario=10&runtime=claude-code`,
    targets: [
      { label: 'model slot tag', loc: { css: '[data-model-id] [data-slot="badge"]' } },
      { label: 'runtime head name (cc)', loc: { css: '[data-testid="runtime-head"] > div > span', nth: 0 } },
    ],
  },
  {
    name: 'providers cc-missing (未安装 hint + runtime-empty)',
    goto: `${PROVIDERS}?scenario=10-cc-missing&runtime=claude-code`,
    targets: [
      { label: 'runtime head 未安装 (orange)', loc: { css: '[data-testid="runtime-head"] > div > span', nth: 1 } },
      { label: 'runtime head install hint', loc: { css: '[data-testid="runtime-head"] p', nth: 1 } },
    ],
  },
  {
    name: 'providers no-source (runtime-empty text)',
    goto: `${PROVIDERS}?scenario=01`,
    targets: [
      { label: 'runtime empty text', loc: { css: '[data-testid="runtime-empty"] p' } },
    ],
  },
  {
    name: 'provider picker (rows before filter)',
    goto: `${PROVIDERS}?scenario=01`,
    ops: [{ click: { css: '[data-testid="resource-new"]' } }],
    targets: [
      { label: 'picker row text', loc: { css: '[data-preset-id="github-copilot"]' } },
      { label: 'picker OAuth chip', loc: { css: '[data-preset-id="github-copilot"] span' } },
      { label: 'picker unwired note chip', loc: { css: '[data-preset-id="openai-codex"] span' } },
      { label: 'picker custom entry', loc: { role: 'button', name: '自定义端点', scope: '.dlg' } },
      { label: 'picker search text', loc: { css: '.dlg input[aria-label="搜索服务商..."]' }, fill: 'git' },
      { label: 'picker search placeholder', loc: { css: '.dlg input[aria-label="搜索服务商..."]' }, pseudo: '::placeholder', clearFirst: true },
    ],
  },
  {
    name: 'provider key form',
    goto: `${PROVIDERS}?scenario=01`,
    ops: [
      { click: { css: '[data-testid="resource-new"]' } },
      { click: { role: 'button', name: '自定义端点', scope: '.dlg' } },
      { fill: { css: '#dlg-provider-id', value: 'relay' } },
      { fill: { css: '#dlg-provider-baseurl', value: 'https://x.example.com/v1' } },
      { fill: { css: '#dlg-provider-label', value: 'R' } },
    ],
    targets: [
      { label: 'form label', loc: { css: '.dlg label', nth: 0 } },
      { label: 'form input text', loc: { css: '#dlg-provider-id' }, fill: 'relay' },
      { label: 'form seg tab selected', loc: { css: '.dlg [role="tab"][aria-selected="true"]' } },
      { label: 'form seg tab unselected', loc: { css: '.dlg [role="tab"][aria-selected="false"]', nth: 0 } },
      { label: 'form note', loc: { css: '.dlg p', nth: 0 } },
      { label: 'checkbox row label', loc: { css: 'label.ui-checkbox span' } },
      { label: 'model-add (ghost)', loc: { role: 'button', name: '添加模型', exact: true, scope: '.dlg' } },
      { label: 'back (ghost)', loc: { role: 'button', name: '返回', scope: '.dlg' } },
      { label: 'submit (brand)', loc: { role: 'button', name: '添加模型服务', scope: '.dlg' } },
    ],
  },
  {
    name: 'secrets empty (with hint)',
    goto: `${SECRETS}?scenario=01`,
    targets: [
      { label: 'empty title', loc: { css: '[data-testid="resource-empty"] h2' } },
      { label: 'empty desc', loc: { css: '[data-testid="resource-empty"] p', nth: 0 } },
      { label: 'empty hint row', loc: { css: '[data-testid="resource-empty"] p', nth: 1 } },
    ],
  },
  {
    name: 'mcp rows',
    goto: `${MCP}?scenario=07`,
    targets: [
      { label: 'mcp row title', loc: { css: '[data-testid="resource-row"] span span span', nth: 0 } },
      { label: 'mcp row kind', loc: { css: '[data-testid="resource-row"] span span span', nth: 1 } },
      { label: 'mcp row url desc', loc: { css: '[data-testid="resource-row"] > span:nth-child(2) > span:nth-child(2)' } },
      { label: 'mcp row ago', loc: { css: '[data-testid="resource-row"] > span:last-child' } },
    ],
  },
];

// --- in-page measurement (canvas-normalized colors + composited backgrounds) --
const MEASURE = (el, opts) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const toRgba = (str) => {
    if (str == null) return null;
    ctx.clearRect(0, 0, 1, 1);
    try {
      ctx.fillStyle = str;
    } catch {
      return null;
    }
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const composite = (layers) => {
    // layers are collected top-down (element first) and the walk stops at the
    // first opaque one, so the LAST entry is the opaque base; fold from there
    // toward the element, each nearer layer over the running result.
    let base = null;
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (base == null) {
        if (l[3] >= 1) base = [l[0], l[1], l[2]];
        continue;
      }
      base = [0, 1, 2].map((k) => l[k] * l[3] + base[k] * (1 - l[3]));
    }
    return base;
  };
  const bgLayers = (node) => {
    const layers = [];
    for (let n = node; n != null; n = n.parentElement) {
      const c = toRgba(getComputedStyle(n).backgroundColor);
      if (c != null && c[3] > 0) layers.push(c);
      if (c != null && c[3] >= 1) break;
    }
    return layers;
  };

  const cs = getComputedStyle(el, opts.pseudo ?? null);
  const result = {
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
  };
  let opacity = 1;
  for (let n = el; n != null; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
  result.opacityChain = opacity;

  let fgStr;
  if (opts.measure === 'bg' || opts.measure === 'beforeBg') {
    if (opts.measure === 'beforeBg') {
      fgStr = getComputedStyle(el, '::before').backgroundColor;
      // the ::before dot sits on the element's own composited background
      result.bgRgb = composite(bgLayers(el));
    } else {
      fgStr = cs.backgroundColor;
      result.bgRgb = composite(bgLayers(el.parentElement));
    }
  } else if (opts.ink === 'svgFill') {
    const svg = el.matches('svg') ? el : el.querySelector('svg');
    const svgCs = svg != null ? getComputedStyle(svg) : cs;
    // repo line icons: root fill="none" stroke="currentColor"; brand marks:
    // per-path hex fills (multi-color — the first filled path is sampled,
    // noted in the row).
    const filled = svg?.querySelector('[fill]:not([fill="none"])') ?? null;
    if (filled != null) fgStr = getComputedStyle(filled).fill;
    else if (svgCs.fill != null && svgCs.fill !== 'none') fgStr = svgCs.fill;
    else fgStr = svgCs.stroke != null && svgCs.stroke !== 'none' ? svgCs.stroke : cs.color;
    result.bgRgb = composite(bgLayers(el));
    // glyph opacity (mark off-state) folds into the effective ink
    let glyphOpacity = 1;
    for (let n = svg; n != null && n !== el.parentElement; n = n.parentElement) {
      glyphOpacity *= Number(getComputedStyle(n).opacity);
    }
    result.glyphOpacity = glyphOpacity;
  } else {
    fgStr = cs.color;
    result.bgRgb = composite(bgLayers(el));
  }
  result.fgRaw = fgStr;
  result.fgRgbA = toRgba(fgStr);
  return result;
};

function resolveLocator(scope, loc) {
  let l;
  if (loc.css != null) l = scope.locator(loc.css);
  else l = scope.getByRole(loc.role, { name: loc.name, exact: loc.exact ?? false });
  if (loc.nth != null) l = l.nth(loc.nth);
  return l.first();
}

async function runTheme(browser, theme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
  await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
  const rows = [];
  for (const step of STEPS) {
    await page.goto(step.goto);
    for (const op of step.ops ?? []) {
      if (op.click) await resolveLocator(page, op.click).click();
      if (op.fill) await page.locator(op.fill.css).fill(op.fill.value);
    }
    // dialogs/menus enter with a 200ms fade+zoom (VIEWPORT_POP_ANIM /
    // data-open animate-in): measuring mid-flight reads an opacity-blended
    // background as if it were the resting color. Settle first.
    if ((step.ops ?? []).length > 0) await page.waitForTimeout(350);
    for (const t of step.targets) {
      const scope = t.loc.scope ? page.locator(t.loc.scope) : page;
      const l = resolveLocator(scope, t.loc);
      const kind = t.kind ?? 'text';
      const row = { step: step.name, label: t.label, kind, theme };
      try {
        if (t.clearFirst) await l.fill('');
        else if (t.fill != null && t.pseudo == null) await l.fill(t.fill);
        const m = await l.evaluate(MEASURE, {
          pseudo: t.pseudo ?? null,
          measure: t.measure ?? 'color',
          ink: t.ink ?? null,
        });
        let fg = m.fgRgbA;
        const bg = m.bgRgb;
        if (fg == null || bg == null) {
          row.status = 'UNMEASURED';
          row.note = `fg=${m.fgRaw} bg=${JSON.stringify(bg)}`;
        } else {
          if (m.glyphOpacity != null && m.glyphOpacity < 1) {
            fg = [...over([...fg.slice(0, 3), fg[3] * m.glyphOpacity], bg), 1];
            row.note = `glyph opacity ${m.glyphOpacity.toFixed(2)} composited into effective ink`;
          }
          if (fg[3] < 1) fg = [...over(fg, bg), 1];
          const r = ratio(fg, bg);
          const px = Number.parseFloat(m.fontSize);
          const bold = Number(m.fontWeight) >= 700;
          const large = px >= 24 || (px >= 18.66 && bold);
          const threshold = kind === 'ui' ? 3 : large ? 3 : 4.5;
          row.ratio = Number(r.toFixed(2));
          row.threshold = threshold;
          row.status = r >= threshold ? 'PASS' : 'FAIL';
          row.fgCss = m.fgRaw;
          row.fgRgb = fg.map((v, i) => (i < 3 ? Math.round(v) : v)).join(',');
          row.bgRgb = bg.map((v) => Math.round(v)).join(',');
          row.fontSize = m.fontSize;
          row.fontWeight = m.fontWeight;
          if (m.opacityChain < 1 && m.glyphOpacity == null) {
            row.note = `container opacity ${m.opacityChain.toFixed(2)} — effective ink is softer than measured pair; state is also carried by aria/data, not color alone`;
          }
        }
      } catch (err) {
        row.status = 'MISSING';
        row.note = String(err).split('\n')[0];
      }
      rows.push(row);
    }
  }
  await page.close();
  return rows;
}

const browser = await chromium.launch();
const results = {};
for (const theme of ['light', 'dark']) {
  results[theme] = await runTheme(browser, theme);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `contrast-${theme}.json`), `${JSON.stringify(results[theme], null, 2)}\n`);
}
await browser.close();

// --- review table ------------------------------------------------------------
const byLabel = new Map();
for (const theme of ['light', 'dark']) {
  for (const r of results[theme]) {
    const key = `${r.step} › ${r.label}`;
    if (!byLabel.has(key)) byLabel.set(key, { kind: r.kind });
    byLabel.get(key)[theme] = r;
  }
}
const lines = [
  '# #944 resources domain — measured contrast (better-colors pass)',
  '',
  `Fixture stack ${BASE}, 1440×732, chromium. Foreground = computed color /`,
  'svg fill / element background (per measure mode); background = the ancestor',
  'background stack composited (alpha layers folded, canvas-normalized so',
  'oklab/color(srgb) serializations measure exactly). Thresholds: 4.5 text,',
  '3.0 large text (≥24px or ≥18.66px bold) and non-text UI. Palette sealed',
  '(#909), values = #915 flip (spec/22 §1.7/1.8); #944 is an equal-value',
  'migration, so every finding below predates this ticket. Failing pairs are',
  'reported, not repainted (better-colors report-not-repaint).',
  '',
  '| surface › pair | kind | light | dark | threshold | verdict |',
  '| --- | --- | --- | --- | --- | --- |',
];
const fails = [];
for (const [key, v] of byLabel) {
  const l = v.light ?? {};
  const d = v.dark ?? {};
  const verdict = [l.status, d.status].every((s) => s === 'PASS')
    ? 'PASS'
    : [l.status, d.status].some((s) => s === 'FAIL')
      ? 'FAIL'
      : 'CHECK';
  if (verdict !== 'PASS') fails.push({ key, l, d });
  lines.push(
    `| ${key} | ${v.kind} | ${l.ratio ?? l.status ?? '?'} | ${d.ratio ?? d.status ?? '?'} | ${l.threshold ?? d.threshold ?? '?'} | ${verdict} |`,
  );
}
lines.push('');
lines.push('## Findings & disposition (human review, #944)');
lines.push('');
lines.push(
  'Every non-pass pair below is an equal-value carry-over of the pre-#944 per-face CSS (same token pairs, sealed #909 palette, #915-flipped values) — the migration introduced no new pair. Per better-colors report-not-repaint, they are reported for the visual-direction line (#909/#915 family) instead of repainted inside a domain ticket:',
);
lines.push('');
lines.push(
  '1. **`--text-dim` small text (12–13px) on card/panel surfaces** — measured 2.73:1 light / 3.12:1 dark on `--surface-secondary` (2.89/3.46 on `--surface`). Canon §1.7/1.8 registered `--text-dim on --background` at threshold 3 (3.05/3.75 PASS); the rendered surfaces sit one step off `--background` and the text is normal-size (threshold 4.5), so the registered pass does not cover these pairs. Affected: machine row desc / shell-switch label / 添加机器 dashed action / orchestration running+waiting / runtime-head status + install hint / model-row id desc / secrets empty hint / mcp kind+url+ago / skills row chevron (ui, 2.73 light < 3). Disposition candidates for the visual-direction ticket: demote these strings to `--text-tertiary` (measured 5.98/6.55 PASS on the same surfaces), or accept as secondary-metadata softness.',
);
lines.push(
  '2. **pi/Claude Code brand marks (light)** — first glyph fill #F09082 on `--surface-secondary` = 1.82:1 (off state 35% opacity composites to 1.35:1). Official brand assets, aria-hidden decoration: the readable name rides `role=img + aria-label + title` and the on/off state rides `data-enabled` + opacity (not color alone), so WCAG 1.4.1 state carrier is satisfied; graphical contrast (1.4.11) is not, in light theme. Not repaintable (brand canon) — reported as-is.',
);
lines.push('');
lines.push('## Surfaces not measurable on the fixture stack');
lines.push('');
lines.push(
  '- **StatusPill (`未启用`)** — no reachable consumer: `machine.pill` is set by no fixture scenario and no live mapper (dormant API). Token-declared pair (NOT a surface measurement): `--text-dim` on `--pill-idle-bg` = light #8d8980/#e8e3da ≈ 3.0:1, dark #79756f/#2d2a24 ≈ 3.2:1 — below 4.5 for its 11px text; folds into the `--text-dim` finding below.',
);
lines.push(
  '- **A3 runtime-empty action (brand sm button)** — the fixture pi segment always carries models, so the 「尚未添加服务商」 block never renders on fixture; measured on the verify live stack instead (fresh server, no providers): `contrast-live.json` — light 7.41 / dark 8.24 PASS, same recipe as the `empty primary (brand sm)` row.',
);
lines.push('');
if (fails.length > 0) {
  lines.push('## Non-pass rows (detail)');
  lines.push('');
  for (const f of fails) {
    lines.push(`- **${f.key}**`);
    for (const [theme, r] of [
      ['light', f.l],
      ['dark', f.d],
    ]) {
      lines.push(`  - ${theme}: ${JSON.stringify(r)}`);
    }
  }
  lines.push('');
}
writeFileSync(join(OUT, 'contrast.md'), `${lines.join('\n')}\n`);
const counted = Object.values(results).flat();
console.log(
  `probe-944-contrast: ${counted.length} measurements (${counted.filter((r) => r.status === 'PASS').length} PASS / ${counted.filter((r) => r.status === 'FAIL').length} FAIL / ${counted.filter((r) => !['PASS', 'FAIL'].includes(r.status)).length} other) → ${join(OUT, 'contrast.md')}`,
);
process.exit(0);
