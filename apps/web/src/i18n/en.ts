// en fallback dictionary (issue #74, 01-stack-v2 S6): the workspace is
// zh-CN authoritative, so the zh source string is the key and this flat
// table is the only en layer — no framework, no namespaces. The official
// en workspace was never observed (r2 §11 Q19), so every value here is
// [设计]; domain nouns follow the CONTEXT.md canonical glossary (任务 Todo,
// 运行 Build, 方案 Plan, 总管 Chief, 定时 Schedule, 模型服务 Provider,
// 密钥 Secret, 机器 Machine, 技能 Skill, Token 用量 Token usage …).
// One zh key = one en value; where a word serves several surfaces (任务 as
// nav row and as popover section) the single best fit is noted inline.
// Discipline: zh renders never touch this file (translate() identity), so
// the parity matrix stays the zh regression gate; coverage of the en side
// is gated by test/i18n-coverage.test.ts.
//
// Fixture-carried chrome: a handful of system-generated labels (streaming
// status, plan-card title, chief thread chip, resource type/pill words)
// reach components through fixture records as capture-verbatim strings.
// They key by exact value here and render through t() like any chrome —
// user/agent content (todo titles, bubbles, docs) never enters the dict
// and falls back to the zh original, exactly like the real app would.

import { PROBE_TOOL_CALL_LABEL, PROBE_TOOL_PILLS } from '../fixtures/fixtures.js';

