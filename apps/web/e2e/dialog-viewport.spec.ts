import { expect, type Locator, test } from '@playwright/test';

// #193: 矮视口(800×500)+ 各弹窗最高内容态下,submit/取消恒在视口内可点,
// 内容区(dialog-body)滚动而不推挤按钮区(dialog-foot)。#175 只修了 provider
// 本弹窗,本 spec 把该验收钉到整族(DialogShell 全部消费点;mcp 添加弹窗已随
// spec 13/#368 本地 config 只读制撤除)。「自建 dialog 容器经 grep 证实不
// 存在」这句旧断言已过期——schedules 新建定时曾自组裸 DialogContent(无封
// 顶/无滚动/footer 不钉底),#1037 收编回 DialogShell 并在 900×420 补钉
// (本文件末条)。每条钉一个面的一种失败方式:
// 1. provider(#175 源头面):3 模型行 → body 溢出,submit 钉底且滚动不位移
// 2. secret / 4. agent / 5. charter:静态表单面 → submit/取消 在视口
// 3. machine:disclosure 展开(最高内容态)→ 底部链接在视口
// 6. chief-agent 列表 / 7. token:无按钮读面 → 面板整体不越视口
// 8. branch sync tab(#366 起从看板卡片分支图标开——详情路由同面改为右 pane
//    静止 section,不再弹窗):全高 410 在 500 视口内天然装得下,压 360 视口
//    验证封顶后同步钮钉底;body 溢出
// 9. history 重跑 footer(57f)→ 重跑钮在视口
// 10. accept(34)→ 取消/完成在视口
// #944/#910 载体（仅 resources 面）：.res-new/.res-add → role+文案；
// .dlg-provider-custom/-model-add/-create → getByRole(button)；
// .dlg-enroll-toggle → getByRole(button 文案)；.dlg-enroll-apikey/-keylink →
// link 文案一级。#950：chief 两面（charter / chief-agent）迁 role 载体——
// .chief-edit-btn/.chief-dlg-ghost/-primary/.chief-agent-row/.chief-pick-list
// 随 chief.css 退役（.dlg 壳级别名存活至 #952，壳层探针原样）。其余面
// （agent 的 .dlg-* 别名）属 #945/#952，原样不动。#951/#910 重钉：
// branch/accept 面 .dlg-sync → getByRole(button 同步)、.dlg-branch-body →
// 行标签文案一级、.dlg-accept-cancel/-done → getByRole(button 取消/完成)
// ——均 dialog scope（detail/overlays.css 清零，类名钩退役）。
// #952/#910 重钉：壳级 .dlg/.dlg-body/.dlg-form-foot/.dlg-agent-create 随
// dialog-shell 别名摘除与 dialog.css 退役换载体——面板 = getByRole(dialog)、
// 结构盒 = dialog-body/dialog-foot testid（§5.5 二级）、创建钮 = getByRole
// (button 创建)（§5.4）；断言语义一字不动。

test.use({ viewport: { width: 800, height: 500 } });

const CAP = 500 - 48; // 面板 max-height = 100vh - 48px

/** 壳层封顶律:面板不越视口、高度不超 100vh-48。 */
async function expectShellCapped(dialog: Locator) {
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  if (box == null) return;
  expect(box.height).toBeLessThanOrEqual(CAP + 0.5);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(500.5);
}

/** dialog-body 真溢出(内容被收进滚动区而非推出面板)。 */
async function expectBodyOverflows(dialog: Locator) {
  const size = await dialog
    .getByTestId('dialog-body')
    .evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
  expect(size.scroll).toBeGreaterThan(size.client);
}

test('provider: 3 模型行把 body 撑溢,submit 钉底且滚动不位移', async ({ page }) => {
  await page.goto('/app/resources/providers?scenario=01');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // #355 picker 面(无 footer):38 行必然溢出,面板仍封顶
  await expectBodyOverflows(dialog);
  await expectShellCapped(dialog);
  // 表单字段在「自定义端点」入口后的 form 视图
  await dialog.getByRole('button', { name: '自定义端点' }).click();
  const addModel = dialog.getByRole('button', { name: '添加模型', exact: true });
  await addModel.click();
  await addModel.click();
  await addModel.click();
  await expect(dialog.locator('[aria-label="模型 ID"]')).toHaveCount(3);
  await expectBodyOverflows(dialog);
  await expectShellCapped(dialog);
  const submit = dialog.getByRole('button', { name: '添加模型服务' });
  await expect(submit).toBeInViewport();
  // 内容区滚到底,钉底钮位置不动(滚动不推挤按钮区)
  const before = await submit.boundingBox();
  await dialog.getByTestId('dialog-body').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const after = await submit.boundingBox();
  expect(after).toEqual(before);
  await expect(submit).toBeInViewport();
});

