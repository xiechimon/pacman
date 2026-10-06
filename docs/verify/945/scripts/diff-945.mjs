#!/usr/bin/env node

// #945 migration-fidelity diff: compares before/after full computed-style
// captures (measure-945.mjs) and prints every drifted VISUAL property.
//
// Noise policy (documented, mechanical):
//   - Only a visual-property whitelist is compared. Skipped classes of
//     properties: --tw-* internal registers, derived origins
//     (perspective/transform-origin track box size), serialization aliases
//     (background-position 0px vs 0%), and border colors on sides whose
//     width is 0 in BOTH captures (unpaintable).
//   - background-clip drift is allowed when the background is fully
//     transparent on both sides (nothing to clip).
//   - ALLOW lists D2-authorized faces (chip 18→20 档 and its consequence
//     chain) and retired carriers (null-ok).
// Anything else printing DRIFT is a migration bug.
//
// Usage:
//   node docs/verify/945/scripts/diff-945.mjs \
//     --before docs/verify/945/measure/before --after docs/verify/945/measure/after

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BEFORE = resolve(REPO, arg('before', 'docs/verify/945/measure/before'));
const AFTER = resolve(REPO, arg('after', 'docs/verify/945/measure/after'));

// visual whitelist — the properties a migration can realistically drift
const VISUAL = new Set([
  'display', 'position', 'top', 'right', 'bottom', 'left', 'float', 'clear',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-radius', 'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'background-color', 'background-image', 'box-shadow', 'outline-color',
  'outline-width', 'outline-style', 'opacity', 'visibility', 'z-index',
  'color', 'font-size', 'font-family', 'font-weight', 'font-style',
  'line-height', 'letter-spacing', 'text-align', 'text-decoration-line',
  'text-indent', 'text-overflow', 'text-transform', 'white-space',
  'overflow', 'overflow-x', 'overflow-y', 'overflow-wrap', 'word-break',
  'flex', 'flex-grow', 'flex-shrink', 'flex-basis', 'flex-direction',
  'flex-wrap', 'justify-content', 'align-items', 'align-self', 'order', 'gap',
  'row-gap', 'column-gap', 'grid-template-columns',
  'box-sizing', 'cursor', 'pointer-events', 'user-select',
  'transform', 'translate', 'rotate', 'scale',
  'transition-property', 'transition-duration', 'transition-timing-function',
  'transition-delay', 'animation-name', 'animation-duration',
  'animation-timing-function', 'animation-iteration-count', 'animation-delay',
  'font-variant-numeric', 'vertical-align', 'clip-path', 'content',
  'field-sizing', 'resize',
]);

const ZERO_WIDTH_SIDES = (style, side) =>
  style[`border-${side}-width`] === '0px' || style[`border-${side}-style`] === 'none';

const transparent = (v) => v === 'rgba(0, 0, 0, 0)' || v === 'transparent' || v === '';

