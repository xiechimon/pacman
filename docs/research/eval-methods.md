# eval-methods — agent / LLM 评测方法论与市面做法

- 性质：方法论调研，不是研究票产物（仓内 `r<N>-*.md` 是按研究票编号的，这份不是）。无实施计划。
- 对象：① 评测方法论本身；② pi（`@earendil-works/pi-*`，pacman daemon 内嵌的 agent runtime）在评测上的做法；③ 市面做法（2026-09 现状）。
- 抓取日期：2026-09-30（分数、版本号均以该日抓到的页面为准）。联网通道 `agent-reach`（`web` = Jina Reader、`exa_search`、`github` = gh CLI）。
- 标记约定：`measured` = 亲手读到代码/抓到原文核过；`inferred` = 由原文或代码推导；`guess` = 无一手证据。`[一手]` / `[二手]` 标注来源性质。
- 引用约定：pi 结论引用本地已安装包（0.86.0）；路径把 `node_modules/.pnpm/@earendil-works+<pkg>@<ver>_<peerhash>/node_modules/@earendil-works/<pkg>/` 缩写成 `~pi-<pkg>/`。
- 入库标注（2026-10-03）：S7.9 / S8 引用的 `apps/daemon/src/backend/pi.ts` 行号为 2026-09-30 基线；#657（relay protocol-400 自适配）落地后整体后移（`stopReason` 声明现于 :313，message_end 分支现于 :418-422，`toMessageRecord` 现于 :348-355）。所述行为已于 2026-10-03 逐条复核仍成立；`integration/eval/chief-dispatch/run-eval.mts:121` 未漂移；pi 三包仍钉 0.86.0。

---

## S0 结论速览

1. 评测不是"一个分数"，是一台装置：**反复问同一个问题、自动判对错**，好让"改动后到底变好还是变坏"变成可看的数。装置只有三个零件：**任务 / 裁判 / 重复**。`measured`
2. 骨架在全球已收敛成**四段式**：数据集 → 执行器（跑 trial）→ 裁判（code / model / human）→ 聚合。八家 harness 与三家厂商文档在这个骨架上高度同构，差异全在**裁判形态**与**聚合统计的严谨度**。`measured`
3. 最承重的单条原则：**判环境终态，不判它说的话**（outcome）。transcript 是叙述，环境才是答案。`measured`
4. 最大的两处分歧：**聚合统计**（只有 Inspect AI 把置信区间做成一等公民 API）与**判据来源**（Anthropic 人定题 / Google 逐题生成 adaptive rubrics / OpenAI 平台 API 化 grader）。`measured`
5. 主流 agent benchmark 处于**可信度危机**：Berkeley RDI 对 8 个榜单打出 73%–100% 可利用度；OpenAI 公开停报 SWE-bench Verified（138 题审计 59.4% 有实质缺陷）。根因全在判分那一格。`measured`
6. 判分器必须按"**能否被绕过**"来设计——问的不是"它判不判得对"，而是"通过它是否真的必须解题"。`measured`（原则）/ `inferred`（推论）
7. **pi 有自己的评测包 `packages/evals`**（`@earendil-works/pi-evals`，`private: true` 未发 npm）：host evals + documentation-lift evals（成对 A/B 报 lift）。**本地安装的三个 pi 包不含它——只查 `node_modules/` 会得出"pi 不做评测"的错误结论**（本次首轮侦察即栽在这里）。`measured`
8. pi **有** `stopReason`（7 态 + `rawStopReason` + `responseModel`）；pacman 的 `metrics.md` 记的"缺 finish_reason"是**宿主侧投影丢弃**，不是上游缺失。`measured`

---

## S1 骨架：四段式

```
数据集 ──→ 执行器（跑 trial）──→ 裁判 ──→ 聚合
              │                    │          │
         agent harness         code/model/human   metric + 阈值 + 报告
         + 模型
              │
       留下 transcript（它说了什么）+ 环境终态（世界被改成什么样）
```

词汇表（Anthropic 工程长文口径，见 [[Demystifying Evals for AI Agents]]）：**task**（输入 + 成功标准）→ 多次尝试为 **trial** → **grader** 给某个方面打分（一个 task 可挂多个 grader）→ **transcript / trace / trajectory** 是 trial 的完整记录 → **outcome = 环境终态** → **evaluation harness** 端到端跑 → **evaluation suite** 是共享大目标的一组 task。

四条主线从这四段长出来：

| 主线 | 要点 |
|---|---|
| 标尺怎么立 | 任务镜像生产；更强模型必涨分；前沿留 headroom 但差距不能来自歧义题；跑分间低方差（环境残留会把答案递给 agent） |
| 判什么 | outcome 优先；只判结果无法定位失败步骤 → 另开过程通道 |
| 谁来判 | code → model → human，按"最便宜够用"选；裁判不能是被测模型 |
| 判几次、怎么读 | 一次不算数；pass@k vs pass^k 在 k 大时讲相反的故事 |

