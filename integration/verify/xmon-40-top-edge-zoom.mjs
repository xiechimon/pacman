// XMON-40 复查：把「菜单上沿 ↔ 标题方框」那一小段放大三倍并排摆，供肉眼直接判。
//
// 用户反馈（2026-10-01）：「你往下滑的时候，上边缘被上面的标题方框遮挡住了，
// 感觉不是很美观。」——这是视觉判断，量出来的几何（8px 空隙、有边框线）得让人
// 一眼看得见，否则数字没有说服力。
//
// 两版取**同一个绝对像素窗口**（弹窗体上沿上下各若干像素），所以两格可以直接叠
// 着看：改动后那条线在菜单自己身上，改动前那条线是弹窗体的裁剪边。
//
//   node integration/verify/xmon-40-top-edge-zoom.mjs

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const ports = JSON.parse(readFileSync(join(ROOT, '.claude/verify-run/ports.json'), 'utf8'));
const WEB = `http://127.0.0.1:${process.env.VERIFY_WEB_PORT ?? ports.webPort}`;
const EVIDENCE = process.env.VERIFY_EVIDENCE_DIR ?? join(ROOT, '.claude/verify-evidence/xmon40-top-edge');
mkdirSync(EVIDENCE, { recursive: true });

const MODEL_COUNT = Number(process.env.XMON40_MODEL_COUNT ?? 40);
const PREFIX_MAXHEIGHT = Number(process.env.XMON40_PREFIX_MAXHEIGHT ?? 300);
const TRIGGER = '.dlg-agent-model-select';
const MENU = '.dlg-agent-model-menu';
const BODY = '.dlg-body';
const SCALE = 3;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 }, colorScheme: 'dark' });

await page.goto(`${WEB}/app/team`);
const tid = await page.evaluate(async () => (await (await fetch('/api/teams')).json())[0].id);
const existing = await page.evaluate(async (t) => (await (await fetch(`/api/teams/${t}/providers`)).json()).providers, tid);
if (!existing.some((p) => p.providerId === 'xmon40-gw' && p.models.length === MODEL_COUNT)) {
  throw new Error('未找到 40 模型服务商，请先跑 xmon-40-top-edge-cover.mjs 播种');
}

/** 开菜单 → 往下滑一格（45px，非行高整数倍，让上边缘停在半行处）→ 取同一个窗口截图。 */
async function crop(label, injectPrefix) {
  await page.goto(`${WEB}/app/team`);
  if (injectPrefix) await page.addStyleTag({ content: `${MENU}{max-height:${PREFIX_MAXHEIGHT}px !important}` });
  await page.getByRole('button', { name: '创建 Agent' }).click();
  await page.waitForSelector(`[role="dialog"] ${TRIGGER}`, { timeout: 15_000 });
  await page.click(TRIGGER);
  await page.waitForSelector(MENU, { timeout: 10_000 });
  await page.waitForTimeout(320);

  const box = await page.locator(MENU).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(120);
  // 真滚轮，一次一小步；滚不动就再来一步（首帧偶发吞事件），读到动了为止。
  let scrollTop = 0;
  for (let i = 0; i < 6 && scrollTop === 0; i += 1) {
    await page.mouse.wheel(0, 14);
    await page.waitForTimeout(180);
    scrollTop = await page.locator(MENU).evaluate((el) => el.scrollTop);
  }

  const m = await page.locator(MENU).boundingBox();
  const body = await page.locator(BODY).boundingBox();
  // 窗口锚在**弹窗体上沿**：改动后菜单上沿在它下面 8px，改动前菜单被它裁掉。
  const clip = { x: Math.round(m.x - 8), y: Math.round(body.y - 14), width: 252, height: 92 };
  const buf = await page.screenshot({ clip });
  writeFileSync(join(EVIDENCE, `${label}-crop.png`), buf);
  return {
    label, png: buf.toString('base64'), clip, scrollTop,
    menuTop: Math.round(m.y), bodyTop: Math.round(body.y), menuBottom: Math.round(m.bottom),
  };
}

const fixed = await crop('30-fixed', false);
const prefix = await crop('31-prefix', true);

const cell = (c, title, note) => `
  <figure>
    <figcaption><b>${title}</b><span>${note}</span></figcaption>
    <img src="data:image/png;base64,${c.png}"
         style="width:${c.clip.width * SCALE}px;image-rendering:pixelated">
  </figure>`;

await page.setContent(`
<style>
  body { margin:0; padding:22px 26px; background:#101014; color:#e7e7ea;
         font:14px/1.6 -apple-system,"PingFang SC","Noto Sans CJK SC",sans-serif; }
  h1 { font-size:15px; margin:0 0 4px; font-weight:600; }
  p.sub { margin:0 0 18px; color:#8b8b95; font-size:12.5px; }
  figure { margin:0 0 20px; }
  figcaption { margin-bottom:7px; }
  figcaption b { display:block; font-size:13.5px; }
  figcaption span { color:#8b8b95; font-size:12.5px; }
  img { display:block; border:1px solid #2a2a30; }
</style>
<h1>创建 Agent · 模型菜单上沿（往下滑一格后的同一个像素窗口，放大 ${SCALE}×）</h1>
<p class="sub">窗口锚在弹窗体上沿（.dlg-body），两格取自同一绝对坐标，可直接上下叠看。</p>
${cell(fixed, '改动后（PR #550）', `菜单上沿 y=${fixed.menuTop}，弹窗体上沿 y=${fixed.bodyTop} —— 菜单上沿有自己的浅色边框线，与上方标题框之间留出空隙（滚轮划过后 scrollTop=${fixed.scrollTop}）`)}
${cell(prefix, '改动前（max-height 300px）', `菜单名义上沿 y=${prefix.menuTop}（在弹窗体上沿之上、整段被裁掉），弹窗体上沿 y=${prefix.bodyTop} —— 上沿无边框、无空隙，列表从标题框下沿直接切出来（同一滚轮操作后 scrollTop=${prefix.scrollTop}）`)}
`);

const shot = await page.locator('body').screenshot({ path: join(EVIDENCE, '30-31-zoom.png') });
void shot;
await browser.close();

writeFileSync(join(EVIDENCE, 'zoom.json'), JSON.stringify({ at: new Date().toISOString(), scale: SCALE, fixed, prefix }, (k, v) => (k === 'png' ? undefined : v), 2));
console.log(`fixed  菜单上沿 y=${fixed.menuTop}  弹窗体上沿 y=${fixed.bodyTop}  scrollTop=${fixed.scrollTop}`);
console.log(`prefix 菜单名义上沿 y=${prefix.menuTop}  弹窗体上沿 y=${prefix.bodyTop}  scrollTop=${prefix.scrollTop}`);
console.log(`evidence: ${EVIDENCE}/30-31-zoom.png`);