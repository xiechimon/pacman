// Drizzle schema——01 §6 锁定清单（24 record 投影表 + `todo_tag` 纯 join 表）。
// 纪律：列 = 02 §6.2 record 形状投影（字段即契约，02/A9）；不发明 02 之外的
// wire 字段。内部列（journal 状态、密文槽、哈希槽）按 01 §6 表注/02 §8 展开，
// 标注 [内部]；表名 = shared DB_TABLES 单源（test/schema.test.ts 对拍）。

import type {
  ActiveRun,
  Assignment,
  DocumentDiffFile,
  McpTransport,
  Phase,
  ProviderApi,
  StepKind,
  TriggerSource,
} from '@pacman/shared';
import { sql } from 'drizzle-orm';
import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** epoch 毫秒（records/common.ts epochMs 同族）。 */
const epochMs = (name: string) => integer(name);
const bool = (name: string) => integer(name, { mode: 'boolean' });
const json = <T>(name: string) => text(name, { mode: 'json' }).$type<T>();

// —— user（seed 一行，02 §2.1）—————————————————————————————————————————
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  displayName: text('displayName').notNull(),
  avatarUrl: text('avatarUrl'),
});

// —— team（seed 一行；plan 形状保留、不参与门控，02 §2.2/A3）———————————————
export const team = sqliteTable('team', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: epochMs('createdAt').notNull(),
  plan: text('plan').notNull().default('free'),
  avatarStyle: text('avatarStyle'),
});

// —— project（repo 双形态：托管 bare / GitHub 接入，02 §3/A4）————————————————
export const project = sqliteTable('project', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  teamId: text('teamId')
    .notNull()
    .references(() => team.id),
  repoKind: text('repoKind').$type<'hosted' | 'github'>(),
  /** 托管形态：bare repo 名段（远端 URL `<teamId>/<repoName>`，r3 §1.4）。 */
  repoName: text('repoName'),
  /** GitHub 接入形态：`owner/repo`（02 §3；字段名 [推断]）。 */
  githubRepo: text('githubRepo'),
});

// —— todo（02 §4.1 字段表全量；tagIds/buildHistory/agent 为派生面不存列）——————
export const todo = sqliteTable('todo', {
  id: text('id').primaryKey(),
  teamId: text('teamId')
    .notNull()
    .references(() => team.id),
  projectId: text('projectId')
    .notNull()
    .references(() => project.id),
  title: text('title').notNull(),
  spec: text('spec').notNull().default(''),
  phase: text('phase').$type<Phase>().notNull().default('todo'),
  phaseAt: epochMs('phaseAt').notNull(),
  seqNum: integer('seqNum').notNull(),
  orderIndex: real('orderIndex').notNull().default(0),
  assignment: json<Assignment | null>('assignment'),
  latestBuildId: text('latestBuildId'),
  lastRunAt: epochMs('lastRunAt'),
  hasChanges: bool('hasChanges').notNull().default(false),
  hasPlan: bool('hasPlan').notNull().default(false),
  sourceTodo: text('sourceTodo'),
  v: integer('v').notNull().default(1),
  createdBy: text('createdBy'),
  ownerId: text('ownerId'),
  sourceBuildId: text('sourceBuildId'),
});

export const tag = sqliteTable('tag', {
  id: text('id').primaryKey(),
  projectId: text('projectId')
    .notNull()
    .references(() => project.id),
  name: text('name').notNull(),
});

// —— todo_tag（纯 join 表，01 §6；无 wire record 形状）————————————————————
export const todoTag = sqliteTable(
  'todo_tag',
  {
    todoId: text('todoId')
      .notNull()
      .references(() => todo.id, { onDelete: 'cascade' }),
    tagId: text('tagId')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.todoId, t.tagId] })],
);

// —— build（buildId ≡ conversationId，CONTEXT.md/02 §4.2）——————————————————
export const build = sqliteTable('build', {
  id: text('id').primaryKey(),
  todoId: text('todoId')
    .notNull()
    .references(() => todo.id, { onDelete: 'cascade' }),
  withPlan: bool('withPlan').notNull(),
  prevPhase: text('prevPhase').$type<Phase | null>(),
  triggerSource: text('triggerSource').$type<TriggerSource>().notNull(),
  pinnedMachineId: text('pinnedMachineId'),
  planDocId: text('planDocId'),
  errorMessage: text('errorMessage'),
  prUrl: text('prUrl'),
  prNumber: integer('prNumber'),
  diffHash: text('diffHash'),
  createdAt: epochMs('createdAt').notNull(),
});

