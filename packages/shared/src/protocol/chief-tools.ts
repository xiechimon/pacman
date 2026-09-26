// Chief remoteTools 词表——49 件（r5 §3.1，一手来源 = thread 记录
// toolDefHashes 全键 `docs/research/assets/r5/raw/chief-threads-testA.json`）。
// 复刻口径（02 §4.3 尾注）：Chief = 挂团队工具的 pi 会话，行为分毫不求同；
// 工具「名单」为实测一手（49 键原样），各工具的 description/parameters 细形
// 未采到 wire 原件 = 全部 [推断] 黑盒逼近（04 §1 A4：不冒充实测），语义按
// r1 docs 六能力组 + r3/r5 行为证据投影。
// 分组计数按 raw 键集实数：读 15 + 组织 19 + 执行 5 + 私有 10 = 49
// （r5 §3.1 正文枚举漏 `delete_skills`，02 §4.3 分组计数随之偏差——raw 键集
// 为权威，vocabulary.test 对拍）。
// replaySafe = 读工具（bundle 提取：读侧带重试预算 RETRY_DELAYS_MS=[500,2000]、
// 超时 remoteTool:10s，r5 §3.1）。

import { z } from 'zod';

/** remoteTools[] 条目（step 载荷，服务端定义、服务端执行；字段名一手来源 =
 * bundle `src/lib/remoteTools.ts` 静态提取 `def.name/label/description/
 * parameters/replaySafe`，r5 §3.1 raw）。parameters = JSON Schema（typebox
 * 产物的 wire 形 [设计]，agent-backend.ts toolSpecSchema 同族）。 */
export const remoteToolDefSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  description: z.string(),
  parameters: z.unknown().optional(),
  /** 读工具幂等可重放（重试预算面，r5 §3.1 bundle 提取）。 */
  replaySafe: z.boolean().optional(),
});
export type RemoteToolDef = z.infer<typeof remoteToolDefSchema>;

/** relay 执行请求 body（bundle 提取原样：`{name: def.name, params}` →
 * `POST /api/machine/tool/<stepId>`，r5 §3.1）。与 live transcript 工具行
 * 回传（toolCallRecordSchema）同径异形，服务端按形状分流 [设计]。 */
export const machineToolRelayBodySchema = z.object({
  name: z.string(),
  params: z.record(z.string(), z.unknown()),
});
export type MachineToolRelayBody = z.infer<typeof machineToolRelayBodySchema>;

/** relay 成功响应（bundle 消费面 `reply.body?.text` = 结果 JSON 串）；
 * 失败 = 标准 {error} + 可选 transient 位（bundle `json?.transient` 读取，
 * 5xx/transient → replaySafe 重试）。 */
export const machineToolRelayResponseSchema = z.object({
  text: z.string(),
});
export type MachineToolRelayResponse = z.infer<typeof machineToolRelayResponseSchema>;

/** 49 词表分组（r5 §3.1 正文分组语义；成员按 raw 键集归位 [推断]）。 */
export const CHIEF_TOOL_CATEGORIES = {
  read: [
    'projects',
    'todos',
    'agents',
    'machines',
    'skills',
    'secrets',
    'mcp_servers',
    'schedules',
    'docs',
    'usage',
    'issues',
    'pull_requests',
    'workflow_runs',
    'attachment',
    'conversation',
  ],
  organize: [
    'create_todo',
    'update_todo',
    'delete_todos',
    'close_todos',
    'reopen_todos',
    'complete_todos',
    'message_todo',
    'create_project',
    'update_project',
    'connect_repo',
    'create_agent',
    'update_agent',
    'delete_agents',
    'delete_skills',
    'set_secret',
    'delete_secrets',
    'set_remote_shell',
    'schedule_todo',
    'unschedule_todo',
  ],
  execute: ['run_builds', 'run_review', 'confirm_builds', 'cancel_builds', 'merge_builds'],
  private: [
    'ask_user',
    'notify_user',
    'save_memory',
    'delete_memory',
    'memories',
    'watch_todos',
    'unwatch_todos',
    'wakes',
    'set_wake',
    'clear_wake',
  ],
} as const satisfies Record<string, readonly string[]>;