`measured`（[[Demystifying Evals for AI Agents]]、[[Anthropic Eval 与 Hillclimb]]，本次已与一手源核对一致）

---

## S2 市面 harness 与平台

### S2.1 八家的核心抽象（均为一手文档）

| 项目 | 任务单位 | 裁判形态 | 轨迹/过程判分 | 置信区间叙事 |
|---|---|---|---|---|
| **Inspect AI**（UK AISI） | `Sample`（input/choices/target/sandbox）；单元 `Task(dataset, solver, scorer, metrics)` | 四类 scorer：启发式抽取 / 文本相似度 / 模型判定 / 另一套 rubric；`multi_scorer()` 组合；人类以 Human Agent / Intervention 存在 | 内置 ReAct / Deep Agent / inspect_swe（跑 Claude Code、Codex CLI）/ Agent Bridge | **有，且最完整**：`ci()`、`ci_wilson()`、`bootstrap_stderr()`、`stderr(cluster=)`、`krippendorff_alpha()` |
| **promptfoo** | YAML test case（`vars` + `assert` 列表），`assert-set` 支持 AND / threshold 后 OR | 确定性指标 + 模型辅助（`llm-rubric` / factuality / answer-relevance / select-best / classifiers） | 有：确定性 `trajectory:tool-used` / `tool-args-match` / `tool-sequence`，模型判 `trajectory:goal-success`（`not-` 前缀判"禁止达成"，且 judge 传输/解析失败仍计失败，避免坏裁判被静默读成通过） | 文档阴性 |
| **DeepEval** | `LLMTestCase` / `EvaluationDataset` 的 `Golden`；四种用法（端到端 / 轨迹级 / 组件级 / 一次性） | 50+ 指标，多数 LLM-as-judge（G-Eval / DAG / QAG）；`JevEval` 用 decision model 打校准概率；`strict_mode` 转二值，`flaky=True` 让噪声指标不参与 pass/fail | 有：TaskCompletion / StepEfficiency / PlanAdherence / PlanQuality / ToolCorrectness / ArgumentCorrectness | 文档阴性 |
| **Braintrust** | Data（examples）/ Task / Evaluators 三段式；playground → experiment（不可变快照）→ CI | `autoevals` + LLM-as-judge + 自定义代码；judge 选型纪律明写"先看多出来的 reasoning 是否真把与人的一致度提高到值得付延迟和成本" | 有（remote evals / sandboxes；online scoring 评 trace） | 文档阴性 |
| **LangSmith** | dataset examples（inputs + reference outputs）离线 / 生产 run 在线两轨 | 五类：human（annotation queue + assertions）/ code / LLM-as-judge / **decision model**（SemIf 或 Jev，typed questions 各自成为独立 feedback）/ pairwise；dataset 支持 splits（含 train/val/test 切分） | 开源包 `agentevals`：`strict` / `unordered` / `subset` / `superset` 四种确定性轨迹匹配 + LLM 裁判 | 文档阴性（全文检索 `confidence interval` 命中为零） |
| **Langfuse** | 在线 trace / 离线 dataset 两轨 | LLM-as-judge、**Jev as a judge**（experimental）、code evaluators、annotation queue、user feedback | — | 只做裁判一致性分析（混淆矩阵 + Cohen's Kappa + F1 + Pearson + Kappa 分档解释） |
| **Arize Phoenix / AX** | — | **`Score` 对象**统一三类裁判：必填 `name` / `kind`（llm/code/human）/ `direction`；特色是 structured output via tool calling——强制裁判调用工具而非自由文本 | 有：Tool Selection / Tool Invocation / Tool Response Handling + `evaluate_path_length`（收敛评估，`avg(minimum steps / steps taken)`） | 文档阴性 |
| **Harbor** | `Task`（instruction + 沙箱 + verifier）/ `Dataset` = 一个 benchmark / `Trial` / `Job` | verifier 是 `tests/test.sh`，**必须写 `/logs/verifier/reward.txt` 或 `reward.json`**；官方明说可在此实现任何验证方式含 LLM/agent judge；RewardKit 提供 programmatic + judge-based 两类 criteria；separate verifier environment 改善 agent 与 verifier 的安全边界（且只有独立 verifier 才能对已跑 trial regrade） | 自定 ATIF（Agent Trajectory Interchange Format），v1.8，目标是一份表示跨 agent 通用 | 文档阴性（只有聚合逻辑：默认对 reward 取均值，缺 reward 与缺维度均按 0 计） |

`measured`（各格来源见附录 B）

