// Issue #919 seam 4（前端腿）：技能路由事件必须成为详情页一等公民——
// 活行出现技能条目、被 deny 挡下的事件同样可见、右栏可汇总。数据面 =
// 既有 wire（ToolCallRecord.name/arguments/result/isError），mapper 推导，
// 零 schema 变更（版本兼容面不动）。检测词表（运行时真值锚定）：
//   - pi 门控 read 拒绝文案 `read denied: skill '<name>' is not in the
//     agent allowlist`（backend/pi.ts createSkillReadGate 原文）；
//   - claude-code deny 规则拒绝 = isError tool_result（docs/verify/917 A2
//     实物：Read + file_path 落 permission_denials），文案随 CLI 版本漂移
//     → 判定不依赖文案，靠 isError + SKILL.md 路径；
//   - claude-code 原生 Skill 工具调用（B5 实物：tool_input.skill）——命中
//     即技能条目，isError 即被拒。
// 失败方式清单（先于实现固化）：
//   S1 授权 read SKILL.md 不产技能条目（路由命中不可见 = 主判据的 UI 面
//      失明）——条目名取路径目录名，且该 call 不再进 tools 组（人类面孔
//      取代原始 pill，#634 回声律同款）。
//   S2 pi 门控拒绝不产 blocked 条目 / 名字取错（必须取拒绝文案里的技能
//      名，不是路径目录名——两源可不同）。
//   S3 claude-code 形拒绝（isError + file_path，无 pi 文案）漏检。
//   S4 原生 Skill 工具调用（命中/被拒两态）漏检。
//   S5 误报面：普通文件 read、bash 里 cat SKILL.md、非 read 工具的 isError
//      都不得产技能条目（bash 绕行是两后端已知不挡的边界，检测面与其
//      对齐——不装看不见）。
//   S6 汇总失真：同名多次读取计数、读取与拦截并存分行、无名可提时兜底。
//   S7 技能条目丢失时间序（条目必须挂在原 call 的落库时刻上）。

import type { ToolCallRecord } from '@pacman/shared';
import { expect, test } from 'vitest';
import { mapTranscript, type MessageRow, summarizeSkillItems } from '../src/api/mappers.js';
import type { TranscriptItem } from '../src/fixtures/records.js';
import { NOW, todo } from './helpers.js';

const TEAM_VIEW = '/tmp/pacman-home/team-skills/views/b794/alpha-skill/SKILL.md';
const LOCAL_BLOCKED = '/tmp/local-skills/local-blocked/SKILL.md';

function call(over: Partial<ToolCallRecord> & { name: string }): ToolCallRecord {
  return {
    id: `call-${Math.random().toString(36).slice(2)}`,
    arguments: {},
    startedAt: NOW - 5_000,
    endedAt: NOW - 4_000,
    ...over,
  } as ToolCallRecord;
}

function toolMessage(c: ToolCallRecord, at: number): MessageRow {
  return { id: c.id, role: 'assistant', content: { kind: 'toolcall', call: c }, createdAt: at };
}

function textResult(text: string): ToolCallRecord['result'] {
  return { content: [{ type: 'text', text }] };
}

function render(messages: MessageRow[]): TranscriptItem[] {
  return mapTranscript({
    messages,
    steps: [],
    plans: [],
    build: null,
    todo: todo(12, 'done'),
    machineName: null,
    userName: 'Xmon Dai',
    liveText: '',
  });
}

function skillItems(items: TranscriptItem[]): Extract<TranscriptItem, { kind: 'skill' }>[] {
  return items.filter((i): i is Extract<TranscriptItem, { kind: 'skill' }> => i.kind === 'skill');
}

function toolGroups(items: TranscriptItem[]): Extract<TranscriptItem, { kind: 'tools' }>[] {
  return items.filter((i): i is Extract<TranscriptItem, { kind: 'tools' }> => i.kind === 'tools');
}

test('S1: authorized SKILL.md read becomes a skill entry and leaves the tools group', () => {
  const items = render([
    toolMessage(
      call({
        name: 'read',
        arguments: { path: TEAM_VIEW },
        result: textResult('---\nname: alpha-skill\n---\nTEAM-ALPHA-MARKER-919'),
        isError: false,
      }),
      NOW - 4_000,
    ),
    toolMessage(
      call({ name: 'bash', arguments: { command: 'ls' }, result: textResult('ok\n') }),
      NOW - 3_000,
    ),
  ]);
  expect(skillItems(items)).toEqual([{ kind: 'skill', name: 'alpha-skill', blocked: false }]);
  // 原始 read pill 被技能条目取代；同轮普通工具照旧进组（#634 人类面孔律）。
  const groups = toolGroups(items);
  expect(groups).toHaveLength(1);
  expect(groups[0]?.pills).toEqual(['bash ls']);
});