test('secret: 静态表单面 submit 在视口', async ({ page }) => {
  await page.goto('/app/resources/secrets?scenario=01');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectShellCapped(dialog);
  // #942 正典表 §5.4：.dlg-secret-create 退役，载体 = getByRole 按钮文案一级
  await expect(dialog.getByRole('button', { name: '添加密钥' })).toBeInViewport();
});

test('machine: disclosure 展开(最高内容态)底部链接在视口', async ({ page }) => {
  await page.goto('/app/resources/machines?scenario=06');
  await page.getByRole('button', { name: '添加机器' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '在云服务器上运行？改用 API key 注册' }).click();
  const keylink = dialog.getByRole('link', { name: '获取 API key →' });
  await expect(keylink).toBeVisible();
  await expectShellCapped(dialog);
  await expect(keylink).toBeInViewport();
});

test('create-agent: submit 在视口', async ({ page }) => {
  await page.goto('/app/team?scenario=12');
  await page.getByRole('button', { name: '创建 Agent' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectShellCapped(dialog);
  await expect(dialog.getByRole('button', { name: '创建', exact: true })).toBeInViewport();
});

test('charter: 取消/保存章程在视口', async ({ page }) => {
  await page.goto('/app?scenario=102');
  // #950: .chief-edit-btn/.chief-dlg-ghost/-primary 随 chief.css 退役 → role 载体。
  await page.getByRole('button', { name: '编辑' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectShellCapped(dialog);
  await expect(dialog.getByRole('button', { name: '取消' })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: '保存章程' })).toBeInViewport();
});

test('chief-agent 列表态(无按钮读面)面板整体不越视口', async ({ page }) => {
  await page.goto('/app?scenario=101');
  // #950: .chief-agent-row → 绑定 Agent 行钮(未绑定时可及名「未设置」);
  // .chief-pick-list → role=listbox。
  await page.getByRole('button', { name: '未设置' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectShellCapped(dialog);
  await expect(dialog.getByRole('listbox')).toBeInViewport();
});

test('branch sync tab: 视口压过内容高,同步钮钉底,body 溢出;git tab 正常', async ({ page }) => {
  // #366:详情路由的分支面改右 pane 静止 section——弹窗形态只剩看板卡片
  // 分支图标这一个入口。sync tab 全高约 410,压到 360 才触发封顶钉底
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto('/app?scenario=01');
  await page.locator('.todo-card-branch').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectBodyOverflows(dialog);
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  if (box == null) return;
  expect(box.height).toBeLessThanOrEqual(360 - 48 + 0.5);
  await expect(dialog.getByRole('button', { name: '同步', exact: true })).toBeInViewport();
  // git tab 无 footer,面板仍在视口内
  // #945/#910 重钉：.dlg-seg-tab → role=tab 一级载体（正典表 §5.4，seg 迁
  // Tabs 件 default 档）。#951：同步钮缺席 = button 同步 count 0；git tab
  // 内容在场 = 分支字段行标签文案一级。
  await dialog.getByRole('tab', { name: 'Git' }).click();
  await expect(dialog.getByRole('button', { name: '同步', exact: true })).toHaveCount(0);
  await expect(dialog.getByText('构建分支')).toBeInViewport();
});

test('accept(34): 取消/完成在视口', async ({ page }) => {
  await page.goto('/app?scenario=34');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectShellCapped(dialog);
  await expect(dialog.getByRole('button', { name: '取消' })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: '完成' })).toBeInViewport();
});

// 11. schedules 新建定时(#1037 c 面):曾是全仓唯一自组裸 DialogContent 的
//     弹层——无封顶、body 不可滚、footer 不钉底,矮视口下面板上下溢出且
//     取消/保存/X 全部够不着。收编回 DialogShell 后按票面在 900×420 实测;
//     内容态取 r3-92b(单次档,日期行在场 = 最高内容态 ≈495px > 372 封顶)。
test('schedules 新建定时(900×420): 封顶、body 内滚、取消/保存/X 恒在视口 (#1037)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 420 });
  await page.goto('/app/schedules?scenario=r3-92b');
  const dialog = page.getByRole('dialog', { name: '新建定时' });
  await expect(dialog).toBeVisible();
  await expectBodyOverflows(dialog);
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  if (box == null) return;
  expect(box.height).toBeLessThanOrEqual(420 - 48 + 0.5);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(420.5);
  const save = dialog.getByRole('button', { name: '保存' });
  await expect(save).toBeInViewport();
  await expect(dialog.getByRole('button', { name: '取消' })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: '关闭' })).toBeInViewport();
  // 内容区滚到底,钉底钮位置不动(滚动不推挤按钮区)
  const before = await save.boundingBox();
  await dialog.getByTestId('dialog-body').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const after = await save.boundingBox();
  expect(after).toEqual(before);
  await expect(save).toBeInViewport();
});
