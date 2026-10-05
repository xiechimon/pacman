# R15 · 首个 Agent 的「职责」该不该有默认值：七生态源码取证与取舍（t-0198）

> 票：用户在看板提问——「初始化任务时，也就是初始化第一个 agent 时，是否应该有一个默认值呢？去调研一下其他项目的代码层面都是怎么做的。」（t-0198，Herdr 线程任务书原文）
> 性质：决策材料，非实现。**产品代码零改动、未开票、未动 `docs/spec/`**。唯一产物 = 本篇。
> 代码基线：`origin/main` = `a831032e`（2026-10-05；本分支即此 tip）。P 侧行号全部在此基线逐行核实。
> 取证执行：本线程自做 **L-A**（Claude Code 子代理，含运行时实测）+ 三条并行调研线程——**L-B**（CrewAI / AutoGen）、**L-C**（OpenAI Agents SDK / LangGraph / Letta）、**L-D**（MetaGPT / ChatDev / Dify / Coze / n8n）。四路结论全部内嵌本篇；每条自带 repo / 路径 / 分支，未另落 raw 归档。

## 0. 阅读约定

出处三类，逐条标注：

- **P**（pacman 代码）= `路径:行号`，2026-10-05 在 `a831032e` 逐行核实。
- **L-A / L-B / L-C / L-D**（调研线程产物）= 本篇内嵌结论，证据原文即其给出的代码片段。
- **D**（文档陈述）= 官方文档 live 抓取（Claude Code docs；抓取走 `agent-reach` 的 web 通道 = Jina Reader）。

证据档位四值，本篇每条结论必须落到其中之一：

| 档位 | 含义 |
|---|---|
| **源码实证** | 逐字代码 / 配置 / 二进制串，可复核 |
| **运行时实测** | 本机真跑出可观察行为（不是读码推断） |
| **文档陈述** | 官方文档原话，未与代码对拍 |
| **未取得证据** | 拿不到（闭源 / 抓取失败），明写不编 |

---

## 1. 问题重述：用户问的是哪一格

「默认值」不是一个动作，是**四个可以分别落地、代价互不相同的位置**。不先把它们拆开，讨论会滑向「别家有没有」。

| # | 落点 | 机制 | 用户能否看出这是默认值 |
|---|---|---|---|
| ① | **schema 默认** | `z.string().default(...)` / 列 `DEFAULT`——缺字段时补齐 | 不能（与手填值同形） |
| ② | **创建面预填** | 新建表单里预填一段文本 | 能（在输入框里、可改） |
| ③ | **首次 seed** | bootstrap 时自动建一个 agent | 能（多了一行数据） |
| ④ | **消费侧兜底** | 读的时候 null → 某段文字 | 取决于文案 |

**pacman 现状：只有 ④，且兜底文案是「未设置职责」——一个描述缺失状态的字符串，被当成职责描述本身注入模型 prompt。** ①②③ 全无（§2 逐条给行号）。

真问题因而收窄为两句：

1. **给一个真默认值（①/②/③）能不能改善总管的派发质量？**
2. **如果不能，该不该改用别的手段让「没填」这件事在正确的时机被看见？**

判据不由别家决定——本仓纪律是「改动由真实使用驱动，不照抄别人的 spec」，且参考产品在这个位置显示的就是「未设置职责」，所以「加默认值」本身就是一次对参考产品的偏离（§2.7）。别家怎么做的用途只有一个：**看这题在别人那里有没有已知的失败形态**。

---

## 2. P 侧现状复核（代码事实）

任务书给的那版现状描述基本正确，但有三处需要修正/补全：**创建弹窗其实没有职责字段**、**同一个 null 在两个消费面上行为不一致**、**写侧存在空串穿透**。逐条如下。

### 2.1 字段形状：可空，无默认

- 记录形状 `packages/shared/src/records/agent.ts:100`：`description: z.string().nullable(),`——可空、无 `.default()`。紧邻注释（:99）自陈「null 形状 [推断]」。
- 创建体 `packages/shared/src/records/agent.ts:125`：`description: z.string().nullish(),`——`nullish` = 可省略 / 可 `null`，同样无默认。
- 修改体 `apps/server/src/routes.ts:256`（`patchAgentBodySchema`）：`description: z.string().nullish(),`。

### 2.2 两条创建路径都不补默认

- **REST** `apps/server/src/routes.ts:914`（`POST /api/teams/:id/agents`），落库行 `:925`：`description: body.description ?? null,`。
- **chief 工具** `apps/server/src/services/chief-tools.ts:511`（`case 'create_agent'`），落库行 `:518`：`description: optStr(params, 'description') ?? null,`。
- 对应工具声明 `packages/shared/src/protocol/chief-tools.ts:349-361`：`description` 参数**在 schema 里存在**（文案 `'Responsibility text (injected into every task and used for dispatch).'`），但 `required` 只有 `['displayName']`——**LLM 侧被明确告知这个参数存在且承重，却不被要求填**。
- 修改侧同律：REST PATCH `apps/server/src/routes.ts:954`（字段清单 `:970`、null 语义注释 `:978`）；chief `update_agent` `apps/server/src/services/chief-tools.ts:534`（`const desc = optStr(params, 'description');` `:544`，写回 `:548`）。

### 2.3 参考产品对照：创建弹窗**同样没有**职责字段

- 任务书未提，但这是本仓行为的关键背景。**本仓的创建弹窗没有职责输入**：`apps/web/src/routes/create-agent-dialog.tsx` 表单只有「名称」（`:114-121` 的 `dlg-agent-name`）与「运行时 / 模型」两级（`:128-150`），无 `description` 控件；`CreateAgentInput`（`:37-41`）也只有 `displayName` / `provider` / `modelId`。
- 参考产品同形：`docs/research/r2-app-ui-inventory.md:347` 记 capture 20 = 头像 + 更换 / `名称`（placeholder `如 Opus builder`）/ 告警行 / `创建`——**没有职责栏**。
- ⚠️ **仓内一处注释与证据冲突**：`packages/shared/src/records/agent.ts:122-123` 写「创建弹窗 r3 §4：名称/职责/模型」。r3 §4（`docs/research/r3-protocol-executor.md:179-188`）描述的是 **Agent 详情页的「概览」tab**（头像 / 名称 / **职责** / 默认 skill / 模型 / 思考强度），不是创建弹窗。该注释把详情页字段集误记成创建弹窗字段集，属**文档债，非行为缺陷**（行为以 r2 capture 20 与本节代码为准）。
- 由此得出一条比任务书更强的结论：**「新建 Agent 职责为空」不是边缘情况，是本仓与参考产品共同的默认路径**——创建口根本没有让用户填的地方。

