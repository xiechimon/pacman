// Board drag & drop commit core (issue #73, re-cut by #616). The gesture
// rides the locked @dnd-kit stack (01-stack-v2 §4.1); every decision a
// settled drop makes — phase rewrite, end-of-column landing, orderIndex
// re-sequence — lives in dnd.ts so it stays testable without a DOM.
// #616 (todos.dev 2026-10-02 live 实测): 拖拽 = 纯跨列改相载体——同列落位
// 无操作（参考站无列内重排），落点 = 目标列视图末尾；#351: 待处理 is not a
// drop target (gate/failed are system states) — a drop there is the
// identity；执行中 不经此路（startGate → 开始任务 dialog，确认才写相位）。
import { describe, expect, test } from 'vitest';
import { moveTodo } from '../src/board/dnd.js';
import { NOW, todo } from './helpers.js';

describe('moveTodo（#616：跨列 = 改相 + 落目标列尾）', () => {
  const a = todo(1, 'todo');
  const b = todo(2, 'todo');
  const c = todo(3, 'todo');

  test('跨列：phase 取目标列正名 + phaseAt 刷新，落在目标列视图末尾', () => {
    const run = todo(6, 'building');
    const next = moveTodo([a, b, run], a.id, 'building', NOW);
    const moved = next.find((t) => t.id === a.id);
    expect(moved?.phase).toBe('building');
    expect(moved?.phaseAt).toBe(NOW);
    // 目标列既有卡之后 = 末尾
    expect(next.filter((t) => t.phase === 'building').map((t) => t.id)).toEqual([run.id, a.id]);
  });

  test('跨列到空目标列：卡落全集尾，列视图只有它', () => {
    const next = moveTodo([a, b, c], a.id, 'done', NOW);
    expect(next.find((t) => t.id === a.id)?.phase).toBe('done');
    expect(next.filter((t) => t.phase === 'done').map((t) => t.id)).toEqual([a.id]);
    expect(next.map((t) => t.id)).toEqual([b.id, c.id, a.id]);
  });

  test('同列落位 = 恒等（#616：参考站无列内重排语义）', () => {
    const input = [a, b, c];
    expect(moveTodo(input, b.id, 'todo', NOW)).toBe(input);
  });

  test('待处理不作落点：跨列拖入 = 原样返回（不改相不动序，#351）', () => {
    const next = moveTodo([a, b, c], a.id, 'pending', NOW);
    expect(next.map((t) => t.id)).toEqual([a.id, b.id, c.id]);
    expect(next.find((t) => t.id === a.id)?.phase).toBe('todo');
  });

  test('orderIndex 回写 = 各列视图序（01 §4.1 列内 orderIndex 排序）', () => {
    const next = moveTodo([a, b, c], c.id, 'done', NOW);
    expect(next.filter((t) => t.phase === 'todo').map((t) => t.orderIndex)).toEqual([0, 1]);
    expect(next.find((t) => t.id === c.id)?.orderIndex).toBe(0);
  });

  test('不 mutate 入参（page state 直接持有 fixture 记录）', () => {
    const before = JSON.stringify([a, b, c]);
    moveTodo([a, b, c], a.id, 'done', NOW);
    expect(JSON.stringify([a, b, c])).toBe(before);
  });

  test('未知 todo / 未知列 = 恒等（防御）', () => {
    expect(moveTodo([a, b], 'nope', 'done', NOW).map((t) => t.id)).toEqual([a.id, b.id]);
    expect(moveTodo([a, b], a.id, 'nope', NOW).map((t) => t.id)).toEqual([a.id, b.id]);
  });
});
