#!/usr/bin/env node

// Scheme-aware app-icon tiles (issue #122): the favicon/apple-touch-icon
// placeholders (icon-192/512) are black ink on a transparent base — legible
// on light browser chrome only — so the prefers-color-scheme media variants
// in apps/web/index.html need opaque-base tiles per scheme. Each variant
// composites the source glyph's alpha over a solid base with the ink
// recolored, so the geometry is the source bitmap's verbatim:
//   -dark  = dark --surface base (#18181b) + dark --text-primary ink (#fafaf9)
//   -light = light --surface base (#faf7f3) + light --text-primary ink (#1c1917)
// (apps/web/src/styles/tokens.css :root / .light). Opaque bases also keep
// iOS home-screen tiles legible — apple-touch-icon ignores media and
// composites transparency over black. Run: node scripts/generate-icon-variants.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const PUBLIC_DIR = new URL('../apps/web/public', import.meta.url).pathname;

const VARIANTS = [
  { suffix: 'dark', base: [24, 24, 27], ink: [250, 250, 249] },
  { suffix: 'light', base: [250, 247, 243], ink: [28, 25, 23] },
];
const SOURCES = ['icon-192.png', 'icon-512.png'];

// ---- minimal PNG codec (8-bit RGB/RGBA, non-interlaced) ----

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error(`bitDepth ${data[8]} unsupported`);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (colorType !== 2 && colorType !== 6) throw new Error(`colorType ${colorType} unsupported`);
  const bpp = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * bpp);
  let rpos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rpos++];
    const row = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      const v = raw[rpos + x];
      let u;
      switch (filter) {
        case 0:
          u = v;
          break;
        case 1:
          u = v + a;
          break;
        case 2:
          u = v + b;
          break;
        case 3:
          u = v + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          u = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`filter ${filter} unsupported`);
      }
      row[x] = u & 0xff;
    }
    rpos += stride;
  }
  return { width, height, bpp, data: out };
}

function encodePng({ width, height, data }) {
  const chunk = (type, payload) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bitDepth
  ihdr[9] = 6; // colorType RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Source alpha over a solid base, ink recolored: out = ink·α + base·(1−α). */
function retile(src, { base, ink }) {
  const data = Buffer.alloc(src.width * src.height * 4);
  for (let i = 0, p = 0; i < src.data.length; i += src.bpp, p += 4) {
    const a = src.bpp === 4 ? src.data[i + 3] : 255;
    for (let ch = 0; ch < 3; ch++) {
      data[p + ch] = Math.round((ink[ch] * a + base[ch] * (255 - a)) / 255);
    }
    data[p + 3] = 255;
  }
  return { width: src.width, height: src.height, data };
}

function px(img, x, y) {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

for (const source of SOURCES) {
  const src = decodePng(readFileSync(join(PUBLIC_DIR, source)));
  for (const variant of VARIANTS) {
    const out = retile(src, variant);
    const name = source.replace(/\.png$/, `-${variant.suffix}.png`);
    // the tiles are opaque by construction; probe base + ink before writing
    const corner = px(out, 0, 0);
    if (corner.slice(0, 3).join() !== variant.base.join() || corner[3] !== 255) {
      throw new Error(`${name}: corner ${corner} != base ${variant.base} opaque`);
    }
    let inked = false;
    for (let i = 0; i < out.data.length; i += 4) {
      if (
        out.data[i] === variant.ink[0] &&
        out.data[i + 1] === variant.ink[1] &&
        out.data[i + 2] === variant.ink[2]
      ) {
        inked = true;
        break;
      }
    }
    if (!inked) throw new Error(`${name}: no ink pixel of ${variant.ink}`);
    writeFileSync(join(PUBLIC_DIR, name), encodePng(out));
    console.log(`wrote apps/web/public/${name} (${out.width}x${out.height})`);
  }
}