// —— step（三类步队列 server 持有、机器 claim，02 §4.2/A6）———————————————————
export const step = sqliteTable('step', {
  id: text('id').primaryKey(),
  buildId: text('buildId')
    .notNull()
    .references(() => build.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<StepKind>().notNull(),
  machineId: text('machineId'),
  /** [内部] journal 状态（02 §5.4；M3a 展开：claimed = 机器领取未收尾）。 */
  status: text('status')
    .$type<'pending' | 'claimed' | 'done' | 'failed'>()
    .notNull()
    .default('pending'),
  /** [内部] 引擎会话标识（done 回传；continue session 复用面——合并轮/重规划轮
   * 同 conv 续跑，02 §4.2/§5.7）。 */
  sessionId: text('sessionId'),
  /** [内部] 步收尾时 conv 分支 HEAD sha（M3b done 回传 commit 字段）：
   * per-step checkpoint（「恢复到此处」数据源，r3 §3.5/02 §4.2 [推断] 语义）
   * + 合并步 fast-forward 落地键（r3 §3.9「目标提交」同族）。 */
  checkpointCommit: text('checkpointCommit'),
  /** [内部] claim 时刻（陈旧领取判定用 [设计]）。 */
  claimedAt: epochMs('claimedAt'),
  /** [内部] heartbeat/<stepId> 续活时刻（02 §5.4）。 */
  lastHeartbeatAt: epochMs('lastHeartbeatAt'),
  createdAt: epochMs('createdAt').notNull(),
});

// —— message（transcript 消息/工具行，经 upload-urls 回传落库，02 §1.3；wire 细形归 M3）——
export const message = sqliteTable('message', {
  id: text('id').primaryKey(),
  /** ≡ buildId（conversation 与 build 同 UUID，CONTEXT.md）。 */
  conversationId: text('conversationId').notNull(),
  role: text('role').$type<'system' | 'user' | 'assistant'>().notNull(),
  content: json<unknown>('content').notNull(),
  createdAt: epochMs('createdAt').notNull(),
});

// —— plan（build facet：plan 即文件 plan.md，版本 = 文件版本，02 §4.2/r5 §4）————
export const plan = sqliteTable('plan', {
  /** = build.planDocId（documents/{id}/diff 的 {id} 同值）。 */
  id: text('id').primaryKey(),
  buildId: text('buildId')
    .notNull()
    .references(() => build.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1),
  /** [内部] plan.md 文件内容（diff 端点源，r5 §4 文件级 unified diff）。 */
  content: text('content').notNull().default(''),
  createdAt: epochMs('createdAt').notNull(),
});

// —— document_diff（`documents/{id}/diff` 端点源，02 §4.2；驳回回路细面归 M4）————
export const documentDiff = sqliteTable('document_diff', {
  id: text('id').primaryKey(),
  documentId: text('documentId').notNull(),
  fromVersion: integer('fromVersion').notNull(),
  toVersion: integer('toVersion').notNull(),
  files: json<DocumentDiffFile[]>('files').notNull(),
  createdAt: epochMs('createdAt').notNull(),
});

// —— schedule（02 §6.2/§9.2；cron 闭环 = services/schedules + scheduler）——————
export const schedule = sqliteTable('schedule', {
  id: text('id').primaryKey(),
  teamId: text('teamId')
    .notNull()
    .references(() => team.id),
  projectId: text('projectId').notNull(),
  todoId: text('todoId').notNull(),
  kind: text('kind').$type<'once' | 'hourly' | 'daily' | 'weekly'>().notNull(),
  at: epochMs('at'),
  tz: text('tz').notNull(),
  machineId: text('machineId'),
  nextRunAt: epochMs('nextRunAt'),
  createdBy: text('createdBy').notNull(),
});

// —— notification（02 §9.1 三事件矩阵 r5 §7.2；SSE 事件面 = services/notifications.ts）——
export const notification = sqliteTable('notification', {
  /** 组合键 `"<userId>:<entityId>"`（r5 §7.2 原样）。 */
  id: text('id').primaryKey(),
  teamId: text('teamId').notNull(),
  userId: text('userId').notNull(),
  type: text('type').$type<'plan_ready' | 'build_review' | 'chief_message'>().notNull(),
  entityId: text('entityId').notNull(),
  entityRef: json<{ title: string; projectId: string | null; seqNum: number | null }>(
    'entityRef',
  ).notNull(),
  agentName: text('agentName').notNull(),
  agentAvatarUrl: text('agentAvatarUrl'),
  snippet: text('snippet'),
  readAt: epochMs('readAt'),
  createdAt: epochMs('createdAt').notNull(),
  channels: json<['in_app']>('channels').notNull().default(['in_app']),
});

// —— agent（02 §6.2；关联面 = JSON 列（01 §6 表注「关联表」在锁定 24+1 表清单内
// 无独立表位，DB_TABLES 单源不扩）；成员/端点面归 M2b+）————————————————————
export const agent = sqliteTable('agent', {
  id: text('id').primaryKey(),
  teamId: text('teamId')
    .notNull()
    .references(() => team.id),
  displayName: text('displayName').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'),
  avatarUrl: text('avatarUrl'),
  provider: text('provider'),
  modelId: text('modelId'),
  thinkingLevel: text('thinkingLevel'),
  tools: json<string[]>('tools').notNull().default(sql`'[]'`),
  secrets: json<string[]>('secrets').notNull().default(sql`'[]'`),
  skills: json<string[]>('skills').notNull().default(sql`'[]'`),
  mcpServers: json<string[]>('mcpServers').notNull().default(sql`'[]'`),
});

// —— agent_memory（02 §4.4/r5 §6：配额 100 + 三级溯源；写路径归 M4）———————————
export const agentMemory = sqliteTable('agent_memory', {
  id: text('id').primaryKey(),
  agentId: text('agentId').notNull(),
  teamId: text('teamId').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  projectId: text('projectId'),
  sourceTodoId: text('sourceTodoId'),
  sourceBuildId: text('sourceBuildId'),
  createdAt: epochMs('createdAt').notNull(),
  updatedAt: epochMs('updatedAt').notNull(),
});

// —— skill（含文件内容，`skills/{sid}/file` 端点源，01 §6；上传面归 M2b+）———————
export const skill = sqliteTable('skill', {
  id: text('id').primaryKey(),
  teamId: text('teamId')
    .notNull()
    .references(() => team.id),
  name: text('name').notNull(),
  description: text('description'),
  /** [内部] fileName → 文件内容（SKILL.md 必含，records/skill.ts）。 */
  files: json<Record<string, string>>('files').notNull().default(sql`'{}'`),
});

// —— mcp_server（02 §6.2/§7.1；管理面归 M4）—————————————————————————————————
export const mcpServer = sqliteTable('mcp_server', {
  id: text('id').primaryKey(),
  teamId: text('teamId')
    .notNull()
    .references(() => team.id),
  label: text('label').notNull(),
  slug: text('slug').notNull(),
  transport: text('transport').$type<McpTransport>().notNull(),
  url: text('url').notNull(),
  hasCredential: bool('hasCredential').notNull().default(false),
  credentialKeys: json<string[]>('credentialKeys').notNull().default(sql`'[]'`),
  createdBy: text('createdBy').notNull(),
  createdAt: epochMs('createdAt').notNull(),
  updatedAt: epochMs('updatedAt').notNull(),
});

// —— provider（38 presets + custom，02 §6.2；apiKey 密文经 SecretBox，02 §8）——————
export const provider = sqliteTable('provider', {
  id: text('id').primaryKey(),
  teamId: text('teamId')
    .notNull()
    .references(() => team.id),
  kind: text('kind').notNull().default('custom'),
  providerId: text('providerId').notNull(),
  label: text('label').notNull(),
  baseUrl: text('baseUrl').notNull(),
  api: text('api').$type<ProviderApi>().notNull(),
  authHeader: bool('authHeader').notNull().default(true),
  compat: json<{ supportsDeveloperRole: boolean }>('compat').notNull(),
  models: json<{ id: string; name: string }[]>('models').notNull().default(sql`'[]'`),
  /** [内部] SecretBox 信封（v1 头 + iv + ciphertext + authTag，01 §4.2）；只写不读（02 §8）。 */
  apiKeyCipher: text('apiKeyCipher'),
  createdBy: text('createdBy').notNull(),
  createdAt: epochMs('createdAt').notNull(),
  updatedAt: epochMs('updatedAt').notNull(),
});

// —— secret（值密文经 SecretBox，只写不读，02 §8；服务面 = services/secrets.ts）————
export const secret = sqliteTable('secret', {
  id: text('id').primaryKey(),
  teamId: text('teamId')
    .notNull()
    .references(() => team.id),
  name: text('name').notNull(),
  description: text('description'),
  /** [内部] SecretBox 信封；GET 永不返回值（02 §8 API 面纪律）。 */
  valueCipher: text('valueCipher'),
});

// —— api_key（哈希 + 白名单，02 §6.2/§8；存哈希不存可逆值 [设计]）————————————————
export const apiKey = sqliteTable('api_key', {
  id: text('id').primaryKey(),
  teamId: text('teamId')
    .notNull()
    .references(() => team.id),
  name: text('name'),
  gitAccess: bool('gitAccess').notNull().default(false),
  mcpAccess: bool('mcpAccess').notNull().default(false),
  toolGrants: json<{ read: string[]; write: string[] }>('toolGrants').notNull(),
  /** [内部] key 哈希（登录校验只需匹配，02 §8）。 */
  keyHash: text('keyHash').notNull(),
  /** [内部] 列表行掩码（`tds_afe07565…` 展示规则 r3 §6）。 */
  masked: text('masked').notNull(),
  createdAt: epochMs('createdAt').notNull(),
});

// —— machine（02 §6.2 + presence 状态，02 §1.2；token 存哈希 02 §8；接入面归 M3）———
export const machine = sqliteTable('machine', {
  id: text('id').primaryKey(),
  teamId: text('teamId')
    .notNull()
    .references(() => team.id),
  name: text('name').notNull(),
  online: bool('online').notNull().default(false),
  maxConcurrent: integer('maxConcurrent').notNull().default(3),
  /** [内部] 机器 token 哈希（64hex 原文不落库，02 §8）。 */
  tokenHash: text('tokenHash'),
  /** [内部] 注册用 API key（重注册复用同一 machineId = 按 key/team 认机器，
   * r3 §1.2 实测 + [推断]）。 */
  apiKeyId: text('apiKeyId'),
  latestCliVersion: text('latestCliVersion'),
});

// —— token_usage（build × model 四维计数，02 §6.2/r3 §3.8；记账归 M3）———————————
export const tokenUsage = sqliteTable(
  'token_usage',
  {
    buildId: text('buildId').notNull(),
    /** `<provider>/<modelId>` 串（r3 §1.5）。 */
    model: text('model').notNull(),
    input: integer('input').notNull().default(0),
    output: integer('output').notNull().default(0),
    cacheRead: integer('cacheRead').notNull().default(0),
    cacheWrite: integer('cacheWrite').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.buildId, t.model] })],
);

