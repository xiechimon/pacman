// backend 图片交付（#730）失败方式先于实现固化：
//   1. claude-code：无图片 → content 恒 string（既有 wire 零回归——文本
//      形是 SDK 的 MessageParam 简单形，不能因加图片面而漂移成数组）。
//   2. claude-code：带图片 → content = 块数组 [{type:'text'},{type:'image',
//      source:{type:'base64',media_type,data}}]——Claude Code 本尊同机制
//      （parent 正典 §Part 2），SDKUserMessage.message 支持 MessageParam
//      content 数组（agentSdkTypes SDKUserMessage 注释明示）。
//   3. pi：DeliveredImage → pi ImageContent 结构映射（type:'image' + data +
//      mimeType）；空数组 = 不传 images（不触发空图片轮）。
//   4. pi：input 能力钉（CUSTOM_MODEL_DEFAULTS input:['text']）会把图片
//      静默降级为占位文本（pi-ai transform-messages.js downgrade）——
//      ensureImageInput 把本步会话的 model.input 翻到含 'image'；
//      已含 'image' 时幂等不重复。
//   5. steer 面带图片：claude-code 流输入队列收到块数组帧；pi steer 映射
//      到 session.steer(text, images)。

import { describe, expect, test } from 'vitest';
import { buildUserMessage, toImageBlock } from '../src/backend/claude-code.js';
import { ensureImageInput, toPiImages } from '../src/backend/pi.js';

const IMG = { data: 'aW1n', mimeType: 'image/png' };

describe('claude-code 用户帧图片交付（#730）', () => {
  test('失败方式 1：无图片 → content 仍为 string（零回归）', () => {
    const msg = buildUserMessage('任务文本');
    expect(msg.type).toBe('user');
    expect(msg.message.role).toBe('user');
    expect(msg.message.content).toBe('任务文本');
    expect(msg.parent_tool_use_id).toBeNull();
  });

  test('失败方式 2：带图片 → 块数组 [text, image...]（CC 本尊同机制）', () => {
    const msg = buildUserMessage('看这张图', [IMG, { ...IMG, mimeType: 'image/jpeg' }]);
    expect(Array.isArray(msg.message.content)).toBe(true);
    const blocks = msg.message.content as unknown[];
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: 'text', text: '看这张图' });
    expect(blocks[1]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'aW1n' },
    });
    expect(blocks[2]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'aW1n' },
    });
  });

  test('失败方式 2：空图片数组 → string 形（不落空数组）', () => {
    const msg = buildUserMessage('任务文本', []);
    expect(msg.message.content).toBe('任务文本');
  });

  test('toImageBlock：单块形态独立钉（source 三字段缺一不可）', () => {
    expect(toImageBlock(IMG)).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'aW1n' },
    });
  });
});

describe('pi 图片交付（#730）', () => {
  test('失败方式 3：DeliveredImage → pi ImageContent 映射', () => {
    const out = toPiImages([IMG]);
    expect(out).toEqual([{ type: 'image', data: 'aW1n', mimeType: 'image/png' }]);
  });

  test('失败方式 3：空数组 → 空数组（调用面判 length 决定是否传）', () => {
    expect(toPiImages([])).toEqual([]);
  });

  test('失败方式 4：ensureImageInput 把 input:["text"] 翻到含 "image"', () => {
    const model = { id: 'm', input: ['text'] as ('text' | 'image')[] };
    ensureImageInput(model);
    expect(model.input).toContain('image');
  });

  test('失败方式 4：已含 "image" 幂等（不重复追加）', () => {
    const model = { id: 'm', input: ['text', 'image'] as ('text' | 'image')[] };
    ensureImageInput(model);
    expect(model.input).toEqual(['text', 'image']);
  });
});
