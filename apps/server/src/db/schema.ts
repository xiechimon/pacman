// Drizzle schema——01 §6 锁定清单（24 record 投影表 + `todo_tag` 纯 join 表）。
// 纪律：列 = 02 §6.2 record 形状投影（字段即契约，02/A9）；不发明 02 之外的
// wire 字段。内部列（journal 状态、密文槽、哈希槽）按 01 §6 表注/02 §8 展开，
// 标注 [内部]；表名 = shared DB_TABLES 单源（test/schema.test.ts 对拍）。

import type {
  ActiveRun,
  Assignment,
  ChiefCompactionModel,
  ChiefWatch,
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

// —— step（三类步队列 server 持有、机器 claim，02 §4.2/A6；M4a +chief 步）—————
export const step = sqliteTable('step', {
  id: text('id').primaryKey(),
  /** ≡ conversationId。worker 步 = build.id（cascade 随行）；chief 步 =
   * `chief-<uuid>`（线程 id，无 build 行——Chief 回合 = 机器 step 实测
   * r5 §3.1，队列复用 [设计]，故本列不带 FK，级联面在 chief_thread）。 */
  buildId: text('buildId').notNull(),
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
  /** [内部] 入队时合成的续轮指令（M4a [设计]）：驳回 feedback 注入重规划轮
   * （r5 §4「v2 内容忠实执行反馈」宿主等价物）、chief 回合任务文本/wake 事实
   * （r5 §3.1/§3.5）。claim 载荷 `instruction` 位透出。 */
  prompt: text('prompt'),
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

// —— steer_pending（W3 #278，06 册 D9：build 会话运行中的补充说明单槽）——————
// conversation 维度一行（单槽覆盖，spec #277「双发竞态不排队」）；定向的
// claimed 步 = 拉取校验 + 旧步丢弃判定（步收尾换新步后 pending 不可复活）。
export const steerPending = sqliteTable('steer_pending', {
  /** ≡ conversationId ≡ buildId（单槽键）。 */
  conversationId: text('conversationId').primaryKey(),
  /** 定向的 claimed 步（拉取-确认的校验位）。 */
  stepId: text('stepId').notNull(),
  content: text('content').notNull(),
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

// —— mcp_server（02 §6.2/§7.1；管理面 = M4b）———————————————————————————————
// wire record = r3 §5.1 实测原样（records/mcp-server.ts）；stdio 的命令/参数与
// http 请求头值 wire 未采 [推断]——[内部] 列承载：headers 密文经 SecretBox
// （02 §8 凭证类 at-rest 纪律；credentialKeys = 头名清单，值只写不读）。
export const mcpServer = sqliteTable('mcp_server', {
  id: text('id').primaryKey(),
  teamId: text('teamId')
    .notNull()
    .references(() => team.id),
  label: text('label').notNull(),
  slug: text('slug').notNull(),
  transport: text('transport').$type<McpTransport>().notNull(),
  /** http = 连接 URL；stdio = 空串（命令/参数走内部列，wire 形未采 [推断]）。 */
  url: text('url').notNull(),
  hasCredential: bool('hasCredential').notNull().default(false),
  credentialKeys: json<string[]>('credentialKeys').notNull().default(sql`'[]'`),
  /** [内部] stdio 命令（r2 §6.2 表单字段「命令+参数」）。 */
  command: text('command'),
  /** [内部] stdio 参数。 */
  args: json<string[]>('args').notNull().default(sql`'[]'`),
  /** [内部] 请求头键值密文（SecretBox 信封，JSON Record<string,string>）。 */
  headersCipher: text('headersCipher'),
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
  /** [内部] 列表行掩码（`pacman_afe07565…`；展示规则 r3 §6，前缀随品牌槽）。 */
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

// —— chief（02 §4.3/r5 §3.6 GET /chief 的 chief 记录本体；M4a 回写 01 §6：
// 原锁定清单仅列线程面两表，chief 记录——绑定 Agent/charter/watches/wakes——
// 无表位。watches/wakes 为 per-chief 小数组，随记录存 JSON 列 [设计]，
// 与 GET /chief 响应封套同形，不另立表）—————————————————————————————————
export const chief = sqliteTable('chief', {
  /** `chief-<userId>-<teamId>`（records/chief.ts chiefIdFormat，r5 §3.6）。 */
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  teamId: text('teamId')
    .notNull()
    .references(() => team.id),
  /** 绑定 Agent id（PATCH /chief + 二次确认，记忆不迁移告示，r5 §2）；未绑定 null。 */
  agentId: text('agentId'),
  /** 绑定 Agent 的思考强度覆盖（PATCH body agent.thinkingLevel，r5 §2）。 */
  thinkingLevel: text('thinkingLevel'),
  /** 压缩模型长槽（#203 [设计]；records/chief.ts chiefCompactionModelSchema
   * 值形，null = 默认「与 Chief 相同」）；JSON 列。 */
  compactionModel: json<ChiefCompactionModel>('compactionModel'),
  /** 章程 = 常设指示（r5 §2 章程 tab；raw 默认空串）。 */
  charter: text('charter').notNull().default(''),
  /** watch 条目集（records/chief.ts chiefWatchSchema[]；派工即建、settle/failed
   * 自动解除，r5 §3.5）；JSON 列 [设计]。 */
  watches: json<ChiefWatch[]>('watches').notNull().default(sql`'[]'`),
  /** wakes[] 非空形态未实测（r5 §10：set_wake 实走遗留）[推断]，开放条目。 */
  wakes: json<Record<string, unknown>[]>('wakes').notNull().default(sql`'[]'`),
  lastTurnAt: epochMs('lastTurnAt'),
  createdAt: epochMs('createdAt').notNull(),
  /** 用户时区（raw chief-record-testA.json 一手 tz）。 */
  tz: text('tz'),
});

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

// —— attachment（#310，r9 §3.1/§4）：附件上传存储面，wire 形状从 grant 落 key
// 起的全过程——DB 行 status 漂移 pending → ready；content/spec 内嵌 markdown
// `attachment:<storageKey>` 解析走 read 端；scope = spec（新建任务描述）|
// message（chat composer）。MIME 白名单在 services/attachments.ts 守门，
// 单文件 ≤10MiB。团队归属校验贯穿 grant/upload/read/工具四关。—————
export const attachment = sqliteTable('attachment', {
  id: text('id').primaryKey(),
  teamId: text('teamId')
    .notNull()
    .references(() => team.id),
  /** 创建者用户 id；chief 派工 agent 路径未至，无 chiefAgentId 槽。 */
  createdBy: text('createdBy').notNull(),
  fileName: text('fileName').notNull(),
  mimeType: text('mimeType').notNull(),
  sizeBytes: integer('sizeBytes').notNull(),
  /** 相对 `<attachmentsDir>/<storageKey>`；layout = `<teamId>/<id>.<ext>`。 */
  storageKey: text('storageKey').notNull(),
  /** grant 端与上传端的串联位（HMAC 签名内含,upload 时回查一致）。 */
  grantId: text('grantId').notNull(),
  scope: text('scope').$type<'spec' | 'message'>().notNull(),
  /** pending = grant 落库未上传；ready = 文件落盘；failed = 上传过程报错。 */
  status: text('status').$type<'pending' | 'ready' | 'failed'>().notNull().default('pending'),
  createdAt: epochMs('createdAt').notNull(),
});
