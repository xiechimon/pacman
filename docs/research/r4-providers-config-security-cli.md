# R4 — 上游近读：providers 路由 / config / security / CLI

- 票：xiechimon/pacman #18（研究），供「设计：providers + config + security + CLI TS 化」票使用
- 上游：`/Users/xmon/Code/AgentProjects/nanobot`（只读）。所有引用为相对该 repo 根的 `路径:行号`，行号来自本次实际 Read。
- 标注约定：未标「推断」的均为代码直读事实；「推断」= 由代码推理、非字面写明。

## 0. 摘要

1. Provider 元数据单一事实源是 `PROVIDERS: tuple[ProviderSpec, ...]`（`nanobot/providers/registry.py:146-786`），**顺序即优先级**（`registry.py:9`）；加新 provider 只需加一条 ProviderSpec + 在 `ProvidersConfig` 加一个字段（`registry.py:4-7`）。
2. 选择算法不在 registry，而在 `Config._match_provider`（`nanobot/config/schema.py:495-614`）：forced provider → 显式模型前缀 → custom 前缀 → keyword 匹配 → 本地 fallback（`detect_by_base_keyword`）→ 任意有 key 的内置 provider → 任意有 api_base 的 custom provider。
3. `detect_by_key_prefix` 字段有定义、有 4 处赋值，但**运行时零消费**（仅测试引用）——疑似死数据（见 §1.4）。
4. 后端实现按 `spec.backend` 字符串在 `factory._make_provider_core` 分派到 7 个类（`nanobot/providers/factory.py:168-237`）；绝大多数 provider 共用 `OpenAICompatProvider`。
5. Config：pydantic-settings，`~/.nanobot/config.json`（`nanobot/config/loader.py:39`），文件存在时走 `model_validate`（`loader.py:124`），env 注入主要靠文件内 `${VAR}` 插值（`loader.py:193-241`）；camelCase/snake_case 双接受（`nanobot/config_base.py:12-15`）。
6. 热更新存在：gateway 用 watchfiles 监听 config → `agent.invalidate_runtime_config()` → 按 `provider_signature` 比较决定是否重建 provider（`nanobot/cli/gateway_runtime.py:932-939`、`nanobot/providers/factory.py:316-370`）。
7. Security = SSRF 网络防护（DNS pinning）+ 应用级 workspace 路径围栏 + 可选 OS 沙箱（bwrap/seatbelt，默认关）。`tools.restrict_to_workspace` 默认 `False`（`nanobot/config/schema.py:401`）。
8. CLI 入口 `nanobot = "nanobot.cli.entry:main"`（`pyproject.toml:110-111`）；命令面：agent/gateway/webui/serve/status/onboard/trigger/sessions/channels/plugins/provider。**没有 `models` 命令**——`nanobot/cli/models.py` 只是被禁用的助手 stub（`models.py:1-6`）。
9. Langfuse 挂钩 = 条件替换全局 `AsyncOpenAI` 符号为 `langfuse.openai.AsyncOpenAI`（`nanobot/providers/openai_compat_provider.py:621-632`）。
10. 失败转移：`FallbackProvider` 包裹 primary，按 `agents.defaults.fallback_models` 配置（`factory.py:273-297`），fallback 触发条件集中在 `_should_fallback`（`nanobot/providers/fallback_provider.py:672-712`）。

---

## 1. Provider 选择算法（伪码 + 引用）

### 1.1 主算法 `Config._match_provider`（nanobot/config/schema.py:495-614）

输入：`model`（或 preset.model）、`preset.provider`（`"auto"` 或显式名）。返回 `(ProviderConfig | None, spec_name | None)`。

```text
resolved = preset or config.resolve_preset()            # schema.py:506
forced = resolved.provider                              # schema.py:507

# ── 0) 显式 provider（非 "auto"）───────────────────────  schema.py:518-526
if forced != "auto":
    spec = find_by_name(forced)                          # registry.py:794-800, 名称 to_snake 归一
    if spec:  return (config.providers[spec.name], spec.name)
    if forced 命中 providers 的 extra 字段(custom):  return 该 custom
    return (None, None)                                  # 显式名不匹配任何 provider → 失败,不 fallback

model_lower/model_prefix/normalized_prefix = 归一化 model  # schema.py:528-531
prefixed_provider = find_by_name(model_prefix)           # schema.py:532

# ── 1) 显式模型前缀 wins ─────────────────────────────  schema.py:538-545
for spec in PROVIDERS (注册顺序):                         # 跳过 is_transcription_only
    if model_prefix 且 normalized_prefix == spec.name:
        if spec.is_oauth or spec.is_local or spec.is_direct or p.api_key:
            return (p, spec.name)
# 注释明言: 防止 `github-copilot/...codex` 误配 openai_codex (schema.py:538)

# ── 2) custom provider 按前缀 ─────────────────────────  schema.py:547-554
if model_prefix 且命中 providers.model_extra:  return 该 custom
# 即使缺 apiBase 也返回, 让畸形显式前缀失败而不是滑到其他 provider (schema.py:548-550)

# ── 3) keyword 匹配(按 PROVIDERS 注册顺序) ─────────────  schema.py:556-579
for spec in PROVIDERS:                                   # 跳过 is_transcription_only
    _kw_matches(kw) = kw in model_lower or kw.replace("-","_") in model_normalized   # schema.py:534-536
    if any keyword 命中:
        if spec.is_local:                                # schema.py:569-577
            # 本地 provider 必须已配 api_base 才算命中; 且带外来前缀的模型
            # (prefixed_provider 存在且 != spec) 不允许被本地 keyword 抢走
            if not p.api_base or foreign_prefix: continue
        if spec.is_oauth or spec.is_local or spec.is_direct or p.api_key:
            return (p, spec.name)

# ── 4) 本地 fallback(仅当模型无 provider 前缀) ─────────  schema.py:581-598
if prefixed_provider is None:
    for spec in PROVIDERS where spec.is_local:
        if p.api_base 已配置:
            if spec.detect_by_base_keyword in p.api_base:  return (p, spec.name)   # 优先 URL 特征
            local_fallback ??= (p, spec.name)              # 否则记住第一个
    if local_fallback: return local_fallback

# ── 5) gateway/任意已配 key 的内置 provider(注册顺序) ──  schema.py:600-607
for spec in PROVIDERS:                                   # 跳过 is_oauth、is_transcription_only
    if p.api_key: return (p, spec.name)
# 注释: OAuth provider 不是合法 fallback,必须显式选模型 (schema.py:601)

# ── 6) 任意已配 api_base 的 custom provider ────────────  schema.py:609-612
for attr_name, p in providers.model_extra:
    if isinstance(p, ProviderConfig) and p.api_base:  return (p, attr_name)

return (None, None)                                      # schema.py:614
```

