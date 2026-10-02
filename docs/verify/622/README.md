# #622 证据索引——claude-code 第二运行时最小闭环（spec 17 T1）

日期 2026-10-02。live 全栈真路径：verify-pacman 隔离栈（server 8793 + vite dev
5275 + scratch PACMAN_HOME）+ 真 daemon（worktree 代码，`verify-622-mbp` 机器名，
真实 HOME——claude 认证机器本地，spec 17 失败方式 2 环境契约；代理 env 保留给
claude CLI 外联，daemon→server 回环走 loopback no-proxy）。

## 断言面（probe 32 项，两栈对照）

- **A 闭环**：claude-code agent（provider='claude-code', modelId='sonnet'）→
  withPlan 派发 → plan 步 claim → claude 后端真执行 → 步 done 携 sessionId →
  plan.md 交接落库（build.planDocId + plan 行 875 字符）→ todo 相位 confirm →
  token_usage 行 `claude-code/<model>` 四维计数 → SDK transcript（CLI 自有
  store `~/.claude/projects/<slug>/<sessionId>.jsonl`）含 assistant text 行 +
  toolcall 行（Bash/Write/Read native 工具真执行）。
- **B resume**：confirm → build 步 claim 收 continue → SDK resume 续同一会话：
  build 步 sessionId === plan 步、transcript 行数 40 → 75 增长、daemon log
  「continue session」canon 行；conv 分支 `pacman/conv-<buildId>` 推回用户仓
  （XMON-77 推送闸放行）+ poem.txt 真产物在分支上 + message 表 transcript 行。
- **C pi 混跑零回归**：同栈同 daemon，stub LLM（openai-completions SSE）pi
  agent 走同链——plan/build 步 done、usage 行 `r3-stub/stub-model`、conv 分支
  真产物。
- **before 面**（origin/main ee636a5 一次性 worktree 栈，同 seed/派发）：plan
  步 failed，errorMessage `model claude-code/sonnet not found`——pi 后端不识
  runtime 身份的起点事实。

## 场景复现（before/after 同一脚本）

1. seed：agent(claude-code) → 本机 git 用户仓（local 形态 clone 源 + conv 分支
   回读面）→ project → todo（spec 显式要求先写 plan.md——首轮规划步 prompt =
   title+spec 原文，plan.md 指令由 spec 表达，#612 词表）→ api-key（明文只落
   /tmp prep 文件，不进证据）。
2. 段间起 daemon（真实 HOME + scratch PACMAN_HOME），再跑 run：派发 → 等 plan
   步终态 → plan.md/usage/transcript 断言 → confirm → 等 build 步终态 →
   resume 三证（sessionId 相等 + transcript 增长 + canon 行）+ 分支/产物断言 →
   pi 混跑（stub provider + pi agent 全链）。
3. before 面 `run --before`：同流，断言步 failed + 原因含 claude-code。

## 文件

| 文件 | 内容 |
| --- | --- |
| probe-claude-code-worker.mjs | 定制 probe（seed/run 两段；断言对照图 + 环境契约见文件头） |
| before-result.json | before 面 5 项检查（origin/main：plan 步 failed，`model claude-code/sonnet not found`） |
| before-responses.json | before 面 API 载荷记录 |
| before-daemon-log.txt | before 面 daemon log 摘录（失败现场） |
| after-result.json | after 面 32 项检查全 PASS（A/B/C 三面断言明细） |
| after-responses.json | after 面 API 载荷记录（无凭据） |
| after-daemon-log.txt | after 面 daemon log 摘录（canon 行 + [runtime] 降级行 + pushed 收尾行） |
| after-transcript.json | SDK transcript 摘录：toolUses（Bash/Write/Read）、行数 40 → 75、assistant 文本样例 |

## 关键事实

- resume 预检的 transcript 路径过 realpath（macOS /tmp → /private/tmp，CLI 子
  进程 cwd 由内核解析符号链接，slug 按解析后路径计）——不解析则 /tmp 起头工作
  区预检恒 miss，resume 回退冷启。失败方式 10/11 已固化单测
  （apps/daemon/test/claude-transcript-path.test.ts）。
- pi 回归独立复核：integration g2t2（2/2）+ m3b（4/4）同分支代码全绿。
