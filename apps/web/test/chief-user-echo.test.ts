// #667 总管抽屉每回合双用户气泡——POST 行与 daemon transcript 回声行同文
// 双落库，读侧（mapChiefStream）按「id 前缀 + 内容孪生」去重（mapper 缝；
// 渲染缝的钉在 e2e/chief-stream-markdown.spec.ts）。
// 失败方式先行枚举：
//   F-C1 同文双行（POST + user-<stepId> 回声）渲染两个用户气泡（bug 本体）
//   F-C2 去重塌过头：两轮各发同文 → 只剩一条（应恰两条，各自 POST 行渲染）
//   F-C3 连发不同文被去重（应各一条）
//   F-C4 wake 回声行（无 POST 孪生）被误删（wake 轮呈现面零变化）
//   F-C5 steer 同文（两条 POST + 两条回声）被塌成一条（应恰两条）
//   F-C6 同毫秒并列 + 尾空白差异逃过全等（比对免序、与渲染同源 trim）
//   F-C7 去重误伤非前缀行：两条非 user- 同文行被去重（判别位 = id 前缀）
//
// 行 id 形（生产对齐）：POST 行 = newRecordId() 21 字符随机无前缀；回声行 =
// `user-<stepId>`（daemon runner.ts，TranscriptBuffer 幂等键）。

import { describe, expect, test } from 'vitest';
import { mapChiefStream, type MessageRow } from '../src/api/mappers.js';
import type { ChiefStreamItem } from '../src/fixtures/records.js';

const NOW = 1_758_000_000_000;

function row(id: string, role: MessageRow['role'], content: unknown, at = NOW): MessageRow {
  return { id, role, content, createdAt: at };
}

function userItems(items: ChiefStreamItem[]) {
  return items.filter((i): i is Extract<ChiefStreamItem, { kind: 'user' }> => i.kind === 'user');
}

describe('mapChiefStream 回声行去重（#667 F-C1..C7）', () => {
  test('F-C1 POST 行 + user-<stepId> 回声行同文 → 恰一个用户气泡（正本 = POST 行 id）', () => {
    const items = mapChiefStream([
      row('AbCdEfGhIjKlMnOpQrStU', 'user', '帮我写 CONTRIBUTING.md', NOW),
      row('user-LFnKO1KhDH4F1HylsEAfY', 'user', '帮我写 CONTRIBUTING.md', NOW + 3000),
      row('msg-a1', 'assistant', '已创建任务并派工', NOW + 9000),
    ]);
    const users = userItems(items);
    expect(users).toHaveLength(1);
    expect(users[0]?.text).toBe('帮我写 CONTRIBUTING.md');
    // rewind 锚位留在正本（POST）行上。
    expect(users[0]?.id).toBe('AbCdEfGhIjKlMnOpQrStU');
  });

  test('F-C2 两轮各发同文 → 恰两个用户气泡（回声各自去重，POST 都渲染）', () => {
    const items = mapChiefStream([
      row('AbCdEfGhIjKlMnOpQrStU', 'user', '继续', NOW),
      row('user-LFnKO1KhDH4F1HylsEAfY', 'user', '继续', NOW + 100),
      row('msg-r1', 'assistant', '第一轮完成', NOW + 9000),
      row('ZxYwVuTsRqPoNmLkJiHgFe', 'user', '继续', NOW + 20000),
      row('user-MnBvCxZlKjHgFeDcSaPoN', 'user', '继续', NOW + 20100),
      row('msg-r2', 'assistant', '第二轮完成', NOW + 29000),
    ]);
    const users = userItems(items);
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.id)).toEqual(['AbCdEfGhIjKlMnOpQrStU', 'ZxYwVuTsRqPoNmLkJiHgFe']);
  });

  test('F-C3 连发两条不同内容 → 各显示一条（防过度去重）', () => {
    const items = mapChiefStream([
      row('AbCdEfGhIjKlMnOpQrStU', 'user', '总结项目进展', NOW),
      row('user-LFnKO1KhDH4F1HylsEAfY', 'user', '总结项目进展', NOW + 100),
      row('ZxYwVuTsRqPoNmLkJiHgFe', 'user', '再查一下 token 用量', NOW + 20000),
      row('user-MnBvCxZlKjHgFeDcSaPoN', 'user', '再查一下 token 用量', NOW + 20100),
    ]);
    const users = userItems(items);
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.text)).toEqual(['总结项目进展', '再查一下 token 用量']);
  });

  test('F-C4 wake 回声行（无 POST 孪生）保留且剥离 marker——呈现 remainder', () => {
    const items = mapChiefStream([
      row('user-LFnKO1KhDH4F1HylsEAfY', 'user', '[wake:settle] 任务 #5「修复」已合并完成', NOW),
      row('msg-r1', 'assistant', '已确认落地', NOW + 9000),
    ]);
    const users = userItems(items);
    expect(users).toHaveLength(1);
    expect(users[0]?.text).toBe('任务 #5「修复」已合并完成');
    expect(users[0]?.text).not.toContain('[wake:');
  });

  test('F-C5 steer 同文（两条 POST + 两条回声）→ 恰两条（真实动作各渲染一次）', () => {
    const items = mapChiefStream([
      row('AbCdEfGhIjKlMnOpQrStU', 'user', '继续', NOW),
      row('user-LFnKO1KhDH4F1HylsEAfY', 'user', '继续', NOW + 100),
      row('ZxYwVuTsRqPoNmLkJiHgFe', 'user', '继续', NOW + 2000),
      row('user-MnBvCxZlKjHgFeDcSaPoN', 'user', '继续', NOW + 2100),
    ]);
    const users = userItems(items);
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.id)).toEqual(['AbCdEfGhIjKlMnOpQrStU', 'ZxYwVuTsRqPoNmLkJiHgFe']);
  });

  test('F-C6 同毫秒并列 + 回声行带尾空白 + 回声行先出现 → 仍去重（比对免序、同源 trim）', () => {
    const items = mapChiefStream([
      row('user-LFnKO1KhDH4F1HylsEAfY', 'user', '派一下\n', NOW),
      row('AbCdEfGhIjKlMnOpQrStU', 'user', '派一下', NOW),
    ]);
    const users = userItems(items);
    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe('AbCdEfGhIjKlMnOpQrStU');
  });

  test('F-C7 两条非 user- 同文行不去重（判别位 = id 前缀，不是内容邻接）', () => {
    const items = mapChiefStream([
      row('AbCdEfGhIjKlMnOpQrStU', 'user', '继续', NOW),
      row('ZxYwVuTsRqPoNmLkJiHgFe', 'user', '继续', NOW + 100),
    ]);
    expect(userItems(items)).toHaveLength(2);
  });
});

