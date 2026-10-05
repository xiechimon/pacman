#!/usr/bin/env node

// #948 better-colors 本域实测（验收模板 v2 第 3 项，不许估）：overlay/ 域
// per-face 清零后，面上每一个「前景 × 实际渲染底」配对逐个实算 WCAG 2.x
// 对比度——chip/tile 的 kind 身份色（mention-chip.ts 的槽映射，#948 暂定
// 正典）按 color-mix 15%/18% tint 在真实底面上合成后再量；文本对 4.5:1、
// 非文本（图标/状态点）3:1。token 值单源 = apps/web/src/styles/shadcn.css
// （#915 翻值后的现行正本），双主题各算一遍。
//
// 产出：docs/verify/948/contrast-948.md（人读表）+ contrast.json（机器读）。
// 判定：FAIL 的配对按 #908 comment-6001887439 裁决 2 换消费面槽引用
// （token 值冻结不动），换完重跑本脚本至零 FAIL。

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../../..');
// token 双源：tokens.css（非颜色层 + 部分语义槽）+ shadcn.css（语义槽正本）。
// 两文件各有 :root（暗，默认态）与 .light（亮）块；shadcn.css 后加载、同名
// 覆盖，故合并序 = tokens 先、shadcn 后。
const SOURCES = ['tokens.css', 'shadcn.css'].map((f) =>
  readFileSync(resolve(ROOT, 'apps/web/src/styles', f), 'utf8'),
);

