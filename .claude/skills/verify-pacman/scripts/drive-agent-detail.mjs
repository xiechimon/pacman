#!/usr/bin/env node
// verify-pacman drive-agent-detail — Agent 详情编辑面（#485，r3 §4 实测形态）。
//
// 走真用户路径：团队页点 Agent 卡 → 详情路由 → 概览改名称/职责/模型 → 权限
// 开关（工具六开关 + #510 密钥区聚合总开关）→ 记忆空态 → 回团队页用创建
// 弹窗选模型建 Agent。
//
// 真值 = server 面（不是 UI 回显）：每次编辑后重取 GET
// /api/teams/{id}/agents/{aid} 对字段，创建后重取 members 对 provider/modelId。
// UI 回显成功而 server 没变 = 本 probe 要抓的失败模式（#485 之前 patchAgent
// 是零消费点的死代码，这条缝从没被 web 面走过）。
//
// fixture 面（apps/web e2e 的 agent-detail.spec / agent-create-model.spec）证明
// 交互；本 probe 证明 live 落库。两条都要，互不替代。
// 用法：node <worktree>/.claude/skills/verify-pacman/scripts/drive-agent-detail.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const REPO = process.env.VERIFY_REPO_ROOT ?? SCRIPT_REPO;
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(REPO, '.claude/verify-run');
const ports = existsSync(join(RUN_DIR, 'ports.json'))
  ? JSON.parse(readFileSync(join(RUN_DIR, 'ports.json'), 'utf8'))
  : {};
const SERVER = `http://127.0.0.1:${ports.serverPort ?? process.env.VERIFY_PORT ?? 8791}`;
const WEB = `http://127.0.0.1:${ports.webPort ?? process.env.VERIFY_WEB_PORT ?? 5273}`;
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const EVIDENCE =
  process.env.VERIFY_EVIDENCE_DIR ?? join(SCRIPT_REPO, `.claude/verify-evidence/${ts}-agent-detail`);
mkdirSync(EVIDENCE, { recursive: true });

const AGENT_NAME = 'verify-485-builder';
const RENAMED = 'verify-485-renamed';

