// PROTOTYPE palette generator (#909, throwaway sandbox — not workspace code).
//
// Builds three candidate visual directions as full semantic token sets
// (dark + light), each from role-driven oklch ramps per better-colors:
//   A 石墨 Graphite   — near-neutral skeleton, achromatic brand (no hue
//                       accent; only the five status hues carry color),
//                       sharp geometry. Keeps the current luminance
//                       structure of the dark skeleton (ticket allows it).
//   B 青墨 Teal Ink   — cool graphite skeleton, teal accent, balanced geometry.
//   C 纸兰 Paper Orchid — warm paper skeleton (light-first), orchid accent,
//                       soft geometry.
//
// Every reported contrast pair is measured with the WCAG 2.1 luminance ratio
// (computed here, exact — nothing estimated). Failing pairs are fixed by
// moving perceived lightness only (hue/chroma held), then remeasured.
// color-mix() declarations are resolved by hand-mixing sRGB channels, so
// the measured value is the rendered value.
//
// Output: src/themes/{a,b,c}.css + reports/contrast.md
//
// Run: node scripts/gen-palettes.mjs   (needs culori from the sandbox install)

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clampChroma, formatHex, parse } from 'culori';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- color math (exact) ----------

function hexToRgb(hex) {
  const c = parse(hex);
  return [c.r, c.g, c.b].map((v) => Math.round(v * 255));
}

