// XMON-46 build 时间线的兜底轨迹：mapTranscript 从 step.attempts 派生轨迹行
// （「模型 X 失败：<error>，已切换 Y」）+ 终态失败行的尝试明细。失败方式先列：
//
//   F1  attempts 为 null（旧数据 / 未触发兜底）仍出轨迹行 —— 时间线多出空壳
//   F2  只有主模型一次尝试（没换过模型）就出轨迹行 —— 同上，凭空造事件
//   F3  换过一次模型不出行 —— 兜底发生了但界面不说
//   F4  轨迹行的 from/next 顺序颠倒（说成「Y 失败切回 X」）
//   F5  轨迹行不按失败时刻落位 —— 排在别的行前后乱序
//   F6  error 原文超长不截断 —— 单行撑爆对话列
//   F7  error 里的换行不压平 —— 轨迹行裂成多行，与「一行一事件」的形状不符
//   F8  全部耗尽的终态行丢掉尝试明细 —— 「试过哪些模型、各自为何失败」无痕
//   F9  终态失败行被轨迹行改写掉既有文案（title/body/links canon）
//   F10 终态行的尝试明细丢序（必须主模型首试在前，与契约 attempts[] 同序）
//
// 渲染侧（展开交互、行几何）由 e2e/fallback-trace.spec.ts 钉。

import type { BuildRecord, ModelAttempt, StepJournalRow } from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import { mapTranscript } from '../src/api/mappers.js';
import type { TodoRecord, TranscriptItem } from '../src/fixtures/records.js';
import { NOW, todo } from './helpers.js';

const BUILD: BuildRecord = {
  id: 'build-1',
  todoId: 'todo-1',
  withPlan: false,
  prevPhase: null,
  triggerSource: 'user',
  pinnedMachineId: null,
  planDocId: null,
  errorMessage: null,
  prUrl: null,
  prNumber: null,
  diffHash: null,
  createdAt: NOW - 60_000,
};

const FAILED_BUILD: BuildRecord = { ...BUILD, errorMessage: 'model call failed: 429 rate limited' };

function attempt(modelId: string, error: string | null, at: number): ModelAttempt {
  return {
    provider: 'r3-gw',
    modelId,
    error,
    startedAt: at - 5_000,
    endedAt: at,
  };
}

function step(status: StepJournalRow['status'], attempts: ModelAttempt[] | null): StepJournalRow {
  return {
    id: `step-${status}-${attempts?.length ?? 0}`,
    buildId: BUILD.id,
    kind: 'build',
    machineId: null,
    // 步入队时刻 = 主模型首试起跑；轨迹行的落位锚是各次尝试的 endedAt
    createdAt: attempts?.[0]?.startedAt ?? NOW - 40_000,
    status,
    checkpointCommit: null,
    attempts,
  };
}

type FallbackRow = Extract<TranscriptItem, { kind: 'fallback' }>;
type FailRow = Extract<TranscriptItem, { kind: 'fail' }>;

function render(steps: StepJournalRow[], build: BuildRecord = BUILD, phase: TodoRecord['phase'] = 'failed') {
  return mapTranscript({
    messages: [],
    steps,
    plans: [],
    build,
    todo: todo(9, phase),
    machineName: null,
    userName: 'Xmon Dai',
    liveText: '',
    now: NOW,
  });
}

const fallbackRows = (items: TranscriptItem[]): FallbackRow[] =>
  items.filter((i): i is FallbackRow => i.kind === 'fallback');
const failRow = (items: TranscriptItem[]): FailRow | undefined =>
  items.find((i): i is FailRow => i.kind === 'fail');

