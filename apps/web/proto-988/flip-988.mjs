#!/usr/bin/env node
// PROTOTYPE #988 — 定版翻值（#987 §4 step 4：冻结 + 1:1 纯值翻转）。
// 把实审定版的 E · 暖灰玫（frozen canon apps/web/e2e/palette-e.css）的字面值
// 翻进 live 载体：shadcn.css（:root 暗 / .light 亮）+ tokens.css（drop-tint
// 族字面值）+ --radius 基 0.875rem → 0.625rem（实审裁决：官方基）。
// 只翻字面槽（#hex / rgb()）；var() 别名与 color-mix 公式槽一行不动
// （#787/#813 继承律：源翻公式随）。注释面另行人工对齐（引用旧实测值的
// 注释改指 docs/verify/988/ 新档）。
//
// 用法：node apps/web/proto-988/flip-988.mjs [--dry]
// 自检：翻后重解析 live 文件，逐槽与 canon 比对，任何不一致退出码 1。

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const DRY = process.argv.includes('--dry');

function blockSpan(css, sel) {
  const i = css.indexOf(sel);
  if (i < 0) throw new Error(`selector not found: ${sel}`);
  const open = css.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') {
      depth--;
      if (depth === 0) return [open + 1, j];
    }
  }
  throw new Error(`unbalanced block: ${sel}`);
}

function decls(css, sel) {
  const [a, b] = blockSpan(css, sel);
  const body = css.slice(a, b).replace(/\/\*[\s\S]*?\*\//g, '');
  const out = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(body)) != null) out[m[1]] = m[2].trim();
  return out;
}

const canonCss = readFileSync(join(WEB, 'e2e/palette-e.css'), 'utf8');
const canon = {
  dark: decls(canonCss, ':root[data-variant="e"] {'),
  light: {
    ...decls(canonCss, ':root[data-variant="e"] {'),
    ...decls(canonCss, ':root[data-variant="e"].light {'),
  },
};

const isLiteral = (v) => /^#[0-9a-fA-F]{3,8}$/.test(v) || /^rgb\(/.test(v);

// Replace literal-valued declarations inside one block, line based.
function flipBlock(css, sel, canonDecls, label, log) {
  const [a, b] = blockSpan(css, sel);
  const body = css.slice(a, b);
  const flipped = body.split('\n').map((line) => {
    const m = line.match(/^(\s*)(--[\w-]+)(\s*:\s*)([^;]+)(;.*)$/);
    if (m == null) return line;
    const [, indent, name, sep, value, tail] = m;
    const canonValue = canonDecls[name];
    if (canonValue == null) return line; // slot not in canon (non-color etc.)
    if (!isLiteral(value.trim())) return line; // alias/formula — inherit law
    if (value.trim() === canonValue) return line; // already equal
    log.push(`${label} ${name}: ${value.trim()} -> ${canonValue}`);
    return `${indent}${name}${sep}${canonValue}${tail}`;
  });
  return css.slice(0, a) + flipped.join('\n') + css.slice(b);
}

const log = [];
const shadcnPath = join(WEB, 'src/styles/shadcn.css');
const tokensPath = join(WEB, 'src/styles/tokens.css');
let shadcn = readFileSync(shadcnPath, 'utf8');
let tokens = readFileSync(tokensPath, 'utf8');

shadcn = flipBlock(shadcn, ':root {', canon.dark, 'shadcn:root(dark)', log);
shadcn = flipBlock(shadcn, '.light {', canon.light, 'shadcn.light', log);
tokens = flipBlock(tokens, ':root {', canon.dark, 'tokens:root(dark)', log);
tokens = flipBlock(tokens, '.light {', canon.light, 'tokens.light', log);

// radius 基翻官方（实审裁决 #988）：乘数族 calc 自动跟随。
const before = shadcn;
shadcn = shadcn.replace('--radius: 0.875rem;', '--radius: 0.625rem;');
if (shadcn === before) throw new Error('--radius: 0.875rem not found — already flipped?');
log.push('shadcn:root --radius: 0.875rem -> 0.625rem (official base, #988 verdict)');

if (!DRY) {
  writeFileSync(shadcnPath, shadcn);
  writeFileSync(tokensPath, tokens);
}

// 自检：重解析翻后文件，canon 里每个字面槽 live 必须等值。
const verifyShadcn = DRY ? shadcn : readFileSync(shadcnPath, 'utf8');
const verifyTokens = DRY ? tokens : readFileSync(tokensPath, 'utf8');
const liveDark = { ...decls(verifyTokens, ':root {'), ...decls(verifyShadcn, ':root {') };
const liveLight = {
  ...liveDark,
  ...decls(verifyTokens, '.light {'),
  ...decls(verifyShadcn, '.light {'),
};
let mismatches = 0;
for (const [mode, canonDecls, live] of [
  ['dark', canon.dark, liveDark],
  ['light', canon.light, liveLight],
]) {
  for (const [name, value] of Object.entries(canonDecls)) {
    if (!isLiteral(value)) continue;
    if (live[name] !== value) {
      mismatches++;
      console.error(`MISMATCH ${mode} ${name}: live ${live[name]} != canon ${value}`);
    }
  }
}
console.log(`${DRY ? '[dry] ' : ''}flipped ${log.length} declarations; mismatches: ${mismatches}`);
if (process.argv.includes('--verbose')) console.log(log.join('\n'));
process.exit(mismatches === 0 ? 0 : 1);