- 「gateway 在 fallback 中获胜」由注册顺序实现：所有 `is_gateway=True` 的条目排在标准 provider 之前（`registry.py:189-386` vs `registry.py:388-687`；注释 `registry.py:9,190`）。
- api_base 解析：`get_api_base` = config 里的 `api_base` 优先，否则 `spec.default_api_base`（`schema.py:646-662`）。
- 选择结果的校验/构造在 `factory._resolve_provider_setup`（`factory.py:76-131`）：无 provider → `ValueError`（86-87）；未知 provider 名且无 api_base → 报错（89-91）；未知但有 api_base → `create_dynamic_spec` 动态 spec（92-96；`registry.py:803-821`，backend=openai_compat、is_direct=True、strip_model_prefixes=(name, normalized)）；transcription-only 拒绝（97-98）；proxy 仅允许 openai_compat/openai_codex/xai_grok（100-104）；azure 必须有 api_base（106-108）；direct 且无默认 base 必须有 api_base（109-116）；anthropic/openai_compat 需要 api_key，除非 spec 是 oauth/local/direct（117-123）。

### 1.2 构造分派 `factory._make_provider_core`（factory.py:150-240）

| backend 字符串 | 实现类 | 引用 |
|---|---|---|
| `openai_codex` | `OpenAICodexProvider` | factory.py:168-176 |
| `xai_grok` | `XAIGrokProvider` | factory.py:177-185 |
| `azure_openai` | `AzureOpenAIProvider` | factory.py:186-196 |
| `github_copilot` | `GitHubCopilotProvider` | factory.py:197-200 |
| `anthropic` | `AnthropicProvider` | factory.py:201-210 |
| `bedrock` | `BedrockProvider` | factory.py:211-222 |
| 其余（默认 `openai_compat`） | `OpenAICompatProvider` | factory.py:223-237 |

- extra_headers = `spec.default_extra_headers` 与 config `extra_headers` 合并（config 覆盖）（`factory.py:42-49`）。
- `provider.generation = preset.to_generation_settings()`（`factory.py:239`；`schema.py:107-113`）。
- `make_provider`：若 `agents.defaults.fallback_models` 非空，用 `FallbackProvider(primary, fallback_presets, provider_factory=…)` 包裹（`factory.py:273-297`）；fallback 项可以是 preset 名（str）或内联 `InlineFallbackConfig`（`factory.py:263-270`；`schema.py:83-94`）。
- `build_provider_snapshot`：context_window 取 primary 与所有 fallback 的最小值（`factory.py:385-396`）。
- 未配置 provider 时构造 `UnconfiguredProvider`，chat 恒返回 `finish_reason="error", error_kind="configuration"` 的提示文本，让 WebUI 能进入首启设置（`factory.py:300-313`；`nanobot/providers/unconfigured_provider.py:10-38`）。
- orcarouter 特例：名字命中内置 spec 但 config 的 api_base ≠ 默认 base 时，退回动态 spec（历史上它曾是自定义 provider 名）（`factory.py:52-73`）。

### 1.3 ProviderSpec → 运行时行为的数据驱动开关（registry.py:34-139）

- `strip_model_prefix` / `strip_model_prefixes`：发给 gateway 前剥 `provider/` 前缀（`registry.py:69-70`；实际剥除在 `_request_model_name`，`openai_compat_provider.py:876`）。
- `thinking_style`（`""` | `thinking_type` | `enable_thinking` | `reasoning_split`，`registry.py:88-94`）→ `_THINKING_STYLE_MAP` 生成 extra_body（`openai_compat_provider.py:137-144`）。
- `gateway_reasoning_style="reasoning_effort"` → `{"reasoning": {"effort": …}}`（`registry.py:96-99`；`openai_compat_provider.py:145-150`）。
- `reasoning_effort_remap`（Mistral 词表映射，`registry.py:106-110`）、`implicit_reasoning_models`（拒绝 effort kwarg 的模型子串，`registry.py:112-115`）、`extract_thinking_blocks`（`registry.py:125-129`）、`strip_history_reasoning_content`（`registry.py:131-135`）、`reasoning_as_content`（StepFun 把答案放 reasoning 字段，`registry.py:101-104`；消费点 `openai_compat_provider.py:1579,1658`）。
- `responses_models` / `responses_default_tools`：模型级 OpenAI Responses wire format 白名单（`registry.py:117-123`）。
- `model_overrides`：按模型名子串覆盖请求参数（如 kimi-k2.7 temperature=1.0，`registry.py:73-74,587-591`；消费 `openai_compat_provider.py:969-974`）。
- `supports_prompt_caching` → `_apply_cache_control` 注入 `cache_control: ephemeral`（`registry.py:85-86`；`openai_compat_provider.py:639-673,942-945`）。
- `env_extras`（占位符 `{api_key}`/`{api_base}`，`registry.py:38-41,58`）、`default_extra_headers`（如 Kimi Coding 需要 `User-Agent: claude-code/0.1.0`，`registry.py:595-603`）。
- `model_catalog`（auto/builtin/hybrid/official）+ `builtin_models: tuple[ProviderModelSpec,...]`：WebUI 模型列表来源（`registry.py:22-31,48-49`）。

### 1.4 `detect_by_key_prefix` 是死数据（重要）

- 定义：`registry.py:64`（注释「match api_key prefix, e.g. "sk-or-"」）。
- 赋值 4 处：openrouter `"sk-or-"`（`registry.py:199`）、orcarouter `"sk-orca-"`（213）、huggingface `"hf_"`（277）、nvidia `"nvapi-"`（752）。
- 全仓 grep：运行时消费为零，仅 `tests/providers/test_orcarouter_provider.py:26` 断言字段值。选择算法只消费 `detect_by_base_keyword`（`schema.py:593`，且仅在本地 fallback 分支）。
- 推断：按 key 前缀路由曾是设计意图但从未接线（或已退场）；TS 化时不必复刻，除非要补全该功能。
- 同理，`env_key` 的运行时消费也只有转写路径（`nanobot/audio/transcription.py:101-102`），LLM 主链路不读它（见 §4.2）。

