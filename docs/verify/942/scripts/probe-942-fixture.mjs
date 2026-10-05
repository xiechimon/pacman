#!/usr/bin/env node
// probe-942-fixture — #942 chip 五态 → StatusChip 映射的 fixture 面实物证据
// （spec/22 §5.2/§5.6）。live 栈上 StatusChip 无可达面（需要在跑任务的
// agent 详情），故 chip 实物走 fixture 场景 agent-detail-active——本探针是
// 证据采集，不是回归面（回归纪律走 apps/web e2e：agent-detail.spec 的
// data-tone 断言已绿）。
//
// 实物判据：data-tone 状态载体 + data-slot=badge 骨架 + sm 档 16px 高 +
// 10px 字 + 皮肤 = --chip-*-bg token 实值（非 Badge 默认 primary）+ 老
// .chip/.chip--* 类 token 清零。
//
// 自含：起 vite preview 服务 apps/web/dist（e2e 的 fixture 构建产物），
// 跑完回收。用法：node probe-942-fixture.mjs [port]（默认 8401）

import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPO = process.env.VERIFY_REPO_ROOT ?? SCRIPT_REPO;
const WEB_DIR = join(REPO, 'apps/web');
const PORT = Number(process.argv[2] ?? process.env.FIXTURE_PORT ?? 8401);
const BASE = `http://127.0.0.1:${PORT}`;
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const EVIDENCE =
  process.env.VERIFY_EVIDENCE_DIR ?? join(SCRIPT_REPO, `.claude/verify-evidence/${ts}-942-fixture`);
mkdirSync(EVIDENCE, { recursive: true });

const checks = [];
function check(name, ok, detail) {
  if (typeof ok !== 'boolean') {
    throw new TypeError(`check(${JSON.stringify(name)}) 的 ok 位须为 boolean，收到 ${typeof ok}`);
  }
  checks.push({ name, ok, detail: detail ?? null });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}\n`);
}
const artifacts = [];
const shot = async (target, name) => {
  await target.screenshot({ path: join(EVIDENCE, name) });
  artifacts.push(name);
  process.stdout.write(`shot  ${name}\n`);
};

const preview = spawn(
  process.execPath,
  [join(WEB_DIR, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort', '--mode', 'fixture'],
  { cwd: WEB_DIR, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_PROXY: '*' } },
);
const previewLog = [];
preview.stdout.on('data', (d) => previewLog.push(String(d)));
preview.stderr.on('data', (d) => previewLog.push(String(d)));

const waitReady = async () => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/app`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`fixture preview 未就绪:\n${previewLog.join('')}`);
};

