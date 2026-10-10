import { expect, type Page, test } from '@playwright/test';

// #1097：项目 Files 面目录下钻。数据面打桩承 board-dnd-live / merge-reject
// 的 stubBoot 纪律（无 ?scenario= 即 live 分支；teams / user me / projects /
// tree / file 供数，其余 GET 一律 500，应用既有 isError 耐受）。tree 桩按
// URL 的 path query 分层供数并记录请求——服务端 readTree/lsTree 的真值面由
// server vitest（project-local.test.ts「tree 路由 path 参数透传」）钉住，
// 本文件钉的是 web 半边。失败方式先列（仓测试纪律）：
//   W1 文件夹与文件不可区分 — 目录行必须有独立载体（data-tree-entry=folder）
//      且图标与文件行不同形（svg path d 不等 = 非仅颜色区分）；
//   W2 点文件夹走了文件读面（本票报告的原始 bug）— 点击后不得发任何
//      file?path=<目录> 请求，必须重发 tree?path=<目录> 并列出其内容；
//   W3 下钻后回不去 — 面包屑必须在位：根段可点回顶层，中段可点回中间层，
//      当前段有可见回显（aria-current=location）；
//   W4 裸名做键串场 — 根 README.md 与 docs/README.md 同名：选中与预览必须
//      按完整路径分流，回到根目录后根行不得顶替选中态；
//   W5 空目录未定义 — entries=[] 必须演空态文案，不是白屏也不是永久加载；
//   W6 切目录加载期闪空态 — tree 请求在途时演加载态，落定后才判空；
//   W7 文件行零回归 — 点 blob 行选中态（aria-current）与查看器内容照旧；
//   W8 tree 读失败被演成空目录 — 读失败是诚实态单列（「文件树读取失败。」），
//      空文案只留给真空目录（code-review #1097 spec 轴抓的状态机洞）。

const PROJECT_ID = 'proj-1097';
const PROJ = `/app/project/${PROJECT_ID}`;

const TEAM = { id: 'team-1', name: 'Team', createdAt: 0, plan: 'free', avatarStyle: null };
const USER = { id: 'user-1', displayName: '我', avatarUrl: null };
const PROJECT = {
  id: PROJECT_ID,
  name: 'drill-repo',
  teamId: 'team-1',
  repoKind: 'hosted',
  repoName: 'drill-repo',
  githubRepo: null,
  localPath: null,
};

interface WireEntry {
  name: string;
  path: string;
  type: 'blob' | 'tree';
  size: number | null;
}

const blob = (path: string, size = 10): WireEntry => ({
  name: path.split('/').pop() ?? path,
  path,
  type: 'blob',
  size,
});
const tree = (path: string): WireEntry => ({
  name: path.split('/').pop() ?? path,
  path,
  type: 'tree',
  size: null,
});

/** 目录 path → 该层 entries（server lsTree 同形：name 裸名、path 全路径）。 */
const DIRS: Record<string, WireEntry[]> = {
  '': [blob('README.md'), tree('docs'), tree('apps')],
  docs: [blob('docs/README.md'), blob('docs/setup.md'), tree('docs/guide')],
  'docs/guide': [blob('docs/guide/deep.md')],
  apps: [],
};

const FILE_CONTENTS: Record<string, string> = {
  'README.md': 'ROOT-README-CONTENT',
  'docs/README.md': 'DOCS-README-CONTENT',
  'docs/setup.md': 'SETUP-CONTENT',
  'docs/guide/deep.md': 'DEEP-CONTENT',
};

interface Wire {
  treeUrls: string[];
  fileUrls: string[];
}

/** 启动面打桩 + tree/file 读面。treeDelayMs > 0 时 tree 响应延迟落定
 *  （W6 加载态钉扎用）；treeStatus ≠ 200 时 tree 读面恒该状态（W8 诚实态）。 */
async function stubWorld(page: Page, treeDelayMs = 0, treeStatus = 200): Promise<Wire> {
  const wire: Wire = { treeUrls: [], fileUrls: [] };
  await page.route('**/api/**', (route, request) => {
    if (request.method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 500, json: { error: 'e2e stub: not the surface under test' } });
  });
  await page.route('**/api/teams', (route) => route.fulfill({ json: [TEAM] }));
  await page.route('**/api/user/me', (route) => route.fulfill({ json: USER }));
  await page.route('**/api/projects?*', (route) => route.fulfill({ json: [PROJECT] }));
  await page.route(`**/api/projects/${PROJECT_ID}/tree*`, async (route, request) => {
    const url = new URL(request.url());
    wire.treeUrls.push(url.search);
    const path = url.searchParams.get('path') ?? '';
    if (treeDelayMs > 0) await new Promise((r) => setTimeout(r, treeDelayMs));
    if (treeStatus !== 200) {
      return route.fulfill({ status: treeStatus, json: { error: 'e2e stub: tree read failed' } });
    }
    return route.fulfill({
      json: {
        ref: 'main',
        commit: 'a'.repeat(40),
        path,
        entries: DIRS[path] ?? [],
      },
    });
  });
  await page.route(`**/api/projects/${PROJECT_ID}/file*`, (route, request) => {
    const url = new URL(request.url());
    wire.fileUrls.push(url.search);
    const path = url.searchParams.get('path') ?? '';
    const content = FILE_CONTENTS[path];
    if (content === undefined) {
      return route.fulfill({ status: 404, json: { error: `no such file: ${path}` } });
    }
    return route.fulfill({
      json: { path, ref: 'main', commit: 'a'.repeat(40), encoding: 'utf-8', content, size: content.length },
    });
  });
  return wire;
}

const folderRow = (page: Page, name: string) =>
  page.locator(`[data-tree-entry="folder"]`).filter({ hasText: name });