### 1.5 Out-of-scope provider 的接口形状（azure/bedrock/codex/copilot/xai）

| provider | 类 | 基类 | 构造要点 | 引用 |
|---|---|---|---|---|
| azure_openai | `AzureOpenAIProvider` | `LLMProvider` | `(api_key, api_base必填, default_model, provider_name)`；含 `_AzureTokenProvider`（AAD token） | azure_openai_provider.py:54,94,107 |
| bedrock | `BedrockProvider` | `LLMProvider` | `(api_key, api_base, default_model, region, profile, extra_body, provider_name)`，原生 Converse API | bedrock_provider.py:51-54; registry.py:166-188; factory.py:211-222 |
| openai_codex | `OpenAICodexProvider` | `LLMProvider` | `(default_model, proxy, extra_body, provider_name)`；OAuth，无 api_key；base `https://chatgpt.com/backend-api` | openai_codex_provider.py:56-59; registry.py:407-469 |
| github_copilot | `GitHubCopilotProvider` | **`OpenAICompatProvider` 子类** | `(default_model, provider_name)`；OAuth；仅 /responses，出错不回落 chat completions | github_copilot_provider.py:182-185; openai_compat_provider.py:1991-1995,2102-2106 |
| xai_grok | `XAIGrokProvider` | `LLMProvider` | `(default_model, proxy, extra_body, provider_name)`；OAuth；base `https://cli-chat-proxy.grok.com/v1` | xai_grok_provider.py:66-73; registry.py:470-494 |

- OAuth provider 共同点：`is_oauth=True`、`env_key=""`、config 字段 `exclude=True`（不落盘 api_key；`schema.py:287-289`）；save_config 只持久化其 `proxy`/`extra_body`（`loader.py:157-171`）；登录走 `nanobot provider login`（`nanobot/cli/provider.py:152-171`）。
- **扩展机制**（`registry.py:4-7` docstring 明言）：① 往 `PROVIDERS` 加一条 `ProviderSpec`（位置=优先级）；② 往 `ProvidersConfig` 加同名字段。env 变量、匹配、status 显示随之派生。不改名进 registry 的自定义 provider 走 `extra="allow"` + `create_dynamic_spec` 路径（`schema.py:240-247,296-310`；`registry.py:803-821`）。`providers/__init__.py` 用 `_LAZY_IMPORTS` 字典惰性导出 7 个实现类（`providers/__init__.py:23-49`）。

---

## 2. openai_compat_provider 结构（streaming / reasoning / Langfuse / anthropic 分叉）

### 2.1 类与客户端生命周期

- `class OpenAICompatProvider(LLMProvider)`（`openai_compat_provider.py:509`）。构造：`_api_type` 仅当 `spec.name=="openai"` 时生效（536）；`effective_base = api_base or spec.default_api_base`（541）；默认头 `x-session-affinity: <uuid>`（543）、OpenRouter attribution 头（544-545）、OpenCode session affinity 头（548-553）；`api_key or "no-key"`（554，本地服务器占位）；客户端**惰性构造**（Windows 上 ~700ms，557-560）；Responses 熔断器状态（562-565）。
- `_build_client`（567-612）：显式 proxy → httpx AsyncClient(trust_env=False)（573-579）；本地端点 → keepalive_expiry=0 且禁 proxy（580-600，注释解释本地服务器提前关连接的坑）；`AsyncOpenAI(max_retries=0, timeout=NANOBOT_OPENAI_COMPAT_TIMEOUT_S|120s)`（604-612；132、210-212）。重试全部集中在基类（见 §2.5）。
- **Langfuse 挂钩点**：`_ensure_client` 里一次性把模块级全局 `AsyncOpenAI` 符号替换为 `langfuse.openai.AsyncOpenAI`，条件是 `LANGFUSE_SECRET_KEY` 已设且 langfuse 包可 import；设了 key 但没装包 → 打 warning 提示 `nanobot plugins enable langfuse`（621-632）。推断：即观测性通过 SDK 类替换（monkeypatch）实现，对上层调用透明。

### 2.2 API surface 路由（chat completions vs responses）

- `_should_use_responses_api`（1106-1145）：`api_type=="chat_completions"` 直接否；模型在 `spec.responses_models` 或 provider ∈ {openai, github_copilot} 才有资格；`api_type=="responses"` 或 extra_body 配了 hosted web search → 强制 Responses（1147-1164）；「wants」= responses 模型 / reasoning_effort≠none / 模型名含 gpt-5|o1|o3|o4（1135-1141）；最后过熔断器（1145，失败计数/探测间隔 564-565、1197-1228）。
- Responses 失败回落 chat completions，但 github_copilot 与「Responses 必需」场景直接 raise（1990-2000、2101-2111）。

### 2.3 streaming

- `chat_stream`（2015-2201）：Responses 路径用 `consume_sdk_stream` + `ResponsesStreamCapture`，产出 content/tool_calls/usage/reasoning 并构建 `provider_state`/compaction 状态（2033-2100）。
- Chat-completions 路径：zhipu 需要 `extra_body.tool_stream=True` 才吐工具参数增量（2118-2123）；`stream=True`、`stream_options={"include_usage":True}`（2124-2126）；**逐 chunk `asyncio.wait_for(idle_timeout)`**，idle 超时来自 `NANOBOT_STREAM_IDLE_TIMEOUT_S`，默认 90s、上限 3600s（2130-2141；`base.py:28-60`）。
- 增量回调三件套：`on_content_delta`（先 `_extract_text_content` 剥 Mistral 的块状 content，2146-2154）、`on_thinking_delta`（`delta.reasoning_content` 或 `delta.reasoning`，空则从 content 数组提 thinking 块，2155-2165）、`on_tool_call_delta`（index/call_id/name/arguments_delta，含 legacy function_call，2166-2187）。
- 流没收到 finish_reason 就结束 → `ConnectionError`（2188-2189）；正常收口 `_parse_chunks`（2190；1689-1848）。