/** 解析一个主题块（`:root` = dark 默认态，`.light` = 亮模），跨双源合并。 */
function parseBlock(selectorRe) {
  const tokens = new Map();
  for (const src of SOURCES) {
    let cursor = 0;
    for (;;) {
      const start = src.slice(cursor).search(selectorRe);
      if (start < 0) break;
      const abs = cursor + start;
      const open = src.indexOf('{', abs);
      let depth = 0;
      let end = open;
      for (let i = open; i < src.length; i += 1) {
        if (src[i] === '{') depth += 1;
        else if (src[i] === '}') {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const body = src.slice(open + 1, end);
      for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        tokens.set(m[1], m[2].trim());
      }
      cursor = end + 1;
    }
  }
  return tokens;
}

const DARK = parseBlock(/^:root\s*\{/m);
const LIGHT = parseBlock(/^\.light\s*\{/m);

/** 解析一个 token 值到 [r,g,b,a]（支持 #hex / rgb() / var() 链）。 */
function resolveColor(raw, tokens, depth = 0) {
  if (depth > 10) throw new Error(`var chain too deep: ${raw}`);
  const v = raw.trim();
  const varMatch = v.match(/^var\((--[\w-]+)\)$/);
  if (varMatch) {
    const next = tokens.get(varMatch[1]);
    if (next === undefined) throw new Error(`undefined token ${varMatch[1]}`);
    return resolveColor(next, tokens, depth + 1);
  }
  const hex = v.match(/^#([\da-f]{6})$/i);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const hex3 = v.match(/^#([\da-f]{3})$/i);
  if (hex3) {
    const [r, g, b] = hex3[1].split('').map((c) => Number.parseInt(c + c, 16));
    return [r, g, b, 1];
  }
  const rgb = v.match(/^rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/);
  if (rgb) {
    const a =
      rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? Number.parseFloat(rgb[4]) / 100 : Number.parseFloat(rgb[4]);
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), a];
  }
  // color-mix(in srgb, var(--x) N%, transparent) = x 取 N% alpha（渲染等价）。
  const mixAlpha = v.match(
    /^color-mix\(in srgb,\s*var\((--[\w-]+)\)\s+([\d.]+)%,\s*transparent\)$/,
  );
  if (mixAlpha) {
    const base = resolveColor(tokens.get(mixAlpha[1]), tokens, depth + 1);
    return [base[0], base[1], base[2], Number.parseFloat(mixAlpha[2]) / 100];
  }
  // color-mix(in srgb, var(--x) N%, var(--y)) = x 以 N% 压在 y 上（不透明合成）。
  const mixOver = v.match(
    /^color-mix\(in srgb,\s*var\((--[\w-]+)\)\s+([\d.]+)%,\s*var\((--[\w-]+)\)\)$/,
  );
  if (mixOver) {
    const fg = resolveColor(tokens.get(mixOver[1]), tokens, depth + 1);
    const over = resolveColor(tokens.get(mixOver[3]), tokens, depth + 1);
    const mixed = composite(fg, Number.parseFloat(mixOver[2]) / 100, over);
    return [mixed[0], mixed[1], mixed[2], 1];
  }
  throw new Error(`unparsable color: ${v}`);
}

/** alpha 合成：fg 以 alpha 压在 over 上（color-mix / rgb 透明底的渲染等价）。 */
function composite(fg, alpha, over) {
  return [0, 1, 2].map((i) => fg[i] * alpha + over[i] * (1 - alpha));
}

function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** chip 面色 = 实底封版槽对（mention-chip.ts 头注的暂定正典映射）。 */
const CHIP_PAIRS = {
  todo: ['--spot-text-on-tint', '--spot-soft'],
  agent: ['--chip-done-fg', '--chip-done-bg'],
  project: ['--tile-orange-fg', '--tile-orange-bg'],
  machine: ['--col-dot-building', '--chip-idle-bg'],
  skill: ['--chip-idle-fg', '--chip-idle-bg'],
  file: ['--chip-idle-fg', '--chip-idle-bg'],
};

/** tile 字形墨槽（18% tint 底，非文本 3:1）。 */
const KIND_SLOTS = {
  todo: '--spot-text-on-tint',
  skill: '--chip-idle-fg',
  agent: '--col-dot-done',
  project: '--tile-orange-fg',
  machine: '--col-dot-building',
};

const rows = [];

function measure(label, theme, tokens, fgTok, bgTokOrComputed, threshold, kind, note = '') {
  const fg = resolveColor(tokens.get(fgTok), tokens);
  const bg = Array.isArray(bgTokOrComputed)
    ? bgTokOrComputed
    : resolveColor(tokens.get(bgTokOrComputed), tokens);
  const r = ratio(fg.slice(0, 3), bg);
  rows.push({
    label,
    theme,
    fg: fgTok,
    bg: Array.isArray(bgTokOrComputed) ? 'composite' : bgTokOrComputed,
    ratio: Number(r.toFixed(2)),
    threshold,
    pass: r >= threshold,
    kind,
    note,
  });
  return r;
}

for (const [theme, tokens] of [
  ['dark', DARK],
  ['light', LIGHT],
]) {
  // A. mention-chip 文本对：实底封版槽对（与渲染底面无关）。
  for (const [kindName, [fgSlot, bgSlot]] of Object.entries(CHIP_PAIRS)) {
    measure(`mention-chip ${kindName}`, theme, tokens, fgSlot, bgSlot, 4.5, 'chip-text');
  }
  // B. picker 图标 tile：字形 on 18% tint over popover-bg（非文本 3:1）。
  for (const [kindName, slot] of Object.entries(KIND_SLOTS)) {
    if (kindName === 'file') continue; // tile 族只有五类目
    const fg = resolveColor(tokens.get(slot), tokens);
    const bg = composite(fg, 0.18, resolveColor(tokens.get('--popover-bg'), tokens));
    const r = ratio(fg.slice(0, 3), bg);
    rows.push({
      label: `mention-icon ${kindName}`,
      theme,
      fg: slot,
      bg: '18% tint over --popover-bg',
      ratio: Number(r.toFixed(2)),
      threshold: 3,
      pass: r >= 3,
      kind: 'icon-glyph',
    });
  }
  // C. 域内文本/图标对（槽引用直读，无 tint）。
  measure('insert 钮 brand 字形', theme, tokens, '--card-button', '--popover-bg', 4.5, 'text');
  measure('delete 行墨', theme, tokens, '--stop', '--popover-bg', 4.5, 'text');
  {
    // delete 行 hover：danger-soft 14% tint over popover-bg
    const fg = resolveColor(tokens.get('--stop'), tokens);
    const soft = resolveColor(tokens.get('--danger-soft'), tokens);
    const bg = composite(soft, soft[3], resolveColor(tokens.get('--popover-bg'), tokens));
    const r = ratio(fg.slice(0, 3), bg);
    rows.push({
      label: 'delete 行 hover（danger-soft tint）',
      theme,
      fg: '--stop',
      bg: '--danger-soft over --popover-bg',
      ratio: Number(r.toFixed(2)),
      threshold: 4.5,
      pass: r >= 4.5,
      kind: 'text',
    });
  }
  measure('菜单图标墨', theme, tokens, '--menu-icon', '--popover-bg', 3, 'icon');
  measure('正文墨 on popover', theme, tokens, '--text-primary', '--popover-bg', 4.5, 'text');
  measure('次级墨 on surface', theme, tokens, '--text-secondary', '--surface', 4.5, 'text');
  measure('三级墨 on popover', theme, tokens, '--text-tertiary', '--popover-bg', 4.5, 'text');
  // 继续编辑钮：旧 --text-dim 亮模 on dialog-bg 实测 2.89:1 连正典自留的 3:1
  // 地板都不过（#943 notify-banner 同病），按 #908 裁决 2 换 --muted-foreground。
  measure('继续编辑钮墨 on dialog', theme, tokens, '--muted-foreground', '--dialog-bg', 4.5, 'text');
  measure('搜索输入墨 on inset', theme, tokens, '--text-primary', '--surface-inset', 4.5, 'text');
  // D. veil 角标：--text-on-veil on 55% 黑 veil——最坏底 = 白（图字节任意）。
  {
    const fg = resolveColor(tokens.get('--text-on-veil'), tokens);
    const bg = composite([0, 0, 0], 0.55, [255, 255, 255]);
    const r = ratio(fg.slice(0, 3), bg);
    rows.push({
      label: '在途角标 on 黑 veil 55%（最坏底=白）',
      theme,
      fg: '--text-on-veil',
      bg: 'rgb(0 0 0 / 0.55) over white',
      ratio: Number(r.toFixed(2)),
      threshold: 4.5,
      pass: r >= 4.5,
      kind: 'text',
    });
  }
  // E. 机器状态点（非文本 3:1，on machine chip 的 --surface 底）。
  measure('机器点 online', theme, tokens, '--col-dot-done', '--surface', 3, 'dot');
  measure('机器点 offline', theme, tokens, '--col-dot-idle', '--surface', 3, 'dot');
  // F. 项目 avatar 字形（11px/9px 文本 4.5）。
  measure('项目 avatar 字形', theme, tokens, '--project-avatar-fg', '--project-avatar-bg', 4.5, 'text');
}

// —— 输出 ————————————————————————————————————————————————
const fails = rows.filter((r) => !r.pass);
let md = `# #948 overlay/ 域对比度实测（better-colors，验收模板 v2 第 3 项）

- 工具：\`docs/verify/948/scripts/contrast-948.mjs\`（本目录，可重跑）
- token 单源：\`apps/web/src/styles/shadcn.css\`（#915 翻值后现行正本）
- 算法：WCAG 2.x 相对亮度；tint 底 = alpha 合成（color-mix 渲染等价）后实算
- 阈值：文本 4.5:1（12px/13px 常规字重），大字号文本 3:1，非文本（图标/状态点）3:1
- 配对数：${rows.length}（dark ${rows.length / 2} / light ${rows.length / 2}）
- **FAIL：${fails.length}**

| 配对 | 主题 | 前景槽 | 实际底 | 实测 | 阈值 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
`;
for (const r of rows) {
  md += `| ${r.label} | ${r.theme} | \`${r.fg}\` | ${r.bg} | ${r.ratio}:1 | ${r.threshold} | ${r.pass ? 'PASS' : '**FAIL**'} |\n`;
}
if (fails.length > 0) {
  md += `\nFAIL 处置（#908 裁决 2）：换消费面槽引用后重跑本脚本，token 值不动。\n`;
} else {
  md += `\n全部配对过阈值；kind 身份色槽映射（mention-chip.ts 头注）实测成立。\n`;
}
const out = resolve(import.meta.dirname, '..');
writeFileSync(resolve(out, 'contrast-948.md'), md);
writeFileSync(resolve(out, 'contrast.json'), `${JSON.stringify({ generatedBy: 'contrast-948.mjs', rows }, null, 2)}\n`);
console.log(`rows=${rows.length} fails=${fails.length}`);
for (const f of fails) console.log(`FAIL [${f.theme}] ${f.label}: ${f.ratio}:1 < ${f.threshold} (${f.fg} on ${f.bg})`);
