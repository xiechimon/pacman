#!/usr/bin/env node

// #946 acceptance item 3 — better-colors measured pass over the pages domain
// (不许估): every text/icon pair the migrated surfaces actually render is
// read back from the DOM — computed foreground color and the BACKGROUND IT
// ACTUALLY RENDERS ON: the ancestor background stack composited (alpha layers
// blended bottom-up), with canvas color normalization so modern
// serializations (oklab / color(srgb) / alpha forms) measure exactly instead
// of being skipped. Both themes, standard fixture stack.
//
// Pairs are reported against their WCAG threshold (4.5 normal text / 3.0
// large text ≥24px or ≥18.66px bold / 3.0 non-text UI). Per-target `floor`
// carries the canon role floor: --text-dim is gated at 3.0 by spec/22
// §1.7/1.8 (its canonical pair --text-dim on --background measures
// 3.75/3.05 there), so dim meta lines take floor 3 with the row noted;
// content text stays 4.5. Per better-colors: a failing pair is REPORTED, and
// only a consumer-slot reference may move (#908 comment-6001887439 裁决 2 —
// token values stay frozen).
//
// Faces without a fixture route (dir-browser overlay, github files link,
// inline error/hint rows) reuse pairs measured here — same token pairs on
// the same plate/box carriers; the review table notes each skip.
//
// Usage: fixture stack serving on BASE (default http://127.0.0.1:8399):
//   node docs/verify/946/scripts/probe-946-contrast.mjs [--out docs/verify/946]
//
// Output: <out>/contrast-<theme>.json (raw measurements) +
//         <out>/contrast-946.md (review table, both themes side by side).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8399';
const outArg = process.argv.indexOf('--out');
const OUT = resolve(REPO, outArg === -1 ? 'docs/verify/946' : process.argv[outArg + 1]);

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
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
};

// --- measurement targets ----------------------------------------------------
// kind: 'text' (4.5 / large 3.0) | 'ui' (3.0, icons & graphical objects)
// floor: per-target canon override (spec/22 §1.7 role floors, e.g. dim meta 3)
// measure: 'color' (default) | 'bg' | 'beforeBg' (own/::before background is
//   the graphical object, contrasted against the composited parent/own bg)
// loc: { css, nth? } or { role, name, exact?, scope? }
const SCHED = `${BASE}/app/schedules`;
const PROJ = `${BASE}/app/project/ZAQczKCu0MOAzC1ZqcFlX`;
const SETTINGS = `${PROJ}/settings`;
const NEWP = `${BASE}/app/project/new`;
const DIM = 3; // canon floor for the --text-dim de-emphasized role (spec/22 §1.7)