describe('mapTranscript 兜底轨迹（XMON-46）', () => {
  test('F1/F2: 无 attempts 或只有主模型首试 → 不出轨迹行', () => {
    expect(fallbackRows(render([step('done', null)]))).toHaveLength(0);
    expect(
      fallbackRows(render([step('done', [attempt('claude-sonnet-5', null, NOW - 10_000)])])),
    ).toHaveLength(0);
  });

  test('F3/F4: 换过一次模型 → 恰一行，方向 = 失败者 → 下一个', () => {
    const rows = fallbackRows(
      render([
        step('done', [
          attempt('claude-sonnet-5', '429 rate limited', NOW - 20_000),
          attempt('claude-opus-5', null, NOW - 10_000),
        ]),
      ]),
    );
    expect(rows).toEqual([
      { kind: 'fallback', model: 'r3-gw/claude-sonnet-5', error: '429 rate limited', next: 'r3-gw/claude-opus-5' },
    ]);
  });

  test('F6/F7: error 原文压平换行并按 120 字截断', () => {
    const long = `${'x'.repeat(200)}\nsecond line`;
    const rows = fallbackRows(
      render([
        step('failed', [
          attempt('claude-sonnet-5', long, NOW - 20_000),
          attempt('claude-opus-5', 'model not found', NOW - 10_000),
        ]),
      ]),
    );
    expect(rows[0]?.error).toBe(`${'x'.repeat(120)}…`);
    expect(rows[0]?.error).not.toContain('\n');
  });

  test('error 为 null（防御形）→ 空串，由渲染层走无原因子句', () => {
    const rows = fallbackRows(
      render([
        step('done', [
          attempt('claude-sonnet-5', null, NOW - 20_000),
          attempt('claude-opus-5', null, NOW - 10_000),
        ]),
      ]),
    );
    expect(rows[0]?.error).toBe('');
  });

  test('F8/F10: 全部耗尽 → 轨迹行 + 终态行带有序尝试明细', () => {
    const items = render(
      [
        step('failed', [
          attempt('claude-sonnet-5', '429 rate limited', NOW - 30_000),
          attempt('claude-opus-5', 'model not found', NOW - 20_000),
          attempt('claude-haiku-5', 'upstream 503', NOW - 10_000),
        ]),
      ],
      FAILED_BUILD,
    );
    expect(fallbackRows(items).map((r) => r.model)).toEqual([
      'r3-gw/claude-sonnet-5',
      'r3-gw/claude-opus-5',
    ]);
    expect(failRow(items)?.attempts).toEqual([
      { model: 'r3-gw/claude-sonnet-5', error: '429 rate limited' },
      { model: 'r3-gw/claude-opus-5', error: 'model not found' },
      { model: 'r3-gw/claude-haiku-5', error: 'upstream 503' },
    ]);
  });

  test('F9: 终态行文案 canon 不动，只多挂明细', () => {
    const items = render([step('failed', [attempt('claude-sonnet-5', 'boom', NOW - 10_000)])], FAILED_BUILD);
    expect(failRow(items)).toMatchObject({
      title: 'model call failed: 429 rate limited',
      body: '请将其重新上线，或重新运行任务以改派其他机器。',
      links: ['查看原始错误', '排查指南'],
    });
  });

  test('F8: 旧数据（attempts 为 null）的失败行不带明细字段', () => {
    const items = render([step('failed', null)], FAILED_BUILD);
    const row = failRow(items);
    expect(row).toBeDefined();
    expect(row?.attempts).toBeUndefined();
  });

  test('F5: 轨迹行按失败时刻落位（与其它行同序）', () => {
    const items = render(
      [
        step('failed', [
          attempt('claude-sonnet-5', 'boom', NOW - 30_000),
          attempt('claude-opus-5', 'boom2', NOW - 20_000),
        ]),
      ],
      FAILED_BUILD,
    );
    // 轨迹行在失败行之前（失败行是列表尾部追加），且在 run 行之后
    const kinds = items.map((i) => i.kind);
    expect(kinds.indexOf('fallback')).toBeGreaterThan(kinds.indexOf('run'));
    expect(kinds.indexOf('fallback')).toBeLessThan(kinds.indexOf('fail'));
  });

  test('phase 未落 failed 时不挂终态行，但轨迹行照出', () => {
    const items = render(
      [step('done', [attempt('claude-sonnet-5', 'boom', NOW - 20_000), attempt('claude-opus-5', null, NOW - 10_000)])],
      BUILD,
      'building',
    );
    expect(fallbackRows(items)).toHaveLength(1);
    expect(failRow(items)).toBeUndefined();
  });
});