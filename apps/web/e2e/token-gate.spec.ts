// Token 门页 e2e（#253，spec #247 D9）：与其余 spec 的 fixture 面不同，
// 本 spec 起真 apps/server 进程（PACMAN_HOME 临时目录 + 托管 parity 构建的
// dist）打真 401 闸。失败方式枚举（web 面，server 面归 test/token-auth.test.ts）：
//   1. 鉴权开 + 无 token 首访 → 门页盖住 UI
//   2. 错 token → 停留门页 + 通用错误文案，localStorage 不写坏值
//   3. 陈旧坏 token → 启动即落门页且坏值被清除（SSE 不带坏 token 重连）
//   4. 放行后 → 原请求重试进 UI，team stream URL 带 ?token=（EventSource
//      无法设 header，server 仅两条 stream 收 query token）
//   5. localStorage 已有好 token → 首访直达 UI，零门页
//   6. 鉴权关 → 零门页，stream URL 不带 token 参数（现况一致）
// 会话流与团队流共用 sse.ts connect() 单缝——URL 构造由团队流断言代表。

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

declare global {
  interface Window {
    /** addInitScript 注入的 EventSource 构造 URL 记录（?token= 断言面）。 */
    __esUrls?: string[];
  }
}

const GATE_TOKEN = 'pacman-e2e-gate-token-0123456789abcdef';

interface LiveServer {
  base: string;
  dispose: () => void;
}

/** OS 分配空闲端口（机器级端口纪律：不碰 8390/8399，不杀既有进程）。 */
function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address !== null && typeof address === 'object') {
        const { port } = address;
        probe.close(() => resolvePort(port));
      } else {
        probe.close(() => reject(new Error('freePort: no address')));
      }
    });
  });
}

/** 起真 server：临时数据根（fresh seed）、托管本 worktree 的 dist、
 *  token 设 = 鉴权开。ready = /api/teams 打出期望状态码（开 401 / 关 200）。 */
