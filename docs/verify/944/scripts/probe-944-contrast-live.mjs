import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const BASE = 'http://127.0.0.1:5274';
const MEASURE = (el) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1; canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const toRgba = (s) => { ctx.clearRect(0,0,1,1); ctx.fillStyle = s; ctx.fillRect(0,0,1,1); const d = ctx.getImageData(0,0,1,1).data; return [d[0],d[1],d[2],d[3]/255]; };
  const layers = [];
  for (let n = el; n != null; n = n.parentElement) {
    const c = toRgba(getComputedStyle(n).backgroundColor);
    if (c && c[3] > 0) layers.push(c);
    if (c && c[3] >= 1) break;
  }
  let base = null;
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    if (base == null) { if (l[3] >= 1) base = [l[0],l[1],l[2]]; continue; }
    base = [0,1,2].map((k) => l[k]*l[3] + base[k]*(1-l[3]));
  }
  const cs = getComputedStyle(el);
  return { fg: toRgba(cs.color), bg: base, fontSize: cs.fontSize, fontWeight: cs.fontWeight };
};
const chan = (c) => { const v = c/255; return v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4; };
const lum = ([r,g,b]) => 0.2126*chan(r)+0.7152*chan(g)+0.0722*chan(b);
const ratio = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
const browser = await chromium.launch();
const rows = [];
for (const theme of ['light','dark']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
  await page.addInitScript((t) => localStorage.setItem('pacman-theme', t), theme);
  await page.goto(`${BASE}/app/resources/providers`);
  await page.waitForSelector('[data-testid="runtime-empty"]', { timeout: 15000 });
  for (const [label, sel] of [
    ['A3 runtime-empty text', '[data-testid="runtime-empty"] p'],
    ['A3 runtime-empty action (brand sm)', '[data-testid="runtime-empty"] button'],
  ]) {
    const m = await page.locator(sel).first().evaluate(MEASURE);
    const r = ratio(m.fg.slice(0,3), m.bg);
    rows.push({ theme, label, ratio: Number(r.toFixed(2)), threshold: 4.5, status: r >= 4.5 ? 'PASS' : 'FAIL', fg: m.fg.map(Math.round).join(','), bg: m.bg.map(Math.round).join(',') });
  }
  await page.close();
}
await browser.close();
writeFileSync(process.argv[2], JSON.stringify(rows, null, 2) + '\n');
console.log(rows.map((r) => `${r.theme} ${r.label} ${r.ratio} ${r.status}`).join('\n'));
