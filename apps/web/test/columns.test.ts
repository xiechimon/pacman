// Column view ordering (issue #73): failed / review-awaiting cards pin to
// the TOP of 待处理 (#351: the pinned group moved from 执行中 to the merged
// gate column); everything else keeps manual/fixture order.
import { BOARD_DROP_PHASES } from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import {
  attentionCount,
  canDropOnColumn,
  COLUMNS,
  sortColumnTodos,
  type BoardColumnDef,
} from '../src/board/columns.js';
import type { TodoRecord } from '../src/fixtures/records.js';
import { todo } from './helpers.js';

// #160→#753 手动改相面落点集单源对拍：server canManualMovePhase 消费 shared
// canBoardDrop/BOARD_DROP_PHASES，web 列定义消费 COLUMNS[].dropPhase——四列
// 落点两表必须同集（#753：待处理 收 已完成 的重开落位，正名 review）。
describe('手动改相面单源（#160 / #753）', () => {
  test('持落点列的 dropPhase 集 = shared BOARD_DROP_PHASES', () => {
    const drops = COLUMNS.map((c) => c.dropPhase);
    expect(drops.sort()).toEqual([...BOARD_DROP_PHASES].sort());
  });

  test('待处理落点正名 review = 重开回审核关口（#753 [设计]）', () => {
    expect(col('pending').dropPhase).toBe('review');
  });
});

// #753 per-source 落位矩阵（todos.dev 2026-10-03/04 live 重测；执行中源行
// 未测 = 沿用既有语义 [设计]）。shared canBoardDrop 是相位级镜像，这里钉
// 卡面级（hasChanges 数据位参与判据）。
describe('canDropOnColumn（#753 per-source 矩阵）', () => {
  const withChanges = (t: TodoRecord) => ({ ...t, hasChanges: true });

  test('待开始 源：执行中 ✓ 已完成 ✓；待处理 ✗（实测恒素面）；源列 ✗', () => {
    const t = todo(1, 'todo');
    expect(canDropOnColumn(t, 'building')).toBe(true);
    expect(canDropOnColumn(t, 'done')).toBe(true);
    expect(canDropOnColumn(t, 'pending')).toBe(false);
    expect(canDropOnColumn(t, 'todo')).toBe(false);
  });

  test('待处理 源（confirm/review/awaitingReply）：待开始 ✓ 已完成 ✓；执行中 ✗', () => {
    for (const t of [todo(1, 'confirm'), todo(2, 'review'), todo(3, 'review', true)]) {
      expect(canDropOnColumn(t, 'todo'), t.phase).toBe(true);
      expect(canDropOnColumn(t, 'done'), t.phase).toBe(true);
      expect(canDropOnColumn(t, 'building'), t.phase).toBe(false);
      expect(canDropOnColumn(t, 'pending'), t.phase).toBe(false);
    }
  });

  test('failed 源：待开始 ✓；已完成 ✗（#702 failed→done 保持非法）', () => {
    const t = todo(1, 'failed');
    expect(canDropOnColumn(t, 'todo')).toBe(true);
    expect(canDropOnColumn(t, 'done')).toBe(false);
    expect(canDropOnColumn(t, 'building')).toBe(false);
  });

  test('已完成 源：有变更 → 待处理 ✓（重开）；无变更 → 待处理 ✗（2026-10-04 实测）', () => {
    const rich = withChanges(todo(1, 'done'));
    const plain = todo(2, 'done'); // localTodo 底 hasChanges=false
    expect(canDropOnColumn(rich, 'pending')).toBe(true);
    expect(canDropOnColumn(rich, 'todo')).toBe(true);
    expect(canDropOnColumn(rich, 'building')).toBe(false);
    expect(canDropOnColumn(rich, 'done')).toBe(false);
    expect(canDropOnColumn(plain, 'pending')).toBe(false);
    expect(canDropOnColumn(plain, 'todo')).toBe(true);
  });

  test('执行中 源（未测行 [设计]）：待开始 ✓ 已完成 ✓；待处理 ✗', () => {
    for (const t of [todo(1, 'planning'), todo(2, 'building')]) {
      expect(canDropOnColumn(t, 'todo'), t.phase).toBe(true);
      expect(canDropOnColumn(t, 'done'), t.phase).toBe(true);
      expect(canDropOnColumn(t, 'pending'), t.phase).toBe(false);
      expect(canDropOnColumn(t, 'building'), t.phase).toBe(false);
    }
  });

  test('closed 不占列 = 无源无落；未知列 = 恒等假', () => {
    const t = todo(1, 'closed');
    for (const id of ['todo', 'building', 'pending', 'done']) {
      expect(canDropOnColumn(t, id), id).toBe(false);
    }
    expect(canDropOnColumn(todo(2, 'todo'), 'nope')).toBe(false);
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