function rgbToCss([r, g, b]) {
  return `rgb(${r} ${g} ${b})`;
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
// culori's rgb channels are [0,1] — the weighted 0-255 sum divides by 100
// (pct) and by 255 (channel scale).
function mixSrgb(hexFg, hexBg, pct) {
  const f = hexToRgb(hexFg);
  const b = hexToRgb(hexBg);
  return formatHex({
    mode: 'rgb',
    r: (f[0] * pct + b[0] * (100 - pct)) / 100 / 255,
    g: (f[1] * pct + b[1] * (100 - pct)) / 100 / 255,
    b: (f[2] * pct + b[2] * (100 - pct)) / 100 / 255,
  });
}

function oklchToHex(l, c, h) {
  return formatHex(clampChroma({ mode: 'oklch', l, c, h }, 'oklch'));
}

// ---------- ramp construction ----------

// 12-step role ramps (Radix model). Dark ramps: 1 = deepest surface … 12 =
// brightest text. Light ramps: 1 = palest paper … 12 = deepest ink.
// L curves below are the perceived-lightness skeleton; chroma rides a
// fraction profile so vividness peaks mid-ramp and falls off at both ends,
// and clampChroma caps each step at what the hue can actually carry in
// sRGB (saturation proportional to the hue's own maximum, per hue).

const NEUTRAL_L = {
  a: {
    // keeps the current dark skeleton's luminance structure (bg 0.235 ≈
    // #17171a, card ≈ #1e1e22, secondary ≈ #26262b)
    dark: [0.235, 0.262, 0.29, 0.325, 0.365, 0.42, 0.49, 0.57, 0.655, 0.755, 0.855, 0.935],
    light: [0.965, 0.947, 0.928, 0.903, 0.873, 0.833, 0.778, 0.7, 0.6, 0.45, 0.32, 0.17],
  },
  b: {
    dark: [0.215, 0.245, 0.275, 0.31, 0.355, 0.41, 0.48, 0.56, 0.645, 0.75, 0.85, 0.935],
    light: [0.97, 0.952, 0.933, 0.908, 0.878, 0.838, 0.782, 0.705, 0.605, 0.455, 0.32, 0.17],
  },
  c: {
    dark: [0.225, 0.255, 0.285, 0.32, 0.36, 0.415, 0.485, 0.565, 0.65, 0.755, 0.855, 0.935],
    // paper: one notch warmer/darker than near-white at the top
    light: [0.955, 0.937, 0.918, 0.893, 0.863, 0.823, 0.768, 0.69, 0.59, 0.445, 0.315, 0.17],
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
// amber — the shared light L curve turns step 9 mustard-brown. Radix's shape:
// keep the solid vivid at high L (dots/badges are decorative reinforcement;
// the text label carries the state), and put text roles on deep step 11/12.
const STATUS_LIGHT_CURVES = {
  amber: [0.965, 0.935, 0.885, 0.835, 0.795, 0.775, 0.775, 0.79, 0.8, 0.74, 0.48, 0.33],
  orange: [0.96, 0.93, 0.875, 0.815, 0.755, 0.7, 0.66, 0.63, 0.615, 0.565, 0.44, 0.31],
};

// ---------- variant definitions ----------

const VARIANTS = {
  a: {
    key: 'a',
    name: 'A · 石墨 Graphite',
    blurb: '无彩色品牌——黑白骨架承全部明度结构，只有五个状态色携带色相。锐利几何：4px 圆角、发丝线承重、零扩散投影、mono 微标签、高密度。',
    neutral: { hue: 260, darkC: 0.005, lightC: 0.004 },
    accent: null, // achromatic brand: accent roles fall back to neutral steps
    statusHues: { gray: 250, amber: 68, blue: 255, green: 150, red: 20, orange: 45 },
    statusPeak: { dark: 0.13, light: 0.15 },
    statusPeakOverride: { gray: { dark: 0.022, light: 0.026 } },
    geometry: {
      '--radius': '0.25rem',
      '--edge-radius': '4px',
      '--radius-popover': '4px',
      '--card-shadow-dark': 'none',
      '--card-shadow-light': '0 1px 2px rgb(0 0 0 / 0.05)',
      '--edge-shadow-dark': 'none',
      '--edge-shadow-light': '0 2px 6px rgb(0 0 0 / 0.08)',
      '--plate-shadow-dark': 'none',
      '--plate-shadow-light': '3px 3px 0 rgb(0 0 0 / 0.1)',
      '--dialog-shadow-dark': '0 2px 8px rgb(0 0 0 / 0.5)',
      '--dialog-shadow-light': '0 2px 8px rgb(0 0 0 / 0.14)',
      '--pad-card': '10px',
      '--pad-page': '20px',
      '--row-h': '34px',
      '--font-label': 'var(--font-mono)',
      '--label-size': '10.5px',
      '--label-transform': 'uppercase',
      '--label-spacing': '0.06em',
      '--title-weight': '550',
      '--title-tracking': '-0.01em',
    },
    sidebarInk: { dark: '255 255 255', light: '18 18 20' },
  },
  b: {
    key: 'b',
    name: 'B · 青墨 Teal Ink',
    blurb: '冷石墨骨架（中性灰带一线青调）+ teal 品牌色。均衡几何：8px 圆角、克制的卡级微影、中密度——Linear 谱系的演进态。',
    neutral: { hue: 228, darkC: 0.009, lightC: 0.007 },
    accent: { hue: 192, darkPeak: 0.125, lightPeak: 0.15 },
    statusHues: { gray: 228, amber: 65, blue: 240, green: 148, red: 12, orange: 45 },
    statusPeak: { dark: 0.135, light: 0.155 },
    statusPeakOverride: { gray: { dark: 0.022, light: 0.026 } },
    geometry: {
      '--radius': '0.5rem',
      '--edge-radius': '8px',
      '--radius-popover': '8px',
      '--card-shadow-dark': '0 2px 4px rgb(0 0 0 / 0.2)',
      '--card-shadow-light': '0 2px 4px rgb(28 25 23 / 0.07)',
      '--edge-shadow-dark': '0 5px 14px rgb(0 0 0 / 0.4)',
      '--edge-shadow-light': '0 5px 14px rgb(28 25 23 / 0.14)',
      '--plate-shadow-dark': 'none',
      '--plate-shadow-light': '4px 4px 0 rgb(0 0 0 / 0.1)',
      '--dialog-shadow-dark': '0 5px 14px rgb(0 0 0 / 0.4)',
      '--dialog-shadow-light': '0 5px 14px rgb(0 0 0 / 0.18)',
      '--pad-card': '12px',
      '--pad-page': '24px',
      '--row-h': '36px',
      '--font-label': 'var(--font-sans)',
      '--label-size': '12px',
      '--label-transform': 'none',
      '--label-spacing': '0',
      '--title-weight': '600',
      '--title-tracking': '-0.015em',
    },
    sidebarInk: { dark: '255 255 255', light: '16 20 24' },
  },
  c: {
    key: 'c',
    name: 'C · 纸兰 Paper Orchid',
    blurb: '暖纸骨架（浅色主导、暗色同源暖灰）+ orchid 洋兰品牌色。柔和几何：14px 圆角、分层软投影、宽松留白——editorial/craft 气质。',
    neutral: { hue: 82, darkC: 0.011, lightC: 0.013 },
    accent: { hue: 312, darkPeak: 0.145, lightPeak: 0.19 },
    statusHues: { gray: 82, amber: 70, blue: 235, green: 152, red: 8, orange: 40 },
    statusPeak: { dark: 0.13, light: 0.15 },
    statusPeakOverride: { gray: { dark: 0.022, light: 0.026 } },
    geometry: {
      '--radius': '0.875rem',
      '--edge-radius': '14px',
      '--radius-popover': '12px',
      '--card-shadow-dark': '0 2px 6px rgb(0 0 0 / 0.24)',
      '--card-shadow-light': '0 2px 8px rgb(28 25 23 / 0.08)',
      '--edge-shadow-dark': '0 8px 24px rgb(0 0 0 / 0.4)',
      '--edge-shadow-light': '0 8px 24px rgb(28 25 23 / 0.14)',
      '--plate-shadow-dark': 'none',
      '--plate-shadow-light': '0 6px 16px rgb(0 0 0 / 0.12)',
      '--dialog-shadow-dark': '0 12px 32px rgb(0 0 0 / 0.45)',
      '--dialog-shadow-light': '0 12px 32px rgb(28 25 23 / 0.18)',
      '--pad-card': '16px',
      '--pad-page': '28px',
      '--row-h': '40px',
      '--font-label': 'var(--font-sans)',
      '--label-size': '12px',
      '--label-transform': 'none',
      '--label-spacing': '0.01em',
      '--title-weight': '590',
      '--title-tracking': '-0.02em',
    },
    sidebarInk: { dark: '255 252 248', light: '28 25 20' },
  },
};

// ---------- ramp bundle per variant ----------

function buildRamps(v) {
  const r = {};
  for (const mode of ['dark', 'light']) {
    r[`n_${mode}`] = {
      hex: buildNeutral(v.key, mode, v.neutral.hue, v.neutral[`${mode}C`]),
      // step specs kept mutable for the auto-fix loop
      spec: NEUTRAL_L[v.key][mode].map((l) => ({
        l,
        c: v.neutral[`${mode}C`],
        h: v.neutral.hue,
      })),
      kind: 'neutral',
      mode,
    };
    if (v.accent) {
      r[`a_${mode}`] = {
        hex: buildAccent(mode, v.accent.hue, v.accent[`${mode}Peak`]),
        spec: ACCENT_L[mode].map((l, i) => ({
          l,
          c: v.accent[`${mode}Peak`] * ACCENT_C_PROFILE[mode][i],
          h: v.accent.hue,
        })),
        kind: 'accent',
        mode,
      };
    }
    for (const [name, hue] of Object.entries(v.statusHues)) {
      // the idle "gray" status is a near-neutral: a hint of the skeleton hue,
      // not a saturated ramp — it must read apart from the building blue dot
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
        kind: 'status',
        mode,
      };
    }
  }
  return r;
}

function rebuild(ramp) {
  ramp.hex = ramp.spec.map((s) => oklchToHex(s.l, s.c, s.h));
}

// step accessor: at(ramps, 'n_dark', 11) → 1-based step
function at(ramps, rampKey, step) {
  return ramps[rampKey].hex[step - 1];
}
function specAt(ramps, rampKey, step) {
  return ramps[rampKey].spec[step - 1];
}

// ---------- semantic token mapping ----------

// Each semantic token is emitted either as a ramp-step reference (so the
// auto-fix loop can move it) or as a literal/formula string.
function mapTokens(v, ramps) {
  const achromatic = !v.accent;
  const ink = v.sidebarInk;

  // Brand/accent role pickers. A (achromatic): solid fill = bright neutral
  // (dark) / deep neutral (light); tint text = high-contrast neutral.
  const brand = {
    dark: {
      fill: achromatic ? ['n_dark', 12] : ['a_dark', 9],
      fillFg: ['n_dark', 1],
      ring: achromatic ? ['n_dark', 12] : ['a_dark', 9],
      onTint: achromatic ? ['n_dark', 12] : ['a_dark', 10],
      dropTint: achromatic ? at(ramps, 'n_dark', 11) : at(ramps, 'a_dark', 9),
    },
    light: {
      fill: achromatic ? ['n_light', 12] : ['a_light', 9],
      fillFgHex: '#ffffff',
      ring: achromatic ? ['n_light', 12] : ['a_light', 9],
      onTint: achromatic ? ['n_light', 12] : ['a_light', 11],
      dropTint: achromatic ? at(ramps, 'n_light', 10) : at(ramps, 'a_light', 9),
    },
  };

  const T = (mode) => {
    const n = (s) => ['n_' + mode, s];
    const st = (name, s) => ['s_' + name + '_' + mode, s];
    const b = brand[mode];
    const dark = mode === 'dark';
    const t = {
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
      '--input': dark ? n(4) : n(6),
      '--ring': n(dark ? 9 : 8),
      // repo supplement family
      '--column': n(1),
      '--col-bg': n(1),
      '--col-head-text': n(dark ? 11 : 10),
      '--sidebar-hover': { raw: `rgb(${ink[mode]} / 0.05)` },
      '--sidebar-active': { raw: `rgb(${ink[mode]} / 0.1)` },
      '--surface': n(2),
      '--surface-secondary': n(3),
      '--surface-tertiary': dark ? n(4) : n(4),
      '--surface-elevated': n(2),
      '--surface-hover': n(3),
      '--surface-press': n(4),
      '--text-secondary': n(dark ? 11 : 11),
      '--text-tertiary': n(10),
      '--text-dim': n(dark ? 8 : 8),
      '--border-default': n(3),
      '--border-strong': dark ? n(4) : n(6),
      '--card-button': b.fill,
      '--text-on-accent': dark ? b.fillFg : { hex: b.fillFgHex },
      '--focus-ring': b.ring,
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
      '--chip-idle-fg': dark ? n(10) : n(10),
      '--chip-plan-bg': { raw: 'var(--spot-soft)' },
      '--chip-plan-fg': { raw: 'var(--spot-text-on-tint)' },
      '--chip-confirm-bg': st('amber', 2),
      '--chip-confirm-fg': dark ? st('amber', 10) : st('amber', 11),
      '--chip-done-bg': st('green', 2),
      '--chip-done-fg': dark ? st('green', 10) : st('green', 11),
      '--chip-failed-bg': st('red', 2),
      '--chip-failed-fg': dark ? st('red', 10) : st('red', 11),
      '--fail-fg': dark ? st('orange', 10) : st('orange', 11),
      '--seg-active': n(4),
      '--tab-chip-bg': n(2),
      '--seg-hover': { raw: `rgb(${ink[mode]} / 0.05)` },
      '--stop': dark ? st('red', 10) : st('red', 9),
      '--diff-add-bg': st('green', 2),
      '--diff-add-fg': dark ? st('green', 8) : st('green', 10),
      '--diff-del-bg': st('red', 2),
      '--dialog-row-bg': n(3),
      '--range-chip-bg': n(3),
      '--range-chip-border': dark ? n(4) : n(6),
      '--dialog-bg': n(2),
      '--dialog-box-bg': n(2),
      '--toggle-track': dark ? n(4) : n(6),
      '--dialog-ring': dark ? n(4) : n(6),
      '--tile-orange-bg': st('amber', 2),
      '--tile-orange-fg': dark ? st('amber', 10) : st('amber', 11),
      '--tile-indigo-bg': { raw: 'var(--spot-soft)' },
      '--tile-indigo-fg': { raw: 'var(--spot-text-on-tint)' },
      '--tile-hero-bg': st('amber', dark ? 2 : 3),
      '--pill-idle-bg': n(3),
      '--dash-border': dark ? n(4) : n(6),
      '--row-selected': n(3),
      '--row-icon-bg': n(4),
      '--overlay-divider': n(3),
      '--overlay-select-indigo': { raw: 'var(--spot-soft)' },
      '--pick-selected-bg': { raw: 'var(--spot-soft)' },
      '--pick-selected-fg': { raw: 'var(--spot-text-on-tint)' },
      '--chief-tab-bg': n(3),
      '--chief-tab-active': n(4),
      '--notify-icon-bg': dark ? n(4) : { raw: 'var(--spot-soft)' },
      '--menu-icon': dark ? n(8) : n(12),
      '--toggle-knob': { hex: '#ffffff' },
      '--overlay-scrim': { raw: 'rgb(0 0 0 / 0.6)' },
      '--text-on-veil': { hex: '#ffffff' },
      // formulas (verbatim from the #787 slot architecture — sources flip
      // with --card-button / --destructive, so they follow any palette)
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
        raw: dark
          ? 'color-mix(in srgb, var(--card-button) 65%, white)'
          : '#ffffff',
      },
      '--primary-disabled': { raw: 'var(--spot-disabled)' },
      // tokens.css aliases (generic names → canonical roles)
      '--surface-inset': { raw: 'var(--background)' },
      '--card-bg': { raw: 'var(--card)' },
      '--popover-bg': { raw: 'var(--popover)' },
      '--text-primary': { raw: 'var(--foreground)' },
      '--code-bg': { raw: 'var(--muted)' },
      '--danger': { raw: 'var(--destructive)' },
      '--card-border': { raw: 'var(--border-default)' },
      // drop-target tint family follows the brand hue (#616/#788 shape)
      '--drop-tint-border': { raw: rgbOf(b.dropTint) },
      '--drop-tint-base': { raw: `${rgbTriplet(b.dropTint)} / 0.05)`, prefix: 'rgb(' },
      '--drop-tint-hover': { raw: `${rgbTriplet(b.dropTint)} / 0.1)`, prefix: 'rgb(' },
    };
    return t;
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
  if (Array.isArray(entry)) return at(ramps, entry[0], entry[1]);
  if (entry.hex) return entry.hex;
  if (entry.raw.startsWith('var(')) {
    const name = entry.raw.slice(4, -1);
    return resolve(tokens[name], ramps, tokens);
  }
  if (entry.raw.startsWith('color-mix(in srgb, var(--card-button) 14%, var(--surface))')) {
    return mixSrgb(resolve(tokens['--card-button'], ramps, tokens), resolve(tokens['--surface'], ramps, tokens), 14);
  }
  if (entry.raw.startsWith('color-mix(in srgb, var(--destructive) 14%')) {
    return null; // over transparent — measured on its real carrier instead
  }
  if (entry.raw.startsWith('color-mix(in srgb, var(--card-button) 60%')) {
    return mixSrgb(resolve(tokens['--card-button'], ramps, tokens), resolve(tokens['--surface'], ramps, tokens), 60);
  }
  if (entry.raw.startsWith('rgb(')) return null; // alpha value — measured on carrier
  return null;
}

// ---------- contrast gate ----------

// Pairs: [fgToken, bgToken, threshold, label]. Thresholds: WCAG 2.1 AA —
// 4.5 body text, 3 large text / UI components & graphical objects.
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
    ['--border-strong', '--background', 1.5, 'hairline border legibility (report-only)'],
  ];
}

