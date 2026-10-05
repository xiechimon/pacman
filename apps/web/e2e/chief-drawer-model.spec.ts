import { expect, type Page, test } from '@playwright/test';
import { evidencePanelShot } from './evidence';

// Issue #615 (总管抽屉四连报 A/B/C 的 fixture 面回归): the drawer's model
// row used to be a display-only `<span>` carrying a broken π trace — the
// live loop (verify probe drive-chief-drawer) covers 显示→可改→落库→回显;
// this spec pins the fixture-face half of the same contract:
//   1. the model row is a control (button.chief-model-btn) that opens
//      the model popover anchored under the row (#751: the #615 centered
//      DialogShell read as 「在中间出现」 against the switcher's under-trigger
//      anchoring); geometry is asserted from live rects, and the selected
//      row's readability from computed contrast in both themes (#751 A);
//      picking a row closes the face (accept 律, #148 同律) and the fixture
//      face sends no PATCH (onPick absent).
//   2. the row carries the runtime mark (RuntimePi 块状 π / RuntimeClaudeCode
//      品牌星标 — 正本 = 参考站 providers 运行时 tab SVG; 用户返工裁决：运行时
//      SVG，不是 Agent 头像; the broken 「ㅋ」 trace is gone); unbound keeps the
//      plain `n/a` line with no control at all.
//   3. the message-row copy glyphs are real clipboard buttons (local-first
//      face exists); 恢复 / foot chevron had no backend and no local-first
//      object face, so per the #306/#146 二分律 they are gone, not inert.
//   4. the gear is reachable off-board: wake shells render it and it lands
//      on the board settings view via the ?chief=settings deep link.

const drawer = (page: Page) => page.locator('.chief-drawer');
const modelBtn = (page: Page) => page.locator('.chief-model button.chief-model-btn');

