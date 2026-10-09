#!/usr/bin/env node

// Permanent debt ratchet (#851; born as the construction-period brake for
// #908, sealed as a standing regression gate by #1012 when map #980 closed —
// the ledgers sit at their floor, so the ratchet now purely blocks regrowth).
// Two debt ledgers may only shrink, never grow:
//
//   per-face CSS   every *.css under apps/web/src except the five
//                  carrier-layer files (WHITELIST below). Counted per file in
//                  physical lines (newline characters, wc -l parity).
//   bare controls  occurrences of <button / <input / <select / <textarea in
//                  *.tsx under apps/web/src, excluding components/ui/ (the
//                  primitives are the sanctioned implementations). Counted as
//                  a grand total. Tag matching keeps the semantics of
//                  scripts/count-raw-controls.mjs (the docs/spec/16 §6.5
//                  ledger tool): multi-line opening tags are found, longer tag
//                  names (<buttonish) are not, and comments are NOT stripped —
//                  a tag-shaped mention inside a comment counts, which keeps
//                  the baseline directly comparable to the published ledger
//                  (76 sites / 30 files @ a831032e).
//
// The baseline is scripts/ui-debt-baseline.json, frozen from a clean main by
// `--write`. Domain tickets shrink debt, then re-freeze in their own PR (the
// ratchet only moves down; see D3 for why up never passes CI).
//
// Gates (default check mode):
//   D1  A per-face CSS file holds more lines than its baseline entry. A file
//       absent from the baseline has an entry of 0, so any brand-new per-face
//       CSS file is red — "新增面为零" (#913 acceptance template v2, item 7).
//   D2  The bare-control total exceeds the baseline total. Per-file deltas are
//       printed for diagnosis, but the rule is the total: moving controls
//       between files without adding any is not new debt.
//   D3  With a base ref (--base <sha> or UI_DEBT_BASE_SHA; CI passes the PR's
//       base sha), the baseline carried by the branch must not be higher than
//       the base's baseline — on any CSS entry or on the control total. This
//       is what makes re-freezing inside a PR unable to legalize new debt:
//       the comparison for D1/D2 runs against the BASE baseline when one is
//       available, so raising the in-tree numbers changes nothing. Bootstrap:
//       a base without the file (the PR that introduces the gate) skips D3.
//   D4  Fail-closed housekeeping: malformed or structurally inconsistent
//       baseline (rawControls.files must sum to rawControls.total, values
//       must be non-negative integers), an empty source scan, or a missing
//       whitelist carrier file all end red — a broken gate must never pass
//       silently (same stance as the drizzle chain guard in ci.yml).
//
// Debt below baseline is not red: the run prints a note asking for a
// `--write` re-freeze so the ledger follows the tree down (#851: 基线随动递减).
//
// Usage:
//   node scripts/ui-debt-gate.mjs                 # check against the baseline
//   node scripts/ui-debt-gate.mjs --write         # freeze baseline from tree
//   node scripts/ui-debt-gate.mjs --base <sha>    # check + D3 against <sha>
//
// Exit codes: 0 = at or below baseline, 1 = violations, 2 = operational error
// (baseline missing/unreadable, base sha not fetched, scan sanity failed).

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const WEB_SRC = join(REPO_ROOT, 'apps/web/src');
const BASELINE_PATH = join(REPO_ROOT, 'scripts/ui-debt-baseline.json');
const BASELINE_REL = 'scripts/ui-debt-baseline.json';

// Carrier layer (#851 whitelist): theme values, tokens, motion, app shell and
// fonts are infrastructure for the new UI, not per-face debt. Paths are
// relative to apps/web/src. Adding a file here is a deliberate, reviewable
// act — the list is intentionally part of the gate's source, mirroring how
// ui-drift-gate.mjs carries HEX_ALLOWLIST.
const WHITELIST = [
  'styles/app.css',
  'styles/fonts.css',
  'styles/motion.css',
  'styles/shadcn.css',
  'styles/tokens.css',
];

const CONTROL_TAGS = ['button', 'input', 'select', 'textarea'];
// The primitives: bare native tags inside components/ui/ ARE the sanctioned
// implementation (same boundary as count-raw-controls' ledger, which the #908
// baseline of 76 sites / 30 files was cut from).
const CONTROLS_EXCLUDED_PREFIX = 'components/ui/';

const rel = (p) => relative(WEB_SRC, p).split(sep).join('/');

function walk(dir, extension, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, extension, out);
    else if (path.endsWith(extension)) out.push(path);
  }
  return out;
}

