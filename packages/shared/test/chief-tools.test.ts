// Chief remoteTools 词表对拍（M4a）：49 键集 = r5 §3.1 一手来源
// `docs/research/assets/r5/raw/chief-threads-testA.json` 的 toolDefHashes 全键
// （名单实测；description/parameters 细形 [推断] 黑盒逼近，04 §1 A4 边界——
// 本测试只钉「名单与分组」的实测面，不为 [推断] 细形背书）。

import { describe, expect, it } from 'vitest';
import {
  CHIEF_REBIND_CONFIRM_COPY,
  CHIEF_REMOTE_TOOLS,
  CHIEF_SETTINGS_TABS,
  CHIEF_TOOL_CATEGORIES,
  CHIEF_TOOL_COUNT,
  CHIEF_TOOL_NAMES,
  CHIEF_WATCHES_EMPTY_COPY,
  chiefIdFormat,
  isChiefConversationId,
  machineToolRelayBodySchema,
  machineToolRelayResponseSchema,
  newChiefThreadId,
  remoteToolDefSchema,
} from '../src/index.js';

/** r5 §3.1 一手来源 = `docs/research/assets/r5/raw/chief-threads-testA.json`
 * 的 toolDefHashes 全键（49 件，已排序原样内嵌；shared 包 node-free 纪律 =
 * 不读 fs，键集冻结在此对拍——改动须回写 raw 与本表）。 */
const RAW_TOOL_DEF_HASH_KEYS = [
  'agents',
  'ask_user',
  'attachment',
  'cancel_builds',
  'clear_wake',
  'close_todos',
  'complete_todos',
  'confirm_builds',
  'connect_repo',
  'conversation',
  'create_agent',
  'create_project',
  'create_todo',
  'delete_agents',
  'delete_memory',
  'delete_secrets',
  'delete_skills',
  'delete_todos',
  'docs',
  'issues',
  'machines',
  'mcp_servers',
  'memories',
  'merge_builds',
  'message_todo',
  'notify_user',
  'projects',
  'pull_requests',
  'reopen_todos',
  'run_builds',
  'run_review',
  'save_memory',
  'schedule_todo',
  'schedules',
  'secrets',
  'set_remote_shell',
  'set_secret',
  'set_wake',
  'skills',
  'todos',
  'unschedule_todo',
  'unwatch_todos',
  'update_agent',
  'update_project',
  'update_todo',
  'usage',
  'wakes',
  'watch_todos',
  'workflow_runs',
];

describe('49 词表（r5 §3.1 toolDefHashes 全键）', () => {
  const rawKeys: string[] = RAW_TOOL_DEF_HASH_KEYS;

  it('raw 键集恰 49 件', () => {
    expect(rawKeys).toHaveLength(CHIEF_TOOL_COUNT);
  });

  it('词表键集 = raw 键集（1:1，无增删改名）', () => {
    expect(CHIEF_TOOL_NAMES).toEqual([...rawKeys].sort());
    expect(CHIEF_REMOTE_TOOLS.map((t) => t.name).sort()).toEqual([...rawKeys].sort());
  });

  it('分组 = 读 15 + 组织 19 + 执行 5 + 私有 10（raw 键集实数；r5 §3.1 正文枚举漏 delete_skills）', () => {
    expect(CHIEF_TOOL_CATEGORIES.read).toHaveLength(15);
    expect(CHIEF_TOOL_CATEGORIES.organize).toHaveLength(19);
    expect(CHIEF_TOOL_CATEGORIES.execute).toHaveLength(5);
    expect(CHIEF_TOOL_CATEGORIES.private).toHaveLength(10);
    expect(CHIEF_TOOL_CATEGORIES.organize).toContain('delete_skills');
  });

  it('读侧全 replaySafe（bundle 提取：读工具带重试预算，r5 §3.1）；写侧不标', () => {
    for (const name of CHIEF_TOOL_CATEGORIES.read) {
      expect(CHIEF_REMOTE_TOOLS.find((t) => t.name === name)?.replaySafe, name).toBe(true);
    }
    for (const name of [...CHIEF_TOOL_CATEGORIES.organize, ...CHIEF_TOOL_CATEGORIES.execute]) {
      expect(CHIEF_REMOTE_TOOLS.find((t) => t.name === name)?.replaySafe, name).toBeUndefined();
    }
    // 私有侧读件（memories/wakes）同 replaySafe。
    expect(CHIEF_REMOTE_TOOLS.find((t) => t.name === 'memories')?.replaySafe).toBe(true);
    expect(CHIEF_REMOTE_TOOLS.find((t) => t.name === 'wakes')?.replaySafe).toBe(true);
    expect(CHIEF_REMOTE_TOOLS.find((t) => t.name === 'save_memory')?.replaySafe).toBeUndefined();
  });

  it('每条过 remoteToolDefSchema（bundle 位形 name/label/description/parameters/replaySafe）', () => {
    for (const def of CHIEF_REMOTE_TOOLS) {
      expect(remoteToolDefSchema.safeParse(def).success, def.name).toBe(true);
      expect(def.description.length, def.name).toBeGreaterThan(0);
    }
  });
});

describe('relay wire（bundle 提取原样，r5 §3.1 raw）', () => {
  it('请求 body = {name, params}', () => {
    expect(
      machineToolRelayBodySchema.parse({ name: 'todos', params: { projectId: 'p1' } }),
    ).toEqual({ name: 'todos', params: { projectId: 'p1' } });
  });

  it('成功响应 = {text}（结果 JSON 串）', () => {
    expect(machineToolRelayResponseSchema.parse({ text: '[]' })).toEqual({ text: '[]' });
  });
});

describe('设置齿轮 canon + id 缝（r5 §2/§3.6，AC3 后端半）', () => {
  it('4 tab 与 chief 记录四字段对应（agent/charter/watches/wakes）', () => {
    expect(CHIEF_SETTINGS_TABS).toEqual(['Agent', '章程', '记忆', '关注与提醒']);
  });

  it('换绑二次确认告示 = r5 §2 原文（记忆不迁移）', () => {
    expect(CHIEF_REBIND_CONFIRM_COPY).toBe(
      '更换总管的 agent？总管的记忆保存在其运行所用的 Agent 上。切换至 <agent> 后，记忆将变为 <agent> 的记忆，当前记忆不会迁移。',
    );
    expect(CHIEF_REBIND_CONFIRM_COPY).toContain('当前记忆不会迁移');
  });

  it('关注与提醒空态 canon（r5 §2）', () => {
    expect(CHIEF_WATCHES_EMPTY_COPY).toContain('暂无跟进事项');
  });

  it('chief id 形 = chief-<userId>-<teamId>；conv id 判别单源', () => {
    expect(chiefIdFormat('u1', 't1')).toBe('chief-u1-t1');
    const threadId = newChiefThreadId('01a0c86f-c1fb-7171-9666-64a3db176b5b');
    expect(threadId).toBe('chief-01a0c86f-c1fb-7171-9666-64a3db176b5b');
    expect(isChiefConversationId(threadId)).toBe(true);
    expect(isChiefConversationId(chiefIdFormat('u1', 't1'))).toBe(true); // 同前缀族
    expect(isChiefConversationId('01a0b86f-04f9-72a8-bba4-75c5cfd6598f')).toBe(false); // worker build
  });
});