### 2.4 同一个 null，两个消费面行为相反

这是复核中最值得记录的一条。

- **总管侧：字面量注入。** `apps/server/src/services/chief.ts:755`（绑定 Agent 行）
  `` `绑定 Agent：${agentRow.displayName}（…）。职责：${agentRow.description ?? '未设置职责'}` ``
  与 `:768`（团队 agents 清单行）
  `` `- ${a.displayName}（id: …，模型: …）：${a.description ?? '未设置职责'}` ``
  → 字符串「未设置职责」**作为职责文本本身**进了总管 system prompt。而同一份 prompt 的策略段写着「读 agents 的职责文本按权重选择」——指令要求按职责选，字段里给的却是「未设置职责」。
- **worker 侧：静默省略。** `apps/daemon/src/runner.ts:259-274`（`composeWorkerSystemPrompt`）第一句就是 `if (description) parts.push(description);` —— falsy（null 与 `''` 皆然）直接不注入；`:531-534` 的调用点把结果交给 `systemPrompt`，`parts.length === 0` 时返回 `undefined`。
- 即：**pacman 对这题已经回答过两次，且答案相反**——总管面选择「显式宣告缺失」，worker 面选择「当作没有」。worker 面的选择是对的（§5.2 会说明为什么总管面是错的）。

### 2.5 写侧还有一个洞：`??` 抓不住空串

四条 API 写路径里，只有 UI 编辑面做了归一：

- UI 保存 `apps/web/src/routes/agent-detail-page.tsx:841-845`：`const next = draft.trim(); onCommit(next === '' ? null : next);`——**空串归一成 null**，正确。
- 但 REST POST（`routes.ts:925`）、REST PATCH（`routes.ts:970-979`）、chief `create_agent`（`chief-tools.ts:518`）、chief `update_agent`（`chief-tools.ts:544-548`）都不是归一形态。`'' ?? null` 求值为 `''`（`??` 只拦 `null` / `undefined`），于是 `description: ""` 会**原样落库**。
- 后果：所有 `?? '未设置职责'` 兜底对 `''` 失效（`'' ?? x` = `''`），详情页 `apps/web/src/routes/agent-detail-page.tsx:812`、团队页 `apps/web/src/routes/team-page.tsx:184`、总管 prompt `chief.ts:755/768` 全部渲染成**空白**，连「未设置职责」这个信号都没了。
- 档位：**源码实证**（读码得出；未跑运行时构造该状态）。
- **这条对第 5 节的取舍是约束项**：任何「默认值」方案的判据都必须同时覆盖 `null` 与 `''`，否则默认值照样被空串绕过。

### 2.6 其它消费面（职责是承重字段的证据链）

| 位置 | 形态 | 空值行为 |
|---|---|---|
| `apps/server/src/services/chief.ts:755,768` | 总管 system prompt | 字面量「未设置职责」 |
| `apps/daemon/src/runner.ts:259-274` | worker 步 systemPrompt | 整段省略 |
| `apps/web/src/api/mappers.ts:879` | `role: a.description ?? null` | `null` |
| `apps/web/src/routes/agent-detail-page.tsx:812` | 详情页职责行 | `t('未设置职责')` |
| `apps/web/src/routes/team-page.tsx:184` | 团队页卡副行 | `t('未设置职责')` |
| `apps/web/src/overlay/use-new-task-surface.ts:286`、`apps/web/src/routes/todo-detail-page.tsx:754` | 指派选择器副题 | `a.role ?? a.model`——**回落模型名**（第三种兜底文案） |

三套不同的兜底（「未设置职责」/ 省略 / 回落模型名）说明这题在本仓从未被统一裁决过。

### 2.7 先例与 e2e 钉扎

- **先例（任务书点名）**：`packages/shared/src/records/agent.ts:64` `export const AGENT_TOOL_DEFAULTS: readonly AgentToolSwitch[] = [AGENT_TOOL_PUSH];`（XMON-84 B4，「推送分支」默认开）。它的取舍逻辑写在 `:61-63` 注释里，是**两条判据**：「不破坏交付」（缺它则新建 agent 推不了工作分支 → 破坏交付）+「最小权限」（合并进默认分支属发布行为，不默认开）。存量行回填走 migration `apps/server/drizzle/0018_agent_push_backfill.sql`（`UPDATE agent SET tools = json_insert(...) WHERE NOT EXISTS (...)`）。
  **这条先例的可迁移部分不是「给了默认值」，是它的判据形态**：默认值只在「缺了它会破坏一条既有链路」时才加，且加的那一档必须是**无歧义的安全值**。§5 会用同一把尺子量职责。
- **bootstrap 不 seed**：`apps/server/src/db/seed.ts` 只建 user + team 两行（`:29-40`），**零 agent**。任务书这条属实。
- **首次使用的硬闸**：总管未绑定 → `apps/web/src/chief/chief-drawer.tsx:600` 渲染 `请先为总管选择一个 Agent。`（文案 canon `apps/web/src/i18n/en.ts:355`）。即**用户必须先建一个 agent 并绑定，才能用总管**——「第一个 agent」在本仓是有确定含义的。
- **e2e 已把空态钉成 canon**：`apps/web/e2e/agent-detail.spec.ts:105` 断言 `.agent-role-text` 文本 = `未设置职责`（失败方式编号 5，文件头 `:12`）。因此**任何默认值方案都会先红在这一条**——这正好是「改动有后果」的现成仪表。

---

## 3. 横向调研：七个生态在代码层面怎么处理「职责 / 指令说明字段」

四类形态：**A 必填校验** / **B 有默认值** / **C 可空 + 空态文案** / **D 无字段（内置写死）**。

### 3.1 Claude Code 子代理（A · 最相关的直接先例）——**L-A**

这是用户生态内的直接先例，也是全部七个目标里**唯一把「职责」当路由键并用硬约束保护它**的实现。三路证据全部到位。

