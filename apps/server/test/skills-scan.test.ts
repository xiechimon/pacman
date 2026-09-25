// POST /api/skills/scan——GitHub 扫描发现半（#223，#201 路线 A）。mock fetch 层
// （录制 repo 树/文件样本，样本裁剪至消费字段），全失败方式走真 HTTP 面。
//
// 失败方式清单（先列后写，TDD 红绿面）：
// A 输入层：A1 repo 缺失/空串 → 400；A2 非 GitHub 形（gitlab URL / 单段 / 三段
//   / SSH 形）→ 400；A3 未知 teamId → 404；A4 fetch 模式 path 逃逸（.. / \ /
//   绝对路径）→ 400。
// B 上游层：B1 repo info 404（私仓无 auth 与不存在同形）→ 404；B2 限流两形
//   （403 + remaining:0 主限额 / 403 + retry-after 二级限额）→ 429；B3 GitHub
//   5xx → 502；B4 网络断（fetch reject TypeError）→ 502；B5 超时（TimeoutError）
//   → 502 且 message 点名；B6 空 repo（trees 409）→ 502 点名 empty；B7
//   tree.truncated=true → 200 + truncated:true 部分结果照返；B8 上游非 JSON
//   → 502。
// C 发现层：C1 树中无 SKILL.md → 200 candidates:[]（空发现合法）；C2 多目录
//   各含 SKILL.md → 每目录一候选；C3 仓根 SKILL.md → path:''；C4 无
//   frontmatter → name 回落目录名、description:null；C5 frontmatter
//   name/description 采用（含引号包裹）；C6 tree 列出但 raw 404（race）→
//   跳过该候选其余照返；C7 小写 skill.md 不算（canon = SKILL.md 单源）；
//   C8 折叠块标量（description: > 族）不受理 → 按缺省回落。
// D fetch 模式（body.path 给定）：D1 目录无 SKILL.md → 404；D2 files 键相对
//   技能目录、SKILL.md 必含，响应过 shared schema；D3 单文件 >512KB（tree
//   size 先知，不发 raw）→ 400；D4 文件数 >64 → 400。
// E 语义链：scan → fetch → 文件集直接喂 POST /api/skills → 201（#195
//   resolution「发现结果喂既有文件集导入半」验收面）。

import {
  fetchSkillFilesResponseSchema,
  scanSkillsResponseSchema,
  skillRecordSchema,
} from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import type { FetchLike } from '../src/lib/github.js';
import { bootServer, req } from './helpers.js';

// —— 录制样本（形状 = GitHub REST/Trees/raw 真响应，裁剪至消费字段）——
const REPO = 'octo/skills';
const REPO_INFO_URL = `https://api.github.com/repos/${REPO}`;
const TREE_URL = `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`;
const RAW = `https://raw.githubusercontent.com/${REPO}/main`;

const ALPHA_SKILL_MD = `---
name: alpha-skill
description: "Alpha does things."
---
# Alpha
Do alpha things.
`;
const BETA_SKILL_MD = `---
name: beta-skill
description: Beta does other things.
---
# Beta
`;
/** 无 frontmatter 变体（C4 回落面）。 */
const NO_FRONTMATTER_SKILL_MD = `# Just a title\nSome prose, no yaml block.\n`;

interface MockReply {
  status?: number;
  headers?: Record<string, string>;
  json?: unknown;
  text?: string;
}

/** mock fetch：按 URL 前缀录制表回放（最长前缀优先——具体 path 压兜底段）；
 * 未录制路径 → 500（测试布线 bug 显形）。calls 留调用序（断言 REST 次数/顺序
 * 用——rate limit 纪律证据）。 */
