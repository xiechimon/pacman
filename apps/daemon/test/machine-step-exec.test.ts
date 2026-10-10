// 步执行全链（02 §5.7 生命周期行 + journal 端点词表）（#1128 自 machine-loop.test.ts 拆分；共享 harness 收编位
// = ./machine-loop-harness.ts，每个测试自 boot 自停）。

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ToolCallRecord } from '@pacman/shared';
import {
  buildPlanFirstRoundInstruction,
  buildTaskPromptText,
  composeTaskPromptWithInstruction,
} from '@pacman/shared';
import { describe, expect, test } from 'vitest';
import { boot, CLAIMED, FakeMachineApi, fakeBackend, waitFor } from './machine-loop-harness.js';

describe('步执行全链（02 §5.7 生命周期行 + journal 端点词表）', () => {
  test('claim → token → session → events → tool relay → upload → done', async () => {
    const api = new FakeMachineApi();
    const toolCall: ToolCallRecord = {
      id: 'call-1',
      name: 'edit',
      arguments: { path: 'README.md' },
      result: { ok: true },
      isError: false,
    };
    const { backend, created } = fakeBackend([
      { type: 'text_delta', text: '方案' },
      { type: 'toolcall_end', call: toolCall },
      {
        type: 'message_end',
        message: { role: 'assistant', content: [{ type: 'text', text: '方案' }] },
      },
      {
        type: 'done',
        usage: [
          { model: 'stub-gw/stub-model', input: 12, output: 980, cacheRead: 0, cacheWrite: 0 },
        ],
      },
    ]);
    const { handle, lines, paths } = await boot({ api, backend });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED);
    await waitFor(() => api.doneBodies.length === 1);

    // 生命周期行序 canon（02 §5.7）。
    expect(lines).toContain('claim step=s1');
    expect(lines).toContain('step s1 for conv conv-1 (1 running)');
    expect(lines).toContain('using model stub-gw/stub-model');
    expect(lines).toContain('[workspace] 准备工作区...');
    expect(lines).toContain('new session conv-1');
    expect(lines).toContain('finished (0 running)');

    // backend 收到 SessionOpts（provider 凭证内存态 + prompt + cwd + systemPrompt）。
    const opts = created[0]?.opts as {
      prompt?: string;
      cwd: string;
      systemPrompt?: string;
      provider: { providerId: string };
      modelId: string;
    };
    // #1025：plan 步（无 instruction）首轮任务 prompt = 任务文本 + plan.md 契约
    // 指令组合串（buildTaskPrompt 注入；compose 单源形状）。
    expect(opts.prompt).toBe(
      composeTaskPromptWithInstruction(
        buildTaskPromptText('探针任务', '写一行探针'),
        buildPlanFirstRoundInstruction(),
      ),
    );
    // agent.description 注入（02 §4.4 同缝）+ spec 15 #394 元信息回填指令块
    // （todo 语境步注入,词表 = FIXED_TAGS 单源）。
    expect(opts.systemPrompt).toContain('职责说明');
    expect(opts.systemPrompt).toContain('set_task_meta');
    expect(opts.systemPrompt).toContain('bug');
    expect(opts.provider.providerId).toBe('stub-gw');
    expect(opts.modelId).toBe('stub-model');
    expect(opts.cwd).toBe(join(paths.workspacesDir, 'conv-1'));

    // tool live 回传 + transcript 终稿（upload-urls → PUT）+ done body。
    expect(api.toolCalls.map((t) => t.call.id)).toEqual(['call-1']);
    const upload = api.uploads[0];
    expect(upload?.url).toBe('http://server/up/1');
    const ids = upload?.body.messages.map((m) => m.id);
    // #955 段序：正文段先落、工具行随后——封口在工具到达那一刻发生，段行必须
    // 排在它之后的工具行**之前**（否则流式期工具会显示在自己前导文本的上方）。
    expect(ids).toEqual(['user-s1', 'msg-s1-1', 'call-1']);
    expect(api.doneBodies[0]?.body).toMatchObject({
      status: 'success',
      sessionId: 'pi-sess-1',
      hasChanges: true, // edit 工具行（[推断] 骨架判定）
    });
    // journal 收尾清空。
    expect(existsSync(join(paths.outboxDir, 'step-s1.json'))).toBe(false);
    await handle.stop();
    await handle.done;
  });

  test('skillsAllowlist 透传（#372）：worker 步 = agent.skills（含 []）；chief 步不传', async () => {
    // worker 步：勾选 slug 原样进 SessionOpts.skillsAllowlist；空勾选传 []
    // （[] = 不注入任何 skill，缺省才是全量——两态不得混淆）。
    for (const skills of [['alpha', 'beta'], []] as string[][]) {
      const api = new FakeMachineApi();
      const { backend, created } = fakeBackend([{ type: 'done', usage: [] }]);
      const { handle } = await boot({ api, backend });
      await waitFor(() => api.parked !== null);
      api.parked?.({
        ...CLAIMED,
        agent: { ...CLAIMED.agent!, skills },
      });
      await waitFor(() => api.doneBodies.length === 1);
      const opts = created[0]?.opts as { skillsAllowlist?: string[] };
      expect(opts.skillsAllowlist).toEqual(skills);
      await handle.stop();
      await handle.done;
    }

    // worker 步 claim 未携带 skills（旧 server）= 缺省不传（全量直通，零回归）。
    {
      const api = new FakeMachineApi();
      const { backend, created } = fakeBackend([{ type: 'done', usage: [] }]);
      const { handle } = await boot({ api, backend });
      await waitFor(() => api.parked !== null);
      api.parked?.(CLAIMED);
      await waitFor(() => api.doneBodies.length === 1);
      const opts = created[0]?.opts as { skillsAllowlist?: string[] };
      expect(opts.skillsAllowlist).toBeUndefined();
      await handle.stop();
      await handle.done;
    }

    // chief 步：绑定 Agent 即使带 skills 也不传——chief 是信任面，全量 catalog。
    {
      const api = new FakeMachineApi();
      const { backend, created } = fakeBackend([{ type: 'done', usage: [] }]);
      const { handle } = await boot({ api, backend });
      await waitFor(() => api.parked !== null);
      api.parked?.({
        ...CLAIMED,
        step: { ...CLAIMED.step, kind: 'chief' as const },
        conversationId: 'chief-t1',
        agent: { ...CLAIMED.agent!, skills: ['alpha'] },
        chief: { threadId: 't1', systemPrompt: '总管 charter', trigger: 'user' as const },
      });
      await waitFor(() => api.doneBodies.length === 1);
      const opts = created[0]?.opts as { skillsAllowlist?: string[] };
      expect(opts.skillsAllowlist).toBeUndefined();
      await handle.stop();
      await handle.done;
    }
  });

  test('backend error 事件 → done failed（步级失败无自动重跑，02 §4.2）', async () => {
    const api = new FakeMachineApi();
    const { backend } = fakeBackend([
      { type: 'error', error: { message: 'invalid prompt', retryable: false } },
      { type: 'done', usage: [] },
    ]);
    const { handle } = await boot({ api, backend });
    await waitFor(() => api.parked !== null);
    api.parked?.(CLAIMED);
    await waitFor(() => api.doneBodies.length === 1);
    expect(api.doneBodies[0]?.body).toMatchObject({
      status: 'failed',
      errorMessage: 'invalid prompt',
    });
    await handle.stop();
    await handle.done;
  });
});
