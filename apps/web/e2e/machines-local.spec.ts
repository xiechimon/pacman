// machines 本地化 fixture 面钉（spec 11 A7/A8/A9，#357）。live 面全链真值 =
// .claude/skills/verify-pacman/scripts/drive-machines-local.mjs（API+SQLite+UI
// 三向对照）；本 spec 钉 fixture canon 展示与交互形：
// 1. 本机行钉列表首（data-kind="local" + data-machine-id + hostname canon）
// 2. 「Pacman 托管机器」facade 行已除（负向）
// 3. per-runtime switches 在位，aria-checked = fixture enabledRuntimes canon
// 4. 点按翻转 aria-checked（fixture 本地态）
// 5. 本机行不可删（行内无删除类控件，负向）
// 6. 行无 chevron 可点感装饰（A7 负向）

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

test('per-runtime switches：aria-checked = enabledRuntimes canon', async ({ page }) => {
  await page.goto(MACHINES);
  const pi = page.locator(`${LOCAL_ROW} [role="switch"][data-runtime="pi"]`);
  const cc = page.locator(`${LOCAL_ROW} [role="switch"][data-runtime="claude-code"]`);
  await expect(pi).toBeVisible();
  await expect(cc).toBeVisible();
  await expect(pi).toHaveAttribute('aria-checked', 'true');
  await expect(cc).toHaveAttribute('aria-checked', 'false');
});

test('点按 switch 翻转 aria-checked（再点复原）', async ({ page }) => {
  await page.goto(MACHINES);
  const cc = page.locator(`${LOCAL_ROW} [role="switch"][data-runtime="claude-code"]`);
  await cc.click();
  await expect(cc).toHaveAttribute('aria-checked', 'true');
  await cc.click();
  await expect(cc).toHaveAttribute('aria-checked', 'false');
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

// A12 钉扎四面之视觉几何断言面：mach-switch 族硬契约（rerun-switch 先例形
// 36×20 轨道 / 16 knob / left 2↔18 双态；fixture canon pi=on cc=off 一次取齐）。
test('switch 几何：36×20 轨道 + 16px knob，on/off 双态 knob 位与底色分离', async ({
  page,
}) => {
  await page.goto(MACHINES);
  const m = await page.evaluate(
    ({ sel }) => {
      const read = (runtime: string) => {
        const sw = document.querySelector(`${sel} [data-runtime="${runtime}"]`);
        if (!sw) throw new Error(`switch missing: ${runtime}`);
        const track = sw.getBoundingClientRect();
        const cs = getComputedStyle(sw);
        const knob = sw.querySelector('.mach-switch-knob');
        if (!knob) throw new Error('knob missing');
        const kr = knob.getBoundingClientRect();
        return {
          trackW: track.width,
          trackH: track.height,
          radius: cs.borderTopLeftRadius,
          bg: cs.backgroundColor,
          knobW: kr.width,
          knobLeft: kr.left - track.left,
          checked: sw.getAttribute('aria-checked'),
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
  expect(m.on.checked).toBe('true');
  expect(m.off.checked).toBe('false');
  for (const s of [m.on, m.off]) {
    expect(s.trackW).toBe(36);
    expect(s.trackH).toBe(20);
    expect(s.radius).toBe('9999px');
    expect(s.knobW).toBe(16);
  }
  expect(m.off.knobLeft).toBe(2); // off：knob 靠左
  expect(m.on.knobLeft).toBe(18); // on：knob 靠右
  expect(m.on.bg).not.toBe(m.off.bg); // 双态底色分离（accent vs dim）
  expect(m.labelFontSize).toBe('12px');
  expect(m.rowHeight).toBe(60); // res-grow 行高契约不破
});
