#!/usr/bin/env node
// verify-pacman 定制 probe — t-0024 诉求 2 的 before/after 截图面。
// 用法(栈须在跑;BEFORE/AFTER 同一脚本同一组机位,只换代码版本):
//   env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
//     SHOT_TAG=before node docs/verify/t-0024/shot-model-slot.mjs
// SHOT_TAG 决定落盘文件名前缀(before-* / after-*),其余逐字节同。
//
// 机位三张:
// 1. 创建 Agent 弹窗(模型菜单展开)——平铺混杂 vs 两级选择的对照主图。
// 2. 创建 Agent 弹窗(菜单收起)——表单行排布对照。
// 3. Agent 详情概览(运行时行 + 模型行)——详情面两级形态对照。
// 数据面:两个 custom provider(r3-gw 两模型 / b-gw 一模型)+ 合成 HOME 的
// claude-code 段三模型——混在平铺下拉里正是用户抱怨的「全部混杂在一起」。

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.VERIFY_REPO_ROOT
  ? resolve(process.env.VERIFY_REPO_ROOT)
  : resolve(SCRIPT_DIR, '../../..');
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(ROOT, '.claude', 'verify-run');
const EVIDENCE = process.env.VERIFY_EVIDENCE_DIR ?? SCRIPT_DIR;
const TAG = process.env.SHOT_TAG ?? 'before';

let stack;
try {
  stack = JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'));
} catch {
  console.error(`无栈:${join(RUN_DIR, 'ports.json')} 不存在或损坏。先跑 launch.mjs`);
  process.exit(1);
}
const API = `http://127.0.0.1:${stack.serverPort}`;
const WEB = `http://127.0.0.1:${stack.webPort}`;

mkdirSync(EVIDENCE, { recursive: true });

async function api(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const teams = await api('GET', '/api/teams');
const teamId = teams.json?.[0]?.id;

// 候选源幂等:已存在就跳过(probe 可能已建过)
const existing = await api('GET', `/api/teams/${teamId}/providers`);
const have = new Set((existing.json?.providers ?? []).map((p) => p.providerId));
if (!have.has('r3-gw'))
  await api('POST', `/api/teams/${teamId}/providers`, {
    providerId: 'r3-gw',
    label: 'r3-gw',
    baseUrl: 'https://gw.example/v1',
    api: 'anthropic-messages',
    authHeader: true,
    models: [
      { id: 'glm-5.3', name: 'glm-5.3' },
      { id: 'qwen3.8-max', name: 'qwen3.8-max' },
    ],
    apiKey: null,
  });
if (!have.has('b-gw'))
  await api('POST', `/api/teams/${teamId}/providers`, {
    providerId: 'b-gw',
    label: 'b-gw',
    baseUrl: 'https://b.example/v1',
    api: 'anthropic-messages',
    authHeader: true,
    models: [{ id: 'deepseek-v4-pro', name: 'deepseek-v4-pro' }],
    apiKey: null,
  });

// 详情面机位的 agent:幂等建一个(同名复用)。members 行的 id 是 member-<x>,
// agent id 在 actor.id——拿错会 404 到没有 .agent-overview 的页。
const members = await api('GET', `/api/teams/${teamId}/members`);
let shotAgentId = (members.json ?? []).find((m) => m.actor?.displayName === 'shot-agent')?.actor
  ?.id;
if (shotAgentId === undefined) {
  const created = await api('POST', `/api/teams/${teamId}/agents`, {
    displayName: 'shot-agent',
    provider: 'r3-gw',
    modelId: 'qwen3.8-max',
  });
  shotAgentId = created.json?.id;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 }, colorScheme: 'dark' });
try {
  // 机位 1+2:创建弹窗
  await page.goto(`${WEB}/app/team`);
  await page.locator('.team-create-agent').click();
  const dialog = page.locator('.dlg');
  await dialog.waitFor({ state: 'visible', timeout: 15_000 });
  await page.screenshot({ path: join(EVIDENCE, `${TAG}-create-dialog.png`) });
  console.log(`shot  ${TAG}-create-dialog.png`);
  // 菜单展开机位。两代 UI 自适应:before(平铺单框)直接开模型菜单;after(两级)
  // 先开一级菜单截一张,选定 r3-gw 后再开二级菜单截对照主图。
  const settle = (menu) =>
    // anim-pop 是 opacity 动画:Playwright 的 visible 判定不看 opacity,waitFor
    // 通过的那一帧菜单还是全透——截图会拍到一个「没展开」的假象。等动画真落地。
    menu.waitForFunction((el) => getComputedStyle(el).opacity === '1');
  const runtimeTrigger = dialog.locator('.dlg-agent-runtime-select');
  if ((await runtimeTrigger.count()) > 0) {
    await runtimeTrigger.click();
    const runtimeMenu = dialog.locator('.dlg-agent-runtime-menu');
    await runtimeMenu.waitFor({ state: 'visible', timeout: 10_000 });
    await settle(runtimeMenu);
    await page.screenshot({ path: join(EVIDENCE, `${TAG}-create-dialog-runtime-menu.png`) });
    console.log(`shot  ${TAG}-create-dialog-runtime-menu.png`);
    await dialog.locator('.dlg-agent-runtime-row', { hasText: 'r3-gw' }).click();
  }
  const modelTrigger = dialog.locator('.dlg-agent-model-select');
  await modelTrigger.click();
  const menu = dialog.locator('.dlg-agent-model-menu');
  await menu.waitFor({ state: 'visible', timeout: 10_000 });
  await settle(menu);
  await page.screenshot({ path: join(EVIDENCE, `${TAG}-create-dialog-menu.png`) });
  console.log(`shot  ${TAG}-create-dialog-menu.png`);
  await page.keyboard.press('Escape');

  // 机位 3:详情概览
  await page.goto(`${WEB}/app/resources/agents/${shotAgentId}`);
  await page.waitForSelector('.agent-overview', { timeout: 15_000 });
  await page.screenshot({ path: join(EVIDENCE, `${TAG}-detail-overview.png`) });
  console.log(`shot  ${TAG}-detail-overview.png`);
} finally {
  await browser.close();
}

writeFileSync(
  join(EVIDENCE, `${TAG}-shots.json`),
  `${JSON.stringify({ tag: TAG, at: new Date().toISOString(), web: WEB, api: API }, null, 2)}\n`,
);
console.log(`done:${TAG}`);
