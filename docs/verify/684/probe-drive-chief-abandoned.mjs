#!/usr/bin/env node
// #684 chief 失联超时兜底 — live 探针（真用户路径）：
//   总管 drawer 发消息（零机器在线）→ 等待 sweep 超时（CHIEF_ABANDONED_STEP_MS
//   = 120s + scheduler tick 15s）→ 失败 toast + 线程内失败行 + activeRun 收口。
// 断言面：
//   1. 发送后 user 行即时上屏（回合挂起面：steer 占位符）。
//   2. 超时后 `.chief-error[role=alert]` 失败行渲染，原因含「没有在线机器」。
//   3. sonner toast（`[data-sonner-toast]`）在失败行落地同刻弹出（drawer 开
//      着才会弹——SSE 订阅面）。
// 真值：API messages 行 +（外部 Bash 落）SQLite step/chief_message 行。
// 用法：node drive-chief-abandoned.mjs   （栈须已 launch；机器零注册）

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SCRIPT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPO = process.env.VERIFY_REPO_ROOT ?? SCRIPT_REPO;
const RUN_DIR = process.env.VERIFY_RUN_DIR ?? join(REPO, '.claude/verify-run');
const portsFile = join(RUN_DIR, 'ports.json');
if (!existsSync(portsFile)) {
  process.stderr.write('无栈：' + portsFile + ' 不存在。先跑 launch.mjs\n');
  process.exit(1);
}
const stack = JSON.parse(readFileSync(portsFile, 'utf8'));
const SERVER = 'http://127.0.0.1:' + (stack.serverPort ?? process.env.VERIFY_PORT ?? 8791);
const WEB = 'http://127.0.0.1:' + (stack.webPort ?? process.env.VERIFY_WEB_PORT ?? 5273);
const EVIDENCE = process.env.VERIFY_EVIDENCE_DIR ?? join(REPO, '.claude/verify-evidence', '684-after');
mkdirSync(EVIDENCE, { recursive: true });

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail: detail ?? null });
  process.stdout.write((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : '') + '\n');
}
async function shot(page, name) {
  await page.screenshot({ path: join(EVIDENCE, name) });
  process.stdout.write('shot  ' + name + '\n');
}

const SWEEP_DEADLINE_MS = 200_000; // 120s 阈值 + 15s tick + 余量

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
  await page.goto(WEB + '/app');
  await page.locator('.chief-fab').click();
  await page.locator('.chief-drawer').waitFor({ state: 'visible', timeout: 10_000 });
  const composer = page.locator('.chief-composer-input');
  await composer.waitFor({ state: 'visible', timeout: 10_000 });
  await composer.fill('帮我看看现在的任务情况');
  await shot(page, '01-drawer-typed.png');
  await composer.press('Enter');
  // 发送即 user 行上屏（POST 201 + SSE message 即时推送）。
  await page
    .locator('.chief-stream', { hasText: '帮我看看现在的任务情况' })
    .waitFor({ timeout: 10_000 });
  check('sent user row rendered', true);
  // 回合挂起面：activeRun 在位 → steer 占位符（r5 §3.6 / #624 canon）。
  await page
    .locator('.chief-composer-input[placeholder="向 Agent 补充说明，执行过程中即可送达"]')
    .waitFor({ timeout: 10_000 });
  check('turn in flight (steer placeholder)', true);
  await shot(page, '02-sent-pending.png');
  const sentAt = Date.now();

  // 等待 sweep：toast 与失败行同刻到达。toast ~4s 自灭——轮询 250ms 先抢拍
  // toast，失败行持久（失败行才是终态证据）。
  let toastSeen = false;
  let lineSeen = false;
  let toastPath = null;
  while (Date.now() - sentAt < SWEEP_DEADLINE_MS) {
    const toast = page.locator('[data-sonner-toast]');
    if (!toastSeen && (await toast.count()) > 0) {
      await shot(page, '03-toast.png');
      toastPath = join(EVIDENCE, '03-toast.png');
      toastSeen = true;
    }
    if (await page.locator('.chief-error[role="alert"]').count() > 0) {
      lineSeen = true;
      break;
    }
    await page.waitForTimeout(250);
  }
  check('failure toast appeared (drawer open, SSE message event)', toastSeen, toastPath ?? 'not seen');
  if (!lineSeen) {
    check('failure line rendered', false, 'deadline ' + SWEEP_DEADLINE_MS + 'ms reached');
    await shot(page, '99-timeout.png');
  } else {
    const reason = await page.locator('.chief-error-reason').first().textContent();
    check('failure line rendered', true);
    check(
      'failure reason names the missing machine',
      reason !== null && reason.includes('没有在线机器'),
      reason ?? 'null',
    );
    await shot(page, '04-failure-line.png');
    // 回合收口：占位符回空闲 canon（activeRun 清空，finishChiefTurn 语义）。
    await page
      .locator('.chief-composer-input[placeholder="有什么可以帮你的？"]')
      .waitFor({ timeout: 15_000 });
    check('turn closed (idle placeholder back)', true);
    await shot(page, '05-turn-closed.png');
    const elapsed = Date.now() - sentAt;
    check(
      'sweep fired within the deadline window',
      elapsed < SWEEP_DEADLINE_MS,
      Math.round(elapsed / 1000) + 's after send',
    );
  }

  // API 真值：线程行集（失败行经公开读面可复核）。
  const teams = await (await fetch(SERVER + '/api/teams')).json();
  const teamId = teams[0].id;
  const threads = await (await fetch(SERVER + `/api/teams/${teamId}/chief/threads`)).json();
  const threadId = threads[0]?.id;
  const messages = await (
    await fetch(SERVER + `/api/conversations/${threadId}/messages`)
  ).json();
  writeFileSync(
    join(EVIDENCE, 'api-messages.json'),
    JSON.stringify({ threadId, messages }, null, 2),
  );
  const errorRow = (messages.messages ?? []).find(
    (m) =>
      m.role === 'system' &&
      typeof m.content === 'string' &&
      m.content.includes('chief_turn_error'),
  );
  check('chief_turn_error row visible over the messages API', errorRow !== undefined);

  writeFileSync(join(EVIDENCE, 'result.json'), JSON.stringify({ checks }, null, 2));
  await browser.close();
  const failed = checks.filter((c) => !c.ok).length;
  process.stdout.write(`\n${checks.length - failed}/${checks.length} PASS\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(String(err?.stack ?? err) + '\n');
  process.exit(1);
});