### 2.4 reasoning / thinking 处理（请求侧 + 响应侧）

请求侧 `_build_kwargs`（928-1104）：
- temperature 门控（GPT-5/o 系列带 effort 时省略，957-960、897-913）；`max_completion_tokens` vs `max_tokens` 选择（962-967；`_requires_max_completion_tokens` 176-181）。
- effort 归一化：semantic（OpenAI 词表，`minimum`→`minimal` 别名）与 wire 分离（986-995）；kimi-k3 只收 `"max"` 或省略（997-1006）；dashscope `minimal`→`minimum`（1007-1009）；`implicit_reasoning_models` 命中 → 整个 kwarg 剥掉（1011-1019、1036-1037）；`reasoning_effort_remap` 映射，映射为空串 = 省略（1021-1034）。
- 仅当 `reasoning_effort` 显式配置时才注入 thinking extra_body（保持 provider 默认，1041-1059）；风格来自 `spec.thinking_style` + 模型级 `_MODEL_THINKING_STYLES`（kimi/mimo → thinking_type，qwen → enable_thinking，151-165、188-195）；kimi thinking 模型再 pop 掉 `reasoning_effort`（Moonshot 拒绝两者并存，1061-1067）。
- DeepSeek thinking 历史必须带 `reasoning_content`，缺则回填 `""`（1073-1094）；`strip_history_reasoning_content` 在 sanitize 阶段剥掉该键（Mistral 严格 schema，700-724 中的 717-721）。
- 用户 `extra_body` 最后深合并，configured tools 保持顶层防被替换（1096-1100、464-507）。

响应侧 `_parse`（1542-1687）：`reasoning_content` 缺失时依次尝试 `reasoning` 字段（1581-1583）、`extract_thinking_blocks` 从 content 数组提 thinking 块（1585-1589）、多 choice 兜底（1602-1603）；`reasoning_as_content`（StepFun）在 content 为空时把 reasoning 当正文（1579、1658）。

### 2.5 基类 `LLMProvider`（providers/base.py）

- 重试参数集中在基类：`_CHAT_RETRY_DELAYS=(1,2,4)`、persistent 模式上限 60s、429/瞬时错误词表（含中文「速率限制/访问量过大」）、可重试与不可重试的 429 错误码分类（`base.py:626-693`）。SDK 客户端一律 `max_retries=0` 防重试放大（`anthropic_provider.py:110-111`；`openai_compat_provider.py:609`）。
- 公共 DTO：`ToolCallRequest`（64）、`LLMUsage`（269，reported/estimated/mixed）、`LLMResponse`（554）、`GenerationSettings`（612）、`ProviderCallContext`（252）、`ProviderConversationState`（167）。
- 观测挂钩：`set_llm_call_observer`（713-715），每次物理调用上报（717-800）。
- 入口族：`chat`/`chat_stream`/`chat_with_context`/`chat_stream_with_context`/`chat_stream_with_retry`/`chat_with_retry`（923-1512）。

### 2.6 anthropic 路径（原生分叉）

- `AnthropicProvider(LLMProvider)` 用原生 `AsyncAnthropic`（`anthropic_provider.py:81-112`）；api_key 仅在提供时传入（104-105）——推断：未传时由 Anthropic SDK 自身回落 `ANTHROPIC_API_KEY` env。base URL 剥尾部 `/v1`（SDK 会自己拼，114-120）。
- 消息格式转换 OpenAI→Anthropic Messages：`_convert_messages`/`_assistant_blocks`/`_tool_result_block`/`_merge_consecutive`（188-497）；工具与 tool_choice 转换（498-539）；prompt caching `_apply_cache_control`（540-576）。
- thinking 映射（`_build_kwargs` 577-652）：`none`→`{"type":"disabled"}`（对默认思考的新模型必须显式关，616-621）；`adaptive`→`{"type":"adaptive"}`（622-627）；新模型（adaptive-only）手动档 → `{"type":"adaptive"} + output_config.effort`（628-632）；旧模型 → `{"type":"enabled","budget_tokens": low=1024/medium=4096/high=max(8192,max_tokens)}` 且抬高 max_tokens（633-639）；thinking 开启时 temperature 强制 1.0（626-627、638-639）；部分模型省略采样参数（600-605）。
- 哪些 spec 走 anthropic backend：`anthropic`（`registry.py:390-397`）、`kimi_coding`（595-603，Anthropic Messages 兼容端点 + 特殊 UA 头）、`minimax_anthropic`（615-622）。分叉点即 `factory.py:201-210` 的 `backend == "anthropic"` 分支。

---

## 3. FallbackProvider（失败转移）

- `class FallbackProvider(LLMProvider)`（`fallback_provider.py:102`），`__init__(primary, fallback_presets, provider_factory, primary_context_window_tokens)`（124；由 `factory.py:289-295` 构造，fallback provider 惰性经 factory lambda 创建）。
- `_should_fallback(response)` 判据（672-712）：欠费响应 → 是；auth 类 kind/token → 是；显式 non-fallback kind → 否；401/403 → 是；`error_should_retry is False` → 否；400/404/422 → 否；`error_should_retry is True` → 是；408/409/429/5xx → 是；否则按 fallback 词表匹配。
- fallback 发生时通知 `FallbackModelObserver`（663-669）。

---

## 4. Config 系统

### 4.1 层次与文件发现

- 默认路径 `~/.nanobot/config.json`（`loader.py:35-39`）；进程级全局覆盖 `set_config_path`（多实例支持，`loader.py:19-32`），CLI 各命令经 `--config/-c` 调它（`cli/runtime_config.py:117-133`）。数据目录 = config 文件所在目录（`config/paths.py:20-22`），运行时子目录 media/cron/logs/webui 都在其下（25-48）；workspace 默认 `~/.nanobot/workspace`（51-54；`schema.py:119`）。
- **加载分两条路**（`loader.py:42-136`）：
  - 文件不存在 → `Config()`（61）——此时 pydantic-settings 的 env 源生效：`env_prefix="NANOBOT_"`、`env_nested_delimiter="__"`（`schema.py:664-667`），即 `NANOBOT_AGENTS__DEFAULTS__MODEL` 这类 env 可整体构造配置。
  - 文件存在 → `json.load` → `_migrate_config`（347-382，旧字段搬家）→ `Config.model_validate(data)`（124）。推断：pydantic-settings v2 的 `model_validate` 不经过 settings sources，因此**有文件时 `NANOBOT_*` env 不参与合并**；文件路径下 env 注入的唯一机制是值内 `${VAR}` 插值（见下）。（依据：loader.py:61 vs 124 的调用差异；pydantic-settings>=2.12，pyproject.toml:29。库语义为推断，未在仓内验证。）
