// #728 内联补全 primitive——对齐 Claude Code 行为正典（#727 §1，源
// v2.1.285 bundle：wCt 触发正则 / kCt 左边界类 / CBt 模糊索引 / CN=15 cap）。
// 每条用例钉票面「先列失败方式」清单里的一项：
//   detectCompletionToken：
//     D1 词中/邮箱误触发（失败方式 2：`foo@`、`a@b.com` 现状会弹）
//     D2 左边界字符集（rules 1-3：行首 / 空白 / CJK 标点 `。、？！`）
//     D3 caret 纯移动离开 token（失败方式 3：现状仅 change 事件重判）
//     D4 退格边界 off-by-one（失败方式 7：删 query 末字符留、删过 @ 关）
//     D5 token 字符集外字符终止（rule 5/34：空格、逗号关闭）
//   fuzzyFilter：
//     F1 子序列匹配非前缀（rule 15）
//     F2 smart case（rule 17：全小写不敏感、含大写敏感）
//     F3 分隔符/camel 边界加分排序（rule 18）
//     F4 cap 15（rules 8/14，CN=15）
//     F5 空 query 列全部（roster 序，rule 13 同构）
//   completionKeyIntent：
//     K1 Enter 有高亮 = accept 不发送（rule 21/23，r9 §5 已知冲突的修复面）
//     K2 Enter 无高亮/列表关 = ignore（调用方照常发送，失败方式 1：
//        composer-wire-reject 族的键盘发送不得回归）
//     K3 Tab = accept 高亮项，无高亮 accept 顶项（rule 22/56）
//     K4 ↑↓ 循环移动（rule 20 + 票面「循环」）
//     K5 IME 组合态全 ignore（失败方式 8）
//     K6 Esc = dismiss（rule 32）
//     K7 空结果集：Tab/↑↓ ignore（不劫持焦点导航）、Esc 仍 dismiss
import { describe, expect, test } from 'vitest';
import {
  completionKeyIntent,
  type CompletionNavState,
  COMPLETION_CAP,
  cycleHighlight,
  detectCompletionToken,
  fuzzyFilter,
  MENTION_COMPLETION_SPEC,
} from '../src/overlay/completion.js';

const detect = (value: string, caret: number) =>
  detectCompletionToken(value, caret, MENTION_COMPLETION_SPEC);

interface Item {
  id: string;
  label: string;
}
const items = (...labels: string[]): Item[] => labels.map((label, i) => ({ id: `a${i}`, label }));
const labels = (list: Item[]) => list.map((i) => i.label);
const labelOf = (i: Item) => i.label;

describe('detectCompletionToken（@ 触发边界，正典 rules 1-5）', () => {
  test('行首 @ 触发，query = @ 后到 caret 的文本（D2/rule 1）', () => {
    expect(detect('@bu', 3)).toEqual({ start: 0, end: 3, query: 'bu' });
    expect(detect('@', 1)).toEqual({ start: 0, end: 1, query: '' });
  });

  test('空白后触发：空格 / 换行 / tab（D2/rule 1）', () => {
    expect(detect('hello @bu', 9)).toEqual({ start: 6, end: 9, query: 'bu' });
    expect(detect('line1\n@bu', 9)).toEqual({ start: 6, end: 9, query: 'bu' });
    expect(detect('a\t@b', 4)).toEqual({ start: 2, end: 4, query: 'b' });
  });

  test('CJK 标点后触发：。、？！（D2/rule 1，kCt 字符集逐字移植）', () => {
    expect(detect('好的。@bu', 6)).toEqual({ start: 3, end: 6, query: 'bu' });
    expect(detect('一、@x', 4)).toEqual({ start: 2, end: 4, query: 'x' });
    expect(detect('真的？@x', 5)).toEqual({ start: 3, end: 5, query: 'x' });
    expect(detect('走了！@x', 5)).toEqual({ start: 3, end: 5, query: 'x' });
  });

  test('词中 @ 不触发：foo@ / 邮箱 a@b.com（D1/rules 2-3，现状缺陷钉死）', () => {
    expect(detect('foo@', 4)).toBeNull();
    expect(detect('foo@bu', 6)).toBeNull();
    expect(detect('a@b.com', 7)).toBeNull();
    expect(detect('mail me at a@b.com ok', 21)).toBeNull();
    // `@` 前是 `(` 等非边界标点也不触发（boundary 类外）
    expect(detect('(@bu', 4)).toBeNull();
  });

  test('caret 不在 token 尾部 = 无 token：纯移动离开即关（D3/rule 33）', () => {
    // caret 在 @ 之前
    expect(detect('hello @bu', 6)).toBeNull();
    // caret 在 token 后的空格之后
    expect(detect('hello @bu world', 15)).toBeNull();
    // caret = 0
    expect(detect('@bu', 0)).toBeNull();
  });

  test('caret 落 token 中段：以 caret 截断重判（D3）', () => {
    expect(detect('hello @bu', 8)).toEqual({ start: 6, end: 8, query: 'b' });
    expect(detect('hello @bu rest', 9)).toEqual({ start: 6, end: 9, query: 'bu' });
  });

  test('退格边界：删 query 末字符留在弹层，删过 @ 关闭（D4/失败方式 7）', () => {
    expect(detect('hello @b', 8)).toEqual({ start: 6, end: 8, query: 'b' });
    expect(detect('hello @', 7)).toEqual({ start: 6, end: 7, query: '' });
    expect(detect('hello ', 6)).toBeNull();
  });

  test('token 字符集外字符终止 token：空格 / 逗号（D5/rules 5+34）', () => {
    expect(detect('hello @bu ', 10)).toBeNull();
    expect(detect('hello @bu,', 10)).toBeNull();
    expect(detect('hello @bu*', 10)).toBeNull();
  });

  test('token 字符集逐字移植：字母数字 _-./\\()[]~: 与 CJK（rule 5）', () => {
    expect(detect('@a.b-c_d/e~f:g', 14)).toEqual({ start: 0, end: 14, query: 'a.b-c_d/e~f:g' });
    expect(detect('@a(i)[j]\\k', 10)).toEqual({ start: 0, end: 10, query: 'a(i)[j]\\k' });
    expect(detect('@建设 agent', 3)).toEqual({ start: 0, end: 3, query: '建设' });
  });

  test('序列化 mention 不误触发：[label](agent:id) 无 @，label 含 @ 时左邻是 [（D1 邻接面）', () => {
    expect(detect('hi [builder](agent:a1)', 22)).toBeNull();
    expect(detect('hi [@foo](agent:a1)', 19)).toBeNull();
  });
});