export const EN: Record<string, string> = {
  // —— shared chrome / sidebar (r2 §1.1) ——
  搜索: 'Search',
  看板: 'Board',
  定时: 'Schedules',
  项目: 'Project', // sidebar group / search group / schedule-form field — one fit
  资源: 'Resources',
  新建项目: 'New project',
  技能: 'Skills',
  密钥: 'Secrets',
  机器: 'Machines',
  模型服务: 'Providers',
  用量: 'Usage',
  收起侧边栏: 'Collapse sidebar',
  展开侧边栏: 'Expand sidebar',
  '收起{label}': 'Collapse {label}',
  '展开{label}': 'Expand {label}',
  总管: 'Chief',
  返回: 'Back',
  更多: 'More',
  关闭: 'Close',
  取消: 'Cancel',
  保存: 'Save',
  删除: 'Delete',
  今天: 'today',

  // —— board surface (r2 §4.1, r7 01/02) ——
  任务: 'Todo', // topbar +任务 button / search nav row / popover section
  看板指南: 'Board guide',
  // guide popover content (#149; [设计] copy — the official guide panel's
  // content was never captured, free-content precedent = whats-new)
  列语义: 'Columns',
  关口操作: 'Gates',
  快速跳转: 'Quick jump',
  '已创建、尚未启动的任务在此排队': 'Created tasks queue here until they start',
  'Agent 正在起草方案，进详情页可实时查看':
    'The agent is drafting the plan — open the task to watch it live',
  '方案就绪：确认后开工，或提出修改意见':
    'Plan ready — confirm to start the work, or ask for changes',
  'Agent 正在执行；失败与待回复的任务钉在列首':
    'The agent is executing; failed and awaiting-reply tasks stay pinned to the top',
  '执行完成：审查变更后验收合并': 'Work done — review the changes, then accept to merge',
  '已合并收尾；重开可发起新一轮': 'Merged and closed; reopen to start a new round',
  '待确认 → 确认方案，或在输入框提出修改':
    'To confirm — approve the plan, or send changes from the composer',
  '待验收 → 审查变更，验收即合并': 'To review — inspect the changes; accepting merges the branch',
  '失败 → 重跑，可复用已有方案': 'Failed — rerun, optionally reusing the existing plan',
  '打开全局搜索，直达任务与资源': 'Open global search to jump to tasks and resources',
  待开始: 'To start',
  规划中: 'Planning',
  待确认: 'To confirm',
  执行中: 'Running',
  待验收: 'To review',
  已完成: 'Done',
  没有等待开始的任务: 'No tasks waiting to start',
  没有规划中的任务: 'No tasks in planning',
  没有等你确认的方案: 'No plans waiting for your confirmation',
  没有执行中的任务: 'No tasks running',
  没有等你验收的任务: 'No tasks waiting for your review',
  '最近 7 天没有完成的任务': 'No tasks completed in the last 7 days',
  '最近 7 天': 'Last 7 days',
  回复: 'Reply',
  '分支与 PR': 'Branch & PR',
  方案: 'Plan',
  变更: 'Changes',
  // 看板顶部通知引导条 (issue #114): components consume the shared
  // NOTIFICATION_BANNER_COPY canon — these keys match its zh values
  // verbatim (i18n-coverage liveness via COMPUTED_KEYS)
  浏览器通知未开启: 'Browser notifications are off',
  '标签页切换到后台时，通过桌面通知提醒你。':
    'Get a desktop reminder when this tab is in the background.',
  开启: 'Turn on',

  // —— phase chips / actions / placeholders (phase.ts canon table) ——
  待处理: 'Pending',
  确认: 'Confirm',
  审核: 'Review',
  开始: 'Start',
  完成: 'Complete',
  重开: 'Reopen',
  '向 Agent 补充说明，执行过程中即可送达':
    'Add details for the Agent — delivered while the run is in progress',
  '请求修改…': 'Request changes…',

  // —— relative time (rel-time.ts; compact en forms avoid plural logic) ——
  刚刚: 'just now',
  '{n} 分钟前': '{n}m ago',
  '{n} 小时前': '{n}h ago',
  昨天: 'yesterday',
  '{n} 天前': '{n}d ago',

  // —— todo detail (r7 §3.3–§3.6) ——
  文档: 'Document',
  聊天: 'Chat',
  'Token 用量': 'Token usage',
  运行历史: 'Run history',
  语音输入: 'Voice input',
  添加附件: 'Add attachment',
  'AI 审核': 'AI review',
  提及: 'Mention',
  停止: 'Stop',
  发送: 'Send',
  暂无方案: 'No plan yet',
  暂无可显示的变更: 'No changes to show',
  '· {n} 个文件改动': '· {n} files changed',
  全部展开: 'Expand all',
  全部收起: 'Collapse all',
  显示完整文件: 'Show full file',
  '完成 {elapsed}': 'Done in {elapsed}',
  运行在: 'Running on',
  上: '', // tail of 运行在 <machine> 上 — the en template needs no tail
  由定时发起: 'Started by schedule',
  收起: 'Collapse',
  尚无描述: 'No description yet',
  '{y}年{mo}月{d}日 {hh}:{mm} 创建': 'Created {monthShort} {d}, {y} {hh}:{mm}',

  // —— user-menu popover (r7 §3.5; 新功能/快捷键 行随 #163 隐去，键同删） ——
  帐号: 'Account',
  'API 密钥': 'API keys',
  外观: 'Appearance',
  浅色: 'Light',
  深色: 'Dark',

  // —— chip popover / plan dropdown (r7 19/20/29) ——
  任务分配: 'Task assignment',
  执行对话: 'Active run',
  未指派: 'Unassigned',
  编辑分配: 'Edit assignment',
  文档类型: 'Document type',

  // —— ⌘K search panel (r7 05/05b, r2 §8.4) ——
  关闭搜索: 'Close search',
  '搜索任务、项目、成员…': 'Search todos, projects, members…',
  前往: 'Go to',
  团队: 'Team',
  '没有与“{q}”匹配的结果': 'No results matching “{q}”',

  // —— schedules route (r3 §9, 02 §9.2) ——
  每小时: 'Hourly',
  每天: 'Daily',
  每周: 'Weekly',
  单次: 'Once',
  每小时运行: 'Runs hourly',
  每天运行: 'Runs daily',
  每周运行: 'Runs weekly',
  运行一次: 'Runs once',
  '{mo}月{d}日': '{monthShort} {d}',
  '下次 {day} {time}': 'Next {day} {time}',
  自动: 'Auto',
  新建定时: 'New schedule',
  日期: 'Date',
  时间: 'Time',
  时: 'Hour',
  分: 'Minute',
  '按你的本地时区运行（Asia/Shanghai）': 'Runs in your local time zone (Asia/Shanghai)',
  '尚无定时。': 'No schedules yet.',
  '按周期或在指定时间自动重新运行任务。每一轮都会依据任务描述从头开始一次全新运行，到达确认或审核关口时暂停，交由负责人接手。':
    'Automatically rerun a task on a cycle or at a chosen time. Every round starts a fresh run from the task description, pausing at the confirm or review gate for the owner to pick up.',
  查看文档: 'View docs',
  '也可以直接告诉总管某个任务要多久重跑一次，它会替你写好规则。':
    'You can also just tell the Chief how often a task should rerun, and it will write the rule for you.',

  // —— account route (r7 13) ——
  更换: 'Change',
  名称: 'Name',
  邮箱: 'Email',
  语言: 'Language',
  推送通知: 'Push notifications',

  // —— team route (r7 12) ——
  设置: 'Settings',
  '{n} 个成员': '{n} members',
  // #148 chart layout empty state (r2 §8.1 17c verbatim)
  暂无成员: 'No members yet',
  ' · 默认': ' · Default',
  未设置职责: 'No role set',
  '创建 Agent': 'Create Agent',

  // —— api-keys route (r2 19, 02 §8 canon note) ——
  '尚无 API 密钥。': 'No API keys yet.',
  'API 密钥用于从命令行接入机器，也让 MCP 客户端能访问你的看板。':
    'API keys connect machines from the command line and let MCP clients reach your board.',
  新建密钥: 'New key',
  复制: 'Copy',
  '请立即复制密钥，它仅显示一次。': 'Copy the key now — it is shown only once.',

  // —— resources routes (r7 06–10, r2 §6, r8 79/80) ——
  新建: 'New',
  'MCP 服务器': 'MCP Servers',
  新建技能: 'New skill',
  添加机器: 'Add machine',
  自定义: 'Custom',
  '搜索技能...': 'Search skills...',
  排序: 'Sort',
  '尚无技能。': 'No skills yet.',
  '技能是写给 Agent 的工作手册：一个包含 SKILL.md 的文件夹，用于将可复用的流程传授给 Agent。授予后，Agent 会在合适的任务中主动使用。':
    'Skills are playbooks for Agents: a folder containing a SKILL.md that teaches a reusable workflow. Once granted, Agents reach for them on the todos that fit.',
  添加技能: 'Add skill',
  '你也可以直接让总管从 GitHub 安装技能，或帮你制作新技能。':
    'You can also just let the Chief install skills from GitHub, or craft new ones for you.',
  '尚无 MCP 服务器。': 'No MCP servers yet.',
  'MCP 服务器为 Agent 提供额外工具，例如工单系统、浏览器、内部 API。授权在每个 Agent 的页面上单独进行。':
    'MCP servers give Agents extra tools — ticketing systems, browsers, internal APIs. Authorization happens per Agent, on its own page.',
  '添加 MCP 服务器': 'Add MCP server',
  '尚无密钥。': 'No secrets yet.',
  '团队密钥将以环境变量注入每个任务的 shell。值只写不读：保存后只能覆盖或删除，无法再次查看。':
    'Team secrets are injected into every task shell as environment variables. Values are write-only: once saved they can be overwritten or deleted, never viewed again.',
  添加密钥: 'Add secret',
  '也可以让总管添加：它会开一张安全输入卡填写值，值不会进入对话。':
    'The Chief can add them too: it opens a secure input card for the value, which never enters the conversation.',
  从文件夹: 'From folder',
  '从 GitHub': 'From GitHub',
  技能文件夹: 'Skill folder',
  点击或拖入技能文件夹: 'Click or drop a skill folder',
  已选择: 'Selected',
  个文件: 'file(s)',
  '必须包含 SKILL.md': 'Must contain SKILL.md',
  '例如：deploy': 'e.g. deploy',
  描述: 'Description',
  简要描述该技能的功能: 'Briefly describe what the skill does',
  创建技能: 'Create skill',
  'GitHub 链接': 'GitHub link',
  扫描: 'Scan',
  '输入仓库链接以扫描其中的技能，或直接指向某个技能目录。':
    'Enter a repo link to scan it for skills, or point directly at a skill directory.',
  // #235 GitHub 扫描结果区（live）
  '扫描中…': 'Scanning…',
  '未发现技能。': 'No skills found.',
  '结果已截断，仅显示部分候选。': 'Results truncated — showing a partial list.',
  '导入中…': 'Importing…',
  扫描失败: 'Scan failed',
  导入失败: 'Import failed',

  // —— project routes (r2 07/24/24b/24c) ——
  文件: 'Files',
  历史: 'History',
  '尚无提交历史。': 'No commits yet.',
  '搜索任务…': 'Search todos…',
  搜索任务: 'Search todos',
  筛选: 'Filter',
  列表视图: 'List view',
  网格视图: 'Grid view',
  暂无内容: 'Nothing yet',
  '创建第一个任务以开始使用。': 'Create your first todo to get started.',
  默认项目: 'Default Project',
  // 桌面通知标题（M5 SSE notification 事件面，02 §9.1 三事件；api/sse.ts
  // 纯函数位消费——非组件 t()，i18n-coverage 以本键位兑现 en 兜底）
  方案已就绪: 'Plan ready',
  构建待审核: 'Build awaiting review',
  请选择一个文件查看: 'Select a file to view',
  // #202 文件查看器三态（loading / error / 不可预览）
  '加载中…': 'Loading…',
  文件加载失败: 'Failed to load file',
  二进制文件暂不支持预览: 'Binary files cannot be previewed',
  '可选。未设置时以首字母代替。': 'Optional. The initial is used when unset.',
  项目名称: 'Project name',
  仓库: 'Repo',
  选择仓库: 'Select repo',
  创建项目: 'Create project',
  基本信息: 'Basic info',
  标签: 'Tags',
  'Pacman 托管': 'Pacman hosted',
  目标分支: 'Target branch',
  危险操作: 'Danger zone',
  删除项目: 'Delete project',
  '将永久删除所有任务与执行记录，此操作不可恢复。':
    'Permanently deletes all todos and run records. This cannot be undone.',
  // #207 确认弹层(r2 24d): 标题镜像删除任务句,确认输入行 {name} = 项目名。
  '确定删除该项目？此操作不可撤销。': 'Delete this project? This cannot be undone.',
  '输入 {name} 以确认删除': 'Type {name} to confirm deletion.',

  // —— chief drawer / settings (r5 100–116) ——
  主题: 'Thread',
  新主题: 'New thread',
  总管设置: 'Chief settings',
  全屏: 'Fullscreen',
  退出全屏: 'Exit fullscreen',
  '请先为总管选择一个 Agent。': 'Choose an Agent for the Chief first.',
  选择一个主题开始: 'Pick a thread to start',
  '有什么可以帮你的？': 'How can I help?',
  '完成 {n}': 'Done in {n}',
  章程: 'Charter',
  记忆: 'Memory',
  关注与提醒: 'Watches & reminders',
  未设置: 'Not set',
  压缩模型: 'Compaction model',
  '压缩上下文时用来生成摘要的模型，选更快的模型可缩短等待。需要 {cli} CLI 0.1.49 及以上版本。':
    'The model used to summarize context during compaction — a faster one shortens the wait. Requires {cli} CLI 0.1.49 or later.',
  '默认（与 Chief 相同）': 'Default (same as Chief)',
  '尚无章程。点击编辑，为总管添加常设指示。':
    'No charter yet. Click edit to give the Chief standing instructions.',
  编辑: 'Edit',
  '尚未选择 Agent。请先在「Agent」页选定 Agent，记忆将保存在该 Agent 上。':
    'No Agent selected yet. Pick an Agent on the "Agent" tab first; memories are saved on that Agent.',
  '暂无跟进事项。总管关注某个任务，或约定到点回头核实时，会按主题列在这里。':
    'Nothing being watched yet. When the Chief watches a todo, or promises to check back at a set time, it is listed here by thread.',
  // #182 设置面接线：选择总管 Agent dialog + 章程编辑弹窗；换绑二次确认
  // copy 走 shared CHIEF_REBIND_CONFIRM_COPY canon（<agent> 占位，显示层替换，
  // i18n-coverage COMPUTED_KEYS 登记）。
  '选择总管 Agent': "Choose the Chief's Agent",
  '搜索 Agent…': 'Search Agents…',
  '没有匹配的 Agent': 'No matching Agents',
  '更换总管的 agent？总管的记忆保存在其运行所用的 Agent 上。切换至 <agent> 后，记忆将变为 <agent> 的记忆，当前记忆不会迁移。':
    "Switch the Chief's Agent? The Chief's memory lives on the Agent it runs on. After switching to <agent>, the memory becomes <agent>'s — the current memory is not migrated.",
  编辑章程: 'Edit charter',
  保存章程: 'Save charter',
  '长期指令：模型路由规则（何种任务使用何种模型）、优先级、偏好…':
    'Long-term instructions: model routing rules (which model for which work), priorities, preferences…',
  // #209 编辑分配接线：chip-popover「编辑分配」→ agent 选择弹层（#182 家族
  // 形态复用）；弹层内容 r2 C.18 从未捕获，文案 [设计]，<agent> 占位显示层
  // 替换。
  '选择执行 Agent': 'Choose the executing Agent',
  '更换执行 Agent？后续运行将改由 <agent> 执行。':
    'Change the executing Agent? Future runs will be executed by <agent>.',

  // —— chrome carried inside fixture records (exact-value keys; user and
  // agent content is deliberately absent — it falls back to the zh
  // original like any real user data would) ——
  '准备工作区...': 'Preparing workspace...',
  '处理中...': 'Working on it...',
  [PROBE_TOOL_CALL_LABEL]: `Calling tool: ${PROBE_TOOL_PILLS[1]}`,
  '方案 · v1': 'Plan · v1',
  'Xmon Dai 发起了合并': 'Xmon Dai started a merge',
  '🎉 任务已完成': '🎉 Todo completed',
  '运行在 ': 'Running on ',
  '远程（HTTP）': 'Remote (HTTP)',
  '2 天前': '2d ago',
  'Pacman 托管机器': 'Pacman hosted machine',
  '随时在线，构建速度快。空闲自动休眠，仅在运行时消耗积分。':
    'Always online and quick to build. Sleeps automatically when idle; consumes credits only while running.',
  未启用: 'Disabled',
  'Pacman（内置）': 'Pacman (built-in)',
  '8 模型': '8 models',
  '12 模型': '12 models',
  // —— overlay dialogs (issues #66 / #68) ——
  新建任务: 'New task',
  '需要做什么？': 'What needs to be done?',
  '我想要的结果：': 'The outcome I want:',
  '现在的情况：': 'Where things stand now:',
  '需要保留或避免：': 'What must be kept or avoided:',
  '我会这样确认完成：': 'How I will confirm this is done:',
  '我希望收到：': 'What I expect to receive:',
  添加标签: 'Add tag',
  保存并开始: 'Save and start',
  删除任务: 'Delete todo',
  '确定删除该任务？此操作不可撤销。': 'Delete this todo? This cannot be undone.',
  关闭菜单: 'Close menu',
  复制链接: 'Copy link',
  完成任务: 'Complete todo',
  将改动合并到默认分支: 'Merge the changes into the default branch',
  输入: 'Input',
  输出: 'Output',
  缓存读取: 'Cache read',
  缓存写入: 'Cache write',
  当前: 'Current',
  重跑: 'Rerun',
  构建分支: 'Build branch',
  目标提交: 'Target commit',
  同步到机器: 'Sync to machine',
  目标机器: 'Target machine',
  同步目录: 'Sync directory',
  强制同步: 'Force sync',
  '丢弃代码修改并删除非忽略的未跟踪文件；保留忽略内容。仅本次生效。':
    'Discards code changes and removes non-ignored untracked files; ignored content is kept. This sync only.',
  同步: 'Sync',
  未创建: 'Not created',
  // run-history rows: fixture-carried chrome (exact-value keys)
  '第 1 次运行': 'Run 1',
  '第 2 次运行': 'Run 2',
  '第 3 次运行': 'Run 3',
  '第 4 次运行': 'Run 4',
  '12 分钟前 · 38.3k tokens': '12m ago · 38.3k tokens',
  '6 小时前 · 66.1k tokens': '6h ago · 66.1k tokens',
  '3 天前 · Cancelled': '3d ago · Cancelled',
  '3 天前': '3d ago',
  '4 天前 · Machine offline': '4d ago · Machine offline',
  '2 天前 · 41.7k tokens': '2d ago · 41.7k tokens',
  '帮我组建 Agent 团队': 'Help me build an Agent team',
  帮我创建一个新项目: 'Help me create a new project',
  总结一下我所有项目现在的进展: 'Summarize the progress of all my projects',
  '查一下这个月的 token 用量': "Check this month's token usage",

  // —— #75 deep dynamic states: reject loop / failed / reuse plan ——
  由总管发起: 'Started by Chief',
  '运行在 {m} 上': 'Running on {m}',
  上一版本: 'Previous version',
  '与其他版本对比…': 'Compare with other versions…',
  '回到与 base 对比': 'Back to comparison with base',
  复用方案: 'Reuse plan',
  选择接下来如何使用这个方案: 'Choose how to use this plan next',
  查看方案: 'View plan',
  直接执行: 'Run directly',
  重试: 'Retry',
  失败: 'Failed',
  默认: 'Default',
  开始任务: 'Start task',
  '规划与执行分用不同 Agent': 'Use different agents for planning and execution',
  先做规划: 'Plan first',
  立即执行: 'Run now',
  // #170 create-agent dialog family
  '创建 agent': 'Create agent',
  '输入 Agent 名称': 'Enter an agent name',
  尚未配置模型服务商: 'No model provider configured yet',
  配置服务商: 'Configure providers',
  创建: 'Create',
  // wayfinder #173 add-secret dialog family (r2 §242 verbatim fields)
  '名称（环境变量名）': 'Name (environment variable name)',
  '描述（可选）': 'Description (optional)',
  值: 'Value',
  该密钥的用途: 'What this secret is for',
  粘贴密钥的值: 'Paste the secret value',
  '值将加密存储，保存后无法再次查看。':
    'The value is stored encrypted and cannot be viewed again after saving.',
  // wayfinder #178 project tasks toolbar (filter/sort menus, match-empty line)
  全部: 'All',
  进行中: 'In progress',
  最近更新: 'Recently updated',
  标题: 'Title',
  没有匹配的任务: 'No matching tasks',
  // wayfinder #174 add-mcp-server dialog family (02 §6.2 / r3 §5.1 text
  // authority; geometry [推断] — capture PNGs unreadable on this API line)
  类型: 'Type',
  '远程 HTTP': 'Remote HTTP',
  本地命令: 'Local command',
  标识符: 'Slug',
  '用作前缀，创建后不可修改。': 'Used as a prefix; cannot be changed after creation.',
  '例如：内部工单系统': 'e.g. internal ticketing',
  '请求头（可选）': 'Headers (optional)',
  请求头名称: 'Header name',
  请求头值: 'Header value',
  添加请求头: 'Add header',
  命令: 'Command',
  '参数（可选，空格分隔）': 'Arguments (optional, space-separated)',
  // wayfinder #175 add-provider dialog family (field authority = server
  // createProviderBodySchema / r3 §2; protocol tab labels stay English
  // verbatim, never translated)
  添加模型服务: 'Add provider',
  '服务商 ID': 'Provider ID',
  '例如 my-relay': 'e.g. my-relay',
  'API 协议': 'API protocol',
  无密钥网关可留空: 'Leave empty for keyless gateways',
  '以 Authorization: Bearer 请求头发送 API 密钥':
    'Send the API key as an Authorization: Bearer header',
  '密钥将加密存储，保存后无法再次查看。':
    'The key is stored encrypted and cannot be viewed again after saving.',
  '模型（可选）': 'Models (optional)',
  '模型 ID': 'Model ID',
  添加模型: 'Add model',
  // wayfinder #181 add-machine dialog family (r2 11b verbatim copy; the
  // command strings themselves stay untranslated — brand slots via BRAND)
  '有条件时优先使用云主机：笔记本会休眠或断网，云主机常在线，构建更稳定。':
    'Prefer a cloud host when you can: laptops sleep or drop off the network, while cloud hosts stay online and build more reliably.',
  '在待接入的机器上执行以下命令。浏览器将打开登录页，授权团队 {team} 后机器即可上线。此后它在后台常驻运行，无需保持终端开启。':
    'Run the following commands on the machine you want to connect. Your browser will open a sign-in page; once you authorize the team {team}, the machine comes online. It then keeps running in the background — no need to keep the terminal open.',
  '安装 CLI': 'Install the CLI',
  在机器上执行: 'Run on the machine',
  '在云服务器上运行？改用 API key 注册':
    'Running on a cloud server? Register with an API key instead',
  '获取 API key →': 'Get an API key →',
};
