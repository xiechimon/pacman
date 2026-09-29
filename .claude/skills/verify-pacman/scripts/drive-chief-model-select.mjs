#!/usr/bin/env node
// verify-pacman drive-chief-model-select — 总管设置压缩模型选择器数据源
// （spec 11 §A10，#358）。
//
// 真用户路径：/app（board）→ 总管 FAB 开 drawer → gear（总管设置）换内容区
// → Agent tab → 压缩模型选择器 button.chief-select → 展开 .chief-model-menu。
//
// 验 #358 的 live 面（fixture e2e 覆盖不到的「hook → mapper → DOM」段）：
//   AC1 选择器行内容随 providers 配置变化 —— API POST 铺底 custom provider
//       后重载，行集合随之变；再铺第二个 provider，行再变（delta 纯由
//       providers 驱动，claude-code 段同机恒定）。
//   并集一致性 —— 选择器非默认行 (providerLabel, modelName) 集合 ==
//       toChiefModelOptions(GET providers, GET model-sources) 的期望投影
//       （driver 内复刻 mapper 逻辑做 UI=API 双真值对拍）。
//   claude-code 段数据源 = 本机 ~/.claude/settings.json（server homedir 直读，
//       A4）——机器相关，只断言 UI=API 一致，不断言具体清单（drive-providers
//       -tabs cc-model-rows-consistency 同律）。
//
// 铺底走公开 REST POST /api/teams/:id/providers（非被测路径，drive.mjs search
// probe 铺底律）。依赖全新库：重验 = 重 launch。
// 用法：VERIFY_REPO_ROOT=<worktree> node drive-chief-model-select.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const REPO = process.env.VERIFY_REPO_ROOT ?? SCRIPT_REPO;
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(REPO, '.claude/verify-run');
const portsFile = join(RUN_DIR, 'ports.json');
if (!existsSync(portsFile)) {
  process.stderr.write('无栈：' + portsFile + ' 不存在或损坏。先跑 launch.mjs\n');
  process.exit(1);
}
const stack = JSON.parse(readFileSync(portsFile, 'utf8'));
const SERVER = 'http://127.0.0.1:' + (stack.serverPort ?? process.env.VERIFY_PORT ?? 8791);
const WEB = 'http://127.0.0.1:' + (stack.webPort ?? process.env.VERIFY_WEB_PORT ?? 5273);
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const EVIDENCE =
  process.env.VERIFY_EVIDENCE_DIR ??
  join(SCRIPT_REPO, '.claude/verify-evidence/' + ts + '-chief-model-select');
mkdirSync(EVIDENCE, { recursive: true });

const checks = [];
function check(name, ok, detail) {
  if (typeof ok !== 'boolean') {
    throw new TypeError('check(' + JSON.stringify(name) + ') 的 ok 位须为 boolean，收到 ' + typeof ok);
  }
  checks.push({ name, ok, detail: detail ?? null });
  process.stdout.write((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : '') + '\n');
}
const artifacts = [];
async function shot(page, name) {
  await page.screenshot({ path: join(EVIDENCE, name) });
  artifacts.push(name);
  process.stdout.write('shot  ' + name + '\n');
}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('GET ' + url + ' → ' + res.status);
  return res.json();
}
async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error('POST ' + url + ' → ' + res.status + ': ' + (await res.text()));
  return res.json();
}

// driver 内复刻 api/mappers.ts toChiefModelOptions（#358）做 UI=API 对拍：
// custom providers models[]（带 providerId/label 归属；pi 段卫生：空 id 跳过、
// 空 name 回退 id）∪ 非 pi runtime 段（provider = runtime 词表值），同
// (provider, modelId) 去重 first-wins。
function expectedOptions(providers, sources) {
  const out = [];
  const seen = new Set();
  function push(o) {
    const k = o.provider + '/' + o.modelId;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(o);
  }
  for (const p of providers) {
    for (const m of p.models ?? []) {
      if (m.id === '') continue;
      push({
        provider: p.providerId,
        providerLabel: p.label,
        modelId: m.id,
        modelName: m.name !== '' ? m.name : m.id,
      });
    }
  }
  for (const s of sources) {
    if (s.runtime === 'pi') continue;
    const providerLabel = s.runtime === 'claude-code' ? 'Claude Code' : s.runtime;
    for (const m of s.models ?? []) {
      push({ provider: s.runtime, providerLabel, modelId: m.id, modelName: m.name });
    }
  }
  return out;
}
function rowKey(providerLabel, modelName) {
  return providerLabel + '\u0000' + modelName;
}
function sortedKeys(list) {
  return list.map((r) => rowKey(r.providerLabel, r.modelName)).sort();
}