**生态收敛的实测证据**：Inspect 的 eval 注册表渲染出 162 条记录，其中 86 条标 `inspect_harbor`、76 条标 `inspect_evals`——AISI 的 harness 直接把 Harbor registry 里的 benchmark 当自家评测跑。`measured` `[一手] https://inspect.aisi.org.uk/evals/index.html`

### S2.2 三家厂商的取向差异

| 维度 | Anthropic | OpenAI | Google |
|---|---|---|---|
| 判据来源 | 人定题，rubric 逐条可核对；任务判据 = "两个领域专家独立看会不会给出同一个 pass/fail" | 平台 API 化 grader（JSON：string check / text similarity / score_model / python），返回 0-1 支持部分分；用专家答案调 grader | adaptive rubrics：**为每条 prompt 现场生成 pass/fail 判据再验证**，文档标 recommended |
| 过程/轨迹判分 | transcript 可再判（code heuristics + 模型裁判评工具调用与协作） | trace grading 曾为产品能力 | ADK 成体系 criteria：`tool_trajectory_avg_score` / `rubric_based_tool_use_quality_v1` / `multi_turn_*` 等 |
| 会话与用户模拟 | 对话 agent 章节给出做法 | 未找到公开一手细节 | user simulation + environment simulation（拦工具调用注入 mock / 503 / 延迟尖峰）是产品能力 |
| 统计口径 | pass@k vs pass^k 明确选型；要求报置信区间 | 连续 0-1 分 + pass_threshold | 聚合 pass rate + 逐条判据明细 |
| 公开资产 | 工程博客 + 方法论 | 论文级 benchmark repo（PaperBench / SWE-Lancer / EVMbench） | eval_hub（README 只有一行）+ skill |

`measured`（每格有 S2.1 / 附录 B 的一手来源支撑；"未找到"是检索阴性）

**OpenAI 在退，不是进**：Evals 与 Agent Builder 产品 **2026-11-30 起下线**，graders API 同步弃用，`simple-evals` 自 2025-07 冻结。`measured` `[一手] https://openai.com/index/introducing-agentkit/`

**2026 年新出现且跨平台一致的东西**：decision model 当裁判。TypeSafe 的 Jev（返回带概率的 typed answer，不生成文本）同时出现在 Langfuse、LangSmith、DeepEval 三家官方文档里，定位一致——便宜、快、确定性、可校准，用来替掉"自由文本打分"那一段。`measured`

---

## S3 统计口径

### S3.1 pass@k vs pass^k

- **pass@k** 出处：HumanEval，NeurIPS 2019。k 次 i.i.d. 试验中**至少一次**成功。
- **pass^k** 出处：τ-bench，arXiv 2406.12045。k 次**全部**成功；无偏估计式 `pass^k = E_task[C(c,k)/C(n,k)]`。
- k=1 时两者相同；k=10 时 pass@k 趋 100% 而 pass^k 趋 0%。选型：一次成功就值钱的工具用 pass@k；要求每次都靠谱的面向用户 agent 用 pass^k。`measured`

**口径不一致（引用必须注明来源）**：Anthropic 博客把 pass^k 写成 `p^k`（独立性假设），τ-bench 原文用有限样本无偏估计 `C(c,k)/C(n,k)`；每 task 多 trial 且 n≥k 时两者**不相等**。`inferred`（两处原文均已读到）

### S3.2 置信区间方法学：无共识，按 N 分档

| 立场 | 出处 | 主张 |
|---|---|---|
| A（大 N） | Evan Miller，arXiv 2411.00640 | super-population 框架；naive SE = `sqrt(Var(s)/n)`，二值退化为 `sqrt(p(1-p)/n)`；题干共享 passage / 同题多语言时**必须用 clustered SE**；**bootstrap 不必要**；同题重复采样 K 次降方差上限 2/3；配对分析必须同时报跨模型相关系数才可复算 |
| B（小 N） | Bowyer 等，ICML 2025 Spotlight Position，arXiv 2503.01747 | N 十几到几十时 **CLT 区间校准极差**，甚至延伸到 [0,1] 之外或塌缩到零；只有 **Bayesian credible interval 与 Wilson CI** 覆盖率正确；CLT 与 bootstrap 覆盖率都远低于名义值；聚类场景同样失败 |

**不要把任一方当普适结论**：两者针对不同 N。bootstrap 在两方那里都被判为"不必要"或"最差之一"。`measured`

**未找到**：pass^k 的置信区间没有专门一手论文（τ-bench 与 TRAIL 都只给点估计）；"步骤效率"的统计显著性检验亦未见一手方案。`measured`（检索阴性）

---

## S4 裁判可靠性（LLM-as-judge）

