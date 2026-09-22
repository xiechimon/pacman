#!/usr/bin/env node

// One-shot icon component generator (issue #53): reads the r7 icon dump
// (docs/research/assets/r7/icons.json, 218 entries / 64 unique raw
// markups) plus the r6 detail-route scopes (r7 §2 measured the detail
// surfaces by set-diff against r6, so r6 icons.json is the recorded source
// of their markups; #56) and emits one typed React SVG component per
// unique normalized markup into apps/web/src/icons/. Normalization drops
// width/height/class, so size and text-color class variants of the same
// glyph collapse. The NAME_TABLE below maps each normalized markup to a
// semantic component name; an unmapped markup fails the run so any new
// baseline icon forces an explicit naming decision.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ICONS_JSON = 'docs/research/assets/r7/icons.json';
// r6 detail-route scopes carry the detail-surface markups: r7 §2 measured
// those surfaces as a set-diff against r6, so r6 stays their recorded
// source. r7 covers every other surface.
const EXTRA_SCOPES_JSON = 'docs/research/assets/r6/icons.json';
const EXTRA_SCOPE_RE = /detail|更多/;
const OUT_DIR = 'apps/web/src/icons';

// The AI 审核 markup exists only as bitmap (r7 §6 records the button, not
// its svg); traced 1:1 from the r7 17 capture so regeneration keeps it.
// `trace` = per-icon provenance line for the generated header comment.
const EXTRA_ICONS = [
  {
    name: 'SearchPlus',
    size: [18, 18],
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="M11 8v6"></path><path d="M8 11h6"></path><path d="M21 21l-4.3-4.3"></path></svg>',
    contexts: ['aria:AI 审核 (traced from r7 17)'],
    trace: 'a 1:1 trace of the r7 17 bitmap (r7 §6 records the control, not its markup)',
  },
  {
    // file-row 👁 in the diff pane (r5b §3.8 records the control, r7 27
    // shows the pixels: almond outline + center dot, x349..362 y93..102)
    name: 'Eye',
    size: [14, 14],
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    contexts: ['diff file row (traced from r7 27)'],
    trace: 'a 1:1 trace of the r7 27 bitmap (r5b §3.8 records the control, not its markup)',
  },
  {
    // tool-pill prefix in the transcript (r7 28: chevron + underscore,
    // x779..790 y556..565 — lucide terminal shape)
    name: 'Terminal',
    size: [12, 12],
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" x2="20" y1="19" y2="19"></line></svg>',
    contexts: ['transcript tool pill (traced from r7 28)'],
    trace: 'a 1:1 trace of the r7 28 bitmap (r5b §3.8 records the pill, not its markup)',
  },
  {
    // 筛选 funnel on the project 任务 toolbar (r2 24b/26; the r7 dump never
    // captured the project routes, so the markup is traced from the bitmap)
    name: 'Funnel',
    size: [14, 14],
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"></path></svg>',
    contexts: ['project 任务 toolbar (traced from r2 24b)'],
    trace: 'a 1:1 trace of the r2 24b bitmap (project routes predate the r7 dump)',
  },
  {
    // list view glyph of the 任务 toolbar view toggle (r2 26), paired with
    // the existing Grid2x2 grid glyph
    name: 'ListLines',
    size: [16, 16],
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="6" y2="6"></line><line x1="4" x2="20" y1="12" y2="12"></line><line x1="4" x2="20" y1="18" y2="18"></line></svg>',
    contexts: ['project 任务 view toggle (traced from r2 26)'],
    trace: 'a 1:1 trace of the r2 26 bitmap (project routes predate the r7 dump)',
  },
  {
    // repo share/export glyph top-right of the project 文件 tree pane
    // (r2 07e/24)
    name: 'Upload',
    size: [16, 16],
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" x2="12" y1="2" y2="15"></line></svg>',
    contexts: ['project 文件 pane (traced from r2 07e)'],
    trace: 'a 1:1 trace of the r2 07e bitmap (project routes predate the r7 dump)',
  },
  {
    // avatar placeholder glyph on /app/project/new (r2 07): image frame
    // with dot + mountain
    name: 'ImageFrame',
    size: [24, 24],
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L3 21"></path></svg>',
    contexts: ['project new avatar tile (traced from r2 07)'],
    trace: 'a 1:1 trace of the r2 07 bitmap (project routes predate the r7 dump)',
  },
  // Chief surfaces (issue #72): the r5 icon dump never scoped the drawer or
  // the 总管设置 view (r5/icons.json carries 12 chief-adjacent entries, none
  // of these glyphs), so all seven are 1:1 traces of the r5 100/101/111
  // bitmaps — same provenance class as the traced trio above.
  {
    name: 'ChiefHash',
    size: [13, 13],
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="9" y2="9"></line><line x1="4" x2="20" y1="15" y2="15"></line><line x1="10" x2="8" y1="3" y2="21"></line><line x1="16" x2="14" y1="3" y2="21"></line></svg>',
    contexts: ['chief drawer header thread glyph (traced from r5 100)'],
    trace: 'a 1:1 trace of the r5 100 bitmap header glyph',
  },
  {
    name: 'ChiefGear',
    size: [18, 18],
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    contexts: ['aria:总管设置 (traced from r5 100)'],
    trace: 'a 1:1 trace of the r5 100 bitmap gear (lucide settings shape)',
  },
  {
    name: 'ChiefExpand',
    size: [16, 16],
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 4 4 4 4 8"></polyline><line x1="4" x2="11" y1="4" y2="11"></line><polyline points="16 20 20 20 20 16"></polyline><line x1="20" x2="13" y1="20" y2="13"></line></svg>',
    contexts: ['aria:全屏 (traced from r5 100)'],
    trace: 'a 1:1 trace of the r5 100 bitmap diagonal-arrows glyph',
  },
  {
    name: 'ChiefFaceDashed',
    size: [24, 24],
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-dasharray="2 3"></circle><circle cx="9" cy="10" r="1.7" fill="currentColor" stroke="none"></circle><circle cx="15" cy="10" r="1.7" fill="currentColor" stroke="none"></circle><line x1="9" y1="15" x2="15" y2="15"></line></svg>',
    contexts: ['chief 设置 Agent row unbound face (traced from r5 101)'],
    trace: 'a 1:1 trace of the r5 101 bitmap dashed-circle face',
  },
  {
    name: 'ChiefUserPlus',
    size: [16, 16],
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" x2="19" y1="8" y2="14"></line><line x1="22" x2="16" y1="11" y2="11"></line></svg>',
    contexts: ['chief example card 帮我组建 Agent 团队 (traced from r5 100)'],
    trace: 'a 1:1 trace of the r5 100 bitmap example glyph (lucide user-plus shape)',
  },
  {
    name: 'ChiefFolder',
    size: [16, 16],
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path></svg>',
    contexts: ['chief example card 帮我创建一个新项目 (traced from r5 100)'],
    trace: 'a 1:1 trace of the r5 100 bitmap example glyph (lucide folder shape)',
  },
  {
    name: 'ChiefUserSolid',
    size: [24, 24],
    svg: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="8" r="4"></circle><path d="M4 19c0-3.5 3.6-5.5 8-5.5s8 2 8 5.5v1.5H4Z"></path></svg>',
    contexts: ['chief stream user avatar (traced from r5 114)'],
    trace: 'a 1:1 trace of the r5 114 bitmap solid user avatar',
  },
  {
    name: 'ChiefPi',
    size: [12, 12],
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 7h11"></path><path d="M5 12h5"></path><path d="M14 7v10"></path></svg>',
    contexts: ['chief model slot glyph (traced from r5 111)'],
    trace: 'a 1:1 trace of the r5 111 bitmap model-slot glyph',
  },
];