// D2-authorized / consequence-chain faces (see the canon §5.2 chip 档):
const CHIP_CHAIN = {
  '.detail-chip': {
    rect: true,
    style: ['height', 'width', 'inline-size', 'block-size'],
  },
  // #949（main 邻道，84f2a82d）把 chevron 类载体退役成 data-testid=
  // chip-chevron + utility 皮肤——before 基线（034bf7d5）还有该类，合并后
  // 的 after 采集里元素随类名退场。跨车道授权改动，非本车道迁移漂移。
  '.detail-chip-chevron': { rect: true, nullOk: true },
  '.detail-title': { rect: true, style: ['width', 'inline-size'] },
};
// TW shadow 合成：shadow utility 计算值带 4 个透明 ring 占位层 + 真投影层，
// 绘制结果与老单层 box-shadow 逐像素一致（同一 --*-shadow token 值在列）。
const SHADOW_COMPOSE = { style: ['box-shadow'] };
// spinner breathe 脉冲是时间函数——两次采集相位不同，opacity/transform/rect
// 采样差属采集噪声（spinner-live spec 以 offsetWidth/动画契约钉几何，不受相位影响）。
const SPINNER_PHASE = {
  style: ['opacity', 'transform'],
  rect: true,
};
// #908 裁决 2 消费面槽换（#946/#947「--text-dim 消费面同律」判例）：
// --text-dim 在非 background 抬升面 light 模实测 2.4–2.89，低于槽地板 3
// （canon 门控对是 dim × background）→ detail-a 全部 dim 消费面换引
// --text-tertiary（token 值冻结不动，只换消费面槽引用）。豁免按精确值对
// 机械判定：before = dim computed 值且 after = tertiary computed 值，
// light/dark 各一对；outline-color 计算值跟随 currentColor 同步漂移。
// 任何其它颜色漂移照常 DRIFT。
const DIM_SWAP_PAIRS = new Set([
  'color|rgb(141, 137, 128)|rgb(87, 83, 76)', // light #8d8980 → #57534c
  'color|rgb(121, 117, 111)|rgb(179, 175, 168)', // dark #79756f → #b3afa8
  'outline-color|rgb(141, 137, 128)|rgb(87, 83, 76)',
  'outline-color|rgb(121, 117, 111)|rgb(179, 175, 168)',
]);

const ALLOW = {
  'review-17b': {
    ...CHIP_CHAIN,
    '.detail-chip .chip': { nullOk: true }, // 老 ui/chip span 随件退役
    '.composer': SHADOW_COMPOSE,
    '.composer-send': {
      // 老两条 transition 简写 → 新单 transition-property 列表：逐属性
      // 时长/缓动值一致，仅 computed 列表序列化长度不同。
      style: ['transition-delay', 'transition-duration', 'transition-timing-function'],
    },
  },
  'user-menu': {
    '.user-menu': SHADOW_COMPOSE,
    // TW v4 rounded-full = calc(infinity * 1px)：与老 9999px 同为满圆绘制。
    '.user-menu-head img': {
      style: [
        'border-radius',
        'border-top-left-radius',
        'border-top-right-radius',
        'border-bottom-left-radius',
        'border-bottom-right-radius',
      ],
    },
  },
  'chip-popover': CHIP_CHAIN,
  'streaming-26': {
    '.chat-spinner': SPINNER_PHASE,
    '.composer-send': {
      style: ['transition-delay', 'transition-duration', 'transition-timing-function'],
    },
  },
  'tools-28': {
    // #943 判例：TW v4 rotate-180 的载体是独立 rotate 属性（transform 恒
    // none），合成像素同形。
    '.chat-collapse-icon': { style: ['rotate', 'transform'] },
  },
  'version-menu-66': {
    '.version-menu': SHADOW_COMPOSE,
  },
  'fab-detail-unread': {
    // rounded-full 序列化（9999px vs calc(infinity*1px)，同绘制）+ shadow 合成
    '.detail-fab': {
      ...SHADOW_COMPOSE,
      style: [
        ...(SHADOW_COMPOSE.style ?? []),
        'border-radius',
        'border-top-left-radius',
        'border-top-right-radius',
        'border-bottom-left-radius',
        'border-bottom-right-radius',
      ],
    },
  },
  'rerun-overlay': {
    '.overlay-panel': SHADOW_COMPOSE,
  },
  'pane-branch-31': {
    // §5.4 正典：.dlg-form-label → 定版标签律（13px → --label-size 12px +
    // --label-spacing 0.01em，值翻转授权面，无 spec 钉 label 类）。
    '.pane-branch-pr': { style: ['font-size', 'letter-spacing'] },
  },
  'branch-dialog': {
    // §5.4: .dlg-form-seg/.dlg-seg-tab → Tabs 件 default 档，老类元素退场。
    '.dlg-form-seg': { nullOk: true },
    '.dlg-seg-tab': { nullOk: true },
    '.dlg-seg-tab[data-active="true"]': { nullOk: true },
  },
};