const fileRow = (page: Page, name: string) =>
  page.locator(`[data-tree-entry="file"]`).filter({ hasText: name });

test('W1 顶层区分文件夹与文件：独立载体 + 图标不同形', async ({ page }) => {
  await stubWorld(page);
  await page.goto(PROJ);
  await expect(fileRow(page, 'README.md')).toBeVisible();
  const docs = folderRow(page, 'docs');
  await expect(docs).toBeVisible();
  await expect(folderRow(page, 'apps')).toBeVisible();
  // 非仅颜色区分：文件夹行的 svg 字形与文件行不同形（path d 不等）。
  const folderD = await docs.locator('svg path').first().getAttribute('d');
  const fileD = await fileRow(page, 'README.md').locator('svg path').first().getAttribute('d');
  expect(folderD).toBeTruthy();
  expect(fileD).toBeTruthy();
  expect(folderD).not.toBe(fileD);
});

test('W2 点文件夹 → 重发 tree?path= 并列出内容；不发文件读请求', async ({ page }) => {
  const wire = await stubWorld(page);
  await page.goto(PROJ);
  await folderRow(page, 'docs').click();
  await expect(fileRow(page, 'setup.md')).toBeVisible();
  await expect(folderRow(page, 'guide')).toBeVisible();
  // 顶层行退场（不是叠加渲染）
  await expect(folderRow(page, 'apps')).toHaveCount(0);
  // 下钻 = tree 二次请求带 path=docs；file 读面零请求（原始 bug 的反面钉）
  expect(wire.treeUrls.some((q) => q.includes('path=docs'))).toBe(true);
  expect(wire.fileUrls).toEqual([]);
});

test('W3 面包屑：根段回顶层，中段回中间层，当前段有回显', async ({ page }) => {
  await stubWorld(page);
  await page.goto(PROJ);
  await folderRow(page, 'docs').click();
  await expect(fileRow(page, 'setup.md')).toBeVisible();
  const nav = page.getByRole('navigation', { name: '目录导航' });
  await expect(nav).toBeVisible();
  // 当前段回显（aria-current=location 载体）
  await expect(nav.getByText('docs', { exact: true })).toHaveAttribute(
    'aria-current',
    'location',
  );
  // 再下钻一层后中段可点回
  await folderRow(page, 'guide').click();
  await expect(fileRow(page, 'deep.md')).toBeVisible();
  await nav.getByRole('button', { name: 'docs', exact: true }).click();
  await expect(fileRow(page, 'setup.md')).toBeVisible();
  // 根段回顶层
  await nav.getByRole('button', { name: '根目录' }).click();
  await expect(fileRow(page, 'README.md')).toBeVisible();
  await expect(folderRow(page, 'docs')).toBeVisible();
  // 顶层无面包屑（根态零视觉漂移）
  await expect(page.getByRole('navigation', { name: '目录导航' })).toHaveCount(0);
});

test('W4 同名文件跨目录：选中与预览按完整路径分流不串', async ({ page }) => {
  const wire = await stubWorld(page);
  await page.goto(PROJ);
  // 根 README.md 选中 → 根内容
  const rootReadme = page.getByRole('button', { name: 'README.md', exact: true });
  await rootReadme.click();
  await expect(rootReadme).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('ROOT-README-CONTENT')).toBeVisible();
  // 下钻 docs，点同名 README.md → docs 内容顶替，请求路径是全路径
  await folderRow(page, 'docs').click();
  const docsReadme = page.getByRole('button', { name: 'README.md', exact: true });
  await docsReadme.click();
  await expect(page.getByText('DOCS-README-CONTENT')).toBeVisible();
  await expect(page.getByText('ROOT-README-CONTENT')).toHaveCount(0);
  expect(wire.fileUrls.at(-1)).toContain(`path=${encodeURIComponent('docs/README.md')}`);
  // 回根：根行不得顶替选中态（选中仍是 docs/README.md），预览不串回
  await page.getByRole('navigation', { name: '目录导航' }).getByRole('button', { name: '根目录' }).click();
  await expect(rootReadme).not.toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('DOCS-README-CONTENT')).toBeVisible();
});

test('W5 空目录 → 空态文案（不是白屏/永久加载）', async ({ page }) => {
  await stubWorld(page);
  await page.goto(PROJ);
  await folderRow(page, 'apps').click();
  await expect(page.getByText('此目录为空。')).toBeVisible();
});

test('W6 切目录加载期演加载态，落定后才判空', async ({ page }) => {
  await stubWorld(page, 600);
  await page.goto(PROJ);
  // 首层落定
  await expect(fileRow(page, 'README.md')).toBeVisible();
  await folderRow(page, 'apps').click();
  // 在途 = 加载态；空态文案不得抢跑
  await expect(page.getByText('加载中…')).toBeVisible();
  await expect(page.getByText('此目录为空。')).toHaveCount(0);
  // 落定 = 空态
  await expect(page.getByText('此目录为空。')).toBeVisible({ timeout: 5_000 });
});

test('W8 tree 读失败 → 诚实态文案，不演空目录', async ({ page }) => {
  await stubWorld(page, 0, 500);
  await page.goto(PROJ);
  await expect(page.getByText('文件树读取失败。')).toBeVisible();
  await expect(page.getByText('此目录为空。')).toHaveCount(0);
});

test('W7 文件行零回归：点 blob → 选中态 + 查看器内容', async ({ page }) => {
  await stubWorld(page);
  await page.goto(PROJ);
  const row = page.getByRole('button', { name: 'README.md', exact: true });
  await row.click();
  await expect(row).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('ROOT-README-CONTENT')).toBeVisible();
  await expect(page.getByText('请选择一个文件查看')).toHaveCount(0);
});