function measureAndFix(v, ramps, tokens, mode, log) {
  for (const [fgName, bgName, threshold, label, reportOnly] of pairList()) {
    const fgEntry = tokens[fgName];
    const bgEntry = tokens[bgName];
    let fg = resolve(fgEntry, ramps, tokens);
    let bg = resolve(bgEntry, ramps, tokens);
    if (!fg || !bg) {
      log.push({ mode, label, pair: `${fgName} on ${bgName}`, result: 'Not verified (alpha/formula carrier)' });
      continue;
    }
    let ratio = contrast(fg, bg);
    const before = { fg: fg.slice(), ratio: ratio };
    let fixed = false;
    let iter = 0;
    const fgIsCriticalNeutral =
      Array.isArray(fgEntry) && fgEntry[0].startsWith('n_') && fgEntry[1] <= 3;
    while (
      ratio < threshold &&
      iter < 40 &&
      Array.isArray(fgEntry) &&
      !reportOnly &&
      !fgIsCriticalNeutral
    ) {
      // lightness-first fix: move fg away from bg in perceived lightness,
      // hue and chroma held (contrast.md). Polarity: if fg is already
      // lighter than bg, raise L; else lower it.
      const ref = Array.isArray(fgEntry) ? fgEntry : null;
      if (!ref) break;
      const spec = specAt(ramps, ref[0], ref[1]);
      const fgL = spec.l;
      const bgL = parse(bg); // fallback direction from measured luminance
      const direction = srgbLuminance(fg) > srgbLuminance(bg) ? 1 : -1;
      spec.l = Math.min(0.99, Math.max(0.05, fgL + direction * 0.012));
      rebuild(ramps[ref[0]]);
      fg = at(ramps, ref[0], ref[1]);
      ratio = contrast(fg, bg);
      fixed = true;
      iter++;
      void bgL;
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
  if (entry.raw) return entry.prefix ? entry.prefix + entry.raw : entry.raw;
  if (entry.hex) return entry.hex;
  if (Array.isArray(entry)) return at(ramps, entry[0], entry[1]);
  throw new Error(`unemittable token entry: ${JSON.stringify(entry)}`);
}

function emitCss(v, ramps, tokensByMode) {
  const g = v.geometry;
  const lines = [];
  lines.push(`/* PROTOTYPE theme — variant ${v.key.toUpperCase()} ${v.name} (#909).`);
  lines.push(`   Generated by scripts/gen-palettes.mjs; hand-editing values here`);
  lines.push(`   will be overwritten. Contrast pairs: reports/contrast.md.`);
  lines.push(`   ${v.blurb} */`);
  lines.push('');
  for (const mode of ['dark', 'light']) {
    const sel =
      mode === 'dark'
        ? `:root[data-variant="${v.key}"]`
        : `:root[data-variant="${v.key}"].light`;
    lines.push(`/* ---- ${mode} ---- */`);
    lines.push(`${sel} {`);
    if (mode === 'dark') {
      lines.push(`  /* geometry (variant-specific, hand-authored) */`);
      for (const [k, val] of Object.entries(g)) {
        if (k.endsWith('-dark') || k.endsWith('-light')) continue;
        lines.push(`  ${k}: ${val};`);
      }
      lines.push(`  --card-shadow: ${g['--card-shadow-dark']};`);
      lines.push(`  --edge-shadow: ${g['--edge-shadow-dark']};`);
      lines.push(`  --plate-shadow: ${g['--plate-shadow-dark']};`);
      lines.push(`  --dialog-shadow: ${g['--dialog-shadow-dark']};`);
    } else {
      lines.push(`  --card-shadow: ${g['--card-shadow-light']};`);
      lines.push(`  --edge-shadow: ${g['--edge-shadow-light']};`);
      lines.push(`  --plate-shadow: ${g['--plate-shadow-light']};`);
      lines.push(`  --dialog-shadow: ${g['--dialog-shadow-light']};`);
    }
    lines.push(`  /* color tokens */`);
    const tokens = tokensByMode[mode];
    for (const [name, entry] of Object.entries(tokens)) {
      lines.push(`  ${name}: ${emitToken(entry, ramps, tokens)};`);
    }
    lines.push('}');
    lines.push('');
  }
  return lines.join('\n');
}

// ---------- driver ----------

mkdirSync(join(ROOT, 'src/themes'), { recursive: true });
mkdirSync(join(ROOT, 'reports'), { recursive: true });

const reportLines = [
  '# 候选色板对比度实测报告（#909）',
  '',
  'WCAG 2.1 亮度比，逐对实测（gen-palettes.mjs 计算，非估计）。',
  'threshold 4.5 = 正文 AA；3 = 大字号/UI 组件/图形对象；1.5 = 发丝线可辨性（report-only）。',
  'FIXED = 首测未过、按「只动明度」自动修正后复测通过。',
  '',
];

for (const v of Object.values(VARIANTS)) {
  const ramps = buildRamps(v);
  const { dark, light } = mapTokens(v, ramps);
  const log = [];
  // measure dark, then light (fixes mutate shared ramp specs)
  measureAndFix(v, ramps, dark, 'dark', log);
  measureAndFix(v, ramps, light, 'light', log);
  // re-measure dark after light-mode fixes touched shared ramps? Ramps are
  // per-mode (n_dark vs n_light), so no cross-mode mutation. Status ramps
  // are per-mode too. Safe.
  const tokensByMode = { dark, light };
  writeFileSync(join(ROOT, `src/themes/${v.key}.css`), emitCss(v, ramps, tokensByMode));

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
    reportLines.push(`| ${r.mode} | \`${r.pair}\` | ${r.label} | ${r.threshold ?? '—'} | ${measured} | ${result} |`);
    if (r.fixed) {
      reportLines.push(`| ${r.mode} | ↳ | fg ${r.before} → ${r.after} | | | |`);
    }
  }
  reportLines.push('');
  const fails = log.filter((r) => r.pass === false).length;
  reportLines.push(`未过对数：**${fails}**${fails === 0 ? '（全部实测达标）' : ''}`);
  reportLines.push('');
}

writeFileSync(join(ROOT, 'reports/contrast.md'), reportLines.join('\n'));
console.log('themes + reports/contrast.md written.');
