#!/usr/bin/env node

// Registry gate for apps/web/src/components/ui (#989, map #980): the
// primitives layer is registry-sourced, and the proof is mechanical.
//
// The claim this gate enforces, per #985's ruling (live upstream diffing was
// measured and rejected: batch `add --diff` truncates at 5 of 16 files, cold
// npx costs ~67s, upstream releases would redden an untouched main):
//
//   Every file under components/ui is either
//     (a) byte-for-byte the pinned upstream registry item after the documented
//         normalization pipeline (status: pristine — proven against the
//         vendored snapshot), or
//     (b) a registered deviation from a named upstream item, with a reason
//         (status: deviated), or
//     (c) a registered local adapter built on registry items, with a reason
//         (kind: adapter) —
//   and every file's content hash is frozen in the ledger, so a silent
//   overwrite becomes a visible ledger diff in the same PR.
//
// Scope is exactly components/ui — hand-rolled skins in domain directories
// are NOT this gate's business (they are covered by ui-debt-gate D1/D2 and
// ui-drift-gate G1–G5 plus review); pretending otherwise was premortem #3 in
// #985 and the output says so.
//
// Inputs (all vendored, zero network, zero node_modules — runs pre-install):
//   scripts/ui-registry.json           manifest + hash ledger (--write freezes)
//   scripts/ui-upstream-snapshots.json vendored upstream content + hashes
//                                      (scripts/ui-registry-refresh.mjs, dev-time)
//   scripts/ui-normalize.mjs           the shared comment-strip/line-normalize
//                                      sha256 pipeline both sides hash through
//
// Gates (default check mode):
//   S1  A file exists under components/ui that the manifest does not
//       register. Hand-rolled primitives are red; registration is a
//       deliberate, reviewed manifest edit.
//   S2  The manifest registers a file that no longer exists — a stale entry
//       means the ledger is not tracking the tree (fail-closed housekeeping).
//   S3  A registered file's content hash differs from its ledger entry: an
//       edit landed without a same-PR re-freeze. The re-freeze (`--write`) is
//       the #851 muscle memory; the ledger diff is the review face.
//   S4  A `pristine` entry's hash no longer equals the pinned upstream
//       snapshot hash. Either the file drifted (register the deviation with a
//       reason) or upstream moved and the snapshot was refreshed (adopt the
//       upstream content, or register the local edit as a deviation).
//   S5  Status ratchet against the base ref (--base <sha> or
//       UI_REGISTRY_BASE_SHA; CI passes the PR base sha, reusing the fetch the
//       debt-gate step already made). During map #980 an existing entry may
//       only move UP: pristine→deviated or registry→adapter downgrades are
//       red, and re-freezing inside the PR cannot hide them (same stance as
//       debt-gate D3 — the comparison runs against the BASE manifest).
//       Brand-new registrations pass mechanically (manifest diff + #939's
//       human layer carry that review) but are named in the output.
//       Bootstrap: a base without the manifest (the PR introducing the gate)
//       skips S5.
//   S6  Fail-closed structural validation: malformed manifest/snapshot JSON,
//       unknown kind/status values, registry entries without upstreamItem or
//       status, deviated/adapter entries without a reason, malformed hashes,
//       pristine entries whose upstream item is absent from the snapshot, a
//       missing snapshot file, or an empty/missing source directory all end
//       red with exit 2 — a broken gate must never pass silently.
//
// Hash semantics note (#985): hashes are unordered — the ratchet (S5) applies
// to kinds/statuses, never to hash values. Comment-only edits do not move the
// hash (scripts/ui-normalize.mjs strips comments before hashing), so
// provenance headers can be maintained without ledger churn; code edits always
// move it.
//
// Usage:
//   node scripts/ui-registry-gate.mjs                 # check
//   node scripts/ui-registry-gate.mjs --write         # re-freeze ledger hashes
//   node scripts/ui-registry-gate.mjs --base <sha>    # check + S5 against <sha>
//
// Exit codes: 0 = green, 1 = violations, 2 = operational error.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { hashFile, isHashShape } from './ui-normalize.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const UI_DIR = join(REPO_ROOT, 'apps/web/src/components/ui');
const UI_REL = 'apps/web/src/components/ui';
const REGISTRY_PATH = join(REPO_ROOT, 'scripts/ui-registry.json');
const REGISTRY_REL = 'scripts/ui-registry.json';
const SNAPSHOT_PATH = join(REPO_ROOT, 'scripts/ui-upstream-snapshots.json');
const SNAPSHOT_REL = 'scripts/ui-upstream-snapshots.json';