**来源分类**：`.claude/agents/*.md` 的 frontmatter `description`。

**① 字段是 required —— 是，硬 required。** 文档（**D**）原文：`Only name and description are required.`（Create custom subagents, `docs.claude.com/en/docs/claude-code/sub-agents`，2026-10-05 抓取）。同页「Subagent files Claude Code skips」段逐字：

> *   **A `name` but no `description`**: Claude Code skips the file and writes the reason to the debug log.

**② 有没有 default —— 没有。** 内置 subagent 的 description 全部写死在产品里（Explore / Plan / general-purpose / claude-code-guide / statusline-setup），不给用户侧默认。

**③ 缺 description 的实际代码路径（源码实证）。** 从本机二进制 `/opt/homebrew/Caskroom/claude-code@latest/2.1.289/claude` 提取（219 MB 单文件 Mach-O，`strings -n 6` 后 JS 源可读）：

```js
function bzn(e, n, r, s, g) {
  try {
    let { name: h, description: b } = r;
    if (!h || typeof h !== "string") return null;
    if (h.startsWith("-")) return t(`Agent file ${wy(e)} has invalid name '${wy(h)}': names must not start with '-'`, {level:"error"}), null;
    if (h.normalize("NFKC").includes(":")) return t(`...names must not contain ':'...`, {level:"error"}), null;
    if (mx("agent", r), !b || typeof b !== "string")
      return t(`Agent file ${e} is missing required 'description' in frontmatter`), null;
    ...
```

注意 `return null` —— **解析函数放弃这条定义**；与 `name` 两处校验相比，这条 `t(...)` 不带 `{level:"error"}`（等级更弱），但结果同样是 null。

**④ 运行时实测（运行时实测，两个创建路径失败形态不同）。** 本机造三个 frontmatter 变体，用嵌套 `claude -p` 读回 Agent 工具的 subagent_type 清单：

| 文件 | frontmatter | 结果 |
|---|---|---|
| `alpha-ok.md` | `name` + `description` | **加载**（清单里出现 `alpha-ok`） |
| `beta-nodesc.md` | 只有 `name` | **不加载**（清单里无） |
| `gamma-noname.md` | 只有 `description` | **不加载**（清单里无） |

命令与回读（实测输出，含内置件对照）：

```
$ cd /tmp/ad3.X2W5jI && claude -p "…list every subagent_type name available in this session…"
alpha-ok, claude, Explore, general-purpose, Plan, statusline-setup
```

第二个创建路径——CLI `--agents` JSON——**是硬失败**（运行时实测）：

```
$ claude --agents '{"nodesc":{"prompt":"You are X."}}' -p "reply with exactly: ok"
Error: Invalid --agents configuration:
nodesc.description: Invalid input: expected string, received undefined
rc=1

$ claude --agents '{"withdesc":{"description":"Use for tests.","prompt":"You are X."}}' -p "..."
ok
rc=0
```

文档（**D**）印证该路径的规格：`Invalid --agents configuration` 段——「the value you passed to `--agents` is invalid, so `claude` exits with code 1 instead of starting the session」；`prompt` 可以是空串，但 `description` 不行。

**⑤ 为什么这么严——description 是路由键，不是标签。** 文档原话：「Claude uses each subagent's description to decide when to delegate tasks.」「Use the Agent tool with specialized agents when the task at hand matches the agent's description.」同页还给了一道**成本意识**的约束：所有自定义 subagent 的 description 合计超过 15,000 token 时启动即告警——description 是常驻上下文，不是免费字段。

**小结**：Claude Code 对「agent 的职责说明」采取的是**最严档**——无默认、无 seed、无模板，缺了就不加载（文件路径静默跳、CLI 路径硬失败）。它的理由与 pacman 完全同构：**这个字段的职责是"被用来选人"，一个假的它比没有它更坏。**

### 3.2 CrewAI（A）——**L-B**

repo `crewAIInc/crewAI`，branch `main`。

字段声明在父类（不在 `Agent` 子类）：`lib/crewai/src/crewai/agents/agent_builder/base_agent.py:256-258`

```python
    role: str = Field(description="Role of the agent")
    goal: str = Field(description="Objective of the agent")
    backstory: str = Field(description="Backstory of the agent")
```

`Field(description=...)` 不带 default → Pydantic 必填。**并且有一道显式的非空 validator**（`base_agent.py:587-593`）：

```python
    @model_validator(mode="after")
    def validate_and_set_attributes(self) -> Self:
        for field in ["role", "goal", "backstory"]:
            if getattr(self, field) is None:
                raise ValueError(f"{field} must be provided either directly or through config")
```

- **required** / **default 无** / **不补默认**（**源码实证**）。
- **预填只发生在脚手架**：`crewai create crew <name>` 从模板复制 `config/agents.yaml`（`lib/cli/src/crewai_cli/create_crew.py:164,177,183`），模板里预置 `researcher` / `reporting_analyst` 两个角色的 role/goal/backstory 全文（`lib/cli/src/crewai_cli/templates/crew/config/agents.yaml`）。`flow` 模板另有 planner/writer/editor 三角色。
- **注意区分**：预填发生在**开发者写代码时生成的文件里**，不是运行时的用户输入面。这条对 §5 的类比很关键——见「取舍」一节的反例批判。

### 3.3 AutoGen（B）——**L-B**

repo `microsoft/autogen`，branch `main`。

- **纠偏**：Python 版 `ConversableAgent` **已不在 `main`**（`python/packages/pyautogen/` 只剩代理包 `__init__.py`，README 自陈需 `pin pyautogen~=0.2.0`）。`main` 现行 = `autogen_agentchat.agents.AssistantAgent`。
- **现行 `AssistantAgent`**（`python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py:734-736`）——**optional + 默认串**：

```python
        system_message: (
            str | None
        ) = "You are a helpful AI assistant. Solve tasks using your tools. Reply with TERMINATE when the task has been completed.",
```

构造体 `:766-770`：传 `None` → `self._system_messages = []`（彻底关闭）；不传 → 用上面那句。**源码实证**。

