// M5 端到端主时序全链实跑（#83 票面 / 01 §7.4 脊柱 / 04 §4 M5 行）：
// 真 web 生产构建（server 同源静态托管，02/A1）+ 真 server + 真 daemon
// （pi 缝）+ stub LLM，Playwright 驱动 UI 走完整生命周期：
//   ① 主时序：新建（保存并开始）→ 规划（live transcript）→ 确认 → 执行 →
//      审核 → 验收合并（202 delegated）→ done（🎉 时间线 + main 落地真值）。
//   ② 驳回支线：confirm 关口 composer 发送 feedback → 规划中 → plan v2 →
//      版本 chip v2 → 确认 → 执行 → 审核（r5 §4 回路 UI 实走）。
//   ③ 定时轮停 review：UI 建 once 定时 → scheduler.tick 触发 → 直执行新
//      build → 停审核关口 + 「由定时发起」时间线标记（r3 §9/02 §9.2）。
// SSE 断言：build 会话流并行采集 text_delta/message/step 三类事件（02 §1.2
// 会话流真接线）；UI 全程零 reload——状态推进全部由 SSE→invalidate 驱动。

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, chromium, type Page, expect as pexpect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { loadDaemonConfig } from '../../apps/daemon/src/config.js';
import { createDaemonLogger } from '../../apps/daemon/src/log.js';
import { type MachineHandle, runMachine } from '../../apps/daemon/src/machine-loop.js';
import { type StatePaths, statePaths } from '../../apps/daemon/src/state.js';
import { plan as planTable } from '../../apps/server/src/db/schema.js';
import { api, bootRealServer, type RealServer, waitFor } from './helpers.js';
import { type StubLlm, startStubLlm } from './stub-llm.js';

// integration/test/<file> → repo root = 三级上跳（resolve 对文件路径先剥
// 文件名段）。
const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const WEB_DIST = join(ROOT, 'apps/web/dist');

const PLAN_MD = (marker: string) =>
  [
    '# 方案',
    '',
    `Context: ${marker} 探针任务。`,
    'Changes: 在 README.md 追加一行探针。',
    'Edge cases: 无。',
    'Verification: 读回确认。',
  ].join('\n');

let stub: StubLlm;
let server: RealServer;
let handle: MachineHandle;
let paths: StatePaths;
let home: string;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  // web 生产构建（scenario-blind = 恒 live 数据源，#58 gate）。
  const build = spawnSync('pnpm', ['--filter', '@pacman/web', 'exec', 'vite', 'build'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (build.status !== 0) {
    throw new Error(`web build failed:\n${build.stdout}\n${build.stderr}`);
  }
  if (!existsSync(join(WEB_DIST, 'index.html'))) {
    throw new Error(`web dist missing at ${WEB_DIST} (static hosting would 404)`);
  }
  stub = await startStubLlm([
    // —— ① 主时序：plan（toolCall+text）→ build（toolCall+text）→ merge（text）
    {
      toolCall: {
        name: 'bash',
        arguments: { command: `cat > plan.md <<'EOF'\n${PLAN_MD('spine')}\nEOF` },
      },
    },
    { content: '方案已就绪：Context / Changes / Edge cases / Verification 四段完整。' },
    {
      toolCall: { name: 'bash', arguments: { command: 'printf "m5 spine probe\\n" >> README.md' } },
    },
    { content: '修改已完成并验证通过：README.md 末行为 m5 spine probe。' },
    { content: '合并已确认：分支改动已并入默认分支。' },
    // —— ② 驳回支线：plan → 重规划 v2（内容带 feedback 标记）→ build
    {
      toolCall: {
        name: 'bash',
        arguments: { command: `cat > plan.md <<'EOF'\n${PLAN_MD('reject-v1')}\nEOF` },
      },
    },
    { content: '方案 v1 已就绪。' },
    {
      toolCall: {
        name: 'bash',
        arguments: {
          command: `cat > plan.md <<'EOF'\n${PLAN_MD('标题去掉项目名后缀-adjusted')}\nEOF`,
        },
      },
    },
    { content: '已按驳回反馈调整方案：标题去掉项目名后缀。' },
    {
      toolCall: {
        name: 'bash',
        arguments: { command: 'printf "m5 reject probe\\n" >> README.md' },
      },
    },
    { content: '驳回轮修改已完成。' },
    // —— ③ 定时轮：直执行（无规划步）
    {
      toolCall: {
        name: 'bash',
        arguments: { command: 'printf "m5 schedule probe\\n" >> README.md' },
      },
    },
    { content: '定时轮修改已完成，等待审核。' },
  ]);
  server = await bootRealServer({
    providerBaseUrl: stub.url,
    claimHoldMs: 1_000,
    agentDescription: '你是集成测试执行 Agent：按任务要求用 bash 工具完成文件改动，然后简短汇报。',
    webDir: WEB_DIST,
    scheduler: true,
  });
  home = mkdtempSync(join(tmpdir(), 'pacman-m5web-home-'));
  const config = loadDaemonConfig(
    { serverUrl: server.url, apiKey: server.apiKey, teamId: server.teamId, home, name: 'm5-web' },
    {},
  );
  paths = statePaths(config.home, config.workspacesDir);
  const logger = createDaemonLogger({ logFile: paths.daemonLog });
  handle = await runMachine({
    config,
    paths,
    logger,
    idleSleepPrevention: false,
    proxyEnv: {},
    claimBackoffBaseMs: 50,
    heartbeatIntervalMs: 500,
  });
  await waitFor(() => {
    try {
      return readFileSync(paths.daemonLog, 'utf8').includes('[wake] push channel connected');
    } catch {
      return false;
    }
  }, 30_000);
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
}, 300_000);