let driftCount = 0;
let allowedCount = 0;
let skippedInternal = 0;

for (const theme of ['light', 'dark']) {
  const before = JSON.parse(readFileSync(join(BEFORE, `measure-${theme}.json`), 'utf8'));
  const after = JSON.parse(readFileSync(join(AFTER, `measure-${theme}.json`), 'utf8'));
  for (const scene of Object.keys(before)) {
    const b = before[scene];
    const a = after[scene] ?? {};
    for (const sel of Object.keys(b)) {
      const allow = ALLOW[scene]?.[sel] ?? {};
      const be = b[sel];
      const af = a[sel];
      if (be == null || af == null) {
        if (be == null && af == null) continue;
        if (allow.nullOk && af == null) {
          allowedCount += 1;
          console.log(`ALLOWED [${theme}] ${scene} ${sel}: element retired (null-ok)`);
          continue;
        }
        driftCount += 1;
        console.log(
          `DRIFT [${theme}] ${scene} ${sel}: presence changed ${be == null} -> ${af == null}`,
        );
        continue;
      }
      if (be.count !== af.count) {
        driftCount += 1;
        console.log(`DRIFT [${theme}] ${scene} ${sel}: count ${be.count} -> ${af.count}`);
      }
      const props = new Set([...Object.keys(be.style), ...Object.keys(af.style)]);
      for (const p of props) {
        if (be.style[p] === af.style[p]) continue;
        if (!VISUAL.has(p)) {
          skippedInternal += 1;
          continue;
        }
        if (DIM_SWAP_PAIRS.has(`${p}|${be.style[p]}|${af.style[p]}`)) {
          allowedCount += 1;
          console.log(
            `ALLOWED [${theme}] ${scene} ${sel} ${p}: dim→tertiary slot swap (ruling 2)`,
          );
          continue;
        }
        // unpaintable border color/style on a zero-width side (both captures)
        if (
          p.startsWith('border-') &&
          (p.endsWith('-color') || p.endsWith('-style')) &&
          p !== 'border-radius'
        ) {
          const side = p.split('-')[1];
          if (
            ['top', 'right', 'bottom', 'left'].includes(side) &&
            ZERO_WIDTH_SIDES(be.style, side) &&
            ZERO_WIDTH_SIDES(af.style, side)
          ) {
            skippedInternal += 1;
            continue;
          }
        }
        // background-clip-ish drift with nothing to clip
        if (
          p === 'background-clip' &&
          transparent(be.style['background-color']) &&
          transparent(af.style['background-color'])
        ) {
          skippedInternal += 1;
          continue;
        }
        if (allow.styleAll === true || (allow.style ?? []).includes(p)) {
          allowedCount += 1;
          console.log(`ALLOWED [${theme}] ${scene} ${sel} ${p}: ${be.style[p]} -> ${af.style[p]}`);
          continue;
        }
        driftCount += 1;
        console.log(`DRIFT [${theme}] ${scene} ${sel} ${p}: ${be.style[p]} -> ${af.style[p]}`);
      }
      for (const k of ['x', 'y', 'w', 'h']) {
        if (be.rect[k] === af.rect[k]) continue;
        if (allow.rect === true) {
          allowedCount += 1;
          console.log(`ALLOWED [${theme}] ${scene} ${sel} rect.${k}: ${be.rect[k]} -> ${af.rect[k]}`);
          continue;
        }
        driftCount += 1;
        console.log(`DRIFT [${theme}] ${scene} ${sel} rect.${k}: ${be.rect[k]} -> ${af.rect[k]}`);
      }
    }
  }
}

console.log(
  `\ndiff-945: DRIFT ${driftCount} · ALLOWED ${allowedCount} · skipped-internal ${skippedInternal}`,
);
process.exit(driftCount > 0 ? 1 : 0);
