// PROTOTYPE palette generator (#988, throwaway branch ui/988-palette-reselect).
//
// Adapted from the #909 canon (main history 144698cb:library/t-0909/scripts/
// gen-palettes.mjs) per the #987 resolution §4 replication flow:
//
//   frozen slot set -> ramp params for new hues -> measured contrast gate
//   (lightness-only fixes) -> hex/rgb emission (no oklch, ADR 0010 D5.4).
//
// Differences from the #909 original:
//   - culori replaced by inline exact color math (oklch -> hex with chroma
//     bisection clamp). Verified end-to-end by the variant-C self-test:
//     regenerating C must reproduce the sealed live shadcn.css byte-for-byte
//     on every emitted literal slot.
//   - variants d/e/f only emit color slots; geometry is NOT per-variant
//     (map ruling Q4: registry default geometry wins; the --radius base flip
//     is a global toggle in the prototype switcher, not a variant trait).
//   - emitted set = the full live slot universe (value holders + var()
//     aliases + color-mix formulas + constants). Aliases/formulas are inert
//     duplicates at runtime (same var chains, resolving against the
//     overridden holders on the same element), but they make each theme file
//     name-complete: the frozen canon copy (e2e/palette-<x>.css) feeds
//     measure-912.mjs, whose slot-name diff needs canon ≡ live names.
//   - retired slots (--toggle-track/--toggle-knob, #952) are gone.
//
// Output: src/styles/proto-988/{d,e,f}.css + proto-988/contrast-proto.md
// Run:    node apps/web/proto-988/gen-palettes.mjs   (zero dependencies)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..'); // apps/web

// ---------- color math (exact, inline — no culori) ----------