const browser = await chromium.launch();
try {
  await waitReady();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 732 },
    colorScheme: 'dark',
  });
  await page.goto(`${BASE}/app/resources/agents/r3-builder?scenario=agent-detail-active`, {
    waitUntil: 'networkidle',
  });
  const rows = page.locator('.agent-task-row');
  await rows.first().waitFor({ state: 'visible', timeout: 15_000 });

  // 实物 1：状态载体 data-tone（#910 裁定 3 状态类载体）+ Badge 骨架
  const chip0 = rows.nth(0).locator('[data-tone]');
  const chip1 = rows.nth(1).locator('[data-tone]');
  const tone0 = await chip0.getAttribute('data-tone');
  const tone1 = await chip1.getAttribute('data-tone');
  const slot0 = await chip0.getAttribute('data-slot');
  const text0 = (await chip0.textContent())?.trim();
  const text1 = (await chip1.textContent())?.trim();
  check(
    'chip-tone-carrier',
    (await chip0.count()) === 1 && tone0 === 'idle' && text0 === '待处理' && slot0 === 'badge',
    `row0 data-tone=${tone0 ?? '缺失'} data-slot=${slot0 ?? '缺失'} text=${text0 ?? '缺失'}`,
  );
  check(
    'chip-tone-plan',
    tone1 === 'plan' && text1 === '执行中',
    `row1 data-tone=${tone1 ?? '缺失'} text=${text1 ?? '缺失'}`,
  );

  // 实物 2：sm 档几何 16px / 10px（正典表 §5.2，替旧 mini 14px/10px）
  const box0 = await chip0.boundingBox();
  const fontSize = await chip0.evaluate((el) => getComputedStyle(el).fontSize);
  check(
    'chip-sm-geometry',
    Math.round(box0?.height ?? -1) === 16 && fontSize === '10px',
    `h=${box0 ? Math.round(box0.height) : '缺失'}px font=${fontSize}（sm 档 h-4/text-[10px]）`,
  );

  // 实物 3：皮肤 = --chip-idle-bg/fg token 实值（不是 Badge 默认 primary）
  const skin = await chip0.evaluate((el) => {
    const cs = getComputedStyle(el);
    const root = getComputedStyle(document.documentElement);
    const resolveToken = (raw) => {
      const probe = document.createElement('div');
      probe.style.color = raw.trim();
      probe.style.display = 'none';
      document.body.append(probe);
      const rgb = getComputedStyle(probe).color;
      probe.remove();
      return rgb;
    };
    return {
      bg: cs.backgroundColor,
      fg: cs.color,
      bgToken: resolveToken(root.getPropertyValue('--chip-idle-bg')),
      fgToken: resolveToken(root.getPropertyValue('--chip-idle-fg')),
      radius: cs.borderTopLeftRadius,
    };
  });
  check(
    'chip-token-skin',
    // 半径 = Badge 骨架的 rounded-4xl（当前 --radius 解析 26px，#915 翻值随动），
    // ≥ h/2 即胶囊视效——不钉死 9999px 旧值，几何正本 = registry 件默认。
    skin.bg === skin.bgToken &&
      skin.fg === skin.fgToken &&
      Number.parseFloat(skin.radius) >= (box0?.height ?? 0) / 2,
    `bg=${skin.bg}(token ${skin.bgToken}) fg=${skin.fg}(token ${skin.fgToken}) radius=${skin.radius}`,
  );

  // 实物 4：行内老 .chip/.chip--* 类 token 清零
  const legacy = await rows.nth(0).evaluate((row) => {
    const hits = [];
    for (const node of [row, ...row.querySelectorAll('*')]) {
      for (const cls of node.classList) {
        if (cls === 'chip' || cls.startsWith('chip--')) hits.push(cls);
      }
    }
    return hits;
  });
  check('chip-legacy-zero', legacy.length === 0, `老类命中 ${legacy.length} 处${legacy.length ? `: ${legacy.join(', ')}` : ''}`);

  await shot(page.locator('.agent-tasks'), '01-agent-task-chips-dark.png');
  await page.close();

  // 亮模面：token 对随主题翻（值探针契约 hex/rgb 可读）
  const lightPage = await browser.newPage({
    viewport: { width: 1440, height: 732 },
    colorScheme: 'light',
  });
  await lightPage.addInitScript(() => localStorage.setItem('pacman-theme', 'light'));
  await lightPage.goto(`${BASE}/app/resources/agents/r3-builder?scenario=agent-detail-active`, {
    waitUntil: 'networkidle',
  });
  await lightPage.locator('.agent-task-row').first().waitFor({ state: 'visible', timeout: 15_000 });
  const lightChip = lightPage.locator('.agent-task-row').nth(0).locator('[data-tone]');
  const lightSkin = await lightChip.evaluate((el) => {
    const cs = getComputedStyle(el);
    const probe = document.createElement('div');
    probe.style.color = getComputedStyle(document.documentElement)
      .getPropertyValue('--chip-idle-bg')
      .trim();
    probe.style.display = 'none';
    document.body.append(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    return { bg: cs.backgroundColor, bgToken: rgb };
  });
  check(
    'chip-token-skin-light',
    lightSkin.bg === lightSkin.bgToken && lightSkin.bg !== skin.bg,
    `亮模 bg=${lightSkin.bg}(token ${lightSkin.bgToken})，与暗模 ${skin.bg} 相异=双模翻值生效`,
  );
  await shot(lightPage.locator('.agent-tasks'), '02-agent-task-chips-light.png');
  await lightPage.close();
} finally {
  await browser.close();
  preview.kill('SIGTERM');
}

const ok = checks.every((c) => c.ok);
const result = {
  probe: '942-fixture',
  ok,
  at: new Date().toISOString(),
  stack: { fixturePreview: BASE, dist: join(WEB_DIR, 'dist') },
  checks,
  artifacts,
};
writeFileSync(join(EVIDENCE, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(
  `\nevidence: ${EVIDENCE}\nallOk=${ok}\n${ok ? 'probe 942-fixture:PASS' : 'probe 942-fixture:FAIL'}\n`,
);
process.exit(ok ? 0 : 1);