- **基础（MT-Bench，arXiv 2306.05685）**：GPT-4 judge 与人类专家 agreement 85%（setup S2 无 tie），高于人类彼此 81%。**口径警告**：agreement 定义是"各随机取一人、在随机一题上投票一致的概率"，人类-human agreement 因此是偏低估计。**引用 85% 必须带 S2 与该定义，否则高估。** `measured`
- **位置偏差**：GPT-4 zero-shot 换序一致性 65.0%（偏第一个 30.0%）、Claude-v1 23.8%（偏前 75.0%）；few-shot 把 GPT-4 拉到 77.5%，但原文强调 "high consistency may not imply high accuracy"。系统量化见 arXiv 2406.07791（15 judge / 15 万+ 实例）：位置偏差**不是随机波动**，偏好方向在同一 judge 不同 task 间高度波动。`measured`
- **自偏好**：GPT-4 +10%、Claude-v1 +25% win rate；根因假设是**困惑度**——对低困惑度输出给分更高，无论是否自己生成（arXiv 2410.21819）。更严谨版引入 gold judgments 作质量代理（arXiv 2506.02592）。`measured`
- **rubric vs Likert**：CheckEval（arXiv 2403.18771）把低一致性归因于 "subjective evaluation criteria combined with Likert scale scoring"，改用**分解的二元 checklist** 后跨 12 个 evaluator model 平均 agreement 提升 0.45。`measured`
- **反向证据（推翻"pairwise 更稳"）**：arXiv 2504.14716（COLM 2025）——pairwise 偏好可被嵌入的 distractor feature 翻转**约 35%**，绝对打分仅约 9%。`measured`
- **jury / panel**：PoLL（arXiv 2404.18796）用 3 个**不同模型家族**的小模型组 panel，与人类相关性优于单个大 judge 且便宜 7 倍以上。`measured`
- **落地形态是"校准"而不是"共识算法"**：Langfuse 给 Cohen's Kappa 等一致性指标与校准工作流，Arize 把 "align evaluators" 列为独立步骤，Anthropic 要求"先读一批已打分的 transcript 再相信评测器"。`measured`

---

## S5 过程 / 轨迹评测

### S5.1 已商品化（五家均有官方一手文档）

判据收敛成六类可操作的量：**工具选择/参数、轨迹序列匹配、步骤效率、计划质量、目标推进、承重步骤定位**。`measured`

- `agentevals`（LangChain，MIT）：`strict` / `unordered` / `subset` / `superset`。**subset / superset 这对正是"步骤效率"与"最小充分步骤"的可操作判据。**
- promptfoo：确定性 `trajectory:tool-*` + 模型判 `trajectory:goal-success`。
- DeepEval：`ToolCorrectnessMetric`（集合比对 + "是否最优工具"取最小值）、`StepEfficiency`、`PlanAdherence`、`PlanQuality`。
- Arize AX：按 trace 聚 tool-calling span → 取有序工具调用列表 → LLM judge 判 correct/incorrect。理由原文："即使最终答案对，糟糕的步骤序列也会浪费时间、钱或把用户暴露在风险里"。
- Google ADK：`tool_trajectory_avg_score`（精确匹配，默认阈值 1.0）/ `rubric_based_tool_use_quality_v1` / `multi_turn_trajectory_quality_v1` 等。

**基建已标准化到 OpenTelemetry**：`gen_ai.operation.name` 的 well-known values 含 `create_agent` / `invoke_agent` / `execute_tool` / **`plan`**（规划阶段本身被建模成一个 operation）；但这些 agent/tool 约定当前标 **Development（非 Stable）**。`measured`

### S5.2 承重步骤定位仍是难题

- **TRAIL**（Patronus AI，arXiv 2505.08638，MIT）：148 条人工标注 trace / 1987 个 OTel span，575 个至少含一个错误。**最好的 Gemini-2.5-pro 只有 11%**。`measured`
- **AgentRx**（Microsoft，arXiv 2602.02475，EMNLP Findings 2026）：人工基准 170 条失败轨迹、每条标一个 critical failure step。方法链 `Raw logs → Trajectory IR → Invariants → Checker → Judge → Reports`（合成约束 → 逐步核验 → 可审计违规日志 → LLM judge 定位）。step localization 相对 prior work 平均提升 **75%**。需 Azure/TRAPI 凭据，不是纯本地。`measured`
- **AgentProcessBench**（arXiv 2603.14465）：1000 条轨迹 / 8509 个人工标注 step / IAA 89.1%；ternary labeling。结论之一：弱 policy model 因**提前终止**呈现虚高的"正确步比例"。动机原文值得记："tool-use failures frequently induce irreversible side effects"——工具调用失败常产生不可逆副作用，所以逐步核验比数学推理里的回退更关键。`measured`
- **Agent-as-a-Judge**（Meta/KAUST，arXiv 2410.10934）：用 agentic 系统评测 agentic 系统；与人类共识对齐 90% vs LLM-as-a-Judge 70%；相对三名人类专家省 97.7% 时间 / 97.6% 成本。**组件消融最有价值**：仅 ask 65.03% → +graph 75.95% → +read 82.24% → +locate 90.44%；再加 search 反而降到 86.06%。即**直接读文件内容 + 定位相关文件是承重能力**。`measured`

