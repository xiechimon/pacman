// 模型兜底契约（XMON-44 / XMON-32 终稿第三节）：fallbackModelSchema、
// agent/step/machine-wire 四处纯增可选扩展、写面去重纯函数。失败场景先行
// （issue 验收）：空/坏 provider、空 modelId、坏 failureKind 词、坏 attempt 行、
// 旧形状载荷（无新字段）必须原样可解析——纯增可选字段无版本墙。

import { describe, expect, test } from 'vitest';
import {
  agentRecordSchema,
  claimedStepSchema,
  createAgentBodySchema,
  fallbackModelSchema,
  machineDoneBodySchema,
  machineTokenResponseSchema,
  modelAttemptSchema,
  patchAgentBodySchema,
  stepFailureKindSchema,
  stepJournalRowSchema,
  stepRecordSchema,
  stripFallbackModelDupes,
} from '../src/index.js';

const agentRecord = {
  id: 'agt-1',
  displayName: 'scribe',
  description: null,
  status: 'active',
  avatarUrl: null,
  provider: 'main-gw',
  modelId: 'm1',
  thinkingLevel: null,
  tools: [],
  secrets: [],
  skills: [],
  mcpServers: [],
};

const fallback = (provider: string | null, modelId: string) => ({ provider, modelId });

describe('fallbackModelSchema（兜底槽 {provider: string|null, modelId}）', () => {
  test('provider null（沿用 agent.provider）与显式 string 均可解析', () => {
    expect(fallbackModelSchema.parse(fallback(null, 'm2'))).toEqual(fallback(null, 'm2'));
    expect(fallbackModelSchema.parse(fallback('groq', 'm2'))).toEqual(fallback('groq', 'm2'));
  });

  test('空 modelId / 缺 modelId / provider 非字符串拒绝', () => {
    expect(fallbackModelSchema.safeParse(fallback(null, '')).success).toBe(false);
    expect(fallbackModelSchema.safeParse({ provider: null }).success).toBe(false);
    // 坏类型入参需 as unknown（zod v4 入参类型 = 输出形收窄）。
    expect(fallbackModelSchema.safeParse({ provider: 123, modelId: 'm2' } as unknown).success).toBe(
      false,
    );
  });
});

describe('agent 契约扩展（record/create/patch + 写面去重）', () => {
  test('agentRecordSchema 缺省 fallbackModels → []（读面兼容旧行）', () => {
    expect(agentRecordSchema.parse(agentRecord).fallbackModels).toEqual([]);
  });

  test('agentRecordSchema 携带列表时原样保序', () => {
    const list = [fallback('groq', 'g1'), fallback(null, 'm2')];
    expect(
      agentRecordSchema.parse({ ...agentRecord, fallbackModels: list }).fallbackModels,
    ).toEqual(list);
  });

  test('createAgentBody 缺省 → undefined（server 写面落 []）；patch 缺省 → undefined（未动语义）', () => {
    expect(createAgentBodySchema.parse({ displayName: 'a' }).fallbackModels).toBeUndefined();
    // patch = create.partial()：空体不得把「未动」解析成「清空」（zod v4
    // .partial() 保留 default，故 create 面用 optional 不用 default）。
    expect(patchAgentBodySchema.parse({}).fallbackModels).toBeUndefined();
    expect(patchAgentBodySchema.parse({ displayName: 'b' }).fallbackModels).toBeUndefined();
    expect(
      createAgentBodySchema.parse({ displayName: 'a', fallbackModels: [fallback(null, 'm2')] })
        .fallbackModels,
    ).toEqual([fallback(null, 'm2')]);
  });

  test('stripFallbackModelDupes：与主模型重复项剥离（null provider = 继承主 provider）', () => {
    const list = [
      fallback(null, 'm1'),
      fallback('main-gw', 'm1'),
      fallback(null, 'm2'),
      fallback('groq', 'm1'),
    ];
    expect(stripFallbackModelDupes(list, 'main-gw', 'm1')).toEqual([
      fallback(null, 'm2'),
      fallback('groq', 'm1'),
    ]);
  });

  test('stripFallbackModelDupes：主 provider null 时 null 槽条目也算重复；主 modelId null → 无可重复', () => {
    expect(stripFallbackModelDupes([fallback(null, 'm1')], null, 'm1')).toEqual([]);
    expect(stripFallbackModelDupes([fallback(null, 'm1')], 'p', null)).toEqual([
      fallback(null, 'm1'),
    ]);
  });
});