const PAGE_PATH = '/app';
const FAB = '.chief-fab';
const GEAR = 'button[aria-label="总管设置"]';
const SETTINGS = '.chief-settings';
const SELECT_BTN = 'button.chief-select';
const MENU = '.chief-model-menu';

// 从 board 走到压缩模型选择器并展开菜单（真用户路径：FAB → gear → select）。
async function openModelMenu(page) {
  await page.goto(WEB + PAGE_PATH);
  await page.waitForSelector(FAB, { timeout: 15000 });
  await page.click(FAB);
  await page.waitForSelector(GEAR, { state: 'visible', timeout: 8000 });
  await page.click(GEAR);
  await page.waitForSelector(SETTINGS, { timeout: 8000 });
  await page.waitForSelector(SELECT_BTN, { timeout: 8000 });
  await page.click(SELECT_BTN);
  await page.waitForSelector(MENU, { state: 'visible', timeout: 8000 });
}

// 读菜单里的行：默认行（无 provider 徽标）+ 模型行（有 .chief-model-row-provider）。
async function readMenuRows(page) {
  return page.evaluate((menuSel) => {
    const menu = document.querySelector(menuSel);
    if (menu == null) return { total: 0, model: [] };
    const rows = [...menu.querySelectorAll('.chief-model-row')];
    const model = rows
      .map((r) => {
        const name = r.querySelector('.chief-model-row-name');
        const prov = r.querySelector('.chief-model-row-provider');
        return {
          modelName: name ? (name.textContent ?? '').trim() : '',
          providerLabel: prov ? (prov.textContent ?? '').trim() : '',
          isDefault: prov == null,
        };
      })
      .filter((r) => !r.isDefault);
    return { total: rows.length, model };
  }, MENU);
}
const stamp = Date.now() % 100000;
const provA = {
  providerId: 'verify-gw-a-' + stamp,
  label: '验证网关A' + stamp,
  baseUrl: 'https://gw-a.verify.example.com/v1',
  api: 'openai-completions',
  authHeader: true,
  models: [
    { id: 'va-model-x-' + stamp, name: '验证A模型X' + stamp },
    { id: 'va-model-y-' + stamp, name: '验证A模型Y' + stamp },
  ],
};
const provB = {
  providerId: 'verify-gw-b-' + stamp,
  label: '验证网关B' + stamp,
  baseUrl: 'https://gw-b.verify.example.com/v1',
  api: 'openai-completions',
  authHeader: true,
  models: [{ id: 'vb-model-z-' + stamp, name: '验证B模型Z' + stamp }],
};

const extra = {};
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 732 },
  colorScheme: 'dark',
});