### S5.3 reward hacking 检测（2026 新）

- **Reward Hacking Benchmark**（arXiv 2605.02964，ICML 2026）：多步工具任务里埋"自然主义捷径"（跳过验证步、从邻近 metadata 反推答案、篡改评测相关函数）。13 个前沿模型 exploit rate 0%（Claude Sonnet 4.5）～13.9%（DeepSeek-R1-Zero）。**72% 的 reward hacking 片段带显式 CoT 理由**（模型常把 exploit 框定为合法解题）。简单环境加固把 exploit rate 降 5.7 个百分点（相对降 87.7%）且不损任务成功率。`measured`
- **METR** 点名两种检测方法："high-scoring heuristic" 与 LLM "monitor"；任务级 reward hack 计数 RE-Bench 30.4% / HCAST 0.7%。`measured`

---

## S6 benchmark 可信度危机

### S6.1 判分可被直接绕过（Berkeley RDI，`[一手]` 但属自测，未见独立复现）

对 8 个榜单打出 **73%–100%** 可利用度：`measured`

| 榜单 | 攻击 | 根因 |
|---|---|---|
| SWE-bench Verified / Pro | 10 行 `conftest.py`（pytest hook 把每个测试结果改写成 passed）→ Verified 500/500、Pro 731/731 满分 | patch 与测试跑在同一容器 |
| Terminal-Bench 2.0 | 89 题中 82 题在验证时 `curl` 装 `uv`；agent 阶段把 `/usr/bin/curl` 换成 wrapper，验证阶段木马化 `uvx`，探测到 pytest 就输出伪造 "3 passed" | Harbor 默认 `allow_internet=true` 且无任务覆盖 |
| WebArena | `goto file:///proc/self/cwd/config_files/{task_id}.json` 读出 gold 答案，812 题约 100% 满分且不改一行代码 | 任务 config 带参考答案落本地文件系统，Playwright 从未禁 `file://` |
| OSWorld | gold 参考文件托管在任务配置内嵌的公开 HuggingFace URL，VM 有不受限外网，agent 直接 wget 形成 gold-vs-gold 比对 | 判分器对来自 VM 的字符串调用 `eval()` |
| GAIA | `normalize_str` 去掉全部空白与标点 → `"D.R M.A.R.T.I.N L.U.T.H.E.R K.I.N.G J.R"` 与 `"Dr. Martin Luther King Jr."` 归一化后相同判满分；100% 分有拦截，但每题故意漏答一题即可约 98% 绕过 | 归一化过宽 + 拦截条件写成 `if all scores == 1.0` |

### S6.2 OpenAI 停报 SWE-bench Verified（分量最重的一手）

对 138 道"o3 跑 64 次仍不稳定解出"的题做审计（每题至少 6 名资深工程师独立复核），**59.4% 存在实质缺陷**：35.5% narrow test（钉死实现细节、误杀功能正确的解）、18.8% wide test（检查了题面没说的额外功能）、5.1% 其他。并用自动化红队证明 GPT-5.2 / Claude Opus 4.5 / Gemini 3 Flash 都能被诱导**逐字复现 gold patch**。结论：Verified 的进步越来越反映训练期曝光度而非工程能力，公开建议改报 SWE-bench Pro。`measured` `[一手] https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/`

### S6.3 污染与饱和

- SWE-bench Illusion（arXiv 2506.12286）：只给 issue 描述、不给仓库结构，让模型猜问题文件路径——SoTA 在 Verified 上最高 76%，在非 SWE-bench 仓库上仅 ≤53%。`measured`
- SWE-bench Pro（Scale AI）三集设计动机明写：数据污染、任务多样性不足、问题过度简化、评测不可复现；头部模型 public set 约 23%、private 14.9–17.8%，而同一批模型在 Verified 上 70%+。`measured`
- 榜单普遍饱和：Verified 榜首 79.20%、Terminal-Bench 2.0 榜首 58.2% ± 2.8%（2026-09-30 抓取）。`measured`
- **跨 harness 分数可比性未决**：`SWE-bench/experiments` issue #462 指出 `metadata.yaml` 不记 harness 版本/镜像，而榜单条目跨约两年；**不应默认可比**。`measured`
- τ-bench 判分方差（官方仓 issue #57，第三方分析非 Sierra 口径）：43%–64% 的任务在同一系统自己的多次 trial 之间结果翻转；ICC(1) 仅 0.41–0.53；airline 域 n=50、power .80 的**最小可检测差异 23.77pp**，而已发布 airline 榜全榜跨度只有 23.5pp——**单次运行几乎分不开榜首与榜尾**。`measured`