const KINDS = new Set(['registry', 'adapter']);
const STATUSES = new Set(['pristine', 'deviated']);

function die6(message) {
  console.error(`[ui-registry-gate] S6 ${message}`);
  process.exit(2);
}

// --- tree scan ----------------------------------------------------------------

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const rel = (p) => relative(UI_DIR, p).split(sep).join('/');

function scanTree() {
  if (!existsSync(UI_DIR)) die6(`source directory missing: ${UI_REL}`);
  const files = walk(UI_DIR).map(rel).sort();
  if (files.length === 0) die6(`scan found no files under ${UI_REL}`);
  return files;
}

// --- validation ---------------------------------------------------------------

function validateManifest(m, label) {
  const problems = [];
  if (m === null || typeof m !== 'object') return [`${label}: manifest is not an object`];
  if (m.files === null || typeof m.files !== 'object' || Array.isArray(m.files)) {
    return [`${label}: files missing or not an object`];
  }
  for (const [file, e] of Object.entries(m.files)) {
    if (e === null || typeof e !== 'object') {
      problems.push(`${label}: files["${file}"] is not an object`);
      continue;
    }
    if (!KINDS.has(e.kind))
      problems.push(
        `${label}: files["${file}"].kind must be registry|adapter, got ${JSON.stringify(e.kind)}`,
      );
    if (!isHashShape(e.hash))
      problems.push(`${label}: files["${file}"].hash is not a 64-char lowercase hex sha256`);
    if (e.kind === 'registry') {
      if (typeof e.upstreamItem !== 'string' || e.upstreamItem.length === 0) {
        problems.push(`${label}: files["${file}"] kind=registry requires upstreamItem`);
      }
      if (!STATUSES.has(e.status)) {
        problems.push(
          `${label}: files["${file}"].status must be pristine|deviated, got ${JSON.stringify(e.status)}`,
        );
      }
      if (e.status === 'deviated' && !(typeof e.reason === 'string' && e.reason.length > 0)) {
        problems.push(`${label}: files["${file}"] status=deviated requires a reason`);
      }
    } else if (e.kind === 'adapter') {
      if (!(typeof e.reason === 'string' && e.reason.length > 0)) {
        problems.push(
          `${label}: files["${file}"] kind=adapter requires a reason (what it adapts and why it is local)`,
        );
      }
      if (e.upstreamItem !== undefined || e.status !== undefined) {
        problems.push(
          `${label}: files["${file}"] kind=adapter must not carry upstreamItem/status (those belong to registry entries)`,
        );
      }
    }
  }
  return problems;
}

function validateSnapshot(s, label, pristineItems) {
  const problems = [];
  if (s === null || typeof s !== 'object') return [`${label}: snapshot is not an object`];
  if (s.items === null || typeof s.items !== 'object' || Array.isArray(s.items)) {
    return [`${label}: items missing or not an object`];
  }
  for (const [name, item] of Object.entries(s.items)) {
    if (item === null || typeof item !== 'object' || !isHashShape(item.hash)) {
      problems.push(`${label}: items["${name}"].hash is not a 64-char lowercase hex sha256`);
    }
    if (typeof item?.content !== 'string' || item.content.length === 0) {
      problems.push(
        `${label}: items["${name}"].content missing — the snapshot vendors upstream content for review`,
      );
    }
  }
  for (const [file, name] of pristineItems) {
    if (!Object.hasOwn(s.items, name)) {
      problems.push(
        `${label}: pristine entry "${file}" points at upstream item "${name}" which the snapshot does not contain`,
      );
    }
  }
  return problems;
}

