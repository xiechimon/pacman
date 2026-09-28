#!/usr/bin/env node
// drizzle snapshot 链护栏（migration 纪律 01 §6 的补丁）。
//
// 为什么需要它：drizzle-kit 撞到 snapshot 父子链断裂时**只打印**一句
// 「... are pointing to a parent snapshot ... which is a collision.」然后
// **退出码 0**，而且不再生成任何迁移。CI 的 drift 步骤是
// `db:generate` + `git diff --exit-code`——generate 空转时 diff 自然为空，
// 于是闸恒绿：既测不出 schema 漂移，也生不出新迁移，而没有任何信号。
// （2026-09-28 实测：往 schema 加一列后 generate 不产出迁移、退出码仍为 0。）
//
// 所以护栏不能只看退出码。两道：
//   ① 链不变量（主）——按 _journal.json 的 idx 顺序取**现存**的快照，断言
//      prevId 逐条指向前一条的 id（首条为全零 UUID）。确定性强，不依赖
//      drizzle 的报错措辞，换版本也不失效。
//      注：journal 有条目而 snapshot 文件缺失（本轮实测：0008 的 snapshot 在
//      并线合并中丢失，0009 直接接在 0007 上）不判失败——drizzle 接受这种
//      跳过；但会打印出来，避免它悄悄变成常态。
//   ② drizzle-kit check 输出扫描（副）——它还能发现链以外的问题（内容层），
//      代价是一次进程调用。
// 任一不过 → 退出码 1。

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const META_DIR = join(SERVER_DIR, 'drizzle', 'meta');
const ZERO_UUID = '00000000000000000000000000000000';

const problems = [];
const notes = [];

// ① 链不变量
const journalPath = join(META_DIR, '_journal.json');
if (!existsSync(journalPath)) {
  problems.push(`缺少 ${journalPath}`);
} else {
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  const entries = [...(journal.entries ?? [])].sort((a, b) => a.idx - b.idx);
  if (entries.length === 0) problems.push('_journal.json 无 entries');

  let prev = null;
  for (const entry of entries) {
    const file = `${String(entry.idx).padStart(4, '0')}_snapshot.json`;
    const path = join(META_DIR, file);
    if (!existsSync(path)) {
      notes.push(`${file}: journal 有条目但 snapshot 文件缺失，链跳过它（drizzle 接受）`);
      continue;
    }
    const snap = JSON.parse(readFileSync(path, 'utf8'));
    const expected = prev === null ? ZERO_UUID : prev.id.replace(/-/g, '');
    const actual = String(snap.prevId).replace(/-/g, '');
    if (actual !== expected) {
      problems.push(
        `${file}: prevId=${actual.slice(0, 8)} 但应指向 ${
          prev === null ? '全零(首条)' : `${prev.file} 的 id=${expected.slice(0, 8)}`
        }（snapshot 链断裂——drizzle-kit 会静默拒绝生成迁移）`,
      );
    }
    prev = { id: snap.id, file };
  }
}

// ② drizzle-kit check 输出扫描（退出码不可信，故扫文本）
try {
  const out = execFileSync('pnpm', ['exec', 'drizzle-kit', 'check'], {
    cwd: SERVER_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (/collision|are pointing to a parent snapshot/i.test(out)) {
    problems.push('drizzle-kit check 报告 snapshot 父子冲突（详见其输出）');
  }
} catch (err) {
  const text = `${err?.stdout ?? ''}${err?.stderr ?? ''}`;
  if (/collision|are pointing to a parent snapshot/i.test(text)) {
    problems.push('drizzle-kit check 报告 snapshot 父子冲突（详见其输出）');
  } else {
    problems.push(`drizzle-kit check 执行失败：${err?.message ?? String(err)}`);
  }
}

for (const n of notes) process.stdout.write(`提示：${n}\n`);

if (problems.length > 0) {
  process.stderr.write('drizzle 护栏未通过：\n');
  for (const p of problems) process.stderr.write(`  - ${p}\n`);
  process.stderr.write(
    '\n修法：让 snapshot 链线性——第 N 条的 prevId 必须等于第 N-1 条的 id' +
      '（并行车道的 drizzle 撞号合并后常见断裂，见 01 §6 migration 纪律）。\n',
  );
  process.exit(1);
}
process.stdout.write('drizzle 护栏通过：snapshot 链线性、无父子冲突\n');