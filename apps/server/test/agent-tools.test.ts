// Agent 权限开关写侧过滤（XMON-77 闭环）。词表 = shared AGENT_TOOL_SWITCHES
//（合并分支/推送分支——原版六档中唯一两档映射到真实执行面：daemon merge/push
// 收尾闸）；写侧 = filterAgentTools 静默丢弃词表外值（filterKnownSkillIds 同律，
// 非 machines enabledRuntimes 的 enum-400 律）。
//
// 为什么是过滤不是 400：UI 是读改写全量（agent-detail toggleTool 读 agent.tools
// → 翻转 → PATCH 全数组）。存量行若带着退役档（如「远程 shell」），enum 律会让
// 每次保存 400、用户被死值锁死；过滤律把残值随下一次写自然清退。
//
// 失败方式（先于实现固化）：
// 1. POST 带退役档/自造档 → 残值原样落库 → 永不消费的死存储 + UI 死开关。
// 2. PATCH 带残值 → 400（enum 律误用）或残值保留 → 读改写面被锁死/不清退。
// 3. 过滤误伤已知档（把 推送分支 也丢掉）→ 授权面静默失能。
// 4. PATCH 不带 tools 字段 → 误清空已授权集（undefined = 不动该列）。

import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { agent as agentTable } from '../src/db/schema.js';
import { bootServer, req } from './helpers.js';

const AGENT_ID = 'agent-tools-1';

describe('Agent tools 写侧过滤（XMON-77）', () => {
  test('POST：词表外值（退役档/自造档）静默丢弃，已知档保留', async () => {
    const s = bootServer();
    const create = await req(s.app, 'POST', `/api/teams/${s.team.id}/agents`, {
      displayName: '权限探针',
      tools: ['推送分支', '远程 shell', '创建标签', '自造档'],
    });
    expect(create.status).toBe(201);
    const id = ((await create.json()) as { id: string }).id;
    expect(s.db.select().from(agentTable).where(eq(agentTable.id, id)).get()!.tools).toEqual([
      '推送分支',
    ]);
    s.dispose();
  });

  test('POST：全关（tools 缺省）= []（least-privilege 默认不变）', async () => {
    const s = bootServer();
    const create = await req(s.app, 'POST', `/api/teams/${s.team.id}/agents`, {
      displayName: '默认探针',
    });
    expect(create.status).toBe(201);
    const id = ((await create.json()) as { id: string }).id;
    expect(s.db.select().from(agentTable).where(eq(agentTable.id, id)).get()!.tools).toEqual([]);
    s.dispose();
  });

  test('PATCH：读改写全量带退役档 → 残值随写清退（存量行自愈通道）', async () => {
    const s = bootServer();
    s.db
      .insert(agentTable)
      .values({ id: AGENT_ID, teamId: s.team.id, displayName: '存量行', modelId: 'm' })
      .run();
    // 直插退役残值（升级前存量形态）。
    s.db
      .update(agentTable)
      .set({ tools: ['远程 shell', '创建技能'] })
      .where(eq(agentTable.id, AGENT_ID))
      .run();
    const patch = await req(s.app, 'PATCH', `/api/teams/${s.team.id}/agents/${AGENT_ID}`, {
      tools: ['远程 shell', '创建技能', '推送分支'],
    });
    expect(patch.status).toBe(200);
    expect(s.db.select().from(agentTable).where(eq(agentTable.id, AGENT_ID)).get()!.tools).toEqual([
      '推送分支',
    ]);
    s.dispose();
  });

  test('PATCH：tools 未携带 → 已授权集不动（undefined ≠ 清空）', async () => {
    const s = bootServer();
    s.db
      .insert(agentTable)
      .values({
        id: AGENT_ID,
        teamId: s.team.id,
        displayName: '授权行',
        modelId: 'm',
        tools: ['合并分支', '推送分支'],
      })
      .run();
    const patch = await req(s.app, 'PATCH', `/api/teams/${s.team.id}/agents/${AGENT_ID}`, {
      displayName: '改名不改权限',
    });
    expect(patch.status).toBe(200);
    expect(s.db.select().from(agentTable).where(eq(agentTable.id, AGENT_ID)).get()!.tools).toEqual([
      '合并分支',
      '推送分支',
    ]);
    s.dispose();
  });

  test('PATCH：清空（tools: []）显式全关', async () => {
    const s = bootServer();
    s.db
      .insert(agentTable)
      .values({
        id: AGENT_ID,
        teamId: s.team.id,
        displayName: '收回探针',
        modelId: 'm',
        tools: ['推送分支'],
      })
      .run();
    const patch = await req(s.app, 'PATCH', `/api/teams/${s.team.id}/agents/${AGENT_ID}`, {
      tools: [],
    });
    expect(patch.status).toBe(200);
    expect(s.db.select().from(agentTable).where(eq(agentTable.id, AGENT_ID)).get()!.tools).toEqual(
      [],
    );
    s.dispose();
  });
});