function stubFetch(table: Record<string, MockReply>) {
  const calls: string[] = [];
  const entries = Object.entries(table).sort((a, b) => b[0].length - a[0].length);
  const fetchImpl: FetchLike = (input, _init) => {
    const url = String(input);
    calls.push(url);
    for (const [prefix, reply] of entries) {
      if (url.startsWith(prefix)) {
        const init: ResponseInit = { status: reply.status ?? 200, headers: reply.headers };
        return Promise.resolve(
          reply.json !== undefined
            ? new Response(JSON.stringify(reply.json), init)
            : new Response(reply.text ?? '', init),
        );
      }
    }
    return Promise.resolve(new Response('unrecorded fetch in test', { status: 500 }));
  };
  return { fetchImpl, calls };
}

function okTable(
  paths: Array<{ path: string; size?: number }>,
  raws: Record<string, MockReply>,
): Record<string, MockReply> {
  return {
    [REPO_INFO_URL]: { json: { default_branch: 'main' } },
    [TREE_URL]: { json: { sha: 't1', tree: treeWith(...paths), truncated: false } },
    [RAW]: { text: '' /* 兜底；具体 path 由调用方覆盖前缀 */ },
    ...raws,
  };
}

function treeWith(...paths: Array<{ path: string; size?: number }>) {
  return paths.map((p) => ({ path: p.path, type: 'blob', size: p.size ?? 42 }));
}

async function expectErrorShape(res: Response, status: number): Promise<string> {
  expect(res.status).toBe(status);
  const body = (await res.json()) as Record<string, unknown>;
  expect(Object.keys(body)).toEqual(['error']);
  expect(typeof body.error).toBe('string');
  return body.error as string;
}

describe('POST /api/skills/scan——输入层（A）', () => {
  test('A1/A2：repo 缺失、非 GitHub 形 → 400', async () => {
    const { fetchImpl } = stubFetch({});
    const s = bootServer({ githubFetch: fetchImpl });
    await expectErrorShape(await req(s.app, 'POST', '/api/skills/scan', {}), 400);
    await expectErrorShape(await req(s.app, 'POST', '/api/skills/scan', { repo: '' }), 400);
    for (const bad of [
      'foo', // 单段
      'a/b/c', // 三段
      'https://gitlab.com/a/b', // 非 GitHub host
      'git@github.com:a/b.git', // SSH 形（首版不受理）
    ]) {
      await expectErrorShape(await req(s.app, 'POST', '/api/skills/scan', { repo: bad }), 400);
    }
  });

  test('A3：未知 teamId → 404', async () => {
    const { fetchImpl } = stubFetch({});
    const s = bootServer({ githubFetch: fetchImpl });
    await expectErrorShape(
      await req(s.app, 'POST', '/api/skills/scan', { teamId: 'nope', repo: REPO }),
      404,
    );
  });

  test('A4：fetch 模式 path 逃逸 → 400', async () => {
    const { fetchImpl } = stubFetch({});
    const s = bootServer({ githubFetch: fetchImpl });
    for (const bad of ['../..', 'a/../b', '/abs', 'back\\slash']) {
      await expectErrorShape(
        await req(s.app, 'POST', '/api/skills/scan', { repo: REPO, path: bad }),
        400,
      );
    }
  });
});