test('S2: pi gate denial names the skill from the denial text, blocked', () => {
  const items = render([
    toolMessage(
      call({
        name: 'read',
        arguments: { path: LOCAL_BLOCKED },
        result: textResult(
          "read denied: skill 'local-blocked' is not in the agent allowlist",
        ),
        isError: true,
      }),
      NOW - 4_000,
    ),
  ]);
  expect(skillItems(items)).toEqual([
    { kind: 'skill', name: 'local-blocked', blocked: true },
  ]);
  expect(toolGroups(items)).toHaveLength(0);
});

test('S3: claude-code rule denial (isError + SKILL.md file_path, no pi text) is detected', () => {
  const items = render([
    toolMessage(
      call({
        name: 'Read',
        arguments: { file_path: '/var/folders/x/secret-skill/SKILL.md' },
        // CLI 2.1.x 拒绝文案（形状随版本漂移——检测不得依赖它）。
        result: textResult("The user doesn't want to proceed with this tool use."),
        isError: true,
      }),
      NOW - 4_000,
    ),
  ]);
  expect(skillItems(items)).toEqual([
    { kind: 'skill', name: 'secret-skill', blocked: true },
  ]);
});

test('S4: native Skill tool calls map to skill entries in both states', () => {
  const items = render([
    toolMessage(
      call({
        name: 'Skill',
        arguments: { skill: 'probe-skill' },
        result: textResult('skill body loaded'),
        isError: false,
      }),
      NOW - 4_000,
    ),
    toolMessage(
      call({
        name: 'Skill',
        arguments: { skill: 'denied-skill' },
        result: textResult('rejected by permission rule'),
        isError: true,
      }),
      NOW - 3_000,
    ),
  ]);
  expect(skillItems(items)).toEqual([
    { kind: 'skill', name: 'probe-skill', blocked: false },
    { kind: 'skill', name: 'denied-skill', blocked: true },
  ]);
});

test('S5: no false positives — plain reads, bash cat, non-read errors stay tool rows', () => {
  const items = render([
    toolMessage(
      call({ name: 'read', arguments: { path: '/x/src/main.ts' }, result: textResult('code') }),
      NOW - 6_000,
    ),
    toolMessage(
      call({
        name: 'bash',
        arguments: { command: `cat ${TEAM_VIEW}` },
        result: textResult('body'),
      }),
      NOW - 5_000,
    ),
    toolMessage(
      call({
        name: 'bash',
        arguments: { command: 'false' },
        result: textResult('boom'),
        isError: true,
      }),
      NOW - 4_000,
    ),
    // SKILL.md 路径的**写**类工具 = 技能库维护面（技能已更新回声族），不是
    // 路由事件。
    toolMessage(
      call({ name: 'write', arguments: { path: TEAM_VIEW }, result: textResult('ok') }),
      NOW - 3_000,
    ),
  ]);
  expect(skillItems(items)).toEqual([]);
  const groups = toolGroups(items);
  expect(groups).toHaveLength(1);
  expect(groups[0]?.pills).toHaveLength(4);
});

test('S6: summary aggregates per skill — read counts, blocked counts, stable order', () => {
  const rows = summarizeSkillItems([
    { kind: 'run', at: '13:35' },
    { kind: 'skill', name: 'alpha-skill', blocked: false },
    { kind: 'skill', name: 'alpha-skill', blocked: false },
    { kind: 'skill', name: 'local-blocked', blocked: true },
    { kind: 'tools', seconds: 3, expanded: false, pills: ['bash ls'] },
  ]);
  expect(rows).toEqual([
    { name: 'alpha-skill', reads: 2, blocked: 0 },
    { name: 'local-blocked', reads: 0, blocked: 1 },
  ]);
});

test('S7: the skill entry keeps the tool call timeline position', () => {
  const items = render([
    toolMessage(
      call({ name: 'bash', arguments: { command: 'ls' }, result: textResult('ok') }),
      NOW - 9_000,
    ),
    toolMessage(
      call({ name: 'read', arguments: { path: TEAM_VIEW }, result: textResult('body') }),
      NOW - 8_000,
    ),
    {
      id: 'robot-1',
      role: 'assistant',
      content: [{ type: 'text', text: '完成。' }],
      createdAt: NOW - 7_000,
    } as MessageRow,
  ]);
  // 序：tools 组 → 技能条目 → robot 行（技能条目钉在原 call 时刻，不漂移
  // 到组尾或行尾）。
  const kinds = items.map((i) => i.kind);
  expect(kinds.indexOf('tools')).toBeLessThan(kinds.indexOf('skill'));
  expect(kinds.indexOf('skill')).toBeLessThan(kinds.indexOf('robot'));
});