- `${VAR}` 插值：`resolve_config_env_vars` 全树扫描，缺变量抛 `ConfigLoadError(kind="missing_env")`（`loader.py:193-215,286-320`）；宽松版 `resolve_env_refs` 单值解析、缺失降级为 `""`（供转写等惰性字段，226-241）。运行时加载统一 `resolve_env=True`（`cli/runtime_config.py:109-110,130`），status 等诊断命令刻意不解析秘密（136-161）。
- 保存：`save_config` = `model_dump(mode="json", by_alias=True)` + 补写 OAuth provider 的 `proxy/extra_body`（其余字段被 `exclude=True` 挡掉）+ 原子写（temp+replace）（`loader.py:146-174`）。
- 错误模型：`ConfigLoadError{path, kind, summary, issues}`，kind ∈ invalid_json/invalid_root/invalid_schema/missing_env/io_error（`config/errors.py:12-18,46-60`）；issue 路径渲染会 redact 非常规标识符防泄密（`errors.py:22-44`）。
- 加载副作用：`_apply_ssrf_whitelist` 把 `tools.ssrf_whitelist` 推进 security.network 全局（`loader.py:139-143`）。

### 4.2 API key 的真实来源（澄清）

- LLM 主链路的 key 只来自 `ProviderConfig.api_key`（config 文件值，可为 `${VAR}` 引用）：`factory.py:227,205` → provider 构造。`OpenAICompatProvider` 无 key 时传 `"no-key"`（`openai_compat_provider.py:554`），**不读 `spec.env_key`**。
- `spec.env_key`（如 `ANTHROPIC_API_KEY`）运行时唯一消费点是音频转写（`nanobot/audio/transcription.py:87-102`：config key → siliconflow 特例 → `spec.env_key` env）。
- `_match_provider` 各分支的 `p.api_key` 判真同样只看 config 值（`schema.py:544,578,606`）。
- 推断：`registry.py:7` 「Env vars … derive from here」对 LLM 主链路而言名不副实；裸 env（如只设 `OPENAI_API_KEY`）不会让 provider 被自动匹配，除非 anthropic backend（SDK 内部回落 env，`anthropic_provider.py:104-105` 推断）或 config 里写了 `${OPENAI_API_KEY}`。
- env 影响运行时的其余散点：`NANOBOT_STREAM_IDLE_TIMEOUT_S`（`base.py:28-46`）、`NANOBOT_OPENAI_COMPAT_TIMEOUT_S`（`openai_compat_provider.py:210-212`）、`LANGFUSE_SECRET_KEY`（621-632）、沙箱标记 env（`security/workspace_access.py:396-411`）。

### 4.3 热更新

- 机制存在且只在 gateway 常驻进程接线：`watch_config_file`（watchfiles `awatch` 监听父目录、过滤到目标文件，`config/watcher.py:11-23`）作为任务运行（`gateway_runtime.py:932-939`），回调 `agent.invalidate_runtime_config()`；首次准入前再主动重读一次关窗（911-912）。
- Agent 侧：`runtime_resolver.invalidate()`/`admit()`（`agent/loop.py:242-243,528-535`；`agent/model_runtime.py:76-83`）；provider 是否重建由 `provider_signature`（模型/provider 名/api_key/api_base/headers/extra_body/api_type/extra_query/region/profile/生成参数/proxy/thinking_style + 每个 fallback 的同构签名）比较决定（`factory.py:316-370`）。
- CLI 一次性命令（agent/serve/status 等）每次进程启动时加载，无热更新（未见 watcher 接线；依据：`watch_config_file` 全仓消费点仅 gateway_runtime.py:361,934）。

### 4.4 Schema 全表

根 `Config(BaseSettings)`（`schema.py:422-667`）。所有子模型继承 `Base`：`alias_generator=to_camel, populate_by_name=True` → **camelCase 与 snake_case 键都接受**（`config_base.py:12-15`）。

| 顶层 section | 类型 | 引用 |
|---|---|---|
| `agents` | `AgentsConfig{defaults: AgentDefaults}` | schema.py:187-190,427 |
| `channels` | `ChannelsConfig`（extra="allow"，插件渠道存 extra） | schema.py:23-39,428 |
| `transcription` | `TranscriptionConfig` | schema.py:42-50,429 |
| `providers` | `ProvidersConfig`（extra="allow" = 自定义 provider） | schema.py:240-323,430 |
| `api` | `ApiConfig` | schema.py:333-350,431 |
| `gateway` | `GatewayConfig` | schema.py:353-359,432 |
| `tools` | `ToolsConfig` | schema.py:384-419,433 |
| `modelPresets` | `dict[str, ModelPresetConfig]`（alias modelPresets/model_presets） | schema.py:434-438 |

**AgentDefaults**（schema.py:116-157）：

| 字段 | 类型/默认 | 行 |
|---|---|---|
| workspace | `"~/.nanobot/workspace"` | 119 |
| model_preset | `str\|None = None`（激活 preset，优先于下面的散装字段） | 120 |
| model | `"anthropic/claude-opus-4-5"` | 121 |
| provider | `"auto"`（或 registry 名） | 122-124 |
| max_tokens / context_window_tokens / temperature | 8192 / 200_000 / 0.1 | 125-127 |
| fallback_models | `list[str \| InlineFallbackConfig] = []` | 128 |
| max_tool_iterations | 200 | 129 |
| max_concurrent_subagents | 4 (ge=1) | 130 |
| max_tool_result_chars | 16_000 | 131 |
| provider_retry_mode | `"standard" \| "persistent"` | 132 |
| tool_hint_max_length | 40 (20..500, alias toolHintMaxLength) | 133-139 |
| reasoning_effort | `str\|None`（low/medium/high/xhigh/max/adaptive/none） | 140 |
| timezone / timezone_mode | "UTC" / "auto"（auto 时 before-validator 探测系统时区） | 141-142,159-184 |
| bot_name / bot_icon | "nanobot" / "🐈" | 143-144 |
| unified_session | False | 145 |
| disabled_skills | `list[str] = []` | 146 |
| session_ttl_minutes | 15（alias idleCompactAfterMinutes；0=禁用） | 147-152 |
| idle_compact_check_interval_seconds | 60 | 153-156 |
| dream | `DreamConfig{enabled=True, interval_h=2, cron=None, model_override=None}` | 157; 53-80 |

