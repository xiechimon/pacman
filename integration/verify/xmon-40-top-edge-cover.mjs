// XMON-40 复查：菜单「上边缘」在往下滑的时候，有没有真被上面的标题方框盖住。
//
// 用户反馈（2026-10-01）：「你往下滑的时候，上边缘被上面的标题方框遮挡住了，
// 感觉不是很美观。」
//
// 遮挡是可判定的事实，不是口味：菜单上边缘那一线做命中测试，命中的元素若不在
// 菜单里，就是被盖住了。顺带量出「标题方框下沿 ↔ 菜单上沿」的距离。
//
//   node integration/verify/xmon-40-top-edge-cover.mjs

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const ports = JSON.parse(readFileSync(join(ROOT, '.claude/verify-run/ports.json'), 'utf8'));
const WEB = `http://127.0.0.1:${process.env.VERIFY_WEB_PORT ?? ports.webPort}`;
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const EVIDENCE = process.env.VERIFY_EVIDENCE_DIR ?? join(ROOT, '.claude/verify-evidence', `${STAMP}-xmon40-top-edge`);
mkdirSync(EVIDENCE, { recursive: true });

const MODEL_COUNT = Number(process.env.XMON40_MODEL_COUNT ?? 40);
const PREFIX_MAXHEIGHT = Number(process.env.XMON40_PREFIX_MAXHEIGHT ?? 300);
const TRIGGER = '.dlg-agent-model-select';
const MENU = '.dlg-agent-model-menu';
const OPTION = `${MENU} [role="option"]`;

