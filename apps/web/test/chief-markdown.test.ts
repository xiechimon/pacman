// #650/#651 总管抽屉 markdown 单源 + 流式打字尾行（mapper 缝；渲染缝的钉在
// e2e/chief-stream-markdown.spec.ts）。
// 失败方式先行枚举：
//   F-A1 chief 回复 `**bold**` 字面星号漏出（内联层不解析 strong，只剥离）
//   F-A2 strong 解析吃掉 code span：反引号内的 `**` 被当粗体标记
//   F-A3 粗体跨 code span 时断链（**使用 `cmd` 安装** 退化成字面星号）
//   F-A4 mention 方案被 strong 解析破坏（[name](agent:id) 不再出 chip）
//   F-A5 mapChiefStream 重写破坏既有投影（toolcall 折叠面 / error 行 / user 行）
//   F-A6 live robot 行仍走第二套手搓投影（paragraphs/bullets），不进 markdown 槽
//   F-B1 liveText 缓冲有字但 mapChief 不产 typing 尾行（增量照旧全丢）
//   F-B2 回合未在进行（activeRun null）也挂 typing 行——陈旧缓冲回显
//   F-B3 空串/纯空白缓冲挂出空气泡（闪烁面）
//   F-B4 typing 行携带 foot（复制钮/完成徽标）——打字面不是定稿面
//   F-B5 流式半途未闭合的 `**` 漏字面星号（闭合符还在路上）
//   F-B6 未闭合代码栅栏内被误补闭合符（fence 内 ** 是字面内容）
// #675 todo 提及位（chief 系统提示词让其发 [#n](todo:id)，SCHEME 正则此前不认）：
//   F-C1 [#n](todo:id) 不出 chip——字面 markdown 漏进 transcript / 抽屉 / 文档 pane
//   F-C2 todo mention 段不带实体 id——渲染层无法接 /app/todo/<id> 点击导航
//   F-C3 prose 里的裸 #N 被误判成提及（正则吃宽）
//   F-C4 相邻 scheme（todos:）或空 id（todo: 无 id）被误配成 chip
//   F-C5 四旧 scheme（agent/project/skill/machine）段投影被改坏（契约扩展回归钉）

import type { AgentRecord, ChiefGetResponse, ChiefThread } from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import {
  inlineSegments,
  mapChief,
  mapChiefStream,
  type MessageRow,
} from '../src/api/mappers.js';
import type { ChiefStreamItem } from '../src/fixtures/records.js';

const NOW = 1_758_000_000_000;

let msgSeq = 0;
function msg(role: MessageRow['role'], content: unknown, at = NOW): MessageRow {
  msgSeq += 1;
  return { id: `msg-${msgSeq}`, role, content, createdAt: at };
}

const AGENT: AgentRecord = {
  id: 'agent-1',
  displayName: 'r5-scribe',
  description: null,
  status: 'active',
  avatarUrl: null,
  provider: 'r3-gw',
  modelId: 'claude-sonnet-5',
  thinkingLevel: null,
  tools: [],
  secrets: [],
  skills: [],
  mcpServers: [],
};

const ENV: ChiefGetResponse = {
  chief: {
    id: 'chief-u1-t1',
    userId: 'u1',
    teamId: 't1',
    agent: { agentId: 'agent-1' },
    charter: null,
    lastTurnAt: null,
    createdAt: NOW,
    tz: null,
  },
  agentActor: AGENT,
  context: null,
  watches: [],
  wakes: [],
};

function thread(activeRun: ChiefThread['activeRun']): ChiefThread {
  return {
    id: 'chief-aaa',
    chiefId: 'chief-u1-t1',
    userId: 'u1',
    teamId: 't1',
    title: '线程甲',
    createdAt: NOW,
    updatedAt: NOW,
    lastTurnAt: null,
    session: { runtime: 'pi', id: 's1', openedAt: NOW },
    pendingSessionResumeAt: null,
    toolDefHashes: {},
    toolResultHashes: {},
    activeRun,
  };
}

function robotItems(items: ChiefStreamItem[]) {
  return items.filter((i): i is Extract<ChiefStreamItem, { kind: 'robot' }> => i.kind === 'robot');
}

