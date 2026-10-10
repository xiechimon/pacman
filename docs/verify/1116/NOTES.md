# #1116 skills 目录预算换轨 —— 验证证据索引

票：#1116（skills: 目录 50 条上限把一半技能静默丢掉）。用户 2026-10-10 裁决：
口径 (b) 字节预算 + (c) 按 agent 绑定；票面 ①（截顶非静默：能看出丢了谁、能
排序/置顶）②（镜像重叠按去重后集合算预算并降噪）一并做。

机制类声称一律取运行时真值（仓规「机制生效验收:实物判据」）。本目录两组实物：

## 1. 真 buildSkillsCatalog 探针（票面场景复现）

- `probe-skills-budget.mts` —— 探针脚本。**真 daemon 源码**（`apps/daemon/
  src/backend/pi.ts` 的 `buildSkillsCatalog`，真 pi `loadSkills` 扫描、真
  `[skills]` 日志出口），fixture = 99 技能库 + 逐字节相同的团队镜像（单机
  server skillsDir = daemon skillsDir 的常见形——即用户票面场景）。三臂：
  arm1 默认预算 / arm2 预算覆写 900 字节 / arm3 纯本机。
  复现：`cd apps/daemon && corepack pnpm exec tsx ../../docs/verify/1116/probe-skills-budget.mts 900`。
- `probe-before-main.txt` —— origin/main（`49c4c4f7` 前沿）同脚本同参输出：
  - arm1：**99 行逐条 collision** + `cap: total=99 truncated=50` +
    `catalog: entries=50`——一半技能静默消失、无任何点名（= 用户贴回的
    daemon 日志原形）。
  - arm2：main 无预算参数，输出与 arm1 相同（budgetBytes 被旧签名忽略）。
- `probe-after-lane.txt` —— 本改动输出：
  - arm1：**1 行** `collision: 99 identical mirror(s) deduped (team view
    wins; budget counts the merged set once)`（99 行 → 1 行降噪②）+
    `catalog: entries=99 chars=21742 bytes=24118`——**99 条全量进目录**，
    omitted_note=absent（票面验收：agent 能看见全部）。
  - arm2：`budget: total=24118 budget=900 dropped=97: skill-02, …, skill-98`
    （逐名点名①）+ `entries=2` + **omitted_note=present**（目录尾
    `<omitted_skills>` 段——agent 自己也看得见少了谁）；留存的 2 条 =
    优先序前缀（skill-00/01），丢弃全在尾部。
  - arm3：纯本机 99 条同样全量（不依赖团队面）。

## 2. 单测（失败方式先固化，后实现）

`apps/daemon/test/skills-catalog.test.ts`（重写「cap 双闸」两 describe →
「catalog 字节预算」八态 +「团队镜像去重降噪」四态）与
`apps/daemon/test/skills-hard-block.test.ts`（catalog 观测行加 bytes 位）：

- 99 技能全量可见（默认预算零截顶）
- 超预算：尾部丢弃 + `budget:` 点名 + `<omitted_skills>` 段 + 被丢集合与
  note 集合一致
- 绑定序 = 优先序：allowlist/injected 数组顺序决定目录序与存活序（置顶 =
  调绑定序；扫描序盲切退役）
- 字节口径 = UTF-8 字节（CJK 诚实，自校准预算证明 .length 口径会漏判）
- description 不再截断（长路由描述全量，200 字闸退役）
- 预算装不下表头+首条 = 全丢但信号仍在
- identical mirror：一行汇总无逐条行 / 内容真冲突逐条行保留 / 预算按去重
  后集合算（镜像不双吃）
- 零回归金样（GOLDEN_CATALOG 逐字节）不动

跑法：`cd apps/daemon && corepack pnpm exec vitest run test/skills-catalog.test.ts test/skills-hard-block.test.ts`（70/70 绿）。

## 判定

票面验收「一台装了 99 个技能的机器：agent 要么能看见全部，要么明确知道
自己少看了哪些（有信号、有可操作的排序/置顶），不再静默丢一半」——**全量
分支**由 arm1/arm3 + 单测钉住；**少看分支**由 arm2 + 单测钉住（budget 行
点名 + 目录尾段双信号 + 绑定序即置顶操作面）。
