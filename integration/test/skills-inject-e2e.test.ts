// skills 执行面注入 E2E（spec 14 / #371）：daemon 扫描 PACMAN_SKILLS_DIR →
// `<available_skills>` catalog 追加进 session systemPrompt（不覆盖既有段）→
// agent 按 catalog 指引用 read 工具真读 SKILL.md（连通性硬验收：catalog 不能
// 是装饰品——read 结果带正文 marker 落库即证路径可达）。

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { loadDaemonConfig } from '../../apps/daemon/src/config.js';
import { createDaemonLogger } from '../../apps/daemon/src/log.js';
import { type MachineHandle, runMachine } from '../../apps/daemon/src/machine-loop.js';
import { type StatePaths, statePaths } from '../../apps/daemon/src/state.js';
import { message as messageTable } from '../../apps/server/src/db/schema.js';
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
  home = mkdtempSync(join(tmpdir(), 'pacman-it-skills-home-'));
  const config = loadDaemonConfig(
    {
      serverUrl: server.url,
      apiKey: server.apiKey,
      teamId: server.teamId,
      home,
      name: 'skills-inject-mbp',
      maxConcurrent: 1,
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

    // ② 连通性硬验收：read 工具真读到 SKILL.md——工具结果（正文 marker）
    //    经 tool relay 落库 message 面。
    const msgs = server.db
      .select()
      .from(messageTable)
      .where(eq(messageTable.conversationId, buildId))
      .all();
    expect(JSON.stringify(msgs)).toContain(SKILL_MARKER);

    // ③ [skills] 日志行族落 daemon.log（loaded 态）。
    expect(logLines().some((l) => l.startsWith('[skills] loaded: 1 skills from'))).toBe(true);
  }, 150_000);
});
