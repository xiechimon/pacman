import { expect, test } from '@playwright/test';

// Issue #470: 对话正文字号提阶 + 行宽上限. Agent replies are reading text —
// the capture-faithful 13px ink steps up to 15px on a unitless 1.6 (the
// product is the same 24px line pitch the r8 rows carried, so row geometry
// does not drift), and a 68ch measure cap keeps wide-screen paragraphs and
// centered notes inside the 60–75 character comfort band. The composer
// placeholder steps 13 → 14px: one notch under the body, hierarchy intact.
// Each test pins one failure way of the rework:
//   1. body ink/pitch falls back to the old 13px fixed-pitch recipe
//   2. line-height declared in px again (stops scaling with the size)
//   3. the 68ch cap is missing or resolves to a different measure
//   4. the note loses its centered look inside the cap
//   5. placeholder ties with the body and the hierarchy collapses
//   6. bubble / avatar / footer geometry gets dragged along
//   7. a rule creeps back between a user turn and the agent row

const DONE = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=36';
const CONFIRM = '/app/todo/7ve0iOkQ-JBpSL98zSiGc?scenario=17b';

test('chat body reads at 15px on a unitless 1.6 — the 24px pitch survives', async ({ page }) => {
  await page.goto(DONE);
  const text = page.locator('.chat-text').first();
  await expect(text).toBeVisible();
  const cs = await text.evaluate((el) => {
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, lineHeight: s.lineHeight };
  });
  expect(cs.fontSize).toBe('15px');
  // 15 × 1.6 lands on the same 24px line box the fixed pitch carried
  expect(cs.lineHeight).toBe('24px');
  // the declaration itself must stay unitless so the pitch tracks the size
  const declared = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule && rule.selectorText === '.chat-text') {
          return rule.style.lineHeight;
        }
      }
    }
    return null;
  });
  expect(declared).toBe('1.6');
});

test('68ch measure cap binds the body text and the centered note', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto(DONE);
  const caps = await page.evaluate(() => {
    // ch resolves against the element's own font — measure the "0" glyph in
    // the same computed font and compare the used max-width against 68 of them
    const zeroWidth = (el: Element) => {
      const cs = getComputedStyle(el);
      const probe = document.createElement('span');
      probe.style.fontFamily = cs.fontFamily;
      probe.style.fontSize = cs.fontSize;
      probe.style.fontWeight = cs.fontWeight;
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.textContent = '0';
      document.body.append(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    };
    const ratio = (sel: string) => {
      const el = document.querySelector(sel)!;
      const used = Number.parseFloat(getComputedStyle(el).maxWidth);
      return used / zeroWidth(el);
    };
    return { text: ratio('.chat-text'), note: ratio('.chat-note') };
  });
  for (const r of [caps.text, caps.note]) {
    expect(r).toBeGreaterThan(67.5);
    expect(r).toBeLessThanOrEqual(68.5);
  }
  // the note keeps its centered look inside the cap: equal auto margins
  const note = await page.locator('.chat-note').first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { left: s.marginLeft, right: s.marginRight, align: s.textAlign };
  });
  expect(note.align).toBe('center');
  expect(Number.parseFloat(note.left)).toBeGreaterThan(0);
  expect(note.left).toBe(note.right);
  // the capped measure must not push the column into horizontal overflow
  const overflow = await page.evaluate(() => {
    const col = document.querySelector('.chat-col')!;
    return { scroll: col.scrollWidth, client: col.clientWidth };
  });
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
});

test('composer placeholder steps to 14px — one notch under the 15px body', async ({ page }) => {
  await page.goto(CONFIRM);
  const sizes = await page.evaluate(() => {
    const ph = document.querySelector('.composer-placeholder')!;
    const text = document.querySelector('.chat-text')!;
    return {
      placeholder: getComputedStyle(ph).fontSize,
      body: getComputedStyle(text).fontSize,
    };
  });
  expect(sizes.placeholder).toBe('14px');
  expect(sizes.body).toBe('15px');
});

test('bubble / avatar / footer keep their own geometry (#470 scope fence)', async ({ page }) => {
  await page.goto(DONE);
  const geo = await page.evaluate(() => {
    const bubble = document.querySelector('.chat-bubble')!;
    const avatar = document.querySelector('.chat-avatar img')!;
    const footer = document.querySelector('.chat-row-icons')!;
    const b = bubble.getBoundingClientRect();
    const a = avatar.getBoundingClientRect();
    return {
      bubbleH: Math.round(b.height),
      bubbleFont: getComputedStyle(bubble).fontSize,
      avatarBox: { w: Math.round(a.width), h: Math.round(a.height) },
      footerPad: getComputedStyle(footer).paddingLeft,
    };
  });
  expect(geo.bubbleH).toBe(24);
  expect(geo.bubbleFont).toBe('15px');
  expect(geo.avatarBox).toEqual({ w: 20, h: 20 });
  expect(geo.footerPad).toBe('31px');
});

test('turn boundary is air, not a rule: no divider between a user turn and the agent row', async ({
  page,
}) => {
  // XMON-55 P5 follow-up. P3 marked every 用户→agent boundary with a full-bleed
  // 1px rule; across a transcript that reads as a document <hr> rather than a
  // change of speaker, and the user asked for it gone. The boundary is carried
  // by the avatar swap, the centered stamp and air. This pins the three ways
  // the air-only boundary can regress: a rule creeps back, the gap collapses,
  // or the gap balloons until the transcript reads as scattered fragments.
  await page.goto(DONE);
  const probe = await page.evaluate(() => {
    // every element in the transcript that paints a horizontal line
    const ruled = [...document.querySelectorAll('.chat-col *')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        const top = Number.parseFloat(cs.borderTopWidth) || 0;
        const bot = Number.parseFloat(cs.borderBottomWidth) || 0;
        return (top > 0 || bot > 0) && el.getBoundingClientRect().height > 0;
      })
      .map((el) => el.className);
    // every 用户→agent boundary: an agent row whose left sibling is the user
    // turn's action row
    const turns = [...document.querySelectorAll('.chat-row--agent')]
      .filter((row) => row.previousElementSibling?.classList.contains('chat-row-icons'))
      .map((row) => {
        const cs = getComputedStyle(row);
        const rect = row.getBoundingClientRect();
        const prev = row.previousElementSibling!.getBoundingClientRect();
        return {
          borderTop: cs.borderTopWidth,
          paddingTop: cs.paddingTop,
          gap: rect.top - prev.bottom,
        };
      });
    return { ruled, turns };
  });
  // nothing in the transcript draws a line
  expect(probe.ruled).toEqual([]);
  // scenario 36 carries two such boundaries — the assertion is not vacuous
  expect(probe.turns).toHaveLength(2);
  for (const turn of probe.turns) {
    expect(turn.borderTop).toBe('0px');
    expect(turn.paddingTop).toBe('0px');
    // more than the 14px consecutive-agent packing, well under the 48px the
    // rule's own padding used to add
    expect(turn.gap).toBeGreaterThanOrEqual(16);
    expect(turn.gap).toBeLessThanOrEqual(32);
  }
});