- **任务书点名的 `DEFAULT_SYSTEM_MESSAGE` **未取得证据**：`main` 上该常量不在 `ConversableAgent`（该类已移除），挂在 `CodeExecutorAgent`（`_code_executor_agent.py:421`，逐字 `"You are a Code Execution Agent. Your role is to generate and execute Python code and shell scripts…"`）及 autogen-ext 若干子模块上。v0.2.x 时代它挂在 `AssistantAgent`（tag `v0.2.40`，`autogen/agentchat/assistant_agent.py:19-30`），而 `ConversableAgent` 用的是内联字面量 `"You are a helpful AI Assistant."`（同 tag `autogen/agentchat/conversable_agent.py:72`）。
- **模板/预设角色**：`AssistantAgent` 本身**不带模板角色**；写死的角色阵容只在上层 team——MagenticOne（`autogen_ext/teams/magentic_one.py:211-221` 固定 fs/ws/coder/executor 四人 + `MAGENTIC_ONE_CODER_SYSTEM_MESSAGE` 常量 persona）。
- **小结**：**B 档**——字段 optional，但有一个通用默认串，且传 `None` 是"显式关闭"的合法选择。

### 3.4 OpenAI Agents SDK 与 LangGraph（C）——**L-C**

**OpenAI Agents SDK**，repo `openai/openai-agents-python`，branch `main`：

```python
# src/agents/agent.py (~332)
    instructions: (str | Callable[[RunContextWrapper[TContext], Agent[TContext]], MaybeAwaitable[str]] | None) = None
```

- **optional，默认 `None`，无 seed 无模板**（**源码实证**）。docstring 是**建议**不是约束：`We strongly recommend passing instructions, which is the "system prompt" for the agent.`
- **不传时运行时发生什么**（`Agent.get_system_prompt`，`:1129`）：`instructions is None` → `return None`；两条模型通道再据此**整条省略** system message——Chat Completions 走 `if system_instructions:` 判真假（`src/agents/models/openai_chatcompletions.py:~629`），Responses 走 `_non_null_or_omit`（`src/agents/models/openai_responses.py:~1035`，`None` → `omit`，请求里连字段都不发）。
- **无兜底文案**——与 pacman 的 worker 侧同形；与 pacman 的总管侧**相反**。
- 唯一带文案的常量 `RECOMMENDED_PROMPT_PREFIX`（`src/agents/extensions/handoff_prompt.py`）是 **opt-in helper**，框架不自动注入。

**LangGraph**，repo `langchain-ai/langgraph`，branch `main`（真实路径 `libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py`）：

```python
def create_react_agent(model, tools, *, prompt: Prompt | None = None, ...) -> CompiledStateGraph:
```

- **optional，默认 `None`**（**源码实证**）。
- 历史上与它并列的 `state_modifier` **已删除**（`search/code` 全仓 0 命中；签名只剩 `**deprecated_kwargs`，:518-528 只认 `config_schema`，其余报 `got unexpected keyword arguments`）。
- 不传的行为（`_get_prompt_runnable`，`:137`）：`prompt is None` → 直接把 state 里的 messages 原样喂给模型，**不前置任何 system message**；传 `str` 才 `SystemMessage(content=prompt)` 前置。
- **无 seed / 无模板**。

### 3.5 Letta（B + 首次 seed）——**L-C**

**前置事实**：`letta-ai/letta` 的 `main` 已只剩元数据，源码迁至 `letta-ai/letta-code`；退役的 V1 服务端在 `letta-ai/letta` 的 `archive` 分支。两处都取证。

**V1（`archive`）**：

```python
# letta/constants.py (~105)
DEFAULT_PERSONA = "sam_pov"
DEFAULT_HUMAN = "basic"
# letta/config.py (~48)
    persona: str = DEFAULT_PERSONA
    human: str = DEFAULT_HUMAN
```

- `DEFAULT_PERSONA` 的值是**文件名**不是正文；正文由 `get_persona_text(name)`（`letta/utils.py:~1008`）从 `letta/personas/examples/<name>.txt` 读入。默认 `sam_pov.txt`，逐字开头：`The following is a starter persona, and it can be expanded as the personality develops: I am Sam. …`
- ⚠️ **但创建链路不 seed 文本**：`letta/schemas/block.py:~131` `DEFAULT_BLOCKS = [Human(value=""), Persona(value="")]`——**值为空串**；`letta/services/agent_manager.py:370-382` 只用默认块**补 description，不补 value**（注释自陈 `# Inject a description for the default blocks if the user didn't specify them`）。
- 档位：**源码实证**；「`DEFAULT_PERSONA` 是否仍在某条创建路径上生效」**未取得证据**（创建链路只把它读进 `LettaConfig.persona` 默认值，未见端到端调用点）。

**当前（`letta-code` `main`）**：**明确 seed，且有预设人格目录**（**源码实证**）：

```ts
// src/agent/personality-presets.ts
export const PERSONALITY_OPTIONS: PersonalityOption[] = [
  { id: "memo", label: "Letta Code", description: "The memory-first agent" },
  { id: "tutorial", label: "Tutor", ... },
  { id: "blank", label: "Blank", description: "Blank starter — you provide the personality" },
  ...
];
export const DEFAULT_CREATE_AGENT_PERSONALITIES = ["memo", "tutorial", "blank", "linus", "kawaii"] as const;
```

- 新建 agent 经 `buildPersonalityMemoryBlocks` + `seedPersonalityDefaultMemoryFiles` 把 persona/human 正文**写进 memory 仓库并提交**。
- 通用默认 persona（`src/agent/prompts/persona.mdx`）逐字：`I'm a coding assistant, ready to be shaped by how we work together.`
- **最值得抄的一格**：`blank` 人格的 persona 正文（`persona_blank.mdx`）不是空白，是**对模型的一条显式指令**：

```
This is a blank starter personality. You must ask the user to provide a personality prompt or preference.
```

即 Letta 在"用户还没填"这个状态上，**不写一句冒充职责的默认文案**，而是写一句**让模型去问**的话。这条直接对应 §2.4 里 pacman 总管面的病灶。

### 3.6 MetaGPT（C 空串默认 + D 内置角色写死）——**L-D**

repo `FoundationAgents/MetaGPT`，branch `main`。

```python
# metagpt/roles/role.py
name: str = ""
profile: str = ""
goal: str = ""
constraints: str = ""
desc: str = ""
PREFIX_TEMPLATE = """You are a {profile}, named {name}, your goal is {goal}. """
CONSTRAINT_TEMPLATE = "the constraint is {constraints}. "
```

