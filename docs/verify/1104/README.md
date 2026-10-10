# docs/verify/1104 — run_builds 无指派 build 静默卡死双修（#1104）

- probe：`scripts/drive-1104-unassigned-build.mjs`（verify-pacman skill 随 PR 提交，复跑配方见下）
- 结果：**15/15 PASS**（`result.json` 逐条对齐，探针两轮调通后第三轮全绿）
- 栈：worktree 一次性 verify 栈（server 8791 + vite dev 5273 + 独立 PACMAN_HOME scratch），零 daemon 零 LLM——chief 回合数据面与真机器同形（claim → tool relay → done 全走真 machine wire）。

## 四腿与验收对拍

| 腿 | 证据 | 验收条 |
|---|---|---|
| A chief relay | `a-chief-relay-400.json` | run_builds 漏/空 assignment → 400 文案可指导补正；补传后成功；400 不留半启动态（SQLite 对拍 phase=todo、零 build 零步） |
| B REST + claim 面 | `b-rest-claim-face.json` + `01-board-failed-card.png` + `02-detail-fail-row.png` | REST 空 assignment → 201 入队；claim 后步 failed + build.errorMessage 落「无指派 Agent」根因 + todo → failed；更晚入队的合法步同次 claim 照常领走（无队头阻塞）；看板/详情终态可见 |
| C scheduler | `c-scheduler-funnel.json` | 无指派 todo 定时触发（triggerSource=schedule）→ 同一失败收尾漏斗 |
| D 看板可见 | 两张 PNG | 失败卡片在「待处理」列；详情页失败行标题 = build.errorMessage 根因（r8 canon） |

单测面（`apps/server/test/unassigned-build.test.ts`）另覆盖失败方式 1–5 共 5 条，含已删 Agent 与指派齐全回归；server 831 + shared 306 + integration 66 全绿。

## 复跑配方

```sh
node .claude/skills/verify-pacman/scripts/cleanup.mjs   # 有旧栈先收
node .claude/skills/verify-pacman/scripts/launch.mjs    # 全新库
env -u http_proxy -u https_proxy -u all_proxy NO_PROXY='*' \
  node .claude/skills/verify-pacman/scripts/drive-1104-unassigned-build.mjs
```

## 实测坑

- once 档 `at` 必须钉 **00/15/30/45** 四档分钟（`assertMinuteStep`，r5 §8）——取上一整刻钟才不 400；「上一整分钟」不够。
- 机器 done 的 wire 词表是 `success|failed|stopped`；DB 步终态词 `done` 别混进请求体（920 gotcha 的反向面）。
