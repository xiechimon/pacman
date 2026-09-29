# chief-dispatch 判分口径

被测对象：总管（Chief）对一个用户请求做出的**一个回合**的决策。判据读**环境终态**——
回合结束后隔离库里的行，不读 transcript（对 agent 类应用，transcript 是叙述，环境才是答案）。

## 指标

| id | 类型 | 定义 |
|---|---|---|
| `decision_ok` | binary（主指标） | 该派工的场景派对了 Agent；不该派工的场景确实没派工。见下方逐类规则。 |
| `receipt_ok` | binary | 工作约定第 4 条「派工后点名承接 Agent 的职责语义」——正文里出现被派 Agent 的显示名。不派工的场景只看正文非空。 |

### `decision_ok` 逐类规则

**派工类（`expect.kind = "dispatch"`）**：判 `run_builds` 被调用 **且** 新建 todo 行的
`assignment.build.agentId` 命中期望的 Agent。两个条件缺一不可——只调了工具但派错人、
或只建了 todo 没派工，都算 0。

**不派工类（`expect.kind = "hold"`）**：判 `run_builds` **未**被调用 **且** 该回合有非空正文
且步状态为 `done`。第三个条件是为了堵「无回答 ≠ 否定回答」：一个被截断或被打断的空回合
不得因为「没派工」而被判通过。

## 为什么主指标是「派给谁」而不是「派没派」

`工作约定` 把「措辞→spec→按职责文本选 Agent」定成总管的中心职责。派给谁这一项：
可程序化判定（读 `todo.assignment`，无需裁判）、有天然的正反例（该派 / 不该派）、
且要改的面（系统提示词里的分派规则 + `run_builds` 的 description）便宜可回滚、指标与
改动面直接耦合——正好落在 hillclimb 的三条适用判据上。

## 场景编制（roster）

四个 Agent 用**花名**（阿岚 / 老周 / 小柯 / 铁手），分类信息只存在于 `description` 里。
这是刻意的：显示名若写成「文档专职」这类，模型不读职责文本也能全对，评测会贴天花板，
后续只能冲成本、冲不了质量。

模型分配：老周 → glm-5.3，小柯 → kimi-k3，阿岚 → qwen3.8-max，铁手 → glm-5.3。
四个 Agent 用三个模型，`modelId` 与分类不一一对应，堵住「按模型名猜分类」这条捷径。
（四个 Agent 在评测里**从不被执行**，它们只是标签；真正被调用的是总管。）

## baseline 结果（glm-5.3，36 用例 × 3 reps，2026-09-29）

```
decision_ok  168/176 = 95.5%   95%CI [92.4%, 98.5%]
原有 36 条 100/105 = 95.2%   新增 28 条 68/71 = 95.8%
成本 $9.16   链路失败 16 条（8.3%，全 harness_error，已隔离不计分）
```

**这个评测已经饱和，测不出改进了。** 余量 4.5 个百分点小于底噪 ±7.5 个百分点。

为此做过一轮加难（36 → 64 条：诱饵路径 8 / 跨类别 6 / 症状归属 6 / 难负例 8），
并先在 `工作约定` 里补了三条对应判别规则以保证「可判」。**结果是加难失败**：
新增的 28 条得 95.8%，比原有的 95.2% 还高 0.6 个点。

失败的原因值得记下来：难例之所以难，通常是因为落在类别边界；而为了让边界可判、
两个专家会同判，就得把判别规则写进提示词——**规则一写进去，模型读规则套规则就
又是容易的了**。难度没有转移到边界判断，只是换了一批「读规则做题」。

结论：派发决策这件事本身对该模型不难。规则写清、编制干净的前提下它近乎全对。
这个评测的有效用法不是能力爬坡的尺子，而是**回归门**（改动后路由是否还正确），
以及下面那条真实缺陷的验证器。

### 失败形态

真失败 6 行 / 5 个 case，两类：

1. **名字与 id 不一致**（o01、o02、o06，共 4 行）——四类里最值得追的一条：
   正文从头到尾写对了（「派给运维职责的 [铁手](agent:X)」），但它引用的 X 是
   **前端 Agent 的 id**。名字与 id 对不上。任何读 transcript 的裁判都会给这几条
   打满分，只有读环境终态才露馅。根因大概率是四条 Agent 被
   `composeChiefSystemPrompt` 压成一行 JSON，加上两个 Agent 共用同一个 `modelId`，
   模型在做 id↔名字对应时错位。
2. **该派而未派 / 无正文**（c03 各 1/3、n12 1/3）：前者做完了探测与建任务却没调
   `run_builds`；后者做了 5 次读侧调用但没吐任何正文——按「无回答 ≠ 否定回答」，
   空回合不得因为「没派工」被判通过。

## 已修复：名字/id 错位（2026-09-29）

上面第 1 类失败查实为产品缺陷，已修，并用本评测验证：

