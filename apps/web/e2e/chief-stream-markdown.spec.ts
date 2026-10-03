import { expect, type Page, test } from '@playwright/test';

// #650/#651 总管抽屉 markdown 单源 + 流式打字面。
// 失败方式枚举（渲染缝；mapper 缝的钉在 test/chief-markdown.test.ts）：
//  F-R1 chief 回复 `**bold**` 仍漏字面星号（没走共用解析器/内联层没 strong 位）
//  F-R2 块级 markdown（标题/列表/嵌套/代码栅栏）在抽屉里不渲染
//  F-R3 mention / 行内 code chip 被 strong 解析破坏
//  F-R4 typing 打字行带 foot（复制钮/完成徽标）——打字面被当定稿面
//  F-R5 定稿行 foot 丢失（typing gate 误伤定稿行）
//  F-R6 用户行头像仍是写死的通用人形字形（没接 XMON-105 单源）
//  F-R7 live 面 avatarUrl 覆盖不生效（不是 /api/user/me 的真值）
//  F-R8 .chief-body 仍不可滚动（overflow hidden），流式增量被裁在视野外
//  F-R9 fixture 捕获面（r5 114 段数组形）被 markdown 改造误伤（DOM 漂移）
//  F-R10 live text_delta 增量不上屏（抽屉不读 liveTextStore——原 bug 本体）
//  F-R11 终稿 message 收敛后打字行残留 / 与落库行重复渲染
//  F-R12 同文双行（POST + user-<stepId> 回声）双气泡（#667）；连发不同文塌成一条
// #742 用户气泡 markdown 面（详情页用户行 #612 同款配方；mapper 缝的钉在
// test/chief-markdown.test.ts F-D1..D5）：
//  F-R14 live 用户行仍字面吐纯文本——[#16](todo:id) 与 **bold** 在自泡漏出
//        （bug 本体）；正例 = chip 成锚可点导航，负例 = 裸 #seq / 伪 scheme 字面
//  F-R15 复制载荷漂移——复制钮拿到渲染后文本（#469 律：复制的是 markdown 源）
//  F-R16 气泡节奏塌——单行纯文本 live 气泡几何漂移（44px 药丸 = 10px padding
//        ×2 + 24px 行盒）；多块气泡首/尾块 margin 与 padding 叠出双倍留白
//  F-R17 fixture 捕获面用户气泡漂移——无槽行被误进 markdown 路径（DOM 不稳）
//
// live 面手法 = notify-click.spec 的替身 EventSource + 路由 mock（SSE 帧
// 程序化注入，不经网络）；fixture 面 = 'chief-md' 命名场景（md-toolout 先例）。

/** window 侧观测槽（init script 写入；notify-click.spec 同款替身）。 */
declare global {
  interface Window {
    __es: { url: string; readyState: number; emit: (ev: unknown) => void }[];
  }
}

function stubEventSource(page: Page) {
  return page.addInitScript(() => {
    window.__es = [];
    class FakeEventSource {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;
      readonly CONNECTING = 0;
      readonly OPEN = 1;
      readonly CLOSED = 2;
      readyState = 1;
      onopen: (() => void) | null = null;
      onmessage: ((e: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(readonly url: string) {
        window.__es.push(this as unknown as (typeof window.__es)[number]);
        queueMicrotask(() => this.onopen?.());
      }
      close() {
        this.readyState = 2;
      }
      emit(ev: unknown) {
        this.onmessage?.({ data: JSON.stringify(ev) });
      }
      addEventListener() {}
      removeEventListener() {}
    }
    Object.defineProperty(window, 'EventSource', { configurable: true, value: FakeEventSource });
  });
}

/** dicebear 桩：fixture 面用户头像走名字种子（avatarUrl null），mock 掉
 *  外网（avatar-dicebear.spec 先例），img 立即加载完成不悬 8s。 */
function stubDicebear(page: Page) {
  return page.route('**/api.dicebear.com/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#888"/></svg>',
    }),
  );
}

/** avatarUrl 覆盖桩（live 面）：1×1 PNG 直接 fulfill——不 mock 该主机会真发
 *  DNS 请求，加载失败触发 SeededAvatar 的 fallback 换 src，断言与 error 事件
 *  赛跑（全量套件下实测 flake）。 */
const PX_1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
function stubCdnAvatar(page: Page) {
  return page.route('**/cdn.example/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PX_1 }),
  );
}

