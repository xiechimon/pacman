// record 形状 25 表投影（01 §6 表清单 = M2 Drizzle schema 面；03 M1
// 「record 形状（02 §6.2，24 表投影源）」；M4a 回写 +1：`chief` 记录本体
// ——02 §4.3/r5 §3.6 GET /chief 的 chief 字段投影，原清单仅列线程面两表）。
// `todo_tag` 为纯 join 表，无 wire record 形状，不在投影面。

import type { z } from 'zod';
import { agentRecordSchema } from './agent.js';
import { apiKeyRecordSchema } from './api-key.js';
import { buildRecordSchema } from './build.js';
import { chiefRecordSchema, chiefThreadSchema } from './chief.js';
import { documentDiffSchema } from './document-diff.js';
import { machineRecordSchema } from './machine.js';
import { mcpServerRecordSchema } from './mcp-server.js';
import { memoryRecordSchema } from './memory.js';
import { messageRecordSchema } from './message.js';
import { notificationRecordSchema } from './notification.js';
import { planRecordSchema } from './plan.js';
import { projectRecordSchema } from './project.js';
import { providerRecordSchema } from './provider.js';
import { scheduleRecordSchema } from './schedule.js';
import { secretRecordSchema } from './secret.js';
import { skillRecordSchema } from './skill.js';
import { stepRecordSchema } from './step.js';
import { tagRecordSchema } from './tag.js';
import { teamRecordSchema } from './team.js';
import { todoRecordSchema } from './todo.js';
import { tokenUsageSchema } from './token-usage.js';
import { userRecordSchema } from './user.js';
import { whatsNewRecordSchema } from './whats-new.js';

export * from './agent.js';
export * from './api-key.js';
export * from './build.js';
export * from './chief.js';
export * from './common.js';
export * from './document-diff.js';
export * from './machine.js';
export * from './mcp-server.js';
export * from './memory.js';
export * from './message.js';
export * from './notification.js';
export * from './plan.js';
export * from './project.js';
export * from './provider.js';
export * from './schedule.js';
export * from './secret.js';
export * from './skill.js';
export * from './step.js';
export * from './tag.js';
export * from './team.js';
export * from './todo.js';
export * from './token-usage.js';
export * from './user.js';
export * from './whats-new.js';

/** 表名 → record schema（25 张，键序 = 01 §6 清单序；快照测试的遍历源）。 */
export const RECORD_SCHEMAS = {
  user: userRecordSchema,
  team: teamRecordSchema,
  project: projectRecordSchema,
  todo: todoRecordSchema,
  tag: tagRecordSchema,
  build: buildRecordSchema,
  step: stepRecordSchema,
  message: messageRecordSchema,
  plan: planRecordSchema,
  document_diff: documentDiffSchema,
  schedule: scheduleRecordSchema,
  notification: notificationRecordSchema,
  agent: agentRecordSchema,
  agent_memory: memoryRecordSchema,
  skill: skillRecordSchema,
  mcp_server: mcpServerRecordSchema,
  provider: providerRecordSchema,
  secret: secretRecordSchema,
  api_key: apiKeyRecordSchema,
  machine: machineRecordSchema,
  token_usage: tokenUsageSchema,
  chief: chiefRecordSchema,
  chief_thread: chiefThreadSchema,
  // chief_message = 线程消息行（records/message.ts 同族 role/content 形状，
  // r5 §3.6；独立列细节归 M2 按 record 形状展开）。
  chief_message: messageRecordSchema,
  whats_new: whatsNewRecordSchema,
} as const satisfies Record<string, z.ZodType>;

export type RecordTableName = keyof typeof RECORD_SCHEMAS;
