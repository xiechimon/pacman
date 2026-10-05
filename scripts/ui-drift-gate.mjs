#!/usr/bin/env node

// Drift gate: one style, one implementation. Every UI face that has been
// consolidated into `apps/web/src/components/ui/*` (or the styles/ token
// single-source) must not grow a second implementation in domain CSS or JSX.
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
//       收编 tickets — this gate only pins the canonical six against
//       redefinition elsewhere.
//   G4  Every bare `<input` in apps/web/src either lives in an Input
//       primitive itself or carries a `deliberate-native` marker comment
//       within the 12 lines above it (#855, parent #851). Text-like inputs
//       migrate to components/ui/input.tsx; deliberate-native sites (hidden
//       file triggers, tri-state checkboxes, custom-switch a11y layers)
//       document their reason at the site instead.
//
// The former single-site exception is closed: #854 minted `--text-on-veil`
// (styles/shadcn.css, both theme mirrors) for the white text over the
// theme-invariant black veil, and `overlay/attachment-strip.css` consumes it.
// No escape is allowlisted any more — HEX_ALLOWLIST stays as the mechanism so
// that any future exception has to name its file + selector explicitly.
//
// Usage: node scripts/ui-drift-gate.mjs
// Exit 0 when all gates hold; exit 1 otherwise, listing the offending sites.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const WEB_SRC = join(REPO_ROOT, 'apps/web/src');
const rel = (p) => relative(WEB_SRC, p);

// G2: the only file allowed to hold color values.
const HEX_SOURCE = join(WEB_SRC, 'styles/shadcn.css');
// G2-ALLOW: file-relative + selector + reason. Empty since #854: every color
// value lives in the token source again (see header).
const HEX_ALLOWLIST = [];
// G3: canonical chip variants, single home.
const CHIP_HOME_REL = rel(join(WEB_SRC, 'ui/chip.css'));
const CHIP_VARIANTS = ['idle', 'plan', 'confirm', 'done', 'failed', 'mini'];
// G4: bare `<input>` marker discipline.
const INPUT_MARKER = 'deliberate-native';
const INPUT_MARKER_WINDOW_LINES = 12;
// Files that ARE the primitive: bare <input> is the implementation there.
const INPUT_PRIMITIVE_FILES = new Set(['ui/input.tsx', 'components/ui/input.tsx']);

const failures = [];

function walk(dir, extension, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, extension, out);
    else if (path.endsWith(extension)) out.push(path);
  }
  return out;
}

// G1-G3 scan stylesheets, where only CSS block comments exist.
function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '\n');
}

/** G4 strips JSX block comments, TS block comments, and line comments so that
 *  `<input` mentioned in prose (e.g. api-key-create-dialog's XMON-75 note)
 *  does not count as a site. String literals are left alone: a literal
 *  "<input" inside a string is rare and errs on the side of flagging. */
function stripJsxComments(source) {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))
    .replace(/(^|[ \t])\/\/[^\n]*/g, '$1');
}

const cssFiles = walk(WEB_SRC, '.css');

// --- G1: dead .btn selectors -------------------------------------------------
const BTN_RE = /\.btn(?![\w-])|\.btn--[\w-]+/;
for (const file of cssFiles) {
  const text = stripCssComments(readFileSync(file, 'utf8'));
  text.split('\n').forEach((line, i) => {
    const m = line.match(BTN_RE);
    if (m) failures.push(`G1 ${rel(file)}:${i + 1}: live \`${m[0]}\` selector (${line.trim()})`);
  });
}

// --- G2: hex escapes ---------------------------------------------------------
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
for (const file of cssFiles) {
  if (file === HEX_SOURCE) continue;
  const text = stripCssComments(readFileSync(file, 'utf8'));
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
  const text = stripCssComments(readFileSync(file, 'utf8'));
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

// --- G4: bare <input> sites (input facet, #855) ------------------------------
const INPUT_RE = /<input(?![A-Za-z0-9-])/;
const tsxFiles = walk(WEB_SRC, '.tsx');
let inputSites = 0;
let deliberateInputs = 0;
for (const file of tsxFiles) {
  const relPath = rel(file);
  if (INPUT_PRIMITIVE_FILES.has(relPath)) continue;
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split('\n');
  const clean = stripJsxComments(raw).split('\n');
  for (let i = 0; i < clean.length; i++) {
    // Bare <input followed by whitespace, newline, /, or > — never <Input
    // (capital I fails the lowercase match) nor a longer tag like <inputish.
    if (!INPUT_RE.test(clean[i])) continue;
    inputSites++;
    const windowStart = Math.max(0, i - INPUT_MARKER_WINDOW_LINES);
    const hasMarker = lines.slice(windowStart, i + 1).some((l) => l.includes(INPUT_MARKER));
    if (hasMarker) deliberateInputs++;
    else
      failures.push(
        `G4 ${relPath}:${i + 1}: bare <input> without \`${INPUT_MARKER}\` — migrate to components/ui/input.tsx or annotate the reason`,
      );
  }
}

// --- verdict -----------------------------------------------------------------
if (failures.length === 0) {
  console.log(
    `[ui-drift-gate] PASS: no live .btn selectors, no hex escapes, ${CHIP_VARIANTS.length} chip variants single-sourced (${cssFiles.length} css files scanned); ${inputSites} bare <input> site(s), ${deliberateInputs} deliberate-native.`,
  );
  process.exit(0);
}
for (const f of failures) console.log(`[ui-drift-gate] ${f}`);
console.log(`[ui-drift-gate] FAIL: ${failures.length} drift site(s). See header for gate intent.`);
process.exit(1);
