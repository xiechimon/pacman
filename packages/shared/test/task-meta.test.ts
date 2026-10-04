// spec 15 #394：占位标题派生 + 固定标签词表（ADR 0002 D2/D4）。
// 失败方式先列（spec 15 Testing Decisions）：首行空白跳过、>50 截断带省略号、
// 全空白 → 空串（调用面兜底）、词表 6 词且 name 唯一。

import { describe, expect, it } from 'vitest';
import { derivePlaceholderTitle, FIXED_TAGS } from '../src/task-meta.js';

describe('derivePlaceholderTitle', () => {
  it('单行原文照返', () => {
    expect(derivePlaceholderTitle('给登录页加验证码')).toBe('给登录页加验证码');
  });

  it('多行取首行', () => {
    expect(derivePlaceholderTitle('修支付回调\n\n现在的情况：偶尔掉单')).toBe('修支付回调');
  });

  it('跳过前导空行取首个非空行', () => {
    expect(derivePlaceholderTitle('\n  \n修支付回调\n细节')).toBe('修支付回调');
  });

  it('首行去首尾空白', () => {
    expect(derivePlaceholderTitle('  修支付回调  \n细节')).toBe('修支付回调');
  });

  it('恰 50 字符不截断不加省略号', () => {
    const line = '一'.repeat(50);
    expect(derivePlaceholderTitle(line)).toBe(line);
  });

  it('51 字符截断到 50 并追加省略号', () => {
    const line = '一'.repeat(51);
    const result = derivePlaceholderTitle(line);
    expect(result).toBe(`${'一'.repeat(50)}…`);
    expect(result.length).toBe(51);
  });

  it('全空白 → 空串（调用面兜底文案）', () => {
    expect(derivePlaceholderTitle('')).toBe('');
    expect(derivePlaceholderTitle('   \n \n')).toBe('');
  });

  it('#757：首行是附件 token 行时取其后首个正文行（标题面不裸路径）', () => {
    expect(
      derivePlaceholderTitle('![pasted-image-1.png](attachment:team-1/att-1.png)\n修复登录'),
    ).toBe('修复登录');
  });

  it('#757：正文在前 token 在后时标题不变', () => {
    expect(derivePlaceholderTitle('修复登录\n![a.png](attachment:t/i.png)')).toBe('修复登录');
  });

  it('#757：全是 token 行时取首个 token 的文件名（chip 名）', () => {
    expect(
      derivePlaceholderTitle('![a.png](attachment:t/i.png)\n![b.png](attachment:t/i2.png)'),
    ).toBe('a.png');
  });

  it('#757：空 label 的 token 行跳过', () => {
    expect(derivePlaceholderTitle('![](attachment:t/i.png)\n修复登录')).toBe('修复登录');
  });

  it('#757：行中内联 token 只留文件名', () => {
    expect(derivePlaceholderTitle('看这个 ![a.png](attachment:t/i.png) 很重要')).toBe(
      '看这个 a.png 很重要',
    );
  });

  it('#757：超长文件名按 50 截断（与正文同律）', () => {
    const label = `${'a'.repeat(60)}.png`;
    const result = derivePlaceholderTitle(`![${label}](attachment:t/i.png)`);
    expect(result).toBe(`${label.slice(0, 50)}…`);
  });
});

describe('FIXED_TAGS', () => {
  it('固定 6 词表', () => {
    expect(FIXED_TAGS.map((t) => t.name)).toEqual([
      'bug',
      'feature',
      'improvement',
      'refactor',
      'docs',
      'chore',
    ]);
  });

  it('name 唯一、色为合法 hex、描述非空', () => {
    const names = new Set(FIXED_TAGS.map((t) => t.name));
    expect(names.size).toBe(FIXED_TAGS.length);
    for (const tag of FIXED_TAGS) {
      expect(tag.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(tag.description.length).toBeGreaterThan(0);
    }
  });
});