afterAll(async () => {
  await browser?.close();
  await handle?.stop();
  await handle?.done;
  await server?.close();
  await stub?.close();
  if (home) rmSync(home, { recursive: true, force: true });
});

/** 会话流事件采集器（node 侧 fetch reader——与 web EventSource 同通道同
 * 载荷）：返回已见事件 type 集与 stop 句柄。 */
function collectConvStream(buildId: string): { types: Set<string>; stop(): void } {
  const types = new Set<string>();
  const ctrl = new AbortController();
  void (async () => {
    const res = await fetch(`${server.url}/api/conversations/${buildId}/stream`, {
      signal: ctrl.signal,
    });
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buf += decoder.decode(value, { stream: true });
      let idx = buf.indexOf('\n\n');
      while (idx >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data:')) continue;
          try {
            types.add((JSON.parse(line.slice(5).trim()) as { type: string }).type);
          } catch {
            // 半帧防御
          }
        }
        idx = buf.indexOf('\n\n');
      }
    }
  })().catch(() => {});
  return { types, stop: () => ctrl.abort() };
}

async function openBoard(): Promise<void> {
  await page.goto(`${server.url}/app`);
  await pexpect(page.locator('.board-new-task')).toBeVisible({ timeout: 30_000 });
}

async function createAndStart(title: string): Promise<void> {
  await page.locator('.board-new-task').click();
  await pexpect(page.locator('.new-task-input')).toBeVisible();
  await page.locator('.new-task-input').fill(title);
  await page.locator('.new-task-start').click();
  // 卡落板（SSE/invalidate 驱动，无 reload）。
  await pexpect(page.locator('.todo-card-title', { hasText: title })).toBeVisible({
    timeout: 30_000,
  });
}

async function openDetail(title: string): Promise<void> {
  await page.locator('.todo-card', { hasText: title }).locator('.todo-card-link').click();
  await pexpect(page.locator('.detail-shell')).toBeVisible({ timeout: 15_000 });
}

async function waitChip(re: RegExp, timeoutMs = 150_000): Promise<void> {
  await pexpect(page.locator('.detail-chip')).toHaveText(re, { timeout: timeoutMs });
}