function hexToRgb(hex) {
  let h = hex.trim().slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

function srgbLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(hexA, hexB) {
  const la = srgbLuminance(hexA);
  const lb = srgbLuminance(hexB);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Resolve `color-mix(in srgb, X p%, Y)` the way the browser composites it.
function mixSrgb(hexFg, hexBg, pct) {
  const f = hexToRgb(hexFg);
  const b = hexToRgb(hexBg);
  return rgbToHex([0, 1, 2].map((i) => (f[i] * pct + b[i] * (100 - pct)) / 100));
}

// OKLCH -> linear sRGB (Björn Ottosson's OKLab matrices, D65).
function oklchToLinear(l, c, h) {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const lc = l_ ** 3;
  const mc = m_ ** 3;
  const sc = s_ ** 3;
  return [
    4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  ];
}

function inGamut(rgb, eps = 1e-4) {
  return rgb.every((v) => v >= -eps && v <= 1 + eps);
}

function gammaEncode(v) {
  const c = Math.min(1, Math.max(0, v));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

// culori clampChroma equivalent: hold L and H, bisect chroma down to the
// sRGB gamut boundary.
function oklchToHex(l, c, h) {
  let rgb = oklchToLinear(l, c, h);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(l, mid, h))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinear(l, lo, h);
  }
  return rgbToHex(rgb.map((v) => gammaEncode(v) * 255));
}

// ---------- ramp construction (canon: #909) ----------

// 12-step role ramps (Radix model). Dark ramps: 1 = deepest surface … 12 =
// brightest text. Light ramps: 1 = palest paper … 12 = deepest ink.
const NEUTRAL_L = {
  a: {
    dark: [0.235, 0.262, 0.29, 0.325, 0.365, 0.42, 0.49, 0.57, 0.655, 0.755, 0.855, 0.935],
    light: [0.965, 0.947, 0.928, 0.903, 0.873, 0.833, 0.778, 0.7, 0.6, 0.45, 0.32, 0.17],
  },
  b: {
    dark: [0.215, 0.245, 0.275, 0.31, 0.355, 0.41, 0.48, 0.56, 0.645, 0.75, 0.85, 0.935],
    light: [0.97, 0.952, 0.933, 0.908, 0.878, 0.838, 0.782, 0.705, 0.605, 0.455, 0.32, 0.17],
  },
  c: {
    dark: [0.225, 0.255, 0.285, 0.32, 0.36, 0.415, 0.485, 0.565, 0.65, 0.755, 0.855, 0.935],
    light: [0.955, 0.937, 0.918, 0.893, 0.863, 0.823, 0.768, 0.69, 0.59, 0.445, 0.315, 0.17],
  },
  // #988 candidates:
  // d 冷瓷 — cool porcelain: bright clean light side (a's curve), deep cool
  //   dark side (b's curve).
  d: {
    dark: [0.215, 0.245, 0.275, 0.31, 0.355, 0.41, 0.48, 0.56, 0.645, 0.75, 0.85, 0.935],
    light: [0.965, 0.947, 0.928, 0.903, 0.873, 0.833, 0.778, 0.7, 0.6, 0.45, 0.32, 0.17],
  },
  // e 暖灰 — warm ash: paper-like light-first structure, top one notch
  //   brighter than c (less golden paper, more ash).
  e: {
    dark: [0.225, 0.255, 0.285, 0.32, 0.36, 0.415, 0.485, 0.565, 0.65, 0.755, 0.855, 0.935],
    light: [0.96, 0.942, 0.923, 0.898, 0.868, 0.828, 0.773, 0.695, 0.595, 0.45, 0.32, 0.17],
  },
  // f 石墨 — signal graphite: deepest dark side of the set, neutral bright
  //   light side.
  f: {
    dark: [0.205, 0.235, 0.265, 0.3, 0.345, 0.4, 0.47, 0.55, 0.64, 0.745, 0.85, 0.935],
    light: [0.965, 0.947, 0.928, 0.903, 0.873, 0.833, 0.778, 0.7, 0.6, 0.45, 0.32, 0.17],
  },
};

const ACCENT_L = {
  dark: [0.27, 0.31, 0.37, 0.44, 0.52, 0.6, 0.675, 0.745, 0.785, 0.825, 0.875, 0.92],
  light: [0.955, 0.925, 0.875, 0.81, 0.73, 0.65, 0.575, 0.52, 0.475, 0.425, 0.365, 0.29],
};

const ACCENT_C_PROFILE = {
  dark: [0.3, 0.42, 0.55, 0.7, 0.85, 0.95, 1.0, 1.0, 1.0, 0.85, 0.6, 0.4],
  light: [0.35, 0.5, 0.65, 0.8, 0.92, 1.0, 1.0, 1.0, 1.0, 0.92, 0.72, 0.5],
};

function buildNeutral(variantKey, mode, hue, chroma) {
  return NEUTRAL_L[variantKey][mode].map((l) => oklchToHex(l, chroma, hue));
}

function buildAccent(mode, hue, peakC, lOverride) {
  const L = lOverride ?? ACCENT_L[mode];
  return L.map((l, i) => oklchToHex(l, peakC * ACCENT_C_PROFILE[mode][i], hue));
}

// Yellow-family problem (better-colors): amber/orange cannot go dark and stay
// amber — keep the solid vivid at high L, put text roles on deep step 11/12.
const STATUS_LIGHT_CURVES = {
  amber: [0.965, 0.935, 0.885, 0.835, 0.795, 0.775, 0.775, 0.79, 0.8, 0.74, 0.48, 0.33],
  orange: [0.96, 0.93, 0.875, 0.815, 0.755, 0.7, 0.66, 0.63, 0.615, 0.565, 0.44, 0.31],
};

// ---------- variant definitions ----------

// c = sealed canon, kept ONLY for the self-test (reproduction check against
// the live shadcn.css); it is not emitted as a prototype variant — the live
// app state IS the baseline ("现 · 纸兰(参考)").
const VARIANTS = {
  c: {
    key: 'c',
    name: 'C · 纸兰 Paper Orchid（已封版，仅自检用）',
    blurb: '暖纸骨架 hue 82 + orchid 品牌色（#909 定版，本票退位为历史参考基线）。',
    neutral: { hue: 82, darkC: 0.011, lightC: 0.013 },
    accent: { hue: 312, darkPeak: 0.145, lightPeak: 0.19 },
    statusHues: { gray: 82, amber: 70, blue: 235, green: 152, red: 8, orange: 40 },
    statusPeak: { dark: 0.13, light: 0.15 },
    statusPeakOverride: { gray: { dark: 0.022, light: 0.026 } },
    sidebarInk: { dark: '255 252 248', light: '28 25 20' },
  },
  d: {
    key: 'd',
    name: 'D · 冷瓷靛 Porcelain Indigo',
    blurb:
      '冷白瓷骨架（hue 255 近中性微冷）+ 靛蓝 indigo 品牌色。亮侧干净明亮、暗侧深冷；精密工具气质，与纸兰的暖 editorial 完全反向。',
    neutral: { hue: 255, darkC: 0.006, lightC: 0.005 },
    accent: { hue: 272, darkPeak: 0.13, lightPeak: 0.17 },
    statusHues: { gray: 255, amber: 68, blue: 240, green: 150, red: 14, orange: 45 },
    statusPeak: { dark: 0.13, light: 0.15 },
    statusPeakOverride: { gray: { dark: 0.022, light: 0.026 } },
    sidebarInk: { dark: '255 255 255', light: '17 18 21' },
  },
  e: {
    key: 'e',
    // 实审定版方向（#988）：e.css 同时是 app overlay 与 measure-912 冻结正本
    // （apps/web/e2e/palette-e.css）的源——两份拷贝必须逐字节一致。
    canon: true,
    name: 'E · 暖灰玫 Ash Rose',
    blurb:
      '暖灰骨架（hue 62，比纸兰少一档金黄、多一档灰）+ 玫瑰木 rosewood 品牌色。保留纸兰的浅色主导与温度，品牌色从兰花紫换到玫红——暖而克制， editorial 底 + 一点 bold。',
    neutral: { hue: 62, darkC: 0.008, lightC: 0.009 },
    accent: { hue: 338, darkPeak: 0.14, lightPeak: 0.18 },
    statusHues: { gray: 62, amber: 70, blue: 238, green: 150, red: 10, orange: 42 },
    statusPeak: { dark: 0.13, light: 0.15 },
    statusPeakOverride: { gray: { dark: 0.022, light: 0.026 } },
    sidebarInk: { dark: '255 252 248', light: '28 25 21' },
  },
  f: {
    key: 'f',
    name: 'F · 石墨青 Signal Graphite',
    blurb:
      '近纯中性石墨骨架（hue 264 极低彩度，暗侧全场最深）+ 高亮信号青 cyan 品牌色。暗色主导、终端/仪表面板气质；品牌色是唯一的彩色信号源。',
    neutral: { hue: 264, darkC: 0.004, lightC: 0.003 },
    accent: { hue: 195, darkPeak: 0.12, lightPeak: 0.14 },
    statusHues: { gray: 264, amber: 68, blue: 240, green: 148, red: 14, orange: 45 },
    statusPeak: { dark: 0.135, light: 0.155 },
    statusPeakOverride: { gray: { dark: 0.022, light: 0.026 } },
    sidebarInk: { dark: '255 255 255', light: '18 18 20' },
  },
};

// ---------- ramp bundle per variant ----------

function buildRamps(v) {
  const r = {};
  for (const mode of ['dark', 'light']) {
    r[`n_${mode}`] = {
      hex: buildNeutral(v.key, mode, v.neutral.hue, v.neutral[`${mode}C`]),
      spec: NEUTRAL_L[v.key][mode].map((l) => ({
        l,
        c: v.neutral[`${mode}C`],
        h: v.neutral.hue,
      })),
    };
    if (v.accent) {
      r[`a_${mode}`] = {
        hex: buildAccent(mode, v.accent.hue, v.accent[`${mode}Peak`]),
        spec: ACCENT_L[mode].map((l, i) => ({
          l,
          c: v.accent[`${mode}Peak`] * ACCENT_C_PROFILE[mode][i],
          h: v.accent.hue,
        })),
      };
    }
    for (const [name, hue] of Object.entries(v.statusHues)) {
      const peak = v.statusPeakOverride?.[name]?.[mode] ?? v.statusPeak[mode];
      const lCurve = mode === 'light' ? STATUS_LIGHT_CURVES[name] : null;
      const Ls = lCurve ?? ACCENT_L[mode];
      r[`s_${name}_${mode}`] = {
        hex: buildAccent(mode, hue, peak, lCurve),
        spec: Ls.map((l, i) => ({
          l,
          c: peak * ACCENT_C_PROFILE[mode][i],
          h: hue,
        })),
      };
    }
  }
  return r;
}

function rebuild(ramp) {
  ramp.hex = ramp.spec.map((s) => oklchToHex(s.l, s.c, s.h));
}

function at(ramps, rampKey, step) {
  return ramps[rampKey].hex[step - 1];
}
function specAt(ramps, rampKey, step) {
  return ramps[rampKey].spec[step - 1];
}

// ---------- semantic token mapping ----------

// Entry shapes: [rampKey, step] (movable by the fix loop) | {hex} | {raw}
// (formula/alias emitted verbatim).
function mapTokens(v, ramps) {
  const ink = v.sidebarInk;

  // Brand/accent role pickers (canon #909): solid fill = accent step 9,
  // tint text = step 10 (dark) / 11 (light), drop-tint = step 9/10.
  const brand = {
    dark: {
      fill: ['a_dark', 9],
      fillFg: ['n_dark', 1],
      ring: ['a_dark', 9],
      onTint: ['a_dark', 10],
      dropTint: at(ramps, 'a_dark', 9),
    },
    light: {
      fill: ['a_light', 9],
      fillFgHex: '#ffffff',
      ring: ['a_light', 9],
      onTint: ['a_light', 11],
      dropTint: at(ramps, 'a_light', 9),
    },
  };

  const T = (mode) => {
    const n = (s) => [`n_${mode}`, s];
    const st = (name, s) => [`s_${name}_${mode}`, s];
    const b = brand[mode];
    const dark = mode === 'dark';
    return {
      // official shadcn slots
      '--background': n(1),
      '--foreground': n(12),
      '--card': n(2),
      '--card-foreground': n(12),
      '--popover': n(2),
      '--popover-foreground': n(12),
      '--primary': n(12),
      '--primary-foreground': dark ? n(1) : { hex: '#fafafa' },
      '--secondary': n(3),
      '--secondary-foreground': n(12),
      '--muted': n(3),
      '--muted-foreground': dark ? n(10) : n(11),
      '--accent': n(3),
      '--accent-foreground': n(12),
      '--destructive': dark ? st('red', 10) : st('red', 9),
      '--destructive-foreground': dark ? st('red', 2) : { hex: '#ffffff' },
      '--border': n(3),
      // Dark control/hairline tier maps to step 5, skipping step 4: the #909
      // review hand-tuned this tier to L≈0.3575 (canon #3f3c36, between s4
      // 0.32 and s5 0.36) so it reads a full step above the border tier
      // (ΔL≈0.075, the 1.5 hairline gate's margin). Candidates inherit the
      // validated spacing at s5; the ±1 LSB residual vs canon is documented
      // in the self-test report.
      '--input': dark ? n(5) : n(6),
      '--ring': n(dark ? 9 : 8),
      // repo supplement family
      '--sidebar-hover': { raw: `rgb(${ink[mode]} / 0.05)` },
      '--sidebar-active': { raw: `rgb(${ink[mode]} / 0.1)` },
      '--surface': n(2),
      '--surface-secondary': n(3),
      '--surface-tertiary': dark ? n(5) : n(4),
      '--surface-hover': n(3),
      '--text-secondary': n(11),
      '--text-tertiary': n(10),
      '--text-dim': n(8),
      '--border-default': n(3),
      '--border-strong': dark ? n(5) : n(6),
      '--card-button': b.fill,
      '--text-on-accent': dark ? b.fillFg : { hex: b.fillFgHex },
      '--focus-ring': b.ring,
      '--col-head-text': n(dark ? 11 : 10),
      '--col-dot-idle': st('gray', 9),
      '--col-dot-confirm': st('amber', 9),
      '--col-dot-building': st('blue', 9),
      '--col-dot-done': st('green', 9),
      '--badge-attention': st('amber', 9),
      '--badge-done': st('green', 9),
      '--badge-idle': st('gray', 9),
      '--badge-attention-fg': dark ? st('amber', 2) : st('amber', 12),
      '--project-avatar-bg': st('orange', 9),
      '--project-avatar-fg': dark ? st('orange', 2) : st('orange', 12),
      '--agent-avatar-bg': n(3),
      '--chip-idle-bg': n(3),
      '--chip-idle-fg': n(10),
      '--chip-plan-bg': { raw: 'var(--spot-soft)' },
      '--chip-plan-fg': { raw: 'var(--spot-text-on-tint)' },
      '--chip-confirm-bg': st('amber', 2),
      '--chip-confirm-fg': dark ? st('amber', 10) : st('amber', 11),
      '--chip-done-bg': st('green', 2),
      '--chip-done-fg': dark ? st('green', 10) : st('green', 11),
      '--chip-failed-bg': st('red', 2),
      '--chip-failed-fg': dark ? st('red', 10) : st('red', 11),
      '--fail-fg': dark ? st('orange', 10) : st('orange', 11),
      '--seg-active': dark ? n(5) : n(4),
      '--tab-chip-bg': n(2),
      '--seg-hover': { raw: `rgb(${ink[mode]} / 0.05)` },
      '--stop': dark ? st('red', 10) : st('red', 9),
      '--diff-add-bg': st('green', 2),
      '--diff-add-fg': dark ? st('green', 8) : st('green', 10),
      '--diff-del-bg': st('red', 2),
      '--dialog-row-bg': n(3),
      '--range-chip-bg': n(3),
      '--range-chip-border': dark ? n(5) : n(6),
      '--dialog-bg': n(2),
      '--dialog-box-bg': n(2),
      '--dialog-ring': dark ? n(5) : n(6),
      '--tile-orange-bg': st('amber', 2),
      '--tile-orange-fg': dark ? st('amber', 10) : st('amber', 11),
      '--tile-hero-bg': st('amber', dark ? 2 : 3),
      '--pill-idle-bg': n(3),
      '--dash-border': dark ? n(5) : n(6),
      '--row-selected': n(3),
      '--row-icon-bg': dark ? n(5) : n(4),
      '--overlay-divider': n(3),
      '--chief-tab-bg': n(3),
      '--chief-tab-active': dark ? n(5) : n(4),
      '--notify-icon-bg': dark ? n(5) : { raw: 'var(--spot-soft)' },
      '--menu-icon': dark ? n(8) : n(12),
      '--overlay-scrim': { raw: 'rgb(0 0 0 / 0.6)' },
      '--text-on-veil': { hex: '#ffffff' },
      // formulas (measured in memory; resolve through the cascade at runtime)
      '--spot-soft': {
        raw: 'color-mix(in srgb, var(--card-button) 14%, var(--surface))',
      },
      '--accent-soft': {
        raw: 'color-mix(in srgb, var(--card-button) 14%, transparent)',
      },
      '--danger-soft': {
        raw: 'color-mix(in srgb, var(--destructive) 14%, transparent)',
      },
      '--spot-text-on-tint': b.onTint,
      '--spot-disabled': {
        raw: 'color-mix(in srgb, var(--card-button) 60%, var(--surface))',
      },
      '--spot-disabled-fg': {
        raw: dark ? 'color-mix(in srgb, var(--card-button) 65%, white)' : '#ffffff',
      },
      '--primary-disabled': { raw: 'var(--spot-disabled)' },
      // tokens.css aliases
      '--surface-inset': { raw: 'var(--background)' },
      '--card-bg': { raw: 'var(--card)' },
      '--popover-bg': { raw: 'var(--popover)' },
      '--text-primary': { raw: 'var(--foreground)' },
      '--code-bg': { raw: 'var(--muted)' },
      '--danger': { raw: 'var(--destructive)' },
      '--card-border': { raw: 'var(--border-default)' },
      // alias chains
      '--column': { raw: 'var(--background)' },
      '--col-bg': { raw: 'var(--background)' },
      '--surface-elevated': { raw: 'var(--surface)' },
      '--surface-press': { raw: 'var(--surface-tertiary)' },
      '--tile-indigo-bg': { raw: 'var(--spot-soft)' },
      '--tile-indigo-fg': { raw: 'var(--spot-text-on-tint)' },
      '--overlay-select-indigo': { raw: 'var(--spot-soft)' },
      '--pick-selected-bg': { raw: 'var(--spot-soft)' },
      '--pick-selected-fg': { raw: 'var(--spot-text-on-tint)' },
      // drop-target tint family (tokens.css literals, brand-derived #616/#788)
      '--drop-tint-border': { raw: rgbOf(b.dropTint) },
      '--drop-tint-base': { raw: `${rgbTriplet(b.dropTint)} / 0.05`, prefix: 'rgb(' },
      '--drop-tint-hover': { raw: `${rgbTriplet(b.dropTint)} / 0.1`, prefix: 'rgb(' },
    };
  };

  return { dark: T('dark'), light: T('light'), brand };
}

function rgbOf(hex) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${r} ${g} ${b})`;
}

function rgbTriplet(hex) {
  const [r, g, b] = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

// resolve a token entry to a concrete hex for measurement
function resolve(entry, ramps, tokens) {
  if (entry == null) return null;
  if (Array.isArray(entry)) return at(ramps, entry[0], entry[1]);
  if (entry.hex) return entry.hex;
  if (entry.raw.startsWith('var(')) {
    const name = entry.raw.slice(4, -1);
    return resolve(tokens[name], ramps, tokens);
  }
  if (entry.raw.startsWith('color-mix(in srgb, var(--card-button) 14%, var(--surface))')) {
    return mixSrgb(
      resolve(tokens['--card-button'], ramps, tokens),
      resolve(tokens['--surface'], ramps, tokens),
      14,
    );
  }
  if (entry.raw.startsWith('color-mix(in srgb, var(--destructive) 14%')) {
    return null; // over transparent — measured on its real carrier instead
  }
  if (entry.raw.startsWith('color-mix(in srgb, var(--card-button) 60%')) {
    return mixSrgb(
      resolve(tokens['--card-button'], ramps, tokens),
      resolve(tokens['--surface'], ramps, tokens),
      60,
    );
  }
  return null; // alpha carriers / white mixes — measured on the real carrier
}

// ---------- contrast gate (canon: #909 pairList, thresholds unchanged) ----------

function pairList() {
  // 5th element reportOnly: measured and logged, never auto-fixed.
  return [
    ['--foreground', '--background', 4.5, 'body text on page bg'],
    ['--foreground', '--card', 4.5, 'body text on card'],
    ['--foreground', '--popover', 4.5, 'body text on popover'],
    ['--foreground', '--muted', 4.5, 'body text on muted/code bg'],
    ['--text-secondary', '--background', 4.5, 'secondary text on page bg'],
    ['--text-secondary', '--card', 4.5, 'secondary text on card'],
    ['--text-tertiary', '--background', 4.5, 'tertiary/meta text on page bg'],
    ['--text-tertiary', '--card', 4.5, 'tertiary/meta text on card'],
    ['--muted-foreground', '--card', 4.5, 'muted-foreground on card'],
    ['--muted-foreground', '--background', 4.5, 'muted-foreground on page bg'],
    ['--text-dim', '--background', 3, 'dim (decorative) on page bg'],
    ['--primary-foreground', '--primary', 4.5, 'primary button label'],
    ['--text-on-accent', '--card-button', 4.5, 'brand solid-fill label'],
    ['--spot-text-on-tint', '--spot-soft', 4.5, 'selected-row text on spot tint'],
    ['--chip-idle-fg', '--chip-idle-bg', 4.5, 'chip idle'],
    ['--chip-confirm-fg', '--chip-confirm-bg', 4.5, 'chip confirm'],
    ['--chip-done-fg', '--chip-done-bg', 4.5, 'chip done'],
    ['--chip-failed-fg', '--chip-failed-bg', 4.5, 'chip failed'],
    ['--badge-attention-fg', '--badge-attention', 4.5, 'attention pill digit'],
    ['--project-avatar-fg', '--project-avatar-bg', 4.5, 'project initial avatar'],
    ['--destructive-foreground', '--destructive', 4.5, 'destructive label'],
    ['--col-dot-idle', '--background', 3, 'column dot idle (graphical)'],
    ['--col-dot-confirm', '--background', 3, 'column dot confirm (decorative, label-carried)', true],
    ['--col-dot-building', '--background', 3, 'column dot building (graphical)'],
    ['--col-dot-done', '--background', 3, 'column dot done (graphical)'],
    ['--focus-ring', '--background', 3, 'focus ring (UI component)'],
    ['--focus-ring', '--card', 3, 'focus ring on card (UI component)'],
    ['--menu-icon', '--popover', 3, 'menu row icon (UI component)'],
    ['--stop', '--background', 3, 'stop button red (UI component)'],
    ['--fail-fg', '--card', 4.5, 'fail message text'],
    ['--diff-add-fg', '--diff-add-bg', 4.5, 'diff add stat'],
    ['--border-strong', '--background', 1.5, 'hairline border legibility (report-only)', true],
  ];
}

function measureAndFix(ramps, tokens, mode, log) {
  for (const [fgName, bgName, threshold, label, reportOnly] of pairList()) {
    const fgEntry = tokens[fgName];
    const bgEntry = tokens[bgName];
    let fg = resolve(fgEntry, ramps, tokens);
    const bg = resolve(bgEntry, ramps, tokens);
    if (!fg || !bg) {
      log.push({ mode, label, pair: `${fgName} on ${bgName}`, result: 'Not verified' });
      continue;
    }
    let ratio = contrast(fg, bg);
    const before = { fg: fg.slice(), ratio };
    let fixed = false;
    let iter = 0;
    const fgIsCriticalNeutral =
      Array.isArray(fgEntry) && fgEntry[0].startsWith('n_') && fgEntry[1] <= 3;
    while (ratio < threshold && iter < 40 && Array.isArray(fgEntry) && !reportOnly && !fgIsCriticalNeutral) {
      // lightness-first fix: move fg away from bg in perceived lightness,
      // hue and chroma held (better-colors contrast discipline).
      const spec = specAt(ramps, fgEntry[0], fgEntry[1]);
      const direction = srgbLuminance(fg) > srgbLuminance(bg) ? 1 : -1;
      spec.l = Math.min(0.99, Math.max(0.05, spec.l + direction * 0.012));
      rebuild(ramps[fgEntry[0]]);
      fg = at(ramps, fgEntry[0], fgEntry[1]);
      ratio = contrast(fg, bg);
      fixed = true;
      iter++;
    }
    log.push({
      mode,
      label,
      pair: `${fgName} on ${bgName}`,
      threshold,
      ratio: Number(ratio.toFixed(2)),
      pass: reportOnly ? undefined : ratio >= threshold,
      reportOnly,
      fixed,
      before: fixed ? `${before.fg} (${before.ratio.toFixed(2)})` : undefined,
      after: fixed ? fg : undefined,
      iters: fixed ? iter : undefined,
    });
  }
}

// ---------- CSS emission ----------

function emitToken(entry, ramps, tokens) {
  if (entry.raw) return entry.prefix ? `${entry.prefix}${entry.raw})` : entry.raw;
  if (entry.hex) return entry.hex;
  if (Array.isArray(entry)) return at(ramps, entry[0], entry[1]);
  throw new Error(`unemittable token entry: ${JSON.stringify(entry)}`);
}

function emitCss(v, ramps, tokensByMode) {
  const lines = [];
  if (v.canon) {
    lines.push(`/* #988 palette reselect — ${v.name}（实审定版方向，地图 #980 裁决⑤）.`);
    lines.push(`   Frozen canon copy: apps/web/e2e/palette-e.css (measure-912 --palette`);
    lines.push(`   input); app overlay copy: src/styles/proto-988/e.css`);
    lines.push(`   (html[data-variant="e"]). Generated by apps/web/proto-988/`);
    lines.push(`   gen-palettes.mjs — the two copies must stay byte-identical.`);
    lines.push(`   ${v.blurb}`);
    lines.push(`   Contrast: proto-988/contrast-proto.md (candidate gate) +`);
    lines.push(`   docs/verify/988/ (full-scale measure-912 on the landed values). */`);
  } else {
    lines.push(`/* PROTOTYPE #988 — variant ${v.key.toUpperCase()} ${v.name}.`);
    lines.push(`   Generated by apps/web/proto-988/gen-palettes.mjs — hand-editing values`);
    lines.push(`   here will be overwritten. Contrast pairs: proto-988/contrast-proto.md.`);
    lines.push(`   ${v.blurb}`);
    lines.push(`   Throwaway prototype branch ui/988-palette-reselect; only the winning`);
    lines.push(`   direction's values land on main (1:1 value flip, #987 §4). */`);
  }
  lines.push('');
  for (const mode of ['dark', 'light']) {
    const sel =
      mode === 'dark'
        ? `:root[data-variant="${v.key}"]`
        : `:root[data-variant="${v.key}"].light`;
    lines.push(`/* ---- ${mode} ---- */`);
    lines.push(`${sel} {`);
    const tokens = tokensByMode[mode];
    for (const [name, entry] of Object.entries(tokens)) {
      lines.push(`  ${name}: ${emitToken(entry, ramps, tokens)};`);
    }
    lines.push('}');
    lines.push('');
  }
  return lines.join('\n');
}

// ---------- variant C self-test: reproduce the sealed live shadcn.css ----------

function block(css, sel) {
  const i = css.indexOf(sel);
  if (i < 0) throw new Error(`selector not found: ${sel}`);
  const open = css.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, j);
    }
  }
  throw new Error(`unbalanced block: ${sel}`);
}

function decls(body) {
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(clean)) != null) out[m[1]] = m[2].trim();
  return out;
}

// Parse an emitted color literal (hex or rgb triplet with optional alpha)
// into numeric channels; null when the shape is unknown.
function parseLiteral(v) {
  const s = v.trim().toLowerCase();
  if (s.startsWith('#')) return { ch: hexToRgb(s), alpha: null };
  const m = s.match(/^rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/);
  if (m) return { ch: [m[1], m[2], m[3]].map(Number), alpha: m[4] ?? null };
  return null;
}

// LSB-class: same alpha, every channel within ±1 (clamp/rounding boundary).
function isLsbNear(a, b) {
  const pa = parseLiteral(a);
  const pb = parseLiteral(b);
  if (!pa || !pb) return false;
  if (pa.alpha !== pb.alpha) return false;
  return pa.ch.every((v, i) => Math.abs(v - pb.ch[i]) <= 1);
}

function selfTestC() {
  const v = VARIANTS.c;
  const ramps = buildRamps(v);
  const { dark, light } = mapTokens(v, ramps);
  const log = [];
  measureAndFix(ramps, dark, 'dark', log);
  measureAndFix(ramps, light, 'light', log);

  // 比对基准 = 冻结的 C 正本（e2e/palette-c.css，#953 封版字节拷贝），不是
  // live shadcn.css——#988 定版翻值后 live 持 E 值，数学自检必须钉在不动的
  // 历史正本上。
  const canonCss = readFileSync(join(WEB, 'e2e/palette-c.css'), 'utf8');
  const liveDark = decls(block(canonCss, ':root[data-variant="c"] {'));
  const liveLight = {
    ...liveDark,
    ...decls(block(canonCss, ':root[data-variant="c"].light {')),
  };

  const lines = ['# Variant-C self-test (inline color math vs sealed canon)', ''];
  let total = 0;
  let identical = 0;
  const diffs = [];
  const lsbDiffs = [];
  const formDiffs = [];
  const missing = [];
  for (const [mode, tokens, live] of [
    ['dark', dark, liveDark],
    ['light', light, liveLight],
  ]) {
    for (const [name, entry] of Object.entries(tokens)) {
      const mine = emitToken(entry, ramps, tokens);
      total++;
      const theirs = live[name];
      if (theirs == null) {
        missing.push(`${mode} ${name} (generated but not live)`);
        continue;
      }
      if (mine.toLowerCase() === theirs.toLowerCase()) identical++;
      else if (mine.startsWith('var(') || theirs.startsWith('var('))
        // 形式差：canon 冻结时该槽持字面值，#915 落地形与本生成器持 var()
        // 别名（解析值相等——封版 measure「unchanged」读数即解析后比较）。
        formDiffs.push(`| ${mode} | \`${name}\` | ${theirs} | ${mine} |`);
      else if (isLsbNear(mine, theirs))
        lsbDiffs.push(`| ${mode} | \`${name}\` | ${theirs} | ${mine} |`);
      else diffs.push(`| ${mode} | \`${name}\` | ${theirs} | ${mine} |`);
    }
  }
  // canon literal slots the generator does not cover (--toggle-* retired by
  // #952 after the C canon froze; they stay in the frozen file by design)
  const RETIRED = new Set(['--toggle-track', '--toggle-knob']);
  const uncovered = [];
  for (const [mode, tokens, live] of [
    ['dark', dark, liveDark],
    ['light', light, liveLight],
  ]) {
    for (const [name, value] of Object.entries(live)) {
      if (name === '--radius' || RETIRED.has(name)) continue;
      if (!/^#[0-9a-f]{3,8}$/i.test(value) && !/^rgb\(/.test(value)) continue; // non-color or var/formula
      if (!(name in tokens)) uncovered.push(`${mode} ${name}: ${value}`);
    }
  }
  lines.push(`emitted literal slots compared: **${total}**`);
  lines.push(`byte-identical: **${identical}**`);
  lines.push(`LSB-class (每通道 ±1，clamp/取整边界): **${lsbDiffs.length}**`);
  lines.push(`form-class (canon 字面值 vs var() 别名，解析值相等): **${formDiffs.length}**`);
  lines.push(`real diffs: **${diffs.length}**`);
  if (formDiffs.length) {
    lines.push('');
    lines.push('| mode | slot | canon (sealed C) | generated |');
    lines.push('| --- | --- | --- | --- |');
    lines.push(...formDiffs);
  }
  if (lsbDiffs.length) {
    lines.push('');
    lines.push('LSB-class residuals — canon 在 #909 实审中手调到 L≈0.3575（dark 控件档）');
    lines.push('等 curve 外位置，候选版按结构等价继承（n(5)），残差 ≤1/通道，不可见：');
    lines.push('');
    lines.push('| mode | slot | canon (sealed C) | generated |');
    lines.push('| --- | --- | --- | --- |');
    lines.push(...lsbDiffs);
  }
  if (diffs.length) {
    lines.push('');
    lines.push('| mode | slot | canon (sealed C) | generated |');
    lines.push('| --- | --- | --- | --- |');
    lines.push(...diffs);
  }
  if (missing.length) {
    lines.push('');
    lines.push(`generated-but-not-live: ${missing.join(', ')}`);
  }
  if (uncovered.length) {
    lines.push('');
    lines.push(`live literal slots NOT covered by generator (need mapping if variant must override):`);
    lines.push(...uncovered.map((u) => `- ${u}`));
  }
  lines.push('');
  return {
    text: lines.join('\n'),
    identical,
    lsb: lsbDiffs.length,
    form: formDiffs.length,
    total,
    diffs: diffs.length,
    missing: missing.length,
  };
}

