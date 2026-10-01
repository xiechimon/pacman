// Chief remoteTools 词表——raw 观测 49 件（r5 §3.1，一手来源 = thread 记录
// toolDefHashes 全键 `docs/research/assets/r5/raw/chief-threads-testA.json`），
// 现行 49 件 = raw − CHIEF_TOOLS_REMOVED + CHIEF_TOOLS_ADDED（divergence
// 双向登记，登记处见两常量）。复刻口径（02 §4.3 尾注）：Chief = 挂团队
// 工具的 pi 会话，行为分毫不求同；工具「名单」为实测一手，各工具的
// description/parameters 细形未采到 wire 原件 = 全部 [推断] 黑盒逼近
// （04 §1 A4：不冒充实测），语义按 r1 docs 六能力组 + r3/r5 行为证据投影。
// 分组计数按 raw 键集实数：读 15 + 组织 19 + 执行 5 + 私有 10 = 49
// （r5 §3.1 正文枚举漏 `delete_skills`，02 §4.3 分组计数随之偏差——raw 键集
// 为权威，vocabulary.test 对拍）；现行分组 = 组织 19（delete_skills、
// set_remote_shell 两件已除名；create_skill、update_skill 两件随 XMON-109
// spec 13 回摆加入——raw 无此二键，经 CHIEF_TOOLS_ADDED 登记）。
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

/** 从 raw 49 键观测词表中有意移除的工具（divergence 登记，对拍测试 =
 * raw 键集 − 本集）。spec 13 #367：delete_skills——技能改本地目录现扫投影
 * （不入库），删除技能 = 从磁盘删目录，server 无删除面可 relay。
 * XMON-77：set_remote_shell——「远程 shell」本体未实现（XMON-84 用户拍板 B
 * 后开关保留在权限词表，但写入点随本体在规划票里重新设计，词条维持除名；
 * 改授权走 REST PATCH /agents/{aid}）。 */
export const CHIEF_TOOLS_REMOVED = ['delete_skills', 'set_remote_shell'] as const;

/** raw 之外有意加入的工具（divergence 反向登记，对拍测试 = raw 键集 −
 * removed + added）。XMON-109（spec 13 回摆）：create_skill / update_skill
 * ——chief 自动制作/维护技能收进 scope（chief 免开关，leader 拍板）。 */
export const CHIEF_TOOLS_ADDED = ['create_skill', 'update_skill'] as const;

/** 词表分组（r5 §3.1 正文分组语义；成员按 raw 键集归位 [推断]；
 * delete_skills、set_remote_shell 已除名；create_skill、update_skill 随
 * XMON-109 归组织面——raw 的 delete_skills 即组织位，写件同位）。 */
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
    'create_skill',
    'update_skill',
    'set_secret',
    'delete_secrets',
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