async function seedProvider(teamId, prov) {
  try {
    await postJson(SERVER + '/api/teams/' + teamId + '/providers', prov);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}
async function apiTruth(teamId) {
  const provEnv = await getJson(SERVER + '/api/teams/' + teamId + '/providers');
  const msEnv = await getJson(SERVER + '/api/teams/' + teamId + '/model-sources');
  return expectedOptions(provEnv.providers ?? [], msEnv.sources ?? []);
}
async function waitMenuHasNames(page, names) {
  await page
    .waitForFunction(
      (want) => {
        const menu = document.querySelector('.chief-model-menu');
        const text = menu ? (menu.textContent ?? '') : '';
        return want.every((n) => text.includes(n));
      },
      names,
      { timeout: 8000 },
    )
    .catch(() => {});
}

try {
  const teams = await getJson(SERVER + '/api/teams');
  const teamId = teams?.[0]?.id ?? null;
  check(
    'api-team-ready',
    teamId != null,
    teamId != null ? 'GET /api/teams teamId=' + teamId : '取 teamId 失败',
  );

  // 基线：全新库无 custom provider → 选择器行只含默认 + 本机 claude-code 段
  await openModelMenu(page);
  const baseline = await readMenuRows(page);
  await shot(page, '01-baseline.png');
  extra.baselineRows = baseline.model;

  // 铺底 provider A（2 模型）→ 重载走真路径 → 两模型应进行
  const seedA = teamId != null ? await seedProvider(teamId, provA) : { ok: false, error: '无 teamId' };
  check(
    'seed-provider-a',
    seedA.ok,
    seedA.ok ? 'POST provider A（' + provA.models.length + ' 模型）' : '铺底 A 失败：' + seedA.error,
  );
  await openModelMenu(page);
  await waitMenuHasNames(
    page,
    provA.models.map((m) => m.name),
  );
  const afterA = await readMenuRows(page);
  await shot(page, '02-provider-a.png');
  const aPresent = provA.models.every((m) =>
    afterA.model.some((r) => r.modelName === m.name && r.providerLabel === provA.label),
  );
  check(
    'ac1-provider-a-rows',
    aPresent,
    aPresent
      ? 'AC1：选择器行含 provider A 两模型（providerLabel=' + provA.label + '）'
      : 'spec 11 A10/AC1：铺底 provider A 后其 models[] 应进选择器行——实测 ' +
        JSON.stringify(afterA.model.slice(0, 6)),
  );
  // UI=API 双真值：非默认行集合 == toChiefModelOptions 期望投影
  const expectedA = teamId != null ? await apiTruth(teamId) : [];
  extra.expectedAfterA = expectedA;
  extra.uiAfterA = afterA.model;
  const sameA = JSON.stringify(sortedKeys(afterA.model)) === JSON.stringify(sortedKeys(expectedA));
  check(
    'union-consistency-a',
    sameA,
    sameA
      ? '并集一致：选择器行集合 == 期望投影（' + expectedA.length + ' 行，含 claude-code 段）'
      : 'UI≠API：UI ' +
        JSON.stringify(sortedKeys(afterA.model)) +
        ' vs 期望 ' +
        JSON.stringify(sortedKeys(expectedA)),
  );
  // 铺底 provider B（1 模型）→ 重载 → 行数增长且 B 模型进行（AC1：随配置变）
  const seedB = teamId != null ? await seedProvider(teamId, provB) : { ok: false, error: '无 teamId' };
  check(
    'seed-provider-b',
    seedB.ok,
    seedB.ok ? 'POST provider B（1 模型）' : '铺底 B 失败：' + seedB.error,
  );
  await openModelMenu(page);
  await waitMenuHasNames(page, [provB.models[0].name]);
  const afterB = await readMenuRows(page);
  await shot(page, '03-provider-b-added.png');
  const bPresent = afterB.model.some(
    (r) => r.modelName === provB.models[0].name && r.providerLabel === provB.label,
  );
  const grew = afterB.model.length === afterA.model.length + provB.models.length;
  check(
    'ac1-config-changes-rows',
    bPresent && grew,
    (bPresent ? 'provider B 模型进行' : 'B 模型未进行') +
      '；模型行数 ' +
      afterA.model.length +
      '→' +
      afterB.model.length +
      '（期望 +' +
      provB.models.length +
      '）',
  );
  const expectedB = teamId != null ? await apiTruth(teamId) : [];
  const sameB = JSON.stringify(sortedKeys(afterB.model)) === JSON.stringify(sortedKeys(expectedB));
  check(
    'union-consistency-b',
    sameB,
    sameB
      ? 'B 加入后行集合仍 == 期望投影（' + expectedB.length + ' 行）'
      : 'B 后 UI≠API：UI ' +
        JSON.stringify(sortedKeys(afterB.model)) +
        ' vs 期望 ' +
        JSON.stringify(sortedKeys(expectedB)),
  );
  extra.providerA = { providerId: provA.providerId, label: provA.label, models: provA.models };
  extra.providerB = { providerId: provB.providerId, label: provB.label, models: provB.models };
  extra.afterBRows = afterB.model;
} catch (err) {
  check('probe-exception', false, String(err?.message ?? err));
  try {
    await shot(page, '99-error.png');
  } catch {
    /* 截不上就算了 */
  }
} finally {
  await browser.close();
}

const ok = checks.every((c) => c.ok);
const result = {
  probe: 'chief-model-select',
  ok,
  at: new Date().toISOString(),
  stack: { api: SERVER, web: WEB, homeDir: stack.homeDir },
  checks,
  artifacts,
  ...extra,
};
writeFileSync(join(EVIDENCE, 'result.json'), JSON.stringify(result, null, 2) + '\n');
process.stdout.write(
  '\nevidence: ' +
    EVIDENCE +
    '\nallOk=' +
    ok +
    '\n' +
    (ok
      ? 'drive chief-model-select:PASS'
      : 'drive chief-model-select:FAIL(' + checks.filter((c) => !c.ok).length + ' 项)') +
    '\n',
);
process.exit(ok ? 0 : 1);