// —— chief_thread（02 §4.3/r5 §3.6 线程面；Chief 编排归 M4）————————————————————
export const chiefThread = sqliteTable('chief_thread', {
  /** `chief-<uuid>`（UUIDv7，conversation 名同值）。 */
  id: text('id').primaryKey(),
  /** `chief-<userId>-<teamId>`（records/chief.ts chiefIdFormat）。 */
  chiefId: text('chiefId').notNull(),
  userId: text('userId').notNull(),
  teamId: text('teamId').notNull(),
  title: text('title').notNull(),
  createdAt: epochMs('createdAt').notNull(),
  updatedAt: epochMs('updatedAt').notNull(),
  lastTurnAt: epochMs('lastTurnAt'),
  sessionRuntime: text('sessionRuntime').notNull().default('pi'),
  sessionId: text('sessionId').notNull(),
  sessionOpenedAt: epochMs('sessionOpenedAt').notNull(),
  pendingSessionResumeAt: epochMs('pendingSessionResumeAt'),
  toolDefHashes: json<Record<string, string>>('toolDefHashes').notNull().default(sql`'{}'`),
  toolResultHashes: json<Record<string, string>>('toolResultHashes').notNull().default(sql`'{}'`),
  activeRun: json<ActiveRun>('activeRun'),
});

// —— chief_message（records/message.ts 同族 role/content 形状，r5 §3.6）————————————
export const chiefMessage = sqliteTable('chief_message', {
  id: text('id').primaryKey(),
  threadId: text('threadId')
    .notNull()
    .references(() => chiefThread.id, { onDelete: 'cascade' }),
  role: text('role').$type<'system' | 'user' | 'assistant'>().notNull(),
  content: json<unknown>('content').notNull(),
  createdAt: epochMs('createdAt').notNull(),
});

// —— whats_new（形状保留、内容自选，02 §6.1 [设计]）————————————————————————————
export const whatsNew = sqliteTable('whats_new', {
  id: text('id').primaryKey(),
  body: json<Record<string, unknown>>('body').notNull(),
  createdAt: epochMs('createdAt').notNull(),
});