/** Attr names JSX renders in camelCase. */
const CAMEL = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-miterlimit': 'strokeMiterlimit',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
};

const ATTR_RE = /([a-zA-Z0-9-]+)="([^"]*)"/g;

function parseAttrs(str) {
  const attrs = [];
  for (const m of str.matchAll(ATTR_RE)) {
    attrs.push([m[1], m[2]]);
  }
  return attrs;
}

/** Root svg: keep everything except width/height/class. */
function rootAttrs(svg) {
  const open = svg.match(/^<svg\s+([^>]*)>/);
  if (open == null) throw new Error('not an svg element');
  return parseAttrs(open[1]).filter(([k]) => k !== 'width' && k !== 'height' && k !== 'class');
}

/** Inner children markup, verbatim. */
function innerMarkup(svg) {
  const open = svg.match(/^<svg\s+[^>]*>/);
  return svg.slice(open[0].length, -6);
}

/** Attr list → JSX attribute string (drops class, camelCase hyphens). */
function attrsToJsx(attrs) {
  return attrs
    .filter(([k]) => k !== 'class')
    .map(([k, v]) => (CAMEL[k] ? `${CAMEL[k]}="${v}"` : `${k}="${v}"`))
    .join(' ');
}

/** JSX-ify a child element: camelCase hyphenated attr names, drop class. */
function toJsx(element) {
  const m = element.match(/^<([a-zA-Z]+)\s*([^>]*?)\/?>/);
  if (m == null) throw new Error(`unparsable element: ${element}`);
  const [, tag, attrStr] = m;
  const attrs = attrsToJsx(parseAttrs(attrStr));
  return `<${tag}${attrs ? ` ${attrs}` : ''} />`;
}