describe('M5 web E2E：主时序全链（01 §7.4 脊柱，UI 零 reload）', () => {
  let buildId = '';
  let stream: { types: Set<string>; stop(): void };

  test('新建（保存并开始）→ 规划 → 确认 → 执行 → 审核 → 合并 → done', async () => {
    await openBoard();
    await createAndStart('M5 脊柱探针');

    // server 真值：todo 落库 + build 启动（withPlan）。
    const todos = (await api(server.url, 'GET', '/api/todos')).body as {
      id: string;
      title: string;
      latestBuildId: string | null;
    }[];
    const spine = todos.find((t) => t.title === 'M5 脊柱探针');
    expect(spine).toBeTruthy();
    buildId = spine!.latestBuildId!;
    expect(buildId).toBeTruthy();

    // 会话流采集挂在 build 会话上（SSE 真接线断言面）。
    stream = collectConvStream(buildId);

    await openDetail('M5 脊柱探针');
    // 规划轮：live 面到 confirm 关口（plan.md v1 落库由 daemon 真执行）。
    await waitChip(/确认/);
    // plan 卡进时间线（方案 · v1）+ 文档 pane 版本 chip v1。
    await pexpect(page.locator('.chat-plan-title').last()).toHaveText('方案 · v1');
    await pexpect(page.locator('.doc-pane-select').nth(1)).toHaveText(/v1/);

    // 确认 → 执行轮（continue session + bash 真改动）→ 审核关口。
    await page.locator('.detail-head-action').click();
    await waitChip(/审核/);

    // 执行轮的会话流三事件族齐证（text_delta = daemon 节流转发真到达）。
    expect(
      stream.types.has('text_delta'),
      `conv stream types: ${[...stream.types].join(',')}`,
    ).toBe(true);
    expect(stream.types.has('message')).toBe(true);
    expect(stream.types.has('step')).toBe(true);
    stream.stop();

    // 审核 → 验收弹层 → 完成（merge 202 delegated → 合并步 → done）。
    await page.locator('.detail-head-action').click();
    await pexpect(page.locator('.dlg-accept-done')).toBeVisible();
    await page.locator('.dlg-accept-done').click();
    await waitChip(/已完成/);

    // 时间线 canon：发起了合并 + 🎉（server 落库行经 SSE→invalidate 上屏）。
    await pexpect(page.locator('.chat-note', { hasText: '发起了合并' })).toBeVisible();
    await pexpect(page.locator('.chat-note', { hasText: '🎉 任务已完成' })).toBeVisible({
      timeout: 30_000,
    });

    // server 真值：main 落地探针行（合并步 fast-forward，r3 §3.6 同款验证）。
    const projects = (await api(server.url, 'GET', '/api/projects')).body as {
      id: string;
      name: string;
    }[];
    const projectId = projects[0]!.id;
    await waitFor(async () => {
      const f = await api(
        server.url,
        'GET',
        `/api/projects/${projectId}/file?path=README.md&ref=main`,
      );
      return f.status === 200 && (f.body as { content: string }).content.includes('m5 spine probe');
    }, 30_000);
    expect(server.todoPhase(spine!.id)).toBe('done');
  }, 300_000);

  test('驳回支线：confirm 关口请求修改 → 规划中 → plan v2 → 确认 → 审核（r5 §4）', async () => {
    await openBoard();
    await createAndStart('M5 驳回探针');
    const todos = (await api(server.url, 'GET', '/api/todos')).body as {
      id: string;
      title: string;
      latestBuildId: string | null;
    }[];
    const target = todos.find((t) => t.title === 'M5 驳回探针');
    const rejectBuildId = target!.latestBuildId!;

    await openDetail('M5 驳回探针');
    await waitChip(/确认/);

    // composer 发送驳回反馈 = POST steps {action:"revision"}（真端点）。
    await page.locator('.composer-input').fill('标题去掉项目名后缀');
    await page.locator('.composer-send').dispatchEvent('click');
    await waitChip(/规划中/);

    // v2 落回 confirm 关口：plan 卡 v2 + 版本 chip v2 + 用户驳回气泡。
    await waitChip(/确认/);
    await pexpect(page.locator('.chat-plan-title').last()).toHaveText('方案 · v2');
    await pexpect(page.locator('.doc-pane-select').nth(1)).toHaveText(/v2/);
    await pexpect(page.locator('.chat-bubble', { hasText: '标题去掉项目名后缀' })).toBeVisible();

    // server 真值：plan 两版，v2 内容忠实执行反馈（r5 §4 口径）。
    const plans = server.db
      .select()
      .from(planTable)
      .where(eq(planTable.buildId, rejectBuildId))
      .all();
    expect(plans).toHaveLength(2);
    expect(plans[1]!.version).toBe(2);
    expect(plans[1]!.content).toContain('标题去掉项目名后缀-adjusted');

    // 版本对比面：下拉 → 与其他版本对比 → 上一版本 = v1 → v2 unified diff。
    // 行集 = v2 + v1 + 对比入口行（reject-chain spec 同款计数口径）。
    await page.locator('.doc-range-wrap .doc-pane-select').click();
    await pexpect(page.locator('.version-menu-row')).toHaveCount(3, { timeout: 10_000 });
    await pexpect(page.locator('.version-menu-row').first()).toHaveText(/v2/);
    await page.getByRole('button', { name: '与其他版本对比…' }).click();
    await page.getByRole('button', { name: '上一版本' }).click();
    await pexpect(page.locator('.doc-range-chip')).toHaveText(/v1 → v2/);
    await pexpect(page.locator('.doc-file-row')).toHaveText(/plan\.md/);

    // 确认 → 执行 → 审核（支线终点：停审核关口，不合并）。
    await page.locator('.detail-head-action').click();
    await waitChip(/审核/);
    expect(server.todoPhase(target!.id)).toBe('review');
  }, 300_000);

  test('定时轮停 review：UI 建 once 定时 → tick 触发 → 直执行 → 停审核 + 由定时发起（r3 §9）', async () => {
    // UI 建定时：schedules 页 → 新建 → 单次 tab → 下一刻钟档（02 §9.2 分档
    // 00/15/30/45）→ 保存。
    await page.goto(`${server.url}/app/schedules`);
    await page.locator('.page-new-action').click();
    await pexpect(page.locator('.sched-form')).toBeVisible();
    await page.locator('.sched-form-freq-tab', { hasText: '单次' }).click();
    const next = new Date(Date.now() + 60_000);
    let minute = Math.ceil(next.getMinutes() / 15) * 15;
    let hour = next.getHours();
    if (minute === 60) {
      minute = 0;
      hour = (hour + 1) % 24;
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    await page.locator('select[aria-label="时"]').selectOption(pad(hour));
    await page.locator('select[aria-label="分"]').selectOption(pad(minute));
    await page.locator('.sched-form-save').click();
    // 卡落列表（invalidate 重取）。
    await pexpect(page.locator('.sched-card')).toBeVisible({ timeout: 15_000 });
    const schedules = (await api(server.url, 'GET', '/api/schedules')).body as {
      id: string;
      kind: string;
      nextRunAt: number | null;
    }[];
    expect(schedules).toHaveLength(1);
    expect(schedules[0]!.kind).toBe('once');

    // 触发前的 build 位（= 主时序已合并轮）——触发后必须换新 build（r3 §9
    // 全新重跑语义）。
    const todosBefore = (await api(server.url, 'GET', '/api/todos')).body as {
      id: string;
      title: string;
      latestBuildId: string | null;
    }[];
    const spineBefore = todosBefore.find((t) => t.title === 'M5 脊柱探针');

    // 触发：手动 tick 越过 nextRunAt（scheduler 确定性驱动，同 schedules
    // 单测口径）。once 触发后自动出队（r3 §9）。
    server.scheduler!.tick((schedules[0]!.nextRunAt ?? Date.now()) + 60_000);

    // 直执行轮（withPlan:false + triggerSource schedule）→ 停 review 关口。
    const spine = spineBefore;
    await waitFor(() => server.todoPhase(spine!.id) === 'review', 150_000);
    const after = (await api(server.url, 'GET', `/api/todos/${spine!.id}`)).body as {
      latestBuildId: string | null;
    };
    expect(after.latestBuildId).not.toBe(spineBefore!.latestBuildId); // 新 build 全新重跑
    const schedBuild = (await api(server.url, 'GET', `/api/builds/${after.latestBuildId}`))
      .body as { triggerSource: string; withPlan: boolean };
    expect(schedBuild.triggerSource).toBe('schedule');
    expect(schedBuild.withPlan).toBe(false);
    // once 出队。
    expect((await api(server.url, 'GET', '/api/schedules')).body as unknown[]).toHaveLength(0);

    // UI 面：看板卡回 待验收 列 + 详情时间线「由定时发起」标记（r7 38）。
    await openBoard();
    const reviewCol = page
      .locator('.board-column')
      .filter({ has: page.locator('.board-column-name', { hasText: '待验收' }) });
    await pexpect(reviewCol.locator('.todo-card', { hasText: 'M5 脊柱探针' })).toBeVisible({
      timeout: 15_000,
    });
    await openDetail('M5 脊柱探针');
    await pexpect(page.locator('.chat-scheduled')).toBeVisible({ timeout: 15_000 });
    await waitChip(/审核/);
  }, 300_000);
});
