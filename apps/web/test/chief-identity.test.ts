// #741 抽屉 robot 行身份 chip（渲染缝单测）：绑定总管的 robot 行身份从
// 「只有头像、不可点、无名字」翻成「头像 + 名字并排 chip，整块 router Link
// → /app/resources/agents/<id>」（参考站 todos.dev 实拍：身份 chip 整块
// cursor:pointer，点击同 tab 整页路由进 Agent 设置页）。
//
// 失败方式先行枚举：
//  F-U6 agent.id 在位不成链（href = /app/resources/agents/<id>）——缺口 1 本体
//  F-U7 agent.id 缺位（ChiefContent.agent.id 是可选位）渲染出 anchor——
//       必须惰性 span（fixture 零导航捕获保证），但名字照常渲染
//  F-U8 chip 名字缺渲染（accessible name = agent 名，参考站 chip 形态 = 头像+名字）
//  F-U9 #121 Link 律破：scenario search 不随行（fixture 面点进详情页丢场景）
//  F-U10 头像槽位丢（XMON-105 单源 SeededAvatar 24px 面被改造砸掉）

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, test } from 'vitest';
import { ChiefIdentity } from '../src/chief/chief-identity.js';
import type { ChiefContent } from '../src/fixtures/records.js';

type BoundAgent = NonNullable<ChiefContent['agent']>;

function render(agent: BoundAgent, entry = '/app'): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [entry] },
      createElement(ChiefIdentity, { agent }),
    ),
  );
}

const WITH_ID: BoundAgent = { id: 'r3-builder', displayName: 'r3-builder', avatarUrl: null };
const NO_ID: BoundAgent = { displayName: 'r3-builder', avatarUrl: null };

describe('chief robot 行身份 chip（#741）', () => {
  test('F-U6: agent.id 在位 → anchor，href = /app/resources/agents/<id>', () => {
    const markup = render(WITH_ID);
    expect(markup).toMatch(/<a [^>]*href="\/app\/resources\/agents\/r3-builder"/);
    expect(markup).toContain('chief-identity');
  });

  test('F-U7: agent.id 缺位 → 惰性 span，无 anchor，名字照常', () => {
    const markup = render(NO_ID);
    expect(markup).not.toContain('<a ');
    expect(markup).toMatch(/<span [^>]*class="[^"]*chief-identity/);
    expect(markup).toContain('r3-builder');
  });

  test('F-U8: chip 渲染名字（头像 + 名字并排的参考站形态）', () => {
    const markup = render(WITH_ID);
    expect(markup).toContain('chief-identity-name');
    expect(markup).toMatch(/<span[^>]*>r3-builder<\/span>/);
  });

  test('F-U9: scenario search 随行（#121 Link 律）', () => {
    const markup = render(WITH_ID, '/app?scenario=chief-agent-chip');
    expect(markup).toContain('href="/app/resources/agents/r3-builder?scenario=chief-agent-chip"');
  });

  test('F-U10: 头像槽位保 XMON-105 单源（chief-avatar--img + SeededAvatar img）', () => {
    const markup = render(WITH_ID);
    expect(markup).toContain('chief-avatar--img');
    expect(markup).toContain('<img');
    expect(markup).toContain('api.dicebear.com');
  });
});