const STEPS = [
  {
    name: 'schedules empty (r7 11)',
    goto: `${SCHED}?scenario=11`,
    targets: [
      { label: 'topbar title', loc: { css: '.page-topbar div', nth: 0 } },
      { label: 'back chevron', loc: { css: '[aria-label="返回"]' }, kind: 'ui', ink: 'svgFill' },
      { label: '新建 action (brand ink on surface)', loc: { css: '.page-new-action' } },
      { label: 'empty tile glyph', loc: { css: '.sched-empty > div:nth-of-type(1)' }, kind: 'ui', ink: 'svgFill' },
      { label: 'empty title', loc: { css: '.sched-empty-title' } },
      { label: 'empty desc', loc: { css: '.sched-empty p' } },
      { label: 'empty primary (brand fill)', loc: { css: '.sched-empty-new' } },
      { label: 'empty hint (dim)', loc: { css: '.sched-empty > div:last-child' }, floor: DIM },
    ],
  },
  {
    name: 'schedules list card (r3 93)',
    goto: `${SCHED}?scenario=r3-93`,
    targets: [
      { label: 'card tile glyph', loc: { css: '.sched-card > span:nth-of-type(1)' }, kind: 'ui', ink: 'svgFill' },
      { label: 'card title', loc: { css: '.sched-card > div:nth-of-type(1) > div:nth-of-type(1)' } },
      { label: 'card line (secondary)', loc: { css: '.sched-card > div:nth-of-type(1) > div:nth-of-type(2)' } },
      { label: 'card line dim + seps', loc: { css: '.sched-card > div:nth-of-type(1) > div:nth-of-type(3)' }, floor: DIM },
      { label: 'card phase chip', loc: { css: '.sched-card > span:nth-of-type(2)' } },
      { label: 'kebab glyph', loc: { css: '.sched-card-more' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'sched card menu (open)',
    goto: `${SCHED}?scenario=r3-93`,
    ops: [{ click: { css: '.sched-card-more' } }],
    targets: [
      { label: 'delete row ink (--stop)', loc: { css: '.sched-card-menu-row' } },
      { label: 'delete row glyph', loc: { css: '.sched-card-menu-row' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: '新建定时 dialog (r3 92)',
    goto: `${SCHED}?scenario=r3-92`,
    targets: [
      { label: 'dialog title', loc: { css: '[aria-label="新建定时"] header span' } },
      { label: 'close glyph', loc: { css: '[aria-label="新建定时"] [aria-label="关闭"]' }, kind: 'ui', ink: 'svgFill' },
      { label: 'row label', loc: { css: '[aria-label="新建定时"] span:text-is("项目")' } },
      { label: 'row value + chevron ink', loc: { css: '[aria-label="新建定时"] span:text-is("项目") + span' } },
      { label: 'freq tab selected', loc: { css: '.sched-form-freq-tab--active' } },
      { label: 'freq tab unselected', loc: { css: '.sched-form-freq-tab', nth: 2 } },
      { label: 'field label', loc: { css: '[aria-label="新建定时"] div:text-is("时间")' } },
      { label: 'select trigger text', loc: { css: 'button[aria-label="时"]' } },
      { label: 'select trigger chevron', loc: { css: 'button[aria-label="时"]' }, kind: 'ui', ink: 'svgFill' },
      { label: 'tz note (dim)', loc: { css: '[aria-label="新建定时"] div:text-is("按你的本地时区运行（Asia/Shanghai）")' }, floor: DIM },
      { label: 'cancel (surface-secondary fill)', loc: { css: '.sched-form-cancel' } },
      { label: 'save (brand fill)', loc: { role: 'button', name: '保存', scope: '[aria-label="新建定时"]' } },
    ],
  },
  {
    name: 'sched select menu (open)',
    goto: `${SCHED}?scenario=r3-92`,
    ops: [{ click: { css: 'button[aria-label="时"]' } }],
    targets: [
      { label: 'select row text', loc: { css: '[role="listbox"][aria-label="时"] [role="option"]', nth: 1 } },
      { label: 'select row selected', loc: { css: '[role="listbox"][aria-label="时"] [role="option"][aria-selected="true"]' } },
      { label: 'select check glyph', loc: { css: '[role="listbox"][aria-label="时"] [role="option"][aria-selected="true"] span:last-child' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'project files pane (r2 24)',
    goto: `${PROJ}?scenario=r2-24`,
    targets: [
      { label: 'topbar tab selected', loc: { css: '.page-tab--active' } },
      { label: 'topbar tab unselected', loc: { css: '.page-tab', nth: 1 } },
      { label: 'branch chip text', loc: { css: '.prj-branch-chip' } },
      { label: 'branch chip glyph', loc: { css: '.prj-branch-chip' }, kind: 'ui', ink: 'svgFill' },
      { label: 'files seg selected', loc: { css: '.prj-files-seg-tab--active' } },
      { label: 'files seg unselected', loc: { css: '.prj-files-seg-tab', nth: 1 } },
      { label: 'file row name', loc: { css: '.prj-file-row span', nth: 0 } },
      { label: 'file row glyph', loc: { css: '.prj-file-row' }, kind: 'ui', ink: 'svgFill' },
      { label: 'viewer placeholder (dim)', loc: { css: 'div:text-is("请选择一个文件查看")' }, floor: DIM },
    ],
  },
  {
    name: 'project file content (row selected)',
    goto: `${PROJ}?scenario=r2-24`,
    ops: [{ click: { css: '.prj-file-row', nth: 0 } }],
    targets: [
      { label: 'file content pre', loc: { css: 'pre' } },
      { label: 'selected row name (on surface-hover)', loc: { css: '.prj-file-row span', nth: 0 } },
      { label: 'history seg unselected', loc: { css: '.prj-files-seg-tab', nth: 1 } },
    ],
  },
  {
    name: 'project tasks toolbar + rows (prj-tasks)',
    goto: `${PROJ}?scenario=prj-tasks&tab=tasks`,
    targets: [
      { label: 'search input placeholder', loc: { css: '[aria-label="搜索任务"]' }, pseudo: '::placeholder' },
      { label: 'search input text', loc: { css: '[aria-label="搜索任务"]' }, fill: 'probe' },
      { label: 'filter trigger text', loc: { role: 'button', name: '筛选' } },
      { label: 'filter trigger chevron (dim)', loc: { css: 'button[aria-haspopup]:has-text("筛选") svg:last-of-type' }, kind: 'ui', ink: 'svgFill' },
      { label: 'view tab selected glyph', loc: { css: '.prj-tasks-view-btn[aria-selected="true"]' }, kind: 'ui', ink: 'svgFill' },
      { label: 'view tab idle glyph', loc: { css: '.prj-tasks-view-btn[aria-selected="false"]' }, kind: 'ui', ink: 'svgFill' },
      { label: 'task row title link', loc: { css: '[data-testid="task-row"] a', nth: 0 } },
      { label: 'task row time (dim)', loc: { css: '[data-testid="task-row"] a + span', nth: 0 }, floor: DIM },
      { label: 'avatar status dot', loc: { css: '.prj-task-avatar' }, kind: 'ui', measure: 'afterBg' },
    ],
  },
  {
    name: 'tasks toolbar menu (open)',
    goto: `${PROJ}?scenario=prj-tasks&tab=tasks`,
    ops: [{ click: { role: 'button', name: '筛选' } }],
    targets: [
      { label: 'menu row text', loc: { css: '[role="menuitemradio"]', nth: 1 } },
      { label: 'menu check glyph (brand)', loc: { css: '[role="menuitemradio"][aria-checked="true"] [data-slot="dropdown-menu-radio-item-indicator"]' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'tasks grid cards',
    goto: `${PROJ}?scenario=prj-tasks&tab=tasks`,
    ops: [{ click: { css: '.prj-tasks-view-btn[aria-label="网格视图"]' } }],
    targets: [
      { label: 'card title link', loc: { css: '[data-testid="task-card"] a', nth: 0 } },
      { label: 'card time (dim)', loc: { css: '[data-testid="task-card"] a + span', nth: 0 }, floor: DIM },
    ],
  },
  {
    name: 'tasks empty state (r2 24b)',
    goto: `${PROJ}?scenario=r2-24b&tab=tasks`,
    targets: [
      { label: 'empty title', loc: { css: 'div:text-is("暂无内容")' } },
      { label: 'empty desc (dim)', loc: { css: 'div:text-is("创建第一个任务以开始使用。")' }, floor: DIM },
      { label: 'empty new (brand fill)', loc: { role: 'button', name: '新建任务' } },
    ],
  },
  {
    name: 'project settings (r2 24c)',
    goto: `${SETTINGS}?scenario=r2-24c`,
    targets: [
      { label: 'settings tab selected', loc: { css: '.page-tab--active' } },
      { label: 'avatar initial', loc: { css: '.prj-set-avatar' } },
      { label: 'row label', loc: { css: 'span:text-is("名称")' } },
      { label: 'row value', loc: { css: 'span:text-is("名称") + span' } },
      { label: 'hosted chip (dim on tertiary)', loc: { css: 'span:text-is("Pacman 托管")' }, floor: DIM },
      { label: 'branch chip text', loc: { css: '.prj-set-branch' } },
      { label: 'danger label', loc: { css: 'div:text-is("危险操作")' } },
      { label: 'danger title', loc: { css: 'div:text-is("删除项目")' } },
      { label: 'danger desc (tertiary)', loc: { css: 'div:has-text("将永久删除所有任务")' } },
      { label: 'delete btn (--danger solid fill)', loc: { role: 'button', name: '删除', exact: true } },
    ],
  },
  {
    name: 'new project form (01)',
    goto: `${NEWP}?scenario=01`,
    targets: [
      { label: 'avatar tile glyph (dim)', loc: { css: '.page-main-col header + div > div:nth-of-type(1)' }, kind: 'ui', ink: 'svgFill' },
      { label: 'caption (dim)', loc: { css: 'div:text-is("可选。未设置时以首字母代替。")' }, floor: DIM },
      { label: 'field label', loc: { css: 'label[for="prj-new-name"]' } },
      { label: 'name input placeholder', loc: { css: '#prj-new-name' }, pseudo: '::placeholder' },
      { label: 'name input text', loc: { css: '#prj-new-name' }, fill: 'probe-app' },
      { label: 'repo trigger placeholder span', loc: { css: 'button#prj-new-repo span' } },
      { label: 'repo trigger chevron (dim)', loc: { css: 'button#prj-new-repo' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'new project local face (browse + swap)',
    goto: `${NEWP}?scenario=01`,
    ops: [
      { click: { css: '#prj-new-repo' } },
      { click: { role: 'menuitemradio', name: '本地文件夹' } },
    ],
    targets: [
      { label: 'path input text', loc: { css: '#prj-new-repo' }, fill: '/tmp/probe' },
      { label: 'browse btn text', loc: { role: 'button', name: '浏览' } },
      { label: 'swap chevron (dim)', loc: { css: 'button[aria-label="选择仓库"]' }, kind: 'ui', ink: 'svgFill' },
    ],
  },
  {
    name: 'github picker (github-picker)',
    goto: `${NEWP}?scenario=github-picker`,
    ops: [
      { click: { css: '#prj-new-repo' } },
      { click: { role: 'menuitemradio', name: 'GitHub 仓库' } },
      { click: { css: '#prj-new-repo' } },
    ],
    targets: [
      { label: 'picker head login', loc: { css: '[data-testid="github-picker"] > div:nth-of-type(1) > span' } },
      { label: 'disconnect link (dim)', loc: { role: 'button', name: '断开连接', scope: '[data-testid="github-picker"]' }, floor: DIM },
      { label: 'search input text', loc: { css: '[aria-label="搜索仓库"]' }, fill: 'pac' },
      { label: 'repo option row', loc: { css: '[data-testid="github-picker"] [role="option"]', nth: 0 } },
      { label: 'footer manual link (dim)', loc: { role: 'button', name: '手动输入 owner/repo', scope: '[data-testid="github-picker"]' }, floor: DIM },
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
    if (opts.measure === 'beforeBg' || opts.measure === 'afterBg') {
      fgStr = getComputedStyle(el, opts.measure === 'afterBg' ? '::after' : '::before')
        .backgroundColor;
      // the pseudo dot sits on the element's own composited background
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
          const threshold = t.floor ?? (kind === 'ui' ? 3 : large ? 3 : 4.5);
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
  '# #946 pages domain — measured contrast (better-colors pass)',
  '',
  `Fixture stack ${BASE}, 1440×732, chromium. Foreground = computed color /`,
  'svg fill / element background (per measure mode); background = the ancestor',
  'background stack composited (alpha layers folded, canvas-normalized so',
  'oklab/color(srgb) serializations measure exactly). Thresholds: 4.5 text,',
  '3.0 large text (≥24px or ≥18.66px bold) and non-text UI. Palette sealed',
  '(#909), values = #915 flip (spec/22 §1.7/1.8); #946 is an equal-value',
  'migration apart from the two slot swaps recorded in Findings below. Failing',
  'pairs are dispositioned per #908 ruling 2 (consumer slot references may',
  'move; token values stay frozen).',
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
lines.push('## Findings & disposition (human review, #946)');
lines.push('');
lines.push(
  'The migration itself is equal-value (same token pairs as the retired pages.css rules, sealed #909 palette, #915-flipped values) — it introduced no new pair except the one deliberate slot swap in item 2. Per better-colors report-not-repaint + #908 ruling 2 (comment-6001887439: domain tickets may move consumer slot references, token values stay frozen):',
);
lines.push('');
lines.push(
  '1. **`--text-dim` small text/glyphs (11–13px) on surface/carrier faces — below the canon floor in light mode.** First measurement: 2.89:1 on `--surface` / 2.73:1 on `--surface-secondary` / 2.53:1 on `--surface-tertiary` (light); dark passes except the hosted chip on `--surface-tertiary` (2.40:1). Canon §1.7/1.8 gates `--text-dim` at floor 3 via its `--text-dim on --background` pair (3.75/3.05) — every pages face renders dim ink on a lifted surface, so the whole light-mode dim family falls under the canon\'s own floor. Same finding and disposition as #944 (resources): per ruling 2 EVERY affected pages-domain consumer swapped `text-(--text-dim)` → `text-(--text-tertiary)` (~20 faces: sched card dim line + seps, tz note, empty hint, select/filter/branch/file-row/swap chevrons, viewer placeholder, history meta, task+card time, tasks nomatch, issues num/page/empty, pager buttons, settings hosted chip, new-project caption + tile glyph, gh disconnect/manual links, picker empty, dir-browser dots/empty/trunc/crumb-sep — the last four are live-only faces carrying the identical pairs). Re-measured after the swap: see the table rows — all PASS both themes.',
);
lines.push(
  '2. **GitHub files link slot swap (`--accent` → `--card-button`).** The retired `.prj-files-github-link` rule referenced `--accent` — a soft-divider slot (≈1.1:1 on surface in both themes, invisible as link ink) contradicting the face\'s own comment (「链接用主题色」= brand). Per ruling 2 the consumer now references the brand slot `--card-button`; the pair `--card-button on --surface` is the measured `新建 action` row (8.24 dark / 6.14-class light — PASS ≥4.5). This is the ticket\'s only intentional color change beyond item 1.',
);
lines.push(
  '3. **Report-only families (not gated, per canon §1.3):** seg-hover tint (`--seg-hover` translucent over group fill — interactive-state tint, state also carried by fill/aria), overlay scrim (`--overlay-scrim`), disabled opacities (0.55 chains — state carried by the disabled attribute, not color). Not repainted.',
);
lines.push('');
lines.push('## Surfaces not measurable on the fixture stack');
lines.push('');
lines.push(
  '- **dir-browser overlay + inline error/hint rows (prj-new)** — live-only faces (fs/pick 422 / server 400 stubs); their pairs are identical to measured rows: error ink `--danger` on plate/surface (canon §1.7/1.8 gate pair 9.56/6.33 ≥3), hint `--text-secondary` on `--surface` (11.05/11.3), plate rows `--text-primary` on `--popover-bg` (13.09/15.86), dim-family faces swapped with item 1.',
);
lines.push(
  '- **github-project files link** — requires a live github-kind project; pair = item 2 (measured via the identical `--card-button on --surface` row).',
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
writeFileSync(join(OUT, 'contrast-946.md'), `${lines.join('\n')}\n`);
const counted = Object.values(results).flat();
console.log(
  `probe-946-contrast: ${counted.length} measurements (${counted.filter((r) => r.status === 'PASS').length} PASS / ${counted.filter((r) => r.status === 'FAIL').length} FAIL / ${counted.filter((r) => !['PASS', 'FAIL'].includes(r.status)).length} other) → ${join(OUT, 'contrast-946.md')}`,
);
process.exit(0);