describe('machineDoneBody 扩展（failureKind + attempts，纯增可选）', () => {
  const attempt = {
    provider: 'main-gw',
    modelId: 'm1',
    error: 'rate limited',
    startedAt: 1790000000000,
    endedAt: 1790000001000,
  };

  test('旧形状（无 failureKind/attempts）原样可解析——无版本墙', () => {
    expect(machineDoneBodySchema.parse({ status: 'failed', errorMessage: 'x' })).toEqual({
      status: 'failed',
      errorMessage: 'x',
    });
  });

  test('failed + failureKind + attempts（error null = 该模型成功收尾）可解析', () => {
    const body = machineDoneBodySchema.parse({
      status: 'failed',
      errorMessage: 'all fallbacks exhausted',
      failureKind: 'model_call',
      attempts: [attempt, { ...attempt, modelId: 'm2', error: null }],
    });
    expect(body.failureKind).toBe('model_call');
    expect(body.attempts).toHaveLength(2);
    expect(body.attempts?.[1]?.error).toBeNull();
  });

  test('词表外 failureKind / 坏 attempt 行（error 类型、非整数时间戳）拒绝', () => {
    expect(
      machineDoneBodySchema.safeParse({ status: 'failed', failureKind: 'network' }).success,
    ).toBe(false);
    expect(
      machineDoneBodySchema.safeParse({ status: 'failed', attempts: [{ ...attempt, error: 42 }] })
        .success,
    ).toBe(false);
    expect(
      machineDoneBodySchema.safeParse({
        status: 'failed',
        attempts: [{ ...attempt, startedAt: 't0' }],
      }).success,
    ).toBe(false);
    expect(modelAttemptSchema.safeParse({ ...attempt, endedAt: 1.5 }).success).toBe(false);
  });
});

describe('claim / token / journal 读面扩展（纯增可选）', () => {
  const stepRecord = {
    id: 'stp-1',
    buildId: 'bld-1',
    kind: 'build',
    machineId: 'mac-1',
    createdAt: 1790000000000,
  };

  test('claimedStep.agent.fallbackModels 缺省可解析；携带列表可解析', () => {
    const base = {
      step: stepRecord,
      conversationId: 'bld-1',
      session: { action: 'new' as const, sessionId: null },
      agent: {
        id: 'agt-1',
        displayName: 'scribe',
        description: null,
        provider: 'main-gw',
        modelId: 'm1',
        thinkingLevel: null,
      },
    };
    expect(claimedStepSchema.parse(base).agent?.fallbackModels).toBeUndefined();
    const list = [fallback(null, 'm2')];
    expect(
      claimedStepSchema.parse({ ...base, agent: { ...base.agent, fallbackModels: list } }).agent
        ?.fallbackModels,
    ).toEqual(list);
  });

  test('machineTokenResponse.fallbackProviders 缺省可解析；携带 providerConfig 列表可解析', () => {
    const base = { provider: null, secrets: {}, git: null };
    expect(machineTokenResponseSchema.parse(base).fallbackProviders).toBeUndefined();
    expect(
      machineTokenResponseSchema.parse({
        ...base,
        fallbackProviders: [{ kind: 'api_key', providerId: 'groq' }],
      }).fallbackProviders,
    ).toEqual([{ kind: 'api_key', providerId: 'groq' }]);
  });

  test('stepJournalRow.attempts null / 列表两态可解析', () => {
    const row = {
      ...stepRecordSchema.parse(stepRecord),
      status: 'failed',
      checkpointCommit: null,
    };
    expect(stepJournalRowSchema.parse({ ...row, attempts: null }).attempts).toBeNull();
    const attempts = [
      {
        provider: 'main-gw',
        modelId: 'm1',
        error: 'rate limited',
        startedAt: 1790000000000,
        endedAt: 1790000001000,
      },
    ];
    expect(stepJournalRowSchema.parse({ ...row, attempts }).attempts).toEqual(attempts);
  });
});

describe('stepFailureKindSchema 词表', () => {
  test('model_call / other 可解析；其余拒绝', () => {
    expect(stepFailureKindSchema.parse('model_call')).toBe('model_call');
    expect(stepFailureKindSchema.parse('other')).toBe('other');
    expect(stepFailureKindSchema.safeParse('stream_timeout').success).toBe(false);
  });
});