// —— live 面 mock（无 scenario 参 = live 模式；notify-click.spec 同配方）——

const TEAM = { id: 't1', name: '团队' };
const USER = { id: 'u1', displayName: 'Xmon Dai', avatarUrl: 'https://cdn.example/me.png' };
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
/** activeRun 在位 = 回合进行中（typing 尾行的 gate 输入）。 */
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
const USER_ROW = { id: 'm1', role: 'user', content: '派一下凭证链路验证', createdAt: 1 };
const FINAL_ROW = { id: 'm9', role: 'assistant', content: '验证完成，**全部通过**。', createdAt: 9 };

function mockChiefLiveApi(
  page: Page,
  state: { final: boolean; messages?: { id: string; role: 'user' | 'assistant'; content: string; createdAt: number }[] },
) {
  const json = (body: unknown) => ({
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  return page.route('**/api/**', (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === '/api/teams') return route.fulfill(json([TEAM]));
    if (p === '/api/user/me') return route.fulfill(json(USER));
    if (p === '/api/teams/t1/notifications')
      return route.fulfill(json({ unreadThreadIds: [] }));
    if (p === '/api/teams/t1/chief/threads') return route.fulfill(json([THREAD]));
    if (p === '/api/teams/t1/chief') {
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
    }
    if (p === '/api/conversations/chief-bbb/messages') {
      return route.fulfill(
        json({ messages: state.messages ?? (state.final ? [USER_ROW, FINAL_ROW] : [USER_ROW]) }),
      );
    }
    if (p === '/api/todos' || p === '/api/projects') return route.fulfill(json([]));
    if (
      p === '/api/teams/t1/members' ||
      p === '/api/teams/t1/machines' ||
      p === '/api/skills'
    ) {
      return route.fulfill(json([]));
    }
    // 未覆盖路径 418 + {error}：react-query retry:1 落定后安静失败，断言面
    // 不吃这些查询（notify-click.spec 同律）。
    return route.fulfill({ status: 418, ...json({ error: `unmocked: ${p}` }) });
  });
}

/** 等到目标会话流的替身 EventSource 建流，返回程序化 emit 句柄。 */
async function chiefStream(page: Page) {
  const part = '/api/conversations/chief-bbb/stream';
  await expect
    .poll(() => page.evaluate((u) => window.__es.some((es) => es.url.includes(u)), part))
    .toBe(true);
  return {
    emit: (ev: unknown) =>
      page.evaluate(
        ([u, e]) => {
          const es = window.__es.find((x) => x.url.includes(u));
          es?.emit(e);
        },
        [part, ev] as [string, unknown],
      ),
  };
}

test.describe('chief drawer markdown 面（fixture，#650）', () => {
  test.beforeEach(async ({ page }) => {
    await stubDicebear(page);
    await page.goto('/app?scenario=chief-md');
    await expect(page.locator('.chief-drawer')).toBeVisible();
  });

  test('F-R1/R2/R3: robot markdown 行走共用块解析——bold/标题/列表/栅栏/chip 全渲染，星号零漏出', async ({
    page,
  }) => {
    const stream = page.locator('.chief-stream');
    // 字面星号一个不漏（定稿行 + 打字行全文范围）。
    await expect(stream).not.toContainText('**');

    // 标题 = 真 h2（chat-md-head 家族，detail.css 几何单源）。
    await expect(stream.locator('h2.chat-md-head')).toHaveText('凭证链路验证报告');

    // 粗体 = 真 <strong>（段落内 + bullet lead 内）。
    await expect(stream.locator('.chat-para strong', { hasText: '全部通过' })).toHaveCount(1);
    const leadBullet = stream.locator('.chat-md-item--bullet').first();
    await expect(leadBullet.locator('strong')).toHaveText('项目');
    await expect(leadBullet).toContainText(': 凭证链路验证');

    // 行内 code chip + mention chip（strong 解析不破坏既有内联家族）。
    await expect(stream.locator('.chat-code', { hasText: 'docs/verify/' })).toHaveCount(1);
    const mention = stream.locator('.mention-chip--agent');
    await expect(mention).toHaveCount(1);
    await expect(mention).toHaveText('r5-scribe');

    // 有序列表 + 嵌套子项（depth 缩进位）+ 代码栅栏（lang 位 + 原文）。
    await expect(stream.locator('.chat-md-item--ordered').first()).toContainText('第一步：读取配置');
    const nested = stream.locator('.chat-md-item--bullet[data-depth="1"]');
    await expect(nested).toHaveCount(1);
    await expect(nested).toContainText('子项：token 门');
    const fence = stream.locator('pre.chat-md-code');
    await expect(fence).toHaveAttribute('data-lang', 'sh');
    await expect(fence).toContainText('curl -s localhost:8787/healthz');
  });

  test('F-R13: todo 提及渲成 chip，锚点指任务详情并可点击导航；字面 #seq/伪 scheme 不出 chip（#675）', async ({
    page,
  }) => {
    const stream = page.locator('.chief-stream');
    const chip = stream.locator('.mention-chip--todo');
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveText('#1');
    // 点击行为 = 导航（参考站实测：todo chip click → /app/todo/<id>，
    // hover 无弹层）。真锚点（router Link）：键盘/中键免费。
    await expect(chip).toHaveAttribute('href', '/app/todo/r3-legacy-1');
    // 防正则吃宽：prose 裸 #12 与相邻 scheme 伪链 [伪链](todos:t2) 保持字面文本。
    await expect(stream).toContainText('prose #12 与 [伪链](todos:t2) 保持字面');
    expect(await stream.locator('.mention-chip').count()).toBe(
      await stream.locator('.mention-chip--agent').count() +
        (await stream.locator('.mention-chip--todo').count()),
    );
    // SPA pushState 只钉 pathname（card-press.spec 同律——query 不随钉）。
    await chip.click();
    await page.waitForURL((u) => u.pathname === '/app/todo/r3-legacy-1');
  });

  test('F-R4/R5: typing 打字行无 foot；定稿行 foot（复制 + 完成 44s）保留', async ({ page }) => {
    const msgs = page.locator('.chief-stream .chief-msg');
    // note 行不是 .chief-msg：user + 定稿 robot + typing robot = 3。
    await expect(msgs).toHaveCount(3);

    const final = msgs.nth(1);
    await expect(final.locator('.chief-msg-foot button[aria-label="复制"]')).toBeVisible();
    await expect(final.locator('.chief-msg-foot')).toContainText('完成 44s');

    const typing = msgs.nth(2);
    await expect(typing.locator('.chief-msg-foot')).toHaveCount(0);
    await expect(typing.locator('strong')).toHaveText('relay 通道');
  });

  test('F-R6/R8: 用户行头像 = 真人身份 img（XMON-105 单源），抽屉体可滚动', async ({ page }) => {
    const userRow = page.locator('.chief-stream .chief-msg').first();
    const img = userRow.locator('.chief-avatar img');
    await expect(img).toBeVisible();
    // fixture 面 avatarUrl null → dicebear 名字种子（USER_NAME canon）。
    await expect(img).toHaveAttribute('src', /api\.dicebear\.com.*Xmon%20Dai/);
    // 写死的通用人形字形退场。
    await expect(userRow.locator('.chief-avatar > svg')).toHaveCount(0);

    // 滚动容器：overflow-y auto（原 hidden 把长线程整个裁死）。
    const overflow = await page.locator('.chief-body').evaluate((el) => getComputedStyle(el).overflowY);
    expect(overflow).toBe('auto');
  });

  test('F-R9: r5 114 冻结捕获面不漂移——段数组行走原 .chief-para/.chief-bullet 路径', async ({
    page,
  }) => {
    await page.goto('/app?scenario=114');
    await expect(page.locator('.chief-drawer')).toBeVisible();
    const stream = page.locator('.chief-stream');
    // 段数组形照旧：chief-para 存在、chat-md 块零出现。
    await expect(stream.locator('.chief-para').first()).toContainText('已创建并派工');
    await expect(stream.locator('.chat-para, .chat-md-item, .chat-md-code')).toHaveCount(0);
    // todo / agent 实体 chip 保留（ChiefSegment 家族不受 markdown 槽影响）。
    await expect(stream.locator('.chief-chip-todo')).toHaveCount(1);
    await expect(stream.locator('.chief-chip-agent')).toHaveCount(1);
    // 用户行头像换 img 后，两钮行（复制/恢复）不受影响。
    await expect(stream.locator('.chief-msg-tools button')).toHaveCount(2);
  });

  test('F-R15: fixture 面（r5 113 running 捕获）不长存在行——ChiefStreamItem 新 kind 零污染', async ({
    page,
  }) => {
    // fixture 直接喂 ChiefContent.stream（不经 mapChief），running 位只切 composer
    // 占位；#739 的存在行是 live mapper 派生，捕获面尾行仍是定稿 robot 行。
    await page.goto('/app?scenario=113');
    await expect(page.locator('.chief-drawer')).toBeVisible();
    const stream = page.locator('.chief-stream');
    await expect(stream.locator('.chief-streaming')).toHaveCount(0);
    // 尾行 = 定稿 robot（带 foot），非在飞存在行。
    const lastMsg = stream.locator('.chief-msg').last();
    await expect(lastMsg.locator('.chief-msg-foot')).toHaveCount(1);
  });
});

test.describe('chief drawer 流式面（live mock，#651）', () => {
  test('F-R7/R10/R11: text_delta 增量上屏，message 终稿收敛不重复不残留', async ({ page }) => {
    await stubEventSource(page);
    await stubDicebear(page);
    await stubCdnAvatar(page);
    const state = { final: false };
    await mockChiefLiveApi(page, state);
    await page.goto('/app?chief=chief-bbb');

    const drawer = page.locator('.chief-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.chief-chip-title')).toHaveText('线程乙');

    // F-R7: live 面用户行头像 = /api/user/me 的 avatarUrl 覆盖真值。
    const userRow = drawer.locator('.chief-msg').first();
    await expect(userRow.locator('.chief-avatar img')).toHaveAttribute(
      'src',
      'https://cdn.example/me.png',
    );

    const es = await chiefStream(page);

    // F-R10: 增量一：打字面上屏，粗体即时渲染（增量面与终稿面同一解析器）。
    await es.emit({ type: 'text_delta', text: '正在验证 **凭证' });
    const typing = drawer.locator('.chief-msg').last();
    await expect(typing.locator('.chat-para')).toContainText('正在验证 凭证');
    await expect(typing.locator('strong')).toHaveText('凭证');
    await expect(typing).not.toContainText('**');
    // user 行 + typing 行；打字面无 foot。
    await expect(drawer.locator('.chief-msg')).toHaveCount(2);
    await expect(typing.locator('.chief-msg-foot')).toHaveCount(0);

    // F-R10: 增量二：同一段落追加（250ms 聚合窗口的下一批）。
    await es.emit({ type: 'text_delta', text: '链路**，马上出报告' });
    await expect(typing.locator('.chat-para')).toContainText('正在验证 凭证链路，马上出报告');
    await expect(typing.locator('strong')).toHaveText('凭证链路');

    // F-R11: 终稿 message 事件 → 缓冲 clear + messages 重取接管。
    state.final = true;
    await es.emit({ type: 'message', message: FINAL_ROW });
    // 打字行退场：user + 定稿 robot = 2 行，「正在验证」文本零残留。
    await expect(drawer.locator('.chief-msg')).toHaveCount(2);
    await expect(drawer.locator('.chief-msg', { hasText: '正在验证' })).toHaveCount(0);
    // 定稿行恰一条（不重复），粗体渲染 + foot 归位。
    const final = drawer.locator('.chief-msg').last();
    await expect(final.locator('strong', { hasText: '全部通过' })).toHaveCount(1);
    await expect(final.locator('.chief-msg-foot button[aria-label="复制"]')).toBeVisible();
  });

  test('F-R12: 双行去重（#667）——同文 POST + user-<stepId> 回声恰一个用户气泡；连发不同文各一条', async ({
    page,
  }) => {
    await stubEventSource(page);
    await stubDicebear(page);
    await stubCdnAvatar(page);
    // 生产对齐：每回合双落库（POST 行 + daemon transcript 回声行 user-<stepId>），
    // 两句话 → mock 4 条 user 行 + 1 条 robot。
    const state = {
      final: true,
      messages: [
        { id: 'm1', role: 'user' as const, content: '派一下凭证链路验证', createdAt: 1 },
        { id: 'user-stepX', role: 'user' as const, content: '派一下凭证链路验证', createdAt: 2 },
        { id: 'm2', role: 'user' as const, content: '再查一下 token 用量', createdAt: 3 },
        { id: 'user-stepY', role: 'user' as const, content: '再查一下 token 用量', createdAt: 4 },
        { id: 'm9', role: 'assistant' as const, content: '两件都办完，**全部通过**。', createdAt: 9 },
      ],
    };
    await mockChiefLiveApi(page, state);
    await page.goto('/app?chief=chief-bbb');

    const drawer = page.locator('.chief-drawer');
    await expect(drawer).toBeVisible();
    // 每句恰一个用户气泡（.chief-bubble 只在 user 行）：2 user + 1 robot = 3 行。
    await expect(drawer.locator('.chief-bubble')).toHaveCount(2);
    await expect(drawer.locator('.chief-msg')).toHaveCount(3);
    await expect(drawer.locator('.chief-bubble', { hasText: '派一下凭证链路验证' })).toHaveCount(1);
    await expect(drawer.locator('.chief-bubble', { hasText: '再查一下 token 用量' })).toHaveCount(1);
  });

  test('F-R14: 在飞存在行（#739）——静默窗口挂 streaming 行，首 delta 收敛为 typing，终稿两行皆退场', async ({
    page,
  }) => {
    await stubEventSource(page);
    await stubDicebear(page);
    await stubCdnAvatar(page);
    // running 在位（THREAD.activeRun）、缓冲空、终稿未落 = 发送到首 token 的
    // 静默窗口（绑定慢模型时分钟级）。
    const state = { final: false };
    await mockChiefLiveApi(page, state);
    await page.goto('/app?chief=chief-bbb');

    const drawer = page.locator('.chief-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.chief-chip-title')).toHaveText('线程乙');

    // 静默窗口：存在行立即可见——loading-dev Atom spinner + 处理中... 标签，
    // 与详情页 streaming 行同族；user 行 + 存在行 = 2，打字面尚未出现。
    const presence = drawer.locator('.chief-msg').last();
    await expect(presence.locator('.chief-streaming')).toBeVisible();
    await expect(presence.locator('.chief-spinner')).toHaveCount(1);
    await expect(presence.locator('.chief-streaming-label')).toHaveText('处理中...');
    // #471：不挂秒数（静止期无流事件驱动重渲，秒数会冻结说谎；本票不加计时器）。
    await expect(presence.locator('.chief-streaming-secs')).toHaveCount(0);
    await expect(drawer.locator('.chief-msg')).toHaveCount(2);
    await expect(presence.locator('.chat-para')).toHaveCount(0);

    const es = await chiefStream(page);

    // 首 delta 到达 → 存在行收敛为 typing 打字行（两行互斥，尾部恒至多一行）。
    await es.emit({ type: 'text_delta', text: '正在验证 **凭证' });
    await expect(drawer.locator('.chief-streaming')).toHaveCount(0);
    const typing = drawer.locator('.chief-msg').last();
    await expect(typing.locator('.chat-para')).toContainText('正在验证 凭证');
    await expect(typing.locator('.chief-msg-foot')).toHaveCount(0);
    await expect(drawer.locator('.chief-msg')).toHaveCount(2);

    // 终稿 message 落库 → 打字行退场，定稿 robot 行接管；存在行/打字行皆不残留。
    state.final = true;
    await es.emit({ type: 'message', message: FINAL_ROW });
    await expect(drawer.locator('.chief-streaming')).toHaveCount(0);
    await expect(drawer.locator('.chief-msg', { hasText: '正在验证' })).toHaveCount(0);
    const final = drawer.locator('.chief-msg').last();
    await expect(final.locator('strong', { hasText: '全部通过' })).toHaveCount(1);
  });
});

