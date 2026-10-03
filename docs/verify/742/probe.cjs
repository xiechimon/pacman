// #742 evidence probe — chief live-mock drawer whose USER messages carry the
// exact acceptance samples from the ticket: a `[#16](todo:<id>)` mention and
// a `**bold**` run, plus the literal-negative trio (bare #seq / adjacent
// scheme / empty id). Same script runs against the before (origin/main) and
// after (branch) fixture-preview stacks; only the stack differs (the t-0059
// paired-probe recipe, docs/verify/675/probe.cjs precedent).
//
// Run: env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
//   NODE_PATH=<repo>/apps/web/node_modules node probe.cjs <baseURL> <outPrefix>
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
// 验收样例（票面逐字）：`[#16](todo:…)` 要渲染成真 chip、`**bold**` 要变粗。
const CHIP_MSG = '派 [#16](todo:t16) 去处理凭证链路验证';
const BOLD_MSG = '**优先** 检查 relay 通道，然后跑一遍回归';
const NEG_MSG = '任务 #12 与 [伪链](todos:t2) [空](todo:) 保持字面';
const MSGS = [
  { id: 'm1', role: 'user', content: CHIP_MSG, createdAt: 1 },
  { id: 'm2', role: 'user', content: BOLD_MSG, createdAt: 2 },
  { id: 'm3', role: 'user', content: NEG_MSG, createdAt: 3 },
  { id: 'm9', role: 'assistant', content: '三件都已安排。', createdAt: 9 },
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
    // user bubbles only — the robot row was already parsed before #742; the
    // ticket surface is the user's own bubble.
    const bubbles = [...document.querySelectorAll('.chief-msg')].filter((m) =>
      m.querySelector('.chief-bubble'),
    );
    const [chipB, boldB, negB] = bubbles.map((m) => m.querySelector('.chief-bubble'));
    const chip = chipB ? chipB.querySelector('.mention-chip--todo') : null;
    const strong = boldB ? boldB.querySelector('strong') : null;
    const h = (el) => (el ? Math.round(el.getBoundingClientRect().height) : null);
    return {
      userBubbleCount: bubbles.length,
      chipBubble: {
        mdClass: chipB ? chipB.classList.contains('chief-bubble--md') : null,
        chipCount: chipB ? chipB.querySelectorAll('.mention-chip--todo').length : null,
        chipText: chip ? chip.textContent : null,
        chipTag: chip ? chip.tagName : null,
        chipHref: chip ? chip.getAttribute('href') : null,
        literalLeak: chipB ? chipB.textContent.includes('[#16](todo:t16)') : null,
        height: h(chipB),
      },
      boldBubble: {
        strongCount: boldB ? boldB.querySelectorAll('strong').length : null,
        strongText: strong ? strong.textContent : null,
        literalLeak: boldB ? boldB.textContent.includes('**') : null,
      },
      negBubble: {
        chipCount: negB ? negB.querySelectorAll('.mention-chip').length : null,
        prosePlain: negB ? negB.textContent.includes('任务 #12') : null,
        pseudoLiteral: negB ? negB.textContent.includes('[伪链](todos:t2)') : null,
        emptyIdLiteral: negB ? negB.textContent.includes('[空](todo:)') : null,
      },
    };
  });
  console.log(JSON.stringify(obs, null, 1));
  const fs = require('node:fs');
  fs.writeFileSync(`${out}.json`, JSON.stringify(obs, null, 2));

  // element shots: chip bubble + bold bubble; then the whole drawer for context
  const msgs = await page.$$('.chief-msg');
  const bubbleOf = async (i) => (await msgs[i].$('.chief-bubble')) ?? msgs[i];
  await (await bubbleOf(0)).screenshot({ path: `${out}-chip.png` });
  await (await bubbleOf(1)).screenshot({ path: `${out}-bold.png` });
  const drawer = await page.$('.chief-drawer');
  await (drawer ?? page).screenshot({ path: `${out}-drawer.png` });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
