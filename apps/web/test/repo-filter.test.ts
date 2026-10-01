// #445 看板仓库筛选——纯函数面（解析/命中判定），DOM 无关故 vitest 直测。
// 每条用例钉一个失败方式：
//   parseProjectsParam：缺参/空串/纯分隔符 = 空集（R1）、重复 id 去重（R2）、
//     返回序 = 字典序规范序而非参数书写序（R3，项目无词表，字节序即规范序
//     ——同选集恒同 URL，与点击序/书写序无关）。
//   matchesProjectFilter：空选中集 = 全量（R4）、命中 = projectId 集成员
//     （R5）、多选 = OR 并集（R6）、未知 id（已删项目/脏 URL）不命中也
//     不误配（R7）——与标签轴不同，仓库筛选没有「无仓库任务恒可见」：
//     每张卡必属一个项目，收窄语义就是精确集成员判定。
import { describe, expect, test } from 'vitest';
import { buildRepoOptions, matchesProjectFilter, parseProjectsParam } from '../src/board/repo-filter.js';
import { todo } from './helpers.js';

const inProject = (projectId: string) => ({ ...todo(1, 'todo'), projectId });

describe('parseProjectsParam（URL ?projects= 解析）', () => {
  test('缺参/空串/纯分隔符 = 空选（R1）', () => {
    expect(parseProjectsParam(null)).toEqual([]);
    expect(parseProjectsParam('')).toEqual([]);
    expect(parseProjectsParam(',')).toEqual([]);
  });

  test('重复 id 去重（R2）', () => {
    expect(parseProjectsParam('p1,p1')).toEqual(['p1']);
  });

  test('返回序 = 字典序规范序，与参数书写序无关（R3）', () => {
    expect(parseProjectsParam('zb,ma,ma,ab')).toEqual(['ab', 'ma', 'zb']);
  });
});

describe('matchesProjectFilter（命中判定，精确集成员 + OR 并集）', () => {
  const a = inProject('p-a');
  const b = inProject('p-b');

  test('空选中集 = 全量可见（R4）', () => {
    expect(matchesProjectFilter(a, new Set())).toBe(true);
    expect(matchesProjectFilter(b, new Set())).toBe(true);
  });

  test('单选收窄：命中所选项的卡可见，其余隐（R5）', () => {
    const sel = new Set(['p-a']);
    expect(matchesProjectFilter(a, sel)).toBe(true);
    expect(matchesProjectFilter(b, sel)).toBe(false);
  });

  test('多选 = OR 并集（R6）', () => {
    const sel = new Set(['p-a', 'p-b']);
    expect(matchesProjectFilter(a, sel)).toBe(true);
    expect(matchesProjectFilter(b, sel)).toBe(true);
  });

  test('未知 id（已删项目/脏 URL）不命中任何卡（R7）', () => {
    expect(matchesProjectFilter(a, new Set(['p-gone']))).toBe(false);
    // 混合：已知 + 未知共存 = 按已知的判（并集语义）
    expect(matchesProjectFilter(a, new Set(['p-gone', 'p-a']))).toBe(true);
    expect(matchesProjectFilter(b, new Set(['p-gone', 'p-a']))).toBe(false);
  });
});

describe('buildRepoOptions（XMON-57 选项集与计数）', () => {
  const entries = [
    { id: 'p-a', name: 'A' },
    { id: 'p-b', name: 'B' },
    { id: 'p-quiet', name: 'Quiet' },
  ];
  const todos = [
    { ...todo(1, 'todo'), projectId: 'p-a' },
    { ...todo(2, 'todo'), projectId: 'p-b' },
    { ...todo(3, 'todo'), projectId: 'p-b' },
  ];

  test('行的序 = 来源序（项目无静态全序，不在这里另排）', () => {
    expect(buildRepoOptions(entries, todos, () => true).map((o) => o.id)).toEqual([
      'p-a',
      'p-b',
      'p-quiet',
    ]);
  });

  test('计数 = 另一轴收窄后的卡数；本轴自身不参与，零卡项目计数为 0', () => {
    expect(buildRepoOptions(entries, todos, () => true).map((o) => o.count)).toEqual([1, 2, 0]);
    expect(
      buildRepoOptions(entries, todos, (t) => t.projectId === 'p-b').map((o) => o.count),
    ).toEqual([0, 2, 0]);
  });

  test('作用域里没有项目源 = 空选项（面板渲染空态行，不是消失）', () => {
    expect(buildRepoOptions([], todos, () => true)).toEqual([]);
  });
});
