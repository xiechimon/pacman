// #1025 首轮 plan 步契约指令：plan.md 的产出契约此前只写在纠错提示词里
//（#113 补写轮 / 驳回重规划 / 审核打回 / 失败重启），首个 plan 步 prompt=null、
// agent 只拿到 title+spec——写不写 plan.md 全凭模型自觉（#892 实测 28 build /
// 0 行 plan.md 的结构性根因）。本票把契约提到首轮正典提示词（daemon
// buildTaskPrompt 组合任务文本 + 契约指令，形状 = composeTaskPromptWithInstruction
// 单源），纠错轮保留。外部行为 = 「指令长什么样、组合行呈现层认不认得出」。
// 失败方式枚举先于实现固化（AGENTS.md 测试规则 3）：
//   1. 契约句漂移：指令不含 plan.md 文件名或缺四段名（Context/Changes/
//      Edge cases/Verification）——契约核心缺一即失效
//   2. 组合行冒名用户：classifyUserText 对「任务前缀 + 首轮契约余段」判
//      user（#612 套娃复辟——任务原文与描述区双渲染）
//   3. 裸契约指令行冒名用户（续轮指令单行形，同律退场）
//   4. 误杀真话：任务前缀 + 用户自己话语不是组合行（负例，照常 user）
//   5. 形状漂移：契约组合不等于 composeTaskPromptWithInstruction 单源形状
//      （写侧/过滤侧各拼各的 → 呈现层认不出）

import { describe, expect, test } from 'vitest';
import { PLAN_FILE_NAME } from '../src/records/plan.js';
import {
  buildPlanFirstRoundInstruction,
  buildTaskPromptText,
  classifyUserText,
  composeTaskPromptWithInstruction,
} from '../src/records/prompts.js';

const TITLE = '契约探针';
const SPEC = '首轮规划要被告知 plan.md 契约。';
const TASK_TEXT = buildTaskPromptText(TITLE, SPEC);
const CONTRACT = buildPlanFirstRoundInstruction();

describe('buildPlanFirstRoundInstruction 契约文本（失败方式 1）', () => {
  test('含文件名 + 四段名（与纠错轮同族，逐字对齐）', () => {
    expect(CONTRACT).toContain(PLAN_FILE_NAME);
    expect(CONTRACT).toContain('工作区根目录');
    expect(CONTRACT).toContain('（覆盖 Context/Changes/Edge cases/Verification 四段）');
  });
});

describe('契约组合形状（失败方式 5）', () => {
  test('任务文本在前、契约殿后，空行分隔（compose 单源形状）', () => {
    const composed = composeTaskPromptWithInstruction(TASK_TEXT, CONTRACT);
    expect(composed).toBe(`${TASK_TEXT}\n\n${CONTRACT}`);
    expect(composed.startsWith(TASK_TEXT)).toBe(true);
    expect(composed.endsWith(CONTRACT)).toBe(true);
  });
});

describe('classifyUserText 契约行识别（失败方式 2/3/4）', () => {
  const task = { title: TITLE, spec: SPEC };

  test('组合行（任务前缀 + 首轮契约余段）→ synthetic 整行退场', () => {
    const composed = composeTaskPromptWithInstruction(TASK_TEXT, CONTRACT);
    expect(classifyUserText(composed.trim(), task)).toBe('synthetic');
  });

  test('裸契约指令 → synthetic（单行形同律）', () => {
    expect(classifyUserText(CONTRACT, task)).toBe('synthetic');
  });

  test('任务前缀 + 用户自己话语 → user（不误杀真话）', () => {
    const text = `${TASK_TEXT}\n\n另外移动端也要看一眼`;
    expect(classifyUserText(text.trim(), task)).toBe('user');
  });
});