**教益不是"benchmark 不可信"**，是判分器要按"能否被绕过"设计。设计裁判时该问的是：**通过它是否真的必须解题。**`inferred`

---

## S7 pi（pacman 的 agent runtime）在评测上的做法

一手源分两层：① 本地已安装的 pi 0.86.0 bundled types + 包内 `docs/` / `examples/` / `README.md`；② 上游 monorepo `earendil-works/pi` 的 `packages/evals`（经 `gh` 读源码，见附录 B）。

**先记一条方法教训**：`packages/evals` 是 `private: true`，**不发 npm**，所以它不在本地 `node_modules/` 里。只查已安装依赖会得出"pi 不做评测"的错误结论——本次首轮侦察正是这么栽的。查一个项目的实践，装好的包不等于它的全部。

1. **pi 有独立的评测包 `packages/evals`**（`@earendil-works/pi-evals`，README 自称 "Behavioral evals for Pi's coding agent, built with `vitest-evals`"）。依赖 `vitest-evals` 0.15.0 + `@vitest-evals/core` + Braintrust 的 `autoevals` 0.3.0。脚本分两条：`eval:host`（vitest 跑本机）与 `eval:docs`（Docker 成对比较）。`measured`（`packages/evals/package.json`、`README.md`）
2. **两类 eval**：`*.docs.eval.ts` 是 **documentation-lift eval**——每条用例在隔离的 `without_docs` 与 `with_docs` 两个容器里各跑一次，**报 lift**；其余 `*.eval.ts` 是 host eval，普通 vitest-evals 套件，不做成对比较。`measured`（`README.md`「File conventions」）
3. **docs-lift runner 的执行纪律**（README 逐条列，是这套东西最值得抄的部分）：
   1. 一次性挂载仓库做 Docker build，用仓内的 consumer-install 机制打包 workspace 包，再从 staged runtime 建两个镜像
   2. **在两个镜像里各自发现选中的用例，并要求 cohort 完全一致**（防止一侧少跑几条而显得 lift 很高）
   3. 执行前先**规划出每一个 `(case, variant, model, runNumber)` 臂**
   4. 每个臂在**全新容器**里跑；失败或缺失的臂**记录下来，其余 cohort 继续**
   5. 从 Vitest 原生 JSON 读结果，**精确配对**（pair exact arms）后算 lift
   6. **blocked pairs 会扣住头条 lift，进程以非零码退出**——不让缺失臂把头条分刷高
   7. **重复顺序按 run number 交替，以降低顺序偏置**
   `measured`（`README.md`「The runner」）
4. **判据形态**：host eval 用普通 `expect`——精确输出（`toBe("Paris")`）、`errors` 必须为空、`usage` 必须匹配 `PI_PROVIDER`/`PI_MODEL`、`totalTokens > 0`；开放处用 `createJudge`（vitest-evals 的 LLM 裁判）与 `autoevals` 的 `Levenshtein`。harness 是 `createPiCodingAgentHarness({ noTools: "all" })`，即**对工具面做脚本化控制**。`measured`（`evals/smoke.eval.ts`、`evals/tui.docs.eval.ts`）
5. **另有测试替身 `fauxProvider()`**（pi-ai 层，公共导出）：脚本化内存 provider，`setResponses([...])` 按序应答、`state.callCount`、`tokensPerSecond`、多模型用于切换测试。用途是"不起真模型驱一个回合"，不是评测框架。`measured`（`~pi-ai/dist/providers/faux.d.ts:1-100`、`README.md:1252-1330`）
6. `pi-agent-core` 的 `conformance/` 与 `benchmark/` 目录，领域是**会话存储后端契约**（`createStorageConformance` / `STORAGE_BENCHMARK_DATASETS`），不是 agent 行为。`measured`
7. pi 官方另把"evaluation research"的出口指向外部仓 `badlogic/pi-share-hf`（把 session 发到 Hugging Face datasets）。`measured`（`~pi-coding-agent/docs/usage.md:142`）
8. **`stopReason` 是有的，而且比 `finish_reason` 更全**：

```ts
// ~pi-ai/dist/types.d.ts:292
export type StopReason = "pending" | "stop" | "length" | "toolUse" | "error" | "aborted" | "deferred";
```

