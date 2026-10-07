#!/usr/bin/env node

// On-demand refresh of the vendored upstream snapshots behind the
// components/ui registry gate (#989, map #980). This is the ONLY place the
// shadcn CLI runs — CI never touches the network for this gate (the live-diff
// form was measured and rejected in #985: batch `add --diff` truncates at 5
// of 16 files, cold npx costs ~67s, and an upstream release would redden an
// untouched main). Upstream drift surfaces only when a developer runs this
// script, turning it into a deliberate sync PR instead of a random red.
//
// Pipeline per registry item:
//
//   fetch      `npx -y shadcn@<pinned> view <items...>` from apps/web (the
//              components.json style decides the registry URL:
//              https://ui.shadcn.com/r/styles/base-nova/<item>.json). The
//              batch view emits one JSON array on stdout — machine-readable,
//              unlike the decorative `add --diff` box output.
//   rewrite    five deterministic repo-adaptation rewrites (details below).
//   normalize  the repo's own biome (`pnpm exec biome check --write` on a
//              temporary probe file under components/ui, so the repo config,
//              quote style, import organizer and type-import fixes all apply
//              exactly as they do to committed files).
//   record     scripts/ui-upstream-snapshots.json: per item the normalized
//              content + its pipeline hash (sha256 over the comment-stripped,
//              line-normalized form — same function the gate hashes local
//              files with, scripts/ui-normalize.mjs) + fetch metadata.
//
// The rewrites (each one a documented, repo-wide fact, not a per-file favor):
//
//   R1  `@/registry/base-nova/ui/<x>` -> `@/components/ui/<x>.js`
//       (registry-internal path -> repo alias, ESM .js suffix per repo law).
//   R2  `<IconPlaceholder lucide="XIcon" ... />` -> `<X />` imported from
//       the repo icons system (`../../icons/index.js`). The lucide attribute
//       names the icon; the `Icon` suffix is the registry's own convention.
//       A className on the placeholder survives (minus cn-* tokens via R4).
//       Fails loudly if the icon has no apps/web/src/icons/<Name>.tsx.
//   R3  `"use client"` dropped — components.json sets rsc:false, exactly the
//       condition under which `shadcn add` strips the directive itself.
//   R4  `cn-*` class tokens dropped — those utilities live in shadcn's own
//       hosted stylesheet, which this repo does not vendor (no cn-* class is
//       defined anywhere under apps/web/src/styles; verified 2026-10-07).
//       Dropped tokens are printed so a future upstream cn-* utility that the
//       repo DOES define gets caught by a human instead of silently erased.
//   R5  `import type * as React from 'react'` added when the content
//       references `React.` but carries no react import — upstream omits the
//       import (global-React assumption); repo tsconfig does not. biome's
//       import organizer slots it into sorted position.
//
// A `pristine` manifest entry means: the local file hashes equal to the
// snapshot hash produced by this pipeline. Anything the pipeline cannot
// express (motion canon, z-token ladder, added variants, injected shells)
// stays a registered deviation.
//
// Usage:
//   node scripts/ui-registry-refresh.mjs                # all manifest+detected items
//   node scripts/ui-registry-refresh.mjs --items a,b    # subset
//   node scripts/ui-registry-refresh.mjs --cli shadcn@X # override the pin (recorded)
//   node scripts/ui-registry-refresh.mjs --skip-detect  # skip `info --json` cross-check
//
// Exit codes: 0 = snapshots written, 2 = operational failure (CLI missing,
// network, malformed output, icon rewrite impossible). Requires node_modules
// (biome) and network; neither CI nor the gate needs either.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { hashFile, normalizedHash } from './ui-normalize.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const WEB_DIR = join(REPO_ROOT, 'apps/web');
const UI_DIR = join(WEB_DIR, 'src/components/ui');
const ICONS_DIR = join(WEB_DIR, 'src/icons');
const SNAPSHOT_PATH = join(REPO_ROOT, 'scripts/ui-upstream-snapshots.json');
const SNAPSHOT_REL = 'scripts/ui-upstream-snapshots.json';
const REGISTRY_PATH = join(REPO_ROOT, 'scripts/ui-registry.json');
const PROBE_PREFIX = '__refresh_probe__';