/** wc -l parity: the number of newline characters. */
function countLines(text) {
  let n = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') n++;
  return n;
}

/** Opening-tag finder, semantics copied from scripts/count-raw-controls.mjs:
 *  scans to the matching `>` of the opening tag, skipping quoted strings and
 *  JSX expression braces, and rejecting longer tag names. */
function tagsOf(source, tag) {
  const open = `<${tag}`;
  const found = [];
  for (let i = source.indexOf(open); i !== -1; i = source.indexOf(open, i + 1)) {
    const next = source[i + open.length];
    if (next !== undefined && /[A-Za-z0-9-]/.test(next)) continue;
    let depth = 0;
    let quote = null;
    let j = i + open.length;
    for (; j < source.length; j++) {
      const c = source[j];
      if (quote) {
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    found.push(source.slice(i, j));
  }
  return found;
}

/** Scan the tree and produce the ledger shape used by the baseline file. */
function scanTree() {
  const cssFiles = walk(WEB_SRC, '.css');
  const tsxFiles = walk(WEB_SRC, '.tsx');

  // D4 sanity: an empty scan means the walk broke (moved src? wrong cwd?),
  // and a missing carrier file means the whitelist went stale. Both are
  // operational errors, not debt.
  const problems = [];
  if (cssFiles.length === 0) problems.push('scan found no *.css under apps/web/src');
  if (tsxFiles.length === 0) problems.push('scan found no *.tsx under apps/web/src');
  for (const w of WHITELIST) {
    if (!cssFiles.some((f) => rel(f) === w)) {
      problems.push(`whitelisted carrier file missing from tree: ${w}`);
    }
  }
  if (problems.length > 0) {
    for (const p of problems) console.error(`[ui-debt-gate] D4 ${p}`);
    process.exit(2);
  }

  const whitelistSet = new Set(WHITELIST);
  const perFaceCss = {};
  for (const f of cssFiles) {
    const r = rel(f);
    if (whitelistSet.has(r)) continue;
    perFaceCss[r] = countLines(readFileSync(f, 'utf8'));
  }

  const controlFiles = {};
  let controlTotal = 0;
  for (const f of tsxFiles) {
    const r = rel(f);
    if (r.startsWith(CONTROLS_EXCLUDED_PREFIX)) continue;
    const source = readFileSync(f, 'utf8');
    let n = 0;
    for (const tag of CONTROL_TAGS) n += tagsOf(source, tag).length;
    if (n > 0) controlFiles[r] = n;
    controlTotal += n;
  }

  return {
    perFaceCss,
    controlFiles,
    controlTotal,
    cssCount: cssFiles.length,
    tsxCount: tsxFiles.length,
  };
}

function sortedObject(obj) {
  const out = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out;
}

function isNonNegativeInt(v) {
  return Number.isInteger(v) && v >= 0;
}

/** D4: structural validation of a parsed baseline. Returns problem strings. */
function validateBaseline(b, label) {
  const problems = [];
  if (b === null || typeof b !== 'object') return [`${label}: baseline is not an object`];
  if (b.perFaceCss === null || typeof b.perFaceCss !== 'object') {
    problems.push(`${label}: perFaceCss missing or not an object`);
  } else {
    for (const [k, v] of Object.entries(b.perFaceCss)) {
      if (!isNonNegativeInt(v))
        problems.push(`${label}: perFaceCss["${k}"] is not a non-negative integer`);
    }
  }
  const rc = b.rawControls;
  if (rc === null || typeof rc !== 'object') {
    problems.push(`${label}: rawControls missing or not an object`);
    return problems;
  }
  if (!isNonNegativeInt(rc.total))
    problems.push(`${label}: rawControls.total is not a non-negative integer`);
  if (rc.files === null || typeof rc.files !== 'object') {
    problems.push(`${label}: rawControls.files missing or not an object`);
    return problems;
  }
  let sum = 0;
  for (const [k, v] of Object.entries(rc.files)) {
    if (!isNonNegativeInt(v))
      problems.push(`${label}: rawControls.files["${k}"] is not a non-negative integer`);
    else sum += v;
  }
  if (problems.length === 0 && sum !== rc.total) {
    problems.push(
      `${label}: rawControls.files sums to ${sum} but rawControls.total is ${rc.total}`,
    );
  }
  return problems;
}

function loadInTreeBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    console.error(
      `[ui-debt-gate] D4 no baseline at ${BASELINE_REL} — freeze one from a clean main with: node scripts/ui-debt-gate.mjs --write`,
    );
    process.exit(2);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch (err) {
    console.error(`[ui-debt-gate] D4 ${BASELINE_REL} is not valid JSON: ${err.message}`);
    process.exit(2);
  }
  const problems = validateBaseline(parsed, BASELINE_REL);
  if (problems.length > 0) {
    for (const p of problems) console.error(`[ui-debt-gate] D4 ${p}`);
    process.exit(2);
  }
  return parsed;
}

function git(args) {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Resolve the base baseline for D3. Returns { baseline|null, mode } where
 *  mode is 'base' (loaded), 'bootstrap' (base commit predates the baseline
 *  file) — anything else is an operational error and exits 2. */
function loadBaseBaseline(sha) {
  let text;
  try {
    text = git(['show', `${sha}:${BASELINE_REL}`]);
  } catch {
    // Distinguish "commit known, file absent" (bootstrap) from "commit not
    // even fetched" (broken CI plumbing — fail loudly rather than gate
    // against a branch-supplied baseline).
    try {
      git(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`]);
    } catch {
      console.error(
        `[ui-debt-gate] D4 base sha ${sha} is not available locally; fetch it first (CI: git fetch --depth=1 origin <sha>). Refusing to fall back to the branch baseline.`,
      );
      process.exit(2);
    }
    return { baseline: null, mode: 'bootstrap' };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error(`[ui-debt-gate] D4 baseline at base ${sha} is not valid JSON: ${err.message}`);
    process.exit(2);
  }
  const problems = validateBaseline(parsed, `base ${sha.slice(0, 12)}`);
  if (problems.length > 0) {
    for (const p of problems) console.error(`[ui-debt-gate] D4 ${p}`);
    process.exit(2);
  }
  return { baseline: parsed, mode: 'base' };
}

function currentSha() {
  try {
    return git(['rev-parse', 'HEAD']).trim();
  } catch {
    return 'unknown';
  }
}

function writeBaseline(scan) {
  const previous = existsSync(BASELINE_PATH)
    ? safeParse(readFileSync(BASELINE_PATH, 'utf8'))
    : null;
  const doc = {
    frozenFrom: { sha: currentSha(), date: new Date().toISOString().slice(0, 10) },
    scope:
      'apps/web/src; per-face css = *.css minus the ui-debt-gate.mjs WHITELIST (carrier layer); bare controls = <button|<input|<select|<textarea occurrences in *.tsx minus components/ui/',
    perFaceCss: sortedObject(scan.perFaceCss),
    rawControls: { total: scan.controlTotal, files: sortedObject(scan.controlFiles) },
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(doc, null, 2)}\n`);

  const cssTotal = Object.values(doc.perFaceCss).reduce((a, b) => a + b, 0);
  console.log(
    `[ui-debt-gate] baseline frozen: ${Object.keys(doc.perFaceCss).length} per-face css files / ${cssTotal} lines; ${doc.rawControls.total} bare control(s) in ${Object.keys(doc.rawControls.files).length} file(s). Written to ${BASELINE_REL}.`,
  );
  if (previous) {
    const notes = [];
    for (const [file, n] of Object.entries(doc.perFaceCss)) {
      const before = previous.perFaceCss?.[file];
      if (before === undefined) notes.push(`  css +new  ${file}: ${n} lines`);
      else if (n !== before)
        notes.push(`  css ${n > before ? 'UP' : 'down'} ${file}: ${before} -> ${n}`);
    }
    for (const [file, before] of Object.entries(previous.perFaceCss ?? {})) {
      if (doc.perFaceCss[file] === undefined) notes.push(`  css -gone ${file} (was ${before})`);
    }
    const totalBefore = previous.rawControls?.total;
    if (totalBefore !== undefined && totalBefore !== doc.rawControls.total) {
      notes.push(
        `  controls ${doc.rawControls.total > totalBefore ? 'UP' : 'down'} total: ${totalBefore} -> ${doc.rawControls.total}`,
      );
    }
    if (notes.length > 0) {
      console.log('[ui-debt-gate] delta vs previous baseline:');
      for (const n of notes) console.log(n);
      if (notes.some((n) => n.includes(' UP ') || n.includes('+new'))) {
        console.log(
          '[ui-debt-gate] WARNING: this re-freeze RAISES the ledger. CI (D3) compares against the base baseline, so a raised baseline does not legalize new debt on a PR.',
        );
      }
    } else {
      console.log('[ui-debt-gate] no numeric change vs previous baseline.');
    }
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function check(baseSha) {
  const scan = scanTree();
  const inTree = loadInTreeBaseline();

  // The comparison baseline for D1/D2: the base ref's copy when CI provides
  // one (so a branch cannot lift its own ceiling), else the in-tree file.
  let effective = inTree;
  let baseMode = 'in-tree only';
  if (baseSha) {
    const loaded = loadBaseBaseline(baseSha);
    if (loaded.mode === 'base') {
      effective = loaded.baseline;
      baseMode = `base ${baseSha.slice(0, 12)}`;
    } else {
      baseMode = `bootstrap (base ${baseSha.slice(0, 12)} has no ${BASELINE_REL})`;
    }
  }

  const failures = [];
  const shrunk = [];

  // D1: per-file per-face CSS lines.
  for (const [file, n] of Object.entries(scan.perFaceCss)) {
    const allowed = effective.perFaceCss?.[file] ?? 0;
    if (n > allowed) {
      const isNew = effective.perFaceCss?.[file] === undefined;
      failures.push(
        `D1 ${file}: ${n} lines > baseline ${allowed}${isNew ? ' (new per-face css file — new faces are red, #913 acceptance item 7)' : ''}`,
      );
    } else if (n < allowed) {
      shrunk.push(`css ${file}: ${allowed} -> ${n}`);
    }
  }

  // D2: bare-control total, with per-file deltas as diagnosis.
  const allowedTotal = effective.rawControls?.total ?? 0;
  if (scan.controlTotal > allowedTotal) {
    const grew = [];
    for (const [file, n] of Object.entries(scan.controlFiles)) {
      const before = effective.rawControls?.files?.[file] ?? 0;
      if (n > before) grew.push(`${file} ${before}->${n}`);
    }
    failures.push(
      `D2 bare controls: ${scan.controlTotal} total > baseline ${allowedTotal}${grew.length > 0 ? ` (grew at: ${grew.join(', ')})` : ''}`,
    );
  } else if (scan.controlTotal < allowedTotal) {
    shrunk.push(`bare controls total: ${allowedTotal} -> ${scan.controlTotal}`);
  }

  // D3: the branch's own baseline must not sit higher than the base's.
  if (baseSha && effective !== inTree) {
    for (const [file, n] of Object.entries(inTree.perFaceCss)) {
      const before = effective.perFaceCss?.[file] ?? 0;
      if (n > before) {
        failures.push(`D3 ${BASELINE_REL} perFaceCss["${file}"] raised vs base: ${before} -> ${n}`);
      }
    }
    const totalNow = inTree.rawControls.total;
    const totalBefore = effective.rawControls?.total ?? 0;
    if (totalNow > totalBefore) {
      failures.push(
        `D3 ${BASELINE_REL} rawControls.total raised vs base: ${totalBefore} -> ${totalNow}`,
      );
    }
  }

  if (failures.length > 0) {
    for (const f of failures) console.log(`[ui-debt-gate] ${f}`);
    console.log(
      `[ui-debt-gate] FAIL: ${failures.length} violation(s). During the #908 overhaul, build with components/ui/* + Tailwind; per-face css and bare controls may only shrink. After removing debt, re-freeze: node scripts/ui-debt-gate.mjs --write`,
    );
    process.exit(1);
  }

  if (shrunk.length > 0) {
    console.log('[ui-debt-gate] debt below baseline (ratchet it down in this PR):');
    for (const s of shrunk) console.log(`  ${s}`);
    console.log('  run: node scripts/ui-debt-gate.mjs --write');
  }
  const cssTotal = Object.values(scan.perFaceCss).reduce((a, b) => a + b, 0);
  console.log(
    `[ui-debt-gate] PASS: ${Object.keys(scan.perFaceCss).length} per-face css files / ${cssTotal} lines; ${scan.controlTotal} bare control(s) in ${Object.keys(scan.controlFiles).length} file(s); ${scan.cssCount} css + ${scan.tsxCount} tsx scanned. Baseline: ${baseMode}, frozen from ${(effective.frozenFrom?.sha ?? 'unknown').slice(0, 12)}.`,
  );
  process.exit(0);
}

// --- CLI ---------------------------------------------------------------------
const argv = process.argv.slice(2);
let writeMode = false;
let baseSha = process.env.UI_DEBT_BASE_SHA || '';
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--write') writeMode = true;
  else if (arg === '--base') {
    baseSha = argv[++i] ?? '';
    if (!baseSha) {
      console.error('[ui-debt-gate] --base requires a sha argument');
      process.exit(2);
    }
  } else {
    console.error(`[ui-debt-gate] unknown argument: ${arg} (expected --write or --base <sha>)`);
    process.exit(2);
  }
}

if (writeMode) {
  writeBaseline(scanTree());
} else {
  check(baseSha);
}
