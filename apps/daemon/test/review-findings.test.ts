// AI 审核步 findings 提取（M7 #330，r8 §3.1）：daemon review-findings.ts
// 从 transcript 最后一条 assistant 消息里解析结构化 verdict JSON。
// 失败方式枚举先于实现固化（AGENTS.md 测试规则 3）：
//   1. happy path：末尾 ```json ... ``` 块 → 解出 verdict（含 blocking）
//   2. happy path：纯文本无 fence，整段 JSON.parse 成功
//   3. fence 解析失败（坏 JSON）→ 回退整段 → 也坏 → null（兜底）
//   4. fence + fence 后还有解释段 → 优先 fence，再退解释段
//   5. 非 review 类内容（user 行 / 工具行）→ null
//   6. assistant 消息但 content 不是文本（toolcall / object）→ null
//   7. 解析成功但 zod 校验失败（缺 conclusion / findings 非数组）→ null
//   8. 空 transcript → null

import { describe, expect, test } from 'vitest';
import { extractReviewVerdict } from '../src/review-findings.js';

// Helper: 用 const 字面量构造 transcript message，避免 role 被宽化成 string。
const userMsg = (content: string) =>
  ({ role: 'user', content }) as { role: 'user'; content: string };
const assistantMsg = (content: unknown) =>
  ({ role: 'assistant', content }) as { role: 'assistant'; content: unknown };

describe('AI 审核 findings 提取（M7 #330）', () => {
  test('happy 1：末尾 ```json ... ``` 块 → 解出 verdict', () => {
    const messages = [
      userMsg('请审核方案'),
      assistantMsg(
        '审核意见已分析。\n\n```json\n' +
          JSON.stringify({
            conclusion: '方案在边界情况有硬风险',
            findings: [
              { id: '1', severity: 'blocking', summary: '空字符串未防御' },
              { id: '2', severity: 'info', summary: '建议补单元测试' },
            ],
          }) +
          '\n```',
      ),
    ];
    const verdict = extractReviewVerdict(messages);
    expect(verdict).not.toBeNull();
    expect(verdict?.conclusion).toBe('方案在边界情况有硬风险');
    expect(verdict?.findings).toHaveLength(2);
    expect(verdict?.findings[0]?.severity).toBe('blocking');
  });

  test('happy 2：无 fence，整段 JSON.parse 成功', () => {
    const messages = [assistantMsg('{"conclusion":"方案通过","findings":[]}')];
    const verdict = extractReviewVerdict(messages);
    expect(verdict).not.toBeNull();
    expect(verdict?.conclusion).toBe('方案通过');
    expect(verdict?.findings).toHaveLength(0);
  });

  test('happy 3：fence 后还有「这是结论」类解释段 → 优先 fence', () => {
    const messages = [
      assistantMsg(
        '我先解释一下整体判断：方案基本可行，但有两点 blocking。\n' +
          '下面是结构化结论：\n```json\n' +
          JSON.stringify({
            conclusion: '需修复两处',
            findings: [{ id: '1', severity: 'blocking', summary: 'X' }],
          }) +
          '\n```\n这就是我的审核意见。',
      ),
    ];
    const verdict = extractReviewVerdict(messages);
    expect(verdict).not.toBeNull();
    expect(verdict?.conclusion).toBe('需修复两处');
    expect(verdict?.findings[0]?.summary).toBe('X');
  });

  test('失败方式 1：fence 坏 JSON + 整段也坏 → null', () => {
    const messages = [assistantMsg('```json\n{not valid}\n``` sorry')];
    expect(extractReviewVerdict(messages)).toBeNull();
  });

  test('失败方式 2：仅 user/工具行（无 assistant）→ null', () => {
    const messages = [userMsg('请审核'), userMsg('继续')];
    expect(extractReviewVerdict(messages)).toBeNull();
  });

  test('失败方式 3：assistant 但 content = 工具调用（无文本）→ null', () => {
    const messages = [
      assistantMsg({ kind: 'toolcall', call: { id: 'c1', name: 'bash', arguments: {} } }),
    ];
    expect(extractReviewVerdict(messages)).toBeNull();
  });

  test('失败方式 4：zod 校验失败（缺 conclusion）→ null', () => {
    const messages = [assistantMsg('{"findings":[]}')];
    expect(extractReviewVerdict(messages)).toBeNull();
  });

  test('失败方式 5：zod 校验失败（findings 非数组）→ null', () => {
    const messages = [assistantMsg('{"conclusion":"x","findings":"oops"}')];
    expect(extractReviewVerdict(messages)).toBeNull();
  });

  test('失败方式 6：zod 校验失败（severity 词外）→ null', () => {
    const messages = [
      assistantMsg(
        '{"conclusion":"x","findings":[{"id":"1","severity":"critical","summary":"y"}]}',
      ),
    ];
    expect(extractReviewVerdict(messages)).toBeNull();
  });

  test('失败方式 7：空 transcript → null', () => {
    expect(extractReviewVerdict([])).toBeNull();
  });

  test('happy 4：content 是 text block 数组（pi 形态）→ 仍能解析', () => {
    const messages = [
      assistantMsg([
        { type: 'text', text: '先解释一下' },
        {
          type: 'text',
          text: `\n\`\`\`json\n${JSON.stringify({ conclusion: '通过', findings: [] })}\n\`\`\``,
        },
      ]),
    ];
    expect(extractReviewVerdict(messages)?.conclusion).toBe('通过');
  });

  test('happy 5：content = {type:"text", text:"…"} 对象（单 block）→ 仍能解析', () => {
    const messages = [assistantMsg({ type: 'text', text: '{"conclusion":"OK","findings":[]}' })];
    expect(extractReviewVerdict(messages)?.conclusion).toBe('OK');
  });

  test('happy 6：多 assistant 消息，只取最后一条', () => {
    const messages = [
      assistantMsg('{"conclusion":"旧结论","findings":[]}'),
      userMsg('继续'),
      assistantMsg(
        '{"conclusion":"新结论","findings":[{"id":"1","severity":"blocking","summary":"x"}]}',
      ),
    ];
    const verdict = extractReviewVerdict(messages);
    expect(verdict?.conclusion).toBe('新结论');
    expect(verdict?.findings[0]?.severity).toBe('blocking');
  });
});
