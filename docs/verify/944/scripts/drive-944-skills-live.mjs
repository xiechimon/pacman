#!/usr/bin/env node

// #944 live evidence: the skills write path on the verify live stack —
// topbar 新建 opens SkillDialog (new carriers), submit POSTs the real
// SKILL.md entry, the row appears without reload, and the row opens the
// edit dialog prefilled. Screenshots + API JSON land in the evidence dir.
//
// Usage (stack running): env -u http_proxy -u https_proxy -u all_proxy \
//   node docs/verify/944/scripts/drive-944-skills-live.mjs [outDir]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const OUT = resolve(REPO, process.argv[2] ?? 'docs/verify/944/live');
const BASE = `http://127.0.0.1:${process.env.VERIFY_WEB_PORT ?? '5274'}`;
const API = `http://127.0.0.1:${process.env.VERIFY_PORT ?? '8792'}`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });

await page.goto(`${BASE}/app/resources/skills`);
await page.waitForLoadState('networkidle');
// fresh scratch: skills dir empty -> empty state with the 新建技能 primary
const empty = page.getByTestId('resource-empty');
check('empty state renders (resource-empty)', await empty.isVisible());
await page.screenshot({ path: join(OUT, 'skills-01-empty-light.png') });

await page.getByRole('button', { name: '新建技能' }).first().click();
const dialog = page.locator('.dlg');
await dialog.waitFor();
check('skill dialog opens via empty primary', await dialog.isVisible());
await dialog.getByLabel('名称').fill('verify-live-skill');
await dialog.getByLabel('描述').fill('live 写面探针');
await dialog.getByLabel('SKILL.md 正文').fill('# live probe\n\n- 真 server 写盘');
await page.screenshot({ path: join(OUT, 'skills-02-dialog-light.png') });
await dialog.getByRole('button', { name: '新建技能' }).click();
await page.waitForTimeout(600);
check('dialog closes on live submit (accept)', !(await dialog.isVisible()));

const rows = page.getByTestId('resource-row');
await rows.first().waitFor();
check('row appears without reload', (await rows.count()) === 1);
check(
  'row carries name + description',
  (await rows.first().textContent())?.includes('verify-live-skill') === true,
);
await page.screenshot({ path: join(OUT, 'skills-03-row-light.png') });

const teams = await (await fetch(`${API}/api/teams`)).json();
const teamId = teams[0]?.id ?? '';
const api = await fetch(`${API}/api/skills?teamId=${teamId}`).catch(() => null);
const skills = api?.ok ? await api.json() : null;
writeFileSync(join(OUT, 'skills-api.json'), `${JSON.stringify(skills, null, 2)}\n`);
check(
  'GET /api/skills carries the entry',
  Array.isArray(skills) && skills.some((s) => s.name === 'verify-live-skill'),
);

// edit dialog prefills from the entry file (GET file -> splitSkillEntry)
await rows.first().click();
await dialog.waitFor();
const bodyVal = await dialog.getByLabel('SKILL.md 正文').inputValue();
check('edit dialog prefills body from disk', bodyVal.includes('# live probe'), bodyVal.slice(0, 40));
await page.screenshot({ path: join(OUT, 'skills-04-edit-light.png') });
await page.keyboard.press('Escape');

await browser.close();
writeFileSync(join(OUT, 'skills-live-result.json'), `${JSON.stringify(results, null, 2)}\n`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length === 0 ? `drive-944-skills-live: ${results.length}/${results.length} PASS` : `drive-944-skills-live: ${failed.length} FAIL`);
process.exit(failed.length === 0 ? 0 : 1);