**ModelPresetConfig**（schema.py:97-113）：model、provider="auto"、max_tokens=8192、context_window_tokens=200_000、temperature=0.1、reasoning_effort=None；`to_generation_settings()`。preset 解析：`resolve_preset(name)`，None/"default" → 由 AgentDefaults 散装字段合成隐式 default preset（`schema.py:472-488`）；`"default"` 名字保留、引用不存在 preset 在根 validator 报错（454-470）。

**ProviderConfig**（schema.py:193-230）：display_name、api_key（repr=False）、api_base、api_type（auto/chat_completions/responses，**仅 providers.openai 允许非 auto**，validator 312-323）、extra_headers、extra_body、extra_query、proxy、thinking_style（枚举同 `_THINKING_STYLE_MAP`，validator 219-230；与 provider 模块解耦刻意复制，注释 210-212）。`BedrockProviderConfig` 加 region/profile（233-237）。

**ProvidersConfig**（schema.py:240-323）：`extra="allow"`；内置字段 44 个（249-294，与 registry 一一对应；openai_codex/xai_grok/github_copilot 三个 OAuth 字段 `exclude=True`，287-289）；extra 字段经 validator 转成 `ProviderConfig`，与内置名冲突直接报错（296-310）。

**其余 section**：
- ApiConfig：host="127.0.0.1"、port=8900、timeout=120.0、api_key=""；host 为 0.0.0.0/:: 时强制要求 api_key（333-350）。
- GatewayConfig：host="127.0.0.1"、port=18790、restart_mode(auto/exec/spawn/exit)、heartbeat{enabled=True, interval_s=1800}（353-359;326-330）。
- ChannelsConfig：send_progress=True、send_tool_hints=True、show_reasoning=True、extract_document_text=True(deprecated)、send_max_retries=3、transcription_provider/language(deprecated)；渠道插件配置放 extra（23-39）。
- TranscriptionConfig：enabled=True、provider、model、language、max_duration_sec=120、max_upload_mb=25（42-50）。
- ToolsConfig：web/exec/file/cli_apps/my/image_generation 六个子配置**惰性 import**（`_lazy_default` 377-381，类型经 `model_rebuild` 后解析 670-707——工具配置类住在工具实现旁，打破循环依赖）；max_session_messages_per_minute=6、restrict_to_workspace=False、webui_allow_local_service_access=True、webui_allow_remote_package_install=False、mcp_servers: dict[str,MCPServerConfig]、ssrf_whitelist: list[CIDR]（384-419）。
- MCPServerConfig：type(stdio/sse/streamableHttp，可省略自动探测)、auth("oauth")、command/args/env/cwd/url/headers、tool_timeout=30、enabled_tools=["*"]（362-374）。

---

## 5. Security 模型摘要

三层，全部**默认宽松、按需收紧**：

### 5.1 网络（nanobot/security/network.py — SSRF 防护）

- 黑名单网段：0.0.0.0/8、10/8、100.64/10（CGNAT）、127/8、169.254/16（云 metadata）、172.16/12、192.168/16、::/128、::1、fc00::/7、fe80::/10（16-28）；IPv4-mapped IPv6 先归一化（56-68）。
- `tools.ssrf_whitelist` CIDR 豁免（如 Tailscale 100.64/10），config 加载时注入全局（46-53；`loader.py:139-143`；`schema.py:419`）。
- `resolve_url_target`：仅 http/https（105-106）；DNS 解析后逐 IP 检查（132-143）；`allow_loopback` 收窄到「字面 loopback 主机名 + 全部解析结果都是 loopback」（84-89、333-344）；`trust_remote_dns` 供用户配置的可信 proxy 场景（本地名与私网字面量仍拦，91-94、116-130）。
- **DNS rebinding 防护**：`PinnedDNSAsyncTransport` 把请求钉在已验证 IP 上（264-288）；`pin_resolved_url_dns` 临时替换 `socket.getaddrinfo`（214-257）；重定向后复验 `validate_resolved_url`（291-320）；命令字符串中的 URL 扫描 `contains_internal_url`（323-330）。
- 消费方：web 工具、shell 工具、mcp、image_generation、skills_marketplace、channels 等（grep：`agent/tools/web.py`、`agent/tools/shell.py`、`agent/tools/mcp.py`、`providers/image_generation.py`、`webui/skills_marketplace.py`、`channels/validation.py`、`channels/slack/runtime.py`）。
- env proxy 感知：`env_proxy_applies_to_url`/`httpx_env_proxy_mounts`（154-211）。

### 5.2 Workspace 边界（应用级）

- `security/workspace_policy.py`：明言「application-level guards… not a replacement for an OS sandbox」（1-5）。`resolve_allowed_path(path, workspace, allowed_root, extra_allowed_roots, extra_allowed_files)`：解析后必须在允许根内，或精确等于白名单文件；越界抛 `WorkspaceBoundaryError`，错误消息附「硬边界勿重试」提示（13-17、96-128）。
- `security/workspace_access.py`：每回合的 `WorkspaceScope{project_path, access_mode: restricted|full, restrict_to_workspace, sandbox_status, source_channel}`（66-92）；ContextVar 传递（25-28、345-354）；只有 `websocket`（WebUI）渠道允许客户端按消息/会话元数据带 scope（111-116、128-165、321-342）；scope 校验：绝对路径、无 NUL、目录必须存在（250-288）。
- `WorkspaceSandboxStatus`：`level ∈ off|system|application`（168-209）。`restrict_to_workspace=False` → off；env `NANOBOT_WORKSPACE_SANDBOX_ENFORCED`（兼容 `NANOBOT_SANDBOX_ENFORCED`）+ `NANOBOT_WORKSPACE_SANDBOX_PROVIDER`（macos_app_sandbox/bwrap/seatbelt）→ system/enforced（189-199、396-411）；否则 application 级、enforced=False（201-209）。
- WebUI Full Access 才允许 loopback 访问：`current_scope_allows_loopback` 要求 websocket + full + 未限制（383-393）；对应 config `tools.webui_allow_local_service_access`（`schema.py:402-410`）。
- 工具消费：`current_tool_workspace` 给每次工具调用解析 project_path/restrict（357-380）；shell 工具把它接到路径检查与 cd 目标（`agent/tools/shell.py:410-411,424-450,846-902`）。