const checks = [];
const record = (ok, label, detail) => {
  checks.push({ ok, label, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

async function seed(page) {
  await page.goto(`${WEB}/app/team`);
  const tid = await page.evaluate(async () => (await (await fetch('/api/teams')).json())[0].id);
  const existing = await page.evaluate(async (t) => (await (await fetch(`/api/teams/${t}/providers`)).json()).providers, tid);
  if (existing.some((p) => p.providerId === 'xmon40-gw' && p.models.length === MODEL_COUNT)) {
    record(true, 'seed: 40 模型服务商已在库中（复用）', `providers=${existing.length}`);
    return;
  }
  await page.goto(`${WEB}/app/resources/providers`);
  await page.waitForSelector('.res-new', { timeout: 15_000 });
  await page.click('.res-new');
  await page.waitForSelector('.dlg-picker-custom', { timeout: 15_000 });
  await page.click('.dlg-picker-custom');
  await page.waitForSelector('#dlg-provider-id', { timeout: 15_000 });
  await page.fill('#dlg-provider-id', 'xmon40-gw');
  await page.fill('#dlg-provider-label', 'XMON40 网关');
  await page.fill('#dlg-provider-baseurl', 'https://example.invalid/v1');
  await page.fill('#dlg-provider-apikey', 'sk-xmon40-not-a-real-key');
  for (let i = 0; i < MODEL_COUNT; i += 1) await page.click('.dlg-provider-model-add');
  const rows = page.locator('input[aria-label="模型 ID"]');
  const n = await rows.count();
  for (let i = 0; i < n; i += 1) await rows.nth(i).fill(`xmon40-model-${String(i).padStart(3, '0')}`);
  await page.click('.dlg-provider-create');
  const env = await page.evaluate(async (t) => {
    for (let i = 0; i < 60; i += 1) {
      const body = await (await fetch(`/api/teams/${t}/providers`)).json();
      if (body.providers.length > 0) return body;
      await new Promise((r) => setTimeout(r, 250));
    }
    return { providers: [] };
  }, tid);
  record(env.providers.length === 1, 'seed: 40 模型的自定义服务商经应用表单建成', `providers=${env.providers.length}`);
}

/** 弹窗结构 + 菜单上边缘的命中测试。 */
async function probe(page, tag) {
  return page.evaluate(({ menuSel, optSel, tag }) => {
    const menuEl = document.querySelector(menuSel);
    const menu = menuEl.getBoundingClientRect();
    const dlg = document.querySelector('[role="dialog"][aria-label]');
    const dlgBox = dlg.getBoundingClientRect();

    // 弹窗的直接子元素们——找出「标题方框」是哪一块、下沿在哪。
    const children = [...dlg.children].map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        cls: el.className.split(' ').slice(0, 3).join('.'),
        top: Math.round(r.top), bottom: Math.round(r.bottom),
        bg: cs.backgroundColor, z: cs.zIndex, pos: cs.position, overflowY: cs.overflowY,
      };
    });

    // 上边缘一线做命中测试：菜单自己的盒子内 3px 处，横跨整个宽度取 9 个点。
    // 采样带避开左右各 12px：菜单是 10px 圆角，端点那几像素本来就不属于菜单
    // 的绘制区，拿它判「被遮挡」会把圆角误报成遮挡。
    const yTop = menu.top + 3;
    const hits = [];
    const span = menu.width - 24;
    for (let i = 0; i <= 8; i += 1) {
      const x = menu.left + 12 + (span * i) / 8;
      const el = document.elementFromPoint(x, yTop);
      const inMenu = el === menuEl || menuEl.contains(el);
      hits.push({ x: Math.round(x), inMenu, got: el ? `${el.tagName}.${String(el.className).split(' ')[0]}` : null });
    }
    // 菜单盒正中一行（对照：这一线一定该命中菜单自己）
    const yMid = menu.top + menu.height / 2;
    const midHit = document.elementFromPoint(menu.left + menu.width / 2, yMid);

    const rows = [...menuEl.querySelectorAll(optSel)].map((o) => {
      const rr = o.getBoundingClientRect();
      const inMenu = Math.max(0, Math.min(rr.bottom, menu.bottom) - Math.max(rr.top, menu.top));
      return { text: o.textContent.trim().slice(0, 26), top: Math.round(rr.top), h: Math.round(rr.height), inMenu: Math.round(inMenu) };
    });
    const firstVisible = rows.find((r) => r.inMenu > 0);

    return {
      tag,
      menu: { top: Math.round(menu.top), bottom: Math.round(menu.bottom), left: Math.round(menu.left), w: Math.round(menu.width) },
      menuScrollTop: menuEl.scrollTop,
      dialogChildren: children,
      // 紧挨菜单上沿、且在菜单之上的那一块弹窗子元素——「标题方框」候选。
      boxAboveMenu: children.filter((c) => c.bottom <= menu.top + 1).sort((a, b) => b.bottom - a.bottom)[0] ?? null,
      gapAboveMenu: (() => {
        const above = children.filter((c) => c.bottom <= menu.top + 1).sort((a, b) => b.bottom - a.bottom)[0];
        return above ? Math.round(menu.top - above.bottom) : null;
      })(),
      topEdgeHits: hits,
      topEdgeCovered: hits.filter((h) => !h.inMenu).length,
      midHitInsideMenu: midHit === menuEl || menuEl.contains(midHit),
      firstVisibleRow: firstVisible ?? null,
      menuOutsideDialog: menu.top < dlgBox.top - 0.5,
      dialogBox: { top: Math.round(dlgBox.top), bottom: Math.round(dlgBox.bottom) },
    };
  }, { menuSel: MENU, optSel: OPTION, tag });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 }, colorScheme: 'dark' });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const all = [];

async function openMenu({ navigate = true } = {}) {
  if (navigate) await page.goto(`${WEB}/app/team`);
  await page.getByRole('button', { name: '创建 Agent' }).click();
  await page.waitForSelector(`[role="dialog"] ${TRIGGER}`, { timeout: 15_000 });
  await page.click(TRIGGER);
  await page.waitForSelector(MENU, { timeout: 10_000 });
  await page.waitForTimeout(300);
  return page.locator(MENU).boundingBox();
}