- **optional，默认空串**；填 profile 的机制是 `_get_prefix()`（**全文件没有 `set_profile` 方法**，任务书未假设此点）：`if self.desc: return self.desc` 否则 `PREFIX_TEMPLATE.format(profile=…, name=…, goal=…)`，再拼 `CONSTRAINT_TEMPLATE`；`_process_role_extra` 里 `self.llm.system_prompt = self._get_prefix()`。
- **内置角色 profile 写死在仓库里**（**源码实证**）：`metagpt/roles/product_manager.py` 的 `ProductManager` 把 `name="Alice"` / `profile="Product Manager"` / `goal=…` / `constraints=…` / `instruction=PRODUCT_MANAGER_INSTRUCTION` 全部写死；Architect / Engineer / QA Engineer 同构。
- **小结**：基类 C 档（空串 + 模板渲染），内置角色 D 档（写死）。**用户不填 = 得到一个 `You are , named , your goal is .` 的残句 prompt**——一个反面教材：空串默认值在没有守卫时会把烂 prompt 直接送进模型。

### 3.7 ChatDev（D 内置写死 + 首跑装配默认公司）——**L-D**

- `main` 分支**已重写为 workflow/graph 系统**，经典 `chatdev/` 目录不复存在（`trees` 无命中）；经典实现在 `chatdev1.0` 分支。
- **`main`**：`entity/configs/node/agent.py` 的 `AgentConfig` —— `role: str | None = None`，且 `FIELD_SPECS` 里 `ConfigFieldSpec(name="role", display_name="System Prompt", required=False, …)` → **optional / 默认 None / `required=False`**（**源码实证**）。
- 角色 prompt 逐字写在 `yaml_instance/ChatDev_v1.yaml` 里（如 Programmer 角色用 `${COMMON_PROMPT}` 复用公共段）。
- **经典版**：角色 prompt 写死在 `CompanyConfig/Default/RoleConfig.json`（`Chief Executive Officer` 等每个角色一组多行字符串模板，含 `{task}` 占位）。
- **首次运行自动装配默认角色集**（**源码实证**，`chatdev1.0/run.py`）：`--config` 默认 `"Default"`；配置查找失败时回落 `CompanyConfig/Default`——即**不配置也能跑起来一套预置角色公司**。

### 3.8 Dify（C 可空，无预填）——**L-D**（本节是本调研最关键的两个样本之一）

repo `langgenius/dify`，branch `main`。**结论：agent 应用的 instruction 没有预填默认模板，默认空。**

- DB 列（`api/models/model.py`）：`pre_prompt: Mapped[str | None] = mapped_column(LongText, default=None)` —— **默认 None**。
- 新 Agent App 的 "Agent Soul"（`api/models/agent_config_entities.py`）：`class AgentSoulPromptConfig(BaseModel): system_prompt: str = ""` —— **默认空串**。
- **新建无 seed**（`api/services/app_service.py::create_app` → `api/constants/model_template.py::default_app_templates`）：`AppMode.AGENT_CHAT` 与 `AppMode.AGENT` 两个模板**都没有 `pre_prompt` 键**；源码注释自陈 AGENT 模式的 prompt 由绑定的 Agent Soul 承载。对照：只有 **completion** 模式预填 `"pre_prompt": "{{query}}"`——**不是 agent**。
- backing agent 走 `AgentRosterService.create_backing_agent_for_app(..., initial_soul=initial_agent_soul)`，而 `prepare_agent_soul` **只填 model、不填 prompt**；调试会话用 `system_instruction="", system_instruction_tokens=0`。
- **无硬编码 agent 默认 prompt 常量**（`AGENT_INSTRUCTION` / `PRE_PROMPT` 在 agent 路径上不存在）。`api/constants/recommended_apps.json` 是用户**主动挑选**的模板库，不自动应用。
- **小结**：Dify = 纯 C 档——可空、空、无预填、无兜底文案。

### 3.9 n8n（B 有默认，节点即预填）——**L-D**（另一个关键样本）

repo `n8n-io/n8n`，branch `master`，包 `@n8n/nodes-langchain`。

```ts
// packages/@n8n/nodes-langchain/nodes/agents/Agent/agents/ToolsAgent/prompt.ts
export const SYSTEM_MESSAGE = 'You are a helpful assistant';
// .../ToolsAgent/options.ts
{ displayName: 'System Message', name: 'systemMessage', type: 'string', default: SYSTEM_MESSAGE, ... }
// packages/@n8n/nodes-langchain/utils/descriptions.ts
export const promptTypeOptions = { ..., default: 'auto', ... };
export const textInput = { displayName: 'Prompt (User Message)', name: 'text', type: 'string', required: true, default: '', ... };
export const textFromPreviousNode = { ..., required: true, default: '={{ $json.chatInput }}', ... };
```

- **`systemMessage` optional 且有硬编码默认** `'You are a helpful assistant'`；`text`（user prompt）声明 `required: true` 但**带默认值**（`''` 或表达式 `={{ $json.chatInput }}`）；`promptType` 默认 `'auto'`。
- **新建节点即带预填**——拖出来就有值，用户不改也能跑。
- 旧版 ConversationalAgent 的默认 `SYSTEM_MESSAGE` 是一整段以 `Assistant is a large language model trained by OpenAI.` 开头的长文案。
- **小结**：n8n = B 档，且是「预填进表单」这一形态的典型——**与 §5 的选项②同形**。

### 3.10 Coze（C 可空 + 写死外层模板）——**L-D**

- **闭源 SaaS（coze.com / coze.cn）：未取得证据**——官方文档页经 Jina Reader 抓取只返回导航与 CAPTCHA 提示（"This page maybe requiring CAPTCHA"），正文 JS 渲染未获取。不回填猜测。
- **开源 Coze Studio（`coze-dev/coze-studio`，branch `main`）：源码实证。** 新建 agent 的 persona/prompt **不预填**（`backend/application/singleagent/create.go::newDefaultSingleAgent` 里 `Prompt: &bot_common.PromptInfo{}` 为空结构体）；但运行时会把它套进一段**写死的系统提示模板**（`backend/domain/agent/singleagent/internal/agentflow/system_prompt.go`）：

