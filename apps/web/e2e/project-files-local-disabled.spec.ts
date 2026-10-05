import { expect, test } from '@playwright/test';

// spec 12 / #362 G2-T2 v1 面：Files tab 对 local 项目禁用（占位 + 一行
// disable 文案）。fixture 面 scenario=prj-local-files（project.repoKind =
// 'local'，projectTab = 'files'）。失败方式钉扎：
// 1. local 项目 files tab 钮 disabled；内容区 = 占位 disable 文案，
//    FilesPane（载体 = pane 内独有的 历史 seg 钮）不渲染
// 2. 任务 tab 可点切换；点 disabled 的 files 钮不切回（停留在任务面）
// 3. 对照面：非 local 项目（r2-24）files tab 可点、FilesPane 照常渲染
// #946/#910 载体：topbar tab = banner scope 的 role=tab（与 pane 内 seg 钮
// 的 button 角色分离）；占位文案 = 一级 text；任务行 = task-row testid。

const LOCAL = '/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=prj-local-files';
const HOSTED = '/app/project/ZAQczKCu0MOAzC1ZqcFlX?scenario=r2-24';
const DISABLE_LINE = '本地仓库项目暂不支持在线浏览文件';

test('local 项目：files tab 禁用 + 占位文案，FilesPane 不渲染', async ({ page }) => {
  await page.goto(LOCAL);
  const filesTab = page.getByRole('banner').getByRole('tab', { name: '文件' });
  await expect(filesTab).toBeDisabled();
  await expect(page.getByText(DISABLE_LINE)).toBeVisible();
  await expect(page.getByRole('button', { name: '历史' })).toHaveCount(0);
});

test('local 项目：任务 tab 可点切换；disabled files 钮点击不切回', async ({ page }) => {
  await page.goto(LOCAL);
  const banner = page.getByRole('banner');
  await banner.getByRole('tab', { name: '任务' }).click();
  await expect(page.getByTestId('task-row')).toHaveCount(2);
  await expect(page.getByText(DISABLE_LINE)).toHaveCount(0);
  await banner.getByRole('tab', { name: '文件' }).click({ force: true });
  await expect(page.getByTestId('task-row')).toHaveCount(2); // 仍停留任务面
  await expect(page.getByText(DISABLE_LINE)).toHaveCount(0);
});

test('对照面：hosted 项目 files tab 可点、FilesPane 照常', async ({ page }) => {
  await page.goto(HOSTED);
  const filesTab = page.getByRole('banner').getByRole('tab', { name: '文件' });
  await expect(filesTab).toBeEnabled();
  await expect(page.getByRole('button', { name: '历史' })).toBeVisible();
  await expect(page.getByText(DISABLE_LINE)).toHaveCount(0);
});