describe('POST /api/skills/scan——发现面（C）与上游错误（B）', () => {
  test('C2/C5：多目录候选发现；frontmatter name/description 采用；REST 恰好 2 次', async () => {
    const { fetchImpl, calls } = stubFetch(
      okTable(
        [
          { path: 'README.md' },
          { path: 'skills/alpha/SKILL.md' },
          { path: 'skills/alpha/references/x.md' },
          { path: 'skills/beta/SKILL.md' },
        ],
        {
          [`${RAW}/skills/alpha/SKILL.md`]: { text: ALPHA_SKILL_MD },
          [`${RAW}/skills/beta/SKILL.md`]: { text: BETA_SKILL_MD },
        },
      ),
    );
    const s = bootServer({ githubFetch: fetchImpl });
    const res = await req(s.app, 'POST', '/api/skills/scan', {
      repo: `https://github.com/${REPO}`,
    });
    expect(res.status).toBe(200);
    const body = scanSkillsResponseSchema.parse(await res.json());
    expect(body.repo).toBe(REPO); // URL 输入归一 owner/repo
    expect(body.defaultBranch).toBe('main');
    expect(body.truncated).toBe(false);
    expect(body.candidates).toEqual([
      { path: 'skills/alpha', name: 'alpha-skill', description: 'Alpha does things.' },
      { path: 'skills/beta', name: 'beta-skill', description: 'Beta does other things.' },
    ]);
    // rate limit 纪律：REST = repo info + tree 恰 2 次；SKILL.md 走 raw CDN
    expect(calls.filter((u) => u.startsWith('https://api.github.com/'))).toEqual([
      REPO_INFO_URL,
      TREE_URL,
    ]);
    expect(calls.filter((u) => u.startsWith(RAW))).toHaveLength(2);
  });

  test('C3/C4：仓根技能 path:""；无 frontmatter → name 回落目录名、description null', async () => {
    const { fetchImpl } = stubFetch(
      okTable([{ path: 'SKILL.md' }, { path: 'skills/plain/SKILL.md' }], {
        [`${RAW}/SKILL.md`]: { text: NO_FRONTMATTER_SKILL_MD },
        [`${RAW}/skills/plain/SKILL.md`]: { text: NO_FRONTMATTER_SKILL_MD },
      }),
    );
    const s = bootServer({ githubFetch: fetchImpl });
    const res = await req(s.app, 'POST', '/api/skills/scan', { repo: REPO });
    const body = scanSkillsResponseSchema.parse(await res.json());
    expect(body.candidates).toEqual([
      { path: '', name: 'skills', description: null }, // 仓根 → 回落 repo 名
      { path: 'skills/plain', name: 'plain', description: null },
    ]);
  });

  // C8 样本 = 真打 anthropics/skills academy-guide 实测折叠形。
  test('C8：折叠块标量标记（description: >）不受理 → 回落 null', async () => {
    const folded = `---\nname: academy-guide\ndescription: >\n  A folded multi-line\n  description here.\n---\n# X\n`;
    const { fetchImpl } = stubFetch(
      okTable([{ path: 'skills/folded/SKILL.md' }], {
        [`${RAW}/skills/folded/SKILL.md`]: { text: folded },
      }),
    );
    const s = bootServer({ githubFetch: fetchImpl });
    const res = await req(s.app, 'POST', '/api/skills/scan', { repo: REPO });
    const body = scanSkillsResponseSchema.parse(await res.json());
    expect(body.candidates).toEqual([
      { path: 'skills/folded', name: 'academy-guide', description: null },
    ]);
  });

  test('C1/C7：无 SKILL.md → candidates:[]；小写 skill.md 不认', async () => {
    const { fetchImpl } = stubFetch(
      okTable([{ path: 'README.md' }, { path: 'docs/skill.md' }], {}),
    );
    const s = bootServer({ githubFetch: fetchImpl });
    const res = await req(s.app, 'POST', '/api/skills/scan', { repo: REPO });
    const body = scanSkillsResponseSchema.parse(await res.json());
    expect(body.candidates).toEqual([]);
    expect(body.truncated).toBe(false);
  });

  test('C6：raw 404（tree 列出后 race 消失）→ 跳过该候选', async () => {
    const { fetchImpl } = stubFetch(
      okTable([{ path: 'skills/alpha/SKILL.md' }, { path: 'skills/gone/SKILL.md' }], {
        [`${RAW}/skills/alpha/SKILL.md`]: { text: ALPHA_SKILL_MD },
        [`${RAW}/skills/gone/SKILL.md`]: { status: 404, text: '404: Not Found' },
      }),
    );
    const s = bootServer({ githubFetch: fetchImpl });
    const res = await req(s.app, 'POST', '/api/skills/scan', { repo: REPO });
    const body = scanSkillsResponseSchema.parse(await res.json());
    expect(body.candidates).toEqual([
      { path: 'skills/alpha', name: 'alpha-skill', description: 'Alpha does things.' },
    ]);
  });

  test('B7：tree.truncated=true → 部分结果 + truncated:true', async () => {
    const { fetchImpl, calls } = stubFetch({
      [REPO_INFO_URL]: { json: { default_branch: 'main' } },
      [TREE_URL]: {
        json: { sha: 't1', tree: treeWith({ path: 'skills/alpha/SKILL.md' }), truncated: true },
      },
      [`${RAW}/skills/alpha/SKILL.md`]: { text: ALPHA_SKILL_MD },
    });
    const s = bootServer({ githubFetch: fetchImpl });
    const res = await req(s.app, 'POST', '/api/skills/scan', { repo: REPO });
    expect(res.status).toBe(200);
    const body = scanSkillsResponseSchema.parse(await res.json());
    expect(body.truncated).toBe(true);
    expect(body.candidates).toHaveLength(1);
    expect(calls).toContain(TREE_URL);
  });

  test('B1：repo 404（私仓/不存在同形）→ 404', async () => {
    const { fetchImpl } = stubFetch({
      [REPO_INFO_URL]: { status: 404, json: { message: 'Not Found' } },
    });
    const s = bootServer({ githubFetch: fetchImpl });
    await expectErrorShape(await req(s.app, 'POST', '/api/skills/scan', { repo: REPO }), 404);
  });

  test('B2：限流 403 + remaining:0 → 429；二级限流 403 + retry-after → 429', async () => {
    const { fetchImpl } = stubFetch({
      [REPO_INFO_URL]: {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1999999999' },
        json: { message: 'API rate limit exceeded' },
      },
    });
    const s = bootServer({ githubFetch: fetchImpl });
    const msg = await expectErrorShape(
      await req(s.app, 'POST', '/api/skills/scan', { repo: REPO }),
      429,
    );
    expect(msg).toContain('rate limit');
    // 二级限流：无 remaining 头、带 retry-after（GitHub abuse 限流形）。
    const s2 = bootServer({
      githubFetch: stubFetch({
        [REPO_INFO_URL]: {
          status: 403,
          headers: { 'retry-after': '60' },
          json: { message: 'You have exceeded a secondary rate limit' },
        },
      }).fetchImpl,
    });
    await expectErrorShape(await req(s2.app, 'POST', '/api/skills/scan', { repo: REPO }), 429);
  });

  test('B3/B8：上游 500 / 非 JSON → 502', async () => {
    const s5xx = bootServer({
      githubFetch: stubFetch({ [REPO_INFO_URL]: { status: 500, text: 'boom' } }).fetchImpl,
    });
    await expectErrorShape(await req(s5xx.app, 'POST', '/api/skills/scan', { repo: REPO }), 502);
    const sBadJson = bootServer({
      githubFetch: stubFetch({ [REPO_INFO_URL]: { text: '<html>not json</html>' } }).fetchImpl,
    });
    await expectErrorShape(
      await req(sBadJson.app, 'POST', '/api/skills/scan', { repo: REPO }),
      502,
    );
  });

  test('B4/B5：网络断 → 502；超时 → 502 点名 timeout', async () => {
    const netDown: FetchLike = () => Promise.reject(new TypeError('fetch failed'));
    const sDown = bootServer({ githubFetch: netDown });
    await expectErrorShape(await req(sDown.app, 'POST', '/api/skills/scan', { repo: REPO }), 502);
    const timeout: FetchLike = () =>
      Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'));
    const sTimeout = bootServer({ githubFetch: timeout });
    const msg = await expectErrorShape(
      await req(sTimeout.app, 'POST', '/api/skills/scan', { repo: REPO }),
      502,
    );
    expect(msg.toLowerCase()).toContain('timeout');
  });

  test('B6：空 repo（trees 409）→ 502 点名 empty', async () => {
    const { fetchImpl } = stubFetch({
      [REPO_INFO_URL]: { json: { default_branch: 'main' } },
      [TREE_URL]: { status: 409, json: { message: 'Git Repository is empty.' } },
    });
    const s = bootServer({ githubFetch: fetchImpl });
    const msg = await expectErrorShape(
      await req(s.app, 'POST', '/api/skills/scan', { repo: REPO }),
      502,
    );
    expect(msg.toLowerCase()).toContain('empty');
  });
});

