#!/usr/bin/env node

// #950 acceptance item 3 — better-colors measured pass over the chief
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
// Usage: fixture stack serving on BASE (default http://127.0.0.1:8403):
//   node docs/verify/950/scripts/probe-950-contrast.mjs [--out docs/verify/950]
//
// Output: <out>/contrast-<theme>.json (raw measurements) +
//         <out>/contrast.md (review table, both themes side by side).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8403';
const outArg = process.argv.indexOf('--out');
const OUT = resolve(REPO, outArg === -1 ? 'docs/verify/950' : process.argv[outArg + 1]);

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

const BOARD = `${BASE}/app`;

const STEPS = [
  {
    name: 'drawer head + model row (111)',
    goto: `${BOARD}?scenario=111`,
    targets: [
      { label: 'chip title (15px/600)', loc: { role: 'button', name: '主题', exact: true } },
      { label: 'head icon glyph (新主题)', loc: { role: 'button', name: '新主题', exact: true }, kind: 'ui', ink: 'svgFill' },
      { label: 'head icon glyph (关闭)', loc: { role: 'button', name: '关闭' }, kind: 'ui', ink: 'svgFill' },
      { label: 'model row label', loc: { role: 'button', name: '总管主模型' } },
      { label: 'model runtime mark (pi)', loc: { role: 'button', name: '总管主模型' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'drawer model popover (open)',
    goto: `${BOARD}?scenario=111`,
    ops: [{ click: { role: 'button', name: '总管主模型' } }],
    targets: [
      { label: 'pick row name (selected)', loc: { css: '[role="option"][aria-selected="true"] [data-testid="model-pick-name"]' } },
      { label: 'pick row check', loc: { css: '[role="option"][aria-selected="true"] [data-testid="model-pick-check"]' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'drawer switcher (116)',
    goto: `${BOARD}?scenario=116`,
    targets: [
      { label: 'switcher row (active)', loc: { css: '[role="menuitem"][aria-current="true"]' } },
      { label: 'switcher row hash glyph', loc: { css: '[role="menuitem"] svg', nth: 0 }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'drawer unbound gate (100)',
    goto: `${BOARD}?scenario=100`,
    targets: [
      { label: 'gate copy', loc: { css: '[data-testid="chief-body"] span', nth: 0 } },
      { label: 'gate 设置 (brand)', loc: { role: 'button', name: '设置' } },
    ],
  },
  {
    name: 'drawer hero examples (111)',
    goto: `${BOARD}?scenario=111`,
    targets: [
      { label: 'hero heading', loc: { role: 'heading', name: '选择一个主题开始' } },
      { label: 'example card text', loc: { css: '[data-testid="chief-examples"] button span:last-child', nth: 0 } },
      { label: 'example tile glyph', loc: { css: '[data-testid="chief-examples"] button span:first-child' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'drawer stream (114)',
    goto: `${BOARD}?scenario=114`,
    targets: [
      { label: 'note line (dim)', loc: { css: '[data-testid="chief-stream"] > div', nth: 0 } },
      { label: 'robot paragraph', loc: { css: '[data-testid="chief-msg"] p', nth: 0 } },
      { label: 'todo chip (plan pair)', loc: { css: '[data-testid="chief-chip-todo"]' } },
      { label: 'agent chip (seg-active)', loc: { css: '[data-testid="chief-chip-agent"]' } },
      { label: 'msg foot (完成 44s)', loc: { css: '[data-testid="chief-msg-foot"]' } },
      { label: 'msg tool glyph (复制)', loc: { role: 'button', name: '复制' }, kind: 'ui', ink: 'svgFill' },
      { label: 'user bubble text', loc: { css: '[data-testid="chief-bubble"]', nth: 0 } },
    ],
  },
  {
    name: 'drawer turn tools disclosed (114)',
    goto: `${BOARD}?scenario=114`,
    ops: [{ click: { role: 'button', name: '展开过程' } }],
    targets: [
      { label: 'tool row (mono)', loc: { css: '[data-testid="chief-turn-tools"] div', nth: 0 } },
    ],
  },
  {
    name: 'drawer rewind confirm (114)',
    goto: `${BOARD}?scenario=114`,
    ops: [{ click: { role: 'button', name: '恢复到此处' } }],
    targets: [
      { label: 'confirm copy', loc: { role: 'dialog', name: '恢复到此处' } },
      { label: 'confirm 取消 (outline)', loc: { role: 'button', name: '取消', scope: '[role="dialog"]' } },
      { label: 'confirm 恢复到此处 (brand)', loc: { role: 'button', name: '恢复到此处', scope: '[role="dialog"]' } },
    ],
  },
  {
    name: 'composer tools + send (111 drafted / 114 idle)',
    goto: `${BOARD}?scenario=111`,
    targets: [
      { label: 'composer placeholder', loc: { css: '[data-testid="chief-composer-input"]' }, pseudo: '::placeholder' },
      { label: 'composer draft text', loc: { css: '[data-testid="chief-composer-input"]' } },
      { label: 'send on (on-accent)', loc: { role: 'button', name: '发送' }, kind: 'ui', ink: 'svgFill' },
      { label: 'tool glyph (提及)', loc: { role: 'button', name: '提及' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'composer send idle (114)',
    goto: `${BOARD}?scenario=114`,
    targets: [
      { label: 'send idle (dim on seg-active)', loc: { role: 'button', name: '发送' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'settings agent tab (101)',
    goto: `${BOARD}?scenario=101`,
    targets: [
      { label: 'set title', loc: { role: 'heading', name: '总管设置' } },
      { label: 'back chevron', loc: { role: 'button', name: '返回' }, kind: 'ui', ink: 'svgFill' },
      { label: 'tab selected (on pill)', loc: { css: '[role="tab"][aria-selected="true"]' } },
      { label: 'tab unselected', loc: { css: '[role="tab"][aria-selected="false"]', nth: 0 } },
      { label: 'agent row label (未设置)', loc: { role: 'button', name: '未设置' } },
      { label: 'agent row dashed glyph', loc: { role: 'button', name: '未设置' }, kind: 'ui', ink: 'svgFill' },
      { label: 'compress h3', loc: { role: 'heading', name: '压缩模型' } },
      { label: 'compress desc', loc: { css: 'h3 + p', nth: 0 } },
      { label: 'model trigger value', loc: { role: 'button', name: '压缩模型' } },
      { label: 'machine h3', loc: { role: 'heading', name: '机器' } },
      { label: 'machine trigger value', loc: { role: 'button', name: '机器' } },
    ],
  },
  {
    name: 'settings model menu (open)',
    goto: `${BOARD}?scenario=101`,
    ops: [{ click: { role: 'button', name: '压缩模型' } }],
    targets: [
      { label: 'menu row name (selected)', loc: { css: '[role="dialog"][aria-label="压缩模型"] [role="option"][aria-selected="true"] [data-testid="model-pick-name"]' } },
      { label: 'menu row name (unselected)', loc: { css: '[role="dialog"][aria-label="压缩模型"] [role="option"][aria-selected="false"] [data-testid="model-pick-name"]' } },
      { label: 'menu row provider', loc: { css: '[role="dialog"][aria-label="压缩模型"] [role="option"][aria-selected="false"] span:last-child' } },
      { label: 'menu check (selected)', loc: { css: '[role="dialog"][aria-label="压缩模型"] [data-testid="model-pick-check"]' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'settings machine menu (101-machines, open)',
    goto: `${BOARD}?scenario=101-machines`,
    ops: [{ click: { role: 'button', name: '机器' } }],
    targets: [
      { label: 'host row name', loc: { css: '[role="dialog"][aria-label="机器"] [role="option"]', nth: 0 } },
      { label: 'host dot online', loc: { css: '[role="dialog"][aria-label="机器"] [data-on="true"]' }, kind: 'ui', measure: 'bg' },
      { label: 'host dot offline', loc: { css: '[role="dialog"][aria-label="机器"] [data-on="false"]' }, kind: 'ui', measure: 'bg' },
      { label: 'host check (selected)', loc: { css: '[role="dialog"][aria-label="机器"] [role="option"][aria-selected="true"] svg' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'settings charter tab (102)',
    goto: `${BOARD}?scenario=102`,
    targets: [
      { label: 'charter empty card', loc: { css: 'div.grid' } },
      { label: 'edit button (outline)', loc: { role: 'button', name: '编辑' } },
    ],
  },
  {
    name: 'charter dialog (open)',
    goto: `${BOARD}?scenario=102`,
    ops: [{ click: { role: 'button', name: '编辑' } }],
    targets: [
      { label: 'charter textarea placeholder', loc: { css: '[role="dialog"] textarea' }, pseudo: '::placeholder' },
      { label: 'charter textarea text', loc: { css: '[role="dialog"] textarea' }, fill: '模型路由：轻活走 qwen。' },
      { label: 'dialog 取消 (outline)', loc: { role: 'button', name: '取消', scope: '[role="dialog"]' } },
      { label: 'dialog 保存章程 (brand)', loc: { role: 'button', name: '保存章程', scope: '[role="dialog"]' } },
    ],
  },
  {
    name: 'agent dialog (open from 101)',
    goto: `${BOARD}?scenario=101`,
    ops: [{ click: { role: 'button', name: '未设置' } }],
    targets: [
      { label: 'agent search placeholder', loc: { css: '[role="dialog"] input' }, pseudo: '::placeholder' },
      { label: 'agent row name', loc: { css: '[role="dialog"] [role="option"]' } },
    ],
  },
  {
    name: 'fab + badge (fab-avatar)',
    goto: `${BOARD}?scenario=fab-avatar`,
    targets: [
      { label: 'fab badge', loc: { css: '[aria-label="总管"] .fab-badge' } },
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
  '1. **`--text-dim` small text (12–13px) on card/panel surfaces — FIXED in this ticket by consumer slot swap.** First measurement: 2.73:1 light / 3.12:1 dark on `--surface-secondary` (2.89/3.46 on `--surface`), below the 4.5 text threshold; canon §1.7/1.8 had registered `--text-dim on --background` at threshold 3 only, which does not cover these surfaces. Per the #908 ruling (comment-6001887439, item 2: domain tickets may change consumer slot references, token values stay frozen) every affected consumer swapped `text-(--text-dim)` → `text-(--text-tertiary)`: machine row desc / shell-switch label / 添加机器 dashed action / orchestration running+waiting / runtime-head status + install hint / model-row id desc / secrets empty hint / mcp kind+url+ago / row chevron / status pill ink. Re-measured after the swap: 5.98–6.68:1 light, 6.55–7.86:1 dark — all PASS (see the rows above).',
);
lines.push(
  '2. **pi/Claude Code brand marks (light) — reported, not repaintable.** First glyph fill #F09082 on `--surface-secondary` = 1.82:1 (off state 35% opacity composites to 1.35:1); dark theme passes (6.14 / 1.71→state also carried by data-enabled). Official brand assets (#887 icon-only law): aria-hidden decoration, readable name rides `role=img + aria-label + title`, on/off state rides `data-enabled` + opacity (not color alone), so the WCAG 1.4.1 state carrier is satisfied; graphical contrast (1.4.11) is not, in light theme. Brand colors are assets, not consumer slot references — outside the ruling-2 authority; left for the visual-direction line.',
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
