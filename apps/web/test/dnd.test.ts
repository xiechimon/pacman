// Board drag & drop commit core (issue #73). The gesture rides the locked
// @dnd-kit stack (01-stack-v2 §4.1); every decision a settled drop makes —
// what it does to phase/order/orderIndex — lives in dnd.ts so it stays
// testable without a DOM. #351: 待处理 is not a drop target (gate/failed
// are system states) — a cross-column drop there is a no-op.
import { describe, expect, test } from 'vitest';
import { moveTodo } from '../src/board/dnd.js';
import { NOW, todo } from './helpers.js';

describe('moveTodo（落位 = 排序 + 手动改相，r2 §4.2 计数联动）', () => {
  const a = todo(1, 'todo');
  const b = todo(2, 'todo');
  const c = todo(3, 'todo');

  test('同列下移：a 落到 index 2', () => {
    const next = moveTodo([a, b, c], a.id, { columnId: 'todo', index: 2 }, NOW);
    expect(next.map((t) => t.id)).toEqual([b.id, c.id, a.id]);
    expect(next.find((t) => t.id === a.id)?.phase).toBe('todo');
  });

  test('同列上移：c 落到 index 0', () => {
    const next = moveTodo([a, b, c], c.id, { columnId: 'todo', index: 0 }, NOW);
    expect(next.map((t) => t.id)).toEqual([c.id, a.id, b.id]);
  });

  test('原位落回 = 顺序不变', () => {
    const next = moveTodo([a, b, c], b.id, { columnId: 'todo', index: 1 }, NOW);
    expect(next.map((t) => t.id)).toEqual([a.id, b.id, c.id]);
  });

  test('跨列：phase 取目标列正名 + phaseAt 刷新', () => {
    const next = moveTodo([a, b, c], a.id, { columnId: 'building', index: 0 }, NOW);
    const moved = next.find((t) => t.id === a.id);
    expect(moved?.phase).toBe('building');
    expect(moved?.phaseAt).toBe(NOW);
    // 目标列视图内落在 index 0
    expect(next.filter((t) => t.phase === 'building').map((t) => t.id)).toEqual([a.id]);
  });

  test('待处理不作落点：跨列拖入 = 原样返回（不改相不动序，#351）', () => {
    const next = moveTodo([a, b, c], a.id, { columnId: 'pending', index: 0 }, NOW);
    expect(next.map((t) => t.id)).toEqual([a.id, b.id, c.id]);
    expect(next.find((t) => t.id === a.id)?.phase).toBe('todo');
  });

  test('failed 卡在本列（待处理）内拖动 = 纯排序，不改相（pinned 组内可排序）', () => {
    const failedCard = todo(5, 'failed');
    const review = todo(6, 'review');
    const next = moveTodo([failedCard, review], failedCard.id, { columnId: 'pending', index: 1 }, NOW);
    expect(next.map((t) => t.id)).toEqual([review.id, failedCard.id]);
    expect(next.find((t) => t.id === failedCard.id)?.phase).toBe('failed');
  });

  test('跨列出待处理：failed 卡拖到待开始 = 改相 todo', () => {
    const failedCard = todo(5, 'failed');
    const next = moveTodo([failedCard, a], failedCard.id, { columnId: 'todo', index: 0 }, NOW);
    expect(next.find((t) => t.id === failedCard.id)?.phase).toBe('todo');
  });

  test('跨列插入_index 计入目标列既有卡', () => {
    const run = todo(6, 'building');
    const run2 = todo(7, 'building');
    const next = moveTodo([a, run, run2], a.id, { columnId: 'building', index: 1 }, NOW);
    expect(next.filter((t) => t.phase === 'building').map((t) => t.id)).toEqual([
      run.id,
      a.id,
      run2.id,
    ]);
  });

  test('orderIndex 回写 = 各列视图序（01 §4.1 列内 orderIndex 排序）', () => {
    const next = moveTodo([a, b, c], a.id, { columnId: 'todo', index: 2 }, NOW);
    expect(next.map((t) => t.orderIndex)).toEqual([0, 1, 2]);
    expect(next.find((t) => t.id === b.id)?.orderIndex).toBe(0);
    expect(next.find((t) => t.id === a.id)?.orderIndex).toBe(2);
  });

  test('不 mutate 入参（page state 直接持有 fixture 记录）', () => {
    const before = JSON.stringify([a, b, c]);
    moveTodo([a, b, c], a.id, { columnId: 'todo', index: 2 }, NOW);
    expect(JSON.stringify([a, b, c])).toBe(before);
  });
});
