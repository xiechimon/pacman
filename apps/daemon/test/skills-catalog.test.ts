// skills 执行面注入（spec 14 / #371）：buildSkillsCatalog 输入五态 + cap 双闸
// + appendSkillsCatalog 追加语义 + `[skills]` 日志行族。失败方式清单（票 #371
// 验收映射）：目录缺 / 目录空 / 目录无 SKILL.md / frontmatter 缺 name / name
// 碰撞 / catalog 超 cap / description 超长 / systemPrompt 被覆盖而非追加 /
// `[skills]` 前缀行不落盘。

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DAEMON_LOG_PREFIXES } from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import {
  appendSkillsCatalog,
  buildSkillsCatalog,
  SKILL_DESCRIPTION_CAP,
  SKILLS_CATALOG_CAP,
} from '../src/backend/pi.js';
import { createDaemonLogger, isLogPrefix } from '../src/log.js';

function fixtureRoot(tag: string): string {
  return mkdtempSync(join(tmpdir(), `pacman-skills-${tag}-`));
}

/** 写一个 skill 目录（<root>/<dirName>/SKILL.md）；返回 SKILL.md 绝对路径。 */
function writeSkill(
  root: string,
  dirName: string,
  opts: { name?: string; description?: string; body?: string } = {},
): string {
  const dir = join(root, dirName);
  mkdirSync(dir, { recursive: true });
  const fm: string[] = ['---'];
  if (opts.name !== undefined) fm.push(`name: ${opts.name}`);
  if (opts.description !== undefined) fm.push(`description: ${opts.description}`);
  fm.push('---', '');
  const file = join(dir, 'SKILL.md');
  writeFileSync(file, `${fm.join('\n')}\n${opts.body ?? `${dirName} body.`}\n`, 'utf8');
  return file;
}

function collect(skillsDir: string, allowlist?: string[]): { catalog: string; logs: string[] } {
  const logs: string[] = [];
  const catalog = buildSkillsCatalog({
    skillsDir,
    cwd: tmpdir(),
    ...(allowlist !== undefined ? { allowlist } : {}),
    log: (msg) => logs.push(msg),
  });
  return { catalog, logs };
}

describe('buildSkillsCatalog 输入五态（spec 14 Testing Decisions）', () => {
  test('env 指向不存在目录 = 空 catalog 不炸 + missing-skill-md 诊断透传', () => {
    const { catalog, logs } = collect(join(fixtureRoot('gone'), 'no-such-dir'));
    expect(catalog).toBe('');
    expect(logs.some((l) => l.startsWith('missing-skill-md:'))).toBe(true);
    expect(logs.some((l) => l.startsWith('loaded:'))).toBe(false);
  });

  test('目录存在但空 = 空 catalog，无诊断', () => {
    const { catalog, logs } = collect(fixtureRoot('empty'));
    expect(catalog).toBe('');
    expect(logs).toEqual([]);
  });

  test('目录含子目录但无 SKILL.md = 空 catalog（pi 递归扫描无命中）', () => {
    const root = fixtureRoot('nomd');
    mkdirSync(join(root, 'not-a-skill'), { recursive: true });
    writeFileSync(join(root, 'not-a-skill', 'notes.txt'), 'x', 'utf8');
    const { catalog } = collect(root);
    expect(catalog).toBe('');
  });

  test('正常 skill = catalog XML（name/description/location）+ read 工具指引 + loaded 行', () => {
    const root = fixtureRoot('normal');
    const file = writeSkill(root, 'demo-skill', {
      name: 'demo-skill',
      description: '演示技能：验证 catalog 注入。',
    });
    const { catalog, logs } = collect(root);
    expect(catalog).toContain('<available_skills>');
    expect(catalog).toContain('<name>demo-skill</name>');
    expect(catalog).toContain('<description>演示技能：验证 catalog 注入。</description>');
    expect(catalog).toContain(`<location>${file}</location>`);
    // fileReadTool='read'：catalog 指引用 read 工具按需加载（spec 14 注入形态）。
    expect(catalog).toContain('Use the read tool');
    expect(logs.some((l) => l.startsWith('loaded: 1 skills from '))).toBe(true);
  });

  test('frontmatter 缺 name = 回落目录名（与 #367 wire 形状同源）', () => {
    const root = fixtureRoot('fallback');
    writeSkill(root, 'fallback-dir', { description: '无 name 字段。' });
    const { catalog } = collect(root);
    expect(catalog).toContain('<name>fallback-dir</name>');
  });

  test('name 碰撞 = winner 单例入 catalog + collision 诊断透传', () => {
    const root = fixtureRoot('collision');
    writeSkill(root, 'a-dir', { name: 'dup-name', description: 'A 版。' });
    writeSkill(root, 'b-dir', { name: 'dup-name', description: 'B 版。' });
    const { catalog, logs } = collect(root);
    expect(catalog.split('<name>dup-name</name>').length - 1).toBe(1);
    const collision = logs.find((l) => l.startsWith('collision:'));
    expect(collision).toBeDefined();
    expect(collision).toContain('dup-name');
  });

  test('frontmatter 非法（name 含大写）= invalid-frontmatter 诊断透传', () => {
    const root = fixtureRoot('badfm');
    writeSkill(root, 'bad-name', { name: 'BadName', description: '名字含大写。' });
    const { logs } = collect(root);
    expect(logs.some((l) => l.startsWith('invalid-frontmatter:'))).toBe(true);
  });
});