/** 现行词表键集（raw 49 键 − 除名登记；vocabulary.test 对拍）。 */
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
    // 批量读是刻意的：这个工具实测占全部工具调用的 64%，而每次调用都是一整趟
    // 模型往返（上下文重发一遍，是成本的大头）。paths 一次给多个文件路径，
    // 把「读五个文件」从五趟压到一趟。
    description:
      'Read repository documents (files at a ref) for a project. Pass several paths at once to read them in one call.',
    parameters: obj(
      {
        projectId: str('Project id.'),
        paths: idArr('File paths to read — batch them; one call may read many files.'),
        ref: str('Optional git ref; defaults to the default branch.'),
      },
      ['projectId', 'paths'],
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
  // —— 组织侧 18（raw 19 − delete_skills，spec 13 除名）——
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
  // create_skill / update_skill（XMON-109，CHIEF_TOOLS_ADDED 登记）：组织面
  // 写件，归 delete_skills 的 raw 组织位。写向 = 团队技能根本地目录，body
  // 语义与 REST 写面同形（frontmatter 是唯一真值）。
  {
    name: 'create_skill',
    description:
      'Create a team skill as a folder in the team skills directory. The skill is a ' +
      'SKILL.md entry file (frontmatter name and description are required and must ' +
      'match the declared values) plus optional extra files.',
    parameters: obj(
      {
        name: str('Skill name; also the folder name and the SKILL.md frontmatter name.'),
        description: str('One-line skill description; must match the SKILL.md frontmatter.'),
        files: arr(
          obj({ path: str('File path inside the skill folder.'), content: str('File text.') }),
          'Skill files; must include SKILL.md.',
        ),
      },
      ['name', 'description', 'files'],
    ),
  },
  {
    name: 'update_skill',
    description:
      'Update an existing team skill by id. Listed files are overwritten, unlisted files ' +
      'are kept; include a new SKILL.md to change the frontmatter (including renaming).',
    parameters: obj(
      {
        skillId: str('Skill id to update.'),
        name: str('Declared skill name; must match the SKILL.md frontmatter.'),
        description: str('Declared description; must match the SKILL.md frontmatter.'),
        files: arr(
          obj({ path: str('File path inside the skill folder.'), content: str('File text.') }),
          'Files to overwrite; include SKILL.md to change frontmatter.',
        ),
      },
      ['skillId', 'name', 'description', 'files'],
    ),
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
  // set_remote_shell 已除名（XMON-77 维持至 XMON-84）：「远程 shell」本体未
  // 实现（开关已随用户拍板 B 恢复，写入点随本体在规划票里重新设计）——改授权
  // 走 REST PATCH /agents/{aid}，词条与
  // handler 均不保留）。
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

/** 词表自检：现行 49 件（raw 49 − CHIEF_TOOLS_REMOVED 2 + CHIEF_TOOLS_ADDED
 * 2）、键集 = CHIEF_TOOL_NAMES、读侧全 replaySafe。 */
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

/** worker 步附件读工具（#310/r9 §3.1）：chief-tools attachment 同形态
 * （replaySafe + attachmentId 必填）。 */
const WORKER_ATTACHMENT_TOOL: RemoteToolDef = {
  name: 'attachment',
  description:
    'Fetch an attachment referenced by a task spec or message. ' +
    'Spec tokens of the form ![name](attachment:<teamId>/<id>.<ext>) embed an attachment; ' +
    'call with the bare <id> (the part before the extension). ' +
    'Returns the file content (utf8 for text/* / json / xml, base64 for images / pdf).',
  parameters: obj({ attachmentId: str('Attachment id.') }, ['attachmentId']),
  replaySafe: true,
};

/** set_task_meta local 形态（spec 15 #394 / ADR 0002 D3 原样）：title 必填
 * 占位回填 + tag 单值固定 6 词表。窄设计：todoId 由 server 从 stepId 钉死
 * （词表外 tag name = 400），agent 无越权改他任务的参数面。 */
const SET_TASK_META_TOOL: RemoteToolDef = {
  name: 'set_task_meta',
  description:
    'Set the title and category tag of the task you are currently working on. ' +
    'Call exactly once before starting work: title = a concise summary of the task spec ' +
    '(50 chars max, plain text, no markdown); tag = one name from the fixed tag vocabulary ' +
    'listed in your instructions (omit it when none fits).',
  parameters: obj(
    {
      title: str('Task title, 50 chars max.'),
      tag: str('Optional tag name from the fixed vocabulary.'),
    },
    ['title'],
  ),
};

/** set_task_meta github 形态变体（#446 / ADR 0005 D2/D4/D5）：title 可选
 * （issue 来源的标题已是真值，daemon 不指示回填）；tag 单值改 tags 数组
 * （词表 = 仓库 label 镜像，issue 挂几个贴几个——「至多 1 个」github 侧
 * 作废）。校验真值在 server setTaskMeta（按项目形态分支取标签集，不信任
 * 工具面形状）。 */
const SET_TASK_META_TOOL_MULTI_TAG: RemoteToolDef = {
  name: 'set_task_meta',
  description:
    'Update the title and/or category tags of the task you are currently working on. ' +
    'title: a concise summary of the task spec (50 chars max, plain text, no markdown) — ' +
    'only when your instructions ask you to replace a placeholder title, omit otherwise. ' +
    'tags: names from the project tag vocabulary listed in your instructions ' +
    '(several allowed; omit when none fits).',
  parameters: obj({
    title: str('Optional task title, 50 chars max.'),
    tags: arr({ type: 'string' }, 'Optional tag names from the project vocabulary.'),
  }),
};

/** worker 技能写词（XMON-109 S1）：词表恒列（write 面授权属 agent 行
 * tools 开关，与词表下发解耦——无开关的 agent 也看到词，执行时 403 点名
 * 开关，requestMerge 同形）。两形态（local/github）同词同形。 */
export const WORKER_SKILL_TOOLS: readonly RemoteToolDef[] = [
  {
    name: 'create_skill',
    description:
      'Create a team skill as a folder in the team skills directory. Requires the ' +
      '「创建技能」permission switch on your agent row. The SKILL.md frontmatter name ' +
      'and description must match the declared values.',
    parameters: obj(
      {
        name: str('Skill name; also the folder name and the SKILL.md frontmatter name.'),
        description: str('One-line skill description; must match the SKILL.md frontmatter.'),
        files: arr(
          obj({ path: str('File path inside the skill folder.'), content: str('File text.') }),
          'Skill files; must include SKILL.md.',
        ),
      },
      ['name', 'description', 'files'],
    ),
  },
  {
    name: 'update_skill',
    description:
      'Update an existing team skill by id. Requires the「更新技能」permission switch ' +
      'on your agent row. Listed files are overwritten, unlisted files are kept; include ' +
      'a new SKILL.md to change the frontmatter (including renaming).',
    parameters: obj(
      {
        skillId: str('Skill id to update.'),
        name: str('Declared skill name; must match the SKILL.md frontmatter.'),
        description: str('Declared description; must match the SKILL.md frontmatter.'),
        files: arr(
          obj({ path: str('File path inside the skill folder.'), content: str('File text.') }),
          'Files to overwrite; include SKILL.md to change frontmatter.',
        ),
      },
      ['skillId', 'name', 'description', 'files'],
    ),
  },
];

/** worker 步全量工具（r5 §3.1 + #310/r9 §3.1 + spec 15 #394 + XMON-109）：
 * 记忆三件套 + 附件读 + 任务元信息回填 + 技能写词（恒列，开关执法在
 * executor）。chief 49 词表（组织/执行面）不外溢到 worker——worker 路径
 * 只挂「任务内可操作」面（技能写是例外：按 XMON-109 拍板 worker 也写）。 */
export const WORKER_REMOTE_TOOLS: readonly RemoteToolDef[] = [
  ...WORKER_MEMORY_REMOTE_TOOLS,
  WORKER_ATTACHMENT_TOOL,
  SET_TASK_META_TOOL,
  ...WORKER_SKILL_TOOLS,
];

/** github 形态项目的 worker 工具面（#446）：set_task_meta 换多标签变体，
 * 其余同 WORKER_REMOTE_TOOLS。server claim 按项目形态下发（machines.ts）。 */
export const WORKER_REMOTE_TOOLS_GITHUB: readonly RemoteToolDef[] = [
  ...WORKER_MEMORY_REMOTE_TOOLS,
  WORKER_ATTACHMENT_TOOL,
  SET_TASK_META_TOOL_MULTI_TAG,
  ...WORKER_SKILL_TOOLS,
];
