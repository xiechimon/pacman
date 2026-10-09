#!/usr/bin/env node

// Consumer shape gate (#1054, ADR 0012 D1): every visible square box a
// consumer point draws must point at a registry basis, ride a registry
// default, or be a registered deviation with a reason.
//
// Why: ADR 0010 authorized free geometric redesign, so consumer faces were
// drawn square; ADR 0012 D1 made the registry default geometry the canon,
// but that migration only covered components/ui/ (#1003). The registry gate
// (#989) hashes component files, the debt gate (#851) counts CSS lines and
// bare controls, the drift gate (#851) polices color escapes — none of them
// looks at the geometry a consumer line paints. This gate closes that blind
// spot for the square-box defect class.
//
// Caliber (machine-decidable, line-based; the full disposition inventory
// lives in docs/spec/27-消费点形状与品牌墨台账.md):
//
//   R1  active square declaration — the line carries a BARE `rounded-none`
//       utility (no variant prefix; `before:rounded-none` is a state-layer
//       form, not an element box) AND unconditional paint on the same line:
//       a bare bg-* (not transparent/none/clip-*), a full-perimeter border
//       (not border-none/transparent, not single-edge border-t/b/l/r/x/y),
//       a shadow (not shadow-none), or a ring (not ring-0). State-variant
//       paint (hover:/data-*:/before: tints) does NOT make a box: flat rows
//       whose only surface is a hover tint are neutralizations, the same
//       exempt class as the components/ui primitive neutralizers.
//   R2  enclosed box by omission — the line declares NO bare rounded-* at
//       all yet draws a STRUCTURAL full-perimeter border (width tokens:
//       border / border-2 / border-[1px]; edge, color-only and style-only
//       border tokens do not enclose) AND a bare bg fill: a boxed surface
//       whose squareness comes from silence (Tailwind default border-radius
//       is 0). Full-bleed bands (border-t header/footer over a bg), block
//       quotes (border-l-4) and bg-only layout strips are not enclosed
//       boxes and are not flagged; the bg-only blind spot is documented in
//       the inventory caliber.
//
// Every flagged line must be covered by an entry in
// scripts/ui-consumer-registry.json (squareBoxes section): {file, anchor,
// kind, basis?, reason} where anchor is a literal substring of the flagged
// line. kinds: deviation (deliberate non-registry geometry, reason
// required), rides-primitive (radius shows through from a registry
// component, basis required), state-surface (state tint over an
// already-ruled box, reason required). Entries with no matching line are
// red too (stale ledger). Registration is semantic — there is no --write:
// new entries are hand-authored in the introducing PR, the ledger diff is
// the review face (same contract as ui-registry.json, #989 S5 spirit).
//
// Usage: node scripts/ui-consumer-shape-gate.mjs
// Exit 0 green / 1 violations / 2 operational error (fail closed).
// Zero dependencies, zero network — runs pre-install in the CI check job.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { stripCodeComments } from './ui-normalize.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const WEB_SRC = join(REPO_ROOT, 'apps/web/src');
const LEDGER_PATH = join(REPO_ROOT, 'scripts/ui-consumer-registry.json');
const rel = (p) => relative(REPO_ROOT, p);

const failures = [];
const fatal = (msg) => {
  console.error(`[ui-consumer-shape-gate] FATAL: ${msg}`);
  process.exit(2);
};

/* ------------------------------------------------------------------ */
// Ledger load + fail-closed structural validation.

let ledger;
try {
  ledger = JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
} catch (err) {
  fatal(`cannot read/parse ${rel(LEDGER_PATH)}: ${err.message}`);
}
const KINDS = new Set(['deviation', 'rides-primitive', 'state-surface']);
const boxEntries = ledger.squareBoxes;
if (!Array.isArray(boxEntries)) fatal('squareBoxes must be an array');
const seenKeys = new Set();
for (const entry of boxEntries) {
  for (const field of ['file', 'anchor', 'kind', 'reason']) {
    if (typeof entry[field] !== 'string' || entry[field] === '') {
      fatal(`squareBoxes entry ${JSON.stringify(entry).slice(0, 120)}: missing ${field}`);
    }
  }
  if (!KINDS.has(entry.kind)) fatal(`unknown kind ${entry.kind}`);
  if (entry.kind === 'rides-primitive' && !(typeof entry.basis === 'string' && entry.basis)) {
    fatal(`rides-primitive entry ${entry.file} (${entry.anchor}): basis required`);
  }
  const key = `${entry.file}\u0000${entry.anchor}`;
  if (seenKeys.has(key)) fatal(`duplicate entry ${entry.file} (${entry.anchor})`);
  seenKeys.add(key);
}

/* ------------------------------------------------------------------ */
// Scan.

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      // The primitives directory is the registry gate's territory (#989);
      // its rounded-none forms are neutralizations by design.
      if (path.endsWith('components/ui')) continue;
      walk(path, out);
    } else if (/\.(ts|tsx)$/.test(path) && !path.endsWith('.d.ts')) {
      out.push(path);
    }
  }
  return out;
}