/** 49 键全量（raw toolDefHashes 键集单源投影；vocabulary.test 对拍）。 */
export const CHIEF_TOOL_NAMES: readonly string[] = Object.values(CHIEF_TOOL_CATEGORIES)
  .flat()
  .sort();

const str = (description: string) => ({ type: 'string', description });
const arr = (items: unknown, description: string) => ({ type: 'array', items, description });
const idArr = (description: string) => arr({ type: 'string' }, description);
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  ...(required.length > 0 ? { required } : {}),
});

/** 词表本体。description/parameters 全 [推断]（语义 = r1 docs 六能力组 +
 * r3/r5 行为证据投影；02 §7.2 24 工具白名单同族语义）。 */
export const CHIEF_REMOTE_TOOLS: readonly RemoteToolDef[] = [
  // —— 读侧 15（replaySafe，r5 §3.1）——
  {
    name: 'projects',
    description: 'List the team projects with their repo binding and todo counts.',
    parameters: obj({ teamId: str('Optional team id; defaults to the current team.') }),
    replaySafe: true,
  },
  {
    name: 'todos',
    description:
      'List todos. Filter by project or phase; returns full todo docs including spec, phase, seqNum and assignment.',
    parameters: obj({
      projectId: str('Optional project id filter.'),
      phase: str(
        'Optional phase filter (todo/queued/planning/confirm/building/review/done/failed/closed).',
      ),
    }),
    replaySafe: true,
  },
  {
    name: 'agents',
    description:
      'List the team agents with their responsibility text (description), model and permissions — the input for dispatch weighting.',
    parameters: obj({}),
    replaySafe: true,
  },
  {
    name: 'machines',
    description:
      'List registered machines with online state, running/ max concurrency and CLI version.',
    parameters: obj({}),
    replaySafe: true,
  },
  {
    name: 'skills',
    description: 'List team skills (folders with a SKILL.md) granted to agents.',
    parameters: obj({}),
    replaySafe: true,
  },
  {
    name: 'secrets',
    description: 'List team secret names (values are write-only and never returned).',
    parameters: obj({}),
    replaySafe: true,
  },
  {
    name: 'mcp_servers',
    description: 'List team MCP servers available to agents (slug, transport, url).',
    parameters: obj({}),
    replaySafe: true,
  },
  {
    name: 'schedules',
    description: 'List scheduled reruns (kind, next run, bound todo).',
    parameters: obj({}),
    replaySafe: true,
  },
  {
    name: 'docs',
    description: 'Read repository documents (files at a ref) for a project.',
    parameters: obj(
      {
        projectId: str('Project id.'),
        path: str('File path to read.'),
        ref: str('Optional git ref; defaults to the default branch.'),
      },
      ['projectId', 'path'],
    ),
    replaySafe: true,
  },
  {
    name: 'usage',
    description:
      'Token usage accounting per build and model (input/output/cache read/cache write).',
    parameters: obj({ buildId: str('Optional build id filter.') }),
    replaySafe: true,
  },
  {
    name: 'issues',
    description: 'List issues of a GitHub-backed project (hosted repos have none).',
    parameters: obj({ projectId: str('Project id.') }, ['projectId']),
    replaySafe: true,
  },
  {
    name: 'pull_requests',
    description: 'List pull requests of a GitHub-backed project with merge state.',
    parameters: obj({ projectId: str('Project id.') }, ['projectId']),
    replaySafe: true,
  },
  {
    name: 'workflow_runs',
    description: 'List CI workflow runs of a GitHub-backed project.',
    parameters: obj({ projectId: str('Project id.') }, ['projectId']),
    replaySafe: true,
  },
  {
    name: 'attachment',
    description: 'Fetch an attachment referenced by a todo or message.',
    parameters: obj({ attachmentId: str('Attachment id.') }, ['attachmentId']),
    replaySafe: true,
  },
  {
    name: 'conversation',
    description:
      'Read the full conversation (transcript messages and tool calls) of a build or chief thread.',
    parameters: obj({ conversationId: str('Conversation id (buildId or chief-<threadId>).') }, [
      'conversationId',
    ]),
    replaySafe: true,
  },
  // —— 组织侧 19 ——
  {
    name: 'create_todo',
    description:
      'Create a todo in a project. Title = verb phrase; spec = the three-section transform (user quote block, 要求 bullets, 补充信息 bullets).',
    parameters: obj(
      {
        projectId: str('Project id.'),
        title: str('Todo title (verb phrase).'),
        spec: str('Structured spec markdown.'),
      },
      ['projectId', 'title', 'spec'],
    ),
  },
  {
    name: 'update_todo',
    description: 'Update fields of a todo (title/spec/tags/order).',
    parameters: obj(
      {
        todoId: str('Todo id.'),
        title: str('Optional new title.'),
        spec: str('Optional new spec.'),
        tagIds: idArr('Optional replacement tag ids.'),
      },
      ['todoId'],
    ),
  },
  {
    name: 'delete_todos',
    description: 'Delete todos permanently (builds and transcripts cascade).',
    parameters: obj({ todoIds: idArr('Todo ids to delete.') }, ['todoIds']),
  },
  {
    name: 'close_todos',
    description: 'Close todos as shelved (phase → closed).',
    parameters: obj({ todoIds: idArr('Todo ids to close.') }, ['todoIds']),
  },
  {
    name: 'reopen_todos',
    description: 'Reopen closed todos (phase closed → todo).',
    parameters: obj({ todoIds: idArr('Todo ids to reopen.') }, ['todoIds']),
  },
  {
    name: 'complete_todos',
    description: 'Mark todos done without a merge step (only valid at the review gate).',
    parameters: obj({ todoIds: idArr('Todo ids to complete.') }, ['todoIds']),
  },
  {
    name: 'message_todo',
    description: 'Post a message into the latest build conversation of a todo (steer or feedback).',
    parameters: obj({ todoId: str('Todo id.'), content: str('Message text.') }, [
      'todoId',
      'content',
    ]),
  },
  {
    name: 'create_project',
    description: 'Create a project (hosted repo or plain).',
    parameters: obj(
      {
        name: str('Project name.'),
        repoKind: str('Optional: "hosted" to provision a managed bare repo.'),
      },
      ['name'],
    ),
  },
  {
    name: 'update_project',
    description: 'Rename a project or update its metadata.',
    parameters: obj({ projectId: str('Project id.'), name: str('Optional new name.') }, [
      'projectId',
    ]),
  },
  {
    name: 'connect_repo',
    description: 'Connect a GitHub repo (owner/repo) to a project.',
    parameters: obj(
      { projectId: str('Project id.'), githubRepo: str('GitHub "owner/repo" reference.') },
      ['projectId', 'githubRepo'],
    ),
  },
  {
    name: 'create_agent',
    description: 'Create an agent with model, responsibility text and permissions.',
    parameters: obj(
      {
        displayName: str('Agent display name.'),
        description: str('Responsibility text (injected into every task and used for dispatch).'),
        provider: str('Optional provider id.'),
        modelId: str('Optional model id.'),
      },
      ['displayName'],
    ),
  },
  {
    name: 'update_agent',
    description: 'Update an agent (responsibility text, model, permission switches).',
    parameters: obj(
      {
        agentId: str('Agent id.'),
        displayName: str('Optional new display name.'),
        description: str('Optional new responsibility text.'),
        provider: str('Optional provider id.'),
        modelId: str('Optional model id.'),
      },
      ['agentId'],
    ),
  },
  {
    name: 'delete_agents',
    description: 'Delete agents from the team.',
    parameters: obj({ agentIds: idArr('Agent ids to delete.') }, ['agentIds']),
  },
  {
    name: 'delete_skills',
    description: 'Delete team skills.',
    parameters: obj({ skillIds: idArr('Skill ids to delete.') }, ['skillIds']),
  },
  {
    name: 'set_secret',
    description: 'Create or overwrite a team secret (value is write-only, encrypted at rest).',
    parameters: obj(
      {
        name: str('Secret name (env var name).'),
        value: str('Secret value.'),
        description: str('Optional description.'),
      },
      ['name', 'value'],
    ),
  },
  {
    name: 'delete_secrets',
    description: 'Delete team secrets by name or id.',
    parameters: obj({ names: idArr('Secret names or ids to delete.') }, ['names']),
  },
  {
    name: 'set_remote_shell',
    description: 'Grant or revoke the remote shell permission switch of an agent.',
    parameters: obj(
      { agentId: str('Agent id.'), enabled: { type: 'boolean', description: 'Grant or revoke.' } },
      ['agentId', 'enabled'],
    ),
  },
  {
    name: 'schedule_todo',
    description: 'Schedule a todo to rerun (hourly/daily/weekly/once; minute steps 00/15/30/45).',
    parameters: obj(
      {
        todoId: str('Todo id.'),
        kind: str('once | hourly | daily | weekly.'),
        at: {
          type: 'number',
          description: 'Epoch ms anchor (required for once; time-of-day anchor for recurring).',
        },
        machineId: str('Optional pinned machine id; null = automatic.'),
      },
      ['todoId', 'kind'],
    ),
  },
  {
    name: 'unschedule_todo',
    description: 'Remove the schedule of a todo.',
    parameters: obj({ todoId: str('Todo id.') }, ['todoId']),
  },
  // —— 执行侧 5 ——
  {
    name: 'run_builds',
    description:
      'Start builds for todos: assignment picks the executing agent per responsibility fit; withPlan defaults to false (chief dispatch runs directly).',
    parameters: obj(
      {
        todoIds: idArr('Todo ids to start.'),
        assignment: obj(
          {
            plan: obj({ agentId: str('Planning agent id.') }),
            build: obj({ agentId: str('Executing agent id.') }),
          },
          [],
        ),
        withPlan: {
          type: 'boolean',
          description: 'Plan first instead of executing directly; defaults to false.',
        },
      },
      ['todoIds'],
    ),
  },
  {
    name: 'run_review',
    description: 'Request an independent review run of a build.',
    parameters: obj({ buildId: str('Build id.') }, ['buildId']),
  },
  {
    name: 'confirm_builds',
    description: 'Confirm parked plans (confirm gate → building).',
    parameters: obj({ buildIds: idArr('Build ids to confirm.') }, ['buildIds']),
  },
  {
    name: 'cancel_builds',
    description: 'Cancel running or queued builds.',
    parameters: obj({ buildIds: idArr('Build ids to cancel.') }, ['buildIds']),
  },
  {
    name: 'merge_builds',
    description:
      'Merge reviewed builds into the default branch (delegated to a machine merge step).',
    parameters: obj({ buildIds: idArr('Build ids to merge.') }, ['buildIds']),
  },
  // —— Chief 私有侧 10 ——
  {
    name: 'ask_user',
    description: 'Ask the user a question in the chief thread and wait for the next user message.',
    parameters: obj({ question: str('The question to ask.') }, ['question']),
  },
  {
    name: 'notify_user',
    description: 'Push an in-app notification to the user (chief_message event).',
    parameters: obj({ message: str('Notification body.') }, ['message']),
  },
  {
    name: 'save_memory',
    description:
      'Save a one-fact memory entry for the agent running the chief (shared store, quota 100).',
    parameters: obj(
      {
        title: str('Short memory title.'),
        content: str('Memory body.'),
        projectId: str('Optional project id for provenance.'),
      },
      ['title', 'content'],
    ),
  },
  {
    name: 'delete_memory',
    description: 'Delete a memory entry by id.',
    parameters: obj({ memoryId: str('Memory id.') }, ['memoryId']),
  },
  {
    name: 'memories',
    description: 'List the memory entries of the agent running the chief.',
    parameters: obj({}),
    replaySafe: true,
  },
  {
    name: 'watch_todos',
    description: 'Watch todos so the chief is woken when they park at a gate, settle or fail.',
    parameters: obj(
      { todoIds: idArr('Todo ids to watch.'), reason: str('Optional human-readable reason.') },
      ['todoIds'],
    ),
  },
  {
    name: 'unwatch_todos',
    description: 'Stop watching todos.',
    parameters: obj({ todoIds: idArr('Todo ids to unwatch.') }, ['todoIds']),
  },
  {
    name: 'wakes',
    description: 'List pending scheduled wake-ups.',
    parameters: obj({}),
    replaySafe: true,
  },
  {
    name: 'set_wake',
    description: 'Schedule a wake-up to check back on a topic at a given time.',
    parameters: obj(
      {
        at: { type: 'number', description: 'Epoch ms to wake at.' },
        note: str('What to check back on.'),
        todoId: str('Optional todo id to attach.'),
      },
      ['at'],
    ),
  },
  {
    name: 'clear_wake',
    description: 'Cancel a pending wake-up.',
    parameters: obj({ wakeId: str('Wake id.') }, ['wakeId']),
  },
];