describe('fuzzyFilter（子序列 + smart case + 边界加分 + cap，正典 rules 14-18）', () => {
  test('空 query 列全部，roster 序保持（F5/rule 13 同构）', () => {
    expect(labels(fuzzyFilter('', items('builder', 'reviewer', 'deploy-bot'), labelOf))).toEqual([
      'builder',
      'reviewer',
      'deploy-bot',
    ]);
  });

  test('子序列匹配非前缀：bld 命中 builder（F1/rule 15）', () => {
    expect(labels(fuzzyFilter('bld', items('builder', 'reviewer', 'deploy-bot'), labelOf))).toEqual([
      'builder',
    ]);
  });

  test('非子序列不命中（F1）', () => {
    expect(fuzzyFilter('zzz', items('builder', 'reviewer'), labelOf)).toEqual([]);
  });

  test('smart case：全小写 query 大小写不敏感（F2/rule 17）', () => {
    expect(labels(fuzzyFilter('bu', items('Builder', 'builder-x'), labelOf))).toEqual([
      'Builder',
      'builder-x',
    ]);
  });

  test('smart case：含大写 query 大小写敏感（F2/rule 17）', () => {
    expect(labels(fuzzyFilter('Bu', items('Builder', 'builder'), labelOf))).toEqual(['Builder']);
    expect(fuzzyFilter('BUILD', items('builder'), labelOf)).toEqual([]);
  });

  test('分隔符边界加分排在词中匹配前（F3/rule 18，Qr=8）', () => {
    // query "b"：a-b 的 b 在 `-` 后（+8）、b1 的 b 在行首（+8）、ab 的 b 词中（+0）
    // 同分保持 roster 序（stable sort）。
    expect(labels(fuzzyFilter('b', items('ab', 'a-b', 'b1'), labelOf))).toEqual(['a-b', 'b1', 'ab']);
  });

  test('camelCase 边界加分（F3/rule 18，Gu=6）', () => {
    // query "am"：abMain 的 m 是 camel 边界（b→M），abmain 的 m 词中。
    expect(labels(fuzzyFilter('am', items('abmain', 'abMain'), labelOf))).toEqual([
      'abMain',
      'abmain',
    ]);
  });

  test('连续命中加分：连跑段优于分散命中（F3 派生）', () => {
    // query "ui"：xuid 的 u,i 连跑（i 得连续加分）；xuqi 的分散命中无加分。
    expect(labels(fuzzyFilter('ui', items('xuqi', 'xuid'), labelOf))).toEqual(['xuid', 'xuqi']);
  });

  test('分隔符加分量级压过连续加分（F3/rule 18，Qr=8 > run=2）', () => {
    // query "ui"：xu-i 的 i 在 `-` 后（+8）胜过 xuid 的 i 连续加分（+2）。
    expect(labels(fuzzyFilter('ui', items('xuid', 'xu-i'), labelOf))).toEqual(['xu-i', 'xuid']);
  });

  test('cap = 15（F4/rules 8+14，CN=15）', () => {
    const many = items(...Array.from({ length: 20 }, (_, i) => `agent-${String(i).padStart(2, '0')}`));
    expect(fuzzyFilter('', many, labelOf)).toHaveLength(COMPLETION_CAP);
    expect(fuzzyFilter('agent', many, labelOf)).toHaveLength(COMPLETION_CAP);
    expect(COMPLETION_CAP).toBe(15);
  });
});

