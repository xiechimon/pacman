import { expect, test } from '@playwright/test';
import { stubNotification } from './helpers.js';

// Issue #1031 验收：/app/account 两个控件真接线。
// 判因面（票面实测指纹）：
//  ① 改名压根没接线——名称行 = 纯文本 + 装饰性 SquarePen svg，ProfileRow
//    渲染 div 无 onClick（tag: DIV / hasBtn: false / cursor: auto）；
//  ② 通知开关结构性单向——checked 完全受控于 Notification.permission 且
//    处理器只在 checked===true 时动作，granted 态点「关」aria-checked 恒 true。
// 口径：点了必须有可解释的结果。开关 = 用户偏好档（本地持久化覆盖），
// 权限只决定「真弹与否」，被拒时开态必须带拦截解释；改名照 agent 详情页
// 正例（按钮 → 内联输入 → Enter/失焦提交、Esc 放弃、空白不提交），落盘
// 走 PATCH /api/user/me（GET 同名 [推断]）。
//
// 失败方式枚举（先列后钉，与测试一一对应）：
//  改名面（R）：
//   R1 名称行值槽无可点载体（无 button 角色 / 铅笔仍是装饰）      → test 1
//   R2 点名称/铅笔不进编辑态（无 textbox 出现）                    → test 1
//   R3 编辑框不预填当前名 / 不聚焦                                 → test 1
//   R4 Enter 不提交（行文本不变 / 编辑态不收）                     → test 1
//   R5 Esc 不取消（编辑态卡死或误提交）                            → test 2
//   R6 空串/纯空白名被提交（身份位空白）                           → test 2
//   R7 live 面提交不发 PATCH /api/user/me（落盘通道没接）          → test 3
//   R8 刷新后名字回旧值（往返不持久）                              → test 3
//   R9 提交失败无可见解释（静默吞错）/ 行面误报新名                → test 3
//  开关面（S）：
//   S1 granted 态关不掉（aria-checked 恒 true——票面指纹）         → test 4
//   S2 关档不随刷新持久（偏好没落存储）                            → test 4
//   S3 denied 态点击无持久可见变化                                 → test 5
//   S4 denied 开态无拦截解释（显示开而实际不弹 = 新假可供性）      → test 5
//   S5 default 态开不驱动 requestPermission（#114 路径回归）       → test 6
//   S6 fixture 面表达不了 denied（permission 冻死 granted）        → test 7
//   S7 偏好 off 时 SSE 通知照弹（「关」没落到通知本体）            → notify-click.spec T5
//  探针面（P）：
//   P1 帐号卡内任一控件点击无可观察效果（假可供性残留）            → test 8

declare global {
  interface Window {
    __probeMutated: boolean;
  }
}

const USER_NAME = 'Xmon Dai'; // fixtures.ts USER_NAME 同值（e2e 不 import src，仓规）

// —— ① 改名 ——————————————————————————————————————————————————————————————

test('改名：名称行有真按钮载体，点进编辑态预填聚焦，Enter 提交落行（R1–R4）', async ({
  page,
}) => {
  await page.goto('/app/account?scenario=13');
  const card = page.locator('.account-card');
  await expect(card).toBeVisible();

  // R1：值槽有 button 载体——文本钮 + aria-label 编辑的铅笔钮（旧面 = 纯文本
  // div + 装饰 svg，两个载体都不存在）
  const nameBtn = card.getByRole('button', { name: USER_NAME, exact: true });
  await expect(nameBtn).toBeVisible();
  const editBtn = card.getByRole('button', { name: '编辑' });
  await expect(editBtn).toBeVisible();

  // R2/R3：点文本进编辑态，预填当前名并聚焦
  await nameBtn.click();
  const input = card.getByRole('textbox');
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(USER_NAME);

  // R4：Enter 提交，编辑态收起，行面显示新名
  await input.fill('改名之后');
  await input.press('Enter');
  await expect(card.getByRole('textbox')).toHaveCount(0);
  await expect(card.getByRole('button', { name: '改名之后', exact: true })).toBeVisible();

  // 铅笔钮是第二入口：同样进编辑态，且预填的是刚提交的新名
  await editBtn.click();
  await expect(card.getByRole('textbox')).toHaveValue('改名之后');
  await card.getByRole('textbox').press('Escape');
});

