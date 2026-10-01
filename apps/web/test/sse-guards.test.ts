// SSE 对账面（XMON-60）单元面：闸门读的是真查询缓存、对账动作真失效真键。
// 这两件事错了整个兜底就是静默失效（永不触发或恒触发），所以按真 TodoRecord
// 形状 + 真 QueryClient 铺缓存来测，不拿对象字面量糊。

import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { hasInFlightWork, streamGuards } from '../src/api/sse-guards.js';
import { todo } from './helpers.js';

const TEAM = 'team-1';

function clientWith(seed: (qc: QueryClient) => void): QueryClient {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seed(qc);
  return qc;
}

describe('闸门：缓存里还有没有在飞的活', () => {
  it('看板列表查询里有 planning → 开', () => {
    const qc = clientWith((c) =>
      c.setQueryData(['todos', TEAM], [todo(1, 'todo'), todo(2, 'planning')]),
    );
    expect(hasInFlightWork(qc)).toBe(true);
  });

  it('详情单查（todo/id 对象形态，非数组）里有 building → 开', () => {
    const qc = clientWith((c) => c.setQueryData(['todo', 'todo-9'], todo(9, 'building')));
    expect(hasInFlightWork(qc)).toBe(true);
  });

  it('全是在等用户或已终结的相位 → 关（静默是常态，不是故障）', () => {
    const qc = clientWith((c) =>
      c.setQueryData(
        ['todos', TEAM],
        [todo(1, 'todo'), todo(2, 'confirm'), todo(3, 'review'), todo(4, 'done'), todo(5, 'failed')],
      ),
    );
    expect(hasInFlightWork(qc)).toBe(false);
  });

  it('缓存里根本没有 todo 查询 → 关（页面没挂 = 退化到加机制前的行为）', () => {
    const qc = clientWith((c) => c.setQueryData(['machines', TEAM], [{ id: 'm1' }]));
    expect(hasInFlightWork(qc)).toBe(false);
  });

  it('数据还没落地（undefined / 空数组）→ 关', () => {
    const qc = clientWith((c) => c.setQueryData(['todos', TEAM], []));
    expect(hasInFlightWork(qc)).toBe(false);
  });
});

describe('对账动作：失效面', () => {
  it('失效 SSE 相关键的并集，不碰非 SSE 驱动却恒活跃的键', () => {
    const qc = clientWith((c) => c.setQueryData(['todos', TEAM], [todo(1, 'planning')]));
    const spy = vi.spyOn(qc, 'invalidateQueries');

    streamGuards(qc).reconcile();

    const keys = spy.mock.calls.map(([filters]) => (filters?.queryKey as string[])[0]);
    // 两条流的事件处理器会碰的键全在（漏一个 = 那条查询仍然陈旧）
    for (const head of [
      'todos',
      'todo',
      'schedules',
      'build',
      'steps',
      'notifications',
      'chiefThreads',
      'machines',
      'branchSync',
      'messages',
      'plans',
      'changes',
    ]) {
      expect(keys).toContain(head);
    }
    // 非 SSE 驱动：失效它们只是白跑（对账可能重复触发，省的是这些）
    expect(keys).not.toContain('session');
    expect(keys).not.toContain('teams');
    expect(keys).not.toContain('providers');
  });

  it('闸门就是对账面的 inFlight', () => {
    const qc = clientWith((c) => c.setQueryData(['todos', TEAM], [todo(1, 'building')]));
    const guards = streamGuards(qc);
    expect(guards.inFlight()).toBe(true);

    qc.setQueryData(['todos', TEAM], [todo(1, 'confirm')]);
    expect(guards.inFlight()).toBe(false);
  });
});