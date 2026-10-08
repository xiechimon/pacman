// Focused better-colors INCREMENT check for #1005 (resources+secondary).
// Measures only the fg/bg pairs this lane's prototype newly composes, both
// themes, using the repo's WCAG math (sRGB luminance, (Lhi+.05)/(Llo+.05)),
// compositing color-mix() spot slots over their base. No value estimated.
import { readFileSync } from 'node:fs';
const css = readFileSync(
  '/Users/xmon/.herdr/worktrees/pacman/hp-pacman-t-0235-1-l2-resources-secondary-1005/apps/web/src/styles/shadcn.css',
  'utf8',
);
const slots = [
  '--secondary',
  '--secondary-foreground',
  '--card',
  '--foreground',
  '--background',
  '--muted-foreground',
  '--primary',
  '--popover',
  '--popover-foreground',
  '--card-button',
  '--spot-soft',
];
function grab(selRe) {
  const m = css.match(new RegExp(selRe + '\\s*\\{([\\s\\S]*?)\\n\\}'));
  if (!m) return {};
  const o = {};
  for (const s of slots) {
    const r = new RegExp(s + ':\\s*([^;]+);');
    const mm = m[1].match(r);
    if (mm) o[s] = mm[1].trim();
  }
  return o;
}
const dark = grab(':root');
const light = grab('\\.light');
const hex2rgb = (h) => {
  h = h.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
};
const mix = (a, b, p) => a.map((v, i) => Math.round(v * p + b[i] * (1 - p)));
function resolve(v, ctx) {
  if (v.startsWith('color-mix')) {
    const m = v.match(
      /color-mix\(in srgb,\s*var\((--[a-z-]+)\)\s*(\d+)%,\s*var\((--[a-z-]+)\)\)/,
    );
    return mix(resolve(ctx[m[1]], ctx), resolve(ctx[m[3]], ctx), parseInt(m[2]) / 100);
  }
  return hex2rgb(v);
}
const lum = (c) => {
  const f = c.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
};
const ratio = (a, b) => {
  const L1 = lum(a);
  const L2 = lum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
};
const pairs = [
  ['badge-secondary text', '--secondary-foreground', '--secondary', 4.5],
  ['badge-outline on card', '--foreground', '--card', 4.5],
  ['link on background', '--primary', '--background', 4.5],
  ['link on card', '--primary', '--card', 4.5],
  ['empty desc on bg', '--muted-foreground', '--background', 4.5],
  ['empty title on bg', '--foreground', '--background', 4.5],
  ['lang check on popover', '--card-button', '--popover', 3.0],
  ['crown on spot-soft', '--card-button', '--spot-soft', 3.0],
];
let fail = 0;
for (const mode of ['dark', 'light']) {
  const ctx = mode === 'dark' ? dark : light;
  console.log(`=== ${mode} ===`);
  for (const [name, f, b, th] of pairs) {
    const r = ratio(resolve(ctx[f], ctx), resolve(ctx[b], ctx));
    const ok = r >= th;
    if (!ok) fail++;
    console.log(`${name.padEnd(24)} ${r.toFixed(2).padStart(6)}  ${ok ? 'PASS' : 'FAIL'}  (th ${th})`);
  }
}
console.log(fail === 0 ? 'ALL INCREMENT PAIRS PASS' : `${fail} FAIL`);