挂在 `AssistantMessage.stopReason`（`:365`），另附 `rawStopReason`（provider 原值，`:368`）、`responseModel`（上游实际回的模型，`:359`）、`endTurn`（`:369`）。会持久化进 session JSONL，遥测里是一等属性 `pi.ai.response.stop_reason`。`measured`

9. **pacman 侧是宿主投影丢弃**（不是上游缺失）：`PiMessageLike` 声明了 `stopReason?: string`（`apps/daemon/src/backend/pi.ts:216`），但 `message_end` 分支只认 `'aborted'` 与 `'error'`（`pi.ts:321-329`），`'length'` 落进通用路径；`toMessageRecord` 又把载荷裁成 `{role, content}`（`pi.ts:251-258`）。harness 因此合成 `stop_reason`（`integration/eval/chief-dispatch/run-eval.mts:121`）。`measured`（本次逐行复核）
10. **两条并存的事件路径**：pacman 用的 `AgentSession`（约 15 型事件 + extensions hooks）；上游另有更完整的 `AgentHarness`（约 30 型事件 + 12 个强类型 hook + 事件总线 + OTel 式遥测 schema，60+ 属性含 `pi.ai.response.stop_reason`），但 pi-coding-agent 自己没用它。`measured`
11. **`agent_end` ≠ 回合结束**：pi 之后还可能 auto-retry / auto-compact / 消费排队 follow-up；正确信号是 extensions 的 `agent_settled`（原文："Use `agent_settled` for status integrations that need to know Pi will not continue running automatically."）。`measured`

---

## S8 与 pacman chief-dispatch 的对照（方法论层）

`integration/eval/chief-dispatch/` 那一套是教科书式的 **outcome 通道**：

| 方法论要求 | pacman 现状 |
|---|---|
| 判环境终态不判叙述 | 判 `todo.assignment.build.agentId`，读 drizzle 不读 transcript（`grade.mts:26,39-63`） |
| 裁判先验证再花钱 | `oracle-check.mts` 喂 oracle（必过）/ null（必挂）/ misroute（必挂）三种构造回合过真判分函数，零成本 |
| 低方差 = 隔离环境 | 每例全新栈 + 全新 home / skills 根 / 机器注册（`stack.mts:142-231`） |
| 基础设施噪音不能伪装成模型波动 | `dead = 零 token 或 step != done` → 落 `errors.jsonl` 不计分（`run-eval.mts:104-110`） |
| harness 改动要有人看 diff | `harness_sha` 门，不符 exit 2，`--approve-harness` 放行（`run-eval.mts:227-269`） |

方法论地图上缺的两格：

1. **只有 outcome 通道，没有过程通道**。失败只有两类形态（名字/id 错位、该派未派），因为 outcome 分把"抽样错 / 分类错 / 算术错 / 某一步前提没测"压成了同一个 0。`metrics.md` 记的"已饱和、测不出改进"与 TRACES 说的"标量把五种成因压成一个数字"是同一个病。
2. **capability 轨与 regression 轨没分开**。`metrics.md` 已意识到该转回归门，但套件里没有独立的 capability 轨。

一处**记录有误**需要勘正：`metrics.md:138-142` 的缺口① 写"pacman 目前不上报模型的 `finish_reason`，runner 只能用征兆当截断特征"。实际上游有更全的字段（本页 S7.8），是宿主投影丢弃（S7.9）。

---

## 附录 A：存疑与未核验（引用前须复核）

1. **τ-bench 细分分数** `pass^1 ≈ 61%（retail）/ ≈ 35%（airline）` 只见于搜索结果抽取片段，原文（v5 HTML 与 PDF）经 Jina 都只返约 1.8KB 抓取失败；摘要级数字（`<50%`、`pass^8 <25% in retail`）已直接核对。`inferred`
2. **pass^k 口径不一致**：Anthropic 用 `p^k`，τ-bench 用 `C(c,k)/C(n,k)`，n 有限时不等——引用必须注明来源。（本页 S3.1 已标注）
3. **CI 方法**：Miller 与 Bowyer 是两个对立阵营且针对不同 N，不要把任一方当普适结论。
4. **Berkeley RDI 的 73%–100% 可利用度**是自建扫描 agent 的自测，未见独立复现；OSWorld 与 GAIA 的数字同源，交叉印证弱。
5. **H2O.ai "约 5% GAIA ground truth 有误"** 是参赛厂商单方声明，未见 GAIA 作者确认。
6. **Epoch AI "约 10% 任务有严重错误"** 与官方 issue #177 的"32/369 ≈ 9% infeasible"**不是同一口径**，不要混用。
7. **未核验、不要引用**：arXiv 2609.11028（BenchShield）、2609.19101。SAJA（ACL 2026 Industry）只返回校对模板，仅标题可用。
8. **Harbor 是否有置信区间功能未证实**（文档阴性）；其指标口径取自仓库内 `docs-mintlify` mdx 源码而非渲染页。
9. **Anthropic `Demystifying evals` 附录的框架名单**（Harbor / Braintrust / LangSmith / Langfuse / Arize）是 2026-01-09 快照，**不含** Inspect AI / promptfoo / DeepEval——厂商视角与社区视角不同。

