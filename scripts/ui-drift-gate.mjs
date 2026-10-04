#!/usr/bin/env node

// UI drift gate, input facet (#855; parent #851).
//
// Rule: every bare `<input` in apps/web/src must either live in an Input
// primitive itself or carry a `deliberate-native` marker comment within the
// 12 lines above it. Text-like inputs migrate to components/ui/input.tsx;
// deliberate-native sites (hidden file triggers, tri-state checkboxes,
// custom-switch a11y layers) document their reason at the site instead.
//
// Usage (repo root): node scripts/ui-drift-gate.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../apps/web/src', import.meta.url)));
const MARKER = 'deliberate-native';
const MARKER_WINDOW_LINES = 12;

// Files that ARE the primitive: bare <input> is the implementation there.
const PRIMITIVE_FILES = new Set(['ui/input.tsx', 'components/ui/input.tsx']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Strip JSX block comments, TS block comments, and line comments so that
 *  `<input` mentioned in prose (e.g. api-key-create-dialog's XMON-75 note)
 *  does not count as a site. String literals are left alone: a literal
 *  "<input" inside a string is rare and errs on the side of flagging. */
function stripComments(source) {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))
    .replace(/(^|[ \t])\/\/[^\n]*/g, '$1');
}

const offenders = [];
let checked = 0;
let deliberate = 0;

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  if (PRIMITIVE_FILES.has(rel)) continue;
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split('\n');
  const clean = stripComments(raw).split('\n');
  for (let i = 0; i < clean.length; i++) {
    // Bare <input followed by whitespace, newline, /, or > — never <Input
    // (capital I fails the lowercase match) nor a longer tag like <inputish.
    if (!/<input(?![A-Za-z0-9-])/.test(clean[i])) continue;
    checked++;
    const windowStart = Math.max(0, i - MARKER_WINDOW_LINES);
    const hasMarker = lines.slice(windowStart, i + 1).some((l) => l.includes(MARKER));
    if (hasMarker) deliberate++;
    else offenders.push(`${rel}:${i + 1}`);
  }
}

if (offenders.length > 0) {
  console.error(`ui-drift-gate: RED — ${offenders.length} uncommented bare <input> site(s):`);
  for (const o of offenders) console.error(`  ${o}`);
  console.error(
    `Migrate to components/ui/input.tsx or add a \`${MARKER}\` comment stating the reason (#855).`,
  );
  process.exit(1);
}
console.log(
  `ui-drift-gate: GREEN — ${checked} bare <input> site(s), ${deliberate} deliberate-native, 0 uncommented.`,
);
