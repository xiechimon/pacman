// Agent 创建时间（B4 / XMON-18）：原版 wire 有这个字段——r5 raw 样本
// `GET /api/teams/{id}/chief` 的 agentActor 带 `createdAt: 1789786840183`
// （docs/research/assets/r5/raw/chief-record-testA.json），渲染形 `active ·
// 创建于 2026/9/19`（r3 §4）。本仓此前既无列也无 record 字段，读面静默剥掉。
//
// 失败方式清单（先固化场景，实现是让场景通过的手段）：
//   写路径——REST POST agents 不写值；chief `create_agent` 工具另一条写路径同律；
//   读路径——GET 单条 / members 的 agent actor / chief agentActor 三面都要带值；
//   不可变——PATCH 改配置不得改动 createdAt（改一次显示就漂一次）；
//   存量行——migration 后旧行取不到真值：不得落 0（0 与真实时间戳同形，
//     渲染成 1970/1/1 = UI 撒谎），必须是 null（读面可判「未知」）；
//   升级——旧库（≤0017，agent 表无此列且有行）跑新 migration 必须成功，
//     且旧行读得出、新行写得进（NOT NULL 无默认值 = 旧安装启动即崩）。

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { AgentRecord } from '@pacman/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { MIGRATIONS_FOLDER, openDbWithHandle } from '../src/db/client.js';
import { agent as agentTable } from '../src/db/schema.js';
import { type ChiefToolCtx, executeChiefTool } from '../src/services/chief-tools.js';
import { bootServer, req } from './helpers.js';

/** 直插一行「旧行」：不带 createdAt（migration 之前的写法）。 */
function insertLegacyAgent(s: ReturnType<typeof bootServer>, id: string): void {
  s.db
    .insert(agentTable)
    .values({
      id,
      teamId: s.team.id,
      displayName: '旧 Agent',
      description: null,
      status: 'active',
      avatarUrl: null,
      provider: null,
      modelId: null,
      thinkingLevel: null,
      tools: [],
      secrets: [],
      skills: [],
      mcpServers: [],
    })
    .run();
}