/** 词表自检：49 件、键集 = CHIEF_TOOL_NAMES、读侧全 replaySafe。 */
export const CHIEF_TOOL_COUNT = 49;

/** worker 步记忆三件套（02 §4.4 写路径 / r5 §6：worker 侧同族工具经
 * remoteTools 下发——「bundle 无本地记忆实现」，写路径 = agent 工具 → 服务端
 * relay 执行）。触发语义 = spec 指令可触发 + Agent 裁量（无指令零写入；宿主
 * 不做任务结束蒸馏）。sourceTodoId 可选：缺省时 server 从步上下文补齐
 * （溯源形状 r5 §6 实测样本 = 运行中 todo/build）。描述措辞面向 worker
 * （chief 词表同族工具描述面向 chief 绑定 Agent，语义同）。 */
export const WORKER_MEMORY_REMOTE_TOOLS: readonly RemoteToolDef[] = [
  {
    name: 'save_memory',
    description:
      'Save a one-fact memory entry for yourself (the agent running this step). Use it only when the task instructions ask for it or a lesson is clearly worth keeping. Quota 100 per agent.',
    parameters: obj(
      {
        title: str('Short memory title.'),
        content: str('Memory body.'),
        projectId: str('Optional project id for provenance.'),
        sourceTodoId: str('Optional source todo id; defaults to the running task.'),
      },
      ['title', 'content'],
    ),
  },
  {
    name: 'delete_memory',
    description: 'Delete one of your memory entries by id.',
    parameters: obj({ memoryId: str('Memory id.') }, ['memoryId']),
  },
  {
    name: 'memories',
    description: 'List your own memory entries.',
    parameters: obj({}),
    replaySafe: true,
  },
];

/** worker 步全量工具（r5 §3.1 + #310/r9 §3.1）：记忆三件套 + 附件读。chief 49
 * 词表（组织/执行面）不外溢到 worker——worker 读路径只挂「任务内可读」面。
 * attachment 同 chief-tools 形态：replaySafe + attachmentId 必填。 */
export const WORKER_REMOTE_TOOLS: readonly RemoteToolDef[] = [
  ...WORKER_MEMORY_REMOTE_TOOLS,
  {
    name: 'attachment',
    description:
      'Fetch an attachment referenced by a task spec or message. ' +
      'Spec tokens of the form ![name](attachment:<teamId>/<id>.<ext>) embed an attachment; ' +
      'call with the bare <id> (the part before the extension). ' +
      'Returns the file content (utf8 for text/* / json / xml, base64 for images / pdf).',
    parameters: obj({ attachmentId: str('Attachment id.') }, ['attachmentId']),
    replaySafe: true,
  },
];
