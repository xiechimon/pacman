// #741 agent 身份可点进设置（渲染缝单测；mapper 缝的 mentionId 投影钉在
// test/chief-markdown.test.ts F-A4/F-C5，e2e 面在 chief-stream-markdown.spec
// 与 agent-identity-chip.spec）。segments.tsx 自 #675 起 todo kind 是 router
// Link，其余四种留死 span（注释原文「stay non-clickable spans until their own
// navigation ticket」）——本票接通 agent kind（参考站 todos.dev 实拍：chip
// 整块 cursor:pointer，点击同 tab 路由 /app/resources/agents/<id>）。
//
// 失败方式先行枚举：
//  F-U1 agent 段带 mentionId 仍渲染死 span（没接导航——票面缺口 2 本体）
//  F-U2 agent 段无 mentionId 渲染出 anchor（应保惰性 span，零导航保证）
//  F-U3 todo 段导航被本次改动回归（#675 行为破坏）
//  F-U4 skill/project/machine 段带 id 越权成 anchor（参考站落点未取证，
//       票面明确不入本票——字面负例钉）
//  F-U5 chip 类名家族翻标签时丢失（accent 色随 mention-chip--<kind> 走）

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, test } from 'vitest';
import { Segments } from '../src/detail/segments.js';
import type { DocSegment } from '../src/fixtures/records.js';

function render(segments: DocSegment[]): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(Segments, { segments, codeClassName: 'chat-code' }),
    ),
  );
}

function mention(
  kind: NonNullable<DocSegment['mentionKind']>,
  id: string | undefined,
  text = 'scribe',
): DocSegment {
  return id === undefined
    ? { text, style: 'mention', mentionKind: kind }
    : { text, style: 'mention', mentionKind: kind, mentionId: id };
}

describe('segments mention 导航缝（#741）', () => {
  test('F-U1: agent 段带 mentionId → anchor，href = /app/resources/agents/<id>', () => {
    const markup = render([mention('agent', 'a1')]);
    expect(markup).toMatch(/<a [^>]*href="\/app\/resources\/agents\/a1"/);
    expect(markup).toContain('scribe</a>');
  });

  test('F-U2: agent 段无 mentionId → 惰性 span，无 anchor', () => {
    const markup = render([mention('agent', undefined)]);
    expect(markup).not.toContain('<a ');
    expect(markup).toMatch(/<span [^>]*class="[^"]*mention-chip--agent/);
  });

  test('F-U3: todo 段导航不回归（#675 既有行为）', () => {
    const markup = render([{ text: '#1', style: 'mention', mentionKind: 'todo', mentionId: 't1' }]);
    expect(markup).toMatch(/<a [^>]*href="\/app\/todo\/t1"/);
  });

  test('F-U4: skill/project/machine 段带 id 仍是 span（负例——落点未取证不入本票）', () => {
    for (const kind of ['skill', 'project', 'machine'] as const) {
      const markup = render([mention(kind, 'x1')]);
      expect(markup, kind).not.toContain('<a ');
      expect(markup, kind).toContain(`mention-chip--${kind}`);
    }
  });

  test('F-U5: 成链后 chip 类名家族保 accent（mention-chip mention-chip--agent）', () => {
    const markup = render([mention('agent', 'a1')]);
    // #948/#910 裁定 3：class 属性逐字串是表现类断言，按新正典整条重钉——
    // 家族钩子类（mention-chip / mention-chip--agent）、身份色槽 utility
    // （mention-chip.ts 的 agent 对）与可点 cursor 逐项断言，不再钉类串的
    // 字节级拼接顺序（utility 皮肤下类序是 cn 合成产物，无语义）。
    expect(markup).toMatch(/class="[^"]*\bmention-chip\b[^"]*"/);
    expect(markup).toMatch(/class="[^"]*\bmention-chip--agent\b[^"]*"/);
    expect(markup).toContain('text-(--chip-done-fg)');
    expect(markup).toContain('cursor-pointer');
  });
});