describe('Agent 创建时间：写路径写真值', () => {
  test('REST POST agents → GET 单条带回 createdAt（数字，≈当前时刻）', async () => {
    const s = bootServer();
    const before = Date.now();
    const created = await req(s.app, 'POST', `/api/teams/${s.team.id}/agents`, {
      displayName: 'worker-a',
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const got = await req(s.app, 'GET', `/api/teams/${s.team.id}/agents/${id}`);
    expect(got.status).toBe(200);
    const record = (await got.json()) as AgentRecord;
    expect(typeof record.createdAt).toBe('number');
    expect(record.createdAt).toBeGreaterThanOrEqual(before);
    expect(record.createdAt).toBeLessThanOrEqual(Date.now());
    s.dispose();
  });

  test('chief create_agent 工具同律（第二条写路径不许漏）', async () => {
    const s = bootServer();
    const ctx: ChiefToolCtx = {
      teamId: s.team.id,
      userId: s.user.id,
      chiefId: 'chief-1',
      threadId: 'thread-1',
      chiefAgentId: null,
      conversationId: 'chief-thread-1',
    };
    const before = Date.now();
    const text = await executeChiefTool(
      {
        db: s.db,
        hub: s.hub,
        machineHub: s.machineHub,
        box: s.secretBox,
        user: s.user,
        reposDir: s.reposDir,
        attachmentsDir: s.attachmentsDir,
        skillsDir: s.skillsDir,
        mcpConfigPath: join(tmpdir(), 'pacman-mcp-absent-creat-at.json'),
      },
      ctx,
      'create_agent',
      { displayName: 'tool-made' },
    );
    const { id } = JSON.parse(text) as { id: string };
    const row = s.db
      .select()
      .from(agentTable)
      .all()
      .find((r) => r.id === id);
    expect(row?.createdAt).toBeGreaterThanOrEqual(before);
    expect(row?.createdAt).toBeLessThanOrEqual(Date.now());
    s.dispose();
  });

  test('PATCH 改配置不改 createdAt（不可变）', async () => {
    const s = bootServer();
    const created = await req(s.app, 'POST', `/api/teams/${s.team.id}/agents`, {
      displayName: 'worker-b',
    });
    const { id } = (await created.json()) as { id: string };
    const first = (
      (await (
        await req(s.app, 'GET', `/api/teams/${s.team.id}/agents/${id}`)
      ).json()) as AgentRecord
    ).createdAt;

    const patched = await req(s.app, 'PATCH', `/api/teams/${s.team.id}/agents/${id}`, {
      displayName: 'worker-b2',
      modelId: 'claude-sonnet-5',
    });
    expect(patched.status).toBe(200);
    expect(((await patched.json()) as AgentRecord).createdAt).toBe(first);

    const after = (await (
      await req(s.app, 'GET', `/api/teams/${s.team.id}/agents/${id}`)
    ).json()) as AgentRecord;
    expect(after.createdAt).toBe(first);
    s.dispose();
  });
});

describe('Agent 创建时间：读面三处都带值', () => {
  test('GET members 的 agent actor 带 createdAt（团队页 roster 同一投影）', async () => {
    const s = bootServer();
    const created = await req(s.app, 'POST', `/api/teams/${s.team.id}/agents`, {
      displayName: 'worker-c',
    });
    const { id } = (await created.json()) as { id: string };

    const rows = (await (await req(s.app, 'GET', `/api/teams/${s.team.id}/members`)).json()) as {
      memberType: string;
      actorId: string;
      actor: AgentRecord;
    }[];
    const agentRow = rows.find((r) => r.memberType === 'agent' && r.actorId === id);
    expect(typeof agentRow?.actor.createdAt).toBe('number');
    s.dispose();
  });

  test('chief GET 的 agentActor 带 createdAt（原版就在这一面观测到的）', async () => {
    const s = bootServer();
    const agentId = 'agent-chief-bound';
    insertLegacyAgent(s, agentId);
    // r5 raw 一手值（chief-record-testA.json 的 agentActor.createdAt）。
    s.db
      .update(agentTable)
      .set({ createdAt: 1789786840183 })
      .where(eq(agentTable.id, agentId))
      .run();
    // 走真实绑定路径（PATCH /chief 的 agent 槽）——agentActor 只在这一面非 null。
    const bound = await req(s.app, 'PATCH', `/api/teams/${s.team.id}/chief`, {
      agent: { agentId, thinkingLevel: null },
    });
    expect(bound.status).toBe(200);

    const res = await req(s.app, 'GET', `/api/teams/${s.team.id}/chief`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { agentActor: AgentRecord | null };
    expect(body.agentActor?.createdAt).toBe(1789786840183);
    s.dispose();
  });
});

describe('存量行：未知必须是 null，不是 0', () => {
  test('旧行（无 createdAt）读得出，值为 null', async () => {
    const s = bootServer();
    insertLegacyAgent(s, 'legacy-1');

    const got = await req(s.app, 'GET', `/api/teams/${s.team.id}/agents/legacy-1`);
    expect(got.status).toBe(200);
    const record = (await got.json()) as AgentRecord;
    expect(record.createdAt).toBeNull();
    // 0 与真实时间戳在 record 里同形——落 0 就等于 UI 显示 1970/1/1 撒谎。
    expect(record.createdAt).not.toBe(0);
    s.dispose();
  });
});

describe('升级路径：旧库带行跑新 migration', () => {
  test('≤0017 库（agent 表有行）续跑新 migration → 成功，旧行 null，新行可写真值', () => {
    const journalPath = resolve(MIGRATIONS_FOLDER, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      dialect: string;
      entries: { idx: number; tag: string }[];
    };
    const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);
    expect(entries.length).toBeGreaterThan(1);
    const before = entries.slice(0, -1); // 全部迁移 − 最后一条（= agent.createdAt 那条）

    // 「旧安装」= 只装 ≤0017 的迁移集（副本，journal 截断到最后一条之前）。
    const oldFolder = mkdtempSync(join(tmpdir(), 'pacman-old-migrations-'));
    const workDir = mkdtempSync(join(tmpdir(), 'pacman-upgrade-'));
    cpSync(resolve(MIGRATIONS_FOLDER, 'meta'), join(oldFolder, 'meta'), { recursive: true });
    for (const entry of before) {
      cpSync(resolve(MIGRATIONS_FOLDER, `${entry.tag}.sql`), join(oldFolder, `${entry.tag}.sql`));
    }
    writeFileSync(
      join(oldFolder, 'meta', '_journal.json'),
      JSON.stringify({ ...journal, entries: before }, null, 2),
    );

    const dbPath = join(workDir, 'legacy.db');
    const old = openDbWithHandle(dbPath);
    const legacyId = 'legacy-upgrade-1';
    // 旧安装的行：老 schema 下建 agent（不带 createdAt——那一列还不存在）。
    old.db.run(
      "insert into team (id, name, createdAt, plan) values ('t-legacy', '旧团队', 1, 'free')",
    );
    old.db.run(
      `insert into agent (id, teamId, displayName, status, tools, secrets, skills, mcpServers)
       values ('${legacyId}', 't-legacy', '旧 Agent', 'active', '[]', '[]', '[]', '[]')`,
    );
    old.close();

    // 续跑完整迁移集（落在同一条 __drizzle_migrations 记录上，只补最后一条）。
    const upgraded = openDbWithHandle(dbPath);
    const legacyRow = upgraded.db
      .select({ createdAt: agentTable.createdAt })
      .from(agentTable)
      .where(eq(agentTable.id, legacyId))
      .get();
    expect(legacyRow?.createdAt).toBeNull();

    // 升级后新建的 Agent 走正常写路径的值形（这里直插真值，与 REST 面同效）。
    upgraded.db
      .insert(agentTable)
      .values({
        id: 'fresh-after-upgrade',
        teamId: 't-legacy',
        displayName: '新 Agent',
        status: 'active',
        tools: [],
        secrets: [],
        skills: [],
        mcpServers: [],
        createdAt: 1789786840183,
      })
      .run();
    const freshRow = upgraded.db
      .select({ createdAt: agentTable.createdAt })
      .from(agentTable)
      .where(eq(agentTable.id, 'fresh-after-upgrade'))
      .get();
    expect(freshRow?.createdAt).toBe(1789786840183);
    upgraded.close();

    rmSync(oldFolder, { recursive: true, force: true });
    rmSync(workDir, { recursive: true, force: true });
  });
});
