// 段缓冲（#955 / ADR 0011）单测。失败方式与 src/segment.ts 头注 F1..F7 一一
// 对应——每条先红后绿，实现是让场景通过的手段。

import { describe, expect, test } from 'vitest';
import { SegmentBuffer, segmentContent } from '../src/segment.js';

describe('SegmentBuffer（F1..F7）', () => {
  test('F1 同 kind 连追加只累积，不产出行', () => {
    const buf = new SegmentBuffer();
    expect(buf.append('text', '甲')).toBeNull();
    expect(buf.append('text', '乙')).toBeNull();
    expect(buf.append('text', '丙')).toBeNull();
    expect(buf.current()).toEqual({ kind: 'text', text: '甲乙丙' });
  });

  test('F2 异 kind 切换先封上一段并把上一段交出', () => {
    const buf = new SegmentBuffer();
    buf.append('text', '先说一句');
    const sealed = buf.append('thinking', '再想一下');
    expect(sealed).toEqual({ kind: 'text', text: '先说一句' });
    expect(buf.current()).toEqual({ kind: 'thinking', text: '再想一下' });
  });

  test('F3 封段清空缓冲——下一段不重复上一段文本', () => {
    const buf = new SegmentBuffer();
    buf.append('text', '第一段');
    expect(buf.seal()).toEqual({ kind: 'text', text: '第一段' });
    expect(buf.current()).toBeNull();
    buf.append('text', '第二段');
    expect(buf.seal()).toEqual({ kind: 'text', text: '第二段' });
  });

  test('F4 空段不出行：从未开段 / 封过之后再封都返回 null', () => {
    const buf = new SegmentBuffer();
    expect(buf.seal()).toBeNull();
    buf.append('text', '有内容');
    expect(buf.seal()).not.toBeNull();
    expect(buf.seal()).toBeNull();
  });

  test('F4 空串不改变段状态', () => {
    const buf = new SegmentBuffer();
    expect(buf.append('text', '')).toBeNull();
    expect(buf.current()).toBeNull();
    buf.append('text', '甲');
    expect(buf.append('text', '')).toBeNull();
    expect(buf.current()).toEqual({ kind: 'text', text: '甲' });
  });

  test('F5 全文事件是权威替换，不与已累积的增量相加', () => {
    const buf = new SegmentBuffer();
    buf.append('thinking', '想了一半');
    expect(buf.replace('thinking', '想了一半然后想完了')).toBeNull();
    expect(buf.seal()).toEqual({ kind: 'thinking', text: '想了一半然后想完了' });
  });

  test('F5 全文事件在异 kind 时先封上一段', () => {
    const buf = new SegmentBuffer();
    buf.append('text', '正文');
    const sealed = buf.replace('thinking', '全文思考');
    expect(sealed).toEqual({ kind: 'text', text: '正文' });
    expect(buf.seal()).toEqual({ kind: 'thinking', text: '全文思考' });
  });

  test('F6 封后 append 正常开新段', () => {
    const buf = new SegmentBuffer();
    buf.append('thinking', '想过');
    buf.seal();
    expect(buf.append('text', '说')).toBeNull();
    expect(buf.current()).toEqual({ kind: 'text', text: '说' });
  });

  test('F7 内容逐字保留（不 trim）', () => {
    const buf = new SegmentBuffer();
    buf.append('text', '  前后有空白\n\n');
    expect(buf.seal()).toEqual({ kind: 'text', text: '  前后有空白\n\n' });
  });

  test('segmentContent 产出单类型块数组形', () => {
    expect(segmentContent({ kind: 'text', text: '甲' })).toEqual([{ type: 'text', text: '甲' }]);
    expect(segmentContent({ kind: 'thinking', text: '乙' })).toEqual([
      { type: 'thinking', thinking: '乙' },
    ]);
  });
});
