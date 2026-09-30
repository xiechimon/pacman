// 状态行的输入来源（XMON-18 补）。`agent-status-line.test.ts` 钉的是「helper 拿到
// undefined 之后返回什么」；本文件钉的是**它凭什么会拿到 undefined**——整条真实链路：
//
//   server 响应里缺 createdAt
//     → api/client.ts 的 settle 是 `(await res.json()) as T`（纯类型断言，无运行时校验）
//       → 记录里就是 undefined
//         → 详情页原样把 agent.createdAt 交给状态行
//
// 失败方式清单（先固化场景）：
//   ① 客户端给缺字段的记录凭空补值 —— 补 0 → `1970/1/1`、补 `Date.now()` → 「今天」；
//      客户端一补，helper 的守卫再紧也白搭。本文件钉「原样透传 undefined，不补值」。
//   ② 缺字段被当成错误抛 —— 详情页整页崩，比显示假日期更糟。
//   ③ 有字段时被客户端吞掉 —— 正向控制，防这条链在相反方向静默失效。
//   ④ 端到端两跳合起来才是回归现场：缺字段 + 旧守卫 = 状态行渲染出「今天」的日期
//      （实测 `2026/10/1`）。把守卫退回 `=== null` 时本文件必红——这是它有没有牙的判据。

import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/api/client.js';
import { EN } from '../src/i18n/en.js';
import { translate, type TVars } from '../src/i18n/translate.js';
import { agentStatusLine } from '../src/routes/agent-status-line.js';

const zh = (source: string, vars?: TVars) => translate('zh', EN, source, vars);

/** 桩掉全局 fetch：把「server 响应」原样喂进来（同源 fetch，02/A1）。 */
function stubResponse(body: unknown, status = 200): void {
  vi.stubGlobal('fetch', async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const PATH = '/api/teams/t1/agents/a1';

/** 原版 wire 形状（r5 raw agentActor）减去 `createdAt`——旧 server 的投影长这样。 */
const WIRE_WITHOUT_CREATED_AT = {
  id: 'a1',
  displayName: '旧 server 的 Agent',
  description: null,
  status: 'active',
  avatarUrl: null,
  provider: null,
  modelId: null,
  thinkingLevel: null,
  tools: [],
  secrets: [],
  skills: [],
  mcpServers: [],
};

const CREATED_AT = 1789786840183;

describe('缺字段的响应经 REST 客户端流到状态行', () => {
  it('① 客户端原样透传 undefined——不补 0、不补当前时刻', async () => {
    stubResponse(WIRE_WITHOUT_CREATED_AT);
    const record = (await api.get<{ status: string; createdAt?: number }>(PATH)) as {
      status: string;
      createdAt?: number;
    };
    expect(record.createdAt).toBeUndefined();
    expect(record.createdAt).not.toBe(0); // 补 0 = 状态行出 1970/1/1
  });

  it('② 缺字段不抛错——拿得到的仍是一条可用记录', async () => {
    stubResponse(WIRE_WITHOUT_CREATED_AT);
    await expect(api.get(PATH)).resolves.toMatchObject({ id: 'a1', status: 'active' });
  });

  it('③ 正向控制：响应带 createdAt 时客户端不吞（值原样到手）', async () => {
    stubResponse({ ...WIRE_WITHOUT_CREATED_AT, createdAt: CREATED_AT });
    const record = (await api.get<{ createdAt: number }>(PATH)) as { createdAt: number };
    expect(record.createdAt).toBe(CREATED_AT);
  });

  it('④ 端到端两跳：缺字段 → 状态行只出 status；带字段 → 出日期', async () => {
    stubResponse(WIRE_WITHOUT_CREATED_AT);
    const missing = (await api.get<{ status: string; createdAt?: number }>(PATH)) as {
      status: string;
      createdAt?: number;
    };
    // 详情页就是这么传的：agent.status 与 agent.createdAt 原样进 helper。
    expect(agentStatusLine(missing.status, missing.createdAt, zh)).toBe('active');

    stubResponse({ ...WIRE_WITHOUT_CREATED_AT, createdAt: CREATED_AT });
    const present = (await api.get<{ status: string; createdAt: number }>(PATH)) as {
      status: string;
      createdAt: number;
    };
    expect(agentStatusLine(present.status, present.createdAt, zh)).toBe(
      'active · 创建于 2026/9/19',
    );
  });
});