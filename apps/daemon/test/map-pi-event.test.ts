// 事件映射纯函数面（02 §5.6 pi 词表 → 01 §5 StepEvent 缝词表的宿主投影，
// 映射登记 = backend/pi.ts 头注 [推断]）。pi 包不在测试面出现——缝纪律。

import { describe, expect, test } from 'vitest';
import {
  type AgentSessionEventLike,
  mapPiSessionEvent,
  newMapState,
  PI_CAPABILITIES,
} from '../src/backend/pi.js';

function map(ev: AgentSessionEventLike, state = newMapState()) {
  return mapPiSessionEvent(ev, state);
}

describe('mapPiSessionEvent（AgentSessionEvent → StepEvent 投影）', () => {
  test('text_delta → text_delta + message_update 双事件', () => {
    const out = map({
      type: 'message_update',
      message: { role: 'assistant', content: [{ type: 'text', text: 'OK' }] },
      assistantMessageEvent: { type: 'text_delta', delta: 'OK' },
    });
    expect(out).toEqual([
      { type: 'text_delta', text: 'OK' },
      {
        type: 'message_update',
        message: { role: 'assistant', content: [{ type: 'text', text: 'OK' }] },
      },
    ]);
  });

  test('thinking_delta → thinking_delta；thinking_end → thinking（块全文）', () => {
    const msg = { role: 'assistant' };
    expect(
      map({
        type: 'message_update',
        message: msg,
        assistantMessageEvent: { type: 'thinking_delta', delta: 'hmm' },
      })[0],
    ).toEqual({ type: 'thinking_delta', text: 'hmm' });
    expect(
      map({
        type: 'message_update',
        message: msg,
        assistantMessageEvent: { type: 'thinking_end', content: 'hmm full' },
      }),
    ).toEqual([{ type: 'thinking', text: 'hmm full' }]);
  });

  test('toolcall_end 两段：调用块（无 result）→ 执行完（含 result，同 id）', () => {
    const state = newMapState();
    const first = map(
      {
        type: 'message_update',
        message: { role: 'assistant' },
        assistantMessageEvent: {
          type: 'toolcall_end',
          toolCall: { id: 'c1', name: 'edit', arguments: { path: 'README.md' } },
        },
      },
      state,
    );
    expect(first).toEqual([
      { type: 'toolcall_end', call: { id: 'c1', name: 'edit', arguments: { path: 'README.md' } } },
    ]);
    const second = map(
      {
        type: 'tool_execution_end',
        toolCallId: 'c1',
        toolName: 'edit',
        result: { ok: 1 },
        isError: false,
      },
      state,
    );
    expect(second).toHaveLength(1);
    const call = (second[0] as { call: Record<string, unknown> }).call;
    expect(call.id).toBe('c1');
    expect(call.arguments).toEqual({ path: 'README.md' }); // 前段参数保留
    expect(call.result).toEqual({ ok: 1 });
    expect(call.isError).toBe(false);
  });

  test('message_end 累积 usage（provider/model 键）；done 携累积值', () => {
    const state = newMapState();
    map(
      {
        type: 'message_end',
        message: {
          role: 'assistant',
          provider: 'stub-gw',
          model: 'stub-model',
          stopReason: 'stop',
          usage: { input: 12, output: 980, cacheRead: 100, cacheWrite: 50 },
        },
      },
      state,
    );
    map(
      {
        type: 'message_end',
        message: {
          role: 'assistant',
          provider: 'stub-gw',
          model: 'stub-model',
          stopReason: 'stop',
          usage: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
        },
      },
      state,
    );
    const done = map({ type: 'agent_end', willRetry: false }, state);
    expect(done).toEqual([
      {
        type: 'done',
        usage: [
          { model: 'stub-gw/stub-model', input: 13, output: 982, cacheRead: 100, cacheWrite: 50 },
        ],
      },
    ]);
  });

  test('agent_end(willRetry) 不发 done（pi 流级自动重试吸收）', () => {
    expect(map({ type: 'agent_end', willRetry: true })).toEqual([]);
  });

  test('stopReason=error → message_end + error{retryable 判定}；aborted → message_stop', () => {
    const err = map({
      type: 'message_end',
      message: { role: 'assistant', stopReason: 'error', errorMessage: 'rate limit hit' },
    });
    expect(err[1]).toEqual({
      type: 'error',
      error: { message: 'rate limit hit', retryable: true },
    });
    const fatal = map({
      type: 'message_end',
      message: { role: 'assistant', stopReason: 'error', errorMessage: 'invalid prompt' },
    });
    expect((fatal[1] as { error: { retryable: boolean } }).error.retryable).toBe(false);
    const stopped = map({
      type: 'message_end',
      message: { role: 'assistant', stopReason: 'aborted' },
    });
    expect(stopped).toEqual([
      { type: 'message_stop', message: { role: 'assistant', content: null } },
    ]);
  });

  test('auto_retry_start/end 与 compaction_start/end 同名直通', () => {
    expect(map({ type: 'auto_retry_start', attempt: 2 })).toEqual([
      { type: 'auto_retry_start', attempt: 2 },
    ]);
    expect(map({ type: 'auto_retry_end', attempt: 2 })).toEqual([
      { type: 'auto_retry_end', attempt: 2 },
    ]);
    expect(map({ type: 'compaction_start' })).toEqual([{ type: 'compaction_start' }]);
    expect(map({ type: 'compaction_end' })).toEqual([{ type: 'compaction_end' }]);
  });

  test('非词表事件（agent_start/turn_end/queue_update 族）不产生 StepEvent', () => {
    for (const type of [
      'agent_start',
      'turn_start',
      'turn_end',
      'queue_update',
      'entry_appended',
    ]) {
      expect(map({ type })).toEqual([]);
    }
  });

  test('toolResult role 投影到 message 词表（system/user/assistant，r5 §3.6）', () => {
    const out = map({ type: 'message_end', message: { role: 'toolResult', content: 'r' } });
    expect((out[0] as { message: { role: string } }).message.role).toBe('system');
  });
});

describe('PI_CAPABILITIES（01 §5 能力面）', () => {
  test('name/oauth 四家/思考强度七档/compaction/sessionResume', () => {
    expect(PI_CAPABILITIES.name).toBe('pi');
    expect(PI_CAPABILITIES.oauthProviders).toEqual([
      'anthropic',
      'openai-codex',
      'github-copilot',
      'xai',
    ]); // 02 §5.6/#34 锁定订阅项
    expect(PI_CAPABILITIES.thinkingLevels).toEqual([
      'off',
      'minimal',
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
    ]);
    expect(PI_CAPABILITIES.compaction).toBe(true);
    expect(PI_CAPABILITIES.sessionResume).toBe(true); // continue session（02 §4.2）
  });
});
