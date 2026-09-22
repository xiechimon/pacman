// phase 九值流转对拍（02 §4.1 权威 + 验收「含 6 列折叠映射」）。
// 6 列折叠映射单源 = shared boardColumnFor（phase × hasChanges 双键，r5 §8）；
// 流转边集 = src/services/phase.ts PHASE_TRANSITIONS（出处逐边注记）。

import { BOARD_COLUMNS, boardColumnFor, PHASE_VALUES, type Phase } from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import { canTransitionPhase, PHASE_TRANSITIONS } from '../src/services/phase.js';

describe('九值权威（02 §4.1）', () => {
  test('流转表键集 = phase 九值，无外值', () => {
    expect(Object.keys(PHASE_TRANSITIONS).sort()).toEqual([...PHASE_VALUES].sort());
    for (const targets of Object.values(PHASE_TRANSITIONS)) {
      for (const to of targets) {
        expect(PHASE_VALUES).toContain(to);
      }
    }
  });

  test('主时序边（02 §4.2 全链）逐边合法', () => {
    // 创建→开始→claim 规划→confirm→确认→building→review→merge 落地→done
    const spine: [Phase, Phase][] = [
      ['todo', 'queued'],
      ['queued', 'planning'],
      ['planning', 'confirm'],
      ['confirm', 'building'],
      ['building', 'review'],
      ['review', 'done'],
    ];
    for (const [from, to] of spine) {
      expect(canTransitionPhase(from, to), `${from}->${to}`).toBe(true);
    }
  });

  test('支线边：驳回重规划 / 直执行 / 失败重跑 / close-reopen', () => {
    expect(canTransitionPhase('confirm', 'planning')).toBe(true); // 驳回→重规划（r5 §4）
    expect(canTransitionPhase('queued', 'building')).toBe(true); // withPlan=false 直执行
    expect(canTransitionPhase('failed', 'queued')).toBe(true); // 重跑新 build（r3 §3.7）
    expect(canTransitionPhase('todo', 'closed')).toBe(true); // 右键 Close（r1 §443）
    expect(canTransitionPhase('closed', 'todo')).toBe(true); // reopen [推断]
  });

  test('定时重跑边（02 §9.2 触发→新 build 全新重跑）', () => {
    expect(canTransitionPhase('done', 'queued')).toBe(true); // done 复跑（r3 §9 实测）
    expect(canTransitionPhase('review', 'queued')).toBe(true); // 停驻轮顶替（r5 §8 Cancelled+新轮）
    expect(canTransitionPhase('confirm', 'queued')).toBe(true); // 同上（方案关口停驻轮）
  });

  test('非法边拒绝（跳跃/回退/终态出边）', () => {
    expect(canTransitionPhase('todo', 'done')).toBe(false);
    expect(canTransitionPhase('todo', 'building')).toBe(false);
    expect(canTransitionPhase('building', 'confirm')).toBe(false);
    expect(canTransitionPhase('review', 'building')).toBe(false);
    expect(canTransitionPhase('done', 'todo')).toBe(false); // done 出边仅定时/重跑 queued（r3 §9）
    expect(canTransitionPhase('done', 'building')).toBe(false);
    for (const from of PHASE_VALUES) {
      expect(canTransitionPhase(from, from)).toBe(false); // 恒恰处一个 phase，自环无意义
    }
  });
});

describe('6 列折叠映射（02 §4.1 表 + r5 §8 双键加注）', () => {
  test('列词表 = 看板 6 列', () => {
    expect(BOARD_COLUMNS).toHaveLength(6);
  });

  test('逐 phase 列位对拍 spec 表', () => {
    // 02 §4.1 表：todo/queued→待开始（queued 折叠 [推断]）；planning→规划中；
    // confirm→待确认；building→执行中；review→待验收；done→已完成（近 7 天）；
    // failed→钉执行中列顶（列归属=执行中）；closed→不占列 [推断]。
    expect(boardColumnFor('todo')).toBe('待开始');
    expect(boardColumnFor('queued')).toBe('待开始');
    expect(boardColumnFor('planning')).toBe('规划中');
    expect(boardColumnFor('building')).toBe('执行中');
    expect(boardColumnFor('done')).toBe('已完成');
    expect(boardColumnFor('failed')).toBe('执行中');
    expect(boardColumnFor('closed')).toBeNull();
    // gate 态双键（r5 §8）：无代码改动留执行中列，有改动进 gate 列。
    expect(boardColumnFor('confirm', false)).toBe('执行中');
    expect(boardColumnFor('confirm', true)).toBe('待确认');
    expect(boardColumnFor('review', false)).toBe('执行中');
    expect(boardColumnFor('review', true)).toBe('待验收');
  });
});