```
const REACT_SYSTEM_PROMPT_JINJA2 = `
You are {{ agent_name }}, an advanced AI assistant designed to be helpful and professional.
...
----- Start Of Persona -----
{{ persona }}
----- End Of Persona -----
...`
```

- **小结**：C 档 + 外层模板。空 persona 不会让 prompt 变残句（有护栏与角色框），但也不会替用户编一段 persona。

### 3.11 汇总

| 项目 | repo · 分支 | 字段 | ① 档位 | 声明处 default | ② 创建面预填 | ③ 首次 seed | ④ 内置模板/角色 | 缺省时的运行时行为 |
|---|---|---|---|---|---|---|---|---|
| **Claude Code 子代理** | 本机 2.1.289 二进制 + docs | frontmatter `description` | **A 必填** | 无 | 无 | 无 | 无（内置件 description 写死） | 文件路径**不加载**；`--agents` JSON **rc=1 拒启动** |
| **CrewAI** | `crewAIInc/crewAI@main` | `role`/`goal`/`backstory` | **A 必填** | 无 + 非空 validator | 脚手架模板 `agents.yaml` | 无 | 脚手架模板角色 | Pydantic `ValidationError` / `ValueError` |
| **AutoGen** | `microsoft/autogen@main` | `system_message` | **B** | `"You are a helpful AI assistant. …"` | 无 | 无 | MagenticOne roster 写死 | 用默认串；传 `None` = 显式关闭 |
| **OpenAI Agents SDK** | `openai/openai-agents-python@main` | `instructions` | **C** | `None` | 无 | 无 | 无（`RECOMMENDED_PROMPT_PREFIX` opt-in） | **完全不发 system message** |
| **LangGraph** | `langchain-ai/langgraph@main` | `create_react_agent(prompt=)` | **C** | `None` | 无 | 无 | 无 | 不前置任何 message |
| **Letta（当前）** | `letta-ai/letta-code@main` | persona / human blocks | **B + seed** | 通用 `persona.mdx` 正文 | 人格预设目录（6 个） | **有**（写进 memory 仓库并提交） | `PERSONALITY_OPTIONS` + `persona_*.mdx` | 用预设正文；`blank` 人格 = 「你必须问用户」 |
| **Letta V1** | `letta-ai/letta@archive` | `persona` / `human` block | B（配置层） | `DEFAULT_PERSONA="sam_pov"`（**文件名**） | 模板库 `personas/examples/*.txt` | 创建链路**不** seed 文本（`DEFAULT_BLOCKS` 值为 `""`） | `.txt` 模板库 | 见左；端到端是否生效**未取得证据** |
| **MetaGPT** | `FoundationAgents/MetaGPT@main` | `profile`/`goal`/`constraints` | **C** | `""` 空串 | 无 | 无 | 内置角色写死（ProductManager 等） | `You are , named , your goal is .` 残句 |
| **ChatDev** | `OpenBMB/ChatDev@main` / `chatdev1.0` | `role` | **C**（main）/ **D**（经典） | `None` | 无 | **经典版**默认装配 `Default` 公司 | `RoleConfig.json` 写死 | main：无 prompt；经典：预置角色 |
| **Dify** | `langgenius/dify@main` | `pre_prompt` / Agent Soul `system_prompt` | **C** | `None` / `""` | **无** | 无 | 无（recommended_apps 需主动选） | 空 instruction |
| **n8n** | `n8n-io/n8n@master` | `systemMessage` | **B** | `'You are a helpful assistant'` | **有**（拖出节点即预填） | 无 | 该默认串即固定模板 | 用默认串直接跑 |
| **Coze Studio** | `coze-dev/coze-studio@main` | persona | **C** | 空 | 无 | 无 | 外层写死 `REACT_SYSTEM_PROMPT_JINJA2` | 空 persona 进模板槽 |

**分布**：A 必填 2 / B 有默认 4（AutoGen、n8n、Letta 当前、Letta V1 配置层）/ C 可空 5（含 ChatDev main、MetaGPT 基类、Dify、Coze、OpenAI+LangGraph 两件算 1）/ D 内置写死 1（ChatDev 经典）。

**两条跨项目的规律**（不是印象，是上表可数的）：

1. **「有默认值」档全是"通用助手"型默认**（`You are a helpful assistant` ×2、`I'm a coding assistant` ×1），**没有一个是"具体角色"型默认**。因为框架不知道你的 agent 是干什么的——它只能给一个诚实的空壳。
2. **越把该字段当路由键，越倾向必填或显式缺失**：Claude Code（按 description 委派）→ 必填；CrewAI（按 role 分工）→ 必填 + 非空校验；pacman 总管（按职责分派）落在同一族，却停在 C 档，且**用一句冒充职责的字符串填了兜底**（§2.4）。

---

## 4. 子问题：有没有项目对「第一个 / 主 agent」特殊对待？

| 项目 | 有没有 | 证据 |
|---|---|---|
| **CrewAI** | **有**（唯一形态最接近"seed 一个默认协调者"的） | `lib/crewai/src/crewai/crew.py:1531-1555` `_create_manager_agent()`：`manager_agent` 为空时自动构造一个 manager，其 role/goal/backstory 从 i18n 取——`lib/crewai/src/crewai/translations/en.json:2-6` 逐字 `"role": "Crew Manager"`、`"goal": "Manage the team to complete the task in the best way possible."`、一长段 backstory。**源码实证**。限定条件：仅 `process=hierarchical` 且未传 `manager_llm`/`manager_agent`；普通 sequential crew 不 seed。 |
| **ChatDev（经典）** | **有** | `chatdev1.0/run.py`：`--config` 默认 `"Default"`，缺失回落 `CompanyConfig/Default`——首跑即装配一整套（含 CEO/CPO）预设角色公司。**源码实证**。 |
| **AutoGen** | **部分有** | MagenticOne team 构造时固定 roster（`magentic_one.py:211-221`），并有一个"主协调者"Orchestrator——但其 system message 实测是**空串**（`autogen_agentchat/teams/_group_chat/_magentic_one/_prompts.py:3` `ORCHESTRATOR_SYSTEM_MESSAGE = ""`，且全仓 grep 不到引用），主 agent 的 persona 靠 ledger 提示词而非常规 system message。**源码实证**。「首次运行自动 seed 一个默认协调者」这一通用机制：**未找到**。 |
| **Claude Code** | **有一格，但不是"默认 persona"** | 主会话 agent 独享 `initialPrompt` 字段——文档（**D**）：`Auto-submitted as the first user turn when this agent runs as the main session agent (via --agent or the agent setting)` + 「Ignored for plugin subagents」。即"主 agent"这个位置确实被特殊对待，但被特殊化的是**自动首轮消息**，不是 persona 默认值。 |
| **Letta 当前** | **部分有** | `ONBOARDING_PERSONALITIES = ["tutorial"]`——只有 `tutorial` 人格的新 agent 会额外 seed 一个 onboarding 块。**按人格预设区分，不是"只给主 agent"**。**源码实证**。 |
| **Letta V1** | **未找到** | `server.py` 对 sleeptime / voice / group 等场景用专用 persona 文本，但**没有"首个/主 agent"分支**，`create_agent` 主路径与所有 agent 同构。 |
| **MetaGPT / ChatDev main / Dify / n8n / Coze / OpenAI SDK / LangGraph** | **未找到** | 均对所有 agent 一视同仁。 |