// Pinned: the CLI's registry output shape and this script's rewrites are a
// pair; bumping the pin is a reviewed change recorded in the snapshot meta.
const CLI_PIN = 'shadcn@4.21.3';

const REWRITE_NOTES = [
  'R1 @/registry/base-nova/ui/<x> -> @/components/ui/<x>.js',
  'R2 <IconPlaceholder lucide="XIcon"> -> <X> from ../../icons/index.js',
  'R3 "use client" dropped (components.json rsc:false)',
  'R4 cn-* class tokens dropped (shadcn-hosted utilities not vendored; dropped tokens printed)',
  'R5 import type * as React added when React. referenced without a react import',
  'biome check --write with the repo config (formatter + import organizer + type-import fixes)',
  'hash = sha256 over comment-stripped, line-normalized content (scripts/ui-normalize.mjs)',
];

function die(message) {
  console.error(`[ui-registry-refresh] ${message}`);
  process.exit(2);
}

/** Strip proxy variables: the shadcn CLI dies through the local proxy
 *  (measured in #985: 83.7s then 'other side closed') but works direct. */
function directEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!/^(https?_proxy|all_proxy|no_proxy)$/i.test(k)) env[k] = v;
  }
  return env;
}

function shadcn(cliSpec, args, timeoutMs) {
  try {
    return execFileSync('npx', ['-y', cliSpec, ...args], {
      cwd: WEB_DIR,
      env: directEnv(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    const stderr = (err.stderr || '').toString().slice(-500);
    die(
      `\`npx -y ${cliSpec} ${args.join(' ')}\` failed: ${err.message}${stderr ? `\n  stderr tail: ${stderr}` : ''}`,
    );
  }
}

// --- rewrites ----------------------------------------------------------------

function rewriteRegistryPaths(content) {
  return content.replace(/@\/registry\/base-nova\/ui\/([\w-]+)/g, '@/components/ui/$1.js');
}

function rewriteIconPlaceholders(content, itemName, warnLog) {
  const icons = new Set();
  let unresolved = false;
  const rewritten = content.replace(/<IconPlaceholder\b([^>]*?)\/>/gs, (match, attrs) => {
    const lucide = /lucide="([A-Za-z0-9]+?)Icon"/.exec(attrs);
    if (!lucide) {
      unresolved = true;
      warnLog.push(`${itemName}: IconPlaceholder without a lucide="…Icon" attribute kept as-is`);
      return match;
    }
    const name = lucide[1];
    if (!existsSync(join(ICONS_DIR, `${name}.tsx`))) {
      unresolved = true;
      warnLog.push(
        `${itemName}: icon '${name}' has no apps/web/src/icons/${name}.tsx — placeholder kept as-is; the item cannot match a pristine claim`,
      );
      return match;
    }
    icons.add(name);
    const cls = /className="([^"]*)"/.exec(attrs);
    return cls ? `<${name} className="${cls[1]}" />` : `<${name} />`;
  });
  if (icons.size === 0) return rewritten;
  const importLine = `import { ${[...icons].sort().join(', ')} } from '../../icons/index.js';\n`;
  const placeholderImport = /(import \{ IconPlaceholder \} from "[^"]*icon-placeholder";?\n)/;
  if (unresolved) {
    // Some placeholders stay: keep their import, add the repo-icon import
    // next to it (biome sorts both into place).
    const replaced = rewritten.replace(placeholderImport, `$1${importLine}`);
    if (replaced === rewritten)
      die(`${itemName}: repo icons resolved but the IconPlaceholder import line was not found`);
    return replaced;
  }
  const replaced = rewritten.replace(placeholderImport, importLine);
  if (replaced === rewritten)
    die(`${itemName}: IconPlaceholder usages rewritten but the import line was not found`);
  return replaced;
}

function rewriteUseClient(content) {
  return content.replace(/^\s*["']use client["'];?\s*\n/, '');
}

function rewriteCnTokens(content, itemName, droppedLog) {
  const dropped = new Set(content.match(/\bcn-[a-z][a-z0-9-]*/g) ?? []);
  if (dropped.size === 0) return content;
  for (const token of dropped) droppedLog.push(`${itemName}: ${token}`);
  return content.replace(/\bcn-[a-z][a-z0-9-]* ?/g, '').replace(/ ?\bcn-[a-z][a-z0-9-]*/g, '');
}

function rewriteReactImport(content) {
  if (!/\bReact\./.test(content)) return content;
  if (/from ["']react["']/.test(content)) return content;
  return `import type * as React from 'react';\n${content}`;
}

// --- items -------------------------------------------------------------------

function manifestRegistryItems() {
  if (!existsSync(REGISTRY_PATH)) return [];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  } catch {
    return []; // a broken manifest is the gate's problem, not the refresh's
  }
  const items = new Set();
  for (const entry of Object.values(manifest.files ?? {})) {
    if (entry?.kind === 'registry' && typeof entry.upstreamItem === 'string') {
      items.add(entry.upstreamItem);
    }
  }
  return [...items];
}

function detectedItems(cliSpec) {
  const raw = shadcn(cliSpec, ['info', '--json'], 120_000);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    die(`\`info --json\` did not emit JSON: ${err.message}`);
  }
  const components = parsed?.components;
  if (!Array.isArray(components)) die('`info --json` has no components array');
  return components;
}

function fetchItems(cliSpec, items) {
  const raw = shadcn(cliSpec, ['view', ...items], 300_000);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    die(`\`view\` did not emit JSON: ${err.message}`);
  }
  if (!Array.isArray(parsed)) die('`view` output is not a JSON array');
  const byName = new Map();
  for (const item of parsed) {
    if (!item?.name || !Array.isArray(item.files))
      die(`view output has a malformed item: ${JSON.stringify(item?.name)}`);
    const uiFiles = item.files.filter((f) => f?.type === 'registry:ui' && f?.content);
    if (uiFiles.length !== 1) {
      die(`item '${item.name}': expected exactly one registry:ui file, got ${uiFiles.length}`);
    }
    byName.set(item.name, uiFiles[0].content);
  }
  for (const name of items) {
    if (!byName.has(name)) die(`item '${name}' missing from the view output`);
  }
  return byName;
}

// --- main --------------------------------------------------------------------

const argv = process.argv.slice(2);
let cliSpec = CLI_PIN;
let onlyItems = null;
let skipDetect = false;
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--cli') cliSpec = argv[++i] ?? die('--cli requires an argument like shadcn@4.21.3');
  else if (arg === '--items')
    onlyItems = (argv[++i] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  else if (arg === '--skip-detect') skipDetect = true;
  else die(`unknown argument: ${arg} (expected --cli, --items or --skip-detect)`);
}

const fromManifest = manifestRegistryItems();
let items;
if (onlyItems) {
  items = [...new Set(onlyItems)].sort();
} else {
  const detected = skipDetect ? [] : detectedItems(cliSpec);
  if (!skipDetect) {
    const detectedSet = new Set(detected);
    const manifestSet = new Set(fromManifest);
    for (const name of detected.filter((n) => !manifestSet.has(n))) {
      console.log(
        `[ui-registry-refresh] NOTE detected as installed but not registered as a registry entry: ${name}`,
      );
    }
    for (const name of fromManifest.filter((n) => !detectedSet.has(n))) {
      console.log(
        `[ui-registry-refresh] NOTE registered but no longer detected by \`info --json\` (heavy local edit?): ${name}`,
      );
    }
  }
  items = [...new Set([...fromManifest, ...(skipDetect ? [] : detected)])].sort();
  if (items.length === 0 && fromManifest.length === 0) {
    die('no items to refresh (manifest absent and detection empty) — pass --items explicitly');
  }
}
if (items.length === 0) die('nothing to refresh');

console.log(
  `[ui-registry-refresh] fetching ${items.length} item(s) via ${cliSpec}: ${items.join(', ')}`,
);
const contents = fetchItems(cliSpec, items);

const droppedCnTokens = [];
const rewriteWarnings = [];
const probes = [];
try {
  for (const name of items) {
    let content = contents.get(name);
    content = rewriteUseClient(content);
    content = rewriteRegistryPaths(content);
    content = rewriteIconPlaceholders(content, name, rewriteWarnings);
    content = rewriteCnTokens(content, name, droppedCnTokens);
    content = rewriteReactImport(content);
    const probe = join(UI_DIR, `${PROBE_PREFIX}${name}.tsx`);
    writeFileSync(probe, content);
    probes.push({ name, probe });
  }
  // One biome pass over all probes: formatter + organizeImports + safe lint
  // fixes (useImportType). Non-zero exit (an unfixable lint diagnostic on
  // probe content) is fine — the fixes are still on disk.
  try {
    execFileSync('pnpm', ['exec', 'biome', 'check', '--write', ...probes.map((p) => p.probe)], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    });
  } catch (err) {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    if (!/Checked \d+ files?/.test(out))
      die(`biome normalization failed to run: ${out.slice(-500)}`);
  }

  const snapshotItems = {};
  for (const { name, probe } of probes) {
    const normalized = readFileSync(probe, 'utf8');
    snapshotItems[name] = { hash: normalizedHash(normalized), content: normalized };
  }

  const doc = {
    fetchedAt: new Date().toISOString(),
    cli: cliSpec,
    style: 'base-nova',
    registryUrlTemplate: 'https://ui.shadcn.com/r/styles/{style}/{name}.json',
    normalization: REWRITE_NOTES,
    items: Object.fromEntries(
      Object.keys(snapshotItems)
        .sort()
        .map((k) => [k, snapshotItems[k]]),
    ),
  };
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(doc, null, 2)}\n`);
} finally {
  for (const { probe } of probes) rmSync(probe, { force: true });
}

if (rewriteWarnings.length > 0) {
  console.log('[ui-registry-refresh] R2 warnings:');
  for (const line of [...new Set(rewriteWarnings)].sort()) console.log(`  ${line}`);
}
if (droppedCnTokens.length > 0) {
  console.log(
    '[ui-registry-refresh] R4 dropped cn-* tokens (upstream stylesheet utilities, not vendored here):',
  );
  for (const line of [...new Set(droppedCnTokens)].sort()) console.log(`  ${line}`);
}

// Drift report: snapshot vs local files vs manifest statuses. Informational —
// the gate is the authority; this tells the developer what to do next.
let manifest = null;
if (existsSync(REGISTRY_PATH)) {
  try {
    manifest = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  } catch {
    manifest = null;
  }
}
const entriesByItem = new Map();
for (const [file, entry] of Object.entries(manifest?.files ?? {})) {
  if (entry?.kind === 'registry' && entry.upstreamItem)
    entriesByItem.set(entry.upstreamItem, { file, entry });
}
console.log(`[ui-registry-refresh] wrote ${SNAPSHOT_REL}: ${items.length} item(s), cli ${cliSpec}`);
const fresh = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
for (const name of items) {
  const snapshotHash = fresh.items[name].hash;
  const registered = entriesByItem.get(name);
  if (!registered) {
    console.log(
      `  ${name}: snapshot ${snapshotHash.slice(0, 12)} — NOT registered in scripts/ui-registry.json`,
    );
    continue;
  }
  const localPath = join(UI_DIR, registered.file);
  const localHash = existsSync(localPath) ? hashFile(localPath) : null;
  const matches = localHash === snapshotHash;
  const status = registered.entry.status;
  if (matches && status === 'pristine')
    console.log(`  ${name}: pristine ✓ (local file matches snapshot)`);
  else if (!matches && status === 'deviated')
    console.log(`  ${name}: deviated ✓ (local file differs from snapshot, as registered)`);
  else if (matches && status === 'deviated') {
    console.log(
      `  ${name}: WARNING local file now MATCHES the snapshot but is registered deviated — ratchet it up to pristine in ${'scripts/ui-registry.json'}`,
    );
  } else {
    console.log(
      `  ${name}: WARNING registered pristine but local file DIFFERS from snapshot — gate S4 will fail. Adopt the upstream content or register the deviation with a reason.`,
    );
  }
}
