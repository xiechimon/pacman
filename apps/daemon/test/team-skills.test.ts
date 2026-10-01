// 团队技能物化（XMON-112 S2，spec 14）：GET /api/machine/skills/{stepId}
// 响应包 → 本机内容寻址缓存目录。失败方式清单先于实现固化（票面纪律）：
//   M1 正常包 → 返回缓存目录；每技能 dirName 子目录 + 文件落盘、内容逐字节
//      （含嵌套相对路径）；`team: N skill(s) materialized` 日志行
//   M2 空包 {skills:[]} → null，cacheRoot 下不创建任何目录（零回归判据的
//      物化侧：白名单空 = 无团队目录 = catalog 走纯本机路径）
//   M3 同包重物化（跨步复用）→ 返回同一目录且不重写（文件 mtime 探针不变）
//      + `cache hit` 日志行
//   M4 内容变化 → 新 hash 目录，旧目录并存（由 pruning 管生命周期）
//   M5 dirName 不安全（../evil、绝对路径、含分隔符、. / ..）→ 整包拒绝：
//      null + `team-invalid` 日志行，cacheRoot 内外零写入
//   M6 file path 不安全（../escape.txt、绝对路径、空段）→ 同 M5 拒绝
//   M7 原子写：成功后 cacheRoot 下无 `.tmp-` 残留目录
//   M8 pruning：条目超过 maxEntries → 只留最新（mtime LRU），最旧被删
//   M9 复用触摸 mtime：cache hit 目录在 pruning 排序中视为最新使用

import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MachineSkillsResponse } from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import { materializeTeamSkills, TEAM_SKILLS_CACHE_MAX_ENTRIES } from '../src/team-skills.js';

function cacheRoot(tag: string): string {
  return join(mkdtempSync(join(tmpdir(), `pacman-team-skills-${tag}-`)), 'team-skills');
}

function skillPkg(skills: MachineSkillsResponse['skills']): MachineSkillsResponse {
  return { skills };
}

function demoSkill(marker: string): MachineSkillsResponse['skills'][number] {
  return {
    id: 'deploy-demo',
    name: 'deploy-demo',
    description: '演示部署技能。',
    dirName: 'deploy-demo',
    files: [
      {
        path: 'SKILL.md',
        content: `---\nname: deploy-demo\ndescription: 演示部署技能。\n---\n\n${marker}\n`,
      },
      { path: 'refs/runbook.md', content: `${marker} runbook\n` },
    ],
  };
}

function collectLogs(): { logs: string[]; log: (msg: string) => void } {
  const logs: string[] = [];
  return { logs, log: (msg) => logs.push(msg) };
}

