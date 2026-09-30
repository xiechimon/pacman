// skills 执行面注入 E2E（spec 14 / #371 + #372 per-agent 白名单）：daemon 扫描
// PACMAN_SKILLS_DIR → 按 agent.skills 勾选过滤 → `<available_skills>` catalog
// 追加进 session systemPrompt（不覆盖既有段）→ agent 按 catalog 指引用 read
// 工具真读 SKILL.md（连通性硬验收：catalog 不能是装饰品——read 结果带正文
// marker 落库即证路径可达）。白名单面：授权 skill 在位、同目录未授权 skill
// 不出现（#372 验收一）。

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { loadDaemonConfig } from '../../apps/daemon/src/config.js';
import { createDaemonLogger } from '../../apps/daemon/src/log.js';
import { type MachineHandle, runMachine } from '../../apps/daemon/src/machine-loop.js';
import { type StatePaths, statePaths } from '../../apps/daemon/src/state.js';
import { agent as agentTable, message as messageTable } from '../../apps/server/src/db/schema.js';
import { AGENT_ID, api, bootRealServer, type RealServer, seedWorld, waitFor } from './helpers.js';
import { type StubLlm, startStubLlm } from './stub-llm.js';

/** SKILL.md 正文 marker：read 结果落库断言键（catalog 触发按需读的实证）。 */
const SKILL_MARKER = 'SKILLS-INJECT-MARKER-371';

let stub: StubLlm;
let server: RealServer;
let handle: MachineHandle;
let paths: StatePaths;
let home: string;
let skillsDir: string;
let skillFile: string;
let world: { projectId: string; todoId: string };
let buildId = '';

function logLines(): string[] {
  try {
    return readFileSync(paths.daemonLog, 'utf8').split('\n');
  } catch {
    return [];
  }
}

beforeAll(async () => {
  // fixture skills 目录：单 skill（frontmatter name + description + 正文 marker）。
  skillsDir = mkdtempSync(join(tmpdir(), 'pacman-it-skills-'));
  const dir = join(skillsDir, 'demo-skill');
  mkdirSync(dir, { recursive: true });
  skillFile = join(dir, 'SKILL.md');
  writeFileSync(
    skillFile,
    [
      '---',
      'name: demo-skill',
      `description: 演示技能：读到正文即证明 skills 目录可达（${SKILL_MARKER}）。`,
      '---',
      '',
      '# demo-skill',
      '',
      `正文 marker：${SKILL_MARKER}`,
      '',
    ].join('\n'),
    'utf8',
  );
  // 未授权对照 skill（#372）：同目录在位但 agent.skills 白名单外——注入面
  // 必须不出现。
  mkdirSync(join(skillsDir, 'extra-skill'), { recursive: true });
  writeFileSync(
    join(skillsDir, 'extra-skill', 'SKILL.md'),
    [
      '---',
      'name: extra-skill',
      'description: 白名单外对照技能。',
      '---',
      '',
      'extra body.',
      '',
    ].join('\n'),
    'utf8',
  );

  stub = await startStubLlm([
    // 轮 1：agent 按 catalog 指引 read SKILL.md（绝对路径 = catalog location）。
    { toolCall: { name: 'read', arguments: { path: skillFile } } },
    // 轮 2：收尾。
    { content: '已读取演示技能。' },
  ]);
  server = await bootRealServer({
    providerBaseUrl: stub.url,
    claimHoldMs: 1_000,
    agentDescription: '你是集成测试 Agent：按指令使用工具，然后简短汇报。',
  });
  // agent.skills 白名单勾选（#372）：worker 步只有授权 slug 进 catalog——
  // demo-skill 勾选、extra-skill 不勾（空勾选 = 不注入任何 skill）。
  server.db
    .update(agentTable)
    .set({ skills: ['demo-skill'] })
    .where(eq(agentTable.id, AGENT_ID))
    .run();
  home = mkdtempSync(join(tmpdir(), 'pacman-it-skills-home-'));
  const config = loadDaemonConfig(
    {
      serverUrl: server.url,
      apiKey: server.apiKey,
      teamId: server.teamId,
      home,
      name: 'skills-inject-mbp',
      skillsDir,
    },
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
  await waitFor(() => logLines().includes('[wake] push channel connected'), 30_000);
}, 120_000);

afterAll(async () => {
  await handle?.stop();
  await handle?.done;
  await server?.close();
  await stub?.close();
  if (home) rmSync(home, { recursive: true, force: true });
  if (skillsDir) rmSync(skillsDir, { recursive: true, force: true });
  process.stdout.write(
    `\n[diag] stub requests consumed: ${stub?.requests.length ?? -1}\n[diag] daemon.log tail:\n${logLines().slice(-40).join('\n')}\n`,
  );
});

describe('spec 14 skills 执行面注入 E2E', () => {
  test('systemPrompt 含 catalog XML（追加不覆盖）；agent read SKILL.md 结果落库（连通性硬验收）', async () => {
    world = await seedWorld(
      server.url,
      server.teamId,
      { title: 'skills 注入探针', spec: '读取演示技能并汇报 marker。' },
      { projectName: 'skills-inject' },
    );
    const started = await api(server.url, 'POST', `/api/projects/${world.projectId}/builds`, {
      todoIds: [world.todoId],
      assignment: { plan: null, build: { agentId: AGENT_ID } },
      withPlan: false,
    });
    expect(started.status).toBe(201);
    buildId = (started.body as { builds: { id: string }[] }).builds[0]!.id;

    await waitFor(() => server.todoPhase(world.todoId) === 'review', 150_000);

    // ① catalog 注入 LLM 输入面（stub 捕获）：systemPrompt 含 <available_skills>
    //    且既有段（agent 职责文本）在位——追加而非覆盖。
    const first = stub.requests[0]!;
    const flat = JSON.stringify(first.messages);
    expect(flat).toContain('<available_skills>');
    expect(flat).toContain('<name>demo-skill</name>');
    expect(flat).toContain(skillFile); // location = 绝对路径，read 工具可直达
    expect(flat).toContain('你是集成测试 Agent');
    // 白名单外 skill 不入注入面（#372 验收一：worker 步 systemPrompt 只含
    // agent.skills 勾选条目）。
    expect(flat).not.toContain('extra-skill');

    // ② 连通性硬验收：read 工具真读到 SKILL.md——工具结果（正文 marker）
    //    经 tool relay 落库 message 面。
    const msgs = server.db
      .select()
      .from(messageTable)
      .where(eq(messageTable.conversationId, buildId))
      .all();
    expect(JSON.stringify(msgs)).toContain(SKILL_MARKER);

    // ③ [skills] 日志行族落 daemon.log（loaded 态 + filtered 行，#372）。
    expect(logLines().some((l) => l.startsWith('[skills] loaded: 1 skills from'))).toBe(true);
    expect(logLines()).toContain('[skills] filtered: extra-skill not in agent allowlist');
  }, 150_000);
});