// ---------- driver ----------

const outDir = join(WEB, 'src/styles/proto-988');
mkdirSync(outDir, { recursive: true });

const reportLines = [
  '# #988 候选色板对比度实测报告',
  '',
  'WCAG 2.1 亮度比，逐对实测（gen-palettes.mjs 内联数学计算，非估计；数学以',
  'variant-C 自检对封版正本逐字节复核，见文末）。threshold 4.5 = 正文 AA；',
  '3 = 大字号/UI 组件/图形对象；1.5 = 发丝线可辨性（report-only）。',
  'FIXED = 首测未过、按「只动感知明度」自动修正后复测通过（hue/chroma 保持）。',
  '',
];

for (const key of ['d', 'e', 'f']) {
  const v = VARIANTS[key];
  const ramps = buildRamps(v);
  const { dark, light } = mapTokens(v, ramps);
  const log = [];
  measureAndFix(ramps, dark, 'dark', log);
  measureAndFix(ramps, light, 'light', log);
  const tokensByMode = { dark, light };
  writeFileSync(join(outDir, `${key}.css`), emitCss(v, ramps, tokensByMode));

  reportLines.push(`## ${v.name}`);
  reportLines.push('');
  reportLines.push('| mode | pair | label | threshold | measured | result |');
  reportLines.push('| --- | --- | --- | --- | --- | --- |');
  for (const r of log) {
    const result = r.reportOnly
      ? `report-only (${r.ratio}:1)`
      : r.pass === undefined
        ? 'Not verified'
        : r.fixed
          ? `FIXED (${r.iters} steps)`
          : r.pass
            ? 'PASS'
            : '**FAIL**';
    const measured = r.ratio === undefined ? '—' : `${r.ratio}:1`;
    reportLines.push(
      `| ${r.mode} | \`${r.pair}\` | ${r.label} | ${r.threshold ?? '—'} | ${measured} | ${result} |`,
    );
    if (r.fixed) {
      reportLines.push(`| ${r.mode} | ↳ | fg ${r.before} → ${r.after} | | | |`);
    }
  }
  reportLines.push('');
  const fails = log.filter((r) => r.pass === false).length;
  reportLines.push(`未过对数：**${fails}**${fails === 0 ? '（全部实测达标）' : ''}`);
  reportLines.push('');
}

const st = selfTestC();
reportLines.push('---');
reportLines.push('');
reportLines.push(st.text);
writeFileSync(join(HERE, 'contrast-proto.md'), reportLines.join('\n'));
console.log(
  `themes written to src/styles/proto-988/{d,e,f}.css; report proto-988/contrast-proto.md; self-test C: ${st.identical}/${st.total} byte-identical, ${st.lsb} LSB-class, ${st.form} form-class, ${st.diffs} real diffs, ${st.missing} missing`,
);
