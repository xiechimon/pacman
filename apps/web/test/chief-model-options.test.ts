// chief-model-select 数据源投影（#358，spec 11 §A10）——失败方式枚举先行，
// 本文件是场景固化（仓测试规则 3）：
// F1  双源空 → 空清单（选择器菜单只剩默认行，不崩）
// F2  custom providers models[] → 带归属行（provider=providerId、
//     providerLabel=label 原样，#180 现状逻辑保留）
// F2a provider 模型行空 id 跳过、空 name 回退 id（与 server pi 投影卫生
//     对齐——shared modelSourceModelSchema 两处 min(1)）
// F3  claude-code 段（installed 带模型）→ provider='claude-code'（runtime
//     词表值）、providerLabel='Claude Code'（品牌名不译，#356 tab 同律）
// F4  sources 的 pi 段不产行——server 端 pi 段 = custom providers 同构
//     flatMap 且无归属，归属行由 F2 唯一产出，防双份
// F5  同 (provider, modelId) 重复（settings.json default 槽 + env 槽同 id）
//     → 去重 first-wins（组件 React key `${provider}/${modelId}` 防撞面）
// F5a 跨 provider 同 modelId → 两行都留（model id 只在 provider 内有意义，
//     chiefCompactionModelSchema 对象形槽值立法理由）
// F6  未安装段（installed:false，models=[]）→ 无行贡献，不崩
// F7  序稳定：custom providers 段在前，非 pi runtime 段按封套序在后

import type { ModelSource, ProviderRecord } from '@pacman/shared';
import { describe, expect, it } from 'vitest';
import { toChiefModelOptions } from '../src/api/mappers.js';

function provider(
  providerId: string,
  models: { id: string; name: string }[],
  label = providerId,
): ProviderRecord {
  return {
    kind: 'custom',
    providerId,
    label,
    baseUrl: 'https://api.example.invalid/v1',
    api: 'anthropic-messages',
    authHeader: true,
    compat: { supportsDeveloperRole: false },
    models,
    id: `prov-${providerId}`,
    createdBy: 'user-test',
    createdAt: 0,
    updatedAt: 0,
  };
}

function ccSource(models: ModelSource['models'], installed = true): ModelSource {
  return { runtime: 'claude-code', installed, hostname: 'test-host', models };
}

function piSource(models: ModelSource['models']): ModelSource {
  return { runtime: 'pi', installed: true, hostname: 'test-host', models };
}

describe('toChiefModelOptions（#358 数据源投影）', () => {
  it('F1: 双源空 → 空清单', () => {
    expect(toChiefModelOptions([], [])).toEqual([]);
  });

  it('F2: custom providers models[] → 带归属行（#180 现状逻辑保留）', () => {
    const rows = toChiefModelOptions(
      [provider('r3-gw', [{ id: 'claude-sonnet-5', name: 'Claude Sonnet 5（R3 网关）' }], 'R3 网关')],
      [],
    );
    expect(rows).toEqual([
      {
        provider: 'r3-gw',
        providerLabel: 'R3 网关',
        modelId: 'claude-sonnet-5',
        modelName: 'Claude Sonnet 5（R3 网关）',
      },
    ]);
  });

  it('F2a: 空 id 行跳过、空 name 回退 id', () => {
    const rows = toChiefModelOptions(
      [provider('gw', [{ id: '', name: '幽灵行' }, { id: 'm1', name: '' }])],
      [],
    );
    expect(rows).toEqual([
      { provider: 'gw', providerLabel: 'gw', modelId: 'm1', modelName: 'm1' },
    ]);
  });

  it('F3: claude-code 段 → runtime 词表值作 provider、品牌名作 label', () => {
    const rows = toChiefModelOptions(
      [],
      [ccSource([{ id: 'claude-opus-4-5', name: 'claude-opus-4-5', slot: 'default' }])],
    );
    expect(rows).toEqual([
      {
        provider: 'claude-code',
        providerLabel: 'Claude Code',
        modelId: 'claude-opus-4-5',
        modelName: 'claude-opus-4-5',
      },
    ]);
  });

  it('F4: sources 的 pi 段不产行（归属行由 providers 投影唯一产出）', () => {
    const rows = toChiefModelOptions(
      [provider('r3-gw', [{ id: 'claude-sonnet-5', name: 'Claude Sonnet 5' }])],
      [piSource([{ id: 'claude-sonnet-5', name: 'Claude Sonnet 5' }])],
    );
    expect(rows).toEqual([
      {
        provider: 'r3-gw',
        providerLabel: 'r3-gw',
        modelId: 'claude-sonnet-5',
        modelName: 'Claude Sonnet 5',
      },
    ]);
  });

  it('F5: claude-code 多槽同 id → 去重 first-wins', () => {
    const rows = toChiefModelOptions(
      [],
      [
        ccSource([
          { id: 'claude-opus-4-5', name: 'claude-opus-4-5', slot: 'default' },
          { id: 'claude-opus-4-5', name: 'claude-opus-4-5', slot: 'opus' },
        ]),
      ],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.modelId).toBe('claude-opus-4-5');
  });

  it('F5a: 跨 provider 同 modelId → 两行都留', () => {
    const rows = toChiefModelOptions(
      [provider('r3-gw', [{ id: 'claude-sonnet-5', name: 'Claude Sonnet 5' }])],
      [ccSource([{ id: 'claude-sonnet-5', name: 'claude-sonnet-5', slot: 'sonnet' }])],
    );
    expect(rows.map((r) => `${r.provider}/${r.modelId}`)).toEqual([
      'r3-gw/claude-sonnet-5',
      'claude-code/claude-sonnet-5',
    ]);
  });

  it('F6: 未安装段（models=[]）→ 无行贡献，不崩', () => {
    expect(toChiefModelOptions([], [ccSource([], false)])).toEqual([]);
  });

  it('F7: 序 = providers 段在前、非 pi runtime 段按封套序在后', () => {
    const rows = toChiefModelOptions(
      [
        provider('gw-a', [{ id: 'm-a', name: 'M A' }]),
        provider('gw-b', [{ id: 'm-b', name: 'M B' }]),
      ],
      [piSource([{ id: 'm-a', name: 'M A' }]), ccSource([{ id: 'm-cc', name: 'm-cc' }])],
    );
    expect(rows.map((r) => `${r.provider}/${r.modelId}`)).toEqual([
      'gw-a/m-a',
      'gw-b/m-b',
      'claude-code/m-cc',
    ]);
  });
});