const checks = [];
function check(name, ok, detail) {
  if (typeof ok !== 'boolean') {
    throw new TypeError(`check(${JSON.stringify(name)}) 的 ok 位须为 boolean，收到 ${typeof ok}`);
  }
  checks.push({ name, ok, detail: detail ?? null });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}\n`);
}
const artifacts = [];
const shot = async (page, name) => {
  await page.screenshot({ path: join(EVIDENCE, name) });
  artifacts.push(name);
  process.stdout.write(`shot  ${name}\n`);
};

const getJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
};
const sendJson = async (url, method, body) => {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
  return res.status === 204 ? null : res.json();
};

const teams = await getJson(`${SERVER}/api/teams`);
const teamId = teams[0]?.id;
if (teamId === undefined) throw new Error('no team seeded');
const agentUrl = (aid) => `${SERVER}/api/teams/${teamId}/agents/${aid}`;
const extra = { teamId, agentId: null };

// —— 播种：一个 custom provider（模型选择器的候选源）+ 两个团队密钥 +
// 一个 Agent ──────────────────────────────────────────────────────────
await sendJson(`${SERVER}/api/teams/${teamId}/providers`, 'POST', {
  providerId: 'verify-485-gw',
  label: 'verify-485-gw',
  baseUrl: 'https://gw.invalid/v1',
  api: 'anthropic-messages',
  models: [{ id: 'claude-sonnet-5', name: 'claude-sonnet-5' }],
}).catch(() => {}); // 409 = 重跑时已存在
// #510：两个团队密钥。密钥区授权粒度是全有全无——写回的是团队全部密钥 id，
// 只播一个密钥时「全 id 集」与「首个 id」两种实现都过，两个才有牙。
// POST 无幂等键（每次新 id），故断言一律对「点击时 server 的现行 id 集」，
// 重跑留下的旧密钥不会让断言失真。
const secretsUrl = `${SERVER}/api/teams/${teamId}/secrets`;
for (const name of ['verify-510-key-a', 'verify-510-key-b']) {
  await sendJson(secretsUrl, 'POST', { name, description: null, value: `value-${name}` });
}
const created = await sendJson(`${SERVER}/api/teams/${teamId}/agents`, 'POST', {
  displayName: AGENT_NAME,
  provider: 'verify-485-gw',
  modelId: 'claude-sonnet-5',
});
const agentId = created.id;
extra.agentId = agentId;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 732 },
  colorScheme: 'dark',
});

try {
  // —— 1. 团队页卡是链接，点进详情路由 ──────────────────────────────────
  await page.goto(`${WEB}/app/team`);
  await page.waitForSelector('[data-route="team"]', { timeout: 15_000 });
  const card = page.locator('.team-agent-card', { hasText: AGENT_NAME });
  await card.waitFor({ state: 'visible', timeout: 15_000 });
  check('team-card-is-link', (await card.evaluate((el) => el.tagName)) === 'A', '卡元素是 a');
  await card.click();
  await page.waitForSelector('.agent-overview', { timeout: 15_000 });
  check(
    'card-opens-detail-route',
    new URL(page.url()).pathname === `/app/resources/agents/${agentId}`,
    page.url(),
  );
  await shot(page, '01-overview.png');

  // —— 2. 概览回显 = server 真值 ────────────────────────────────────────
  const record0 = await getJson(agentUrl(agentId));
  check('server-seeded', record0.displayName === AGENT_NAME, record0.displayName);
  check(
    'overview-name',
    (await page.locator('.agent-name').textContent())?.trim() === AGENT_NAME,
  );
  check(
    'overview-role-empty-canon',
    (await page.locator('.agent-role-text').textContent())?.trim() === '未设置职责',
  );
  check(
    'overview-model',
    ((await page.locator('.agent-model-select').textContent()) ?? '').includes('claude-sonnet-5'),
  );
  // XMON-18（2026-10-01 裁决）：概览撤掉「思考强度」「状态」两行——思考强度交给
  // agent 编排、不给人手设；状态只有一个取值。判据是**页面里不存在**（元素计数为
  // 零），比断言文本更能钉住「没长回来 + 没留空壳」。
  const thinkingCount = await page.locator('.agent-thinking').count();
  const statusCount = await page.locator('.agent-status').count();
  check(
    'overview-no-thinking-status-rows',
    thinkingCount === 0 && statusCount === 0,
    `thinking=${thinkingCount} status=${statusCount}`,
  );
  // 运行时档 = provider 位派生（本场景 provider = verify-485-gw 这个 custom
  // provider，故直接出 id；内置 pi 时出「内置 (pi)」）。
  check(
    'overview-runtime-derived',
    (await page.locator('.agent-runtime').textContent())?.trim() === 'verify-485-gw',
    await page.locator('.agent-runtime').textContent(),
  );

  // —— 2b. 能力读面已删（XMON-18）→ 钉住它真的是 404，不是只从 UI 上摘掉 ——
  // 撤行之后 `GET /api/capabilities` 零消费点，端点连同封套 schema、web 的钩与
  // 投影一起删了。这条防的是「UI 摘了、端点还挂着」——死面留在 server 上没人看
  // 得见。404 是**路由不存在**（落 SPA/JSON 404），与 401/403 区分开。
  const capsRes = await fetch(`${SERVER}/api/capabilities`, { signal: AbortSignal.timeout(8000) });
  check('capabilities-endpoint-gone', capsRes.status === 404, `HTTP ${capsRes.status}`);

  // —— 3. 名称行内编辑 → server displayName 变 ──────────────────────────
  await page.locator('.agent-name').click();
  await page.locator('#agent-name-input').fill(RENAMED);
  await page.locator('#agent-name-input').press('Enter');
  await page.waitForTimeout(400); // invalidateAll 重取的落窗
  const afterName = await getJson(agentUrl(agentId));
  check('name-persisted', afterName.displayName === RENAMED, afterName.displayName);

  // —— 4. 职责编辑 → server description 变 ──────────────────────────────
  await page.locator('.agent-role-edit').click();
  await page.locator('#agent-role-input').fill('负责构建与合并');
  await page.locator('.agent-role-save').click();
  await page.waitForTimeout(400);
  const afterRole = await getJson(agentUrl(agentId));
  check('role-persisted', afterRole.description === '负责构建与合并', afterRole.description);
  await shot(page, '02-overview-edited.png');

  // —— 5. 模型槽：清空 → server 置 null；再选回 → server 复原 ───────────
  await page.locator('.agent-model-select').click();
  await page.waitForSelector('.agent-model-menu');
  await page.locator('.agent-model-menu').waitFor({ state: 'visible' });
  await shot(page, '03-model-menu.png');
  check(
    'model-menu-has-provider-row',
    (await page.locator('.agent-model-row', { hasText: 'verify-485-gw' }).count()) === 1,
  );
  await page.locator('.agent-model-row', { hasText: '未设置模型' }).click();
  await page.waitForTimeout(400);
  const afterClear = await getJson(agentUrl(agentId));
  check(
    'model-cleared',
    afterClear.provider === null && afterClear.modelId === null,
    `${afterClear.provider}/${afterClear.modelId}`,
  );
  await page.locator('.agent-model-select').click();
  await page.locator('.agent-model-row', { hasText: 'verify-485-gw' }).click();
  await page.waitForTimeout(400);
  const afterPick = await getJson(agentUrl(agentId));
  check(
    'model-persisted',
    afterPick.provider === 'verify-485-gw' && afterPick.modelId === 'claude-sonnet-5',
    `${afterPick.provider}/${afterPick.modelId}`,
  );

  // —— 6. 权限：工具开关 → server tools[] 变 ────────────────────────────
  await page.locator('.agent-tab').nth(2).click();
  await page.waitForSelector('.agent-perms');
  const switches = page.locator('.agent-tool-switch');
  check('perm-six-switches', (await switches.count()) === 6, `${await switches.count()} 个`);
  await switches.first().click();
  await page.waitForTimeout(400);
  const afterTool = await getJson(agentUrl(agentId));
  check('tool-persisted', afterTool.tools.length === 1, JSON.stringify(afterTool.tools));
  await shot(page, '04-permissions.png');

  // —— 6b. 密钥区：一行聚合总开关 → server secrets[] = 团队全 id 集 ────────
  // 有密钥时恰好一行、一个开关（回退成 per-secret 粒度会渲染 N 行 N 开关）。
  const allSecretIds = (await getJson(secretsUrl)).map((row) => row.id);
  const secretSwitch = page.locator('.agent-secret-switch');
  check(
    'secret-row-single',
    (await page.locator('.agent-secret-row').count()) === 1,
    `${await page.locator('.agent-secret-row').count()} 行`,
  );
  check('secret-switch-single', (await secretSwitch.count()) === 1, `${await secretSwitch.count()} 个`);
  check(
    'secret-unchecked-when-empty',
    (await secretSwitch.getAttribute('aria-checked')) === 'false',
    `secrets=${JSON.stringify((await getJson(agentUrl(agentId))).secrets)}`,
  );

  await secretSwitch.click();
  await page.waitForTimeout(400); // invalidateAll 重取的落窗
  const afterSecretOn = await getJson(agentUrl(agentId));
  check(
    'secret-on-writes-full-id-set',
    afterSecretOn.secrets.length === allSecretIds.length &&
      allSecretIds.every((id) => afterSecretOn.secrets.includes(id)),
    `写回 ${JSON.stringify(afterSecretOn.secrets)}；团队全 id 集 ${JSON.stringify(allSecretIds)}`,
  );
  // 勾选态 = agent.secrets 非空：重取回来的真值仍非空 → 开关保持勾选。
  check(
    'secret-stays-checked-when-nonempty',
    (await secretSwitch.getAttribute('aria-checked')) === 'true',
    `${await secretSwitch.count()} 个开关，首个 aria-checked=${await secretSwitch.getAttribute('aria-checked')}`,
  );
  await shot(page, '05-permissions-secret-on.png');

  await secretSwitch.click();
  await page.waitForTimeout(400);
  const afterSecretOff = await getJson(agentUrl(agentId));
  check(
    'secret-off-clears',
    afterSecretOff.secrets.length === 0,
    JSON.stringify(afterSecretOff.secrets),
  );

  // —— 7. 记忆 tab：canon 空态 ──────────────────────────────────────────
  await page.locator('.agent-tab').nth(1).click();
  await page.waitForSelector('.agent-memories');
  check(
    'memory-empty-canon',
    (await page.locator('.agent-memory-empty').textContent())?.trim() ===
      '尚无记忆。Agent 会在工作中将值得沉淀的经验存入此处。',
  );

  // —— 8. 创建弹窗：有服务商 → 弹窗内选模型 → POST 落库 ─────────────────
  await page.goto(`${WEB}/app/team`);
  await page.waitForSelector('[data-route="team"]', { timeout: 15_000 });
  await page.locator('.team-create-agent').click();
  await page.waitForSelector('.dlg-agent-model-select', { timeout: 15_000 });
  check('create-dialog-model-slot', true, '有服务商时弹窗内出模型选择器');
  check('create-dialog-no-warn', (await page.locator('.dlg-agent-warn').count()) === 0);
  await page.locator('#dlg-agent-name').fill('verify-485-created');
  await page.locator('.dlg-agent-model-select').click();
  await page.waitForSelector('.dlg-agent-model-menu');
  await shot(page, '06-create-model-menu.png');
  await page.locator('.dlg-agent-model-row', { hasText: 'verify-485-gw' }).click();
  await page.locator('.dlg-agent-create').click();
  await page.waitForSelector('.dlg', { state: 'hidden', timeout: 15_000 });
  const members = await getJson(`${SERVER}/api/teams/${teamId}/members`);
  const fresh = members
    .filter((m) => m.memberType === 'agent')
    .map((m) => m.actor)
    .find((a) => a.displayName === 'verify-485-created');
  check(
    'create-with-model-persisted',
    fresh?.provider === 'verify-485-gw' && fresh?.modelId === 'claude-sonnet-5',
    `${fresh?.provider}/${fresh?.modelId}`,
  );
  await shot(page, '07-team-after-create.png');
} finally {
  await browser.close();
}

const ok = checks.every((c) => c.ok);
writeFileSync(
  join(EVIDENCE, 'result.json'),
  `${JSON.stringify(
    {
      probe: 'agent-detail',
      ok,
      at: new Date().toISOString(),
      stack: { api: SERVER, web: WEB, homeDir: join(RUN_DIR, 'home') },
      checks,
      artifacts,
      ...extra,
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(
  `\nevidence: ${EVIDENCE}\nallOk=${ok}\n${ok ? 'drive agent-detail:PASS' : 'drive agent-detail:FAIL'}\n`,
);
process.exit(ok ? 0 : 1);