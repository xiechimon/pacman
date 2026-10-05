# #880 判因：`waitChip(/规划中/)` 要求 UI 采样到一个亚秒瞬态——oracle 不成立，非产品缺陷

## 结论一句话

驳回支线的服务端 planning 窗口在 stub 下只有 **175~375ms**，而相位 chip 是**纯采样面**
（SSE 事件只作失效提示，chip 文案 = todo 查询快照的 `PHASE_UI` 映射）；2vCPU CI 负载下
「SSE→invalidate→refetch→响应构建」往返恒超过窗口，每次采样构建时相位都已翻回
confirm——DOM **从未渲染过**「规划中」，150s×303 次轮询全部看到「确认」。这是
**测试 oracle 断言了一个架构上不保证可观察的瞬态**，不是 UI 刷新链故障。

## 判据一：今日三次 CI 命中的 dump 签名完全一致

| 命中 | run（att1） | 修订步创建 | v2 落库 | planning 窗口 | 超时时刻 UI chip | 超时时刻 server 相位 |
| --- | --- | --- | --- | --- | --- | --- |
| PR #876 车道 | 37259164634 | @…631708 | @…631927 | **219ms** | `"确认"` | `confirm` |
| #876 合入后 main | 37262325352 | @…521275 | @…521483 | **208ms** | `"确认"` | `confirm` |
| PR #879 | 37272143997 | @…496639 | @…496814 | **175ms** | `"确认"` | `confirm` |

原始 dump：`ci-dumps-2026-10-05.log`（含 #879 的 Playwright 失败块——与 #880 票面引文
逐字节同形：`Expected pattern: /规划中/`、`Received string: "确认"`、`303 × locator
resolved`）。三例的 DB 真值都是 plans 2 条（v1+v2）、steps 2 条 plan/done——**服务端
驳回回路全部正确走完**，UI chip 显示的「确认」正是超时时刻的真实相位。chip 没有停更、
没有陈旧值：它从头到尾都在显示正确的当前态，只是「规划中」这个中间态从未被任何一次
采样捕捉到。

## 判据二：机制复现（确定性，注入采样延迟）

代码链（全部 main 现行码）：

- `apps/web/src/detail/dhead.tsx:62-63`：chip 文案 = `PHASE_UI[phase ?? todo.phase].chip`；
  live 面 `phaseOverride` 恒 null（`todo-detail-page.tsx:502`），数据源 = `useTodo`。
- `apps/web/src/api/hooks.ts:177-182`：`useTodo` → `GET /api/todos/<id>` 快照。
- `apps/web/src/api/sse.ts:2`：S8 canon——「SSE 事件仅作 invalidateQueries 提示信号」，
  相位不经事件载荷直渲。

⇒ chip 能显示「规划中」的唯一途径：某次 `/api/todos/<id>` 响应**在 planning 窗口内构建**。
窗口 < 采样往返时，物理上不可能。

复现（`repro-spec.ts.txt`，归档自一次性 spec；跑法见文末）：在 confirm 关口后对
`**/api/todos/*` 注入 600ms 请求延迟（> 实测窗口 175~375ms，< 所有 30s 预算），模拟
CI 的「采样往返 > 窗口」：

- `ORACLE_880=old`（原 oracle `waitChip(/规划中/)`)：**2/2 红**，失败签名与 CI 逐字一致
  （`repro-injected-old-oracle-run1.log` / `run2.log`）。
- `ORACLE_880=new`（持久证据 oracle，与本 PR 对真测试的改法同款）：**1/1 绿**，驳回
  回路全链走完（驳回气泡 → plan 卡 v2 → 版本 chip v2 → DB 修订步 → 确认 → 审核关口），
  7.3s（`repro-injected-new-oracle-run1.log`）。

## 判据三：本地限核自然复现 = 0 命中（与历史一致）

macOS（M2，8 核）上用有界燃烧器限核（固定数量 + 45min 寿命上限 + 收尾 kill + pgrep
自检）：6 燃烧器 1 轮、14 燃烧器 1 轮（修前码），均绿（`starve-pre-fix-*.log`）；修后
10 轮 @ 6 燃烧器见 `starve-post-fix.log`。本地自然命中率 **0/12**——与 #698 的
20 轮零复现、#767 的 5 轮全绿一致。原因：macOS 调度器对突发进程给足核时，而 CI 的
条件是**全栈**（vitest+server+daemon+chromium）挤 2 vCPU，每个环节的毫秒级延迟同时
被拉长——本地限核造不出同形条件，故确定性证据面走判据二的注入复现。

## 为什么 #767 没修掉它

#767 修的是**失效丢失**（挂载取数在飞时 invalidate 被 react-query 去重吞掉，chip 停在
陈旧值）——那条路径下 chip 显示的是**过期**相位。本签名是另一条独立路径：失效没丢、
重取也发生了，但**采样时刻晚于窗口关闭**，chip 显示的是**新鲜且正确**的 confirm。
#767 判因文档当时已点名此形态（「亚秒瞬态在采样式架构下不可观察……此形态不是失效
丢失」）并列为「留待裁决 1」，推荐选项 a（oracle 改钉持久证据）；本 PR 即执行该裁决。

## 产品面判定：无缺陷

真实 LLM 下 planning 窗口是几十秒，用户必然看得见「规划中」；stub 的 200ms 窗口是
测试装置自身造出来的。三层看护（XMON-60 对账 / #462 看门狗 / seq 空洞）与此无关——
UI 与服务端全程一致，没有任何状态丢失。若产品要求「瞬态相位保证可见」（选项 b：
事件载荷直渲 + 最小展示时长），那是动 S8 canon 的产品变更，需单独立票；本修复不
排除该选项。

## 修复

`integration/test/m5-web-e2e.test.ts` 驳回支线：

- 删 `waitChip(/规划中/)` 与其后的冗余 `waitChip(/确认/)`（chip 从未离开「确认」，
  后者在故障形态下立即假通过，无判别力）。
- 改钉持久证据链：**驳回气泡**（发送即落库，替代原瞬态断言的「驳回已受理」语义）→
  **plan 卡 v2** → **版本 chip v2**（30s 预算，本文件跨进程断言统一口径）→ 新增
  **DB 修订步断言**（第二个 plan 步行 = 相位确实重入规划过的服务端真值，补上
  「规划中」原本承载的 r5 §4 覆盖）。
- `waitChip` 保留给持久关口（确认/审核/已完成——这些相位停留到用户动作，采样必然命中）。

## 复跑方法

```sh
# 机制复现（一次性 spec，未进测试套件）：
cp docs/verify/880/repro-spec.ts.txt integration/test/scratch-880-repro.test.ts
cd integration
ORACLE_880=old pnpm exec vitest run test/scratch-880-repro.test.ts   # 红：CI 同签名
ORACLE_880=new pnpm exec vitest run test/scratch-880-repro.test.ts   # 绿：修复有效
rm integration/test/scratch-880-repro.test.ts

# 修复后的真测试：
cd integration && pnpm exec vitest run test/m5-web-e2e.test.ts       # 3/3
```
