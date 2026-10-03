// 模型候选投影 toModelOptions（#358，spec 11 §A10；#770 起 providers 段已除
// ——只剩 model-sources 非 pi 段）——消费面三处（总管压缩模型选择器 / 创建
// Agent 弹窗 / Agent 详情概览），投影本体与消费面无关，故不叫 chief-*。
// 失败方式枚举先行，本文件是场景固化（仓测试规则 3）：
// F1  sources 空 → 空清单（选择器菜单只剩默认行，不崩）
// F2  providers 记录不再是候选源：投影签名只收 sources——custom provider
//     的 models[] 即使存在也不产行（建/改/删走 providers 管理页，执行面按
//     存值解析，两者都不经本投影）
// F3  claude-code 段（installed 带模型）→ provider='claude-code'（runtime
//     词表值）、providerLabel='Claude Code'（品牌名不译，#356 tab 同律）
// F4  sources 的 pi 段不产行（server 端 pi 段 = 旧 providers 同构 flatMap 且
//     无归属；#770 后归属行不再产出，pi 段恒跳过）
// F5  同 (provider, modelId) 重复（settings.json default 槽 + env 槽同 id）
//     → 去重 first-wins（组件 React key `${provider}/${modelId}` 防撞面）
// F5a 跨封套条目同键 → 去重 first-wins（留首名）
// F6  未安装段（installed:false，models=[]）→ 无行贡献，不崩
// F7  序稳定：非 pi runtime 段按封套序
// F8  空 id 行跳过（shared modelSourceModelSchema min(1) 卫生在本层对齐）

import type { ModelSource } from '@pacman/shared';
import { describe, expect, it } from 'vitest';
import { toModelOptions } from '../src/api/mappers.js';

function ccSource(models: ModelSource['models'], installed = true): ModelSource {
  return { runtime: 'claude-code', installed, hostname: 'test-host', models };
}

function piSource(models: ModelSource['models']): ModelSource {
  return { runtime: 'pi', installed: true, hostname: 'test-host', models };
}

describe('toModelOptions（#358 数据源投影，#770 providers 段已除）', () => {
  it('F1: sources 空 → 空清单', () => {
    expect(toModelOptions([])).toEqual([]);
  });

  it('F3: claude-code 段 → runtime 词表值作 provider、品牌名作 label', () => {
    const rows = toModelOptions([
      ccSource([{ id: 'claude-opus-4-5', name: 'claude-opus-4-5', slot: 'default' }]),
    ]);
    expect(rows).toEqual([
      {
        provider: 'claude-code',
        providerLabel: 'Claude Code',
        modelId: 'claude-opus-4-5',
        modelName: 'claude-opus-4-5',
      },
    ]);
  });

  it('F4: sources 的 pi 段不产行', () => {
    const rows = toModelOptions([piSource([{ id: 'm-a', name: 'M A' }])]);
    expect(rows).toEqual([]);
  });

  it('F5: claude-code 多槽同 id → 去重 first-wins', () => {
    const rows = toModelOptions([
      ccSource([
        { id: 'claude-opus-4-5', name: 'claude-opus-4-5', slot: 'default' },
        { id: 'claude-opus-4-5', name: 'claude-opus-4-5', slot: 'opus' },
      ]),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.modelId).toBe('claude-opus-4-5');
  });

  it('F5a: 跨封套条目同键 → 去重 first-wins（留首名）', () => {
    const rows = toModelOptions([
      ccSource([{ id: 'm-x', name: '首名' }]),
      ccSource([{ id: 'm-x', name: '次名' }]),
    ]);
    expect(rows).toEqual([
      {
        provider: 'claude-code',
        providerLabel: 'Claude Code',
        modelId: 'm-x',
        modelName: '首名',
      },
    ]);
  });

  it('F6: 未安装段（models=[]）→ 无行贡献，不崩', () => {
    expect(toModelOptions([ccSource([], false)])).toEqual([]);
  });

  it('F7: 序 = 非 pi runtime 段按封套序', () => {
    const rows = toModelOptions([
      piSource([{ id: 'm-a', name: 'M A' }]),
      ccSource([{ id: 'm-cc', name: 'm-cc' }]),
    ]);
    expect(rows.map((r) => `${r.provider}/${r.modelId}`)).toEqual(['claude-code/m-cc']);
  });

  it('F8: 空 id 行跳过', () => {
    const rows = toModelOptions([
      ccSource([
        { id: '', name: '幽灵行' },
        { id: 'm1', name: 'm1' },
      ]),
    ]);
    expect(rows.map((r) => r.modelId)).toEqual(['m1']);
  });
});
