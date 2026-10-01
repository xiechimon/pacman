// SKILL.md 入口文件的组装/拆分契约（XMON-114 S3）：frontmatter 是唯一真值——
// web 表单面（name/description 字段 + 正文 textarea）与 server 写面消费同一
// 套 parse/build，组装产物必须被解析器逐字段回读一致（round-trip）。
import { describe, expect, it } from 'vitest';
import {
  buildSkillEntry,
  parseSkillFrontmatter,
  SKILL_DIR_NAME_RE,
  splitSkillEntry,
} from '../src/index.js';

describe('SKILL_DIR_NAME_RE（目录名安全域）', () => {
  it('受理常规名', () => {
    for (const ok of ['deploy', 'a', 'A1', 'my-skill', 'my.skill', 'my_skill', 'x'.repeat(64)]) {
      expect(SKILL_DIR_NAME_RE.test(ok)).toBe(true);
    }
  });
  it('拒：空 / 非字母数字开头 / 非法字符 / 超 64 / 路径段', () => {
    for (const bad of ['', '-lead', '.lead', '_lead', 'a b', 'a/b', 'a\\b', '中', 'x'.repeat(65)]) {
      expect(SKILL_DIR_NAME_RE.test(bad)).toBe(false);
    }
  });
});

describe('parseSkillFrontmatter（自 server 上提，语义不动）', () => {
  it('解析单行 name/description', () => {
    expect(parseSkillFrontmatter('---\nname: a\ndescription: b\n---\n')).toEqual({
      name: 'a',
      description: 'b',
    });
  });
  it('无 frontmatter 块 → 空洞', () => {
    expect(parseSkillFrontmatter('no frontmatter')).toEqual({});
  });
  it('引号包裹值剥引号；折叠块标量不受理', () => {
    expect(parseSkillFrontmatter('---\nname: "quoted"\n---\n')).toEqual({ name: 'quoted' });
    expect(parseSkillFrontmatter('---\ndescription: >\n---\n')).toEqual({});
  });
});

describe('buildSkillEntry ↔ splitSkillEntry round-trip', () => {
  it('组装产物回读：name/description 逐字段一致，正文保留', () => {
    const content = buildSkillEntry('deploy', '部署流程手册', '# 步骤\n\n1. 构建\n2. 发布\n');
    const split = splitSkillEntry(content);
    expect(split.name).toBe('deploy');
    expect(split.description).toBe('部署流程手册');
    expect(split.body).toBe('# 步骤\n\n1. 构建\n2. 发布\n');
  });

  it('空正文：frontmatter 完整、body 空串', () => {
    const split = splitSkillEntry(buildSkillEntry('a', 'b', ''));
    expect(split).toEqual({ name: 'a', description: 'b', body: '' });
  });

  it('正文首尾空白收敛（编辑回写不抖空白）', () => {
    const split = splitSkillEntry(buildSkillEntry('a', 'b', '\n\n  正文  \n\n'));
    expect(split.body).toBe('正文\n');
  });

  it('split 受理盘上既有文件（frontmatter + 正文原样分离）', () => {
    const split = splitSkillEntry('---\nname: x\ndescription: y\n---\n\nhello\n');
    expect(split).toEqual({ name: 'x', description: 'y', body: 'hello\n' });
  });

  it('split 无 frontmatter → 全部归 body（与 parseSkillFrontmatter 空洞同律）', () => {
    expect(splitSkillEntry('# 直接正文\n')).toEqual({ body: '# 直接正文\n' });
  });

  it('引号包裹的描述 round-trip 失守（客户端预检要拦的形态）', () => {
    const split = splitSkillEntry(buildSkillEntry('a', '"quoted"', ''));
    expect(split.description).toBe('quoted'); // ≠ 输入 '"quoted"' → 对拍失败可被检出
  });
});