const files = walk(WEB_SRC);
if (files.length === 0) fatal(`no source files under ${rel(WEB_SRC)}`);

/** Split a source line into candidate utility tokens. */
const tokensOf = (line) => line.split(/[\s"'`]+/).filter(Boolean);
/** A token is bare when no variant prefix (hover:, dark:, data-x:, before:,
 *  arbitrary-selector […]:) gates it. */
const isBare = (tok) => !tok.includes(':');

const BG_NONE = new Set(['bg-transparent', 'bg-none']);
const isBgPaint = (tok) =>
  tok.startsWith('bg-') && !BG_NONE.has(tok) && !tok.startsWith('bg-clip-');

// Structural border = a token that puts a full-perimeter border WIDTH on the
// box: bare `border`, `border-2`, `border-[1px]`. Everything else after
// `border-` is an edge (border-t/b-l-4…), a color (border-(--x), border-input,
// border-primary — Tailwind v4 token shorthand sets border-color only), a
// style word (border-dashed — invisible without a width token beside it) or a
// reset (border-none). Those do not enclose a box on their own: full-bleed
// bands (dialog header/footer border-t over bg) and blockquotes (border-l-4)
// are layout surfaces riding a parent box, not boxes.
const isBorderPaint = (tok) =>
  tok === 'border' || /^border-\d/.test(tok) || /^border-\[\d/.test(tok);

const isShadowPaint = (tok) =>
  (tok.startsWith('shadow-') && tok !== 'shadow-none') || tok.startsWith('[box-shadow:');

const isRingPaint = (tok) =>
  tok === 'ring' || (tok.startsWith('ring-') && !/^ring-(0|inset|offset)/.test(tok));

const isRounded = (tok) => tok.startsWith('rounded-') || tok.startsWith('rounded[');

/** @returns {'R1'|'R2'|null} */
function classifyLine(line) {
  const tokens = tokensOf(line);
  const bare = tokens.filter(isBare);
  const paint =
    bare.some(isBgPaint) ||
    bare.some(isBorderPaint) ||
    bare.some(isShadowPaint) ||
    bare.some(isRingPaint);
  // R1: active square declaration + unconditional paint.
  if (bare.includes('rounded-none') && paint) return 'R1';
  // R2: enclosed box by omission — border + bg fill, no radius declared.
  const declaresRadius = bare.some(isRounded);
  if (!declaresRadius && bare.some(isBorderPaint) && bare.some(isBgPaint)) return 'R2';
  return null;
}

const hits = []; // {file, line, rule, text}
const linesByFile = new Map();
for (const path of files) {
  const stripped = stripCodeComments(readFileSync(path, 'utf8'));
  const lines = stripped.split('\n');
  linesByFile.set(path, lines);
  for (let i = 0; i < lines.length; i++) {
    const rule = classifyLine(lines[i]);
    if (rule) hits.push({ path, lineNo: i + 1, rule, text: lines[i] });
  }
}

/* ------------------------------------------------------------------ */
// Coverage both ways.

const hitKeys = new Set();
for (const hit of hits) {
  const covering = boxEntries.filter(
    (entry) => entry.file === rel(hit.path) && hit.text.includes(entry.anchor),
  );
  if (covering.length === 0) {
    failures.push(
      `[ui-consumer-shape-gate] ${hit.rule} ${rel(hit.path)}:${hit.lineNo}: square box with no registry basis and no ledger entry — point it at a registry component, ride the registry default radius, or register a deviation with a reason in scripts/ui-consumer-registry.json (#1054, ADR 0012 D1).\n    ${hit.text.trim().slice(0, 160)}`,
    );
  } else {
    for (const entry of covering) hitKeys.add(`${entry.file}\u0000${entry.anchor}`);
  }
}

for (const entry of boxEntries) {
  const key = `${entry.file}\u0000${entry.anchor}`;
  if (!hitKeys.has(key)) {
    failures.push(
      `[ui-consumer-shape-gate] STALE ${entry.file} (${entry.anchor}): ledger entry matches no flagged line — the site was fixed, deleted, or reworded; drop or re-anchor the entry in the same PR.`,
    );
  }
  const target = join(REPO_ROOT, entry.file);
  if (!linesByFile.has(target)) {
    failures.push(
      `[ui-consumer-shape-gate] STALE ${entry.file}: file is not in the scanned consumer territory.`,
    );
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  console.error(
    `[ui-consumer-shape-gate] FAIL: ${hits.length} flagged line(s), ${failures.length} violation(s). Caliber + inventory: docs/spec/27-消费点形状与品牌墨台账.md.`,
  );
  process.exit(1);
}

const byKind = boxEntries.reduce((acc, entry) => {
  acc[entry.kind] = (acc[entry.kind] ?? 0) + 1;
  return acc;
}, {});
console.log(
  `[ui-consumer-shape-gate] PASS: ${hits.length} flagged line(s) across ${files.length} consumer file(s), all registered (${boxEntries.length} entries = ${Object.entries(
    byKind,
  )
    .map(([k, n]) => `${n} ${k}`)
    .join(' / ')}).`,
);