describe('catalog cap 双闸（#371：catalog 不能无限增长）', () => {
  test(`skills > ${SKILLS_CATALOG_CAP} = 截顶 + cap 日志`, () => {
    const root = fixtureRoot('cap-total');
    const total = SKILLS_CATALOG_CAP + 1;
    for (let i = 0; i < total; i++) {
      writeSkill(root, `skill-${String(i).padStart(2, '0')}`, {
        name: `skill-${String(i).padStart(2, '0')}`,
        description: `批量技能 ${i}。`,
      });
    }
    const { catalog, logs } = collect(root);
    expect(catalog.split('<skill>').length - 1).toBe(SKILLS_CATALOG_CAP);
    expect(logs).toContain(`cap: total=${total} truncated=${SKILLS_CATALOG_CAP}`);
  });

  test(`description > ${SKILL_DESCRIPTION_CAP} 字符 = 截断 + … + cap 日志`, () => {
    const root = fixtureRoot('cap-desc');
    const long = 'x'.repeat(SKILL_DESCRIPTION_CAP + 50);
    writeSkill(root, 'long-desc', { name: 'long-desc', description: long });
    const { catalog, logs } = collect(root);
    expect(catalog).toContain(`${'x'.repeat(SKILL_DESCRIPTION_CAP)}…`);
    expect(catalog).not.toContain(long);
    expect(logs).toContain('cap: description truncated for long-desc');
  });

  test('description 在 cap 内 = 不截断、无 cap 日志', () => {
    const root = fixtureRoot('cap-ok');
    writeSkill(root, 'ok-desc', { name: 'ok-desc', description: 'y'.repeat(50) });
    const { catalog, logs } = collect(root);
    expect(catalog).toContain('y'.repeat(50));
    expect(logs.some((l) => l.startsWith('cap:'))).toBe(false);
  });
});