test.describe('chief drawer 用户气泡 markdown 面（live mock，#742）', () => {
  // 验收样例逐字进 mock：todo 提及 link 形 + 粗体 + 三面字面负例一句话打包。
  const MD_USER =
    '派 [#16](todo:t16) 去处理，**优先** 检查；prose #12 与 [伪链](todos:t2) [空](todo:) 保持字面';
  const PLAIN_USER = '收到，谢谢';
  const FENCE_USER = '```sh\necho before-and-after\n```';

  async function boot(page: Page) {
    await stubEventSource(page);
    await stubDicebear(page);
    await stubCdnAvatar(page);
    await mockChiefLiveApi(page, {
      final: true,
      messages: [
        { id: 'm1', role: 'user', content: MD_USER, createdAt: 1 },
        { id: 'm2', role: 'user', content: PLAIN_USER, createdAt: 2 },
        { id: 'm3', role: 'user', content: FENCE_USER, createdAt: 3 },
        { id: 'm9', role: 'assistant', content: '三件都办完。', createdAt: 9 },
      ],
    });
    await page.goto('/app?chief=chief-bbb');
    const drawer = page.locator('.chief-drawer');
    await expect(drawer).toBeVisible();
    return drawer;
  }

  test('F-R14: 用户气泡走同源解析——todo chip 成锚可点导航、bold 成 strong、负例保持字面', async ({
    page,
  }) => {
    const drawer = await boot(page);
    const bubble = drawer.locator('.chief-bubble').first();
    // 气泡类名双态（#612 配方）：live 用户行带槽进 md 路径。
    await expect(bubble).toHaveClass(/chief-bubble--md/);
    // 字面漏出归零：粗体定界符与链接语法不再以文本形态出现。
    await expect(bubble).not.toContainText('**');
    await expect(bubble).not.toContainText('[#16]');
    // bold = 真 strong（与 robot 行同一内联层）。
    await expect(bubble.locator('strong')).toHaveText('优先');
    // todo chip = 真锚点（router Link，#678 已通面），href 指任务详情。
    const chip = bubble.locator('.mention-chip--todo');
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveText('#16');
    await expect(chip).toHaveAttribute('href', '/app/todo/t16');
    // 负例集（t-0059 probe 三面在用户气泡内同律）：裸 #seq / 相邻 scheme /
    // 空 id 保持字面文本，chip 总数不因它们增加。
    await expect(bubble).toContainText('prose #12 与 [伪链](todos:t2) [空](todo:) 保持字面');
    await expect(bubble.locator('.mention-chip')).toHaveCount(1);
    // 点击 = 导航（F-R13 同律；SPA pushState 只钉 pathname，放行末位）。
    await chip.click();
    await page.waitForURL((u) => u.pathname === '/app/todo/t16');
  });

  test('F-R15: 复制载荷 = markdown 原文（不是渲染结果）；两钮行（复制/恢复）不受影响', async ({
    page,
  }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const drawer = await boot(page);
    const firstUser = drawer.locator('.chief-msg').first();
    await expect(firstUser.locator('.chief-msg-tools button')).toHaveCount(2);
    await expect(
      firstUser.locator('.chief-msg-tools button[aria-label="恢复到此处"]'),
    ).toBeVisible();
    await firstUser.locator('.chief-msg-tools button[aria-label="复制"]').click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    // #469 律：复制的是消息 markdown 源——wire 原文逐字（trim 归一后全等）。
    expect(clip).toBe(MD_USER);
  });

  test('F-R16: 单行纯文本气泡几何不漂移（44px 药丸）；多块气泡首/尾块 margin 修剪生效', async ({
    page,
  }) => {
    const drawer = await boot(page);
    // live 面纯文本消息同样走 md 路径——几何必须与原字面路径逐值咬合。
    const plain = drawer.locator('.chief-bubble', { hasText: PLAIN_USER });
    const geo = await plain.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { h: Math.round(r.height), font: getComputedStyle(el).fontSize };
    });
    expect(geo.h).toBe(44); // 10px padding ×2 + 24px 行盒（现状逐像素同值）
    expect(geo.font).toBe('14px');
    // 整条消息 = 单个代码栅栏：首/尾块 margin 归零，不与 10px/12px padding
    // 叠出双倍留白（#612 chat-bubble--md 修剪的抽屉版）。
    const fence = drawer.locator('.chief-bubble', { hasText: 'echo before-and-after' });
    const pre = fence.locator('pre.chat-md-code');
    await expect(pre).toBeVisible();
    const margins = await pre.evaluate((el) => ({
      top: getComputedStyle(el).marginTop,
      bottom: getComputedStyle(el).marginBottom,
    }));
    expect(margins.top).toBe('0px');
    expect(margins.bottom).toBe('0px');
  });

  test('F-R17: fixture 捕获面用户气泡零漂移——无槽走字面路径（无 --md 类、无 chat-md 块）', async ({
    page,
  }) => {
    await stubDicebear(page);
    await page.goto('/app?scenario=chief-md');
    await expect(page.locator('.chief-drawer')).toBeVisible();
    const bubble = page.locator('.chief-stream .chief-bubble');
    await expect(bubble).toHaveCount(1);
    await expect(bubble).toHaveText('验证一下凭证链路，然后给我一份报告');
    // fixture user 项不挂槽（单源在 live mapper）——捕获字节级稳定。
    await expect(bubble).not.toHaveClass(/chief-bubble--md/);
    await expect(bubble.locator('.chat-para, .chat-md-item, .chat-md-code')).toHaveCount(0);
  });
});