**结论**：**「给第一个 agent 特殊待遇」在别的项目里是少数派，且都是"多 agent 协作框架的编排者"语境**（CrewAI hierarchical manager、ChatDev 默认公司、AutoGen MagenticOne roster）——它们特殊对待的是**协调者这个角色**，不是"第一个被创建的对象"。

这一点对本仓直接相关：**pacman 已经有专门的协调者实体——总管（chief）**。它不是 agent 花名册里的一员，而是独立记录 + 绑定一个 agent（`apps/server/src/services/chief.ts:735-756`；未绑定则 `chief-drawer.tsx:600` 硬闸）。所以"第一个 agent 需要特殊待遇"这个直觉在本仓的对应物**不是给第一个 agent 一个默认职责，而是总管绑定这件事本身**——这正好是 §5 选项④的由来，也是它代价的来源。

---

## 5. 对本仓的取舍

### 5.1 四个选项摆开

沿用 §2.7 那把尺子（`AGENT_TOOL_DEFAULTS` 的两条判据：**不破坏交付** + **最小权限**——默认值只在"缺它会破坏一条既有链路"且"加的那档无歧义"时才加）。

**① 维持可空（现状）**

- 代价：默认路径（创建弹窗无职责栏 → §2.3）产出空职责；总管 prompt 里出现「未设置职责」并**被当作职责文本消费**；worker 侧静默省略（两面对同一 null 行为相反，§2.4）；空串还能绕过所有兜底（§2.5）。
- 要改的落点：零。
- 存量行：不动。

**② 首次创建 agent 时预填一段可编辑草稿**

必须先分成两个不同的东西，它们的代价相差一个量级：

- **②a placeholder（灰字提示，不落库）**：只改 UI。落点 = `create-agent-dialog.tsx` 增加职责输入（placeholder 给范例，如「负责后端接口与数据层」）+ `CreateAgentInput` 扩字段 + `POST` 带上。存量行不动，e2e 空态断言不动（用户没填仍落 null）。**代价最小，且不伪造数据。**
- **②b 真预填（落库一段默认文案）**：等于 ①+一个谎（见 5.2）。落点同 ②a，但多一条 migration 语义、且总管 prompt 里将不再有"缺失"信号。**不建议**。

**③ 把 `description` 改成必填**

- 代价：破坏参考产品平价（todos.dev 允许空，r3:187 团队页卡显「未设置职责」）；存量 null 行必须 migration 回填（沿 `0018_agent_push_backfill.sql` 的形态），而**回填什么值本身就是本题**——无法回避地要编一段通用文案；`create-agent-dialog` 要多一栏且加提交闸；`createAgentBodySchema` / `patchAgentBodySchema` / chief `create_agent` 工具 schema（`protocol/chief-tools.ts:349-361` 要从 `required:['displayName']` 扩成含 description）四处同改；`apps/web/e2e/agent-detail.spec.ts:105` 空态 canon 断言作废重写。
- **最强的反例（来自 L-B）**：CrewAI 的必填之所以零成本，是因为它的 `role` 是**开发者写代码时填的常数**——开发者本来就要给 agent 起名，多填三行不构成摩擦。pacman 的职责是**终端用户在 UI 上的运行时输入**（创建口今天连输入框都没有）。必填在这里等于在 UI 上挡一道闸，而**必填只能保证非空、不能保证有信息量**（用户填「agent」二字照样过关）。这题的实际损失是**语义缺失**，形式约束治不了语义缺失。

**④ 只对「总管绑定的 agent」给默认值**

- 代价：绑定时 agent 已建好（§2.3 创建口无职责栏），写默认值 = **回头改用户的数据**；换绑时要决定是否撤销（撤销 = 改回 null，又是一次写）；且总管绑定的 agent 在 pacman 里就是**一个普通 agent**（记忆共用，`chief.ts:735`），给它一份特殊默认值会让它与同表其它行不同源，后续判据都要带"是不是总管绑的那个"这个分支。
- 存量行：绑定关系在 `chief` 表，回填要 join，且"曾经绑过又解绑"的行没有可判定的终态。
- 唯一站得住的地方：§4 表明"特殊对待协调者"确实是对齐别家的（CrewAI / ChatDev / AutoGen）。但别家特殊对待的是**编排者这个角色**，pacman 的编排者已经有专门实体（总管），不需要借用"第一个 agent"来承载。

### 5.2 取舍：为什么「给默认值」在本仓比「留空」更坏

这一段是本篇的核心论证，独立于别家证据。

**职责在本仓是路由键。** 证据：总管 system prompt 的策略段写着「分派：读 agents 的职责文本按权重选择」（`apps/server/src/services/chief.ts:768` 前后），且 r5 §3.3 的 A/B 实测证明**职责文本确实参与分派且方向一致**（纯文档任务 → 文档职责 Agent；含代码 → 代码职责 Agent；`docs/research/r5-chief-behavior.md:52-56`）。

对一个路由键：

- **留空是真实信号**：总管看到的是一行明确标着「未设置职责」的候选，它可以据此选择「问用户」或「按名称/模型判断」——**这个决策发生在模型侧，且信息是真的**。
- **默认值是貌似合理的假信号**：若默认写成「通用助手」，那么**每一个没填职责的 agent 在分派清单里长得一模一样**。总管会把它当作真实职责去读、按它去挑人——派发依然退化，但**退化成静默的**：用户再也看不出"我没填"这件事。

