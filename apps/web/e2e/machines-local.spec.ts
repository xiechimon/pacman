// machines 本地化 fixture 面钉（spec 11 A7/A8/A9，#357；#503 开关 → 品牌 mark）。
// live 面全链真值 = .claude/skills/verify-pacman/scripts/drive-machines-local.mjs
// （API+SQLite+UI 三向对照）；本 spec 钉 fixture canon 展示形：
// 1. 本机行钉列表首（data-kind="local" + data-machine-id + hostname canon）
// 2. 「Pacman 托管机器」facade 行已除（负向）
// 3. per-runtime 品牌 mark 在位（data-runtime），亮度分态 = fixture enabledRuntimes canon
// 4. 行内零交互控件（#503 摘除开关：无 role=switch / button，负向）
// 5. 副行已除（#503：id 尾巴 / 并发上限行不存在，负向）
// 6. 本机行不可删（行内无删除类控件，负向）
// 7. 行无 chevron 可点感装饰（A7 负向）

import { expect, test } from '@playwright/test';

const MACHINES = '/app/resources/machines?scenario=06';
const SHELL = '[data-route="/app/resources/machines"]';
const ROW = `${SHELL} .res-grow[data-machine-id]`;
const LOCAL_ROW = `${ROW}[data-kind="local"]`;
// fixture canon（fixtures.ts RESOURCES.machines）：本机行 = MACHINE_NAME /
// MACHINE_ID，enabledRuntimes ['pi']（pi 开 / Claude Code 关两态展示）。
const LOCAL_NAME = 'xmonsMac-3574.local';
const LOCAL_ID = 'TlZ2sSD4EJCxjNJqVhdo_';

test('本机行钉列表首：data-kind=local + id 句柄 + hostname canon', async ({ page }) => {
  await page.goto(MACHINES);
  const first = page.locator(ROW).first();
  await expect(first).toBeVisible();
  await expect(first).toHaveAttribute('data-kind', 'local');
  await expect(first).toHaveAttribute('data-machine-id', LOCAL_ID);
  await expect(first.locator('.res-row-title')).toHaveText(LOCAL_NAME);
});

test('托管 facade 行已除（spec 11 A8 负向）', async ({ page }) => {
  await page.goto(MACHINES);
  await expect(page.locator(LOCAL_ROW)).toBeVisible();
  await expect(page.locator(`${SHELL} .res-main`)).not.toContainText('Pacman 托管机器');
});

test('per-runtime 品牌 mark：两个在位 + 亮度分态 = enabledRuntimes canon', async ({ page }) => {
  await page.goto(MACHINES);
  const pi = page.locator(`${LOCAL_ROW} .mach-runtime[data-runtime="pi"]`);
  const cc = page.locator(`${LOCAL_ROW} .mach-runtime[data-runtime="claude-code"]`);
  await expect(pi).toBeVisible();
  await expect(cc).toBeVisible();
  await expect(pi.locator('.mach-mark')).toBeVisible();
  await expect(cc.locator('.mach-mark')).toBeVisible();
  await expect(pi.locator('.mach-runtime-label')).toHaveText('pi');
  await expect(cc.locator('.mach-runtime-label')).toHaveText('Claude Code');
  // 亮度分态 canon：pi 开（实色）/ Claude Code 关（35% 透明）。
  await expect(pi).toHaveClass(/mach-runtime--on/);
  await expect(cc).not.toHaveClass(/mach-runtime--on/);
});

test('行内零交互控件（#503 摘除开关，负向）', async ({ page }) => {
  await page.goto(MACHINES);
  await expect(page.locator(`${LOCAL_ROW} [role="switch"]`)).toHaveCount(0);
  await expect(page.locator(`${LOCAL_ROW} button`)).toHaveCount(0);
});

test('副行已除（#503：id 尾巴 / 并发上限行不存在，负向）', async ({ page }) => {
  await page.goto(MACHINES);
  await expect(page.locator(`${LOCAL_ROW} .res-row-desc`)).toHaveCount(0);
  await expect(page.locator(LOCAL_ROW)).not.toContainText('· max');
});

test('本机行不可删：行内无删除类控件（负向）', async ({ page }) => {
  await page.goto(MACHINES);
  await expect(page.locator(`${LOCAL_ROW} button[aria-label*="删除"]`)).toHaveCount(0);
  await expect(page.locator(`${LOCAL_ROW} .res-row-more`)).toHaveCount(0);
});

test('行无 chevron 可点感装饰（spec 11 A7 负向）', async ({ page }) => {
  await page.goto(MACHINES);
  await expect(page.locator(LOCAL_ROW)).toBeVisible();
  await expect(page.locator(`${SHELL} .res-row-chev`)).toHaveCount(0);
});

// 钉扎四面之视觉几何断言面：mach-runtime 族硬契约（16×16 官方 mark；on/off
// 透明度分离 1 / 0.35；label 12px；fixture canon pi=on cc=off 一次取齐）。
test('mark 几何：16×16 mark，on/off 透明度分离，行高契约不破', async ({ page }) => {
  await page.goto(MACHINES);
  const m = await page.evaluate(
    ({ sel }) => {
      const read = (runtime: string) => {
        const wrap = document.querySelector(`${sel} .mach-runtime[data-runtime="${runtime}"]`);
        if (!wrap) throw new Error(`runtime missing: ${runtime}`);
        const mark = wrap.querySelector('.mach-mark');
        if (!mark) throw new Error('mark missing');
        const r = mark.getBoundingClientRect();
        return {
          markW: r.width,
          markH: r.height,
          opacity: getComputedStyle(mark).opacity,
        };
      };
      const label = document.querySelector(`${sel} .mach-runtime-label`);
      const row = document.querySelector(sel)?.getBoundingClientRect();
      return {
        on: read('pi'),
        off: read('claude-code'),
        labelFontSize: label ? getComputedStyle(label).fontSize : null,
        rowHeight: row?.height ?? null,
      };
    },
    { sel: LOCAL_ROW },
  );
  for (const s of [m.on, m.off]) {
    expect(s.markW).toBe(16);
    expect(s.markH).toBe(16);
  }
  expect(m.on.opacity).toBe('1'); // on：品牌原色
  expect(m.off.opacity).toBe('0.35'); // off：35% 透明
  expect(m.labelFontSize).toBe('12px');
  expect(m.rowHeight).toBe(60); // res-grow 行高契约不破
});