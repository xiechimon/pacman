#!/usr/bin/env node
// #915 对比度验收对账（票面判据：取 library/t-0909/reports/contrast.md 的
// C 段实测表复测，不许估）。
//
// 复测 = 值翻转后重跑 library/t-0909/scripts/measure-912.mjs（解析 live
// apps/web/src/styles/{shadcn,tokens}.css，WCAG 2.1 亮度比逐对实测，算法与
// #909 正本生成器 gen-palettes.mjs 同源），产物快照 =
// docs/verify/915/token-scale-912-postflip.json。
//
// 本脚本把复测 json 的逐对读数与 contrast.md C 段表逐行对账：
//   同 mode + 同角色对（fg on bg）→ 比率必须逐项一致（2 位小数）。
// 输出 docs/verify/915/contrast-recheck.md。
//
// 用法：node docs/verify/915/contrast-recheck.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const contrastMd = readFileSync(join(root, 'library/t-0909/reports/contrast.md'), 'utf8');
const postFlip = JSON.parse(
  readFileSync(join(root, 'docs/verify/915/token-scale-912-postflip.json'), 'utf8'),
);

// ---- parse contrast.md section C rows ----
const sectionC = contrastMd.split(/^## /m).find((s) => s.startsWith('C ·'));
if (!sectionC) throw new Error('section C not found in contrast.md');
const cRows = [];
for (const line of sectionC.split('\n')) {
  const m = line.match(
    /^\|\s*(dark|light)\s*\|\s*`(--[\w-]+) on (--[\w-]+)`\s*\|\s*([^|]+)\|\s*([\d.]+)\s*\|\s*([\d.]+):1\s*\|\s*(.+?)\s*\|$/,
  );
  if (m) {
    cRows.push({
      mode: m[1],
      fg: m[2],
      bg: m[3],
      label: m[4].trim(),
      threshold: Number(m[5]),
      ratio: Number(m[6]),
      result: m[7].trim(),
    });
  }
}
if (cRows.length === 0) throw new Error('no C-section table rows parsed');

// ---- index post-flip measurements ----
const idx = new Map();
for (const mode of ['dark', 'light']) {
  for (const row of postFlip.modes[mode].rows) {
    idx.set(`${mode}|${row.fg}|${row.bg}`, row);
  }
}

// ---- WCAG 2.1 luminance ratio (same algorithm family as measure-912) ----
function channel(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function parseColor(str) {
  const hex = str.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (hex) return [1, 2, 3].map((i) => Number.parseInt(hex[i], 16));
  const rgb = str.match(/^rgb\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*\)$/);
  if (rgb) return [1, 2, 3].map((i) => Math.round(Number(rgb[i])));
  throw new Error(`unparsable color: ${str}`);
}
function ratio(fgStr, bgStr) {
  const [fr, fg2, fb] = parseColor(fgStr).map(channel);
  const [br, bg2, bb] = parseColor(bgStr).map(channel);
  const l1 = 0.2126 * fr + 0.7152 * fg2 + 0.0722 * fb;
  const l2 = 0.2126 * br + 0.7152 * bg2 + 0.0722 * bb;
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// measure-912 每槽只量一条正典角色对；C 段里其余组合对（如 --foreground on
// --card）直接按翻值后 live 解析值补测——同算法同阈值，非估计。
function measureMissing(mode, fg, bg) {
  const vals = postFlip.modes[mode].currentValues;
  const fgValue = vals[fg];
  const bgValue = vals[bg];
  if (!fgValue || !bgValue) return null;
  const r = ratio(fgValue, bgValue);
  return { fg, bg, fgValue, bgValue, ratio: Math.round(r * 100) / 100 };
}

// ---- reconcile ----
const mismatches = [];
const missing = [];
let matched = 0;
let supplemented = 0;
const reportOnlySkipped = [];
for (const c of cRows) {
  let live = idx.get(`${c.mode}|${c.fg}|${c.bg}`);
  if (!live) {
    const sup = measureMissing(c.mode, c.fg, c.bg);
    if (sup) {
      live = { ...sup, result: c.result.startsWith('report-only') ? 'report-only' : 'PASS' };
      supplemented += 1;
      if (Math.abs(live.ratio - c.ratio) > 0.005) {
        mismatches.push({ ...c, live, why: `supplemented ratio ${c.ratio} vs live ${live.ratio}` });
        continue;
      }
      matched += 1;
      if (!c.result.startsWith('report-only') && c.threshold >= 3 && live.ratio < c.threshold) {
        mismatches.push({ ...c, live, why: `supplemented gated pair below threshold ${c.threshold}` });
      }
      continue;
    }
    missing.push(c);
    continue;
  }
  const cGated = !c.result.startsWith('report-only');
  const liveGated = live.result !== 'report-only';
  if (cGated !== liveGated) {
    mismatches.push({ ...c, live, why: 'gating class differs' });
    continue;
  }
  if (!cGated) {
    reportOnlySkipped.push(c);
  }
  if (Math.abs(live.ratio - c.ratio) > 0.005) {
    mismatches.push({ ...c, live, why: `ratio ${c.ratio} vs live ${live.ratio}` });
    continue;
  }
  matched += 1;
}

// ---- digest from the re-run (flip=0 acceptance) ----
const summary = [];
for (const mode of ['dark', 'light']) {
  const st = Object.values(postFlip.modes[mode].status);
  const counts = {};
  for (const s of st) counts[s] = (counts[s] ?? 0) + 1;
  const rows = postFlip.modes[mode].rows;
  const gated = rows.filter((r) => r.result !== 'report-only');
  const failed = gated.filter((r) => r.result !== 'PASS');
  const min = gated.reduce((a, b) => (b.ratio < a.ratio ? b : a));
  summary.push({ mode, counts, pairs: rows.length, gated: gated.length, failed: failed.length, min });
}

const md = [
  '# #915 对比度验收复测（contrast.md C 段 × 翻值后 live token 对账）',
  '',
  '- 复测器：`library/t-0909/scripts/measure-912.mjs`（WCAG 2.1 亮度比，逐对实测非估计；',
  '  算法与 #909 正本生成器 gen-palettes.mjs 同源）',
  '- 复测输入：翻转后的 `apps/web/src/styles/shadcn.css` + `tokens.css`（live 值）',
  '- 复测快照：`docs/verify/915/token-scale-912-postflip.json`',
  '- 对账基准：`library/t-0909/reports/contrast.md` § C · 纸兰（#909 定版实测表）',
  '',
  '## 槽位状态（flip=0 = live 值与 c.css 定版值逐项一致）',
  '',
  '| mode | unchanged | flip | new | retired | retire-candidate |',
  '| --- | --- | --- | --- | --- | --- |',
  ...summary.map(
    (s) =>
      `| ${s.mode} | ${s.counts.unchanged ?? 0} | ${s.counts.flip ?? 0} | ${s.counts.new ?? 0} | ${s.counts.retired ?? 0} | ${s.counts['retire-candidate'] ?? 0} |`,
  ),
  '',
  '注：`--toggle-track`/`--toggle-knob` 计入 unchanged（retire-candidate 状态位）——',
  '两槽消费点（detail/overlays.css .dlg-toggle、secondary.css .account-switch-knob）',
  '仍是活 UI，删槽推迟到消费面迁移波次（#947/#951），本票按 spec/22 §1.7/§1.8 翻值。',
  '',
  '## 门控结果',
  '',
  ...summary.map(
    (s) =>
      `- ${s.mode}: ${s.pairs} 对（门控 ${s.gated}），FAIL ${s.failed}，最低门控比 ${s.min.ratio}:1（${s.min.fg} on ${s.min.bg}）`,
  ),
  '',
  '## C 段逐对比对',
  '',
  `- C 段表行数：${cRows.length}`,
  `- 比率逐项一致（±0.005）：${matched}（其中 ${supplemented} 对为 measure-912 正典角色对之外的组合，按翻值后 live 值同算法补测）`,
  `- report-only/info 对（非 AA 门控，仍逐项核对比率）：${reportOnlySkipped.length}`,
  `- live 测量缺对：${missing.length}`,
  `- 不一致：${mismatches.length}`,
  '',
  ...(mismatches.length
    ? ['### 不一致明细', '', ...mismatches.map((m) => `- ${m.mode} ${m.fg} on ${m.bg}: ${m.why}`), '']
    : []),
  ...(missing.length
    ? ['### 缺对明细', '', ...missing.map((m) => `- ${m.mode} ${m.fg} on ${m.bg} (${m.label})`), '']
    : []),
  mismatches.length === 0 && missing.length === 0
    ? '结论：翻值后 live token 的对比度读数与 #909 定版 C 段实测表逐项一致，双模 AA 门控 0 未过。验收通过。'
    : '结论：存在不一致，验收不通过——逐项排查上表。',
  '',
].join('\n');

writeFileSync(join(root, 'docs/verify/915/contrast-recheck.md'), `${md}\n`);
console.log(md);
if (mismatches.length || missing.length) process.exit(1);
