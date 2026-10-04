// 发送后 skill 路由（#823 纠正方向：收单之后 agent 侧自动检测，输入时 UI
// 一个不动）——纯匹配函数契约。首批两规则：显式点名（用户报出已装技能名，
// 精确最高优先）与提醒意图（时间表达 + 提醒动词双信号）。第一失败方式是普通
// 对话被劫持：凡不命中一律 null（调用方 = 不附加任何提示），误触发必须可逆
// （提示节恒为"建议"，agent 先核对再用）。
import { describe, expect, it } from 'vitest';
import {
  formatSkillRouteSection,
  type SkillRouteHint,
  suggestSkillsForMessage,
} from '../src/index.js';

const installed = [
  { id: 'translator', name: 'translator', description: '中英互译，翻译文档与段落' },
  { id: 'morning-reminder', name: 'morning-reminder', description: '定时提醒与日程通知' },
];

describe('普通对话零命中（第一失败方式：不劫持）', () => {
  it('寒暄/闲聊无提示', () => {
    expect(suggestSkillsForMessage('你好，今天过得怎么样？', installed)).toBeNull();
  });
  it('有时间词但无提醒意图 → 无提示', () => {
    expect(suggestSkillsForMessage('明天的会议纪要帮我整理一下', installed)).toBeNull();
    expect(suggestSkillsForMessage('下周的计划是先把登录页做完', installed)).toBeNull();
  });
  it('有提醒词但无时间表达 → 无提示', () => {
    expect(suggestSkillsForMessage('记得把门带上', installed)).toBeNull();
  });
  it('空串/空白无提示', () => {
    expect(suggestSkillsForMessage('   ', installed)).toBeNull();
    expect(suggestSkillsForMessage('', [])).toBeNull();
  });
  it('系统触发 prompt（[wake:…] 前缀）永不提示', () => {
    expect(suggestSkillsForMessage('[wake:settle] 明天提醒我汇报', installed)).toBeNull();
  });
});

describe('提醒意图（时间表达 + 提醒动词双信号）', () => {
  it('用户原话即触发：明早 9 点提醒我', () => {
    const hint = suggestSkillsForMessage('明早 9 点提醒我', installed);
    expect(hint?.ruleId).toBe('reminder');
    expect(hint?.skills.map((s) => s.id)).toEqual(['morning-reminder']);
  });
  it('全半角/标点归一后同样触发', () => {
    expect(suggestSkillsForMessage('明早９点，提醒我！', installed)?.ruleId).toBe('reminder');
    expect(suggestSkillsForMessage('每天早上八点叫我起床', installed)?.ruleId).toBe('reminder');
  });
  it('未装提醒类技能 → 技能空集但给内置能力回落（用户原话开箱可用）', () => {
    const hint = suggestSkillsForMessage('明早 9 点提醒我', [
      { id: 'translator', name: 'translator', description: '中英互译' },
    ]);
    expect(hint?.ruleId).toBe('reminder');
    expect(hint?.skills).toEqual([]);
    expect(hint?.toolHint).toContain('set_wake');
  });
  it('装有提醒类技能 → 同时点名技能与内置能力', () => {
    const hint = suggestSkillsForMessage('明早 9 点提醒我', installed);
    expect(hint?.toolHint).toContain('set_wake');
  });
});

describe('显式点名已装技能（精度最高，优先于意图规则）', () => {
  it('报出技能名即命中该技能', () => {
    const hint = suggestSkillsForMessage('用 translator 帮我翻一下这段', installed);
    expect(hint?.ruleId).toBe('explicit-mention');
    expect(hint?.skills.map((s) => s.id)).toEqual(['translator']);
  });
  it('中文名同样命中', () => {
    const zh = [{ id: 's1', name: '周报助手', description: '帮你写周报' }];
    const hint = suggestSkillsForMessage('喊周报助手出来写一下', zh);
    expect(hint?.skills.map((s) => s.id)).toEqual(['s1']);
  });
  it('点名未安装的名字 → null（不编造）', () => {
    expect(suggestSkillsForMessage('用 pdf-polish 排一下版', installed)).toBeNull();
  });
  it('单字名不参与点名（防单字误配）', () => {
    const one = [{ id: 'x', name: 'x', description: '占位' }];
    expect(suggestSkillsForMessage('x 是什么', one)).toBeNull();
  });
});

describe('提示节文案（误触发可逆：恒为建议）', () => {
  it('含候选技能 id + description + 先核对再用', () => {
    const hint = suggestSkillsForMessage('明早 9 点提醒我', installed);
    expect(hint?.ruleId).toBe('reminder');
    const section = formatSkillRouteSection(hint as SkillRouteHint);
    expect(section).toContain('morning-reminder');
    expect(section).toContain('定时提醒与日程通知');
    expect(section).toContain('set_wake');
    expect(section).toMatch(/核对|不切合.*忽略|仅建议/);
  });
  it('普通对话的 null 不产出任何节', () => {
    expect(suggestSkillsForMessage('你好', installed)).toBeNull();
  });
});