describe('mapChiefStream 内部 marker 剥离（#778 F-W1..W6）', () => {
  test('F-W1 同族四种（gate/settle/failed/wake）前导 marker 都剥', () => {
    for (const kind of ['gate', 'settle', 'failed', 'wake']) {
      const items = mapChiefStream([
        row('user-stepW', 'user', `[wake:${kind}] 任务 #5 已合并完成`, NOW),
      ]);
      const users = userItems(items);
      expect(users).toHaveLength(1);
      expect(users[0]?.text).toBe('任务 #5 已合并完成');
      expect(users[0]?.markdown).toBe('任务 #5 已合并完成');
    }
  });

  test('F-W2 纯 marker 行（无 remainder）不渲染', () => {
    const items = mapChiefStream([
      row('user-stepW', 'user', '[wake:gate]', NOW),
      row('msg-r1', 'assistant', '已确认落地', NOW + 9000),
    ]);
    expect(userItems(items)).toHaveLength(0);
  });

  test('F-W3 句中 marker 保留（只剥前导一次）', () => {
    const items = mapChiefStream([row('u-post-1', 'user', '任务 [wake:gate] 别动', NOW)]);
    expect(userItems(items)[0]?.text).toBe('任务 [wake:gate] 别动');
  });

  test('F-W4 POST 行与 wake 回声行同 remainder → 恰一条（去重键吃剥离后文本）', () => {
    const items = mapChiefStream([
      row('AbCdEfGhIjKlMnOpQrStU', 'user', '任务 #5 已合并完成', NOW),
      row('user-LFnKO1KhDH4F1HylsEAfY', 'user', '[wake:settle] 任务 #5 已合并完成', NOW + 100),
    ]);
    const users = userItems(items);
    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe('AbCdEfGhIjKlMnOpQrStU');
  });

  test('F-W5 assistant 行不动（协议 token 永不经该面产生）', () => {
    const items = mapChiefStream([
      row('msg-r1', 'assistant', '[wake:gate] 是内部触发标记', NOW),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'robot',
      markdown: '[wake:gate] 是内部触发标记',
    });
  });

  test('F-W6 POST 行前导 marker 同剥（用户可见边界统一）', () => {
    const items = mapChiefStream([row('u-post-1', 'user', '[wake:gate] 帮我查一下', NOW)]);
    expect(userItems(items)[0]?.text).toBe('帮我查一下');
  });
});