test.describe('chief drawer model row (#615)', () => {
  test('the model row is a control that opens the anchored model popover', async ({ page }) => {
    await page.goto('/app?scenario=111');
    await expect(drawer(page)).toBeVisible();
    const btn = modelBtn(page);
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('claude-sonnet-5 · 默认');

    await btn.click();
    const menu = page.locator('.chief-model-pop');
    await expect(menu).toBeVisible();
    // the enter animation (V2 scale-fade 100ms, #790 P3) transforms the menu
    // for 100ms; rects sampled mid-flight are not the resting geometry.
    await menu.evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined),
    );
    // the inherit row rides first (compaction select 同律: null = 默认)
    await expect(menu.locator('.chief-model-pick-row').nth(0)).toContainText(
      '默认（与绑定 Agent 相同）',
    );

    // #751 B: the menu hangs under its trigger like the thread switcher,
    // not centered over the viewport — live rects, not CSS values.
    const btnBox = await btn.boundingBox();
    const menuBox = await menu.boundingBox();
    const drawerBox = await drawer(page).boundingBox();
    expect(btnBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(drawerBox).not.toBeNull();
    if (btnBox == null || menuBox == null || drawerBox == null) throw new Error('missing rects');
    // V2 顶部锚距（#790 P3）: menu.top = trigger.bottom + 8（原家族基线 4）。
    expect(Math.abs(menuBox.y - (btnBox.y + btnBox.height + 8))).toBeLessThanOrEqual(2);
    expect(Math.abs(menuBox.x - btnBox.x)).toBeLessThanOrEqual(2);
    expect(menuBox.x).toBeGreaterThanOrEqual(drawerBox.x);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(drawerBox.x + drawerBox.width);

    // fixture accept 律: picking closes; no live callback, no request
    await menu.locator('.chief-model-pick-row').nth(0).click();
    await expect(menu).toHaveCount(0);
    await expect(drawer(page)).toBeVisible();
  });

  test('the selected model row is readable in both themes (#751 A)', async ({ page }) => {
    // #751 A: the retired rule painted --seg-active (a segmented-control
    // fill) as the selected row's text — 1.24:1 light. Assert the rendered
    // pair instead of the CSS value: computed name color against the
    // background it actually renders on must clear AA, and the selected
    // state must not ride color alone (the row carries a fill).
    for (const theme of ['dark', 'light'] as const) {
      await page.goto('/app?scenario=111');
      await page.evaluate((t) => localStorage.setItem('pacman-theme', t), theme);
      await page.reload();
      await expect(drawer(page)).toBeVisible();
      await modelBtn(page).click();
      const row = page.locator('.chief-model-pick-row[aria-selected="true"]');
      const name = row.locator('.chief-model-pick-name');
      await expect(name).toBeVisible();
      const ratio = await name.evaluate((el) => {
        const lin = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        const lum = (rgb: number[]) =>
          0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
        const parse = (s: string) => {
          // color-mix() tokens serialize computed as color(srgb …) fractions,
          // not rgb() 0–255 ints (#788: the selected-row fill rides --spot-soft)
          const m = s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
          if (m) return [m[1], m[2], m[3]].map((v) => Number(v) * 255);
          return (s.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
        };
        let bg = 'rgba(0, 0, 0, 0)';
        let node: Element | null = el;
        while (node != null && bg === 'rgba(0, 0, 0, 0)') {
          bg = getComputedStyle(node).backgroundColor;
          node = node.parentElement;
        }
        const [hi, lo] = [lum(parse(getComputedStyle(el).color)), lum(parse(bg))].sort(
          (a, b) => b - a,
        );
        return (hi + 0.05) / (lo + 0.05);
      });
      expect(ratio, `${theme} selected-row contrast`).toBeGreaterThanOrEqual(4.5);
      expect(await row.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
        'rgba(0, 0, 0, 0)',
      );
      await page.keyboard.press('Escape');
      await expect(page.locator('.chief-model-pop')).toHaveCount(0);
    }
  });

  // #872: 选中行底色整行铺满（用户报「中间还有间隙，要全覆盖的」）。修法 = 把
  // 弹层壳的横向内边距移到行上（壳 padding: 12px 0，行自带内衬），选中/hover
  // 底色因此伸到弹层内缘。钉住的失败方式：① 底色仍内缩（壳还留着横垫）；② 行
  // 盒被撑出行外（负外边距式修法的退化：清单作为滚动容器会长出横向溢出）；
  // ③ 字墨与行尾勾的位置跟着挪（行内衬没补回壳垫的量）。
  test('the selected row fill bleeds to the popover edges (#872)', async ({ page }) => {
    // 用户报的是亮面（截图即亮面）——证据帧与它同面；几何本身与主题无关。
    await page.addInitScript(() => localStorage.setItem('pacman-theme', 'light'));
    await page.goto('/app?scenario=111');
    await expect(drawer(page)).toBeVisible();
    await modelBtn(page).click();
    const menu = page.locator('.chief-model-pop');
    await expect(menu).toBeVisible();
    await menu.evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined),
    );
    const row = menu.locator('.chief-model-pick-row[aria-selected="true"]');
    await expect(row).toHaveCount(1);
    // 证据帧（PACMAN_E2E_EVIDENCE 未设时零写入）：整块弹层连底色到边一起拍
    await evidencePanelShot(page, '872-drawer-picker.png', menu);

    const geo = await row.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const panelEl = el.closest('.chief-model-pop') as HTMLElement;
      const p = panelEl.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const pcs = getComputedStyle(panelEl);
      const name = el.querySelector('.model-pick-name') as HTMLElement;
      const check = el.querySelector('.model-pick-check') as HTMLElement;
      return {
        fillLeft: r.left - p.left,
        fillRight: p.right - r.right,
        panelBorder: parseFloat(pcs.borderLeftWidth),
        bg: cs.backgroundColor,
        padLeft: parseFloat(cs.paddingLeft),
        padRight: parseFloat(cs.paddingRight),
        nameInset: name.getBoundingClientRect().left - r.left,
        checkInset: r.right - check.getBoundingClientRect().right,
      };
    });
    expect(geo.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(geo.fillLeft).toBeCloseTo(geo.panelBorder, 1);
    expect(geo.fillRight).toBeCloseTo(geo.panelBorder, 1);
    // 字墨与勾仍骑在行的内衬上（壳垫移进行内后零位移）
    expect(geo.nameInset).toBeCloseTo(geo.padLeft, 1);
    expect(geo.checkInset).toBeCloseTo(geo.padRight, 1);

    // 清单是滚动容器：铺满不许把内容撑成横向溢出
    const scroll = await menu
      .locator('.chief-model-pick-list')
      .evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(scroll.sw).toBe(scroll.cw);
  });

  test('the picker search is typeahead-only: absent until a key, retracted on clear (#756)', async ({
    page,
  }) => {
    await page.goto('/app?scenario=111');
    await expect(drawer(page)).toBeVisible();
    const chipTitle = await page.locator('.chief-chip-title').textContent();
    await modelBtn(page).click();
    const menu = page.locator('.chief-model-pop');
    await expect(menu).toBeVisible();
    // open state carries zero search footprint (not rendered, not transparent)
    await expect(menu.locator('.chief-pick-search')).toHaveCount(0);
    // scenario 111 is fixture mode: modelOptions is undefined (live-only
    // union), so the face shows the default row alone by design
    const rowsOpen = await menu.locator('.chief-model-pick-row').count();
    expect(rowsOpen).toBe(1);

    // typeahead 接的是面内焦点：FloatingShell 把焦点移进面是异步的，
    // 没落定就打字会打在触发钮上（抽屉面还会触发 N 新主题热键）——等落定再敲
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el != null && el.contains(document.activeElement);
      },
      '.chief-model-pop',
    );

    // a printable key is consumed by the face: the box reveals with the key
    // prefilled, focus in the input — and the drawer's N hotkey must not
    // steal it (no new-thread view, chip title unchanged). With no fixture
    // options the key matches nothing, so the default row plus empty state
    // show (the filtered-list path is pinned on the settings face instead)
    await page.keyboard.press('n');
    const search = menu.locator('.chief-pick-search input');
    await expect(search).toBeVisible();
    await expect(search).toHaveValue('n');
    await expect(search).toBeFocused();
    await expect(menu).toBeVisible();
    expect(await page.locator('.chief-chip-title').textContent()).toBe(chipTitle);
    await expect(menu.locator('.chief-model-pick-row')).toHaveCount(1);
    await expect(menu.locator('.chief-pick-empty')).toBeVisible();

    // a key matching nothing filters to the default row plus the empty state
    await search.fill('x');
    await expect(menu.locator('.chief-model-pick-row')).toHaveCount(1);
    await expect(menu.locator('.chief-pick-empty')).toBeVisible();

    // retract rule: clearing collapses the box and restores the full list,
    // and typeahead re-arms afterwards
    await search.fill('');
    await expect(menu.locator('.chief-pick-search')).toHaveCount(0);
    await expect(menu.locator('.chief-model-pick-row')).toHaveCount(rowsOpen);
    await page.keyboard.press('c');
    await expect(search).toBeVisible();
    await expect(search).toHaveValue('c');
    await expect(menu.locator('.chief-model-pick-row')).toHaveCount(1);
    await expect(menu.locator('.chief-pick-empty')).toBeVisible();
  });

  test('the model row carries the runtime mark, not an agent avatar', async ({ page }) => {
    await page.goto('/app?scenario=fab-avatar');
    await expect(drawer(page)).toBeVisible();
    const btn = modelBtn(page);
    await expect(btn).toBeVisible();
    // #615 返工裁决：行首 = 运行时标记（fixture 未录 provider 位 = pi 正典
    // π 字形），不是 Agent 头像——头像脸归 FAB / 消息流各自的面
    await expect(btn.locator('.chief-model-mark svg')).toHaveCount(1);
    await expect(btn.locator('.chief-model-mark img')).toHaveCount(0);

    // unbound: plain n/a line, no control (nothing to pick until an agent binds)
    await page.goto('/app?scenario=100');
    await expect(drawer(page)).toBeVisible();
    await expect(modelBtn(page)).toHaveCount(0);
    await expect(page.locator('.chief-model')).toContainText('n/a');
  });

  test('message copy glyphs are clipboard buttons; no bare inert glyphs remain', async ({
    page,
  }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/app?scenario=114');
    await expect(drawer(page)).toBeVisible();

    const copy = page.locator('.chief-msg-tools button[aria-label="复制"]');
    await expect(copy).toBeVisible();
    await copy.click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('CONTRIBUTING.md');

    // the foot copy wires the assistant text the same way
    const footCopy = page.locator('.chief-msg-foot button[aria-label="复制"]');
    await expect(footCopy).toBeVisible();
    await footCopy.click();
    const footClip = await page.evaluate(() => navigator.clipboard.readText());
    expect(footClip).toContain('已创建并派工');

    // 用户行两钮（复制 + 恢复到此处）皆为真按钮；裸 glyph 子节点零残留
    // （#615 返工：恢复钮按用户裁决闭环复活，不再按二分律删除）
    await expect(page.locator('.chief-msg-tools button')).toHaveCount(2);
    await expect(page.locator('.chief-msg-tools > svg')).toHaveCount(0);
    await expect(page.locator('.chief-msg-foot > svg')).toHaveCount(0);
  });

  test('restore button opens the rewind confirm; the foot chevron discloses tool rows', async ({
    page,
  }) => {
    await page.goto('/app?scenario=114');
    await expect(drawer(page)).toBeVisible();

    // 恢复钮（参考站 live aria 正词「恢复到此处」）→ 破坏性确认层先行
    const restore = page.locator('.chief-msg-tools button[aria-label="恢复到此处"]');
    await expect(restore).toBeVisible();
    await restore.first().click();
    const confirm = page.locator('.chief-pick-confirm');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('恢复到此处？');
    // fixture accept 律：确认只关窗（零请求），流不变
    await page.locator('.chief-dlg-primary').click();
    await expect(confirm).toHaveCount(0);
    await expect(page.locator('.chief-msg')).toHaveCount(2);

    // foot 折叠箭头 = 过程披露：展开出该回合工具行（Multica OuterProcessFold 同族）
    const fold = page.locator('.chief-msg-foot button[aria-label="展开过程"]');
    await expect(fold).toBeVisible();
    await expect(page.locator('.chief-turn-tools')).toHaveCount(0);
    await fold.click();
    const tools = page.locator('.chief-turn-tools');
    await expect(tools).toBeVisible();
    await expect(tools.locator('.chief-turn-tool-row')).toHaveCount(2);
    await expect(tools).toContainText('create_todo');
    // 收起回折叠态
    await page.locator('.chief-msg-foot button[aria-label="收起过程"]').click();
    await expect(tools).toHaveCount(0);
  });

  test('the gear reaches board settings from a wake surface', async ({ page }) => {
    await page.goto('/app/team?scenario=12');
    await page.locator('button[aria-label="总管"]').click();
    await expect(drawer(page)).toBeVisible();
    const gear = drawer(page).locator('button[aria-label="总管设置"]');
    await expect(gear).toBeVisible();

    await gear.click();
    // the deep-link param is consumed (stripped) once the view lands — the
    // stable contract is the settings view itself, not the URL mid-consumption
    await expect(page.locator('.chief-settings')).toBeVisible();
  });

  test('closing the drawer (⌘J) recycles the model popover with it (#773)', async ({
    page,
  }) => {
    await page.goto('/app?scenario=111');
    await expect(drawer(page)).toBeVisible();
    await modelBtn(page).click();
    const menu = page.locator('.chief-model-pop');
    await expect(menu).toBeVisible();

    // ⌘J 收起抽屉：弹层跟随回收（X/⌘J 同走 open=false，见 chief-drawer）
    await page.keyboard.press('Meta+j');
    await expect(drawer(page)).toHaveCount(0);
    await expect(menu).toHaveCount(0);

    // 再按 ⌘J 重开：弹层不带回 stale open 态
    await page.keyboard.press('Meta+j');
    await expect(drawer(page)).toBeVisible();
    await expect(menu).toHaveCount(0);
  });
});