function loadJsonOr6(path, relPath, what) {
  if (!existsSync(path)) {
    die6(
      what === 'manifest'
        ? `no manifest at ${relPath} — this gate needs the registered ledger; freeze one with: node scripts/ui-registry-gate.mjs --write (after adding entries)`
        : `no vendored snapshot at ${relPath} — regenerate with: node scripts/ui-registry-refresh.mjs`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    die6(`${relPath} is not valid JSON: ${err.message}`);
  }
  return parsed;
}

function loadManifest() {
  const parsed = loadJsonOr6(REGISTRY_PATH, REGISTRY_REL, 'manifest');
  for (const p of validateManifest(parsed, REGISTRY_REL)) die6(p);
  return parsed;
}

function loadSnapshot(manifest) {
  const parsed = loadJsonOr6(SNAPSHOT_PATH, SNAPSHOT_REL, 'snapshot');
  const pristineItems = Object.entries(manifest.files)
    .filter(([, e]) => e.kind === 'registry' && e.status === 'pristine')
    .map(([f, e]) => [f, e.upstreamItem]);
  for (const p of validateSnapshot(parsed, SNAPSHOT_REL, pristineItems)) die6(p);
  return parsed;
}

// --- base manifest (S5) ---------------------------------------------------------

function git(args) {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function loadBaseManifest(sha) {
  let text;
  try {
    text = git(['show', `${sha}:${REGISTRY_REL}`]);
  } catch {
    try {
      git(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`]);
    } catch {
      console.error(
        `[ui-registry-gate] S6 base sha ${sha} is not available locally; fetch it first (CI: git fetch --depth=1 origin <sha>). Refusing to fall back to the branch manifest.`,
      );
      process.exit(2);
    }
    return { manifest: null, mode: 'bootstrap' };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    die6(`manifest at base ${sha} is not valid JSON: ${err.message}`);
  }
  for (const p of validateManifest(parsed, `base ${sha.slice(0, 12)}`)) die6(p);
  return { manifest: parsed, mode: 'base' };
}

function currentSha() {
  try {
    return git(['rev-parse', 'HEAD']).trim();
  } catch {
    return 'unknown';
  }
}

// --- check ----------------------------------------------------------------------

function check(baseSha) {
  const treeFiles = scanTree();
  const manifest = loadManifest();
  const snapshot = loadSnapshot(manifest);
  const entries = manifest.files;

  const failures = [];
  const newcomers = [];

  // S1/S2: manifest <-> tree coverage.
  const treeSet = new Set(treeFiles);
  for (const file of treeFiles) {
    if (!Object.hasOwn(entries, file)) {
      failures.push(
        `S1 ${UI_REL}/${file}: not registered in ${REGISTRY_REL} — components/ui is registry-sourced only (#989, map #980). Hand-written primitives are red wherever they come from. To register: add a files["${file}"] entry (kind registry with upstreamItem+status, or kind adapter with a reason), then freeze the ledger: node scripts/ui-registry-gate.mjs --write`,
      );
    }
  }
  for (const file of Object.keys(entries)) {
    if (!treeSet.has(file)) {
      failures.push(
        `S2 ${file}: registered in ${REGISTRY_REL} but missing from ${UI_REL} — remove the entry in the same PR that removed the file (or restore the file); --write drops gone entries`,
      );
    }
  }

  // S3: content hash ledger.
  for (const file of treeFiles) {
    const entry = entries[file];
    if (!entry) continue;
    const actual = hashFile(join(UI_DIR, file));
    if (actual !== entry.hash) {
      failures.push(
        `S3 ${file}: content hash changed (ledger ${(entry.hash ?? 'none').slice(0, 12)}… → tree ${actual.slice(0, 12)}…) — a registered file was edited without re-freezing the ledger in the same PR. Review the edit against its registered status/reason, then: node scripts/ui-registry-gate.mjs --write`,
      );
    }
  }

  // S4: pristine claims vs the vendored snapshot.
  for (const [file, entry] of Object.entries(entries)) {
    if (entry.kind !== 'registry' || entry.status !== 'pristine') continue;
    const snapItem = snapshot.items[entry.upstreamItem];
    if (!snapItem) continue; // already caught by S6 validation
    if (entry.hash !== snapItem.hash) {
      failures.push(
        `S4 ${file}: registered pristine against upstream item "${entry.upstreamItem}" but the ledger hash no longer equals the pinned snapshot hash (${snapItem.hash.slice(0, 12)}…, ${snapshot.cli} fetched ${String(snapshot.fetchedAt).slice(0, 10)}) — the file drifted from upstream, or upstream moved. Either adopt the upstream content (node scripts/ui-registry-refresh.mjs shows the diff surface) or register the deviation with a reason and re-freeze.`,
      );
    }
  }

  // S5: status/kind ratchet against the base manifest.
  let baseMode = 'in-tree only';
  if (baseSha) {
    const loaded = loadBaseManifest(baseSha);
    if (loaded.mode === 'base') {
      baseMode = `base ${baseSha.slice(0, 12)}`;
      const baseEntries = loaded.manifest.files;
      for (const [file, entry] of Object.entries(entries)) {
        const before = baseEntries[file];
        if (!before) {
          newcomers.push(`${file} (kind ${entry.kind}${entry.status ? `, ${entry.status}` : ''})`);
          continue;
        }
        if (
          before.kind === 'registry' &&
          before.status === 'pristine' &&
          entry.status === 'deviated'
        ) {
          failures.push(
            `S5 ${file}: downgraded pristine → deviated vs base ${baseSha.slice(0, 12)} — during map #980 the ratchet only moves up; a pristine file may not grow a deviation (move the local behavior into an adapter, or land it upstream-shaped). Re-freezing in-PR does not lift this: the comparison runs against the base manifest.`,
          );
        }
        if (before.kind === 'registry' && entry.kind === 'adapter') {
          failures.push(
            `S5 ${file}: downgraded registry → adapter vs base ${baseSha.slice(0, 12)} — a registry item may not be re-declared as local invention while map #980 runs.`,
          );
        }
      }
      for (const file of Object.keys(baseEntries)) {
        if (!Object.hasOwn(entries, file)) {
          newcomers.push(`${file} (removed — fine, the ratchet counts down)`);
        }
      }
    } else {
      baseMode = `bootstrap (base ${baseSha.slice(0, 12)} has no ${REGISTRY_REL})`;
    }
  }

  if (failures.length > 0) {
    for (const f of failures) console.log(`[ui-registry-gate] ${f}`);
    console.log(
      `[ui-registry-gate] FAIL: ${failures.length} violation(s). Scope = ${UI_REL} only (#989). The manifest diff is the review face; hashes re-freeze with: node scripts/ui-registry-gate.mjs --write`,
    );
    process.exit(1);
  }

  // --- green output ------------------------------------------------------------
  let pristine = 0;
  let deviated = 0;
  let adapters = 0;
  for (const e of Object.values(entries)) {
    if (e.kind === 'adapter') adapters++;
    else if (e.status === 'pristine') pristine++;
    else deviated++;
  }
  if (newcomers.length > 0) {
    console.log(
      `[ui-registry-gate] NEW registrations vs ${baseMode} (mechanically allowed; the manifest diff and #939's two questions carry the review):`,
    );
    for (const n of newcomers) console.log(`  ${n}`);
  }
  console.log(
    `[ui-registry-gate] PASS: ${treeFiles.length} file(s) in ${UI_REL} = ${pristine + deviated} registry (${pristine} pristine vs pinned snapshot / ${deviated} registered deviations) + ${adapters} adapters; snapshot ${snapshot.cli} fetched ${String(snapshot.fetchedAt).slice(0, 10)}; ledger frozen from ${(manifest.frozenFrom?.sha ?? 'unknown').slice(0, 12)}; comparison: ${baseMode}.`,
  );
  process.exit(0);
}

// --- write ----------------------------------------------------------------------

function write() {
  const treeFiles = scanTree();
  const manifest = loadManifest();
  const snapshot = loadSnapshot(manifest);
  const entries = manifest.files;
  const treeSet = new Set(treeFiles);

  const unregistered = treeFiles.filter((f) => !Object.hasOwn(entries, f));
  if (unregistered.length > 0) {
    for (const f of unregistered) {
      console.error(
        `[ui-registry-gate] S1 cannot freeze: ${UI_REL}/${f} is not registered. Registration is semantic (the script must not invent kind/status/reason) — add an entry to ${REGISTRY_REL} first, e.g.:\n  "${f}": { "kind": "adapter", "reason": "<what it adapts, why it is local, ticket>" }\nor for a registry item:\n  "${f}": { "kind": "registry", "upstreamItem": "<item>", "status": "deviated", "reason": "<why>" }\nthen re-run --write to freeze its hash.`,
      );
    }
    process.exit(2);
  }

  const notes = [];
  const next = {};
  for (const file of treeFiles) {
    const entry = { ...entries[file] };
    const actual = hashFile(join(UI_DIR, file));
    if (entry.hash !== actual) {
      notes.push(`hash ${file}: ${(entry.hash ?? 'none').slice(0, 12)}… → ${actual.slice(0, 12)}…`);
      entry.hash = actual;
    }
    next[file] = entry;
  }
  for (const file of Object.keys(entries)) {
    if (!treeSet.has(file)) notes.push(`entry dropped (file gone): ${file}`);
  }

  const doc = {
    frozenFrom: { sha: currentSha(), date: new Date().toISOString().slice(0, 10) },
    scope: manifest.scope,
    files: Object.fromEntries(
      Object.keys(next)
        .sort()
        .map((k) => [k, next[k]]),
    ),
  };
  writeFileSync(REGISTRY_PATH, `${JSON.stringify(doc, null, 2)}\n`);

  let pristine = 0;
  let deviated = 0;
  let adapters = 0;
  let pristineBroken = 0;
  for (const e of Object.values(doc.files)) {
    if (e.kind === 'adapter') adapters++;
    else if (e.status === 'pristine') {
      pristine++;
      if (snapshot.items[e.upstreamItem] && e.hash !== snapshot.items[e.upstreamItem].hash)
        pristineBroken++;
    } else deviated++;
  }
  console.log(
    `[ui-registry-gate] ledger frozen: ${Object.keys(doc.files).length} entries (${pristine} pristine / ${deviated} deviated / ${adapters} adapters) from ${(doc.frozenFrom.sha ?? 'unknown').slice(0, 12)}. Written to ${REGISTRY_REL}.`,
  );
  if (notes.length > 0) {
    console.log('[ui-registry-gate] delta vs previous ledger:');
    for (const n of notes) console.log(`  ${n}`);
  } else {
    console.log('[ui-registry-gate] no change vs previous ledger (idempotent).');
  }
  if (pristineBroken > 0) {
    console.log(
      `[ui-registry-gate] WARNING: ${pristineBroken} pristine entr(ies) no longer match the pinned snapshot — check mode (S4) will stay red until the files adopt upstream or the deviations get registered. Snapshot refresh: node scripts/ui-registry-refresh.mjs`,
    );
  }
}

// --- CLI ------------------------------------------------------------------------

const argv = process.argv.slice(2);
let writeMode = false;
let baseSha = process.env.UI_REGISTRY_BASE_SHA || '';
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--write') writeMode = true;
  else if (arg === '--base') {
    baseSha = argv[++i] ?? '';
    if (!baseSha) {
      console.error('[ui-registry-gate] --base requires a sha argument');
      process.exit(2);
    }
  } else {
    console.error(`[ui-registry-gate] unknown argument: ${arg} (expected --write or --base <sha>)`);
    process.exit(2);
  }
}

if (writeMode) {
  if (baseSha) {
    console.error(
      '[ui-registry-gate] --write does not take a base sha (the ratchet is a check-mode gate)',
    );
    process.exit(2);
  }
  write();
} else {
  check(baseSha);
}