describe('inlineSegments strong 位（#650 F-A1..A4）', () => {
  test('F-A1 **bold** 切成 strong 段，星号不再漏字面也不再只剥离', () => {
    const segs = inlineSegments('**项目**: [凭证链路验证]');
    expect(segs).toContainEqual({ text: '项目', style: 'strong' });
    expect(segs.map((s) => s.text).join('')).not.toContain('**');
    expect(segs.map((s) => s.text).join('')).toContain(': [凭证链路验证]');
  });

  test('F-A2 code span 内的 ** 保持字面（反引号优先）', () => {
    const segs = inlineSegments('运行 `grep **` 输出');
    const code = segs.find((s) => s.style === 'code');
    expect(code?.text).toBe('grep **');
    expect(segs.filter((s) => s.style === 'strong')).toHaveLength(0);
  });

  test('F-A3 粗体跨 code span 不断链', () => {
    const segs = inlineSegments('**使用 `npm i` 安装**');
    expect(segs).toEqual([
      { text: '使用 ', style: 'strong' },
      { text: 'npm i', style: 'code' },
      { text: ' 安装', style: 'strong' },
    ]);
  });

  test('F-A4 mention 方案照常出 chip（strong 内外都不破）', () => {
    // #675：mention 段契约扩展——携带 wire 实体 id（mentionId），四旧 scheme 同律。
    const plain = inlineSegments('派给 [scribe](agent:a1) 承接');
    expect(plain).toContainEqual({
      text: 'scribe',
      style: 'mention',
      mentionKind: 'agent',
      mentionId: 'a1',
    });
    const bolded = inlineSegments('**由 [scribe](agent:a1) 承接**');
    expect(bolded).toContainEqual({
      text: 'scribe',
      style: 'mention',
      mentionKind: 'agent',
      mentionId: 'a1',
    });
    expect(bolded.map((s) => s.text).join('')).not.toContain('**');
  });

  test('无标记文本行为不变（回归钉）', () => {
    expect(inlineSegments('纯文本')).toEqual([{ text: '纯文本' }]);
    expect(inlineSegments('带 `code` 的文本')).toEqual([
      { text: '带 ' },
      { text: 'code', style: 'code' },
      { text: ' 的文本' },
    ]);
  });

  test('落单 ** 保持字面（奇数个定界符不吞尾段）', () => {
    const segs = inlineSegments('a ** b');
    expect(segs.map((s) => s.text).join('')).toBe('a ** b');
    expect(segs.filter((s) => s.style === 'strong')).toHaveLength(0);
  });
});

describe('inlineSegments todo 提及位（#675 F-C1..C5）', () => {
  test('F-C1/C2 [#n](todo:id) 切出 mention 段——label 逐字 + 实体 id 随行', () => {
    const segs = inlineSegments('已创建并派工 [#24](todo:t24)，进入复核');
    expect(segs).toContainEqual({
      text: '#24',
      style: 'mention',
      mentionKind: 'todo',
      mentionId: 't24',
    });
    expect(segs.map((s) => s.text).join('')).not.toContain('](');
  });

  test('F-C1 strong 内的 todo 提及照常出 chip（F-A4 同律）', () => {
    const bolded = inlineSegments('**由 [#1](todo:r3-legacy-1) 承接**');
    expect(bolded).toContainEqual({
      text: '#1',
      style: 'mention',
      mentionKind: 'todo',
      mentionId: 'r3-legacy-1',
    });
    expect(bolded.map((s) => s.text).join('')).not.toContain('**');
  });

  test('F-C3 prose 裸 #N 不是提及（正则不吃宽）', () => {
    expect(inlineSegments('任务 #12 停在 review，另见 PR #487')).toEqual([
      { text: '任务 #12 停在 review，另见 PR #487' },
    ]);
  });

  test('F-C4 相邻 scheme 与空 id 保持字面（todos: / todo: 无 id 不配）', () => {
    const near = inlineSegments('[伪链](todos:t1) 保持字面');
    expect(near.filter((s) => s.style === 'mention')).toHaveLength(0);
    expect(near.map((s) => s.text).join('')).toContain('[伪链](todos:t1)');
    const empty = inlineSegments('[x](todo:) 保持字面');
    expect(empty.filter((s) => s.style === 'mention')).toHaveLength(0);
    expect(empty.map((s) => s.text).join('')).toContain('[x](todo:)');
  });

  test('F-C5 四旧 scheme 照常出段并携带 wire id（契约扩展回归钉）', () => {
    const segs = inlineSegments(
      '[scribe](agent:a1) [proj](project:p1) [sk](skill:s1) [box](machine:m1)',
    );
    expect(segs).toContainEqual({
      text: 'scribe',
      style: 'mention',
      mentionKind: 'agent',
      mentionId: 'a1',
    });
    expect(segs).toContainEqual({
      text: 'proj',
      style: 'mention',
      mentionKind: 'project',
      mentionId: 'p1',
    });
    expect(segs).toContainEqual({ text: 'sk', style: 'mention', mentionKind: 'skill', mentionId: 's1' });
    expect(segs).toContainEqual({
      text: 'box',
      style: 'mention',
      mentionKind: 'machine',
      mentionId: 'm1',
    });
  });
});

