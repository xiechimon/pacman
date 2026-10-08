// Independent conservation check for #1039 migration.
// Re-derives the original chain chunks from git (pre-change base SHA),
// walks the changelog/ files on disk, and compares chunk multisets.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const OUTDIR = join(ROOT, '.claude/skills/verify-pacman/changelog');
const BASE = '8176650a'; // pre-change origin/main tip

const cleanLead = (s) => s.replace(/^[。;；：:、,.\s]+/, '').replace(/^同日[:：]\s*/, '');

// original lines from git
const skillOrig = execSync(`git -C ${ROOT} show ${BASE}:.claude/skills/verify-pacman/SKILL.md`, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const mapOrig = execSync(`git -C ${ROOT} show ${BASE}:.claude/skills/verify-pacman/features/README.md`, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const skillLine = skillOrig.split('\n').find((l) => l.startsWith('Last updated: '));
const mapLinesO = mapOrig.split('\n');
const mapLine = mapLinesO.find((l) => l.startsWith('Last updated: '));
const footerLine = mapLinesO.find((l) => l.startsWith('前序：2026-09-27'));
if (!skillLine || !mapLine || !footerLine) throw new Error('original lines not found in git base');

// chunk the originals (same logic as migration)
let frags = skillLine.slice('Last updated: '.length).split('前序').map(cleanLead);
const last = frags[frags.length - 1];
const k = last.indexOf('建成日');
frags[frags.length - 1] = last.slice(0, k);
frags.push(last.slice(k));
frags = frags.filter((f) => f.length > 0);
const inputSkill = frags;

const [chainA, chainB] = mapLine.slice('Last updated: '.length).split('：前序:');
const mapFrags = [...chainA.split('＋'), ...chainB.split('＋')]
  .map((f) => cleanLead(f).replace(/[：\s]+$/, ''))
  .filter((f) => f.length > 0);
const mapUniq = new Map();
for (const f of mapFrags) {
  const key = f.slice(0, 30); // dedupe byte-identical A/B copies
  if (!mapUniq.has(key)) mapUniq.set(key, f);
}
const micro308 = '停止钮全栈链 #308';
const microInit = '初始 map';

// parse changelog files on disk: H1 line, then ## sections, body = lines until next ## or EOF
const output = []; // [sectionLabel, bodyText]
const names = readdirSync(OUTDIR).filter((n) => n.endsWith('.md') && n !== 'README.md').sort();
for (const name of names) {
  const lines = readFileSync(join(OUTDIR, name), 'utf8').split('\n');
  let i = 0;
  if (!lines[i].startsWith('# ')) throw new Error(`${name}: no H1`);
  i++;
  while (i < lines.length) {
    if (lines[i] === '') { i++; continue; }
    if (!lines[i].startsWith('## ')) throw new Error(`${name}:${i + 1}: expected ## section, got ${JSON.stringify(lines[i])}`);
    const label = lines[i].slice(3);
    i++;
    if (lines[i] !== '') throw new Error(`${name}:${i + 1}: expected blank after ##`);
    i++;
    const body = [];
    while (i < lines.length && !lines[i].startsWith('## ')) { body.push(lines[i]); i++; }
    while (body.length && body[body.length - 1] === '') body.pop();
    output.push([label, body.join('\n'), name]);
  }
}

const count = (arr) => {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
};
const inMap = count([...inputSkill, ...mapUniq.values(), micro308, microInit]);
const outMap = count(output.map(([, t]) => t));

const fail = [];
for (const [t, n] of inMap) {
  if ((outMap.get(t) ?? 0) !== n) fail.push(`in ${n}x / out ${outMap.get(t) ?? 0}x — ${JSON.stringify(t.slice(0, 50))}`);
}
for (const [t, n] of outMap) {
  if ((inMap.get(t) ?? 0) !== n) fail.push(`EXTRA out ${n}x — ${JSON.stringify(t.slice(0, 50))}`);
}
console.log(`input chunks: skill=${inputSkill.length}, map-unique=${mapUniq.size}, micro=2 (map fragments total=${mapFrags.length})`);
console.log(`output: ${names.length} files, ${output.length} sections`);
if (fail.length) {
  console.log('CONSERVATION MISMATCH:');
  for (const f of fail) console.log('  ' + f);
  process.exit(1);
}
console.log('CONSERVATION PASS: every original chain chunk appears exactly once as a section body on disk');

// pointer lines present, old tokens gone
const skillNow = readFileSync(join(ROOT, '.claude/skills/verify-pacman/SKILL.md'), 'utf8');
const mapNow = readFileSync(join(ROOT, '.claude/skills/verify-pacman/features/README.md'), 'utf8');
const ptrSkill = skillNow.split('\n').find((l) => l.startsWith('变更历史:'));
const ptrMap = mapNow.split('\n').find((l) => l.startsWith('变更历史:'));
if (!ptrSkill || !ptrMap) throw new Error('pointer lines missing');
for (const [nm, c] of [['SKILL.md', skillNow], ['features/README.md', mapNow]]) {
  // the pointer line may quote the retired form's name; a live chain would be
  // a line starting with "Last updated: " or any 前序 separator token
  if (c.split('\n').some((l) => l.startsWith('Last updated: ')) || c.includes('前序')) {
    throw new Error(`${nm} still carries old tokens`);
  }
}
console.log('POINTER PASS: both files carry 变更历史 pointer; no Last updated / 前序 tokens remain');
