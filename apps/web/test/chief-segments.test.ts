// 段行投影（#955 / ADR 0011）：思考段单列一行、工具行在回合在飞时平铺。
// 失败方式枚举先于实现固化（AGENTS.md 测试规则 3）：
//   F1 在飞期工具行不出现：activeRun 在位时工具行必须平铺进主呈现。
//   F2 顺序反了：工具行必须排在它**之后**那条文本行之前（daemon 封段保证
//      createdAt 单调；投影按落库序，不得重排）。
//   F3 收口后仍平铺：回合收口（activeRun 清）后工具必须回到 robot 行的
//      `tools` 折叠面——r5 canon 的落库形，不是两套并存。
//   F4 思考段被吞：无正文的 thinking 行必须出 thinking 项，不是消失。
//   F5 混合行双出：存量的原始块数组（text + thinking 同一条）仍只出 robot
//      行，思考不重复呈现。
//   F6 默认面漂移：不传 inlineTools 的既有调用（mapChiefStream 单参）投影
//      必须与改动前逐字相同。

import { describe, expect, test } from 'vitest';
import { mapChiefStream, type MessageRow } from '../src/api/mappers.js';

const row = (id: string, role: MessageRow['role'], content: unknown, createdAt: number): MessageRow =>
  ({ id, role, content, createdAt }) as MessageRow;

const text = (t: string) => [{ type: 'text', text: t }];
const thinking = (t: string) => [{ type: 'thinking', thinking: t }];
const toolcall = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  kind: 'toolcall',
  call: { id, name, arguments: {}, startedAt: 1000, ...extra },
});

describe('段行投影（F1..F6）', () => {
  test('F1 回合在飞时工具行平铺进主呈现', () => {
    const items = mapChiefStream(
      [
        row('m1', 'assistant', text('先说一句'), 1),
        row('t1', 'assistant', toolcall('c1', 'bash'), 2),
      ],
      true,
    );
    expect(items.map((i) => i.kind)).toEqual(['robot', 'tool']);
  });

  test('F2 工具行排在其后的文本段之前，且不重排落库序', () => {
    const items = mapChiefStream(
      [
        row('m1', 'assistant', text('甲'), 1),
        row('t1', 'assistant', toolcall('c1', 'bash'), 2),
        row('m2', 'assistant', text('乙'), 3),
      ],
      true,
    );
    expect(items.map((i) => i.kind)).toEqual(['robot', 'tool', 'robot']);
    expect(items[0]).toMatchObject({ kind: 'robot', markdown: '甲' });
    expect(items[2]).toMatchObject({ kind: 'robot', markdown: '乙' });
  });

  test('F2 无 result 的调用带 running 位，有 result 的带秒数', () => {
    const items = mapChiefStream(
      [
        row('t1', 'assistant', toolcall('c1', 'bash'), 1),
        row('t2', 'assistant', toolcall('c2', 'read', { endedAt: 3000, result: 'ok' }), 2),
      ],
      true,
    );
    expect(items[0]).toEqual({ kind: 'tool', label: 'bash', startedAt: 1000, running: true });
    expect(items[1]).toEqual({ kind: 'tool', label: 'read', startedAt: 1000, seconds: 2 });
  });

  test('F3 回合收口后工具回到 robot 行的 tools 折叠面，不再平铺', () => {
    const messages = [
      row('t1', 'assistant', toolcall('c1', 'bash', { endedAt: 3000 }), 1),
      row('m1', 'assistant', text('甲'), 2),
    ];
    const inFlight = mapChiefStream(messages, true);
    expect(inFlight.map((i) => i.kind)).toEqual(['tool', 'robot']);
    const settled = mapChiefStream(messages, false);
    expect(settled.map((i) => i.kind)).toEqual(['robot']);
    expect(settled[0]).toMatchObject({ kind: 'robot', tools: [{ label: 'bash', seconds: 2 }] });
  });

  test('F4 无正文的 thinking 行出 thinking 项', () => {
    const items = mapChiefStream([row('m1', 'assistant', thinking('想了一下'), 1)]);
    expect(items).toEqual([{ kind: 'thinking', text: '想了一下' }]);
  });

  test('F5 混合行（text + thinking）仍只出 robot 行，思考不重复', () => {
    const items = mapChiefStream([
      row('m1', 'assistant', [...text('正文'), ...thinking('顺带想了想')], 1),
    ]);
    expect(items.map((i) => i.kind)).toEqual(['robot']);
    expect(items[0]).toMatchObject({ kind: 'robot', markdown: '正文' });
  });

  test('F6 默认面（不传 inlineTools）投影与改动前同形', () => {
    const items = mapChiefStream([
      row('m1', 'assistant', text('甲'), 1),
      row('t1', 'assistant', toolcall('c1', 'bash', { endedAt: 3000 }), 2),
      row('m2', 'assistant', text('乙'), 3),
    ]);
    expect(items.map((i) => i.kind)).toEqual(['robot', 'robot']);
    expect(items[0]).toEqual({ kind: 'robot', markdown: '甲', seconds: '' });
    expect(items[1]).toMatchObject({ kind: 'robot', markdown: '乙', tools: [{ label: 'bash' }] });
  });
});