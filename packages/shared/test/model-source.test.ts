// parseClaudeCodeModelSource 对拍（#707 纯函数：server 与 daemon 共吃——
// 谁读谁机器的 settings.json）。语义 = 旧 server 端 fs 直读的解析面（model +
// env.ANTHROPIC_*_MODEL 槽，中段小写化；缺失/非法 → installed:false）。

import { describe, expect, test } from 'vitest';
import {
  claudeCodeReportSchema,
  modelSourcesEnvelopeSchema,
  parseClaudeCodeModelSource,
} from '../src/records/model-source.js';

describe('parseClaudeCodeModelSource', () => {
  test('model + env 槽解析（中段小写化，非槽键跳过）', () => {
    const source = parseClaudeCodeModelSource(
      {
        model: 'claude-opus-4-5',
        env: {
          ANTHROPIC_OPUS_MODEL: 'claude-opus-4-1',
          ANTHROPIC_SMALL_FAST_MODEL: 'claude-haiku-4-5',
          ANTHROPIC_BASE_URL: 'https://not-a-model-slot.example.com',
        },
      },
      'exec-1',
    );
    expect(source).toEqual({
      runtime: 'claude-code',
      installed: true,
      hostname: 'exec-1',
      models: [
        { id: 'claude-opus-4-5', name: 'claude-opus-4-5', slot: 'default' },
        { id: 'claude-opus-4-1', name: 'claude-opus-4-1', slot: 'opus' },
        { id: 'claude-haiku-4-5', name: 'claude-haiku-4-5', slot: 'small-fast' },
      ],
    });
  });

  test('JSON 字符串输入同律（daemon 读文件原文直喂）', () => {
    const source = parseClaudeCodeModelSource(JSON.stringify({ model: 'm-1' }), 'exec-1');
    expect(source.installed).toBe(true);
    expect(source.models).toEqual([{ id: 'm-1', name: 'm-1', slot: 'default' }]);
  });

  test('缺失/非法/非对象 → installed:false（不抛）', () => {
    for (const raw of [null, undefined, '{ not json', '["m-1"]', '42', '']) {
      const source = parseClaudeCodeModelSource(raw, 'exec-1');
      expect(source).toEqual({
        runtime: 'claude-code',
        installed: false,
        hostname: 'exec-1',
        models: [],
      });
    }
  });

  test('槽值非字符串/空串跳过该槽，installed 仍 true', () => {
    const source = parseClaudeCodeModelSource(
      { model: '', env: { ANTHROPIC_OPUS_MODEL: 42, ANTHROPIC_SONNET_MODEL: 'claude-sonnet-5' } },
      'exec-1',
    );
    expect(source.installed).toBe(true);
    expect(source.models).toEqual([
      { id: 'claude-sonnet-5', name: 'claude-sonnet-5', slot: 'sonnet' },
    ]);
  });

  test('上报载荷 round-trip：report → 段（hostname/模型原样）', () => {
    const source = parseClaudeCodeModelSource({ model: 'm-1' }, 'exec-1');
    const report = claudeCodeReportSchema.parse({
      installed: source.installed,
      hostname: source.hostname,
      models: source.models,
    });
    const envelope = modelSourcesEnvelopeSchema.parse({
      sources: [
        { runtime: 'pi', installed: true, hostname: 'server-1', models: [] },
        { runtime: 'claude-code', ...report },
      ],
    });
    expect(envelope.sources).toHaveLength(2);
    expect(envelope.sources[1]?.hostname).toBe('exec-1');
  });
});
