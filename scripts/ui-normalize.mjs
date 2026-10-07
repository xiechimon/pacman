// Shared normalization for the components/ui registry gate (#989, map #980).
//
// Two consumers: scripts/ui-registry-gate.mjs (CI, zero-dep, pre-install) and
// scripts/ui-registry-refresh.mjs (dev-time snapshot refresh). Both must hash
// file content through the SAME pipeline, or the pristine-vs-upstream
// comparison drifts apart:
//
//   1. strip comments       — provenance/deviation header comments (avatar,
//                             kbd, textarea, button, switch, ...) are local
//                             documentation, not content. A file may carry or
//                             edit its header without touching the code the
//                             gate freezes. Comment stripping mirrors the
//                             stripJsxComments semantics of ui-drift-gate.mjs
//                             (JSX expression comments, block comments, line
//                             comments; string literals left alone).
//   2. line-normalize       — trim each line, drop empty lines. Comment holes
//                             leave blank lines on one side only; indentation
//                             is formatter territory (biome pins it in the
//                             committed tree). Line structure and token order
//                             are preserved, so real content edits still move
//                             the hash.
//   3. sha256 hex           — the ledger value.
//
// Pure node builtins only: the gate runs before pnpm install.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** Strip JSX/TS comments, preserving line count. The single implementation,
 *  shared by ui-drift-gate (G4/G5 site matching) and the registry hash
 *  pipeline — it replaced a local copy in the drift gate, which is how the
 *  missing-`m`-flag bug once lived in two places at once. The `m` flag
 *  matters: without it `^` only matches the very start of the file and every
 *  standalone `//` comment line after the first survives stripping (measured:
 *  the kbd provenance header). A `//` preceded by `:` (a URL inside a string)
 *  still does not match — only line starts and space/tab-preceded `//` do.
 *  String literals are not parsed beyond that: both hash sides go through the
 *  same function, so equality semantics are unaffected. */
export function stripCodeComments(source) {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))
    .replace(/(^|[ \t])\/\/[^\n]*/gm, '$1');
}

/** The canonical form a hash is computed over: comments stripped, CRLF
 *  folded, lines trimmed, empty lines dropped. */
export function normalizeSource(source) {
  return stripCodeComments(source)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

/** sha256 hex over normalizeSource(). */
export function normalizedHash(source) {
  return createHash('sha256').update(normalizeSource(source), 'utf8').digest('hex');
}

/** Read a file and hash it through the canonical pipeline. */
export function hashFile(path) {
  return normalizedHash(readFileSync(path, 'utf8'));
}

/** 64-char lowercase hex — the shape every ledger/snapshot hash must have. */
export function isHashShape(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}
