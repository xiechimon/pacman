#!/usr/bin/env node
// #951 parity 人审 diff：before（origin/main per-face 规则栈）与 after
// （token utility 载体栈）的 probe-parity-951.mjs 采集值逐键比对。
//
// 判定三档：
//   OK       —— 逐字节等值（等值迁移面应全部落这档）
//   EXPECTED —— 声明过的授权漂移：强制同步拨杆换代（label.dlg-toggle 28×16
//               手搓 → components/ui Switch 正典默认档 32×18.4，§2.5 冻结
//               几何 / D2 授权 / 票面注「手工 toggle → shadcn Switch」）与
//               TW v4 序列化族（rounded-full 的 calc(infinity*1px) 等）
//   DRIFT    —— 未声明差异 = 疑似回归，本脚本报非零退出
//
// 用法：
//   node docs/verify/951/scripts/diff-parity-951.mjs \
//     --before /tmp/951-parity-before-dark.json --after /tmp/951-parity-after-dark.json \
//     [--out docs/verify/951/parity/diff-dark.txt]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const argOf = (name) => args[args.indexOf(name) + 1];
const BEFORE = JSON.parse(readFileSync(argOf('--before'), 'utf8'));
const AFTER = JSON.parse(readFileSync(argOf('--after'), 'utf8'));
// 采集元数据（载体档位自述）不参与比对。
delete BEFORE.scheme;
delete BEFORE.toggleCarrier;
delete AFTER.scheme;
delete AFTER.toggleCarrier;
const OUT = argOf('--out');

// TW v4 / 载体换代下语义等值的记法对（before 值 → after 值）。
const EQUIV_PAIRS = [
  ['50%', 'calc(infinity * 1px)'],
  ['50%', '9999px'],
  // rounded-full 的 used value（calc(infinity*1px) 的解析形），与 50% 同为正圆。
  ['50%', '3.35544e+07px'],
  ['0px', 'calc(infinity * 0px)'],
];

// Switch 换代（28×16 手搓 → 32×18.4 正典默认档）的布局链后果：force 行里
// flex-1 文字列被 4px 更宽的控件吃掉（票面注授权面，值 = 32-28）。
const SWITCH_CHAIN = new Set(['forceDesc.width']);

// 不可见边框的 color 序列化差：两侧 border-style 均为 none / width 均为 0
// 时，border*Color 的 computed 值（currentcolor 解析 vs border-transparent）
// 不产生任何渲染差。
const invisibleBorder = (path, rootB, rootA) => {
  const m = path.match(/^(.*)\.border(Top|Bottom|Left|Right)?Color$/);
  if (m == null) return false;
  const side = m[2] ?? '';
  const get = (root, prop) => {
    const parts = `${m[1]}.style.border${side}${prop}`.split('.');
    let node = root;
    for (const k of parts) {
      if (node == null || typeof node !== 'object') return undefined;
      node = node[k];
    }
    return node;
  };
  for (const root of [rootB, rootA]) {
    const style = get(root, 'Style');
    const width = get(root, 'Width');
    const noneStyle = style === 'none' || style === undefined;
    const zeroWidth = width === '0px' || width === undefined;
    if (!noneStyle && !zeroWidth) return false;
  }
  return true;
};
const equiv = (a, b) => EQUIV_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));

// EXPECTED 面：拨杆换代（结构换代，值必然不同——人审看两列对照 §2.5 正典）。
const isSwitchFace = (path) => path.startsWith('toggle.') || path.startsWith('dialogToggle.');

const rows = [];
let drift = 0;
let expected = 0;
let ok = 0;

function walk(path, b, a) {
  if (b === a) {
    ok += 1;
    return;
  }
  const bObj = b != null && typeof b === 'object';
  const aObj = a != null && typeof a === 'object';
  if (bObj || aObj) {
    const keys = new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})]);
    for (const k of [...keys].sort()) walk(path === '' ? k : `${path}.${k}`, b?.[k], a?.[k]);
    return;
  }
  if (typeof b === 'string' && typeof a === 'string' && equiv(b, a)) {
    ok += 1;
    return;
  }
  if (isSwitchFace(path) || SWITCH_CHAIN.has(path)) {
    expected += 1;
    rows.push(`EXPECTED  ${path}\n          before: ${JSON.stringify(b)}\n          after : ${JSON.stringify(a)}`);
    return;
  }
  if (invisibleBorder(path, BEFORE, AFTER)) {
    ok += 1;
    return;
  }
  drift += 1;
  rows.push(`DRIFT     ${path}\n          before: ${JSON.stringify(b)}\n          after : ${JSON.stringify(a)}`);
}

walk('', BEFORE, AFTER);

const report = [
  `#951 parity diff — ${argOf('--before')} vs ${argOf('--after')}`,
  `keys OK ${ok} · EXPECTED ${expected}（Switch 换代面 + TW 序列化等值对） · DRIFT ${drift}`,
  '',
  'EXPECTED 授权依据：票面注「手工 toggle → shadcn Switch」+ spec/22 §2.5 Switch',
  '冻结几何（default 32×18.4 / thumb 16）+ D2 几何自由重设计；track/thumb 色从',
  '--toggle-track/--toggle-knob 手搓槽换 --input/--primary/--background 正典槽',
  '（§1.5 实测 gated，两槽孤儿化归 #915/散件票）。',
  '',
  ...rows,
  '',
  drift === 0 ? 'VERDICT: PASS（等值面零漂移）' : `VERDICT: FAIL（${drift} 处未声明漂移）`,
  '',
].join('\n');

if (OUT != null) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, report);
}
console.log(report);
process.exit(drift === 0 ? 0 : 1);