async function bootLiveServer(token: string | null): Promise<LiveServer> {
  const home = mkdtempSync(join(tmpdir(), 'pacman-e2e-home-'));
  const port = await freePort();
  const child = spawn('pnpm', ['exec', 'tsx', 'src/index.ts'], {
    cwd: resolve(import.meta.dirname, '..', '..', 'server'),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      LOG_LEVEL: 'warn',
      PACMAN_HOME: home,
      PACMAN_WEB_DIR: resolve(import.meta.dirname, '..', 'dist'),
      ...(token !== null ? { PACMAN_TOKEN: token } : {}),
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      const res = await fetch(`${base}/api/teams`);
      if (res.status === (token !== null ? 401 : 200)) break;
    } catch {
      // 端口未起——继续轮询
    }
    if (Date.now() > deadline) {
      child.kill('SIGTERM');
      throw new Error(`live server not ready on ${base}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return {
    base,
    dispose() {
      child.kill('SIGTERM');
      rmSync(home, { recursive: true, force: true });
    },
  };
}

/** 记录每个 EventSource 构造 URL（?token= 面断言）。 */
async function recordEventSourceUrls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const urls: string[] = [];
    (window as Window).__esUrls = urls;
    const Native = window.EventSource;
    const Patched = function (url: string | URL, init?: EventSourceInit) {
      urls.push(String(url));
      return new Native(url, init);
    } as unknown as typeof EventSource;
    window.EventSource = Patched;
  });
}

async function streamUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__esUrls ?? []);
}

let authed: LiveServer;
let openServer: LiveServer;

test.beforeAll(async () => {
  authed = await bootLiveServer(GATE_TOKEN);
  openServer = await bootLiveServer(null);
});

test.afterAll(() => {
  authed.dispose();
  openServer.dispose();
});

test('鉴权开：首访落门页；错 token 停留不落盘；对 token 进 UI 且 SSE 带 ?token=', async ({
  page,
}) => {
  await recordEventSourceUrls(page);
  await page.goto(`${authed.base}/app`);

  // 失败方式 1：门页盖住 UI
  await expect(page.locator('.token-gate')).toBeVisible();
  await expect(page.locator('.token-gate-title')).toHaveText('需要访问令牌');

  // 失败方式 2：错 token → 停留 + 通用文案 + localStorage 不落坏值
  await page.locator('.token-gate-input').fill('wrong-token');
  await page.locator('.token-gate-submit').click();
  await expect(page.locator('.token-gate-error')).toHaveText('令牌无效，请重试。');
  await expect(page.locator('.token-gate')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pacman.token'))).toBeNull();
  // 错误细节不泄漏：server {error} 内容不出现在页面
  expect(await page.locator('.token-gate').innerText()).not.toContain('Unauthorized');

  // 失败方式 4：对 token → 放行、停车的原请求带 Bearer 重试成功、UI 呈现
  const retryLands = page.waitForResponse(
    (res) => res.url().endsWith('/api/teams') && res.status() === 200,
  );
  await page.locator('.token-gate-input').fill(GATE_TOKEN);
  await page.locator('.token-gate-submit').click();
  await expect(page.locator('.token-gate')).toHaveCount(0);
  await expect(page.locator('.board-sidebar')).toBeVisible();
  const retried = await retryLands;
  expect(retried.request().headers().authorization).toBe(`Bearer ${GATE_TOKEN}`);
  expect(await page.evaluate(() => localStorage.getItem('pacman.token'))).toBe(GATE_TOKEN);

  // SSE 以 ?token= 建流（EventSource 无法设 header 的协议例外）
  await expect
    .poll(async () =>
      (await streamUrls(page)).some(
        (url) => url.includes('/stream?') && new URL(url, authed.base).searchParams.get('token') === GATE_TOKEN,
      ),
    )
    .toBe(true);
});

test('鉴权开：陈旧坏 token 首访即落门页且坏值被清除', async ({ page }) => {
  await recordEventSourceUrls(page);
  await page.addInitScript(() => localStorage.setItem('pacman.token', 'stale-bad-token'));
  await page.goto(`${authed.base}/app`);

  // 失败方式 3：门页出现，坏值清除（SSE 不得带坏 token 建流）
  await expect(page.locator('.token-gate')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pacman.token'))).toBeNull();
  for (const url of await streamUrls(page)) {
    expect(url).not.toContain('stale-bad-token');
  }
});

test('鉴权开：localStorage 已有好 token → 首访直达 UI 零门页', async ({ page }) => {
  await recordEventSourceUrls(page);
  await page.addInitScript(
    (token: string) => localStorage.setItem('pacman.token', token),
    GATE_TOKEN,
  );
  const firstLoad = page.waitForResponse(
    (res) => res.url().endsWith('/api/teams') && res.status() === 200,
  );
  await page.goto(`${authed.base}/app`);

  await expect(page.locator('.board-sidebar')).toBeVisible();
  await expect(page.locator('.token-gate')).toHaveCount(0);
  expect((await firstLoad).request().headers().authorization).toBe(`Bearer ${GATE_TOKEN}`);
  await expect
    .poll(async () => (await streamUrls(page)).some((url) => url.includes('/stream?token=')))
    .toBe(true);
});

test('鉴权关：零门页零 token 附带，行为与现状一致', async ({ page }) => {
  await recordEventSourceUrls(page);
  const firstLoad = page.waitForResponse((res) => res.url().endsWith('/api/teams'));
  await page.goto(`${openServer.base}/app`);

  // 失败方式 6：门页永不出现，live 数据面直达且请求零附带
  await expect(page.locator('.board-sidebar')).toBeVisible();
  await expect(page.locator('.token-gate')).toHaveCount(0);
  const res = await firstLoad;
  expect(res.status()).toBe(200);
  expect(res.request().headers().authorization).toBeUndefined();
  await expect
    .poll(async () => (await streamUrls(page)).some((url) => url.includes('/stream')))
    .toBe(true);
  for (const url of await streamUrls(page)) {
    expect(url).not.toContain('token=');
  }
});