### 5.3 OS 沙箱（shell 执行，可选）

- `agent/tools/sandbox.py`：`wrap_command` 按 backend 包裹命令，`_BACKENDS = {"bwrap": _bwrap, "seatbelt": _seatbelt}`（309）。bwrap：`--new-session --die-with-parent`、HOME 指到 workspace、ro/rw bind（48-104）；seatbelt：`/usr/bin/sandbox-exec` + SBPL 策略，真实路径（非隔离 scratch fs），**网络不限制**（与 bwrap 一致，注释 106、205-206、184-306）。
- 配置面：`ExecToolConfig.sandbox: str = ""`（默认关）、`sandbox_ro_binds`/`sandbox_rw_binds`、`allowed_env_keys`（默认空 = 只透传基本 env）、`deny_patterns`（`shell.py:100-105`）；deny/allow 模式检查在执行前，allow 优先于 deny，链式命令逐段检查（`shell.py:812-831`）；Windows 不支持沙箱 → 警告后裸跑（456-460）。
- 默认值结论：`tools.restrict_to_workspace=False`（`schema.py:401`）+ `sandbox=""`（`shell.py:100`）→ **开箱无 OS 沙箱、无 workspace 限制**；仓库另有 `docker-compose.bwrap.yml`/`Dockerfile` 提供容器级部署（存在性事实，未精读，out of scope）。

---

## 6. CLI 命令面

### 6.1 入口

- `pyproject.toml:110-111`：`[project.scripts] nanobot = "nanobot.cli.entry:main"`；`python -m nanobot` 同入口（`nanobot/__main__.py:1-8`）。
- `entry.py:main`（71-100）是**低开销分发器**：无参数 → desktop target 分发（82-89）；`agent` 或以非根选项 flag 开头 → 只 import `cli.agent` 直接跑（23-31、59-68、90-96）；`agent` 且不带 `--classic/--no-tui/-m` → 原生 TUI 路径（34-45）。其余才 import 完整 typer app（98-100）。
- 完整 app：`commands.py:95-106` `typer.Typer(name="nanobot", invoke_without_command=True, no_args_is_help=False)`；根 callback 无子命令时回落 `_run_agent([])`（116-139）。

### 6.2 命令清单（实测存在）

| 命令 | 关键 flags | 作用 | 引用 |
|---|---|---|---|
| `agent` | `-m/--message`、`-s/--session`、`-w`、`-c`、`--markdown/--no-markdown`、`--logs`、`--classic`、`--theme auto\|dark\|light` | 终端聊天；无 -m 且非 --classic → 原生 TUI（需 tty）；--classic → 旧 REPL（AgentLoop+MessageBus+SessionManager+ToolRegistry+MCPProvider） | agent.py:54-80,86-118; commands.py:472 |
| `gateway` | callback: `-p`、`-w`、`-v`、`-c`、`--foreground`、`--background`；子命令 `status`/`logs --tail --follow`/`stop --timeout`/`restart` | 常驻网关（channels+cron+WebUI 后端）；共享 runtime `_run_gateway` | gateway.py:152-160,257-306; commands.py:451-464; gateway_runtime.py:340-409 |
| `webui` | `-p`、`--gateway-port`、`-w`、`-c`、`--background`(deprecated→gateway)、`--dev`(Vite)、`--no-open`、`-y/--yes` | 准备本地 WebUI + 起 gateway + 开浏览器；WS 端口默认 8765 | webui.py:73-99; webui_support.py:320-325; commands.py:443 |
| `serve` | `-p`、`-H/--host`、`-t/--timeout`、`-v`、`-w`、`-c` | OpenAI 兼容 API server `/v1/chat/completions`（aiohttp，插件 `api`）；非 loopback host 必须配 api.api_key | commands.py:350-436 |
| `status` | `-c`、`-w` | 打印 config/workspace/model 就绪状态；逐 provider 检查 key（OAuth 显示 ✓ (OAuth)，local 显示 api_base）；不触网 | commands.py:666-736 |
| `onboard` | `-w`、`-c`、`--wizard`、`--refresh` | 初始化 config+workspace（见 §6.3） | commands.py:147-239 |
| `trigger` | `trigger_id`、`message`(或 stdin)、`-w`、`-c` | 向绑定会话投递本地 trigger | commands.py:316-325 |
| `sessions restore-workspace` | — | 会话历史管理子 app | commands.py:480-485 |
| `channels status` / `channels login` | — | 渠道管理子 app | commands.py:518-552 |
| `plugins list/enable/disable` | — | 可选功能（extras+渠道插件）管理 | commands.py:586-639 |
| `provider login/logout` | login: `--set-main`、`--model`、`-c` | OAuth 登录（openai_codex/xai_grok/github_copilot），login 可顺带设为主模型 | provider.py:22,152-199,105-151,220-349; commands.py:743 |

- **`models` 命令不存在**：`cli/models.py` 是给 onboard 用的助手模块且已被 stub（「Model database / autocomplete is temporarily disabled while litellm is being replaced」，返回空表；`models.py:1-31`）。票面提到的 models 命令在当前上游没有对应物。
- gateway 进程形态：`--foreground`/`--background`/restart_mode（`schema.py:358`）、端口冲突检测（`gateway_runtime.py:389-402`）、健康检查 server（955-959）、本地客户端全断开后按需网关自停（924-930）。

### 6.3 onboard 流程逐步（commands.py:147-239 + onboard.py）

