// PWA byte-level seam (issue #74, 01-stack-v2 §7 acceptance point 7):
// manifest.webmanifest + sw.js are carried over verbatim from the r1
// capture originals. Current brand phase is 先原样 (素材替换计划 D3), so
// the diff against docs/research/assets/r1/ must be exactly zero bytes;
// when #44 replacement triggers, the only permitted divergence is the
// BRAND_SLOTS.manifestName slot (Todos → Pacman) — this test is the gate
// that keeps the rest of the files frozen.
// sw.js keeps its push handler file shape although the server never sends
// push (04-验收口径 §5 divergence A5: dead code tolerated, registered).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const R1_DIR = resolve(ROOT, 'docs/research/assets/r1');
const PUBLIC_DIR = resolve(ROOT, 'apps/web/public');

describe('PWA files vs r1 capture originals', () => {
  it.each(['manifest.webmanifest', 'sw.js'])('%s is byte-identical', (file) => {
    const original = readFileSync(resolve(R1_DIR, file));
    const shipped = readFileSync(resolve(PUBLIC_DIR, file));
    expect(shipped.equals(original)).toBe(true);
  });

  it('sw.js keeps the push + notificationclick handler shape', () => {
    const sw = readFileSync(resolve(PUBLIC_DIR, 'sw.js'), 'utf8');
    expect(sw).toContain("self.addEventListener('push'");
    expect(sw).toContain("self.addEventListener('notificationclick'");
    // no fetch handler — the capture's defining property (r1 §5.3 point 2)
    expect(sw).not.toContain("addEventListener('fetch'");
  });

  it('index.html links the manifest', () => {
    const html = readFileSync(resolve(ROOT, 'apps/web/index.html'), 'utf8');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
  });
});