- **成因**：`composeChiefSystemPrompt` 把 agents 清单压成一整行 JSON，分派变成
  在密集条目里数位置抄 id。失败呈现系统性「往前错一位」——该派最后一个 Agent
  （铁手），实际派了它前面那个（小柯），而回执正文里名字仍然写对。
  另有一个放大器：helpers 会给每个测试栈 seed 一个集成测试用 Agent
  （`agent-it-1`），它不属于场景编制却出现在清单里，多一个错位机会。
- **修法**：agents 改成一行一个、名字与 id 相邻；场景侧清掉那个遗留 Agent；
  并给 `run_builds` 加 `requireTeamAgent`——不存在的 agentId 抛错经 relay 回到
  模型眼前（此前是静默落库，直到构建跑起来才炸，而用户早已看到「已派工」）。

**验证**（同 9 条用例 × 3 reps，修复前取本轮 baseline 的同批行）：

| | 修复前 | 修复后 |
|---|---|---|
| 9 条合计 | 20/25 = 80% | 27/27 = 100% |
| 其中 ops 相关 7 条 | 15/19 | 21/21 |

若错位率不变（21%），21 次全对的偶然概率约 0.7%。

**注意：本文件上面的 baseline 数字早于这次修复**（`harness_sha` 也已随之失效，
重跑需 `--approve-harness`）。要一份与当前代码一致的基线需重跑全量。

### 计分边界：哪些回合不算分

链路失败**一律落 `errors.jsonl`，绝不计分**。两种实测形态都必须在 runner 里拦掉，
否则失败会集中到某几条用例上，看起来像「模型系统性不会做这件事」：

1. **零 token**：回合根本没跑到模型（延迟整齐卡在 ~30s 的超时特征）。
2. **`step != done`**：模型跑了、也出了话，但步以失败收场。**只看 token 抓不到
   这一种**——有过某条用例 3/3 全是 failed step，被误读成「它系统性地不派工」，
   实际是链路问题。

## 怎么跑

凭据：relay key 取 `PACMAN_EVAL_RELAY_KEY`，缺省回落 `~/.claude/settings.json`
的 `env.ANTHROPIC_AUTH_TOKEN`。relay 地址可用 `PACMAN_EVAL_RELAY_URL` 覆盖。
密钥只在进程内持有，不落盘、不进仓。

```sh
# 全量 baseline（36 用例 × 3 reps，约 $5 / 35 分钟）
pnpm --filter @pacman/integration exec tsx eval/chief-dispatch/run-eval.mts \
  --flow .claude/hillclimb/chief-dispatch --variant baseline --model glm-5.3 --reps 3

# 出报告 → .claude/hillclimb/chief-dispatch/report.html
node integration/eval/chief-dispatch/build-report-lite.mts .claude/hillclimb/chief-dispatch/
```

改动 harness（runner / judgeCase / cases.json / 场景种子 / `chief.ts`）后，
下一次运行会因 `harness_sha` 不符而拒绝——这是刻意的：重跑前先看 diff，
再带 `--approve-harness` 放行。跑挂了直接重跑即可，已完成的 (case,rep) 会跳过。

## 诊断入口

| 脚本 | 用途 |
|---|---|
| `oracle-check.mts` | 判分链自检（oracle 必过 / null 必挂 / misroute 必挂），不花钱 |
| `verify-seed.mts` | 摊开场景裸仓的完整文件树，验种子有没有真进仓，不花钱 |
| `debug-one.mts <flow> <caseId>` | 跑单条用例并打印 roster→agentId 映射、run_builds 实参、todo 落库、正文点名 |

## 已知缺口（如实记录，不掩盖）

1. **截断只能靠征兆判定。** pacman 目前不上报模型的 `finish_reason`，runner 只能用
   「回合正常结束但既无工具调用也无正文」当截断特征。这会把截断和「模型主动不作为」
   混在一起。修法是让 daemon 在 step 事件/transcript 里带上 `stop_reason`（加法改动）。
2. **served-model 断言较弱。** 模型 id 取自 `token_usage.model`，是 pacman 自己记的账，
   不是上游响应回显的——它能发现「daemon 选了别的模型」，发现不了 relay 静默换模型。
3. **relay 不报成本。** `cost_usd` 按 OpenRouter 挂牌价现算，不是账单实测值。
4. **链路失败率约 5%。** 108 回合里 5 条没跑到模型（零 token）或 `fetch failed`。
   已落 errors.jsonl 不计分，但重复跑会缺格。

## relay 可用性（2026-09-29 实测，四类请求各一次）

| 模型 | 应答 | 出工具调用 | 中位延迟 | 结论 |
|---|---|---|---|---|
| `kimi-k3` | 4/4 | 4/4 | 22.1s | 可用 |
| `glm-5.3` | 4/4 | 4/4 | 18.3s | 可用，推理最重 |
| `qwen3.8-max` | 4/4 | 4/4 | 11.6s | 可用 |
| `deepseek-v4-pro` | 2/4 | 1/4 | — | 不稳（502 上游断流） |
| `gpt-5.6-luna` | 0/4 | 0/4 | — | 不可用（relay 未配账号） |