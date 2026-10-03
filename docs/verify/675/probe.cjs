// t-0059 (#675) evidence probe — chief live-mock drawer carrying a todo
// mention in the exact wire shape the chief system prompt instructs
// (`[#n](todo:<id>)`). Same script runs against the before (origin/main)
// and after (branch) fixture-preview stacks; only the stack differs.
//
// Run: NODE_PATH=<repo>/apps/web/node_modules node /tmp/t-0059-probe.cjs <baseURL> <outPrefix>
const { chromium } = require('@playwright/test');

const baseURL = process.argv[2];
const out = process.argv[3];

const TEAM = { id: 't1', name: '团队' };
const USER = { id: 'u1', displayName: 'Xmon Dai', avatarUrl: null };
const AGENT = {
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
const THREAD = {
  id: 'chief-bbb',
  chiefId: 'chief-u1-t1',
  userId: 'u1',
  teamId: 't1',
  title: '线程乙',
  createdAt: 2,
  updatedAt: 2,
  lastTurnAt: null,
  session: { runtime: 'pi', id: 's2', openedAt: 2 },
  pendingSessionResumeAt: null,
  toolDefHashes: {},
  toolResultHashes: {},
  activeRun: { phase: 'chief' },
};
const MENTION_MD = [
  '已创建并派工 [#24](todo:t-24)「新建 docs/r98-notes.md 介绍仓库用途」，交给文档类 agent [r5-scribe](agent:agent-1) 承接。',
  '',
  '字面例：任务 #12 停在 review，[伪链](todos:t2) 与 [空](todo:) 保持字面。',
].join('\n');
const MSGS = [
  { id: 'm1', role: 'user', content: '把 r98 笔记和日期脚本派出去', createdAt: 1 },
  { id: 'm9', role: 'assistant', content: MENTION_MD, createdAt: 9 },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 732 },
    colorScheme: 'dark',
  });
  await page.addInitScript(() => {
    window.__es = [];
    class FakeEventSource {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;
      constructor(url) {
        this.url = url;
        this.readyState = 1;
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        window.__es.push(this);
        queueMicrotask(() => this.onopen?.());
      }
      close() {
        this.readyState = 2;
      }
      emit(ev) {
        this.onmessage?.({ data: JSON.stringify(ev) });
      }
      addEventListener() {}
      removeEventListener() {}
    }
    Object.defineProperty(window, 'EventSource', { configurable: true, value: FakeEventSource });
  });
  const json = (body) => ({ contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api.dicebear.com/**', (r) =>
    r.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#888"/></svg>',
    }),
  );
  await page.route('**/api/**', (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === '/api/teams') return route.fulfill(json([TEAM]));
    if (p === '/api/user/me') return route.fulfill(json(USER));
    if (p === '/api/teams/t1/notifications')
      return route.fulfill(json({ unreadThreadIds: [] }));
    if (p === '/api/teams/t1/chief/threads') return route.fulfill(json([THREAD]));
    if (p === '/api/teams/t1/chief')
      return route.fulfill(
        json({
          chief: {
            id: 'chief-u1-t1',
            userId: 'u1',
            teamId: 't1',
            agent: { agentId: 'agent-1' },
            charter: null,
            lastTurnAt: null,
            createdAt: 0,
            tz: null,
          },
          agentActor: AGENT,
          context: null,
          watches: [],
          wakes: [],
        }),
      );
    if (p === '/api/conversations/chief-bbb/messages')
      return route.fulfill(json({ messages: MSGS }));
    if (p === '/api/todos' || p === '/api/projects') return route.fulfill(json([]));
    if (
      p === '/api/teams/t1/members' ||
      p === '/api/teams/t1/machines' ||
      p === '/api/skills'
    )
      return route.fulfill(json([]));
    return route.fulfill({ status: 418, ...json({ error: `unmocked: ${p}` }) });
  });
  await page.goto(`${baseURL}/app?chief=chief-bbb`);
  await page.waitForSelector('.chief-drawer', { timeout: 20000 });
  await page.waitForSelector('.chief-msg', { timeout: 20000 });
  await page.waitForTimeout(2000);
  const obs = await page.evaluate(() => {
    const chip = document.querySelector('.mention-chip--todo');
    const stream = document.querySelector('.chief-stream');
    const cs = chip ? getComputedStyle(chip) : null;
    return {
      todoChipCount: document.querySelectorAll('.mention-chip--todo').length,
      agentChipCount: document.querySelectorAll('.mention-chip--agent').length,
      chipText: chip ? chip.textContent : null,
      chipTag: chip ? chip.tagName : null,
      chipHref: chip ? chip.getAttribute('href') : null,
      chipColor: cs ? cs.color : null,
      chipBg: cs ? cs.backgroundColor : null,
      chipRadius: cs ? cs.borderRadius : null,
      chipCursor: cs ? cs.cursor : null,
      literalLeak: stream ? stream.textContent.includes('[#24](todo:t-24)') : null,
      prosePlain: stream ? stream.textContent.includes('任务 #12 停在 review') : null,
      pseudoLiteral: stream ? stream.textContent.includes('[伪链](todos:t2)') : null,
      emptyIdLiteral: stream ? stream.textContent.includes('[空](todo:)') : null,
    };
  });
  console.log(JSON.stringify(obs, null, 1));
  const fs = require('node:fs');
  fs.writeFileSync(`${out}.json`, JSON.stringify(obs, null, 2));
  const el = await page.$('.chief-drawer');
  await (el ?? page).screenshot({ path: `${out}.png` });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