/** 往下滑的过程中，每一步都拍一张上边缘的局部图。 */
async function scrollFilmstrip(prefix, steps) {
  const box = await page.locator(MENU).boundingBox();
  const dlg = await page.getByRole('dialog', { name: '创建 agent' }).boundingBox();
  const clipTop = Math.max(0, dlg.y - 8);
  const clip = { x: dlg.x - 8, y: clipTop, width: dlg.width + 16, height: Math.min(260, 732 - clipTop) };
  const out = [];
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < steps; i += 1) {
    const snap = await probe(page, `${prefix}/step-${i}`);
    out.push(snap);
    await page.screenshot({ path: join(EVIDENCE, `${prefix}-step-${i}.png`), clip });
    // 非行高整数倍：让上边缘停在「一行被切成半截」的位置——那才是肉眼看上边缘的时候
    await page.mouse.wheel(0, 45);
    await page.waitForTimeout(120);
  }
  return out;
}

await seed(page);

// ══ 待验分支 ══════════════════════════════════════════════════════════════
{
  await openMenu();
  const film = await scrollFilmstrip('10-fixed', 4);
  all.push(...film);

  const s0 = film[0];
  const above = s0.boxAboveMenu;
  record(s0.topEdgeCovered === 0,
    'fixed: 菜单上边缘整条都在菜单自己身上（没有被任何东西盖住）',
    `命中测试 ${9 - s0.topEdgeCovered}/9 落在菜单内${s0.topEdgeCovered ? `，被盖住的点：${JSON.stringify(s0.topEdgeHits.filter((h) => !h.inMenu))}` : ''}`);
  record(film.every((s) => s.topEdgeCovered === 0),
    'fixed: 往下滑的每一步，上边缘都没被盖住',
    `各步被盖住的点数=${film.map((s) => s.topEdgeCovered).join(',')}`);
  record(s0.menuOutsideDialog === false,
    'fixed: 菜单整体在弹窗框内（不出框）',
    `菜单 ${s0.menu.top}..${s0.menu.bottom}，弹窗 ${s0.dialogBox.top}..${s0.dialogBox.bottom}`);
  record(s0.gapAboveMenu != null && s0.gapAboveMenu > 0,
    'fixed: 菜单上沿与其上方那块之间留有空隙',
    `上方块「${above?.cls}」下沿 ${above?.bottom}，菜单上沿 ${s0.menu.top}，间距 ${s0.gapAboveMenu}px`);
  console.log(`   fixed 弹窗直接子元素：\n${s0.dialogChildren.map((c) => `     ${c.cls} ${c.top}..${c.bottom} bg=${c.bg} z=${c.z} pos=${c.pos} overflowY=${c.overflowY}`).join('\n')}`);
}

// ══ 改动前对照（唯一那行 max-height 还原成 300px）══════════════════════════
{
  await page.goto(`${WEB}/app/team`);
  await page.addStyleTag({ content: `${MENU}{max-height:${PREFIX_MAXHEIGHT}px !important}` });
  await openMenu({ navigate: false });
  const film = await scrollFilmstrip('11-prefix', 4);
  all.push(...film);
  const s0 = film[0];
  record(s0.topEdgeCovered > 0 || s0.menuOutsideDialog,
    'prefix: 改动前菜单上边缘伸到弹窗框外，被上面的标题方框切掉',
    `菜单 ${s0.menu.top}..${s0.menu.bottom}，弹窗上沿 ${s0.dialogBox.top}；上边缘命中测试被盖住 ${s0.topEdgeCovered}/9 点：${JSON.stringify(s0.topEdgeHits.filter((h) => !h.inMenu).slice(0, 3))}`);
}

const failed = checks.filter((c) => !c.ok);
writeFileSync(join(EVIDENCE, 'result.json'), JSON.stringify({
  probe: 'xmon-40-top-edge-cover', at: new Date().toISOString(), web: WEB, modelCount: MODEL_COUNT,
  prefixMaxHeight: PREFIX_MAXHEIGHT, checks, snapshots: all, pageErrors: errors,
}, null, 2));
await browser.close();
console.log(`\n${checks.length - failed.length}/${checks.length} checks ok`);
console.log(`evidence: ${EVIDENCE}`);
process.exitCode = failed.length === 0 ? 0 : 1;