**结论 1：对路由键而言，`空` 优于 `通用默认`，因为前者诚实、后者撒谎。** 这也解释了 §3.11 规律 1：所有「有默认值」档给的都是"通用助手"型空壳——框架不敢替用户编具体角色，只敢给一个诚实的占位；而一旦这个占位被当成路由依据，它就和 pacman 的「未设置职责」一样是假信号。

**结论 2：pacman 今天的两个面已经各选了一边，worker 面选对了，总管面选错了。** §2.4：`composeWorkerSystemPrompt` 用 `if (description)` **静默省略**（= 真·留空，与 OpenAI Agents SDK / LangGraph 同形），总管面用 `?? '未设置职责'` **字面注入**（= 把缺失状态当值）。**同一份 null，两个面相反**——这本身就是"从未被统一裁决过"的标志。

**结论 3：因此正确的方向不是"补一个默认值"，是把总管面从"字面注入"改成"显式告知缺失并给出可执行动作"。** 别家有一条现成的、比 pacman 现有兜底更好的形态：**Letta `blank` 人格的 persona 正文不是空白也不是假 persona，而是一条指令**——`This is a blank starter personality. You must ask the user to provide a personality prompt or preference.`（§3.5）。同构地，总管 prompt 里该出现的不应是「职责：未设置职责」，而是「职责：未设置——分派前先 ask_user 澄清，不要凭名称猜」。**它保住"缺失"这个信号，同时把模型从"猜"推向"问"。**

### 5.3 推荐

**推荐组合：维持可空（选项①）+ 两处小改（都在消费侧，不碰 schema、不碰数据）。**

1. **改总管 prompt 的缺失兜底**（`apps/server/src/services/chief.ts:755` 与 `:768` 两处）：把 `?? '未设置职责'` 换成一句**可执行指令**而非状态标签，让"没填"变成"去问"而不是"按它猜"。这是 §5.2 结论 3 的直接落点。
2. **补空串归一**（§2.5）：在四条 API 写路径落库前把 `''` 归一成 `null`（`description: body.description?.trim() || null` 形态），或下沉成 shared schema 的一个 `.transform`。**不做这条，任何兜底文案（包括现有的「未设置职责」）都能被 `''` 绕过而渲染成空白**——这是当下就存在的洞，与本题结论无关也该修。

**加上一个可选的 UI 改进（②a，placeholder）**：在创建弹窗加一个职责输入，**placeholder 给范例、不落库**。它不改变任何数据语义，只在用户注意力最集中的时刻（正在建 agent）提示这个字段存在及其用途——今天创建口连这个栏位都没有（§2.3）。**这是"帮用户写"，不是"替用户决定"**，与 5.2 的结论不冲突。

**明确不建议**：②b 真预填、③ 必填、④ 只对总管绑定 agent 给默认值——理由见 5.1 各项代价，核心是它们要么引入假信号（②b/④），要么用形式约束去治语义缺失（③）。

### 5.4 Premortem：假设这套推荐已失败，三个最可能的死因

1. **"改文案"没有可验证的判据 → 改完没人知道有没有用。**
   最可能死因。总管的派发质量没有离线指标，改了兜底文案后唯一能观测的是"派发是否变好"，而那要真跑 LLM。**护栏**：把这条拆成**可判定的两步**——(a) prompt 里不再出现「未设置职责」这五个字（可单测：组装后的 prompt 字符串断言）；(b) 存在一条 e2e/集成用例：未设置职责的 agent 在场时，总管回合的输出含 ask_user 调用（可用 stub LLM 打桩，仓内已有 chief 全链假 LLM 的跑法）。没有 (b) 就别开工。
2. **推荐被读成"什么都不做"，然后选项③在别处被顺手实现。**
   "维持可空 + 改文案"听起来像低优先级，容易被下一次"帮我把职责设成必填"的直觉覆盖。**护栏**：本篇结论要能被引用——把 5.2 的「空优于通用默认，因为路由键不能撒谎」写成一句话写进 `CONTEXT.md` 的 agent 词条或 spec 13，让后来者撞到同一个直觉时有正本可查。
3. **placeholder（②a）被实现成 ②b 真预填。**
   差别只在"提交时带不带那个值"，实现时极易滑过去（`CreateAgentInput` 多一个字段、`onCreate` 顺手填上就成默认值）。**护栏**：e2e 加一条——**不触碰职责输入直接提交，落库的 `description` 必须是 `null`**（这条断言顺手也把 §2.5 的空串洞一起钉住）。

### 5.5 对本仓纪律的对照

- 本仓「改动由真实使用驱动，不照抄别人的 spec」：本篇给的推荐**不是**从别家的分布投票来的（A 2 / B 4 / C 5 / D 1，多数派其实是 B），而是从"职责在本仓是路由键"这一条**自有事实**推出来的；别家证据只用于取反面样本（MetaGPT 空串残句、Letta blank 的正确形态、CrewAI 必填不适用于运行时输入面）。
- 「加默认值 = 对参考产品的偏离」：推荐①不偏离；推荐里的两处小改（总管文案、空串归一）**已经与参考产品不同源**——参考产品的总管是黑盒（r5 §2 黑盒逼近），其分派策略段的文案本就是复刻侧的 [设计]，改它不构成新的偏离。空串归一属纯缺陷修复。

---

## 6. 附：本篇未闭合的项

1. **Coze SaaS 的新建预填**：**未取得证据**（文档页 JS 渲染 + CAPTCHA，Jina Reader 取不到正文）。开源 Coze Studio 的结论不能替它说话。
2. **Letta V1 的 `DEFAULT_PERSONA="sam_pov"` 是否仍在某条创建路径生效**：**未取得证据**（创建链路只把它读进配置默认值，未找到端到端调用点）。
3. **空串穿透（§2.5）只做了读码复核，未跑运行时构造 `description: ""` 的状态**。要闭环应起 verify 栈跑一次 `POST` 带 `description: ""`，看详情页是否渲染空白。
4. **总管派发在"职责缺失"下的实际表现**（是否真的会退化成按名称猜、是否真的会 ask_user）：未实测。这是 5.4 死因 1 的护栏 (b) 要回答的问题。