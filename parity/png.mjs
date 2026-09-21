// Minimal PNG decoder (RGB/RGBA 8-bit, non-interlaced) + pixel probes.
// Node has zlib built in; no deps. Used for capture analysis and
// region-diff iteration while implementing parity screens.
import { inflateSync } from 'node:zlib';

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8) throw new Error(`bitDepth ${bitDepth} unsupported`);
      if (colorType !== 2 && colorType !== 6) throw new Error(`colorType ${colorType} unsupported`);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * 3);
  let prev = Buffer.alloc(stride);
  let rpos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rpos++];
    const row = Buffer.from(raw.subarray(rpos, rpos + stride));
    rpos += stride;
    unfilter(row, prev, filter, bpp);
    for (let x = 0; x < width; x++) {
      const s = x * bpp;
      const d = (y * width + x) * 3;
      out[d] = row[s];
      out[d + 1] = row[s + 1];
      out[d + 2] = row[s + 2];
    }
    prev = row;
  }
  return { width, height, data: out };
}

function unfilter(row, prev, filter, bpp) {
  if (filter === 0) return;
  for (let i = 0; i < row.length; i++) {
    const a = i >= bpp ? row[i - bpp] : 0;
    const b = prev[i];
    const c = i >= bpp ? prev[i - bpp] : 0;
    switch (filter) {
      case 1:
        row[i] = (row[i] + a) & 0xff;
        break;
      case 2:
        row[i] = (row[i] + b) & 0xff;
        break;
      case 3:
        row[i] = (row[i] + ((a + b) >> 1)) & 0xff;
        break;
      case 4: {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        row[i] = (row[i] + pred) & 0xff;
        break;
      }
    }
  }
}

export function px(img, x, y) {
  const d = (y * img.width + x) * 3;
  return [img.data[d], img.data[d + 1], img.data[d + 2]];
}

export const rgb = ([r, g, b]) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** Vertical scan: for each y, the fraction of x in [x0,x1) that differs from
 *  the dominant background color of that column band. Returns bands of ink. */
export function inkProfile(img, x0, x1, y0, y1) {
  const rows = [];
  for (let y = y0; y < y1; y++) {
    let ink = 0;
    for (let x = x0; x < x1; x++) {
      const [r, g, b] = px(img, x, y);
      // ink = clearly not near-white / not near-bg; use luminance distance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 200) ink++;
    }
    rows.push({ y, ink, frac: ink / (x1 - x0) });
  }
  return rows;
}

/** Group consecutive rows with frac >= threshold into bands. */
export function bands(rows, threshold = 0.01, gap = 1) {
  const out = [];
  let start = -1;
  let last = -1;
  for (const r of rows) {
    if (r.frac >= threshold) {
      if (start === -1) start = r.y;
      last = r.y;
    } else if (start !== -1 && r.y - last > gap) {
      out.push({ y0: start, y1: last, h: last - start + 1 });
      start = -1;
    }
  }
  if (start !== -1) out.push({ y0: start, y1: last, h: last - start + 1 });
  return out;
}

/** ASCII render of a region: each char = cellW×cellH block averaged to gray. */
export function ascii(img, x0, y0, x1, y1, cellW = 4, cellH = 8) {
  const chars = ' .:-=+*#%@';
  const lines = [];
  for (let cy = y0; cy < y1; cy += cellH) {
    let line = '';
    for (let cx = x0; cx < x1; cx += cellW) {
      let sum = 0;
      let n = 0;
      for (let y = cy; y < Math.min(cy + cellH, y1); y++) {
        for (let x = cx; x < Math.min(cx + cellW, x1); x++) {
          const [r, g, b] = px(img, x, y);
          sum += 0.299 * r + 0.587 * g + 0.114 * b;
          n++;
        }
      }
      const v = sum / n;
      const idx = Math.min(chars.length - 1, Math.floor(((255 - v) / 256) * chars.length));
      line += chars[idx];
    }
    lines.push(`${String(cy).padStart(4)} ${line}`);
  }
  return lines.join('\n');
}

/** Per-column color boundary detection: scan row y for color changes. */
export function colorRuns(img, y, x0, x1, tol = 8) {
  const runs = [];
  let runStart = x0;
  let runColor = px(img, x0, y);
  for (let x = x0 + 1; x < x1; x++) {
    const c = px(img, x, y);
    if (
      Math.abs(c[0] - runColor[0]) > tol ||
      Math.abs(c[1] - runColor[1]) > tol ||
      Math.abs(c[2] - runColor[2]) > tol
    ) {
      runs.push({ x: runStart, w: x - runStart, color: runColor });
      runStart = x;
      runColor = c;
    }
  }
  runs.push({ x: runStart, w: x1 - runStart, color: runColor });
  return runs.filter((r) => r.w >= 2);
}