function normalize(svg) {
  const children = innerMarkup(svg)
    // outerHTML keeps explicit closing tags; collapse to self-closing form
    .replace(/<\/[a-zA-Z]+>/g, '')
    .split(/(?=<[a-zA-Z])/)
    .filter((s) => s.trim() !== '')
    .map((s) => toJsx(s.trim()));
  return { attrs: rootAttrs(svg), children };
}

const entries = JSON.parse(readFileSync(ICONS_JSON, 'utf8'));
const extraEntries = JSON.parse(readFileSync(EXTRA_SCOPES_JSON, 'utf8')).filter((e) =>
  EXTRA_SCOPE_RE.test(e.route ?? ''),
);
const uniq = new Map(); // normalized markup string -> { attrs, children, size, contexts }
for (const [src, e] of [...entries.map((e) => ['r7', e]), ...extraEntries.map((e) => ['r6', e])]) {
  const n = normalize(e.svg);
  const key = JSON.stringify([n.attrs, n.children]);
  if (!uniq.has(key)) {
    uniq.set(key, { ...n, size: [e.w, e.h], count: 0, contexts: [], source: src });
  }
  const u = uniq.get(key);
  u.count += 1;
  u.contexts.push(e.context ?? e.route);
}

for (const x of EXTRA_ICONS) {
  const n = normalize(x.svg);
  uniq.set(JSON.stringify([n.attrs, n.children]), {
    ...n,
    size: x.size,
    count: 1,
    contexts: x.contexts,
    source: 'trace',
    trace: x.trace,
    name: x.name,
  });
}

const sorted = [...uniq.entries()].sort((a, b) => b[1].count - a[1].count);

if (process.argv.includes('--list')) {
  for (const [key, u] of sorted) {
    const hash = createHash('sha1').update(key).digest('hex').slice(0, 10);
    console.log(
      `#${hash} size=${u.size} count=${u.count} ctx=${u.contexts.slice(0, 2).join(' | ')}`,
    );
    console.log(`  attrs: ${attrsToJsx(u.attrs)}`);
    console.log(`  children: ${u.children.join(' ')}`);
  }
  process.exit(0);
}

const NAME_TABLE = JSON.parse(readFileSync(new URL('./icon-names.json', import.meta.url), 'utf8'));

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const usedNames = new Set();
const exports = [];
for (const [key, u] of sorted) {
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 10);
  const name = u.name ?? NAME_TABLE[hash];
  if (name == null) {
    console.error(`unmapped icon markup #${hash} — add to scripts/icon-names.json`);
    console.error(`  contexts: ${u.contexts.join(' | ')}`);
    console.error(`  children: ${u.children.join(' ')}`);
    process.exit(1);
  }
  const pascal = name[0].toUpperCase() + name.slice(1);
  if (usedNames.has(pascal)) throw new Error(`duplicate component name ${pascal}`);
  usedNames.add(pascal);

  const [w, h] = u.size;
  const from = u.source === 'trace' ? u.trace : `docs/research/assets/${u.source}/icons.json`;
  const file = `// Generated by scripts/generate-icons.mjs from ${from} (#${hash}, seen ${u.count}×: ${u.contexts.slice(0, 3).join(' | ')}). Do not edit.
import type { SVGProps } from 'react';

export function ${pascal}({ width = ${w}, height = ${h}, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" width={width} height={height} ${attrsToJsx(u.attrs)} {...props}>
${u.children.map((c) => `      ${c}`).join('\n')}
    </svg>
  );
}
`;
  writeFileSync(join(OUT_DIR, `${name}.tsx`), file);
  exports.push(`export { ${pascal} } from './${name}.js';`);
}

writeFileSync(
  join(OUT_DIR, 'index.ts'),
  `// Generated by scripts/generate-icons.mjs. Do not edit.
${exports.sort().join('\n')}
`,
);

// emit Biome-stable formatting so regeneration keeps `biome ci` green
const formatted = spawnSync('pnpm', ['exec', 'biome', 'check', '--write', OUT_DIR], {
  encoding: 'utf8',
});
if (formatted.status !== 0) {
  console.error(`biome check --write failed:\n${formatted.stdout}\n${formatted.stderr}`);
  process.exit(1);
}

console.log(`wrote ${usedNames.size} icon components to ${OUT_DIR}`);