test('改名：Esc 取消不误提交；空串与纯空白名不提交（R5/R6）', async ({ page }) => {
  await page.goto('/app/account?scenario=13');
  const card = page.locator('.account-card');
  const nameBtn = card.getByRole('button', { name: USER_NAME, exact: true });

  // R5：Esc 放弃草稿，行面回原名
  await nameBtn.click();
  await card.getByRole('textbox').fill('半路放弃');
  await card.getByRole('textbox').press('Escape');
  await expect(card.getByRole('textbox')).toHaveCount(0);
  await expect(nameBtn).toBeVisible();

  // R6：空白名是提交闸（displayName min(1)，空白视同空）——编辑态收起、
  // 行面保持原名
  await nameBtn.click();
  await card.getByRole('textbox').fill('   ');
  await card.getByRole('textbox').press('Enter');
  await expect(card.getByRole('textbox')).toHaveCount(0);
  await expect(nameBtn).toBeVisible();
});

test('改名 live：提交发 PATCH /api/user/me、刷新后仍是新名、失败有 toast 点名（R7–R9）', async ({
  page,
}) => {
  // live 面（无 ?scenario=）：/api/user/me 双动词打桩——GET 供数、PATCH 落
  // 状态（board-dnd-live 的 stubBoot 纪律同款；其余 GET 走 preview SPA 回退
  // 安静失败，应用既有 isError 耐受）。
  let current = USER_NAME;
  let failPatch = false;
  const patchBodies: unknown[] = [];
  const userJson = () => ({ id: 'user-1', displayName: current, avatarUrl: null, type: 'user' });
  await page.route('**/api/user/me', (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { displayName?: string };
      patchBodies.push(body);
      if (failPatch) return route.fulfill({ status: 500, json: { error: 'boom' } });
      current = body.displayName ?? current;
      return route.fulfill({ json: userJson() });
    }
    return route.fulfill({ json: userJson() });
  });

  await page.goto('/app/account');
  const card = page.locator('.account-card');
  await card.getByRole('button', { name: USER_NAME, exact: true }).click();
  await card.getByRole('textbox').fill('落库名字');
  await card.getByRole('textbox').press('Enter');

  // R7：PATCH 真发出去，body = 改名单字段
  await expect.poll(() => patchBodies.length).toBe(1);
  expect(patchBodies[0]).toEqual({ displayName: '落库名字' });
  // 往返收口：invalidate 重取后行面 = 服务端真值
  await expect(card.getByRole('button', { name: '落库名字', exact: true })).toBeVisible();

  // R8：刷新后仍是新名（持久化经 API 往返，不是组件态残影）
  await page.reload();
  await expect(card.getByRole('button', { name: '落库名字', exact: true })).toBeVisible();

  // R9：提交失败 toast 点名，行面不误报新名
  failPatch = true;
  await card.getByRole('button', { name: '落库名字', exact: true }).click();
  await card.getByRole('textbox').fill('坏名字');
  await card.getByRole('textbox').press('Enter');
  await expect.poll(() => patchBodies.length).toBe(2);
  const toast = page.locator('[data-sonner-toast]').first();
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('保存失败，请重试。');
  await expect(card.getByRole('button', { name: '落库名字', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: '坏名字', exact: true })).toHaveCount(0);
});

// —— ② 推送通知开关 ————————————————————————————————————————————————————————

test('开关：granted 态能关掉、关档随刷新持久、能再开回来（S1/S2）', async ({ page }) => {
  await stubNotification(page, 'granted', 'granted');
  await page.goto('/app/account');
  const sw = page.getByRole('switch', { name: '推送通知' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');

  // S1：关得掉（旧面 = 结构性空操作，aria-checked 恒 true）
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  // S2：偏好落存储，刷新不回弹
  await page.reload();
  await expect(sw).toHaveAttribute('aria-checked', 'false');

  // 开回来：权限已 granted，无需再请求（#114 路径只在非 granted 时驱动）
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => window.__permCalls)).toBe(0);
  await page.reload();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
});