describe('allowlist 过滤四态（#372：agent.skills 白名单 = catalog 执行面闸）', () => {
  /** 两个 skill 的公共 fixture；返回扫描根。 */
  function twoSkillRoot(tag: string): string {
    const root = fixtureRoot(tag);
    writeSkill(root, 'alpha', { name: 'alpha', description: 'A 技能。' });
    writeSkill(root, 'beta', { name: 'beta', description: 'B 技能。' });
    return root;
  }

  test('allowlist 缺省（undefined）= 全量直通（chief 面语义，零回归）', () => {
    const { catalog, logs } = collect(twoSkillRoot('al-full'));
    expect(catalog).toContain('<name>alpha</name>');
    expect(catalog).toContain('<name>beta</name>');
    expect(logs.some((l) => l.startsWith('filtered:'))).toBe(false);
  });

  test('部分过滤 = 白名单内保留、名单外剔除 + filtered 行', () => {
    const { catalog, logs } = collect(twoSkillRoot('al-part'), ['alpha']);
    expect(catalog).toContain('<name>alpha</name>');
    expect(catalog).not.toContain('<name>beta</name>');
    expect(logs).toContain('filtered: beta not in agent allowlist');
  });

  test('空白名单（[]）= 空 catalog，无 <available_skills> 块（least-privilege）', () => {
    const { catalog, logs } = collect(twoSkillRoot('al-empty'), []);
    expect(catalog).toBe('');
    expect(logs).toContain('filtered: alpha not in agent allowlist');
    expect(logs).toContain('filtered: beta not in agent allowlist');
    expect(logs.some((l) => l.startsWith('loaded:'))).toBe(false);
  });

  test('白名单含未知 slug = 静默跳过不炸（#367 容忍语义同律）', () => {
    const { catalog, logs } = collect(twoSkillRoot('al-ghost'), ['alpha', 'ghost-slug']);
    expect(catalog).toContain('<name>alpha</name>');
    expect(catalog).not.toContain('ghost-slug');
    // filtered 行只为「目录里有但被裁掉」的 skill 而记；ghost 不在目录，无行。
    expect(logs).toContain('filtered: beta not in agent allowlist');
    expect(logs.some((l) => l.includes('ghost-slug'))).toBe(false);
  });

  test('过滤先于 cap 闸 = 白名单内条目不受目录总量截顶影响', () => {
    const root = fixtureRoot('al-cap');
    // 目录总量 > cap，但白名单只留 1 个排在扫描序后段的 skill：先过滤后 cap
    // 时它必然存活（若先 cap 后过滤，它可能被截顶裁掉 → 白名单失效）。
    const total = SKILLS_CATALOG_CAP + 5;
    for (let i = 0; i < total; i++) {
      writeSkill(root, `skill-${String(i).padStart(2, '0')}`, {
        name: `skill-${String(i).padStart(2, '0')}`,
        description: `批量技能 ${i}。`,
      });
    }
    const last = `skill-${String(total - 1).padStart(2, '0')}`;
    const { catalog, logs } = collect(root, [last]);
    expect(catalog).toContain(`<name>${last}</name>`);
    expect(logs.some((l) => l.startsWith('cap: total='))).toBe(false);
  });
});

describe('appendSkillsCatalog（spec 14 数据契约：追加而非覆盖）', () => {
  test('catalog 空 = base 原样（含 undefined）——零回归面', () => {
    expect(appendSkillsCatalog('BASE', '')).toBe('BASE');
    expect(appendSkillsCatalog(undefined, '')).toBeUndefined();
  });

  test('base 在位 = catalog 追加到末尾（catalog 自带 \\n\\n 空行分隔）', () => {
    const out = appendSkillsCatalog('BASE', '\n\n<available_skills></available_skills>');
    expect(out).toBe('BASE\n\n<available_skills></available_skills>');
  });

  test('base 缺省 = catalog 独立成 prompt（首空行剥除）', () => {
    expect(appendSkillsCatalog(undefined, '\n\nCATALOG')).toBe('CATALOG');
    expect(appendSkillsCatalog('', '\n\nCATALOG')).toBe('CATALOG');
  });
});

describe('[skills] 日志行族（02 §5.3 前缀词表扩位）', () => {
  test('DAEMON_LOG_PREFIXES 含 skills；isLogPrefix 认可', () => {
    expect(DAEMON_LOG_PREFIXES).toContain('skills');
    expect(isLogPrefix('skills')).toBe(true);
  });

  test('createDaemonLogger.skills(msg) 落盘 `[skills] msg` canon 行', () => {
    const root = fixtureRoot('log');
    const logFile = join(root, 'daemon.log');
    const logger = createDaemonLogger({ logFile });
    logger.skills('loaded: 1 skills from /tmp/x');
    const lines = readFileSync(logFile, 'utf8').split('\n');
    expect(lines).toContain('[skills] loaded: 1 skills from /tmp/x');
  });
});