describe('POST /api/skills/scan——fetch 模式（D）与导入语义链（E）', () => {
  const fetchTable = () =>
    okTable(
      [
        { path: 'skills/alpha/SKILL.md', size: ALPHA_SKILL_MD.length },
        { path: 'skills/alpha/references/x.md', size: 12 },
        { path: 'skills/beta/SKILL.md', size: 10 },
      ],
      {
        [`${RAW}/skills/alpha/SKILL.md`]: { text: ALPHA_SKILL_MD },
        [`${RAW}/skills/alpha/references/x.md`]: { text: '# reference\n' },
      },
    );

  test('D2：文件集键相对技能目录、过 shared schema', async () => {
    const s = bootServer({ githubFetch: stubFetch(fetchTable()).fetchImpl });
    const res = await req(s.app, 'POST', '/api/skills/scan', {
      repo: REPO,
      path: 'skills/alpha',
    });
    expect(res.status).toBe(200);
    const body = fetchSkillFilesResponseSchema.parse(await res.json());
    expect(body.repo).toBe(REPO);
    expect(body.path).toBe('skills/alpha');
    expect(Object.keys(body.files).sort()).toEqual(['SKILL.md', 'references/x.md']);
    expect(body.files['SKILL.md']).toBe(ALPHA_SKILL_MD);
  });

  test('D1：目录无 SKILL.md → 404', async () => {
    const s = bootServer({ githubFetch: stubFetch(fetchTable()).fetchImpl });
    await expectErrorShape(
      await req(s.app, 'POST', '/api/skills/scan', { repo: REPO, path: 'skills/nope' }),
      404,
    );
  });

  test('D3/D4：单文件 >512KB / 文件数 >64 → 400（tree size 先知，不发 raw）', async () => {
    const big = bootServer({
      githubFetch: stubFetch(
        okTable(
          [
            { path: 'skills/fat/SKILL.md', size: 100 },
            { path: 'skills/fat/blob.bin', size: 600_000 },
          ],
          {},
        ),
      ).fetchImpl,
    });
    const msgBig = await expectErrorShape(
      await req(big.app, 'POST', '/api/skills/scan', { repo: REPO, path: 'skills/fat' }),
      400,
    );
    expect(msgBig).toContain('blob.bin');

    const many = treeWith({ path: 'skills/many/SKILL.md', size: 10 });
    for (let i = 0; i < 65; i++) {
      many.push({ path: `skills/many/f${i}.md`, type: 'blob', size: 1 });
    }
    const sMany = bootServer({
      githubFetch: stubFetch(okTable(many, {})).fetchImpl,
    });
    await expectErrorShape(
      await req(sMany.app, 'POST', '/api/skills/scan', { repo: REPO, path: 'skills/many' }),
      400,
    );
  });

  test('E：scan → fetch → 文件集喂 POST /api/skills → 201 入库（#195 验收链）', async () => {
    const s = bootServer({ githubFetch: stubFetch(fetchTable()).fetchImpl });
    const scan = scanSkillsResponseSchema.parse(
      await (await req(s.app, 'POST', '/api/skills/scan', { repo: REPO })).json(),
    );
    const alpha = scan.candidates.find((c) => c.name === 'alpha-skill');
    expect(alpha).toBeDefined();
    const fetched = fetchSkillFilesResponseSchema.parse(
      await (
        await req(s.app, 'POST', '/api/skills/scan', { repo: REPO, path: alpha!.path })
      ).json(),
    );
    const imported = await req(s.app, 'POST', '/api/skills', {
      name: alpha!.name,
      description: alpha!.description,
      files: fetched.files,
    });
    expect(imported.status).toBe(201);
    const record = skillRecordSchema.parse(await imported.json());
    expect(record.name).toBe('alpha-skill');
  });
});
