#!/usr/bin/env node

// 裸控件账本（docs/spec/16 §1 批次表的「裸 <button>」列）：batch accounting
// used to key off「有没有引 ui/ 原语」only, so a page whose controls are all
// hand-rolled `<button>` read as「已无原语消费点」and fell out of every batch's
// acceptance scope. This script makes those controls countable.
//
// 口径（三列，逐域一行；域 = apps/web/src 下的顶层目录）：
//   裸 button  = 该域 *.tsx 里 `<button` 的出现次数（含多行标签）。
//   手搓类     = 挂在裸 `<button>` 的 className 上、且在 apps/web/src 下任一
//                .css 里被定义成选择子的类名数（distinct）。这就是「两套按钮
//                样式」的度量：一套来自 components/ui/button，一套来自域 css。
//   shadcn 文件 = 引 `components/ui/button` 的 tsx 文件数。
//
// 用法（仓根）: node scripts/count-raw-controls.mjs
// 输出 markdown 表，直接贴进 docs/spec/16 §5.3。

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(fileURLToPath(new URL('../apps/web/src', import.meta.url)));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const allFiles = walk(SRC);
const tsxFiles = allFiles.filter((f) => f.endsWith('.tsx'));
const cssFiles = allFiles.filter((f) => f.endsWith('.css'));

/** 全站 css 里被定义成选择子的类名（`.foo` 形态）。 */
const cssClasses = new Set();
for (const f of cssFiles) {
  const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of text.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) cssClasses.add(m[1]);
}

/** 扫出一个 `<button` 标签的属性段（到配对的 `>` 为止，跳过引号与花括号里的 `>`）。 */
function tags(source) {
  const found = [];
  for (let i = source.indexOf('<button'); i !== -1; i = source.indexOf('<button', i + 1)) {
    let depth = 0;
    let quote = null;
    let j = i + '<button'.length;
    for (; j < source.length; j++) {
      const c = source[j];
      if (quote) {
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    found.push(source.slice(i, j));
  }
  return found;
}

/** 标签里 className 的三个形（字符串 / 模板串 / 表达式）取并集。 */
function classTokens(tag) {
  const m = tag.match(/className\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*')/s);
  if (!m) return [];
  const body = m[1];
  const literals = [...body.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
    (x) => x[1] ?? x[2] ?? x[3] ?? '',
  );
  return literals
    .join(' ')
    .split(/\s+/)
    .filter((t) => /^-?[_a-zA-Z][\w-]*$/.test(t));
}

const domains = new Map();
const perFile = [];
for (const f of tsxFiles) {
  const rel = relative(SRC, f);
  const [domain, ...rest] = rel.split('/');
  if (rest.length === 0) continue; // 顶层散文件（App.tsx 等）不计域
  if (!domains.has(domain)) domains.set(domain, { raw: 0, files: 0, handrolled: new Set() });
  const bucket = domains.get(domain);
  const source = readFileSync(f, 'utf8');
  bucket.files++;
  const fileHandrolled = new Set();
  let fileRaw = 0;
  for (const tag of tags(source)) {
    bucket.raw++;
    fileRaw++;
    if (/role\s*=\s*["'{]/.test(tag) && !/\bclassName\s*=/.test(tag)) continue;
    for (const token of classTokens(tag)) {
      if (cssClasses.has(token)) {
        bucket.handrolled.add(token);
        fileHandrolled.add(token);
      }
    }
  }
  if (fileRaw > 0) perFile.push({ rel, domain, raw: fileRaw, handrolled: fileHandrolled.size });
}

const uiButtonConsumers = new Map();
for (const f of tsxFiles) {
  const rel = relative(SRC, f);
  const [domain] = rel.split('/');
  if (!domains.has(domain)) continue;
  if (readFileSync(f, 'utf8').includes('components/ui/button')) {
    uiButtonConsumers.set(domain, (uiButtonConsumers.get(domain) ?? 0) + 1);
  }
}

const rows = [...domains.entries()].sort((a, b) => b[1].raw - a[1].raw || a[0].localeCompare(b[0]));
console.log('| 域 | 裸 `<button>` | 手搓按钮类 | 消费 shadcn `Button` 的文件 |');
console.log('|---|---|---|---|');
let raw = 0;
let hand = 0;
let consumers = 0;
for (const [domain, b] of rows) {
  raw += b.raw;
  hand += b.handrolled.size;
  consumers += uiButtonConsumers.get(domain) ?? 0;
  console.log(
    `| \`${domain}\` | ${b.raw} | ${b.handrolled.size} | ${uiButtonConsumers.get(domain) ?? 0} |`,
  );
}
console.log(`| **合计** | **${raw}** | **${hand}** | **${consumers}** |`);

console.log('\n逐文件（只列裸 `<button>` > 0 者，按处数降序）：\n');
console.log('| 文件 | 裸 `<button>` | 手搓按钮类 |');
console.log('|---|---|---|');
for (const r of perFile.sort((a, b) => b.raw - a.raw || a.rel.localeCompare(b.rel))) {
  console.log(`| \`${r.rel}\` | ${r.raw} | ${r.handrolled} |`);
}
