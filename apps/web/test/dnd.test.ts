// Board drag & drop commit core (issue #73). The gesture rides the locked
// @dnd-kit stack (01-stack-v2 §4.1); every decision a settled drop makes —
// what it does to phase/order/orderIndex — lives in dnd.ts so it stays
// testable without a DOM. #351: 待处理 is not a drop target (gate/failed
// are system states) — a cross-column drop there is a no-op.
import { describe, expect, test } from 'vitest';
import { COLUMNS } from '../src/board/columns.js';
import { columnDropIndex, moveTodo } from '../src/board/dnd.js';
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

// #403 筛选面拖拽落点翻译：筛选激活时拖拽视图是列的子集，视图内落点
// index 直传给 moveTodo 会被全集列视图错读（隐藏卡占着序位）。翻译规则 =
// 锚卡映射：落点之后那张可见卡在全集列视图（排除被拖卡）中的位次；落在
// 可见末尾 = 跟在最后一张可见卡之后（而非全集末尾）。无隐藏卡时与旧直传
// `list.indexOf(active)` 恒等（回归 parity）。
describe('columnDropIndex（筛选视图落点 → 全集列视图位次，#403）', () => {
  const column = COLUMNS.find((c) => c.id === 'todo');
  if (column == null) throw new Error('todo column missing');
  const a = todo(1, 'todo');
  const b = todo(2, 'todo');
  const c = todo(3, 'todo');
  /** 列视图序 = orderIndex 升序；todo(seq) 全零 orderIndex 时 sort 稳定保入参序。 */
  const ids = (list: { id: string }[]) => list.map((t) => t.id);

  test('parity：无隐藏卡时与旧直传 index 恒等（中间落点）', () => {
    // 全集 [a,b,c]，a 拖到 c 后 → 可见 post-move [b,c,a]，旧 index = 2
    const index = columnDropIndex(column, [a, b, c], ids([b, c, a]), a.id);
    expect(index).toBe(2);
    const next = moveTodo([a, b, c], a.id, { columnId: 'todo', index }, NOW);
    expect(ids(next)).toEqual(ids([b, c, a]));
  });

  test('parity：无隐藏卡时与旧直传恒等（落回首位）', () => {
    const index = columnDropIndex(column, [a, b, c], ids([a, b, c]), a.id);
    expect(index).toBe(0);
  });

  test('隐藏卡占序：拖到可见卡之前 = 锚到该卡的全集位次', () => {
    // 全集 [a,b(hidden),c]，筛选可见 [a,c]；c 拖到 a 前 → 可见 post-move [c,a]
    const index = columnDropIndex(column, [a, b, c], ids([c, a]), c.id);
    const next = moveTodo([a, b, c], c.id, { columnId: 'todo', index }, NOW);
    expect(ids(next)).toEqual(ids([c, a, b])); // c 在 a 前，隐藏的 b 原位不动
  });

  test('落可见末尾 = 跟在最后可见卡之后，而非插进隐藏卡之前（所见即所得）', () => {
    // 全集 [a,b(hidden),c]，a 拖到可见末尾（c 后）→ 可见 post-move [c,a]。
    // 旧直传 index = list.indexOf(a) = 1 → moveTodo 会把 a 插到 c 之前
    // （anchor = 全集视图[1] = c），筛选一关落点与所见颠倒。
    const index = columnDropIndex(column, [a, b, c], ids([c, a]), a.id);
    const next = moveTodo([a, b, c], a.id, { columnId: 'todo', index }, NOW);
    expect(ids(next)).toEqual(ids([b, c, a])); // a 跟在 c 后 = 全集尾
  });

  test('落可见末尾而尾部有隐藏卡：跟在最后可见卡之后（不进全集尾）', () => {
    // 全集 [a,b,c(hidden)]，a 拖到可见末尾（b 后）→ 可见 post-move [b,a]
    const index = columnDropIndex(column, [a, b, c], ids([b, a]), a.id);
    const next = moveTodo([a, b, c], a.id, { columnId: 'todo', index }, NOW);
    expect(ids(next)).toEqual(ids([b, a, c])); // a 在 b 后、隐藏的 c 前
  });

  test('可见集只余被拖卡（同列其余全滤隐）：落全集末尾（定义行为）', () => {
    const index = columnDropIndex(column, [a, b], ids([a]), a.id);
    const next = moveTodo([a, b], a.id, { columnId: 'todo', index }, NOW);
    expect(ids(next)).toEqual(ids([b, a]));
  });

  test('activeId 不在可见视图（防御）：落全集末尾不炸', () => {
    const index = columnDropIndex(column, [a, b, c], ids([b, c]), a.id);
    expect(index).toBe(2);
  });
});
