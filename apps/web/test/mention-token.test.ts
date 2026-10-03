// #728 插入面单测——insertMentionText 的尾随空格 + caret 落点 + 区间替换。
// 正典双参考：CC rule 26（accept → token + trailing space）+ todos.dev
// r9 §3.2（插入形 ` @r3-builder ` 两侧带空格）。每条用例钉票面失败方式：
//   I1 尾随空格缺失或 caret 落 token 内（失败方式 6：继续键入插进
//      `[label](scheme:id)` 中段 → markdown 破坏）
//   I2 插入位置错位（失败方式 5：`at = caret - query.length - 1` 的
//      重算漂移会吃掉邻近文本——改用存储区间 [start, replaceEnd) 替换）
//   I3 共享 helper 回归（失败方式 11：前导空格逻辑与 append 路径是
//      popover 多选 / 新建任务对话框两消费面的既有行为，不得漂移）
//   I4 @query 残留（现状缺陷：inline 路径只插不删，`hello @bu` 插完
//      变 `hello [builder](agent:a1)@bu`——replaceEnd 修复后钉死）
import { describe, expect, test } from 'vitest';
import {
  insertMentionText,
  type MentionToken,
  parseMentionSegments,
  serializeMention,
} from '../src/overlay/mention-token.js';

const BUILDER: MentionToken = { kind: 'agent', label: 'builder', id: 'a1' };
const SERIALIZED = serializeMention(BUILDER); // [builder](agent:a1)

describe('insertMentionText 尾随空格 + caret（I1/rule 26 + r9 §3.2）', () => {
  test('文末插入：token + 一个尾随空格，caret 落空格后', () => {
    const r = insertMentionText('hello ', BUILDER, 6);
    expect(r.value).toBe(`hello ${SERIALIZED} `);
    expect(r.caret).toBe(r.value.length);
  });

  test('词中插入：前后各补一个空格（r9 §3.2 两侧带空格形）', () => {
    // caret 紧贴非空白（"hello|world"）——前导空格补、尾随空格补
    const r = insertMentionText('helloworld', BUILDER, 5);
    expect(r.value).toBe(`hello ${SERIALIZED} world`);
    expect(r.caret).toBe(6 + SERIALIZED.length + 1); // 尾随空格之后
  });

  test('后邻已是空白：不双空格，caret 仍落 token 后（尾随空白即 caret 位）', () => {
    const r = insertMentionText('hello  world', BUILDER, 6);
    expect(r.value).toBe(`hello ${SERIALIZED} world`);
    expect(r.caret).toBe(6 + SERIALIZED.length);
  });

  test('前邻已是空白：不双前导空格（既有行为不回归，I3）', () => {
    const r = insertMentionText('hi ', BUILDER, 3);
    expect(r.value).toBe(`hi ${SERIALIZED} `);
    expect(r.value.startsWith('hi  ')).toBe(false);
  });

  test('at = null 追加路径：piece 两侧带空格（I3 既有行为）', () => {
    const r = insertMentionText('draft', BUILDER, null);
    expect(r.value).toBe(`draft ${SERIALIZED} `);
    expect(r.caret).toBe(r.value.length);
  });

  test('caret 落点可继续键入：插入后紧接字符落尾随空格之后，不破坏 markdown（I1）', () => {
    const r = insertMentionText('', BUILDER, 0);
    const typed = `${r.value.slice(0, r.caret)}x${r.value.slice(r.caret)}`;
    expect(typed).toBe(`${SERIALIZED} x`);
    // round-trip：插入产物仍解析回同一个 mention chip
    const segs = parseMentionSegments(r.value);
    expect(segs.filter((s) => s.kind === 'mention')).toHaveLength(1);
  });
});

describe('insertMentionText 区间替换（I2+I4，inline @ 路径）', () => {
  test('@query 被整个替换，无残留（I4 现状缺陷钉死）', () => {
    // "hello @bu" 检测区间 [6, 9)——替换后只剩序列化 token + 尾随空格
    const r = insertMentionText('hello @bu', BUILDER, 6, 9);
    expect(r.value).toBe(`hello ${SERIALIZED} `);
    expect(r.caret).toBe(r.value.length);
  });

  test('@query 后还有文本：替换区间只吃 [start, end)，邻近文本原样（I2）', () => {
    const r = insertMentionText('@bu rest', BUILDER, 0, 3);
    expect(r.value).toBe(`${SERIALIZED} rest`);
    expect(r.caret).toBe(SERIALIZED.length); // 后邻是空格 → 不补尾随
  });

  test('空 query（裸 @）替换：只吃 @ 一个字符', () => {
    const r = insertMentionText('hi @', BUILDER, 3, 4);
    expect(r.value).toBe(`hi ${SERIALIZED} `);
  });

  test('replaceEnd 缺省 = 纯插入（popover / 新建任务路径不受影响，I3）', () => {
    const r = insertMentionText('hello @bu', BUILDER, 6);
    // 无 replaceEnd 时不删任何字符——@bu 保留（popover 语义）
    expect(r.value).toContain('@bu');
  });

  test('replaceEnd 越界钳制到 value 长度（防陈旧区间吃穿文本，I2）', () => {
    const r = insertMentionText('hello @bu', BUILDER, 6, 99);
    expect(r.value).toBe(`hello ${SERIALIZED} `);
  });
});

describe('serializeMention（既有 wire 形不回归，I3）', () => {
  test('agent → markdown link + agent: scheme', () => {
    expect(SERIALIZED).toBe('[builder](agent:a1)');
  });

  test('todo → 纯文本 #seq', () => {
    expect(serializeMention({ kind: 'todo', label: '#3', id: 't1', seq: 3 })).toBe('#3');
  });

  test('label 含 ] 与 \\ 时转义（escapeLabel 既有面）', () => {
    expect(serializeMention({ kind: 'agent', label: 'a]b\\c', id: 'x' })).toBe(
      '[a\\]b\\\\c](agent:x)',
    );
  });
});
