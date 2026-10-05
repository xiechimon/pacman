#!/usr/bin/env node

// #851 drift gate: one style, one implementation. Every UI face that has
// been consolidated into `apps/web/src/components/ui/*` (or the styles/
// token single-source) must not grow a second implementation in domain CSS.
//
// What this checks (all source-only, no build needed):
//   G1  No live `.btn` / `.btn--*` selectors. The old button skins were
//       retired by the A3/A4/A5/A6收编 + #574 re-key: components/ui/Button
//       no longer renders a `btn` class, so any such selector is dead on
//       arrival. (Old values survive only inside CSS comments as migration
//       notes — comments are stripped before matching.)
//   G2  No hex color literals in declaration lines outside the token source
//       (`styles/shadcn.css` holds the values by design; `tokens.css` holds
//       aliases). Hex inside comments is stripped, not flagged.
//   G3  The canonical `.chip--*` variants are defined exactly once, in
//       `ui/chip.css`. Per-face chip families (search-row-chip--*,
//       mention-chip--*, detail-chip--*) are separate skins with their own
//      收编 tickets — this gate only pins the canonical six against
//       redefinition elsewhere.
//
// Known single-site exception (G2-ALLOW): attachment-strip.css
// `.attachment-pending-badge` paints white text on a theme-invariant black
// veil (`rgb(0 0 0/0.55)`); no theme-invariant white-text token exists yet.
// Tracked by the color-escape follow-up of #851 — the allowlist entry names
// the file + selector so a second escape anywhere else still fails.
//
// Usage: node scripts/ui-drift-gate.mjs
// Exit 0 when all gates hold; exit 1 otherwise, listing the offending sites.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const WEB_SRC = join(REPO_ROOT, 'apps/web/src');
const rel = (p) => relative(WEB_SRC, p);

// G2: the only file allowed to hold color values.
const HEX_SOURCE = join(WEB_SRC, 'styles/shadcn.css');
// G2-ALLOW: file-relative + selector + reason (see header).
const HEX_ALLOWLIST = [
  {
    file: 'overlay/attachment-strip.css',
    selector: '.attachment-pending-badge',
    reason: '#851-followup: theme-invariant white on black veil, no token yet',
  },
];
// G3: canonical chip variants, single home.
const CHIP_HOME_REL = rel(join(WEB_SRC, 'ui/chip.css'));
const CHIP_VARIANTS = ['idle', 'plan', 'confirm', 'done', 'failed', 'mini'];

const failures = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith('.css')) out.push(path);
  }
  return out;
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '\n');
}

const cssFiles = walk(WEB_SRC);

// --- G1: dead .btn selectors -------------------------------------------------
const BTN_RE = /\.btn(?![\w-])|\.btn--[\w-]+/;
for (const file of cssFiles) {
  const text = stripComments(readFileSync(file, 'utf8'));
  text.split('\n').forEach((line, i) => {
    const m = line.match(BTN_RE);
    if (m) failures.push(`G1 ${rel(file)}:${i + 1}: live \`${m[0]}\` selector (${line.trim()})`);
  });
}

// --- G2: hex escapes ---------------------------------------------------------
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
for (const file of cssFiles) {
  if (file === HEX_SOURCE) continue;
  const text = stripComments(readFileSync(file, 'utf8'));
  text.split('\n').forEach((line, i) => {
    if (!HEX_RE.test(line)) return;
    const allowed = HEX_ALLOWLIST.some(
      (a) => join(WEB_SRC, a.file) === file && line.includes(a.selector),
    );
    // Allowlist matches the selector definition line; the declaration lines
    // under it are covered by tracking the block below.
    if (!allowed) {
      // Check whether this line sits inside an allowlisted rule block.
      const lines = text.split('\n');
      let inside = false;
      for (let j = i; j >= 0 && i - j < 12; j--) {
        if (
          HEX_ALLOWLIST.some((a) => join(WEB_SRC, a.file) === file && lines[j].includes(a.selector))
        ) {
          inside = true;
          break;
        }
        if (j < i && lines[j].includes('}')) break;
      }
      if (!inside)
        failures.push(
          `G2 ${rel(file)}:${i + 1}: hex literal outside token source (${line.trim()})`,
        );
    }
  });
}

// --- G3: canonical chip variants defined once, at home -----------------------
const chipDefs = new Map();
for (const file of cssFiles) {
  const text = stripComments(readFileSync(file, 'utf8'));
  text.split('\n').forEach((line, i) => {
    const m = line.match(/^\s*\.chip--([a-z]+)\b/);
    if (m) {
      const key = m[1];
      if (!chipDefs.has(key)) chipDefs.set(key, []);
      chipDefs.get(key).push(`${rel(file)}:${i + 1}`);
    }
  });
}
for (const variant of CHIP_VARIANTS) {
  const sites = chipDefs.get(variant) ?? [];
  if (sites.length !== 1 || !sites[0].startsWith(`${CHIP_HOME_REL}:`)) {
    failures.push(
      `G3 .chip--${variant}: expected exactly one definition in ui/chip.css, found [${sites.join(', ') || 'none'}]`,
    );
  }
}

// --- verdict -----------------------------------------------------------------
if (failures.length === 0) {
  console.log(
    `[ui-drift-gate] PASS: no live .btn selectors, no hex escapes, ${CHIP_VARIANTS.length} chip variants single-sourced (${cssFiles.length} css files scanned).`,
  );
  process.exit(0);
}
for (const f of failures) console.log(`[ui-drift-gate] ${f}`);
console.log(`[ui-drift-gate] FAIL: ${failures.length} drift site(s). See header for gate intent.`);
process.exit(1);