test('开关：denied 态开出偏好档 + 拦截解释、关得掉，两档都随刷新持久（S3/S4）', async ({
  page,
}) => {
  await stubNotification(page, 'denied', 'denied');
  await page.goto('/app/account');
  const sw = page.getByRole('switch', { name: '推送通知' });
  const hint = page.locator('.account-card .profile-hint');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(hint).toHaveCount(0); // 关档不出解释（无「开着却不弹」的矛盾）

  // S3：点击有持久可见变化（旧面永远 false）
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => window.__permCalls)).toBe(1);
  // S4：开而权限被拒——必须带可解释的拦截提示，不许「显示开、实际不弹」裸奔
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('重新允许');
  await page.reload();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(hint).toBeVisible();

  // 关得掉，解释随关档撤下
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(hint).toHaveCount(0);
  await page.reload();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
});

test('开关：default 态开出驱动 requestPermission，granted 落定后开档持久（S5）', async ({
  page,
}) => {
  await stubNotification(page, 'default', 'granted');
  await page.goto('/app/account');
  const sw = page.getByRole('switch', { name: '推送通知' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => window.__permCalls)).toBe(1);
  // 刷新面：偏好档持久。桩的 permission 每次导航复位 default（真实浏览器会
  // 记住 granted）——开关吃偏好档，不被权限桩的复位拉回 off，这正是
  // 「状态不能只由浏览器权限推导」的持久面证据。
  await page.reload();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
});

test('开关 fixture 面：scenario 可冻 denied——关态起步、点开出拦截解释；13 基线仍开（S6）', async ({
  page,
}) => {
  await page.goto('/app/account?scenario=13-notify-denied');
  const sw = page.getByRole('switch', { name: '推送通知' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.account-card .profile-hint')).toContainText('重新允许');

  // r7 13 基线行不漂：无偏好存储时 granted 冻结面仍是开态
  await page.goto('/app/account?scenario=13');
  await expect(page.getByRole('switch', { name: '推送通知' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

// —— ③ 假可供性探针 ————————————————————————————————————————————————————————

test('探针：帐号卡内每个控件点击都有可观察效果（P1，不只验改名与开关两个）', async ({
  page,
}) => {
  await page.goto('/app/account?scenario=13');
  const card = page.locator('.account-card');
  // 只枚举用户感知的可点控件（button / switch / link）。不枚举裸 input：
  // Base UI Switch 会挂一个 hidden `<input type=checkbox>` 做表单关联，那不是
  // 独立可点面；名称编辑器 input 是点名称钮后的瞬态（由点名称钮这一步覆盖）。
  const SELECTOR = 'button, [role="switch"], a[href]';
  const descriptors = await card
    .locator(SELECTOR)
    .evaluateAll((els) =>
      els.map((el) => ({
        // 原生 <a href> 的 ARIA 角色是 link（不是标签名 a）；<button> 无 role
        // 属性时角色是 button。其余取标签名兜底（当前卡内只有 button/switch）。
        role:
          el.getAttribute('role') ??
          (el.tagName === 'BUTTON' ? 'button' : el.tagName === 'A' ? 'link' : el.tagName.toLowerCase()),
        name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim(),
      })),
    );
  // 探针空转 = 没测：名称钮 / 编辑铅笔 / 语言触发器 / 开关 = 4 个可点控件
  expect(descriptors.length).toBeGreaterThanOrEqual(4);

  for (const d of descriptors) {
    // 每个控件拿全新面：点击会改 DOM/控件集（名称钮点开编辑态、语言触发器
    // 开菜单），共面串测会互相踩。
    await page.goto('/app/account?scenario=13');
    await page.locator('.account-card').evaluate((el) => {
      window.__probeMutated = false;
      new MutationObserver(() => {
        window.__probeMutated = true;
      }).observe(el, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    });
    const target = card.getByRole(d.role as 'button', { name: d.name, exact: true });
    await expect(target, `控件定位丢失: ${d.role}/${d.name}`).toHaveCount(1);
    await target.click();
    // 效果判据 = 卡子树内任一 DOM/属性变化（aria-checked、aria-expanded、
    // 编辑态替换、菜单 Portal 落 langDock 都在卡内）。壳面控件（侧栏/顶栏/
    // 用户菜单）各有专 spec 钉（title-band-clicks / user-menu-nav /
    // dead-buttons），本探针钉的是帐号卡这张缺陷面。
    await expect
      .poll(() => page.evaluate(() => window.__probeMutated), {
        timeout: 2000,
        message: `假可供性: ${d.role}/${d.name} 点击后无可观察变化`,
      })
      .toBe(true);
  }
});
