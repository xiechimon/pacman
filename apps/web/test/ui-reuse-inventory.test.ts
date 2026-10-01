// 复用清单同步门（apps/web/COMPONENTS.md ↔ 源码）
//
// 为什么需要它：UI 复用失败的头号原因是「写新东西前不知道已有的在哪」——
// 而组件清单这种东西天生会腐烂（写完就过期），所以清单要么有门，要么等于没有。
// 本 gate 只钉三件稳定事实，不钉数量（消费点数每改一处调用就会变，钉它只会变噪音）：
//
//   1. 新轨（src/components/ui/）每新增一个原语，必须在 COMPONENTS.md 登记；
//      —— 这条的副作用才是真正的复用门：作者被迫在读清单时看一眼「是不是已经有能用的」。
//   2. 清单里列的新轨件必须真实存在（防 doc 写成幽灵路径）。
//   3. 旧轨（src/ui/）已按 #417 裁决冻结：只许删、不许加新件；
//      新增 UI 件一律落新轨。删旧件不报错（迁移就是要删），往旧轨加件报错。
//
// 迁移期背景见 #417（全站铺开 shadcn/ui）+ #409（散件分级盘点）：试点 PR #416 已合并，
// primitives 基 = Base UI（@base-ui/react，#410 裁决）。

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = resolve(import.meta.dirname, '..');
const DOC = join(WEB, 'COMPONENTS.md');

const NEW_TRACK_DIR = join(WEB, 'src/components/ui');
const OLD_TRACK_DIR = join(WEB, 'src/ui');

// 清单里的两个机器可读段：<!-- inventory:<key> --> … <!-- /inventory:<key> -->
function section(md: string, key: string): string[] {
  const re = new RegExp(`<!-- inventory:${key} -->([\\s\\S]*?)<!-- /inventory:${key} -->`);
  const block = md.match(re)?.[1];
  if (block === undefined) return [];
  return block
    .split('\n')
    .map((l) => l.replace(/`/g, '').replace(/#.*$/, '').trim())
    .filter((l) => /^[\w.-]+\.(tsx|css)$/.test(l));
}

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir)
    .filter((f) => ext.test(f))
    .sort();
}

const md = existsSync(DOC) ? readFileSync(DOC, 'utf8') : '';
const listedNew = section(md, 'new-track');
const listedFrozen = section(md, 'old-track-frozen');
const onDiskNew = files(NEW_TRACK_DIR, /\.tsx$/);
const onDiskOld = files(OLD_TRACK_DIR, /\.(tsx|css)$/);

describe('复用清单与源码同步（apps/web/COMPONENTS.md）', () => {
  it('清单文件存在', () => {
    expect(
      existsSync(DOC),
      '缺 apps/web/COMPONENTS.md —— 复用向清单（有哪些件、该复用谁）是 UI 开工前必读，不能被删。',
    ).toBe(true);
  });

  it('新轨每个原语都已登记（新增组件前先读清单）', () => {
    const missing = onDiskNew.filter((f) => !listedNew.includes(f));
    expect(
      missing,
      `src/components/ui/ 下这些件没写进 COMPONENTS.md 的 new-track 段:\n  ${missing.join('\n  ')}\n` +
        `登记前先确认: 已有原语里真的没有能用的吗（这是本 gate 的用意）；确认要新增，就在清单里补一行并写清何时该用它。`,
    ).toEqual([]);
  });

  it('清单里的新轨件都真实存在（防幽灵路径）', () => {
    const ghost = listedNew.filter((f) => !onDiskNew.includes(f));
    expect(ghost, `COMPONENTS.md 列了不存在的文件:\n  ${ghost.join('\n  ')}`).toEqual([]);
  });

  it('旧轨已冻结：只许删不许加（#417 裁决，新件落新轨）', () => {
    const added = onDiskOld.filter((f) => !listedFrozen.includes(f));
    expect(
      added,
      `src/ui/ 是待退役的手工轨，按 #417 已冻结，不得新增:\n  ${added.join('\n  ')}\n` +
        `新件请落 src/components/ui/（shadcn + Base UI 基）；确需留在旧轨，就在 COMPONENTS.md 的 old-track-frozen 段补一行并说明理由。`,
    ).toEqual([]);
  });
});