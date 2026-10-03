// 审核关口人肉打回的续轮指令（#701）：外部行为 = 「打回后重规划步收到什么
// 指令、transcript 过滤面怎么对待它」，不是字符串拼法。失败方式枚举先于实现
// 固化（AGENTS.md 测试规则 3）：
//   1. 过滤面击穿：合成指令行没进 classifyUserText 词表 → 它以用户气泡冒名
//      顶替（#612 立的就是这条单源）；
//   2. 反馈丢失：feedback 没内嵌进指令 → 重规划轮不知道改什么（用户原文另有
//      独立 wire 行，但续轮 prompt 是 agent 的工作指令）；
//   3. 产物孤儿化措辞：指令没交代「改动仍在会话分支上、不丢弃」→ agent 重开
//      炉灶，旧改动被无视（票面失败方式 3 的 prompt 半边）；
//   4. 与 confirm 关口驳回模板混用：两关口的事实不同（review 已产出改动），
//      措辞必须分词，但都归同一族「忠实按反馈调整方案」。

import { describe, expect, test } from 'vitest';
import {
  buildReplanPrompt,
  buildReviewRejectPrompt,
  classifyUserText,
} from '../src/records/prompts.js';

const TASK = { title: 'gate', spec: 'body' };
const FEEDBACK = '关闭按钮挪到左边，文案改成「返回」';

describe('buildReviewRejectPrompt（#701 审核关口打回续轮指令）', () => {
  test('FM2：feedback 逐字内嵌', () => {
    expect(buildReviewRejectPrompt(FEEDBACK)).toContain(FEEDBACK);
  });

  test('FM3：指令交代既有改动保留在会话分支、不丢弃', () => {
    const prompt = buildReviewRejectPrompt(FEEDBACK);
    expect(prompt).toContain('会话分支');
  });

  test('FM4：与 confirm 关口驳回模板分词（事实不同，措辞不同）', () => {
    expect(buildReviewRejectPrompt(FEEDBACK)).not.toBe(buildReplanPrompt(FEEDBACK));
  });

  test('FM1：合成行进 classifyUserText 词表 = synthetic，不冒充用户气泡', () => {
    expect(classifyUserText(buildReviewRejectPrompt(FEEDBACK), TASK)).toBe('synthetic');
    // 用户 feedback 原文照常是 user（它是独立 wire 行，要渲染）。
    expect(classifyUserText(FEEDBACK, TASK)).toBe('user');
    // confirm 关口模板不回归。
    expect(classifyUserText(buildReplanPrompt(FEEDBACK), TASK)).toBe('synthetic');
  });
});