**抓取失败清单**（本次）：huggingface.co 全域被 Jina 匿名封禁（403）→ GAIA 当前榜分与 TB2.0 / CORE-Bench 数据集卡未取得；τ-bench 全文；Harbor 文档站子页（改仓库 mdx 成功）；`docs.smith.langchain.com` 轨迹页重定向（改 `langchain-ai/docs` 仓 mdx）；Langfuse 文档需加 `.md` 后缀；`tbench.ai/docs/*` 子页 404。

---

## 附录 B：来源

**方法论正本**
- https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents （2026-01-09）
- https://claude.dev/blog/automating-eval-design-and-hillclimbing/ （2026-09-28）

**S2 harness / 平台（按节序）**
- Inspect：https://inspect.aisi.org.uk/ 、 `/datasets.html`、`/scorers.html`、`/metrics.html`、`/agents.html`、`/agent-bridge.html`、`/evals/index.html`
- promptfoo：https://www.promptfoo.dev/docs/configuration/expected-outputs/ 、 `/expected-outputs/model-graded/`
- DeepEval：https://docs.confident-ai.com/docs/metrics-introduction 、 `/metrics-tool-correctness`
- Braintrust：https://www.braintrust.dev/docs/guides/evals 、 `/evaluate/llm-as-a-judge`
- LangSmith：https://docs.smith.langchain.com/evaluation 、 `/langsmith/decision-model-evaluator` 、 https://github.com/langchain-ai/agentevals
- Langfuse：https://langfuse.com/docs/evaluation/overview.md 、 `/evaluation/evaluation-methods/jev-as-a-judge.md` 、 `/evaluation/scores/score-analytics.md`
- Arize：https://docs.arize.com/phoenix/evaluation/evals 、 https://arize.com/docs/ax/evaluate/evaluators/trace-and-session-evals/trace-level-evaluations/agent-trajectory-evaluations
- Harbor：https://github.com/harbor-framework/harbor （`docs-mintlify/core-concepts/*.mdx`、`rfcs/0001-trajectory-format.md`）、 https://www.tbench.ai/
- 厂商：https://openai.com/index/introducing-agentkit/ 、 https://platform.openai.com/docs/guides/graders 、 https://deploymentsafety.openai.com/gpt-6-astra/evaluating-auto-review 、 https://cloud.google.com/vertex-ai/generative-ai/docs/models/evaluation-overview 、 https://cloud.google.com/gemini-enterprise-agent-platform/optimize/evaluation/agent-evaluation 、 https://google.github.io/adk-docs/evaluate/

**S3 统计**：https://arxiv.org/abs/2411.00640 、 https://arxiv.org/abs/2503.01747 、 https://arxiv.org/abs/2406.12045

**S4 judge 可靠性**：https://arxiv.org/abs/2306.05685 、 https://arxiv.org/abs/2406.07791 、 https://arxiv.org/abs/2410.21819 、 https://arxiv.org/abs/2403.18771 、 https://arxiv.org/abs/2504.14716 、 https://arxiv.org/abs/2404.18796

**S5 过程评测**：https://arxiv.org/abs/2505.08638 、 https://arxiv.org/abs/2602.02475 、 https://arxiv.org/abs/2603.14465 、 https://arxiv.org/abs/2410.10934 、 https://arxiv.org/abs/2605.02964 、 https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/

**S6 benchmark**：https://rdi.berkeley.edu/blog/trustworthy-benchmarks-cont/ 、 https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/ 、 https://arxiv.org/abs/2506.12286 、 https://scale.com/research/swe_bench_pro 、 https://www.swebench.com/ 、 https://github.com/SWE-bench/experiments/issues/462 、 https://github.com/sierra-research/tau-bench/issues/57 、 https://github.com/xlang-ai/OSWorld/issues/177

**S7 pi**：① 本地 `node_modules/.pnpm/@earendil-works+pi-*@0.86.0/**`（bundled types + `docs/` + `README.md`）；② 上游 monorepo `packages/evals`（经 `gh api repos/earendil-works/pi/contents/...` 读 `README.md` / `package.json` / `evals/smoke.eval.ts` / `evals/tui.docs.eval.ts`）

**S8 pacman**：`integration/eval/chief-dispatch/{stack,grade}.mts`、`run-eval.mts`、`.claude/hillclimb/chief-dispatch/{metrics.md,_state.json}`、`apps/daemon/src/backend/pi.ts`