describe('mapChiefStream markdown 槽（#650 F-A5/A6）', () => {
  test('F-A6 assistant 行进 markdown 槽（原文逐字），不再手搓 paragraphs/bullets', () => {
    const text = '## 报告\n\n- **项目**: 凭证链路验证\n- 次要点';
    const items = mapChiefStream([msg('assistant', text)]);
    const robots = robotItems(items);
    expect(robots).toHaveLength(1);
    expect(robots[0]?.markdown).toBe(text);
    expect(robots[0]?.paragraphs).toBeUndefined();
    expect(robots[0]?.seconds).toBe('');
  });

  test('F-A5 toolcall 行仍缓冲进下一 robot 行的折叠面', () => {
    const items = mapChiefStream([
      msg('assistant', {
        kind: 'toolcall',
        call: { id: 'c1', name: 'create_todo', arguments: {}, startedAt: NOW, endedAt: NOW + 2000 },
      }),
      msg('assistant', '已创建并派工'),
    ]);
    const robots = robotItems(items);
    expect(robots).toHaveLength(1);
    expect(robots[0]?.tools).toEqual([{ name: 'create_todo', seconds: 2 }]);
  });

  test('F-A5 user 行 / chief_turn_error 行投影不变（回归钉）', () => {
    const items = mapChiefStream([
      msg('user', '帮我写 CONTRIBUTING.md'),
      msg('system', JSON.stringify({ kind: 'chief_turn_error', message: '400 协议不支持' })),
    ]);
    expect(items[0]).toMatchObject({ kind: 'user', text: '帮我写 CONTRIBUTING.md' });
    expect(items[1]).toMatchObject({ kind: 'error', text: '400 协议不支持' });
  });
});

describe('mapChief typing 尾行（#651 F-B1..B4）', () => {
  const opts = (activeRun: ChiefThread['activeRun'], liveText?: string) => ({
    threads: [thread(activeRun)],
    activeThreadId: 'chief-aaa',
    messages: [msg('user', '派一下')],
    ...(liveText !== undefined ? { liveText } : {}),
  });

  test('F-B1 回合进行中 + 缓冲非空 → stream 尾挂 typing robot 行', () => {
    const content = mapChief(ENV, opts({ phase: 'chief' }, '正在读取 **仓库结构**'));
    const stream = content.stream ?? [];
    const last = stream[stream.length - 1];
    expect(last).toMatchObject({
      kind: 'robot',
      markdown: '正在读取 **仓库结构**',
      typing: true,
    });
  });

  test('F-B2 activeRun null（回合已收）→ 陈旧缓冲不渲染', () => {
    const content = mapChief(ENV, opts(null, '上一轮的残留文本'));
    expect(robotItems(content.stream ?? []).some((r) => r.typing === true)).toBe(false);
  });

  test('F-B3 空串/纯空白缓冲 → 不挂空气泡', () => {
    expect(
      robotItems(mapChief(ENV, opts({ phase: 'chief' }, '')).stream ?? []).some((r) => r.typing),
    ).toBe(false);
    expect(
      robotItems(mapChief(ENV, opts({ phase: 'chief' }, '   \n ')).stream ?? []).some(
        (r) => r.typing,
      ),
    ).toBe(false);
  });

  test('F-B5 未闭合 ** 的流式半途自动补虚拟闭合符（增量面不漏字面星号）', () => {
    const content = mapChief(ENV, opts({ phase: 'chief' }, '正在验证 **凭证'));
    const stream = content.stream ?? [];
    expect(stream[stream.length - 1]).toMatchObject({
      kind: 'robot',
      typing: true,
      markdown: '正在验证 **凭证**',
    });
  });

  test('F-B6 未闭合代码栅栏内不补（fence 内 ** 是字面内容）', () => {
    const content = mapChief(ENV, opts({ phase: 'chief' }, '```sh\necho **'));
    const stream = content.stream ?? [];
    expect(stream[stream.length - 1]).toMatchObject({ markdown: '```sh\necho **' });
  });

  test('F-B4 typing 行不带 foot 数据（seconds 空串、无 tools）', () => {
    const content = mapChief(ENV, opts({ phase: 'chief' }, '打字中'));
    const typing = robotItems(content.stream ?? []).find((r) => r.typing === true);
    expect(typing?.seconds).toBe('');
    expect(typing?.tools).toBeUndefined();
  });

  test('liveText 缺省（fixture 面 / 未订阅）→ stream 与现状一致', () => {
    const content = mapChief(ENV, opts({ phase: 'chief' }));
    expect(robotItems(content.stream ?? [])).toHaveLength(0);
    expect(content.running).toBe(true);
  });
});
