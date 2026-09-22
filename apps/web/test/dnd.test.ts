// Board drag & drop commit core (issue #73). The gesture rides the locked
// @dnd-kit stack (01-stack-v2 §4.1); every decision a settled drop makes —
// what it does to phase/order/orderIndex — lives in dnd.ts so it stays
// testable without a DOM.
import { describe, expect, test } from 'vitest';
import { moveTodo } from '../src/board/dnd.js';
import { NOW, todo } from './helpers.js';

describe('moveTodo（落位 = 排序 + 手动改相，r2 §4.2 计数联动 / r5b 折叠）', () => {
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
    const next = moveTodo([a, b, c], a.id, { columnId: 'planning', index: 0 }, NOW);
    const moved = next.find((t) => t.id === a.id);
    expect(moved?.phase).toBe('planning');
    expect(moved?.phaseAt).toBe(NOW);
    // 目标列视图内落在 index 0
    expect(next.filter((t) => t.phase === 'planning').map((t) => t.id)).toEqual([a.id]);
  });

  test('跨列到待验收：awaitingReply 清位（否则折叠回执行中，落位失败）', () => {
    const waiting = todo(4, 'review', true);
    const next = moveTodo([waiting, a], waiting.id, { columnId: 'review', index: 0 }, NOW);
    const moved = next.find((t) => t.id === waiting.id);
    expect(moved?.phase).toBe('review');
    expect(moved?.awaitingReply).toBe(false);
  });

  test('failed 卡拖回本列（执行中）= 纯排序，不改相（pinned 组内可排序）', () => {
    const failedCard = todo(5, 'failed');
    const run = todo(6, 'building');
    const next = moveTodo([failedCard, run], failedCard.id, { columnId: 'building', index: 1 }, NOW);
    expect(next.map((t) => t.id)).toEqual([run.id, failedCard.id]);
    expect(next.find((t) => t.id === failedCard.id)?.phase).toBe('failed');
  });

  test('跨列离执行中：failed 卡拖到待开始 = 改相 todo', () => {
    const failedCard = todo(5, 'failed');
    const next = moveTodo([failedCard, a], failedCard.id, { columnId: 'todo', index: 0 }, NOW);
    expect(next.find((t) => t.id === failedCard.id)?.phase).toBe('todo');
  });

  test('跨列插入_index 计入目标列既有卡', () => {
    const planner = todo(6, 'planning');
    const planner2 = todo(7, 'planning');
    const next = moveTodo([a, planner, planner2], a.id, { columnId: 'planning', index: 1 }, NOW);
    expect(next.filter((t) => t.phase === 'planning').map((t) => t.id)).toEqual([
      planner.id,
      a.id,
      planner2.id,
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
