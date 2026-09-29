// spec 15 #394：worker systemPrompt 的元信息回填指令（ADR 0002 D3）——
// todo 语境步注入，词表 = shared FIXED_TAGS 单源对拍，当前占位标题入指令。

import { FIXED_TAGS } from '@pacman/shared';
import { describe, expect, it } from 'vitest';
import { composeTaskMetaInstruction, composeWorkerSystemPrompt } from '../src/runner.js';

describe('composeTaskMetaInstruction', () => {
  it('含 set_task_meta 调用指令 + 当前占位标题 + 全词表 name/description', () => {
    const text = composeTaskMetaInstruction('给登录页加验证码');
    expect(text).toContain('set_task_meta');
    expect(text).toContain('「给登录页加验证码」');
    for (const tag of FIXED_TAGS) {
      expect(text).toContain(`${tag.name}：${tag.description}`);
    }
  });
});

describe('composeWorkerSystemPrompt 的 taskMeta 开关', () => {
  it('给出 taskMeta 时追加元信息块；缺省不追加', () => {
    const on = composeWorkerSystemPrompt('职责文本', undefined, {
      taskMeta: { currentTitle: '占位标题' },
    });
    expect(on).toContain('职责文本');
    expect(on).toContain('set_task_meta');
    expect(on).toContain('「占位标题」');
    const off = composeWorkerSystemPrompt('职责文本', undefined);
    expect(off).toBe('职责文本');
  });
});
