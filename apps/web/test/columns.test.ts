// Column view ordering (issue #73): failed / review-awaiting cards pin to
// the TOP of 执行中 (changelog 2026-09-12: "stays pinned to the top of the
// Building column"); everything else keeps manual/fixture order.
import { describe, expect, test } from 'vitest';
import { COLUMNS, sortColumnTodos, type BoardColumnDef } from '../src/board/columns.js';
import { todo } from './helpers.js';

function col(id: string): BoardColumnDef {
  const found = COLUMNS.find((c) => c.id === id);
  if (found == null) throw new Error(`no column ${id}`);
  return found;
}

const building = col('building');

describe('sortColumnTodos（pinned 组置顶，余者保序）', () => {
  test('执行中：failed 与 review+awaitingReply 置顶且内部保序', () => {
    const run = todo(1, 'building');
    const failed = todo(2, 'failed');
    const waiting = todo(3, 'review', true);
    const run2 = todo(4, 'building');
    const sorted = sortColumnTodos(building, [run, failed, waiting, run2]);
    expect(sorted.map((t) => t.id)).toEqual([failed.id, waiting.id, run.id, run2.id]);
  });

  test('非 pinned 列 = 原序透传', () => {
    const backlog = col('todo');
    const a = todo(1, 'todo');
    const b = todo(2, 'queued');
    expect(sortColumnTodos(backlog, [a, b]).map((t) => t.id)).toEqual([a.id, b.id]);
  });

  test('review 非 awaitingReply 在待验收列不置顶（本列无 pinned 组）', () => {
    const reviewCol = col('review');
    const a = todo(1, 'review');
    const b = todo(2, 'review');
    expect(sortColumnTodos(reviewCol, [a, b]).map((t) => t.id)).toEqual([a.id, b.id]);
  });
});

describe('sortColumnTodos（orderIndex = 手动序，01 §4.1）', () => {
  test('列内按 orderIndex 排，数组序仅作平局兜底', () => {
    const backlog = col('todo');
    const a = { ...todo(1, 'todo'), orderIndex: 1 };
    const b = { ...todo(2, 'queued'), orderIndex: 0 };
    expect(sortColumnTodos(backlog, [a, b]).map((t) => t.id)).toEqual([b.id, a.id]);
  });

  test('执行中：pinned 组恒在 orderIndex 之前', () => {
    const run = { ...todo(1, 'building'), orderIndex: 0 };
    const failed = { ...todo(2, 'failed'), orderIndex: 5 };
    const sorted = sortColumnTodos(building, [run, failed]);
    expect(sorted.map((t) => t.id)).toEqual([failed.id, run.id]);
  });
});