describe('cycleHighlight（↑↓ 循环，票面 K4）', () => {
  test('null 起步：下 → 首项，上 → 末项', () => {
    expect(cycleHighlight(null, 1, 3)).toBe(0);
    expect(cycleHighlight(null, -1, 3)).toBe(2);
  });

  test('两端回绕', () => {
    expect(cycleHighlight(2, 1, 3)).toBe(0);
    expect(cycleHighlight(0, -1, 3)).toBe(2);
    expect(cycleHighlight(1, 1, 3)).toBe(2);
  });

  test('越界 highlight（候选收缩后陈旧）按 null 处理', () => {
    expect(cycleHighlight(7, 1, 3)).toBe(0);
  });
});

describe('completionKeyIntent（键盘语义，正典 rules 20-23/32/55-56）', () => {
  const open3: CompletionNavState = { open: true, highlight: null, matchCount: 3 };
  const openH1: CompletionNavState = { open: true, highlight: 1, matchCount: 3 };

  test('列表关：一律 ignore——Enter 交回调用方发送（K2/失败方式 1）', () => {
    const closed: CompletionNavState = { open: false, highlight: null, matchCount: 0 };
    expect(completionKeyIntent({ key: 'Enter' }, closed)).toEqual({ kind: 'ignore' });
    expect(completionKeyIntent({ key: 'ArrowDown' }, closed)).toEqual({ kind: 'ignore' });
    expect(completionKeyIntent({ key: 'Tab' }, closed)).toEqual({ kind: 'ignore' });
    expect(completionKeyIntent({ key: 'Escape' }, closed)).toEqual({ kind: 'ignore' });
  });

  test('Enter 有高亮 = accept 不发送（K1/rule 21+23，r9 §5 冲突修复）', () => {
    expect(completionKeyIntent({ key: 'Enter' }, openH1)).toEqual({ kind: 'accept', index: 1 });
  });

  test('Enter 无高亮 = ignore（发送照旧，rule 55/56 同构）', () => {
    expect(completionKeyIntent({ key: 'Enter' }, open3)).toEqual({ kind: 'ignore' });
  });

  test('Shift+Enter 永远 ignore（换行语义不动）', () => {
    expect(completionKeyIntent({ key: 'Enter', shiftKey: true }, openH1)).toEqual({
      kind: 'ignore',
    });
  });

  test('Tab = accept 高亮项；无高亮 accept 顶项（K3/rule 22+56）', () => {
    expect(completionKeyIntent({ key: 'Tab' }, openH1)).toEqual({ kind: 'accept', index: 1 });
    expect(completionKeyIntent({ key: 'Tab' }, open3)).toEqual({ kind: 'accept', index: 0 });
  });

  test('↑↓ 循环移动高亮（K4/rule 20）', () => {
    expect(completionKeyIntent({ key: 'ArrowDown' }, open3)).toEqual({ kind: 'navigate', index: 0 });
    expect(completionKeyIntent({ key: 'ArrowUp' }, open3)).toEqual({ kind: 'navigate', index: 2 });
    expect(completionKeyIntent({ key: 'ArrowDown' }, openH1)).toEqual({
      kind: 'navigate',
      index: 2,
    });
    expect(completionKeyIntent({ key: 'ArrowUp' }, { ...openH1, highlight: 0 })).toEqual({
      kind: 'navigate',
      index: 2,
    });
  });

  test('IME 组合态：Enter/↑↓/Tab/Esc 全 ignore（K5/失败方式 8）', () => {
    for (const key of ['Enter', 'ArrowDown', 'ArrowUp', 'Tab', 'Escape']) {
      expect(completionKeyIntent({ key, isComposing: true }, openH1)).toEqual({ kind: 'ignore' });
    }
  });

  test('Esc = dismiss（K6/rule 32）', () => {
    expect(completionKeyIntent({ key: 'Escape' }, open3)).toEqual({ kind: 'dismiss' });
    expect(completionKeyIntent({ key: 'Escape' }, openH1)).toEqual({ kind: 'dismiss' });
  });

  test('空结果集：Tab/↑↓ ignore（焦点导航不被劫持），Esc 仍 dismiss（K7）', () => {
    const empty: CompletionNavState = { open: true, highlight: null, matchCount: 0 };
    expect(completionKeyIntent({ key: 'Tab' }, empty)).toEqual({ kind: 'ignore' });
    expect(completionKeyIntent({ key: 'ArrowDown' }, empty)).toEqual({ kind: 'ignore' });
    expect(completionKeyIntent({ key: 'Enter' }, empty)).toEqual({ kind: 'ignore' });
    expect(completionKeyIntent({ key: 'Escape' }, empty)).toEqual({ kind: 'dismiss' });
  });

  test('其余键不劫持（打字/退格走 change 重判路径）', () => {
    expect(completionKeyIntent({ key: 'a' }, openH1)).toEqual({ kind: 'ignore' });
    expect(completionKeyIntent({ key: 'Backspace' }, openH1)).toEqual({ kind: 'ignore' });
    expect(completionKeyIntent({ key: 'ArrowLeft' }, openH1)).toEqual({ kind: 'ignore' });
  });
});
