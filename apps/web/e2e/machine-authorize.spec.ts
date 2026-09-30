// 浏览器授权页 e2e（#285 路径一，route `/app/machines/authorize`）。本页此前
// web 侧零钉扎（#409 盘点 0 处），域内行为面是真空——本 spec 建最小回归网。
// 新增钉扎面按 #411 政策 1 走语义 locator（getByRole / getByText），不新铸
// 类名钉；唯一类别名例外 = .authorize-backdrop（纯布局 wrapper，无语义角色
// 可挂）。覆盖面 = 该页四个渲染分支（idle / pending / expired / authorized），
// 即相位机六相位中除 authorizing（瞬时过渡）与 error（见下）外的全部。
// 失败方式枚举（本 spec 面；server 侧归 apps/server/test/enroll-browser.test.ts）：
//   1. 无参到达 → idle 面：背板与卡在位、标题与引导语就位、生成授权链接钮可点
//   2. ?enroll=<id> 到达 → 轮询驱动相位（本页相位机的唯一网络缝 = poll）：
//      pending 面 = 待授权文案 + 确认授权钮；expired 面 = 失效文案（无钮）
//   3. authorized 面 = 完成文案 + machineId 元信息
// 相位取值由 poll 决定，故测试用 page.route 直接喂该端点——不依赖 fixture 侧
// 对 enroll 端点的兜底答复（fixture 现答 expired，属实现细节，不是本页契约）。
// 未覆盖：error 分支（.authorize-error，需 stub confirm 409/404；声明见
// docs/verify/426/README.md 未覆盖段）。

import { expect, type Page, test } from '@playwright/test';

const AUTHORIZE = '/app/machines/authorize';
const POLL = '**/api/machine/enroll/poll';

/** 喂 poll 一个相位答复（本页相位机的唯一输入）。 */
async function pollSays(page: Page, body: Record<string, unknown>): Promise<void> {
  await page.route(POLL, (route) => route.fulfill({ status: 200, json: body }));
}

/** 页面唯一 region = 授权卡（Card 携 role=region + aria-label）。 */
function card(page: Page) {
  return page.getByRole('region', { name: '授权机器' });
}

test('无参到达 → idle 面（背板 + 卡 + 标题 + 引导语 + 生成授权链接钮）', async ({ page }) => {
  await page.goto(AUTHORIZE);
  await expect(page.locator('.authorize-backdrop')).toBeVisible();
  await expect(card(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: '授权机器' })).toBeVisible();
  await expect(page.getByText('生成授权链接，在执行机上完成注册发起。')).toBeVisible();
  await expect(page.getByRole('button', { name: '生成授权链接' })).toBeEnabled();
});

test('?enroll=<id> + poll=pending → 待授权面（文案 + 确认授权钮）', async ({ page }) => {
  await pollSays(page, { status: 'pending' });
  await page.goto(`${AUTHORIZE}?enroll=e2e-enroll`);
  await expect(
    page.getByText('一台执行机请求加入你的团队。确认后它将以自己的凭据连接。'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '确认授权' })).toBeEnabled();
});

test('?enroll=<id> + poll=expired → 失效面（文案，无钮）', async ({ page }) => {
  await pollSays(page, { status: 'expired' });
  await page.goto(`${AUTHORIZE}?enroll=e2e-enroll`);
  await expect(page.getByText('授权链接已失效，请在执行机上重新发起。')).toBeVisible();
  await expect(card(page).getByRole('button')).toHaveCount(0);
});

test('?enroll=<id> + poll=authorized → 完成面（文案 + machineId 元信息）', async ({ page }) => {
  await pollSays(page, {
    status: 'authorized',
    machine: {
      machineId: 'e2e-machine-id',
      token: 'e2e-token',
      teamId: 'e2e-team',
      serverUrl: 'http://127.0.0.1:1',
    },
  });
  await page.goto(`${AUTHORIZE}?enroll=e2e-enroll`);
  await expect(page.getByText('授权完成，机器已注册。')).toBeVisible();
  await expect(page.getByText('machineId: e2e-machine-id')).toBeVisible();
});