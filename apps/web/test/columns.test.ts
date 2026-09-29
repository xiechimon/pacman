// Column view ordering (issue #73): failed / review-awaiting cards pin to
// the TOP of 待处理 (#351: the pinned group moved from 执行中 to the merged
// gate column); everything else keeps manual/fixture order.
import { BOARD_DROP_PHASES } from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import {
  attentionCount,
  COLUMNS,
  sortColumnTodos,
  type BoardColumnDef,
} from '../src/board/columns.js';
import { todo } from './helpers.js';

// #160 手动改相面落点集单源对拍：server canManualMovePhase 消费 shared
// BOARD_DROP_PHASES，web 列定义消费 COLUMNS[].dropPhase——持落点列两表必须同集
// （#351：待处理无落点，不入拍）。
describe('手动改相面单源（#160 / #351）', () => {
  test('持落点列的 dropPhase 集 = shared BOARD_DROP_PHASES', () => {
    const drops = COLUMNS.flatMap((c) => (c.dropPhase == null ? [] : [c.dropPhase]));
    expect(drops.sort()).toEqual([...BOARD_DROP_PHASES].sort());
  });

  test('待处理不作落点（gate/failed 是系统态，手动拖入无语义）', () => {
    expect(col('pending').dropPhase).toBeUndefined();
  });
});

function col(id: string): BoardColumnDef {
  const found = COLUMNS.find((c) => c.id === id);
  if (found == null) throw new Error(`no column ${id}`);
  return found;
}

const pending = col('pending');

describe('待处理列收纳（confirm ∪ review ∪ failed，#351）', () => {
  test('accepts：confirm / review（含 awaitingReply）/ failed 入列', () => {
    for (const t of [
      todo(1, 'confirm'),
      todo(2, 'review'),
      todo(3, 'review', true),
      todo(4, 'failed'),
    ]) {
      expect(pending.accepts(t), `${t.phase} awaiting=${t.awaitingReply}`).toBe(true);
    }
  });

  test('accepts：todo/queued/planning/building/done/closed 不入列', () => {
    for (const t of [
      todo(1, 'todo'),
      todo(2, 'queued'),
      todo(3, 'planning'),
      todo(4, 'building'),
      todo(5, 'done'),
      todo(6, 'closed'),
    ]) {
      expect(pending.accepts(t), t.phase).toBe(false);
    }
  });

  test('侧栏 badge = 待处理列计数（同一 accepts 谓词单源）', () => {
    const set = [
      todo(1, 'todo'),
      todo(2, 'planning'),
      todo(3, 'confirm'),
      todo(4, 'building'),
      todo(5, 'review', true), // awaitingReply 也计数（与列计数同源）
      todo(6, 'review'),
      todo(7, 'failed'),
      todo(8, 'done'),
      todo(9, 'closed'),
    ];
    expect(set.filter(pending.accepts)).toHaveLength(4);
    expect(attentionCount(set)).toBe(set.filter(pending.accepts).length);
  });
});

describe('sortColumnTodos（pinned 组置顶，余者保序）', () => {
  test('待处理：failed 与 review+awaitingReply 置顶且内部保序', () => {
    const confirm = todo(1, 'confirm');
    const failed = todo(2, 'failed');
    const waiting = todo(3, 'review', true);
    const confirm2 = todo(4, 'confirm');
    const sorted = sortColumnTodos(pending, [confirm, failed, waiting, confirm2]);
    expect(sorted.map((t) => t.id)).toEqual([failed.id, waiting.id, confirm.id, confirm2.id]);
  });

  test('非 pinned 列 = 原序透传', () => {
    const backlog = col('todo');
    const a = todo(1, 'todo');
    const b = todo(2, 'queued');
    expect(sortColumnTodos(backlog, [a, b]).map((t) => t.id)).toEqual([a.id, b.id]);
  });

  test('执行中无 pinned 组：planning/building 原序透传', () => {
    const running = col('building');
    const a = todo(1, 'planning');
    const b = todo(2, 'building');
    expect(sortColumnTodos(running, [a, b]).map((t) => t.id)).toEqual([a.id, b.id]);
  });
});

describe('sortColumnTodos（orderIndex = 手动序，01 §4.1）', () => {
  test('列内按 orderIndex 排，数组序仅作平局兜底', () => {
    const backlog = col('todo');
    const a = { ...todo(1, 'todo'), orderIndex: 1 };
    const b = { ...todo(2, 'queued'), orderIndex: 0 };
    expect(sortColumnTodos(backlog, [a, b]).map((t) => t.id)).toEqual([b.id, a.id]);
  });

  test('待处理：pinned 组恒在 orderIndex 之前', () => {
    const review = { ...todo(1, 'review'), orderIndex: 0 };
    const failed = { ...todo(2, 'failed'), orderIndex: 5 };
    const sorted = sortColumnTodos(pending, [review, failed]);
    expect(sorted.map((t) => t.id)).toEqual([failed.id, review.id]);
  });
});