1. 解析 config 路径（`-c` → `set_config_path`，否则默认 `~/.nanobot/config.json`）（158-164）。
2. 文件已存在：`--wizard` → 直接载入；否则问「Overwrite?」——y=重置为默认并保存，N=refresh（load+save，保留旧值补新字段）；`--refresh` 跳过提问直接 refresh（173-198）。
3. 文件不存在：`Config()` 默认值；非 wizard 立即保存（199-204）。
4. `--wizard` → `run_onboard(initial_config)`（`onboard.py:2069-2121`）：deep-copy 出 original/config 双份（2087-2088）；主菜单循环 `[Q] Quick Start / [A] Advanced Settings / [S] Save and Exit / [X] Exit`（2006-2016，未保存变更时才显示 S/X 双项）；退出时有未保存变更则问 save/discard/resume（1983-2003）；返回 `OnboardResult{config, should_save}`（43-47），should_save=False 时命令层丢弃（commands.py:214-216）。
5. Quick Start（`onboard.py:1951-1972,1780-1869`）：选 provider（含 endpoint 变体选择）→ 需要 key 的输入 API key（必填，1810-1819）→ 输入 model ID（autocomplete，1840-1850）→ OAuth provider 走登录（1852-1854）→ 写入 provider_config.api_key/api_base + 设主 preset（1856-1868）→ 第二步启用 WebSocket 渠道并**强制设置 WebUI 密码**（1872-1898；WS 默认端口 8765，webui_support.py:325）→ 摘要 → 保存退出。
6. wizard 保存后（或跳过 wizard）：`_onboard_plugins` 把已发现渠道插件的默认 config 合并进 channels（`merge_missing_defaults` 不覆盖已有值，commands.py:242-266；loader.py:177-190）。
7. 创建 workspace + `sync_workspace_templates`（227-233）；打印 `✓ nanobot is ready. Run: nanobot webui`（235-239）。
8. 交互式输入原语基于 questionary + prompt_toolkit（`onboard.py:131-139,531-543`）；敏感字段掩码显示（339-352）。

---

## 7. TS 化设计票需要注意的坑/耦合点（标注：以下为分析）

1. **注册表顺序 = 语义**。`PROVIDERS` 元组的次序直接决定 keyword 冲突胜负与 fallback 优先级（`registry.py:9`、`schema.py:556-607`）。TS 侧必须保序（数组，不能是普通对象/Map 乱序序列化）。
2. **动态 custom provider** 依赖 pydantic `extra="allow"` + `model_extra` 遍历（`schema.py:247,296-310,509-516,609-612`）。TS 等价物是索引签名 + 与内置名冲突校验（302-307 的行为要保留：冲突报错而非静默覆盖）。
3. **双命名法**：一切配置键 camelCase/snake_case 都收（`config_base.py:12-15`），部分字段还有历史 alias（`AliasChoices`：`schema.py:66,137,150,404-409,412-416,436`）。TS schema（zod 等）需要显式 alias 层，序列化统一 by_alias→camelCase（`loader.py:157`）。
4. **ProviderSpec 是数据不是代码**：~35 个布尔/元组字段编码了各 provider 的 wire 怪癖（§1.3）。TS 化最大红利是这份表可整体平移；最大风险是消费点分散——thinking 注入、effort remap、strip、responses 路由散在 `_build_kwargs`/`_should_use_responses_api`/`_parse` 三处（`openai_compat_provider.py:928-1104,1106-1145,1542-1687`），移植时要连消费逻辑一起对照。
5. **死字段勿盲移**：`detect_by_key_prefix` 运行时无消费（§1.4）；`env_key` 仅转写路径用（§4.2）；`cli/models.py` 是 stub。照抄会把上游的历史包袱当成契约。
6. **env 语义要显式化**：上游「有文件时 `NANOBOT_*` env 不生效」是 pydantic-settings 调用方式的副作用（§4.1 推断），并非明确设计承诺；TS 版应显式定义 file/env/`${VAR}` 三者优先级并写测试。
7. **热更新契约**：watcher → invalidate → signature diff → 惰性重建 provider（§4.3）。signature 是位置敏感的异构 tuple（`factory.py:351-370`），TS 侧建议改为结构化对象深比较，但**必须覆盖 fallback 链的每一环**（369）。
8. **重试集中化**：所有 SDK 客户端 `max_retries=0`，重试/429 分类/欠费识别全在基类词表（`base.py:626-693`；`fallback_provider.py:672-712`）。TS 版若用官方 SDK，必须同样关掉 SDK 重试，否则重试放大（`anthropic_provider.py:110` 注释明言）。
9. **Langfuse 挂钩是全局符号替换**（`openai_compat_provider.py:621-632`），依赖 Python import 机制；TS 需要替代注入点（构造时传 client 工厂或 OpenTelemetry instrumentation），这是接口必须变化的点。
10. **流式健壮性细节**：逐 chunk idle timeout（90s 默认）、无 finish_reason 视为断流、zhipu tool_stream、stream_options.include_usage、Mistral 块状 content 剥离（§2.3）——每条都对应真实上游 bug，TS 移植清单里应逐条落测试。
11. **security 是「状态注入 + 调用点自觉」**：SSRF 白名单经 config 加载副作用写全局（`loader.py:139-143`）、workspace scope 走 ContextVar（`workspace_access.py:25-28`）。TS 侧对应 AsyncLocalStorage + 显式初始化，避免隐式全局。
12. **沙箱是可插拔 backend 表**（`{"bwrap","seatbelt"}`，`sandbox.py:309`），且 seatbelt/bwrap 都不管网络；网络管控完全靠 SSRF 层。TS 化若目标环境无 bwrap/seatbelt，需要定义降级语义（上游 Windows 的降级是「警告后裸跑」，`shell.py:456-460`）。
13. **CLI 分层**：entry.py 的「不 import 完整命令图」启动优化（`entry.py:59-96`）+ desktop target 分发 + 无参默认进 agent/TUI（`commands.py:100-106,136-139`）。TS 版（如 commander/yargs）要保留：裸 `nanobot` = agent、flag 前缀 = agent 别名、补全脚本走根命令（`entry.py:74-79`）。
14. **OAuth provider 的 config 落盘规则特殊**：字段 `exclude=True`、save 时只回写 proxy/extra_body（`schema.py:287-289`；`loader.py:157-171`），token 存在独立 store（`provider.py` login/logout 删除 token 文件，`provider.py:323-349`）。TS 版序列化层需要同等「白名单回写」能力。