describe('materializeTeamSkills（M1–M9）', () => {
  test('M1 正常包 → 缓存目录 + 文件逐字节落盘（含嵌套路径）+ materialized 日志行', () => {
    const root = cacheRoot('m1');
    const { logs, log } = collectLogs();
    const dir = materializeTeamSkills({ cacheRoot: root, pkg: skillPkg([demoSkill('v1')]), log });
    expect(dir).not.toBeNull();
    expect(readFileSync(join(dir!, 'deploy-demo', 'SKILL.md'), 'utf8')).toContain('v1');
    expect(readFileSync(join(dir!, 'deploy-demo', 'refs', 'runbook.md'), 'utf8')).toBe(
      'v1 runbook\n',
    );
    expect(logs.some((l) => l.startsWith('team: 1 skill(s) materialized'))).toBe(true);
  });

  test('M2 空包 → null 且 cacheRoot 零创建', () => {
    const root = cacheRoot('m2');
    const { logs, log } = collectLogs();
    const dir = materializeTeamSkills({ cacheRoot: root, pkg: skillPkg([]), log });
    expect(dir).toBeNull();
    expect(existsSync(root)).toBe(false);
    expect(logs).toEqual([]);
  });

  test('M3 同包重物化 → 同一目录、不重写（文件 mtime 探针不变）+ cache hit 行', () => {
    const root = cacheRoot('m3');
    const pkg = skillPkg([demoSkill('v1')]);
    const first = materializeTeamSkills({ cacheRoot: root, pkg });
    const probe = join(first!, 'deploy-demo', 'SKILL.md');
    const old = new Date(Date.now() - 60_000);
    utimesSync(probe, old, old);
    const { logs, log } = collectLogs();
    const second = materializeTeamSkills({ cacheRoot: root, pkg, log });
    expect(second).toBe(first);
    expect(readFileSync(probe, 'utf8')).toContain('v1');
    // 未被重写：mtime 仍是探针设置的旧值（容差 1s = 文件系统时间粒度）。
    const mtime = statSync(probe).mtime;
    expect(Math.abs(mtime.getTime() - old.getTime())).toBeLessThan(1_000);
    expect(logs.some((l) => l.startsWith('team: 1 skill(s) cache hit'))).toBe(true);
  });

  test('M4 内容变化 → 新目录；两包目录并存', () => {
    const root = cacheRoot('m4');
    const dirA = materializeTeamSkills({ cacheRoot: root, pkg: skillPkg([demoSkill('v1')]) });
    const dirB = materializeTeamSkills({ cacheRoot: root, pkg: skillPkg([demoSkill('v2')]) });
    expect(dirB).not.toBe(dirA);
    expect(readFileSync(join(dirA!, 'deploy-demo', 'SKILL.md'), 'utf8')).toContain('v1');
    expect(readFileSync(join(dirB!, 'deploy-demo', 'SKILL.md'), 'utf8')).toContain('v2');
    expect(readdirSync(root).length).toBe(2);
  });

  test.each([
    ['../evil', 'parent-escape'],
    ['/etc/evil', 'absolute'],
    ['a/b', 'separator'],
    ['.', 'dot'],
    ['..', 'dotdot'],
    ['', 'empty'],
  ])('M5 dirName 不安全 %s → 整包拒绝 null + team-invalid 行 + 零写入', (dirName) => {
    const root = cacheRoot('m5');
    const sentinel = join(root, '..', 'sentinel-escape');
    const { logs, log } = collectLogs();
    const dir = materializeTeamSkills({
      cacheRoot: root,
      pkg: skillPkg([{ ...demoSkill('x'), dirName }]),
      log,
    });
    expect(dir).toBeNull();
    expect(logs.some((l) => l.startsWith('team-invalid:'))).toBe(true);
    expect(existsSync(sentinel)).toBe(false);
    if (existsSync(root)) {
      expect(readdirSync(root).filter((e) => !e.startsWith('.tmp-'))).toEqual([]);
    }
  });

  test.each([
    ['../escape.txt', 'parent-escape'],
    ['/etc/passwd', 'absolute'],
    ['a//b.md', 'empty-segment'],
    ['./SKILL.md', 'dot-segment'],
    ['..\\SKILL.md', 'backslash-escape'],
  ])('M6 file path 不安全 %s → 整包拒绝 null + team-invalid 行', (path) => {
    const root = cacheRoot('m6');
    const { logs, log } = collectLogs();
    const dir = materializeTeamSkills({
      cacheRoot: root,
      pkg: skillPkg([{ ...demoSkill('x'), files: [{ path, content: 'x' }] }]),
      log,
    });
    expect(dir).toBeNull();
    expect(logs.some((l) => l.startsWith('team-invalid:'))).toBe(true);
  });

  test('M7 原子写：成功后无 .tmp- 残留', () => {
    const root = cacheRoot('m7');
    materializeTeamSkills({ cacheRoot: root, pkg: skillPkg([demoSkill('v1')]) });
    expect(readdirSync(root).filter((e) => e.includes('.tmp-'))).toEqual([]);
  });

  test('M8 pruning：超过 maxEntries → 只留最新，最旧被删', () => {
    const root = cacheRoot('m8');
    const max = 3;
    const dirs: string[] = [];
    for (let i = 0; i < max + 2; i++) {
      const d = materializeTeamSkills({
        cacheRoot: root,
        pkg: skillPkg([{ ...demoSkill(`v${i}`), id: `s${i}`, name: `s${i}`, dirName: `s${i}` }]),
        maxEntries: max,
      });
      dirs.push(d!);
      // 显式错开 mtime，LRU 排序确定（i 越大越新）。
      const t = new Date(Date.now() - (max + 2 - i) * 10_000);
      utimesSync(d!, t, t);
    }
    const left = readdirSync(root);
    expect(left.length).toBeLessThanOrEqual(max);
    // 最新写入的目录还在；最早的两个已被 pruning 删除。
    expect(existsSync(dirs[dirs.length - 1]!)).toBe(true);
    expect(existsSync(dirs[0]!)).toBe(false);
  });

  test('M9 默认保留上限为常量值；cache hit 触摸目录 mtime（LRU 视为最新）', () => {
    expect(TEAM_SKILLS_CACHE_MAX_ENTRIES).toBeGreaterThan(0);
    const root = cacheRoot('m9');
    const pkg = skillPkg([demoSkill('v1')]);
    const dir = materializeTeamSkills({ cacheRoot: root, pkg })!;
    const old = new Date(Date.now() - 60_000);
    utimesSync(dir, old, old);
    materializeTeamSkills({ cacheRoot: root, pkg });
    expect(statSync(dir).mtime.getTime()).toBeGreaterThan(old.getTime() + 30_000);
  });
});
