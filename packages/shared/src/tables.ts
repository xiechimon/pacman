// 存储表清单——01 §6（02 §6.2 record 形状 + §1.3 数据所有权的投影，锁定清单）。
// migration 纪律（01 §6）：drizzle-kit 生成、进 repo、CI 校验 drift；
// 不发明 02 之外的字段形状——协议面字段即契约（02/A9）。
// 列细节 = M2 实现期按 record 形状展开（record schema 见 records/，24 表投影源；
// `todo_tag` 为纯 join 表，无 wire record 形状，故 record 投影为 24 张）。

export const DB_TABLES = [
  'user', // seed 一行（02 §2.1）
  'team', // seed 一行；plan 字段形状保留、不参与门控（02 §2.2/A3）
  'project', // repo 形态字段：托管 bare / GitHub 接入（02 §3/A4）
  'todo', // 02 §4.1 字段表全量
  'tag',
  'todo_tag', // 多对多 join（CONTEXT.md：tag 是 todo 的多对多标签）
  'build', // buildId ≡ conversationId（CONTEXT.md/r3 §3.0）
  'step', // 三类步队列 + journal 状态（02 §4.2/A6）
  'steer_pending', // W3 #278：build 会话运行中补话单槽（06 册 D9，自有功能）
  'message', // transcript 消息/工具行，经 upload-urls 回传落库（02 §1.3）
  'plan', // build facet：版本 v1/v2 + 四段卡（02 §4.2）
  'document_diff', // `documents/{id}/diff` 端点源（02 §4.2）
  'schedule', // 02 §6.2 形状；kind 枚举含 [推断] 词
  'notification', // 02 §9.1 三事件矩阵（r5 §7.2 改判）
  'agent', // 含 6 工具开关/secrets/skills/mcpServers 关联（02 §6.2）
  'agent_memory', // 02 §4.4 条目集（r5 §6 改判）
  'skill', // 含文件内容，`skills/{sid}/file` 端点源（02 §6.1）
  'mcp_server', // 02 §6.2 形状
  'provider', // 38 presets + custom；apiKey 密文经 SecretBox（02 §6.2/§8）
  'secret', // 值密文经 SecretBox，只写不读（02 §8）
  'api_key', // 哈希 + gitAccess/mcpAccess/toolGrants 白名单（02 §6.2/§8）
  'machine', // 02 §6.2 + presence 状态（02 §1.2）
  'token_usage', // build×model 四维计数（02 §6.2/r3 §3.8）
  'chief', // 02 §4.3 Chief 记录面（r5 §3.6 GET /chief 的 chief 字段：绑定 Agent/charter/watches/wakes；M4a 回写 01 §6——原清单仅列线程面两表，记录本体无表位）
  'chief_thread', // 02 §4.3 线程面（r5 §3.6）
  'chief_message', // 02 §4.3 线程面（r5 §3.6）
  'whats_new', // 形状保留内容自选（02 §6.1）
  'branch_sync', // M7 #319 分支对话框「同步到机器」状态机（pending/running/synced/failed）；内部状态表无独立 record 投影面
] as const;

export type DbTable = (typeof DB_TABLES)[number];

/** join 表（无 wire record 形状）——record 投影面 = DB_TABLES 减去此集。 */
export const JOIN_ONLY_TABLES = ['todo_tag'] as const;

/** 内部状态表（无 wire record 形状，读位内嵌于既有封套）——record 投影面
 * 同减此集。W3 #278：steer_pending 读位 = conversation messages 封套的
 * steerPending 数组（spec #277），无独立 record。M7 #319：branch_sync
 * 读位 = `GET /api/builds/{id}/branch-sync` 端点封套与 team stream
 * `branch_sync` 事件载荷（web 实时结果卡数据面），不另开 record projection
 * ——投影在 server 端组装，wire 形状见 protocol/sse.ts branchSyncEvent。 */
export const INTERNAL_ONLY_TABLES = ['steer_pending', 'branch_sync'] as const;
