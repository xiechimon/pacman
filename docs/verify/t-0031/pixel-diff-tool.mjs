import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/Users/xmon/.herdr/worktrees/pacman/hp-pacman-t-0031-css-pr/apps/web/package.json');
const { chromium } = require('@playwright/test');
const [fileA, fileB] = process.argv.slice(2);
const a = readFileSync(fileA).toString('base64');
const b = readFileSync(fileB).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
const res = await page.evaluate(async ([a, b]) => {
  const load = async (b64) => {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return createImageBitmap(new Blob([buf], { type: 'image/png' }));
  };
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) {
    return { dimMismatch: [ia.width, ia.height, ib.width, ib.height] };
  }
  const grab = (img) => {
    const c = new OffscreenCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height).data;
  };
  const da = grab(ia), db = grab(ib);
  let diff = 0, maxDelta = 0;
  const coords = [];
  for (let i = 0; i < da.length; i += 4) {
    const d = Math.max(Math.abs(da[i]-db[i]), Math.abs(da[i+1]-db[i+1]), Math.abs(da[i+2]-db[i+2]), Math.abs(da[i+3]-db[i+3]));
    if (d > 0) { diff++; maxDelta = Math.max(maxDelta, d); if (coords.length < 10) coords.push([ (i/4) % ia.width, Math.floor((i/4)/ia.width), d ]); }
  }
  return { width: ia.width, height: ia.height, diffPixels: diff, maxChannelDelta: maxDelta, sampleCoords: coords };
}, [a, b]);
console.log(JSON.stringify(res, null, 2));
await browser.close();
