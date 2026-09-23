// PWA byte-level seam (issue #74, 01-stack-v2 §7 acceptance point 7):
// manifest.webmanifest + sw.js were carried over verbatim from the r1
// capture originals during the 复刻 phase (素材替换计划 D3 先原样).
// apple-mobile-web-app-title 槽：r1 原件与复刻 index.html 均无该 meta
// （r1 捕获未含），复刻面 N/A——无需切换，登记于此。
// D3 已触发（2026-09-23, #109）：品牌槽已切 replacement 值，本 gate 的新
// 契约 = 冻结面只允许素材替换计划 §3.4 的品牌槽 divergence——manifest
// name/short_name = Pacman + description 自写 + sw.js 通知兜底标题 =
// Pacman；其余字段/字节仍须与 docs/research/assets/r1/ 原件逐字节一致
// （icons URL 换 D8 产物、related_applications 等归后续替换票，未动）。
// sw.js keeps its push handler file shape although the server never sends
// push (04-验收口径 §5 divergence A5: dead code tolerated, registered).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const R1_DIR = resolve(ROOT, 'docs/research/assets/r1');
const PUBLIC_DIR = resolve(ROOT, 'apps/web/public');

/** manifest 品牌槽替换值（素材替换计划 §3.4：`Pacman` + 自写 description）。 */
const MANIFEST_BRAND = {
  name: 'Pacman',
  shortName: 'Pacman',
  description:
    'Pacman — a local-first, self-hosted workspace where humans direct the work and agents execute it.',
} as const;

describe('PWA files vs r1 capture originals (D3 replacement-phase gate)', () => {
  it('manifest.webmanifest diverges only in the §3.4 brand slots', () => {
    const original = JSON.parse(readFileSync(resolve(R1_DIR, 'manifest.webmanifest'), 'utf8'));
    const shipped = JSON.parse(readFileSync(resolve(PUBLIC_DIR, 'manifest.webmanifest'), 'utf8'));
    expect(shipped.name).toBe(MANIFEST_BRAND.name);
    expect(shipped.short_name).toBe(MANIFEST_BRAND.shortName);
    expect(shipped.description).toBe(MANIFEST_BRAND.description);
    // 其余字段与 r1 原件冻结一致（start_url 形状保留、icons 归 D8 票）
    const { name: _n, short_name: _s, description: _d, ...restShipped } = shipped;
    const { name: _on, short_name: _os, description: _od, ...restOriginal } = original;
    expect(restShipped).toEqual(restOriginal);
  });

  it('sw.js diverges only in the notification-title brand slot', () => {
    const original = readFileSync(resolve(R1_DIR, 'sw.js'), 'utf8');
    const shipped = readFileSync(resolve(PUBLIC_DIR, 'sw.js'), 'utf8');
    expect(shipped).toBe(original.replace("n.title || 'Todos'", "n.title || 'Pacman'"));
  });

  it('sw.js keeps the push + notificationclick handler shape', () => {
    const sw = readFileSync(resolve(PUBLIC_DIR, 'sw.js'), 'utf8');
    expect(sw).toContain("self.addEventListener('push'");
    expect(sw).toContain("self.addEventListener('notificationclick'");
    // no fetch handler — the capture's defining property (r1 §5.3 point 2)
    expect(sw).not.toContain("addEventListener('fetch'");
  });

  it('index.html links the manifest and carries the replaced title', () => {
    const html = readFileSync(resolve(ROOT, 'apps/web/index.html'), 'utf8');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    // 站点 <title> 品牌词槽（素材替换计划 §3.4：自写，从产品定位 = 产品名）
    expect(html).toContain('<title>Pacman</title>');
  });
});
