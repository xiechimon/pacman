import { expect, test } from '@playwright/test';

// Issue #469: the chat column renders two things the flat `.chat-para` /
// `.chat-note` path could not — (A) a tool call's stdout as its own
// left-aligned mono block tied to the tool group, and (B) an agent reply's
// block markdown (heading / ordered+unordered nested lists / code fence)
// with inline `.chat-code` chips preserved. Each test pins one failure way
// of the rework:
//   A1 tool output stays collapsed behind the group toggle (not flattened
//      into a centered dim `.chat-note`)
//   A2 expanded output is a standalone block per tool call, verbatim stdout
//   A3 output block is left aligned, mono, normal contrast (not `.chat-note`)
//   B1 heading renders as a heading element, not literal `##`
//   B2 ordered list renders ordinals; unordered renders bullets
//   B3 nested list items indent past their parent
//   B4 code fence renders as a mono block, no literal ``` leak
//   B5 inline code keeps the `.chat-code` chip
//   B6 no raw markdown syntax survives as literal prose

const ROUTE = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=md-toolout';

/** Computed color of a `color: var(--text-primary)` probe — the "normal
 *  contrast" reference the tool output must match (and `.chat-note`'s dim
 *  ink must not). */
async function primaryInk(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--text-primary)';
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
}

test('A1: tool output is collapsed behind the group toggle by default', async ({ page }) => {
  await page.goto(ROUTE);
  // the group renders collapsed — no output block on screen yet
  await expect(page.locator('.chat-tool-output')).toHaveCount(0);
  // the stdout must NOT have leaked into a centered dim note either
  await expect(page.locator('.chat-note', { hasText: 'total 16' })).toHaveCount(0);
  await expect(page.locator('.chat-note', { hasText: 'hello from pacman' })).toHaveCount(0);
  // the collapsible tool group toggle (完成 Ns ▸ row) is present
  await expect(page.locator('.chat-row-icons--toggle')).toBeVisible();
});

test('A2: expanding the group reveals one standalone block per tool output', async ({ page }) => {
  await page.goto(ROUTE);
  await page.locator('.chat-row-icons--toggle').click();
  const outputs = page.locator('.chat-tool-output');
  await expect(outputs).toHaveCount(2);
  // verbatim stdout, whitespace preserved
  await expect(outputs.nth(0)).toContainText('total 16');
  await expect(outputs.nth(0)).toContainText('drwxr-xr-x@ 4 xmon  staff');
  await expect(outputs.nth(1)).toContainText('hello from pacman');
});

test('A3: the output block is left aligned, mono, normal contrast — not a chat-note', async ({
  page,
}) => {
  await page.goto(ROUTE);
  await page.locator('.chat-row-icons--toggle').click();
  const ink = await primaryInk(page);
  const box = await page.locator('.chat-tool-output').first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      textAlign: cs.textAlign,
      fontFamily: cs.fontFamily,
      color: cs.color,
      inNote: el.closest('.chat-note') !== null,
    };
  });
  expect(box.textAlign === 'left' || box.textAlign === 'start').toBe(true);
  expect(box.fontFamily.toLowerCase()).toContain('mono');
  expect(box.color).toBe(ink);
  expect(box.inNote).toBe(false);
});

test('B1: a markdown heading renders as a heading element, not literal ##', async ({ page }) => {
  await page.goto(ROUTE);
  const head = page.locator('.chat-md-head').first();
  await expect(head).toBeVisible();
  await expect(head).toContainText('检查结果');
  // `##` maps to an <h2>
  expect(await head.evaluate((el) => el.tagName)).toBe('H2');
  // the raw marker never survives as text
  await expect(page.locator('.chat-text', { hasText: '## 检查结果' })).toHaveCount(0);
});

test('B2: ordered list renders ordinals and unordered list renders bullets', async ({ page }) => {
  await page.goto(ROUTE);
  const ordered = page.locator('.chat-md-item--ordered');
  await expect(ordered).toHaveCount(2);
  await expect(ordered.first()).toContainText('第一步：确认目录');
  await expect(ordered.nth(1)).toContainText('第二步：打印问候');
  // the ordinal marker is rendered, not the literal `1.` from source
  await expect(ordered.first().locator('.chat-md-ordinal')).toContainText('1.');

  const bullets = page.locator('.chat-md-item--bullet');
  // 子项 A / 子项 B (nested under step 1) + 顶层要点 + 嵌套要点
  await expect(bullets).toHaveCount(4);
  await expect(page.locator('.chat-md-item--bullet', { hasText: '顶层要点' })).toHaveCount(1);
});

test('B3: nested list items indent past their parent', async ({ page }) => {
  await page.goto(ROUTE);
  const parentLeft = await page
    .locator('.chat-md-item--ordered', { hasText: '第一步' })
    .first()
    .evaluate((el) => el.getBoundingClientRect().left);
  const nestedLeft = await page
    .locator('.chat-md-item--bullet', { hasText: '子项 A' })
    .first()
    .evaluate((el) => el.getBoundingClientRect().left);
  expect(nestedLeft).toBeGreaterThan(parentLeft);
});

test('B4: a code fence renders as a mono block with no literal ``` leak', async ({ page }) => {
  await page.goto(ROUTE);
  const code = page.locator('.chat-md-code').first();
  await expect(code).toBeVisible();
  await expect(code).toContainText('total 16');
  await expect(code).toContainText('drwxr-xr-x  4 xmon  staff  128');
  const family = await code.evaluate((el) => getComputedStyle(el).fontFamily.toLowerCase());
  expect(family).toContain('mono');
  // the fence markers are syntax, never content
  await expect(page.locator('.chat-text', { hasText: '```' })).toHaveCount(0);
});

test('B5: inline code keeps the existing .chat-code chip', async ({ page }) => {
  await page.goto(ROUTE);
  const chip = page.locator('.chat-text .chat-code', { hasText: 'ls -la' });
  await expect(chip).toHaveCount(1);
  const family = await chip.first().evaluate((el) => getComputedStyle(el).fontFamily.toLowerCase());
  expect(family).toContain('mono');
});

test('B6: no raw markdown syntax survives as literal prose', async ({ page }) => {
  await page.goto(ROUTE);
  const text = page.locator('.chat-text').first();
  await expect(text).not.toContainText('## 检查结果');
  await expect(text).not.toContainText('1. 第一步');
  await expect(text).not.toContainText('- 顶层要点');
});
