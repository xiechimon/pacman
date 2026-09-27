// M7 #309 标签垂直切片 live 全链（spec 08 附录 A 档 2 行 / r9 §2.5/§3.4）：
// 真 web 生产构建（server 同源静态托管）+ 真 server（内存库），Playwright
// 走真用户路径：
//   新建任务对话框 → 标签面板新建「r9probe」（POST /api/projects/{id}/tags）
//   → 选中 → 保存（createTodo body 携 tagIds）→ 看板卡落板（卡面不渲染
//   标签，spec 08 附录 A 校准行）→ 详情页 fresh meta 区标签 chip（tag.color 底）。
// 证据三面：UI 断言（chip 文本 + 背景色）、REST 真值（todo.tagIds 往返 +
// tag record 全形）、SQLite 行（tag/todo_tag join 直读）。
// 无 build/daemon 面——标签链停在 fresh 态（不点 保存并开始）。

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TagRecord } from '@pacman/shared';
import { type Browser, chromium, type Page, expect as pexpect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { tag as tagTable, todoTag as todoTagTable } from '../../apps/server/src/db/schema.js';
import { api, bootRealServer, type RealServer } from './helpers.js';

// integration/test/<file> → repo root = 三级上跳。
const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const WEB_DIST = join(ROOT, 'apps/web/dist');

let server: RealServer;
let browser: Browser;
let page: Page;
let projectId = '';

beforeAll(async () => {
  // web 生产构建（scenario-blind = 恒 live 数据源，#58 gate）。与 m5-web-e2e
  // 同款；dist 为两文件共用，CI 顺序跑不互踩（同 worktree 内 playwright 与
  // parity 的 dist 互斥纪律归 AGENTS.md，此处均为 vite 默认 mode）。
  const build = spawnSync('pnpm', ['--filter', '@pacman/web', 'exec', 'vite', 'build'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (build.status !== 0) {
    throw new Error(`web build failed:\n${build.stdout}\n${build.stderr}`);
  }
  if (!existsSync(join(WEB_DIST, 'index.html'))) {
    throw new Error(`web dist missing at ${WEB_DIST}`);
  }
  server = await bootRealServer({
    // 标签链无 LLM 面：provider 行指向不监听的地址即可（不产调用）。
    providerBaseUrl: 'http://127.0.0.1:1',
    webDir: WEB_DIST,
  });
  const project = await api(server.url, 'POST', '/api/projects', {
    name: 'tags-it',
    teamId: server.teamId,
  });
  projectId = (project.body as { id: string }).id;
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1440, height: 732 } });
}, 180_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe('M7 #309 标签垂直切片（live UI → wire → SQLite）', () => {
  test('对话框建标签 + 选中 + 保存 → createTodo 携 tagIds → 详情 fresh meta 区 chip', async () => {
    await page.goto(`${server.url}/app`);
    await pexpect(page.locator('.board-new-task')).toBeVisible({ timeout: 30_000 });

    // —— 新建任务对话框 → 标签面板 → 新建「r9probe」（live 面 POST tags，
    // 建后自动选中 r9 94→95）——
    await page.locator('.board-new-task').click();
    await pexpect(page.locator('.new-task-dialog')).toBeVisible();
    await page.locator('.new-task-tag-add').click();
    const panel = page.locator('.new-task-tag-panel');
    await pexpect(panel).toBeVisible();
    await panel.locator('.new-task-tag-new').click();
    await panel.locator('.new-task-tag-input').fill('r9probe');
    await panel.locator('.new-task-tag-save').click();
    await pexpect(panel.locator('.new-task-tag-pill')).toHaveCount(1, { timeout: 15_000 });
    await pexpect(panel.locator('.new-task-tag-pill')).toHaveAttribute('data-on', 'true');
    await panel.locator('.dlg-close').click();
    // footer 选中 chip（r9 96：chip + 虚线圆添加钮）。
    await pexpect(page.locator('.new-task-tag-chip')).toHaveText('r9probe');

    // —— 保存（保存钮 = 创建不开始，fresh 态停留）→ 卡落板 ——
    await page.locator('.new-task-input').fill('M7 标签探针');
    await page.locator('.new-task-save').click();
    await pexpect(page.locator('.todo-card-title', { hasText: 'M7 标签探针' })).toBeVisible({
      timeout: 30_000,
    });

    // —— REST 真值：tag record 全形 + todo.tagIds 往返（join 真值）——
    // record 全形断言：cast 单源 = shared tagRecordSchema 的静态侧（r9 §3.4）。
    const tags = (await api(server.url, 'GET', `/api/projects/${projectId}/tags`))
      .body as TagRecord[];
    expect(tags).toHaveLength(1);
    const created = tags[0]!;
    expect(created.name).toBe('r9probe');
    expect(created.color).toBe('#6366f1'); // TAG_DEFAULT_COLOR（r9 §3.4 客户端缺省）
    expect(created.projectId).toBe(projectId);
    expect(created.v).toBe(1);
    expect(created.createdAt).toBeGreaterThan(0);

    const todos = (await api(server.url, 'GET', '/api/todos')).body as {
      id: string;
      title: string;
      tagIds: string[];
    }[];
    const probe = todos.find((t) => t.title === 'M7 标签探针');
    expect(probe).toBeTruthy();
    expect(probe!.tagIds).toEqual([created.id]);

    // —— SQLite 行直读：tag 行 + todo_tag join 行（存储面证据）——
    const tagRow = server.db.select().from(tagTable).where(eq(tagTable.id, created.id)).get();
    expect(tagRow?.name).toBe('r9probe');
    expect(tagRow?.color).toBe('#6366f1');
    const joinRows = server.db
      .select()
      .from(todoTagTable)
      .where(eq(todoTagTable.todoId, probe!.id))
      .all();
    expect(joinRows).toHaveLength(1);
    expect(joinRows[0]!.tagId).toBe(created.id);

    // —— 详情页 fresh meta 区：标签 chip 渲染 + tag.color 底（r9 100）——
    await page.locator('.todo-card', { hasText: 'M7 标签探针' }).locator('.todo-card-link').click();
    await pexpect(page.locator('.detail-shell')).toBeVisible({ timeout: 15_000 });
    const chip = page.locator('.fresh-tag-chip');
    await pexpect(chip).toHaveCount(1, { timeout: 15_000 });
    await pexpect(chip).toHaveText('r9probe');
    await pexpect(chip).toHaveCSS('background-color', 'rgb(99, 102, 241)'); // #6366f1

    // —— spec 08 附录 A 校准：看板卡不渲染标签（回板面卡内无 chip 元素）——
    await page.locator('.detail-back').click();
    await pexpect(page.locator('.todo-card', { hasText: 'M7 标签探针' })).toBeVisible({
      timeout: 15_000,
    });
    await pexpect(
      page.locator('.todo-card', { hasText: 'M7 标签探针' }).locator('.fresh-tag-chip'),
    ).toHaveCount(0);
  }, 180_000);
});
