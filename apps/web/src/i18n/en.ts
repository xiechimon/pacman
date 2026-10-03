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
// the e2e suite stays the zh regression gate; coverage of the en side
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
  // #351 看板更名工作台：'Workbench'（不用 'Workspace'，避撞 daemon workspaces 概念）
  工作台: 'Workbench',
  定时: 'Schedules',
  项目: 'Project', // sidebar group / search group / schedule-form field — one fit
  资源: 'Resources',
  新建项目: 'New project',
  新任务: 'New task', // sidebar action row (#389) — the dialog title stays 新建任务
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

  // —— board surface (r2 §4.1, r7 01/02; #351 6→4 列收敛) ——
  任务: 'Todo', // topbar +任务 button / search nav row / popover section
  待开始: 'To start',
  // 规划中 survives as the planning phase chip (detail header), not a column
  规划中: 'Planning',
  执行中: 'Running',
  已完成: 'Done',
  没有等待开始的任务: 'No tasks waiting to start',
  没有执行中的任务: 'No tasks running',
  没有等你处理的任务: 'No tasks waiting on you',
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
  'Token 用量': 'Token usage',
  运行历史: 'Run history',
  打开方案: 'Open plan',
  添加附件: 'Add attachment',
  'AI 审核': 'AI review',
  审核中: 'Reviewing',
  'AI 审核进行中…': 'AI review in progress…',
  提及: 'Mention',
  停止: 'Stop',
  '停止当前这一轮？': 'Stop this round?',
  '丢弃本轮修改——方案和代码回到上一个版本':
    'Discard this round’s changes — plan and code revert to the previous version',
  发送: 'Send',
  '当前没有运行中的会话，消息未送出': 'No active run — the message was not delivered',
  '任务状态已变化，消息未送出': 'The task state changed — the message was not delivered',
  暂无方案: 'No plan yet',
  暂无可显示的变更: 'No changes to show',
  '· {n} 个文件改动': '· {n} files changed',
  全部展开: 'Expand all',
  全部收起: 'Collapse all',
  显示完整文件: 'Show full file',
  显示差异: 'Show diff',
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
  面板视图: 'Pane view',

  // —— ⌘K search panel (r7 05/05b, r2 §8.4) ——
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
  '也可以直接告诉总管某个任务要多久重跑一次，它会替你写好规则。':
    'You can also just tell the Chief how often a task should rerun, and it will write the rule for you.',

  // —— account route (r7 13) ——
  更换: 'Change',
  名称: 'Name',
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
  'API 密钥用于从命令行接入机器，也让 MCP 客户端能访问你的工作台。':
    'API keys connect machines from the command line and let MCP clients reach your workbench.',
  新建密钥: 'New key',
  复制: 'Copy',
  '请立即复制密钥，它仅显示一次。': 'Copy the key now — it is shown only once.',

  // —— resources routes (r7 06–10, r2 §6) ——
  新建: 'New',
  'MCP 服务器': 'MCP Servers',
  添加机器: 'Add machine',
  自定义: 'Custom',
  '搜索技能...': 'Search skills...',
  排序: 'Sort',
  '尚无技能。': 'No skills yet.',
  // spec 13 + XMON-109（spec 13 回摆）技能面：双入口口径——本地目录或页面
  // 新建都会出现在这里（{dir} = SKILLS_DIR_DEFAULT）。
  '把包含 SKILL.md 的技能目录放进 {dir}，或新建一个技能，即会出现在这里。':
    'Drop a skill folder containing SKILL.md into {dir}, or create a new skill here, and it will show up in this list.',
  // XMON-114（spec 13 回摆）技能写面：新建/编辑弹窗与错误态。
  新建技能: 'New skill',
  编辑技能: 'Edit skill',
  'SKILL.md 正文': 'SKILL.md body',
  '这个技能做什么、什么时候用它。': 'What this skill does and when to reach for it.',
  '正在读取 SKILL.md…': 'Loading SKILL.md…',
  'frontmatter（name/description）由上方表单生成，这里只写正文。':
    'The frontmatter (name/description) is generated from the form above — only the body is written here.',
  'frontmatter（name/description）由上方表单生成；未在此编辑的文件保持原样。':
    'The frontmatter (name/description) is generated from the form above; files not edited here stay untouched.',
  '名称须以字母或数字开头，只能含字母、数字、点、横杠、下划线，最长 64 字符。':
    'The name must start with a letter or digit and may only contain letters, digits, dots, dashes and underscores (64 chars max).',
  '描述不要用引号整体包裹——写进 frontmatter 后引号会被剥去，与表单值不一致。':
    'Do not wrap the description in quotes — they are stripped when written to frontmatter and would no longer match the form value.',
  '内容超出单文件上限（{limit} KB）。': 'Content exceeds the per-file limit ({limit} KB).',
  '同名技能已存在——换个名称，或从列表打开它编辑。':
    'A skill with this name already exists — pick another name, or open the existing one from the list to edit it.',
  '该技能已不存在——可能刚被移动或删除。':
    'This skill no longer exists — it may have just been moved or deleted.',
  '内容未通过校验。': 'The content failed validation.',
  '尚无 MCP 服务器。': 'No MCP servers yet.',
  // spec 13/#368 本地 config 只读制：空态文案 = 配置指引（无添加钮）。
  '读取 server 本机 ~/.claude.json 的 mcpServers 段：在该文件添加配置并刷新，即出现在这里。MCP 服务器为 Agent 提供额外工具；授权在每个 Agent 的页面上单独进行。':
    'Reads the mcpServers section of ~/.claude.json on the pacman server machine — add entries there and refresh to see them here. MCP servers give Agents extra tools; authorization happens per Agent, on its own page.',
  '尚无密钥。': 'No secrets yet.',
  '团队密钥按 Agent 授权，在需要它的执行步中下发，不预置进任务 shell 环境。值只写不读：保存后只能覆盖或删除，无法再次查看。':
    'Team secrets are granted per Agent and released to the build steps that need them — never pre-set into the task shell environment. Values are write-only: once saved they can be overwritten or deleted, never viewed again.',
  添加密钥: 'Add secret',
  '也可以让总管添加：它会开一张安全输入卡填写值，值不会进入对话。':
    'The Chief can add them too: it opens a secure input card for the value, which never enters the conversation.',
  个文件: 'file(s)',
  描述: 'Description',

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
  // #446（ADR 0005 读向）项目页「从 GitHub issue 建任务」入口 + 选择弹层
  // （状态过滤 / 分页 / 三态行）。
  '从 GitHub issue 建任务': 'New task from GitHub issue',
  打开: 'Open',
  已关闭: 'Closed',
  'issue 列表加载失败': 'Failed to load issues',
  '这个状态下没有 issue': 'No issues in this state',
  上一页: 'Previous page',
  下一页: 'Next page',
  '第 {page} 页': 'Page {page}',
  // #452（ADR 0006 写向）详情页来源 issue 行：未建成 + 重试入口 / 回显
  // （号 + 状态 + 上游现值标题）/ 不一致中性提示（只提示不覆盖）。
  'GitHub issue 未建成': 'GitHub issue not created',
  '来源 issue': 'Source issue',
  与本地标题不一致: 'Differs from the local title',
  // #476（#473 决策候选 A + C 尾注）右栏方案空态任务元信息块：行 label
  // （机器复用侧栏键）+ 尾注引导句。
  '分支 / PR': 'Branch / PR',
  模型: 'Model',
  创建时间: 'Created',
  方案产出后显示于此: 'The plan will appear here once produced',
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
  // #360（spec 12）repo 选择面两行：GitHub 仓库 / 本地文件夹（hosted 行
  // 创建入口移除；下方「Pacman 托管」= 存量 hosted 项目的设置面显示键，
  // 与本表无关，保留）。
  'GitHub 仓库': 'GitHub repo',
  本地文件夹: 'Local folder',
  创建项目: 'Create project',
  // #386 本地路径校验错误行：server 400 reason code 的三态分类文案（zh 键
  // 单源 = shared LOCAL_ERROR_REASON_COPY）；无 code / 未分类 reason 原文直
  // 透（不进词典）。
  路径不存在: 'Path not found',
  '不是 git 仓库': 'Not a git repository',
  需要绝对路径: 'Absolute path required',
  浏览: 'Browse',
  '此部署形态不支持系统对话框，请直接输入路径':
    'System folder dialog is unavailable in this deployment — type the path directly',
  已有一个选取对话框在进行中: 'A folder dialog is already open',
  无法打开系统文件夹对话框: 'Cannot open the system folder dialog',
  // #441 应用内目录浏览器（ADR 0003 D6 remote/headless 兜底）。
  浏览本地文件夹: 'Browse local folders',
  显示隐藏文件: 'Show hidden files',
  没有子目录: 'No subfolders',
  子目录均已隐藏: 'All subfolders are hidden',
  选择: 'Select',
  'git 仓库': 'Git repository',
  '目录条目过多，只列出前 {n} 条': 'Too many entries — showing the first {n}',
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
  '请先为总管选择一个 Agent。': 'Choose an Agent for the Chief first.',
  选择一个主题开始: 'Pick a thread to start',
  '有什么可以帮你的？': 'How can I help?',
  '完成 {n}': 'Done in {n}',
  章程: 'Charter',
  记忆: 'Memory',
  记忆已更新: 'Memory updated',
  技能已更新: 'Skill updated',
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
  // #615 总管抽屉主模型闭环文案（模型行 aria + 覆盖 dialog 默认行/搜索/空态）。
  总管主模型: 'Chief main model',
  // #615 返工：恢复钮（参考站 live aria 正词）+ 过程折叠 + 确认层 + 工具行失败徽标。
  恢复到此处: 'Restore to here',
  '恢复到此处？该条之后的 {n} 条消息会移除，总管从这条重发开新回合。':
    'Restore to here? The {n} messages after it are removed and the Chief resends from this one as a fresh turn.',
  展开过程: 'Show process',
  收起过程: 'Hide process',
  '默认（与绑定 Agent 相同）': 'Default (same as bound Agent)',
  '搜索模型…': 'Search models…',
  没有匹配的模型: 'No matching models',
  // M7 #312 AI 审核模态文案（r8 §3.1 实测）：Agent 选择 + 关注点 textarea +
  // 提交按钮。dialog 选 Agent 走 dlg-form-* family 共用层,文案独立。
  '选择审核 Agent': 'Choose review Agent',
  '希望 Agent 审核时重点关注什么？（可选）':
    'What do you want the Agent to focus on during review? (optional)',
  开始审核: 'Start review',
  // #509 审核选人独立性提示：默认值优先跨厂商；无跨厂商可选时出声。两档措辞
  // ——确证同源 vs 无法判定（未配置厂商 = 没有比对基准），都不静默。
  本次审核与产出同源: 'This review shares a vendor with the producing step',
  无法判定审核独立性: 'Cannot determine review independence',
  '审核人与产出该方案的 Agent 来自同一模型厂商，不构成独立复核。':
    'The reviewer and the Agent that produced this plan use the same model vendor; this is not an independent review.',
  '产出该方案的 Agent 或所选审核人未配置模型厂商，缺少比对基准，不构成独立复核。':
    'Neither the producing Agent nor the selected reviewer has a model vendor configured, so there is nothing to compare against; this is not an independent review.',
  // M7 #330 AI 审核消息渲染（r8 §3.1 真 findings 上线）：结论先行 + 编号 findings
  // + 严重度后缀（(blocking)/(suggestion)/(info)）+ 方案引用块 + 修复建议。
  // 服务端消息 kind = REVIEW_VERDICT_KIND（shared/message.ts 双端单源），
  // findings 形态 = reviewVerdictSchema（shared/review.ts）。
  审核结论: 'Review conclusion',
  '(blocking)': '(blocking)',
  '(suggestion)': '(suggestion)',
  '(info)': '(info)',
  '建议：': 'Suggestion: ',
  '建议：{body}': 'Suggestion: {body}',
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
  '执行中...': 'Running...',
  '正在停止…': 'Stopping…',
  已取消: 'Cancelled',
  [PROBE_TOOL_CALL_LABEL]: `Calling tool: ${PROBE_TOOL_PILLS[1]}`,
  '方案 · v1': 'Plan · v1',
  'Xmon Dai 发起了合并': 'Xmon Dai started a merge',
  '🎉 任务已完成': '🎉 Todo completed',
  '运行在 ': 'Running on ',
  '远程（HTTP）': 'Remote (HTTP)',
  '2 天前': '2d ago',
  未启用: 'Disabled',
  // —— overlay dialogs (issues #66 / #68) ——
  新建任务: 'New task',
  '我想要的结果：': 'The outcome I want:',
  '现在的情况：': 'Where things stand now:',
  '需要保留或避免：': 'What must be kept or avoided:',
  '我会这样确认完成：': 'How I will confirm this is done:',
  '我希望收到：': 'What I expect to receive:',
  保存并开始: 'Save and start',
  删除任务: 'Delete todo',
  '确定删除该任务？此操作不可撤销。': 'Delete this todo? This cannot be undone.',
  // #306 sched-card 菜单删除确认（DeleteConfirm 家族泛化随加）。
  删除定时: 'Delete schedule',
  '确定删除该定时？此操作不可撤销。': 'Delete this schedule? This cannot be undone.',
  // XMON-19/B2 删除 Agent：三串 = 原版产线 bundle 的 en 语料原文
  // （agent_modal.remove / remove_title / remove_confirm），非回译。
  '删除 Agent': 'Delete agent',
  '删除 Agent？': 'Delete agent?',
  '将「{name}」移出团队？该 Agent 进行中的任务将被停止。':
    'Remove "{name}" from this team? Active tasks for this agent will be stopped.',
  关闭菜单: 'Close menu',
  复制链接: 'Copy link',
  完成任务: 'Complete todo',
  将改动合并到默认分支: 'Merge the changes into the default branch',
  // XMON-89 合并被拒的可见化：前置缺项行（{tools} = 1~2 个开关名的顿号串；
  // 开关名本身是 shared AGENT_TOOL_SWITCHES 的 zh 值域词，locate 后仍按 zh
  // 出现——与权限 tab 的开关行一致，不另开一份 en 词表）＋ 非 403 失败的固定
  // 兜底句（403 的 server 原文不翻译：它逐字点名缺哪项，翻一遍反而对不上）。
  '缺少「{tools}」授权，无法合并。请在该 Agent 的权限里开启。':
    'Missing the "{tools}" permission, so this merge cannot go through. Turn it on in the agent’s permissions.',
  '合并请求未送出，请重试。': 'The merge request was not sent. Try again.',
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
  // #319 分支对话框「同步到机器」结果卡四态 + 机器选择占位
  选择机器: 'Choose a machine',
  暂无在线机器: 'No online machines',
  等待中: 'Pending',
  '正在同步…': 'Syncing…',
  已同步: 'Synced',
  同步失败: 'Sync failed',
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
  // XMON-55 P0 / #640: the hint that rides the 开始 button on the fresh brief
  // —— 开始入口不再选机器/Agent，改为直发总管编排回合后派发。
  '点开始后由总管编排派发，Agent 在你的机器上跑':
    'The chief orchestrates and dispatches after you start — the agent runs on your machine',
  // #170 create-agent dialog family
  '创建 agent': 'Create agent',
  '输入 Agent 名称': 'Enter an agent name',
  尚未配置模型服务商: 'No model provider configured yet',
  配置服务商: 'Configure providers',
  创建: 'Create',
  // W4 #287 API key 新建表单弹窗（r3 §6 权限位 [推断]）
  '名称（可选）': 'Name (optional)',
  '如：笔记本、CI 机器': 'e.g. laptop, CI runner',
  'Git 读写（托管仓库 push/pull）': 'Git read/write (hosted repo push/pull)',
  'MCP 访问（MCP 客户端接入）': 'MCP access (MCP client connections)',
  工具权限位: 'Tool grants',
  // #636 起 zh「全选」归筛选面板的全选行（en 'Select all'）；本面快捷键换
  // 「授予全部」避开同形碰撞——zh 源串即 key，两个语义域必须分叉。
  授予全部: 'Grant all',
  清空: 'Clear all',
  读: 'Read',
  写: 'Write',
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
  // wayfinder #175 add-provider dialog family (field authority = shared
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
  // #355 picker 形态(spec 11 §A6;preset 显示名 = 品牌串不译,OAuth 徽标
  // 同为英文字面)
  '搜索服务商...': 'Search providers...',
  自定义端点: 'Custom endpoint',
  // #385 族表未接线的 OAuth preset 行注记(如 openai-codex)
  暂未开通: 'Not yet available',
  // #356 runtime tabs(spec 11 §A1-A4;tab 名 pi/Claude Code 不译,槽位名
  // default/opus/… 为配置标识符不译;{hostname} = server 机器名插值)
  'pacman 自有运行时。模型来自你添加的服务商。':
    "pacman's own runtime. Models come from the providers you add.",
  '本机 Claude Code 配置（~/.claude/settings.json）的模型槽。':
    "Model slots from this machine's Claude Code configuration (~/.claude/settings.json).",
  '已安装在 {hostname}': 'Installed on {hostname}',
  未安装: 'Not installed',
  '安装 Claude Code 并完成一次登录后，此处自动展示其模型槽。':
    'Install Claude Code and sign in once; its model slots appear here automatically.',
  '尚未添加服务商。添加后，服务商的模型会出现在这里。':
    'No providers yet. Once you add one, its models appear here.',
  'settings.json 未配置模型槽。': 'No model slots configured in settings.json.',
  // #231/#243 OAuth 落地 reason 三译(providers-page 喂 connectError 行)
  '授权已被取消。': 'Authorization was cancelled.',
  '令牌交换失败，请稍后重试。': 'Token exchange failed — please try again.',
  '连接已过期，请重新发起。': 'Connection expired — please start it again.',
  // #361 GitHub 连接认证 + repo picker（spec 12 G2-T4；错误三译复用 #243 键）
  '认证 GitHub': 'Connect GitHub',
  '选择 GitHub 仓库': 'Choose a GitHub repository',
  搜索仓库: 'Search repositories',
  没有匹配的仓库: 'No matching repositories',
  断开连接: 'Disconnect',
  已连接: 'Connected',
  '手动输入 owner/repo': 'Enter owner/repo manually',
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
  // #253 token 门页（鉴权开时 401 落页；auth 单缝 = src/api/auth.ts）
  需要访问令牌: 'Access token required',
  '服务端已开启令牌鉴权，输入访问令牌后继续使用。':
    'This server has token authentication enabled. Enter your access token to continue.',
  访问令牌: 'Access token',
  进入: 'Continue',
  '令牌无效，请重试。': 'Invalid token — please try again.',
  // W4 #285 浏览器授权页（02 §5.2 路径一；/app/machines/authorize）
  授权机器: 'Authorize machine',
  '生成授权链接，在执行机上完成注册发起。':
    'Generate an authorization link and start enrollment on the executor machine.',
  生成授权链接: 'Generate authorization link',
  '一台执行机请求加入你的团队。确认后它将以自己的凭据连接。':
    'An executor machine is requesting to join your team. Once authorized it connects with its own credentials.',
  确认授权: 'Authorize',
  '正在授权…': 'Authorizing…',
  '授权完成，机器已注册。': 'Authorized — the machine is registered.',
  '授权链接已失效，请在执行机上重新发起。':
    'This authorization link has expired — restart enrollment on the executor machine.',
  '浏览器授权注册 →': 'Browser authorization →',
  // W2 #318 桩群校准：新建任务未保存闸（r9 §3.4）。#310 附件：dirty 位由
  // spec 非空承载（附件 token 注入后归 spec）,标签 add 仍为桩（本票不动）。
  // （#640：开始任务 dialog 统一面的 规划/执行/在线/离线/选择 Agent 五键随
  // 选择面撤销退役——开始入口不再有 dialog 选择器。）
  '放弃新建任务？未保存的内容将丢失。': 'Discard this new task? Unsaved content will be lost.',
  继续编辑: 'Keep editing',
  放弃并关闭: 'Discard and close',

  // —— mention picker (issue #311, r9 §2.2/§3.2) ——
  // Top layer 5 category rows + drill-in search + footer Insert (N) count.
  // 与侧边栏/搜索面板的「任务/技能/Agents/项目/机器」键一致,只追加弹层
  // 本地需要的 6 个键(搜索/空集/返回/插入 (n)/两个 empty 分支)。
  '搜索…': 'Search…',
  没有可引用的对象: 'Nothing to mention',
  '没有与"{query}"匹配的结果': 'No results matching “{query}”',
  '插入 ({count})': 'Insert ({count})',
  '没有可用的 Agent': 'No Agents available',

  // —— local 项目 Files tab 禁用面 (spec 12 / #362 G2-T2 v1) ——
  本地仓库项目暂不支持在线浏览文件:
    'Online file browsing is not available for local repository projects',

  // —— #403/#445 看板筛选面（仓库 chip 组 + 类型 popover + 空结果态）——
  类型: 'Type',
  没有匹配筛选条件的任务: 'No tasks match the selected filters',
  清除筛选: 'Clear filters',

  // —— XMON-57 统一筛选面板（两维 + 批次键 + 生效筛选条 + 空词表行）——
  // #636 批次行照参考站形：全选行（zh「全选」，本域 en 'Select all'）+ 右端
  // 反选；权限授予面改用「授予全部」避开同形碰撞（zh 源串即 key，两域必须
  // 分叉）。段内清除钮撤除——清除由全选行满选再点 / 反选 / 顶栏生效筛选条
  // 三路承接，`清除` 条目随之下架。
  全选: 'Select all',
  反选: 'Invert',
  仅此: 'Only this',
  '已选 {n}/{m}': '{n}/{m} selected',
  清除全部: 'Clear all',
  '搜索{name}': 'Search {name}',
  '清除{name}筛选': 'Clear {name} filter',
  本作用域内没有可选的仓库: 'No repositories available in this scope',
  本作用域内没有可选的类型: 'No types available in this scope',
  '没有与“{q}”匹配的选项': 'No options match “{q}”',
  '筛选生效：{summary}': 'Filters active: {summary}',

  // —— #485 Agent 详情编辑面（三 tab + 概览字段 + 记忆/权限面）——
  // 含空格/标点的键一律引号形（对象字面量的键不是标识符）。
  概览: 'Overview',
  权限: 'Permissions',
  职责: 'Responsibility',
  工具: 'Tools',
  // 模型 已在 #476 段登记，本段不重复。
  思考强度: 'Thinking level',
  // 「状态」键随 XMON-18 撤行一并摘除（概览不再摆状态行，en-coverage gate 也不
  // 容许死键）。
  未设置模型: 'No model',
  '默认 skill': 'Default skill',
  '找不到该 Agent。它可能已被删除。': 'Agent not found. It may have been deleted.',
  // 概览「进行中」段空态（原文 = 参考产品 web 包 agent_modal.no_active_tasks）。
  暂无进行中的任务: 'No active tasks',
  '暂无团队密钥。': 'No team secrets yet.',
  // XMON-80/P3：零密钥空态旁的出口（落到侧栏密钥页）。
  去添加密钥: 'Add a secret',
  // XMON-80/P2：权限 tab 保存失败的可见反馈。
  '保存失败，请重试。': 'Save failed. Try again.',
  // XMON-113：机器行 shell 开关的副文案（机器侧半边；{tool} 插值 = 上面那条
  // AGENT_TOOL_SHELL 的 en 值，两层开关共用同一词）。
  '已授权「{tool}」的 Agent 可在该机器上执行命令。':
    'Agents you have granted {tool} to can run commands on this machine.',
  '暂无 MCP 服务器。': 'No MCP servers yet.',
  团队密钥: 'Team secrets',
  // shared canon（packages/shared/src/records/agent.ts、memory.ts），经 t()
  // 消费、不作字面量出现——i18n-coverage COMPUTED_KEYS 登记。
  '远程 shell': 'Remote shell',
  合并分支: 'Merge branches',
  创建标签: 'Create labels',
  推送分支: 'Push branches',
  创建技能: 'Create skills',
  更新技能: 'Update skills',
  运行时: 'Runtime',
  '内置 (pi)': 'Built-in (pi)',
  '允许该 Agent 在团队中已开启 shell 访问的机器上执行命令。':
    'Allow this Agent to run commands on machines where shell access is enabled for the team.',
  '允许该 Agent 通过合并分支进行发布（例如将 develop 合并进 main）。':
    'Let this Agent publish by merging branches (for example develop into main).',
  '允许该 Agent 创建 git tag，这可能触发发布流程。':
    'Let this Agent create git tags, which may trigger a release pipeline.',
  '允许该 Agent 随时提交并推送其工作分支（自行合并发布改动时需要）。':
    'Let this Agent commit and push its working branch at any time (needed when it merges release changes itself).',
  '允许该 Agent 向团队技能库添加新技能。':
    'Let this Agent add new skills to the team skill library.',
  '允许该 Agent 修改团队技能库中已有的技能。':
    'Let this Agent modify skills already in the team skill library.',
  '任务执行时，该 Agent 可在需要密钥的执行步中按需取用团队密钥，每次取用都会留下记录；密钥不预置进 shell 环境。所在机器需要 pacman CLI 0.1.28 及以上。':
    'When running a task, this Agent can retrieve team secrets on demand in the execution steps that need them; every retrieval is recorded, and secrets are never preloaded into the shell environment. The machine must have pacman CLI 0.1.28 or newer.',
  '该 Agent 执行任务时可使用的团队 MCP 服务器，其工具以 mcp__<服务器>__<工具> 的形式出现。':
    'Team MCP servers this Agent may use while running tasks; their tools appear as mcp__<server>__<tool>.',
  '用一两句话说明该 Agent 的职责。该说明会注入它执行的每个任务，也会提供给总管用于分派。':
    'Describe this Agent’s responsibility in a sentence or two. The text is injected into every task it runs and is given to the chief for dispatch.',
  '该 Agent 执行任何任务时自动携带的团队技能，无需在消息中 @ 引用。':
    'The team skill this Agent always carries, without an @ mention in the message.',
  '尚无记忆。Agent 会在工作中将值得沉淀的经验存入此处。':
    'No memories yet. The Agent stores experience worth keeping here as it works.',

  // —— #499 记忆 tab 的搜索与排序（配额头 + 搜索框 + 排序档）——
  // `记忆 · {n} / {max}`：{max} = shared MEMORY_QUOTA_PER_AGENT 插值，不写死
  // 数字；`搜索记忆…` = shared MEMORY_UI_COPY.searchPlaceholder（经 t() 消费、
  // 不作字面量出现，i18n-coverage COMPUTED_KEYS 登记）。
  '记忆 · {n} / {max}': 'Memory · {n} / {max}',
  '搜索记忆…': 'Search memories…',
  // 排序第二档（[设计]，见 agent-detail-page.tsx 的 MEMORY_SORT_OPTIONS）。
  添加时间: 'Added',
  // 零命中态：与「尚无记忆」canon 空态分开——搜不到不等于没存过。
  '没有匹配的记忆。': 'No memories match.',
  // —— #631 总管对话失败闭环（sonner toast + 线程失败行）——
  总管本轮执行失败: 'The chief turn failed',
  '发送失败，请重试。': 'Send failed. Try again.',
  '恢复失败，请重试。': 'Restore failed. Try again.',
  // —— #729 附件上传失败面（toast 家族同上；大小/类型拒是本地预检可自救，
  // 各给专名，其余归通用失败）——
  '附件超过 10MB 上限': 'Attachment exceeds the 10 MB limit',
  不支持该文件类型: 'That file type is not supported',
  附件上传失败: 'Attachment upload failed',
  // —— #640 开始任务单出口（直发总管编排回合；r14 §5.7 前置裁决落地）——
  由总管创建: 'Created by chief',
  来源: 'Source',
  总管编排会话: 'Chief orchestration session',
  '这张任务将交给总管重新编排。': 'The chief will re-orchestrate this task.',
  已交给总管编排: 'Handed to the chief',
  '已保存，交给总管编排': 'Saved — handed to the chief',
  '总管将直接规划，并按活的类型派发执行。':
    'The chief plans first, then dispatches each piece to the right agent.',
  查看会话: 'View session',
  未能开始编排: 'Could not start orchestration',
};
